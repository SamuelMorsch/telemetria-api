// Especificação OpenAPI 3.0 da API. É servida em /api/openapi.json e desenhada em /api/docs.

const json = (schema) => ({ 'application/json': { schema } });
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const err = (description) => ({ description, content: json(ref('Error')) });
const auth = [{ bearerAuth: [] }];
const idPath = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Telemetria Automotiva Remota - API',
    version: '2.0.0',
    description:
      'API do TCC de telemetria automotiva remota. Como testar aqui: use POST /api/auth/register ' +
      '(ou /login), copie o campo `token` da resposta, clique em **Authorize** e cole o token.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Saúde' },
    { name: 'Autenticação' },
    { name: 'Usuários' },
    { name: 'Veículos' },
    { name: 'Sessões' },
    { name: 'Telemetria' },
    { name: 'Anomalias' },
    { name: 'Códigos de falha (DTC)' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'validation_error' },
          message: { type: 'string' },
          details: { type: 'array', items: { type: 'object' } },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          workshop_id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'mechanic', 'driver'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: { token: { type: 'string' }, user: ref('User') },
      },
      Vehicle: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          plate: { type: 'string', example: 'ABC1D23' },
          model: { type: 'string', nullable: true },
          owner_name: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Reading: {
        type: 'object',
        required: ['seq', 'time'],
        properties: {
          seq: { type: 'integer', minimum: 0, description: 'Número sequencial da leitura dentro da sessão' },
          time: { type: 'string', format: 'date-time', description: 'Instante da leitura, medido no celular' },
          battery_voltage: { type: 'number', nullable: true, description: 'Volts (ELM327 AT RV)' },
          control_module_voltage: { type: 'number', nullable: true, description: 'Volts (PID 01 42)' },
          rpm: { type: 'integer', nullable: true },
          speed_kmh: { type: 'integer', nullable: true },
          coolant_temp_c: { type: 'integer', nullable: true },
        },
      },
      Dtc: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'P0562' },
          status: { type: 'string', enum: ['stored', 'pending', 'permanent'], description: 'pending = o veículo detectou, mas ainda não confirmou' },
          detected_at: { type: 'string', format: 'date-time' },
          description: { type: 'string', example: 'Tensão do sistema baixa (bateria/alternador não mantém a carga)' },
          electrical: { type: 'boolean', description: 'Ligado a carga, bateria ou motor de partida' },
          scope: { type: 'string', enum: ['generic', 'manufacturer', 'mixed', 'unknown'] },
        },
      },
      AnomalyEvent: {
        type: 'object',
        properties: {
          kind: { type: 'string', example: 'voltage_drop' },
          started_at: { type: 'string', format: 'date-time' },
          ended_at: { type: 'string', format: 'date-time' },
          min_value: { type: 'number', example: 11.47 },
          details: { type: 'object', example: { samples: 10, max_rpm: 4050, threshold_v: 13 } },
        },
      },
      Session: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          vehicle_id: { type: 'string', format: 'uuid' },
          started_at: { type: 'string', format: 'date-time' },
          ended_at: { type: 'string', format: 'date-time', nullable: true },
          source: { type: 'string', enum: ['obd', 'simulator'] },
          app_version: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Saúde'],
        summary: 'Verifica se a API e o banco respondem',
        responses: {
          200: { description: 'Tudo certo', content: json({ type: 'object', example: { status: 'ok', database: 'up' } }) },
          503: { description: 'Banco indisponível' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'],
        summary: 'Cadastra uma oficina e seu primeiro usuário (admin)',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['workshop_name', 'email', 'password'],
            properties: {
              workshop_name: { type: 'string', example: 'Autoelétrica Morsch' },
              email: { type: 'string', example: 'oficina@exemplo.com' },
              password: { type: 'string', minLength: 8, example: 'senha-forte-123' },
            },
          }),
        },
        responses: {
          201: { description: 'Criado', content: json(ref('AuthResponse')) },
          400: err('Dados inválidos'),
          403: err('Cadastro desativado'),
          409: err('E-mail já cadastrado'),
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Entra e recebe um token JWT',
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['email', 'password'],
            properties: { email: { type: 'string' }, password: { type: 'string' } },
          }),
        },
        responses: {
          200: { description: 'OK', content: json(ref('AuthResponse')) },
          401: err('E-mail ou senha inválidos'),
          429: err('Muitas tentativas'),
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Autenticação'],
        summary: 'Dados do usuário logado',
        security: auth,
        responses: {
          200: { description: 'OK', content: json({ type: 'object', properties: { user: ref('User') } }) },
          401: err('Token ausente ou inválido'),
        },
      },
    },
    '/api/users': {
      get: {
        tags: ['Usuários'],
        summary: 'Lista os usuários da oficina (admin)',
        security: auth,
        responses: {
          200: { description: 'OK', content: json({ type: 'array', items: ref('User') }) },
          403: err('Apenas administradores'),
        },
      },
      post: {
        tags: ['Usuários'],
        summary: 'Cria um usuário na oficina (admin)',
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['email', 'password', 'role'],
            properties: {
              email: { type: 'string' },
              password: { type: 'string', minLength: 8 },
              role: { type: 'string', enum: ['admin', 'mechanic', 'driver'] },
            },
          }),
        },
        responses: {
          201: { description: 'Criado', content: json(ref('User')) },
          400: err('Dados inválidos'),
          403: err('Apenas administradores'),
          409: err('E-mail já cadastrado'),
        },
      },
    },
    '/api/vehicles': {
      get: {
        tags: ['Veículos'],
        summary: 'Lista os veículos da oficina',
        security: auth,
        responses: { 200: { description: 'OK', content: json({ type: 'array', items: ref('Vehicle') }) } },
      },
      post: {
        tags: ['Veículos'],
        summary: 'Cadastra um veículo (admin ou mecânico)',
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['plate'],
            properties: {
              plate: { type: 'string', example: 'ABC-1D23' },
              model: { type: 'string', example: 'Fiat Uno 2012' },
              owner_name: { type: 'string' },
            },
          }),
        },
        responses: {
          201: { description: 'Criado', content: json(ref('Vehicle')) },
          400: err('Dados inválidos'),
          403: err('Sem permissão'),
          409: err('Placa já cadastrada nesta oficina'),
        },
      },
    },
    '/api/vehicles/{id}': {
      get: {
        tags: ['Veículos'],
        summary: 'Detalhe de um veículo',
        security: auth,
        parameters: [idPath],
        responses: {
          200: { description: 'OK', content: json(ref('Vehicle')) },
          404: err('Não encontrado'),
        },
      },
    },
    '/api/sessions': {
      get: {
        tags: ['Sessões'],
        summary: 'Lista sessões de monitoramento (mais recentes primeiro)',
        security: auth,
        parameters: [
          { name: 'vehicle_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: 'OK', content: json({ type: 'array', items: ref('Session') }) } },
      },
      post: {
        tags: ['Sessões'],
        summary: 'Abre uma sessão (idempotente: repetir o mesmo id devolve a sessão existente)',
        security: auth,
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['id', 'vehicle_id', 'started_at'],
            properties: {
              id: { type: 'string', format: 'uuid', description: 'Gerado pelo app' },
              vehicle_id: { type: 'string', format: 'uuid' },
              started_at: { type: 'string', format: 'date-time' },
              source: { type: 'string', enum: ['obd', 'simulator'], default: 'obd' },
              app_version: { type: 'string' },
            },
          }),
        },
        responses: {
          200: { description: 'Sessão já existia', content: json(ref('Session')) },
          201: { description: 'Criada', content: json(ref('Session')) },
          404: err('Veículo não encontrado'),
          409: err('Id já usado por outra sessão'),
        },
      },
    },
    '/api/sessions/{id}': {
      get: {
        tags: ['Sessões'],
        summary: 'Detalhe de uma sessão',
        security: auth,
        parameters: [idPath],
        responses: {
          200: { description: 'OK', content: json(ref('Session')) },
          404: err('Não encontrada'),
        },
      },
    },

    '/api/sessions/{id}/readings': {
      post: {
        tags: ['Telemetria'],
        summary: 'Envia um lote de leituras (até 500). Reenviar o mesmo lote não duplica.',
        security: auth,
        parameters: [idPath],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['readings'],
            properties: { readings: { type: 'array', maxItems: 500, items: ref('Reading') } },
            example: {
              readings: [
                { seq: 0, time: '2026-10-14T12:00:00Z', battery_voltage: 14.2, rpm: 2500, speed_kmh: 62, coolant_temp_c: 90 },
                { seq: 1, time: '2026-10-14T12:00:01Z', battery_voltage: 11.5, rpm: 4000, speed_kmh: 100, coolant_temp_c: 90 },
              ],
            },
          }),
        },
        responses: {
          201: { description: 'Leituras novas gravadas', content: json({ type: 'object', example: { received: 2, inserted: 2, duplicates: 0 } }) },
          200: { description: 'Todas já existiam (reenvio)' },
          400: err('Dados inválidos'),
          404: err('Sessão não encontrada'),
        },
      },
      get: {
        tags: ['Telemetria'],
        summary: 'Histórico de leituras, brutas ou resumidas por intervalo (bucket)',
        security: auth,
        parameters: [
          idPath,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 1000, maximum: 5000 } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
          { name: 'bucket', in: 'query', description: 'Se informado (segundos), devolve mínimo/média/máximo por intervalo', schema: { type: 'integer', minimum: 1, maximum: 3600 } },
        ],
        responses: {
          200: { description: 'OK', content: json({ type: 'array', items: { type: 'object' } }) },
          404: err('Sessão não encontrada'),
        },
      },
    },
    '/api/sessions/{id}/dtcs': {
      post: {
        tags: ['Códigos de falha (DTC)'],
        summary: 'Envia códigos de falha lidos do veículo (até 50). Reenviar não duplica.',
        security: auth,
        parameters: [idPath],
        requestBody: {
          required: true,
          content: json({
            type: 'object',
            required: ['dtcs'],
            properties: {
              dtcs: {
                type: 'array',
                maxItems: 50,
                items: {
                  type: 'object',
                  required: ['code', 'detected_at'],
                  properties: {
                    code: { type: 'string', example: 'P0562' },
                    status: { type: 'string', enum: ['stored', 'pending', 'permanent'], default: 'stored' },
                    detected_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          }),
        },
        responses: {
          201: { description: 'Códigos novos gravados', content: json({ type: 'object', example: { received: 2, inserted: 2, duplicates: 0 } }) },
          200: { description: 'Todos já existiam' },
          400: err('Dados inválidos'),
          404: err('Sessão não encontrada'),
        },
      },
      get: {
        tags: ['Códigos de falha (DTC)'],
        summary: 'Códigos de falha da sessão, com a descrição em português',
        security: auth,
        parameters: [idPath],
        responses: {
          200: { description: 'OK', content: json({ type: 'array', items: ref('Dtc') }) },
          404: err('Sessão não encontrada'),
        },
      },
    },
    '/api/sessions/{id}/anomalies': {
      get: {
        tags: ['Anomalias'],
        summary: 'Quedas de tensão com o motor girando, calculadas na hora',
        description: 'Os limites são ajustáveis por parâmetro; os padrões são pontos de partida a calibrar em campo.',
        security: auth,
        parameters: [
          idPath,
          { name: 'voltage_min', in: 'query', schema: { type: 'number', default: 13 }, description: 'Abaixo disso (com o motor girando) é queda' },
          { name: 'rpm_min', in: 'query', schema: { type: 'integer', default: 700 }, description: 'Rotação mínima para considerar o motor girando' },
          { name: 'min_samples', in: 'query', schema: { type: 'integer', default: 2 }, description: 'Leituras seguidas necessárias' },
          { name: 'max_gap_s', in: 'query', schema: { type: 'number', default: 10 }, description: 'Buraco máximo entre leituras da mesma queda' },
        ],
        responses: {
          200: {
            description: 'OK',
            content: json({ type: 'object', properties: { parameters: { type: 'object' }, events: { type: 'array', items: ref('AnomalyEvent') } } }),
          },
          404: err('Sessão não encontrada'),
        },
      },
    },
    '/api/sessions/{id}/stream': {
      get: {
        tags: ['Telemetria'],
        summary: 'Transmissão ao vivo (Server-Sent Events)',
        description:
          'Eventos: `ready`, `readings` (leituras novas), `dtcs` (códigos de falha novos), `ended` (sessão encerrada). Envia um comentário `: ping` a cada 15 s. ' +
          'Precisa do cabeçalho Authorization, então leia com fetch (não com EventSource). O Swagger não exibe streams: teste com `curl -N`.',
        security: auth,
        parameters: [idPath],
        responses: {
          200: { description: 'Fluxo text/event-stream' },
          404: err('Sessão não encontrada'),
          503: err('Limite de transmissões atingido'),
        },
      },
    },
    '/api/anomalies': {
      get: {
        tags: ['Anomalias'],
        summary: 'Eventos de anomalia já gravados (gerados ao encerrar cada sessão)',
        security: auth,
        parameters: [
          { name: 'vehicle_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: 'OK', content: json({ type: 'array', items: { type: 'object' } }) } },
      },
    },
    '/api/sessions/{id}/end': {
      patch: {
        tags: ['Sessões'],
        summary: 'Encerra a sessão, procura quedas de tensão e avisa os painéis ao vivo',
        security: auth,
        parameters: [idPath],
        requestBody: {
          content: json({
            type: 'object',
            properties: { ended_at: { type: 'string', format: 'date-time', description: 'Padrão: agora' } },
          }),
        },
        responses: {
          200: { description: 'OK', content: json(ref('Session')) },
          404: err('Não encontrada'),
        },
      },
    },
  },
};
