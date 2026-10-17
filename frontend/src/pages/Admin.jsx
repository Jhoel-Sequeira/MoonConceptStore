import React, { useCallback, useEffect, useMemo, useState } from 'react';
import adminService from '../services/adminService';

const DEFAULT_ROLES = [
  'Administrador General',
  'Cajero / Operador POS',
  'Gestor de Marca',
  'Auditor de Inventario',
];

const emptyForm = () => ({
  nombre: '',
  email: '',
  usuario: '',
  password: '',
  confirmPassword: '',
  rol: 'Cajero / Operador POS',
});

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

function getErrorMessage(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join('. ');
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [credentialsToShare, setCredentialsToShare] = useState(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadUsers = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const result = await adminService.listUsers();
      setUsers(result.users || []);
      setRoles([...new Set([...(result.roles?.length ? result.roles : DEFAULT_ROLES), ...(result.users || []).map((user) => user.rol)])]);
      setActiveCount(result.active || 0);
      setTotalCount(result.total || 0);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => users.filter((user) => {
    const queryMatch = normalize(`${user.nombre} ${user.email} ${user.usuario} ${user.rol}`).includes(normalize(searchQuery));
    const roleMatch = roleFilter === 'all' || user.rol === roleFilter;
    const statusMatch = statusFilter === 'all' || (statusFilter === 'active' ? user.estado === 'Activo' : user.estado !== 'Activo');
    return queryMatch && roleMatch && statusMatch;
  }), [users, searchQuery, roleFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setForm({ nombre: user.nombre, email: user.email, usuario: user.usuario, password: '', confirmPassword: '', rol: roles.includes(user.rol) ? user.rol : DEFAULT_ROLES[1] });
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if ((!editingUser || form.password) && form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden. Verifica ambas e inténtalo de nuevo.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { confirmPassword, ...formData } = form;
      const payload = { ...formData, nombre: form.nombre.trim(), email: form.email.trim(), usuario: form.usuario.trim() };
      if (editingUser) {
        if (!payload.password) delete payload.password;
        await adminService.updateUser(editingUser.id, payload);
        setNotice(`Se actualizaron los datos de ${payload.nombre}.`);
      } else {
        await adminService.createUser(payload);
        setCredentialsToShare({ nombre: payload.nombre, email: payload.email, usuario: payload.usuario, password: payload.password });
        setCredentialsCopied(false);
        setNotice(`Se creó el usuario ${payload.nombre}. Comparte sus credenciales de forma segura.`);
      }
      setShowModal(false);
      await loadUsers(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const credentialsMessage = credentialsToShare && [
    `Acceso a Moon Concept Store para ${credentialsToShare.nombre}`,
    `Usuario: ${credentialsToShare.usuario}`,
    `Correo: ${credentialsToShare.email}`,
    `Contraseña: ${credentialsToShare.password}`,
    'Guarda estas credenciales en un lugar seguro.',
  ].join('\n');

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(credentialsMessage);
      setCredentialsCopied(true);
      setError('');
    } catch {
      setError('No se pudo copiar. Selecciona las credenciales y cópialas manualmente.');
    }
  };

  const toggleUserStatus = async (user) => {
    const activate = user.estado !== 'Activo';
    if (!activate && !window.confirm(`¿Desactivar la cuenta de ${user.nombre}? Ya no podrá iniciar sesión.`)) return;
    setError('');
    setNotice('');
    try {
      await adminService.setUserActive(user.id, activate);
      setNotice(activate ? `Se activó la cuenta de ${user.nombre}.` : `Se desactivó la cuenta de ${user.nombre}.`);
      await loadUsers(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <header className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-lowest p-2.5 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-on-primary"><span className="material-symbols-outlined text-[20px]">admin_panel_settings</span></span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-on-surface">Usuarios y permisos</h1>
            <p className="mt-0.5 text-xs text-on-surface-variant">Crea cuentas, asigna roles y controla el acceso al sistema.</p>
          </div>
        </div>
        <button type="button" onClick={openCreateModal} className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg bg-primary px-3.5 text-sm font-semibold text-on-primary shadow-sm hover:opacity-95 sm:self-center">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Crear usuario
        </button>
      </header>

      {error && <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-error/20 bg-error-container/40 px-4 py-3 text-sm text-on-surface"><span>{error}</span><button type="button" onClick={() => loadUsers()} className="shrink-0 font-semibold text-primary hover:underline">Reintentar</button></div>}
      {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-secondary/20 bg-secondary-fixed/30 px-4 py-3 text-sm text-on-surface"><span>{notice}</span><button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice('')} className="material-symbols-outlined text-[18px]">close</button></div>}

      <section aria-label="Resumen de usuarios" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="flex items-center gap-3 rounded-2xl border border-primary-fixed-dim/25 bg-white p-4 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-fixed text-primary"><span className="material-symbols-outlined">group</span></span>
          <div><p className="text-sm text-on-surface-variant">Cuentas registradas</p><p className="text-2xl font-semibold text-on-surface">{loading ? '—' : totalCount}</p></div>
        </article>
        <article className="flex items-center gap-3 rounded-2xl border border-primary-fixed-dim/25 bg-white p-4 shadow-sm">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary-fixed/50 text-secondary"><span className="material-symbols-outlined">verified_user</span></span>
          <div><p className="text-sm text-on-surface-variant">Cuentas activas</p><p className="text-2xl font-semibold text-on-surface">{loading ? '—' : activeCount}</p></div>
        </article>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-white p-3.5 shadow-sm sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input aria-label="Buscar usuarios" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar por nombre, usuario, correo o rol" className="h-10 w-full rounded-lg bg-surface-container-low pl-9 pr-3 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary" />
        </label>
        <select aria-label="Filtrar por rol" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-10 rounded-lg bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary">
          <option value="all">Todos los roles</option>
          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg bg-surface-container-low px-3 text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button type="button" onClick={() => loadUsers()} disabled={loading} title="Actualizar lista" aria-label="Actualizar lista" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-container-low text-primary hover:bg-surface-container disabled:opacity-50"><span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span></button>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-container-low px-4 py-3">
          <h2 className="font-semibold text-on-surface">Cuentas de usuario</h2>
          <span className="text-sm text-on-surface-variant">{filteredUsers.length} resultados</span>
        </div>
        {loading ? (
          <p className="p-10 text-center text-sm text-on-surface-variant">Cargando usuarios…</p>
        ) : filteredUsers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><th scope="col" className="px-4 py-3">Usuario</th><th scope="col" className="px-4 py-3">Correo</th><th scope="col" className="px-4 py-3">Rol</th><th scope="col" className="px-4 py-3">Estado</th><th scope="col" className="px-4 py-3">Creado</th><th scope="col" className="px-4 py-3 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-surface-container-low text-sm">
                {filteredUsers.map((user) => {
                  const active = user.estado === 'Activo';
                  const created = user.creado_en ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(new Date(user.creado_en)) : '—';
                  return (
                    <tr key={user.id} className="hover:bg-surface-container-low/40">
                      <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-xs font-semibold text-primary">{initials(user.nombre)}</span><span className="min-w-0"><span className="block truncate font-semibold text-on-surface">{user.nombre}</span><span className="block text-xs text-on-surface-variant">@{user.usuario}</span></span></div></td>
                      <td className="px-4 py-3 text-on-surface-variant">{user.email}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-medium text-on-surface">{user.rol}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${active ? 'bg-secondary-fixed/50 text-on-secondary-fixed-variant' : 'bg-surface-container-high text-on-surface-variant'}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-secondary' : 'bg-outline'}`} />{user.estado}</span></td>
                      <td className="px-4 py-3 text-on-surface-variant">{created}</td>
                      <td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => openEditModal(user)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-fixed/40">Editar</button><button type="button" onClick={() => toggleUserStatus(user)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${active ? 'text-error hover:bg-error-container/40' : 'text-secondary hover:bg-secondary-fixed/40'}`}>{active ? 'Desactivar' : 'Activar'}</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-on-surface-variant">No hay usuarios que coincidan con esos filtros.</p>
        )}
        <div className="border-t border-surface-container-low bg-surface-container-low/50 px-4 py-3 text-xs text-on-surface-variant">Las cuentas desactivadas no pueden iniciar sesión. El sistema conserva sus datos para mantener el historial.</div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowModal(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-surface-container-low pb-4">
              <div><h2 id="user-form-title" className="text-lg font-semibold text-on-surface">{editingUser ? 'Editar usuario' : 'Crear usuario'}</h2><p className="mt-1 text-sm text-on-surface-variant">Configura sus datos de acceso y el rol del sistema.</p></div>
              <button type="button" onClick={() => setShowModal(false)} aria-label="Cerrar formulario" className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Nombre completo<input required minLength={2} maxLength={255} autoComplete="name" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} className="h-10 rounded-lg bg-surface-container-low px-3 font-normal outline-none focus:ring-1 focus:ring-primary" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Correo electrónico<input required type="email" maxLength={255} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-10 rounded-lg bg-surface-container-low px-3 font-normal outline-none focus:ring-1 focus:ring-primary" /></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Nombre de usuario<input required minLength={3} maxLength={100} pattern="[A-Za-z0-9._-]+" autoComplete="username" value={form.usuario} onChange={(event) => setForm({ ...form, usuario: event.target.value })} className="h-10 rounded-lg bg-surface-container-low px-3 font-normal outline-none focus:ring-1 focus:ring-primary" /><span className="text-xs font-normal text-on-surface-variant">Usa letras sin tilde, números, punto, guion o guion bajo.</span></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Rol<select required value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value })} className="h-10 rounded-lg bg-surface-container-low px-3 font-normal outline-none focus:ring-1 focus:ring-primary">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">{editingUser ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}<input required={!editingUser} type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="h-10 rounded-lg bg-surface-container-low px-3 font-normal outline-none focus:ring-1 focus:ring-primary" /><span className="text-xs font-normal text-on-surface-variant">Mínimo 8 caracteres. Si cambias la contraseña, confirma el mismo valor abajo.</span></label>
              {(!editingUser || form.password) && <label className="flex flex-col gap-1.5 text-sm font-medium text-on-surface">Confirmar contraseña<input required={!editingUser || Boolean(form.password)} type="password" minLength={8} maxLength={72} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="h-10 rounded-lg bg-surface-container-low px-3 font-normal outline-none focus:ring-1 focus:ring-primary" /></label>}
              {error && <p role="alert" className="rounded-lg bg-error-container/50 p-3 text-sm text-on-surface">{error}</p>}
              <div className="mt-2 flex justify-end gap-2 border-t border-surface-container-low pt-4"><button type="button" disabled={saving} onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">{saving && <span className="material-symbols-outlined animate-spin text-[17px]">progress_activity</span>}{saving ? 'Guardando…' : editingUser ? 'Guardar cambios' : 'Crear cuenta'}</button></div>
            </form>
          </section>
        </div>
      )}

      {credentialsToShare && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="credentials-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h2 id="credentials-title" className="text-lg font-semibold text-on-surface">Usuario creado</h2><p className="mt-1 text-sm text-on-surface-variant">Copia o comparte estas credenciales ahora. La contraseña no se volverá a mostrar.</p></div>
              <button type="button" onClick={() => setCredentialsToShare(null)} aria-label="Cerrar credenciales" className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-surface-container-low p-4 font-sans text-sm text-on-surface">{credentialsMessage}</pre>
            <div className="mt-5 flex flex-col justify-end gap-2 sm:flex-row">
              <button type="button" onClick={copyCredentials} className="rounded-lg border border-outline/30 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-fixed/30">{credentialsCopied ? 'Credenciales copiadas' : 'Copiar credenciales'}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(credentialsMessage)}`} target="_blank" rel="noopener noreferrer" onClick={() => setCredentialsToShare(null)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary"><span className="material-symbols-outlined text-[18px]">chat</span>Preparar en WhatsApp</a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
