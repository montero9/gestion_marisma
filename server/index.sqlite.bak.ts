import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { OdsExportService } from './services/odsExportService.js';
import {
  db,
  initDatabase,
  DOCUMENTS_DIR,
  UPLOADS_DIR,
  DATA_DIR,
  DB_PATH,
  mapAnimalRow,
  mapOwnerRow,
  mapStallionRow,
  mapMovementRow,
  mapUserRow,
  mapAuditLogRow,
  recordAudit,
  checkpointDb,
  reloadDbFromFile,
  validateDatabaseBuffer,
} from './db.js';
import {
  Animal,
  AnimalDocument,
  Annotation,
  Owner,
  Stallion,
  Movement,
  User,
  Association,
  AuditLog,
} from '../src/types/marisma.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  requireAuth,
  requireAdmin,
  AuthenticatedRequest,
} from './auth.js';

dotenv.config();

function getAuditUser(req: AuthenticatedRequest) {
  if (!req.user) throw new Error('No se puede auditar una operación sin sesión autenticada');
  const u = db.prepare('SELECT nombre_completo, rol FROM users WHERE id = ?').get(req.user.id) as any;
  if (!u) throw new Error('Usuario de auditoría no encontrado');
  return { id: req.user.id, nombre: u.nombre_completo || req.user.username, rol: u.rol as any };
}

function auditOperation(req: AuthenticatedRequest, accion: string, entidad: string, entidadId: string, detalles: Record<string, unknown>) {
  const user = getAuditUser(req);
  recordAudit(db, {
    usuarioId: user.id,
    usuarioNombre: user.nombre,
    usuarioRol: user.rol,
    accion,
    entidad,
    entidadId,
    detalles,
    ip: String(req.ip || req.socket.remoteAddress || ''),
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar la base de datos SQLite y semillas
initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Cabeceras de Seguridad y Hardening HTTP
app.disable('x-powered-by'); // Ocultar que el servidor corre en Express

app.use((req, res, next) => {
  // Redirección HTTPS automática en producción (Reverse Proxies de hosting)
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (process.env.NODE_ENV === 'production' && !isHttps) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  // Cabeceras de seguridad fundamentales contra XSS, Clickjacking y Sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* http://127.0.0.1:* ws: wss:;"
  );

  next();
});

// 2. Rate Limiting en memoria: solo cuenta intentos FALLIDOS para no bloquear usuarios legítimos
interface RateLimitBucket {
  failedAttempts: number;
  blockedUntil: number;
}
const loginRateLimitStore = new Map<string, RateLimitBucket>();

function loginRateLimiter(maxFailedAttempts = 5, blockDurationMs = 2 * 60 * 1000) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Si estamos en entorno de desarrollo local, no bloquear
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = String(ip);
    const now = Date.now();

    const record = loginRateLimitStore.get(key);
    if (record && record.blockedUntil > now) {
      const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return res.status(429).json({
        error: `Demasiados intentos fallidos. Por favor espere ${waitSeconds} segundos antes de volver a intentar.`,
      });
    }

    next();
  };
}

export function recordFailedLogin(ip: string, maxFailedAttempts = 5, blockDurationMs = 2 * 60 * 1000) {
  const now = Date.now();
  const record = loginRateLimitStore.get(ip) || { failedAttempts: 0, blockedUntil: 0 };
  record.failedAttempts++;

  if (record.failedAttempts >= maxFailedAttempts) {
    record.blockedUntil = now + blockDurationMs;
    console.warn(`[SEGURIDAD] IP ${ip} bloqueada temporalmente por ${blockDurationMs / 1000}s tras ${record.failedAttempts} fallos.`);
  }

  loginRateLimitStore.set(ip, record);
}

export function resetFailedLogin(ip: string) {
  loginRateLimitStore.delete(ip);
}

// Middlewares. En producción sólo se aceptan peticiones desde el origen
// configurado; las peticiones sin Origin (servicio interno/descarga directa)
// continúan requiriendo un token válido.
const configuredOrigins = new Set(
  (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopment = process.env.NODE_ENV !== 'production' &&
      (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
    if (!origin || configuredOrigins.has(origin) || isLocalDevelopment) return callback(null, true);
    return callback(new Error('Origen no autorizado por la política CORS'));
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Toda la API, salvo salud y login, requiere una cuenta activa. El rol se lee
// de la base de datos en cada petición para que bajas y cambios de permisos
// surtan efecto inmediatamente, incluso con tokens aún no vencidos.
app.use('/api', (req: AuthenticatedRequest, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login') return next();
  requireAuth(req, res, () => {
    const row = db.prepare('SELECT username, rol, activo FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!row || !row.activo) return res.status(401).json({ error: 'La cuenta no está activa' });
    req.user = { id: req.user!.id, username: row.username, rol: row.rol };
    const readOnlyMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const ownAccountWrite =
      (req.method === 'POST' && req.path === '/auth/logout') ||
      (req.method === 'PUT' && req.path === '/users/me/active-campaign') ||
      (req.method === 'POST' && req.path === '/auth/change-password');
    if (!readOnlyMethod && !ownAccountWrite && req.user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Permisos insuficientes: esta operación requiere rol Administrador' });
    }
    next();
  });
});

// Limpiador periódico del rate limit store cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of loginRateLimitStore.entries()) {
    if (now > b.blockedUntil) loginRateLimitStore.delete(key);
  }
}, 10 * 60 * 1000);

// Los adjuntos contienen datos personales y sólo se sirven a una cuenta activa.
app.use('/uploads', (req: AuthenticatedRequest, res, next) => {
  requireAuth(req, res, () => {
    const row = db.prepare('SELECT activo FROM users WHERE id = ?').get(req.user!.id) as any;
    if (!row?.activo) return res.status(401).json({ error: 'La cuenta no está activa' });
    next();
  });
}, express.static(UPLOADS_DIR));

// Configuración de Multer para subida de documentos y PDFs
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, DOCUMENTS_DIR);
  },
  filename: (_req, file, cb) => {
    // Sanitizar nombre de archivo y evitar colisiones
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${cleanName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Sólo se permiten PDF, JPG y PNG'));
    cb(null, true);
  },
});

const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB
});

function hasValidDocumentSignature(filePath: string, mimeType: string): boolean {
  const header = fs.readFileSync(filePath).subarray(0, 8);
  if (mimeType === 'application/pdf') return header.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimeType === 'image/png') return header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return false;
}

// ==========================================
// 1. HEALTHCHECK & COLD START WAKEUP
// ==========================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'Sistema Ganadero Marisma de Hinojos API',
    database: 'SQLite (node:sqlite) WAL',
  });
});

// ==========================================
// 2. BOOTSTRAP INICIAL COMPLETO (1 sola petición para hidratación rápida)
// ==========================================
app.get('/api/bootstrap', (req: AuthenticatedRequest, res) => {
  try {
    const animalsRows = db.prepare('SELECT * FROM animals ORDER BY plaza_numero ASC').all();
    const animals = animalsRows.map(mapAnimalRow);

    const ownersRows = db.prepare('SELECT * FROM owners ORDER BY nombre_completo ASC').all();
    const owners = ownersRows.map(mapOwnerRow);

    const asocRows = db.prepare('SELECT * FROM associations ORDER BY nombre ASC').all();
    const associations: Association[] = asocRows.map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      cif: r.cif,
      creadoEn: r.creado_en,
    }));

    const stallionsRows = db.prepare('SELECT * FROM stallions ORDER BY nombre ASC').all();
    const stallions = stallionsRows.map(mapStallionRow);

    const movRows = db.prepare('SELECT * FROM movements ORDER BY fecha DESC, rowid DESC').all();
    const movements = movRows.map(mapMovementRow);

    const campaignsRows = db.prepare('SELECT nombre FROM campaigns ORDER BY creado_en DESC, rowid DESC').all();
    const campaigns = campaignsRows.map((r: any) => r.nombre);

    const activeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as { value: string } | undefined;
    let activeCampaign: string = activeSetting?.value || '';
    if (!activeCampaign || !campaigns.includes(activeCampaign)) {
      activeCampaign = campaigns[0] || '2025-2026';
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('active_campaign', activeCampaign);
    }

    const usersRows = req.user?.rol === 'ADMINISTRADOR'
      ? db.prepare('SELECT * FROM users ORDER BY nombre_completo ASC').all()
      : [];
    const users = usersRows.map(mapUserRow);

    res.json({
      animals,
      owners,
      associations,
      stallions,
      movements,
      campaigns,
      activeCampaign,
      users,
    });
  } catch (error: any) {
    console.error('Error en /api/bootstrap:', error);
    res.status(500).json({ error: error.message || 'Error al obtener datos iniciales' });
  }
});

// ==========================================
// 3. ANIMALES Y PLAZAS
// ==========================================
app.get('/api/animals', (req, res) => {
  try {
    const { campana, tipo } = req.query;
    let query = 'SELECT * FROM animals WHERE 1=1';
    const params: any[] = [];

    if (campana) {
      query += ' AND campana = ?';
      params.push(campana);
    }
    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }
    query += ' ORDER BY plaza_numero ASC';

    const rows = db.prepare(query).all(...params);
    res.json(rows.map(mapAnimalRow));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/animals/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Animal no encontrado' });
    }
    res.json(mapAnimalRow(row));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// HELPERS DE PERSISTENCIA SEGURA (UPSERT)
// ==========================================
const ANIMAL_TYPES = new Set(['EQUINO', 'BOVINO']);
const PRESENCE_STATES = new Set(['DENTRO', 'FUERA', 'PROGRAMADO_ENTRADA', 'PLAZA_VACANTE']);
const MOVEMENT_TYPES = new Set(['ENTRADA', 'SALIDA']);
const USER_ROLES = new Set(['ADMINISTRADOR', 'CONSULTA']);

function requiredText(value: unknown, label: string, maxLength = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new Error(`${label} es obligatorio y no puede superar ${maxLength} caracteres`);
  }
  return value.trim();
}

