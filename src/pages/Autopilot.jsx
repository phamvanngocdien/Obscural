import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import { autopilotApi } from '../services/api';
import { toast } from '../components/common';
import '../styles/Autopilot.css';

const TRUST_COLORS = {
  high: '#22D3EE',
  medium: '#F59E0B',
  low: '#EF4444',
  unknown: '#6B7280',
};

export default function Autopilot() {
  const { user } = useAuthStore();
  const { t, locale } = useI18nStore();
  const [tab, setTab] = useState('trust');
  const [trustProfiles, setTrustProfiles] = useState([]);
  const [actions, setActions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [latchStatus, setLatchStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Edit state
  const [editAddr, setEditAddr] = useState(null);
  const [editScore, setEditScore] = useState('');
  const [editReason, setEditReason] = useState('');

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
      const [trustRes, activityRes, statusRes] = await Promise.allSettled([
        autopilotApi.getTrust(user.address),
        autopilotApi.getActivity(user.address, 30),
        autopilotApi.getLatchStatus(),
      ]);
      if (trustRes.status === 'fulfilled') setTrustProfiles(trustRes.value.contacts || []);
      if (activityRes.status === 'fulfilled') setActivity(activityRes.value.data || []);
      if (statusRes.status === 'fulfilled') setLatchStatus(statusRes.value.data || null);
    } catch (err) {
      console.error('Failed to load', err);
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
    const score = parseInt(editScore);
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
                    <th>{t('autopilot.colAddress')}</th>
                    <th>{t('autopilot.colTrustScore')}</th>
                    <th>{t('autopilot.colLevel')}</th>
                    <th>{t('autopilot.colTransactions')}</th>
                    <th>{t('autopilot.colAvgAmount')}</th>
                    <th>{t('autopilot.colPattern')}</th>
                    <th>{t('autopilot.colRecommendation')}</th>
                    <th>{t('autopilot.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {trustProfiles.map((p, i) => (
                    <tr key={i} className={editAddr === p.address ? 'ap-row-editing' : ''}>
                      <td className="ap-cell-addr">
                        <span className="ap-addr-dot" style={{ background: trustColor(p.trustLevel) }} />
                        <span className="ap-addr-text" title={p.address}>{shortAddr(p.address)}</span>
                        {p.isOverridden && (
                          <span className="ap-override-badge" title={`Override: ${p.overrideReason}`}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </span>
                        )}
                      </td>

                      <td className="ap-cell-score">
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
                          <div className="ap-score-bar-wrap">
                            <div className="ap-score-bar">
                              <div className="ap-score-fill" style={{ width: `${p.trustScore}%`, background: trustColor(p.trustLevel) }} />
                            </div>
                            <span className="ap-score-num" style={{ color: trustColor(p.trustLevel) }}>{p.trustScore}</span>
                            {p.isOverridden && <span className="ap-ai-score-hint">AI: {p.aiScore}</span>}
                          </div>
                        )}
                      </td>

                      <td>
                        <span className={`ap-level-badge ap-trust-${p.trustLevel}`}>
                          {p.trustLevel.toUpperCase()}
                        </span>
                      </td>

                      <td className="ap-cell-num">{p.metrics.txCount}</td>
                      <td className="ap-cell-num">${p.metrics.avgAmount}</td>
                      <td className="ap-cell-tag">{p.pattern}</td>

                      <td>
                        <span className={`ap-rec-tag ap-rec-${p.recommendation}`}>
                          {p.recommendation === 'auto_pay'
                            ? `✓ ${locale === 'vi' ? 'Tự động' : 'Auto'}`
                            : p.recommendation === 'notify'
                              ? `🔔 ${locale === 'vi' ? 'Thông báo' : 'Notify'}`
                              : `✋ ${t('autopilot.manual')}`}
                        </span>
                      </td>

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
                  ))}
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
                      {shortAddr(a.sender)} · ${a.amount}
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
                      {log.output?.amount && ` · $${log.output.amount}`}
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
    </div>
  );
}
