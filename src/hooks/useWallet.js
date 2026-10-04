import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111

export default function useWallet() {
  const { login, logout, authenticated, ready, user: privyUser, createWallet } = usePrivy();
  const { wallets } = useWallets();

  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);

  // Find the embedded wallet (created by Privy for email/Google login)
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy') || null;
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy') || null;
  const activeWallet = embeddedWallet || externalWallet || wallets[0] || null;

  // Wallet address — always use on-chain address, never email
  const walletAddress = activeWallet?.address
    || privyUser?.wallet?.address
    || null;

  // Email identity
  const emailAddress = privyUser?.email?.address || null;
  const googleEmail = privyUser?.google?.email || null;
  const userEmail = emailAddress || googleEmail || null;
  const userName = privyUser?.google?.name || (userEmail ? userEmail.split('@')[0] : null);

  // The primary account is always the wallet address (for on-chain interactions)
  const account = walletAddress;
  const isCorrectNetwork = chainId === parseInt(SEPOLIA_CHAIN_ID, 16);

  // Auto-create embedded wallet if user logged in via email/Google but has no wallet yet
  useEffect(() => {
    if (authenticated && privyUser && !walletAddress && createWallet) {
      createWallet().catch(err => {
        // Wallet may already exist or be creating
        console.warn('Auto-create wallet:', err?.message || err);
      });
    }
  }, [authenticated, privyUser, walletAddress, createWallet]);

  // Setup provider and signer when wallet changes
  useEffect(() => {
    const initProvider = async () => {
      if (!activeWallet) {
        setProvider(null);
        setSigner(null);
        setChainId(null);
        setBalance('0');
        return;
      }
      try {
        const ethProvider = await activeWallet.getEthereumProvider();
        const browserProvider = new ethers.BrowserProvider(ethProvider);
        const walletSigner = await browserProvider.getSigner();
        const network = await browserProvider.getNetwork();
        
        setProvider(browserProvider);
        setSigner(walletSigner);
        setChainId(Number(network.chainId));

        const bal = await browserProvider.getBalance(activeWallet.address);
        setBalance(ethers.formatEther(bal));
      } catch (err) {
        console.warn('Failed to init provider:', err);
      }
    };
    initProvider();
  }, [activeWallet]);

  const openConnectModal = login;
  const disconnect = logout;

  const switchToSepolia = useCallback(async () => {
    if (!activeWallet) return;
    try {
      await activeWallet.switchChain(parseInt(SEPOLIA_CHAIN_ID, 16));
    } catch (err) {
      console.warn('Network switch error:', err);
      setError('Failed to switch network.');
    }
  }, [activeWallet]);

  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  return {
    account,
    balance,
    chainId,
    provider,
    signer,
    isConnecting: !ready,
    isConnected: authenticated,
    isCorrectNetwork,
    error,
    shortAddress,
    connectedWalletId: activeWallet?.walletClientType || 'privy',
    
    // Email/identity info
    userEmail,
    userName,
    hasWallet: Boolean(walletAddress),
    walletAddress,

    // Login method detection
    loginMethod: emailAddress ? 'email' : googleEmail ? 'google' : walletAddress ? 'wallet' : null,

    // Legacy placeholders so existing components don't break
    availableWallets: [],
    showModal: false,
    openConnectModal,
    closeConnectModal: () => {},
    connectToWallet: () => {},
    connectWithGoogle: login,
    disconnect,
    switchToSepolia,
    connect: login,
  };
}

