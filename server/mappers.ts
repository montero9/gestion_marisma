import {
  Animal,
  Owner,
  Stallion,
  Movement,
  User,
  AuditLog,
  EntradaRemesa,
  EntradaPersona,
  EntradaAnimal,
} from '../src/types/marisma.js';

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
    rastra: row.rastra_json ? (typeof row.rastra_json === 'string' ? JSON.parse(row.rastra_json) : row.rastra_json) : null,
    documentos: row.documentos_json ? (typeof row.documentos_json === 'string' ? JSON.parse(row.documentos_json) : row.documentos_json) : [],
    anotaciones: row.anotaciones_json ? (typeof row.anotaciones_json === 'string' ? JSON.parse(row.anotaciones_json) : row.anotaciones_json) : [],
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

export function mapEntradaAnimalRow(row: any): EntradaAnimal {
  return {
    id: row.id,
    remesaId: row.remesa_id,
    personaEntradaId: row.persona_entrada_id,
    animalId: row.animal_id || null,
    esManual: Boolean(row.es_manual),
    plazaNumero: row.plaza_numero,
    identificacionChip: row.identificacion_chip,
    nombreAnimal: row.nombre_animal || undefined,
    propietarioNombre: row.propietario_nombre || undefined,
    faena: row.faena,
    guiaDocumentoId: row.guia_documento_id || undefined,
    guiaArchivoUrl: row.guia_archivo_url || undefined,
    guiaArchivoNombre: row.guia_archivo_nombre || undefined,
    creadoEn: row.creado_en || undefined,
  };
}

export function mapEntradaPersonaRow(row: any, animales: EntradaAnimal[] = []): EntradaPersona {
  return {
    id: row.id,
    remesaId: row.remesa_id,
    diaSemana: row.dia_semana,
    fecha: row.fecha,
    esTitular: Boolean(row.es_titular),
    titularId: row.titular_id || null,
    nombreApellidos: row.nombre_apellidos,
    ownerId: row.owner_id || null,
    faena: row.faena,
    finca: row.finca || 'MARISMA DE HINOJOS',
    matriculas: row.matriculas || '',
    telefono: row.telefono || '',
    observacionesRaw: row.observaciones_raw || '',
    ordenFila: row.orden_fila ?? 0,
    animales,
  };
}

export function mapEntradaRemesaRow(row: any, personas: EntradaPersona[] = []): EntradaRemesa {
  let fechas: string[] = [];
  try {
    fechas = row.fechas_json ? JSON.parse(row.fechas_json) : [];
  } catch {
    fechas = [];
  }

  return {
    id: row.id,
    campana: row.campana || '2025-2026',
    tipoRemesa: row.tipo_remesa || 'ORDINARIA',
    tituloOficial: row.titulo_oficial,
    fechas,
    diasTexto: row.dias_texto || '',
    estado: row.estado || 'BORRADOR',
    archivoOdsNombre: row.archivo_ods_nombre || undefined,
    archivoOdsUrl: row.archivo_ods_url || undefined,
    fechaEnvioEmail: row.fecha_envio_email || undefined,
    destinatariosEmail: row.destinatarios_email || undefined,
    observacionesGenerales: row.observaciones_generales || undefined,
    creadoPorUsuarioId: row.creado_por_usuario_id || undefined,
    creadoPorNombre: row.creado_por_nombre || undefined,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
    personas,
  };
}
