import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';
import { handleInvoiceCreator } from './invoiceCreator.js';
import { handleAnalyst } from './analyst.js';

const ROUTER_SYSTEM = `You are the AI router for Obscural, a blockchain invoice & payment dApp.
Classify intent and extract parameters. Return JSON:
{"intent":"create_invoice"|"analyze"|"general_chat","confidence":0-1,"params":{...},"reply":"string if general_chat"}
Intents: create_invoice (recipientName,amount,currency,description,dueDate), analyze (period,question), general_chat.
Support Vietnamese and English. Default currency USD.`;

export async function routeMessage(message, context = {}) {
  const pc = checkPolicy('router', 'read');
  if (!pc.allowed) return { type: 'error', message: pc.reason };

  let classification;
  try {
    const raw = await generate(`User: "${message}"\nClassify intent:`, ROUTER_SYSTEM);
    classification = parseJson(raw);
  } catch {
    return { type: 'chat', message: 'Xin lỗi, thử lại:\n• "Tạo invoice 500 USD cho John"\n• "Phân tích tài chính"' };
  }

  switch (classification.intent) {
    case 'create_invoice': return handleInvoiceCreator(classification.params, context);
    case 'analyze': return handleAnalyst(classification.params, context);
    default: return { type: 'chat', message: classification.reply || 'Xin chào! Tôi có thể giúp tạo invoice hoặc phân tích tài chính.' };
  }
}
