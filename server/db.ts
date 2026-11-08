import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  Animal,
  Owner,
  Stallion,
  Movement,
  User,
  Association,
  AuditLog,
} from '../src/types/marisma.js';
import {
  INITIAL_ANIMALS,
  INITIAL_OWNERS,
  INITIAL_STALLIONS,
  INITIAL_MOVEMENTS,
  INITIAL_USERS,
  CAMPAIGNS,
  INITIAL_ASSOCIATIONS,
} from '../src/data/initialData.js';

import { hashPassword, verifyPassword } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directorios para datos y subida de archivos
export const DATA_DIR = path.resolve(__dirname, '..', 'data');
export const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');
export const DOCUMENTS_DIR = path.resolve(UPLOADS_DIR, 'documents');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_DIR)) {
  fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
}

export const DB_PATH = path.join(DATA_DIR, 'marisma.db');
export const db = new DatabaseSync(DB_PATH);

// Configuración WAL para alto rendimiento y concurrencia
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Inicialización del esquema de tablas relacionales
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      nombre TEXT PRIMARY KEY,
      activa INTEGER DEFAULT 0,
      creado_en TEXT
    );

    CREATE TABLE IF NOT EXISTS associations (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      cif TEXT NOT NULL,
      creado_en TEXT
    );

    CREATE TABLE IF NOT EXISTS owners (
      id TEXT PRIMARY KEY,
      campana TEXT DEFAULT '2025-2026',
      nombre_completo TEXT NOT NULL,
      dni_cif TEXT NOT NULL,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      municipio TEXT,
      codigo_rega TEXT,
      asociacion TEXT,
      notas TEXT
    );

    CREATE TABLE IF NOT EXISTS stallions (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      campana TEXT NOT NULL,
      nombre TEXT NOT NULL,
      identificacion_chip TEXT,
      ueln TEXT,
      propietario TEXT NOT NULL,
      fecha_nacimiento TEXT,
      capa TEXT,
      estado_aprobacion TEXT DEFAULT 'AUTORIZADO',
      numero_yeguas_cubiertas INTEGER DEFAULT 0,
      zona_marisma TEXT,
      observaciones TEXT
    );

    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      animal_id TEXT NOT NULL,
      campana TEXT,
      identificacion1 TEXT,
      tipo_animal TEXT NOT NULL,
      plaza_numero TEXT NOT NULL,
      nombre_animal TEXT,
      propietario TEXT NOT NULL,
      tipo_movimiento TEXT NOT NULL,
      fecha TEXT NOT NULL,
      motivo TEXT NOT NULL,
      numero_guia TEXT,
      guarda_responsable TEXT,
      observaciones TEXT,
      liberar_plaza INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      nombre_completo TEXT NOT NULL,
      rol TEXT NOT NULL,
      cargo TEXT,
      email TEXT,
      avatar_initials TEXT,
      activo INTEGER DEFAULT 1,
      password_hash TEXT,
      campana_activa TEXT DEFAULT '2025-2026'
    );

    CREATE TABLE IF NOT EXISTS animals (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      campana TEXT NOT NULL,
      plaza_numero TEXT NOT NULL,
      propietario TEXT NOT NULL,
      finca TEXT DEFAULT 'HINOJOS',
      identificacion1 TEXT,
      identificacion2 TEXT,
      nombre_animal TEXT NOT NULL,
      sexo TEXT NOT NULL,
      fecha_nacimiento TEXT,
      capa TEXT NOT NULL,
      fecha_ultima_revision TEXT,
      estado_presencia TEXT NOT NULL,
      fecha_entrada_marisma TEXT,
      fecha_salida_marisma TEXT,
      es_semental INTEGER DEFAULT 0,
      es_plaza_vacante INTEGER DEFAULT 0,
      animal_anterior_id TEXT,
      rastra_json TEXT,
      documentos_json TEXT,
      anotaciones_json TEXT,
      creado_en TEXT,
      actualizado_en TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      fecha TEXT NOT NULL,
      usuario_id TEXT,
      usuario_nombre TEXT NOT NULL,
      usuario_rol TEXT NOT NULL,
      accion TEXT NOT NULL,
      entidad TEXT NOT NULL,
      entidad_id TEXT,
      detalles_json TEXT,
      ip TEXT
    );

    CREATE TRIGGER IF NOT EXISTS audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'Los registros de auditoría son inmutables');
    END;

    CREATE TRIGGER IF NOT EXISTS audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'Los registros de auditoría son inmutables');
    END;

    CREATE TRIGGER IF NOT EXISTS movements_require_existing_animal
    BEFORE INSERT ON movements
    WHEN NOT EXISTS (SELECT 1 FROM animals WHERE id = NEW.animal_id)
    BEGIN
      SELECT RAISE(ABORT, 'El movimiento debe pertenecer a un animal existente');
    END;

    CREATE TRIGGER IF NOT EXISTS movements_require_existing_animal_on_update
    BEFORE UPDATE OF animal_id ON movements
    WHEN NOT EXISTS (SELECT 1 FROM animals WHERE id = NEW.animal_id)
    BEGIN
      SELECT RAISE(ABORT, 'El movimiento debe pertenecer a un animal existente');
    END;
  `);

  // Migración automática: asegurar que existe la columna password_hash en instalaciones existentes
  try {
    db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
  } catch {
    // La columna ya existe
  }

  // Migración automática: columna campana_activa por usuario
  try {
    db.exec(`ALTER TABLE users ADD COLUMN campana_activa TEXT DEFAULT '2025-2026';`);
  } catch {
    // La columna ya existe
  }

  // Normalización de marcas de tiempo en campañas iniciales para orden cronológico estricto
  try {
    db.prepare("UPDATE campaigns SET creado_en = '2023-01-01T00:00:00.000Z' WHERE nombre = '2023-2024' AND creado_en LIKE '2026-10-30%'").run();
    db.prepare("UPDATE campaigns SET creado_en = '2024-01-01T00:00:00.000Z' WHERE nombre = '2024-2025' AND creado_en LIKE '2026-10-30%'").run();
    db.prepare("UPDATE campaigns SET creado_en = '2025-01-01T00:00:00.000Z' WHERE nombre = '2025-2026' AND creado_en LIKE '2026-10-30%'").run();
    db.prepare("UPDATE campaigns SET creado_en = '2026-01-01T00:00:00.000Z' WHERE nombre = '2026-2027' AND creado_en LIKE '2026-10-30%'").run();
  } catch {}

  // Normalización: los animales bovinos no tienen nombre
  try {
    db.prepare("UPDATE animals SET nombre_animal = '' WHERE tipo = 'BOVINO' AND nombre_animal != ''").run();
    db.prepare("UPDATE movements SET nombre_animal = '' WHERE tipo_animal = 'BOVINO' AND nombre_animal != ''").run();
  } catch {}

  // Migración automática: columna campana por propietario/socio
  try {
    db.exec(`ALTER TABLE owners ADD COLUMN campana TEXT DEFAULT '2025-2026';`);
  } catch {
    // La columna ya existe
  }

  // Migración automática: columnas campana e identificacion1 en movements
  try {
    db.exec(`ALTER TABLE movements ADD COLUMN campana TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE movements ADD COLUMN identificacion1 TEXT;`);
  } catch {}

  // Backfill de campana e identificacion1 en movements a partir de los datos históricos del animal
  try {
    db.prepare(`
      UPDATE movements
      SET campana = (SELECT a.campana FROM animals a WHERE a.id = movements.animal_id),
          identificacion1 = (SELECT a.identificacion1 FROM animals a WHERE a.id = movements.animal_id)
      WHERE campana IS NULL OR campana = '' OR identificacion1 IS NULL OR identificacion1 = '';
    `).run();

    // Si algún animal cambió de ID entre campañas, asociar por identificacion1 o plaza/nombre
    db.prepare(`
      UPDATE movements
      SET campana = (
        SELECT a.campana FROM animals a
        WHERE a.tipo = movements.tipo_animal
          AND (
            (movements.identificacion1 IS NOT NULL AND movements.identificacion1 != '' AND a.identificacion1 = movements.identificacion1)
            OR (movements.nombre_animal != '' AND a.nombre_animal = movements.nombre_animal)
            OR a.plaza_numero = movements.plaza_numero
          )
        ORDER BY a.rowid DESC
        LIMIT 1
      )
      WHERE campana IS NULL OR campana = '';
    `).run();

    // Fallback por defecto a la campaña 2025-2026 si aún no tiene
    db.prepare(`UPDATE movements SET campana = '2025-2026' WHERE campana IS NULL OR campana = '';`).run();
  } catch (err) {
    console.warn('Error backfilling movements:', err);
  }

  // Una instalación anterior con la clave pública histórica no puede ponerse
  // en producción sin rotarla de forma explícita.
  const existingUsers = db.prepare('SELECT id, password_hash FROM users').all() as any[];
  const insecureUsers = existingUsers.filter((user) =>
    user.password_hash && verifyPassword('hinojos2026', user.password_hash)
  );
  if (insecureUsers.length > 0) {
    const replacement = process.env.INITIAL_ADMIN_PASSWORD;
    if (!replacement || replacement.length < 12) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Se detectaron contraseñas históricas inseguras. Configure INITIAL_ADMIN_PASSWORD (mínimo 12 caracteres) para rotarlas antes de iniciar producción');
      }
      console.warn('[SEGURIDAD] Se detectaron contraseñas históricas inseguras. Defina INITIAL_ADMIN_PASSWORD antes de desplegar.');
    } else {
      const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
      for (const user of insecureUsers) updatePassword.run(hashPassword(replacement), user.id);
      console.warn(`[SEGURIDAD] Se rotaron ${insecureUsers.length} contraseñas históricas mediante INITIAL_ADMIN_PASSWORD.`);
    }
  }

  seedInitialDataIfEmpty();
}

// Carga de datos semilla si la base de datos está vacía
function seedInitialDataIfEmpty() {
  const countStmt = db.prepare('SELECT COUNT(*) as total FROM campaigns');
  const countRow = countStmt.get() as { total: number };

  if (countRow.total === 0) {
    console.log('🌱 Inicializando datos semilla en SQLite...');

    // 1. Campañas (con marcas temporales escalonadas para orden cronológico)
    const insertCampaign = db.prepare(
      'INSERT INTO campaigns (nombre, activa, creado_en) VALUES (?, ?, ?)'
    );
    const baseDate = new Date('2026-01-01T00:00:00.000Z');
    CAMPAIGNS.forEach((c, idx) => {
      const campDate = new Date(baseDate.getTime() - idx * 365 * 24 * 60 * 60 * 1000).toISOString();
      insertCampaign.run(c, c === '2025-2026' ? 1 : 0, campDate);
    });

    const setSetting = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    );
    setSetting.run('active_campaign', '2025-2026');

    // 2. Asociaciones
    const insertAsoc = db.prepare(
      'INSERT INTO associations (id, nombre, cif, creado_en) VALUES (?, ?, ?, ?)'
    );
    for (const a of INITIAL_ASSOCIATIONS) {
      insertAsoc.run(a.id, a.nombre, a.cif, a.creadoEn || new Date().toISOString());
    }

    // 3. Propietarios
    const insertOwner = db.prepare(
      `INSERT INTO owners (id, nombre_completo, dni_cif, telefono, email, direccion, municipio, codigo_rega, asociacion, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const o of INITIAL_OWNERS) {
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

    // 4. Sementales
    const insertStallion = db.prepare(
      `INSERT INTO stallions (id, tipo, campana, nombre, identificacion_chip, ueln, propietario, fecha_nacimiento, capa, estado_aprobacion, numero_yeguas_cubiertas, zona_marisma, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of INITIAL_STALLIONS) {
      insertStallion.run(
        s.id,
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
    }

    // 5. Movimientos
    const insertMov = db.prepare(
      `INSERT INTO movements (id, animal_id, tipo_animal, plaza_numero, nombre_animal, propietario, tipo_movimiento, fecha, motivo, numero_guia, guarda_responsable, observaciones, liberar_plaza)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const m of INITIAL_MOVEMENTS) {
      insertMov.run(
        m.id,
        m.animalId,
        m.tipoAnimal,
        m.plazaNumero,
        m.nombreAnimal || '',
        m.propietario,
        m.tipoMovimiento,
        m.fecha,
        m.motivo,
        m.numeroGuia || '',
        m.guardaResponsable || '',
        m.observaciones || '',
        m.liberarPlaza ? 1 : 0
      );
    }

    // 6. Usuarios. El primer arranque exige una contraseña de instalación
    // explícita; nunca se deja una clave conocida dentro del código fuente.
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialPassword || initialPassword.length < 12) {
      throw new Error('INITIAL_ADMIN_PASSWORD (mínimo 12 caracteres) es obligatoria al crear una base de datos nueva');
    }
    const insertUser = db.prepare(
      `INSERT INTO users (id, username, nombre_completo, rol, cargo, email, avatar_initials, activo, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const u of INITIAL_USERS) {
      // Sólo el administrador inicial queda activo. El resto de cuentas debe
      // ser activado y recibir una contraseña individual desde Administración.
      const defaultHash = hashPassword(u.rol === 'ADMINISTRADOR' ? initialPassword : crypto.randomBytes(32).toString('base64url'));
      insertUser.run(
        u.id,
        u.username,
        u.nombreCompleto,
        u.rol,
        u.cargo || '',
        u.email || '',
        u.avatarInitials || '',
        u.rol === 'ADMINISTRADOR' && u.activo ? 1 : 0,
        defaultHash
      );
    }

    // Migración automática: asegurar que existe la columna password_hash en instalaciones existentes
    try {
      db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
    } catch {
      // La columna ya existe
    }

    // 7. Animales
    const insertAnimal = db.prepare(
      `INSERT INTO animals (
        id, tipo, campana, plaza_numero, propietario, finca,
        identificacion1, identificacion2, nombre_animal, sexo, fecha_nacimiento,
        capa, fecha_ultima_revision, estado_presencia, fecha_entrada_marisma,
        fecha_salida_marisma, es_semental, es_plaza_vacante, animal_anterior_id,
        rastra_json, documentos_json, anotaciones_json, creado_en, actualizado_en
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const a of INITIAL_ANIMALS) {
      insertAnimal.run(
        a.id,
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
        a.fechaUltimaRevision || '',
        a.estadoPresencia,
        a.fechaEntradaMarisma || '',
        a.fechaSalidaMarisma || '',
        a.esSemental ? 1 : 0,
        a.esPlazaVacante ? 1 : 0,
        a.animalAnteriorId || '',
        a.rastra ? JSON.stringify(a.rastra) : null,
        JSON.stringify(a.documentos || []),
        JSON.stringify(a.anotaciones || []),
        a.creadoEn || new Date().toISOString(),
        a.actualizadoEn || new Date().toISOString()
      );
    }

    console.log(`✅ Base de datos SQLite inicializada con ${INITIAL_ANIMALS.length} animales y datos municipales.`);
  }
}

