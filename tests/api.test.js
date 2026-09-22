const request = require('supertest');
const app = require('../src/server');

describe('Validação da API de Telemetria Edge-to-Cloud', () => {
  
  it('Deve confirmar que o servidor está online (GET /api/status)', async () => {
    const res = await request(app).get('/api/status');
    expect(res.statusCode).toEqual(200);
  });

  it('Deve processar o recebimento de novas falhas (POST /api/sincronizar)', async () => {
    const mockPayload = {
      falhas: [
        { codigo: "P0100", descricao: "Falha no sensor MAF" }
      ]
    };
    
    const res = await request(app)
      .post('/api/sincronizar')
      .send(mockPayload);
      
    expect(res.statusCode).toEqual(201);
  });

  it('Deve retornar o histórico de falhas salvas (GET /api/falhas)', async () => {
    const res = await request(app).get('/api/falhas');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
  });
  
});