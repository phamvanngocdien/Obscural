import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import AiChat from '../ai/AiChat';
import { toast } from '../common/toastEmitter';
import useI18nStore from '../../store/i18nStore';
import api, { notificationsApi } from '../../services/api';
import '../../styles/app-layout.css';

const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

export function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale } = useI18nStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const currentLang = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (code) => {
    if (code !== locale) {
      setLocale(code);
      toast.success(code === 'vi' ? 'Đã chuyển sang Tiếng Việt' : 'Switched to English');
    }
    setIsOpen(false);
  };

  return (
    <div className={`lang-switcher-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`lang-switcher-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Change language"
        title={locale === 'vi' ? 'Đổi ngôn ngữ' : 'Change language'}
      >
        <span className="lang-switcher-flag">{currentLang.flag}</span>
        <span className="lang-switcher-code">{currentLang.code.toUpperCase()}</span>
        <svg
          className={`lang-switcher-chevron ${isOpen ? 'open' : ''}`}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="lang-switcher-dropdown" role="listbox">
          <div className="lang-switcher-dropdown-header">
            {locale === 'vi' ? 'Ngôn ngữ' : 'Language'}
          </div>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className={`lang-switcher-option ${locale === lang.code ? 'active' : ''}`}
              onClick={() => handleSelect(lang.code)}
              role="option"
              aria-selected={locale === lang.code}
            >
              <span className="lang-switcher-option-flag">{lang.flag}</span>
              <span className="lang-switcher-option-label">{lang.label}</span>
              {locale === lang.code && (
                <span className="lang-switcher-check">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ user, wallet, onConnectWallet, onDisconnect }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const { t, locale } = useI18nStore();

  useEffect(() => {
    const computeNotifications = async () => {
      try {
        const list = [];

        // 1. Fetch persistent notifications from backend
        if (user?.address) {
          try {
            const backendRes = await notificationsApi.list(user.address);
            (backendRes.data || []).forEach((n) => {
              list.push({
                id: n.id,
                type: n.type || 'info',
                icon: n.icon || '🔔',
                title: n.title,
                desc: n.description || '',
                link: n.link || '/dashboard',
                time: n.is_read ? (locale === 'vi' ? 'Đã xem' : 'Read') : new Date(n.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' }),
                isRead: n.is_read,
                fromBackend: true,
              });
            });
          } catch {
            // Backend unavailable
          }
        }

        // 2. Compute client-side notifications from invoices
        const localSaved = localStorage.getItem('obscural_local_invoices');
        const localInvoices = localSaved ? JSON.parse(localSaved) : [];

        let apiInvoices = [];
        if (user?.address) {
          try {
            const res = await api.invoiceApi.list({ userId: user.address });
            apiInvoices = res.data || [];
          } catch {
            // fallback
          }
        }

        const seenIds = new Set(localInvoices.map((inv) => inv.id));
        // Also skip IDs already from backend notifications
        list.forEach((n) => seenIds.add(n.id));
        const merged = [...localInvoices];
        apiInvoices.forEach((inv) => {
          if (!seenIds.has(inv.id)) merged.push(inv);
        });

        const now = Date.now();

        merged.forEach((inv) => {
          const due = inv.dueDate ? new Date(inv.dueDate).getTime() : inv.due_date ? new Date(inv.due_date).getTime() : null;
          const isPaid = inv.status === 'paid';
          const isRecipient = inv.recipient_id?.toLowerCase() === user?.address?.toLowerCase();

          if (!isPaid && due && due < now) {
            list.push({
              id: `overdue-${inv.id}`,
              type: 'warning',
              icon: '⚠️',
              title: locale === 'vi' ? 'Hóa đơn quá hạn' : 'Invoice Overdue',
              desc: isRecipient
                ? (locale === 'vi' ? `Bạn có hóa đơn quá hạn $${inv.amount || inv.total} cần thanh toán.` : `You have an overdue bill of $${inv.amount || inv.total} to pay.`)
                : (locale === 'vi' ? `Hóa đơn "${inv.title || 'Hóa đơn'}" $${inv.amount || inv.total} đã quá ngày đến hạn.` : `${inv.title || 'Invoice'} of $${inv.amount || inv.total} is past due date.`),
              link: `/invoices/${inv.id}`,
              time: locale === 'vi' ? 'Cần xử lý' : 'Action required',
            });
          } else if (!isPaid && due && due - now < 3 * 86400000 && due > now) {
            const daysLeft = Math.ceil((due - now) / 86400000);
            list.push({
              id: `due-${inv.id}`,
              type: 'info',
              icon: '🔔',
              title: locale === 'vi' ? 'Sắp đến hạn' : 'Due Soon',
              desc: isRecipient
                ? (locale === 'vi' ? `Khoản thanh toán $${inv.amount || inv.total} đến hạn trong ${daysLeft} ngày.` : `Payment of $${inv.amount || inv.total} due in ${daysLeft} day(s).`)
                : (locale === 'vi' ? `Hóa đơn "${inv.title || 'Hóa đơn'}" $${inv.amount || inv.total} đến hạn trong ${daysLeft} ngày.` : `${inv.title || 'Invoice'} of $${inv.amount || inv.total} due in ${daysLeft} day(s).`),
              link: `/invoices/${inv.id}`,
              time: locale === 'vi' ? 'Sắp tới' : 'Upcoming',
            });
          } else if (isPaid) {
            list.push({
              id: `paid-${inv.id}`,
              type: 'success',
              icon: '✅',
              title: locale === 'vi' ? 'Đã quyết toán' : 'Payment Settled',
              desc: locale === 'vi' ? `Hóa đơn "${inv.title || 'Hóa đơn'}" $${inv.amount || inv.total} đã thanh toán on-chain.` : `${inv.title || 'Invoice'} of $${inv.amount || inv.total} was settled on-chain.`,
              link: `/invoices/${inv.id}`,
              time: locale === 'vi' ? 'Hoàn tất' : 'Completed',
            });
          }
        });

        // Add default welcome notification if list is empty
        if (list.length === 0) {
          list.push({
            id: 'welcome',
            type: 'info',
            icon: '✨',
            title: t('topbar.welcomeTitle'),
            desc: t('topbar.welcomeDesc'),
            link: '/create',
            time: locale === 'vi' ? 'Vừa xong' : 'Just now',
          });
        }

        setNotifications(list.slice(0, 12));
      } catch (err) {
        console.error('Failed to compute notifications', err);
      }
    };

    computeNotifications();
  }, [user?.address, locale, t]);

  const notifCount = notifications.filter((n) => n.id !== 'welcome' && !n.isRead).length;

  const handleMarkAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (user?.address) {
      notificationsApi.markAllRead(user.address).catch(() => {});
    }
  }, [user?.address]);

  return (
    <div className="layout">
      <Sidebar onDisconnect={onDisconnect} />
      <main className="layout-main">
        <div className="layout-topbar">
          <div className="layout-topbar-brand">
            <img src="/obscural.svg" alt="Obscural" className="layout-topbar-logo" />
            <span className="layout-topbar-title">Obscural</span>
          </div>

          <div className="layout-topbar-actions">
            <LanguageSwitcher />

            <div
              className="layout-notification"
              onClick={() => setShowNotifications(!showNotifications)}
              title={locale === 'vi' ? 'Thông báo' : 'Notifications'}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setShowNotifications(!showNotifications)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notifCount > 0 && (
                <span className="layout-notification-badge">
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </div>
          </div>

          {/* Notification dropdown */}
          {showNotifications && (
            <div className="layout-notif-dropdown" style={{ width: '320px', maxHeight: '420px', overflowY: 'auto' }}>
              <div className="layout-notif-header">
                <span>{t('topbar.notifications')} ({notifications.length})</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {notifCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{ fontSize: '10px', color: 'var(--color-primary, #9F8CFF)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      {t('topbar.markAllRead')}
                    </button>
                  )}
                  <button onClick={() => setShowNotifications(false)} className="layout-notif-close">✕</button>
                </div>
              </div>

              <div className="layout-notif-list">
                {notifications.map((n) => (
                  <Link
                    key={n.id}
                    to={n.link}
                    onClick={() => setShowNotifications(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      textDecoration: 'none',
                      color: 'inherit',
                      background: n.type === 'warning' ? 'rgba(255, 73, 74, 0.05)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '18px', marginTop: '1px' }}>{n.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#FFFFFF' }}>{n.title}</span>
                        <span style={{ fontSize: '10px', color: '#737B9B' }}>{n.time}</span>
                      </div>
                      <p style={{ fontSize: '11px', color: '#A9AEC5', margin: 0, lineHeight: 1.4 }}>{n.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="layout-content">
          <Outlet context={{ user, wallet, onConnectWallet, onDisconnect }} />
        </div>
      </main>
      <AiChat />
      <MobileNav />
    </div>
  );
}
