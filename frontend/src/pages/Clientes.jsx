import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import brandConfig from '../brandConfig';
import clientesService from '../services/clientesService';
import { formatCordobas } from '../utils/currency';
import { SplashScreen, useFeedback } from '../components/ui/FeedbackProvider';

const blankForm = { nombre_cliente: '', telefono: '', correo: '', fecha_nacimiento: '' };
const formatBirthDate = (value) => value
  ? new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
  : '—';

export default function ClientesPage() {
  const location = useLocation();
  const { notify } = useFeedback();
  const [clientes, setClientes] = useState([]);
  const [buscar, setBuscar] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location.state?.globalSearch) setBuscar(location.state.globalSearch);
  }, [location.state]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      if (active) setSearching(Boolean(buscar.trim()));
      try {
        const rows = await clientesService.getAll({ buscar: buscar.trim(), limite: 200 });
        if (active) setClientes(rows);
      } catch (error) {
        if (active) notify(error.response?.data?.detail || 'No se pudo cargar la lista de clientes.', 'error');
      } finally {
        if (active) {
          setLoading(false);
          setSearching(false);
        }
      }
    }, buscar.trim() ? 250 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [buscar, notify]);

  const startCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setFormOpen(true);
  };

  const startEdit = (cliente) => {
    setEditing(cliente);
    setFormOpen(true);
    setForm({
      nombre_cliente: cliente.nombre_cliente || '',
      telefono: cliente.telefono || '',
      correo: cliente.correo || '',
      fecha_nacimiento: cliente.fecha_nacimiento || '',
    });
  };

  const saveClient = async (event) => {
    event.preventDefault();
    const payload = {
      nombre_cliente: form.nombre_cliente.trim(),
      telefono: form.telefono.trim() || null,
      correo: form.correo.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
    };
    if (!payload.nombre_cliente) return;
    try {
      setSaving(true);
      const saved = editing
        ? await clientesService.update(editing.id, payload)
        : await clientesService.create(payload);
      notify(editing ? 'Cliente actualizado.' : 'Cliente registrado.', 'success');
      setFormOpen(false);
      setEditing(false);
      setForm(blankForm);
      setClientes((current) => {
        const matches = !buscar.trim() || [saved.nombre_cliente, saved.telefono, saved.correo]
          .some((value) => String(value || '').toLocaleLowerCase().includes(buscar.trim().toLocaleLowerCase()));
        if (editing) return matches ? current.map((item) => item.id === saved.id ? saved : item) : current.filter((item) => item.id !== saved.id);
        return matches ? [saved, ...current] : current;
      });
    } catch (error) {
      notify(error.response?.data?.detail || 'No se pudo guardar el cliente.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <SplashScreen message="Cargando clientes..." compact />;

  const totalCompras = clientes.reduce((sum, cliente) => sum + Number(cliente.total_compras || 0), 0);

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined">group</span>
            </span>
            <h1 className="text-xl font-bold text-on-surface">Clientes</h1>
          </div>
          <p className="mt-2 text-sm text-on-surface-variant">Gestiona la información de contacto de los clientes de {brandConfig.name}.</p>
        </div>
        <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">
          <span className="material-symbols-outlined text-lg">person_add</span> Registrar cliente
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-on-surface-variant">Clientes registrados</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{clientes.length}{buscar.trim() ? ' encontrados' : ''}</p>
        </article>
        <article className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm text-on-surface-variant">Compras asociadas a la búsqueda</p>
          <p className="mt-1 text-2xl font-bold text-on-surface">{formatCordobas(totalCompras)}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold text-on-surface">Directorio</h2>
          <label className="relative w-full sm:max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">search</span>
            <input value={buscar} onChange={(event) => setBuscar(event.target.value)} placeholder="Buscar nombre, teléfono o correo" className="h-10 w-full rounded-xl border border-outline-variant/50 bg-white pl-10 pr-3 text-sm text-on-surface outline-none focus:border-primary" />
            {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">Buscando…</span>}
          </label>
        </div>
        {clientes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant">
                <tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Teléfono</th><th className="px-5 py-3">Correo</th><th className="px-5 py-3">Nacimiento</th><th className="px-5 py-3 text-right">Compras</th><th className="px-5 py-3 text-right">Total</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {clientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-stone-50">
                    <td className="px-5 py-4 font-semibold text-on-surface">{cliente.nombre_cliente}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{cliente.telefono || '—'}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{cliente.correo || '—'}</td>
                    <td className="px-5 py-4 text-on-surface-variant">{formatBirthDate(cliente.fecha_nacimiento)}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{Number(cliente.cantidad_compras || 0)}</td>
                    <td className="px-5 py-4 text-right font-medium tabular-nums">{formatCordobas(cliente.total_compras || 0)}</td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => startEdit(cliente)} className="rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-fixed/50">Editar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-14 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant">person_search</span>
            <p className="mt-2 font-semibold text-on-surface">{buscar.trim() ? 'No hay clientes con esa búsqueda' : 'Todavía no hay clientes registrados'}</p>
            <p className="mt-1 text-sm text-on-surface-variant">Registra un cliente o continúa una venta como Consumidor Final desde el POS.</p>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { setFormOpen(false); setEditing(false); setForm(blankForm); } }}>
          <form onSubmit={saveClient} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-on-surface">{editing ? 'Editar cliente' : 'Registrar cliente'}</h2>
              <button type="button" aria-label="Cerrar" onClick={() => { setFormOpen(false); setEditing(false); setForm(blankForm); }} className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
            </div>
            <label className="block text-sm font-medium text-on-surface">Nombre completo *
              <input required maxLength={255} autoFocus value={form.nombre_cliente} onChange={(event) => setForm({ ...form, nombre_cliente: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-outline-variant/50 px-3 font-normal outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium text-on-surface">Teléfono
              <input type="tel" maxLength={50} value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} placeholder="+505 8888-9999" className="mt-1 h-11 w-full rounded-xl border border-outline-variant/50 px-3 font-normal outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium text-on-surface">Correo
              <input type="email" maxLength={255} value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} placeholder="cliente@ejemplo.com" className="mt-1 h-11 w-full rounded-xl border border-outline-variant/50 px-3 font-normal outline-none focus:border-primary" />
            </label>
            <label className="block text-sm font-medium text-on-surface">Fecha de nacimiento
              <input type="date" max={new Date().toLocaleDateString('en-CA')} value={form.fecha_nacimiento} onChange={(event) => setForm({ ...form, fecha_nacimiento: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-outline-variant/50 px-3 font-normal outline-none focus:border-primary" />
            </label>
            <div className="flex justify-end gap-2 border-t border-surface-container-low pt-4">
              <button type="button" disabled={saving} onClick={() => { setFormOpen(false); setEditing(false); setForm(blankForm); }} className="rounded-xl px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low">Cancelar</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar cliente'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
