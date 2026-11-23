import React, { useEffect, useState } from 'react';
import { formatCordobas } from '../utils/currency';
import posService from '../services/posService';
import { SplashScreen, useFeedback } from '../components/ui/FeedbackProvider';

const PAGE_SIZE = 25;
const invoiceLabel = (id) => `#${String(id).padStart(6, '0')}`;
const formatDate = (value) => value
  ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Managua' }).format(new Date(value))
  : '—';

export default function DevolucionesPage() {
  const { notify } = useFeedback();
  const [view, setView] = useState('pendientes');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState({ total: 0, ventas: [], devoluciones: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [reference, setReference] = useState('');

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = { buscar: search.trim(), pagina: page, por_pagina: PAGE_SIZE };
        const data = view === 'pendientes'
          ? await posService.getReturnableSales(params)
          : await posService.getReturns(params);
        if (active) {
          setResult(data);
          setError('');
        }
      } catch (err) {
        if (active) setError(err.response?.data?.detail || 'No se pudo cargar el módulo de devoluciones.');
      } finally {
        if (active) setLoading(false);
      }
    }, search.trim() ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [view, search, page, refreshKey]);

  const openReturn = (sale) => {
    setSelectedSale(sale);
    setReason('');
    setConfirmed(false);
  };

  const submitReturn = async (event) => {
    event.preventDefault();
    if (!selectedSale || !confirmed || reason.trim().length < 5) return;
    setBusy(true);
    try {
      const created = await posService.registerReturn({ venta_id: selectedSale.id, motivo: reason.trim() });
      notify(`Devolución registrada. Reembolso pendiente: ${formatCordobas(created.monto_reembolso)}.`, 'success');
      setSelectedSale(null);
      setView('historial');
      setPage(1);
    } catch (err) {
      notify(err.response?.data?.detail || 'No se pudo registrar la devolución.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (!selectedRefund || reference.trim().length < 3) return;
    setBusy(true);
    try {
      await posService.confirmRefund(selectedRefund.id, { referencia: reference.trim() });
      notify('Reembolso marcado como realizado.', 'success');
      setSelectedRefund(null);
      setReference('');
      setPage(1);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      notify(err.response?.data?.detail || 'No se pudo confirmar el reembolso.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const rows = view === 'pendientes' ? result.ventas || [] : result.devoluciones || [];

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <header className="flex flex-col justify-between gap-3 rounded-xl bg-surface-container-lowest p-space-lg shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Ventas · Control de caja</p>
          <h1 className="mt-1 font-headline-md text-headline-md text-on-surface">Devoluciones</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Registra devoluciones completas y controla el reembolso al cliente.</p>
        </div>
        <div className="rounded-xl bg-primary-fixed/50 px-4 py-3 text-sm text-on-surface">
          <span className="block text-xs text-on-surface-variant">Flujo</span>
          <strong>Anular venta · reponer inventario · reembolsar</strong>
        </div>
      </header>

      {error && <div role="alert" className="rounded-lg bg-error-container p-3 text-sm text-error">{error}</div>}

      <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 border-b border-surface-container-low sm:border-0">
            {[['pendientes', 'Ventas por devolver'], ['historial', 'Historial']].map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setView(key); setPage(1); }} aria-current={view === key ? 'page' : undefined}
                className={`border-b-2 px-3 py-2 text-sm font-semibold ${view === key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:max-w-sm">
            <span className="sr-only">Buscar factura, cliente o producto</span>
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant">search</span>
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Factura, cliente o producto"
              className="w-full rounded-lg border border-outline-variant py-2 pl-10 pr-3 text-sm outline-none focus:border-primary" />
          </label>
        </div>

        {loading ? <div className="p-6"><SplashScreen compact message="Cargando devoluciones..." /></div> : rows.length === 0 ? (
          <div className="p-10 text-center">
            <span className="material-symbols-outlined text-4xl text-primary/50">assignment_return</span>
            <p className="mt-2 font-semibold text-on-surface">{view === 'pendientes' ? 'No hay ventas disponibles para devolver' : 'Aún no hay devoluciones registradas'}</p>
            <p className="mt-1 text-sm text-on-surface-variant">{search ? 'Prueba con otro término de búsqueda.' : 'Las ventas anuladas aparecerán en el historial.'}</p>
          </div>
        ) : view === 'pendientes' ? (
          <div className="divide-y divide-surface-container-low">
            {rows.map((sale) => <article key={sale.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-on-surface">Factura {invoiceLabel(sale.id)}</h2>
                    <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-semibold text-on-surface-variant">{sale.metodo_pago}</span>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{sale.cliente} · {formatDate(sale.fecha_venta)}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <strong className="font-mono text-lg text-primary">{formatCordobas(sale.total)}</strong>
                  <button type="button" onClick={() => openReturn(sale)} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90">
                    Registrar devolución
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(sale.items || []).map((item) => <span key={item.producto_id} className="rounded-lg bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface">
                  {item.cantidad} × {item.producto} <strong className="ml-1">{formatCordobas(item.subtotal)}</strong>
                </span>)}
              </div>
            </article>)}
          </div>
        ) : (
          <div className="divide-y divide-surface-container-low">
            {rows.map((row) => <article key={row.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-on-surface">Factura {invoiceLabel(row.venta_id)}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.estado_reembolso === 'Reembolsado' ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : 'bg-amber-100 text-amber-900'}`}>
                      {row.estado_reembolso === 'Reembolsado' ? 'Reembolsado' : 'Reembolso pendiente'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-on-surface-variant">{row.cliente} · {formatDate(row.fecha_devolucion)} · {row.metodo_reembolso}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">Motivo: {row.motivo}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <strong className="font-mono text-lg text-primary">{formatCordobas(row.monto_reembolso)}</strong>
                  {row.estado_reembolso === 'Pendiente' && <button type="button" onClick={() => { setSelectedRefund(row); setReference(''); }} className="rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-fixed/40">
                    Registrar reembolso
                  </button>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(row.items || []).map((item) => <span key={item.producto_id} className="rounded-lg bg-surface-container-low px-2.5 py-1.5 text-xs text-on-surface">
                  {item.cantidad} × {item.producto} <strong className="ml-1">{formatCordobas(item.monto_devuelto)}</strong>
                </span>)}
              </div>
              {row.estado_reembolso === 'Reembolsado' && <p className="mt-3 text-xs text-on-surface-variant">Ref. {row.reembolso_referencia} · {formatDate(row.reembolsado_en)}{row.reembolso_registrado_por ? ` · ${row.reembolso_registrado_por}` : ''}</p>}
            </article>)}
          </div>
        )}

        {!loading && result.total > PAGE_SIZE && <div className="flex items-center justify-between border-t border-surface-container-low p-4 text-sm">
          <span>Página {page} de {totalPages} · {result.total} registros</span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-40">Anterior</button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-outline-variant px-3 py-1.5 disabled:opacity-40">Siguiente</button>
          </div>
        </div>}
      </section>

      {selectedSale && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
        <form role="dialog" aria-modal="true" aria-labelledby="return-sale-title" onSubmit={submitReturn} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface-container-lowest p-5 shadow-2xl sm:p-6">
          <h2 id="return-sale-title" className="text-lg font-bold text-on-surface">Devolver factura {invoiceLabel(selectedSale.id)}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">{selectedSale.cliente} · {formatCordobas(selectedSale.total)} · {selectedSale.metodo_pago}</p>
          <div className="mt-4 rounded-xl bg-surface-container-low p-3 text-sm">
            {(selectedSale.items || []).map((item) => <div key={item.producto_id} className="flex justify-between gap-3 py-1"><span>{item.cantidad} × {item.producto}</span><strong>{formatCordobas(item.subtotal)}</strong></div>)}
            <div className="mt-2 flex justify-between border-t border-surface-container-high pt-2 font-bold"><span>Devolución total</span><span>{formatCordobas(selectedSale.total)}</span></div>
          </div>
          <label className="mt-4 block text-sm font-semibold text-on-surface">Motivo de devolución
            <textarea required minLength={5} maxLength={1000} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1.5 w-full rounded-lg border border-outline-variant px-3 py-2 font-normal outline-none focus:border-primary" placeholder="Ej. Venta registrada por error" />
          </label>
          <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Se anulará toda la factura y se repondrán todas las unidades. El reembolso quedará pendiente hasta que se entregue el dinero al cliente.</div>
          <label className="mt-3 flex items-start gap-2 text-sm text-on-surface"><input required type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 accent-primary" />Confirmo la devolución completa y la reposición de estos productos.</label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={() => setSelectedSale(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="submit" disabled={busy || !confirmed || reason.trim().length < 5} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{busy ? 'Registrando…' : 'Confirmar devolución'}</button>
          </div>
        </form>
      </div>}

      {selectedRefund && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
        <form role="dialog" aria-modal="true" aria-labelledby="confirm-refund-title" onSubmit={submitRefund} className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-5 shadow-2xl sm:p-6">
          <h2 id="confirm-refund-title" className="text-lg font-bold text-on-surface">Confirmar reembolso</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Factura {invoiceLabel(selectedRefund.venta_id)} · {formatCordobas(selectedRefund.monto_reembolso)}</p>
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Confirma solo después de entregar el dinero o completar la transferencia.</p>
          <label className="mt-4 block text-sm font-semibold text-on-surface">Referencia o comprobante
            <input required minLength={3} maxLength={120} value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1.5 w-full rounded-lg border border-outline-variant px-3 py-2 font-normal outline-none focus:border-primary" placeholder="N.º de transferencia o recibo" />
          </label>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={() => setSelectedRefund(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="submit" disabled={busy || reference.trim().length < 3} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">{busy ? 'Guardando…' : 'Marcar reembolsado'}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
