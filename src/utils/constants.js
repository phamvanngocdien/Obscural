/**
 * App constants for the Obscural platform.
 */

// ── Network ──
export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_RPC = 'https://rpc.sepolia.org';
export const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

// ── Contract Addresses (Sepolia — will be updated after deploy) ──
export const CONTRACTS = {
  invoiceFactory: import.meta.env.VITE_INVOICE_FACTORY_ADDRESS || '',
  escrowVault: import.meta.env.VITE_ESCROW_VAULT_ADDRESS || '',
  billSplitter: import.meta.env.VITE_BILL_SPLITTER_ADDRESS || '',
};

// ── Supported Tokens ──
export const TOKENS = {
  ETH: {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    address: '0x0000000000000000000000000000000000000000',
    icon: '⟠',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    address: '', // Sepolia USDC address
    icon: '💲',
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai',
    decimals: 18,
    address: '', // Sepolia DAI address
    icon: '◈',
  },
};

export const TOKEN_OPTIONS = Object.values(TOKENS).map((t) => ({
  value: t.symbol,
  label: t.symbol,
  icon: t.icon,
}));

// ── Invoice Status ──
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  DISPUTED: 'disputed',
};

export const STATUS_CONFIG = {
  [INVOICE_STATUS.DRAFT]: { label: 'Draft', variant: 'default', color: 'var(--text-tertiary)' },
  [INVOICE_STATUS.SENT]: { label: 'Sent', variant: 'info', color: 'var(--color-primary)' },
  [INVOICE_STATUS.PAID]: { label: 'Paid', variant: 'success', color: 'var(--color-success)' },
  [INVOICE_STATUS.OVERDUE]: { label: 'Overdue', variant: 'error', color: 'var(--color-error)' },
  [INVOICE_STATUS.CANCELLED]: { label: 'Cancelled', variant: 'default', color: 'var(--text-tertiary)' },
  [INVOICE_STATUS.DISPUTED]: { label: 'Disputed', variant: 'warning', color: 'var(--color-warning)' },
};

// ── Transaction Types ──
export const TX_TYPES = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
};

export const TX_CATEGORIES = {
  INVOICE_PAYMENT: 'invoice_payment',
  ESCROW_DEPOSIT: 'escrow_deposit',
  ESCROW_RELEASE: 'escrow_release',
  ESCROW_REFUND: 'escrow_refund',
  BILL_SPLIT_PAY: 'bill_split_pay',
  BILL_SPLIT_RECEIVE: 'bill_split_receive',
};

export const TX_CATEGORY_LABELS = {
  [TX_CATEGORIES.INVOICE_PAYMENT]: 'Invoice Payment',
  [TX_CATEGORIES.ESCROW_DEPOSIT]: 'Escrow Deposit',
  [TX_CATEGORIES.ESCROW_RELEASE]: 'Escrow Release',
  [TX_CATEGORIES.ESCROW_REFUND]: 'Escrow Refund',
  [TX_CATEGORIES.BILL_SPLIT_PAY]: 'Pay Bill Split',
  [TX_CATEGORIES.BILL_SPLIT_RECEIVE]: 'Receive Bill Split',
};

// ── Agent Types ──
export const AGENTS = {
  CREATOR: 'creator',
  REMINDER: 'reminder',
  SPLITTER: 'splitter',
  ANALYST: 'analyst',
};

export const AGENT_CONFIG = {
  [AGENTS.CREATOR]: {
    name: 'AI Creator',
    icon: '🤖',
    description: 'Create invoices from natural language descriptions',
    permissions: { canReadContacts: true, canSignTx: false, canSendEmail: false },
  },
  [AGENTS.REMINDER]: {
    name: 'Auto Reminder',
    icon: '🔔',
    description: 'Automatically send payment reminders via email',
    permissions: { canReadContacts: false, canSignTx: false, canSendEmail: true },
  },
  [AGENTS.SPLITTER]: {
    name: 'Smart Splitter',
    icon: '✂️',
    description: 'Smart bill splitting with AI suggestions',
    permissions: { canSignTx: true, maxTxAmount: '0.5', canSendEmail: false },
  },
  [AGENTS.ANALYST]: {
    name: 'Cash Flow Analyst',
    icon: '📊',
    description: 'Analyze cash flow and provide financial insights',
    permissions: { canReadData: true, canSignTx: false, canSendEmail: false },
  },
};

// ── Escrow ──
export const ESCROW_TIMEOUT_DAYS = 7;
export const DISPUTE_WINDOW_DAYS = 3;

// ── API ──
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
