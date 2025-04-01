import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const getActiveSession = async () => {
  try {
    const response = await api.get('/api/sessions/active');
    return response.data;
  } catch (error) {
    console.error('Error fetching active session:', error);
    return null;
  }
};

export const createSession = async (sessionData: any) => {
  const response = await api.post('/api/sessions', sessionData);
  return response.data;
};

export const markAttendance = async (sessionId: string, qrData: string) => {
  const response = await api.post(`/api/attendance/${sessionId}`, { qrData });
  return response.data;
};

export default api; 