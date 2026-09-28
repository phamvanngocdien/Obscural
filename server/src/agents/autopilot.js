import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';
import supabase from '../services/supabase.js';

/**
 * Autopilot Agent — AI-evaluated trust scoring.
 *
 * Instead of manually adding trusted contacts, the agent:
 * 1. Analyzes ALL transaction history with each address
 * 2. Computes a trust score based on: frequency, consistency, amounts, duration
 * 3. Auto-classifies contacts as trusted/neutral/unknown
 * 4. Proposes auto-pay only for high-trust contacts
 *
 * Trust Score Factors:
 * - txCount: Number of completed transactions (more = higher trust)
 * - frequency: How regularly they transact (weekly/monthly pattern = higher)
 * - consistency: How consistent the amounts are (stable = higher)
 * - duration: How long the relationship has existed (longer = higher)
 * - avgAmount: Average transaction size
 * - lastTxAge: Days since last transaction (recent = higher)
 */

const TRUST_THRESHOLDS = {
  HIGH: 80,     // Auto-pay eligible
  MEDIUM: 50,   // Notify user, suggest approval
  LOW: 20,      // Flag for review
};

const EVALUATE_SYSTEM = `You are a trust evaluation AI for Obscural, a blockchain payment platform.
Analyze the transaction history between a user and a counterparty to determine trust level.

Input: transaction statistics and history.
Return JSON:
{
  "trustScore": 0-100,
  "trustLevel": "high" | "medium" | "low" | "unknown",
  "reasoning": "string — why this score",
  "suggestedLimit": number — recommended auto-pay limit in USD,
  "pattern": "weekly" | "monthly" | "irregular" | "one-time",
  "flags": ["string — any concerns"],
  "recommendation": "auto_pay" | "notify" | "manual_only"
}

Scoring guide:
- 5+ transactions, monthly pattern, consistent amounts → 80-100 (high trust)
- 3-5 transactions, somewhat regular → 50-79 (medium trust)
- 1-2 transactions → 20-49 (low trust)
- 0 transactions → 0-19 (unknown)
- Deduct points for: irregular amounts, large gaps, sudden amount spikes
- Suggested limit should be ~1.5x the average historical amount`;

/**
 * Analyze transaction history and compute trust metrics for each counterparty.
 */
