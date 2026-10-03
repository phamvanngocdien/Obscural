import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../../services/api';
import useAuthStore from '../../store/authStore';
import useI18nStore from '../../store/i18nStore';
import '../../styles/AiChat.css';

const SUGGESTIONS = {
  vi: [
    'Tạo hóa đơn 500 USD cho John thiết kế UI',
    'Phân tích dòng tiền tài chính tháng này',
    'Kiểm tra danh sách hóa đơn đang chờ',
  ],
  en: [
    'Create a $500 invoice for John for UI design',
    'Analyze my financial cash flow this month',
    'Check my pending invoices status',
  ],
};

const getWelcomeMessage = (locale) => {
  if (locale === 'vi') {
    return 'Xin chào! Tôi là Trợ lý AI của Obscural ✨\n\n• 📄 Soạn thảo hóa đơn bằng ngôn ngữ tự nhiên\n• 📊 Phân tích dòng tiền & thanh khoản\n• 🛡️ Tra cứu đối tác & ma trận tín nhiệm\n\nHãy gửi tin nhắn hoặc chọn gợi ý bên dưới!';
  }
  return 'Hello! I am Obscural AI Assistant ✨\n\n• 📄 Draft smart invoices in natural language\n• 📊 Analyze cash flow & telemetry\n• 🛡️ Inspect counterparties & trust scores\n\nType a message or select a suggestion below!';
};

export default function AiChat() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', type: 'chat', message: getWelcomeMessage(locale) },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Update initial message if language changes and no chat yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length <= 1) {
        return [{ role: 'ai', type: 'chat', message: getWelcomeMessage(locale) }];
      }
      return prev;
    });
  }, [locale]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: 'user', message: text.trim() }]);
    setInput('');
    setLoading(true);

    try {
      const localSaved = localStorage.getItem('obscural_local_invoices');
      const invoices = localSaved ? JSON.parse(localSaved) : [];
      const result = await aiApi.chat(text.trim(), {
        userId: user?.address,
        senderName: user?.name,
        invoiceCount: invoices.length,
        invoices: invoices.slice(0, 20).map((inv) => ({
          title: inv.title,
          amount: inv.amount,
          status: inv.status,
          created_at: inv.created_at,
          currency: inv.currency,
        })),
      });
      setMessages((prev) => [...prev, { role: 'ai', type: result.type, message: result.message, data: result.data }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          type: 'error',
          message: err.message?.includes('fetch')
            ? (locale === 'vi' ? '⚠️ Máy chủ ngoại tuyến. Đang chạy ở chế độ cục bộ.' : '⚠️ Server offline. Operating in local mode.')
            : `⚠️ ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyInvoiceDraft = (data) => {
    localStorage.setItem('obscural_ai_draft', JSON.stringify(data));
    setOpen(false);
    navigate('/create');
  };

  const currentSuggestions = SUGGESTIONS[locale] || SUGGESTIONS.en;

  return (
    <>
      <button className={`ai-fab ${open ? 'ai-fab-open' : ''}`} onClick={() => setOpen(!open)} title="AI Assistant">
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z" />
            <path d="M8.5 14.5A7.5 7.5 0 004 21h16a7.5 7.5 0 00-4.5-6.5" />
            <circle cx="9" cy="9" r="1" fill="currentColor" />
            <circle cx="15" cy="9" r="1" fill="currentColor" />
          </svg>
        )}
      </button>

      {open && (
        <div className="ai-panel">
          <div className="ai-header">
            <div className="ai-header-left">
              <div className="ai-avatar">✨</div>
              <div>
                <h3 className="ai-header-title">Obscural AI Copilot</h3>
                <span className="ai-header-sub">Gemini Intelligence</span>
              </div>
            </div>
            <button className="ai-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="ai-messages" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
                <div className="ai-msg-bubble">
                  <p className="ai-msg-text">{msg.message}</p>
                  {msg.type === 'invoice_draft' && msg.data && (
                    <div className="ai-result-card">
                      <div className="ai-result-header">
                        {locale === 'vi' ? '📄 Bản nháp hóa đơn' : '📄 Draft Invoice'}
                      </div>
                      <div className="ai-result-body">
                        <p><strong>{t('invoiceDetail.to')}</strong> {msg.data.recipientName || '—'}</p>
                        {msg.data.items?.map((it, j) => (
                          <p key={j}>• {it.description}: {it.quantity} × ${it.price}</p>
                        ))}
                        <p><strong>{t('invoiceDetail.dueDate')}</strong> {msg.data.dueDate || '30 days'}</p>
                      </div>
                      <button className="ai-result-action" onClick={() => applyInvoiceDraft(msg.data)}>
                        {locale === 'vi' ? '→ Áp dụng vào biểu mẫu' : '→ Apply to Invoice Form'}
                      </button>
                    </div>
                  )}
                  {msg.type === 'analysis' && msg.data && (
                    <div className="ai-result-card">
                      <div className="ai-result-header">
                        {locale === 'vi' ? '📊 Phân tích tài chính' : '📊 Financial Analysis'}
                      </div>
                      <div className="ai-result-body">
                        {msg.data.insights?.map((ins, j) => (
                          <p key={j}>{ins.icon} <strong>{ins.title}:</strong> {ins.text}</p>
                        ))}
                        {msg.data.recommendations?.map((r, j) => (
                          <p key={j}>💡 {r}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-ai">
                <div className="ai-msg-bubble">
                  <div className="ai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="ai-suggestions">
              {currentSuggestions.map((s, i) => (
                <button key={i} className="ai-suggestion" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form className="ai-input-bar" onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}>
            <input
              className="ai-input"
              placeholder={locale === 'vi' ? 'Nhắn tin cho trợ lý AI...' : 'Ask AI Copilot...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
            />
            <button type="submit" className="ai-send" disabled={loading || !input.trim()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
