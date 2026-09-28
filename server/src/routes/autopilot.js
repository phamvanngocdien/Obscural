import { Router } from 'express';
import { scanInvoices, evaluateTrust, getActivityLog, saveOverride, deleteOverride } from '../agents/autopilot.js';
import { getLatchStatus } from '../services/ai.js';

const router = Router();

// ── Trust Evaluation ──

/** GET /api/autopilot/trust?userId=0x... */
router.get('/trust', async (req, res, next) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await evaluateTrust(userId);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ── Trust Override (manual score adjustment) ──

/** PUT /api/autopilot/override — Save manual score override */
router.put('/override', async (req, res, next) => {
  try {
    const { userId, address, score, reason } = req.body;
    if (!userId || !address || score === undefined) return res.status(400).json({ error: 'userId, address, score required' });
    const data = await saveOverride(userId, address, parseInt(score), reason || '');
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

/** DELETE /api/autopilot/override — Remove override (revert to AI score) */
router.delete('/override', async (req, res, next) => {
  try {
    const { userId, address } = req.query;
    if (!userId || !address) return res.status(400).json({ error: 'userId, address required' });
    await deleteOverride(userId, address);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Autopilot Scan ──

/** POST /api/autopilot/scan — Scan + auto-evaluate + propose actions */
router.post('/scan', async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const result = await scanInvoices(userId);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

// ── Activity Log ──

/** GET /api/autopilot/activity?userId=0x... */
router.get('/activity', async (req, res, next) => {
  try {
    const { userId, limit } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const data = await getActivityLog(userId, parseInt(limit) || 50);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// ── OnLatch Status ──

/** GET /api/autopilot/latch-status */
router.get('/latch-status', (_req, res) => {
  res.json({ success: true, data: getLatchStatus() });
});

export default router;
