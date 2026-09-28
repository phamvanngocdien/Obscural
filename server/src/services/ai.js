import '../config/env.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini AI Service — with OnLatch proxy support.
 * If LATCH_TOKEN is set, all requests go through OnLatch proxy (policy enforcement + audit).
 * Otherwise, falls back to direct Gemini SDK.
 */

const LATCH_TOKEN = process.env.LATCH_TOKEN || '';
const LATCH_PROXY_URL = process.env.LATCH_PROXY_URL || 'https://onlatch.com/proxy';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const useLatch = !!(LATCH_TOKEN && !LATCH_TOKEN.includes('your_latch_token'));

const genAI = !useLatch && GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

async function generateViaLatch(prompt, systemInstruction = '') {
  const url = `${LATCH_PROXY_URL}/v1beta/models/gemini-2.0-flash:generateContent`;
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${LATCH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OnLatch: ${err.reason || err.error || `HTTP ${res.status}`}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateDirect(prompt, systemInstruction = '') {
  if (!genAI) {
    // Fallback if no Gemini key: create a smart simulated response
    return JSON.stringify({
      reply: 'AI Assistant phản hồi: Tôi có thể giúp bạn tạo hóa đơn, phân tích tài chính hoặc chia bill.',
      summary: 'Dữ liệu tài chính ổn định.',
      insights: [{ icon: '📊', title: 'Dòng tiền', text: 'Chỉ số thanh khoản tốt.' }],
      recommendations: ['Tiếp tục theo dõi các hóa đơn sắp đến hạn.'],
    });
  }
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemInstruction || undefined,
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generate(prompt, systemInstruction = '') {
  return useLatch ? generateViaLatch(prompt, systemInstruction) : generateDirect(prompt, systemInstruction);
}

export function parseJson(text) {
  let cleaned = text.trim();
  const m = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) cleaned = m[1];
  return JSON.parse(cleaned.trim());
}

export function getLatchStatus() {
  return {
    enabled: useLatch,
    proxyUrl: useLatch ? LATCH_PROXY_URL : null,
    tokenPrefix: useLatch ? LATCH_TOKEN.slice(0, 8) + '...' : null,
  };
}
