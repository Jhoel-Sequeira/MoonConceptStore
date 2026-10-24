import api from './api';

const recepcionService = {
  getAll: async () => {
    const response = await api.get('/recepcion/');
    return response.data;
  },
  getDetail: async (id) => {
    const response = await api.get(`/recepcion/${id}`);
    return response.data;
  },
  downloadQrPdf: async (id) => {
    try {
      const response = await api.get(`/recepcion/${id}/qr-pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_Recepcion_${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      return Number(response.headers['x-productos-qr'] || 0);
    } catch (error) {
      if (error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* conservar el error original */ }
      }
      throw error;
    }
  },
};

export default recepcionService;
