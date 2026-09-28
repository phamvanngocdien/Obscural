import { generate, parseJson } from '../services/ai.js';
import { checkPolicy } from './policies.js';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY || '';
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const REMINDER_SYSTEM = `You are a professional financial assistant for Obscural.
Generate a courteous, concise payment reminder email.
Return JSON:
{
  "subject": "string",
  "html": "string (formatted email HTML with dark luxury aesthetic styling)",
  "text": "string (plain text fallback)",
  "urgency": "gentle" | "standard" | "urgent"
}`;

export async function handleReminder(invoiceData = {}, context = {}) {
  const pc = checkPolicy('reminder', 'email');
  if (!pc.allowed) return { success: false, message: pc.reason };

  const prompt = `Invoice details:
Recipient: ${invoiceData.recipientName || 'Counterparty'} (${invoiceData.recipientEmail || 'no-email'})
Amount: ${invoiceData.amount || 0} ${invoiceData.currency || 'USD'}
Due Date: ${invoiceData.dueDate || 'Immediate'}
Title: ${invoiceData.title || 'Invoice'}
Status: ${invoiceData.status || 'pending'}
Sender: ${context.senderName || 'Obscural User'}

Draft an email payment reminder:`;

  try {
    const raw = await generate(prompt, REMINDER_SYSTEM);
    const emailDraft = parseJson(raw);

    let sentResult = null;
    if (resend && invoiceData.recipientEmail) {
      try {
        sentResult = await resend.emails.send({
          from: process.env.EMAIL_FROM || 'invoices@obscural.xyz',
          to: invoiceData.recipientEmail,
          subject: emailDraft.subject,
          html: emailDraft.html,
          text: emailDraft.text,
        });
      } catch (sendErr) {
        console.error('[Reminder Agent] Resend error:', sendErr.message);
      }
    }

    return {
      success: true,
      delivered: !!sentResult,
      email: emailDraft,
      message: `✅ Reminder generated for ${invoiceData.recipientName || 'recipient'}${sentResult ? ' & email sent.' : '.'}`,
    };
  } catch (err) {
    console.error('[Reminder Agent] Generation error:', err.message);
    return {
      success: false,
      message: 'Failed to generate reminder: ' + err.message,
    };
  }
}
