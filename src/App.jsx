import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { ToastContainer, ImmersiveBackground } from './components/common';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceList from './pages/InvoiceList';
import InvoiceDetail from './pages/InvoiceDetail';
import Contact from './pages/Contact';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Autopilot from './pages/Autopilot';
import NotFound from './pages/NotFound';
import useWallet from './hooks/useWallet';
import useAuthStore from './store/authStore';

function AppContent() {
  const wallet = useWallet();
  const { user, onConnect, onDisconnect, setInitialized } = useAuthStore();

  // Mouse-reactive background spotlight (inspired by vitael.xyz)
  useEffect(() => {
    const handleMouseMove = (e) => {
      document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMouseMove);
  }, []);

  const disconnectWallet = wallet.disconnect;
  const handleDisconnect = useCallback(() => {
    disconnectWallet?.();
    onDisconnect();
    localStorage.removeItem('obscural_dev_mock');
    localStorage.removeItem('obscural_last_active');
  }, [disconnectWallet, onDisconnect]);

  // Sync Privy auth state → auth store (supports email, Google, and wallet login)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isDevMock = localStorage.getItem('obscural_dev_mock') === 'true' || searchParams.get('mock') === 'true' || searchParams.get('obscural_dev_mock') === 'true';
    if (isDevMock && !user) {
      localStorage.setItem('obscural_dev_mock', 'true');
      localStorage.setItem('obscural_last_active', Date.now().toString());
      sessionStorage.setItem('obscural_session_active', '1');
      onConnect('demo@obscural.xyz', '0', null, { name: 'Demo User', email: 'demo@obscural.xyz' });
      return;
    }

    if (wallet.isConnected && wallet.account) {
      if (!user || user.address !== wallet.account) {
        localStorage.setItem('obscural_last_active', Date.now().toString());
        sessionStorage.setItem('obscural_session_active', '1');
        onConnect(
          wallet.account,
          wallet.balance,
          wallet.chainId,
          { name: wallet.userName, email: wallet.userEmail }
        );
      }
    } else if (!wallet.isConnected && user && !isDevMock) {
      onDisconnect();
    }
    setInitialized();
  }, [wallet.isConnected, wallet.account, wallet.balance, wallet.chainId, wallet.userName, wallet.userEmail, user, onConnect, onDisconnect, setInitialized]);

  const handleLogin = () => {
    wallet.openConnectModal();
  };

  // Security: Auto-logout after 7 days of inactivity
  useEffect(() => {
    if (!user) return;

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const lastActive = localStorage.getItem('obscural_last_active');

    if (lastActive) {
      const elapsed = Date.now() - parseInt(lastActive, 10);
      if (!isNaN(elapsed) && elapsed > SEVEN_DAYS) {
        console.log('7 days inactivity — auto logout');
        handleDisconnect();
        return;
      }
    } else {
      localStorage.setItem('obscural_last_active', Date.now().toString());
    }

    let timer;
    const resetTimer = () => {
      localStorage.setItem('obscural_last_active', Date.now().toString());
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleDisconnect();
      }, SEVEN_DAYS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, handleDisconnect]);

  return (
    <BrowserRouter>
      <ImmersiveBackground />
      <ToastContainer />

      <Routes>
        {/* Landing — no layout */}
        <Route
          path="/"
          element={
            user
              ? <Navigate to="/dashboard" replace />
              : <Landing onLogin={handleLogin} />
          }
        />

        {/* App pages — with layout */}
        <Route element={
          user ? (
            <Layout
              user={user}
              wallet={wallet}
              onConnectWallet={handleLogin}
              onDisconnect={handleDisconnect}
            />
          ) : (
            <Navigate to="/" replace />
          )
        }>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/invoices" element={<InvoiceList />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="/create" element={<CreateInvoice />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/autopilot" element={<Autopilot />} />
        </Route>

        {/* 404 — catch all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PrivyProvider
        appId={import.meta.env.VITE_PRIVY_APP_ID || 'cm0xx_placeholder_app_id'}
        config={{
          loginMethods: ['email', 'google'],
          appearance: {
            theme: 'dark',
            accentColor: '#8B5CF6',
            logo: '/favicon.svg',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
        }}
      >
        <AppContent />
      </PrivyProvider>
    </ErrorBoundary>
  );
}
