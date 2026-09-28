import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';

const SYSTEM = `You are an invoice creation AI for Obscural. Return JSON:
{"title":"string","recipientName":"string","recipientEmail":"string or empty","recipientAddress":"string or empty","currency":"USD"|"ETH"|"USDC","dueDate":"YYYY-MM-DD","items":[{"description":"string","quantity":number,"price":number}],"taxPercent":number,"note":"string"}
Default due: 30 days. Default tax: 0%. Prices are numbers.`;

export async function handleInvoiceCreator(params = {}, context = {}) {
  const pc = checkPolicy('invoiceCreator', 'write');
  if (!pc.allowed) return { type: 'error', message: pc.reason };
  const today = new Date().toISOString().split('T')[0];
  const prompt = `Today: ${today}\nParams: ${JSON.stringify(params)}\n${context.senderName ? `Sender: ${context.senderName}` : ''}\nGenerate invoice JSON:`;
  try {
    const raw = await generate(prompt, SYSTEM);
    const invoice = parseJson(raw);
    return { type: 'invoice_draft', message: `✅ Draft invoice cho ${invoice.recipientName || 'recipient'}`, data: invoice };
  } catch (err) {
    console.error('[InvoiceCreator]', err.message);
    return { type: 'error', message: 'Không thể tạo invoice.' };
  }
}
