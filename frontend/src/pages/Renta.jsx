import React, { useEffect, useState } from 'react';
import api from '../services/api';
import rentaService from '../services/rentaService';
import { formatCordobas } from '../utils/currency';

const localDate = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const currentMonth = () => localDate().slice(0, 7);
const blankConfig = () => ({ marca_id: '', monto_mensual: '', dia_vencimiento: '1', fecha_inicio: `${currentMonth()}-01`, fecha_fin: '', activa: true });

export default function RentaPage() {
  const [period, setPeriod] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [brands, setBrands] = useState([]);
  const [config, setConfig] = useState(blankConfig());
  const [paymentFor, setPaymentFor] = useState(null);
  const [payment, setPayment] = useState({ monto_pagado: '', fecha_pago: localDate(), referencia_pago: '', comentario: '' });
  const [rentSearch, setRentSearch] = useState('');
  const [rentStatus, setRentStatus] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setData(null);
    setError('');
    try {
      const [rentaData, brandResult] = await Promise.all([
        rentaService.listar(period), api.get('/marcas/'),
      ]);
      setData(rentaData);
      setBrands(Array.isArray(brandResult.data) ? brandResult.data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cargar el control de rentas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const selectBrand = (brandId) => {
    const saved = data?.configuraciones.find((item) => String(item.marca_id) === brandId);
    setConfig(saved ? {
      marca_id: String(saved.marca_id), monto_mensual: String(saved.monto_mensual),
      dia_vencimiento: String(saved.dia_vencimiento), fecha_inicio: saved.fecha_inicio,
      fecha_fin: saved.fecha_fin || '', activa: saved.activa,
    } : { ...blankConfig(), marca_id: brandId });
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await rentaService.guardarConfiguracion({
        marca_id: Number(config.marca_id), monto_mensual: Number(config.monto_mensual),
        dia_vencimiento: Number(config.dia_vencimiento), fecha_inicio: config.fecha_inicio,
        fecha_fin: config.fecha_fin || null, activa: config.activa,
      });
      setMessage('Se guardó la renta mensual de la marca.');
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await rentaService.generar(period);
      setMessage(result.creadas ? `Se generaron ${result.creadas} rentas para ${period}.` : `Las rentas de ${period} ya estaban generadas o no hay contratos vigentes.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudieron generar las rentas del mes.');
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async (event) => {
    event.preventDefault();
    if (!paymentFor) return;
    setSaving(true);
    setError('');
    try {
      await rentaService.registrarPago(paymentFor.id, {
        ...payment, monto_pagado: Number(payment.monto_pagado),
      });
      setPaymentFor(null);
      setPayment({ monto_pagado: '', fecha_pago: localDate(), referencia_pago: '', comentario: '' });
      setMessage('Se registró el abono.');
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar el abono.');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = () => setConfig(blankConfig());
  const summary = data?.resumen || { monto_total: 0, total_pagado: 0, saldo_pendiente: 0, saldo_vencido: 0, vencidas_total: 0, por_vencer: 0 };
  const configurations = data?.configuraciones || [];
  const rentRows = (data?.rentas || []).filter((row) => {
    const matchesStatus = rentStatus === 'Todas' || row.estado === rentStatus;
    const term = rentSearch.trim().toLowerCase();
    const matchesSearch = !term || row.marca.toLowerCase().includes(term) || String(row.id).includes(term)
      || row.pagos.some((item) => String(item.referencia_pago || '').toLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });
  const maxMonth = currentMonth();

  const exportCsv = () => {
    if (!rentRows.length) return;
    const headers = ['Periodo', 'Marca', 'Vencimiento', 'Estado', 'Renta', 'Total pagado', 'Saldo', 'Fecha de abono', 'Abono', 'Referencia', 'Comentario'];
    const lines = rentRows.flatMap((row) => (row.pagos.length ? row.pagos : [null]).map((paymentRow) => [
      row.periodo, row.marca, row.fecha_vencimiento, row.estado, row.monto, row.pagado, row.saldo,
      paymentRow?.fecha_pago || '', paymentRow?.monto_pagado || '', paymentRow?.referencia_pago || '', paymentRow?.comentario || '',
    ]));
    const csv = [headers, ...lines].map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `renta_${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <section className="w-full min-w-0 space-y-6">
    <header className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-lowest p-5 shadow-sm sm:flex-row sm:items-center">
      <div><h1 className="text-xl font-semibold tracking-tight text-on-surface">Renta mensual del colectivo</h1><p className="mt-1 text-sm text-on-surface-variant">Configura cuánto paga cada marca, genera los cobros del mes y registra sus abonos.</p></div>
      <div className="flex flex-wrap items-center gap-2"><label htmlFor="rent-period" className="text-sm font-medium">Mes</label><input id="rent-period" type="month" max={maxMonth} value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-lg border border-stone-200 p-2" /><button type="button" disabled={saving || loading} onClick={generate} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Procesando…' : `Generar rentas de ${period}`}</button><button type="button" disabled={!rentRows.length} onClick={exportCsv} className="rounded-lg border border-stone-200 px-4 py-2.5 font-semibold disabled:opacity-50">Exportar CSV</button></div>
    </header>

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

    {(summary.vencidas_total > 0 || summary.por_vencer > 0) && <div role="status" className={`rounded-xl border p-4 text-sm ${summary.vencidas_total ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {summary.vencidas_total > 0 && <p><strong>{summary.vencidas_total} rentas vencidas:</strong> {formatCordobas(summary.saldo_vencido)} pendientes en períodos anteriores o actuales.</p>}
      {summary.por_vencer > 0 && <p><strong>{summary.por_vencer} rentas vencen dentro de 7 días.</strong> Revisa los cobros del período.</p>}
    </div>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Renta generada', summary.monto_total], ['Pagado', summary.total_pagado],
        ['Saldo pendiente del mes', summary.saldo_pendiente], ['Saldo vencido total', summary.saldo_vencido],
      ].map(([label, value]) => <article key={label} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-on-surface-variant">{label}</p><p className={`mt-2 text-2xl font-bold ${label.includes('Saldo') ? 'text-primary' : ''}`}>{formatCordobas(value)}</p></article>)}
    </div>

    <form onSubmit={saveConfig} className="grid gap-3 rounded-2xl bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-6 xl:items-end">
      <div className="xl:col-span-2"><label htmlFor="rent-brand" className="text-sm font-medium">Marca</label><select id="rent-brand" required value={config.marca_id} onChange={(event) => selectBrand(event.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5"><option value="">Selecciona marca</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre_marca}{brand.estado_id !== 2 ? ' (inactiva)' : ''}</option>)}</select></div>
      <label className="text-sm font-medium">Monto mensual (C$)<input required min="0.01" step="0.01" type="number" value={config.monto_mensual} onChange={(event) => setConfig({ ...config, monto_mensual: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label>
      <label className="text-sm font-medium">Día de vencimiento<input required min="1" max="31" step="1" type="number" value={config.dia_vencimiento} onChange={(event) => setConfig({ ...config, dia_vencimiento: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label>
      <label className="text-sm font-medium">Inicio del cobro<input required type="date" value={config.fecha_inicio} onChange={(event) => setConfig({ ...config, fecha_inicio: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label>
      <label className="text-sm font-medium">Fin del contrato<input type="date" min={config.fecha_inicio} value={config.fecha_fin} onChange={(event) => setConfig({ ...config, fecha_fin: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label>
      <div className="flex items-center gap-2 xl:col-span-2"><input id="rent-active" type="checkbox" checked={config.activa} onChange={(event) => setConfig({ ...config, activa: event.target.checked })} /><label htmlFor="rent-active" className="text-sm">Contrato activo</label></div>
      <div className="flex gap-2 xl:col-span-4 xl:justify-end"><button type="button" onClick={resetConfig} className="rounded-lg border border-stone-200 px-4 py-2.5 font-semibold">Limpiar</button><button disabled={saving || !config.marca_id} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar renta mensual'}</button></div>
      <p className="text-xs text-on-surface-variant sm:col-span-2 xl:col-span-6">Se cobra el monto mensual completo por cada mes dentro de la vigencia. Al desactivar un contrato sin fecha final, se usa hoy como fecha de fin.</p>
    </form>

    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold">Cobros de {period}</h2><p className="mt-1 text-xs text-on-surface-variant">Los abonos se descuentan del saldo y conservan su referencia.</p></div><div className="flex flex-wrap gap-2"><label className="sr-only" htmlFor="rent-search">Buscar marca o referencia</label><input id="rent-search" value={rentSearch} onChange={(event) => setRentSearch(event.target.value)} placeholder="Marca o referencia" className="rounded-lg border border-stone-200 px-3 py-2 text-sm" /><label className="sr-only" htmlFor="rent-status">Filtrar por estado</label><select id="rent-status" value={rentStatus} onChange={(event) => setRentStatus(event.target.value)} className="rounded-lg border border-stone-200 px-3 py-2 text-sm"><option>Todas</option><option>Pendiente</option><option>Parcial</option><option>Vencida</option><option>Pagada</option></select></div></div>
      {loading ? <p className="p-8 text-center text-on-surface-variant">Cargando rentas…</p> : !data?.rentas.length ? <p className="p-8 text-center text-on-surface-variant">No se han generado cobros para este mes. Configura las marcas y genera el período.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-5 py-3">Marca</th><th className="px-5 py-3">Vencimiento</th><th className="px-5 py-3 text-right">Renta (C$)</th><th className="px-5 py-3 text-right">Pagado</th><th className="px-5 py-3 text-right">Saldo</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-stone-100">{rentRows.map((row) => <tr key={row.id}>
        <td className="px-5 py-4 font-semibold">{row.marca}</td><td className="px-5 py-4">{row.fecha_vencimiento || '—'}{row.por_vencer && <span className="mt-1 block text-xs font-medium text-amber-700">Vence pronto</span>}</td><td className="px-5 py-4 text-right">{formatCordobas(row.monto)}</td><td className="px-5 py-4 text-right">{formatCordobas(row.pagado)}</td><td className="px-5 py-4 text-right font-semibold">{formatCordobas(row.saldo)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.estado === 'Pagada' ? 'bg-emerald-100 text-emerald-800' : row.estado === 'Vencida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{row.estado}</span></td><td className="px-5 py-4 text-right">{row.saldo > 0 && <button type="button" onClick={() => { setPaymentFor(row); setPayment({ monto_pagado: Number(row.saldo).toFixed(2), fecha_pago: localDate(), referencia_pago: '', comentario: '' }); }} className="rounded-lg bg-primary-fixed px-3 py-2 text-xs font-semibold">Registrar abono</button>}<details className="mt-2 text-left"><summary className="cursor-pointer text-xs text-on-surface-variant">Pagos ({row.pagos.length})</summary><div className="mt-2 space-y-1">{row.pagos.map((item) => <p key={item.pago_id} className="text-xs text-on-surface-variant">{item.fecha_pago} · {formatCordobas(item.monto_pagado)} · Ref. {item.referencia_pago}{item.comentario ? ` · ${item.comentario}` : ''}</p>)}</div></details></td>
      </tr>)}{!rentRows.length && <tr><td colSpan="7" className="p-8 text-center text-on-surface-variant">No hay cobros que coincidan con los filtros.</td></tr>}</tbody></table></div>}
    </div>

    <div className="overflow-hidden rounded-2xl bg-white shadow-sm"><div className="border-b border-stone-100 px-5 py-4"><h2 className="font-semibold">Tarifas mensuales por marca</h2></div>{loading ? <p className="p-6 text-on-surface-variant">Cargando…</p> : !configurations.length ? <p className="p-6 text-sm text-on-surface-variant">Aún no hay rentas mensuales configuradas.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-5 py-3">Marca</th><th className="px-5 py-3 text-right">Monto mensual</th><th className="px-5 py-3">Vencimiento</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3">Contrato</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-stone-100">{configurations.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold">{item.marca}</td><td className="px-5 py-4 text-right">{formatCordobas(item.monto_mensual)}</td><td className="px-5 py-4">Día {item.dia_vencimiento}</td><td className="px-5 py-4">{item.fecha_inicio}{item.fecha_fin ? ` — ${item.fecha_fin}` : ' en curso'}</td><td className="px-5 py-4">{item.activa ? 'Activo' : 'Finalizado'}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => selectBrand(String(item.marca_id))} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold">Editar</button></td></tr>)}</tbody></table></div>}</div>

    {paymentFor && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"><form onSubmit={savePayment} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div><h2 className="text-xl font-bold">Registrar abono</h2><p className="mt-1 text-sm text-on-surface-variant">{paymentFor.marca} · saldo {formatCordobas(paymentFor.saldo)}</p></div><label className="block text-sm font-medium">Monto recibido (C$)<input required min="0.01" max={paymentFor.saldo} step="0.01" type="number" value={payment.monto_pagado} onChange={(event) => setPayment({ ...payment, monto_pagado: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-sm font-medium">Fecha del pago<input required max={localDate()} type="date" value={payment.fecha_pago} onChange={(event) => setPayment({ ...payment, fecha_pago: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-sm font-medium">Referencia / comprobante<input required maxLength={255} value={payment.referencia_pago} onChange={(event) => setPayment({ ...payment, referencia_pago: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" placeholder="Número de transferencia o recibo" /></label><label className="block text-sm font-medium">Comentario opcional<input maxLength={1000} value={payment.comentario} onChange={(event) => setPayment({ ...payment, comentario: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentFor(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar abono'}</button></div></form></div>}
  </section>;
}
