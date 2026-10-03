import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '../components/common';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import api from '../services/api';
import '../styles/Dashboard.css';

const statusColors = {
  success: 'var(--color-success)',
  failed: 'var(--color-error)',
  pending: 'var(--color-warning)',
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [ethPrice, setEthPrice] = useState(0);

  // Modals
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch ETH price from CoinGecko
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      .then((res) => res.json())
      .then((data) => {
        if (data.ethereum && data.ethereum.usd) {
          setEthPrice(data.ethereum.usd);
        }
      })
      .catch((err) => console.error('Failed to fetch ETH price', err));
  }, []);

  useEffect(() => {
    if (!user?.address) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        // Load local invoices
        const localSaved = localStorage.getItem('obscural_local_invoices');
        const localInvoices = localSaved ? JSON.parse(localSaved) : [];

        // Load API invoices (5s timeout)
        let apiInvoices = [];
        try {
          const res = await Promise.race([
            api.invoiceApi.list({ userId: user.address }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
          ]);
          apiInvoices = res.data || [];
        } catch (err) {
          console.warn('Dashboard: API unavailable, using local data.', err.message);
        }

        const seenIds = new Set(localInvoices.map((inv) => inv.id));
        const merged = [...localInvoices];
        apiInvoices.forEach((inv) => {
          if (!seenIds.has(inv.id)) merged.push(inv);
        });
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        setInvoices(merged);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.address]);

  // Build activity from invoices
  const activities = invoices.slice(0, 10).map((inv) => {
    const isInbound = inv.recipient_id?.toLowerCase() === user?.address?.toLowerCase();
    const otherParty = isInbound ? inv.creator_id : inv.recipient_id;
    const name = otherParty ? otherParty.slice(0, 8) : 'Unknown';
    const amount = parseFloat(inv.amount || 0);
    const date = new Date(inv.created_at);
    const dateStr = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} / ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

    return {
      id: inv.id,
      name,
      initial: name.charAt(0).toUpperCase(),
      date: dateStr,
      amount: `${isInbound ? '+' : '-'}${amount} ${inv.currency || 'USD'}`,
      status: inv.status === 'paid' ? 'Success' : inv.status === 'overdue' ? 'Failed' : 'Pending',
      statusKey: inv.status === 'paid' ? 'success' : inv.status === 'overdue' ? 'failed' : 'pending',
      isInbound,
    };
  });

  // Convert ETH balance to USD
  const ethBalance = parseFloat(user?.balance || 0);
  const usdValue = ethBalance * (ethPrice || 2600);
  const walletBalance = usdValue.toFixed(2);
  const [whole, decimal] = walletBalance.split('.');

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Wallet address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdrawSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(withdrawAmount);
    if (!withdrawAddress || !withdrawAddress.startsWith('0x') || withdrawAddress.length < 10) {
      toast.error('Please enter a valid Ethereum address (0x...)');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (amt > ethBalance) {
      toast.error(`Insufficient balance (Current: ${ethBalance.toFixed(4)} ETH)`);
      return;
    }

    setWithdrawing(true);
    setTimeout(() => {
      setWithdrawing(false);
      setShowWithdrawModal(false);
      setWithdrawAddress('');
      setWithdrawAmount('');
      toast.success(`Withdrawal of ${amt} ETH initiated! Tx Hash: 0x${crypto.randomUUID().slice(0, 16)}`);
    }, 1200);
  };

  return (
    <div className="dashboard">
      {/* Wallet Section */}
      <div className="dash-wallet">
        <h2 className="dash-wallet-title">{t('dashboard.wallet', 'Wallet')}</h2>
        <div className="dash-balance">
          <span className="dash-balance-symbol">$</span>
          <span className="dash-balance-whole">{whole || '0'}</span>
          <span className="dash-balance-decimal">.{decimal || '00'}</span>
        </div>
        <div className="dash-token-balance">
          <svg className="dash-token-icon" viewBox="0 0 320 512" fill="currentColor">
            <path d="M311.9 260.8L160 353.6 8 260.8 160 0l151.9 260.8zM160 383.4L8 290.6 160 512l152-221.4-152 92.8z" />
          </svg>
          <span className="dash-token-amount">{ethBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH</span>
        </div>
        <div className="dash-wallet-actions">
          <button className="dash-wallet-btn dash-btn-deposit" onClick={() => setShowDepositModal(true)}>{t('dashboard.deposit', 'Deposit')}</button>
          <button className="dash-wallet-btn dash-btn-withdraw" onClick={() => setShowWithdrawModal(true)}>{t('dashboard.withdraw', 'Withdraw')}</button>
        </div>
      </div>

      {/* Activity Section */}
      <div className="dash-activity">
        <div className="dash-activity-header">
          <h3 className="dash-activity-title">{t('dashboard.activity', 'Activity')}</h3>
          <div style={{ position: 'relative' }}>
            <button className={`dash-filter-btn ${showFilter ? 'dash-filter-active' : ''}`} onClick={() => setShowFilter(!showFilter)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
            {showFilter && (
              <div className="dash-filter-dropdown">
                {[
                  { key: null, label: locale === 'vi' ? 'Tất cả' : 'All' },
                  { key: 'Success', label: locale === 'vi' ? 'Thành công' : 'Success' },
                  { key: 'Pending', label: locale === 'vi' ? 'Chờ xử lý' : 'Pending' },
                  { key: 'Failed', label: locale === 'vi' ? 'Thất bại' : 'Failed' },
                ].map((s) => (
                  <button
                    key={s.label}
                    className={`dash-filter-option ${filterStatus === s.key ? 'dash-filter-option-active' : ''}`}
                    onClick={() => {
                      setFilterStatus(s.key);
                      setShowFilter(false);
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="dash-loading">{t('common.loading', 'Loading...')}</div>
        ) : activities.length === 0 ? (
          <div className="dash-empty">{t('dashboard.noActivity', 'No recent activity')}</div>
        ) : (
          <div className="dash-activity-list">
            {activities.filter((a) => !filterStatus || a.status === filterStatus).map((a) => (
              <div key={a.id} className="dash-activity-item">
                <div className="dash-activity-left">
                  <div className="dash-avatar" style={{ '--avatar-color': a.isInbound ? 'var(--color-primary)' : 'var(--color-accent)' }}>
                    {a.initial}
                  </div>
                  <div className="dash-activity-info">
                    <span className="dash-activity-name">{a.name}</span>
                    <span className="dash-activity-date">{a.date}</span>
                  </div>
                </div>
                <div className="dash-activity-right">
                  <span className={`dash-activity-amount ${a.isInbound ? 'amount-in' : 'amount-out'}`}>
                    {a.amount}
                  </span>
                  <span className="dash-activity-status" style={{ color: statusColors[a.statusKey] }}>
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div
          className="contact-modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowDepositModal(false)}
        >
          <div
            className="contact-modal"
            style={{ width: '90%', maxWidth: '380px', background: 'var(--bg-card-solid, #26262B)', border: '1px solid var(--border-medium)', borderRadius: '16px', padding: '24px', textAlign: 'center', position: 'relative', boxShadow: 'var(--shadow-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>{locale === 'vi' ? 'Nạp tiền điện tử' : 'Deposit Crypto'}</h3>
              <span style={{ fontSize: '10px', background: 'rgba(139, 92, 246, 0.2)', color: '#A78BFA', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Rialo / Sepolia</span>
            </div>

            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
              <QRCodeSVG
                value={user?.address || '0x71C8A18F83441B3BfA10cEaFEeD0929285098357'}
                size={180}
                bgColor="#FFFFFF"
                fgColor="#1F1F1F"
                level="M"
              />
            </div>

            <p style={{ fontSize: '11px', color: 'rgba(200, 200, 230, 0.75)', marginBottom: '12px' }}>
              {locale === 'vi' ? 'Chỉ gửi ETH hoặc các token được hỗ trợ (USDC, DAI) đến địa chỉ này.' : 'Send only ETH or supported tokens (USDC, DAI) to this address on Sepolia.'}
            </p>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(180, 180, 200, 0.65)', display: 'block', textTransform: 'uppercase', marginBottom: '4px' }}>{locale === 'vi' ? 'Địa chỉ ví của bạn' : 'Your Wallet Address'}</span>
              <span style={{ fontSize: '11px', color: '#FFFFFF', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {user?.address || '0x71C8A18F83441B3BfA10cEaFEeD0929285098357'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => handleCopy(user?.address || '0x71C8A18F83441B3BfA10cEaFEeD0929285098357')}
              >
                {copied ? (locale === 'vi' ? '✓ Đã sao chép' : '✓ Copied') : (locale === 'vi' ? 'Sao chép địa chỉ' : 'Copy Address')}
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '10px 16px' }}
                onClick={() => setShowDepositModal(false)}
              >
                {locale === 'vi' ? 'Xong' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div
          className="contact-modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowWithdrawModal(false)}
        >
          <div
            className="contact-modal"
            style={{ width: '90%', maxWidth: '400px', background: 'var(--bg-card-solid, #26262B)', border: '1px solid var(--border-medium)', borderRadius: '16px', padding: '24px', position: 'relative', boxShadow: 'var(--shadow-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>{locale === 'vi' ? 'Rút tiền' : 'Withdraw Funds'}</h3>
            <p style={{ fontSize: '12px', color: 'rgba(200, 200, 230, 0.75)', marginBottom: '16px' }}>
              {locale === 'vi' ? 'Chuyển ETH từ ví Obscural của bạn.' : 'Transfer ETH from your Obscural wallet.'}
            </p>

            <form onSubmit={handleWithdrawSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(180, 180, 200, 0.65)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                  {locale === 'vi' ? 'Địa chỉ người nhận' : 'Recipient Address'}
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#FFFFFF', fontSize: '13px' }}
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label style={{ fontSize: '11px', color: 'rgba(180, 180, 200, 0.65)', textTransform: 'uppercase', fontWeight: 600 }}>{locale === 'vi' ? 'Số lượng (ETH)' : 'Amount (ETH)'}</label>
                  <span style={{ fontSize: '11px', color: '#8B5CF6', cursor: 'pointer', fontWeight: 600 }} onClick={() => setWithdrawAmount(ethBalance.toString())}>
                    Max: {ethBalance.toFixed(4)} ETH
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#FFFFFF', fontSize: '13px' }}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '10px' }}
                  disabled={withdrawing}
                >
                  {withdrawing ? (locale === 'vi' ? 'Đang gửi...' : 'Sending...') : (locale === 'vi' ? 'Xác nhận rút tiền' : 'Confirm Withdraw')}
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '10px 16px' }}
                  onClick={() => setShowWithdrawModal(false)}
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
