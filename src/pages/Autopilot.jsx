import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import { autopilotApi, contactsApi } from '../services/api';
import { fetchLiveTokenPrices } from '../utils/currency';
import { toast } from '../components/common';
import '../styles/Autopilot.css';

const TRUST_COLORS = {
  high: '#22D3EE',
  medium: '#F59E0B',
  low: '#EF4444',
  unknown: '#6B7280',
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7C3AED, #06B6D4)',
  'linear-gradient(135deg, #3B82F6, #10B981)',
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

export default function Autopilot() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [tab, setTab] = useState('trust');
  const [trustProfiles, setTrustProfiles] = useState([]);
  const [contactsMap, setContactsMap] = useState(new Map());
  const [actions, setActions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [latchStatus, setLatchStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Edit state
  const [editAddr, setEditAddr] = useState(null);
  const [editScore, setEditScore] = useState('');
  const [editReason, setEditReason] = useState('');

  // Hover Popover State
  const [hoverPopover, setHoverPopover] = useState(null);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const hideTimerRef = useRef(null);

  const getActionConfig = (action) => {
    switch (action) {
      case 'proposed':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ),
          label: t('autopilot.autoPay'),
        };
      case 'notify':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          ),
          label: t('autopilot.needsApproval'),
        };
      case 'blocked':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          ),
          label: t('autopilot.blocked'),
        };
      case 'flagged':
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ),
          label: t('autopilot.flagged'),
        };
      default:
        return {
          icon: (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          ),
          label: action,
        };
    }
  };

  const loadData = useCallback(async () => {
    if (!user?.address) return;
    setLoading(true);
    try {
      const [trustRes, activityRes, statusRes, contactsRes] = await Promise.allSettled([
        autopilotApi.getTrust(user.address),
        autopilotApi.getActivity(user.address, 30),
        autopilotApi.getLatchStatus(),
        contactsApi.list(user.address),
        fetchLiveTokenPrices(),
      ]);

      if (trustRes.status === 'fulfilled') {
        setTrustProfiles(trustRes.value.contacts || []);
      }
      if (activityRes.status === 'fulfilled') {
        setActivity(activityRes.value.data || []);
      }
      if (statusRes.status === 'fulfilled') {
        setLatchStatus(statusRes.value.data || null);
      }
      if (contactsRes.status === 'fulfilled') {
        const cMap = new Map();
        (contactsRes.value.data || []).forEach((c) => {
          if (c.wallet_address) {
            cMap.set(c.wallet_address.toLowerCase().trim(), c);
          }
        });
        setContactsMap(cMap);
      }
    } catch (err) {
      console.error('Failed to load autopilot data', err);
    } finally {
      setLoading(false);
    }
  }, [user?.address]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await autopilotApi.scan(user.address);
      setActions(res.actions || []);
      if (res.trustProfiles) setTrustProfiles(res.trustProfiles);
      toast.success(t('autopilot.scannedCount').replace('{count}', (res.actions || []).length));
      loadData();
    } catch (err) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const openEdit = (p) => {
    setEditAddr(p.address);
    setEditScore(p.trustScore.toString());
    setEditReason(p.overrideReason || '');
  };

  const handleSaveOverride = async () => {
    const score = parseInt(editScore, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error(t('autopilot.scoreRangeError'));
      return;
    }
    try {
      await autopilotApi.setOverride(user.address, editAddr, score, editReason);
      toast.success(t('autopilot.scoreUpdated'));
      setEditAddr(null);
      loadData();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
  };

  const handleRemoveOverride = async (addr) => {
    try {
      await autopilotApi.removeOverride(user.address, addr);
      toast.success(t('autopilot.overrideRemoved'));
      loadData();
    } catch (err) {
      toast.error('Failed: ' + err.message);
    }
  };

  // Hover Popover Handlers
  const handleContactMouseEnter = (e, profile, contactInfo) => {
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

    setHoverPopover({
      type: 'contact',
      profile,
      contact: contactInfo,
      x,
      y,
    });
  };

  const handleTrustMouseEnter = (e, profile) => {
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

    setHoverPopover({
      type: 'trust',
      profile,
      x,
      y,
    });
  };

  const handleMouseLeavePopover = () => {
    hideTimerRef.current = setTimeout(() => {
      setHoverPopover(null);
    }, 140);
  };

  const handlePopoverMouseEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  };

  const copyAddressToClipboard = (addr) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1800);
  };

  const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '???');
  const trustColor = (level) => TRUST_COLORS[level] || TRUST_COLORS.unknown;

  return (
    <div className="ap-page">
      {/* Header */}
      <div className="ap-header">
        <div>
          <h1 className="ap-title">
            <span style={{ marginRight: '8px' }}>🤖</span>
            {t('autopilot.title')}
          </h1>
          <p className="ap-subtitle">{t('autopilot.subtitle')}</p>
        </div>
        <button className="ap-scan-btn" onClick={handleScan} disabled={scanning}>
          {scanning ? (
            <>
              <span className="spinner-ring" style={{ width: '14px', height: '14px' }} />
              {t('autopilot.scanning')}
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              {t('autopilot.scanBtn')}
            </>
          )}
        </button>
      </div>

      {/* OnLatch */}
      <div className={`ap-latch-bar ${latchStatus?.enabled ? 'ap-latch-on' : 'ap-latch-off'}`}>
        <span className="ap-latch-dot" />
        <span className="ap-latch-text">
          OnLatch: {latchStatus?.enabled ? `${t('autopilot.connected')} (${latchStatus.tokenPrefix})` : t('autopilot.notConfigured')}
        </span>
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        {[
          { id: 'trust', label: t('autopilot.tabAll'), count: trustProfiles.length },
          { id: 'actions', label: t('autopilot.tabActions'), count: actions.length },
          { id: 'activity', label: t('autopilot.tabActivity'), count: activity.length },
        ].map((tItem) => (
          <button
            key={tItem.id}
            className={`ap-tab ${tab === tItem.id ? 'ap-tab-active' : ''}`}
            onClick={() => setTab(tItem.id)}
          >
            {tItem.label} {tItem.count > 0 && <span className="ap-tab-badge">{tItem.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Trust Profiles (Table Layout) ── */}
      {tab === 'trust' && (
        <div className="ap-section">
          {trustProfiles.length === 0 && !loading && (
            <div className="ap-empty">
              <p>{t('autopilot.noData')}</p>
              <p className="ap-empty-hint">{t('autopilot.scanHint')}</p>
            </div>
          )}

          {trustProfiles.length > 0 && (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>{locale === 'vi' ? 'Đối tác / Liên hệ' : 'Contact / Partner'}</th>
                    <th>{t('autopilot.colTrustScore')}</th>
                    <th>{t('autopilot.colLevel')}</th>
                    <th>{t('autopilot.colTransactions')}</th>
                    <th>{locale === 'vi' ? 'Số tiền TB (USDC)' : 'Avg Amount (USDC)'}</th>
                    <th>{t('autopilot.colPattern')}</th>
                    <th>{t('autopilot.colRecommendation')}</th>
                    <th>{t('autopilot.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {trustProfiles.map((p, i) => {
                    const contact = contactsMap.get(p.address?.toLowerCase().trim()) || p.contactDetails || null;
                    const contactName = p.contactName || contact?.name || null;
                    const displayName = contactName || shortAddr(p.address);

                    return (
                      <tr key={i} className={editAddr === p.address ? 'ap-row-editing' : ''}>
                        {/* 1. Contact / Partner Name Cell */}
                        <td
                          className="ap-cell-contact"
                          onMouseEnter={(e) => handleContactMouseEnter(e, p, contact)}
                          onMouseLeave={handleMouseLeavePopover}
                        >
                          <div className="ap-contact-badge-box">
                            <div
                              className="ap-contact-avatar-mini"
                              style={{ background: getAvatarGradient(displayName) }}
                            >
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="ap-contact-text-wrap">
                              <span className="ap-contact-name-main">{displayName}</span>
                              <span className="ap-contact-addr-sub">{shortAddr(p.address)}</span>
                            </div>
                            {p.isOverridden && (
                              <span className="ap-override-badge" title={`Override: ${p.overrideReason}`}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Trust Score Cell */}
                        <td
                          className="ap-cell-score"
                          onMouseEnter={(e) => editAddr !== p.address && handleTrustMouseEnter(e, p)}
                          onMouseLeave={handleMouseLeavePopover}
                        >
                          {editAddr === p.address ? (
                            <input
                              type="number"
                              min="0"
                              max="100"
                              className="ap-score-input"
                              value={editScore}
                              onChange={(e) => setEditScore(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <div className="ap-score-interactive-wrap">
                              <div className="ap-score-bar-wrap">
                                <div className="ap-score-bar">
                                  <div
                                    className="ap-score-fill"
                                    style={{ width: `${p.trustScore}%`, background: trustColor(p.trustLevel) }}
                                  />
                                </div>
                                <span className="ap-score-num" style={{ color: trustColor(p.trustLevel) }}>
                                  {p.trustScore}
                                </span>
                                {p.isOverridden && <span className="ap-ai-score-hint">AI: {p.aiScore}</span>}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 3. Level Badge */}
                        <td>
                          <span className={`ap-level-badge ap-trust-${p.trustLevel}`}>
                            {p.trustLevel.toUpperCase()}
                          </span>
                        </td>

                        {/* 4. Transactions Count */}
                        <td className="ap-cell-num">{p.metrics.txCount}</td>

                        {/* 5. Avg Amount in USDC / USDT */}
                        <td className="ap-cell-num ap-cell-avg">
                          <div className="ap-avg-display">
                            <span className="ap-avg-usdc-num">
                              {(p.metrics.avgAmount || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{' '}
                              USDC
                            </span>
                            {p.metrics.avgCrypto && (
                              <span className="ap-avg-crypto-tag">({p.metrics.avgCrypto})</span>
                            )}
                          </div>
                        </td>

                        {/* 6. Pattern */}
                        <td className="ap-cell-tag">{p.pattern}</td>

                        {/* 7. Recommendation */}
                        <td>
                          <span className={`ap-rec-tag ap-rec-${p.recommendation}`}>
                            {p.recommendation === 'auto_pay'
                              ? `✓ ${locale === 'vi' ? 'Tự động' : 'Auto'}`
                              : p.recommendation === 'notify'
                                ? `🔔 ${locale === 'vi' ? 'Thông báo' : 'Notify'}`
                                : `✋ ${t('autopilot.manual')}`}
                          </span>
                        </td>

                        {/* 8. Actions */}
                        <td className="ap-cell-actions">
                          {editAddr === p.address ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                className="ap-reason-input"
                                placeholder={t('autopilot.reasonPlaceholder')}
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                              />
                              <button
                                className="ap-btn-save"
                                onClick={handleSaveOverride}
                                title={t('common.save')}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </button>
                              <button
                                className="ap-btn-cancel"
                                onClick={() => setEditAddr(null)}
                                title={t('common.cancel')}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                className="ap-btn-edit"
                                onClick={() => openEdit(p)}
                                title={t('autopilot.editScoreTitle')}
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              {p.isOverridden && (
                                <button
                                  className="ap-btn-revert"
                                  onClick={() => handleRemoveOverride(p.address)}
                                  title={t('autopilot.revertTitle')}
                                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px' }}
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="1 4 1 10 7 10" />
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Scan Results ── */}
      {tab === 'actions' && (
        <div className="ap-section">
          {actions.length === 0 && (
            <div className="ap-empty">
              <p>{t('autopilot.noScanResults')}</p>
              <p className="ap-empty-hint">{t('autopilot.scanResultsHint')}</p>
            </div>
          )}
          <div className="ap-activity-list">
            {actions.map((a, i) => {
              const cfg = getActionConfig(a.action);
              return (
                <div key={i} className={`ap-activity-item ap-activity-${a.action}`}>
                  <span className="ap-activity-icon">{cfg.icon}</span>
                  <div className="ap-activity-content">
                    <p className="ap-activity-text">
                      <strong>{cfg.label}</strong> — {a.reason}
                    </p>
                    <p className="ap-activity-meta">
                      {shortAddr(a.sender)} · {a.amount} {a.currency || 'USDC'}
                      {a.trustScore !== undefined && ` · Trust: ${a.trustScore}/100`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Activity Log ── */}
      {tab === 'activity' && (
        <div className="ap-section">
          {activity.length === 0 && !loading && (
            <div className="ap-empty">
              <p>{t('autopilot.noActivity')}</p>
            </div>
          )}
          <div className="ap-activity-list">
            {activity.map((log, i) => {
              const action = log.output?.action || log.action;
              const cfg = getActionConfig(action);
              return (
                <div key={i} className={`ap-activity-item ap-activity-${action}`}>
                  <span className="ap-activity-icon">{cfg.icon}</span>
                  <div className="ap-activity-content">
                    <p className="ap-activity-text">
                      <strong>{cfg.label}</strong> — {log.output?.reason || 'No details'}
                    </p>
                    <p className="ap-activity-meta">
                      {log.output?.sender && shortAddr(log.output.sender)}
                      {log.output?.amount && ` · ${log.output.amount} ${log.output?.currency || 'USDC'}`}
                      {log.output?.trustScore !== undefined && ` · Trust: ${log.output.trustScore}`}
                      {log.created_at && ` · ${new Date(log.created_at).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Floating Hover Card Portals ── */}
      {hoverPopover && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="ap-popover-portal-container"
            style={{
              position: 'fixed',
              left: `${hoverPopover.x}px`,
              top: `${hoverPopover.y}px`,
              zIndex: 99999,
            }}
            onMouseEnter={handlePopoverMouseEnter}
            onMouseLeave={handleMouseLeavePopover}
          >
            {/* Popover Type 1: Contact Details Card */}
            {hoverPopover.type === 'contact' && (() => {
              const p = hoverPopover.profile;
              const c = hoverPopover.contact;
              const contactName = p.contactName || c?.name || null;
              const displayName = contactName || shortAddr(p.address);
              const email = p.contactEmail || c?.email || null;
              const homeAddr = c?.home_address || null;
              const company = c?.company || null;
              const notes = c?.notes || null;

              return (
                <div className="ap-hover-card ap-contact-popover-card">
                  {/* Header */}
                  <div className="ap-popover-header">
                    <div
                      className="ap-popover-avatar"
                      style={{ background: getAvatarGradient(displayName) }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="ap-popover-title-box">
                      <div className="ap-popover-name-row">
                        <span className="ap-popover-fullname">{displayName}</span>
                        <span className={`ap-popover-type-badge ${c ? 'saved' : 'counterparty'}`}>
                          {c ? (locale === 'vi' ? '✓ Danh bạ' : '✓ Saved Contact') : (locale === 'vi' ? 'Ví On-Chain' : 'Counterparty')}
                        </span>
                      </div>
                      {company && <span className="ap-popover-company">🏢 {company}</span>}
                    </div>
                  </div>

                  {/* Body fields */}
                  <div className="ap-popover-body">
                    {/* Wallet address with 1-click copy */}
                    <div className="ap-popover-row">
                      <span className="ap-popover-icon">👛</span>
                      <div className="ap-popover-row-content">
                        <span className="ap-popover-label">{locale === 'vi' ? 'Địa chỉ ví' : 'Wallet Address'}</span>
                        <div className="ap-popover-copy-row">
                          <code className="ap-popover-code">{p.address}</code>
                          <button
                            type="button"
                            className="ap-popover-copy-btn"
                            onClick={() => copyAddressToClipboard(p.address)}
                            title="Copy Address"
                          >
                            {copiedAddr ? '✓' : '⧉'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Email */}
                    {email && (
                      <div className="ap-popover-row">
                        <span className="ap-popover-icon">✉️</span>
                        <div className="ap-popover-row-content">
                          <span className="ap-popover-label">Email</span>
                          <span className="ap-popover-val">{email}</span>
                        </div>
                      </div>
                    )}

                    {/* Physical Address */}
                    {homeAddr && (
                      <div className="ap-popover-row">
                        <span className="ap-popover-icon">📍</span>
                        <div className="ap-popover-row-content">
                          <span className="ap-popover-label">{locale === 'vi' ? 'Địa chỉ' : 'Location / Address'}</span>
                          <span className="ap-popover-val">{homeAddr}</span>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {notes && (
                      <div className="ap-popover-row">
                        <span className="ap-popover-icon">📝</span>
                        <div className="ap-popover-row-content">
                          <span className="ap-popover-label">{locale === 'vi' ? 'Ghi chú' : 'Notes'}</span>
                          <span className="ap-popover-val notes">{notes}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer telemetry */}
                  <div className="ap-popover-stats-grid">
                    <div className="ap-popover-stat-item">
                      <span className="ap-stat-label">{locale === 'vi' ? 'Giao dịch' : 'Transactions'}</span>
                      <span className="ap-stat-val">{p.metrics.txCount}</span>
                    </div>
                    <div className="ap-popover-stat-item">
                      <span className="ap-stat-label">{locale === 'vi' ? 'Tổng thanh toán' : 'Total Volume'}</span>
                      <span className="ap-stat-val">
                        {(p.metrics.totalVolume || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} USDC
                      </span>
                    </div>
                    <div className="ap-popover-stat-item">
                      <span className="ap-stat-label">{locale === 'vi' ? 'Tín nhiệm' : 'Trust Score'}</span>
                      <span className="ap-stat-val" style={{ color: trustColor(p.trustLevel) }}>
                        {p.trustScore}/100
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Popover Type 2: Trust Score Evaluation Card */}
            {hoverPopover.type === 'trust' && (() => {
              const p = hoverPopover.profile;
              const levelColor = trustColor(p.trustLevel);
              const reasoningText = p.aiEval?.reasoning || (
                p.trustLevel === 'high'
                  ? (locale === 'vi'
                    ? `Mức độ tín nhiệm cao với ${p.metrics.txCount} giao dịch hoàn tất ổn định, phương sai số tiền thấp.`
                    : `High trust established with ${p.metrics.txCount} completed transactions and strong volume consistency.`)
                  : p.trustLevel === 'medium'
                  ? (locale === 'vi'
                    ? `Đã phát sinh ${p.metrics.txCount} giao dịch. Lịch sử thanh toán tốt nhưng khuyến nghị duyệt thông báo.`
                    : `Moderate transaction history (${p.metrics.txCount} txs). Stable interaction pattern, standard approval advised.`)
                  : (locale === 'vi'
                    ? `Lịch sử giao dịch on-chain còn ít (${p.metrics.txCount} txs). Yêu cầu xác nhận thủ công.`
                    : `Limited on-chain history (${p.metrics.txCount} txs). Manual approval required before payment.`)
              );

              return (
                <div className="ap-hover-card ap-trust-popover-card">
                  {/* Top Bar with Score meter */}
                  <div className="ap-trust-pop-top">
                    <div className="ap-trust-meter-circle" style={{ borderColor: levelColor }}>
                      <span className="ap-meter-score" style={{ color: levelColor }}>
                        {p.trustScore}
                      </span>
                      <span className="ap-meter-max">/100</span>
                    </div>
                    <div className="ap-trust-top-info">
                      <div className="ap-trust-badge-row">
                        <span className={`ap-level-badge ap-trust-${p.trustLevel}`}>
                          {p.trustLevel.toUpperCase()} TRUST
                        </span>
                        {p.isOverridden && (
                          <span className="ap-override-tag-mini">
                            ✏️ {locale === 'vi' ? 'Ghi đè thủ công' : 'Manual Override'}
                          </span>
                        )}
                      </div>
                      <span className="ap-trust-rec-label">
                        {p.recommendation === 'auto_pay'
                          ? `✓ ${locale === 'vi' ? 'Đủ điều kiện thanh toán tự động' : 'Eligible for 1-Click Auto-Pay'}`
                          : p.recommendation === 'notify'
                          ? `🔔 ${locale === 'vi' ? 'Gửi thông báo & Chờ người dùng duyệt' : 'Notification & Review Required'}`
                          : `✋ ${locale === 'vi' ? 'Yêu cầu kiểm tra & duyệt thủ công' : 'Manual Approval Required'}`}
                      </span>
                    </div>
                  </div>

                  {/* Factor Breakdown Rows */}
                  <div className="ap-trust-metrics-section">
                    <span className="ap-section-title">{locale === 'vi' ? 'Tiêu chí đánh giá AI' : 'AI Scoring Metrics'}</span>

                    <div className="ap-factor-item">
                      <div className="ap-factor-label-row">
                        <span>🔄 {locale === 'vi' ? 'Số lần giao dịch' : 'Completed Transactions'}</span>
                        <strong>{p.metrics.txCount} txs</strong>
                      </div>
                      <div className="ap-factor-bar">
                        <div
                          className="ap-factor-bar-fill"
                          style={{
                            width: `${Math.min(100, (p.metrics.txCount / 10) * 100)}%`,
                            background: levelColor,
                          }}
                        />
                      </div>
                    </div>

                    <div className="ap-factor-item">
                      <div className="ap-factor-label-row">
                        <span>📈 {locale === 'vi' ? 'Độ ổn định số tiền' : 'Amount Consistency'}</span>
                        <strong>{Math.round(p.metrics.consistency || 0)}%</strong>
                      </div>
                      <div className="ap-factor-bar">
                        <div
                          className="ap-factor-bar-fill"
                          style={{
                            width: `${Math.min(100, p.metrics.consistency || 0)}%`,
                            background: '#10B981',
                          }}
                        />
                      </div>
                    </div>

                    <div className="ap-factor-item">
                      <div className="ap-factor-label-row">
                        <span>⏳ {locale === 'vi' ? 'Thời gian quan hệ' : 'Relationship Age'}</span>
                        <strong>{Math.round(p.metrics.durationDays || 0)} {locale === 'vi' ? 'ngày' : 'days'}</strong>
                      </div>
                      <div className="ap-factor-bar">
                        <div
                          className="ap-factor-bar-fill"
                          style={{
                            width: `${Math.min(100, ((p.metrics.durationDays || 0) / 90) * 100)}%`,
                            background: '#8B5CF6',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI Reasoning Quote Box */}
                  <div className="ap-trust-reason-box">
                    <span className="ap-reason-tag">💡 {locale === 'vi' ? 'Nhận định rủi ro' : 'Risk Evaluation'}:</span>
                    <p className="ap-reason-text">"{reasoningText}"</p>
                  </div>

                  {/* Limit & Security Status */}
                  <div className="ap-trust-footer-row">
                    <div className="ap-limit-badge">
                      <span className="ap-limit-label">{locale === 'vi' ? 'Hạn mức thanh toán an toàn' : 'Safe Auto Limit'}:</span>
                      <span className="ap-limit-val">
                        {(p.suggestedLimit || 0).toLocaleString()} USDC
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>,
          document.body
        )}
    </div>
  );
}
