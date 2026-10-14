import pg from 'pg';
import { createApp } from './app.js';
import { migrate } from './migrate.js';

const { DATABASE_URL, PORT = 3000 } = process.env;

if (!DATABASE_URL) {
  console.error('Variável de ambiente DATABASE_URL não definida.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 });

await migrate(pool);

const server = createApp({ pool }).listen(PORT, () => {
  console.log(`API escutando na porta ${PORT}`);
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
