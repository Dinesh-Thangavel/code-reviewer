import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 300000, // 5 minutes for long-running operations like reviews
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('ai-code-review-token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response) {
            // Handle 401 Unauthorized - clear auth and redirect to login
            if (error.response.status === 401) {
                localStorage.removeItem('ai-code-review-token');
                localStorage.removeItem('ai-code-review-user');
                delete api.defaults.headers.common['Authorization'];
                
                // Only redirect if not already on login/signup page
                if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/signup')) {
                    window.location.href = '/login';
                }
            }
            
            // Server responded with error status
            console.error(`API Error [${error.response.status}]:`, error.response.data?.error || error.response.data);
        } else if (error.request) {
            // Request made but no response (network error)
            console.error('API Network Error:', error.message);
        } else {
            console.error('API Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;
