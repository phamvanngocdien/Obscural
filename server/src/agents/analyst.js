import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';

const SYSTEM = `Financial analyst AI for Obscural. Return JSON:
{"summary":"string","metrics":{"totalRevenue":number,"totalPending":number,"avgInvoiceValue":number,"paidCount":number,"pendingCount":number,"overdueCount":number},"insights":[{"icon":"emoji","title":"string","text":"string"}],"recommendations":["string"]}`;

export async function handleAnalyst(params = {}, context = {}) {
  const pc = checkPolicy('analyst', 'read');
  if (!pc.allowed) return { type: 'error', message: pc.reason };
  const invoices = context.invoices || [];
  const prompt = `Analyze financial data (${params.period || 30} days):\nCount: ${invoices.length}\nData: ${JSON.stringify(invoices.slice(0, 30))}\n${params.question ? `Q: "${params.question}"` : ''}\nAnalyze:`;
  try {
    const raw = await generate(prompt, SYSTEM);
    const analysis = parseJson(raw);
    return { type: 'analysis', message: analysis.summary || 'Phân tích hoàn tất.', data: analysis };
  } catch (err) {
    console.error('[Analyst]', err.message);
    return { type: 'error', message: 'Không thể phân tích.' };
  }
}
