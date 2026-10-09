import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api from '../services/api';
import { fetchLiveEthPrice, getInvoiceUsdcValue, formatInvoiceDisplay } from '../utils/currency';
import '../styles/Analytics.css';

Chart.register(...registerables);

export default function Analytics() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [timeRange, setTimeRange] = useState('all_time');
  const [ethPrice, setEthPrice] = useState(2480);

  const lineChartRef = useRef(null);
  const donutChartRef = useRef(null);
  const lineInstanceRef = useRef(null);
  const donutInstanceRef = useRef(null);

  useEffect(() => {
    fetchLiveEthPrice().then((p) => {
      if (p > 0) setEthPrice(p);
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
        const res = await api.invoiceApi.list({
          userId: user.address || '',
          email: user.email || '',
        });
        const list = res.data || [];
        list.sort((a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now()));
        setInvoices(list);
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
  const totalVolume = invoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, ethPrice), 0);
  
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const totalPaid = paidInvoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, ethPrice), 0);

  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const totalPending = pendingInvoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, ethPrice), 0);

  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const totalOverdue = overdueInvoices.reduce((acc, inv) => acc + getInvoiceUsdcValue(inv, ethPrice), 0);

  const settlementRate = totalInvoices > 0 ? ((paidInvoices.length / totalInvoices) * 100).toFixed(1) : '100.0';

  // Build Charts
  useEffect(() => {
    if (loading || !lineChartRef.current || !donutChartRef.current) return;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTotals = new Array(12).fill(0);
    
    invoices.forEach((inv) => {
      const date = inv.created_at ? new Date(inv.created_at) : new Date();
      const m = date.getMonth();
      monthlyTotals[m] += getInvoiceUsdcValue(inv, ethPrice);
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
                  const displayId = inv.id ? (inv.id.length > 12 ? `${inv.id.slice(0, 8)}...` : inv.id) : 'INV-001';
                  const recipient = inv.recipient_id || inv.to_name || '—';
                  const formattedRecipient = recipient.length > 14 ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}` : recipient;
                  const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US') : (locale === 'vi' ? 'Hôm nay' : 'Today');
                  const dueStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US') : '—';
                  const amountNum = parseFloat(inv.amount || 0);

                  return (
                    <tr key={inv.id || Math.random()}>
                      <td>
                        <span className="invoice-id-badge">{inv.title || `INV-${displayId}`}</span>
                      </td>
                      <td>
                        <div className="counterparty-cell">
                          <span className="counterparty-dot" />
                          <span className="counterparty-addr">{formattedRecipient}</span>
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
                            const display = formatInvoiceDisplay(inv, ethPrice);
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
    </div>
  );
}
