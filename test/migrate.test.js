import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrate } from '../src/migrate.js';

// Banco falso que só registra o que foi executado.
function fakePool(appliedNames = []) {
  const executed = [];
  const client = {
    query: async (sql) => { executed.push(sql.trim()); return { rows: [] }; },
    release: () => {},
  };
  return {
    executed,
    query: async (sql) =>
      sql.includes('SELECT name FROM schema_migrations')
        ? { rows: appliedNames.map((name) => ({ name })) }
        : { rows: [] },
    connect: async () => client,
  };
}

async function dirWith(files) {
  const dir = await mkdtemp(path.join(tmpdir(), 'mig-'));
  for (const [name, sql] of Object.entries(files)) await writeFile(path.join(dir, name), sql);
  return dir;
}

test('aplica as migrations pendentes em ordem alfabética', async () => {
  const dir = await dirWith({ '002_b.sql': 'SELECT 2;', '001_a.sql': 'SELECT 1;' });
  const pool = fakePool();
  await migrate(pool, dir);
  const sqls = pool.executed.filter((s) => s.startsWith('SELECT'));
  assert.deepEqual(sqls, ['SELECT 1;', 'SELECT 2;']);
  assert.equal(pool.executed.filter((s) => s === 'COMMIT').length, 2);
});

test('pula migrations já aplicadas', async () => {
  const dir = await dirWith({ '001_a.sql': 'SELECT 1;', '002_b.sql': 'SELECT 2;' });
  const pool = fakePool(['001_a.sql']);
  await migrate(pool, dir);
  assert.deepEqual(pool.executed.filter((s) => s.startsWith('SELECT')), ['SELECT 2;']);
});

test('desfaz a transação e propaga o erro quando o SQL falha', async () => {
  const dir = await dirWith({ '001_a.sql': 'ISSO NAO E SQL;' });
  const executed = [];
  const client = {
    query: async (sql) => {
      executed.push(sql.trim());
      if (sql.startsWith('ISSO')) throw new Error('erro de sintaxe');
      return { rows: [] };
    },
    release: () => {},
  };
  const pool = { query: async () => ({ rows: [] }), connect: async () => client };
  await assert.rejects(() => migrate(pool, dir), /erro de sintaxe/);
  assert.ok(executed.includes('ROLLBACK'));
  assert.ok(!executed.includes('COMMIT'));
});
