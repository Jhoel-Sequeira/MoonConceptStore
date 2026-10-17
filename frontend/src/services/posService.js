// src/services/posService.js
import api from './api'; // o tu instancia configurada de axios

const posService = {
    // Crear una nueva venta / ticket
    crearVenta: async (ventaData) => {
        const response = await api.post('/pos/ventas', ventaData);
        return response.data;
    }
};

export default posService;