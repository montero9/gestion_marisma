export type AnimalType = 'EQUINO' | 'BOVINO';

export type Sex = 'H' | 'M';

export type PresenceStatus = 'DENTRO' | 'FUERA' | 'PROGRAMADO_ENTRADA' | 'PLAZA_VACANTE';

export interface Rastra {
  id: string;
  propietarioRastra: string;
  rastrasChip: string; // Microchip / Identificación
  ueln: string;
  nombre: string;
  sexo: Sex;
  fechaNacimiento: string; // DD/MM/AA
  capa: string;
  fechaEntrada?: string;
  fechaSalida?: string;
  observaciones?: string;
}

export interface AnimalDocument {
  id: string;
  nombre: string;
  tipo: 'PASAPORTE_DIE' | 'TARJETA_MOVIMIENTO' | 'GUIA_SANITARIA' | 'CERTIFICADO_SANEAMIENTO' | 'FOTO_HIERRO' | 'OTRO';
  fechaSubida: string;
  tamano: string;
  url?: string;
  fileData?: string; // Base64 data for uploaded files
}

export type AnnotationCategory = 'REVISION' | 'VETERINARIA' | 'GUARDERIA' | 'DOCUMENTAL' | 'INCIDENCIA' | 'OTROS';

export interface Annotation {
  id: string;
  fecha: string;
  autor: string;
  categoria: AnnotationCategory;
  texto: string;
}

export interface Association {
  id: string;
  nombre: string;
  cif: string;
  creadoEn?: string;
}

export interface Movement {
  id: string;
  animalId: string;
  campana?: string; // Campaña municipal en la que se registra el movimiento (e.g. "2025-2026", "250")
  identificacion1?: string; // Microchip o Crotal para trazabilidad completa entre campañas
  tipoAnimal: AnimalType;
  plazaNumero: string;
  nombreAnimal: string;
  propietario: string;
  tipoMovimiento: 'ENTRADA' | 'SALIDA';
  fecha: string; // YYYY-MM-DD or DD/MM/YYYY
  motivo: 'ADJUDICACION' | 'SANEAMIENTO' | 'VENTA' | 'PARIDERA' | 'RETIRADA_TEMPORAL' | 'TRASLADO_CUADRA' | 'FALLECIMIENTO' | 'OTRO';
  numeroGuia?: string;
  guardaResponsable: string;
  observaciones?: string;
  liberarPlaza?: boolean;
}

export interface Animal {
  id: string;
  tipo: AnimalType; // 'EQUINO' or 'BOVINO'
  campana: string; // e.g. "2025-2026", "2026-2027"
  plazaNumero: string; // e.g. "HI001"
  propietario: string;
  finca: string; // Default: "HINOJOS"
  identificacion1: string; // Microchip / Crotal (e.g. "724019010080788")
  identificacion2: string; // UELN / Pasaporte (e.g. "724901000121842")
  nombreAnimal: string;
  sexo: Sex;
  fechaNacimiento: string; // DD/MM/YY
  capa: string; // Castaña, Torda, Alazana, Bayo, etc.
  fechaUltimaRevision?: string; // Date or text like "ENTRA 26/04/26" or "02/05/2026"
  estadoPresencia: PresenceStatus;
  fechaEntradaMarisma?: string;
  fechaSalidaMarisma?: string;
  esSemental?: boolean;
  esPlazaVacante?: boolean;
  animalAnteriorId?: string;
  rastra?: Rastra | null;
  documentos: AnimalDocument[];
  anotaciones: Annotation[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface Owner {
  id: string;
  campana?: string; // e.g. "2025-2026", "2026-2027"
  nombreCompleto: string;
  dniCif: string;
  telefono: string;
  email: string;
  direccion: string;
  municipio: string;
  codigoRega?: string; // Código de Explotación Ganadera
  asociacion?: string; // e.g. "Asociación Nacional de Criadores de Ganado Marismeño"
  notas?: string;
}

export interface Stallion {
  id: string;
  tipo: AnimalType;
  campana: string;
  nombre: string;
  identificacionChip: string;
  ueln: string;
  propietario: string;
  fechaNacimiento: string;
  capa: string;
  estadoAprobacion: 'AUTORIZADO' | 'PENDIENTE_VALORACION' | 'NO_AUTORIZADO';
  numeroYeguasCubiertas?: number;
  zonaMarisma?: string;
  observaciones?: string;
}

export type UserRole = 'ADMINISTRADOR' | 'CONSULTA';

export interface User {
  id: string;
  username: string;
  nombreCompleto: string;
  rol: UserRole;
  cargo: string;
  email: string;
  avatarInitials: string;
  activo: boolean;
  campanaActiva?: string;
}

export type AuditAction =
  | 'ALTA'
  | 'MODIFICACION'
  | 'BAJA'
  | 'PERMUTA'
  | 'MOVIMIENTO'
  | 'NUEVA_CAMPANA'
  | 'RENOMBRAR_CAMPANA'
  | 'ELIMINAR_CAMPANA'
  | 'CREAR_EDITAR_GANADERO'
  | 'ELIMINAR_GANADERO'
  | 'INICIO_SESION'
  | 'CIERRE_SESION'
  | 'CREAR_EDITAR_USUARIO'
  | 'ELIMINAR_USUARIO'
  | 'DESCARGA_COPIA_SEGURIDAD'
  | 'RESTAURAR_COPIA_SEGURIDAD'
  | 'OTRO';

export type AuditEntity =
  | 'ANIMAL'
  | 'MOVIMIENTO'
  | 'PLAZAS'
  | 'CAMPANA'
  | 'GANADERO'
  | 'ASOCIACION'
  | 'SEMENTAL'
  | 'USUARIO'
  | 'SISTEMA';

export interface AuditLog {
  id: string;
  fecha: string;
  usuarioId?: string;
  usuarioNombre: string;
  usuarioRol: UserRole;
  accion: AuditAction | string;
  entidad: AuditEntity | string;
  entidadId?: string;
  detallesJson?: string;
  ip?: string;
}
