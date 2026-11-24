import api from './api';

const clientesService = {
  getAll: async ({ buscar = '', limite = 100 } = {}) => {
    const response = await api.get('/clientes/', { params: { buscar: buscar || undefined, limite } });
    return response.data;
  },
  getById: async (id) => (await api.get(`/clientes/${id}`)).data,
  getCreditAccount: async (id) => (await api.get(`/clientes/${id}/cuentas`)).data,
  registerPayment: async (id, payment) => (await api.post(`/clientes/${id}/abonos`, payment)).data,
  create: async (data) => (await api.post('/clientes/', data)).data,
  update: async (id, data) => (await api.put(`/clientes/${id}`, data)).data,
};

export default clientesService;
