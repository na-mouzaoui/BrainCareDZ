const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/$/, '')}/api`;
const IS_DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const DEMO_USERS = [
  { id: 'demo-admin', name: 'Demo Admin', email: 'admin@demo.local', role: 'admin' },
  { id: 'demo-prac', name: 'Demo Practitioner', email: 'test@demo.local', role: 'practitioner' },
  { id: 'demo-rec', name: 'Demo Reception', email: 'reception@demo.local', role: 'receptionist' },
];

const DEMO_PASSWORD = 'demo123';

function getStoredDemoUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('demo_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function handleDemoRequest<T>(endpoint: string, options: ApiRequestOptions): ApiResponse<T> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body || {};

  if (endpoint === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').toLowerCase();
    const password = String(body.password || '');
    const user = DEMO_USERS.find((u) => u.email === email);

    if (!user || password !== DEMO_PASSWORD) {
      return { success: false, message: 'Invalid email or password' };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('demo_user', JSON.stringify(user));
    }

    return {
      success: true,
      data: user as T,
      token: 'demo-token',
      message: 'Logged in (demo mode)',
    };
  }

  if (endpoint === '/auth/register' && method === 'POST') {
    const user = {
      id: `demo-${Date.now()}`,
      name: String(body.name || 'Demo User'),
      email: String(body.email || '').toLowerCase(),
      role: body.role || 'practitioner',
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem('demo_user', JSON.stringify(user));
    }

    return {
      success: true,
      data: user as T,
      token: 'demo-token',
      message: 'Registered (demo mode)',
    };
  }

  if (endpoint === '/auth/me' && method === 'GET') {
    const user = getStoredDemoUser() || DEMO_USERS[1];
    return { success: true, data: user as T };
  }

  if (endpoint.startsWith('/clients') && method === 'GET') {
    return { success: true, data: { clients: [] } as T };
  }

  if (endpoint.startsWith('/appointments') && method === 'GET') {
    return { success: true, data: { appointments: [] } as T };
  }

  if (endpoint.startsWith('/session-notes') && method === 'GET') {
    return { success: true, data: { notes: [] } as T };
  }

  if (endpoint.startsWith('/invoices') && method === 'GET') {
    return { success: true, data: { invoices: [] } as T };
  }

  if (endpoint.startsWith('/services') && method === 'GET') {
    return { success: true, data: { services: [] } as T };
  }

  return { success: true, data: {} as T, message: 'Demo mode response' };
}

interface ApiRequestOptions extends RequestInit {
  body?: any;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  token?: string;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, ...fetchOptions } = options;

  if (IS_DEMO_MODE) {
    return handleDemoRequest<T>(endpoint, options);
  }
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'An error occurred',
        error: data.error,
      };
    }

    return {
      success: true,
      data: data.user || data.users || data.client || data.clients || data,
      token: data.token,
      message: data.message,
    };
  } catch (error) {
    console.error('API request failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

// Auth endpoints
export const auth = {
  register: (name: string, email: string, password: string, role?: string) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: { name, email, password, role },
    }),
  login: (email: string, password: string) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  getMe: () => apiRequest('/auth/me', { method: 'GET' }),
};

// Client endpoints
export const clients = {
  getAll: () =>
    apiRequest('/clients', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/clients/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/clients', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/clients/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/clients/${id}`, { method: 'DELETE' }),
  search: (query: string) =>
    apiRequest(`/clients/search/${query}`, { method: 'GET' }),
};

// Services endpoints
export const services = {
  getAll: () =>
    apiRequest('/services', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/services/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/services', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/services/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/services/${id}`, { method: 'DELETE' }),
  getByCategory: (category: string) =>
    apiRequest(`/services/category/${category}`, { method: 'GET' }),
};

// Appointments endpoints
export const appointments = {
  getAll: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/appointments${query}`, { method: 'GET' });
  },
  getById: (id: string) =>
    apiRequest(`/appointments/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/appointments', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/appointments/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/appointments/${id}`, { method: 'DELETE' }),
  complete: (id: string) =>
    apiRequest(`/appointments/${id}/complete`, { method: 'PUT' }),
  getAvailability: (date: string) =>
    apiRequest(`/appointments/availability/${date}`, { method: 'GET' }),
};

// Session Notes endpoints
export const sessionNotes = {
  getAll: () =>
    apiRequest('/session-notes', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/session-notes/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/session-notes', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/session-notes/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/session-notes/${id}`, { method: 'DELETE' }),
  getByClient: (clientId: string) =>
    apiRequest(`/session-notes/client/${clientId}`, { method: 'GET' }),
};

// Invoices endpoints
export const invoices = {
  getAll: (status?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/invoices${query}`, { method: 'GET' });
  },
  getById: (id: string) =>
    apiRequest(`/invoices/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/invoices', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/invoices/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/invoices/${id}`, { method: 'DELETE' }),
  send: (id: string) =>
    apiRequest(`/invoices/${id}/send`, { method: 'PUT' }),
  markPaid: (id: string) =>
    apiRequest(`/invoices/${id}/mark-paid`, { method: 'PUT' }),
  getByClient: (clientId: string) =>
    apiRequest(`/invoices/client/${clientId}`, { method: 'GET' }),
};
