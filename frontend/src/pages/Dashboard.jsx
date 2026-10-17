import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import dashboardService from '../services/dashboardService';
import { formatCordobas } from '../utils/currency';

const formatDay = (value, options = { day: 'numeric', month: 'short' }) =>
  new Intl.DateTimeFormat('es-NI', options).format(new Date(`${value}T12:00:00`));

function MetricCard({ item, loading }) {
  const iconTone = item.color === 'gold' ? 'bg-tertiary-fixed text-tertiary' : item.color === 'sand' ? 'bg-surface-container text-on-surface' : 'bg-primary-fixed text-primary';
  return (
    <article className="rounded-2xl border border-primary-fixed-dim/25 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-on-surface-variant">{item.title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-on-surface sm:text-[28px]">{loading ? '—' : item.value}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconTone}`}>
          <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
        </div>
      </div>
      <div className="mt-4 border-t border-primary-fixed-dim/25 pt-3 text-xs text-on-surface-variant">
        {item.href ? <Link to={item.href} className="font-semibold text-primary hover:underline">{item.detail}</Link> : item.detail}
      </div>
    </article>
  );
}

function SalesChart({ days, loading }) {
  const maxValue = Math.max(0, ...days.map((day) => Number(day.total) || 0));
  return (
    <div className="rounded-2xl border border-primary-fixed-dim/25 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Ventas de los últimos 7 días</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Ingresos de ventas facturadas</p>
        </div>
        <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant">Córdobas</span>
      </div>
      {loading ? (
        <div className="mt-7 flex h-48 items-center justify-center text-sm text-on-surface-variant">Cargando ventas…</div>
      ) : days.length ? (
        <div className="mt-7 grid h-52 grid-cols-7 items-end gap-2 sm:h-60 sm:gap-3">
          {days.map((day) => {
            const total = Number(day.total) || 0;
            const height = maxValue > 0 && total > 0 ? Math.max(5, (total / maxValue) * 100) : 2;
            return (
              <div key={day.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                <span className="max-w-full truncate text-[9px] text-on-surface-variant sm:text-[10px]">{total ? formatCordobas(total) : 'C$ 0'}</span>
                <div className="flex h-full w-full items-end">
                  <div
                    title={`${formatDay(day.date, { day: 'numeric', month: 'long' })}: ${formatCordobas(total)}`}
                    className="w-full rounded-t-md bg-primary/70 transition-all"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[10px] capitalize text-on-surface-variant sm:text-xs">{formatDay(day.date, { weekday: 'short' }).replace('.', '')}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-7 flex h-48 items-center justify-center text-sm text-on-surface-variant">Aún no hay ventas en este período.</div>
      )}
    </div>
  );
}

export default function DashboardPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const today = new Intl.DateTimeFormat('es-NI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const loadDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await dashboardService.getSummary();
      setSummary(data);
      setError('');
      setLastUpdated(new Date());
    } catch (requestError) {
      console.error('No se pudo cargar el resumen del dashboard:', requestError);
      setError('No se pudieron cargar los datos del dashboard. Intenta actualizar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(() => loadDashboard(false), 60_000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const metrics = [
    { title: 'Ventas de hoy', value: formatCordobas(summary?.sales_today), detail: `${summary?.sales_count_today ?? 0} ventas facturadas`, icon: 'shopping_cart', color: 'rose' },
    { title: 'Productos vendidos', value: `${summary?.units_sold_today ?? 0}`, detail: 'Unidades vendidas hoy', icon: 'inventory_2', color: 'sand' },
    { title: 'Stock bajo', value: `${summary?.low_stock_products ?? 0}`, detail: 'Ver inventario', href: '/inventario', icon: 'deployed_code', color: 'rose' },
    { title: 'Clientes atendidos', value: `${summary?.customers_today ?? 0}`, detail: 'Clientes con venta hoy', icon: 'groups', color: 'gold' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-primary">RESUMEN DE TU TIENDA</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">¡Hola{user?.name ? `, ${user.name}` : ''}!</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Aquí tienes un resumen de tu tienda hoy.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-fit items-center gap-2 rounded-xl border border-primary-fixed-dim/30 bg-white px-3.5 py-2.5 text-sm text-on-surface shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-primary">calendar_today</span>
            <span className="capitalize">{today}</span>
          </div>
          <button type="button" onClick={() => loadDashboard()} disabled={loading} title={lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-NI')}` : 'Actualizar datos'} className="grid h-10 w-10 place-items-center rounded-xl border border-primary-fixed-dim/30 bg-white text-primary shadow-sm hover:bg-surface-container-low disabled:opacity-50" aria-label="Actualizar dashboard">
            <span className={`material-symbols-outlined ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        </div>
      </section>

      {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-error/20 bg-error-container/40 px-4 py-3 text-sm text-on-surface"><span>{error}</span><button type="button" onClick={() => loadDashboard()} className="shrink-0 font-semibold text-primary hover:underline">Reintentar</button></div>}

      <section aria-label="Indicadores de la tienda" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => <MetricCard key={item.title} item={item} loading={loading && !summary} />)}
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[1.45fr_1fr]">
        <SalesChart days={summary?.sales_last_7_days || []} loading={loading && !summary} />
        <div className="rounded-2xl border border-primary-fixed-dim/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Productos más vendidos</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Unidades vendidas en los últimos 7 días</p>
            </div>
            <Link to="/inventario" aria-label="Ver inventario" className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary">
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
          {loading && !summary ? (
            <p className="py-10 text-center text-sm text-on-surface-variant">Cargando productos…</p>
          ) : summary?.best_sellers?.length ? (
            <div className="mt-4 divide-y divide-primary-fixed-dim/25">
              {summary.best_sellers.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3 py-3.5">
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${index % 2 ? 'bg-surface-container' : 'bg-primary-fixed'} text-on-surface-variant`}>
                    <span className="material-symbols-outlined">{index === 0 ? 'workspace_premium' : 'inventory_2'}</span>
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">{product.name}</p>
                  <span className="text-sm font-semibold text-on-surface">{product.units} uds</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-on-surface-variant">Aún no hay productos vendidos en este período.</p>
          )}
          <Link to="/inventario" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Ver inventario <span className="material-symbols-outlined text-[17px]">arrow_forward</span></Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/pos" className="flex items-center gap-3 rounded-2xl border border-primary-fixed-dim/30 bg-white p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary"><span className="material-symbols-outlined">add_shopping_cart</span></span>
          <span><span className="block text-sm font-semibold text-on-surface">Registrar una venta</span><span className="text-xs text-on-surface-variant">Abrir punto de venta</span></span>
        </Link>
        <Link to="/inventario" className="flex items-center gap-3 rounded-2xl border border-primary-fixed-dim/30 bg-white p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-container text-on-surface"><span className="material-symbols-outlined">inventory_2</span></span>
          <span><span className="block text-sm font-semibold text-on-surface">Revisar inventario</span><span className="text-xs text-on-surface-variant">Consultar productos y existencias</span></span>
        </Link>
        <Link to="/clientes" className="flex items-center gap-3 rounded-2xl border border-primary-fixed-dim/30 bg-white p-4 shadow-sm transition hover:border-primary/50 hover:shadow-md">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-tertiary-fixed text-tertiary"><span className="material-symbols-outlined">group_add</span></span>
          <span><span className="block text-sm font-semibold text-on-surface">Gestionar clientes</span><span className="text-xs text-on-surface-variant">Ver y actualizar registros</span></span>
        </Link>
      </section>
    </div>
  );
}
