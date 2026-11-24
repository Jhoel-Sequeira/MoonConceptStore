// src/services/posService.js
import api from './api'; // o tu instancia configurada de axios

const posService = {
    getCommissionConfig: async () => (await api.get('/pos/configuracion-comision')).data,
    saveCommissionConfig: async (config) => (await api.put('/pos/configuracion-comision', config)).data,
    getSalesForReturns: async (params) => {
        const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null));
        return (await api.get('/pos/devoluciones/ventas', { params: query })).data;
    },
    // Crear una nueva venta / ticket
    crearVenta: async (ventaData) => {
        const response = await api.post('/pos/ventas', ventaData);
        return response.data;
    },
    getSalesForReturns: async (params) => {
        const query = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value !== undefined && value !== null));
        return (await api.get('/pos/devoluciones/ventas', { params: query })).data;
    },
    registerReturn: async (payload) => (await api.post('/pos/devoluciones', payload)).data,
    confirmRefund: async (id, payload) => (await api.post(`/pos/devoluciones/${id}/reembolso`, payload)).data,
};

export default posService;
