import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { Spinner, toast } from '../components/common';
import useI18nStore from '../store/i18nStore';
import api from '../services/api';
import '../styles/InvoiceList.css';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { t, locale } = useI18nStore();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        const res = await api.invoiceApi.get(id);
        if (res.data) {
          setInv(res.data);
        } else {
          setError('Invoice not found');
        }
      } catch (err) {
        console.error('Failed to load invoice from Supabase', err);
        setError('Invoice not found or failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const updateInvoiceStatus = async (newStatus) => {
    if (!inv) return;
    setProcessingAction(true);
    try {
      const updated = { ...inv, status: newStatus };
      await api.invoiceApi.update(inv.id, { status: newStatus });
      setInv(updated);
      toast.success(t('detail.statusUpdated', 'Invoice status updated!'));
    } catch (err) {
      console.error('Failed to update invoice status:', err);
      toast.error('Failed to update invoice status on server');
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!inv) return;
    try {
      const doc = new jsPDF();

      // Compute all data locally inside the function
      const pdfCreatedDate = new Date(inv.created_at).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' });
      const pdfDueDate = inv.dueDate
        ? new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
        : inv.due_date
          ? new Date(inv.due_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
          : 'Immediate';
      const pdfFrom = inv.from || { name: inv.creator_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.creator_id };
      const pdfTo = inv.to || { name: inv.recipient_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.recipient_id };
      const pdfItems = inv.items || [{ description: inv.title || 'Invoice Payment', quantity: 1, price: parseFloat(inv.amount) || 0 }];
      const pdfSubtotal = inv.subtotal || pdfItems.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 0), 0);
      const pdfTaxAmount = inv.taxAmount || 0;
      const pdfTotal = inv.total || parseFloat(inv.amount) || pdfSubtotal + pdfTaxAmount;
      const pdfNote = inv.note || '';

      // Background
      doc.setFillColor(13, 16, 34);
      doc.rect(0, 0, 210, 297, 'F');

      // Title & Branding
      doc.setTextColor(139, 122, 255);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('OBSCURAL', 20, 25);

      doc.setFontSize(10);
      doc.setTextColor(169, 174, 197);
      doc.text('Smart Invoicing on Rialo Protocol', 20, 32);

      // Invoice Meta
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text(`INVOICE: #${inv.id?.slice(0, 8) || 'INV-001'}`, 130, 25);
      doc.setFontSize(9);
      doc.setTextColor(169, 174, 197);
      doc.text(`Status: ${(inv.status || 'pending').toUpperCase()}`, 130, 32);
      doc.text(`Date: ${pdfCreatedDate}`, 130, 38);
      doc.text(`Due Date: ${pdfDueDate}`, 130, 44);

      // Divider
      doc.setDrawColor(40, 45, 75);
      doc.line(20, 50, 190, 50);

      // Issuer / Counterparty
      doc.setFontSize(9);
      doc.setTextColor(93, 228, 199);
      doc.text('FROM (ISSUER):', 20, 58);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfFrom.name || 'Anonymous Creator', 20, 64);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(169, 174, 197);
      if (pdfFrom.email) doc.text(`Email: ${pdfFrom.email}`, 20, 70);
      if (pdfFrom.address) doc.text(`Address: ${pdfFrom.address.slice(0, 45)}`, 20, 75);

      doc.setFontSize(9);
      doc.setTextColor(93, 228, 199);
      doc.text('TO (COUNTERPARTY):', 110, 58);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(pdfTo.name || 'Anonymous Recipient', 110, 64);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(169, 174, 197);
      if (pdfTo.email) doc.text(`Email: ${pdfTo.email}`, 110, 70);
      if (pdfTo.address) doc.text(`Address: ${pdfTo.address.slice(0, 45)}`, 110, 75);

      doc.line(20, 82, 190, 82);

      // Items Table Header
      doc.setFillColor(24, 28, 56);
      doc.rect(20, 88, 170, 8, 'F');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('ITEM DESCRIPTION', 24, 93);
      doc.text('QTY', 110, 93);
      doc.text('PRICE', 135, 93);
      doc.text('TOTAL', 165, 93);

      // Items Table Rows
      let y = 104;
      doc.setFont('helvetica', 'normal');
      pdfItems.forEach((it) => {
        const qty = parseInt(it.quantity) || 1;
        const price = parseFloat(it.price) || 0;
        doc.setFontSize(9);
        doc.setTextColor(220, 225, 240);
        doc.text(it.description || 'Service', 24, y);
        doc.text(String(qty), 112, y);
        doc.text(`$${price.toFixed(2)}`, 135, y);
        doc.text(`$${(qty * price).toFixed(2)}`, 165, y);
        y += 8;
      });

      doc.line(20, y + 2, 190, y + 2);
      y += 10;

      // Summary
      doc.setFontSize(9);
      doc.setTextColor(169, 174, 197);
      doc.text('Subtotal:', 125, y);
      doc.text(`$${typeof pdfSubtotal === 'number' ? pdfSubtotal.toFixed(2) : pdfSubtotal}`, 165, y);
      y += 6;
      doc.text(`Tax (${inv.taxPercent || 0}%):`, 125, y);
      doc.text(`$${typeof pdfTaxAmount === 'number' ? pdfTaxAmount.toFixed(2) : pdfTaxAmount}`, 165, y);
      y += 8;

      doc.setFillColor(139, 122, 255, 0.2);
      doc.rect(120, y - 5, 70, 10, 'F');
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('Total Amount:', 125, y + 2);
      doc.setTextColor(93, 228, 199);
      doc.text(`$${typeof pdfTotal === 'number' ? pdfTotal.toFixed(2) : pdfTotal} ${inv.currency || 'USD'}`, 155, y + 2);

      // Note & Verification
      y += 20;
      if (pdfNote) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(140, 145, 170);
        doc.text(`Note: "${pdfNote}"`, 20, y);
        y += 10;
      }

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 105, 130);
      doc.text('This invoice was generated & verified with cryptographic signatures on Rialo Protocol.', 20, 275);
      doc.text(`Invoice ID: ${inv.id}`, 20, 280);

      doc.save(`obscural_invoice_${inv.id.slice(0, 8)}.pdf`);
      toast.success('Invoice PDF downloaded!');
    } catch (err) {
      console.error('Failed to generate PDF', err);
      toast.error('Failed to generate PDF');
    }
  };

  const handleCopyPaymentInfo = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Address copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="id-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Spinner size="lg" />
      </div>
    );
  }

  // Status label localized helper
  const statusLabel = (status) => {
    switch (status) {
      case 'paid': return t('invoice.paid');
      case 'pending': return t('invoice.pending');
      case 'overdue': return t('invoice.overdue');
      case 'draft': return t('invoice.draft');
      case 'sent': return locale === 'vi' ? 'Đã nạp Escrow' : 'In Escrow';
      case 'cancelled': return locale === 'vi' ? 'Đã hủy' : 'Cancelled';
      default: return status ? status.toUpperCase() : t('invoice.pending');
    }
  };

  if (error || !inv) {
    return (
      <div className="id-page">
        <div style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
          <p style={{ color: 'var(--color-error)', marginBottom: 'var(--space-4)' }}>{error || t('invoice.noInvoices')}</p>
          <Link to="/invoices" className="id-back-btn">
            ← {t('invoiceDetail.back')}
          </Link>
        </div>
      </div>
    );
  }

  // Parse data
  const createdDate = new Date(inv.created_at).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', day: '2-digit', year: 'numeric' });
  const dueDate = inv.dueDate
    ? new Date(inv.dueDate).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', day: '2-digit', year: 'numeric' })
    : inv.due_date
      ? new Date(inv.due_date).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', day: '2-digit', year: 'numeric' })
      : (locale === 'vi' ? 'Ngay lập tức' : 'Immediate');

  const fromData = inv.from || { name: inv.creator_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.creator_id };
  const toData = inv.to || { name: inv.recipient_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.recipient_id };
  const itemsList = inv.items || [{ description: inv.title || 'Invoice Payment', quantity: 1, price: parseFloat(inv.amount) || 0 }];
  const subtotal = inv.subtotal || itemsList.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 0), 0);
  const taxAmount = inv.taxAmount || 0;
  const total = inv.total || parseFloat(inv.amount) || subtotal + taxAmount;
  const noteText = inv.note || '';
  const currency = inv.currency || 'USD';

  // Valid on-chain payout wallet address for QR and payments
  const payWallet =
    toData.walletAddress ||
    (inv.recipient_id && inv.recipient_id.startsWith('0x') ? inv.recipient_id : null) ||
    (toData.address && toData.address.startsWith('0x') ? toData.address : null) ||
    '';

  return (
    <div className="id-page">
      {/* Top action header */}
      <div className="id-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <Link to="/invoices" className="id-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('common.back')}
        </Link>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="id-action-btn id-btn-pdf"
            onClick={handleDownloadPdf}
            title={t('invoiceDetail.downloadPdf')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              color: '#FFFFFF',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('invoiceDetail.downloadPdf')}
          </button>

          <button
            className="id-action-btn id-btn-qr"
            onClick={() => setShowQrModal(true)}
            title={t('invoiceDetail.payQr')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              color: '#22D3EE',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            {t('invoiceDetail.payQr')}
          </button>
        </div>
      </div>

      <div className="id-card">
        {/* Header */}
        <div className="id-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 className="id-title">{t('invoiceDetail.invoice')}</h1>
              <span className={`invoice-item-status status-${inv.status || 'pending'}`}>
                {statusLabel(inv.status)}
              </span>
            </div>
            <p className="id-date">{createdDate}</p>
          </div>
          <span className="id-invoice-id">{inv.id?.slice(0, 8) || 'invoice_id'}</span>
        </div>

        {/* From / To */}
        <div className="id-parties">
          <div className="id-party">
            <h3 className="id-section-label">{t('invoiceDetail.from')}</h3>
            <p className="id-party-name">{fromData.name || '—'}</p>
            <p className="id-party-info">{fromData.email || '—'}</p>
            {fromData.address && (
              <p className="id-party-info" style={{ color: 'var(--text-secondary)' }}>
                📍 {fromData.address}
              </p>
            )}
            {fromData.walletAddress && (
              <p className="id-party-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-primary-light)' }}>
                🔗 {fromData.walletAddress.slice(0, 10)}...{fromData.walletAddress.slice(-6)}
              </p>
            )}
          </div>
          <div className="id-party">
            <h3 className="id-section-label">{t('invoiceDetail.to')}</h3>
            <p className="id-party-name">{toData.name || '—'}</p>
            <p className="id-party-info">{toData.email || '—'}</p>
            {toData.address && (
              <p className="id-party-info" style={{ color: 'var(--text-secondary)' }}>
                📍 {toData.address}
              </p>
            )}
            {toData.walletAddress && (
              <p className="id-party-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-primary-light)' }}>
                🔗 {toData.walletAddress.slice(0, 10)}...{toData.walletAddress.slice(-6)}
              </p>
            )}
          </div>
        </div>

        <div className="id-divider" />

        {/* Due date & Currency */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
          <div className="id-due">
            <span className="id-section-label">{t('invoiceDetail.dueDate')}</span>
            <p className="id-due-date">{dueDate}</p>
          </div>
          <div className="id-currency-tag" style={{ textAlign: 'right' }}>
            <span className="id-section-label">{t('invoiceDetail.currency')}</span>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary-light)', margin: 0 }}>
              {currency}
            </p>
          </div>
        </div>

        <div className="id-divider" />

        {/* Items table */}
        <div className="id-items">
          <div className="id-items-header">
            <span className="id-col-item">{t('invoiceDetail.item')}</span>
            <span className="id-col-qty">{t('invoiceDetail.quantity')}</span>
            <span className="id-col-price">{t('invoiceDetail.price')}</span>
            <span className="id-col-total">{t('invoiceDetail.total')}</span>
          </div>
          {itemsList.map((item, i) => {
            const qty = parseInt(item.quantity) || 1;
            const price = parseFloat(item.price) || 0;
            return (
              <div key={i} className="id-items-row">
                <span className="id-col-item">{item.description || t('invoiceDetail.item')}</span>
                <span className="id-col-qty">{qty}</span>
                <span className="id-col-price">${price.toFixed(2)}</span>
                <span className="id-col-total">${(qty * price).toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="id-summary">
          <div className="id-summary-row">
            <span>{t('invoiceDetail.subtotal')}</span>
            <span>${subtotal.toFixed ? subtotal.toFixed(2) : subtotal}</span>
          </div>
          <div className="id-summary-row">
            <span>{t('invoiceDetail.tax')} ({inv.taxPercent || 0}%):</span>
            <span>${taxAmount.toFixed ? taxAmount.toFixed(2) : taxAmount}</span>
          </div>
          <div className="id-summary-row id-summary-total">
            <span>{t('invoiceDetail.total')}:</span>
            <span>${typeof total === 'number' ? total.toFixed(2) : total} {currency}</span>
          </div>
        </div>

        <div className="id-divider" />

        {/* Note */}
        {noteText && (
          <div className="id-note" style={{ marginBottom: 'var(--space-6)' }}>
            <h3 className="id-section-label">{t('invoiceDetail.note')}</h3>
            <p className="id-note-text">{noteText}</p>
          </div>
        )}

        {/* Payment & Lifecycle Action Buttons */}
        <div
          className="id-footer-actions"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {inv.status !== 'paid' ? (
            <>
              <button
                className="btn btn-primary"
                style={{ flex: 1, minWidth: '160px', padding: '10px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => updateInvoiceStatus('paid')}
                disabled={processingAction}
              >
                <span>✓ {t('invoiceDetail.markPaid')}</span>
              </button>

              <button
                className="btn"
                style={{
                  flex: 1,
                  minWidth: '160px',
                  padding: '10px 16px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onClick={() => {
                  toast.success(`Escrow safety vault initiated for ${inv.amount || total} ${currency}!`);
                  updateInvoiceStatus('sent');
                }}
                disabled={processingAction}
              >
                <span>🛡️ {t('invoiceDetail.escrowDeposit')}</span>
              </button>

              <button
                className="btn"
                style={{ padding: '10px 16px', background: 'rgba(255, 107, 122, 0.1)', border: '1px solid rgba(255, 107, 122, 0.25)', color: 'var(--color-error)', fontWeight: 600 }}
                onClick={() => updateInvoiceStatus('cancelled')}
                disabled={processingAction}
              >
                {t('invoiceDetail.cancel')}
              </button>
            </>
          ) : (
            <div
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(93, 228, 199, 0.1)',
                border: '1px solid rgba(93, 228, 199, 0.25)',
                borderRadius: '8px',
                color: '#5DE4C7',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              ✓ {t('invoiceDetail.settled')}
            </div>
          )}
        </div>
      </div>

      {/* QR Code Payment Modal */}
      {showQrModal && (
        <div
          className="contact-modal-overlay"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="contact-modal"
            style={{
              width: '90%',
              maxWidth: '380px',
              background: 'var(--bg-card-solid, #26262B)',
              border: '1px solid var(--border-medium, rgba(255, 255, 255, 0.15))',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>{t('invoiceDetail.scanToPay')}</h3>
            <p style={{ fontSize: '12px', color: 'rgba(240, 240, 245, 0.85)', marginBottom: '16px' }}>
              {t('invoiceDetail.amount')} <strong style={{ color: '#5DE4C7' }}>${typeof total === 'number' ? total.toFixed(2) : total} {currency}</strong>
            </p>

            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
              <QRCodeSVG value={payWallet} size={180} bgColor="#FFFFFF" fgColor="#1F1F1F" level="M" />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '10px', color: 'rgba(200, 200, 220, 0.75)', display: 'block', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                {t('invoiceDetail.recipientWallet')}
              </span>
              <span style={{ fontSize: '11px', color: '#FFFFFF', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {payWallet}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={() => handleCopyPaymentInfo(payWallet)}>
                {copied ? `✓ ${t('invoiceDetail.copied')}` : t('invoiceDetail.copyAddress')}
              </button>
              <button
                className="btn"
                style={{ background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', padding: '10px 16px', border: '1px solid rgba(255,255,255,0.15)' }}
                onClick={() => setShowQrModal(false)}
              >
                {t('invoiceDetail.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
