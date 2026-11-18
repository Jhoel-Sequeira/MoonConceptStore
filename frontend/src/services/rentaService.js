import api from './api';

const rentaService = {
  listar: async (periodo) => (await api.get('/renta/', { params: { periodo } })).data,
  guardarConfiguracion: async (configuracion) => (await api.post('/renta/configuraciones', configuracion)).data,
  importarConfiguraciones: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return (await api.post('/renta/configuraciones/importar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })).data;
  },
  generar: async (periodo) => (await api.post('/renta/generar', null, { params: { periodo } })).data,
  registrarPago: async (rentaId, pago) => (await api.post(`/renta/${rentaId}/pagos`, pago)).data,
};

export default rentaService;
