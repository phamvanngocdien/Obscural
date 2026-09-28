import { Router } from 'express';
import supabase from '../services/supabase.js';

const router = Router();

/**
 * GET /api/notifications?userId=0x...&unreadOnly=true
 * List notifications for a user.
 */
router.get('/', async (req, res, next) => {
  try {
    const { userId, unreadOnly, limit } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly === 'true') {
      query = query.eq('is_read', false);
    }

    if (limit) {
      query = query.limit(parseInt(limit) || 50);
    } else {
      query = query.limit(50);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notifications/count?userId=0x...
 * Get unread notification count.
 */
router.get('/count', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ success: true, count: count || 0 });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notifications
 * Create a notification.
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId, type, icon, title, description, link, metadata } = req.body;
    if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });

    const record = {
      user_id: userId,
      type: type || 'info',
      icon: icon || '🔔',
      title,
      description: description || '',
      link: link || '',
      metadata: metadata || {},
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
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
 * PATCH /api/notifications/read-all
 * Mark all notifications as read for a user.
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
