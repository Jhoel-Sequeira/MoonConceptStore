import React, { useEffect, useMemo, useState } from 'react';
import brandConfig from '../brandConfig';
import bajasRetirosService from '../services/bajasRetirosService';
import marcasService from '../services/marcasService';
import { inventarioService } from '../services/inventarioService';
import { formatCordobas } from '../utils/currency';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-NI', { dateStyle: 'medium' });
};

export default function BajasRetirosPage() {
  const [retiros, setRetiros] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [items, setItems] = useState([]);
  const [marcaId, setMarcaId] = useState('');
  const [marcaSearch, setMarcaSearch] = useState('');
  const [brandSuggestionsOpen, setBrandSuggestionsOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productSuggestionsOpen, setProductSuggestionsOpen] = useState(false);
  const [motivo, setMotivo] = useState('Retiro de mercadería por la marca');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadHistory = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setPageError('');
    try {
      const data = await bajasRetirosService.getAll();
      setRetiros(Array.isArray(data) ? data : []);
    } catch (error) {
      setPageError(error.response?.data?.detail || 'No se pudo cargar el historial de retiros.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([bajasRetirosService.getAll(), marcasService.getAll()])
      .then(([retirements, brands]) => {
        if (!active) return;
        setRetiros(Array.isArray(retirements) ? retirements : []);
        setMarcas(Array.isArray(brands) ? brands : []);
      })
      .catch((error) => {
        if (active) setPageError(error.response?.data?.detail || 'No se pudieron cargar los retiros y las marcas.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return retiros;
    return retiros.filter((row) => [row.id, row.marca, row.motivo, row.solicitado_por]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [retiros, search]);
  const totalUnits = retiros.reduce((sum, row) => sum + (row.unidades || 0), 0);
  const totalProducts = retiros.reduce((sum, row) => sum + (row.items || 0), 0);
  const brandMatches = marcas.filter((brand) => brand.nombre_marca.toLocaleLowerCase().includes(marcaSearch.trim().toLocaleLowerCase())).slice(0, 8);
  const productMatches = productos
    .filter((product) => Number(product.stock_actual) > 0 && !items.some((item) => item.producto_id === product.id))
    .filter((product) => [product.nombre, product.sku, product.descripcion]
      .some((value) => String(value || '').toLocaleLowerCase().includes(productSearch.trim().toLocaleLowerCase())))
    .slice(0, 10);

  const openCreate = () => {
    setFormError('');
    setNotice('');
    setItems([]);
    setMarcaSearch('');
    setBrandSuggestionsOpen(false);
    setProductSearch('');
    setProductSuggestionsOpen(false);
    setMotivo('Retiro de mercadería por la marca');
    setMarcaId('');
    setProductos([]);
    setModalOpen(true);
  };

  const loadProducts = async (id) => {
    if (!id) { setProductos([]); return; }
    setLoadingProducts(true);
    setFormError('');
    try {
      const data = await inventarioService.getAll({ marca_id: Number(id) });
      setProductos(Array.isArray(data) ? data : []);
    } catch (error) {
      setFormError(error.response?.data?.detail || 'No se pudo cargar el inventario de esta marca.');
      setProductos([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const changeBrand = (brand) => {
    const id = String(brand.id);
    setMarcaId(id);
    setMarcaSearch(brand.nombre_marca);
    setBrandSuggestionsOpen(false);
    setItems([]);
    setProductSearch('');
    setProductSuggestionsOpen(false);
    loadProducts(id);
  };

  const searchBrand = (value) => {
    setMarcaSearch(value);
    setBrandSuggestionsOpen(true);
    if (marcaId) {
      setMarcaId('');
      setProductos([]);
      setItems([]);
      setProductSearch('');
    }
  };

  const addProduct = (product) => {
    if (!product) return;
    if (items.some((row) => row.producto_id === product.id)) {
      setFormError('Ese producto ya está en la lista. Cambia la cantidad en su fila.');
      return;
    }
    setFormError('');
    setItems((current) => [...current, {
      producto_id: product.id,
      nombre: product.nombre,
      sku: product.sku,
      stock_actual: Number(product.stock_actual || 0),
      cantidad: 1,
    }]);
    setProductSearch('');
    setProductSuggestionsOpen(false);
  };

  const updateQuantity = (productId, value) => {
    const parsed = value === '' ? '' : Number(value);
    setItems((current) => current.map((row) => row.producto_id === productId
      ? { ...row, cantidad: parsed === '' ? '' : Math.min(parsed, row.stock_actual) }
      : row));
  };

  const submitRetiro = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!marcaId) { setFormError('Selecciona la marca que retira su mercadería.'); return; }
    if (!items.length) { setFormError('Agrega al menos un producto al retiro.'); return; }
    if (items.some((row) => !Number.isInteger(Number(row.cantidad)) || Number(row.cantidad) <= 0 || Number(row.cantidad) > row.stock_actual)) {
      setFormError('Revisa las cantidades: deben ser enteros positivos y no superar el stock disponible.');
      return;
    }
    setSaving(true);
    try {
      const created = await bajasRetirosService.create({
        marca_id: Number(marcaId),
        motivo: motivo.trim(),
        productos: items.map(({ producto_id, cantidad }) => ({ producto_id, cantidad: Number(cantidad) })),
      });
      setModalOpen(false);
      setNotice(`Retiro ${created.id} registrado: ${created.unidades} unidades descontadas del inventario.`);
      await loadHistory();
    } catch (error) {
      setFormError(error.response?.data?.detail || 'No se pudo registrar el retiro.');
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (row) => {
    setSelected(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await bajasRetirosService.getDetail(row.retiro_id));
    } catch (error) {
      setPageError(error.response?.data?.detail || 'No se pudo cargar el detalle del retiro.');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => { setSelected(null); setDetail(null); };

  return (
    <div className="flex w-full flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-2xl bg-surface-container-lowest p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{brandConfig.name} · Inventario</p>
          <h1 className="mt-1 text-2xl font-bold text-on-surface">Bajas y retiros de mercadería</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Registra cuando una marca retira productos del colectivo y consulta cada movimiento.</p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <span className="material-symbols-outlined text-lg">outbox</span> Registrar retiro
        </button>
      </header>

      {notice && <div role="status" className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar aviso"><span className="material-symbols-outlined text-lg">close</span></button></div>}
      {pageError && <div role="alert" className="rounded-xl bg-error-container px-4 py-3 text-sm text-on-error-container">{pageError}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Retiros registrados', value: retiros.length, icon: 'receipt_long' },
          { label: 'Productos retirados', value: totalProducts, icon: 'inventory_2' },
          { label: 'Unidades retiradas', value: totalUnits, icon: 'remove_shopping_cart' },
        ].map((card) => <div key={card.label} className="flex items-center gap-4 rounded-2xl bg-surface-container-lowest p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-error-container text-error"><span className="material-symbols-outlined">{card.icon}</span></div>
          <div><p className="text-sm text-on-surface-variant">{card.label}</p><p className="text-2xl font-bold text-on-surface">{card.value.toLocaleString('es-NI')}</p></div>
        </div>)}
      </section>

      <section className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col gap-3 border-b border-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-semibold text-on-surface">Historial de retiros</h2><p className="text-xs text-on-surface-variant">Cada registro descuenta las unidades del stock disponible.</p></div>
          <div className="flex gap-2">
            <label className="flex min-w-56 items-center gap-2 rounded-lg border border-surface-container-high px-3 py-2 text-sm">
              <span className="material-symbols-outlined text-lg text-on-surface-variant">search</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar marca o motivo" className="w-full bg-transparent outline-none" />
            </label>
            <button type="button" onClick={() => loadHistory()} title="Actualizar historial" className="rounded-lg border border-surface-container-high px-3 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">refresh</span></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr>
              <th className="px-4 py-3">Código</th><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Motivo</th><th className="px-4 py-3 text-right">Productos</th><th className="px-4 py-3 text-right">Unidades</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Registrado por</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-surface-container-low">
              {loading ? <tr><td colSpan="9" className="px-4 py-12 text-center text-on-surface-variant">Cargando retiros…</td></tr>
                : filtered.length === 0 ? <tr><td colSpan="9" className="px-4 py-12 text-center text-on-surface-variant">{retiros.length ? 'No hay resultados para esta búsqueda.' : 'Todavía no hay retiros registrados.'}</td></tr>
                  : filtered.map((row) => <tr key={row.retiro_id} onClick={() => openDetail(row)} className="cursor-pointer transition hover:bg-surface-container-low/70" title="Ver detalle del retiro">
                    <td className="px-4 py-4 font-mono font-semibold text-error">{row.id}</td><td className="px-4 py-4 font-semibold text-on-surface">{row.marca}</td><td className="max-w-56 truncate px-4 py-4 text-on-surface-variant" title={row.motivo}>{row.motivo}</td><td className="px-4 py-4 text-right tabular-nums">{row.items}</td><td className="px-4 py-4 text-right font-semibold text-error tabular-nums">-{row.unidades}</td><td className="px-4 py-4 text-on-surface-variant">{formatDate(row.fecha)}</td><td className="px-4 py-4 text-on-surface-variant">{row.solicitado_por}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">{row.estado}</span></td><td className="px-4 py-4 text-right"><span className="material-symbols-outlined text-on-surface-variant">chevron_right</span></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="border-t border-surface-container-low px-4 py-3 text-xs text-on-surface-variant">Mostrando {filtered.length} de {retiros.length} retiros</div>
      </section>

      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="create-retiro-title" className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-visible rounded-2xl bg-surface-container-lowest shadow-2xl">
          <header className="flex items-start justify-between border-b border-surface-container-low p-5">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-error">Movimiento de salida</p><h2 id="create-retiro-title" className="mt-1 text-xl font-bold text-on-surface">Registrar retiro de mercadería</h2><p className="mt-1 text-sm text-on-surface-variant">El stock se validará y actualizará al guardar.</p></div>
            <button type="button" onClick={() => setModalOpen(false)} disabled={saving} aria-label="Cerrar formulario" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
          </header>
          <form onSubmit={submitRetiro} className="flex min-h-0 flex-col">
            <div className="flex-1 space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={`relative ${brandSuggestionsOpen ? 'z-30' : ''}`}>
                  <label className="text-sm font-medium text-on-surface">Marca que retira
                    <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-surface-container-high bg-white px-3 py-2.5 focus-within:border-primary">
                      <span className="material-symbols-outlined text-lg text-on-surface-variant">search</span>
                      <input type="text" role="combobox" aria-expanded={brandSuggestionsOpen} value={marcaSearch} onFocus={() => setBrandSuggestionsOpen(true)} onBlur={() => setTimeout(() => setBrandSuggestionsOpen(false), 120)} onChange={(event) => searchBrand(event.target.value)} placeholder="Buscar marca por nombre" className="w-full bg-transparent text-sm font-normal outline-none" />
                    </div>
                  </label>
                  {brandSuggestionsOpen && <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-surface-container-high bg-white p-1 shadow-lg">
                    {brandMatches.length ? brandMatches.map((brand) => <button key={brand.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => changeBrand(brand)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-low">{brand.nombre_marca}</button>) : <p className="px-3 py-2 text-sm text-on-surface-variant">No se encontraron marcas.</p>}
                  </div>}
                  {marcaId && <p className="mt-1 text-xs text-on-surface-variant">Marca seleccionada: {marcaSearch}</p>}
                </div>
                <label className="text-sm font-medium text-on-surface">Motivo del retiro
                  <input required minLength="3" maxLength="2000" value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej. Retiro total de inventario" className="mt-1.5 w-full rounded-lg border border-surface-container-high px-3 py-2.5 font-normal outline-none focus:border-primary" />
                </label>
              </div>
              <div className="rounded-xl border border-surface-container-low p-4">
                <h3 className="font-semibold text-on-surface">Productos a retirar</h3>
                <div className="relative mt-3">
                  <div className="flex items-center gap-2 rounded-lg border border-surface-container-high bg-white px-3 py-2.5 focus-within:border-primary">
                    <span className="material-symbols-outlined text-lg text-on-surface-variant">search</span>
                    <input type="text" role="combobox" aria-expanded={productSuggestionsOpen} value={productSearch} onFocus={() => setProductSuggestionsOpen(true)} onBlur={() => setTimeout(() => setProductSuggestionsOpen(false), 120)} onChange={(event) => { setProductSearch(event.target.value); setProductSuggestionsOpen(true); }} disabled={!marcaId || loadingProducts} placeholder={loadingProducts ? 'Cargando inventario...' : marcaId ? 'Buscar producto por nombre o SKU' : 'Busca y selecciona una marca primero'} className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed" />
                  </div>
                  {productSuggestionsOpen && marcaId && <div className="mt-1 max-h-64 w-full overflow-auto rounded-xl border border-surface-container-high bg-white p-1 shadow-lg">
                    {loadingProducts ? <p className="px-3 py-2 text-sm text-on-surface-variant">Cargando inventario...</p> : productMatches.length ? productMatches.map((product) => <button key={product.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => addProduct(product)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-container-low"><span className="min-w-0"><span className="block truncate text-sm font-medium text-on-surface">{product.nombre}</span><span className="block text-xs text-on-surface-variant">{product.sku || 'Sin SKU'} - {product.stock_actual} disponibles</span></span><span className="material-symbols-outlined text-primary">add_circle</span></button>) : <p className="px-3 py-2 text-sm text-on-surface-variant">No hay productos con stock que coincidan.</p>}
                  </div>}
                  <p className="mt-1 text-xs text-on-surface-variant">Busca por nombre o SKU. Al seleccionar un resultado, se agrega al retiro.</p>
                </div>
                {items.length > 0 ? <div className="mt-4 divide-y divide-surface-container-low">
                  {items.map((item) => <div key={item.producto_id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-on-surface">{item.nombre}</p><p className="text-xs text-on-surface-variant">{item.sku || 'Sin SKU'} · disponibles: {item.stock_actual}</p></div>
                    <label className="flex items-center gap-2 text-xs text-on-surface-variant">Cantidad
                      <input type="number" min="1" max={item.stock_actual} step="1" value={item.cantidad} onChange={(event) => updateQuantity(item.producto_id, event.target.value)} className="w-24 rounded-lg border border-surface-container-high px-2 py-2 text-sm text-on-surface outline-none focus:border-primary" />
                    </label>
                    <button type="button" onClick={() => setItems((current) => current.filter((row) => row.producto_id !== item.producto_id))} aria-label={`Quitar ${item.nombre}`} className="rounded-lg p-2 text-error hover:bg-error-container"><span className="material-symbols-outlined">delete</span></button>
                  </div>)}
                  <div className="flex justify-between pt-3 text-sm font-semibold text-on-surface"><span>Total de unidades</span><span>{items.reduce((sum, item) => sum + (Number(item.cantidad) || 0), 0)}</span></div>
                </div> : <p className="mt-3 rounded-lg bg-surface-container-low px-3 py-4 text-center text-sm text-on-surface-variant">Agrega los productos y cantidades entregados por la marca.</p>}
              </div>
              {formError && <div role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{formError}</div>}
            </div>
            <footer className="flex flex-col-reverse justify-between gap-3 border-t border-surface-container-low p-4 sm:flex-row sm:items-center">
              <p className="text-xs text-on-surface-variant">El retiro quedará guardado en el kardex.</p>
              <div className="flex justify-end gap-2"><button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="rounded-lg border border-surface-container-high px-4 py-2 text-sm text-on-surface">Cancelar</button><button type="submit" disabled={saving || !items.length} className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Confirmar retiro'}</button></div>
            </footer>
          </form>
        </section>
      </div>}

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="retiro-detail-title" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-surface-container-low p-5 sm:p-6">
            <div><p className="text-xs font-semibold uppercase tracking-widest text-error">Detalle del retiro · {selected.id}</p><h2 id="retiro-detail-title" className="mt-1 text-xl font-bold text-on-surface">{detail?.marca || selected.marca}</h2><p className="mt-1 text-sm text-on-surface-variant">{detail?.motivo || selected.motivo}</p></div>
            <button type="button" onClick={closeDetail} aria-label="Cerrar detalle" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
          </header>
          {detailLoading ? <div className="p-12 text-center text-on-surface-variant">Cargando detalle…</div> : detail && <>
            <div className="grid gap-3 border-b border-surface-container-low bg-surface-container-low/50 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {[['Fecha', formatDate(detail.fecha)], ['Registrado por', detail.solicitado_por], ['Estado', detail.estado], ['Total', `${detail.items} productos · ${detail.unidades} unidades`]].map(([label, value]) => <div key={label}><p className="text-xs text-on-surface-variant">{label}</p><p className="mt-1 text-sm font-medium text-on-surface">{value}</p></div>)}
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="sticky top-0 bg-surface-container-low text-xs uppercase tracking-wide text-on-surface-variant"><tr><th className="px-4 py-3">Producto</th><th className="px-4 py-3">SKU / variante</th><th className="px-4 py-3 text-right">Cantidad retirada</th><th className="px-4 py-3 text-right">Precio actual</th><th className="px-4 py-3">Código QR</th></tr></thead>
                <tbody className="divide-y divide-surface-container-low">{detail.productos.map((product) => <tr key={product.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3">{product.imagen_url ? <img src={inventarioService.getProductImageUrl(product.imagen_url)} alt="" className="h-11 w-11 rounded-lg border border-surface-container-low object-cover" /> : <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container-low text-on-surface-variant"><span className="material-symbols-outlined">image</span></div>}<div><p className="font-medium text-on-surface">{product.nombre}</p><p className="max-w-xs text-xs text-on-surface-variant">{product.descripcion || 'Sin descripción'}</p></div></div></td>
                  <td className="px-4 py-3"><p className="font-mono text-xs font-semibold">{product.sku || '—'}</p><p className="text-xs text-on-surface-variant">{product.tamano || 'Sin variante'}</p></td><td className="px-4 py-3 text-right font-bold text-error tabular-nums">-{product.cantidad}</td><td className="px-4 py-3 text-right tabular-nums">{formatCordobas(product.precio)}</td><td className="px-4 py-3 font-mono text-xs">{product.codigo_qr || '—'}</td>
                </tr>)}</tbody>
              </table>
            </div>
            <footer className="flex justify-end border-t border-surface-container-low p-4"><button type="button" onClick={closeDetail} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Cerrar</button></footer>
          </>}
        </section>
      </div>}
    </div>
  );
}

