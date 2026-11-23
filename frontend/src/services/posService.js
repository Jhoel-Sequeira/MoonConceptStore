// src/services/posService.js
import api from './api'; // o tu instancia configurada de axios

const posService = {
    getCommissionConfig: async () => (await api.get('/pos/configuracion-comision')).data,
    saveCommissionConfig: async (config) => (await api.put('/pos/configuracion-comision', config)).data,
    // Crear una nueva venta / ticket
    crearVenta: async (ventaData) => {
        const response = await api.post('/pos/ventas', ventaData);
        return response.data;
    },
    getReturnableSales: async (params) => (await api.get('/pos/devoluciones/pendientes', { params })).data,
    getReturns: async (params) => (await api.get('/pos/devoluciones/historial', { params })).data,
    registerReturn: async (payload) => (await api.post('/pos/devoluciones', payload)).data,
    confirmRefund: async (id, payload) => (await api.post(`/pos/devoluciones/${id}/reembolso`, payload)).data,
};

export default posService;
