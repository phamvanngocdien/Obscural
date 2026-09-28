/**
 * Server security middleware for Obscural.
 * Provides: rate limiting, security headers, request size validation.
 */

// ── In-memory rate limiter (no external deps) ──

const rateLimitStore = new Map();

const RATE_LIMIT_WINDOW_MS = 60_000;  // 1 minute
const RATE_LIMIT_MAX = 120;            // max requests per window
const AI_RATE_LIMIT_MAX = 20;          // stricter for AI endpoints

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60_000);

/**
 * Creates a rate limiter middleware.
 * @param {number} maxRequests - Max requests per window
 */
export function rateLimit(maxRequests = RATE_LIMIT_MAX) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${ip}:${maxRequests}`;
    const now = Date.now();

    let entry = rateLimitStore.get(key);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      entry = { windowStart: now, count: 0 };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS) / 1000));

    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000),
      });
    }

    next();
  };
}

/** Stricter rate limiter for AI endpoints */
export const aiRateLimit = rateLimit(AI_RATE_LIMIT_MAX);

// ── Security Headers ──

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// ── Request Size Guard ──

const MAX_BODY_SIZE = 1024 * 1024; // 1MB

export function bodySizeGuard(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    return res.status(413).json({
      error: 'Request body too large',
      maxSize: '1MB',
    });
  }
  next();
}

// ── Input Sanitizer ──

/**
 * Basic input sanitization — strips HTML tags and trims strings.
 * Does NOT modify non-string values.
 */
export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Strip HTML tags (basic XSS prevention)
      obj[key] = val.replace(/<[^>]*>/g, '').trim();
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitizeObject(val);
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (typeof item === 'string') {
          val[idx] = item.replace(/<[^>]*>/g, '').trim();
        } else if (item && typeof item === 'object') {
          sanitizeObject(item);
        }
      });
    }
  }
}
