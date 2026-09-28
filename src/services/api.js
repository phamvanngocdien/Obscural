import { API_BASE_URL } from '../utils/constants';

/**
 * Backend API client.
 * Handles all communication with the Express.js backend.
 */

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available
  const token = localStorage.getItem('obscural_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Backend server is not running. Start it with: npm run dev:server');
    }
    throw error;
  }
}

// ── AI Agent Endpoints ──

export const aiApi = {
  /** Send a message to AI assistant (routed to the right agent) */
  chat: (message, context = {}) =>
    request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    }),

  /** Get AI system health */
  health: () => request('/api/ai/health'),

  /** Get agent policies */
  policies: () => request('/api/ai/policies'),
};

// ── Invoice Endpoints ──

export const invoiceApi = {
  /** List invoices with optional filters */
  list: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/api/invoices${params ? `?${params}` : ''}`);
  },

  /** Get single invoice by ID */
  get: (id) => request(`/api/invoices/${id}`),

  /** Create invoice (off-chain metadata) */
  create: (data) =>
    request('/api/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Update invoice */
  update: (id, data) =>
    request(`/api/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Delete invoice (draft only) */
  delete: (id) =>
    request(`/api/invoices/${id}`, {
      method: 'DELETE',
    }),

  /** Send payment reminder */
  remind: (id, data = {}) =>
    request(`/api/invoices/${id}/remind`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Export Endpoints ──

export const exportApi = {
  csv: (filters = {}) => {
    const params = new URLSearchParams(filters).toString();
    return request(`/api/export/csv${params ? `?${params}` : ''}`);
  },
  pdf: (invoiceId) => request(`/api/export/pdf/${invoiceId}`),
};

// ── Autopilot Endpoints ──

export const autopilotApi = {
  /** AI-evaluated trust profiles from transaction history */
  getTrust: (userId) => request(`/api/autopilot/trust?userId=${userId}`),

  /** Trigger autopilot scan (evaluate + propose actions) */
  scan: (userId) =>
    request('/api/autopilot/scan', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  /** Override trust score manually */
  setOverride: (userId, address, score, reason) =>
    request('/api/autopilot/override', {
      method: 'PUT',
      body: JSON.stringify({ userId, address, score, reason }),
    }),

  /** Remove trust override (revert to AI score) */
  removeOverride: (userId, address) =>
    request(`/api/autopilot/override?userId=${userId}&address=${address}`, {
      method: 'DELETE',
    }),

  /** Get activity log */
  getActivity: (userId, limit = 50) =>
    request(`/api/autopilot/activity?userId=${userId}&limit=${limit}`),

  /** Get OnLatch connection status */
  getLatchStatus: () => request('/api/autopilot/latch-status'),
};

// ── Contact Endpoints ──

export const contactsApi = {
  /** List contacts for a user */
  list: (userId) => request(`/api/contacts?userId=${userId}`),

  /** Get single contact */
  get: (id) => request(`/api/contacts/${id}`),

  /** Create contact */
  create: (data) =>
    request('/api/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Update contact */
  update: (id, data) =>
    request(`/api/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** Delete contact */
  delete: (id) =>
    request(`/api/contacts/${id}`, {
      method: 'DELETE',
    }),

  /** Bulk sync contacts from localStorage to server */
  sync: (userId, contacts) =>
    request('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ userId, contacts }),
    }),
};

// ── Notification Endpoints ──

export const notificationsApi = {
  /** List notifications */
  list: (userId, unreadOnly = false) =>
    request(`/api/notifications?userId=${userId}${unreadOnly ? '&unreadOnly=true' : ''}`),

  /** Get unread count */
  count: (userId) => request(`/api/notifications/count?userId=${userId}`),

  /** Create notification */
  create: (data) =>
    request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Mark single notification as read */
  markRead: (id) =>
    request(`/api/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  /** Mark all notifications as read */
  markAllRead: (userId) =>
    request('/api/notifications/read-all', {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    }),

  /** Delete notification */
  delete: (id) =>
    request(`/api/notifications/${id}`, {
      method: 'DELETE',
    }),
};

// ── Profile Endpoints ──

export const profilesApi = {
  /** Get user profile */
  get: (userId) => request(`/api/profiles/${userId}`),

  /** Create or update profile (upsert) */
  save: (userId, data) =>
    request(`/api/profiles/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export default { aiApi, invoiceApi, exportApi, autopilotApi, contactsApi, notificationsApi, profilesApi };
