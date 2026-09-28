import { Link } from 'react-router-dom';

/**
 * NotFound — 404 page for unmatched routes.
 * Styled consistently with the Obscural dark theme.
 */
export default function NotFound() {
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
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Glitch 404 */}
        <div style={{
          fontSize: '96px',
          fontWeight: 800,
          fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
          background: 'linear-gradient(135deg, #6C5CE7, #9F8CFF, #22D3EE)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1.1,
          marginBottom: '8px',
          letterSpacing: '-4px',
        }}>
          404
        </div>

        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#FFFFFF',
          marginBottom: '12px',
          fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
        }}>
          Page Not Found
        </h2>

        <p style={{
          fontSize: '14px',
          color: '#A9AEC5',
          lineHeight: 1.6,
          marginBottom: '32px',
          maxWidth: '340px',
          margin: '0 auto 32px',
        }}>
          The page you're looking for doesn't exist or has been moved. Check the URL or navigate back.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6C5CE7, #9F8CFF)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: '0 4px 20px rgba(108, 92, 231, 0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Dashboard
          </Link>

          <Link
            to="/invoices"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'background 0.15s ease',
            }}
          >
            Invoices
          </Link>
        </div>
      </div>
    </div>
  );
}
