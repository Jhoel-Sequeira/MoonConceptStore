import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { formatCordobas } from '../utils/currency';

const money = formatCordobas;
const dateInput = () => new Date().toISOString().slice(0, 10);

export default function RentaPage() {
  const [rentas, setRentas] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ marca_id: '', fecha_pago: dateInput(), monto: '' });
  const [paymentFor, setPaymentFor] = useState(null);
  const [payment, setPayment] = useState({ monto_pagado: '', fecha_pago: dateInput(), comentario: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [rentRes, brandRes] = await Promise.all([api.get('/renta/'), api.get('/marcas/')]);
      setRentas(rentRes.data);
      setMarcas(brandRes.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'No se pudo cargar el módulo de Renta.');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const totals = useMemo(() => rentas.reduce((acc, row) => {
    acc.due += Number(row.monto || 0);
    acc.paid += Number(row.pagado || 0);
    return acc;
  }, { due: 0, paid: 0 }), [rentas]);

  const createRenta = async (event) => {
    event.preventDefault();
    try {
      await api.post('/renta/', { ...form, marca_id: Number(form.marca_id), monto: Number(form.monto), fecha_pago: new Date(`${form.fecha_pago}T12:00:00`).toISOString() });
      setForm({ marca_id: '', fecha_pago: dateInput(), monto: '' });
      await load();
    } catch (e) { setError(e.response?.data?.detail || 'No se pudo registrar la renta.'); }
  };

  const registerPayment = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/renta/${paymentFor.id}/pagos`, { ...payment, monto_pagado: Number(payment.monto_pagado), fecha_pago: new Date(`${payment.fecha_pago}T12:00:00`).toISOString() });
      setPaymentFor(null);
      setPayment({ monto_pagado: '', fecha_pago: dateInput(), comentario: '' });
      await load();
    } catch (e) { setError(e.response?.data?.detail || 'No se pudo registrar el pago.'); }
  };

  return <section className="mx-auto max-w-7xl space-y-6">
    <header><p className="text-sm font-semibold uppercase tracking-[.18em] text-primary">Administración</p><h1 className="mt-1 text-3xl font-bold text-on-surface">Renta</h1><p className="mt-1 text-on-surface-variant">Control de rentas por marca y registro de pagos.</p></header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-on-surface-variant">Renta total registrada</p><p className="mt-2 text-2xl font-bold">{money(totals.due)}</p></div>
      <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-on-surface-variant">Saldo pendiente</p><p className="mt-2 text-2xl font-bold text-primary">{money(totals.due - totals.paid)}</p></div>
    </div>
    <form onSubmit={createRenta} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-4 sm:items-end">
      <label className="text-sm font-medium">Marca<select required value={form.marca_id} onChange={e => setForm({ ...form, marca_id: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5"><option value="">Selecciona marca</option>{marcas.map(m => <option key={m.id} value={m.id}>{m.nombre_marca}</option>)}</select></label>
      <label className="text-sm font-medium">Monto de renta (C$)<input required min="0.01" step="0.01" type="number" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label>
      <label className="text-sm font-medium">Fecha de vencimiento<input required type="date" value={form.fecha_pago} onChange={e => setForm({ ...form, fecha_pago: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label>
      <button className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white hover:brightness-95">Agregar renta</button>
    </form>
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b border-stone-100 px-5 py-4 font-semibold">Rentas por marca</div>
      {loading ? <p className="p-8 text-center text-on-surface-variant">Cargando rentas…</p> : rentas.length === 0 ? <p className="p-8 text-center text-on-surface-variant">Todavía no hay rentas registradas.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-5 py-3">Marca</th><th className="px-5 py-3">Vence</th><th className="px-5 py-3 text-right">Monto (C$)</th><th className="px-5 py-3 text-right">Pagado (C$)</th><th className="px-5 py-3 text-right">Saldo (C$)</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-stone-100">{rentas.map(row => { const balance = Number(row.monto || 0) - Number(row.pagado || 0); return <tr key={row.id}><td className="px-5 py-4 font-semibold">{row.marca}</td><td className="px-5 py-4">{row.fecha_pago ? new Date(row.fecha_pago).toLocaleDateString() : '—'}</td><td className="px-5 py-4 text-right">{money(row.monto)}</td><td className="px-5 py-4 text-right">{money(row.pagado)}</td><td className="px-5 py-4 text-right font-semibold">{money(balance)}</td><td className="px-5 py-4 text-right">{balance > 0 && <button onClick={() => { setPaymentFor(row); setPayment({ monto_pagado: balance.toFixed(2), fecha_pago: dateInput(), comentario: '' }); }} className="rounded-lg bg-primary-fixed px-3 py-2 text-xs font-semibold hover:brightness-95">Registrar pago</button>}</td></tr>; })}</tbody></table></div>}
    </div>
    {paymentFor && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"><form onSubmit={registerPayment} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div><h2 className="text-xl font-bold">Registrar pago</h2><p className="mt-1 text-sm text-on-surface-variant">{paymentFor.marca} · saldo {money(paymentFor.monto - paymentFor.pagado)}</p></div><label className="block text-sm font-medium">Monto (C$)<input required min="0.01" max={paymentFor.monto - paymentFor.pagado} step="0.01" type="number" value={payment.monto_pagado} onChange={e => setPayment({ ...payment, monto_pagado: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-sm font-medium">Fecha<input required type="date" value={payment.fecha_pago} onChange={e => setPayment({ ...payment, fecha_pago: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-sm font-medium">Comentario<input value={payment.comentario} onChange={e => setPayment({ ...payment, comentario: e.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentFor(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">Guardar pago</button></div></form></div>}
  </section>;
}
