import React, { useEffect, useMemo, useState } from 'react';
import { formatCordobas } from '../utils/currency';
import finanzasService from '../services/finanzasService';
import api from '../services/api';

const localDateParts = (options) => Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Managua', ...options }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
const currentPeriod = () => { const p = localDateParts({ year: 'numeric', month: '2-digit' }); return `${p.year}-${p.month}`; };
const todayLocal = () => { const p = localDateParts({ year: 'numeric', month: '2-digit', day: '2-digit' }); return `${p.year}-${p.month}-${p.day}`; };
const initialSalesFilters = () => ({ desde: `${currentPeriod()}-01`, hasta: todayLocal(), marca_id: '', metodo_pago: '', buscar: '' });
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

function buildBrandStatementHtml(brand, period, settlement, productRows, metadata = {}) {
  const money = (value) => escapeHtml(formatCordobas(value));
  const status = settlement?.estado || 'Sin liquidación generada';
  const paymentInfo = settlement?.estado === 'Pagado'
    ? `Pagada el ${escapeHtml(settlement.fecha_pago || '—')} · Ref. ${escapeHtml(settlement.referencia_pago || '—')}`
    : status;
  const productTable = productRows.map((item, index) => `<tr>
    <td class="number">${index + 1}</td><td>${escapeHtml(item.sku || '—')}</td><td><strong>${escapeHtml(item.producto)}</strong></td><td class="number">${escapeHtml(item.cantidad)}</td>
    <td class="number">${money(item.bruto)}</td><td class="number">${money(item.metodos.efectivo)}</td>
    <td class="number">${money(item.metodos.tarjeta)}</td><td class="number">${money(item.metodos.transferencia)}</td>
    <td class="number">${money(item.comision_pos)}</td><td class="number">${money(item.comision_tienda)}</td>
    <td class="number net">${money(item.neto_marca)}</td>
  </tr>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Liquidación ${escapeHtml(brand.marca)} ${escapeHtml(period)}</title>
    <style>
      @page{size:landscape;margin:13mm}*{box-sizing:border-box}body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#292522;margin:0;background:#fff}
      .sheet{max-width:1250px;margin:auto}.hero{position:relative;overflow:hidden;background:linear-gradient(120deg,#f7d1d6,#f3e2d9);color:#493a35;border-radius:10px;padding:22px 26px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #c9a46d}
      .eyebrow{text-transform:uppercase;letter-spacing:1.8px;font-size:9px;color:#786963;font-weight:bold}.hero h1{font-size:26px;margin:8px 0 4px;line-height:1.1}.hero p{color:#786963;margin:0}.period{text-align:right;border-left:1px solid #d7b7a8;padding-left:24px}.period span{display:block;color:#786963;text-transform:uppercase;letter-spacing:1.3px;font-size:9px}.period strong{display:block;font-size:20px;margin-top:5px;color:#493a35}
      .brand-data{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #e8d8d1;margin:14px 0 10px}.brand-data div{padding:8px 10px;border:1px solid #e8d8d1;min-height:43px}.brand-data .label{display:block;margin-bottom:3px}.brand-data span{font-size:10px;color:#786963}.statusbar{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#f8f0e4;border:1px solid #e8d8d1;border-radius:6px;padding:10px 14px;margin:10px 0 18px}.status{border-radius:4px;background:#c9a46d;color:#fff;padding:5px 10px;font-size:10px;font-weight:bold;white-space:nowrap}.status-text{font-size:11px;color:#655b56}.label{color:#786963;text-transform:uppercase;letter-spacing:1px;font-size:9px;font-weight:bold}
      .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin:0 0 22px}.card{border:1px solid #e8d8d1;border-radius:7px;padding:14px 16px;background:#fff;box-shadow:0 2px 7px #493a3508}.card small{display:block;color:#786963;font-size:10px;margin-bottom:8px}.card strong{font-size:18px;color:#493a35}.card.net{background:#f8f0e4;border-color:#c9a46d}.card.net strong{color:#8c5d2f}
      .section-head{display:flex;justify-content:space-between;align-items:end;margin:0 0 9px}.section-head h2{font-size:15px;margin:0;color:#493a35}.section-head p{margin:0;color:#786963;font-size:10px}
      table{width:100%;border-collapse:separate;border-spacing:0;font-size:9px;border:1px solid #e8d8d1;border-radius:7px;overflow:hidden}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:8px 6px;border-bottom:1px solid #e8d8d1;text-align:left}th{background:#e9b7c3;color:#493a35;font-size:8px;text-transform:uppercase;letter-spacing:.35px}th:nth-child(n+5){background:#c9a46d;color:#fff}tbody tr:nth-child(even){background:#fffbfa}tbody tr:last-child td{border-bottom:0}.number{text-align:right;white-space:nowrap}.net{font-weight:bold;color:#8c5d2f}.foot{display:flex;justify-content:space-between;gap:24px;border-top:1px solid #e8d8d1;margin-top:18px;padding-top:11px;color:#786963;font-size:9px}.foot strong{color:#493a35}
      @media(max-width:800px){.sheet{min-width:900px}.hero{border-radius:0}.cards{gap:7px}.card{padding:10px}.card strong{font-size:15px}}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.hero,.card,.statusbar,th{print-color-adjust:exact}.sheet{max-width:none}}
    </style></head><body><main class="sheet">
    <header class="hero"><div><div class="eyebrow">Moon Concept Store · Colectivo</div><h1>${escapeHtml(brand.marca)}</h1><p>Estado de cuenta mensual de ventas</p></div><div class="period"><span>Período liquidado</span><strong>${escapeHtml(period)}</strong></div></header>
    <section class="brand-data"><div><span class="label">Marca</span><span>${escapeHtml(brand.marca)}</span></div><div><span class="label">Código</span><span>${escapeHtml(metadata.codigo || '—')}</span></div><div><span class="label">Categoría</span><span>${escapeHtml(metadata.categoria || 'General')}</span></div><div><span class="label">Representante</span><span>${escapeHtml(metadata.nombre_representante || '—')}</span></div><div><span class="label">Correo</span><span>${escapeHtml(metadata.email || '—')}</span></div><div><span class="label">Teléfono</span><span>${escapeHtml(metadata.telefono || '—')}</span></div></section>
    <div class="statusbar"><div><div class="label">Estado de liquidación</div><div class="status-text">${escapeHtml(paymentInfo)}</div></div><span class="status">${escapeHtml(status)}</span></div>
    <section class="cards"><article class="card"><small>Ventas brutas</small><strong>${money(brand.ventas_brutas)}</strong></article><article class="card"><small>Comisión de tienda · 20%</small><strong>${money(brand.comision_tienda)}</strong></article><article class="card net"><small>Neto para la marca</small><strong>${money(brand.neto_pagar)}</strong></article><article class="card"><small>Recargo terminal POS · 5%</small><strong>${money(brand.comision_pos)}</strong></article></section>
    <div class="section-head"><div><h2>Detalle de productos</h2><p>Unidades vendidas: ${escapeHtml(brand.cantidad)}</p></div><p>Montos en córdobas</p></div>
    <table><thead><tr><th class="number">#</th><th>SKU / código</th><th>Producto</th><th class="number">Unidades</th><th class="number">Bruto</th><th class="number">Efectivo</th><th class="number">Tarjeta</th><th class="number">Transferencia</th><th class="number">POS</th><th class="number">Tienda 20%</th><th class="number">Neto marca</th></tr></thead><tbody>${productTable || '<tr><td colspan="11">No hay detalle de productos en este período.</td></tr>'}</tbody></table>
    <footer class="foot"><span><strong>Moon Concept Store</strong><br>Reporte preparado para ${escapeHtml(brand.marca)} · ${escapeHtml(todayLocal())}</span><span>El recargo POS se informa por separado y no reduce el neto correspondiente a la marca.</span></footer>
    </main></body></html>`;
}

export default function LiquidacionesPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [report, setReport] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [paymentDate, setPaymentDate] = useState(todayLocal());
  const [reference, setReference] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [brandFilter, setBrandFilter] = useState('');
  const [previewBrandId, setPreviewBrandId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('report');
  const [brands, setBrands] = useState([]);
  const [salesFilters, setSalesFilters] = useState(initialSalesFilters());
  const [activeSalesFilters, setActiveSalesFilters] = useState(initialSalesFilters());
  const [salesPage, setSalesPage] = useState(1);
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [salesHistory, setSalesHistory] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const nowPeriod = currentPeriod();
  const isPastPeriod = period < nowPeriod;

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [monthlyReport, monthlySettlements] = await Promise.all([
        finanzasService.obtenerReporte(period), finanzasService.obtenerLiquidaciones(period),
      ]);
      setReport(monthlyReport);
      setSettlements(monthlySettlements);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudieron cargar los reportes.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, [period]);
  useEffect(() => {
    api.get('/marcas/').then(({ data }) => setBrands(Array.isArray(data) ? data : [])).catch(() => setBrands([]));
  }, []);
  useEffect(() => {
    if (view !== 'ventas') return undefined;
    let cancelled = false;
    setSalesLoading(true);
    setError('');
    finanzasService.obtenerHistorialVentas({
      ...activeSalesFilters,
      marca_id: activeSalesFilters.marca_id || undefined,
      metodo_pago: activeSalesFilters.metodo_pago || undefined,
      buscar: activeSalesFilters.buscar || undefined,
      pagina: salesPage,
      por_pagina: 25,
    }).then((data) => { if (!cancelled) setSalesHistory(data); })
      .catch((err) => { if (!cancelled) setError(err.response?.data?.detail || 'No se pudo cargar el historial de ventas.'); })
      .finally(() => { if (!cancelled) setSalesLoading(false); });
    return () => { cancelled = true; };
  }, [view, activeSalesFilters, salesPage]);

  const paid = async () => {
    if (!selected || !reference.trim()) return;
    setSaving(true);
    setError('');
    try {
      await finanzasService.marcarPagada(selected.id, { fecha_pago: paymentDate, referencia_pago: reference.trim() });
      setSelected(null);
      setReference('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const generate = async () => {
    setSaving(true);
    setError('');
    try {
      await finanzasService.generarLiquidaciones(period);
      await refresh();
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudieron generar las liquidaciones.');
    } finally {
      setSaving(false);
    }
  };

  const rows = useMemo(() => {
    if (!report) return [];
    return report.por_marca.map((brand) => {
      const settlement = settlements.find((item) => item.marca_id === brand.marca_id);
      return { ...brand, settlement };
    }).filter((brand) => (filter === 'Todos' || brand.settlement?.estado === filter)
      && (!brandFilter || String(brand.marca_id) === brandFilter));
  }, [report, settlements, filter, brandFilter]);

  const exportCsv = () => {
    if (!report) return;
    const columns = ['Marca', 'Unidades', 'Ventas brutas', 'Retención tienda 20%', 'Neto marca', 'Comisión terminal POS', 'Efectivo', 'Tarjeta', 'Transferencia', 'Estado', 'Fecha pago', 'Referencia'];
    const values = rows.map((row) => [row.marca, row.cantidad, row.ventas_brutas, row.comision_tienda, row.neto_pagar, row.comision_pos,
      row.por_metodo.efectivo, row.por_metodo.tarjeta, row.por_metodo.transferencia,
      row.settlement?.estado || 'Sin liquidar', row.settlement?.fecha_pago || '', row.settlement?.referencia_pago || '']);
    const csv = [columns, ...values].map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `reporte_liquidaciones_${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const searchSales = (event) => {
    event.preventDefault();
    setSalesPage(1);
    setActiveSalesFilters({ ...salesFilters });
  };

  const exportSalesCsv = () => {
    if (!salesHistory?.ventas?.length) return;
    // ponytail: export the current page so large history ranges stay bounded; change to a server export if full-range exports are needed.
    const headers = ['Factura', 'Fecha', 'Cliente', 'Marcas', 'Unidades', 'Método', 'Subtotal productos', 'Comisión POS', 'Total cobrado', 'Detalle'];
    const rows = salesHistory.ventas.map((sale) => [sale.id, sale.fecha_venta, sale.cliente, sale.marcas.join(' | '), sale.unidades,
      sale.metodo_pago, sale.subtotal, sale.comision_pos, sale.total,
      sale.items.map((item) => `${item.cantidad} x ${item.producto} (${item.marca}) = ${item.subtotal}`).join(' | ')]);
    const csv = [headers, ...rows].map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `historial_ventas_${salesFilters.desde}_${salesFilters.hasta}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const previewBrand = report?.por_marca.find((item) => String(item.marca_id) === previewBrandId);
  const previewSettlement = previewBrand && settlements.find((item) => item.marca_id === previewBrand.marca_id);
  const previewProducts = previewBrand ? (report.por_producto || []).filter((item) => item.marca_id === previewBrand.marca_id) : [];
  const previewMetadata = brands.find((item) => String(item.id) === previewBrandId) || {};
  const previewHtml = previewBrand ? buildBrandStatementHtml(previewBrand, period, previewSettlement, previewProducts, previewMetadata) : '';

  const exportBrandExcel = async () => {
    if (!previewBrand) return;
    setSaving(true);
    setError('');
    try {
      await finanzasService.descargarLiquidacionExcel(previewBrand.marca_id, period, previewBrand.marca);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo descargar el Excel de la liquidación.');
    } finally {
      setSaving(false);
    }
  };

  const summary = report?.resumen;
  const comparison = report?.comparacion_mes_anterior;
  return (
    <div className="flex flex-col w-full gap-space-lg">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{view === 'report' ? 'Reportes y liquidaciones' : 'Historial de ventas'}</h1>
          <p className="text-sm text-on-surface-variant">Ventas mensuales y liquidación por marca. Retención fija de tienda: 20%.</p>
        </div>
        {view === 'report' && <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="period">Mes del reporte</label>
          <input id="period" type="month" value={period} max={nowPeriod} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg border border-outline-variant" />
          <button type="button" onClick={exportCsv} disabled={!report} className="px-4 py-2 rounded-lg bg-surface-container-low text-on-surface font-semibold disabled:opacity-50">Exportar CSV</button>
          <button type="button" onClick={generate} disabled={!isPastPeriod || saving || !report?.por_marca?.length} title={!isPastPeriod ? 'Las liquidaciones se generan cuando termina el mes.' : ''} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50">
            {saving ? 'Procesando…' : 'Generar liquidaciones'}
          </button>
        </div>}
      </div>

      <nav className="flex gap-2 border-b border-surface-container-high" aria-label="Sección de reportes">
        {[['report', 'Reporte mensual'], ['ventas', 'Historial de ventas']].map(([key, label]) => <button key={key} type="button" onClick={() => setView(key)} aria-current={view === key ? 'page' : undefined} className={`border-b-2 px-4 py-3 text-sm font-semibold ${view === key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>{label}</button>)}
      </nav>

      {error && <div role="alert" className="p-3 rounded-lg bg-error-container text-error text-sm">{error}</div>}
      {view === 'report' && (loading ? <p className="text-on-surface-variant">Cargando reporte…</p> : summary && <>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            ['Ventas de productos', summary.ventas_brutas], ['Retención tienda (20%)', summary.comision_tienda],
            ['Neto de marcas', summary.neto_marcas], ['Comisión POS cobrada aparte', summary.comision_pos],
          ].map(([label, amount]) => <article key={label} className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-on-surface-variant">{label}</div>
            <div className="text-2xl font-bold mt-2 text-on-surface">{formatCordobas(amount)}</div>
          </article>)}
        </section>

        {comparison && <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm"><p className="text-xs uppercase text-on-surface-variant">Ventas vs. {comparison.periodo}</p><p className="mt-2 text-xl font-bold">{comparison.variacion_ventas >= 0 ? '+' : '−'}{formatCordobas(Math.abs(comparison.variacion_ventas))}</p><p className="text-xs text-on-surface-variant">{comparison.variacion_ventas_pct == null ? 'Sin ventas el mes anterior' : `${comparison.variacion_ventas_pct >= 0 ? '+' : ''}${comparison.variacion_ventas_pct}%`}</p></article>
          <article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm"><p className="text-xs uppercase text-on-surface-variant">Mes anterior</p><p className="mt-2 text-xl font-bold">{formatCordobas(comparison.ventas_brutas_anterior)}</p><p className="text-xs text-on-surface-variant">Ventas de productos</p></article>
          <article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm"><p className="text-xs uppercase text-on-surface-variant">Transacciones vs. mes anterior</p><p className="mt-2 text-xl font-bold">{comparison.variacion_transacciones >= 0 ? '+' : ''}{comparison.variacion_transacciones}</p><p className="text-xs text-on-surface-variant">{comparison.transacciones_anterior} transacciones el mes anterior</p></article>
        </section>}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            ['Cobrado en efectivo', summary.cobrado_efectivo], ['Cobrado con tarjeta', summary.cobrado_tarjeta], ['Cobrado por transferencia', summary.cobrado_transferencia],
          ].map(([label, amount]) => <div key={label} className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex justify-between gap-2"><span className="text-sm text-on-surface-variant">{label}</span><b>{formatCordobas(amount)}</b></div>)}
        </section>

        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 flex flex-wrap justify-between items-center gap-3 border-b border-surface-container-low">
            <div><h2 className="font-bold text-on-surface">Liquidaciones por marca</h2><p className="text-xs text-on-surface-variant">{summary.transacciones} ventas registradas</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="settlement-brand" className="sr-only">Filtrar liquidación por marca</label>
              <select id="settlement-brand" value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className="rounded-lg border border-outline-variant px-3 py-2 text-sm">
                <option value="">Todas las marcas</option>{report.por_marca.map((brand) => <option key={brand.marca_id} value={brand.marca_id}>{brand.marca}</option>)}
              </select>
              <button type="button" onClick={() => setPreviewBrandId(brandFilter)} disabled={!brandFilter} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">Vista previa</button>
              <div className="flex gap-1">{['Todos', 'Pendiente', 'Pagado'].map((option) => <button key={option} type="button" onClick={() => setFilter(option)} className={`px-3 py-1 rounded-lg text-xs font-semibold ${filter === option ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>{option}</button>)}</div>
            </div>
            <p className="w-full text-right text-xs text-on-surface-variant">Elige una marca para revisar su liquidación y descargarla en Excel.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><th className="p-3">Marca</th><th className="p-3 text-right">Unidades</th><th className="p-3 text-right">Bruto</th><th className="p-3 text-right">20% tienda</th><th className="p-3 text-right">Neto a pagar</th><th className="p-3">Estado</th><th className="p-3">Pago / referencia</th></tr></thead>
              <tbody className="divide-y divide-surface-container-low">
                {rows.map((row) => <tr key={row.marca_id}>
                  <td className="p-3 font-semibold">{row.marca}</td><td className="p-3 text-right">{row.cantidad}</td>
                  <td className="p-3 text-right">{formatCordobas(row.ventas_brutas)}</td><td className="p-3 text-right">{formatCordobas(row.comision_tienda)}</td>
                  <td className="p-3 text-right font-bold">{formatCordobas(row.neto_pagar)}</td>
                  <td className="p-3">{row.settlement?.estado || 'Sin liquidar'}</td>
                  <td className="p-3">{row.settlement?.estado === 'Pagado' ? <span>{row.settlement.fecha_pago}<br /><small>{row.settlement.referencia_pago}</small></span> : row.settlement ? <button type="button" onClick={() => setSelected(row.settlement)} className="px-3 py-1 rounded bg-primary text-on-primary text-xs font-semibold">Registrar pago</button> : '—'}</td>
                </tr>)}
                {!rows.length && <tr><td colSpan="7" className="p-6 text-center text-on-surface-variant">No hay marcas con ventas en este período.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-surface-container-low"><h2 className="font-bold text-on-surface">Ventas por día</h2></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><th className="p-3">Fecha</th><th className="p-3 text-right">Unidades</th><th className="p-3 text-right">Ventas de productos</th></tr></thead><tbody className="divide-y divide-surface-container-low">
            {report.por_dia.map((day) => <tr key={day.fecha}><td className="p-3">{day.fecha}</td><td className="p-3 text-right">{day.cantidad}</td><td className="p-3 text-right">{formatCordobas(day.ventas_brutas)}</td></tr>)}
            {!report.por_dia.length && <tr><td colSpan="3" className="p-6 text-center text-on-surface-variant">Sin ventas en este mes.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-surface-container-low"><h2 className="font-bold text-on-surface">Ventas por producto y método</h2><p className="text-xs text-on-surface-variant">El recargo POS se muestra separado y no reduce la venta de la marca.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><th className="p-3">Marca</th><th className="p-3">Producto</th><th className="p-3 text-right">Unidades</th><th className="p-3 text-right">Bruto</th><th className="p-3 text-right">Efectivo</th><th className="p-3 text-right">Tarjeta</th><th className="p-3 text-right">Transferencia</th><th className="p-3 text-right">POS</th></tr></thead><tbody className="divide-y divide-surface-container-low">
            {(report.por_producto || []).map((item) => <tr key={`${item.marca_id}-${item.producto_id}`}><td className="p-3">{item.marca}</td><td className="p-3 font-medium">{item.producto}</td><td className="p-3 text-right">{item.cantidad}</td><td className="p-3 text-right">{formatCordobas(item.bruto)}</td><td className="p-3 text-right">{formatCordobas(item.metodos.efectivo)}</td><td className="p-3 text-right">{formatCordobas(item.metodos.tarjeta)}</td><td className="p-3 text-right">{formatCordobas(item.metodos.transferencia)}</td><td className="p-3 text-right">{formatCordobas(item.comision_pos)}</td></tr>)}
            {!report.por_producto?.length && <tr><td colSpan="8" className="p-6 text-center text-on-surface-variant">Sin ventas de productos en este mes.</td></tr>}
          </tbody></table></div>
        </section>
      </>)}

      {previewBrand && view === 'report' && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewBrandId(''); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="brand-preview-title" className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
            <div><h2 id="brand-preview-title" className="text-lg font-bold text-on-surface">Vista previa · {previewBrand.marca}</h2><p className="text-sm text-on-surface-variant">Liquidación de {period}</p></div>
            <div className="flex gap-2"><button type="button" disabled={saving} onClick={exportBrandExcel} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{saving ? 'Generando...' : 'Descargar Excel'}</button><button type="button" onClick={() => setPreviewBrandId('')} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold" aria-label="Cerrar vista previa">Cerrar</button></div>
          </header>
          <iframe title={`Vista previa de liquidación de ${previewBrand.marca}`} srcDoc={previewHtml} sandbox="" className="min-h-[60vh] flex-1 bg-stone-100" />
          <p className="border-t border-stone-200 px-5 py-3 text-xs text-on-surface-variant">El Excel conserva este diseño y agrega el detalle de productos, métodos de pago y totales de la marca.</p>
        </section>
      </div>}

      {view === 'ventas' && <>
        <form onSubmit={searchSales} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:items-end">
          <label className="text-sm font-medium">Desde<input required type="date" value={salesFilters.desde} onChange={(e) => setSalesFilters({ ...salesFilters, desde: e.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2" /></label>
          <label className="text-sm font-medium">Hasta<input required type="date" min={salesFilters.desde} value={salesFilters.hasta} onChange={(e) => setSalesFilters({ ...salesFilters, hasta: e.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2" /></label>
          <label className="text-sm font-medium">Marca<select value={salesFilters.marca_id} onChange={(e) => setSalesFilters({ ...salesFilters, marca_id: e.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2"><option value="">Todas</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre_marca}</option>)}</select></label>
          <label className="text-sm font-medium">Método<select value={salesFilters.metodo_pago} onChange={(e) => setSalesFilters({ ...salesFilters, metodo_pago: e.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2"><option value="">Todos</option><option>Efectivo</option><option>Tarjeta</option><option>Transferencia</option></select></label>
          <label className="text-sm font-medium xl:col-span-2">Cliente, factura o producto<input value={salesFilters.buscar} maxLength={100} onChange={(e) => setSalesFilters({ ...salesFilters, buscar: e.target.value })} placeholder="Nombre, número de factura, SKU…" className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2" /></label>
          <div className="flex gap-2 xl:col-span-6 xl:justify-end"><button type="submit" className="rounded-lg bg-primary px-4 py-2 font-semibold text-on-primary">Buscar ventas</button><button type="button" disabled={!salesHistory?.ventas?.length} onClick={exportSalesCsv} className="rounded-lg bg-surface-container-low px-4 py-2 font-semibold text-on-surface disabled:opacity-50">Exportar página CSV</button></div>
        </form>

        {salesHistory?.resumen && <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            ['Ventas encontradas', salesHistory.total], ['Ventas de productos', formatCordobas(salesHistory.resumen.ventas_productos)],
            ['Comisión POS', formatCordobas(salesHistory.resumen.comision_pos)], ['Total cobrado', formatCordobas(salesHistory.resumen.total_cobrado)],
          ].map(([label, value]) => <article key={label} className="rounded-xl bg-surface-container-lowest p-4 shadow-sm"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 font-bold text-on-surface">{value}</p></article>)}
        </section>}

        <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          {salesLoading ? <p className="p-8 text-center text-on-surface-variant">Cargando historial…</p> : !salesHistory?.ventas?.length ? <p className="p-8 text-center text-on-surface-variant">No hay ventas que coincidan con esos filtros.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="bg-surface-container-low text-xs uppercase text-on-surface-variant"><th className="p-3">Factura</th><th className="p-3">Fecha</th><th className="p-3">Cliente</th><th className="p-3">Marcas</th><th className="p-3">Método</th><th className="p-3 text-right">Subtotal</th><th className="p-3 text-right">POS</th><th className="p-3 text-right">Cobrado</th><th className="p-3">Detalle</th></tr></thead><tbody className="divide-y divide-surface-container-low">
            {salesHistory.ventas.map((sale) => <React.Fragment key={sale.id}>
              <tr className={expandedSaleId === sale.id ? 'bg-surface-container-low/70' : ''}>
                <td className="p-3 font-semibold">#{sale.id}</td><td className="p-3 whitespace-nowrap">{sale.fecha_venta ? new Date(sale.fecha_venta).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : '—'}</td><td className="p-3">{sale.cliente}</td><td className="p-3">{sale.marcas.join(', ') || '—'}</td><td className="p-3">{sale.metodo_pago}</td><td className="p-3 text-right">{formatCordobas(sale.subtotal)}</td><td className="p-3 text-right">{formatCordobas(sale.comision_pos)}</td><td className="p-3 text-right font-bold">{formatCordobas(sale.total)}</td>
                <td className="p-3"><button type="button" aria-expanded={expandedSaleId === sale.id} aria-controls={`sale-items-${sale.id}`} onClick={() => setExpandedSaleId((current) => current === sale.id ? null : sale.id)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold text-primary hover:bg-surface-container-low"><span className="material-symbols-outlined text-base">{expandedSaleId === sale.id ? 'expand_less' : 'receipt_long'}</span>{expandedSaleId === sale.id ? 'Ocultar' : `Ver ${sale.unidades} artículos`}</button></td>
              </tr>
              {expandedSaleId === sale.id && <tr><td id={`sale-items-${sale.id}`} colSpan="9" className="p-0"><div className="border-y border-surface-container-high bg-surface-container-low/50 p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-bold text-on-surface">Artículos de la factura #{sale.id}</h3><p className="mt-1 text-xs text-on-surface-variant">{sale.cliente} · {sale.fecha_venta ? new Date(sale.fecha_venta).toLocaleString('es-NI', { timeZone: 'America/Managua' }) : 'Fecha no disponible'}</p></div><p className="text-xs text-on-surface-variant">{sale.items.length} productos · {sale.unidades} unidades</p></div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sale.items.map((item, index) => <article key={`${item.producto_id}-${index}`} className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold text-on-surface">{item.producto}</p><p className="mt-1 text-xs text-on-surface-variant">{item.marca}</p></div><span className="shrink-0 rounded-md bg-primary-fixed px-2 py-1 text-[10px] font-semibold text-on-surface">#{index + 1}</span></div>
                  <p className="mt-3 truncate text-xs text-on-surface-variant">SKU: {item.sku || 'Sin código'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-surface-container-low pt-3"><div><p className="text-[10px] uppercase tracking-wide text-on-surface-variant">Cantidad</p><p className="mt-1 font-semibold">{item.cantidad}</p></div><div><p className="text-[10px] uppercase tracking-wide text-on-surface-variant">Precio unitario</p><p className="mt-1 font-semibold">{formatCordobas(item.precio_unitario)}</p></div></div>
                  <div className="mt-3 flex items-center justify-between border-t border-surface-container-low pt-3"><span className="text-xs text-on-surface-variant">Subtotal</span><strong className="text-sm text-on-surface">{formatCordobas(item.subtotal)}</strong></div>
                </article>)}</div>
                <div className="mt-4 flex flex-wrap justify-end gap-x-6 gap-y-2 border-t border-surface-container-high pt-4 text-sm"><span className="text-on-surface-variant">Subtotal productos: <strong className="text-on-surface">{formatCordobas(sale.subtotal)}</strong></span><span className="text-on-surface-variant">Comisión POS: <strong className="text-on-surface">{formatCordobas(sale.comision_pos)}</strong></span><span className="text-on-surface-variant">Total cobrado: <strong className="text-primary">{formatCordobas(sale.total)}</strong></span></div>
              </div></td></tr>}
            </React.Fragment>)}
          </tbody></table></div>}
          {salesHistory?.total > 25 && <div className="flex items-center justify-between border-t border-surface-container-low p-4 text-sm"><span>Página {salesPage} de {Math.ceil(salesHistory.total / 25)}</span><div className="flex gap-2"><button type="button" disabled={salesPage <= 1 || salesLoading} onClick={() => setSalesPage((page) => page - 1)} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-40">Anterior</button><button type="button" disabled={salesPage >= Math.ceil(salesHistory.total / 25) || salesLoading} onClick={() => setSalesPage((page) => page + 1)} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-40">Siguiente</button></div></div>}
        </section>
      </>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="w-full max-w-md rounded-xl bg-surface-container-lowest p-6 shadow-xl">
          <h2 id="payment-title" className="font-bold text-lg text-on-surface">Registrar pago a {selected.nombre_marca}</h2>
          <p className="text-sm text-on-surface-variant mt-1">Monto: {formatCordobas(selected.total_neto_pagar)}</p>
          <label htmlFor="payment-date" className="block mt-4 text-sm font-semibold">Fecha de transferencia</label>
          <input id="payment-date" type="date" required max={todayLocal()} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-outline-variant" />
          <label htmlFor="payment-reference" className="block mt-4 text-sm font-semibold">Referencia / comprobante</label>
          <input id="payment-reference" required maxLength={255} value={reference} onChange={(e) => setReference(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-outline-variant" placeholder="Código de transferencia o comprobante" />
          <div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg bg-surface-container-low">Cancelar</button><button type="button" disabled={!paymentDate || !reference.trim() || saving} onClick={paid} className="px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50">{saving ? 'Guardando…' : 'Confirmar pago'}</button></div>
        </section>
      </div>}
    </div>
  );
}
