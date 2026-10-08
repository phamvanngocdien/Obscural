import { API_BASE_URL } from '../utils/constants';
import supabase from './supabase';

/**
 * Backend API client.
 * Handles all communication with the Express.js backend with direct Supabase fallback.
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
  list: async (filters = {}) => {
    try {
      const params = new URLSearchParams(filters).toString();
      return await request(`/api/invoices${params ? `?${params}` : ''}`);
    } catch (err) {
      // Direct Supabase fallback
      try {
        let query = supabase
          .from('invoices')
          .select('*')
          .order('created_at', { ascending: false });

        const conditions = [];

        if (filters.userId && filters.userId.trim()) {
          const u = filters.userId.trim();
          conditions.push(`creator_id.ilike.${u}`);
          conditions.push(`recipient_id.ilike.${u}`);
          conditions.push(`to_data->>walletAddress.ilike.${u}`);
          conditions.push(`from_data->>walletAddress.ilike.${u}`);
        }

        if (filters.email && filters.email.trim()) {
          const em = filters.email.trim();
          conditions.push(`creator_id.ilike.${em}`);
          conditions.push(`recipient_id.ilike.${em}`);
          conditions.push(`to_data->>email.ilike.${em}`);
          conditions.push(`from_data->>email.ilike.${em}`);
        }

        if (conditions.length > 0) {
          query = query.or(conditions.join(','));
        }

        if (filters.status && filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }
        if (filters.limit) {
          query = query.limit(parseInt(filters.limit));
        }

        const { data, error } = await query;
        if (error) throw error;
        return { success: true, data: data || [] };
      } catch (sbErr) {
        throw err;
      }
    }
  },

  /** Get single invoice by ID */
  get: async (id) => {
    try {
      return await request(`/api/invoices/${id}`);
    } catch (err) {
      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', id)
          .single();
        if (error) throw error;
        return { success: true, data };
      } catch {
        throw err;
      }
    }
  },

  /** Create invoice (off-chain metadata) */
  create: async (data) => {
    try {
      return await request('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      // Direct Supabase fallback
      try {
        const body = { ...data };
        if (body.metadata) {
          if (!body.from_data && body.metadata.from) body.from_data = body.metadata.from;
          if (!body.to_data && body.metadata.to) body.to_data = body.metadata.to;
          if (!body.items && body.metadata.items) body.items = body.metadata.items;
          if (body.tax_percent === undefined && body.metadata.taxPercent !== undefined) {
            body.tax_percent = body.metadata.taxPercent;
          }
          if (!body.note && body.metadata.note) body.note = body.metadata.note;
          delete body.metadata;
        }

        if (body.from && !body.from_data) { body.from_data = body.from; delete body.from; }
        if (body.to && !body.to_data) { body.to_data = body.to; delete body.to; }
        if (body.taxPercent !== undefined && body.tax_percent === undefined) {
          body.tax_percent = body.taxPercent;
          delete body.taxPercent;
        }
        if (body.dueDate && !body.due_date) {
          body.due_date = body.dueDate;
          delete body.dueDate;
        }

        // Ensure numeric fields
        if (body.amount !== undefined) body.amount = parseFloat(body.amount) || 0;
        if (body.subtotal !== undefined) body.subtotal = parseFloat(body.subtotal) || 0;
        if (body.tax_amount !== undefined) body.tax_amount = parseFloat(body.tax_amount) || 0;
        if (body.total !== undefined) body.total = parseFloat(body.total) || 0;
        if (body.tax_percent !== undefined) body.tax_percent = parseFloat(body.tax_percent) || 0;

        const { data: created, error } = await supabase
          .from('invoices')
          .insert(body)
          .select()
          .single();

        if (error) throw error;

        // Auto-create notification for recipient (both wallet and email if available)
        const recipientTargets = new Set();
        if (body.recipient_id) recipientTargets.add(body.recipient_id);
        if (body.to_data?.walletAddress) recipientTargets.add(body.to_data.walletAddress);
        if (body.to_data?.email) recipientTargets.add(body.to_data.email);

        for (const target of recipientTargets) {
          supabase.from('notifications').insert({
            user_id: target,
            type: 'info',
            icon: '📄',
            title: 'Hóa đơn mới nhận được',
            description: `Bạn nhận được hóa đơn "${body.title || 'Hóa đơn'}" trị giá ${body.amount || body.total || 0} ${body.currency || 'USD'} từ ${body.from_data?.name || 'Đối tác'}.`,
            link: `/invoices/${created.id}`,
            is_read: false,
          }).then(() => {}).catch(() => {});
        }

        return { success: true, data: created };
      } catch (sbErr) {
        throw sbErr || err;
      }
    }
  },

  /** Update invoice */
  update: async (id, data) => {
    try {
      return await request(`/api/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err) {
      try {
        const { data: updated, error } = await supabase
          .from('invoices')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return { success: true, data: updated };
      } catch {
        throw err;
      }
    }
  },

  /** Delete invoice (draft only) */
  delete: async (id) => {
    try {
      return await request(`/api/invoices/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      try {
        const { error } = await supabase.from('invoices').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch {
        throw err;
      }
    }
  },

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
  list: async (userId) => {
    try {
      return await request(`/api/contacts?userId=${userId}`);
    } catch (err) {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return { success: true, data: data || [] };
      } catch {
        throw err;
      }
    }
  },

  /** Get single contact */
  get: async (id) => {
    try {
      return await request(`/api/contacts/${id}`);
    } catch (err) {
      try {
        const { data, error } = await supabase.from('contacts').select('*').eq('id', id).single();
        if (error) throw error;
        return { success: true, data };
      } catch {
        throw err;
      }
    }
  },

  /** Create contact */
  create: async (data) => {
    try {
      return await request('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      try {
        const row = {
          owner_id: data.userId || data.owner_id,
          name: data.name || '',
          email: data.email || '',
          wallet_address: data.walletAddress || data.wallet_address || '',
          home_address: data.homeAddress || data.home_address || '',
          company: data.company || '',
          notes: data.notes || '',
        };
        const { data: created, error } = await supabase.from('contacts').insert(row).select().single();
        if (error) throw error;
        return { success: true, data: created };
      } catch {
        throw err;
      }
    }
  },

  /** Update contact */
  update: async (id, data) => {
    try {
      return await request(`/api/contacts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (err) {
      try {
        const { data: updated, error } = await supabase.from('contacts').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error) throw error;
        return { success: true, data: updated };
      } catch {
        throw err;
      }
    }
  },

  /** Delete contact */
  delete: async (id) => {
    try {
      return await request(`/api/contacts/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      try {
        const { error } = await supabase.from('contacts').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch {
        throw err;
      }
    }
  },

  /** Bulk sync contacts */
  sync: (userId, contacts) =>
    request('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ userId, contacts }),
    }),
};

// ── Notification Endpoints ──

export const notificationsApi = {
  /** List notifications */
  list: async (userId, unreadOnly = false) => {
    try {
      return await request(`/api/notifications?userId=${userId}${unreadOnly ? '&unreadOnly=true' : ''}`);
    } catch (err) {
      try {
        let q = supabase.from('notifications').select('*').order('created_at', { ascending: false });
        if (userId) {
          q = q.ilike('user_id', userId);
        }
        if (unreadOnly) {
          q = q.eq('is_read', false);
        }
        const { data, error } = await q;
        if (error) throw error;
        return { success: true, data: data || [] };
      } catch {
        throw err;
      }
    }
  },

  /** Get unread count */
  count: async (userId) => {
    try {
      return await request(`/api/notifications/count?userId=${userId}`);
    } catch (err) {
      try {
        const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).ilike('user_id', userId).eq('is_read', false);
        if (error) throw error;
        return { success: true, count: count || 0 };
      } catch {
        return { success: true, count: 0 };
      }
    }
  },

  /** Create notification */
  create: async (data) => {
    try {
      return await request('/api/notifications', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      try {
        const { data: created, error } = await supabase.from('notifications').insert(data).select().single();
        if (error) throw error;
        return { success: true, data: created };
      } catch {
        throw err;
      }
    }
  },

  /** Mark single notification as read */
  markRead: async (id) => {
    try {
      return await request(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });
    } catch (err) {
      try {
        const { data, error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id).select().single();
        if (error) throw error;
        return { success: true, data };
      } catch {
        throw err;
      }
    }
  },

  /** Mark all notifications as read */
  markAllRead: async (userId) => {
    try {
      return await request('/api/notifications/read-all', {
        method: 'PATCH',
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      try {
        const { error } = await supabase.from('notifications').update({ is_read: true }).ilike('user_id', userId);
        if (error) throw error;
        return { success: true };
      } catch {
        throw err;
      }
    }
  },

  /** Delete notification */
  delete: async (id) => {
    try {
      return await request(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      try {
        const { error } = await supabase.from('notifications').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      } catch {
        throw err;
      }
    }
  },
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