// Helpers de transformación entre SQLite y tipos TypeScript
export function mapAnimalRow(row: any): Animal {
  return {
    id: row.id,
    tipo: row.tipo,
    campana: row.campana,
    plazaNumero: row.plaza_numero,
    propietario: row.propietario,
    finca: row.finca,
    identificacion1: row.identificacion1 || '',
    identificacion2: row.identificacion2 || '',
    nombreAnimal: row.tipo === 'BOVINO' ? '' : (row.nombre_animal || ''),
    sexo: row.sexo,
    fechaNacimiento: row.fecha_nacimiento || '',
    capa: row.capa,
    fechaUltimaRevision: row.fecha_ultima_revision || undefined,
    estadoPresencia: row.estado_presencia,
    fechaEntradaMarisma: row.fecha_entrada_marisma || undefined,
    fechaSalidaMarisma: row.fecha_salida_marisma || undefined,
    esSemental: Boolean(row.es_semental),
    esPlazaVacante: Boolean(row.es_plaza_vacante),
    animalAnteriorId: row.animal_anterior_id || undefined,
    rastra: row.rastra_json ? JSON.parse(row.rastra_json) : null,
    documentos: row.documentos_json ? JSON.parse(row.documentos_json) : [],
    anotaciones: row.anotaciones_json ? JSON.parse(row.anotaciones_json) : [],
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  };
}

