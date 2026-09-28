import { Router } from 'express';
import { routeMessage } from '../agents/router.js';
import { getAllPolicies } from '../agents/policies.js';

const router = Router();

/** POST /api/ai/chat — Main chat endpoint */
router.post('/chat', async (req, res, next) => {
  try {
    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    const result = await routeMessage(message.trim(), context || {});
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

/** GET /api/ai/policies */
router.get('/policies', (_req, res) => {
  res.json({ success: true, data: getAllPolicies() });
});

/** GET /api/ai/health */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', agents: ['router', 'invoiceCreator', 'analyst', 'splitter', 'autopilot'], model: 'gemini-2.0-flash' });
});

export default router;
