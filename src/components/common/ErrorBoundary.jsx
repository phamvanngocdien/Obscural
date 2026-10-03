import { Component } from 'react';

/**
 * ErrorBoundary — Catches unhandled errors in child component tree.
 * Displays a themed fallback UI with retry and navigation options.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary, #080C18)',
          padding: '20px',
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '40px 32px',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255, 107, 122, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '28px',
            }}>
              ⚠️
            </div>

            <h2 style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '8px',
              fontFamily: 'var(--font-display, "Exo 2", sans-serif)',
            }}>
              Something went wrong
            </h2>

            <p style={{
              fontSize: '13px',
              color: 'rgba(200, 200, 230, 0.75)',
              lineHeight: 1.6,
              marginBottom: '8px',
            }}>
              An unexpected error occurred. You can try again or return to the dashboard.
            </p>

            {this.state.error && (
              <p style={{
                fontSize: '11px',
                color: 'rgba(160, 160, 200, 0.55)',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '24px',
                fontFamily: '"JetBrains Mono", monospace',
                wordBreak: 'break-all',
                textAlign: 'left',
              }}>
                {this.state.error.message || 'Unknown error'}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6C5CE7, #8B7AFF)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
