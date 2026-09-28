import { Router } from 'express';
import supabase from '../services/supabase.js';

const router = Router();

/**
 * GET /api/profiles/:userId
 * Get user profile by wallet address.
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      // Return empty profile shell (not yet created)
      return res.json({
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
      });
    }

    res.json({ success: true, data, exists: true });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/profiles/:userId
 * Create or update user profile (upsert).
 */
router.put('/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { name, email, avatarUrl, location, company } = req.body;

    const record = {
      user_id: userId,
      name: name ?? '',
      email: email ?? '',
      avatar_url: avatarUrl ?? '',
      location: location ?? '',
      company: company ?? '',
    };

    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    let data;
    if (existing) {
      // Update
      const result = await supabase
        .from('profiles')
        .update(record)
        .eq('user_id', userId)
        .select()
        .single();

      if (result.error) throw result.error;
      data = result.data;
    } else {
      // Insert
      const result = await supabase
        .from('profiles')
        .insert(record)
        .select()
        .single();

      if (result.error) throw result.error;
      data = result.data;
    }

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
