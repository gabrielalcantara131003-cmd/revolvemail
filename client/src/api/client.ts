import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://revolvemail.onrender.com/api',
  withCredentials: true,
  headers: { 
    'Content-Type': 'application/json'
  },
});

// Interceptor para adicionar token JWT automaticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('revolvemail_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('revolvemail_token');
      localStorage.removeItem('revolvemail_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
