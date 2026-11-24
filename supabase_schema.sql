-- ==============================================================================
-- GESTIÓN GANADERA MARISMA DE HINOJOS - ESQUEMA SUPABASE POSTGRESQL
-- ==============================================================================

-- 1. TABLA: campaigns (Campañas ganaderas)
CREATE TABLE IF NOT EXISTS campaigns (
  nombre TEXT PRIMARY KEY,
  activa INTEGER DEFAULT 0,
  creado_en TEXT
);

-- 2. TABLA: associations (Asociaciones ganaderas)
CREATE TABLE IF NOT EXISTS associations (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  cif TEXT NOT NULL,
  creado_en TEXT
);

-- 3. TABLA: owners (Propietarios / Ganaderos)
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

-- 4. TABLA: stallions (Sementales autorizados)
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

-- 5. TABLA: animals (Censo oficial de animales / Plazas)
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

-- 6. TABLA: movements (Libro oficial de movimientos)
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

-- 7. TABLA: users (Usuarios del sistema municipal)
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

-- 8. TABLA: settings (Configuraciones del sistema)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- 9. TABLA: audit_logs (Trazabilidad y auditoría municipal)
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

-- 10. TABLA: entradas_remesas (Comunicaciones oficiales a Doñana)
CREATE TABLE IF NOT EXISTS entradas_remesas (
  id TEXT PRIMARY KEY,
  campana TEXT NOT NULL DEFAULT '2025-2026',
  tipo_remesa TEXT NOT NULL DEFAULT 'ORDINARIA',
  titulo_oficial TEXT NOT NULL,
  fechas_json TEXT NOT NULL,
  dias_texto TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'BORRADOR',
  archivo_ods_nombre TEXT,
  archivo_ods_url TEXT,
  fecha_envio_email TEXT,
  destinatarios_email TEXT,
  observaciones_generales TEXT,
  creado_por_usuario_id TEXT,
  creado_por_nombre TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

-- 11. TABLA: entradas_personas (Personas autorizadas por día)
CREATE TABLE IF NOT EXISTS entradas_personas (
  id TEXT PRIMARY KEY,
  remesa_id TEXT NOT NULL REFERENCES entradas_remesas(id) ON DELETE CASCADE,
  dia_semana TEXT NOT NULL,
  fecha TEXT NOT NULL,
  es_titular INTEGER NOT NULL DEFAULT 1,
  titular_id TEXT,
  nombre_apellidos TEXT NOT NULL,
  owner_id TEXT,
  faena TEXT NOT NULL,
  finca TEXT NOT NULL DEFAULT 'MARISMA DE HINOJOS',
  matriculas TEXT,
  telefono TEXT,
  observaciones_raw TEXT,
  orden_fila INTEGER NOT NULL DEFAULT 0
);

-- 12. TABLA: entradas_animales (Equinos autorizados para soltar/recoger)
CREATE TABLE IF NOT EXISTS entradas_animales (
  id TEXT PRIMARY KEY,
  remesa_id TEXT NOT NULL REFERENCES entradas_remesas(id) ON DELETE CASCADE,
  persona_entrada_id TEXT NOT NULL REFERENCES entradas_personas(id) ON DELETE CASCADE,
  animal_id TEXT,
  es_manual INTEGER NOT NULL DEFAULT 0,
  plaza_numero TEXT NOT NULL,
  identificacion_chip TEXT NOT NULL,
  nombre_animal TEXT,
  propietario_nombre TEXT,
  faena TEXT NOT NULL,
  guia_documento_id TEXT,
  guia_archivo_url TEXT,
  guia_archivo_nombre TEXT,
  creado_en TEXT NOT NULL
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_animals_campana ON animals(campana);
CREATE INDEX IF NOT EXISTS idx_animals_propietario ON animals(propietario);
CREATE INDEX IF NOT EXISTS idx_movements_animal_id ON movements(animal_id);
CREATE INDEX IF NOT EXISTS idx_movements_campana ON movements(campana);
CREATE INDEX IF NOT EXISTS idx_owners_campana ON owners(campana);
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_logs(fecha);
CREATE INDEX IF NOT EXISTS idx_entradas_remesas_campana ON entradas_remesas(campana);
CREATE INDEX IF NOT EXISTS idx_entradas_personas_remesa ON entradas_personas(remesa_id);
CREATE INDEX IF NOT EXISTS idx_entradas_animales_animal ON entradas_animales(animal_id);
CREATE INDEX IF NOT EXISTS idx_entradas_animales_remesa ON entradas_animales(remesa_id);

-- Inmutabilidad estricta de la auditoría (Ley de trazabilidad)
CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Los registros de auditoria son inmutables';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_immutable();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION audit_logs_immutable();

-- Habilitar RLS en todas las tablas para proteger contra accesos no autorizados/anónimos vía API pública
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE stallions ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas_remesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas_animales ENABLE ROW LEVEL SECURITY;
