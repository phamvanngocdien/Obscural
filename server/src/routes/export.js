import { Router } from 'express';
import supabase from '../services/supabase.js';

const router = Router();

/**
 * GET /api/export/csv
 * Export invoices as CSV.
 */
router.get('/csv', async (req, res, next) => {
  try {
    const { userId, status, fromDate, toDate } = req.query;

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
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, error } = await query;
    if (error) throw error;

    const invoices = data || [];

    // Build CSV
    const headers = ['ID', 'Status', 'Amount', 'Currency', 'Due Date', 'Created At'];
    const rows = invoices.map((inv) => [
      inv.on_chain_id || inv.id,
      inv.status,
      inv.amount,
      inv.currency,
      inv.due_date || '',
      inv.created_at,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=obscural_invoices.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/transactions/csv
 * Export transactions as CSV.
 */
router.get('/transactions/csv', async (req, res, next) => {
  try {
    const { userId, type, fromDate, toDate } = req.query;

    let query = supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) query = query.eq('user_id', userId);
    if (type && type !== 'all') query = query.eq('type', type);
    if (fromDate) query = query.gte('created_at', fromDate);
    if (toDate) query = query.lte('created_at', toDate);

    const { data, error } = await query;
    if (error) throw error;

    const transactions = data || [];

    const headers = ['Type', 'Category', 'From', 'To', 'Amount', 'Currency', 'Tx Hash', 'Status', 'Date'];
    const rows = transactions.map((tx) => [
      tx.type,
      tx.category,
      tx.from_address,
      tx.to_address,
      tx.amount,
      tx.currency,
      tx.tx_hash || '',
      tx.status,
      tx.created_at,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=obscural_transactions.csv');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/export/pdf/:id
 * Return invoice data for client-side PDF generation (jsPDF renders on frontend).
 */
router.get('/pdf/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json({ error: 'Invoice not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
