import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { OdsExportService } from './services/odsExportService.js';
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
const PORT = process.env.PORT || 3001;

// 1. Hardening y Cabeceras de Seguridad
app.disable('x-powered-by');

app.use((req, res, next) => {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  if (process.env.NODE_ENV === 'production' && !isHttps) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.supabase.co ws: wss:;"
  );

  next();
});

// 2. CORS y Parseo de Cargas
const configuredOrigins = new Set(
  (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopment = process.env.NODE_ENV !== 'production' &&
      (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
    if (!origin || configuredOrigins.has(origin) || isLocalDevelopment) return callback(null, true);
    return callback(null, true); // Permitir peticiones en subdominios de Vercel
  },
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 3. Rate Limiter en memoria para intentos fallidos
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

function isIpBlocked(ip: string): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  const record = loginRateLimitStore.get(ip);
  return Boolean(record && record.blockedUntil > Date.now());
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

// Configuración de Multer para subida a memoria
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Sólo se permiten PDF, JPG y PNG'));
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
      await auditLog(req, 'BAJA', 'ANIMAL', animal.plazaNumero || animal.id, {
        tipo: animal.tipo,
        plaza: animal.plazaNumero,
        nombre: animal.nombreAnimal,
        titular: animal.propietario,
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

// Servicio seguro de documentos desde Supabase Storage
app.get('/uploads/documents/:filename', async (req: AuthenticatedRequest, res) => {
  try {
    const { filename } = req.params;
    const { data, error } = await dataAdapter.downloadDocument(filename);
    if (error || !data) return res.status(404).send('Documento no encontrado');

    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (filename.endsWith('.pdf')) res.setHeader('Content-Type', 'application/pdf');
    else if (filename.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');

    res.send(buffer);
  } catch (err: any) {
    res.status(500).send('Error recuperando documento');
  }
});

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
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
    await dataAdapter.saveCampaign(nombre.trim(), 0);
    await auditLog(req, 'NUEVA_CAMPANA', 'CAMPANA', nombre.trim(), {});
    res.status(201).json({ success: true, nombre: nombre.trim() });
  } catch (error: any) {
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

    if (isIpBlocked(ip)) {
      return res.status(429).json({ error: 'Demasiados intentos fallidos. Espere 2 minutos.' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const user = await dataAdapter.getUserByUsername(username.trim().toLowerCase());
    if (!user || !user.activo || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      recordFailedLogin(ip);
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
    res.json({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo || '',
      email: user.email || '',
      avatarInitials: user.avatar_initials || '',
      activo: Boolean(user.activo),
      campanaActiva: user.campana_activa || '2025-2026',
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

    res.json({
      databaseSizeBytes: 0,
      databaseSizeFormatted: 'Supabase Cloud Postgres',
      totalAnimals: animals.length,
      totalOwners: owners.length,
      totalMovements: movements.length,
      totalCampaigns: campaigns.length,
      totalStallions: stallions.length,
      totalUsers: users.length,
      totalAuditLogs: audit.length,
      documentsCount: 0,
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
        settings,
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

export { app };
export default function handler(req: any, res: any) {
  return app(req, res);
}

