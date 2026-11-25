import React, { useEffect, useState } from 'react';
import api from '../services/api';
import rentaService from '../services/rentaService';
import { SplashScreen } from '../components/ui/FeedbackProvider';

const formatDollars = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(Number(value ?? 0));

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
  const [configMode, setConfigMode] = useState(null);
  const [paymentFor, setPaymentFor] = useState(null);
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [payment, setPayment] = useState({ monto_pagado: '', fecha_pago: localDate(), referencia_pago: '', comentario: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const importTemplate = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await rentaService.importarConfiguraciones(file);
      setMessage(`Plantilla importada: ${result.creadas} configuraciones nuevas y ${result.actualizadas} actualizadas.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo importar la plantilla de renta.');
    } finally {
      setSaving(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setData(null);
    setError('');
    try {
      const [rentaData, brandResult] = await Promise.all([
        rentaService.listar(period), api.get('/marcas/'),
      ]);
      setData(rentaData);
      window.dispatchEvent(new Event('renta-updated'));
      setBrands(Array.isArray(brandResult.data) ? brandResult.data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cargar el control de rentas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const openCreateConfig = () => {
    setConfig(blankConfig());
    setConfigMode('create');
    setError('');
    setMessage('');
  };

  const openEditConfig = (saved) => {
    setConfig({
      marca_id: String(saved.marca_id), monto_mensual: String(saved.monto_mensual),
      dia_vencimiento: String(saved.dia_vencimiento), fecha_inicio: saved.fecha_inicio,
      fecha_fin: saved.fecha_fin || '', activa: saved.activa,
    });
    setConfigMode('edit');
    setError('');
    setMessage('');
  };

  const closeConfig = () => {
    if (!saving) setConfigMode(null);
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (configMode === 'create' && configurations.some((item) => String(item.marca_id) === config.marca_id)) {
        setError('Esta marca ya tiene una renta configurada. Abre Editar para modificarla.');
        return;
      }
      await rentaService.guardarConfiguracion({
        marca_id: Number(config.marca_id), monto_mensual: Number(config.monto_mensual),
        dia_vencimiento: Number(config.dia_vencimiento), fecha_inicio: config.fecha_inicio,
        fecha_fin: config.fecha_fin || null, activa: config.activa,
      });
      setConfigMode(null);
      setMessage(configMode === 'create' ? 'Se creó la renta mensual de la marca.' : 'Se actualizaron los datos de la renta.');
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
      const result = await rentaService.registrarPago(paymentFor.id, {
        ...payment, monto_pagado: Number(payment.monto_pagado),
      });
      const amount = Number(payment.monto_pagado);
      setPaymentReceipt({
        pago_id: result.pago_id,
        marca: paymentFor.marca,
        periodo: paymentFor.periodo,
        fecha_vencimiento: paymentFor.fecha_vencimiento,
        fecha_pago: payment.fecha_pago,
        monto_pagado: amount,
        saldo_anterior: Number(paymentFor.saldo),
        saldo_nuevo: Math.max(0, Number(paymentFor.saldo) - amount),
        referencia_pago: payment.referencia_pago,
        comentario: payment.comentario,
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

  const beginPayment = (row) => {
    setPaymentFor(row);
    setPayment({ monto_pagado: Number(row.saldo).toFixed(2), fecha_pago: localDate(), referencia_pago: '', comentario: '' });
    setError('');
  };

  const summary = data?.resumen || { monto_total: 0, total_pagado: 0, saldo_pendiente: 0, saldo_vencido: 0, vencidas_total: 0, por_vencer: 0 };
  const configurations = data?.configuraciones || [];
  const pendingRows = (data?.rentas || []).filter((row) => Number(row.saldo) > 0);
  const pendingTotal = pendingRows.reduce((total, row) => total + Number(row.saldo), 0);
  const availableBrands = brands.filter((brand) => !configurations.some((item) => String(item.marca_id) === String(brand.id)));
  const selectedBrandName = brands.find((brand) => String(brand.id) === config.marca_id)?.nombre_marca || '';
  const rentRows = data?.rentas || [];
  const maxMonth = currentMonth();

  const exportCsv = () => {
    if (!rentRows.length) return;
    const headers = ['Periodo', 'Marca', 'Vencimiento', 'Estado', 'Renta (USD)', 'Total pagado (USD)', 'Saldo pendiente (USD)'];
    const lines = rentRows.map((row) => [row.periodo, row.marca, row.fecha_vencimiento, row.estado, row.monto, row.pagado, row.saldo]);
    const csv = [headers, ...lines].map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `reporte_saldos_renta_${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return <section className="w-full min-w-0 space-y-6">
    <header className="rounded-2xl bg-surface-container-lowest p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Control de pagos</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-on-surface">Renta mensual del colectivo</h1><p className="mt-2 text-sm text-on-surface-variant">Consulta saldos, registra abonos y genera el reporte mensual en USD.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label htmlFor="rent-period" className="text-sm font-medium">Filtrar por mes<input id="rent-period" type="month" max={maxMonth} value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 sm:w-auto" /></label>
          <label className="cursor-pointer rounded-lg border border-stone-200 px-4 py-2.5 text-center text-sm font-semibold hover:bg-stone-50">{saving ? 'Procesando...' : 'Importar Excel'}<input type="file" accept=".xlsx" className="hidden" disabled={saving || loading} onChange={importTemplate} /></label>
          <button type="button" disabled={saving || loading} onClick={generate} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Procesando...' : 'Generar rentas'}</button>
          <button type="button" disabled={!rentRows.length || loading} onClick={exportCsv} className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50">Reporte de saldos</button>
        </div>
      </div>
    </header>

    {configMode && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 modal-scroll-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfig(); }}>
      <form onSubmit={saveConfig} onKeyDown={(event) => { if (event.key === 'Escape') closeConfig(); }} role="dialog" aria-modal="true" aria-labelledby="rent-config-title" className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="rent-config-title" className="text-xl font-bold">{configMode === 'create' ? 'Crear renta mensual' : 'Editar renta mensual'}</h2><p className="mt-1 text-sm text-on-surface-variant">Define monto, vencimiento y vigencia del contrato.</p></div><button type="button" onClick={closeConfig} disabled={saving} aria-label="Cerrar" className="rounded-lg border border-stone-200 px-3 py-2 disabled:opacity-50">×</button></div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {configMode === 'create' ? <label htmlFor="rent-brand" className="block text-sm font-medium">Marca<select id="rent-brand" required value={config.marca_id} onChange={(event) => setConfig({ ...config, marca_id: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5"><option value="">Selecciona una marca sin renta</option>{availableBrands.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre_marca}{brand.estado_id !== 2 ? ' (inactiva)' : ''}</option>)}</select>{!availableBrands.length && <span className="mt-1 block text-xs text-on-surface-variant">Todas las marcas ya tienen una configuración.</span>}</label> : <div className="rounded-lg bg-stone-50 p-3 text-sm"><span className="text-on-surface-variant">Marca</span><p className="mt-1 font-semibold">{selectedBrandName}</p></div>}
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Monto mensual (USD)<input required min="0.01" step="0.01" type="number" value={config.monto_mensual} onChange={(event) => setConfig({ ...config, monto_mensual: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="text-sm font-medium">Día de vencimiento<input required min="1" max="31" step="1" type="number" value={config.dia_vencimiento} onChange={(event) => setConfig({ ...config, dia_vencimiento: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="text-sm font-medium">Inicio del cobro<input required type="date" value={config.fecha_inicio} onChange={(event) => setConfig({ ...config, fecha_inicio: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="text-sm font-medium">Fin del contrato<input type="date" min={config.fecha_inicio} value={config.fecha_fin} onChange={(event) => setConfig({ ...config, fecha_fin: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.activa} onChange={(event) => setConfig({ ...config, activa: event.target.checked })} />Contrato activo</label>
        <p className="text-xs text-on-surface-variant">Al desactivar un contrato sin fecha final, se usará hoy como fecha de fin. Editar actualiza la configuración de la marca.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={closeConfig} disabled={saving} className="rounded-lg border border-stone-200 px-4 py-2.5 font-semibold disabled:opacity-50">Cancelar</button><button disabled={saving || (configMode === 'create' && !config.marca_id)} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : configMode === 'create' ? 'Crear renta' : 'Guardar cambios'}</button></div>
      </form>
    </div>}

    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

    {(summary.vencidas_total > 0 || summary.por_vencer > 0) && <div role="status" className={`rounded-xl border p-4 text-sm ${summary.vencidas_total ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      {summary.vencidas_total > 0 && <p><strong>{summary.vencidas_total} rentas vencidas:</strong> {formatDollars(summary.saldo_vencido)} pendientes en períodos anteriores o actuales.</p>}
      {summary.por_vencer > 0 && <p><strong>{summary.por_vencer} rentas vencen dentro de 7 días.</strong> Revisa los cobros del período.</p>}
    </div>}

    {!loading && pendingRows.length > 0 && <section aria-labelledby="rent-pending-title" className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="border-b border-amber-200 px-5 py-4"><h2 id="rent-pending-title" className="font-semibold text-amber-950">Marcas con saldo pendiente · {period}</h2><p className="mt-1 text-sm text-amber-900">{pendingRows.length} {pendingRows.length === 1 ? 'marca tiene' : 'marcas tienen'} un saldo por pagar · Total {formatDollars(pendingTotal)}.</p></div>
      <ul className="divide-y divide-amber-200">{pendingRows.map((row) => <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="font-semibold text-on-surface">{row.marca}</p><p className="mt-1 text-sm text-on-surface-variant">Vence {row.fecha_vencimiento || 'sin fecha'} · <span className={row.estado === 'Vencida' ? 'font-semibold text-red-700' : 'text-amber-800'}>{row.estado}</span></p></div>
        <div className="flex items-center justify-between gap-4 sm:justify-end"><span className="font-semibold tabular-nums">Saldo {formatDollars(row.saldo)}</span><button type="button" disabled={saving} onClick={() => beginPayment(row)} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Abonar pago</button></div>
      </li>)}</ul>
    </section>}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Renta generada (USD)', summary.monto_total], ['Pagado (USD)', summary.total_pagado],
        ['Saldo pendiente (USD)', summary.saldo_pendiente], ['Saldo vencido (USD)', summary.saldo_vencido],
      ].map(([label, value]) => <article key={label} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-on-surface-variant">{label}</p><p className={`mt-2 text-2xl font-bold ${label.includes('Saldo') ? 'text-primary' : ''}`}>{formatDollars(value)}</p></article>)}
    </div>

    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-semibold">Tarifas mensuales por marca</h2><p className="mt-1 text-xs text-on-surface-variant">Montos en USD. Crea una renta para una marca nueva o edita su configuración actual.</p></div>
        <button type="button" disabled={loading || saving || !availableBrands.length} onClick={openCreateConfig} className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-white disabled:opacity-50">Crear renta</button>
      </div>
      {loading ? <SplashScreen compact message="Cargando contratos..." /> : !configurations.length ? <p className="p-6 text-sm text-on-surface-variant">Aún no hay rentas configuradas. Usa Crear renta para comenzar.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-5 py-3">Marca</th><th className="px-5 py-3 text-right">Monto mensual</th><th className="px-5 py-3">Vencimiento</th><th className="px-5 py-3">Vigencia</th><th className="px-5 py-3">Contrato</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-stone-100">{configurations.map((item) => <tr key={item.id}><td className="px-5 py-4 font-semibold">{item.marca}</td><td className="px-5 py-4 text-right">{formatDollars(item.monto_mensual)}</td><td className="px-5 py-4">Día {item.dia_vencimiento}</td><td className="px-5 py-4">{item.fecha_inicio}{item.fecha_fin ? ` — ${item.fecha_fin}` : ' en curso'}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.activa ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{item.activa ? 'Activo' : 'Finalizado'}</span></td><td className="px-5 py-4 text-right"><button type="button" disabled={saving} onClick={() => openEditConfig(item)} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold disabled:opacity-50">Editar</button></td></tr>)}</tbody></table></div>}
    </div>

    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold">Cobros de {period}</h2><p className="mt-1 text-xs text-on-surface-variant">Registra abonos desde cada saldo pendiente. El reporte incluye los saldos del mes seleccionado.</p></div></div>
      {loading ? <SplashScreen compact message="Cargando cobros de renta..." /> : !data?.rentas.length ? <p className="p-8 text-center text-on-surface-variant">No se han generado cobros para este mes. Configura las marcas y genera el período.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-5 py-3">Marca</th><th className="px-5 py-3">Vencimiento</th><th className="px-5 py-3 text-right">Renta (USD)</th><th className="px-5 py-3 text-right">Pagado (USD)</th><th className="px-5 py-3 text-right">Saldo (USD)</th><th className="px-5 py-3">Estado</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-stone-100">{rentRows.map((row) => <tr key={row.id}>
        <td className="px-5 py-4 font-semibold">{row.marca}</td><td className="px-5 py-4">{row.fecha_vencimiento || '—'}{row.por_vencer && <span className="mt-1 block text-xs font-medium text-amber-700">Vence pronto</span>}</td><td className="px-5 py-4 text-right">{formatDollars(row.monto)}</td><td className="px-5 py-4 text-right">{formatDollars(row.pagado)}</td><td className="px-5 py-4 text-right font-semibold">{formatDollars(row.saldo)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.estado === 'Pagada' ? 'bg-emerald-100 text-emerald-800' : row.estado === 'Vencida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{row.estado}</span></td><td className="px-5 py-4 text-right">{Number(row.saldo) > 0 && <button type="button" disabled={saving} onClick={() => beginPayment(row)} className="rounded-lg bg-primary-fixed px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Abonar pago</button>}<details className="mt-2 text-left"><summary className="cursor-pointer text-xs text-on-surface-variant">Pagos ({row.pagos.length})</summary><div className="mt-2 space-y-1">{row.pagos.map((item) => <p key={item.pago_id} className="text-xs text-on-surface-variant">{item.fecha_pago} · {formatDollars(item.monto_pagado)} · Ref. {item.referencia_pago}{item.comentario ? ` · ${item.comentario}` : ''}</p>)}</div></details></td>
      </tr>)}{!rentRows.length && <tr><td colSpan="7" className="p-8 text-center text-on-surface-variant">No hay cobros para este mes.</td></tr>}</tbody></table></div>}
    </div>


    {paymentFor && <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4 modal-scroll-overlay"><form onSubmit={savePayment} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"><div><h2 className="text-xl font-bold">Abonar pago</h2><p className="mt-1 text-sm text-on-surface-variant">{paymentFor.marca} · saldo {formatDollars(paymentFor.saldo)}</p></div>{error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}<label className="block text-sm font-medium">Monto recibido (USD)<input required min="0.01" max={paymentFor.saldo} step="0.01" type="number" value={payment.monto_pagado} onChange={(event) => setPayment({ ...payment, monto_pagado: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-sm font-medium">Fecha del pago<input required max={localDate()} type="date" value={payment.fecha_pago} onChange={(event) => setPayment({ ...payment, fecha_pago: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><label className="block text-sm font-medium">Referencia / comprobante<input required maxLength={255} value={payment.referencia_pago} onChange={(event) => setPayment({ ...payment, referencia_pago: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" placeholder="Número de transferencia o recibo" /></label><label className="block text-sm font-medium">Comentario opcional<input maxLength={1000} value={payment.comentario} onChange={(event) => setPayment({ ...payment, comentario: event.target.value })} className="mt-1 w-full rounded-lg border border-stone-200 p-2.5" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setPaymentFor(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button disabled={saving} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar abono'}</button></div></form></div>}

    {paymentReceipt && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/50 p-4 modal-scroll-overlay">
      <style>{`@media print { @page { size: 80mm auto; margin: 4mm; } body * { visibility: hidden !important; } #rent-payment-receipt, #rent-payment-receipt * { visibility: visible !important; } #rent-payment-receipt { position: fixed; inset: 0 auto auto 0; width: 72mm; max-width: none; margin: 0; border: 0; box-shadow: none; } .rent-receipt-actions { display: none !important; } }`}</style>
      <section id="rent-payment-receipt" className="w-full max-w-md rounded-2xl bg-white p-6 font-mono text-sm text-stone-800 shadow-2xl">
        <header className="border-b border-dashed border-stone-300 pb-4 text-center"><p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Moon Concept Store</p><h2 className="mt-2 text-lg font-bold">Comprobante de abono de renta</h2><p className="mt-1 text-xs">Recibo #{String(paymentReceipt.pago_id).padStart(6, '0')}</p></header>
        <div className="space-y-2 border-b border-dashed border-stone-300 py-4 text-xs">
          <div className="flex justify-between gap-3"><span>Marca</span><strong className="text-right">{paymentReceipt.marca}</strong></div>
          <div className="flex justify-between gap-3"><span>Período</span><strong>{paymentReceipt.periodo}</strong></div>
          <div className="flex justify-between gap-3"><span>Fecha de abono</span><strong>{paymentReceipt.fecha_pago}</strong></div>
          <div className="flex justify-between gap-3"><span>Vencimiento</span><strong>{paymentReceipt.fecha_vencimiento || '—'}</strong></div>
          <div className="flex justify-between gap-3"><span>Referencia</span><strong className="text-right">{paymentReceipt.referencia_pago}</strong></div>
          {paymentReceipt.comentario && <div className="flex justify-between gap-3"><span>Comentario</span><strong className="text-right">{paymentReceipt.comentario}</strong></div>}
        </div>
        <div className="space-y-2 py-4 text-xs"><div className="flex justify-between"><span>Saldo anterior</span><strong>{formatDollars(paymentReceipt.saldo_anterior)}</strong></div><div className="flex justify-between text-base font-bold"><span>Abono recibido</span><strong>{formatDollars(paymentReceipt.monto_pagado)}</strong></div><div className="flex justify-between border-t border-stone-200 pt-2 font-bold"><span>Saldo pendiente</span><strong>{formatDollars(paymentReceipt.saldo_nuevo)}</strong></div></div>
        <p className="border-t border-dashed border-stone-300 pt-4 text-center text-[10px]">Conserve este comprobante como constancia del pago.</p>
        <div className="rent-receipt-actions mt-5 flex gap-2 font-sans"><button type="button" onClick={() => window.print()} className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white">Imprimir comprobante</button><button type="button" onClick={() => setPaymentReceipt(null)} className="rounded-lg border border-stone-200 px-4 py-2.5 text-sm">Cerrar</button></div>
      </section>
    </div>}
  </section>;
}
