import { API_BASE_URL } from '../utils/constants';
import supabase from './supabase';
import { fetchLiveTokenPrices, isStablecoin, getCachedTokenPrice } from '../utils/currency';

/**
 * Backend API client.
 * For deployed web environment: directly communicates with Supabase for data operations,
 * or delegates to API_BASE_URL if explicitly configured.
 */

async function request(endpoint, options = {}) {
  // In deployed web with no external backend set, immediately use direct Supabase
  if (!API_BASE_URL) {
    throw new Error('Direct Supabase mode active');
  }

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

  const response = await fetch(url, config);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }

  return response.json();
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

async function evaluateTrustSupabase(userId) {
  if (!userId) return { contacts: [] };
  const u = userId.toLowerCase().trim();

  // 1. Fetch manual overrides
  let overrides = [];
  try {
    const { data: ovData } = await supabase
      .from('trust_overrides')
      .select('*')
      .eq('owner_id', userId);
    overrides = ovData || [];
  } catch {
    // optional table
  }
  const overrideMap = new Map(overrides.map((o) => [(o.address || '').toLowerCase().trim(), o]));

  // 2. Fetch invoices for this user
  let allTxs = [];
  try {
    const { data: invData } = await supabase
      .from('invoices')
      .select('id, creator_id, recipient_id, amount, currency, status, created_at, title, from_data, to_data')
      .or(`creator_id.ilike.${u},recipient_id.ilike.${u}`)
      .in('status', ['paid', 'sent'])
      .order('created_at', { ascending: false })
      .limit(200);
    allTxs = invData || [];
  } catch (err) {
    console.warn('Failed to load transactions for trust scoring', err);
  }

  if (!allTxs.length) return { contacts: [] };

  // 3. Fetch contacts
  let contactsList = [];
  try {
    const { data: cData } = await supabase
      .from('contacts')
      .select('*')
      .eq('owner_id', userId);
    contactsList = cData || [];
  } catch {}

  const contactsMap = new Map();
  contactsList.forEach((c) => {
    if (c.wallet_address) {
      contactsMap.set(c.wallet_address.toLowerCase().trim(), c);
    }
  });

  // 4. Find counterparties
  const counterparties = new Map();
  for (const tx of allTxs) {
    const cId = (tx.creator_id || '').toLowerCase().trim();
    const rId = (tx.recipient_id || '').toLowerCase().trim();
    const other = cId === u ? rId : cId;
    if (other && other !== u) {
      if (!counterparties.has(other)) counterparties.set(other, []);
      counterparties.get(other).push(tx);
    }
  }

  const tokenPrices = await fetchLiveTokenPrices();
  const profiles = [];

  for (const [addr, txs] of counterparties.entries()) {
    let cryptoCount = 0;
    let totalCrypto = 0;
    let cryptoSymbol = null;

    const amounts = txs.map((t) => {
      const raw = parseFloat(t.amount) || 0;
      const curr = (t.currency || 'USDC').toUpperCase().trim();
      if (isStablecoin(curr)) {
        return raw;
      }
      const liveRate = tokenPrices[curr] || getCachedTokenPrice(curr);
      if (liveRate > 0) {
        cryptoCount++;
        totalCrypto += raw;
        cryptoSymbol = curr;
        return raw * liveRate;
      }
      return raw;
    });

    const dates = txs.map((t) => new Date(t.created_at || Date.now()).getTime()).sort();
    const now = Date.now();
    const totalVolume = amounts.reduce((a, b) => a + b, 0);
    const avgAmount = amounts.length > 0 ? totalVolume / amounts.length : 0;
    const avgCrypto = cryptoCount > 0 && cryptoSymbol ? `${(totalCrypto / amounts.length).toFixed(4)} ${cryptoSymbol}` : null;

    // Variance & consistency
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / (amounts.length || 1);
    const stdDev = Math.sqrt(variance);
    const consistency = avgAmount > 0 ? Math.max(0, 100 - (stdDev / avgAmount) * 100) : 0;

    let frequencyDays = null;
    if (dates.length >= 2) {
      const gaps = [];
      for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
      frequencyDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    }

    const durationDays = (now - dates[0]) / 86400000;
    const lastTxAge = (now - dates[dates.length - 1]) / 86400000;

    let score = 0;
    score += Math.min(30, txs.length * 8);
    score += Math.min(25, consistency * 0.25);
    score += Math.min(20, Math.max(0, 20 - lastTxAge * 0.5));
    score += Math.min(15, durationDays > 30 ? 15 : durationDays / 2);
    score += frequencyDays && frequencyDays < 45 ? 10 : 0;
    const calculatedScore = Math.round(Math.min(100, Math.max(10, score)));

    const override = overrideMap.get(addr);
    const isOverridden = !!override;
    const trustScore = isOverridden ? override.manual_score : calculatedScore;

    const trustLevel = trustScore >= 80 ? 'high' : trustScore >= 50 ? 'medium' : trustScore >= 20 ? 'low' : 'unknown';
    const pattern = frequencyDays ? (frequencyDays <= 10 ? 'weekly' : frequencyDays <= 35 ? 'monthly' : 'irregular') : 'one-time';
    const recommendation = trustLevel === 'high' ? 'auto_pay' : trustLevel === 'medium' ? 'notify' : 'manual_only';

    const matchedContact = contactsMap.get(addr) || null;
    let contactName = matchedContact?.name || '';
    let contactEmail = matchedContact?.email || '';

    if (!contactName) {
      for (const t of txs) {
        if ((t.creator_id || '').toLowerCase() === addr && t.from_data?.name) {
          contactName = t.from_data.name;
          contactEmail = contactEmail || t.from_data.email || '';
          break;
        }
        if ((t.recipient_id || '').toLowerCase() === addr && t.to_data?.name) {
          contactName = t.to_data.name;
          contactEmail = contactEmail || t.to_data.email || '';
          break;
        }
      }
    }

    const reasoning = isOverridden
      ? `Manual override applied: ${override.reason || 'Set by user'}`
      : trustLevel === 'high'
      ? `High trust established with ${txs.length} successful transactions and strong volume consistency (${Math.round(consistency)}%).`
      : trustLevel === 'medium'
      ? `Moderate transaction history (${txs.length} txs). Stable interactions, standard approval recommended.`
      : `Limited on-chain history (${txs.length} txs). Manual approval required before settlement.`;

    profiles.push({
      address: addr,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      contactDetails: matchedContact,
      trustScore,
      aiScore: calculatedScore,
      isOverridden,
      overrideReason: override?.reason || null,
      trustLevel,
      pattern,
      recommendation,
      suggestedLimit: Math.round(avgAmount * 1.5 * 100) / 100,
      metrics: {
        address: addr,
        txCount: txs.length,
        totalVolume: Math.round(totalVolume * 100) / 100,
        avgAmount: Math.round(avgAmount * 100) / 100,
        avgCrypto,
        consistency: Math.round(consistency),
        frequencyDays: frequencyDays ? Math.round(frequencyDays) : null,
        durationDays: Math.round(durationDays),
        lastTxAge: Math.round(lastTxAge),
        score: calculatedScore,
      },
      aiEval: {
        trustScore,
        trustLevel,
        reasoning,
        suggestedLimit: Math.round(avgAmount * 1.5 * 100) / 100,
        pattern,
        flags: isOverridden ? [`Manual override: ${override.reason}`] : [],
        recommendation,
      },
      flags: isOverridden ? [`Manual override: ${override.reason}`] : [],
    });
  }

  profiles.sort((a, b) => b.trustScore - a.trustScore);
  return { contacts: profiles };
}

