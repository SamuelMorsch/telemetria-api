require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// 1. Configuração da ligação ao PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 2. Inicialização: Garante que a tabela existe no banco de dados real
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS falhas (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) NOT NULL,
        descricao TEXT NOT NULL,
        data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Banco de dados PostgreSQL conectado e tabela verificada.");
  } catch (error) {
    console.error("Erro ao conectar no banco de dados:", error);
  }
}
initDB();

// 3. Rotas da API reescritas para usar SQL
app.get('/api/status', (req, res) => {
  res.status(200).json({ status: "API Edge-to-Cloud conectada ao PostgreSQL" });
});

app.post('/api/sincronizar', async (req, res) => {
  const { falhas } = req.body;
  
  if (!falhas || !Array.isArray(falhas)) {
    return res.status(400).json({ erro: "Payload inválido. Esperado um array." });
  }

  try {
    // Insere cada falha vinda do celular diretamente na nuvem
    for (const falha of falhas) {
      await pool.query(
        'INSERT INTO falhas (codigo, descricao) VALUES ($1, $2)',
        [falha.codigo, falha.descricao]
      );
    }
    console.log(`[📥] ${falhas.length} falha(s) sincronizada(s) com sucesso.`);
    res.status(201).json({ mensagem: "Sincronização concluída com sucesso no PostgreSQL" });
  } catch (error) {
    console.error("Erro no INSERT:", error);
    res.status(500).json({ erro: "Erro ao salvar no banco de dados" });
  }
});

app.get('/api/falhas', async (req, res) => {
  try {
    // Busca o histórico ordenado pelas mais recentes
    const result = await pool.query('SELECT * FROM falhas ORDER BY data_registro DESC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro no SELECT:", error);
    res.status(500).json({ erro: "Erro ao buscar falhas" });
  }
});

// 4. Exportação para testes e inicialização do servidor
module.exports = app;

if (require.main === module) {
  app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000");
  });
}