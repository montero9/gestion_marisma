import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import path from 'node:path';
import { OdsExportService } from './services/odsExportService.js';
import { generateEntradaOds } from './services/odsEntradasService.js';
import { sendEntradaEmail, testSmtpConnection, getSmtpConfig, encryptPassword } from './services/emailService.js';
import { dataAdapter } from './dataAdapter.js';
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
  EntradaRemesa,
  EntradaPersona,
  EntradaAnimal,
  SmtpConfig,
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

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// 1. Hardening y Cabeceras de Seguridad
app.disable('x-powered-by');

app.use((req, res, next) => {
  // En Vercel / Cloudflare el proxy maneja HTTPS en el Edge. Evitar llamar a req.secure directamente.
  const proto = req.headers['x-forwarded-proto'];
  const host = req.headers.host;
  if (process.env.NODE_ENV === 'production' && proto === 'http' && host) {
    return res.redirect(301, `https://${host}${req.url}`);
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  const scriptSrc = process.env.NODE_ENV === 'production'
    ? "script-src 'self'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.supabase.co ws: wss:;`
  );

  next();
});

// 2. CORS y Parseo de Cargas
const configuredOrigins = new Set(
  (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const isLocalDevelopment = process.env.NODE_ENV !== 'production' &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const isVercelDomain = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);

    if (isLocalDevelopment || configuredOrigins.has(origin) || isVercelDomain) {
      return callback(null, true);
    }
    return callback(new Error('Acceso no permitido por política de CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Rate Limiter resistente para entornos locales y Serverless
interface RateLimitBucket {
  failedAttempts: number;
  blockedUntil: number;
}
const loginRateLimitStore = new Map<string, RateLimitBucket>();

function recordFailedLogin(ip: string, maxFailedAttempts = 5, blockDurationMs = 2 * 60 * 1000) {
  const now = Date.now();
  const record = loginRateLimitStore.get(ip) || { failedAttempts: 0, blockedUntil: 0 };
  record.failedAttempts++;
  if (record.failedAttempts >= maxFailedAttempts) {
    record.blockedUntil = now + blockDurationMs;
    console.warn(`[SEGURIDAD] IP ${ip} bloqueada por ${blockDurationMs / 1000}s tras ${record.failedAttempts} fallos.`);
  }
  loginRateLimitStore.set(ip, record);
}

function resetFailedLogin(ip: string) {
  loginRateLimitStore.delete(ip);
}

async function isIpBlocked(ip: string): Promise<boolean> {
  const record = loginRateLimitStore.get(ip);
  if (record && record.blockedUntil > Date.now()) return true;

  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const recentLogs = await dataAdapter.getAuditLogs(50);
    const failedCount = (recentLogs || []).filter(
      (l) => l.accion === 'LOGIN_FALLIDO' && l.ip === ip && l.fecha >= twoMinutesAgo
    ).length;

    if (failedCount >= 5) {
      return true;
    }
  } catch {}

  return false;
}

// 4. Middlewares de Autenticación y Autorización
app.use('/api', async (req: AuthenticatedRequest, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login') return next();
  requireAuth(req, res, async () => {
    try {
      const user = await dataAdapter.getUserById(req.user!.id);
      if (!user || !user.activo) return res.status(401).json({ error: 'La cuenta no está activa' });
      req.user = { id: user.id, username: user.username, rol: user.rol };

      const readOnlyMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      const ownAccountWrite =
        (req.method === 'POST' && req.path === '/auth/logout') ||
        (req.method === 'PUT' && req.path === '/users/me/active-campaign') ||
        (req.method === 'POST' && req.path === '/auth/change-password');

      if (!readOnlyMethod && !ownAccountWrite && req.user.rol !== 'ADMINISTRADOR') {
        return res.status(403).json({ error: 'Permisos insuficientes: esta operación requiere rol Administrador' });
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: 'Error validando sesión: ' + err.message });
    }
  });
});

// Helper de auditoría
async function auditLog(req: AuthenticatedRequest, accion: string, entidad: string, entidadId: string, detalles: any) {
  await dataAdapter.recordAudit({
    usuarioId: req.user?.id,
    usuarioNombre: req.user?.username || 'Sistema',
    usuarioRol: req.user?.rol || 'ADMINISTRADOR',
    accion,
    entidad,
    entidadId,
    detalles,
    ip: String(req.ip || req.socket.remoteAddress || ''),
  });
}

// Configuración de Multer para subida de documentos a memoria
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Sólo se permiten PDF, JPG y PNG'));
    cb(null, true);
  },
});

// Configuración de Multer para restauración de copias de seguridad (.ZIP)
const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      return cb(new Error('Sólo se permiten archivos de copia de seguridad en formato .ZIP'));
    }
    cb(null, true);
  },
});

function hasValidSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'application/pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }
  return false;
}

// ==========================================
// 1. HEALTHCHECK
// ==========================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'Sistema Ganadero Marisma de Hinojos API',
    database: 'Supabase PostgreSQL + Storage',
  });
});

// ==========================================
// 2. BOOTSTRAP INICIAL
// ==========================================
app.get('/api/bootstrap', async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.user?.rol === 'ADMINISTRADOR';
    const data = await dataAdapter.getBootstrap(isAdmin);
    res.json(data);
  } catch (error: any) {
    console.error('Error en /api/bootstrap:', error);
    res.status(500).json({ error: error.message || 'Error al obtener datos iniciales' });
  }
});