function computeTrustMetrics(transactions, counterpartyAddress) {
  const txs = transactions.filter(t =>
    t.creator_id?.toLowerCase() === counterpartyAddress ||
    t.recipient_id?.toLowerCase() === counterpartyAddress
  );

  if (!txs.length) {
    return {
      address: counterpartyAddress,
      txCount: 0,
      totalVolume: 0,
      avgAmount: 0,
      consistency: 0,
      frequencyDays: null,
      durationDays: 0,
      lastTxAge: Infinity,
      score: 0,
    };
  }

  const amounts = txs.map(t => parseFloat(t.amount) || 0);
  const dates = txs.map(t => new Date(t.created_at).getTime()).sort();
  const now = Date.now();

  const totalVolume = amounts.reduce((a, b) => a + b, 0);
  const avgAmount = totalVolume / amounts.length;

  // Consistency: standard deviation / mean (lower = more consistent)
  const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const consistency = avgAmount > 0 ? Math.max(0, 100 - (stdDev / avgAmount) * 100) : 0;

  // Frequency: average days between transactions
  let frequencyDays = null;
  if (dates.length >= 2) {
    const gaps = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
    frequencyDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  // Duration: days from first to now
  const durationDays = (now - dates[0]) / 86400000;

  // Last tx age
  const lastTxAge = (now - dates[dates.length - 1]) / 86400000;

  // Basic score computation (before AI refinement)
  let score = 0;
  score += Math.min(30, txs.length * 6);                           // max 30 from tx count
  score += Math.min(25, consistency * 0.25);                        // max 25 from consistency
  score += Math.min(20, Math.max(0, 20 - lastTxAge * 0.5));        // max 20 from recency
  score += Math.min(15, durationDays > 30 ? 15 : durationDays / 2);// max 15 from duration
  score += frequencyDays && frequencyDays < 45 ? 10 : 0;           // 10 for regular frequency

  return {
    address: counterpartyAddress,
    txCount: txs.length,
    totalVolume: Math.round(totalVolume * 100) / 100,
    avgAmount: Math.round(avgAmount * 100) / 100,
    consistency: Math.round(consistency),
    frequencyDays: frequencyDays ? Math.round(frequencyDays) : null,
    durationDays: Math.round(durationDays),
    lastTxAge: Math.round(lastTxAge),
    score: Math.round(Math.min(100, score)),
  };
}

/**
 * Get/save manual trust overrides (e.g. wallet compromised).
 */
export async function getOverrides(userId) {
  const { data } = await supabase
    .from('trust_overrides').select('*')
    .eq('owner_id', userId);
  return data || [];
}

export async function saveOverride(userId, address, score, reason = '') {
  const record = {
    owner_id: userId,
    address: address.toLowerCase(),
    manual_score: score,
    reason,
    updated_at: new Date().toISOString(),
  };
  // Upsert by owner_id + address
  const { data: existing } = await supabase
    .from('trust_overrides').select('id')
    .eq('owner_id', userId).eq('address', address.toLowerCase()).single();

  if (existing) {
    const { data, error } = await supabase
      .from('trust_overrides').update(record)
      .eq('id', existing.id).select().single();
    if (error) throw new Error(error.message);
    return data;
  } else {
    record.created_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('trust_overrides').insert(record).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}

export async function deleteOverride(userId, address) {
  await supabase.from('trust_overrides').delete()
    .eq('owner_id', userId).eq('address', address.toLowerCase());
  return { success: true };
}

/**
 * Evaluate all counterparties and return trust profiles.
 */
export async function evaluateTrust(userId) {
  const pc = checkPolicy('autopilot', 'read');
  if (!pc.allowed) return { contacts: [], error: pc.reason };

  // Load manual overrides
  const overrides = await getOverrides(userId);
  const overrideMap = new Map(overrides.map(o => [o.address, o]));

  // Get ALL transactions involving this user
  const { data: allTxs } = await supabase
    .from('invoices').select('id, creator_id, recipient_id, amount, currency, status, created_at, title')
    .or(`creator_id.eq.${userId},recipient_id.eq.${userId}`)
    .in('status', ['paid', 'sent'])
    .order('created_at', { ascending: false }).limit(200);

  if (!allTxs?.length) return { contacts: [], message: 'No transaction history to analyze.' };

  // Find unique counterparties
  const counterparties = new Set();
  for (const tx of allTxs) {
    const other = tx.creator_id?.toLowerCase() === userId.toLowerCase()
      ? tx.recipient_id?.toLowerCase()
      : tx.creator_id?.toLowerCase();
    if (other) counterparties.add(other);
  }

  // Compute metrics for each
  const profiles = [];
  for (const addr of counterparties) {
    const metrics = computeTrustMetrics(allTxs, addr);

    // AI refinement for contacts with enough history
    let aiEval = null;
    if (metrics.txCount >= 2) {
      try {
        const relevantTxs = allTxs.filter(t =>
          t.creator_id?.toLowerCase() === addr || t.recipient_id?.toLowerCase() === addr
        ).slice(0, 15);

        const prompt = `Evaluate trust for address ${addr}:
Metrics: ${JSON.stringify(metrics)}
Recent transactions: ${JSON.stringify(relevantTxs)}
Evaluate:`;

        const raw = await generate(prompt, EVALUATE_SYSTEM);
        aiEval = parseJson(raw);
      } catch (err) {
        console.error(`[Autopilot] AI eval failed for ${addr}:`, err.message);
      }
    }

    const aiScore = aiEval?.trustScore ?? metrics.score;

    // Apply manual override if exists
    const override = overrideMap.get(addr);
    const trustScore = override ? override.manual_score : aiScore;
    const isOverridden = !!override;

    const trustLevel = trustScore >= TRUST_THRESHOLDS.HIGH ? 'high'
      : trustScore >= TRUST_THRESHOLDS.MEDIUM ? 'medium'
      : trustScore >= TRUST_THRESHOLDS.LOW ? 'low' : 'unknown';

    profiles.push({
      address: addr,
      trustScore,
      aiScore,
      isOverridden,
      overrideReason: override?.reason || null,
      trustLevel,
      metrics,
      aiEval: aiEval || null,
      recommendation: aiEval?.recommendation || (trustLevel === 'high' ? 'auto_pay' : trustLevel === 'medium' ? 'notify' : 'manual_only'),
      suggestedLimit: aiEval?.suggestedLimit || Math.round(metrics.avgAmount * 1.5 * 100) / 100,
      pattern: aiEval?.pattern || (metrics.frequencyDays ? (metrics.frequencyDays <= 10 ? 'weekly' : metrics.frequencyDays <= 35 ? 'monthly' : 'irregular') : 'one-time'),
      flags: isOverridden ? [...(aiEval?.flags || []), `Manual override: ${override.reason || 'User adjusted'}`] : (aiEval?.flags || []),
    });
  }

  // Sort by trust score descending
  profiles.sort((a, b) => b.trustScore - a.trustScore);

  return { contacts: profiles };
}

/**
 * Scan pending invoices + use trust scoring (not manual contacts list).
 */
export async function scanInvoices(userId) {
  const pc = checkPolicy('autopilot', 'read');
  if (!pc.allowed) return { actions: [], error: pc.reason };

  // 1. Get trust profiles
  const { contacts: trustProfiles } = await evaluateTrust(userId);

  // 2. Get pending invoices
  const { data: pendingInvoices } = await supabase
    .from('invoices').select('*')
    .eq('recipient_id', userId).eq('status', 'sent')
    .order('created_at', { ascending: false }).limit(20);

  if (!pendingInvoices?.length) return { actions: [], trustProfiles, message: 'No pending invoices.' };

  const actions = [];

  for (const invoice of pendingInvoices) {
    const senderAddress = invoice.creator_id?.toLowerCase();
    if (!senderAddress) continue;

    const profile = trustProfiles.find(p => p.address === senderAddress);

    if (!profile || profile.trustLevel === 'unknown') {
      actions.push({
        invoiceId: invoice.id, action: 'flagged',
        reason: `Unknown sender — no transaction history`,
        sender: senderAddress, amount: invoice.amount,
        trustScore: profile?.trustScore || 0,
      });
      continue;
    }

    if (profile.trustLevel === 'low') {
      actions.push({
        invoiceId: invoice.id, action: 'flagged',
        reason: `Low trust score (${profile.trustScore}/100) — ${profile.flags.join(', ') || 'insufficient history'}`,
        sender: senderAddress, amount: invoice.amount,
        trustScore: profile.trustScore,
      });
      continue;
    }

    const amt = parseFloat(invoice.amount) || 0;
    if (profile.suggestedLimit > 0 && amt > profile.suggestedLimit) {
      actions.push({
        invoiceId: invoice.id, action: 'blocked',
        reason: `$${amt} exceeds AI-suggested limit $${profile.suggestedLimit}`,
        sender: senderAddress, amount: invoice.amount,
        trustScore: profile.trustScore,
      });
      continue;
    }

    if (profile.recommendation === 'auto_pay') {
      actions.push({
        invoiceId: invoice.id, action: 'proposed',
        reason: `Trust score ${profile.trustScore}/100 — ${profile.pattern} pattern, ${profile.metrics.txCount} past transactions`,
        sender: senderAddress, amount: invoice.amount,
        currency: invoice.currency,
        trustScore: profile.trustScore, trustLevel: profile.trustLevel,
      });
    } else {
      actions.push({
        invoiceId: invoice.id, action: 'notify',
        reason: `Medium trust (${profile.trustScore}/100) — needs manual approval`,
        sender: senderAddress, amount: invoice.amount,
        trustScore: profile.trustScore, trustLevel: profile.trustLevel,
      });
    }
  }

  // Log
  try {
    if (actions.length) {
      await supabase.from('agent_logs').insert(
        actions.map(a => ({
          agent_type: 'autopilot', action: a.action,
          input: { invoiceId: a.invoiceId, sender: a.sender },
          output: a, user_id: userId, created_at: new Date().toISOString(),
        }))
      );
    }
  } catch (e) { console.error('[Autopilot] Log error:', e.message); }

  return { actions, trustProfiles };
}

export async function getActivityLog(userId, limit = 50) {
  const { data } = await supabase
    .from('agent_logs').select('*')
    .eq('agent_type', 'autopilot').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit);
  return data || [];
}
