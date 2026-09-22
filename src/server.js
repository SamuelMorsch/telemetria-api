require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações de segurança e formato de dados
app.use(cors());
app.use(express.json()); // Permite que a API entenda arquivos JSON vindos do app

// Rota de Teste (Health Check)
app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'online', 
        mensagem: 'API da Telemetria Automotiva rodando 100%!',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// BANCO DE DADOS EM MEMÓRIA (PROVISÓRIO)
// ==========================================
// Vamos usar uma lista simples enquanto não configuramos um banco de dados real na nuvem
let historicoDeFalhasNaNuvem = [];

// ==========================================
// ROTA 1: O Celular ENVIA os dados (POST)
// ==========================================
app.post('/api/sincronizar', (req, res) => {
    // O aplicativo vai enviar um JSON contendo os códigos das falhas
    const { falhas, data_sincronizacao } = req.body;

    if (!falhas || falhas.length === 0) {
        return res.status(400).json({ erro: 'Nenhuma falha recebida no pacote.' });
    }

    console.log(`\n[📥] Nova sincronização recebida do Edge (App)!`);
    console.log(`Data: ${data_sincronizacao}`);
    console.log(`Falhas:`, falhas);

    // Salva na memória da nossa API
    const novoRegistro = {
        id: historicoDeFalhasNaNuvem.length + 1,
        falhas: falhas,
        data_sincronizacao: data_sincronizacao,
        recebido_em: new Date().toISOString()
    };
    
    historicoDeFalhasNaNuvem.push(novoRegistro);

    // Responde para o celular que deu tudo certo
    res.status(201).json({ mensagem: 'Sincronização concluída com sucesso!' });
});

// ==========================================
// ROTA 2: O Painel Web LÊ os dados (GET)
// ==========================================
app.get('/api/falhas', (req, res) => {
    // Retorna todos os dados salvos para o painel do mecânico
    res.json(historicoDeFalhasNaNuvem);
});

module.exports = app; 


if (require.main === module) {
    app.listen(3000, () => {
        console.log("Servidor rodando na porta 3000");
    });
}

