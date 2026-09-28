import { useState, useEffect, useCallback } from 'react';
import useAuthStore from '../store/authStore';
import { autopilotApi } from '../services/api';
import { toast } from '../components/common';
import '../styles/Autopilot.css';

const TRUST_COLORS = {
  high: '#22D3EE', medium: '#F59E0B', low: '#EF4444', unknown: '#6B7280',
};

const ACTION_CONFIG = {
  proposed: { icon: '✅', label: 'Auto-pay' },
  notify: { icon: '🔔', label: 'Needs approval' },
  blocked: { icon: '🚫', label: 'Blocked' },
  flagged: { icon: '⚠️', label: 'Flagged' },
};

export default function Autopilot() {
  const { user } = useAuthStore();
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
    } finally { setLoading(false); }
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
      toast.success(`Scanned — ${(res.actions || []).length} invoice(s)`);
      loadData();
    } catch (err) {
      toast.error('Scan failed: ' + err.message);
    } finally { setScanning(false); }
  };

  const openEdit = (p) => {
    setEditAddr(p.address);
    setEditScore(p.trustScore.toString());
    setEditReason(p.overrideReason || '');
  };

  const handleSaveOverride = async () => {
    const score = parseInt(editScore);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error('Score phải từ 0–100');
      return;
    }
    try {
      await autopilotApi.setOverride(user.address, editAddr, score, editReason);
      toast.success('Trust score updated');
      setEditAddr(null);
      loadData();
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const handleRemoveOverride = async (addr) => {
    try {
      await autopilotApi.removeOverride(user.address, addr);
      toast.success('Override removed — reverted to AI score');
      loadData();
    } catch (err) { toast.error('Failed: ' + err.message); }
  };

  const shortAddr = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '???';
  const trustColor = (level) => TRUST_COLORS[level] || TRUST_COLORS.unknown;

  return (
    <div className="ap-page">
      {/* Header */}
      <div className="ap-header">
        <div>
          <h1 className="ap-title">🤖 Autopilot</h1>
          <p className="ap-subtitle">AI tự đánh giá trust score từ lịch sử giao dịch</p>
        </div>
        <button className="ap-scan-btn" onClick={handleScan} disabled={scanning}>
          {scanning ? '⏳ Analyzing...' : '🔍 Scan & Evaluate'}
        </button>
      </div>

      {/* OnLatch */}
      <div className={`ap-latch-bar ${latchStatus?.enabled ? 'ap-latch-on' : 'ap-latch-off'}`}>
        <span className="ap-latch-dot" />
        <span className="ap-latch-text">
          OnLatch: {latchStatus?.enabled ? `Connected (${latchStatus.tokenPrefix})` : 'Not configured'}
        </span>
      </div>

      {/* Tabs */}
      <div className="ap-tabs">
        {[
          { id: 'trust', label: '🧠 All Contacts', count: trustProfiles.length },
          { id: 'actions', label: '⚡ Scan Results', count: actions.length },
          { id: 'activity', label: '📋 Activity', count: activity.length },
        ].map(t => (
          <button key={t.id} className={`ap-tab ${tab === t.id ? 'ap-tab-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label} {t.count > 0 && <span className="ap-tab-badge">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Trust Profiles (Table Layout) ── */}
      {tab === 'trust' && (
        <div className="ap-section">
          {trustProfiles.length === 0 && !loading && (
            <div className="ap-empty">
              <p>🧠 Chưa có dữ liệu.</p>
              <p className="ap-empty-hint">Click "Scan & Evaluate" để AI phân tích lịch sử.</p>
            </div>
          )}

          {trustProfiles.length > 0 && (
            <div className="ap-table-wrap">
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Trust Score</th>
                    <th>Level</th>
                    <th>Transactions</th>
                    <th>Avg Amount</th>
                    <th>Pattern</th>
                    <th>Recommendation</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trustProfiles.map((p, i) => (
                    <tr key={i} className={editAddr === p.address ? 'ap-row-editing' : ''}>
                      <td className="ap-cell-addr">
                        <span className="ap-addr-dot" style={{ background: trustColor(p.trustLevel) }} />
                        <span className="ap-addr-text" title={p.address}>{shortAddr(p.address)}</span>
                        {p.isOverridden && <span className="ap-override-badge" title={`Override: ${p.overrideReason}`}>✏️</span>}
                      </td>

                      <td className="ap-cell-score">
                        {editAddr === p.address ? (
                          <input
                            type="number" min="0" max="100"
                            className="ap-score-input"
                            value={editScore}
                            onChange={e => setEditScore(e.target.value)}
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
                          {p.recommendation === 'auto_pay' ? '✅ Auto' : p.recommendation === 'notify' ? '🔔 Notify' : '✋ Manual'}
                        </span>
                      </td>

                      <td className="ap-cell-actions">
                        {editAddr === p.address ? (
                          <>
                            <input
                              className="ap-reason-input"
                              placeholder="Lý do (VD: wallet bị hack)"
                              value={editReason}
                              onChange={e => setEditReason(e.target.value)}
                            />
                            <button className="ap-btn-save" onClick={handleSaveOverride}>✓</button>
                            <button className="ap-btn-cancel" onClick={() => setEditAddr(null)}>✕</button>
                          </>
                        ) : (
                          <>
                            <button className="ap-btn-edit" onClick={() => openEdit(p)} title="Sửa trust score">✏️</button>
                            {p.isOverridden && (
                              <button className="ap-btn-revert" onClick={() => handleRemoveOverride(p.address)} title="Revert to AI score">↩️</button>
                            )}
                          </>
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
              <p>Chưa có kết quả scan.</p>
              <p className="ap-empty-hint">Click "Scan & Evaluate" để quét invoice mới.</p>
            </div>
          )}
          <div className="ap-activity-list">
            {actions.map((a, i) => {
              const cfg = ACTION_CONFIG[a.action] || { icon: '📌', label: a.action };
              return (
                <div key={i} className={`ap-activity-item ap-activity-${a.action}`}>
                  <span className="ap-activity-icon">{cfg.icon}</span>
                  <div className="ap-activity-content">
                    <p className="ap-activity-text"><strong>{cfg.label}</strong> — {a.reason}</p>
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
            <div className="ap-empty"><p>Chưa có hoạt động nào.</p></div>
          )}
          <div className="ap-activity-list">
            {activity.map((log, i) => {
              const action = log.output?.action || log.action;
              const cfg = ACTION_CONFIG[action] || { icon: '📌', label: action };
              return (
                <div key={i} className={`ap-activity-item ap-activity-${action}`}>
                  <span className="ap-activity-icon">{cfg.icon}</span>
                  <div className="ap-activity-content">
                    <p className="ap-activity-text"><strong>{cfg.label}</strong> — {log.output?.reason || 'No details'}</p>
                    <p className="ap-activity-meta">
                      {log.output?.sender && shortAddr(log.output.sender)}
                      {log.output?.amount && ` · $${log.output.amount}`}
                      {log.output?.trustScore !== undefined && ` · Trust: ${log.output.trustScore}`}
                      {log.created_at && ` · ${new Date(log.created_at).toLocaleString()}`}
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
