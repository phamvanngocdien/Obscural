import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { QRCodeSVG } from 'qrcode.react';
import { ethers } from 'ethers';
import { Spinner, toast } from '../components/common';
import useAuthStore from '../store/authStore';
import useI18nStore from '../store/i18nStore';
import useWallet from '../hooks/useWallet';
import api from '../services/api';
import { fetchLiveEthPrice, formatInvoiceDisplay } from '../utils/currency';
import '../styles/InvoiceList.css';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const wallet = useWallet();
  const { t, locale } = useI18nStore();

  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [isPayingOnChain, setIsPayingOnChain] = useState(false);
  const [ethPrice, setEthPrice] = useState(2480);

  useEffect(() => {
    fetchLiveEthPrice().then((p) => {
      if (p > 0) setEthPrice(p);
    });
  }, []);

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

  const updateInvoiceStatus = async (newStatus, extraFields = {}) => {
    if (!inv) return;
    setProcessingAction(true);
    try {
      const updated = { ...inv, status: newStatus, ...extraFields };
      await api.invoiceApi.update(inv.id, { status: newStatus, ...extraFields });
      setInv(updated);
      toast.success(t('detail.statusUpdated', 'Invoice status updated!'));
    } catch (err) {
      console.error('Failed to update invoice status:', err);
      toast.error('Failed to update invoice status on server');
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePayOnChain = async () => {
    if (!inv) return;

    if (!wallet.isConnected) {
      toast.info(locale === 'vi' ? 'Vui lòng kết nối ví để thanh toán on-chain!' : 'Please connect your wallet to pay on-chain!');
      wallet.openConnectModal?.();
      return;
    }

    const targetPayoutAddress =
      inv.from_data?.walletAddress ||
      (inv.creator_id && inv.creator_id.startsWith('0x') ? inv.creator_id : null) ||
      inv.from?.walletAddress;

    if (!targetPayoutAddress || !targetPayoutAddress.startsWith('0x') || targetPayoutAddress.length < 20) {
      toast.error(locale === 'vi' ? 'Người tạo hóa đơn chưa cung cấp địa chỉ ví Ethereum hợp lệ để nhận tiền!' : 'Issuer has not provided a valid Ethereum wallet address to receive funds!');
      return;
    }

    if (!wallet.signer) {
      toast.error(locale === 'vi' ? 'Ví chưa sẵn sàng để ký giao dịch. Vui lòng tải lại trang hoặc kết nối lại ví.' : 'Wallet signer not ready. Please reconnect wallet.');
      return;
    }

    // Determine ETH amount
    let ethToSend = 0;
    if (inv.currency === 'ETH') {
      ethToSend = parseFloat(inv.amount || inv.total || 0);
    } else {
      const fiatTotal = parseFloat(inv.amount || inv.total || 0);
      ethToSend = parseFloat((fiatTotal / (ethPrice || 2600)).toFixed(6));
    }

    if (isNaN(ethToSend) || ethToSend <= 0) {
      toast.error(locale === 'vi' ? 'Số tiền thanh toán không hợp lệ!' : 'Invalid payment amount!');
      return;
    }

    const currentBalance = parseFloat(wallet.balance || 0);
    if (currentBalance < ethToSend) {
      toast.error(
        locale === 'vi'
          ? `Số dư không đủ! Ví bạn có ${currentBalance.toFixed(4)} ETH, cần thanh toán ${ethToSend} ETH (+ phí gas).`
          : `Insufficient balance! You have ${currentBalance.toFixed(4)} ETH, required: ${ethToSend} ETH.`
      );
      return;
    }

    setIsPayingOnChain(true);
    toast.info(
      locale === 'vi'
        ? `Đang mở ví... Vui lòng ký xác nhận chuyển ${ethToSend} ETH tới người nhận.`
        : `Opening wallet... Please confirm transfer of ${ethToSend} ETH.`
    );

    try {
      if (wallet.switchToSepolia && !wallet.isCorrectNetwork) {
        try {
          await wallet.switchToSepolia();
        } catch {
          // continue
        }
      }

      // Execute on-chain transfer
      const tx = await wallet.signer.sendTransaction({
        to: targetPayoutAddress,
        value: ethers.parseEther(ethToSend.toString()),
      });

      toast.info(
        locale === 'vi'
          ? `Giao dịch đã được gửi lên Sepolia (Tx: ${tx.hash.slice(0, 10)}...). Đang chờ xác nhận trên blockchain...`
          : `Transaction sent to Sepolia (Tx: ${tx.hash.slice(0, 10)}...). Awaiting confirmation...`
      );

      // Wait for blockchain confirmation
      await tx.wait(1);

      // Save on-chain hash and status to Supabase
      const updated = {
        ...inv,
        status: 'paid',
        tx_hash: tx.hash,
      };

      await api.invoiceApi.update(inv.id, {
        status: 'paid',
        tx_hash: tx.hash,
      });

      setInv(updated);
      wallet.refreshBalance?.();

      toast.success(
        locale === 'vi'
          ? `Thanh toán On-chain thành công! Tiền đã được chuyển vào ví người nhận. Mã Tx: ${tx.hash.slice(0, 8)}...`
          : `On-chain payment successful! Funds sent to recipient. Tx: ${tx.hash.slice(0, 8)}...`
      );
    } catch (err) {
      console.error('On-chain payment error:', err);
      const errMsg = err?.reason || err?.message || '';
      if (errMsg.includes('user rejected') || errMsg.includes('ACTION_REJECTED') || errMsg.includes('rejected')) {
        toast.info(locale === 'vi' ? 'Bạn đã hủy xác nhận giao dịch trên ví.' : 'Transaction cancelled in wallet.');
      } else {
        toast.error(
          locale === 'vi'
            ? `Thanh toán on-chain thất bại: ${errMsg.slice(0, 90)}`
            : `Payment failed: ${errMsg.slice(0, 90)}`
        );
      }
    } finally {
      setIsPayingOnChain(false);
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
      const pdfFrom = inv.from_data || inv.from || { name: inv.creator_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.creator_id };
      const pdfTo = inv.to_data || inv.to || { name: inv.recipient_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.recipient_id };
      const pdfItems = inv.items || [{ description: inv.title || 'Invoice Payment', quantity: 1, price: parseFloat(inv.amount) || 0 }];
      const pdfSubtotal = inv.subtotal || pdfItems.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 0), 0);
      const pdfTaxAmount = inv.tax_amount || inv.taxAmount || 0;
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

  const fromData = inv.from_data || inv.from || { name: inv.creator_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.creator_id };
  const toData = inv.to_data || inv.to || { name: inv.recipient_id?.slice(0, 8) || '', email: '', address: '', walletAddress: inv.recipient_id };
  const itemsList = inv.items || [{ description: inv.title || 'Invoice Payment', quantity: 1, price: parseFloat(inv.amount) || 0 }];
  const subtotal = inv.subtotal || itemsList.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.quantity) || 0), 0);
  const taxAmount = inv.tax_amount || inv.taxAmount || 0;
  const total = inv.total || parseFloat(inv.amount) || subtotal + taxAmount;
  const noteText = inv.note || '';
  const currency = inv.currency || 'USD';

  // Valid on-chain payout wallet address for QR and payments (pays the creator/seller)
  const payWallet =
    fromData.walletAddress ||
    (inv.creator_id && inv.creator_id.startsWith('0x') ? inv.creator_id : null) ||
    toData.walletAddress ||
    '';

  const userAddr = user?.address?.toLowerCase();
  const userEmail = user?.email?.toLowerCase();
  const isRecipient = Boolean(
    (userAddr && (inv.recipient_id?.toLowerCase() === userAddr || toData.walletAddress?.toLowerCase() === userAddr)) ||
    (userEmail && toData.email?.toLowerCase() === userEmail)
  );
  const isCreator = !isRecipient;

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
            title={isRecipient ? (locale === 'vi' ? 'Quét mã thanh toán' : 'Scan to Pay') : (locale === 'vi' ? 'Mã QR nhận tiền' : 'Receive QR')}
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
            {isRecipient ? (locale === 'vi' ? 'Thanh toán QR' : 'Pay QR') : (locale === 'vi' ? 'QR Nhận tiền' : 'Receive QR')}
          </button>
        </div>
      </div>

      <div className="id-card">
        {/* Role identification banner */}
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: 'var(--space-4)',
            background: isRecipient ? 'rgba(245, 158, 11, 0.1)' : 'rgba(139, 92, 246, 0.1)',
            border: isRecipient ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{isRecipient ? '💳' : '📄'}</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: isRecipient ? '#FBBF24' : '#C4B5FD' }}>
                {isRecipient
                  ? (locale === 'vi' ? 'Hóa đơn gửi tới bạn (Bên thanh toán)' : 'Invoice sent to you (Payer)')
                  : (locale === 'vi' ? 'Hóa đơn do bạn tạo (Bên thụ hưởng)' : 'Invoice created by you (Payee)')}
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(220, 220, 240, 0.8)' }}>
                {isRecipient
                  ? (inv.status === 'paid'
                      ? (locale === 'vi' ? 'Bạn đã thanh toán thành công hóa đơn này.' : 'You have paid this invoice.')
                      : (locale === 'vi' ? `Bạn cần thanh toán cho ${fromData.name || 'người gửi'} số tiền này.` : `Please pay this amount to ${fromData.name || 'the issuer'}.`))
                  : (inv.status === 'paid'
                      ? (locale === 'vi' ? 'Hóa đơn đã được đối tác quyết toán thành công.' : 'Invoice has been fully settled by client.')
                      : (locale === 'vi' ? `Khoản tiền đang chờ ${toData.name || 'khách hàng'} thanh toán.` : `Waiting for payment from ${toData.name || 'client'}.`))}
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              background: isRecipient ? 'rgba(245, 158, 11, 0.2)' : 'rgba(139, 92, 246, 0.2)',
              color: isRecipient ? '#FDE68A' : '#EDE9FE',
              border: isRecipient ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(139, 92, 246, 0.4)',
            }}
          >
            {isRecipient ? (locale === 'vi' ? 'Bên thanh toán' : 'Payer') : (locale === 'vi' ? 'Người tạo hóa đơn' : 'Issuer')}
          </span>
        </div>

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
            <span>{subtotal.toFixed ? subtotal.toFixed(2) : subtotal} USDC</span>
          </div>
          <div className="id-summary-row">
            <span>{t('invoiceDetail.tax')} ({inv.taxPercent || 0}%):</span>
            <span>{taxAmount.toFixed ? taxAmount.toFixed(2) : taxAmount} USDC</span>
          </div>
          <div className="id-summary-row id-summary-total">
            <span>{t('invoiceDetail.total')}:</span>
            {(() => {
              const display = formatInvoiceDisplay(inv, ethPrice);
              if (display.cryptoStr) {
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px' }}>
                    <span style={{ fontWeight: 800 }}>{display.usdcStr}</span>
                    <span style={{ fontSize: '13px', color: '#8B7AFF', fontWeight: 600 }}>({display.cryptoStr})</span>
                  </span>
                );
              }
              return <span>{display.usdcStr}</span>;
            })()}
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

        {/* On-Chain Receipt Badge if paid on-chain */}
        {inv.tx_hash && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(93, 228, 199, 0.08)',
              border: '1px solid rgba(93, 228, 199, 0.25)',
              borderRadius: '10px',
              marginBottom: 'var(--space-4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(220, 220, 240, 0.9)', display: 'block' }}>
                  {locale === 'vi' ? 'Biên lai giao dịch On-chain Ethereum Sepolia:' : 'On-Chain Sepolia Receipt:'}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#5DE4C7' }}>
                  {inv.tx_hash}
                </span>
              </div>
            </div>
            <a
              href={`https://sepolia.etherscan.io/tx/${inv.tx_hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#5DE4C7',
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{locale === 'vi' ? 'Xem trên Sepolia Etherscan ↗' : 'View on Sepolia Etherscan ↗'}</span>
            </a>
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
            isRecipient ? (
              // Actions for Recipient (Payer - Dienpham)
              <>
                <button
                  className="btn btn-primary"
                  style={{
                    flex: 2,
                    minWidth: '220px',
                    padding: '12px 18px',
                    fontWeight: 700,
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    border: 'none',
                    color: '#FFFFFF',
                  }}
                  onClick={handlePayOnChain}
                  disabled={isPayingOnChain || processingAction}
                >
                  {isPayingOnChain ? (
                    <span>⏳ {locale === 'vi' ? 'Đang chuyển tiền on-chain...' : 'Processing Payment...'}</span>
                  ) : (
                    <span>⚡ {locale === 'vi' ? 'Thanh toán On-chain (Ký ví)' : 'Pay On-Chain (1-Click)'}</span>
                  )}
                </button>

                <button
                  className="btn"
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    padding: '10px 16px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    color: '#22D3EE',
                    fontWeight: 600,
                  }}
                  onClick={() => setShowQrModal(true)}
                  disabled={isPayingOnChain || processingAction}
                >
                  <span>📱 {locale === 'vi' ? 'Quét QR' : 'Scan QR'}</span>
                </button>

                <button
                  className="btn"
                  style={{
                    flex: 1,
                    minWidth: '140px',
                    padding: '10px 16px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(139, 92, 246, 0.35)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onClick={() => {
                    toast.success(`Escrow safety vault initiated for ${inv.amount || total} ${currency}!`);
                    updateInvoiceStatus('sent');
                  }}
                  disabled={isPayingOnChain || processingAction}
                >
                  <span>🛡️ {t('invoiceDetail.escrowDeposit')}</span>
                </button>

                <button
                  className="btn"
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'rgba(220, 220, 240, 0.75)',
                    fontSize: '11px',
                  }}
                  onClick={() => updateInvoiceStatus('paid')}
                  disabled={isPayingOnChain || processingAction}
                  title={locale === 'vi' ? 'Đã tự chuyển khoản ngoài app' : 'Mark paid manually'}
                >
                  <span>✓ {locale === 'vi' ? 'Đã chuyển thủ công' : 'Paid Manually'}</span>
                </button>
              </>
            ) : (
              // Actions for Creator (Payee / Seller - Luck)
              <>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, minWidth: '160px', padding: '10px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => updateInvoiceStatus('paid')}
                  disabled={processingAction}
                >
                  <span>✓ {locale === 'vi' ? 'Xác nhận đã nhận tiền' : 'Mark as Received / Paid'}</span>
                </button>

                <button
                  className="btn"
                  style={{
                    flex: 1,
                    minWidth: '160px',
                    padding: '10px 16px',
                    background: 'rgba(6, 182, 212, 0.15)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    color: '#22D3EE',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                  onClick={() => {
                    toast.success(locale === 'vi' ? `Đã gửi lời nhắc thanh toán tới ${toData.name || 'người nhận'}!` : 'Payment reminder sent!');
                  }}
                  disabled={processingAction}
                >
                  <span>🔔 {locale === 'vi' ? 'Nhắc thanh toán' : 'Send Reminder'}</span>
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
            )
          ) : (
            <div
              style={{
                width: '100%',
                padding: '16px',
                background: 'rgba(93, 228, 199, 0.1)',
                border: '1px solid rgba(93, 228, 199, 0.25)',
                borderRadius: '8px',
                color: '#5DE4C7',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              <div>
                ✓ {isRecipient
                  ? (locale === 'vi' ? 'Hóa đơn đã được bạn thanh toán thành công.' : 'You have completed payment for this invoice.')
                  : (locale === 'vi' ? 'Hóa đơn đã được thanh toán. Bạn đã nhận được tiền.' : 'Payment received. Invoice is fully settled.')}
              </div>
              {inv.tx_hash && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>
                  <span>{locale === 'vi' ? 'Mã Tx: ' : 'Tx Hash: '}</span>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${inv.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#5DE4C7', textDecoration: 'underline', fontFamily: 'monospace', fontWeight: 600 }}
                  >
                    {inv.tx_hash.slice(0, 10)}...{inv.tx_hash.slice(-8)} ↗
                  </a>
                </div>
              )}
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
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', marginBottom: '4px' }}>
              {isRecipient
                ? (locale === 'vi' ? 'Quét mã để thanh toán' : 'Scan to Pay')
                : (locale === 'vi' ? 'Mã QR nhận tiền của bạn' : 'Your Payment QR Code')}
            </h3>
            <p style={{ fontSize: '12px', color: 'rgba(240, 240, 245, 0.85)', marginBottom: '16px' }}>
              {isRecipient
                ? (locale === 'vi' ? `Thanh toán cho ${fromData.name || 'người bán'}: ` : 'Pay to issuer: ')
                : (locale === 'vi' ? 'Số tiền yêu cầu: ' : 'Amount due: ')}
              <strong style={{ color: '#5DE4C7' }}>${typeof total === 'number' ? total.toFixed(2) : total} {currency}</strong>
            </p>

            <div style={{ background: '#FFFFFF', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '16px' }}>
              <QRCodeSVG value={payWallet} size={180} bgColor="#FFFFFF" fgColor="#1F1F1F" level="M" />
            </div>

            <div style={{ background: 'rgba(255,255,255,0.06)', padding: '10px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '10px', color: 'rgba(200, 200, 220, 0.75)', display: 'block', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.05em' }}>
                {locale === 'vi' ? 'Địa chỉ ví nhận tiền (Người thụ hưởng)' : 'Payout Wallet Address (Payee)'}
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
