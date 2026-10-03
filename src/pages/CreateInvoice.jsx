import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api from '../services/api';
import { toast } from '../components/common';
import '../styles/CreateInvoice.css';

export default function CreateInvoice() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();

  const today = new Date();
  const dateStr = today.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });

  const [from, setFrom] = useState({ name: '', email: '', address: '', walletAddress: '' });
  const [to, setTo] = useState({ name: '', email: '', address: '', walletAddress: '' });
  const [dueMonth, setDueMonth] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [dueYear, setDueYear] = useState('');
  const [items, setItems] = useState([{ description: 'Service', quantity: 1, price: '' }]);
  const [taxPercent, setTaxPercent] = useState(5);
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState(
    locale === 'vi' ? 'Cảm ơn quý khách! Vui lòng thanh toán theo thời hạn đã thỏa thuận.' : 'Thank you for your business!'
  );
  const [recentContacts, setRecentContacts] = useState([]);

  // Load profile from localStorage + user wallet info
  useEffect(() => {
    const saved = localStorage.getItem('obscural_profile');
    if (saved) {
      const p = JSON.parse(saved);
      setFrom({
        name: p.name || user?.name || '',
        email: p.email || '',
        address: p.location || '',
        walletAddress: user?.address || '',
      });
    } else if (user) {
      setFrom({
        name: user.name || '',
        email: '',
        address: '',
        walletAddress: user.address || '',
      });
    }
  }, [user]);

  // Load AI Assistant draft if available
  useEffect(() => {
    const aiDraftRaw = localStorage.getItem('obscural_ai_draft');
    if (aiDraftRaw) {
      try {
        const draft = JSON.parse(aiDraftRaw);
        if (draft.recipientName || draft.recipientAddress || draft.recipientEmail) {
          setTo({
            name: draft.recipientName || '',
            email: draft.recipientEmail || '',
            address: draft.recipientAddress || '',
            walletAddress: draft.recipientWallet || '',
          });
        }
        if (draft.items && Array.isArray(draft.items) && draft.items.length > 0) {
          setItems(
            draft.items.map((it) => ({
              description: it.description || '',
              quantity: parseInt(it.quantity) || 1,
              price: it.price !== undefined ? String(it.price) : '',
            }))
          );
        }
        if (draft.taxPercent !== undefined) {
          setTaxPercent(draft.taxPercent);
        }
        if (draft.note) {
          setNote(draft.note);
        }
        if (draft.currency) {
          setCurrency(draft.currency);
        }
        if (draft.dueDate) {
          const d = new Date(draft.dueDate);
          if (!isNaN(d.getTime())) {
            setDueMonth(String(d.getMonth() + 1));
            setDueDay(String(d.getDate()));
            setDueYear(String(d.getFullYear()));
          }
        }
        toast.info('Loaded invoice draft from AI Copilot ✨');
      } catch (err) {
        console.error('Failed to parse AI draft', err);
      } finally {
        localStorage.removeItem('obscural_ai_draft');
      }
    }
  }, []);

  // Load recent contacts from localStorage & invoices
  useEffect(() => {
    const localSaved = localStorage.getItem('obscural_contacts');
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentContacts(parsed.slice(0, 4));
          return;
        }
      } catch {
        // fallback
      }
    }

    if (!user?.address) return;
    const loadFromApi = async () => {
      try {
        const res = await api.invoiceApi.list({ userId: user.address });
        const seen = new Set();
        const extracted = [];
        (res.data || []).forEach((inv) => {
          const isRecipient = inv.recipient_id?.toLowerCase() === user?.address?.toLowerCase();
          const otherParty = isRecipient ? inv.creator_id : inv.recipient_id;
          if (otherParty && !seen.has(otherParty.toLowerCase())) {
            seen.add(otherParty.toLowerCase());
            extracted.push({
              name: isRecipient ? (inv.from?.name || otherParty.slice(0, 8)) : (inv.to?.name || otherParty.slice(0, 8)),
              email: (isRecipient ? inv.from?.email : inv.to?.email) || '',
              address: (isRecipient ? inv.from?.address : inv.to?.address) || '',
              walletAddress: otherParty,
            });
          }
        });
        setRecentContacts(extracted.slice(0, 4));
      } catch (err) {
        console.error('Failed to load recent contacts', err);
      }
    };
    loadFromApi();
  }, [user?.address]);

  const updateItem = (index, key, value) => {
    const newItems = [...items];
    let sanitized = value;
    if (key === 'price') {
      if (typeof sanitized === 'string') {
        if (/^0[0-9]+/.test(sanitized)) {
          sanitized = sanitized.replace(/^0+/, '') || '0';
        }
      }
    }
    newItems[index] = { ...newItems[index], [key]: sanitized };
    setItems(newItems);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, price: '' }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce(
    (sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0),
    0
  );
  const taxAmount = (subtotal * (parseFloat(taxPercent) || 0)) / 100;
  const total = subtotal + taxAmount;

  const selectRecent = (contact) => {
    setTo({
      name: contact.name || '',
      email: contact.email || '',
      address: contact.homeAddress || (contact.address && !contact.address.startsWith('0x') ? contact.address : ''),
      walletAddress: contact.walletAddress || (contact.address && contact.address.startsWith('0x') ? contact.address : ''),
    });
    toast.info(`Filled details for ${contact.name}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!to.name) {
      toast.error('Please enter a recipient name');
      return;
    }

    if (items.some((item) => !item.description || !item.price)) {
      toast.error('Please fill in all item descriptions and prices');
      return;
    }

    const dueDate = dueYear && dueMonth && dueDay ? `${dueYear}-${dueMonth.padStart(2, '0')}-${dueDay.padStart(2, '0')}` : '';

    const invoice = {
      id: crypto.randomUUID(),
      title: items[0]?.description || 'Invoice',
      from: {
        name: from.name || 'You',
        email: from.email || '',
        address: from.address || '',
        walletAddress: user?.address || from.walletAddress || '',
      },
      to: {
        name: to.name,
        email: to.email || '',
        address: to.address || '',
        walletAddress: to.walletAddress || '',
      },
      items,
      taxPercent: parseFloat(taxPercent) || 0,
      subtotal,
      taxAmount,
      total,
      amount: String(total),
      currency,
      dueDate,
      status: 'pending',
      created_at: new Date().toISOString(),
      creator_id: user?.address || '',
      recipient_id: to.walletAddress || to.email || to.name || '',
      note,
    };

    // Save to localStorage
    const saved = localStorage.getItem('obscural_local_invoices');
    const invoices = saved ? JSON.parse(saved) : [];
    invoices.unshift(invoice);
    localStorage.setItem('obscural_local_invoices', JSON.stringify(invoices));

    // Also auto-save recipient to contacts if not existing
    const localContactsSaved = localStorage.getItem('obscural_contacts');
    const existingContacts = localContactsSaved ? JSON.parse(localContactsSaved) : [];
    const contactExists = existingContacts.some((c) => c.name.toLowerCase() === to.name.toLowerCase());
    if (!contactExists && to.name) {
      existingContacts.unshift({
        id: `contact-${Date.now()}`,
        name: to.name,
        email: to.email,
        walletAddress: to.walletAddress,
        homeAddress: to.address,
        address: to.address,
      });
      localStorage.setItem('obscural_contacts', JSON.stringify(existingContacts));
    }

    // Attempt backend sync
    try {
      if (user?.address) {
        api.invoiceApi.create({
          creator_id: user.address,
          recipient_id: invoice.recipient_id,
          amount: invoice.total,
          currency: invoice.currency,
          title: invoice.title,
          status: 'pending',
          due_date: invoice.dueDate || null,
          metadata: { from: invoice.from, to: invoice.to, items, taxPercent, note },
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    toast.success('Invoice created successfully!');
    navigate('/invoices');
  };

  const months = locale === 'vi'
    ? ['Tháng', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12']
    : ['Month', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = [locale === 'vi' ? 'Ngày' : 'Day', ...Array.from({ length: 31 }, (_, i) => String(i + 1))];
  const years = [locale === 'vi' ? 'Năm' : 'Year', ...Array.from({ length: 5 }, (_, i) => String(today.getFullYear() + i))];

  return (
    <div className="ci-page">
      <div className="ci-card">
        {/* Header */}
        <div className="ci-header">
          <h1 className="ci-title">{locale === 'vi' ? 'Tạo' : 'Create'} <strong>{locale === 'vi' ? 'Hóa Đơn' : 'Invoice'}</strong></h1>
          <p className="ci-date">{dateStr}</p>
        </div>

        {/* From + Due Date */}
        <div className="ci-row-split">
          <div className="ci-section">
            <h3 className="ci-section-label">{t('create.from', 'From')}:</h3>
            <label className="ci-field-label">{t('create.name', 'Full Name / Business Name')}</label>
            <input
              className="ci-input"
              type="text"
              placeholder={locale === 'vi' ? 'VD: Công ty TNHH Rialo Studio' : 'e.g. Satoshi Design Studio'}
              value={from.name}
              onChange={(e) => setFrom((p) => ({ ...p, name: e.target.value }))}
            />
            <label className="ci-field-label">{t('create.email', 'Email')}</label>
            <input
              className="ci-input"
              type="email"
              placeholder="biller@example.com"
              value={from.email}
              onChange={(e) => setFrom((p) => ({ ...p, email: e.target.value }))}
            />
            <label className="ci-field-label">{t('create.address', 'Address')}</label>
            <input
              className="ci-input"
              type="text"
              placeholder={locale === 'vi' ? 'VD: Tòa nhà Landmark, TP.HCM' : 'e.g. 100 Financial Way, Manhattan, New York, NY 10005'}
              value={from.address}
              onChange={(e) => setFrom((p) => ({ ...p, address: e.target.value }))}
            />
            <label className="ci-field-label">{t('create.wallet', 'Wallet Address')}</label>
            <input
              className="ci-input"
              type="text"
              placeholder="0x..."
              value={from.walletAddress}
              onChange={(e) => setFrom((p) => ({ ...p, walletAddress: e.target.value }))}
            />
          </div>
          <div className="ci-due-section">
            <h3 className="ci-section-label">{t('create.dueDate', 'Due date')}:</h3>
            <div className="ci-due-selects">
              <select className="ci-select" value={dueMonth} onChange={(e) => setDueMonth(e.target.value)}>
                {months.map((m, i) => (
                  <option key={m} value={i === 0 ? '' : i}>
                    {m}
                  </option>
                ))}
              </select>
              <select className="ci-select" value={dueDay} onChange={(e) => setDueDay(e.target.value)}>
                {days.map((d) => (
                  <option key={d} value={d === 'Day' || d === 'Ngày' ? '' : d}>
                    {d}
                  </option>
                ))}
              </select>
              <select className="ci-select" value={dueYear} onChange={(e) => setDueYear(e.target.value)}>
                {years.map((y) => (
                  <option key={y} value={y === 'Year' || y === 'Năm' ? '' : y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <h3 className="ci-section-label" style={{ marginTop: '14px' }}>{t('create.currency', 'Currency / Settlement Token')}:</h3>
            <select
              className="ci-select"
              style={{ width: '100%' }}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="USD">💵 USD (Fiat Pegged)</option>
              <option value="ETH">⟠ ETH (Ethereum / Rialo)</option>
              <option value="USDC">💲 USDC (USD Coin)</option>
              <option value="DAI">◈ DAI (Decentralized USD)</option>
            </select>
          </div>
        </div>

        <div className="ci-divider" />

        {/* To + Recent */}
        <div className="ci-row-split">
          <div className="ci-section">
            <h3 className="ci-section-label">{t('create.to', 'To (Client / Recipient)')}:</h3>
            <label className="ci-field-label">{t('create.name', 'Full Name / Client Business')} *</label>
            <input
              className="ci-input"
              type="text"
              placeholder={locale === 'vi' ? 'VD: Tập đoàn ABC, Nguyễn Văn A' : 'e.g. Acme Corporation, Alice Smith'}
              value={to.name}
              onChange={(e) => setTo((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <label className="ci-field-label">{t('create.email', 'Email')}</label>
            <input
              className="ci-input"
              type="email"
              placeholder="client@acme.com"
              value={to.email}
              onChange={(e) => setTo((p) => ({ ...p, email: e.target.value }))}
            />
            <label className="ci-field-label">{t('create.address', 'Address')}</label>
            <input
              className="ci-input"
              type="text"
              placeholder={locale === 'vi' ? 'VD: 456 Đường Nguyễn Huệ, Quận 1, TP.HCM' : 'e.g. 456 Market St, Suite 200, San Francisco, CA 94105'}
              value={to.address}
              onChange={(e) => setTo((p) => ({ ...p, address: e.target.value }))}
            />
            <label className="ci-field-label">{t('create.wallet', 'Wallet Address')}</label>
            <input
              className="ci-input"
              type="text"
              placeholder="0x..."
              value={to.walletAddress}
              onChange={(e) => setTo((p) => ({ ...p, walletAddress: e.target.value }))}
            />
          </div>
          <div className="ci-recent-section">
            <h3 className="ci-section-label">{t('create.recentContacts', 'Quick Pick from Contacts')}</h3>
            <div className="ci-recent-list">
              {recentContacts.length > 0 ? (
                recentContacts.map((contact, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`ci-recent-item ${to.name === contact.name ? 'ci-recent-active' : ''}`}
                    onClick={() => selectRecent(contact)}
                  >
                    <span className="ci-recent-name">{contact.name}</span>
                    <span className="ci-recent-email">{contact.email || contact.homeAddress || (locale === 'vi' ? 'Liên hệ đã lưu' : 'Saved Contact')}</span>
                  </button>
                ))
              ) : (
                <p className="ci-recent-empty">{t('create.noRecentContacts', 'No contacts saved yet')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="ci-divider" />

        {/* Items */}
        <div className="ci-items-section">
          <div className="ci-items-header">
            <span className="ci-items-col-item">{t('create.itemDesc', 'Item / Service')}:</span>
            <span className="ci-items-col-qty">{t('create.itemQty', 'Quantity')}:</span>
            <span className="ci-items-col-price">{t('create.itemPrice', 'Unit Price')} ({currency}):</span>
          </div>
          {items.map((item, i) => (
            <div key={i} className="ci-item-row">
              <input
                className="ci-input ci-item-desc"
                placeholder={locale === 'vi' ? 'VD: Tư vấn thiết kế giao diện UI/UX' : 'e.g. UI/UX Design Consultation'}
                value={item.description}
                onChange={(e) => updateItem(i, 'description', e.target.value)}
              />
              <div className="ci-qty-control">
                <button
                  type="button"
                  className="ci-qty-btn"
                  onClick={() => updateItem(i, 'quantity', Math.max(1, (parseInt(item.quantity) || 1) - 1))}
                >
                  -
                </button>
                <span className="ci-qty-value">{item.quantity}</span>
                <button
                  type="button"
                  className="ci-qty-btn"
                  onClick={() => updateItem(i, 'quantity', (parseInt(item.quantity) || 1) + 1)}
                >
                  +
                </button>
              </div>
              <input
                className="ci-input ci-item-price"
                type="number"
                step="any"
                placeholder="0.00"
                value={item.price}
                onChange={(e) => updateItem(i, 'price', e.target.value)}
              />
              {items.length > 1 && (
                <button type="button" className="ci-item-remove" onClick={() => removeItem(i)} title={locale === 'vi' ? 'Xóa mục' : 'Remove item'}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" className="ci-add-item-btn" onClick={addItem}>
            {t('create.addItem', '+ Add Another Item')}
          </button>
        </div>

        <div className="ci-divider" />

        {/* Note */}
        <div className="ci-note-section">
          <label className="ci-field-label">{t('create.note', 'Notes & Payment Terms')}</label>
          <textarea
            className="ci-input ci-textarea"
            rows="2"
            placeholder={locale === 'vi' ? 'Cảm ơn quý khách! Vui lòng thanh toán theo thời hạn đã thỏa thuận.' : 'Thank you for your business!'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {/* Summary Table */}
        <div className="ci-summary-wrap">
          <div className="ci-summary-row">
            <span className="ci-summary-label">{t('create.subtotal', 'Subtotal')}:</span>
            <span className="ci-summary-val">${subtotal.toFixed(2)} {currency}</span>
          </div>
          <div className="ci-summary-row">
            <div className="ci-tax-label-group">
              <span className="ci-summary-label">{t('create.tax', 'Tax')}:</span>
              <div className="ci-tax-input-wrap">
                <input
                  className="ci-tax-input"
                  type="number"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                />
                <span className="ci-tax-sign">%</span>
              </div>
            </div>
            <span className="ci-summary-val">${taxAmount.toFixed(2)} {currency}</span>
          </div>
          <div className="ci-summary-row ci-summary-total">
            <span className="ci-total-label">{t('create.totalDue', 'Total Due:')}</span>
            <span className="ci-total-val">${total.toFixed(2)} {currency}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="ci-actions">
          <button className="ci-create-btn" onClick={handleSubmit} type="button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>{t('create.submit', 'Create & Issue Invoice')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
