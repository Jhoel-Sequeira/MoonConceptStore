import React, { useState, useEffect } from 'react';
import inventarioService from '../services/inventarioService';
import marcasService from '../services/marcasService';
import brandConfig from '../brandConfig';
import { formatCordobas } from '../utils/currency';

export default function CatalogoQRPage() {
  const [productos, setProductos] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMarcaId, setSelectedMarcaId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewProduct, setPreviewProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [detailProduct, setDetailProduct] = useState(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);
  const [removedPhotoUrls, setRemovedPhotoUrls] = useState([]);
  const [activePhoto, setActivePhoto] = useState('');
  const [thermalFormat, setThermalFormat] = useState('50x30mm');
  const [disposition, setDisposition] = useState('2 Columnas');
  const [showLogoOnLabel, setShowLogoOnLabel] = useState(true);

  // Formulario producto (Crear / Editar)
  const [formData, setFormData] = useState({
    sku: '',
    nombre: '',
    marca_id: '',
    precio: '',
    descripcion: '',
    tamano: '',
    imagen_url: '',
    estado_id: 1,
    stock_inicial: 10,
    stock_critico: 5,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodsData, marcasData, statsData] = await Promise.all([
        inventarioService.getAll({
          marca_id: selectedMarcaId || undefined,
          search: search || undefined,
        }),
        marcasService.getAll(),
        inventarioService.getStats(),
      ]);

      setProductos(prodsData);
      setMarcas(marcasData);
      setStats(statsData);

      // Preseleccionar por defecto todos o los primeros
      if (prodsData.length > 0 && selectedIds.size === 0) {
        setSelectedIds(new Set(prodsData.map((p) => p.id)));
      }
      if (prodsData.length > 0 && !previewProduct) {
        setPreviewProduct(prodsData[0]);
      }
    } catch (err) {
      console.error('Error cargando inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMarcaId]);

  useEffect(() => {
    const previewUrls = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviewUrls(previewUrls);
    return () => previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [photoFiles]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchData();
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(productos.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleOpenCreate = () => {
    setProductToEdit(null);
    setPhotoFiles([]);
    setRemovedPhotoUrls([]);
    setActivePhoto('');
    setFormData({
      sku: '',
      nombre: '',
      marca_id: marcas[0]?.id || '',
      precio: '',
      descripcion: '',
      tamano: '',
      imagen_url: '',
      estado_id: 1,
      stock_inicial: 10,
      stock_critico: 5,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setProductToEdit(product);
    setPhotoFiles([]);
    setRemovedPhotoUrls([]);
    setActivePhoto(product.imagen_url || product.imagenes?.[0] || '');
    setFormData({
      sku: product.sku,
      nombre: product.nombre,
      marca_id: product.marca_id,
      precio: product.precio,
      descripcion: product.descripcion || '',
      tamano: product.tamano || '',
      imagen_url: product.imagen_url || '',
      estado_id: product.estado_id ?? 1,
      stock_inicial: product.stock_actual,
      stock_critico: product.stock_critico ?? 5,
    });
    setDetailProduct(null);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm("¿Seguro que deseas eliminar este producto y sus movimientos de Kardex?")) {
      try {
        await inventarioService.delete(productId);
        if (detailProduct?.id === productId) setDetailProduct(null);
        if (previewProduct?.id === productId) setPreviewProduct(null);
        fetchData();
      } catch (err) {
        alert("Error al eliminar producto: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      let savedProduct;
      if (productToEdit) {
        savedProduct = await inventarioService.update(productToEdit.id, {
          sku: formData.sku,
          nombre: formData.nombre,
          marca_id: parseInt(formData.marca_id),
          precio: parseFloat(formData.precio),
          descripcion: formData.descripcion,
          tamano: formData.tamano,
          imagen_url: (activePhoto && !activePhoto.startsWith('file:') ? activePhoto : formData.imagen_url) || null,
          estado_id: Number(formData.estado_id || 1),
          stock_critico: parseInt(formData.stock_critico || 5),
          stock_actual: parseInt(formData.stock_inicial || 0),
        });
      } else {
        savedProduct = await inventarioService.create({
          ...formData,
          marca_id: parseInt(formData.marca_id),
          precio: parseFloat(formData.precio),
          estado_id: Number(formData.estado_id || 1),
          stock_inicial: parseInt(formData.stock_inicial || 0),
          stock_critico: parseInt(formData.stock_critico || 5),
        });
      }
      let photoUploadError = null;
      if (removedPhotoUrls.length && productToEdit) {
        for (const imageUrl of removedPhotoUrls) {
          await inventarioService.deletePhoto(productToEdit.id, imageUrl);
        }
      }
      if (photoFiles.length) {
        try {
          const photoResult = await inventarioService.uploadPhotos(savedProduct.id, photoFiles);
          if (activePhoto.startsWith('file:')) {
            const photoIndex = Number(activePhoto.slice(5));
            const persistedUrl = photoResult.imagenes?.[photoResult.imagenes.length - photoFiles.length + photoIndex];
            if (persistedUrl) await inventarioService.update(savedProduct.id, { imagen_url: persistedUrl });
          }
        } catch (uploadError) {
          photoUploadError = uploadError.response?.data?.detail || uploadError.message;
        }
      }
      setPhotoFiles([]);
      setIsModalOpen(false);
      setProductToEdit(null);
      fetchData();
      if (photoUploadError) {
        alert(`El producto se guardó, pero no se pudo cargar la foto: ${photoUploadError}`);
      }
    } catch (err) {
      alert('Error al guardar producto: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleRegenerateQr = async (product) => {
    try {
      setIsGeneratingQr(true);
      const res = await inventarioService.generarQrEnServidor(product.id);
      const updatedProduct = {
        ...product,
        qr_image_url: `${res.qr_image_url}?t=${Date.now()}`,
        qr_status: 'Generado'
      };
      setDetailProduct(updatedProduct);
      setPreviewProduct(updatedProduct);
      setProductos(productos.map(p => p.id === product.id ? updatedProduct : p));
      alert("¡Código QR generado y guardado como imagen en el servidor exitosamente!");
    } catch (err) {
      console.error("Error al generar QR:", err);
      alert("Error al generar QR: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleOpenProductDetail = async (product) => {
    setDetailProduct(product);
    try {
      const res = await inventarioService.generarQrEnServidor(product.id);
      setDetailProduct({
        ...product,
        qr_image_url: `${res.qr_image_url}?t=${Date.now()}`,
        qr_status: 'Generado',
      });
    } catch (err) {
      console.error('Error preparando la imagen QR:', err);
    }
  };

  const handlePrintLabels = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (productos.length === 0) return;
    const headers = ['ID', 'SKU', 'Producto', 'Marca', 'Precio (C$)', 'Stock Actual', 'QR Código'];
    const rows = productos.map((p) => [
      p.id,
      p.sku,
      `"${p.nombre}"`,
      `"${p.marca_nombre || ''}"`,
      p.precio,
      p.stock_actual,
      p.codigo_qr,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'catalogo_inventario.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedList = productos.filter((p) => selectedIds.has(p.id));
  const displayPreview = previewProduct || productos[0];

  const storedPhotoUrls = (productToEdit?.imagenes?.length
    ? productToEdit.imagenes
    : productToEdit?.imagen_url ? [productToEdit.imagen_url] : [])
    .filter((url) => !removedPhotoUrls.includes(url));
  const visiblePhotoUrls = [...storedPhotoUrls, ...photoPreviewUrls];
  const activePhotoIndex = activePhoto.startsWith('file:')
    ? storedPhotoUrls.length + Number(activePhoto.slice(5))
    : Math.max(0, visiblePhotoUrls.indexOf(activePhoto || formData.imagen_url));

  return (
    <div className="flex flex-col w-full gap-space-lg">
      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
            </span>
            <h1 className="font-headline-md text-headline-md text-on-surface tracking-tight">
              Catálogo y Generador de Etiquetas QR
            </h1>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Generación masiva de etiquetas de precio y códigos QR únicos para identificación en punto de venta
          </p>
        </div>

        {/* Quick Stats Metric Chips */}
        <div className="flex items-center gap-space-sm self-start lg:self-auto">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Etiquetas Listas</span>
              <span className="font-label-md text-label-md font-bold">
                {stats ? `${stats.total_skus} SKUs` : `${productos.length} SKUs`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
            <span className="material-symbols-outlined text-tertiary-container text-[18px]">print</span>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Cola de Impresión</span>
              <span className="font-label-md text-label-md font-bold">
                {selectedIds.size} seleccionados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar & Filter Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-space-sm flex-1 min-w-0">
          {/* Counter Badge */}
          {/* <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed-variant font-label-md text-label-md">
            <span className="material-symbols-outlined text-[16px]">check_box</span>
            <span id="selected-count">{selectedIds.size} productos seleccionados</span>
          </div> */}

          {/* Brand Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedMarcaId}
              onChange={(e) => setSelectedMarcaId(e.target.value)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container transition-colors border-none outline-none cursor-pointer"
            >
              <option value="">Todas las Marcas</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre_marca}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-xs">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-[36px] pl-8 pr-3 rounded-lg bg-surface-container-low text-on-surface placeholder:text-on-surface-variant font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-lowest shadow-sm"
              placeholder="Buscar SKU, nombre o ref..."
              type="text"
            />
          </form>
        </div>

        {/* Right Global Actions */}
        <div className="flex items-center gap-space-sm shrink-0">
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:opacity-90 transition-all shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Nuevo Producto</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container transition-colors shadow-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">table_chart</span>
            <span>Exportar CSV</span>
          </button>
          {/* <button
            onClick={handlePrintLabels}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md shadow-md hover:opacity-95 active:scale-95 transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>Generar e Imprimir Lote ({selectedIds.size})</span>
          </button> */}
        </div>
      </div>

      {/* Main Content Split: 65% Catalog Table / 35% Live Label Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* LEFT PANEL: Data Table */}
        <div className="xl:col-span-12 flex flex-col bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
          {/* Table Quick Header Meta */}
          <div className="flex items-center justify-between px-space-lg py-space-sm bg-surface-container-low">
            <div className="flex items-center gap-2">
              <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider">
                Inventario Activo
              </span>

            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1 font-label-sm text-label-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Responsive Table Container */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider h-10 select-none">

                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Producto</th>
                  <th className="py-2.5 px-3">Marca</th>
                  <th className="py-2.5 px-3 text-right">Precio Venta</th>
                  <th className="py-2.5 px-3 text-right">Stock Actual</th>
                  <th className="py-2.5 px-4 text-center">Código QR Estado</th>
                  <th className="py-2.5 px-3 text-center w-12">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y-0 font-body-sm text-body-sm text-on-surface">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                      Cargando productos de inventario...
                    </td>
                  </tr>
                ) : productos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                      No se encontraron productos registrados en este filtro.
                    </td>
                  </tr>
                ) : (
                  productos.map((prod) => {
                    const isSelected = selectedIds.has(prod.id);
                    const isCurrentPreview = displayPreview?.id === prod.id;

                    return (
                      <tr
                        key={prod.id}
                        onClick={() => setPreviewProduct(prod)}
                        className={`transition-colors group cursor-pointer ${isCurrentPreview
                          ? 'bg-primary-fixed/20'
                          : isSelected
                            ? 'bg-surface-container-lowest hover:bg-surface-container-low'
                            : 'bg-surface-container-lowest/60 opacity-80 hover:bg-surface-container-low'
                          }`}
                      >

                        <td className="py-3 px-3">
                          <span className="font-label-md text-label-md text-primary font-mono bg-primary-fixed/40 px-1.5 py-0.5 rounded">
                            {prod.sku}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center">
                              {prod.imagen_url ? (
                                <img src={inventarioService.getProductImageUrl(prod.imagen_url)} alt={prod.nombre} className="h-full w-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[20px] text-primary">local_mall</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span
                                onClick={(e) => handleOpenEdit(prod, e)}
                                className="font-label-md text-label-md text-on-surface font-semibold group-hover:text-primary transition-colors">
                                {prod.nombre}
                              </span>
                              <span className="text-on-surface-variant font-body-sm text-body-sm line-clamp-1">
                                {prod.descripcion || 'Sin descripción'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                            {prod.marca_nombre || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-label-md text-label-md font-bold text-on-surface">
                          {formatCordobas(prod.precio)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`font-label-md text-label-md ${prod.stock_actual <= prod.stock_critico
                              ? 'text-error font-semibold'
                              : 'text-on-surface'
                              }`}
                          >
                            {prod.stock_actual} uds
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                            {prod.qr_status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => { setPreviewProduct(prod); handleOpenProductDetail(prod); }}
                              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                              title="Ver Detalle y QR"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            <button
                              onClick={() => handleOpenEdit(prod)}
                              className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                              title="Editar Producto"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
                              title="Eliminar Producto"
                              type="button"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Info */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm px-space-lg py-space-md bg-surface-container-low text-on-surface-variant font-body-sm text-body-sm">
            <div className="flex items-center gap-2">
              <span>Mostrando {productos.length} referencias</span>

            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Live Printable Sticker & QR Preview Sheet */}

      </div>

      {/* Modal: Registrar / Editar Producto */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-6">
          <section role="dialog" aria-modal="true" aria-labelledby="product-editor-title" className="w-full max-w-4xl overflow-hidden rounded-2xl border border-outline-variant/20 bg-[#f8f0ec] shadow-2xl">
            <form onSubmit={handleCreateSubmit}>
              <header className="flex items-center gap-3 border-b border-outline-variant/20 px-5 py-4 sm:px-7">
                <button type="button" onClick={() => { setIsModalOpen(false); setProductToEdit(null); }} aria-label="Volver" className="rounded-full p-1 text-on-surface-variant hover:bg-white/70">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="min-w-0 flex-1">
                  <h3 id="product-editor-title" className="font-semibold text-on-surface">{productToEdit ? 'Editar producto' : 'Nuevo producto'}</h3>
                  <p className="text-xs text-on-surface-variant">{productToEdit ? 'Código ' + productToEdit.sku : 'Completa los datos del producto'}</p>
                </div>
                <button type="button" onClick={() => { setIsModalOpen(false); setProductToEdit(null); }} aria-label="Cerrar" className="rounded-lg p-2 text-on-surface-variant hover:bg-white/70"><span className="material-symbols-outlined">close</span></button>
              </header>

              <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[150px_minmax(0,1fr)]">
                <div className="flex flex-col gap-3">
                  <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#eaded5] shadow-sm">
                    {visiblePhotoUrls[activePhotoIndex] ? <img src={activePhotoIndex >= storedPhotoUrls.length ? visiblePhotoUrls[activePhotoIndex] : inventarioService.getProductImageUrl(visiblePhotoUrls[activePhotoIndex])} alt="Vista del producto" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-primary/50"><span className="material-symbols-outlined text-4xl">add_a_photo</span></div>}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {visiblePhotoUrls.map((url, index) => <div key={url + '-' + index} className="group relative aspect-square overflow-hidden rounded-lg">
                      <button type="button" onClick={() => {
                        if (index >= storedPhotoUrls.length) setActivePhoto('file:' + (index - storedPhotoUrls.length));
                        else { setActivePhoto(url); setFormData((current) => ({ ...current, imagen_url: url })); }
                      }} className={'h-full w-full overflow-hidden rounded-lg border-2 ' + (index === activePhotoIndex ? 'border-primary' : 'border-transparent')}>
                        <img src={index >= storedPhotoUrls.length ? url : inventarioService.getProductImageUrl(url)} alt={'Foto ' + (index + 1)} className="h-full w-full object-cover" />
                      </button>
                      {index < storedPhotoUrls.length && <button type="button" title="Quitar foto" onClick={() => {
                        const nextRemoved = [...removedPhotoUrls, url];
                        setRemovedPhotoUrls(nextRemoved);
                        if (activePhoto === url) {
                          const nextUrl = storedPhotoUrls.find((imageUrl) => imageUrl !== url);
                          setActivePhoto(nextUrl || '');
                          setFormData((current) => ({ ...current, imagen_url: nextUrl || '' }));
                        }
                      }} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white/90 text-error opacity-0 shadow transition group-hover:opacity-100"><span className="material-symbols-outlined text-sm">close</span></button>}
                    </div>)}
                    {storedPhotoUrls.length + photoFiles.length < 10 && <label className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed border-outline-variant/60 bg-white/50 text-primary hover:bg-white">
                      <span className="material-symbols-outlined">add</span>
                      <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => {
                        const selectedFiles = Array.from(event.target.files || []);
                        if (storedPhotoUrls.length + photoFiles.length + selectedFiles.length > 10) { alert('Cada producto admite hasta 10 fotos.'); event.target.value = ''; return; }
                        const invalidFile = selectedFiles.find((file) => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024);
                        if (invalidFile) { alert('Usa im?genes JPG, PNG o WEBP de m?ximo 8 MB cada una.'); event.target.value = ''; return; }
                        const firstNewIndex = photoFiles.length;
                        setPhotoFiles((current) => [...current, ...selectedFiles]);
                        if (!activePhoto || !visiblePhotoUrls.length) setActivePhoto('file:' + firstNewIndex);
                        event.target.value = '';
                      }} />
                    </label>}
                  </div>
                  <p className="text-center text-[11px] text-on-surface-variant">Hasta 10 im?genes ? 8 MB c/u</p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-medium text-on-surface-variant">Nombre del producto
                    <input required value={formData.nombre} onChange={(event) => setFormData({ ...formData, nombre: event.target.value })} placeholder="Nombre del producto" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                  </label>
                  <label className="block text-xs font-medium text-on-surface-variant">Código
                    <input required value={formData.sku} onChange={(event) => setFormData({ ...formData, sku: event.target.value })} placeholder="Ej. TB-001" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                  </label>
                  <label className="block text-xs font-medium text-on-surface-variant">Marca
                    <select required value={formData.marca_id} onChange={(event) => setFormData({ ...formData, marca_id: event.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary">
                      <option value="">Selecciona una marca</option>{marcas.map((brand) => <option key={brand.id} value={brand.id}>{brand.nombre_marca}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-on-surface-variant">Precio de venta (C$)
                      <input required type="number" min="0.01" step="0.01" value={formData.precio} onChange={(event) => setFormData({ ...formData, precio: event.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                    </label>
                    <label className="block text-xs font-medium text-on-surface-variant">{productToEdit ? 'Stock' : 'Stock inicial'}
                      <input type="number" min="0" value={formData.stock_inicial} onChange={(event) => setFormData({ ...formData, stock_inicial: event.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-xs font-medium text-on-surface-variant">Stock cr?tico
                      <input type="number" min="0" value={formData.stock_critico} onChange={(event) => setFormData({ ...formData, stock_critico: event.target.value })} className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                    </label>
                    <label className="block text-xs font-medium text-on-surface-variant">Talla / presentación
                      <input value={formData.tamano} onChange={(event) => setFormData({ ...formData, tamano: event.target.value })} placeholder="Opcional" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                    </label>
                  </div>
                  <label className="block text-xs font-medium text-on-surface-variant">Descripción
                    <input value={formData.descripcion} onChange={(event) => setFormData({ ...formData, descripcion: event.target.value })} placeholder="Descripción o variante" className="mt-1 w-full rounded-lg border border-outline-variant/30 bg-white/70 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary" />
                  </label>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-sm text-on-surface">Producto activo</span>
                    <button type="button" role="switch" aria-checked={Number(formData.estado_id) === 1} onClick={() => setFormData({ ...formData, estado_id: Number(formData.estado_id) === 1 ? 7 : 1 })} className={'relative h-6 w-11 rounded-full transition ' + (Number(formData.estado_id) === 1 ? 'bg-primary-fixed-dim' : 'bg-outline-variant/60')}><span className={'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ' + (Number(formData.estado_id) === 1 ? 'left-6' : 'left-1')} /></button>
                  </div>
                </div>
              </div>

              <footer className="flex justify-end gap-3 border-t border-outline-variant/20 px-5 py-4 sm:px-7">
                <button type="button" onClick={() => { setIsModalOpen(false); setProductToEdit(null); }} className="rounded-lg border border-outline-variant/30 px-5 py-2.5 text-sm text-on-surface-variant hover:bg-white/60">Cancelar</button>
                <button type="submit" className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary shadow-sm hover:opacity-95">Guardar</button>
              </footer>
            </form>
          </section>
        </div>
      )}
      {/* Modal: Ver Detalle del Producto y Código QR */}
      {detailProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl p-6 flex flex-col gap-5 border border-surface-container-high animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-surface-container-low pb-3">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-primary-fixed text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[22px]">inventory_2</span>
                </span>
                <div>
                  <h3 className="font-bold text-lg text-on-surface leading-tight">{detailProduct.nombre}</h3>
                  <span className="font-mono text-xs text-primary font-bold">SKU: {detailProduct.sku}</span>
                </div>
              </div>
              <button
                onClick={() => setDetailProduct(null)}
                className="text-on-surface-variant hover:text-error p-1 rounded-lg hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Columna Izquierda: QR y Acciones */}
              <div className="flex flex-col items-center justify-center p-4 bg-surface-container-low/60 rounded-xl border border-surface-container gap-3">
                <div className="w-48 h-48 bg-white p-3 rounded-xl shadow-md flex items-center justify-center border border-slate-200">
                  <img
                    src={inventarioService.getQrImageUrl(detailProduct.id, detailProduct.sku, detailProduct.qr_image_url)}
                    alt={`Código QR ${detailProduct.sku}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = inventarioService.getQrImageUrl(detailProduct.id, detailProduct.sku);
                    }}
                  />
                </div>
                <div className="flex flex-col items-center text-center">
                  <span className="font-mono text-xs font-bold text-on-surface">Token: {detailProduct.codigo_qr}</span>

                </div>
                <div className="flex items-center gap-2 w-full">
                  <button
                    onClick={() => handleRegenerateQr(detailProduct)}
                    disabled={isGeneratingQr}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">{isGeneratingQr ? 'sync' : 'refresh'}</span>
                    <span>{isGeneratingQr ? 'Guardando...' : 'Regenerar en Servidor'}</span>
                  </button>
                  <a
                    href={inventarioService.getQrImageUrl(detailProduct.id, detailProduct.sku, detailProduct.qr_image_url)}
                    download={`QR_${detailProduct.sku}.png`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors"
                    title="Descargar imagen PNG"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </a>
                </div>
              </div>

              {/* Columna Derecha: Detalles del Producto */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 p-3 bg-surface-container-low rounded-xl">
                  <span className="text-xs text-on-surface-variant font-semibold">Marca en Consignación</span>
                  <span className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                    {detailProduct.marca_nombre || 'N/A'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-surface-container-low rounded-xl">
                    <span className="text-xs text-on-surface-variant font-semibold">Precio de Venta</span>
                    <div className="text-lg font-bold text-on-surface font-mono">{formatCordobas(detailProduct.precio)}</div>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-xl">
                    <span className="text-xs text-on-surface-variant font-semibold">Stock Actual</span>
                    <div className={`text-lg font-bold font-mono ${detailProduct.stock_actual <= detailProduct.stock_critico ? 'text-error' : 'text-secondary'}`}>
                      {detailProduct.stock_actual} uds
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl flex flex-col gap-1">
                  <span className="text-xs text-on-surface-variant font-semibold">Descripción / Características</span>
                  <p className="text-xs text-on-surface leading-relaxed">
                    {detailProduct.descripcion || 'Sin descripción adicional registrada para este SKU.'}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs px-1 text-on-surface-variant">
                  <span>Stock Crítico Configurado:</span>
                  <span className="font-bold text-on-surface">{detailProduct.stock_critico} uds</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surface-container-low">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEdit(detailProduct)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-fixed text-primary font-label-sm text-xs font-semibold hover:bg-primary hover:text-on-primary transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => handleDeleteProduct(detailProduct.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-error font-label-sm text-xs font-semibold hover:bg-error hover:text-on-error transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Eliminar</span>
                </button>
              </div>
              <button
                onClick={() => setDetailProduct(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-sm hover:bg-surface-container-high transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
