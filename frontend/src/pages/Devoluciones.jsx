import React, { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { formatCordobas } from '../utils/currency';
import posService from '../services/posService';
import { SplashScreen, useFeedback } from '../components/ui/FeedbackProvider';

const PAGE_SIZE = 25;
const invoiceLabel = (id) => `#${String(id).padStart(6, '0')}`;
const formatDate = (value) => value
  ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Managua' }).format(new Date(value))
  : '—';
const estimateLineRefund = (item, quantity) => {
  if (!quantity) return 0;
  const remainingAmount = Number(item.subtotal || 0) - Number(item.monto_devuelto || 0);
  if (quantity === Number(item.cantidad_disponible)) return remainingAmount;
  return Math.round(Number(item.subtotal || 0) * quantity / Number(item.cantidad_vendida) * 100) / 100;
};

function QrScannerModal({ onClose, onScan }) {
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let stopped = false;
    let controls;
    const startCamera = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('La cámara requiere HTTPS y permiso para acceder al dispositivo.');
        return;
      }
      try {
        const reader = new BrowserQRCodeReader();
        const activeControls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result && !stopped) onScanRef.current(result.getText().trim());
        });
        if (stopped) activeControls.stop();
        else controls = activeControls;
      } catch (error) {
        setCameraError(error.name === 'NotAllowedError'
          ? 'No se concedió permiso para usar la cámara.'
          : 'No se pudo iniciar la cámara. Verifica que el dispositivo tenga una cámara disponible.');
      }
    };
    startCamera();
    return () => { stopped = true; controls?.stop(); };
  }, []);

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="return-qr-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <header className="flex items-center justify-between border-b border-surface-container-low p-4"><div><h2 id="return-qr-title" className="font-bold text-on-surface">Escanear producto</h2><p className="text-xs text-on-surface-variant">Enfoca el código QR del producto</p></div><button type="button" onClick={onClose} aria-label="Cerrar escáner" className="rounded-lg p-2 hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button></header>
      <div className="p-4"><video ref={videoRef} className="aspect-video w-full rounded-lg bg-black object-cover" muted playsInline />{cameraError && <p role="alert" className="mt-3 rounded-lg bg-error-container p-3 text-sm text-error">{cameraError}</p>}</div>
    </section>
  </div>;
}

