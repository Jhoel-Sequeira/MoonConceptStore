import api from './api';

const bajasRetirosService = {
  getAll: async () => {
    const response = await api.get('/bajas-retiros/');
    return response.data;
  },
  getDetail: async (id) => {
    const response = await api.get(`/bajas-retiros/${id}`);
    return response.data;
  },
  create: async (data) => {
    const response = await api.post('/bajas-retiros/', data);
    return response.data;
  },
};

export default bajasRetirosService;
