import { useMemo } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS } from '../utils/constants';

/**
 * Minimal ABIs — only the functions we actually call from the frontend.
 * Full ABIs are in the compiled contract artifacts.
 */
const INVOICE_FACTORY_ABI = [
  'function createInvoice(address recipient, bytes32 dataHash, uint256 amount, address token, uint256 dueDate) external returns (uint256)',
  'function payInvoice(uint256 invoiceId) external payable',
  'function updateStatus(uint256 invoiceId, uint8 newStatus) external',
  'function getInvoice(uint256 invoiceId) external view returns (tuple(uint256 id, address creator, address recipient, bytes32 dataHash, uint256 amount, address token, uint256 dueDate, uint8 status, uint256 createdAt, uint256 paidAt))',
  'function getInvoicesByCreator(address creator) external view returns (uint256[])',
  'function getInvoicesByRecipient(address recipient) external view returns (uint256[])',
  'function verifyData(uint256 invoiceId, bytes data) external view returns (bool)',
  'function nextInvoiceId() external view returns (uint256)',
  'event InvoiceCreated(uint256 indexed id, address indexed creator, address indexed recipient, bytes32 dataHash, uint256 amount, address token)',
  'event InvoicePaid(uint256 indexed id, address indexed payer, uint256 amount)',
  'event InvoiceStatusUpdated(uint256 indexed id, uint8 oldStatus, uint8 newStatus)',
];

const ESCROW_VAULT_ABI = [
  'function deposit(uint256 invoiceId) external payable',
  'function release(uint256 invoiceId) external',
  'function refund(uint256 invoiceId) external',
  'function dispute(uint256 invoiceId) external',
  'function getEscrow(uint256 invoiceId) external view returns (tuple(uint256 invoiceId, address depositor, address beneficiary, uint256 amount, uint8 status, uint256 depositedAt, uint256 deadline))',
  'event EscrowDeposited(uint256 indexed invoiceId, address indexed depositor, uint256 amount)',
  'event EscrowReleased(uint256 indexed invoiceId, address indexed beneficiary, uint256 amount)',
];

/**
 * useContract hook — provides contract instances connected to the user's signer.
 *
 * @param {ethers.Signer|null} signer — from wallet provider
 * @param {ethers.Provider|null} provider — fallback for read-only calls
 */
export default function useContract(signer, provider) {
  const signerOrProvider = signer || provider;

  const invoiceFactory = useMemo(() => {
    if (!signerOrProvider || !CONTRACTS.invoiceFactory) return null;
    return new ethers.Contract(CONTRACTS.invoiceFactory, INVOICE_FACTORY_ABI, signerOrProvider);
  }, [signerOrProvider]);

  const escrowVault = useMemo(() => {
    if (!signerOrProvider || !CONTRACTS.escrowVault) return null;
    return new ethers.Contract(CONTRACTS.escrowVault, ESCROW_VAULT_ABI, signerOrProvider);
  }, [signerOrProvider]);

  return {
    invoiceFactory,
    escrowVault,
    /** True when at least one contract address is configured */
    isReady: !!(invoiceFactory || escrowVault),
  };
}

