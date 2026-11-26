import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import brandConfig from '../../brandConfig';
import clientesService from '../../services/clientesService';
import { inventarioService } from '../../services/inventarioService';
import rentaService from '../../services/rentaService';
import api from '../../services/api';

const navItems = [
  { name: 'Inicio', path: '/', icon: 'home' },
  { name: 'Ventas', path: '/pos', icon: 'point_of_sale' },
  { name: 'Devoluciones', path: '/devoluciones', icon: 'assignment_return' },
  { name: 'Inventario', path: '/inventario', icon: 'inventory_2' },
  { name: 'Clientes', path: '/clientes', icon: 'group' },
  { name: 'Marcas', path: '/marcas', icon: 'loyalty' },
  { name: 'Renta', path: '/renta', icon: 'payments' },
  { name: 'Recepción', path: '/recepcion', icon: 'move_to_inbox' },
  { name: 'Bajas y retiros', path: '/bajas-retiros', icon: 'outbox' },
  { name: 'Cierre de caja', path: '/cierre-caja', icon: 'lock_clock' },
  { name: 'Reportes y liquidaciones', path: '/liquidaciones', icon: 'bar_chart' },
  { name: 'Configuración', path: '/admin', icon: 'settings' },
];

function Sidebar({ user, onLogout, open, onClose }) {
  const [rentPending, setRentPending] = useState(false);
  const visibleNavItems = navItems.filter((item) =>
    item.path !== '/admin' || /admin|administrador/i.test(user?.role || '')
  );

  useEffect(() => {
    let active = true;
    const refreshRentStatus = async () => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
        timeZone: 'America/Managua', year: 'numeric', month: '2-digit',
      }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
      try {
        const data = await rentaService.listar(`${parts.year}-${parts.month}`);
        if (active) setRentPending(Number(data.resumen?.saldo_pendiente) > 0 || Number(data.resumen?.vencidas_total) > 0);
      } catch {
        if (active) setRentPending(false);
      }
    };
    refreshRentStatus();
    const interval = window.setInterval(refreshRentStatus, 60_000);
    window.addEventListener('renta-updated', refreshRentStatus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('renta-updated', refreshRentStatus);
    };
  }, []);

  return (
    <>
      {open && <button type="button" aria-label="Cerrar menú" onClick={onClose} className="fixed inset-0 z-40 bg-[#382E29]/35 md:hidden" />}
      <aside style={{ backgroundColor: '#fff' }} className={`sidebar-scrollbar-hidden fixed inset-y-0 left-0 z-50 flex h-dvh w-[238px] flex-col overflow-y-auto border-r border-stone-200 !bg-white px-3 py-5 shadow-lg transition-transform max-[700px]:py-3 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div>
          <div className="mb-7 flex flex-col items-center gap-3 px-2 text-center max-[700px]:mb-3 max-[700px]:gap-1.5">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-stone-200 bg-white max-[700px]:h-10 max-[700px]:w-10">
              <img src={brandConfig.logo.main} alt={`Logo de ${brandConfig.name}`} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="break-words font-headline-sm text-lg font-semibold text-on-surface">{brandConfig.name}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-on-surface-variant">Sistema de gestión</p>
            </div>
          </div>

          <nav aria-label="Navegación principal" className="flex flex-col gap-1">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onClose}
                className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors max-[700px]:py-1.5 ${isActive ? 'bg-primary-fixed font-semibold text-on-surface shadow-sm' : 'text-on-surface-variant hover:bg-stone-50 hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span>{item.name}</span>
                {item.path === '/renta' && rentPending && <span aria-label="Hay rentas pendientes" title="Hay rentas pendientes" className="ml-auto h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
              </NavLink>
            ))}
          </nav>
        </div>

      </aside>
    </>
  );
}

function Header({ user, onMenuOpen, onLogout }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState({ products: [], clients: [] });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSearchResults({ products: [], clients: [] });
      setSearching(false);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const [productsResult, clientsResult] = await Promise.allSettled([
        inventarioService.getAll({ search: term }),
        clientesService.getAll({ buscar: term, limite: 6 }),
      ]);
      if (active) {
        setSearchResults({
          products: productsResult.status === 'fulfilled' ? productsResult.value.slice(0, 6) : [],
          clients: clientsResult.status === 'fulfilled' ? clientsResult.value.slice(0, 6) : [],
        });
        setSearching(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  const openProduct = (product) => {
    navigate('/inventario', { state: { globalSearch: product.sku || product.codigo_qr || product.nombre } });
    setSearchOpen(false);
    setQuery('');
  };

  const openClient = (client) => {
    navigate('/clientes', { state: { globalSearch: client.nombre_cliente } });
    setSearchOpen(false);
    setQuery('');
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (passwords.new_password !== passwords.confirm_password) {
      setPasswordError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setPasswordSaving(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswordSuccess(data.message);
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'No se pudo actualizar la contraseña. Intenta de nuevo.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <>
    <header className="fixed left-0 right-0 top-0 z-30 flex h-[68px] items-center justify-between gap-3 border-b border-primary-fixed-dim/50 bg-white/95 px-4 backdrop-blur-xl md:left-[238px] md:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button type="button" aria-label="Abrir menú" onClick={onMenuOpen} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container-low md:hidden">
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="relative hidden w-full max-w-md sm:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[19px]">search</span>
          <input
            aria-label="Buscar productos, códigos o clientes"
            aria-expanded={searchOpen && query.trim().length >= 2}
            aria-controls="global-search-results"
            role="combobox"
            autoComplete="off"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setSearchOpen(true);
              setSearching(value.trim().length >= 2);
              if (value.trim().length < 2) setSearchResults({ products: [], clients: [] });
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
              if (event.key === 'Enter' && searchResults.products[0]) openProduct(searchResults.products[0]);
              else if (event.key === 'Enter' && searchResults.clients[0]) openClient(searchResults.clients[0]);
            }}
            className="h-10 w-full rounded-xl border border-primary-fixed-dim/40 bg-surface px-10 text-sm text-on-surface placeholder:text-on-surface-variant/80 focus:outline-none focus:ring-2 focus:ring-primary/25"
            placeholder="Buscar producto, código o cliente..."
            type="search"
          />
          {searchOpen && query.trim().length >= 2 && <div id="global-search-results" role="listbox" className="absolute left-0 right-0 top-full z-[80] mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-xl">
            {searching ? <p className="px-3 py-2 text-sm text-on-surface-variant">Buscando…</p> : <>
              {searchResults.products.length > 0 && <>
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Productos</p>
                {searchResults.products.map((product) => <button key={`product-${product.id}`} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => openProduct(product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-primary-fixed/40">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium text-on-surface">{product.nombre}</span><span className="block truncate text-xs text-on-surface-variant">{product.sku || product.codigo_qr || 'Sin código'} · {product.marca_nombre || 'General'}</span></span>
                  <span className="shrink-0 text-xs font-semibold text-on-surface">{product.stock_actual} disp.</span>
                </button>)}
              </>}
              {searchResults.clients.length > 0 && <>
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Clientes</p>
                {searchResults.clients.map((client) => <button key={`client-${client.id}`} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => openClient(client)} className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-primary-fixed/40">
                  <span className="text-sm font-medium text-on-surface">{client.nombre_cliente}</span><span className="text-xs text-on-surface-variant">{client.telefono || client.correo || 'Cliente registrado'}</span>
                </button>)}
              </>}
              {!searchResults.products.length && !searchResults.clients.length && <p className="px-3 py-3 text-sm text-on-surface-variant">No se encontraron productos ni clientes.</p>}
            </>}
          </div>}
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-2 sm:gap-4">
        <button type="button" aria-label="Notificaciones" className="relative grid h-10 w-10 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container-low">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </button>
        <button
          type="button"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          aria-label="Opciones de usuario"
          aria-expanded={userMenuOpen}
          className="flex items-center gap-2 rounded-xl p-1.5 text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-on-surface">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold leading-tight text-on-surface">{user?.name || 'Administrador'}</span>
            <span className="block text-xs text-on-surface-variant">{user?.role || 'Administrador'}</span>
          </span>
          <span className="material-symbols-outlined px-1 text-[19px]">expand_more</span>
        </button>
        {userMenuOpen && <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
          <button type="button" onClick={() => { setUserMenuOpen(false); setPasswordError(''); setPasswordSuccess(''); setChangePasswordOpen(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[18px]">key</span>Cambiar contraseña
          </button>
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-on-surface hover:bg-surface-container-low">
            <span className="material-symbols-outlined text-[18px]">logout</span>Cerrar sesión
          </button>
        </div>}
      </div>
    </header>
    {changePasswordOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !passwordSaving) setChangePasswordOpen(false); }}>
      <form onSubmit={changePassword} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><h2 className="text-xl font-bold text-on-surface">Cambiar contraseña</h2><p className="mt-1 text-sm text-on-surface-variant">Confirma tu contraseña actual y escribe una nueva de al menos 8 caracteres.</p></div>
        {passwordError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{passwordError}</div>}
        {passwordSuccess && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{passwordSuccess}</div>}
        <label className="block text-sm font-medium text-on-surface">Contraseña actual<input required minLength="1" maxLength="72" autoComplete="current-password" type="password" value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5 font-normal outline-none focus:border-primary" /></label>
        <label className="block text-sm font-medium text-on-surface">Nueva contraseña<input required minLength="8" maxLength="72" autoComplete="new-password" type="password" value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5 font-normal outline-none focus:border-primary" /></label>
        <label className="block text-sm font-medium text-on-surface">Confirmar contraseña nueva<input required minLength="8" maxLength="72" autoComplete="new-password" type="password" value={passwords.confirm_password} onChange={(event) => setPasswords({ ...passwords, confirm_password: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5 font-normal outline-none focus:border-primary" /></label>
        <div className="flex justify-end gap-2"><button type="button" disabled={passwordSaving} onClick={() => setChangePasswordOpen(false)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm">Cerrar</button>{!passwordSuccess && <button type="submit" disabled={passwordSaving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{passwordSaving ? 'Guardando…' : 'Actualizar contraseña'}</button>}</div>
      </form>
    </div>}
    </>
  );
}

export const Layout = ({ children, user, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <Sidebar user={user} onLogout={onLogout} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Header user={user} onMenuOpen={() => setMenuOpen(true)} onLogout={onLogout} />
      <main className="min-h-screen bg-background px-4 pb-8 pt-[88px] text-on-surface sm:px-6 md:ml-[238px] md:px-8 md:pt-[92px]">
        {children}
      </main>
    </>
  );
};
