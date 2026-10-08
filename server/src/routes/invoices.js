import { Router } from 'express';
import supabase from '../services/supabase.js';

const router = Router();

/**
 * GET /api/invoices
 * List invoices with optional filters.
 */
router.get('/', async (req, res, next) => {
  try {
    const { userId, email, status, limit } = req.query;

    let query = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    const conditions = [];

    if (userId && userId.trim()) {
      const u = userId.trim();
      conditions.push(`creator_id.ilike.${u}`);
      conditions.push(`recipient_id.ilike.${u}`);
      conditions.push(`to_data->>walletAddress.ilike.${u}`);
      conditions.push(`from_data->>walletAddress.ilike.${u}`);
    }

    if (email && email.trim()) {
      const em = email.trim();
      conditions.push(`creator_id.ilike.${em}`);
      conditions.push(`recipient_id.ilike.${em}`);
      conditions.push(`to_data->>email.ilike.${em}`);
      conditions.push(`from_data->>email.ilike.${em}`);
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/invoices/:id
 * Get a single invoice by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Invoice not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/invoices
 * Create a new invoice (off-chain metadata).
 */
router.post('/', async (req, res, next) => {
  try {
    const body = { ...req.body };

    // Extract fields if legacy metadata object was passed
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

    // Support camelCase mappings
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

    const { data, error } = await supabase
      .from('invoices')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    // Automatic Notification for Recipient
    const recipientTargets = new Set();
    if (body.recipient_id) recipientTargets.add(body.recipient_id);
    if (body.to_data?.walletAddress) recipientTargets.add(body.to_data.walletAddress);
    if (body.to_data?.email) recipientTargets.add(body.to_data.email);

    for (const target of recipientTargets) {
      try {
        await supabase.from('notifications').insert({
          user_id: target,
          type: 'info',
          icon: '📄',
          title: 'Hóa đơn mới nhận được',
          description: `Bạn nhận được hóa đơn "${body.title || 'Hóa đơn'}" trị giá ${body.amount || body.total || 0} ${body.currency || 'USD'} từ ${body.from_data?.name || 'Đối tác'}.`,
          link: `/invoices/${data.id}`,
          is_read: false,
        });
      } catch (notifErr) {
        console.warn('Auto-create notification notice:', notifErr?.message || notifErr);
      }
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/invoices/:id
 * Update an invoice.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/invoices/:id
 * Delete a draft invoice.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    // Only allow deleting drafts
    const { data: invoice } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', req.params.id)
      .single();

    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    }

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/invoices/:id/remind
 * Send AI payment reminder email.
 */
router.post('/:id/remind', async (req, res, next) => {
  try {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const invoicePayload = invoice || req.body.invoice || {};
    const { handleReminder } = await import('../agents/reminder.js');
    const result = await handleReminder(invoicePayload, req.body.context || {});

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