function assertCampaignExists(campaign: unknown): string {
  const name = requiredText(campaign, 'La campaña', 30);
  if (!db.prepare('SELECT 1 FROM campaigns WHERE nombre = ?').get(name)) {
    throw new Error(`La campaña "${name}" no existe`);
  }
  return name;
}

function validateAnimalInput(a: Animal) {
  if (!a || !ANIMAL_TYPES.has(a.tipo)) throw new Error('Tipo de animal no válido');
  assertCampaignExists(a.campana);
  requiredText(a.plazaNumero, 'La plaza', 30);
  requiredText(a.propietario, 'El titular', 200);
  requiredText(a.identificacion1, 'La identificación primaria', 100);
  if (!['H', 'M'].includes(a.sexo)) throw new Error('Sexo no válido');
  if (!PRESENCE_STATES.has(a.estadoPresencia)) throw new Error('Estado de presencia no válido');
  if (!Array.isArray(a.documentos) || !Array.isArray(a.anotaciones)) throw new Error('El formato de documentos o anotaciones no es válido');
  if (a.tipo === 'BOVINO' && a.nombreAnimal) throw new Error('Los bovinos no pueden tener nombre');
}

function validateOwnerInput(o: Owner) {
  if (!o) throw new Error('Datos de ganadero no válidos');
  assertCampaignExists(o.campana || '');
  requiredText(o.nombreCompleto, 'El nombre completo', 200);
  requiredText(o.dniCif, 'El DNI/CIF', 30);
}

function validateStallionInput(s: Stallion) {
  if (!s || !ANIMAL_TYPES.has(s.tipo)) throw new Error('Tipo de semental no válido');
  assertCampaignExists(s.campana);
  requiredText(s.identificacionChip, 'La identificación del semental', 100);
  requiredText(s.propietario, 'El titular', 200);
  if (!['AUTORIZADO', 'PENDIENTE_VALORACION', 'NO_AUTORIZADO'].includes(s.estadoAprobacion)) {
    throw new Error('Estado de aprobación no válido');
  }
}

function upsertAnimalRecord(a: Animal, overrideId?: string): Animal {
  validateAnimalInput(a);
  const now = new Date().toISOString();
  const animalId = overrideId || a.id || `anm-${Date.now()}`;

  // Si no es plaza vacante y tiene número de plaza asignado, eliminar plaza vacante previa si existiera
  if (!a.esPlazaVacante && a.plazaNumero) {
    db.prepare(
      'DELETE FROM animals WHERE es_plaza_vacante = 1 AND campana = ? AND UPPER(plaza_numero) = ? AND id != ?'
    ).run(a.campana, a.plazaNumero.trim().toUpperCase(), animalId);
  }

  const upsert = db.prepare(`
    INSERT INTO animals (
      id, tipo, campana, plaza_numero, propietario, finca,
      identificacion1, identificacion2, nombre_animal, sexo, fecha_nacimiento,
      capa, fecha_ultima_revision, estado_presencia, fecha_entrada_marisma,
      fecha_salida_marisma, es_semental, es_plaza_vacante, animal_anterior_id,
      rastra_json, documentos_json, anotaciones_json, creado_en, actualizado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      tipo = excluded.tipo,
      campana = excluded.campana,
      plaza_numero = excluded.plaza_numero,
      propietario = excluded.propietario,
      finca = excluded.finca,
      identificacion1 = excluded.identificacion1,
      identificacion2 = excluded.identificacion2,
      nombre_animal = excluded.nombre_animal,
      sexo = excluded.sexo,
      fecha_nacimiento = excluded.fecha_nacimiento,
      capa = excluded.capa,
      fecha_ultima_revision = excluded.fecha_ultima_revision,
      estado_presencia = excluded.estado_presencia,
      fecha_entrada_marisma = excluded.fecha_entrada_marisma,
      fecha_salida_marisma = excluded.fecha_salida_marisma,
      es_semental = excluded.es_semental,
      es_plaza_vacante = excluded.es_plaza_vacante,
      animal_anterior_id = excluded.animal_anterior_id,
      rastra_json = excluded.rastra_json,
      documentos_json = excluded.documentos_json,
      anotaciones_json = excluded.anotaciones_json,
      actualizado_en = excluded.actualizado_en
  `);

  upsert.run(
    animalId,
    a.tipo,
    a.campana,
    a.plazaNumero,
    a.propietario,
    a.finca || 'HINOJOS',
    a.identificacion1 || '',
    a.identificacion2 || '',
    a.tipo === 'BOVINO' ? '' : (a.nombreAnimal || (a.esPlazaVacante ? 'PLAZA VACANTE' : 'SIN NOMBRE')),
    a.sexo,
    a.fechaNacimiento || '',
    a.capa,
    a.fechaUltimaRevision || null,
    a.estadoPresencia,
    a.fechaEntradaMarisma || null,
    a.fechaSalidaMarisma || null,
    a.esSemental ? 1 : 0,
    a.esPlazaVacante ? 1 : 0,
    a.animalAnteriorId || null,
    a.rastra ? JSON.stringify(a.rastra) : null,
    JSON.stringify(a.documentos || []),
    JSON.stringify(a.anotaciones || []),
    a.creadoEn || now,
    now
  );

  const saved = db.prepare('SELECT * FROM animals WHERE id = ?').get(animalId);
  return mapAnimalRow(saved);
}

