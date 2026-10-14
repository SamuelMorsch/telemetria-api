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
    '/api/sessions/{id}/end': {
      patch: {
        tags: ['Sessões'],
        summary: 'Encerra a sessão',
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
