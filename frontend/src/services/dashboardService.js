import api from './api';

const dashboardService = {
  getSummary: async () => {
    const response = await api.get('/dashboard/');
    return response.data;
  },
};

export default dashboardService;
