/** Cabeçalhos de segurança básicos em todas as respostas. */
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
}

/**
 * CORS com lista de origens permitidas. Origem fora da lista não recebe cabeçalho
 * nenhum, e o navegador bloqueia. O app Android não usa CORS.
 */
export function cors(allowedOrigins = []) {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
      if (req.method === 'OPTIONS') return res.status(204).end();
    }
    return next();
  };
}

/**
 * Limite de requisições por IP, em memória (janela fixa).
 * Basta para uma instância só; com várias, usaríamos Redis.
 */
export function rateLimit({ windowMs, max, keyPrefix = '', now = () => Date.now() }) {
  const hits = new Map();

  const cleaner = setInterval(() => {
    const t = now();
    for (const [key, entry] of hits) if (entry.resetAt <= t) hits.delete(key);
  }, windowMs);
  cleaner.unref?.();

  return (req, res, next) => {
    const key = `${keyPrefix}${req.ip}`;
    const t = now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));

    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - t) / 1000)));
      return res.status(429).json({ error: 'too_many_requests', message: 'Muitas requisições. Tente em instantes.' });
    }
    return next();
  };
}
