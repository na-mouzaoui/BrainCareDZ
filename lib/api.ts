const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
const API_BASE_URL = rawApiUrl.endsWith('/api')
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/$/, '')}/api`;

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
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fetchOptions.headers && typeof fetchOptions.headers === 'object' && !Array.isArray(fetchOptions.headers)) {
    Object.assign(headers, fetchOptions.headers as Record<string, string>);
  }

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
      data: data.user || data.users || data.patient || data.patients || data.payments || data.service || data.services || data.data || data,
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

// Patient endpoints
export const patients = {
  getAll: () =>
    apiRequest('/patients', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/patients/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/patients', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/patients/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/patients/${id}`, { method: 'DELETE' }),
  search: (query: string) =>
    apiRequest(`/patients/search/${query}`, { method: 'GET' }),
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
  delete: (id: string, reason?: string) =>
    apiRequest(`/appointments/${id}`, { 
      method: 'DELETE',
      body: reason ? { reason } : {},
    }),
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
  getByPatient: (patientId: string) =>
    apiRequest(`/session-notes/patient/${patientId}`, { method: 'GET' }),
};

// Expenses endpoints (Admin only)
export const expenses = {
  getAll: () =>
    apiRequest('/expenses', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/expenses/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/expenses', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/expenses/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/expenses/${id}`, { method: 'DELETE' }),
};

// Companies endpoints
export const companies = {
  getAll: () =>
    apiRequest('/companies', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/companies/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/companies', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/companies/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/companies/${id}`, { method: 'DELETE' }),
};

// Company invoices endpoints
export const companyInvoices = {
  getAll: () =>
    apiRequest('/company-invoices', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/company-invoices/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/company-invoices', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/company-invoices/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/company-invoices/${id}`, { method: 'DELETE' }),
};

// Payments endpoints
export const payments = {
  getAll: () =>
    apiRequest('/payments', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/payments/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/payments', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/payments/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/payments/${id}`, { method: 'DELETE' }),
};

// Users endpoints (Admin only)
export const users = {
  getAll: () =>
    apiRequest('/users', { method: 'GET' }),
  getById: (id: string) =>
    apiRequest(`/users/${id}`, { method: 'GET' }),
  create: (data: any) =>
    apiRequest('/users', {
      method: 'POST',
      body: data,
    }),
  update: (id: string, data: any) =>
    apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: data,
    }),
  delete: (id: string) =>
    apiRequest(`/users/${id}`, { method: 'DELETE' }),
  updatePassword: (id: string, password: string) =>
    apiRequest(`/users/${id}/password`, {
      method: 'PUT',
      body: { password },
    }),
};

// Activity Logs endpoints (Admin only)
export const activityLogs = {
  getAll: (limit = 100, offset = 0, filters?: any) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/activity-logs${query}`, { method: 'GET' });
  },
  getMyActivity: (limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    params.append('offset', String(offset));
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/activity-logs/my-activity${query}`, { method: 'GET' });
  },
  create: (data: any) =>
    apiRequest('/activity-logs', {
      method: 'POST',
      body: data,
    }),
  getStats: () =>
    apiRequest('/activity-logs/stats/summary', { method: 'GET' }),
};

// Patient Packs endpoints
export const patientPacks = {
  getAll: () =>
    apiRequest('/patient-packs', { method: 'GET' }),
  getByPatient: (patientId: string) =>
    apiRequest(`/patient-packs/patient/${patientId}`, { method: 'GET' }),
  create: (data: { patientId: string; serviceId: string; totalSessions: number }) =>
    apiRequest('/patient-packs', {
      method: 'POST',
      body: data,
    }),
  useSession: (packId: string) =>
    apiRequest(`/patient-packs/${packId}/use`, { method: 'POST' }),
  delete: (id: string) =>
    apiRequest(`/patient-packs/${id}`, { method: 'DELETE' }),
};
