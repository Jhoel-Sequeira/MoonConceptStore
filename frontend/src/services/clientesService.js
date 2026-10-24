import api from './api';

const clientesService = {
  getAll: async ({ buscar = '', limite = 100 } = {}) => {
    const response = await api.get('/clientes/', { params: { buscar: buscar || undefined, limite } });
    return response.data;
  },
  getById: async (id) => (await api.get(`/clientes/${id}`)).data,
  create: async (data) => (await api.post('/clientes/', data)).data,
  update: async (id, data) => (await api.put(`/clientes/${id}`, data)).data,
};

export default clientesService;
