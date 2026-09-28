import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import { toast } from '../components/common';
import '../styles/InvoiceList.css';

export default function InvoiceList() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        // Load from localStorage
        const localSaved = localStorage.getItem('obscural_local_invoices');
        const localInvoices = localSaved ? JSON.parse(localSaved) : [];

        // Load from API (5s timeout)
        let apiInvoices = [];
        if (user?.address) {
          try {
            const res = await Promise.race([
              api.invoiceApi.list({ userId: user.address }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
            ]);
            apiInvoices = res.data || [];
          } catch (err) {
            console.warn('InvoiceList: API unavailable, using local data.', err.message);
          }
        }

        // Merge: local first, then API (deduplicate by id)
        const seenIds = new Set(localInvoices.map((inv) => inv.id));
        const merged = [...localInvoices];
        apiInvoices.forEach((inv) => {
          if (!seenIds.has(inv.id)) {
            merged.push(inv);
          }
        });

        // Sort by date, newest first
        merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setInvoices(merged);
      } catch (err) {
        console.error('Failed to load invoices', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [user?.address]);

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
    const headers = ['ID', 'Title', 'Recipient', 'Amount', 'Currency', 'Status', 'Due Date', 'Created At'];
    const rows = filteredInvoices.map((inv) => [
      inv.id || '',
      `"${(inv.title || 'Invoice').replace(/"/g, '""')}"`,
      `"${(inv.to?.name || inv.recipient_id || '').replace(/"/g, '""')}"`,
      inv.amount || inv.total || 0,
      inv.currency || 'USD',
      inv.status || 'pending',
      inv.dueDate || inv.due_date || '',
      inv.created_at || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `obscural_invoices_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Invoices exported to CSV!');
  };

  const statusLabel = (status) => {
    if (!status) return 'Pending';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const title = (inv.title || '').toLowerCase();
      const recipient = (inv.to?.name || inv.recipient_id || '').toLowerCase();
      const idStr = (inv.id || '').toLowerCase();
      return title.includes(q) || recipient.includes(q) || idStr.includes(q);
    }
    return true;
  });

  return (
    <div className="invoice-page">
      {/* Fixed top section */}
      <div className="invoice-top-fixed">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
          <h1 className="invoice-page-title" style={{ margin: 0 }}>Invoices</h1>
          <button
            onClick={handleExportCsv}
            title="Export CSV"
            style={{
              background: 'rgba(159, 140, 255, 0.12)',
              border: '1px solid rgba(159, 140, 255, 0.3)',
              color: '#FFFFFF',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
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
          <span>Create Invoice</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '10px 0', alignItems: 'center', width: '100%' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            placeholder="Search by title, recipient or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px 6px 30px',
              fontSize: '11px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              color: '#FFFFFF',
            }}
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#737B9B' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div style={{ display: 'flex', gap: '8px', padding: '4px 0 10px', overflowX: 'auto', width: '100%' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'pending', label: 'Pending' },
          { id: 'paid', label: 'Paid' },
          { id: 'overdue', label: 'Overdue' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            style={{
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '20px',
              cursor: 'pointer',
              border: statusFilter === tab.id ? '1px solid #9F8CFF' : '1px solid rgba(255,255,255,0.08)',
              background: statusFilter === tab.id ? 'rgba(159, 140, 255, 0.2)' : 'rgba(255,255,255,0.03)',
              color: statusFilter === tab.id ? '#FFFFFF' : '#A9AEC5',
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
            <h3 className="invoice-list-heading">My Invoices ({filteredInvoices.length})</h3>
            <div className="invoice-items">
              {filteredInvoices.map((inv) => (
                <Link key={inv.id} to={`/invoices/${inv.id}`} className="invoice-item">
                  <div className="invoice-item-left">
                    <span className="invoice-item-title">{inv.title || `INV-${inv.id.slice(0, 6)}`}</span>
                    <span className="invoice-item-date">{new Date(inv.created_at).toLocaleDateString()}</span>
                    {inv.to?.name && (
                      <span className="invoice-item-recipient">→ {inv.to.name}</span>
                    )}
                  </div>
                  <div className="invoice-item-right">
                    <span className="invoice-item-amount">
                      ${inv.amount || inv.total} {inv.currency || 'USD'}
                    </span>
                    <span className={`invoice-item-status status-${inv.status}`}>
                      {statusLabel(inv.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : !loading ? (
          <div className="invoice-empty">
            <span className="invoice-empty-icon">📄</span>
            <p>No invoices found matching criteria.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
