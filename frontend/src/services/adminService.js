import api from './api';

const adminService = {
  listUsers: async () => (await api.get('/admin/')).data,
  createUser: async (user) => (await api.post('/admin/users', user)).data,
  updateUser: async (id, user) => (await api.put(`/admin/users/${id}`, user)).data,
  setUserActive: async (id, active) => (await api.patch(`/admin/users/${id}/status`, { active })).data,
};

export default adminService;
