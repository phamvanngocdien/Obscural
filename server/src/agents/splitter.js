import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';

const SYSTEM = `Bill splitting AI. Return JSON:
{"description":"string","totalAmount":number,"currency":"USD"|"ETH"|"USDC","method":"equal"|"percentage"|"custom","participants":[{"name":"string","share":number,"percentage":number,"reason":"string"}]}
Shares must sum to totalAmount.`;

export async function handleSplitter(params = {}, _context = {}) {
  const pc = checkPolicy('splitter', 'read');
  if (!pc.allowed) return { type: 'error', message: pc.reason };
  const prompt = `Split: "${params.description || 'Bill'}" = ${params.totalAmount || 0} ${params.currency || 'USD'}\nParticipants: ${JSON.stringify(params.participants || [])}\nSuggest:`;
  try {
    const raw = await generate(prompt, SYSTEM);
    const split = parseJson(raw);
    return { type: 'split', message: `✅ Chia bill cho ${split.participants?.map(p => p.name).join(', ')}`, data: split };
  } catch (err) {
    console.error('[Splitter]', err.message);
    return { type: 'error', message: 'Không thể chia bill.' };
  }
}