function normalizeOwnerName(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function upsertOwnerRecord(o: Owner, overrideId?: string): Owner {
  validateOwnerInput(o);
  const id = overrideId || o.id || `own-${Date.now()}`;
  const campana = o.campana || '2025-2026';
  const cleanDni = (o.dniCif || '').trim().toUpperCase();

  // 1. Evitar duplicado de DNI en la misma campaña
  if (cleanDni) {
    const dupInCamp = db.prepare(
      'SELECT id, nombre_completo FROM owners WHERE campana = ? AND UPPER(TRIM(dni_cif)) = ? AND id != ?'
    ).get(campana, cleanDni, id) as any;
    if (dupInCamp) {
      throw new Error(`El DNI/CIF "${cleanDni}" ya está registrado en la campaña ${campana} a nombre de "${dupInCamp.nombre_completo}".`);
    }

    // 2. Control de unicidad histórica: el DNI no puede asignarse a un titular diferente
    const histOwner = db.prepare(
      'SELECT nombre_completo FROM owners WHERE UPPER(TRIM(dni_cif)) = ? AND id != ? LIMIT 1'
    ).get(cleanDni, id) as any;
    if (histOwner && normalizeOwnerName(o.nombreCompleto) !== normalizeOwnerName(histOwner.nombre_completo)) {
      throw new Error(`El DNI/CIF "${cleanDni}" ya pertenece en el censo municipal a "${histOwner.nombre_completo}". No se permite registrarlo con otro nombre.`);
    }
  }

  // Obtener nombre anterior antes de actualizar para cascada de animales si cambió
  const existing = db.prepare('SELECT nombre_completo, campana FROM owners WHERE id = ?').get(id) as any;
  const oldName = existing?.nombre_completo;
  const oldCampana = existing?.campana || campana;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO owners (id, campana, nombre_completo, dni_cif, telefono, email, direccion, municipio, codigo_rega, asociacion, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        campana = excluded.campana,
        nombre_completo = excluded.nombre_completo,
        dni_cif = excluded.dni_cif,
        telefono = excluded.telefono,
        email = excluded.email,
        direccion = excluded.direccion,
        municipio = excluded.municipio,
        codigo_rega = excluded.codigo_rega,
        asociacion = excluded.asociacion,
        notas = excluded.notas
    `).run(
      id,
      campana,
      o.nombreCompleto,
      o.dniCif,
      o.telefono || '',
      o.email || '',
      o.direccion || '',
      o.municipio || 'Hinojos',
      o.codigoRega || '',
      o.asociacion || '',
      o.notas || ''
    );

    // Cascada: si cambió el nombre del ganadero, actualizarlo en los animales de esta campaña
    if (oldName && oldName !== o.nombreCompleto) {
      db.prepare('UPDATE animals SET propietario = ? WHERE propietario = ? AND campana = ?').run(
        o.nombreCompleto,
        oldName,
        campana
      );
      // También en sementales
      db.prepare('UPDATE stallions SET propietario = ? WHERE propietario = ? AND campana = ?').run(
        o.nombreCompleto,
        oldName,
        campana
      );
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  return mapOwnerRow(db.prepare('SELECT * FROM owners WHERE id = ?').get(id));
}

function upsertStallionRecord(s: Stallion, overrideId?: string): Stallion {
  validateStallionInput(s);
  const id = overrideId || s.id || `stl-${Date.now()}`;
  db.prepare(`
    INSERT INTO stallions (id, tipo, campana, nombre, identificacion_chip, ueln, propietario, fecha_nacimiento, capa, estado_aprobacion, numero_yeguas_cubiertas, zona_marisma, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      tipo = excluded.tipo,
      campana = excluded.campana,
      nombre = excluded.nombre,
      identificacion_chip = excluded.identificacion_chip,
      ueln = excluded.ueln,
      propietario = excluded.propietario,
      fecha_nacimiento = excluded.fecha_nacimiento,
      capa = excluded.capa,
      estado_aprobacion = excluded.estado_aprobacion,
      numero_yeguas_cubiertas = excluded.numero_yeguas_cubiertas,
      zona_marisma = excluded.zona_marisma,
      observaciones = excluded.observaciones
  `).run(
    id,
    s.tipo,
    s.campana,
    s.nombre,
    s.identificacionChip || '',
    s.ueln || '',
    s.propietario,
    s.fechaNacimiento || '',
    s.capa,
    s.estadoAprobacion || 'AUTORIZADO',
    s.numeroYeguasCubiertas || 0,
    s.zonaMarisma || '',
    s.observaciones || ''
  );
  return mapStallionRow(db.prepare('SELECT * FROM stallions WHERE id = ?').get(id));
}

app.post('/api/animals', (req, res) => {
  try {
    const saved = upsertAnimalRecord(req.body);
    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'ALTA',
      entidad: 'ANIMAL',
      entidadId: saved.plazaNumero || saved.id,
      detalles: {
        tipo: saved.tipo,
        plaza: saved.plazaNumero,
        nombre: saved.nombreAnimal,
        titular: saved.propietario,
        crotal: saved.identificacion1,
        campana: saved.campana,
      },
    });
    res.status(201).json(saved);
  } catch (error: any) {
    console.error('Error en POST /api/animals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/animals/:id', (req, res) => {
  try {
    const prevRow = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id) as any;
    const prevAnimal = prevRow ? mapAnimalRow(prevRow) : null;
    const saved = upsertAnimalRecord(req.body, req.params.id);
    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'MODIFICACION',
      entidad: 'ANIMAL',
      entidadId: saved.plazaNumero || req.params.id,
      detalles: {
        tipo: saved.tipo,
        plaza: saved.plazaNumero,
        nombre: saved.nombreAnimal,
        titular: saved.propietario,
        titularAnterior: prevAnimal && prevAnimal.propietario !== saved.propietario ? prevAnimal.propietario : undefined,
        estado: saved.estadoPresencia,
        campana: saved.campana,
      },
    });
    res.json(saved);
  } catch (error: any) {
    console.error('Error en PUT /api/animals/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/animals/:id', (req, res) => {
  try {
    const prevRow = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id) as any;
    const prevAnimal = prevRow ? mapAnimalRow(prevRow) : null;
    db.prepare('DELETE FROM animals WHERE id = ?').run(req.params.id);
    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'BAJA',
      entidad: 'ANIMAL',
      entidadId: prevAnimal?.plazaNumero || req.params.id,
      detalles: {
        plaza: prevAnimal?.plazaNumero,
        nombre: prevAnimal?.nombreAnimal,
        titular: prevAnimal?.propietario,
        crotal: prevAnimal?.identificacion1,
        campana: prevAnimal?.campana,
      },
    });
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Intercambio atómico de plazas (Permuta de plazas)
app.post('/api/animals/swap', (req, res) => {
  try {
    const { animalAId, animalBId, motivo, autor } = req.body;
    if (!animalAId || !animalBId) {
      return res.status(400).json({ error: 'Se requieren animalAId y animalBId' });
    }

    const rowA = db.prepare('SELECT * FROM animals WHERE id = ?').get(animalAId);
    const rowB = db.prepare('SELECT * FROM animals WHERE id = ?').get(animalBId);

    if (!rowA || !rowB) {
      return res.status(404).json({ error: 'Uno o ambos animales no existen' });
    }

    const animalA = mapAnimalRow(rowA);
    const animalB = mapAnimalRow(rowB);

    const plazaA = animalA.plazaNumero;
    const propA = animalA.propietario;
    const plazaB = animalB.plazaNumero;
    const propB = animalB.propietario;

    const dateStr = new Date().toISOString().slice(0, 10);
    const annotationTextA = motivo?.trim()
      ? `Permuta de plaza: El animal pasa a la Plaza ${plazaB} (Titular: ${propB}). Motivo: ${motivo.trim()}`
      : `Permuta de plaza: El animal pasa a la Plaza ${plazaB} (Titular: ${propB}).`;
    const annotationTextB = motivo?.trim()
      ? `Permuta de plaza: El animal pasa a la Plaza ${plazaA} (Titular: ${propA}). Motivo: ${motivo.trim()}`
      : `Permuta de plaza: El animal pasa a la Plaza ${plazaA} (Titular: ${propA}).`;

    const anotacionesA = [
      ...animalA.anotaciones,
      {
        id: `ant-${Date.now()}-a`,
        fecha: dateStr,
        autor: autor || 'Guardería / Gestión Municipal',
        categoria: 'GUARDERIA' as const,
        texto: annotationTextA,
      },
    ];

    const anotacionesB = [
      ...animalB.anotaciones,
      {
        id: `ant-${Date.now()}-b`,
        fecha: dateStr,
        autor: autor || 'Guardería / Gestión Municipal',
        categoria: 'GUARDERIA' as const,
        texto: annotationTextB,
      },
    ];

    const now = new Date().toISOString();

    // Transacción SQLite Atómica
    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare(`
        UPDATE animals SET
          plaza_numero = ?, propietario = ?, anotaciones_json = ?, actualizado_en = ?
        WHERE id = ?
      `).run(plazaB, propB, JSON.stringify(anotacionesA), now, animalAId);

      db.prepare(`
        UPDATE animals SET
          plaza_numero = ?, propietario = ?, anotaciones_json = ?, actualizado_en = ?
        WHERE id = ?
      `).run(plazaA, propA, JSON.stringify(anotacionesB), now, animalBId);

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const updatedA = mapAnimalRow(db.prepare('SELECT * FROM animals WHERE id = ?').get(animalAId));
    const updatedB = mapAnimalRow(db.prepare('SELECT * FROM animals WHERE id = ?').get(animalBId));

    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'PERMUTA',
      entidad: 'PLAZAS',
      entidadId: `${plazaA} ↔ ${plazaB}`,
      detalles: {
        plazaA,
        titularA: propA,
        plazaB,
        titularB: propB,
        motivo: motivo || 'Permuta municipal autorizada',
      },
    });

    res.json({ success: true, animalA: updatedA, animalB: updatedB });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. SUBIDA Y GESTIÓN DE DOCUMENTOS (PDFs, certificados, fotos)
// ==========================================
app.post('/api/animals/:id/documents', upload.single('file'), (req, res) => {
  try {
    const animalId = req.params.id;
    const file = req.file;
    const { tipo, nombre } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    }
    if (!hasValidDocumentSignature(file.path, file.mimetype)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'El contenido del archivo no coincide con un PDF, JPG o PNG válido' });
    }

    const row = db.prepare('SELECT * FROM animals WHERE id = ?').get(animalId);
    if (!row) {
      // Eliminar archivo si el animal no existe
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Animal no encontrado' });
    }

    const animal = mapAnimalRow(row);
    const relativeUrl = `/uploads/documents/${file.filename}`;
    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const newDoc: AnimalDocument = {
      id: `doc-${Date.now()}`,
      nombre: nombre || file.originalname,
      tipo: tipo || 'OTRO',
      fechaSubida: new Date().toISOString().slice(0, 10),
      tamano: sizeStr,
      url: relativeUrl,
    };

    const updatedDocs = [...animal.documentos, newDoc];
    const now = new Date().toISOString();

    db.prepare('UPDATE animals SET documentos_json = ?, actualizado_en = ? WHERE id = ?').run(
      JSON.stringify(updatedDocs),
      now,
      animalId
    );
    auditOperation(req, 'MODIFICACION', 'ANIMAL', animalId, { operacion: 'SUBIR_DOCUMENTO', documento: newDoc.nombre, tipo: newDoc.tipo });

    res.status(201).json({ success: true, document: newDoc, documents: updatedDocs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/animals/:id/documents/:docId', (req, res) => {
  try {
    const { id: animalId, docId } = req.params;
    const row = db.prepare('SELECT * FROM animals WHERE id = ?').get(animalId);
    if (!row) return res.status(404).json({ error: 'Animal no encontrado' });

    const animal = mapAnimalRow(row);
    const targetDoc = animal.documentos.find((d) => d.id === docId);

    if (targetDoc && targetDoc.url) {
      const fileName = path.basename(targetDoc.url);
      const filePath = path.join(DOCUMENTS_DIR, fileName);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.warn('No se pudo borrar archivo físico:', filePath);
        }
      }
    }

    const updatedDocs = animal.documentos.filter((d) => d.id !== docId);
    const now = new Date().toISOString();

    db.prepare('UPDATE animals SET documentos_json = ?, actualizado_en = ? WHERE id = ?').run(
      JSON.stringify(updatedDocs),
      now,
      animalId
    );
    auditOperation(req, 'MODIFICACION', 'ANIMAL', animalId, { operacion: 'ELIMINAR_DOCUMENTO', documentoId: docId });

    res.json({ success: true, documents: updatedDocs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Anotaciones en animal
app.post('/api/animals/:id/annotations', (req, res) => {
  try {
    const animalId = req.params.id;
    const annotation: Annotation = req.body;
    const row = db.prepare('SELECT * FROM animals WHERE id = ?').get(animalId);
    if (!row) return res.status(404).json({ error: 'Animal no encontrado' });

    const animal = mapAnimalRow(row);
    const newAnnotation: Annotation = {
      id: annotation.id || `ant-${Date.now()}`,
      fecha: annotation.fecha || new Date().toISOString().slice(0, 10),
      autor: annotation.autor || 'Guardería / Gestión Municipal',
      categoria: annotation.categoria || 'GUARDERIA',
      texto: annotation.texto,
    };

    const updated = [...animal.anotaciones, newAnnotation];
    const now = new Date().toISOString();

    db.prepare('UPDATE animals SET anotaciones_json = ?, actualizado_en = ? WHERE id = ?').run(
      JSON.stringify(updated),
      now,
      animalId
    );
    auditOperation(req, 'MODIFICACION', 'ANIMAL', animalId, { operacion: 'ANOTACION', categoria: newAnnotation.categoria });

    res.status(201).json({ success: true, annotation: newAnnotation, anotaciones: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. GANADEROS (OWNERS) Y ASOCIACIONES
// ==========================================
app.get('/api/owners', (req, res) => {
  try {
    const { campana } = req.query;
    let query = 'SELECT * FROM owners';
    const params: any[] = [];
    if (campana) {
      query += ' WHERE campana = ?';
      params.push(campana);
    }
    query += ' ORDER BY nombre_completo ASC';
    const rows = db.prepare(query).all(...params);
    res.json(rows.map(mapOwnerRow));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/owners', (req, res) => {
  try {
    const saved = upsertOwnerRecord(req.body);
    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'CREAR_EDITAR_GANADERO',
      entidad: 'GANADERO',
      entidadId: saved.id,
      detalles: { nombre: saved.nombreCompleto, dniCif: saved.dniCif, campana: saved.campana },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/owners/:id', (req, res) => {
  try {
    const saved = upsertOwnerRecord(req.body, req.params.id);
    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'CREAR_EDITAR_GANADERO',
      entidad: 'GANADERO',
      entidadId: saved.id,
      detalles: { nombre: saved.nombreCompleto, dniCif: saved.dniCif, campana: saved.campana },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/owners/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { reassignAnimalesTo } = req.body || {};

    const targetOwner = db.prepare('SELECT * FROM owners WHERE id = ?').get(id) as any;
    if (!targetOwner) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }

    const campana = targetOwner.campana || '2025-2026';
    const ownerName = targetOwner.nombre_completo;

    // Contar cuántos animales tiene asignados en esta campaña
    const animalCountRow = db.prepare(
      'SELECT COUNT(*) as total FROM animals WHERE propietario = ? AND campana = ?'
    ).get(ownerName, campana) as { total: number };
    const animalCount = animalCountRow ? animalCountRow.total : 0;

    // Si tiene animales y no se especificó a quién transferirlos, error exigiendo reasignación
    if (animalCount > 0 && (!reassignAnimalesTo || !reassignAnimalesTo.trim())) {
      return res.status(400).json({
        error: `El ganadero "${ownerName}" tiene ${animalCount} animal(es) asignados en la campaña ${campana}. Debe seleccionar un ganadero receptor para reasignar dichos animales.`,
        animalCount,
      });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // Si tiene animales, reasignarlos al nuevo propietario
      if (animalCount > 0 && reassignAnimalesTo) {
        const cleanReassign = reassignAnimalesTo.trim();
        db.prepare('UPDATE animals SET propietario = ? WHERE propietario = ? AND campana = ?').run(
          cleanReassign,
          ownerName,
          campana
        );
        // También reasignar sementales si tuviese
        db.prepare('UPDATE stallions SET propietario = ? WHERE propietario = ? AND campana = ?').run(
          cleanReassign,
          ownerName,
          campana
        );
      }

      // Eliminar el propietario de esta campaña
      db.prepare('DELETE FROM owners WHERE id = ?').run(id);

      db.exec('COMMIT;');

      const user = getAuditUser(req);
      recordAudit(db, {
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        usuarioRol: user.rol,
        accion: 'ELIMINAR_GANADERO',
        entidad: 'GANADERO',
        entidadId: id,
        detalles: {
          nombre: ownerName,
          campana,
          animalesReasignados: animalCount,
          nuevoPropietario: reassignAnimalesTo || null,
        },
        ip: String(req.ip || req.socket.remoteAddress || ''),
      });

      res.json({
        success: true,
        id,
        nombre: ownerName,
        campana,
        animalesReasignados: animalCount,
        nuevoPropietario: reassignAnimalesTo || null,
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Asociaciones
app.get('/api/associations', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM associations ORDER BY nombre ASC').all();
    res.json(rows.map((r: any) => ({ id: r.id, nombre: r.nombre, cif: r.cif, creadoEn: r.creado_en })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/associations', (req, res) => {
  try {
    const { nombre, cif } = req.body;
    if (!nombre || !cif) {
      return res.status(400).json({ error: 'Nombre y CIF son obligatorios' });
    }
    const cleanNombre = nombre.trim();
    const cleanCif = cif.trim().toUpperCase();

    // Comprobar si ya existe una asociación con este nombre o CIF
    const existing = db.prepare('SELECT id FROM associations WHERE LOWER(nombre) = LOWER(?) OR UPPER(cif) = ?').get(cleanNombre, cleanCif) as any;
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una asociación con ese nombre o CIF' });
    }

    const id = req.body.id || `asoc-${Date.now()}`;
    const now = new Date().toISOString();
    db.prepare('INSERT INTO associations (id, nombre, cif, creado_en) VALUES (?, ?, ?, ?)').run(
      id,
      cleanNombre,
      cleanCif,
      now
    );
    auditOperation(req, 'ALTA', 'ASOCIACION', id, { nombre: cleanNombre, cif: cleanCif });
    res.status(201).json({ id, nombre: cleanNombre, cif: cleanCif, creadoEn: now });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/associations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cif } = req.body;
    if (!nombre || !cif) {
      return res.status(400).json({ error: 'Nombre y CIF son obligatorios' });
    }

    const current = db.prepare('SELECT * FROM associations WHERE id = ?').get(id) as any;
    if (!current) {
      return res.status(404).json({ error: 'Asociación no encontrada' });
    }

    const cleanNombre = nombre.trim();
    const cleanCif = cif.trim().toUpperCase();

    // Comprobar si otra asociación distinta ya usa ese nombre o CIF
    const duplicate = db.prepare(
      'SELECT id FROM associations WHERE (LOWER(nombre) = LOWER(?) OR UPPER(cif) = ?) AND id != ?'
    ).get(cleanNombre, cleanCif, id) as any;
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe otra asociación con ese nombre o CIF' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Actualizar datos de la asociación
      db.prepare('UPDATE associations SET nombre = ?, cif = ? WHERE id = ?').run(
        cleanNombre,
        cleanCif,
        id
      );

      // 2. Si ha cambiado el nombre de la asociación, actualizar en cascada a todos los propietarios asociados
      if (current.nombre !== cleanNombre) {
        db.prepare('UPDATE owners SET asociacion = ? WHERE asociacion = ?').run(cleanNombre, current.nombre);
      }

      db.exec('COMMIT;');
      auditOperation(req, 'MODIFICACION', 'ASOCIACION', id, { nombreAnterior: current.nombre, nombre: cleanNombre, cif: cleanCif });
      res.json({ id, nombre: cleanNombre, cif: cleanCif, creadoEn: current.creado_en });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/associations/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { reassignTo } = req.body || {}; // Puede ser un nombre de asociación o '' para "Sin asociación"

    const current = db.prepare('SELECT * FROM associations WHERE id = ?').get(id) as any;
    if (!current) {
      return res.status(404).json({ error: 'Asociación no encontrada' });
    }

    // Contar socios actualmente vinculados
    const countRow = db.prepare('SELECT COUNT(*) as total FROM owners WHERE asociacion = ?').get(current.nombre) as { total: number };
    const memberCount = countRow ? countRow.total : 0;

    // Si tiene socios y no se indicó qué hacer con ellos
    if (memberCount > 0 && reassignTo === undefined) {
      return res.status(400).json({
        error: `La asociación tiene ${memberCount} socio(s) vinculados. Debe especificar si reasignarlos o dejarlos sin asociación.`,
        memberCount,
      });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // Si tiene socios y se indicó reassignTo:
      if (memberCount > 0) {
        const targetAsoc = typeof reassignTo === 'string' ? reassignTo.trim() : '';
        db.prepare('UPDATE owners SET asociacion = ? WHERE asociacion = ?').run(targetAsoc, current.nombre);
      }

      // Eliminar la asociación
      db.prepare('DELETE FROM associations WHERE id = ?').run(id);

      db.exec('COMMIT;');
      auditOperation(req, 'BAJA', 'ASOCIACION', id, { nombre: current.nombre, sociosReasignados: memberCount, nuevaAsociacion: reassignTo || null });
      res.json({
        success: true,
        id,
        nombre: current.nombre,
        sociosReasignados: memberCount,
        nuevaAsociacion: reassignTo || 'Sin Asociación / Particular',
      });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. LIBRO DE SEMENTALES
// ==========================================
app.get('/api/stallions', (req, res) => {
  try {
    const { campana, tipo } = req.query;
    let query = 'SELECT * FROM stallions WHERE 1=1';
    const params: any[] = [];
    if (campana) {
      query += ' AND campana = ?';
      params.push(campana);
    }
    if (tipo) {
      query += ' AND tipo = ?';
      params.push(tipo);
    }
    query += ' ORDER BY nombre ASC';
    const rows = db.prepare(query).all(...params);
    res.json(rows.map(mapStallionRow));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stallions', (req, res) => {
  try {
    const saved = upsertStallionRecord(req.body);
    auditOperation(req, 'ALTA', 'SEMENTAL', saved.id, { tipo: saved.tipo, campana: saved.campana, identificacion: saved.identificacionChip });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stallions/:id', (req, res) => {
  try {
    const saved = upsertStallionRecord(req.body, req.params.id);
    auditOperation(req, 'MODIFICACION', 'SEMENTAL', saved.id, { tipo: saved.tipo, campana: saved.campana, identificacion: saved.identificacionChip });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stallions/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM stallions WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Semental no encontrado' });
    db.prepare('DELETE FROM stallions WHERE id = ?').run(req.params.id);
    auditOperation(req, 'BAJA', 'SEMENTAL', req.params.id, { id: req.params.id });
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. MOVIMIENTOS Y TRAZABILIDAD (Atómico)
// ==========================================
app.get('/api/movements', (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM movements ORDER BY fecha DESC, rowid DESC').all();
    res.json(rows.map(mapMovementRow));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/movements', (req, res) => {
  try {
    const m: Movement = req.body;
    if (!m || !MOVEMENT_TYPES.has(m.tipoMovimiento)) {
      return res.status(400).json({ error: 'Tipo de movimiento no válido' });
    }
    requiredText(m.animalId, 'El animal', 100);
    requiredText(m.fecha, 'La fecha', 30);
    requiredText(m.motivo, 'El motivo', 100);
    const id = m.id || `mov-${Date.now()}`;
    const now = new Date().toISOString();
    let targetCampana = m.campana || '2025-2026';

    db.exec('BEGIN TRANSACTION;');
    try {
      const animalRow = db.prepare('SELECT * FROM animals WHERE id = ?').get(m.animalId) as any;
      if (!animalRow) throw new Error('El animal indicado no existe');
      const animal = mapAnimalRow(animalRow);
      if (m.campana && m.campana !== animal.campana) throw new Error('La campaña del movimiento no coincide con la del animal');
      if (m.tipoAnimal !== animal.tipo || m.plazaNumero !== animal.plazaNumero || m.propietario !== animal.propietario) {
        throw new Error('Los datos de especie, plaza o titular no coinciden con el animal seleccionado');
      }
      targetCampana = animal.campana;
      const targetIdentificacion1 = animal.identificacion1;

      // 1. Registrar movimiento con campaña e identificación
      db.prepare(`
        INSERT INTO movements (id, animal_id, campana, identificacion1, tipo_animal, plaza_numero, nombre_animal, propietario, tipo_movimiento, fecha, motivo, numero_guia, guarda_responsable, observaciones, liberar_plaza)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        m.animalId,
        targetCampana,
        targetIdentificacion1,
        m.tipoAnimal,
        m.plazaNumero,
        m.tipoAnimal === 'BOVINO' ? '' : (m.nombreAnimal || ''),
        m.propietario,
        m.tipoMovimiento,
        m.fecha,
        m.motivo,
        m.numeroGuia || '',
        m.guardaResponsable || '',
        m.observaciones || '',
        m.liberarPlaza ? 1 : 0
      );

      // 2. Si hay un animal objetivo, actualizar su estado según las normas municipales
      if (animalRow) {
        let nuevoEstado = animal.estadoPresencia;
        let salidaMarisma = animal.fechaSalidaMarisma;
        let entradaMarisma = animal.fechaEntradaMarisma;
        let esPlazaVacante = animal.esPlazaVacante;

        if (m.tipoMovimiento === 'ENTRADA') {
          nuevoEstado = 'DENTRO';
          entradaMarisma = m.fecha;
          salidaMarisma = undefined;
        } else if (m.tipoMovimiento === 'SALIDA') {
          nuevoEstado = 'FUERA';
          salidaMarisma = m.fecha;
          if (m.liberarPlaza) {
            esPlazaVacante = true;
            nuevoEstado = 'PLAZA_VACANTE';
          }
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        const movAnnotation: Annotation = {
          id: `ant-${Date.now()}`,
          fecha: dateStr,
          autor: m.guardaResponsable || 'Guardería Rural',
          categoria: 'GUARDERIA',
          texto: `Movimiento registrado: ${m.tipoMovimiento} (${m.motivo}). Guía: ${m.numeroGuia || 'S/N'}. ${m.observaciones || ''}`,
        };

        const updatedAnotaciones = [...animal.anotaciones, movAnnotation];

        db.prepare(`
          UPDATE animals SET
            estado_presencia = ?,
            fecha_entrada_marisma = ?,
            fecha_salida_marisma = ?,
            es_plaza_vacante = ?,
            anotaciones_json = ?,
            actualizado_en = ?
          WHERE id = ?
        `).run(
          nuevoEstado,
          entradaMarisma || null,
          salidaMarisma || null,
          esPlazaVacante ? 1 : 0,
          JSON.stringify(updatedAnotaciones),
          now,
          m.animalId
        );
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const saved = db.prepare('SELECT * FROM movements WHERE id = ?').get(id);

    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'MOVIMIENTO',
      entidad: 'MOVIMIENTO',
      entidadId: m.plazaNumero || id,
      detalles: {
        tipoMovimiento: m.tipoMovimiento,
        plaza: m.plazaNumero,
        titular: m.propietario,
        motivo: m.motivo,
        campana: targetCampana,
        guia: m.numeroGuia,
        guarda: m.guardaResponsable,
      },
    });

    res.status(201).json(mapMovementRow(saved));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. CAMPAÑAS Y CONFIGURACIÓN
// ==========================================
app.get('/api/campaigns', (_req, res) => {
  try {
    const rows = db.prepare('SELECT nombre, activa, creado_en FROM campaigns ORDER BY creado_en DESC, rowid DESC').all();
    const activeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as { value: string } | undefined;
    res.json({
      campaigns: rows.map((r: any) => r.nombre),
      activeCampaign: activeSetting?.value || '2025-2026',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', requireAuth, requireAdmin, (req, res) => {
  try {
    const { nombre, cloneFromCampaign, selectedOwners, selectedAnimals, setActiveImmediately } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre de campaña requerido' });

    db.exec('BEGIN TRANSACTION;');
    try {
      db.prepare('INSERT OR IGNORE INTO campaigns (nombre, activa, creado_en) VALUES (?, 1, ?)').run(
        nombre,
        new Date().toISOString()
      );

      // 1. Traspaso de Socios/Ganaderos a la nueva campaña
      if (Array.isArray(selectedOwners) && selectedOwners.length > 0) {
        const insertOwnerStmt = db.prepare(`
          INSERT INTO owners (id, campana, nombre_completo, dni_cif, telefono, email, direccion, municipio, codigo_rega, asociacion, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const ow of selectedOwners) {
          const newOwnerId = `own-${Date.now()}-${Math.round(Math.random() * 10000)}`;
          insertOwnerStmt.run(
            newOwnerId,
            nombre,
            ow.nombreCompleto,
            ow.dniCif,
            ow.telefono || '',
            ow.email || '',
            ow.direccion || '',
            ow.municipio || 'Hinojos',
            ow.codigoRega || '',
            ow.asociacion || '',
            ow.notas || ''
          );
        }
      } else if (cloneFromCampaign) {
        // Si no se pasaron explícitos pero se seleccionó cloneFromCampaign, traspasar todos los de esa campaña por defecto
        const sourceOwners = db.prepare('SELECT * FROM owners WHERE campana = ?').all(cloneFromCampaign) as any[];
        const insertOwnerStmt = db.prepare(`
          INSERT INTO owners (id, campana, nombre_completo, dni_cif, telefono, email, direccion, municipio, codigo_rega, asociacion, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ow of sourceOwners) {
          const newOwnerId = `own-${Date.now()}-${Math.round(Math.random() * 10000)}`;
          insertOwnerStmt.run(
            newOwnerId,
            nombre,
            ow.nombre_completo,
            ow.dni_cif,
            ow.telefono || '',
            ow.email || '',
            ow.direccion || '',
            ow.municipio || 'Hinojos',
            ow.codigo_rega || '',
            ow.asociacion || '',
            ow.notas || ''
          );
        }
      }

      // 2. Traspaso de Animales a la nueva campaña
      if (Array.isArray(selectedAnimals)) {
        // Ordenación según criterios oficiales del municipio:
        // 1º Agrupados por especie (EQUINO antes que BOVINO)
        // 2º Alfabéticamente por el nombre del titular adjudicatario
        // 3º Por número de plaza de origen / nombre
        const sortedAnimals = [...selectedAnimals].sort((a, b) => {
          if (a.tipo !== b.tipo) return a.tipo === 'EQUINO' ? -1 : 1;
          const propA = (a.propietario || '').trim();
          const propB = (b.propietario || '').trim();
          const compOwner = propA.localeCompare(propB, 'es', { sensitivity: 'base' });
          if (compOwner !== 0) return compOwner;
          const numA = parseInt((String(a.plazaNumero || '').match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((String(b.plazaNumero || '').match(/\d+/) || ['0'])[0], 10);
          if (numA !== numB) return numA - numB;
          return (a.nombreAnimal || '').localeCompare(b.nombreAnimal || '', 'es', { sensitivity: 'base' });
        });

        let nextEquinoPlaza = 1;
        let nextBovinoPlaza = 1;

        const insertAnimalStmt = db.prepare(`
          INSERT INTO animals (
            id, tipo, campana, plaza_numero, propietario, finca,
            identificacion1, identificacion2, nombre_animal, sexo, fecha_nacimiento,
            capa, fecha_ultima_revision, estado_presencia, fecha_entrada_marisma,
            fecha_salida_marisma, es_semental, es_plaza_vacante, animal_anterior_id,
            rastra_json, documentos_json, anotaciones_json, creado_en, actualizado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const an of sortedAnimals) {
          const newId = `anm-${Date.now()}-${Math.round(Math.random() * 100000)}`;
          const prefix = an.tipo === 'BOVINO' ? 'HIN' : 'HI';
          const plazaIndex = an.tipo === 'BOVINO' ? nextBovinoPlaza++ : nextEquinoPlaza++;
          const targetPlaza = `${prefix}${String(plazaIndex).padStart(3, '0')}`;

          const rastraVal =
            an.mantenerRastra && an.rastra
              ? typeof an.rastra === 'string'
                ? an.rastra
                : JSON.stringify(an.rastra)
              : null;
          const docsVal = an.documentos
            ? typeof an.documentos === 'string'
              ? an.documentos
              : JSON.stringify(an.documentos)
            : JSON.stringify([]);

          insertAnimalStmt.run(
            newId,
            an.tipo,
            nombre,
            targetPlaza,
            an.propietario, // Titular asignado para la nueva campaña
            an.finca || 'HINOJOS',
            an.identificacion1,
            an.identificacion2 || '',
            an.tipo === 'BOVINO' ? '' : (an.nombreAnimal || ''),
            an.sexo || 'H',
            an.fechaNacimiento || '',
            an.capa || 'TORDO',
            null, // fecha_ultima_revision reinicia
            an.estadoPresencia || 'DENTRO',
            an.fechaEntradaMarisma || null,
            null,
            an.esSemental ? 1 : 0,
            an.esPlazaVacante ? 1 : 0,
            an.sourceAnimalId || null,
            rastraVal,
            docsVal,
            JSON.stringify([]),
            new Date().toISOString(),
            new Date().toISOString()
          );

          if (an.esSemental) {
            const insertStallion = db.prepare(`
              INSERT OR REPLACE INTO stallions (
                id, campana, tipo, nombre, plaza_numero, microchip, ueln,
                propietario, asociacion, fecha_autorizacion, resolucion, estado
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            insertStallion.run(
              `stl-${Date.now()}-${Math.round(Math.random() * 10000)}`,
              nombre,
              an.tipo,
              an.nombreAnimal || 'SEMENTAL',
              targetPlaza,
              an.identificacion1 || '',
              an.identificacion2 || '',
              an.propietario,
              '',
              new Date().toISOString().slice(0, 10),
              'RENOVACIÓN CAMPAÑA',
              'AUTORIZADO'
            );
          }
        }
      } else if (cloneFromCampaign) {
        // Fallback a clonado automático de todo el censo si no se especificó array
        const sourceAnimals = db.prepare('SELECT * FROM animals WHERE campana = ?').all(cloneFromCampaign) as any[];
        const sortedCloned = [...sourceAnimals].sort((a, b) => {
          if (a.tipo !== b.tipo) return a.tipo === 'EQUINO' ? -1 : 1;
          const propA = (a.propietario || '').trim();
          const propB = (b.propietario || '').trim();
          const compOwner = propA.localeCompare(propB, 'es', { sensitivity: 'base' });
          if (compOwner !== 0) return compOwner;
          const numA = parseInt((String(a.plaza_numero || '').match(/\d+/) || ['0'])[0], 10);
          const numB = parseInt((String(b.plaza_numero || '').match(/\d+/) || ['0'])[0], 10);
          if (numA !== numB) return numA - numB;
          return (a.nombre_animal || '').localeCompare(b.nombre_animal || '', 'es', { sensitivity: 'base' });
        });

        let nextEq = 1;
        let nextBv = 1;

        const insertCloned = db.prepare(`
          INSERT INTO animals (
            id, tipo, campana, plaza_numero, propietario, finca,
            identificacion1, identificacion2, nombre_animal, sexo, fecha_nacimiento,
            capa, fecha_ultima_revision, estado_presencia, fecha_entrada_marisma,
            fecha_salida_marisma, es_semental, es_plaza_vacante, animal_anterior_id,
            rastra_json, documentos_json, anotaciones_json, creado_en, actualizado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const row of sortedCloned) {
          const newId = `anm-${Date.now()}-${Math.round(Math.random() * 1000)}`;
          const prefix = row.tipo === 'BOVINO' ? 'HIN' : 'HI';
          const plazaIndex = row.tipo === 'BOVINO' ? nextBv++ : nextEq++;
          const targetPlaza = `${prefix}${String(plazaIndex).padStart(3, '0')}`;

          insertCloned.run(
            newId,
            row.tipo,
            nombre,
            targetPlaza,
            row.propietario,
            row.finca,
            row.identificacion1,
            row.identificacion2,
            row.tipo === 'BOVINO' ? '' : (row.nombre_animal || ''),
            row.sexo,
            row.fecha_nacimiento,
            row.capa,
            null,
            row.estado_presencia,
            row.fecha_entrada_marisma,
            null,
            row.es_semental,
            row.es_plaza_vacante,
            row.id,
            null, // Crías reinician ciclo
            row.documentos_json,
            JSON.stringify([]),
            new Date().toISOString(),
            new Date().toISOString()
          );
        }
      }

      if (setActiveImmediately !== false) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('active_campaign', nombre);
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    const user = getAuditUser(req);
    recordAudit(db, {
      usuarioId: user.id,
      usuarioNombre: user.nombre,
      usuarioRol: user.rol,
      accion: 'NUEVA_CAMPANA',
      entidad: 'CAMPANA',
      entidadId: nombre,
      detalles: {
        nombre,
        origen: cloneFromCampaign || 'Nueva desde cero',
        totalAnimales: Array.isArray(selectedAnimals) ? selectedAnimals.length : 0,
      },
    });

    res.status(201).json({ success: true, activeCampaign: nombre });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/:nombre', requireAuth, requireAdmin, (req, res) => {
  try {
    const oldName = req.params.nombre;
    const { nuevoNombre } = req.body;
    if (!nuevoNombre || !nuevoNombre.trim()) {
      return res.status(400).json({ error: 'El nuevo nombre de campaña es obligatorio' });
    }
    const cleanNew = nuevoNombre.trim();
    if (cleanNew === oldName) {
      return res.json({ success: true, nombre: cleanNew });
    }

    const exists = db.prepare('SELECT nombre FROM campaigns WHERE nombre = ?').get(cleanNew);
    if (exists) {
      return res.status(400).json({ error: `Ya existe una campaña con el nombre "${cleanNew}"` });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Insertar nuevo nombre de campaña
      const oldCamp = db.prepare('SELECT activa, creado_en FROM campaigns WHERE nombre = ?').get(oldName) as any;
      db.prepare('INSERT INTO campaigns (nombre, activa, creado_en) VALUES (?, ?, ?)').run(
        cleanNew,
        oldCamp?.activa || 0,
        oldCamp?.creado_en || new Date().toISOString()
      );

      // 2. Actualizar animales
      db.prepare('UPDATE animals SET campana = ? WHERE campana = ?').run(cleanNew, oldName);

      // 3. Actualizar sementales
      db.prepare('UPDATE stallions SET campana = ? WHERE campana = ?').run(cleanNew, oldName);

      // 4. Actualizar propietarios/socios
      db.prepare('UPDATE owners SET campana = ? WHERE campana = ?').run(cleanNew, oldName);

      // 5. Actualizar setting si era la activa
      const currentActive = db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as any;
      if (currentActive?.value === oldName) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('active_campaign', cleanNew);
      }

      // 5. Eliminar la campaña antigua
      db.prepare('DELETE FROM campaigns WHERE nombre = ?').run(oldName);

      db.exec('COMMIT;');

      const user = getAuditUser(req);
      recordAudit(db, {
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        usuarioRol: user.rol,
        accion: 'RENOMBRAR_CAMPANA',
        entidad: 'CAMPANA',
        entidadId: cleanNew,
        detalles: { anterior: oldName, nueva: cleanNew },
      });

      res.json({ success: true, oldName, nuevoNombre: cleanNew });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:nombre', requireAuth, requireAdmin, (req, res) => {
  try {
    const campana = req.params.nombre;
    
    // Comprobar cuántas campañas quedan
    const totalCampaigns = db.prepare('SELECT COUNT(*) as count FROM campaigns').get() as { count: number };
    if (totalCampaigns.count <= 1) {
      return res.status(400).json({ error: 'No es posible eliminar la única campaña existente en el sistema' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      // 1. Obtener los IDs de animales de esta campaña para limpiar movimientos
      const animalsInCamp = db.prepare('SELECT id FROM animals WHERE campana = ?').all(campana) as { id: string }[];
      const animalIds = animalsInCamp.map((a) => a.id);

      if (animalIds.length > 0) {
        const placeholders = animalIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM movements WHERE animal_id IN (${placeholders})`).run(...animalIds);
      }

      // 2. Eliminar animales
      db.prepare('DELETE FROM animals WHERE campana = ?').run(campana);

      // 3. Eliminar sementales
      db.prepare('DELETE FROM stallions WHERE campana = ?').run(campana);

      // 4. Eliminar propietarios de la campaña
      db.prepare('DELETE FROM owners WHERE campana = ?').run(campana);

      // 5. Eliminar la campaña
      db.prepare('DELETE FROM campaigns WHERE nombre = ?').run(campana);

      // 6. Obtener las campañas restantes ordenadas (la más reciente primero)
      const remainingRows = db.prepare('SELECT nombre FROM campaigns ORDER BY nombre DESC').all() as { nombre: string }[];
      const nuevaCampana = remainingRows[0]?.nombre || '2025-2026';

      // 7. Si era la campaña activa global o si ya no existe entre las restantes, actualizar settings
      const currentActive = db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as any;
      if (!currentActive?.value || currentActive.value === campana || !remainingRows.some(r => r.nombre === currentActive.value)) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('active_campaign', nuevaCampana);
      }

      // 8. Actualizar a todos los usuarios cuya campaña activa era la eliminada a la nueva campaña activa
      db.prepare('UPDATE users SET campana_activa = ? WHERE campana_activa = ? OR campana_activa NOT IN (SELECT nombre FROM campaigns)').run(nuevaCampana, campana);

      db.exec('COMMIT;');

      const user = getAuditUser(req);
      recordAudit(db, {
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        usuarioRol: user.rol,
        accion: 'ELIMINAR_CAMPANA',
        entidad: 'CAMPANA',
        entidadId: campana,
        detalles: {
          campanaEliminada: campana,
          animalesEliminados: animalIds.length,
          nuevaCampanaActiva: nuevaCampana,
        },
      });

      res.json({ success: true, campanaEliminada: campana, nuevaCampanaActiva: nuevaCampana });
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/active', (req, res) => {
  try {
    const { campana } = req.body;
    try {
      assertCampaignExists(campana);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('active_campaign', campana);
    res.json({ success: true, activeCampaign: campana });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8.5. AUTENTICACIÓN REAL Y SEGURIDAD
// ==========================================
app.post('/api/auth/login', loginRateLimiter(), (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = String(req.ip || req.socket.remoteAddress || 'unknown');

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const row: any = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
    if (!row) {
      recordFailedLogin(clientIp);
      console.warn(`[AUDITORÍA SEGURIDAD] Intento de acceso fallido: usuario desconocido "${username}" desde IP ${clientIp}`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (!row.activo) {
      console.warn(`[AUDITORÍA SEGURIDAD] Intento de acceso a cuenta inactiva "${username}"`);
      return res.status(403).json({ error: 'Usuario inactivo. Contacte al Administrador.' });
    }

    const isValid = Boolean(row.password_hash) && verifyPassword(password, row.password_hash);

    if (!isValid) {
      recordFailedLogin(clientIp);
      console.warn(`[AUDITORÍA SEGURIDAD] Contraseña incorrecta para el usuario "${username}" desde IP ${clientIp}`);
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    // Éxito: limpiar contador de fallos para esta IP
    resetFailedLogin(clientIp);
    console.log(`[AUDITORÍA SEGURIDAD] Sesión iniciada con éxito: "${row.username}" (${row.rol})`);
    const token = generateToken({ id: row.id, username: row.username, rol: row.rol });
    const user = mapUserRow(row);

    recordAudit(db, {
      usuarioId: row.id,
      usuarioNombre: row.nombre_completo || row.username,
      usuarioRol: row.rol,
      accion: 'INICIO_SESION',
      entidad: 'USUARIO',
      entidadId: row.id,
      detalles: { username: row.username, rol: row.rol },
      ip: clientIp,
    });

    res.json({ token, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const user = getAuditUser(req);
    if (user.id) {
      recordAudit(db, {
        usuarioId: user.id,
        usuarioNombre: user.nombre,
        usuarioRol: user.rol,
        accion: 'CIERRE_SESION',
        entidad: 'USUARIO',
        entidadId: user.id,
        detalles: { motivo: 'Cierre de sesión manual' },
        ip: String(req.ip || req.socket.remoteAddress || ''),
      });
      console.log(`[AUDITORÍA SEGURIDAD] Sesión cerrada: "${user.nombre}" (${user.rol})`);
    }
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/switch-user', requireAuth, requireAdmin, (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'ID de usuario requerido' });
    }
    const row: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (!row.activo) {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    const token = generateToken({ id: row.id, username: row.username, rol: row.rol });
    const user = mapUserRow(row);

    const adminUser = getAuditUser(req);
    recordAudit(db, {
      usuarioId: adminUser.id,
      usuarioNombre: adminUser.nombre,
      usuarioRol: adminUser.rol,
      accion: 'INICIO_SESION',
      entidad: 'USUARIO',
      entidadId: row.id,
      detalles: { motivo: `Cambio de cuenta administrativo a "${row.username}"` },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });

    res.json({ token, user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!row) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const user = mapUserRow(row);
    // Verificar si la campanaActiva del usuario sigue existiendo en campaigns
    const currentCamp = user.campanaActiva || '';
    const campExists = currentCamp ? db.prepare('SELECT 1 FROM campaigns WHERE nombre = ?').get(currentCamp) : null;
    if (!campExists) {
      const activeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as any;
      const validCamp: string = activeSetting?.value || (db.prepare('SELECT nombre FROM campaigns ORDER BY nombre DESC LIMIT 1').get() as any)?.nombre || '2025-2026';
      db.prepare('UPDATE users SET campana_activa = ? WHERE id = ?').run(validCamp, user.id);
      user.campanaActiva = validCamp;
    }

    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/me/active-campaign', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { campana } = req.body;
    if (!campana) {
      return res.status(400).json({ error: 'Campaña requerida' });
    }
    if (!db.prepare('SELECT 1 FROM campaigns WHERE nombre = ?').get(campana)) {
      return res.status(400).json({ error: 'La campaña seleccionada no existe' });
    }

    db.prepare('UPDATE users SET campana_activa = ? WHERE id = ?').run(campana, payload.id);
    const updatedRow = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);

    res.json({ success: true, campanaActiva: campana, user: updatedRow ? mapUserRow(updatedRow) : null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/change-password', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }

    const { oldPassword, newPassword } = req.body;
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 12) {
      return res.status(400).json({ error: 'La contraseña actual y una nueva contraseña de al menos 12 caracteres son obligatorias' });
    }

    const row: any = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (row.password_hash && !verifyPassword(oldPassword, row.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, row.id);

    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 9. USUARIOS Y ROLES (RBAC) - RUTAS ADMINISTRATIVAS PROTEGIDAS
// ==========================================
app.get('/api/users', requireAuth, (_req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM users ORDER BY nombre_completo ASC').all();
    res.json(rows.map(mapUserRow));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  try {
    const u: User & { password?: string } = req.body;
    const id = u.id || `usr-${Date.now()}`;
    const cleanUsername = (u.username || '').trim().toLowerCase();

    if (!cleanUsername || !u.nombreCompleto || !USER_ROLES.has(u.rol)) {
      return res.status(400).json({ error: 'Nombre de usuario y nombre completo son obligatorios' });
    }
    const currentUserRecord = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!currentUserRecord && (!u.password || !u.password.trim())) {
      return res.status(400).json({ error: 'Debe indicar una contraseña de al menos 12 caracteres al crear un usuario' });
    }

    // Comprobar que no exista otro usuario con el mismo username
    const existing = db.prepare('SELECT id, username FROM users WHERE LOWER(username) = ? AND id != ?').get(cleanUsername, id);
    if (existing) {
      return res.status(400).json({ error: `El nombre de usuario "${cleanUsername}" ya está registrado en el sistema. Debe ser único.` });
    }
    
    // Si viene contraseña, hashearla
    const activoVal = u.activo === false ? 0 : 1;
    const params: any[] = [
      id,
      cleanUsername,
      u.nombreCompleto.trim(),
      u.rol,
      u.cargo || '',
      u.email || '',
      u.avatarInitials || '',
      activoVal,
    ];

    if (u.password && u.password.trim()) {
      if (u.password.trim().length < 12) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 12 caracteres' });
      }
      const hash = hashPassword(u.password.trim());
      db.prepare(`
        INSERT INTO users (id, username, nombre_completo, rol, cargo, email, avatar_initials, activo, password_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          nombre_completo = excluded.nombre_completo,
          rol = excluded.rol,
          cargo = excluded.cargo,
          email = excluded.email,
          avatar_initials = excluded.avatar_initials,
          activo = excluded.activo,
          password_hash = excluded.password_hash
      `).run(...params, hash);
    } else {
      db.prepare(`
        INSERT INTO users (id, username, nombre_completo, rol, cargo, email, avatar_initials, activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          username = excluded.username,
          nombre_completo = excluded.nombre_completo,
          rol = excluded.rol,
          cargo = excluded.cargo,
          email = excluded.email,
          avatar_initials = excluded.avatar_initials,
          activo = excluded.activo
      `).run(...params);
    }

    const savedUser = mapUserRow(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
    const auditUser = getAuditUser(req);
    recordAudit(db, {
      usuarioId: auditUser.id,
      usuarioNombre: auditUser.nombre,
      usuarioRol: auditUser.rol,
      accion: 'CREAR_EDITAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: id,
      detalles: { username: cleanUsername, nombreCompleto: u.nombreCompleto, rol: u.rol, activo: activoVal === 1 },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });

    res.json(savedUser);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (totalUsers.count <= 1) {
      return res.status(400).json({ error: 'No es posible eliminar el único usuario del sistema' });
    }
    const targetUser = db.prepare('SELECT username, nombre_completo FROM users WHERE id = ?').get(req.params.id) as any;
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

    const auditUser = getAuditUser(req);
    recordAudit(db, {
      usuarioId: auditUser.id,
      usuarioNombre: auditUser.nombre,
      usuarioRol: auditUser.rol,
      accion: 'ELIMINAR_USUARIO',
      entidad: 'USUARIO',
      entidadId: req.params.id,
      detalles: { idEliminado: req.params.id, username: targetUser?.username, nombre: targetUser?.nombre_completo },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });

    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10. BACKUP Y RESTAURACIÓN INTEGRAL (JSON) - PROTEGIDO CON ADMIN
// ==========================================
app.get('/api/backup', requireAuth, requireAdmin, (_req, res) => {
  try {
    const backup = {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      animals: db.prepare('SELECT * FROM animals').all().map(mapAnimalRow),
      owners: db.prepare('SELECT * FROM owners').all().map(mapOwnerRow),
      associations: db.prepare('SELECT * FROM associations').all(),
      stallions: db.prepare('SELECT * FROM stallions').all().map(mapStallionRow),
      movements: db.prepare('SELECT * FROM movements').all().map(mapMovementRow),
      campaigns: db.prepare('SELECT * FROM campaigns').all(),
      users: db.prepare('SELECT * FROM users').all().map(mapUserRow),
      settings: db.prepare('SELECT * FROM settings').all(),
    };
    res.json(backup);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/restore', requireAuth, requireAdmin, (req, res) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.animals)) {
      return res.status(400).json({ error: 'Formato de respaldo JSON no válido' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      if (Array.isArray(data.animals)) {
        db.prepare('DELETE FROM animals').run();
        const insertAnimal = db.prepare(`
          INSERT INTO animals (
            id, tipo, campana, plaza_numero, propietario, finca,
            identificacion1, identificacion2, nombre_animal, sexo, fecha_nacimiento,
            capa, fecha_ultima_revision, estado_presencia, fecha_entrada_marisma,
            fecha_salida_marisma, es_semental, es_plaza_vacante, animal_anterior_id,
            rastra_json, documentos_json, anotaciones_json, creado_en, actualizado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const a of data.animals) {
          insertAnimal.run(
            a.id,
            a.tipo,
            a.campana,
            a.plazaNumero,
            a.propietario,
            a.finca || 'HINOJOS',
            a.identificacion1 || '',
            a.identificacion2 || '',
            a.nombreAnimal || (a.esPlazaVacante ? 'PLAZA VACANTE' : 'SIN NOMBRE'),
            a.sexo,
            a.fechaNacimiento || '',
            a.capa,
            a.fechaUltimaRevision || null,
            a.estadoPresencia,
            a.fechaEntradaMarisma || null,
            a.fechaSalidaMarisma || null,
            a.esSemental ? 1 : 0,
            a.esPlazaVacante ? 1 : 0,
            a.animalAnteriorId || null,
            a.rastra ? JSON.stringify(a.rastra) : null,
            JSON.stringify(a.documentos || []),
            JSON.stringify(a.anotaciones || []),
            a.creadoEn || new Date().toISOString(),
            a.actualizadoEn || new Date().toISOString()
          );
        }
      }

      if (Array.isArray(data.owners)) {
        db.prepare('DELETE FROM owners').run();
        const insertOwner = db.prepare(`
          INSERT INTO owners (id, nombre_completo, dni_cif, telefono, email, direccion, municipio, codigo_rega, asociacion, notas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const o of data.owners) {
          insertOwner.run(
            o.id,
            o.nombreCompleto,
            o.dniCif,
            o.telefono || '',
            o.email || '',
            o.direccion || '',
            o.municipio || 'Hinojos',
            o.codigoRega || '',
            o.asociacion || '',
            o.notas || ''
          );
        }
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      db.exec('ROLLBACK;');
      throw txErr;
    }

    res.json({ success: true, message: 'Base de datos restaurada correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10.1. REGISTRO OFICIAL DE AUDITORÍA MUNICIPAL
// ==========================================
app.get('/api/audit-logs', requireAuth, (req, res) => {
  try {
    const { search, accion, entidad, limit = '200', offset = '0' } = req.query;
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (accion && typeof accion === 'string' && accion !== 'TODAS') {
      query += ' AND accion = ?';
      params.push(accion);
    }

    if (entidad && typeof entidad === 'string' && entidad !== 'TODAS') {
      query += ' AND entidad = ?';
      params.push(entidad);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(usuario_nombre) LIKE ? OR LOWER(detalles_json) LIKE ? OR LOWER(entidad_id) LIKE ? OR LOWER(accion) LIKE ?)';
      params.push(term, term, term, term);
    }

    // Contar total con los filtros aplicados
    const countSql = query.replace('SELECT * FROM audit_logs', 'SELECT COUNT(*) as total FROM audit_logs');
    const totalRow = db.prepare(countSql).get(...params) as { total: number };
    const total = totalRow ? totalRow.total : 0;

    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 200, 1), 1000);
    const offsetNum = Math.max(parseInt(offset as string, 10) || 0, 0);

    query += ' ORDER BY fecha DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offsetNum);

    const rows = db.prepare(query).all(...params);
    const logs = rows.map(mapAuditLogRow);

    res.json({ logs, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10.2. COPIA DE SEGURIDAD MUNICIPAL (DESCARGA Y RESTAURACIÓN ZIP)
// ==========================================
app.get('/api/admin/backup/stats', requireAuth, requireAdmin, (_req, res) => {
  try {
    checkpointDb();

    let databaseSize = 0;
    let databaseLastModified = '';
    if (fs.existsSync(DB_PATH)) {
      const stats = fs.statSync(DB_PATH);
      databaseSize = stats.size;
      databaseLastModified = stats.mtime.toISOString();
    }

    let documentsCount = 0;
    let documentsTotalSize = 0;
    if (fs.existsSync(DOCUMENTS_DIR)) {
      const files = fs.readdirSync(DOCUMENTS_DIR);
      documentsCount = files.length;
      for (const f of files) {
        try {
          const s = fs.statSync(path.join(DOCUMENTS_DIR, f));
          if (s.isFile()) documentsTotalSize += s.size;
        } catch {}
      }
    }

    const animalsCount = (db.prepare('SELECT COUNT(*) as c FROM animals').get() as any)?.c || 0;
    const movementsCount = (db.prepare('SELECT COUNT(*) as c FROM movements').get() as any)?.c || 0;
    const ownersCount = (db.prepare('SELECT COUNT(*) as c FROM owners').get() as any)?.c || 0;
    const auditLogsCount = (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any)?.c || 0;
    const campaignsCount = (db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as any)?.c || 0;

    res.json({
      databaseSize,
      databaseLastModified,
      documentsCount,
      documentsTotalSize,
      animalsCount,
      movementsCount,
      ownersCount,
      auditLogsCount,
      campaignsCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const generateBackupZip = async (req: express.Request, res: express.Response) => {
  try {
    // 1. Forzar volcado completo de WAL a archivo SQLite marisma.db
    checkpointDb();

    if (!fs.existsSync(DB_PATH)) {
      return res.status(500).json({ error: 'Archivo de base de datos no encontrado' });
    }

    const zip = new JSZip();

    // 2. Añadir base de datos SQLite marisma.db
    const dbBuffer = fs.readFileSync(DB_PATH);
    zip.file('marisma.db', dbBuffer);

    // 3. Documentos adjuntos (PDFs, certificados sanitarios, etc.)
    let docsAdded = 0;
    if (fs.existsSync(DOCUMENTS_DIR)) {
      const files = fs.readdirSync(DOCUMENTS_DIR);
      const docsFolder = zip.folder('documents');
      if (docsFolder) {
        for (const file of files) {
          const filePath = path.join(DOCUMENTS_DIR, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              const fileData = fs.readFileSync(filePath);
              docsFolder.file(file, fileData);
              docsAdded++;
            }
          } catch (e) {
            console.warn(`No se pudo incluir documento ${file} en backup:`, e);
          }
        }
      }
    }

    // 4. Manifiesto oficial de integridad
    const statsRow = {
      animales: (db.prepare('SELECT COUNT(*) as c FROM animals').get() as any)?.c || 0,
      movimientos: (db.prepare('SELECT COUNT(*) as c FROM movements').get() as any)?.c || 0,
      ganaderos: (db.prepare('SELECT COUNT(*) as c FROM owners').get() as any)?.c || 0,
      campanas: (db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as any)?.c || 0,
      usuarios: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0,
      registrosAuditoria: (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any)?.c || 0,
    };

    const manifest = {
      institucion: 'Ayuntamiento de Hinojos',
      sistema: 'Gestión Ganadera Marisma de Hinojos',
      version: '2.0.0',
      fechaExportacion: new Date().toISOString(),
      baseDatos: 'marisma.db (SQLite 3 WAL)',
      totalDocumentos: docsAdded,
      estadisticas: statsRow,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // 5. Comprimir a formato .ZIP
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // 6. Registrar en auditoría municipal
    const auditUser = getAuditUser(req);
    recordAudit(db, {
      usuarioId: auditUser.id,
      usuarioNombre: auditUser.nombre,
      usuarioRol: auditUser.rol,
      accion: 'DESCARGA_COPIA_SEGURIDAD',
      entidad: 'SISTEMA',
      detalles: {
        tamanoBytes: zipBuffer.length,
        documentosIncluidos: docsAdded,
        estadisticas: statsRow,
      },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });

    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `Copia_Seguridad_Marisma_Hinojos_${nowStr}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('Error generando copia de seguridad zip:', error);
    res.status(500).json({ error: error.message || 'Error al generar copia de seguridad' });
  }
};

app.get('/api/admin/backup/export', requireAuth, requireAdmin, generateBackupZip);
app.get('/api/admin/backup/download', requireAuth, requireAdmin, generateBackupZip);

app.post('/api/admin/backup/restore-zip', requireAuth, requireAdmin, uploadZip.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo ZIP de copia de seguridad' });
    }

    const zip = await JSZip.loadAsync(req.file.buffer);
    const dbFile = zip.file('marisma.db');
    if (!dbFile) {
      return res.status(400).json({ error: 'El archivo ZIP no contiene una base de datos válida (marisma.db)' });
    }

    // 1. Extraer el buffer de la base de datos
    const dbBuffer = await dbFile.async('nodebuffer');
    validateDatabaseBuffer(dbBuffer);

    // 2. Volcar con seguridad usando la función atómica que guarda backup previo de emergencia
    const { emergencyBackupPath } = reloadDbFromFile(dbBuffer);
    // Reaplicar esquema y protecciones de la versión instalada, incluso si la
    // copia procede de una versión anterior de la aplicación.
    initDatabase();

    // 3. Extraer documentos de la carpeta documents/ si vienen incluidos
    let restoredDocs = 0;
    const documentsFolder = zip.folder('documents');
    if (documentsFolder) {
      if (!fs.existsSync(DOCUMENTS_DIR)) {
        fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
      }
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (relativePath.startsWith('documents/') && !zipEntry.dir) {
          const docName = path.basename(relativePath);
          if (docName) {
            const docBuffer = await zipEntry.async('nodebuffer');
            fs.writeFileSync(path.join(DOCUMENTS_DIR, docName), docBuffer);
            restoredDocs++;
          }
        }
      }
    }

    // 4. Registrar en auditoría
    const auditUser = getAuditUser(req);
    recordAudit(db, {
      usuarioId: auditUser.id,
      usuarioNombre: auditUser.nombre,
      usuarioRol: auditUser.rol,
      accion: 'RESTAURAR_COPIA_SEGURIDAD',
      entidad: 'SISTEMA',
      detalles: {
        tamanoBytesSubido: req.file.buffer.length,
        documentosRestaurados: restoredDocs,
        copiaEmergenciaPrevia: emergencyBackupPath || null,
      },
      ip: String(req.ip || req.socket.remoteAddress || ''),
    });

    res.json({
      success: true,
      message: 'Copia de seguridad restaurada correctamente con éxito',
      documentosRestaurados: restoredDocs,
      copiaEmergenciaPrevia: emergencyBackupPath || null,
    });
  } catch (error: any) {
    console.error('Error restaurando copia de seguridad zip:', error);
    res.status(500).json({ error: error.message || 'Error al restaurar copia de seguridad' });
  }
});

// ==========================================
// 11. EXPORTACIÓN ODS OFICIAL PARA EQUINOS (4 HOJAS)
// ==========================================
app.get('/api/export/equinos-ods', async (req, res) => {
  try {
    const campaign =
      (req.query.campana as string) ||
      (db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as any)?.value ||
      '2026-2027';

    const animals = db.prepare('SELECT * FROM animals').all().map(mapAnimalRow);
    const stallions = db.prepare('SELECT * FROM stallions').all().map(mapStallionRow);
    const movements = db.prepare('SELECT * FROM movements').all().map(mapMovementRow);
    const owners = db.prepare('SELECT * FROM owners').all().map(mapOwnerRow);

    const buffer = await OdsExportService.generateEquinosWorkbook({
      campaign,
      animals,
      stallions,
      movements,
      owners,
    });

    res.setHeader('Content-Type', 'application/vnd.oasis.openoffice.spreadsheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CONTROL EQUINO ${campaign}.ods"`
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error al generar ODS de equinos:', error);
    res.status(500).json({ error: error.message || 'Error al generar archivo ODS' });
  }
});

// ==========================================
// 12. EXPORTACIÓN ODS OFICIAL PARA BOVINOS (1 HOJA - PLANTILLA EXACTA)
// ==========================================
app.get('/api/export/bovinos-ods', async (req, res) => {
  try {
    const campaign =
      (req.query.campana as string) ||
      (db.prepare('SELECT value FROM settings WHERE key = ?').get('active_campaign') as any)?.value ||
      '2026-2027';

    const animals = db.prepare('SELECT * FROM animals').all().map(mapAnimalRow);
    const owners = db.prepare('SELECT * FROM owners').all().map(mapOwnerRow);

    const buffer = await OdsExportService.generateBovinosWorkbook({
      campaign,
      animals,
      owners,
    });

    res.setHeader('Content-Type', 'application/vnd.oasis.openoffice.spreadsheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="CONTROL BOVINO ${campaign}.ods"`
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error al generar ODS de bovinos:', error);
    res.status(500).json({ error: error.message || 'Error al generar archivo ODS de bovinos' });
  }
});

// En producción: Servir la SPA compilada en dist
const distPath = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor Backend Marisma de Hinojos activo en http://localhost:${PORT}`);
  console.log(`📁 Directorio de Documentos (PDF/Imágenes): ${DOCUMENTS_DIR}`);
  console.log(`🗄️  Base de Datos SQLite: data/marisma.db`);
});
