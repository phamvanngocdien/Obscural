import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api from '../services/api';
import { toast } from '../components/common';
import { fetchLiveTokenPrices, getInvoiceUsdcValue, formatInvoiceDisplay } from '../utils/currency';
import '../styles/Analytics.css';

Chart.register(...registerables);

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7C3AED, #3B82F6)',
  'linear-gradient(135deg, #059669, #10B981)',
  'linear-gradient(135deg, #D97706, #F59E0B)',
  'linear-gradient(135deg, #DC2626, #EF4444)',
  'linear-gradient(135deg, #4F46E5, #06B6D4)',
  'linear-gradient(135deg, #9333EA, #EC4899)',
  'linear-gradient(135deg, #2563EB, #38BDF8)',
  'linear-gradient(135deg, #F59E0B, #EF4444)',
  'linear-gradient(135deg, #EC4899, #8B5CF6)',
  'linear-gradient(135deg, #10B981, #06B6D4)',
];

function getAvatarGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export default function Analytics() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [invoices, setInvoices] = useState([]);
  const [contactsMap, setContactsMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [timeRange, setTimeRange] = useState('all_time');
  const [tokenPrices, setTokenPrices] = useState({});

  // Floating Counterparty Hover Card Popover
  const [hoverPopover, setHoverPopover] = useState(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const hideTimerRef = useRef(null);

  const lineChartRef = useRef(null);
  const donutChartRef = useRef(null);
  const lineInstanceRef = useRef(null);
  const donutInstanceRef = useRef(null);

  useEffect(() => {
    fetchLiveTokenPrices().then((prices) => {
      if (prices && Object.keys(prices).length > 0) setTokenPrices(prices);
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      if (!user?.address && !user?.email) {
        setInvoices([]);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [invoicesRes, contactsRes] = await Promise.allSettled([
          api.invoiceApi.list({
            userId: user.address || '',
            email: user.email || '',
          }),
          user.address ? api.contactsApi.list(user.address) : Promise.resolve({ data: [] }),
        ]);

        if (invoicesRes.status === 'fulfilled') {
          const list = invoicesRes.value?.data || [];
          list.sort((a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now()));
          setInvoices(list);
        }

        if (contactsRes.status === 'fulfilled') {
          const cMap = new Map();
          (contactsRes.value?.data || []).forEach((c) => {
            if (c.wallet_address) cMap.set(c.wallet_address.toLowerCase().trim(), c);
            if (c.email) cMap.set(c.email.toLowerCase().trim(), c);
          });
          setContactsMap(cMap);
        }
      } catch (err) {
        console.error('Failed to load analytics data from Supabase', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    return () => controller.abort();
  }, [user?.address, user?.email]);

  // Compute calculated financial telemetry in USDC
  const totalInvoices = invoices.length;
  const totalVolume = invoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, tokenPrices), 0);
  
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalPaid = paidInvoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, tokenPrices), 0);

  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const totalPending = pendingInvoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, tokenPrices), 0);

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOverdue = overdueInvoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, tokenPrices), 0);

  const settlementRate = totalInvoices > 0 ? ((paidInvoices.length / totalInvoices) * 100).toFixed(1) : '100.0';

  // Build Charts
  useEffect(() => {
    if (loading || !lineChartRef.current || !donutChartRef.current) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals = new Array(12).fill(0);
    
    invoices.forEach((inv) => {
      const date = inv.created_at ? new Date(inv.created_at) : new Date();
      const m = date.getMonth();
      monthlyTotals[m] += getInvoiceUsdcValue(inv, tokenPrices);
    });

    const maxMonthlyVal = Math.max(...monthlyTotals, 0);

    // Line / Area Chart
    if (lineInstanceRef.current) lineInstanceRef.current.destroy();
    const lineCtx = lineChartRef.current.getContext('2d');
    const lineGradient = lineCtx.createLinearGradient(0, 0, 0, 220);
    lineGradient.addColorStop(0, 'rgba(139, 122, 255, 0.35)');
    lineGradient.addColorStop(0.5, 'rgba(139, 122, 255, 0.1)');
    lineGradient.addColorStop(1, 'rgba(139, 122, 255, 0)');

    lineInstanceRef.current = new Chart(lineChartRef.current, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          data: monthlyTotals,
          borderColor: '#8B7AFF',
          backgroundColor: lineGradient,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#8B7AFF',
          pointBorderColor: '#1F1F1F',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          borderWidth: 2.5,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(28, 28, 34, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: 'rgba(200, 200, 230, 0.75)',
            borderColor: 'rgba(139, 122, 255, 0.3)',
            borderWidth: 1,
            padding: 10,
            boxPadding: 4,
            callbacks: {
              label: (context) => ` Invoiced: ${context.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: 'rgba(160, 160, 200, 0.55)', font: { size: 11, family: 'Inter' } },
          },
          y: {
            beginAtZero: true,
            suggestedMax: maxMonthlyVal > 0 ? maxMonthlyVal * 1.2 : 100,
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
              color: 'rgba(160, 160, 200, 0.55)',
              font: { size: 11, family: 'JetBrains Mono' },
              callback: (v) => {
                if (v >= 1000) return `${(v / 1000).toFixed(1)}k USDC`;
                return `${v} USDC`;
              },
            },
          },
        },
      },
    });

    // Donut Chart
    const paidCount = invoices.filter(i => i.status === 'paid').length;
    const pendingCount = invoices.filter(i => i.status === 'pending').length;
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;
    const hasData = paidCount > 0 || pendingCount > 0 || overdueCount > 0;

    if (donutInstanceRef.current) donutInstanceRef.current.destroy();
    donutInstanceRef.current = new Chart(donutChartRef.current, {
      type: 'doughnut',
      data: {
        labels: [t('invoice.paid'), t('invoice.pending'), t('invoice.overdue')],
        datasets: [{
          data: hasData ? [paidCount, pendingCount, overdueCount] : [1, 0, 0],
          backgroundColor: hasData ? ['#5DE4C7', '#8B7AFF', '#FF6B7A'] : ['rgba(255, 255, 255, 0.06)'],
          borderColor: '#1F1F1F',
          borderWidth: 2,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
            backgroundColor: 'rgba(28, 28, 34, 0.95)',
            titleColor: '#FFFFFF',
            bodyColor: 'rgba(200, 200, 230, 0.75)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            padding: 8,
          },
        },
      },
    });

    return () => {
      if (lineInstanceRef.current) lineInstanceRef.current.destroy();
      if (donutInstanceRef.current) donutInstanceRef.current.destroy();
    };
  }, [loading, invoices, locale]);

  // Status localized helper
  const statusLabel = (status) => {
    switch (status) {
      case 'paid': return t('invoice.paid');
      case 'pending': return t('invoice.pending');
      case 'overdue': return t('invoice.overdue');
      case 'draft': return t('invoice.draft');
      default: return status ? status.toUpperCase() : t('invoice.pending');
    }
  };

  // Helper to extract counterparty profile from invoice & contacts map
  const getCounterpartyInfo = (inv) => {
    const userAddr = user?.address?.toLowerCase();
    const userEmail = user?.email?.toLowerCase();
    const isRecipient = Boolean(
      (userAddr && (inv.recipient_id?.toLowerCase() === userAddr || inv.to_data?.walletAddress?.toLowerCase() === userAddr)) ||
      (userEmail && inv.to_data?.email?.toLowerCase() === userEmail)
    );

    const counterData = isRecipient
      ? (inv.from_data || inv.from || {})
      : (inv.to_data || inv.to || {});

    const wallet = isRecipient
      ? (counterData.walletAddress || (inv.creator_id?.startsWith('0x') ? inv.creator_id : ''))
      : (counterData.walletAddress || (inv.recipient_id?.startsWith('0x') ? inv.recipient_id : ''));

    const rawId = isRecipient ? inv.creator_id : inv.recipient_id;
    const finalWallet = wallet || (rawId?.startsWith('0x') ? rawId : '');
    const email = counterData.email || (!rawId?.startsWith('0x') && rawId?.includes('@') ? rawId : '');
    const address = counterData.address || counterData.home_address || '';

    // Check in saved contacts map
    const savedContact =
      (finalWallet ? contactsMap.get(finalWallet.toLowerCase().trim()) : null) ||
      (email ? contactsMap.get(email.toLowerCase().trim()) : null) ||
      null;

    const displayName =
      savedContact?.name ||
      counterData.name ||
      (!finalWallet && email ? email.split('@')[0] : null) ||
      (finalWallet ? `${finalWallet.slice(0, 6)}...${finalWallet.slice(-4)}` : (rawId || (locale === 'vi' ? 'Đối tác On-Chain' : 'On-Chain Partner')));

    return {
      isRecipient,
      roleLabel: isRecipient
        ? (locale === 'vi' ? 'Bên xuất hóa đơn (Người bán)' : 'Issuer (Seller)')
        : (locale === 'vi' ? 'Bên thanh toán (Khách hàng)' : 'Client (Payer)'),
      displayName,
      wallet: finalWallet,
      email: savedContact?.email || email,
      location: savedContact?.home_address || address,
      company: savedContact?.company || counterData.company || null,
      notes: savedContact?.notes || null,
      savedContact,
    };
  };

  const getCounterpartyStats = (wallet, email) => {
    const w = (wallet || '').toLowerCase().trim();
    const em = (email || '').toLowerCase().trim();
    if (!w && !em) return { count: 1, totalUsdc: 0 };

    const matching = invoices.filter((i) => {
      const cId = (i.creator_id || '').toLowerCase();
      const rId = (i.recipient_id || '').toLowerCase();
      const fromW = (i.from_data?.walletAddress || '').toLowerCase();
      const toW = (i.to_data?.walletAddress || '').toLowerCase();
      const fromEm = (i.from_data?.email || '').toLowerCase();
      const toEm = (i.to_data?.email || '').toLowerCase();

      return (
        (w && (cId === w || rId === w || fromW === w || toW === w)) ||
        (em && (fromEm === em || toEm === em))
      );
    });

    const totalUsdc = matching.reduce((sum, inv) => sum + getInvoiceUsdcValue(inv, tokenPrices), 0);
    return {
      count: matching.length,
      totalUsdc,
    };
  };

  const handleCounterpartyMouseEnter = (e, party) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const popWidth = 330;
    let x = rect.left;
    if (x + popWidth > window.innerWidth - 16) {
      x = window.innerWidth - popWidth - 16;
    }
    if (x < 12) x = 12;

    let y = rect.bottom + 8;
    if (y + 320 > window.innerHeight) {
      y = Math.max(12, rect.top - 330);
    }

    const stats = getCounterpartyStats(party.wallet, party.email);

    setHoverPopover({
      party,
      stats,
      x,
      y,
    });
  };

  const handleMouseLeavePopover = () => {
    hideTimerRef.current = setTimeout(() => {
      setHoverPopover(null);
    }, 150);
  };

  const handlePopoverMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const copyAddressToClipboard = (addr) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedAddr(true);
    toast.success(locale === 'vi' ? 'Đã sao chép địa chỉ ví!' : 'Wallet address copied!');
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  // Tab Filtering
  const tabs = [
    { key: 'all', label: t('analytics.allInvoices'), count: totalInvoices },
    { key: 'paid', label: t('invoice.paid'), count: paidInvoices.length },
    { key: 'pending', label: t('invoice.pending'), count: pendingInvoices.length },
    { key: 'overdue', label: t('invoice.overdue'), count: overdueInvoices.length },
  ];

  const filteredInvoices = invoices.filter((inv) => {
    if (activeTab === 'all') return true;
    return inv.status === activeTab;
  });

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="analytics-loading">
          <div className="spinner-ring" />
          <span>{t('analytics.syncing')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {/* ── Top Header ── */}
      <div className="analytics-header">
        <div className="analytics-header-left">
          <span className="analytics-eyebrow">{t('analytics.eyebrow')}</span>
          <h1 className="analytics-title">{t('analytics.title')}</h1>
        </div>

        <div className="analytics-time-pills">
          <button
            className={`analytics-time-pill ${timeRange === 'all_time' ? 'analytics-pill-active' : ''}`}
            onClick={() => setTimeRange('all_time')}
          >
            {t('analytics.allTime')}
          </button>
          <button
            className={`analytics-time-pill ${timeRange === '30d' ? 'analytics-pill-active' : ''}`}
            onClick={() => setTimeRange('30d')}
          >
            {t('analytics.30d')}
          </button>
          <button
            className={`analytics-time-pill ${timeRange === '7d' ? 'analytics-pill-active' : ''}`}
            onClick={() => setTimeRange('7d')}
          >
            {t('analytics.7d')}
          </button>
        </div>
      </div>

      {/* ── 4 Telemetry Metrics Cards ── */}
      <div className="analytics-stats-grid">
        <div className="analytics-card-stat">
          <div className="analytics-stat-top">
            <span className="analytics-stat-label">{t('analytics.totalVolume')}</span>
            <span className="analytics-stat-chip chip-purple">{totalInvoices} {t('analytics.invoices')}</span>
          </div>
          <div className="analytics-stat-num-wrap">
            <span className="analytics-stat-num">
              {totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#8B7AFF', marginLeft: '6px' }}>USDC</span>
          </div>
          <span className="analytics-stat-footnote">{t('analytics.grossInvoiced')}</span>
        </div>

        <div className="analytics-card-stat">
          <div className="analytics-stat-top">
            <span className="analytics-stat-label">{t('analytics.totalSettled')}</span>
            <span className="analytics-stat-chip chip-green">{t('invoice.paid')}</span>
          </div>
          <div className="analytics-stat-num-wrap">
            <span className="analytics-stat-num stat-success">
              {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#5DE4C7', marginLeft: '6px' }}>USDC</span>
          </div>
          <span className="analytics-stat-footnote">{paidInvoices.length} {t('analytics.txCompleted')}</span>
        </div>

        <div className="analytics-card-stat">
          <div className="analytics-stat-top">
            <span className="analytics-stat-label">{t('analytics.outstanding')}</span>
            <span className="analytics-stat-chip chip-amber">{pendingInvoices.length} {t('invoice.pending')}</span>
          </div>
          <div className="analytics-stat-num-wrap">
            <span className="analytics-stat-num stat-warning">
              {totalPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FBBF24', marginLeft: '6px' }}>USDC</span>
          </div>
          <span className="analytics-stat-footnote">{t('analytics.awaitingRelease')}</span>
        </div>

        <div className="analytics-card-stat">
          <div className="analytics-stat-top">
            <span className="analytics-stat-label">{t('analytics.settlementRate')}</span>
            <span className="analytics-stat-chip chip-blue">&lt;1s Finality</span>
          </div>
          <div className="analytics-stat-num-wrap">
            <span className="analytics-stat-num stat-rate">
              {settlementRate}%
            </span>
          </div>
          <span className="analytics-stat-footnote">{t('analytics.autoEscrow')}</span>
        </div>
      </div>

      {/* ── Visual Charts Bento ── */}
      <div className="analytics-charts-bento">
        {/* Timeline Area Chart */}
        <div className="analytics-chart-card timeline-card">
          <div className="analytics-card-header">
            <div>
              <span className="analytics-chart-eyebrow">{t('analytics.cashFlow')}</span>
              <h2 className="analytics-chart-heading">{t('analytics.monthlyVolume')}</h2>
            </div>
            <span className="analytics-chart-badge">USDT / Rialo</span>
          </div>
          <div className="analytics-canvas-wrap">
            <canvas ref={lineChartRef} />
          </div>
        </div>

        {/* Status Breakdown & Donut */}
        <div className="analytics-chart-card status-card">
          <div className="analytics-card-header">
            <div>
              <span className="analytics-chart-eyebrow">{t('analytics.distribution')}</span>
              <h2 className="analytics-chart-heading">{t('analytics.settlementStatus')}</h2>
            </div>
          </div>

          <div className="analytics-status-body">
            <div className="analytics-donut-wrap">
              <canvas ref={donutChartRef} />
              <div className="analytics-donut-center">
                <span className="donut-center-num">{totalInvoices}</span>
                <span className="donut-center-lbl">{locale === 'vi' ? 'Tổng' : 'Total'}</span>
              </div>
            </div>

            <div className="analytics-status-legend">
              <div className="status-legend-row">
                <div className="status-legend-left">
                  <span className="status-dot dot-green" />
                  <span className="status-lbl">{t('invoice.paid')}</span>
                </div>
                <span className="status-val">${totalPaid.toFixed(2)} ({paidInvoices.length})</span>
              </div>

              <div className="status-legend-row">
                <div className="status-legend-left">
                  <span className="status-dot dot-purple" />
                  <span className="status-lbl">{t('invoice.pending')}</span>
                </div>
                <span className="status-val">${totalPending.toFixed(2)} ({pendingInvoices.length})</span>
              </div>

              <div className="status-legend-row">
                <div className="status-legend-left">
                  <span className="status-dot dot-red" />
                  <span className="status-lbl">{t('invoice.overdue')}</span>
                </div>
                <span className="status-val">${totalOverdue.toFixed(2)} ({overdueInvoices.length})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── On-Chain Invoice Ledger ── */}
      <div className="analytics-table-section">
        <div className="analytics-table-header">
          <div>
            <span className="analytics-chart-eyebrow">{t('analytics.auditTrail')}</span>
            <h2 className="analytics-chart-heading">{t('analytics.ledger')}</h2>
          </div>

          <div className="analytics-tabs-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`analytics-table-tab ${activeTab === tab.key ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <span className="tab-count-chip">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="analytics-table-container">
          <table className="analytics-ledger-table">
            <thead>
              <tr>
                <th>{t('analytics.colId')}</th>
                <th>{t('analytics.colCounterparty')}</th>
                <th>{t('analytics.colDateIssued')}</th>
                <th>{t('analytics.colDueDate')}</th>
                <th>{t('analytics.colAmount')}</th>
                <th>{t('analytics.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="analytics-empty-cell">
                    <div className="analytics-empty-state">
                      <div className="empty-icon-circle">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                      <span className="empty-title">{t('analytics.noRecords')}</span>
                      <span className="empty-desc">{t('analytics.createToPopulate')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const invoiceIdStr = inv.id ? inv.id.slice(0, 8) : 'INV-001';
                  const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US') : (locale === 'vi' ? 'Hôm nay' : 'Today');
                  const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US') : '—';
                  const party = getCounterpartyInfo(inv);

                  return (
                    <tr key={inv.id || Math.random()}>
                      <td>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="invoice-id-badge"
                          style={{
                            textDecoration: 'none',
                            color: 'inherit',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            letterSpacing: '0.02em',
                          }}
                          title={inv.title ? `${invoiceIdStr} (${inv.title})` : invoiceIdStr}
                        >
                          {invoiceIdStr}
                        </Link>
                      </td>
                      <td
                        className="analytics-cell-counterparty"
                        onMouseEnter={(e) => handleCounterpartyMouseEnter(e, party)}
                        onMouseLeave={handleMouseLeavePopover}
                      >
                        <div className="analytics-counterparty-badge-box">
                          <div
                            className="analytics-counterparty-avatar-mini"
                            style={{ background: getAvatarGradient(party.displayName) }}
                          >
                            {party.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="analytics-counterparty-text-wrap">
                            <div className="analytics-counterparty-name-row">
                              <span className="analytics-counterparty-name-main">{party.displayName}</span>
                              {party.savedContact && (
                                <span className="analytics-contact-tag-pill" title={locale === 'vi' ? 'Đã lưu trong danh bạ' : 'Saved in Contacts'}>
                                  ✓
                                </span>
                              )}
                            </div>
                            <span className="analytics-counterparty-addr-sub">
                              {party.wallet ? `${party.wallet.slice(0, 6)}...${party.wallet.slice(-4)}` : (party.email || '—')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="date-cell">{dateStr}</span>
                      </td>
                      <td>
                        <span className="date-cell">{dueStr}</span>
                      </td>
                      <td>
                        <span className="amount-cell">
                          {(() => {
                            const display = formatInvoiceDisplay(inv, tokenPrices);
                            if (display.cryptoStr) {
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                                  <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{display.usdcStr}</span>
                                  <span style={{ fontSize: '10px', color: '#8B7AFF', fontWeight: 600 }}>({display.cryptoStr})</span>
                                </div>
                              );
                            }
                            return <span style={{ fontWeight: 700, color: '#FFFFFF' }}>{display.usdcStr}</span>;
                          })()}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill pill-${inv.status || 'pending'}`}>
                          {statusLabel(inv.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Floating Counterparty Contact Card Popover ── */}
      {hoverPopover && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="analytics-popover-portal-container"
            style={{
              position: 'fixed',
              left: `${hoverPopover.x}px`,
              top: `${hoverPopover.y}px`,
              zIndex: 99999,
            }}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handleMouseLeavePopover}
          >
            <div className="analytics-hover-card">
              {/* Header */}
              <div className="analytics-popover-header">
                <div
                  className="analytics-popover-avatar"
                  style={{ background: getAvatarGradient(hoverPopover.party.displayName) }}
                >
                  {hoverPopover.party.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="analytics-popover-title-box">
                  <div className="analytics-popover-name-row">
                    <span className="analytics-popover-fullname">{hoverPopover.party.displayName}</span>
                    <span className={`analytics-popover-type-badge ${hoverPopover.party.savedContact ? 'saved' : 'counterparty'}`}>
                      {hoverPopover.party.savedContact
                        ? (locale === 'vi' ? '✓ Danh bạ' : '✓ Saved Contact')
                        : (locale === 'vi' ? 'Đối tác On-Chain' : 'Counterparty')}
                    </span>
                  </div>
                  {hoverPopover.party.company && (
                    <span className="analytics-popover-company">🏢 {hoverPopover.party.company}</span>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="analytics-popover-body">
                {hoverPopover.party.wallet && (
                  <div className="analytics-popover-row">
                    <span className="analytics-popover-icon">👛</span>
                    <div className="analytics-popover-row-content">
                      <span className="analytics-popover-label">{locale === 'vi' ? 'Địa chỉ ví' : 'Wallet Address'}</span>
                      <div className="analytics-popover-copy-row">
                        <code className="analytics-popover-code">{hoverPopover.party.wallet}</code>
                        <button
                          type="button"
                          className="analytics-popover-copy-btn"
                          onClick={() => copyAddressToClipboard(hoverPopover.party.wallet)}
                          title="Copy Address"
                        >
                          {copiedAddr ? '✓' : '⧉'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {hoverPopover.party.email && (
                  <div className="analytics-popover-row">
                    <span className="analytics-popover-icon">✉️</span>
                    <div className="analytics-popover-row-content">
                      <span className="analytics-popover-label">Email</span>
                      <span className="analytics-popover-val">{hoverPopover.party.email}</span>
                    </div>
                  </div>
                )}

                {hoverPopover.party.location && (
                  <div className="analytics-popover-row">
                    <span className="analytics-popover-icon">📍</span>
                    <div className="analytics-popover-row-content">
                      <span className="analytics-popover-label">{locale === 'vi' ? 'Địa chỉ' : 'Location / Address'}</span>
                      <span className="analytics-popover-val">{hoverPopover.party.location}</span>
                    </div>
                  </div>
                )}

                {hoverPopover.party.notes && (
                  <div className="analytics-popover-row">
                    <span className="analytics-popover-icon">📝</span>
                    <div className="analytics-popover-row-content">
                      <span className="analytics-popover-label">{locale === 'vi' ? 'Ghi chú' : 'Notes'}</span>
                      <span className="analytics-popover-val notes">{hoverPopover.party.notes}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats Grid */}
              <div className="analytics-popover-stats-grid">
                <div className="analytics-popover-stat-item">
                  <span className="analytics-stat-label">{locale === 'vi' ? 'Hóa đơn' : 'Invoices'}</span>
                  <span className="analytics-stat-val">{hoverPopover.stats.count}</span>
                </div>
                <div className="analytics-popover-stat-item">
                  <span className="analytics-stat-label">{locale === 'vi' ? 'Tổng volume' : 'Volume'}</span>
                  <span className="analytics-stat-val" style={{ color: '#5DE4C7' }}>
                    {hoverPopover.stats.totalUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                  </span>
                </div>
                <div className="analytics-popover-stat-item">
                  <span className="analytics-stat-label">{locale === 'vi' ? 'Vai trò' : 'Role'}</span>
                  <span className="analytics-stat-val" style={{ fontSize: '10px', color: '#8B7AFF' }}>
                    {hoverPopover.party.isRecipient ? (locale === 'vi' ? 'Người tạo' : 'Issuer') : (locale === 'vi' ? 'Người trả' : 'Client')}
                  </span>
                </div>
              </div>

              {hoverPopover.party.wallet && hoverPopover.party.wallet.startsWith('0x') && (
                <div style={{ marginTop: '10px', textAlign: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <a
                    href={`https://sepolia.etherscan.io/address/${hoverPopover.party.wallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '11px',
                      color: '#8B7AFF',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600,
                    }}
                  >
                    <span>{locale === 'vi' ? 'Xem trên Sepolia Etherscan ↗' : 'View on Sepolia Etherscan ↗'}</span>
                  </a>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}
