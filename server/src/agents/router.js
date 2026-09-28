import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';
import { handleInvoiceCreator } from './invoiceCreator.js';
import { handleAnalyst } from './analyst.js';
import { handleSplitter } from './splitter.js';

const ROUTER_SYSTEM = `You are the AI router for Obscural, a blockchain invoice & payment dApp.
Classify intent and extract parameters. Return JSON:
{"intent":"create_invoice"|"analyze"|"split_bill"|"general_chat","confidence":0-1,"params":{...},"reply":"string if general_chat"}
Intents: create_invoice (recipientName,amount,currency,description,dueDate), analyze (period,question), split_bill (description,totalAmount,currency,participants), general_chat.
Support Vietnamese and English. Default currency USD.`;

export async function routeMessage(message, context = {}) {
  const pc = checkPolicy('router', 'read');
  if (!pc.allowed) return { type: 'error', message: pc.reason };

  let classification;
  try {
    const raw = await generate(`User: "${message}"\nClassify intent:`, ROUTER_SYSTEM);
    classification = parseJson(raw);
  } catch {
    return { type: 'chat', message: 'Xin lỗi, thử lại:\n• "Tạo invoice 500 USD cho John"\n• "Phân tích tài chính"\n• "Chia bill 100 USD cho 3 người"' };
  }

  switch (classification.intent) {
    case 'create_invoice': return handleInvoiceCreator(classification.params, context);
    case 'analyze': return handleAnalyst(classification.params, context);
    case 'split_bill': return handleSplitter(classification.params, context);
    default: return { type: 'chat', message: classification.reply || 'Xin chào! Tôi có thể giúp tạo invoice, phân tích tài chính, hoặc chia bill.' };
  }
}
