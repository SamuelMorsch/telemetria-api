/** Lê e valida as variáveis de ambiente. Falha cedo, com mensagem clara. */
export function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres (gere com: openssl rand -hex 32).');
  }
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL não definida.');
  }
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: env.DATABASE_URL,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '8h',
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    registrationEnabled: (env.REGISTRATION_ENABLED ?? 'true') === 'true',
  };
}