export const autopilotApi = {
  /** AI-evaluated trust profiles from transaction history */
  getTrust: async (userId) => {
    try {
      return await request(`/api/autopilot/trust?userId=${userId}`);
    } catch {
      return await evaluateTrustSupabase(userId);
    }
  },

  /** Trigger autopilot scan (evaluate + propose actions) */
  scan: async (userId) => {
    try {
      return await request('/api/autopilot/scan', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
    } catch {
      const trustRes = await evaluateTrustSupabase(userId);
      const profiles = trustRes.contacts || [];
      const profileMap = new Map(profiles.map((p) => [p.address.toLowerCase(), p]));

      // Propose actions on pending invoices
      const u = (userId || '').toLowerCase().trim();
      const { data: pendingInvoices } = await supabase
        .from('invoices')
        .select('*')
        .or(`creator_id.ilike.${u},recipient_id.ilike.${u}`)
        .in('status', ['sent', 'draft'])
        .limit(50);

      const actions = (pendingInvoices || []).map((inv) => {
        const cId = (inv.creator_id || '').toLowerCase().trim();
        const rId = (inv.recipient_id || '').toLowerCase().trim();
        const counterparty = cId === u ? rId : cId;
        const p = profileMap.get(counterparty);
        const score = p ? p.trustScore : 20;

        let action = 'notify';
        let reason = 'Review recommended before on-chain payment.';
        if (score >= 80) {
          action = 'proposed';
          reason = `High trust score (${score}/100) — eligible for 1-click auto-pay.`;
        } else if (score >= 50) {
          action = 'notify';
          reason = `Medium trust score (${score}/100) — notification sent, awaiting sign-off.`;
        } else {
          action = 'flagged';
          reason = `Limited transaction history (${score}/100) — manual safety approval required.`;
        }

        return {
          invoiceId: inv.id,
          action,
          sender: counterparty,
          amount: inv.amount,
          currency: inv.currency || 'USDC',
          trustScore: score,
          reason,
        };
      });

      return { success: true, actions, trustProfiles: profiles };
    }
  },

  /** Override trust score manually */
  setOverride: async (userId, address, score, reason) => {
    try {
      return await request('/api/autopilot/override', {
        method: 'PUT',
        body: JSON.stringify({ userId, address, score, reason }),
      });
    } catch {
      const addr = (address || '').toLowerCase().trim();
      const record = {
        owner_id: userId,
        address: addr,
        manual_score: parseInt(score, 10) || 50,
        reason: reason || '',
        updated_at: new Date().toISOString(),
      };
      const { data: existing } = await supabase
        .from('trust_overrides')
        .select('id')
        .eq('owner_id', userId)
        .eq('address', addr)
        .single();

      if (existing?.id) {
        await supabase.from('trust_overrides').update(record).eq('id', existing.id);
      } else {
        await supabase.from('trust_overrides').insert({ ...record, created_at: new Date().toISOString() });
      }
      return { success: true };
    }
  },

  /** Remove trust override (revert to AI score) */
  removeOverride: async (userId, address) => {
    try {
      return await request(`/api/autopilot/override?userId=${userId}&address=${address}`, {
        method: 'DELETE',
      });
    } catch {
      await supabase
        .from('trust_overrides')
        .delete()
        .eq('owner_id', userId)
        .eq('address', (address || '').toLowerCase().trim());
      return { success: true };
    }
  },

  /** Get activity log */
  getActivity: async (userId, limit = 50) => {
    try {
      return await request(`/api/autopilot/activity?userId=${userId}&limit=${limit}`);
    } catch {
      return { success: true, data: [] };
    }
  },

  /** Get OnLatch connection status */
  getLatchStatus: async () => {
    try {
      return await request('/api/autopilot/latch-status');
    } catch {
      return { success: true, data: { enabled: false } };
    }
  },
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

  /** Create or update contact */
  create: async (data) => {
    try {
      return await request('/api/contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      try {
        const ownerId = data.userId || data.owner_id;
        const walletAddr = (data.walletAddress || data.wallet_address || '').trim();
        const email = (data.email || '').trim();

        // Check if contact already exists for this owner
        if (ownerId && (walletAddr || email)) {
          let existingQuery = supabase.from('contacts').select('*').eq('owner_id', ownerId);
          if (walletAddr && email) {
            existingQuery = existingQuery.or(`wallet_address.ilike.${walletAddr},email.ilike.${email}`);
          } else if (walletAddr) {
            existingQuery = existingQuery.ilike('wallet_address', walletAddr);
          } else if (email) {
            existingQuery = existingQuery.ilike('email', email);
          }
          const { data: existingList } = await existingQuery;
          if (existingList && existingList.length > 0) {
            const existingId = existingList[0].id;
            const updateFields = {
              name: data.name || existingList[0].name,
              email: email || existingList[0].email,
              wallet_address: walletAddr || existingList[0].wallet_address,
              home_address: data.homeAddress || data.home_address || existingList[0].home_address,
              updated_at: new Date().toISOString(),
            };
            const { data: updated, error: updateErr } = await supabase
              .from('contacts')
              .update(updateFields)
              .eq('id', existingId)
              .select()
              .single();
            if (!updateErr && updated) return { success: true, data: updated };
            return { success: true, data: existingList[0] };
          }
        }

        const row = {
          owner_id: ownerId,
          name: data.name || '',
          email: email,
          wallet_address: walletAddr,
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
  get: async (userId) => {
    try {
      return await request(`/api/profiles/${userId}`);
    } catch {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) {
          return {
            success: true,
            data: {
              user_id: userId,
              name: '',
              email: '',
              avatar_url: '',
              location: '',
              company: '',
            },
            exists: false,
          };
        }
        return { success: true, data, exists: true };
      } catch {
        return {
          success: true,
          data: {
            user_id: userId,
            name: '',
            email: '',
            avatar_url: '',
            location: '',
            company: '',
          },
          exists: false,
        };
      }
    }
  },

  /** Create or update profile (upsert) */
  save: async (userId, data) => {
    try {
      return await request(`/api/profiles/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (err) {
      try {
        const record = {
          user_id: userId,
          name: data.name ?? '',
          email: data.email ?? '',
          avatar_url: data.avatarUrl ?? data.avatar_url ?? '',
          location: data.location ?? '',
          company: data.company ?? '',
          updated_at: new Date().toISOString(),
        };
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .single();
        if (existing?.id) {
          const { data: updated, error } = await supabase
            .from('profiles')
            .update(record)
            .eq('id', existing.id)
            .select()
            .single();
          if (error) throw error;
          return { success: true, data: updated };
        } else {
          const { data: created, error } = await supabase
            .from('profiles')
            .insert(record)
            .select()
            .single();
          if (error) throw error;
          return { success: true, data: created };
        }
      } catch (sbErr) {
        throw sbErr || err;
      }
    }
  },
};

export default { aiApi, invoiceApi, exportApi, autopilotApi, contactsApi, notificationsApi, profilesApi };
