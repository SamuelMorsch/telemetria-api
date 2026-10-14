import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { createAuth } from './auth.js';
import { HttpError } from './errors.js';
import { openapi } from './openapi.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { vehiclesRouter } from './routes/vehicles.js';
import { sessionsRouter } from './routes/sessions.js';
import { telemetryRouter } from './routes/telemetry.js';
import { anomaliesRouter } from './routes/anomalies.js';
import { LiveBus } from './live.js';
import { createMetrics } from './metrics.js';
import { cors, rateLimit, securityHeaders } from './security.js';

/**
 * Monta a aplicação. Recebe o pool do banco e a config por parâmetro
 * (injeção de dependência), então os testes usam um banco falso.
 */
export function createApp({ pool, config, bus = new LiveBus(), metrics = createMetrics({ bus }) }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // atrás do Caddy: req.ip vem do X-Forwarded-For

  app.use(metrics.middleware);
  app.use(securityHeaders);
  app.use(cors(config.corsOrigins));
  app.use(rateLimit({ windowMs: 60_000, max: 300, keyPrefix: 'geral:' }));
  app.use(express.json({ limit: '1mb' }));

  const auth = createAuth(config);

  // Saúde do serviço: usado pelo Docker, pelo monitoramento e por você, no navegador.
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  // Métricas para o Prometheus. O Caddy só encaminha /api/*, então isto NÃO é público:
  // fica acessível apenas dentro da rede do Docker.
  app.get('/metrics', (_req, res) => {
    res.type('text/plain; version=0.0.4').send(metrics.registry.render());
  });

  // Documentação interativa (Swagger UI) e a especificação OpenAPI
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Telemetria API' }));

  // Rotas públicas (login/cadastro) com limite mais rígido contra adivinhação de senha
  app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'auth:' }), authRouter({ pool, auth, config }));

  // Rotas protegidas
  app.use('/api/users', auth.requireAuth, usersRouter({ pool, auth }));
  app.use('/api/vehicles', auth.requireAuth, vehiclesRouter({ pool, auth }));
  app.use(
    '/api/sessions',
    auth.requireAuth,
    sessionsRouter({ pool, bus, metrics }),
    telemetryRouter({ pool, bus, metrics }),
  );
  app.use('/api/anomalies', auth.requireAuth, anomaliesRouter({ pool }));

  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Tratador central de erros
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
    }
    // Erros do PostgreSQL: duplicidade, referência inválida, UUID malformado
    if (err.code === '23505') return res.status(409).json({ error: 'conflict', message: 'Registro já existe.' });
    if (err.code === '23503') return res.status(400).json({ error: 'invalid_reference', message: 'Referência inválida.' });
    if (err.code === '22P02') return res.status(400).json({ error: 'bad_request', message: 'Formato inválido.' });

    // JSON malformado etc. (erros do próprio Express com status 4xx)
    if (err.status && err.status < 500) return res.status(err.status).json({ error: 'bad_request' });

    console.error(err);
    return res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
