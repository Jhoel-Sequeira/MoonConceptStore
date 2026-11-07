import React, { useState, useEffect, useRef } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import brandConfig from '../brandConfig';
import inventarioService from '../services/inventarioService';
import posService from '../services/posService'; // Opcional, si tienes endpoint de venta
import clientesService from '../services/clientesService';
import { formatCordobas } from '../utils/currency';
import { SplashScreen, useFeedback } from '../components/ui/FeedbackProvider';

function InvoiceBarcode({ value }) {
  const text = String(value || '000000');
  let seed = [...text].reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 2166136261);
  const bars = [];
  let x = 4;
  for (let index = 0; index < 96; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const width = 1 + ((seed >>> 28) % 3);
    if (index % 2 === 0) bars.push(<rect key={index} x={x} y="2" width={width} height="38" fill="#382e29" />);
    x += width + 1;
  }
  return <svg role="img" aria-label={'Código de barras de factura ' + text} viewBox={'0 0 ' + (x + 3) + ' 42'} className="mx-auto h-12 w-full max-w-[250px]" preserveAspectRatio="none">{bars}</svg>;
}

const formatInvoiceDate = (value) => new Intl.DateTimeFormat('es-NI', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));
const normalizeSearch = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function POSPage() {
  const { notify } = useFeedback();
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedMetodoPago, setSelectedMetodoPago] = useState('Efectivo');
  const [cashEntryOpen, setCashEntryOpen] = useState(false);
  const [cardPaymentOpen, setCardPaymentOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerOptions, setCustomerOptions] = useState([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [processingSale, setProcessingSale] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const [invoice, setInvoice] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState(6.75);
  const [commissionRateDraft, setCommissionRateDraft] = useState('6.75');
  const [savingCommissionRate, setSavingCommissionRate] = useState(false);

  // 1. Cargar productos desde la base de datos (Backend Python)
  const cargarProductos = async () => {
    try {
      setLoading(true);
      const res = await inventarioService.getAll();
      const list = Array.isArray(res) ? res : (res?.data || res?.results || []);
      setProductos(list.filter((product) => Number(product.estado_id) === 1));
    } catch (err) {
      console.error('Error cargando inventario en POS:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, []);
  useEffect(() => {
    let active = true;
    posService.getCommissionConfig().then((config) => {
      if (!active) return;
      const rate = Number(config.comision_tarjeta_porcentaje);
      setCommissionRate(rate);
      setCommissionRateDraft(String(rate));
    }).catch((error) => {
      if (active) notify(error.response?.data?.detail || 'No se pudo cargar la tasa de comisión POS.', 'error');
    });
    return () => { active = false; };
  }, [notify]);
  useEffect(() => {
    if (!customerSearchOpen) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        setCustomerSearchLoading(true);
        const matches = await clientesService.getAll({ buscar: customerQuery.trim(), limite: 8 });
        if (active) setCustomerOptions(matches);
      } catch (error) {
        if (active) {
          setCustomerOptions([]);
          notify(error.response?.data?.detail || 'No se pudo buscar clientes.', 'error');
        }
      } finally {
        if (active) setCustomerSearchLoading(false);
      }
    }, customerQuery.trim() ? 180 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [customerQuery, customerSearchOpen, notify]);
  useEffect(() => {
    if (!cameraOpen) return undefined;
    let stopped = false;
    let controls;

    const stopCamera = () => {
      stopped = true;
      controls?.stop();
    };

    const startCamera = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError('La cámara requiere HTTPS y permiso para acceder al dispositivo. Abre el sistema desde una dirección segura.');
        return;
      }

      try {
        const reader = new BrowserQRCodeReader();
        const activeControls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result) => {
            if (result && !stopped) {
              processScannedCode(result.getText());
              setCameraOpen(false);
            }
          },
        );
        if (stopped) activeControls.stop();
        else controls = activeControls;
      } catch (error) {
        setCameraError(error.name === 'NotAllowedError'
          ? 'No se concedió permiso para usar la cámara. Habilítalo en el navegador e inténtalo de nuevo.'
          : 'No se pudo iniciar la cámara. Verifica que el dispositivo tenga una cámara disponible.');
      }
    };

    setCameraError('');
    startCamera();
    return stopCamera;
  }, [cameraOpen]);

  // Extraer marcas/categorías únicas dinámicamente de los productos cargados
  const categories = [
    'Todo',
    ...Array.from(
      new Set(
        productos
          .map((p) => p.categoria || p.marca_nombre || p.marca?.nombre_marca)
          .filter(Boolean)
      )
    ),
  ];

  // Filtro en memoria por búsqueda y categoría
  const filteredCatalog = productos.filter((p) => {
    const nombre = p.nombre || '';
    const sku = p.sku || '';
    const marca = p.marca_nombre || p.marca?.nombre_marca || '';
    const cat = p.categoria || marca;

    const matchesCat = selectedCategory === 'Todo' || cat === selectedCategory;
    const normalizedSearch = normalizeSearch(searchTerm);
    const matchesSearch =
      normalizeSearch(nombre).includes(normalizedSearch) ||
      normalizeSearch(sku).includes(normalizedSearch) ||
      normalizeSearch(marca).includes(normalizedSearch) ||
      normalizeSearch(p.codigo_qr).includes(normalizedSearch) ||
      normalizeSearch(p.codigo_articulo).includes(normalizedSearch) ||
      normalizeSearch(p.talla).includes(normalizedSearch) ||
      normalizeSearch(p.color).includes(normalizedSearch) ||
      normalizeSearch(p.descripcion).includes(normalizedSearch);

    return matchesCat && matchesSearch;
  });
  const productSuggestions = searchTerm.trim() ? filteredCatalog.slice(0, 7) : [];

  // Agregar al carrito con validación de stock de BD
  const handleAddToCart = (product) => {
    const stockDisponible = product.stock_actual ?? product.stock ?? 0;
    if (stockDisponible <= 0) {
      notify(`El producto "${product.nombre}" no tiene existencias disponibles.`, 'warning');
      return false;
    }

    const exists = cart.find((item) => item.id === product.id);
    if (exists) {
      if (exists.qty + 1 > stockDisponible) {
        notify(`Stock máximo disponible alcanzado (${stockDisponible} unidades).`, 'warning');
        return false;
      }
      setCart(cart.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          sku: product.sku,
          nombre: product.nombre,
          variante: [product.talla && `Talla ${product.talla}`, product.color].filter(Boolean).join(' · '),
          marca: product.marca_nombre || product.marca?.nombre_marca || 'General',
          precio: parseFloat(product.precio) || 0,
          stockMax: stockDisponible,
          qty: 1,
        },
      ]);
    }
    return true;
  };

  const addSuggestedProduct = (product) => {
    const added = handleAddToCart(product);
    setSearchTerm('');
    setScanMessage(added ? `${product.nombre} agregado al ticket.` : `${product.nombre} sin existencias disponibles.`);
    setSearchSuggestionsOpen(false);
    setSelectedSuggestionIndex(0);
  };

  // Atajo para lector de Código de Barras / QR con tecla Enter
  const processScannedCode = (value) => {
    const code = String(value || '').trim().toLowerCase();
    if (!code) return;
    const match = productos.find(
      (p) => p.sku?.trim().toLowerCase() === code || p.codigo_qr?.trim().toLowerCase() === code
    );

    if (match) {
      const added = handleAddToCart(match);
      setSearchTerm('');
      setScanMessage(added ? `${match.nombre} agregado al ticket.` : `${match.nombre} sin existencias disponibles.`);
    } else {
      setScanMessage(`No se encontró producto para el código "${String(value).trim()}".`);
      setSearchTerm('');
    }
    setSearchSuggestionsOpen(false);
    setSelectedSuggestionIndex(0);
  };

  const handleKeyDownSearch = (e) => {
    if (e.key === 'ArrowDown' && productSuggestions.length) {
      e.preventDefault();
      setSearchSuggestionsOpen(true);
      setSelectedSuggestionIndex((index) => (index + 1) % productSuggestions.length);
      return;
    }
    if (e.key === 'ArrowUp' && productSuggestions.length) {
      e.preventDefault();
      setSearchSuggestionsOpen(true);
      setSelectedSuggestionIndex((index) => (index - 1 + productSuggestions.length) % productSuggestions.length);
      return;
    }
    if (e.key === 'Escape') {
      setSearchSuggestionsOpen(false);
      return;
    }
    if (e.key === 'Enter' && searchTerm.trim() !== '') {
      e.preventDefault();
      const exactProduct = productos.find((product) =>
        normalizeSearch(product.sku) === normalizeSearch(searchTerm.trim()) ||
        normalizeSearch(product.codigo_qr) === normalizeSearch(searchTerm.trim())
      );
      if (exactProduct) processScannedCode(searchTerm);
      else if (productSuggestions.length) addSuggestedProduct(productSuggestions[selectedSuggestionIndex] || productSuggestions[0]);
      else processScannedCode(searchTerm);
    }
  };

  const handleQtyChange = (id, delta) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.qty + delta;
            if (nextQty > item.stockMax) {
              notify(`Solo hay ${item.stockMax} unidades disponibles.`, 'warning');
              return item;
            }
            return nextQty > 0 ? { ...item, qty: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (id) => {
    setCart(cart.filter((item) => item.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.precio * item.qty, 0);
  const totalItems = cart.reduce((acc, item) => acc + item.qty, 0);
  const totalCents = Math.round(subtotal * 100);
  const cardCommissionCents = Math.round(totalCents * commissionRate / 100);
  const cashReceivedCents = Math.max(0, Math.round((Number(cashReceived.replace(',', '.')) || 0) * 100));
  const changeCents = Math.max(0, cashReceivedCents - totalCents);

  const saveCommissionRate = async () => {
    const rate = Number(commissionRateDraft.replace(',', '.'));
    if (!Number.isFinite(rate) || rate < 0 || rate > 100 || !/^\d{1,3}(?:[.,]\d{1,2})?$/.test(commissionRateDraft.trim())) {
      notify('Ingresa una tasa entre 0% y 100%, con máximo dos decimales.', 'warning');
      return;
    }
    try {
      setSavingCommissionRate(true);
      const config = await posService.saveCommissionConfig({ comision_tarjeta_porcentaje: rate });
      const savedRate = Number(config.comision_tarjeta_porcentaje);
      setCommissionRate(savedRate);
      setCommissionRateDraft(String(savedRate));
      notify('Tasa de comisión POS guardada.', 'success');
    } catch (error) {
      notify(error.response?.data?.detail || 'No se pudo guardar la tasa de comisión POS.', 'error');
    } finally {
      setSavingCommissionRate(false);
    }
  };

  // Procesar venta en el Backend Python
  const handleCompleteSale = async (metodo) => {
    const paymentMethod = metodo || selectedMetodoPago;
    if (paymentMethod === 'Efectivo' && cashReceivedCents < totalCents) return;
    try {
      setProcessingSale(true);
      const result = await posService.crearVenta({
        cliente_id: selectedClient?.id ?? null,
        metodo_pago: paymentMethod,
        items: cart.map((item) => ({ producto_id: item.id, cantidad: item.qty })),
      });
      setInvoice({
        ...result,
        fecha_venta: new Date().toISOString(),
        efectivo_recibido: paymentMethod === 'Efectivo' ? cashReceivedCents / 100 : null,
        vuelto: paymentMethod === 'Efectivo' ? changeCents / 100 : null,
      });
      setReceiptOpen(false);
      setCart([]);
      setSelectedClient(null);
      setCustomerQuery('');
      setCustomerSearchOpen(false);
      setPaymentModalOpen(false);
      setCashEntryOpen(false);
      setCardPaymentOpen(false);
      setCashReceived('');

      // Recargar stock actualizado desde la base de datos
      cargarProductos();
    } catch (err) {
      console.error('Error procesando venta:', err);
      notify('Error al registrar la venta: ' + (err.response?.data?.detail || err.message), 'error');
    } finally {
      setProcessingSale(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-lg bg-primary text-on-primary">
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
          </span>
          <div>
            <h1 className="font-bold text-lg text-on-surface">Punto de Venta (POS)</h1>
            <span className="text-xs text-on-surface-variant">
              {brandConfig?.name || 'BrandHub'} · {brandConfig?.branchName || 'Tienda Central'} · Terminal 01
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cargarProductos}
            title="Refrescar inventario"
            className="flex items-center gap-1 px-3 py-1 bg-surface-container-low rounded-lg text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">sync</span>
            Sincronizar
          </button>

        </div>
      </div>

      {/* 2. Main Grid: Catálogo (7 cols) + Carrito (5 cols) */}
      <div className="grid grid-cols-12 gap-space-lg items-start">
        {/* Catálogo de Productos */}
        <div className="order-2 col-span-12 flex flex-col gap-4 lg:order-1 lg:col-span-7">
          <div className="bg-surface-container-lowest p-3 rounded-xl shadow-sm flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
                <input
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={searchSuggestionsOpen && Boolean(searchTerm.trim())}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setScanMessage(''); setSearchSuggestionsOpen(true); setSelectedSuggestionIndex(0); }}
                  onFocus={() => setSearchSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchSuggestionsOpen(false), 120)}
                  onKeyDown={handleKeyDownSearch}
                  placeholder="Busca un producto o escanea su QR..."
                  className="w-full h-10 pl-9 pr-4 bg-surface-container-low rounded-lg text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searchSuggestionsOpen && searchTerm.trim() && (
                  <div role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border border-surface-container-high bg-white p-1 shadow-xl">
                    {productSuggestions.length ? productSuggestions.map((product, index) => {
                      const stock = product.stock_actual ?? product.stock ?? 0;
                      return (
                        <button
                          key={product.id}
                          id={`pos-product-suggestion-${product.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === selectedSuggestionIndex}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          onClick={() => addSuggestedProduct(product)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${index === selectedSuggestionIndex ? 'bg-surface-container-low' : 'hover:bg-surface-container-low'}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-on-surface">{product.nombre}</span>
                            <span className="block truncate text-xs text-on-surface-variant">{product.sku || 'Sin SKU'} · {product.marca_nombre || 'General'} · {stock} disponibles</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-primary">{formatCordobas(product.precio)}</span>
                        </button>
                      );
                    }) : (
                      <p className="px-3 py-3 text-sm text-on-surface-variant">No hay productos que coincidan.</p>
                    )}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setCameraOpen(true)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90">
                <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>Escanear QR
              </button>
            </div>
            {scanMessage && <p role="status" className="px-2 text-xs text-on-surface-variant">{scanMessage}</p>}
            <div className="hidden items-center gap-1.5 overflow-x-auto py-1 lg:flex">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === c
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Productos */}
          {loading ? (
            <div className="hidden bg-surface-container-lowest rounded-xl shadow-sm lg:block"><SplashScreen compact message="Cargando productos para venta..." /></div>
          ) : filteredCatalog.length === 0 ? (
            <div className="hidden p-12 text-center text-sm text-on-surface-variant bg-surface-container-lowest rounded-xl shadow-sm lg:block">
              No se encontraron productos disponibles con ese criterio.
            </div>
          ) : (
            <div className="hidden grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid">
              {filteredCatalog.map((p) => {
                const stock = p.stock_actual ?? p.stock ?? 0;
                const sinStock = stock <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !sinStock && handleAddToCart(p)}
                    className={`bg-surface-container-lowest rounded-xl p-3 shadow-sm transition-all flex flex-col justify-between group border border-transparent ${sinStock
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:shadow-md hover:border-primary/20 cursor-pointer'
                      }`}
                  >
                    <div>
                      <div className="relative w-full h-28 rounded-lg bg-surface-container overflow-hidden flex items-center justify-center">
                        {p.imagen_url ? (
                          <img
                            src={inventarioService.getProductImageUrl(p.imagen_url)}
                            alt={p.nombre}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-primary/40">
                            inventory_2
                          </span>
                        )}
                        <span
                          className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold shadow-sm ${sinStock ? 'bg-error text-white' : 'bg-white/90 text-secondary'
                            }`}
                        >
                          {stock} uds
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-2">
                        <span className="text-[11px] font-semibold text-primary">
                          {p.marca_nombre || p.marca?.nombre_marca || 'General'}
                        </span>
                        <h4 className="font-semibold text-xs text-on-surface line-clamp-1">{p.nombre}</h4>
                        <span className="text-[11px] font-mono text-on-surface-variant">{p.sku}</span>
                        {p.codigo_articulo && <span className="text-[10px] text-primary">Artículo {p.codigo_articulo}</span>}
                        {(p.talla || p.color) && <span className="text-[10px] text-on-surface-variant">{[p.talla && `Talla ${p.talla}`, p.color].filter(Boolean).join(' · ')}</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-container-low">
                      <span className="font-bold text-sm text-on-surface">
                        {formatCordobas(p.precio)}
                      </span>
                      <button
                        disabled={sinStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(p);
                        }}
                        className="p-1 rounded-lg bg-surface-container-low text-primary hover:bg-primary hover:text-on-primary transition-colors disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Carrito de Venta */}
        <div className="order-1 col-span-12 flex flex-col gap-4 lg:order-2 lg:col-span-5">
          <div className="relative overflow-visible rounded-xl bg-surface-container-lowest shadow-sm flex flex-col">
            <div className="p-4 bg-surface-container-low/50 flex flex-col gap-2 border-b border-surface-container-low">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-on-surface">Ticket Activo</span>
                <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary text-xs font-bold font-mono">
                  {totalItems} UDS
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-surface-container-lowest p-2">
                <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                <div className="relative min-w-0 flex-1">
                  <input
                    aria-label="Buscar cliente para la factura"
                    aria-expanded={customerSearchOpen}
                    aria-controls="pos-client-results"
                    role="combobox"
                    autoComplete="off"
                    placeholder="Buscar cliente o Consumidor Final"
                    value={selectedClient ? selectedClient.nombre_cliente : customerQuery}
                    onFocus={() => setCustomerSearchOpen(true)}
                    onBlur={() => window.setTimeout(() => setCustomerSearchOpen(false), 120)}
                    onChange={(event) => { setSelectedClient(null); setCustomerQuery(event.target.value); setCustomerSearchOpen(true); }}
                    className="h-9 w-full rounded-md border border-surface-container-low bg-white px-2 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {customerSearchOpen && <div id="pos-client-results" role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1 shadow-xl">
                    {customerSearchLoading ? <p className="px-3 py-2 text-xs text-on-surface-variant">Buscando clientes…</p> : customerOptions.length ? customerOptions.map((client) => <button key={client.id} type="button" role="option" aria-selected={selectedClient?.id === client.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedClient(client); setCustomerQuery(''); setCustomerSearchOpen(false); }} className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left hover:bg-primary-fixed/50">
                      <span className="text-xs font-semibold text-on-surface">{client.nombre_cliente}</span>
                      <span className="text-[11px] text-on-surface-variant">{[client.telefono, client.correo].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</span>
                    </button>) : <p className="px-3 py-2 text-xs text-on-surface-variant">No hay coincidencias. Puedes registrar al cliente en el módulo Clientes.</p>}
                  </div>}
                </div>
                {selectedClient ? <button type="button" onClick={() => { setSelectedClient(null); setCustomerQuery(''); }} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-low">Quitar</button> : <span className="shrink-0 text-[11px] text-on-surface-variant">{customerQuery.trim() ? 'Sin seleccionar' : 'Consumidor Final'}</span>}
              </div>
            </div>

            {/* Items Carrito */}
            <div className="p-4 flex flex-col gap-2 max-h-80 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-on-surface-variant">
                  El ticket de venta está vacío. Selecciona productos del catálogo o escanea un código QR.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 p-2 bg-surface-container-low/40 rounded-lg"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-primary">{item.marca}</span>
                      <span className="font-semibold text-xs text-on-surface truncate">{item.nombre}</span>
                      {item.variante && <span className="text-[10px] text-on-surface-variant">{item.variante}</span>}
                      <span className="text-[11px] text-on-surface-variant font-mono">
                        {formatCordobas(item.precio)} c/u
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center bg-surface-container rounded-lg p-0.5">
                        <button
                          onClick={() => handleQtyChange(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center text-xs hover:bg-surface-container-high rounded"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                        <button
                          onClick={() => handleQtyChange(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center text-xs hover:bg-surface-container-high rounded"
                        >
                          +
                        </button>
                      </div>
                      <span className="w-14 text-right font-bold text-xs font-mono">
                        {formatCordobas(item.precio * item.qty)}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-on-surface-variant hover:text-error p-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Resumen */}
            <div className="p-4 bg-surface-container-low/30 border-t border-surface-container-low flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>Subtotal</span>
                <span className="font-mono">{formatCordobas(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span>IVA (Incluido)</span>
                <span className="font-mono">{formatCordobas(0)}</span>
              </div>
              <div className="flex items-center justify-between font-bold text-base text-on-surface pt-2 border-t border-surface-container-low">
                <span>Total a Cobrar</span>
                <span className="text-primary font-mono">{formatCordobas(subtotal)}</span>
              </div>
              <button
                disabled={cart.length === 0 || processingSale}
                onClick={() => { setCashEntryOpen(false); setCardPaymentOpen(false); setCashReceived(''); setPaymentModalOpen(true); }}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-md hover:opacity-95 disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">payments</span>
                Cobrar Ticket ({formatCordobas(subtotal)})
              </button>
            </div>
          </div>
        </div>
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="qr-camera-title" className="w-full max-w-md overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl">
            <header className="flex items-center justify-between border-b border-surface-container-low p-4">
              <div><h2 id="qr-camera-title" className="font-bold text-on-surface">Escanear producto</h2><p className="text-xs text-on-surface-variant">Enfoca el c?digo QR del producto</p></div>
              <button type="button" onClick={() => setCameraOpen(false)} aria-label="Cerrar esc?ner" className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button>
            </header>
            <div className="relative aspect-square bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
            </div>
            <div className="p-4">
              {cameraError ? <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-surface">{cameraError}</p> : <p className="text-center text-sm text-on-surface-variant">Mant?n el c?digo dentro del recuadro.</p>}
              <button type="button" onClick={() => setCameraOpen(false)} className="mt-3 w-full rounded-lg border border-surface-container-high px-4 py-2 text-sm font-semibold text-on-surface">Cerrar</button>
            </div>
          </section>
        </div>
      )}

      {/* Modal Cobro */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
            <h3 className="font-bold text-lg text-on-surface">Seleccionar Método de Pago</h3>
            <div className="text-center py-2 bg-surface-container-low rounded-xl">
              <span className="text-xs text-on-surface-variant">Subtotal de productos</span>
              <div className="font-bold text-2xl text-primary font-mono">{formatCordobas(subtotal)}</div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                disabled={processingSale}
                aria-expanded={cashEntryOpen}
                onClick={() => { setSelectedMetodoPago('Efectivo'); setCardPaymentOpen(false); setCashEntryOpen(true); }}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary flex items-center justify-between text-sm font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">payments</span> Efectivo
                </span>
                <span>Ingresar billetes</span>
              </button>
              {cashEntryOpen && (
                <section aria-label="Conteo de efectivo" className="rounded-xl border border-surface-container-high p-3">
                  <label className="block text-sm font-semibold text-on-surface" htmlFor="cash-received">Efectivo recibido (C$)
                    <input id="cash-received" type="text" inputMode="decimal" autoFocus value={cashReceived} disabled={processingSale} onChange={(event) => {
                      const value = event.target.value;
                      if (/^\d*(?:[.,]\d{0,2})?$/.test(value)) setCashReceived(value);
                    }} placeholder="0.00" className="mt-2 w-full rounded-lg border border-surface-container-high bg-white px-3 py-2.5 text-base font-mono text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50" />
                  </label>
                  <div aria-live="polite" className="mt-4 space-y-2 rounded-lg bg-surface-container-low p-3 text-sm">
                    <div className="flex justify-between gap-2"><span>Efectivo recibido</span><strong>{formatCordobas(cashReceivedCents / 100)}</strong></div>
                    {cashReceivedCents >= totalCents ? (
                      <div className="flex justify-between gap-2 text-primary"><span>Vuelto</span><strong>{formatCordobas(changeCents / 100)}</strong></div>
                    ) : (
                      <div className="flex justify-between gap-2 text-error"><span>Falta</span><strong>{formatCordobas((totalCents - cashReceivedCents) / 100)}</strong></div>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={processingSale || cashReceived === ''} onClick={() => setCashReceived('')} className="rounded-lg border border-surface-container-high px-3 py-2 text-xs font-semibold text-on-surface-variant disabled:opacity-50">Limpiar</button>
                    <button type="button" disabled={processingSale || cashReceivedCents < totalCents} onClick={() => handleCompleteSale('Efectivo')} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-on-primary disabled:cursor-not-allowed disabled:opacity-50">Cobrar y dar vuelto</button>
                  </div>
                </section>
              )}
              <button
                disabled={processingSale}
                aria-expanded={cardPaymentOpen}
                onClick={() => { setSelectedMetodoPago('Tarjeta'); setCashEntryOpen(false); setCashReceived(''); setCardPaymentOpen(true); }}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary flex items-center justify-between text-sm font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">credit_card</span> Tarjeta POS
                </span>
                <span>Terminal 01</span>
              </button>
              {cardPaymentOpen && (
                <section aria-label="Comisión de terminal POS" className="rounded-xl border border-surface-container-high p-3">
                  <div className="mb-3 flex items-end gap-2">
                    <label htmlFor="pos-commission-rate" className="flex-1 text-xs font-medium text-on-surface-variant">Tasa POS global (%)
                      <input id="pos-commission-rate" type="number" min="0" max="100" step="0.01" value={commissionRateDraft} disabled={savingCommissionRate} onChange={(event) => setCommissionRateDraft(event.target.value)} className="mt-1 w-full rounded-lg border border-surface-container-high bg-white px-3 py-2 text-sm text-on-surface" />
                    </label>
                    <button type="button" disabled={savingCommissionRate || commissionRateDraft === String(commissionRate)} onClick={saveCommissionRate} className="rounded-lg border border-surface-container-high px-3 py-2 text-xs font-semibold disabled:opacity-50">{savingCommissionRate ? 'Guardando…' : 'Guardar'}</button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-2"><span className="text-on-surface-variant">Subtotal de productos</span><strong>{formatCordobas(totalCents / 100)}</strong></div>
                    <div className="flex justify-between gap-2"><span className="text-on-surface-variant">Comisión POS</span><strong>{formatCordobas(cardCommissionCents / 100)}</strong></div>
                    <div className="flex justify-between gap-2 border-t border-surface-container-high pt-2 font-bold text-primary"><span>Total que paga el cliente</span><strong>{formatCordobas(totalCents / 100)}</strong></div>
                  </div>
                  <button type="button" disabled={processingSale || savingCommissionRate} onClick={() => handleCompleteSale('Tarjeta')} className="mt-3 w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-bold text-on-primary disabled:opacity-50">Confirmar y cobrar {formatCordobas(totalCents / 100)}</button>
                </section>
              )}
              <button
                disabled={processingSale}
                onClick={() => handleCompleteSale('Transferencia')}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary flex items-center justify-between text-sm font-semibold transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined">account_balance</span> Transferencia
                </span>
                <span></span>
              </button>
            </div>
            <button
              onClick={() => setPaymentModalOpen(false)}
              className="py-2 text-on-surface-variant text-xs hover:text-on-surface"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
      {invoice && !receiptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="sale-complete-title" className="w-full max-w-[350px] rounded-[2rem] border border-[#e9b7c3]/50 bg-[#fbf4f0] p-6 text-center shadow-2xl">
            <button type="button" onClick={() => setInvoice(null)} aria-label="Cerrar confirmación" className="mb-3 flex items-center text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">arrow_back</span></button>
            <h2 id="sale-complete-title" className="text-sm font-semibold text-on-surface">Venta completada</h2>
            <div className="mx-auto mt-4 grid h-14 w-14 place-items-center rounded-full border-2 border-[#e9b7c3] text-[#80643f]"><span className="material-symbols-outlined text-3xl">check</span></div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-on-surface">{formatCordobas(invoice.total)}</p>
            <p className="mt-1 text-sm text-on-surface-variant">¡Gracias por tu compra!</p>
            <div className="my-5 space-y-3 border-y border-[#eaded5] py-4 text-left text-xs">
              <div className="flex justify-between gap-3"><span className="text-on-surface-variant"># Factura</span><strong className="font-mono">{String(invoice.id).padStart(6, '0')}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Fecha</span><strong>{formatInvoiceDate(invoice.fecha_venta)}</strong></div>
              {invoice.efectivo_recibido !== null && <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Efectivo recibido</span><strong>{formatCordobas(invoice.efectivo_recibido)}</strong></div>}
              {invoice.vuelto !== null && <div className="flex justify-between gap-3 font-bold text-primary"><span>Vuelto</span><strong>{formatCordobas(invoice.vuelto)}</strong></div>}
              <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Método de pago</span><strong>{invoice.metodo_pago}</strong></div>
            </div>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => setReceiptOpen(true)} className="w-full rounded-full bg-[#c9a46d] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-95">Ver comprobante</button>
              <button type="button" onClick={() => { setInvoice(null); setReceiptOpen(false); setCustomer('Consumidor Final'); }} className="w-full rounded-full bg-[#f3cbd1] px-4 py-3 text-sm font-semibold text-[#382e29] hover:brightness-95">Nueva venta</button>
            </div>
          </section>
        </div>
      )}

      {invoice && receiptOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/55 p-3 sm:p-6">
          <style>{`@media print { @page { size: 80mm auto; margin: 3mm; } body * { visibility: hidden !important; } #pos-receipt, #pos-receipt * { visibility: visible !important; } #pos-receipt { position: fixed; inset: 0 auto auto 0; width: 74mm; max-width: none; border: 0; box-shadow: none; margin: 0; padding: 2mm; } .receipt-actions { display: none !important; } }`}</style>
          <section id="pos-receipt" className="w-full max-w-[360px] bg-[#fffdfa] px-6 py-7 font-mono text-[11px] leading-relaxed text-[#382e29] shadow-2xl">
            <header className="border-b border-dashed border-[#c9a46d]/50 pb-4 text-center">
              <img src={brandConfig?.logo?.main} alt={brandConfig?.name || 'Logo de la tienda'} className="mx-auto mb-2 h-14 w-14 rounded-full object-contain" />
              <h2 className="font-sans text-lg font-semibold">{brandConfig?.name || 'Tienda'}</h2>
              <p className="mt-1 text-[10px]">#{String(invoice.id).padStart(6, '0')}</p>
              <p className="mt-2 text-[10px]">{formatInvoiceDate(invoice.fecha_venta)}</p>
              {invoice.cliente && invoice.cliente !== 'Consumidor Final' && <p className="mt-2 break-words text-left text-[10px]">Cliente: {invoice.cliente}</p>}
            </header>
            <div className="grid grid-cols-[1fr_34px_52px_56px] gap-1 border-b border-[#d8c9bf] py-2 text-[9px] font-bold uppercase">
              <span>Producto</span><span className="text-right">Cant.</span><span className="text-right">Precio</span><span className="text-right">Total</span>
            </div>
            <div className="border-b border-dashed border-[#c9a46d]/50 py-1">
              {invoice.items.map((item) => <div key={item.producto_id} className="grid grid-cols-[1fr_34px_52px_56px] gap-1 py-2 text-[10px]">
                <span className="break-words">{item.nombre}</span><span className="text-right">{item.cantidad}</span><span className="text-right">{formatCordobas(item.precio_unitario)}</span><span className="text-right">{formatCordobas(item.subtotal)}</span>
              </div>)}
            </div>
            <div className="space-y-1 border-b border-dashed border-[#c9a46d]/50 py-3 text-[11px]">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCordobas(invoice.subtotal ?? invoice.total)}</span></div>
              <div className="flex justify-between"><span>Descuento</span><span>{formatCordobas(0)}</span></div>
              <div className="flex justify-between pt-1 text-sm font-bold"><span>Total</span><span>{formatCordobas(invoice.total)}</span></div>
              {invoice.efectivo_recibido !== null && <div className="flex justify-between pt-1"><span>Efectivo recibido</span><span>{formatCordobas(invoice.efectivo_recibido)}</span></div>}
              {invoice.vuelto !== null && <div className="flex justify-between font-bold"><span>Vuelto</span><span>{formatCordobas(invoice.vuelto)}</span></div>}
            </div>
            <div className="py-3 text-center text-[10px]">
              <p>Gracias por tu compra</p>
              <span className="text-base text-[#9b5264]">♥</span>
            </div>
            <InvoiceBarcode value={String(invoice.id).padStart(6, '0')} />
            <p className="mt-1 text-center text-[9px] tracking-[0.25em]">{String(invoice.id).padStart(6, '0')}</p>
            <div className="receipt-actions mt-5 flex gap-2 font-sans">
              <button type="button" onClick={() => window.print()} className="flex-1 rounded-lg bg-[#c9a46d] px-3 py-2.5 text-xs font-semibold text-white">Imprimir comprobante</button>
              <button type="button" onClick={() => setReceiptOpen(false)} className="rounded-lg border border-[#e9b7c3] px-3 py-2.5 text-xs font-semibold">Volver</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
