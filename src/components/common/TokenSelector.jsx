import { useState, useRef, useEffect } from 'react';
import { SUPPORTED_TOKENS } from '../../utils/currency';
import '../../styles/TokenSelector.css';

export function TokenIcon({ symbol, size = 24 }) {
  switch (symbol) {
    case 'USDC':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#2775CA" />
          <path
            d="M16 6.5C10.75 6.5 6.5 10.75 6.5 16C6.5 21.25 10.75 25.5 16 25.5C21.25 25.5 25.5 21.25 25.5 16C25.5 10.75 21.25 6.5 16 6.5ZM16.8 21.2V22.5H15.2V21.2C13.2 21 12 19.8 11.9 18.2H13.7C13.8 19 14.5 19.7 16 19.7C17.4 19.7 18.2 19 18.2 18.1C18.2 17.2 17.4 16.6 15.6 16.1C13.4 15.5 12.2 14.7 12.2 13.1C12.2 11.7 13.3 10.7 15.2 10.4V9.2H16.8V10.4C18.5 10.7 19.5 11.7 19.6 13H17.8C17.7 12.2 17.1 11.7 16 11.7C14.8 11.7 14 12.2 14 13C14 13.8 14.7 14.3 16.4 14.8C18.7 15.4 20 16.3 20 18C20 19.6 18.8 20.8 16.8 21.2Z"
            fill="white"
          />
        </svg>
      );
    case 'ETH':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <path d="M16 4.5L15.8 5.1V20.2L16 20.4L22.9 16.3L16 4.5Z" fill="#C0CBF6" />
          <path d="M16 4.5L9.1 16.3L16 20.4V13.1V4.5Z" fill="white" />
          <path d="M16 21.7L15.9 21.8V27.3L16 27.5L22.9 17.6L16 21.7Z" fill="#C0CBF6" />
          <path d="M16 27.5V21.7L9.1 17.6L16 27.5Z" fill="white" />
          <path d="M16 20.4L22.9 16.3L16 13.1V20.4Z" fill="#8197EE" />
          <path d="M9.1 16.3L16 20.4V13.1L9.1 16.3Z" fill="#C0CBF6" />
        </svg>
      );
    case 'USDT':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#26A17B" />
          <path
            d="M17.8 14.8V13.4H22.7V10.2H9.3V13.4H14.2V14.8C9.9 15 6.7 16 6.7 17.1C6.7 18.3 9.9 19.2 14.2 19.5V23.7H17.8V19.5C22.1 19.2 25.3 18.3 25.3 17.1C25.3 16 22.1 15 17.8 14.8ZM16 18.3C12.5 18.3 9.6 17.6 9.6 16.8C9.6 15.9 12.5 15.3 16 15.3C19.5 15.3 22.4 15.9 22.4 16.8C22.4 17.6 19.5 18.3 16 18.3Z"
            fill="white"
          />
        </svg>
      );
    case 'DAI':
      return (
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="16" fill="#F5AC37" />
          <path
            d="M16 7H11.5V10.4H13.6C16.8 10.4 19.2 11.7 19.7 14.1H11.5V15.7H19.9C19.9 16 19.9 16.3 19.9 16.6C19.9 16.9 19.9 17.2 19.9 17.5H11.5V19.1H19.7C19.1 21.4 16.8 22.8 13.6 22.8H11.5V26.2H16C20.6 26.2 24.3 22.5 24.3 16.6C24.3 10.7 20.6 7 16 7Z"
            fill="white"
          />
        </svg>
      );
    default:
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'rgba(139, 122, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '11px',
            color: '#FFFFFF',
          }}
        >
          {symbol.charAt(0)}
        </div>
      );
  }
}

export default function TokenSelector({ value = 'USDC', onChange, ethPrice = 2480 }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedToken =
    SUPPORTED_TOKENS.find((t) => t.symbol === value) || SUPPORTED_TOKENS[0];

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (token) => {
    onChange?.(token.symbol);
    setIsOpen(false);
  };

  return (
    <div className="token-selector-wrap" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`token-selector-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="token-trigger-left">
          <div className="token-trigger-icon-box" style={{ boxShadow: `0 0 12px ${selectedToken.color}40` }}>
            <TokenIcon symbol={selectedToken.symbol} size={24} />
          </div>
          <div className="token-trigger-info">
            <div className="token-trigger-title-row">
              <span className="token-trigger-symbol">{selectedToken.symbol}</span>
              <span
                className="token-badge-pill"
                style={{
                  background: selectedToken.bg,
                  borderColor: selectedToken.border,
                  color: selectedToken.color,
                }}
              >
                {selectedToken.badge}
              </span>
            </div>
            <span className="token-trigger-name">{selectedToken.name}</span>
          </div>
        </div>

        <div className="token-trigger-right">
          {selectedToken.symbol === 'ETH' && ethPrice > 0 && (
            <span className="token-trigger-rate">
              1 ETH ≈ ${ethPrice.toLocaleString()}
            </span>
          )}
          <svg
            className={`token-chevron ${isOpen ? 'rotate' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="token-dropdown-menu" role="listbox">
          <div className="token-dropdown-header">
            <span>On-Chain Settlement Tokens</span>
            <span className="token-header-note">100% Non-Custodial</span>
          </div>

          <div className="token-dropdown-list">
            {SUPPORTED_TOKENS.map((token) => {
              const isSelected = token.symbol === selectedToken.symbol;
              return (
                <button
                  key={token.symbol}
                  type="button"
                  className={`token-item-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(token)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="token-item-left">
                    <div
                      className="token-item-icon-box"
                      style={{
                        boxShadow: isSelected ? `0 0 10px ${token.color}50` : 'none',
                      }}
                    >
                      <TokenIcon symbol={token.symbol} size={28} />
                    </div>
                    <div className="token-item-details">
                      <div className="token-item-top">
                        <span className="token-item-symbol">{token.symbol}</span>
                        <span
                          className="token-badge-pill"
                          style={{
                            background: token.bg,
                            borderColor: token.border,
                            color: token.color,
                          }}
                        >
                          {token.badge}
                        </span>
                      </div>
                      <span className="token-item-name">{token.name}</span>
                    </div>
                  </div>

                  <div className="token-item-right">
                    {token.symbol === 'ETH' && ethPrice > 0 && (
                      <span className="token-item-rate">
                        ≈ ${ethPrice.toLocaleString()}
                      </span>
                    )}
                    {token.isStablecoin && (
                      <span className="token-item-peg">$1.00 Pegged</span>
                    )}
                    {isSelected && (
                      <span className="token-selected-check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="token-dropdown-footer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>USDC is the default stable currency for automated bookkeeping.</span>
          </div>
        </div>
      )}
    </div>
  );
}