export function mapOwnerRow(row: any): Owner {
  return {
    id: row.id,
    campana: row.campana || '2025-2026',
    nombreCompleto: row.nombre_completo,
    dniCif: row.dni_cif,
    telefono: row.telefono || '',
    email: row.email || '',
    direccion: row.direccion || '',
    municipio: row.municipio || '',
    codigoRega: row.codigo_rega || undefined,
    asociacion: row.asociacion || undefined,
    notas: row.notas || undefined,
  };
}

export function mapStallionRow(row: any): Stallion {
  return {
    id: row.id,
    tipo: row.tipo,
    campana: row.campana,
    nombre: row.nombre,
    identificacionChip: row.identificacion_chip || '',
    ueln: row.ueln || '',
    propietario: row.propietario,
    fechaNacimiento: row.fecha_nacimiento || '',
    capa: row.capa,
    estadoAprobacion: row.estado_aprobacion,
    numeroYeguasCubiertas: row.numero_yeguas_cubiertas || 0,
    zonaMarisma: row.zona_marisma || undefined,
    observaciones: row.observaciones || undefined,
  };
}

export function mapMovementRow(row: any): Movement {
  return {
    id: row.id,
    animalId: row.animal_id,
    campana: row.campana || '',
    identificacion1: row.identificacion1 || '',
    tipoAnimal: row.tipo_animal,
    plazaNumero: row.plaza_numero,
    nombreAnimal: row.tipo_animal === 'BOVINO' ? '' : (row.nombre_animal || ''),
    propietario: row.propietario,
    tipoMovimiento: row.tipo_movimiento,
    fecha: row.fecha,
    motivo: row.motivo,
    numeroGuia: row.numero_guia || undefined,
    guardaResponsable: row.guarda_responsable || '',
    observaciones: row.observaciones || undefined,
    liberarPlaza: Boolean(row.liberar_plaza),
  };
}

