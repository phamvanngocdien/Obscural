/**
 * Currency and Token Utilities for Obscural On-Chain Invoicing
 */

export const SUPPORTED_TOKENS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    isStablecoin: true,
    badge: 'Stablecoin',
    color: '#2775CA',
    bg: 'rgba(39, 117, 202, 0.15)',
    border: 'rgba(39, 117, 202, 0.35)',
    description: 'Primary on-chain dollar stablecoin (1:1 USD)',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    isStablecoin: false,
    badge: 'Native Crypto',
    color: '#627EEA',
    bg: 'rgba(98, 126, 234, 0.15)',
    border: 'rgba(98, 126, 234, 0.35)',
    description: 'Ethereum Sepolia native settlement token',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    isStablecoin: true,
    badge: 'Stablecoin',
    color: '#26A17B',
    bg: 'rgba(38, 161, 123, 0.15)',
    border: 'rgba(38, 161, 123, 0.35)',
    description: 'Tether USD on-chain stablecoin',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    isStablecoin: true,
    badge: 'Decentralized',
    color: '#F5AC37',
    bg: 'rgba(245, 172, 55, 0.15)',
    border: 'rgba(245, 172, 55, 0.35)',
    description: 'Decentralized algorithmic dollar pegged token',
  },
];

let cachedEthPrice = 2480;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Fetch live ETH price in USD with in-memory caching and fallback
 */
export async function fetchLiveEthPrice() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && cachedEthPrice > 0) {
    return cachedEthPrice;
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data = await res.json();
    if (data.ethereum?.usd && data.ethereum.usd > 0) {
      cachedEthPrice = data.ethereum.usd;
      lastFetchTime = now;
      return cachedEthPrice;
    }
  } catch (err) {
    console.warn('Using cached ETH price fallback:', err);
  }
  return cachedEthPrice || 2480;
}

export function getCachedEthPrice() {
  return cachedEthPrice || 2480;
}

/**
 * Calculate the total USDC value of an invoice
 * If the invoice was denominated in ETH, convert using ethPrice.
 */
export function getInvoiceUsdcValue(inv, ethPrice = cachedEthPrice) {
  if (!inv) return 0;
  const rawAmt = parseFloat(inv.amount || inv.total || 0);
  if (isNaN(rawAmt) || rawAmt <= 0) return 0;

  const curr = (inv.currency || 'USDC').toUpperCase();
  const rate = ethPrice > 0 ? ethPrice : 2480;

  if (curr === 'ETH') {
    return rawAmt * rate;
  }
  // Stablecoins are 1:1 with USD
  return rawAmt;
}

/**
 * Format invoice display according to Obscural standard:
 * Default is USDC. If paid/denominated in another token like ETH,
 * show: "100.00 USDC (0.0400 ETH)"
 */
export function formatInvoiceDisplay(inv, ethPrice = cachedEthPrice) {
  if (!inv) return { usdcStr: '0.00 USDC', fullStr: '0.00 USDC', usdcVal: 0 };
  const rawAmt = parseFloat(inv.amount || inv.total || 0);
  const curr = (inv.currency || 'USDC').toUpperCase();
  const rate = ethPrice > 0 ? ethPrice : 2480;

  if (curr === 'ETH') {
    const usdcVal = rawAmt * rate;
    const usdcStr = `${usdcVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
    const ethStr = `${rawAmt} ETH`;
    return {
      usdcVal,
      usdcStr,
      cryptoStr: ethStr,
      fullStr: `${usdcStr} (${ethStr})`,
    };
  }

  // USDC, USDT, DAI
  const usdcVal = rawAmt;
  const usdcStr = `${usdcVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
  return {
    usdcVal,
    usdcStr,
    cryptoStr: null,
    fullStr: usdcStr,
  };
}
