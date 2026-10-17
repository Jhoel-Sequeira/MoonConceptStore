import React, { useState, useEffect } from 'react';
import marcasService from '../services/marcasService';
import api from '../services/api';
import { formatCordobas } from '../utils/currency';

const apiOrigin = new URL(api.defaults.baseURL).origin;

// Generador de colores e iniciales para avatar visual de marca
const getBrandVisuals = (name, index = 0) => {
  const initials = (name || 'MB')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || 'MB';

  const palette = [
    { bg: '#1e293b', color: '#ffffff' },
    { bg: '#4f46e5', color: '#ffffff' },
    { bg: '#006c49', color: '#ffffff' },
    { bg: '#6366f1', color: '#ffffff' },
    { bg: '#0284c7', color: '#ffffff' },
    { bg: '#d97706', color: '#ffffff' },
    { bg: '#e11d48', color: '#ffffff' },
  ];
  const choice = palette[index % palette.length];
  return { initials, avatarBg: choice.bg, avatarColor: choice.color };
};

export default function MarcasPage() {
  const [brands, setBrands] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [sortBy, setSortBy] = useState('ventas-desc');
  const [copySuccess, setCopySuccess] = useState(false);

  // Estado para la Ficha Técnica de la Marca (Visualización)
  const [selectedBrandForDetail, setSelectedBrandForDetail] = useState(null);

  // Estados del Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [brandToEdit, setBrandToEdit] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  // Formulario del Modal adaptado a dbo.marcas y dbo.cuentas
  const [formData, setFormData] = useState({
    nombre_marca: '',
    cedula: '',
    codigo: '',
    categoria: 'Hogar & Deco',
    razon_social: '',
    ciudad_pais: '',
    redes_sociales: '',
    nombre_representante: '',
    cargo: '',
    contacto_nombre: '',
    repPhonePrefix: '+505',
    telefono: '',
    email: '',
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    tiempo_estancia: 6,
    catalogo: '',
    estado_id: 2,
    banco: 'BAC Credomatic',
    no_cuenta: '',
    logo: '',
  });

  // Cargar marcas desde el backend MySQL
  const loadBrands = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await marcasService.getAll();
      const list = Array.isArray(data) ? data : [];
      const enriched = list.map((b, idx) => {
        const visuals = getBrandVisuals(b.nombre_marca, idx);
        return {
          ...b,
          monthSales: typeof b.monthSales === 'number' ? b.monthSales : parseFloat(b.monthSales || 0),
          activeSkus: b.activeSkus || '0 SKUs',
          initials: visuals.initials,
          avatarBg: visuals.avatarBg,
          avatarColor: visuals.avatarColor,
        };
      });
      setBrands(enriched);
      return enriched;
    } catch (err) {
      console.error("Error cargando marcas:", err);
      setErrorMessage("No se pudieron cargar las marcas desde la base de datos MySQL (" + (err.message || "Error de red") + ")");
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  // Abrir modal para Crear
  const handleOpenCreate = () => {
    setBrandToEdit(null);
    setLogoFile(null);
    setLogoPreview(null);
    setFormData({
      nombre_marca: '',
      cedula: '',
      codigo: '',
      categoria: 'Hogar & Deco',
      razon_social: '',
      ciudad_pais: '',
      redes_sociales: '',
      nombre_representante: '',
      cargo: '',
      contacto_nombre: '',
      repPhonePrefix: '+505',
      telefono: '',
      email: '',
      fecha_ingreso: new Date().toISOString().slice(0, 10),
      tiempo_estancia: 6,
      catalogo: '',
      estado_id: 2,
      banco: 'BAC Credomatic',
      no_cuenta: '',
      logo: '',
    });
    setIsModalOpen(true);
  };

  // Abrir modal para Editar
  const handleOpenEdit = (brand) => {
    setBrandToEdit(brand);
    setLogoFile(null);
    setLogoPreview(brand.logo ? new URL(brand.logo, `${apiOrigin}/`).toString() : null);
    const phoneParts = (brand.telefono || '').split(' ');
    const prefix = phoneParts[0]?.startsWith('+') ? phoneParts[0] : '+505';
    const number = phoneParts.slice(1).join(' ') || brand.telefono || '';

    setFormData({
      nombre_marca: brand.nombre_marca || '',
      cedula: brand.cedula || '',
      codigo: brand.codigo || '',
      categoria: brand.categoria || 'Hogar & Deco',
      razon_social: brand.razon_social || '',
      ciudad_pais: brand.ciudad_pais || '',
      redes_sociales: brand.redes_sociales || '',
      nombre_representante: brand.nombre_representante || '',
      cargo: brand.cargo || '',
      contacto_nombre: brand.contacto_nombre || '',
      repPhonePrefix: prefix,
      telefono: number,
      email: brand.email || '',
      fecha_ingreso: brand.fecha_ingreso ? brand.fecha_ingreso.slice(0, 10) : new Date().toISOString().slice(0, 10),
      tiempo_estancia: brand.tiempo_estancia || 6,
      catalogo: brand.catalogo || '',
      estado_id: brand.estado_id || 2,
      banco: brand.banco || 'BAC Credomatic',
      no_cuenta: brand.no_cuenta || '',
      logo: brand.logo || '',
    });

    // Si venía de ver la ficha, la cerramos para editar
    setSelectedBrandForDetail(null);
    setIsModalOpen(true);
  };

  // Manejar selección de logo local
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setLogoPreview(previewUrl);
    }
  };

  // Subir logo directo desde la ficha técnica
  const handleDirectLogoUpload = async (brandId, file) => {
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const updated = await marcasService.uploadLogo(brandId, file);
      const enriched = await loadBrands();
      if (selectedBrandForDetail && selectedBrandForDetail.id === brandId) {
        const found = enriched.find(b => b.id === brandId);
        if (found) setSelectedBrandForDetail(found);
      }
    } catch (err) {
      console.error("Error subiendo logo:", err);
      alert("Error al subir el logo: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Descargar Ficha de Entrega en Excel
  const handleDownloadFichaEntrega = async (brand) => {
    setIsDownloadingExcel(true);
    try {
      await marcasService.downloadFichaEntrega(brand.id, brand.nombre_marca);
    } catch (err) {
      console.error("Error descargando ficha de entrega:", err);
      alert("Error al generar la ficha de entrega: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsDownloadingExcel(false);
    }
  };

  const handleImportProductTemplate = async (brand, file, input) => {
    if (!file) return;
    setIsImportingExcel(true);
    try {
      const result = await marcasService.importProductTemplate(brand.id, file);
      alert(`Importación completada para ${brand.nombre_marca}: ${result.creados} productos nuevos, ${result.actualizados} productos existentes con stock aumentado y ${result.unidades} unidades agregadas.`);
      const refreshedBrands = await loadBrands();
      const refreshedBrand = refreshedBrands.find((item) => item.id === brand.id);
      if (refreshedBrand && selectedBrandForDetail?.id === brand.id) setSelectedBrandForDetail(refreshedBrand);
    } catch (err) {
      alert("No se pudo importar la plantilla: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsImportingExcel(false);
      if (input) input.value = '';
    }
  };

  // Guardar Marca (Crear o Editar en MySQL via API)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const fullPhone = `${formData.repPhonePrefix} ${formData.telefono}`.trim();
      const payload = {
        nombre_marca: formData.nombre_marca,
        cedula: formData.cedula,
        codigo: formData.codigo,
        categoria: formData.categoria,
        razon_social: formData.razon_social,
        ciudad_pais: formData.ciudad_pais,
        redes_sociales: formData.redes_sociales,
        nombre_representante: formData.nombre_representante,
        cargo: formData.cargo,
        contacto_nombre: formData.contacto_nombre,
        telefono: fullPhone,
        email: formData.email,
        tiempo_estancia: parseFloat(formData.tiempo_estancia) || 0,
        fecha_ingreso: formData.fecha_ingreso ? new Date(formData.fecha_ingreso).toISOString() : null,
        catalogo: formData.catalogo,
        estado_id: parseInt(formData.estado_id, 10),
        banco: formData.banco,
        no_cuenta: formData.no_cuenta,
      };

      let savedBrand = null;
      if (brandToEdit) {
        savedBrand = await marcasService.update(brandToEdit.id, payload);
      } else {
        savedBrand = await marcasService.create(payload);
      }

      // Si se seleccionó un archivo de logo, subirlo inmediatamente
      if (logoFile && savedBrand && savedBrand.id) {
        await marcasService.uploadLogo(savedBrand.id, logoFile);
      }

      await loadBrands();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error al guardar marca:", err);
      alert("Error al guardar la marca en la base de datos: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Eliminar Marca en MySQL via API
  const handleDeleteBrand = async (id) => {
    if (window.confirm("¿Seguro que deseas dar de baja o eliminar esta marca?")) {
      try {
        await marcasService.delete(id);
        if (selectedBrandForDetail && selectedBrandForDetail.id === id) {
          setSelectedBrandForDetail(null);
        }
        await loadBrands();
      } catch (err) {
        console.error("Error al eliminar marca:", err);
        alert("Error al eliminar la marca: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  // Descarga reporte en formato CSV
  const handleDownloadCSV = () => {
    const headers = "ID,Codigo,Marca,Categoria,Representante,Email,Telefono,Pais,Banco,Cuenta,Estado\n";
    const rows = brands.map(b =>
      `"${b.id}","${b.codigo}","${b.nombre_marca}","${b.categoria}","${b.nombre_representante}","${b.email}","${b.telefono}","${b.ciudad_pais}","${b.banco}","${b.no_cuenta}","${b.estado_id === 2 ? 'Activa' : 'Inactiva'}"`
    ).join("\n");

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `reporte_marcas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copiar link de Onboarding
  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://brandhub.pos/onboarding/nueva-marca");
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Filtrado y Ordenación en vivo
  const filteredBrands = brands
    .filter((brand) => {
      const query = searchTerm.toLowerCase();
      const matchesSearch =
        brand.nombre_marca.toLowerCase().includes(query) ||
        (brand.nombre_representante && brand.nombre_representante.toLowerCase().includes(query)) ||
        (brand.email && brand.email.toLowerCase().includes(query)) ||
        (brand.codigo && brand.codigo.toLowerCase().includes(query));
      const matchesStatus =
        statusFilter === 'Todas' ||
        (statusFilter === 'Activa' && brand.estado_id === 2) ||
        (statusFilter === 'Inactiva' && brand.estado_id !== 2);
      const matchesCategory = categoryFilter === 'Todas' || brand.categoria === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'ventas-desc') return b.monthSales - a.monthSales;
      if (sortBy === 'ventas-asc') return a.monthSales - b.monthSales;
      if (sortBy === 'nombre') return a.nombre_marca.localeCompare(b.nombre_marca);
      return 0;
    });

  const totalSales = brands.reduce((acc, b) => acc + b.monthSales, 0);
  const activeCount = brands.filter(b => b.estado_id === 2).length;

  return (
    <div className="flex flex-col w-full gap-6 mx-auto pb-12">

      {/* 1. TOP CONTEXT HEADER & ACTIONS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          {/* <nav className="flex items-center gap-1 text-slate-400 text-xs font-semibold tracking-wide uppercase">
            <span>Operaciones</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-indigo-600 font-semibold">Alianzas Comerciales</span>
          </nav> */}
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión de Marcas Aliadas</h1>

          </div>
          <p className="text-sm text-slate-500 max-w-3xl">
            Haz clic sobre cualquier marca de la tabla para ver y editar su ficha técnica completa.
          </p>
        </div>

        {/* Quick Actions Buttons */}
        <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px] text-slate-500">download</span>
            <span>Descargar Reporte</span>
          </button>
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Nueva Marca</span>
          </button>
        </div>
      </div>

      {/* 2. METRIC SUMMARY CARDS (KPI GRID) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Marcas</span>
            <div className="w-9 h-9 rounded-xl bg-slate-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">storefront</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{brands.length}</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              <span className="material-symbols-outlined text-[12px] text-emerald-600">trending_up</span>
              +3 este trimestre
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full" style={{ width: '82%' }}></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Marcas Activas</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{activeCount}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              {((activeCount / (brands.length || 1)) * 100).toFixed(1)}% operando
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: '89%' }}></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuentas Registradas</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{brands.filter(b => b.no_cuenta).length}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
              Bancos activos
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '68%' }}></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ventas Marcas (Mes)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">payments</span>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{formatCordobas(totalSales)}</span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
              +16.4%
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: '76%' }}></div>
          </div>
        </div>
      </div>

      {/* 3. FILTERS & OPERATIONS BAR */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por marca, código o representante..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-slate-50 text-sm text-slate-800 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-indigo-600 transition-all"
            />
          </div>

          <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 shrink-0">
            {['Todas', 'Activa', 'Inactiva'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {tab === 'Todas' ? `Todas (${brands.length})` : tab === 'Activa' ? `Activas (${activeCount})` : `Inactivas (${brands.length - activeCount})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 pl-3 pr-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold appearance-none cursor-pointer focus:outline-none"
            >
              <option value="Todas">Todas las Categorías</option>
              <option value="Hogar & Deco">Hogar & Deco</option>
              <option value="Moda Sostenible">Moda Sostenible</option>
              <option value="Cosmética Orgánica">Cosmética Orgánica</option>
              <option value="Textil Artesanal">Textil Artesanal</option>
              <option value="Marroquinería">Marroquinería</option>
              <option value="Papelería & Cerámica">Papelería & Cerámica</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">expand_more</span>
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 pl-3 pr-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold appearance-none cursor-pointer focus:outline-none"
            >
              <option value="ventas-desc">Mayor Venta</option>
              <option value="ventas-asc">Menor Venta</option>
              <option value="nombre">Nombre A - Z</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px] pointer-events-none">unfold_more</span>
          </div>
        </div>
      </div>

      {/* 4. PRIMARY DATA TABLE PRESENTATION */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 h-10">
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Marca</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Representante</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cuenta / Banco</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Productos Activos</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Ventas del Mes</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">Estado</th>
                <th className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-indigo-600 text-[28px]">sync</span>
                      <span className="text-sm font-medium">Cargando marcas desde la base de datos MySQL...</span>
                    </div>
                  </td>
                </tr>
              ) : errorMessage ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-rose-500 font-medium">
                    {errorMessage}
                  </td>
                </tr>
              ) : filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">
                    No se encontraron marcas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                  <tr
                    key={brand.id}
                    onClick={() => setSelectedBrandForDetail(brand)}
                    className="hover:bg-indigo-50/40 transition-colors group cursor-pointer"
                  >
                    {/* Marca & Logo */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {brand.logo ? (
                          <img
                            src={new URL(brand.logo, `${apiOrigin}/`).toString()}
                            alt={brand.nombre_marca}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shadow-sm shrink-0"
                          style={{
                            backgroundColor: brand.avatarBg,
                            color: brand.avatarColor,
                            display: brand.logo ? 'none' : 'flex',
                          }}
                        >
                          {brand.initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="max-w-[220px] break-words text-base font-bold leading-tight text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {brand.nombre_marca}
                            </span>
                            <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                              {brand.categoria}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">Código: {brand.codigo}</span>
                        </div>
                      </div>
                    </td>

                    {/* Representante */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-slate-800 font-medium">{brand.nombre_representante}</span>
                        <span className="text-slate-400 text-xs">{brand.email}</span>
                      </div>
                    </td>

                    {/* Cuenta / Banco */}
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700">{brand.banco}</span>
                        <span className="font-mono text-xs text-slate-400">{brand.no_cuenta || 'Sin registrar'}</span>
                      </div>
                    </td>

                    {/* Productos */}
                    <td className="px-4 py-3.5 text-right font-medium">
                      <span className={brand.estado_id !== 2 ? 'text-slate-400 text-xs' : 'text-slate-700'}>
                        {brand.activeSkus}
                      </span>
                    </td>

                    {/* Ventas */}
                    <td className="px-4 py-3.5 text-right font-semibold text-slate-900 tracking-tight">
                      {formatCordobas(brand.monthSales)}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${brand.estado_id === 2
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${brand.estado_id === 2 ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                        {brand.estado_id === 2 ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDownloadFichaEntrega(brand)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Descargar plantilla de importación de inventario (Excel)"
                        >
                          <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
                        </button>
                        <label
                          className={`p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors ${isImportingExcel ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                          title="Importar productos y unidades recibidas"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="material-symbols-outlined text-[18px]">upload_file</span>
                          <input type="file" accept=".xlsx" className="hidden" disabled={isImportingExcel} onChange={(e) => handleImportProductTemplate(brand, e.target.files?.[0], e.target)} />
                        </label>
                        <button
                          onClick={() => setSelectedBrandForDetail(brand)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                          title="Ver Ficha Técnica"
                        >
                          <span className="material-symbols-outlined text-[18px]">visibility</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(brand)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                          title="Editar Marca"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBrand(brand.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                          title="Eliminar Marca"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Mostrando <span className="font-semibold text-slate-800">{filteredBrands.length}</span> de <span className="font-semibold text-slate-800">{brands.length}</span> marcas registradas
          </span>
          <div className="inline-flex items-center gap-1">
            <button className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:bg-slate-200 transition-colors" disabled>
              Anterior
            </button>
            <button className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-sm">
              1
            </button>
            <button className="w-7 h-7 rounded-lg text-slate-600 hover:bg-slate-200 font-semibold text-xs transition-colors">
              2
            </button>
            <button className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* 5. ONBOARDING DIGITAL CALLOUT BANNER */}
      {/*  */
      }

      {/* 6. MODAL: FICHA TÉCNICA DE LA MARCA (VISTA PREVIA Y ACCIÓN DE EDICIÓN) */}
      {
        selectedBrandForDetail && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setSelectedBrandForDetail(null)}
          >
            <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

              {/* Header de la Ficha */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-3">
                  <div className="relative group/logo">
                    {selectedBrandForDetail.logo ? (
                      <img
                        src={new URL(selectedBrandForDetail.logo, `${apiOrigin}/`).toString()}
                        alt={selectedBrandForDetail.nombre_marca}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-sm"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm"
                        style={{ backgroundColor: selectedBrandForDetail.avatarBg, color: selectedBrandForDetail.avatarColor }}
                      >
                        {selectedBrandForDetail.initials}
                      </div>
                    )}
                    {/* Botón flotante para cambiar logo directo */}
                    <label
                      title="Actualizar Logo"
                      className="absolute inset-0 bg-slate-900/60 rounded-xl opacity-0 group-hover/logo:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[10px]"
                    >
                      <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                      <span>Cambiar</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => handleDirectLogoUpload(selectedBrandForDetail.id, e.target.files[0])}
                      />
                    </label>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-extrabold leading-tight tracking-wide text-slate-900">{selectedBrandForDetail.nombre_marca}</h2>
                      <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-semibold">
                        {selectedBrandForDetail.codigo}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${selectedBrandForDetail.estado_id === 2 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {selectedBrandForDetail.estado_id === 2 ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{selectedBrandForDetail.categoria} • {selectedBrandForDetail.ciudad_pais}</span>
                    {isUploadingLogo && (
                      <span className="text-[11px] text-indigo-600 font-medium animate-pulse flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                        Subiendo nuevo logo...
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* <button
                  onClick={() => handleDownloadFichaEntrega(selectedBrandForDetail)}
                  disabled={isDownloadingExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                  title="Generar y descargar Excel con productos y datos de entrega"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {isDownloadingExcel ? 'sync' : 'download'}
                  </span>
                  <span>{isDownloadingExcel ? 'Generando...' : 'Ficha de Entrega (Excel)'}</span>
                </button> */}
                  {/* <button
                  onClick={() => handleOpenEdit(selectedBrandForDetail)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Editar Ficha</span>
                </button> */}
                  <button
                    onClick={() => setSelectedBrandForDetail(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>

              {/* Contenido de la Ficha Técnica */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

                {/* Grid 1: Datos Legales & Comerciales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">badge</span>
                      Razón Social & Registro
                    </span>
                    <div className="text-sm font-semibold text-slate-900">{selectedBrandForDetail.razon_social || 'No registrada'}</div>
                    <div className="text-xs text-slate-500">Cédula: {selectedBrandForDetail.cedula || 'No registrada'}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">public</span>
                      {selectedBrandForDetail.ciudad_pais}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">share</span>
                      Redes & Catálogo
                    </span>
                    <div className="text-sm font-semibold text-indigo-600 truncate">{selectedBrandForDetail.redes_sociales || 'Sin redes asignadas'}</div>
                    {selectedBrandForDetail.catalogo ? (
                      <a
                        href={selectedBrandForDetail.catalogo}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline font-semibold inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">link</span>
                        Abrir Catálogo Digital
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Sin catálogo digital adjunto</span>
                    )}
                  </div>
                </div>

                {/* Grid 2: Representante & Contacto Directo */}
                <div className="p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    Representante & Canales de Contacto
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold block">Representante Legal</label>
                      <div className="text-sm font-bold text-slate-800">{selectedBrandForDetail.nombre_representante}</div>
                      <div className="text-xs text-slate-500">{selectedBrandForDetail.cargo}</div>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold block">Teléfono / WhatsApp</label>
                      <a
                        href={`https://wa.me/${selectedBrandForDetail.telefono.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        {selectedBrandForDetail.telefono}
                      </a>
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-400 font-semibold block">Correo Electrónico</label>
                      <a
                        href={`mailto:${selectedBrandForDetail.email}`}
                        className="text-sm font-semibold text-indigo-600 hover:underline inline-flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                        {selectedBrandForDetail.email}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Grid 3: Datos de Contrato & Cuentas Bancarias */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                      Estancia & Contrato
                    </span>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-500">Fecha de Ingreso:</span>
                      <span className="font-semibold text-slate-800">{selectedBrandForDetail.fecha_ingreso || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-500">Tiempo de Permanencia:</span>
                      <span className="font-semibold text-slate-800">{selectedBrandForDetail.tiempo_estancia} Meses</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-500">Ventas Registradas Mes:</span>
                      <span className="font-bold text-emerald-600">{formatCordobas(selectedBrandForDetail.monthSales)}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col gap-2 bg-slate-50/50">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      Cuenta Bancaria Asociada
                    </span>
                    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                      <span className="text-slate-500">Entidad Bancaria:</span>
                      <span className="font-semibold text-slate-800">{selectedBrandForDetail.banco || 'Sin Banco'}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs py-1">
                      <span className="text-slate-500">Número de Cuenta:</span>
                      <span className="font-mono font-bold text-slate-800">{selectedBrandForDetail.no_cuenta || 'No registrado'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Footer de la Ficha */}
              <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => handleDeleteBrand(selectedBrandForDetail.id)}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Dar de baja marca
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadFichaEntrega(selectedBrandForDetail)}
                    disabled={isDownloadingExcel}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isDownloadingExcel ? 'sync' : 'download'}
                    </span>
                    <span>{isDownloadingExcel ? 'Generando...' : 'Descargar plantilla de inventario (Excel)'}</span>
                  </button>
                  <label className={`inline-flex cursor-pointer items-center gap-1 px-4 py-2 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-semibold hover:bg-indigo-200 ${isImportingExcel ? 'pointer-events-none opacity-50' : ''}`}>
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>{isImportingExcel ? 'Importando...' : 'Importar plantilla llena'}</span>
                    <input type="file" accept=".xlsx" className="hidden" disabled={isImportingExcel} onChange={(e) => handleImportProductTemplate(selectedBrandForDetail, e.target.files?.[0], e.target)} />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedBrandForDetail)}
                    className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    <span>Modificar Información</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      }

      {/* 7. MODAL CREAR / EDITAR MARCA */}
      {
        isModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-opacity"
            onClick={(e) => e.target === e.currentTarget && setIsModalOpen(false)}
          >
            <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">

              {/* Modal Header Fijo */}
              <div className="flex items-start justify-between px-6 py-4 bg-white border-b border-slate-100 z-10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[24px]">store</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                        {brandToEdit ? 'Editar Marca Aliada' : 'Registrar Nueva Marca Aliada'}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configura la identidad, representante legal, tiempo de estancia y cuentas bancarias.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  type="button"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              {/* Formulario con Scroll Interno */}
              <form onSubmit={handleSubmitForm} id="brandModalForm" className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">

                {/* SECCIÓN 1: Identidad de Marca (dbo.marcas) */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">1</span>
                      <h3 className="text-sm font-bold text-slate-800">Identidad de Marca</h3>
                    </div>
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Paso Obligatorio</span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Carga de Logo Funcional */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                      <label className="text-xs font-semibold text-slate-700">Logo</label>
                      <label className="flex sm:flex-col items-center gap-2 p-3 rounded-xl bg-slate-50 border border-dashed border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer text-center w-full sm:w-[130px]">
                        <div className="w-16 h-16 rounded-lg bg-white shadow-sm flex flex-col items-center justify-center relative overflow-hidden border border-slate-200">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-indigo-600 text-[24px]">cloud_upload</span>
                              <span className="text-[10px] text-slate-400">PNG / JPG</span>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-indigo-600 font-semibold hover:underline">
                          {logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={handleLogoChange}
                        />
                      </label>
                    </div>

                    {/* Campos de Identidad */}
                    <div className="flex-1 w-full flex flex-col gap-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <label className="text-xs font-semibold text-slate-700">
                            Nombre Marca <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">verified</span>
                            <input
                              required
                              type="text"
                              value={formData.nombre_marca}
                              onChange={(e) => setFormData({ ...formData, nombre_marca: e.target.value })}
                              placeholder="ej. Nordic Home"
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Código / Prefijo <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">tag</span>
                            <input
                              required
                              type="text"
                              value={formData.codigo}
                              onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                              placeholder="ej. NDH"
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 font-mono text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Categoría <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={formData.categoria}
                            onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                            className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                          >
                            <option value="Hogar & Deco">Decoración y Hogar</option>
                            <option value="Moda Sostenible">Indumentaria y Textil</option>
                            <option value="Cosmética Orgánica">Cosmética Natural y Botánica</option>
                            <option value="Textil Artesanal">Textil Artesanal</option>
                            <option value="Marroquinería">Accesorios y Marroquinería</option>
                            <option value="Papelería & Cerámica">Papelería & Cerámica</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">Razón Social</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">badge</span>
                            <input
                              type="text"
                              value={formData.razon_social}
                              onChange={(e) => setFormData({ ...formData, razon_social: e.target.value })}
                              placeholder="Descripcion breve de la marca"
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">Cedula</label>
                          <input type="text" value={formData.cedula} onChange={(e) => setFormData({ ...formData, cedula: e.target.value })} placeholder="Numero de cedula" className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">
                            Ciudad y País de Origen <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">public</span>
                            <input
                              required
                              type="text"
                              value={formData.ciudad_pais}
                              onChange={(e) => setFormData({ ...formData, ciudad_pais: e.target.value })}
                              placeholder="ej. Managua, Nicaragua"
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-slate-700">Redes Sociales / Sitio Web</label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">share</span>
                            <input
                              type="text"
                              value={formData.redes_sociales}
                              onChange={(e) => setFormData({ ...formData, redes_sociales: e.target.value })}
                              placeholder="ej. @nordichome.ni"
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                            />
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </section>

                {/* SECCIÓN 2: Contacto Principal o Representante */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">2</span>
                      <h3 className="text-sm font-bold text-slate-800">Contacto Principal o Representante</h3>
                    </div>
                    <span className="text-xs text-slate-400">Canales de liquidación</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Nombre del Representante <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">person</span>
                        <input
                          required
                          type="text"
                          value={formData.nombre_representante}
                          onChange={(e) => setFormData({ ...formData, nombre_representante: e.target.value })}
                          placeholder="ej. Elena Müller"
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Cargo <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">work</span>
                        <input
                          required
                          type="text"
                          value={formData.cargo}
                          onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                          placeholder="ej. Gerente General"
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Nombre de Contacto Directo</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">contact_page</span>
                        <input
                          type="text"
                          value={formData.contacto_nombre}
                          onChange={(e) => setFormData({ ...formData, contacto_nombre: e.target.value })}
                          placeholder="ej. Elena Müller"
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Teléfono / WhatsApp <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={formData.repPhonePrefix}
                          onChange={(e) => setFormData({ ...formData, repPhonePrefix: e.target.value })}
                          className="w-24 h-9 px-2 rounded-lg bg-slate-50 text-xs font-semibold text-slate-700 border border-slate-200"
                        >
                          <option value="+505">NI +505</option>
                          <option value="+506">CR +506</option>
                          <option value="+502">GT +502</option>
                          <option value="+504">HN +504</option>
                        </select>
                        <input
                          type="tel"
                          value={formData.telefono}
                          onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                          placeholder="8999-9999"
                          className="flex-1 h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Correo Electrónico <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">alternate_email</span>
                        <input
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="ej. finanzas@nordichome.cloud"
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECCIÓN 3: Estancia, Catálogo y Estado (dbo.marcas) */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">3</span>
                      <h3 className="text-sm font-bold text-slate-800">Estancia, Catálogo y Operación</h3>
                    </div>
                    <span className="text-xs text-slate-400">Contrato en Tienda</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Fecha de Ingreso <span className="text-rose-500">*</span>
                      </label>
                      <input
                        required
                        type="date"
                        value={formData.fecha_ingreso}
                        onChange={(e) => setFormData({ ...formData, fecha_ingreso: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Tiempo Estancia (Meses)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={formData.tiempo_estancia}
                        onChange={(e) => setFormData({ ...formData, tiempo_estancia: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Estado <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.estado_id}
                        onChange={(e) => setFormData({ ...formData, estado_id: parseInt(e.target.value, 10) })}
                        className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                      >
                        <option value="2">Activa (Operando)</option>
                        <option value="5">Inactiva (En Pausa)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Enlace Catálogo Digital</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">link</span>
                        <input
                          type="url"
                          value={formData.catalogo}
                          onChange={(e) => setFormData({ ...formData, catalogo: e.target.value })}
                          placeholder="https://drive... o pdf"
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* SECCIÓN 4: Datos Bancarios (dbo.cuentas) */}
                <section className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-bold">4</span>
                      <h3 className="text-sm font-bold text-slate-800">Datos Bancarios para Transferencias</h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Entidad Bancaria</label>
                      <select
                        value={formData.banco}
                        onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
                        className="w-full h-9 px-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600"
                      >
                        <option value="BAC Credomatic">BAC Credomatic</option>
                        <option value="Banco Lafise">Banco Lafise</option>
                        <option value="Banpro">Banpro Grupo Promerica</option>
                        <option value="Banco BDF">Banco BDF</option>
                        <option value="Banco Ficohsa">Banco Ficohsa</option>
                        <option value="Otro">Otro Banco / Billetera Digital</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700">Número de Cuenta</label>
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">credit_card</span>
                        <input
                          type="text"
                          value={formData.no_cuenta}
                          onChange={(e) => setFormData({ ...formData, no_cuenta: e.target.value })}
                          placeholder="000-12345678-9"
                          className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 text-sm text-slate-800 border border-slate-200 focus:outline-none focus:border-indigo-600 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </section>

              </form>

              {/* Modal Footer Fijo */}
              <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Los acuerdos comerciales se aplicarán de inmediato
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    form="brandModalForm"
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isSubmitting ? 'progress_activity' : 'add_circle'}
                    </span>
                    <span>{isSubmitting ? 'Guardando...' : brandToEdit ? 'Guardar Cambios' : 'Guardar Marca'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )
      }

    </div >
  );
}