export function mapUserRow(row: any): User {
  return {
    id: row.id,
    username: row.username,
    nombreCompleto: row.nombre_completo,
    rol: row.rol,
    cargo: row.cargo || '',
    email: row.email || '',
    avatarInitials: row.avatar_initials || '',
    activo: Boolean(row.activo),
    campanaActiva: row.campana_activa || '2025-2026',
  };
}

export function mapAuditLogRow(row: any): AuditLog {
  return {
    id: row.id,
    fecha: row.fecha,
    usuarioId: row.usuario_id || undefined,
    usuarioNombre: row.usuario_nombre || 'Sistema',
    usuarioRol: row.usuario_rol || 'CONSULTA',
    accion: row.accion,
    entidad: row.entidad,
    entidadId: row.entidad_id || undefined,
    detallesJson: row.detalles_json || undefined,
    ip: row.ip || undefined,
  };
}

export function recordAudit(
  database: any,
  entry: {
    usuarioId?: string;
    usuarioNombre?: string;
    usuarioRol?: string;
    accion: string;
    entidad: string;
    entidadId?: string;
    detalles?: any;
    ip?: string;
  }
) {
  try {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fecha = new Date().toISOString();
    const detallesJson =
      typeof entry.detalles === 'string'
        ? entry.detalles
        : entry.detalles
        ? JSON.stringify(entry.detalles)
        : null;

    database.prepare(`
      INSERT INTO audit_logs (id, fecha, usuario_id, usuario_nombre, usuario_rol, accion, entidad, entidad_id, detalles_json, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      fecha,
      entry.usuarioId || null,
      entry.usuarioNombre || 'Sistema',
      entry.usuarioRol || 'ADMINISTRADOR',
      entry.accion,
      entry.entidad,
      entry.entidadId || null,
      detallesJson,
      entry.ip || null
    );
  } catch (err) {
    console.warn('Error al registrar log de auditoría:', err);
  }
}

export function checkpointDb() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (err) {
    console.warn('Error ejecutando checkpoint WAL de SQLite:', err);
  }
}

export function validateDatabaseBuffer(buffer: Buffer): void {
  if (buffer.length < 100 || buffer.subarray(0, 16).toString('ascii') !== 'SQLite format 3\u0000') {
    throw new Error('La copia no contiene una base de datos SQLite válida');
  }
  const temporaryPath = path.join(DATA_DIR, `restore-validation-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  try {
    fs.writeFileSync(temporaryPath, buffer, { flag: 'wx' });
    const candidate = new DatabaseSync(temporaryPath);
    try {
      const requiredTables = ['animals', 'owners', 'movements', 'users', 'campaigns', 'audit_logs'];
      const existingTables = candidate.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
      const names = new Set(existingTables.map((table) => table.name));
      if (!requiredTables.every((table) => names.has(table))) {
        throw new Error('La copia no tiene el esquema municipal esperado');
      }
      const integrity = candidate.prepare('PRAGMA integrity_check').get() as Record<string, string>;
      if (Object.values(integrity)[0] !== 'ok') throw new Error('La copia SQLite no supera la comprobación de integridad');
    } finally {
      candidate.close();
    }
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}

export function reloadDbFromFile(newDbBuffer: Buffer): { emergencyBackupPath?: string } {
  checkpointDb();
  let emergencyBackupPath: string | undefined;

  db.close();
  try {
    if (fs.existsSync(DB_PATH)) {
      emergencyBackupPath = `${DB_PATH}.bak-${Date.now()}`;
      fs.copyFileSync(DB_PATH, emergencyBackupPath);
      console.log(`[BACKUP] Copia de seguridad de emergencia guardada en: ${emergencyBackupPath}`);
    }

    fs.writeFileSync(DB_PATH, newDbBuffer);

    // Limpiar archivos WAL y SHM anteriores para consistencia
    const walFile = `${DB_PATH}-wal`;
    const shmFile = `${DB_PATH}-shm`;
    if (fs.existsSync(walFile)) fs.unlinkSync(walFile);
    if (fs.existsSync(shmFile)) fs.unlinkSync(shmFile);
  } finally {
    db.open();
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
  }

  return { emergencyBackupPath };
}
