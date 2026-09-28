import { Router } from 'express';
import supabase from '../services/supabase.js';

const router = Router();

/**
 * GET /api/invoices
 * List invoices with optional filters.
 */
router.get('/', async (req, res, next) => {
  try {
    const { userId, status, limit } = req.query;

    let query = supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.or(`creator_id.eq.${userId},recipient_id.eq.${userId}`);
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
    const { data, error } = await supabase
      .from('invoices')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;

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
