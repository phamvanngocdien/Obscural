import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api from '../services/api';
import { toast } from '../components/common';
import { fetchLiveEthPrice, formatInvoiceDisplay } from '../utils/currency';
import '../styles/InvoiceList.css';

export default function InvoiceList() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ethPrice, setEthPrice] = useState(2480);

  useEffect(() => {
    fetchLiveEthPrice().then((p) => {
      if (p > 0) setEthPrice(p);
    });
  }, []);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user?.address && !user?.email) {
        setInvoices([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.invoiceApi.list({
          userId: user.address || '',
          email: user.email || '',
        });
        const list = res.data || [];
        // Deduplicate invoices by ID
        const uniqueMap = new Map();
        list.forEach((item) => {
          if (item?.id && !uniqueMap.has(item.id)) {
            uniqueMap.set(item.id, item);
          }
        });
        const uniqueList = Array.from(uniqueMap.values());
        uniqueList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setInvoices(uniqueList);
      } catch (err) {
        console.error('Failed to load invoices from Supabase', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [user?.address, user?.email]);

  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch((e) => console.error('Autoplay prevented:', e));
    }
  }, []);

  const handleExportCsv = () => {
    if (invoices.length === 0) {
      toast.info('No invoices to export');
      return;
    }
    const headers = ['ID', 'Title', 'Counterparty', 'Role', 'Amount', 'Currency', 'Status', 'Due Date', 'Created At'];
    const rows = filteredInvoices.map((inv) => {
      const userAddr = user?.address?.toLowerCase();
      const userEmail = user?.email?.toLowerCase();
      const isRecipient = Boolean(
        (userAddr && (inv.recipient_id?.toLowerCase() === userAddr || inv.to_data?.walletAddress?.toLowerCase() === userAddr)) ||
        (userEmail && inv.to_data?.email?.toLowerCase() === userEmail)
      );
      const party = isRecipient
        ? (inv.from_data?.name || inv.from?.name || inv.from_data?.email || inv.creator_id || 'Unknown')
        : (inv.to_data?.name || inv.to?.name || inv.to_data?.email || inv.recipient_id || 'Unknown');

      return [
        inv.id || '',
        `"${(inv.title || 'Invoice').replace(/"/g, '""')}"`,
        `"${party.replace(/"/g, '""')}"`,
        isRecipient ? 'Payer (Received)' : 'Issuer (Sent)',
        inv.amount || inv.total || 0,
        inv.currency || 'USD',
        inv.status || 'pending',
        inv.dueDate || inv.due_date || '',
        inv.created_at || '',
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `obscural_invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(locale === 'vi' ? 'Đã xuất hóa đơn sang CSV!' : 'Invoices exported to CSV!');
  };

  const filteredInvoices = invoices.filter((inv) => {
    const userAddr = user?.address?.toLowerCase();
    const userEmail = user?.email?.toLowerCase();
    const isRecipient = Boolean(
      (userAddr && (inv.recipient_id?.toLowerCase() === userAddr || inv.to_data?.walletAddress?.toLowerCase() === userAddr)) ||
      (userEmail && inv.to_data?.email?.toLowerCase() === userEmail)
    );
    const isCreator = !isRecipient;

    if (statusFilter === 'sent' && !isCreator) return false;
    if (statusFilter === 'received' && !isRecipient) return false;
    if (statusFilter !== 'all' && statusFilter !== 'sent' && statusFilter !== 'received' && inv.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (inv.title || '').toLowerCase();
      const recipient = (inv.to_data?.name || inv.to?.name || inv.to_data?.email || inv.recipient_id || '').toLowerCase();
      const sender = (inv.from_data?.name || inv.from?.name || inv.from_data?.email || inv.creator_id || '').toLowerCase();
      const idStr = (inv.id || '').toLowerCase();
      return title.includes(q) || recipient.includes(q) || sender.includes(q) || idStr.includes(q);
    }
    return true;
  });

  const statusLabel = (status) => {
    switch (status) {
      case 'paid': return t('invoice.paid', 'Paid');
      case 'pending': return t('invoice.pending', 'Pending');
      case 'overdue': return t('invoice.overdue', 'Overdue');
      case 'draft': return t('invoice.draft', 'Draft');
      default: return status;
    }
  };

  const tabs = [
    { id: 'all', label: t('invoice.all', 'All') },
    { id: 'sent', label: locale === 'vi' ? 'Đã tạo (Phải thu)' : 'Created (Payee)' },
    { id: 'received', label: locale === 'vi' ? 'Cần trả (Phải trả)' : 'To Pay (Payer)' },
    { id: 'pending', label: t('invoice.pending', 'Pending') },
    { id: 'paid', label: t('invoice.paid', 'Paid') },
    { id: 'overdue', label: t('invoice.overdue', 'Overdue') },
  ];

  return (
    <div className="invoice-page">
      {/* Fixed top section */}
      <div className="invoice-top-fixed">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
          <h1 className="invoice-page-title" style={{ margin: 0 }}>{t('invoice.title', 'Invoices')}</h1>
          <button
            onClick={handleExportCsv}
            title={t('invoice.exportCsv', 'Export CSV')}
            style={{
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              color: '#FFFFFF',
              borderRadius: '8px',
              padding: '7px 14px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{t('invoice.exportCsv', 'Export CSV')}</span>
          </button>
        </div>

        {/* Hero Card - smaller */}
        <div className="invoice-hero-card">
          <div className="invoice-hero-image">
            <video
              ref={videoRef}
              src="/obscural.webm"
              autoPlay
              loop
              muted
              playsInline
              className="invoice-hero-video"
            />
          </div>
        </div>

        {/* Create Invoice Button */}
        <Link to="/create" className="invoice-create-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
          <span>{t('invoice.create', 'Create Invoice')}</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 0', alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder={t('invoice.search', 'Search by title, recipient or ID...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              fontSize: '12px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#FFFFFF',
              outline: 'none',
            }}
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(180, 180, 200, 0.6)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '4px 0 10px', overflowX: 'auto', width: '100%' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '5px 14px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '20px',
              cursor: 'pointer',
              border: statusFilter === tab.id ? '1px solid #8B5CF6' : '1px solid rgba(255,255,255,0.08)',
              background: statusFilter === tab.id ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.04)',
              color: statusFilter === tab.id ? '#FFFFFF' : 'rgba(220, 220, 235, 0.8)',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable invoice list */}
      <div className="invoice-list-scroll">
        {filteredInvoices.length > 0 ? (
          <div className="invoice-list-section">
            <h3 className="invoice-list-heading">
              {locale === 'vi' ? 'Hóa đơn của tôi' : 'My Invoices'} ({filteredInvoices.length})
            </h3>
            <div className="invoice-items">
              {filteredInvoices.map((inv) => {
                const userAddr = user?.address?.toLowerCase();
                const userEmail = user?.email?.toLowerCase();
                const isRecipient = Boolean(
                  (userAddr && (inv.recipient_id?.toLowerCase() === userAddr || inv.to_data?.walletAddress?.toLowerCase() === userAddr)) ||
                  (userEmail && inv.to_data?.email?.toLowerCase() === userEmail)
                );
                const counterpartyName = isRecipient
                  ? (inv.from_data?.name || inv.from?.name || (inv.creator_id ? inv.creator_id.slice(0, 6) + '...' + inv.creator_id.slice(-4) : 'Người bán'))
                  : (inv.to_data?.name || inv.to?.name || (inv.recipient_id ? inv.recipient_id.slice(0, 6) + '...' + inv.recipient_id.slice(-4) : 'Khách hàng'));

                return (
                  <Link key={inv.id} to={`/invoices/${inv.id}`} className="invoice-item">
                    <div className="invoice-item-left">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="invoice-item-title">{inv.title || `INV-${String(inv.id).slice(0, 6)}`}</span>
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: isRecipient ? 'rgba(245, 158, 11, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                            color: isRecipient ? '#FBBF24' : '#C4B5FD',
                            border: isRecipient ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
                          }}
                        >
                          {isRecipient ? (locale === 'vi' ? 'Cần trả' : 'Payer') : (locale === 'vi' ? 'Đã tạo' : 'Issuer')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                        <span className="invoice-item-date">{new Date(inv.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}</span>
                        <span className="invoice-item-recipient" style={{ color: isRecipient ? 'rgba(251, 191, 36, 0.9)' : 'rgba(200, 200, 220, 0.7)' }}>
                          {isRecipient ? '← ' : '→ '}
                          {isRecipient ? (locale === 'vi' ? 'Từ: ' : 'From: ') : (locale === 'vi' ? 'Đến: ' : 'To: ')}
                          {counterpartyName}
                        </span>
                      </div>
                    </div>
                    <div className="invoice-item-right">
                      {(() => {
                        const display = formatInvoiceDisplay(inv, ethPrice);
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                            <span
                              className="invoice-item-amount"
                              style={{ color: isRecipient ? '#F87171' : '#5DE4C7' }}
                            >
                              {isRecipient ? '-' : '+'}{display.usdcStr}
                            </span>
                            {display.cryptoStr && (
                              <span style={{ fontSize: '10px', color: isRecipient ? 'rgba(248, 113, 113, 0.75)' : '#8B7AFF', fontWeight: 600 }}>
                                ({display.cryptoStr})
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <span className={`invoice-item-status status-${inv.status}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : !loading ? (
          <div className="invoice-empty">
            <span className="invoice-empty-icon">📄</span>
            <p>{t('invoice.noInvoices', 'No invoices found matching criteria.')}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
