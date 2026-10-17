import React from 'react';
import { Link } from 'react-router-dom';

const metrics = [
  { title: 'Ventas del día', value: 'C$ 1,248.50', detail: '12% vs. ayer', icon: 'shopping_cart', color: 'rose' },
  { title: 'Productos vendidos', value: '42', detail: '18% vs. ayer', icon: 'inventory_2', color: 'sand' },
  { title: 'Stock bajo', value: '6', detail: 'Ver productos', icon: 'deployed_code', color: 'rose' },
  { title: 'Clientes atendidos', value: '35', detail: '10% vs. ayer', icon: 'groups', color: 'gold' },
];

const bestSellers = [
  { name: 'Top básico', units: 12, icon: 'checkroom', tone: 'bg-primary-fixed' },
  { name: 'Bolsa de hombro', units: 8, icon: 'shopping_bag', tone: 'bg-surface-container' },
  { name: 'Set de accesorios', units: 6, icon: 'diamond', tone: 'bg-primary-fixed-dim/50' },
  { name: 'Vestido casual', units: 5, icon: 'apparel', tone: 'bg-surface-container-low' },
];

function MetricCard({ item }) {
  const iconTone = item.color === 'gold' ? 'bg-tertiary-fixed text-tertiary' : item.color === 'sand' ? 'bg-surface-container text-on-surface' : 'bg-primary-fixed text-primary';
  return (
    <article className="rounded-2xl border border-primary-fixed-dim/25 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-on-surface-variant">{item.title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-on-surface sm:text-[28px]">{item.value}</p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconTone}`}>
          <span className="material-symbols-outlined text-[21px]">{item.icon}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1.5 border-t border-primary-fixed-dim/25 pt-3 text-xs text-on-surface-variant">
        {item.title === 'Stock bajo' ? <span className="text-primary">{item.detail}</span> : <><span className="material-symbols-outlined text-[15px] text-emerald-700">trending_up</span><span className="font-semibold text-emerald-800">{item.detail.split(' ')[0]}</span><span>vs. ayer</span></>}
      </div>
    </article>
  );
}

function SalesChart() {
  return (
    <div className="rounded-2xl border border-primary-fixed-dim/25 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Ventas de los últimos 7 días</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Resumen de ingresos de la tienda</p>
        </div>
        <span className="rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-on-surface-variant">Esta semana⌄</span>
      </div>
      <div className="mt-7 grid grid-cols-[38px_1fr] gap-2">
        <div className="flex h-48 flex-col justify-between pb-6 text-[10px] text-on-surface-variant sm:h-56">
          <span>C$ 2,000</span><span>C$ 1,500</span><span>C$ 1,000</span><span>C$ 500</span><span>C$ 0</span>
        </div>
        <div className="relative h-48 sm:h-56">
          <div className="absolute inset-0 flex flex-col justify-between pb-6">
            {[0, 1, 2, 3, 4].map((line) => <div key={line} className="border-t border-dashed border-primary-fixed-dim/45" />)}
          </div>
          <svg className="absolute inset-0 h-[calc(100%-24px)] w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 700 190" role="img" aria-label="Gráfico de ventas semanales">
            <defs><linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#E9B7C3" stopOpacity=".58" /><stop offset="100%" stopColor="#E9B7C3" stopOpacity=".04" /></linearGradient></defs>
            <path d="M0 148 C50 124 55 99 112 105 S172 132 225 92 S284 72 340 80 S399 111 450 57 S515 79 564 59 S634 28 700 12 L700 190 L0 190 Z" fill="url(#salesFill)" />
            <path d="M0 148 C50 124 55 99 112 105 S172 132 225 92 S284 72 340 80 S399 111 450 57 S515 79 564 59 S634 28 700 12" fill="none" stroke="#C67E8F" strokeLinecap="round" strokeWidth="3" />
            <circle cx="700" cy="12" r="5" fill="#C67E8F" />
          </svg>
          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-on-surface-variant sm:text-xs">
            {['11 Oct', '12 Oct', '13 Oct', '14 Oct', '15 Oct', '16 Oct', '17 Oct'].map((day) => <span key={day}>{day}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ user }) {
  const today = new Intl.DateTimeFormat('es-NI', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-primary">RESUMEN DE TU TIENDA</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">¡Hola{user?.name ? `, ${user.name}` : ''}!</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Aquí tienes un resumen de tu tienda hoy.</p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-xl border border-primary-fixed-dim/30 bg-white px-3.5 py-2.5 text-sm text-on-surface shadow-sm">
          <span className="material-symbols-outlined text-[18px] text-primary">calendar_today</span>
          <span className="capitalize">{today}</span>
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">expand_more</span>
        </div>
      </section>

      <section aria-label="Indicadores de la tienda" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => <MetricCard key={item.title} item={item} />)}
      </section>

      <section className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[1.45fr_1fr]">
        <SalesChart />
        <div className="rounded-2xl border border-primary-fixed-dim/25 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-on-surface">Productos más vendidos</h2>
              <p className="mt-1 text-sm text-on-surface-variant">Unidades vendidas esta semana</p>
            </div>
            <Link to="/inventario" aria-label="Ver inventario" className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container-low hover:text-primary">
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
          <div className="mt-4 divide-y divide-primary-fixed-dim/25">
            {bestSellers.map((product) => (
              <div key={product.name} className="flex items-center gap-3 py-3.5">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${product.tone} text-on-surface-variant`}>
                  <span className="material-symbols-outlined">{product.icon}</span>
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">{product.name}</p>
                <span className="text-sm font-semibold text-on-surface">{product.units} uds</span>
              </div>
            ))}
          </div>
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
