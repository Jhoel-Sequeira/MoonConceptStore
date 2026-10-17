import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import brandConfig from '../brandConfig';
import recepcionService from '../services/recepcionService';
import { inventarioService } from '../services/inventarioService';
import { formatCordobas } from '../utils/currency';

const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function RecepcionPage() {
  const [ingresos, setIngresos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await recepcionService.getAll();
      setIngresos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo cargar el historial de recepciones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return ingresos;
    return ingresos.filter((row) => [row.id, row.marca, row.comprobante, row.recibido_por]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [ingresos, search]);
  const totalSkus = ingresos.reduce((sum, item) => sum + (item.items || 0), 0);
  const totalUnits = ingresos.reduce((sum, item) => sum + (item.unidades || 0), 0);

  const openDetail = async (row) => {
    setSelected(row);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      setDetail(await recepcionService.getDetail(row.ingreso_id));
    } catch (err) {
      setDetailError(err.response?.data?.detail || 'No se pudo cargar el detalle de esta recepción.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); setDetailError(''); };

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-surface-container-lowest p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{brandConfig.name} · Inventario</p>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">Recepción y kardex</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Historial de importaciones de productos recibidos por marca. Abre una recepción para revisar sus detalles.</p>
        </div>
        <Link to="/marcas" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <span className="material-symbols-outlined text-lg">upload_file</span> Importar desde Marcas
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Importaciones registradas', value: ingresos.length, icon: 'inventory_2' },
          { label: 'Productos / variantes', value: totalSkus, icon: 'sell' },
          { label: 'Unidades recibidas', value: totalUnits, icon: 'move_to_inbox' },
        ].map((card) => (
          <div key={card.label} className="flex items-center gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-fixed text-primary"><span className="material-symbols-outlined">{card.icon}</span></div>
            <div><p className="text-sm text-on-surface-variant">{card.label}</p><p className="text-2xl font-bold text-on-surface">{card.value.toLocaleString('es-NI')}</p></div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-on-surface">Movimientos de recepción</h2><p className="text-xs text-on-surface-variant">Selecciona una fila para consultar los productos incluidos.</p></div>
          <div className="flex gap-2">
            <label className="flex min-w-56 items-center gap-2 rounded-lg border border-surface-container-high px-3 py-2 text-sm">
              <span className="material-symbols-outlined text-lg text-on-surface-variant">search</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar marca o archivo" className="w-full bg-transparent outline-none" />
            </label>
            <button type="button" onClick={load} title="Actualizar" className="rounded-lg border border-surface-container-high px-3 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">refresh</span></button>
          </div>
        </div>
        {error && <div role="alert" className="m-4 rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr>
              <th className="px-4 py-3">Recepción</th><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3 text-right">Productos</th><th className="px-4 py-3 text-right">Unidades</th><th className="px-4 py-3">Archivo / origen</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-surface-container-low">
              {loading ? <tr><td colSpan="8" className="px-4 py-12 text-center text-on-surface-variant">Cargando historial…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan="8" className="px-4 py-12 text-center text-on-surface-variant">{ingresos.length ? 'No hay resultados para esta búsqueda.' : 'Aún no hay importaciones registradas. Importa una plantilla desde el detalle de una marca.'}</td></tr>
                  : filtered.map((row) => <tr key={row.ingreso_id} onClick={() => openDetail(row)} className="cursor-pointer transition hover:bg-surface-container-low/70" title="Ver detalle de recepción">
                    <td className="px-4 py-4 font-mono font-semibold text-primary">{row.id}</td><td className="px-4 py-4 font-semibold text-on-surface">{row.marca}</td><td className="px-4 py-4 text-on-surface-variant">{dateLabel(row.fecha)}</td><td className="px-4 py-4 text-right tabular-nums">{row.items}</td><td className="px-4 py-4 text-right font-semibold tabular-nums">{row.unidades}</td><td className="max-w-52 truncate px-4 py-4 text-on-surface-variant" title={row.comprobante}>{row.comprobante || 'Importación de plantilla'}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">{row.estado}</span></td><td className="px-4 py-4 text-right"><span className="material-symbols-outlined text-on-surface-variant">chevron_right</span></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="border-t border-surface-container-low px-4 py-3 text-xs text-on-surface-variant">Mostrando {filtered.length} de {ingresos.length} recepciones</div>
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDetail(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="recepcion-detail-title" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-surface-container-low p-5 sm:p-6">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Detalle de ingreso · {selected.id}</p><h2 id="recepcion-detail-title" className="mt-1 text-xl font-bold text-on-surface">{detail?.marca || selected.marca}</h2><p className="mt-1 text-sm text-on-surface-variant">{dateLabel(detail?.fecha || selected.fecha)}</p></div>
            <button onClick={closeDetail} aria-label="Cerrar detalle" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
          </header>
          {detailLoading ? <div className="p-12 text-center text-on-surface-variant">Cargando detalle…</div> : detailError ? <div role="alert" className="m-5 rounded-lg bg-error-container p-4 text-sm text-on-error-container">{detailError}</div> : detail && <>
            <div className="grid gap-3 border-b border-surface-container-low bg-surface-container-low/50 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[['Fecha y hora', dateLabel(detail.fecha)], ['Recibido por', detail.recibido_por || '—'], ['Archivo fuente', detail.comprobante || 'Importación de plantilla'], ['Totales', `${detail.items} productos · ${detail.unidades} unidades`]].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 break-words text-sm font-medium text-on-surface">{value}</p></div>)}
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="sticky top-0 bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Código / variante</th><th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Precio venta</th><th className="px-4 py-3 text-right">Costo de ingreso</th><th className="px-4 py-3 text-right">Stock crítico</th><th className="px-4 py-3">QR</th></tr></thead>
                <tbody className="divide-y divide-surface-container-low">{detail.productos.map((product) => <tr key={product.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3">{product.imagen_url ? <img src={inventarioService.getProductImageUrl(product.imagen_url)} alt="" className="h-11 w-11 rounded-lg border border-surface-container-low object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant"><span className="material-symbols-outlined">image</span></div>}<div className="max-w-xs"><p className="font-medium text-on-surface">{product.nombre}</p><p className="line-clamp-2 text-xs text-on-surface-variant">{product.descripcion || 'Sin descripción'}</p></div></div></td>
                  <td className="px-4 py-3"><p className="font-mono text-xs font-semibold">{product.sku || '—'}</p><p className="text-xs text-on-surface-variant">{product.tamano || 'Sin variante'}</p></td><td className="px-4 py-3 text-right font-semibold tabular-nums">{product.cantidad}</td><td className="px-4 py-3 text-right tabular-nums">{product.precio == null ? '—' : formatCordobas(product.precio)}</td><td className="px-4 py-3 text-right tabular-nums">{product.costo == null ? '—' : formatCordobas(product.costo)}</td><td className="px-4 py-3 text-right tabular-nums">{product.stock_critico ?? '—'}</td><td className="px-4 py-3 font-mono text-xs">{product.codigo_qr || '—'}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <footer className="flex justify-end border-t border-surface-container-low p-4"><button onClick={closeDetail} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Cerrar</button></footer>
          </>}
        </section>
      </div>}
    </div>
  );
}


