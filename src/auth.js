import { SignJWT, jwtVerify } from 'jose';
import { HttpError } from './errors.js';

const ISSUER = 'telemetria-api';

/** Cria o assinador de tokens e os middlewares de autenticação/autorização. */
export function createAuth({ jwtSecret, jwtExpiresIn }) {
  const key = new TextEncoder().encode(jwtSecret);

  /** Token JWT (HS256) com: sub = id do usuário, wid = id da oficina, role = papel. */
  async function signToken(user) {
    return new SignJWT({ wid: user.workshop_id, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime(jwtExpiresIn)
      .sign(key);
  }

  /** Exige "Authorization: Bearer <token>" válido e preenche req.user. */
  async function requireAuth(req, _res, next) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new HttpError(401, 'unauthorized', 'Token ausente.');
    }
    let payload;
    try {
      ({ payload } = await jwtVerify(token, key, { algorithms: ['HS256'], issuer: ISSUER }));
    } catch {
      throw new HttpError(401, 'unauthorized', 'Token inválido ou expirado.');
    }
    req.user = { id: payload.sub, workshopId: payload.wid, role: payload.role };
    next();
  }

  /** Autoriza apenas os papéis informados (usar depois de requireAuth). */
  function requireRole(...roles) {
    return (req, _res, next) => {
      if (!roles.includes(req.user?.role)) {
        throw new HttpError(403, 'forbidden', 'Sem permissão para esta operação.');
      }
      next();
    };
  }

  return { signToken, requireAuth, requireRole };
}
