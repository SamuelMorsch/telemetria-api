import express from 'express';

/**
 * Monta a aplicação Express. Recebe o pool do banco por parâmetro
 * (injeção de dependência) para que os testes usem um banco falso.
 */
export function createApp({ pool }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Saúde do serviço: usado pelo Docker, pelo monitoramento e por você, no navegador.
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  // Rota inexistente
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  // Erros (ex.: JSON inválido vira 400; o resto vira 500 sem vazar detalhes)
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const status = err.status && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'internal_error' : 'bad_request' });
  });

  return app;
}
