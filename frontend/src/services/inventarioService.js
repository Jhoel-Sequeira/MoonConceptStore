import api from './api';

const apiOrigin = new URL(api.defaults.baseURL, window.location.origin).origin;

export const inventarioService = {
  getAll: async (params = {}) => {
    const response = await api.get('/inventario/', { params });
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/inventario/stats');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/inventario/${id}`);
    return response.data;
  },

  create: async (productoData) => {
    const response = await api.post('/inventario/', productoData);
    return response.data;
  },

  update: async (id, productoData) => {
    const response = await api.put(`/inventario/${id}`, productoData);
    return response.data;
  },

  uploadPhoto: async (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/inventario/${id}/foto`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadPhotos: async (id, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await api.post(`/inventario/${id}/fotos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deletePhoto: async (id, imageUrl) => {
    const response = await api.delete(`/inventario/${id}/fotos`, { params: { image_url: imageUrl } });
    return response.data;
  },

  getProductImageUrl: (imagePath) => {
    if (!imagePath) return '';
    if (/^https?:\/\//i.test(imagePath)) return imagePath;
    return new URL(imagePath, `${apiOrigin}/`).toString();
  },

  delete: async (id) => {
    const response = await api.delete(`/inventario/${id}`);
    return response.data;
  },

  getQrImageUrl: (id, sku, imagePath) => {
    if (imagePath) return new URL(imagePath, `${apiOrigin}/`).toString();
    if (sku) return `${apiOrigin}/uploads/qr/qr_prod_${id}_${sku}.png`;
    return `${apiOrigin}/api/v1/inventario/${id}/qr-image`;
  },

  generarQrEnServidor: async (id) => {
    const response = await api.post(`/inventario/${id}/generar-qr`);
    return response.data;
  },
};

export default inventarioService;
