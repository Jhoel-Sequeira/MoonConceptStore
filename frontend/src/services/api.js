import axios from 'axios';

const api = axios.create({
  baseURL: `${window.location.origin}/api/v1`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('moon-token') || sessionStorage.getItem('moon-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('moon-session');
      localStorage.removeItem('moon-token');
      sessionStorage.removeItem('moon-session');
      sessionStorage.removeItem('moon-token');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export default api;
