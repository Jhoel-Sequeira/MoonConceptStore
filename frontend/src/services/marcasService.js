import api from './api';

export const marcasService = {
  getAll: async () => {
    const response = await api.get('/marcas/');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/marcas/${id}`);
    return response.data;
  },

  create: async (marcaData) => {
    const response = await api.post('/marcas/', marcaData);
    return response.data;
  },

  update: async (id, marcaData) => {
    const response = await api.put(`/marcas/${id}`, marcaData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/marcas/${id}`);
    return response.data;
  },

  uploadLogo: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/marcas/${id}/logo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  downloadFichaEntrega: async (id, brandName = 'marca') => {
    const response = await api.get(`/marcas/${id}/ficha-entrega`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Plantilla_Inventario_${brandName.replace(/\s+/g, '_')}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  importProductTemplate: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post(`/marcas/${id}/importar-productos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob',
      });
      return {
        pdf: response.data,
        creados: Number(response.headers['x-productos-creados'] || 0),
        actualizados: Number(response.headers['x-productos-actualizados'] || 0),
        unidades: Number(response.headers['x-unidades'] || 0),
      };
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try {
          error.response.data = JSON.parse(await error.response.data.text());
        } catch {
          // Keep the original response if the server returned a non-JSON error.
        }
      }
      throw error;
    }
  },
};

export default marcasService;
