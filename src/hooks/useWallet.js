import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111

export default function useWallet() {
  const { login, logout, authenticated, ready, user: privyUser } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet = wallets[0];

  const [balance, setBalance] = useState('0');
  const [chainId, setChainId] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [error, setError] = useState(null);

  // Derive account from wallet or email
  const walletAddress = privyUser?.wallet?.address || activeWallet?.address || null;
  const emailAddress = privyUser?.email?.address || null;
  const googleEmail = privyUser?.google?.email || null;

  // Use wallet address if available, otherwise use email as identifier
  const account = walletAddress || emailAddress || googleEmail || null;
  const isCorrectNetwork = chainId === parseInt(SEPOLIA_CHAIN_ID, 16);

  // User identity info for the auth store
  const userEmail = emailAddress || googleEmail || null;
  const userName = privyUser?.google?.name || (userEmail ? userEmail.split('@')[0] : null);

  // Setup provider and signer when Privy wallet changes
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
    ? (account.includes('@') ? account : `${account.slice(0, 6)}...${account.slice(-4)}`)
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
