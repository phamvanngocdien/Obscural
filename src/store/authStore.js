import { create } from 'zustand';

/**
 * Auth Store (Zustand)
 * Manages user authentication state and profile data.
 * Supports both email-based and wallet-based authentication.
 */
const useAuthStore = create((set, get) => ({
  // ── State ──
  user: null,
  wallet: {
    address: null,
    balance: '0',
    chainId: null,
    isConnected: false,
  },
  isLoading: false,
  isInitialized: false,

  // ── Actions ──

  /** Set wallet connection state */
  setWallet: (walletData) =>
    set((state) => ({
      wallet: { ...state.wallet, ...walletData },
    })),

  /** Set user profile */
  setUser: (user) => set({ user }),

  /**
   * Called after auth connect — builds user profile.
   * Supports email-based login (address = email or generated ID).
   */
  onConnect: (address, balance, chainId, extra = {}) =>
    set({
      wallet: {
        address,
        balance: balance || '0',
        chainId: chainId || null,
        isConnected: true,
      },
      user: {
        address,
        name: extra.name || (address.includes('@') ? address.split('@')[0] : `${address.slice(0, 6)}...${address.slice(-4)}`),
        email: extra.email || (address.includes('@') ? address : ''),
        balance: balance || '0',
      },
    }),

  /** Called on disconnect / logout */
  onDisconnect: () =>
    set({
      wallet: {
        address: null,
        balance: '0',
        chainId: null,
        isConnected: false,
      },
      user: null,
    }),

  /** Update balance */
  updateBalance: (balance) =>
    set((state) => ({
      wallet: { ...state.wallet, balance: balance || '0' },
      user: state.user ? { ...state.user, balance: balance || '0' } : null,
    })),

  /** Set loading state */
  setLoading: (isLoading) => set({ isLoading }),

  /** Mark as initialized (after auto-reconnect attempt) */
  setInitialized: () => set({ isInitialized: true }),

  // ── Getters ──
  getShortAddress: () => {
    const addr = get().wallet.address;
    if (!addr) return null;
    if (addr.includes('@')) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  },
}));

export default useAuthStore;
