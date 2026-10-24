import api from './api';

const rentaService = {
  listar: async (periodo) => (await api.get('/renta/', { params: { periodo } })).data,
  guardarConfiguracion: async (configuracion) => (await api.post('/renta/configuraciones', configuracion)).data,
  generar: async (periodo) => (await api.post('/renta/generar', null, { params: { periodo } })).data,
  registrarPago: async (rentaId, pago) => (await api.post(`/renta/${rentaId}/pagos`, pago)).data,
};

export default rentaService;
