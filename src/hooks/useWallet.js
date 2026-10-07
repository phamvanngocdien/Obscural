import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

export default function useWallet() {
  const { logout, authenticated, ready, user: privyUser, createWallet } = usePrivy();
  const { login } = useLogin({
    onComplete: (user, isNewUser, wasAlreadyAuthenticated, loginMethod, loginAccount) => {
      console.log('Privy login success:', { loginMethod, user, loginAccount });
    },
    onError: (err) => {
      console.error('Privy login error:', err);
    },
  });
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

  // Extract identity from email or Google OAuth across privyUser and linkedAccounts
  const googleAccount = privyUser?.google
    || privyUser?.linkedAccounts?.find(a => a.type === 'google_oauth' || a.type === 'google')
    || null;
  const emailAccount = privyUser?.email
    || privyUser?.linkedAccounts?.find(a => a.type === 'email')
    || null;
  const walletAccountObj = privyUser?.wallet
    || privyUser?.linkedAccounts?.find(a => a.type === 'wallet')
    || null;

  // Wallet address — always use on-chain address, fallback to linked wallet
  const walletAddress = activeWallet?.address
    || walletAccountObj?.address
    || null;

  // Email and name identity
  const emailAddress = emailAccount?.address || emailAccount?.email || null;
  const googleEmail = googleAccount?.email || null;
  const userEmail = emailAddress || googleEmail || null;
  const userName = googleAccount?.name
    || privyUser?.name
    || (userEmail ? userEmail.split('@')[0] : null);

  // The primary account is always the wallet address (for on-chain interactions)
  const account = walletAddress;
  const isCorrectNetwork = chainId === SEPOLIA_CHAIN_ID;

  // Auto-create embedded wallet if user logged in via email/Google but has no wallet yet
  useEffect(() => {
    if (authenticated && privyUser && !walletAddress && createWallet) {
      createWallet().catch(err => {
        console.warn('Auto-create wallet:', err?.message || err);
      });
    }
  }, [authenticated, privyUser, walletAddress, createWallet]);

  // Robust balance fetcher: queries wallet provider if on Sepolia, otherwise uses Sepolia RPC fallback
  const fetchBalance = useCallback(async (addr, prov) => {
    if (!addr) return;
    try {
      if (prov) {
        const net = await prov.getNetwork();
        if (Number(net.chainId) === SEPOLIA_CHAIN_ID) {
          const bal = await prov.getBalance(addr);
          setBalance(ethers.formatEther(bal));
          return;
        }
      }
      // Direct Sepolia balance check
      const rpc = new ethers.JsonRpcProvider(SEPOLIA_RPC);
      const bal = await rpc.getBalance(addr);
      setBalance(ethers.formatEther(bal));
    } catch (err) {
      console.warn('Failed to fetch Sepolia balance:', err);
    }
  }, []);

  // Setup provider and signer when wallet changes
  useEffect(() => {
    let timer;
    const initProvider = async () => {
      if (!activeWallet) {
        setProvider(null);
        setSigner(null);
        setChainId(null);
        setBalance('0');
        return;
      }
      try {
        // Auto-switch to Sepolia if supported
        if (activeWallet.switchChain) {
          try {
            await activeWallet.switchChain(SEPOLIA_CHAIN_ID);
          } catch (switchErr) {
            console.warn('Auto switch to Sepolia:', switchErr?.message || switchErr);
          }
        }

        const ethProvider = await activeWallet.getEthereumProvider();
        const browserProvider = new ethers.BrowserProvider(ethProvider);
        const walletSigner = await browserProvider.getSigner();
        const network = await browserProvider.getNetwork();
        const currentChainId = Number(network.chainId);
        
        setProvider(browserProvider);
        setSigner(walletSigner);
        setChainId(currentChainId);

        await fetchBalance(activeWallet.address, browserProvider);

        // Auto refresh balance every 10 seconds to detect incoming deposits
        timer = setInterval(() => {
          fetchBalance(activeWallet.address, browserProvider);
        }, 10000);
      } catch (err) {
        console.warn('Failed to init provider:', err);
        if (activeWallet?.address) {
          fetchBalance(activeWallet.address);
        }
      }
    };
    initProvider();

    const handleFocus = () => {
      if (activeWallet?.address) {
        fetchBalance(activeWallet.address);
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeWallet, fetchBalance]);

  const openConnectModal = login;
  const disconnect = logout;

  const switchToSepolia = useCallback(async () => {
    if (!activeWallet) return;
    try {
      await activeWallet.switchChain(SEPOLIA_CHAIN_ID);
      setChainId(SEPOLIA_CHAIN_ID);
      await fetchBalance(activeWallet.address);
    } catch (err) {
      console.warn('Network switch error:', err);
      setError('Failed to switch network.');
    }
  }, [activeWallet, fetchBalance]);

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

    // Actions & Legacy placeholders
    refreshBalance: () => fetchBalance(activeWallet?.address, provider),
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

