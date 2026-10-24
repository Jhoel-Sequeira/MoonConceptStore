import api from './api';

const finanzasService = {
  obtenerCierre: async () => (await api.get('/cierre-caja/')).data,
  cerrarCaja: async (datos) => (await api.post('/cierre-caja/', datos)).data,
  reabrirCaja: async () => (await api.post('/cierre-caja/reabrir')).data,
  obtenerReporte: async (periodo) => (await api.get('/liquidaciones/reporte', { params: { periodo } })).data,
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
  generarLiquidaciones: async (periodo) => (await api.post('/liquidaciones/generar', null, { params: { periodo } })).data,
  marcarPagada: async (id, datos) => (await api.post(`/liquidaciones/${id}/pagar`, datos)).data,
};

export default finanzasService;
