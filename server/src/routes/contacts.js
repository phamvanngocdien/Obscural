import { Router } from 'express';
import supabase from '../services/supabase.js';

const router = Router();

/**
 * GET /api/contacts?userId=0x...
 * List all contacts belonging to a user.
 */
router.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('owner_id', userId)
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/contacts/:id
 * Get a single contact by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json({ error: 'Contact not found' });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/contacts
 * Create a new contact.
 */
router.post('/', async (req, res, next) => {
  try {
    const { userId, name, email, walletAddress, homeAddress, company, notes, avatarUrl } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!name) return res.status(400).json({ error: 'name required' });

    const record = {
      owner_id: userId,
      name,
      email: email || '',
      wallet_address: walletAddress || '',
      home_address: homeAddress || '',
      company: company || '',
      notes: notes || '',
      avatar_url: avatarUrl || '',
    };

    const { data, error } = await supabase
      .from('contacts')
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
 * PATCH /api/contacts/:id
 * Update a contact.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const updates = {};
    const allowedFields = ['name', 'email', 'wallet_address', 'home_address', 'company', 'notes', 'avatar_url', 'is_favorite'];

    // Map camelCase body keys to snake_case DB columns
    const fieldMap = {
      walletAddress: 'wallet_address',
      homeAddress: 'home_address',
      avatarUrl: 'avatar_url',
      isFavorite: 'is_favorite',
    };

    for (const [key, value] of Object.entries(req.body)) {
      const dbKey = fieldMap[key] || key;
      if (allowedFields.includes(dbKey)) {
        updates[dbKey] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
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
 * DELETE /api/contacts/:id
 * Delete a contact.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/contacts/sync
 * Bulk sync contacts from client localStorage to server.
 * Accepts an array of contacts and upserts them.
 */
router.post('/sync', async (req, res, next) => {
  try {
    const { userId, contacts } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!Array.isArray(contacts)) return res.status(400).json({ error: 'contacts must be an array' });

    const records = contacts.map((c) => ({
      id: c.id || undefined,
      owner_id: userId,
      name: c.name || '',
      email: c.email || '',
      wallet_address: c.walletAddress || c.wallet_address || '',
      home_address: c.homeAddress || c.home_address || c.address || '',
      company: c.company || '',
      notes: c.notes || '',
      avatar_url: c.avatarUrl || c.avatar_url || '',
    }));

    const { data, error } = await supabase
      .from('contacts')
      .upsert(records, { onConflict: 'id' })
      .select();

    if (error) throw error;

    res.json({ success: true, data: data || [], synced: records.length });
  } catch (err) {
    next(err);
  }
});

export default router;