// ==========================================
// 3. ANIMALES Y PLAZAS
// ==========================================
app.get('/api/animals', async (req, res) => {
  try {
    const { campana, tipo } = req.query as { campana?: string; tipo?: string };
    const animals = await dataAdapter.getAnimals(campana, tipo);
    res.json(animals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/animals/:id', async (req, res) => {
  try {
    const animal = await dataAdapter.getAnimalById(req.params.id);
    if (!animal) return res.status(404).json({ error: 'Animal no encontrado' });
    res.json(animal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/animals', async (req: AuthenticatedRequest, res) => {
  try {
    const a: Animal = req.body;
    if (a.tipo === 'BOVINO') a.nombreAnimal = '';
    const saved = await dataAdapter.saveAnimal(a);
    await auditLog(req, 'ALTA', 'ANIMAL', saved.plazaNumero || saved.id, {
      tipo: saved.tipo,
      plaza: saved.plazaNumero,
      nombre: saved.nombreAnimal,
      titular: saved.propietario,
      crotal: saved.identificacion1,
      campana: saved.campana,
    });
    res.status(201).json(saved);
  } catch (error: any) {
    console.error('Error en POST /api/animals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/animals/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const a: Animal = req.body;
    a.id = req.params.id;
    if (a.tipo === 'BOVINO') a.nombreAnimal = '';
    const saved = await dataAdapter.saveAnimal(a);
    await auditLog(req, 'MODIFICACION', 'ANIMAL', saved.plazaNumero || saved.id, {
      tipo: saved.tipo,
      plaza: saved.plazaNumero,
      nombre: saved.nombreAnimal,
      titular: saved.propietario,
      campana: saved.campana,
    });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/animals/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const animal = await dataAdapter.getAnimalById(req.params.id);
    await dataAdapter.deleteAnimal(req.params.id);
    if (animal) {
      const docCount = (animal.documentos || []).length;
      await auditLog(req, 'BAJA', 'ANIMAL', animal.plazaNumero || animal.id, {
        tipo: animal.tipo,
        plaza: animal.plazaNumero,
        nombre: animal.nombreAnimal,
        titular: animal.propietario,
        archivosEliminados: docCount,
      });
    }
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/animals/swap', async (req: AuthenticatedRequest, res) => {
  try {
    const { animalAId, animalBId, motivo, autor } = req.body;
    if (!animalAId || !animalBId) {
      return res.status(400).json({ error: 'Se requieren animalAId y animalBId' });
    }

    const animalA = await dataAdapter.getAnimalById(animalAId);
    const animalB = await dataAdapter.getAnimalById(animalBId);

    if (!animalA || !animalB) {
      return res.status(404).json({ error: 'Uno o ambos animales no existen' });
    }

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

    animalA.anotaciones = [
      ...(animalA.anotaciones || []),
      {
        id: `ant-${Date.now()}-1`,
        fecha: dateStr,
        autor: autor || req.user?.username || 'Administrador',
        categoria: 'DOCUMENTAL',
        texto: annotationTextA,
      },
    ];
    animalA.plazaNumero = plazaB;
    animalA.propietario = propB;

    animalB.anotaciones = [
      ...(animalB.anotaciones || []),
      {
        id: `ant-${Date.now()}-2`,
        fecha: dateStr,
        autor: autor || req.user?.username || 'Administrador',
        categoria: 'DOCUMENTAL',
        texto: annotationTextB,
      },
    ];
    animalB.plazaNumero = plazaA;
    animalB.propietario = propA;

    await dataAdapter.saveAnimal(animalA);
    await dataAdapter.saveAnimal(animalB);

    await auditLog(req, 'PERMUTA', 'ANIMAL', `${plazaA} <-> ${plazaB}`, {
      animalA: { id: animalA.id, nombre: animalA.nombreAnimal, plazaAnterior: plazaA, plazaNueva: plazaB },
      animalB: { id: animalB.id, nombre: animalB.nombreAnimal, plazaAnterior: plazaB, plazaNueva: plazaA },
      motivo: motivo || 'Permuta municipal',
    });

    res.json({ success: true, animalA, animalB });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Documentos y anotaciones de animales
app.post('/api/animals/:id/documents', uploadMemory.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const animalId = req.params.id;
    const file = req.file;
    const { tipo, nombre } = req.body;

    if (!file) return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    if (!hasValidSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({ error: 'El contenido del archivo no coincide con un PDF, JPG o PNG válido' });
    }

    const animal = await dataAdapter.getAnimalById(animalId);
    if (!animal) return res.status(404).json({ error: 'Animal no encontrado' });

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFilename = `${animalId}_${Date.now()}_${cleanName}`;

    await dataAdapter.uploadDocument(storageFilename, file.buffer, file.mimetype);

    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const newDoc: AnimalDocument = {
      id: `doc-${Date.now()}`,
      nombre: nombre || file.originalname,
      tipo: tipo || 'OTRO',
      fechaSubida: new Date().toISOString().slice(0, 10),
      tamano: sizeStr,
      url: `/uploads/documents/${storageFilename}`,
    };

    animal.documentos = [...(animal.documentos || []), newDoc];
    const saved = await dataAdapter.saveAnimal(animal);

    await auditLog(req, 'ALTA', 'DOCUMENTO', newDoc.id, {
      animalId,
      plaza: animal.plazaNumero,
      documento: newDoc.nombre,
      tipo: newDoc.tipo,
    });

    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/animals/:id/documents/:docId', async (req: AuthenticatedRequest, res) => {
  try {
    const { id: animalId, docId } = req.params;
    const animal = await dataAdapter.getAnimalById(animalId);
    if (!animal) return res.status(404).json({ error: 'Animal no encontrado' });

    const doc = (animal.documentos || []).find((d) => d.id === docId);
    if (doc?.url) {
      const filename = doc.url.replace('/uploads/documents/', '');
      await dataAdapter.deleteDocument(filename);
    }

    animal.documentos = (animal.documentos || []).filter((d) => d.id !== docId);
    const saved = await dataAdapter.saveAnimal(animal);

    await auditLog(req, 'BAJA', 'DOCUMENTO', docId, { animalId, documento: doc?.nombre });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/animals/:id/annotations', async (req: AuthenticatedRequest, res) => {
  try {
    const animalId = req.params.id;
    const { autor, categoria, texto } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: 'El texto es obligatorio' });

    const animal = await dataAdapter.getAnimalById(animalId);
    if (!animal) return res.status(404).json({ error: 'Animal no encontrado' });

    const newAnnotation: Annotation = {
      id: `ant-${Date.now()}`,
      fecha: new Date().toISOString().slice(0, 10),
      autor: autor || req.user?.username || 'Administrador',
      categoria: categoria || 'OTROS',
      texto: texto.trim(),
    };

    animal.anotaciones = [...(animal.anotaciones || []), newAnnotation];
    const saved = await dataAdapter.saveAnimal(animal);

    await auditLog(req, 'ALTA', 'ANOTACION', newAnnotation.id, { animalId, categoria });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Servicio seguro y autenticado de documentos desde Supabase Storage
const handleDocumentDownload = async (req: AuthenticatedRequest, res: any) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const { data, error } = await dataAdapter.downloadDocument(safeFilename);
    if (error || !data) return res.status(404).send('Documento no encontrado');

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (safeFilename.endsWith('.pdf')) res.setHeader('Content-Type', 'application/pdf');
    else if (safeFilename.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    else if (safeFilename.endsWith('.jpg') || safeFilename.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');

    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error recuperando documento');
  }
};

app.get('/uploads/documents/:filename', requireAuth, handleDocumentDownload);
app.get('/api/uploads/documents/:filename', requireAuth, handleDocumentDownload);

// ==========================================
// 4. GANADEROS (OWNERS) Y ASOCIACIONES
// ==========================================
app.get('/api/owners', async (req, res) => {
  try {
    const { campana } = req.query as { campana?: string };
    const owners = await dataAdapter.getOwners(campana);
    res.json(owners);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/owners', async (req: AuthenticatedRequest, res) => {
  try {
    const o: Owner = req.body;
    o.id = o.id || `own-${Date.now()}`;
    const saved = await dataAdapter.saveOwner(o);
    await auditLog(req, 'ALTA', 'GANADERO', saved.id, { nombre: saved.nombreCompleto, dni: saved.dniCif });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/owners/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const o: Owner = req.body;
    o.id = req.params.id;
    const saved = await dataAdapter.saveOwner(o);
    await auditLog(req, 'MODIFICACION', 'GANADERO', saved.id, { nombre: saved.nombreCompleto });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/owners/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await dataAdapter.deleteOwner(req.params.id);
    await auditLog(req, 'BAJA', 'GANADERO', req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/associations', async (_req, res) => {
  try {
    const associations = await dataAdapter.getAssociations();
    res.json(associations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/associations', async (req: AuthenticatedRequest, res) => {
  try {
    const a: Association = req.body;
    a.id = a.id || `asc-${Date.now()}`;
    const saved = await dataAdapter.saveAssociation(a);
    await auditLog(req, 'ALTA', 'ASOCIACION', saved.id, { nombre: saved.nombre, cif: saved.cif });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/associations/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const a: Association = req.body;
    a.id = req.params.id;
    const saved = await dataAdapter.saveAssociation(a);
    await auditLog(req, 'MODIFICACION', 'ASOCIACION', saved.id, { nombre: saved.nombre });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/associations/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await dataAdapter.deleteAssociation(req.params.id);
    await auditLog(req, 'BAJA', 'ASOCIACION', req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. SEMENTALES
// ==========================================
app.get('/api/stallions', async (req, res) => {
  try {
    const { campana } = req.query as { campana?: string };
    const stallions = await dataAdapter.getStallions(campana);
    res.json(stallions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stallions', async (req: AuthenticatedRequest, res) => {
  try {
    const s: Stallion = req.body;
    s.id = s.id || `stl-${Date.now()}`;
    const saved = await dataAdapter.saveStallion(s);
    await auditLog(req, 'ALTA', 'SEMENTAL', saved.id, { nombre: saved.nombre, propietario: saved.propietario });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stallions/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const s: Stallion = req.body;
    s.id = req.params.id;
    const saved = await dataAdapter.saveStallion(s);
    await auditLog(req, 'MODIFICACION', 'SEMENTAL', saved.id, { nombre: saved.nombre });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/stallions/:id', async (req: AuthenticatedRequest, res) => {
  try {
    await dataAdapter.deleteStallion(req.params.id);
    await auditLog(req, 'BAJA', 'SEMENTAL', req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. MOVIMIENTOS
// ==========================================
app.get('/api/movements', async (req, res) => {
  try {
    const { campana } = req.query as { campana?: string };
    const movements = await dataAdapter.getMovements(campana);
    res.json(movements);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/movements', async (req: AuthenticatedRequest, res) => {
  try {
    const m: Movement = req.body;
    m.id = m.id || `mov-${Date.now()}`;
    if (m.tipoAnimal === 'BOVINO') m.nombreAnimal = '';

    const animal = await dataAdapter.getAnimalById(m.animalId);
    if (!animal) return res.status(404).json({ error: 'El animal indicado no existe' });

    m.campana = animal.campana;
    m.identificacion1 = animal.identificacion1;

    const savedMovement = await dataAdapter.saveMovement(m);

    // Actualizar presencia del animal según movimiento
    if (m.tipoMovimiento === 'SALIDA') {
      animal.estadoPresencia = 'FUERA';
      animal.fechaSalidaMarisma = m.fecha;
      if (m.liberarPlaza) {
        animal.esPlazaVacante = true;
      }
    } else if (m.tipoMovimiento === 'ENTRADA') {
      animal.estadoPresencia = 'DENTRO';
      animal.fechaEntradaMarisma = m.fecha;
      animal.fechaSalidaMarisma = undefined;
      animal.esPlazaVacante = false;
    }
    await dataAdapter.saveAnimal(animal);

    await auditLog(req, 'MOVIMIENTO', 'MOVIMIENTO', savedMovement.id, {
      tipo: m.tipoMovimiento,
      animalId: m.animalId,
      plaza: m.plazaNumero,
      titular: m.propietario,
      motivo: m.motivo,
      guia: m.numeroGuia,
    });

    res.status(201).json(savedMovement);
  } catch (error: any) {
    console.error('Error en POST /api/movements:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. CAMPAÑAS Y CONFIGURACIÓN
// ==========================================
app.get('/api/campaigns', async (_req, res) => {
  try {
    const campaigns = await dataAdapter.getCampaigns();
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', async (req: AuthenticatedRequest, res) => {
  try {
    const { nombre, cloneFromCampaign, selectedOwners, selectedAnimals, setActiveImmediately } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });

    const result = await dataAdapter.createCampaignWithMigration({
      nombre: nombre.trim(),
      cloneFromCampaign,
      selectedOwners,
      selectedAnimals,
      setActiveImmediately,
    });

    await auditLog(req, 'NUEVA_CAMPANA', 'CAMPANA', nombre.trim(), {
      origen: cloneFromCampaign || 'Nueva desde cero',
      totalAnimales: result.animalsCount,
      totalPropietarios: result.ownersCount,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error en POST /api/campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:nombre', async (req: AuthenticatedRequest, res) => {
  try {
    await dataAdapter.deleteCampaign(req.params.nombre);
    await auditLog(req, 'ELIMINAR_CAMPANA', 'CAMPANA', req.params.nombre, {});
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/active', async (req: AuthenticatedRequest, res) => {
  try {
    const { campana } = req.body;
    if (!campana) return res.status(400).json({ error: 'Campaña no especificada' });
    await dataAdapter.setSetting('active_campaign', campana);
    await auditLog(req, 'MODIFICACION', 'CONFIGURACION', 'active_campaign', { campana });
    res.json({ success: true, activeCampaign: campana });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = String(req.ip || req.socket.remoteAddress || '');

    if (await isIpBlocked(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Espere 2 minutos.' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const user = await dataAdapter.getUserByUsername(username.trim().toLowerCase());
    if (!user || !user.activo || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      recordFailedLogin(ip);
      await dataAdapter.recordAudit({
        usuarioNombre: username ? username.trim() : 'Desconocido',
        usuarioRol: 'CONSULTA',
        accion: 'LOGIN_FALLIDO',
        entidad: 'USUARIO',
        entidadId: username ? username.trim() : undefined,
        detalles: { motivo: 'Credenciales inválidas' },
        ip,
      });
      return res.status(401).json({ error: 'Credenciales incorrectas o usuario inactivo' });
    }

    resetFailedLogin(ip);
    const token = generateToken({ id: user.id, username: user.username, rol: user.rol });
    const settingCamp = await dataAdapter.getSetting('active_campaign');

    const authUser: User = {
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo || '',
      email: user.email || '',
      avatarInitials: user.avatar_initials || '',
      activo: Boolean(user.activo),
      campanaActiva: user.campana_activa || settingCamp || '2025-2026',
    };

    await dataAdapter.recordAudit({
      usuarioId: user.id,
      usuarioNombre: user.nombre_completo,
      usuarioRol: user.rol,
      accion: 'INICIO_SESION',
      entidad: 'USUARIO',
      entidadId: user.id,
      ip,
    });

    res.json({ token, user: authUser });
  } catch (error: any) {
    console.error('Error en /api/auth/login:', error);
    res.status(500).json({ error: 'Error durante el inicio de sesión' });
  }
});

app.post('/api/auth/logout', async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user) {
      await auditLog(req, 'CIERRE_SESION', 'USUARIO', req.user.id, {});
    }
    res.json({ success: true });
  } catch (error: any) {
    res.json({ success: true });
  }
});

app.post('/api/auth/switch-user', async (req: AuthenticatedRequest, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId es requerido' });

    const targetUser = await dataAdapter.getUserById(targetUserId);
    if (!targetUser || !targetUser.activo) {
      return res.status(404).json({ error: 'Usuario destino no disponible o inactivo' });
    }

    const token = generateToken({ id: targetUser.id, username: targetUser.username, rol: targetUser.rol });
    const settingCamp = await dataAdapter.getSetting('active_campaign');

    const authUser: User = {
      id: targetUser.id,
      username: targetUser.username,
      nombreCompleto: targetUser.nombre_completo,
      rol: targetUser.rol,
      cargo: targetUser.cargo || '',
      email: targetUser.email || '',
      avatarInitials: targetUser.avatar_initials || '',
      activo: Boolean(targetUser.activo),
      campanaActiva: targetUser.campana_activa || settingCamp || '2025-2026',
    };

    await auditLog(req, 'CAMBIO_USUARIO', 'USUARIO', targetUser.id, { aUsuario: targetUser.username });
    res.json({ token, user: authUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', async (req: AuthenticatedRequest, res) => {
  try {
    const user = await dataAdapter.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    const authUser = {
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo || '',
      email: user.email || '',
      avatarInitials: user.avatar_initials || '',
      activo: Boolean(user.activo),
      campanaActiva: user.campana_activa || '2025-2026',
    };
    res.json({
      user: authUser,
      ...authUser,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/me/active-campaign', async (req: AuthenticatedRequest, res) => {
  try {
    const { campana } = req.body;
    if (!campana) return res.status(400).json({ error: 'Campaña no especificada' });
    const user = await dataAdapter.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    user.campana_activa = campana;
    await dataAdapter.saveUser({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo,
      email: user.email,
      avatarInitials: user.avatar_initials,
      activo: user.activo,
      campanaActiva: campana,
    });

    res.json({ success: true, campanaActiva: campana });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/change-password', async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await dataAdapter.getUserById(req.user!.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (user.password_hash && !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'La contraseña actual no es correcta' });
    }

    const newHash = hashPassword(newPassword);
    await dataAdapter.saveUser({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo,
      email: user.email,
      avatarInitials: user.avatar_initials,
      activo: user.activo,
      passwordHash: newHash,
      campanaActiva: user.campana_activa,
    });

    await auditLog(req, 'MODIFICACION', 'USUARIO', user.id, { accion: 'Cambio de contraseña' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 9. GESTIÓN DE USUARIOS (ADMIN)
// ==========================================
app.get('/api/users', requireAdmin, async (_req, res) => {
  try {
    const users = await dataAdapter.getUsers();
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, username, nombreCompleto, rol, cargo, email, avatarInitials, activo, password } = req.body;
    const userId = id || `usr-${Date.now()}`;
    const userToSave: any = {
      id: userId,
      username: username.trim().toLowerCase(),
      nombreCompleto,
      rol: rol || 'CONSULTA',
      cargo: cargo || '',
      email: email || '',
      avatarInitials: avatarInitials || '',
      activo: activo !== false ? 1 : 0,
      campanaActiva: '2025-2026',
    };
    if (password) {
      userToSave.passwordHash = hashPassword(password);
    }
    const saved = await dataAdapter.saveUser(userToSave);
    await auditLog(req, 'CREAR_EDITAR_USUARIO', 'USUARIO', saved.id, { username: saved.username, rol: saved.rol });
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    await dataAdapter.deleteUser(req.params.id);
    await auditLog(req, 'ELIMINAR_USUARIO', 'USUARIO', req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10. AUDITORÍA
// ==========================================
app.get('/api/audit-logs', async (_req, res) => {
  try {
    const logs = await dataAdapter.getAuditLogs();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 11. COPIAS DE SEGURIDAD (ADMIN)
// ==========================================
app.get('/api/admin/backup/stats', requireAdmin, async (_req, res) => {
  try {
    const [animals, owners, movements, campaigns, stallions, users, audit] = await Promise.all([
      dataAdapter.getAnimals(),
      dataAdapter.getOwners(),
      dataAdapter.getMovements(),
      dataAdapter.getCampaigns(),
      dataAdapter.getStallions(),
      dataAdapter.getUsers(),
      dataAdapter.getAuditLogs(),
    ]);

    const totalDocuments = animals.reduce(
      (acc, a) => acc + (Array.isArray(a.documentos) ? a.documentos.length : 0),
      0
    );

    res.json({
      databaseSize: 1048576,
      databaseSizeBytes: 0,
      databaseSizeFormatted: 'Supabase Cloud (PostgreSQL)',
      databaseProvider: 'Supabase Cloud (PostgreSQL)',
      storageProvider: 'Supabase Storage Bucket',
      totalAnimals: animals.length,
      animalsCount: animals.length,
      totalOwners: owners.length,
      ownersCount: owners.length,
      totalMovements: movements.length,
      movementsCount: movements.length,
      totalCampaigns: campaigns.length,
      campaignsCount: campaigns.length,
      totalStallions: stallions.length,
      stallionsCount: stallions.length,
      totalUsers: users.length,
      usersCount: users.length,
      totalAuditLogs: audit.length,
      auditLogsCount: audit.length,
      documentsCount: totalDocuments,
      documentsTotalSize: 0,
      documentsSizeBytes: 0,
      documentsSizeFormatted: 'Supabase Storage Bucket',
      lastModified: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/backup/export', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const [animals, owners, movements, campaigns, stallions, users, audit, settings] = await Promise.all([
      dataAdapter.getAnimals(),
      dataAdapter.getOwners(),
      dataAdapter.getMovements(),
      dataAdapter.getCampaigns(),
      dataAdapter.getStallions(),
      dataAdapter.getUsers(),
      dataAdapter.getAuditLogs(),
      dataAdapter.getSettings(),
    ]);

    const safeSettings = { ...settings };
    delete safeSettings['entradas_smtp_pass'];

    const backupData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      database: 'Supabase Postgres Backup',
      data: {
        animals,
        owners,
        movements,
        campaigns,
        stallions,
        users,
        audit,
        settings: safeSettings,
      },
    };

    const zip = new JSZip();
    zip.file('database_export.json', JSON.stringify(backupData, null, 2));
    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    const filename = `marisma_backup_${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await auditLog(req, 'DESCARGA_COPIA_SEGURIDAD', 'SISTEMA', 'BACKUP_ZIP', {});
    res.send(content);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/backup/download', requireAdmin, async (req: AuthenticatedRequest, res) => {
  // Redirige al export estándar
  res.redirect('/api/admin/backup/export');
});

app.post('/api/admin/backup/restore-zip', requireAdmin, uploadZip.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: 'No se ha subido ningún archivo ZIP de copia de seguridad' });
    }

    const zip = await JSZip.loadAsync(file.buffer);
    const exportFile = zip.file('database_export.json');
    if (!exportFile) {
      return res.status(400).json({ error: 'El archivo ZIP no contiene una copia de seguridad válida (database_export.json)' });
    }

    const jsonContent = await exportFile.async('string');
    const parsed = JSON.parse(jsonContent);

    const { restoredCounts } = await dataAdapter.restoreFromBackupData(parsed.data);

    // Restaurar documentos si existen dentro de documents/
    let restoredDocs = 0;
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (relativePath.startsWith('documents/') && !zipEntry.dir) {
        const docName = path.basename(relativePath);
        if (docName) {
          const docBuffer = await zipEntry.async('nodebuffer');
          const mimeType = docName.endsWith('.pdf')
            ? 'application/pdf'
            : docName.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg';
          await dataAdapter.uploadDocument(docName, docBuffer, mimeType);
          restoredDocs++;
        }
      }
    }

    await auditLog(req, 'RESTAURACION_BACKUP', 'SISTEMA', 'RESTORE_ZIP', {
      fechaCopia: parsed.exportDate,
      restaurados: restoredCounts,
      documentosRestaurados: restoredDocs,
    });

    res.json({
      success: true,
      message: 'Copia de seguridad restaurada correctamente',
      documentosRestaurados: restoredDocs,
    });
  } catch (error: any) {
    console.error('Error restaurando backup ZIP:', error);
    res.status(500).json({ error: 'Error al restaurar la copia de seguridad: ' + error.message });
  }
});

// ==========================================
// 12. EXPORTACIONES ODS OFICIALES
// ==========================================
app.get('/api/export/equinos-ods', async (req: AuthenticatedRequest, res) => {
  try {
    const campana = (req.query.campana as string) || '2025-2026';
    const [animals, owners, movements, stallions] = await Promise.all([
      dataAdapter.getAnimals(campana, 'EQUINO'),
      dataAdapter.getOwners(campana),
      dataAdapter.getMovements(campana),
      dataAdapter.getStallions(campana),
    ]);

    const odsBuffer = await OdsExportService.generateEquinosWorkbook({
      campaign: campana,
      animals,
      owners,
      movements,
      stallions,
    });

    const filename = `CENSO_EQUINO_HINOJOS_${campana}.ods`;
    res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.spreadsheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(odsBuffer);
  } catch (error: any) {
    console.error('Error generando ODS Equinos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/export/bovinos-ods', async (req: AuthenticatedRequest, res) => {
  try {
    const campana = (req.query.campana as string) || '2025-2026';
    const [animals, owners] = await Promise.all([
      dataAdapter.getAnimals(campana, 'BOVINO'),
      dataAdapter.getOwners(campana),
    ]);

    const odsBuffer = await OdsExportService.generateBovinosWorkbook({
      campaign: campana,
      animals,
      owners,
    });

    const filename = `CENSO_BOVINO_HINOJOS_${campana}.ods`;
    res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.spreadsheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(odsBuffer);
  } catch (error: any) {
    console.error('Error generando ODS Bovinos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 13. MÓDULO ENTRADAS (MARISMA DE HINOJOS - DOÑANA)
// ==========================================

// Listar remesas
app.get('/api/entradas', async (req: AuthenticatedRequest, res) => {
  try {
    const campana = (req.query.campana as string) || undefined;
    const remesas = await dataAdapter.getEntradasRemesas(campana);
    res.json(remesas);
  } catch (error: any) {
    console.error('Error en GET /api/entradas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Detalle de remesa
app.get('/api/entradas/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const remesa = await dataAdapter.getEntradaRemesaById(req.params.id);
    if (!remesa) return res.status(404).json({ error: 'Remesa de entrada no encontrada' });
    res.json(remesa);
  } catch (error: any) {
    console.error('Error en GET /api/entradas/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Guardar/Crear remesa
app.post('/api/entradas', async (req: AuthenticatedRequest, res) => {
  try {
    const remesaData: EntradaRemesa = req.body;
    if (!remesaData.id) {
      remesaData.id = `REM-${Date.now()}`;
    }
    if (req.user) {
      remesaData.creadoPorUsuarioId = req.user.id;
      const dbUser = await dataAdapter.getUserById(req.user.id);
      remesaData.creadoPorNombre = dbUser ? dbUser.nombreCompleto : req.user.username;
    }

    const saved = await dataAdapter.saveEntradaRemesa(remesaData);

    await auditLog(req, remesaData.estado === 'ENVIADO' ? 'ENVIO_PERMISOS_DONANA' : 'CREAR_ENTRADA', 'ENTRADA', saved.id, {
      titulo: saved.tituloOficial,
      tipo: saved.tipoRemesa,
      fechas: saved.fechas,
      totalPersonas: saved.personas?.length || 0,
    });

    res.status(201).json(saved);
  } catch (error: any) {
    console.error('Error en POST /api/entradas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Eliminar remesa
app.delete('/api/entradas/:id', async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    await dataAdapter.deleteEntradaRemesa(id);

    await auditLog(req, 'ELIMINAR_ENTRADA', 'ENTRADA', id, {});
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error en DELETE /api/entradas/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// Descargar ODS oficial de la remesa
app.get('/api/entradas/:id/download-ods', async (req: AuthenticatedRequest, res) => {
  try {
    const remesa = await dataAdapter.getEntradaRemesaById(req.params.id);
    if (!remesa) return res.status(404).json({ error: 'Remesa no encontrada' });

    const buffer = await generateEntradaOds(remesa);
    const filename = (remesa.archivoOdsNombre || `${remesa.tituloOficial || 'Permisos_Marisma_Hinojos'}.ods`)
      .replace(/[^\w.-]/g, '_');

    await auditLog(req, 'DESCARGA_ODS_ENTRADA', 'ENTRADA', remesa.id, {
      archivo: filename,
    });

    res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.spreadsheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('Error descargando ODS de entrada:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enviar remesa por correo electrónico
app.post('/api/entradas/:id/enviar-email', async (req: AuthenticatedRequest, res) => {
  try {
    const remesa = await dataAdapter.getEntradaRemesaById(req.params.id);
    if (!remesa) return res.status(404).json({ error: 'Remesa no encontrada' });

    // Prevención de doble envío / concurrencia
    if (remesa.estado === 'ENVIANDO') {
      const lastUpdate = remesa.actualizadoEn ? new Date(remesa.actualizadoEn).getTime() : 0;
      const now = Date.now();
      // Si lleva menos de 2 minutos procesándose, evitar envío concurrente / duplicado
      if (now - lastUpdate < 120000) {
        return res.status(409).json({
          error: 'La remesa ya se está enviando a Doñana en este momento. Por favor, espere unos segundos a que finalice el proceso.',
        });
      }
    }

    const previousEstado = (remesa.estado === 'ENVIANDO' ? 'BORRADOR' : remesa.estado) || 'BORRADOR';

    // BLOQUEO PREVENTIVO: Marcar en base de datos como ENVIANDO de inmediato
    await dataAdapter.updateEntradaRemesaEstado(remesa.id, { estado: 'ENVIANDO' });
    remesa.estado = 'ENVIANDO';

    try {
      const { destinatariosOverride } = req.body;
      const odsBuffer = await generateEntradaOds(remesa);

      let currentUser: User | null = null;
      if (req.user) {
        currentUser = await dataAdapter.getUserById(req.user.id);
      }
      if (!currentUser) {
        currentUser = {
          id: req.user?.id || 'admin',
          username: req.user?.username || 'admin',
          nombreCompleto: 'Usuario Administrador',
          rol: 'ADMINISTRADOR',
          cargo: 'Responsable',
          email: '',
          avatarInitials: 'AD',
          activo: true,
        };
      }

      const sendResult = await sendEntradaEmail({
        remesa,
        odsBuffer,
        destinatariosOverride,
        user: currentUser,
      });

      // Actualizar estado de la remesa a ENVIADO de forma definitiva
      const fechaEnvioEmail = new Date().toISOString();
      const destinatariosEmail = sendResult.recipients.join(', ');
      const archivoOdsNombre = remesa.archivoOdsNombre || `${(remesa.tituloOficial || 'Permisos_Marisma').replace(/[^\w.-]/g, '_')}.ods`;

      await dataAdapter.updateEntradaRemesaEstado(remesa.id, {
        estado: 'ENVIADO',
        fechaEnvioEmail,
        destinatariosEmail,
        archivoOdsNombre,
      });

      remesa.estado = 'ENVIADO';
      remesa.fechaEnvioEmail = fechaEnvioEmail;
      remesa.destinatariosEmail = destinatariosEmail;
      remesa.archivoOdsNombre = archivoOdsNombre;

      await auditLog(req, 'ENVIO_PERMISOS_DONANA', 'ENTRADA', remesa.id, {
        titulo: remesa.tituloOficial,
        destinatarios: sendResult.recipients,
        bcc: sendResult.bcc,
        messageId: sendResult.messageId,
      });

      res.json({ success: true, remesa, sendResult });
    } catch (sendError: any) {
      console.error('Error durante el envío de la remesa, revirtiendo estado en BD:', sendError);
      await dataAdapter.updateEntradaRemesaEstado(remesa.id, { estado: previousEstado }).catch((revErr) => {
        console.error('Error al revertir estado de remesa:', revErr);
      });
      throw sendError;
    }
  } catch (error: any) {
    console.error('Error enviando remesa por email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Subir Guía de Traslado para un animal en una entrada
app.post('/api/entradas/upload-guia', uploadMemory.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const file = req.file;
    const { animalId, remesaId, personaEntradaId, faena, plazaNumero, chip } = req.body;

    if (!file) return res.status(400).json({ error: 'No se ha subido ningún archivo' });
    if (!hasValidSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({ error: 'El archivo debe ser un PDF, JPG o PNG válido' });
    }

    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageFilename = `guia_${animalId || 'externo'}_${Date.now()}_${cleanName}`;

    await dataAdapter.uploadDocument(storageFilename, file.buffer, file.mimetype);

    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const docUrl = `/uploads/documents/${storageFilename}`;
    const docId = `guia-${Date.now()}`;

    // Si el animal existe en el censo, agregar la guía a su expediente en Documentación Adjunta
    // SIN modificar fecha_ultima_revision ni estado_presencia
    const animalsToUpdate: Animal[] = [];
    if (animalId) {
      const a = await dataAdapter.getAnimalById(animalId);
      if (a) animalsToUpdate.push(a);
    }
    if (chip || plazaNumero) {
      const allAnimals = await dataAdapter.getAnimals();
      const matches = allAnimals.filter(
        (a) =>
          (chip && a.identificacion1 && a.identificacion1.trim() === String(chip).trim()) ||
          (plazaNumero && a.plazaNumero && a.plazaNumero.trim().toUpperCase() === String(plazaNumero).trim().toUpperCase())
      );
      for (const m of matches) {
        if (!animalsToUpdate.some((x) => x.id === m.id)) {
          animalsToUpdate.push(m);
        }
      }
    }

    for (const animal of animalsToUpdate) {
      const newDoc: AnimalDocument = {
        id: docId,
        nombre: `Guía Traslado ${animal.plazaNumero ? `(${animal.plazaNumero})` : ''} - ${file.originalname}`,
        tipo: 'GUIA_SANITARIA',
        fechaSubida: new Date().toISOString().slice(0, 10),
        tamano: sizeStr,
        url: docUrl,
      };
      animal.documentos = [...(animal.documentos || []), newDoc];
      await dataAdapter.saveAnimal(animal);

      await auditLog(req, 'ALTA', 'DOCUMENTO', newDoc.id, {
        animalId: animal.id,
        plaza: animal.plazaNumero,
        documento: newDoc.nombre,
        origen: 'MODULO_ENTRADAS',
      });
    }

    res.status(201).json({
      success: true,
      documentId: docId,
      documentName: file.originalname,
      documentUrl: docUrl,
      size: sizeStr,
    });
  } catch (error: any) {
    console.error('Error subiendo guía de traslado:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener historial de autorizaciones de entrada de un animal concreto
app.get('/api/entradas/animal/:animalId', async (req: AuthenticatedRequest, res) => {
  try {
    const list = await dataAdapter.getEntradasByAnimalId(req.params.animalId);
    res.json(list);
  } catch (error: any) {
    console.error('Error en GET /api/entradas/animal/:animalId:', error);
    res.status(500).json({ error: error.message });
  }
});

// Configuración SMTP
app.get('/api/settings/smtp', async (_req: AuthenticatedRequest, res) => {
  try {
    const config = await getSmtpConfig();
    res.json({
      ...config,
      pass: config.pass ? '••••••••' : '',
      hasPass: Boolean(config.pass),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/smtp', async (req: AuthenticatedRequest, res) => {
  try {
    const { host, port, secure, user, pass, fromName, destinatarios, bcc } = req.body;

    if (host !== undefined) await dataAdapter.setSetting('entradas_smtp_host', host.trim());
    if (port !== undefined) await dataAdapter.setSetting('entradas_smtp_port', String(port).trim());
    if (secure !== undefined) await dataAdapter.setSetting('entradas_smtp_secure', String(Boolean(secure)));
    if (user !== undefined) await dataAdapter.setSetting('entradas_smtp_user', user.trim());
    if (pass && pass !== '••••••••' && pass !== '********') {
      const encrypted = encryptPassword(pass.trim());
      await dataAdapter.setSetting('entradas_smtp_pass', encrypted);
    }
    if (fromName !== undefined) await dataAdapter.setSetting('entradas_smtp_from_name', fromName.trim());
    if (destinatarios !== undefined) await dataAdapter.setSetting('entradas_email_destinatarios', destinatarios.trim());
    if (bcc !== undefined) await dataAdapter.setSetting('entradas_email_bcc', bcc.trim());

    await auditLog(req, 'MODIFICACION', 'SISTEMA', 'config-smtp', {
      host,
      user,
      destinatarios,
      bcc,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings/smtp-test', async (req: AuthenticatedRequest, res) => {
  try {
    let { host, port, secure, user, pass, fromName, testRecipient } = req.body;

    if (!pass || pass === '••••••••' || pass === '********') {
      pass = (await getSmtpConfig()).pass || '';
    }

    const config: SmtpConfig = {
      host: host || (await dataAdapter.getSetting('entradas_smtp_host')) || '',
      port: port || parseInt((await dataAdapter.getSetting('entradas_smtp_port')) || '587', 10),
      secure: secure !== undefined ? Boolean(secure) : ((await dataAdapter.getSetting('entradas_smtp_secure')) === 'true'),
      user: user || (await dataAdapter.getSetting('entradas_smtp_user')) || '',
      pass,
      fromName: fromName || (await dataAdapter.getSetting('entradas_smtp_from_name')) || 'Ayuntamiento de Hinojos',
      destinatarios: '',
      bcc: '',
    };

    const result = await testSmtpConnection(config, testRecipient);
    res.json(result);
  } catch (error: any) {
    console.error('Error probando SMTP:', error);
    res.status(400).json({ error: error.message });
  }
});

// Middleware global para manejo seguro de errores de Express y Multer
app.use((err: any, _req: any, res: any, next: any) => {
  if (err) {
    console.error('[EXPRESS ERROR]:', err.message || err);
    return res.status(err.status || 400).json({ error: err.message || 'Error procesando la solicitud' });
  }
  next();
});

export { app };
export default function handler(req: any, res: any) {
  return app(req, res);
}

