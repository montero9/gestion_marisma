import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// El secreto nunca puede tener un valor público o predecible. En desarrollo se
// genera uno efímero; en producción la aplicación no arranca sin configurarlo.
const developmentSecret = crypto.randomBytes(48).toString('base64url');
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[SEGURIDAD CRÍTICA] JWT_SECRET es obligatorio en producción y debe tener al menos 16 caracteres.');
  }
  return developmentSecret;
}

/**
 * Hashea una contraseña con salt aleatorio de 16 bytes usando crypto.scrypt nativo
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifica si una contraseña coincide con el hash almacenado en tiempo constante
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

/**
 * Genera un token HMAC firmado (HS256)
 */
export function generateToken(payload: { id: string; username: string; rol: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + 7 * 24 * 60 * 60, // 7 días de validez
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`${header}.${data}`)
    .digest('base64url');

  return `${header}.${data}.${signature}`;
}

/**
 * Valida un token y devuelve el payload decodificado o null
 */
export function verifyToken(token: string): { id: string; username: string; rol: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;

    const expectedSignature = crypto
      .createHmac('sha256', getSecret())
      .update(`${header}.${data}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

// Extensión de tipo Request para Express
export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; rol: string };
}

/**
 * Middleware de Autenticación: exige un token Bearer válido
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Se requiere token de sesión' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Sesión expirada o token inválido' });
  }

  req.user = payload;
  next();
}

/**
 * Middleware de Autorización: exige rol ADMINISTRADOR
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  if (req.user.rol !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Permisos insuficientes: Requiere rol Administrador' });
  }
  next();
}
