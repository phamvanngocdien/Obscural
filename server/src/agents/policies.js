/**
 * Agent Policy Engine — per-agent permissions + rate limiting.
 */
const POLICIES = {
  router: { description: 'Routes user intent to sub-agents', canRead: true, canWrite: false, canSign: false, canEmail: false, rateLimit: 30 },
  invoiceCreator: { description: 'Creates invoices from NL', canRead: true, canWrite: true, canSign: false, canEmail: false, rateLimit: 10 },
  analyst: { description: 'Financial insights', canRead: true, canWrite: false, canSign: false, canEmail: false, rateLimit: 10 },
  reminder: { description: 'Payment reminder & email dispatch', canRead: true, canWrite: false, canSign: false, canEmail: true, rateLimit: 15 },
  autopilot: { description: 'Auto-manages recurring payments via OnLatch', canRead: true, canWrite: true, canSign: true, canEmail: true, maxTxAmount: null, rateLimit: 20 },
};

const rateCounts = {};
setInterval(() => { for (const k in rateCounts) rateCounts[k] = 0; }, 60_000);

export function checkPolicy(agentId, action, context = {}) {
  const p = POLICIES[agentId];
  if (!p) return { allowed: false, reason: `Unknown agent: ${agentId}` };
  const rk = `${agentId}:${action}`;
  rateCounts[rk] = (rateCounts[rk] || 0) + 1;
  if (rateCounts[rk] > p.rateLimit) return { allowed: false, reason: `Rate limit exceeded for ${agentId}` };

  switch (action) {
    case 'read': return p.canRead ? { allowed: true } : { allowed: false, reason: `${agentId} cannot read` };
    case 'write': return p.canWrite ? { allowed: true } : { allowed: false, reason: `${agentId} cannot write` };
    case 'sign':
      if (!p.canSign) return { allowed: false, reason: `${agentId} cannot sign` };
      if (p.maxTxAmount && context.amount > p.maxTxAmount) return { allowed: false, reason: `Amount exceeds max ${p.maxTxAmount}` };
      return { allowed: true };
    case 'email': return p.canEmail ? { allowed: true } : { allowed: false, reason: `${agentId} cannot email` };
    default: return { allowed: false, reason: `Unknown action: ${action}` };
  }
}

export function getAllPolicies() { return POLICIES; }
