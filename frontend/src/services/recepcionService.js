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
};

export default recepcionService;
