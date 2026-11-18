import api from './api';

const finanzasService = {
  obtenerCierre: async () => (await api.get('/cierre-caja')).data,
  cerrarCaja: async (datos) => (await api.post('/cierre-caja', datos)).data,
  reabrirCaja: async () => (await api.post('/cierre-caja/reabrir')).data,
  obtenerReporte: async (filtros) => {
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else if (value !== undefined && value !== null && value !== '') params.set(key, value);
    });
    return (await api.get('/liquidaciones/reporte', { params })).data;
  },
  obtenerLiquidaciones: async (periodo) => (await api.get('/liquidaciones/', { params: { periodo } })).data,
  obtenerHistorialVentas: async (filtros) => (await api.get('/pos/ventas/historial', { params: filtros })).data,
  descargarLiquidacionExcel: async (marcaId, periodo, nombreMarca) => {
    const response = await api.get(`/liquidaciones/marca/${marcaId}/excel`, { params: { periodo }, responseType: 'blob' });
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    const safeName = String(nombreMarca || `marca_${marcaId}`).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
    link.href = blobUrl;
    link.download = `Liquidacion_${safeName}_${periodo}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  },
  generarYDescargarLiquidaciones: async (periodo, marcaIds) => {
    try {
      const response = await api.post('/liquidaciones/generar-exportar', marcaIds, {
        params: { periodo }, responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Liquidaciones_${periodo}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return {
        exportadas: Number(response.headers['x-marcas-exportadas'] || 0),
        sinVentas: Number(response.headers['x-marcas-sin-ventas'] || 0),
      };
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try {
          error.response.data = JSON.parse(await error.response.data.text());
        } catch {
          // Preserve the original response when the server returns a non-JSON error.
        }
      }
      throw error;
    }
  },
  marcarPagada: async (id, datos) => (await api.post(`/liquidaciones/${id}/pagar`, datos)).data,
};

export default finanzasService;
