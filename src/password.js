import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// Custo do scrypt (padrão do Node): ~16 MB de memória por hash.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

/** Gera "scrypt$N$r$p$salt$hash" (salt aleatório por senha; tudo em base64). */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

/** Compara em tempo constante. Qualquer formato inesperado devolve false. */
export async function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, keyB64] = parts;
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
