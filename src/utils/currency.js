/**
 * Currency and Token Utilities for Obscural On-Chain Invoicing
 * Supports Real-Time Multi-Token Market Price Oracles
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
    coingeckoId: 'ethereum',
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
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    isStablecoin: false,
    badge: 'Native Crypto',
    color: '#F7931A',
    bg: 'rgba(247, 147, 26, 0.15)',
    border: 'rgba(247, 147, 26, 0.35)',
    description: 'Bitcoin settlement token',
    coingeckoId: 'bitcoin',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    isStablecoin: false,
    badge: 'Native Crypto',
    color: '#14F195',
    bg: 'rgba(20, 241, 149, 0.15)',
    border: 'rgba(20, 241, 149, 0.35)',
    description: 'Solana settlement token',
    coingeckoId: 'solana',
  },
];

export const STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'USDT',
  'DAI',
  'BUSD',
  'FDUSD',
  'USDE',
  'PYUSD',
  'FRAX',
  'TUSD',
  'USD',
]);

export function isStablecoin(symbol = '') {
  return STABLECOIN_SYMBOLS.has(String(symbol).toUpperCase().trim());
}

export const TOKEN_COINGECKO_MAP = {
  ETH: 'ethereum',
  WETH: 'ethereum',
  BTC: 'bitcoin',
  WBTC: 'wrapped-bitcoin',
  SOL: 'solana',
  MATIC: 'matic-network',
  POL: 'matic-network',
  AVAX: 'avalanche-2',
  BNB: 'binancecoin',
  ARB: 'arbitrum',
  OP: 'optimism',
  LINK: 'chainlink',
};

let cachedPrices = {};
let lastFetchTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds fresh cache for real-time accuracy

/**
 * Fetch real-time market prices for all supported non-stable tokens
 */
export async function fetchLiveTokenPrices() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && Object.keys(cachedPrices).length > 0) {
    return { ...cachedPrices };
  }

  try {
    const ids = Array.from(new Set(Object.values(TOKEN_COINGECKO_MAP))).join(',');
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(3500) }
    );
    if (res.ok) {
      const data = await res.json();
      const updated = { ...cachedPrices };
      for (const [symbol, id] of Object.entries(TOKEN_COINGECKO_MAP)) {
        if (data[id]?.usd) {
          updated[symbol] = data[id].usd;
        }
      }
      cachedPrices = updated;
      lastFetchTime = now;
      return { ...cachedPrices };
    }
  } catch (err) {
    console.warn('CoinGecko price fetch warning, trying alternative live sources:', err);
  }

  // Backup fallback: fetch live prices from Coinbase spot API
  try {
    const symbolsToFetch = ['ETH', 'BTC', 'SOL'];
    const spotPromises = symbolsToFetch.map(async (sym) => {
      try {
        const cbRes = await fetch(`https://api.coinbase.com/v2/prices/${sym}-USD/spot`, {
          signal: AbortSignal.timeout(2000),
        });
        if (cbRes.ok) {
          const cbData = await cbRes.json();
          const p = parseFloat(cbData?.data?.amount);
          if (p > 0) return { sym, price: p };
        }
      } catch {}
      return null;
    });

    const results = await Promise.all(spotPromises);
    results.forEach((r) => {
      if (r) cachedPrices[r.sym] = r.price;
    });
    if (cachedPrices.ETH) {
      cachedPrices.WETH = cachedPrices.ETH;
    }
    if (cachedPrices.BTC) {
      cachedPrices.WBTC = cachedPrices.BTC;
    }
    if (Object.keys(cachedPrices).length > 0) {
      lastFetchTime = now;
    }
  } catch (backupErr) {
    console.warn('Alternative price fetch warning:', backupErr);
  }

  return { ...cachedPrices };
}

export function getAllTokenPrices() {
  return { ...cachedPrices };
}

export function getCachedTokenPrice(symbol) {
  if (!symbol) return 0;
  const s = symbol.toUpperCase().trim();
  if (isStablecoin(s)) return 1.0;
  return cachedPrices[s] || (s === 'ETH' ? cachedPrices.WETH || 0 : 0);
}

export async function getTokenLivePrice(symbol) {
  if (!symbol) return 0;
  const s = symbol.toUpperCase().trim();
  if (isStablecoin(s)) return 1.0;
  const existing = getCachedTokenPrice(s);
  if (existing > 0 && Date.now() - lastFetchTime < CACHE_TTL) {
    return existing;
  }
  const prices = await fetchLiveTokenPrices();
  return prices[s] || getCachedTokenPrice(s) || 0;
}

// Backward compatibility helpers
export async function fetchLiveEthPrice() {
  const p = await getTokenLivePrice('ETH');
  return p > 0 ? p : (cachedPrices.ETH || 0);
}

export function getCachedEthPrice() {
  return getCachedTokenPrice('ETH') || 0;
}

/**
 * Calculate the total USDC value of an invoice based on real-time market rates
 */
export function getInvoiceUsdcValue(inv, priceMapOrEthPrice) {
  if (!inv) return 0;
  const rawAmt = parseFloat(inv.amount || inv.total || 0);
  if (isNaN(rawAmt) || rawAmt <= 0) return 0;

  const curr = (inv.currency || 'USDC').toUpperCase().trim();
  if (isStablecoin(curr)) {
    return rawAmt;
  }

  let rate = 0;
  if (typeof priceMapOrEthPrice === 'object' && priceMapOrEthPrice !== null) {
    rate = priceMapOrEthPrice[curr] || getCachedTokenPrice(curr);
  } else if (typeof priceMapOrEthPrice === 'number' && priceMapOrEthPrice > 0 && curr === 'ETH') {
    rate = priceMapOrEthPrice;
  } else {
    rate = getCachedTokenPrice(curr);
  }

  return rawAmt * (rate > 0 ? rate : 1);
}

/**
 * Format invoice display according to Obscural standard:
 * Default is USDC. If denominated in another token (ETH, BTC, SOL, etc.),
 * show: "100.00 USDC (0.0400 ETH)" based on real-time market rates.
 */
export function formatInvoiceDisplay(inv, priceMapOrEthPrice) {
  if (!inv) return { usdcStr: '0.00 USDC', fullStr: '0.00 USDC', usdcVal: 0 };
  const rawAmt = parseFloat(inv.amount || inv.total || 0);
  const curr = (inv.currency || 'USDC').toUpperCase().trim();

  if (isStablecoin(curr)) {
    const usdcVal = rawAmt;
    const usdcStr = `${usdcVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
    return {
      usdcVal,
      usdcStr,
      cryptoStr: null,
      fullStr: usdcStr,
    };
  }

  let rate = 0;
  if (typeof priceMapOrEthPrice === 'object' && priceMapOrEthPrice !== null) {
    rate = priceMapOrEthPrice[curr] || getCachedTokenPrice(curr);
  } else if (typeof priceMapOrEthPrice === 'number' && priceMapOrEthPrice > 0 && curr === 'ETH') {
    rate = priceMapOrEthPrice;
  } else {
    rate = getCachedTokenPrice(curr);
  }

  const usdcVal = rawAmt * (rate > 0 ? rate : 1);
  const usdcStr = `${usdcVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`;
  const cryptoStr = `${rawAmt} ${curr}`;
  return {
    usdcVal,
    usdcStr,
    cryptoStr,
    fullStr: `${usdcStr} (${cryptoStr})`,
  };
}