export default function DevolucionesPage() {
  const { confirm, notify } = useFeedback();
  const [filters, setFilters] = useState({ desde: '', hasta: '', codigo: '', producto: '' });
  const [activeFilters, setActiveFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ total: 0, ventas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState('');
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [refundReference, setRefundReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await posService.getSalesForReturns({
          ...activeFilters,
          pagina: page,
          por_pagina: PAGE_SIZE,
        });
        if (active) {
          setResult(data);
          setError('');
        }
      } catch (err) {
        if (active) setError(err.response?.data?.detail || 'No se pudo cargar la lista de ventas.');
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => { active = false; window.clearTimeout(timer); };
  }, [activeFilters, page, refreshKey]);

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setActiveFilters({ ...filters });
    setExpandedSaleId(null);
  };

  const clearFilters = () => {
    const empty = { desde: '', hasta: '', codigo: '', producto: '' };
    setFilters(empty);
    setActiveFilters(empty);
    setPage(1);
    setExpandedSaleId(null);
  };

  const toggleDetails = (sale) => {
    setExpandedSaleId((current) => current === sale.id ? null : sale.id);
    setQuantities({});
    setReason('');
  };

  const selectedLines = (sale) => (sale.items || [])
    .map((item) => ({ item, cantidad: Number(quantities[item.venta_detalle_id] || 0) }))
    .filter(({ cantidad }) => cantidad > 0);

  const refundEstimate = (sale) => selectedLines(sale)
    .reduce((sum, { item, cantidad }) => sum + estimateLineRefund(item, cantidad), 0);

  const handleScannedCode = (value) => {
    const code = value.replace(/^BHPOS-/i, '');
    const next = { ...filters, producto: code };
    setFilters(next);
    setActiveFilters(next);
    setPage(1);
    setExpandedSaleId(null);
    setCameraOpen(false);
  };

  const submitReturn = async (sale) => {
    const lines = selectedLines(sale);
    const units = lines.reduce((sum, line) => sum + line.cantidad, 0);
    if (!lines.length || reason.trim().length < 5) return;
    const amount = refundEstimate(sale);
    if (!(await confirm(
      `Se repondrán ${units} unidad${units === 1 ? '' : 'es'} y el reembolso quedará pendiente por ${formatCordobas(amount)}.`,
      { title: `Devolución de factura ${invoiceLabel(sale.id)}`, confirmLabel: 'Registrar devolución' },
    ))) return;

    setBusy(true);
    try {
      const created = await posService.registerReturn({
        venta_id: sale.id,
        motivo: reason.trim(),
        lineas: lines.map(({ item, cantidad }) => ({ venta_detalle_id: item.venta_detalle_id, cantidad })),
      });
      notify(`Devolución registrada por ${formatCordobas(created.monto_reembolso)}.`, 'success');
      setExpandedSaleId(null);
      setQuantities({});
      setReason('');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      notify(err.response?.data?.detail || 'No se pudo registrar la devolución.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (!selectedRefund || refundReference.trim().length < 3) return;
    setBusy(true);
    try {
      await posService.confirmRefund(selectedRefund.id, { referencia: refundReference.trim() });
      notify('Reembolso marcado como realizado.', 'success');
      setSelectedRefund(null);
      setRefundReference('');
      setRefreshKey((key) => key + 1);
    } catch (err) {
      notify(err.response?.data?.detail || 'No se pudo confirmar el reembolso.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <header className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ventas · Control de caja</p>
          <h1 className="mt-1 font-headline-md text-headline-md text-on-surface">Devoluciones</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Busca una factura, revisa sus productos y elige cuántas unidades devolver.</p>
        </div>
        <div className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm text-on-surface">
          <span className="block text-xs text-on-surface-variant">Devoluciones registradas</span>
          <strong>{result.total} facturas encontradas</strong>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg bg-error-container p-3 text-sm text-error">{error}</div>}

      <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <form onSubmit={applyFilters} className="grid gap-3 border-b border-surface-container-low p-4 sm:grid-cols-2 xl:grid-cols-5 xl:items-end">
          <label className="text-xs font-semibold text-on-surface-variant">Desde
            <input type="date" value={filters.desde} max={filters.hasta || undefined} onChange={(event) => setFilters({ ...filters, desde: event.target.value })} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" />
          </label>
          <label className="text-xs font-semibold text-on-surface-variant">Hasta
            <input type="date" value={filters.hasta} min={filters.desde || undefined} onChange={(event) => setFilters({ ...filters, hasta: event.target.value })} className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" />
          </label>
          <label className="text-xs font-semibold text-on-surface-variant">Código de factura
            <input inputMode="numeric" value={filters.codigo} onChange={(event) => setFilters({ ...filters, codigo: event.target.value })} placeholder="000039" className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 text-sm text-on-surface outline-none focus:border-primary" />
          </label>
          <div className="text-xs font-semibold text-on-surface-variant"><label htmlFor="return-product-filter">Producto o SKU</label>
            <div className="mt-1 flex gap-2">
              <input id="return-product-filter" value={filters.producto} onChange={(event) => setFilters({ ...filters, producto: event.target.value })} placeholder="Nombre o código del producto" className="min-w-0 flex-1 rounded-lg border border-outline-variant px-3 py-2 text-sm font-normal text-on-surface outline-none focus:border-primary" />
              <button type="button" onClick={() => setCameraOpen(true)} aria-label="Escanear producto" title="Escanear QR con cámara" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:opacity-90"><span className="material-symbols-outlined text-[18px]">qr_code_scanner</span><span>Escanear QR</span></button>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary">Buscar</button>
            <button type="button" onClick={clearFilters} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-on-surface">Limpiar</button>
          </div>
        </form>

        {loading ? <div className="p-6"><SplashScreen compact message="Cargando ventas..." /></div> : result.ventas.length === 0 ? (
          <div className="p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-primary/50">receipt_long</span>
            <p className="mt-2 font-semibold text-on-surface">No hay ventas que coincidan</p>
            <p className="mt-1 text-sm text-on-surface-variant">Cambia las fechas o los filtros de factura y producto.</p>
          </div>
        ) : <div className="divide-y divide-surface-container-low">
          {result.ventas.map((sale) => {
            const expanded = expandedSaleId === sale.id;
            const canReturn = sale.estado_venta === 'Facturada' && Number(sale.items?.reduce((sum, item) => sum + Number(item.cantidad_disponible || 0), 0)) > 0;
            const lines = selectedLines(sale);
            const selectedUnits = lines.reduce((sum, line) => sum + line.cantidad, 0);
            return <article key={sale.id} className="p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-on-surface">Factura {invoiceLabel(sale.id)}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sale.estado_devolucion === 'Sin devolución' ? 'bg-surface-container-low text-on-surface-variant' : sale.estado_devolucion === 'Parcial' ? 'bg-amber-100 text-amber-900' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'}`}>
                      {sale.estado_devolucion}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-on-surface-variant">{formatDate(sale.fecha_venta)} · {sale.cliente} · {sale.metodo_pago}</p>
                  {Number(sale.monto_devuelto) > 0 && <p className="mt-1 text-xs text-on-surface-variant">Devuelto: {formatCordobas(sale.monto_devuelto)}{sale.reembolso_pendiente ? ' · reembolso pendiente' : ''}</p>}
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <strong className="font-mono text-lg text-primary">{formatCordobas(sale.total)}</strong>
                  <button type="button" onClick={() => toggleDetails(sale)} aria-expanded={expanded} className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-fixed/40">
                    <span className="material-symbols-outlined text-lg">{expanded ? 'expand_less' : 'receipt_long'}</span>
                    {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                </div>
              </div>

              {expanded && <div className="mt-4 rounded-xl border border-surface-container-high bg-surface-container-low/30 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div><h3 className="font-semibold text-on-surface">Productos de la factura</h3><p className="text-xs text-on-surface-variant">Indica cuántas unidades de cada producto deseas devolver.</p></div>
                  {canReturn && <button type="button" onClick={() => setCameraOpen(true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary hover:opacity-90"><span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>Escanear QR</button>}
                  {!canReturn && <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant">Esta factura ya no tiene unidades disponibles</span>}
                </div>
                <div className="flex flex-col divide-y divide-surface-container-high rounded-lg border border-surface-container-high bg-white">
                  {(sale.items || []).map((item) => {
                    const available = Number(item.cantidad_disponible || 0);
                    const quantity = Number(quantities[item.venta_detalle_id] || 0);
                    const refund = estimateLineRefund(item, quantity);
                    return <div key={item.venta_detalle_id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0"><p className="truncate text-sm font-semibold text-on-surface">{item.producto}</p><p className="text-xs text-on-surface-variant">{item.sku || 'Sin SKU'} · Vendidas {item.cantidad_vendida} · Devueltas {item.cantidad_devuelta} · Disponibles {available}</p></div>
                      <span className="text-sm font-semibold text-on-surface sm:text-right">{formatCordobas(item.subtotal)}</span>
                      <label className="flex items-center gap-2 text-xs font-semibold text-on-surface-variant">Devolver
                        <input type="number" min="0" max={available} step="1" value={quantities[item.venta_detalle_id] || ''} disabled={!canReturn || available < 1 || busy}
                          onChange={(event) => {
                            const value = event.target.value;
                            setQuantities((current) => ({
                              ...current,
                              [item.venta_detalle_id]: value === '' ? '' : String(Math.min(available, Math.max(0, Math.trunc(Number(value) || 0)))),
                            }));
                          }}
                          className="w-20 rounded-md border border-outline-variant px-2 py-1.5 text-center text-sm text-on-surface outline-none focus:border-primary disabled:bg-surface-container-low" />
                      </label>
                      {quantity > 0 && <p className="text-right text-xs text-on-surface-variant sm:col-span-3">Reembolso estimado: {formatCordobas(refund)}</p>}
                    </div>;
                  })}
                </div>
                {canReturn && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <label className="text-sm font-semibold text-on-surface">Motivo
                    <textarea rows={2} maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Producto no era lo que buscaba" className="mt-1 block w-full rounded-lg border border-outline-variant px-3 py-2 font-normal outline-none focus:border-primary disabled:bg-surface-container-low" />
                  </label>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                    <div className="text-right"><p className="text-xs text-on-surface-variant">{selectedUnits} unidades</p><strong className="font-mono text-primary">{formatCordobas(refundEstimate(sale))}</strong></div>
                    <button type="button" disabled={busy || !lines.length || reason.trim().length < 5} onClick={() => submitReturn(sale)} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50">{busy ? 'Registrando…' : 'Registrar devolución'}</button>
                  </div>
                </div>}
                {sale.historial_devoluciones?.length > 0 && <section className="mt-4 border-t border-surface-container-high pt-3">
                  <h4 className="text-sm font-semibold text-on-surface">Devoluciones registradas</h4>
                  <div className="mt-2 divide-y divide-surface-container-high rounded-lg border border-surface-container-high bg-white">
                    {sale.historial_devoluciones.map((entry) => <div key={entry.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-medium text-on-surface">{formatCordobas(entry.monto)} · {entry.metodo}</p><p className="text-xs text-on-surface-variant">{formatDate(entry.fecha)} · {entry.estado === 'Reembolsado' ? `Ref. ${entry.referencia || 'registrada'} · ${formatDate(entry.reembolsado_en)}` : 'Reembolso pendiente'}</p></div>
                      {entry.estado === 'Pendiente' && <button type="button" disabled={busy} onClick={() => { setSelectedRefund(entry); setRefundReference(''); }} className="self-start rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-fixed/40 sm:self-auto">Registrar reembolso</button>}
                    </div>)}
                  </div>
                </section>}
              </div>}
            </article>;
          })}
        </div>}

        {!loading && result.total > PAGE_SIZE && <div className="flex items-center justify-between border-t border-surface-container-low p-4 text-sm">
          <span>Página {page} de {totalPages} · {result.total} facturas</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-40">Anterior</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-40">Siguiente</button>
          </div>
        </div>}
      </section>

      {cameraOpen && <QrScannerModal onClose={() => setCameraOpen(false)} onScan={handleScannedCode} />}

      {selectedRefund && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 modal-scroll-overlay">
        <form role="dialog" aria-modal="true" aria-labelledby="refund-title" onSubmit={submitRefund} className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-5 shadow-2xl sm:p-6">
          <h2 id="refund-title" className="text-lg font-bold text-on-surface">Confirmar reembolso</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Factura {invoiceLabel(selectedRefund.venta_id)} · {formatCordobas(selectedRefund.monto)}</p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Confirma solo después de entregar el dinero o completar la transferencia.</p>
          <label className="mt-4 block text-sm font-semibold text-on-surface">Referencia o comprobante
            <input required minLength={3} maxLength={120} value={refundReference} onChange={(event) => setRefundReference(event.target.value)} className="mt-1.5 w-full rounded-lg border border-outline-variant px-3 py-2 font-normal outline-none focus:border-primary" placeholder="N.º de transferencia o recibo" />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={() => setSelectedRefund(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="submit" disabled={busy || refundReference.trim().length < 3} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{busy ? 'Guardando…' : 'Marcar reembolsado'}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
