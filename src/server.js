import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Configuração inválida: ${err.message}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });

await migrate(pool);

const server = createApp({ pool, config }).listen(config.port, () => {
  console.log(`API escutando na porta ${config.port}`);
});

// Encerramento limpo quando o Docker manda parar o container
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
