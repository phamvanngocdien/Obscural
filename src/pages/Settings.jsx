import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { toast } from '../components/common';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import useWallet from '../hooks/useWallet';
import { profilesApi } from '../services/api';
import '../styles/Settings.css';

export default function Settings() {
  const { user, onDisconnect } = useAuthStore();
  const { locale, t } = useI18nStore();
  const wallet = useWallet();
  const outletCtx = useOutletContext() || {};

  // Profile state
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('obscural_profile');
    return saved ? JSON.parse(saved) : {
      name: user?.name || '',
      email: '',
      location: '',
      company: '',
    };
  });
  const [profileDirty, setProfileDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Load profile from backend on mount
  useEffect(() => {
    if (!user?.address) return;
    profilesApi.get(user.address).then((res) => {
      if (res.exists && res.data) {
        const bp = res.data;
        setProfile((prev) => {
          const merged = {
            name: bp.name || prev.name,
            email: bp.email || prev.email,
            location: bp.location || prev.location,
            company: bp.company || prev.company || '',
          };
          localStorage.setItem('obscural_profile', JSON.stringify(merged));
          return merged;
        });
      }
    }).catch(() => {});
  }, [user?.address]);

  const handleProfileChange = (field, value) => {
    setProfile((p) => ({ ...p, [field]: value }));
    setProfileDirty(true);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      localStorage.setItem('obscural_profile', JSON.stringify(profile));
      if (user?.address) {
        await profilesApi.save(user.address, profile);
      }
      setProfileDirty(false);
      toast.success(locale === 'vi' ? 'Đã lưu hồ sơ!' : 'Profile saved!');
    } catch {
      toast.error(locale === 'vi' ? 'Lưu thất bại, đã lưu cục bộ.' : 'Failed to save profile to server, saved locally.');
      setProfileDirty(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const [security, setSecurity] = useState(() => {
    const saved = localStorage.getItem('obscural_security');
    return saved ? JSON.parse(saved) : {
      twoFactor: false,
      sessionTimeout: true,
      loginAlerts: true,
    };
  });

  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('obscural_notifications');
    return saved ? JSON.parse(saved) : {
      emailReminders: true,
      paymentAlerts: true,
      weeklyReport: false,
    };
  });

  useEffect(() => {
    localStorage.setItem('obscural_security', JSON.stringify(security));
  }, [security]);

  useEffect(() => {
    localStorage.setItem('obscural_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('obscural_dev_mock');
      localStorage.removeItem('obscural_last_active');
      sessionStorage.removeItem('obscural_session_active');

      if (wallet?.disconnect) {
        await wallet.disconnect();
      }
      if (outletCtx.onDisconnect) {
        outletCtx.onDisconnect();
      }
      onDisconnect();
      toast.success(t('auth.logoutSuccess'));
    } catch (err) {
      console.error('Failed to logout:', err);
      onDisconnect();
    }
  };

  const isLoggedIn = Boolean(user || wallet?.isConnected || wallet?.account);
  const displayEmail = user?.email || profile.email || user?.address || 'Not connected';

  const [copiedWallet, setCopiedWallet] = useState(false);

  const handleCopyWallet = () => {
    if (!wallet.walletAddress) return;
    navigator.clipboard.writeText(wallet.walletAddress);
    setCopiedWallet(true);
    toast.success(locale === 'vi' ? 'Đã sao chép địa chỉ ví!' : 'Wallet address copied!');
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  return (
    <div className="settings-page">
      {/* Profile Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.profile')}</h2>
        <div className="settings-toggles">
          <div className="settings-toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <label className="settings-toggle-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('settings.displayName')}</label>
            <input
              type="text"
              className="settings-input"
              value={profile.name}
              onChange={(e) => handleProfileChange('name', e.target.value)}
              placeholder={locale === 'vi' ? 'Tên của bạn' : 'Your name'}
            />
          </div>
          <div className="settings-toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <label className="settings-toggle-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('settings.email')}</label>
            <input
              type="email"
              className="settings-input"
              value={profile.email}
              onChange={(e) => handleProfileChange('email', e.target.value)}
              placeholder="email@example.com"
            />
          </div>
          <div className="settings-toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <label className="settings-toggle-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('settings.location')}</label>
            <input
              type="text"
              className="settings-input"
              value={profile.location}
              onChange={(e) => handleProfileChange('location', e.target.value)}
              placeholder={locale === 'vi' ? 'Thành phố, Quốc gia' : 'City, Country'}
            />
          </div>
          <div className="settings-toggle-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '6px' }}>
            <label className="settings-toggle-label" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('settings.company')}</label>
            <input
              type="text"
              className="settings-input"
              value={profile.company}
              onChange={(e) => handleProfileChange('company', e.target.value)}
              placeholder={locale === 'vi' ? 'Công ty của bạn' : 'Your company'}
            />
          </div>
          {profileDirty && (
            <button
              className="btn btn-primary"
              style={{ marginTop: '8px', padding: '10px 24px', alignSelf: 'flex-start' }}
              onClick={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? t('settings.saving') : t('settings.saveProfile')}
            </button>
          )}
        </div>
      </section>

      {/* Security Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.security')}</h2>
        <div className="settings-toggles">
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">{t('settings.twoFactor')}</span>
              <span className="settings-toggle-desc">{t('settings.twoFactorDesc')}</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={security.twoFactor}
                onChange={(e) => setSecurity((s) => ({ ...s, twoFactor: e.target.checked }))}
              />
              <span className="settings-slider" />
            </label>
          </div>
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">{t('settings.sessionTimeout')}</span>
              <span className="settings-toggle-desc">{t('settings.sessionTimeoutDesc')}</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={security.sessionTimeout}
                onChange={(e) => setSecurity((s) => ({ ...s, sessionTimeout: e.target.checked }))}
              />
              <span className="settings-slider" />
            </label>
          </div>
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">{t('settings.loginAlerts')}</span>
              <span className="settings-toggle-desc">{t('settings.loginAlertsDesc')}</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={security.loginAlerts}
                onChange={(e) => setSecurity((s) => ({ ...s, loginAlerts: e.target.checked }))}
              />
              <span className="settings-slider" />
            </label>
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">{t('settings.notifications')}</h2>
        <div className="settings-toggles">
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">{t('settings.emailReminders')}</span>
              <span className="settings-toggle-desc">{t('settings.emailRemindersDesc')}</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={notifications.emailReminders}
                onChange={(e) => setNotifications((n) => ({ ...n, emailReminders: e.target.checked }))}
              />
              <span className="settings-slider" />
            </label>
          </div>
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">{t('settings.paymentAlerts')}</span>
              <span className="settings-toggle-desc">{t('settings.paymentAlertsDesc')}</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={notifications.paymentAlerts}
                onChange={(e) => setNotifications((n) => ({ ...n, paymentAlerts: e.target.checked }))}
              />
              <span className="settings-slider" />
            </label>
          </div>
          <div className="settings-toggle-row">
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">{t('settings.weeklyReport')}</span>
              <span className="settings-toggle-desc">{t('settings.weeklyReportDesc')}</span>
            </div>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={notifications.weeklyReport}
                onChange={(e) => setNotifications((n) => ({ ...n, weeklyReport: e.target.checked }))}
              />
              <span className="settings-slider" />
            </label>
          </div>
        </div>
      </section>

      {/* Account Section */}
      <section className="settings-section">
        <h2 className="settings-section-title">{locale === 'vi' ? 'Tài khoản' : 'Account'}</h2>
        <div className="settings-wallet-card">
          <div className="settings-wallet-grid">
            {/* Login identity */}
            <div className="settings-wallet-info">
              <span className="settings-wallet-label">{locale === 'vi' ? 'Đăng nhập với' : 'Signed in as'}</span>
              <span className="settings-wallet-address">{displayEmail}</span>
            </div>

            {/* Wallet address */}
            {wallet.walletAddress && (
              <div className="settings-wallet-info">
                <span className="settings-wallet-label">{locale === 'vi' ? 'Ví blockchain' : 'Wallet address'}</span>
                <div className="settings-wallet-address-row">
                  <span className="settings-wallet-address-chip" title={wallet.walletAddress}>
                    {wallet.shortAddress}
                  </span>
                  <button
                    type="button"
                    className={`settings-copy-btn ${copiedWallet ? 'settings-copy-btn-copied' : ''}`}
                    title={locale === 'vi' ? (copiedWallet ? 'Đã sao chép' : 'Sao chép địa chỉ') : (copiedWallet ? 'Copied!' : 'Copy address')}
                    aria-label="Copy wallet address"
                    onClick={handleCopyWallet}
                  >
                    {copiedWallet ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Balance & Network */}
            {wallet.hasWallet && (
              <div className="settings-wallet-info">
                <span className="settings-wallet-label">{locale === 'vi' ? 'Số dư & Mạng' : 'Balance & Network'}</span>
                <div className="settings-wallet-balance-row">
                  <span className="settings-wallet-balance-val">
                    {parseFloat(wallet.balance).toFixed(4)} ETH
                  </span>
                  <span className={`settings-network-badge ${wallet.isCorrectNetwork ? 'network-sepolia' : 'network-other'}`}>
                    <span className="network-dot" />
                    {wallet.isCorrectNetwork ? 'Sepolia' : `Chain ${wallet.chainId || '—'}`}
                  </span>
                </div>
              </div>
            )}

            {/* Waiting for wallet */}
            {wallet.isConnected && !wallet.hasWallet && (
              <div className="settings-wallet-info">
                <span className="settings-wallet-label">{locale === 'vi' ? 'Trạng thái ví' : 'Wallet Status'}</span>
                <span className="settings-wallet-creating">
                  <span className="settings-spinner-small" />
                  {locale === 'vi' ? 'Đang tạo ví...' : 'Creating wallet...'}
                </span>
              </div>
            )}
          </div>

          {isLoggedIn && (
            <button className="settings-btn-disconnect" onClick={handleLogout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              {t('settings.logout')}
            </button>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="settings-section settings-danger-zone">
        <h2 className="settings-section-title" style={{ color: 'var(--color-error)' }}>{t('settings.dangerZone')}</h2>
        <div className="settings-danger-row">
          <div>
            <span className="settings-danger-label">{t('settings.clearDataLabel')}</span>
            <span className="settings-danger-desc">{t('settings.clearDataDesc')}</span>
          </div>
          <button
            className="settings-btn-danger"
            onClick={() => {
              if (window.confirm(t('settings.clearDataConfirm'))) {
                localStorage.clear();
                toast.success(locale === 'vi' ? 'Đã xóa dữ liệu' : 'Local data cleared');
                window.location.reload();
              }
            }}
          >
            {t('settings.clearData')}
          </button>
        </div>
      </section>
    </div>
  );
}
