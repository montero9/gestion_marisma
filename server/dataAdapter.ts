import fs from 'node:fs';
import path from 'node:path';
import { supabase, DOCUMENTS_BUCKET } from './supabaseClient.js';
import {
  Animal,
  Owner,
  Stallion,
  Movement,
  User,
  Association,
  AuditLog,
  EntradaRemesa,
  EstadoRemesa,
  EntradaPersona,
  EntradaAnimal,
} from '../src/types/marisma.js';
import {
  mapAnimalRow,
  mapOwnerRow,
  mapStallionRow,
  mapMovementRow,
  mapUserRow,
  mapAuditLogRow,
  mapEntradaRemesaRow,
  mapEntradaPersonaRow,
  mapEntradaAnimalRow,
} from './mappers.js';

export const dataAdapter = {
  // 1. USUARIOS
  async getUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('nombre_completo', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapUserRow);
  },

  async getUserById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async getUserByUsername(username: string): Promise<any | null> {
    const clean = username.trim().toLowerCase();
    const targetUsernames = clean === 'admin' ? ['admin', 'antonio'] : [clean];
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .in('username', targetUsernames)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async saveUser(user: {
    id: string;
    username: string;
    nombreCompleto: string;
    rol: string;
    cargo?: string;
    email?: string;
    avatarInitials?: string;
    activo: number | boolean;
    passwordHash?: string;
    campanaActiva?: string;
  }) {
    const row: any = {
      id: user.id,
      username: user.username,
      nombre_completo: user.nombreCompleto,
      rol: user.rol,
      cargo: user.cargo || '',
      email: user.email || '',
      avatar_initials: user.avatarInitials || '',
      activo: user.activo ? 1 : 0,
      campana_activa: user.campanaActiva || '2025-2026',
    };
    if (user.passwordHash) {
      row.password_hash = user.passwordHash;
    }
    const { data, error } = await supabase.from('users').upsert(row).select().single();
    if (error) throw error;
    return mapUserRow(data);
  },

  async deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 2. CONFIGURACIÓN Y CAMPAÑAS
  async getSettings(): Promise<Record<string, string>> {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    const res: Record<string, string> = {};
    (data || []).forEach((row: any) => {
      res[row.key] = row.value;
    });
    return res;
  },

  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  },

  async setSetting(key: string, value: string) {
    const { error } = await supabase.from('settings').upsert({ key, value });
    if (error) throw error;
  },

  async getCampaigns(): Promise<string[]> {
    const { data, error } = await supabase
      .from('campaigns')
      .select('nombre')
      .order('creado_en', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => r.nombre);
  },

  async saveCampaign(nombre: string, activa = 0) {
    const { error } = await supabase.from('campaigns').upsert({
      nombre,
      activa,
      creado_en: new Date().toISOString(),
    });
    if (error) throw error;
  },

  async createCampaignWithMigration(params: {
    nombre: string;
    cloneFromCampaign?: string;
    selectedOwners?: Owner[];
    selectedAnimals?: any[];
    setActiveImmediately?: boolean;
  }) {
    const { nombre, cloneFromCampaign, selectedOwners, selectedAnimals, setActiveImmediately } = params;

    // 1. Guardar la campaña en la tabla campaigns
    await this.saveCampaign(nombre, setActiveImmediately !== false ? 1 : 0);

    // 2. Traspasar propietarios / ganaderos
    let ownersToInsert: any[] = [];
    if (Array.isArray(selectedOwners) && selectedOwners.length > 0) {
      ownersToInsert = selectedOwners.map((ow) => ({
        id: `own-${Date.now()}-${Math.round(Math.random() * 1000000)}`,
        campana: nombre,
        nombre_completo: ow.nombreCompleto,
        dni_cif: ow.dniCif,
        telefono: ow.telefono || '',
        email: ow.email || '',
        direccion: ow.direccion || '',
        municipio: ow.municipio || 'Hinojos',
        codigo_rega: ow.codigoRega || '',
        asociacion: ow.asociacion || '',
        notas: ow.notas || '',
      }));
    } else if (cloneFromCampaign) {
      const sourceOwners = await this.getOwners(cloneFromCampaign);
      ownersToInsert = sourceOwners.map((ow) => ({
        id: `own-${Date.now()}-${Math.round(Math.random() * 1000000)}`,
        campana: nombre,
        nombre_completo: ow.nombreCompleto,
        dni_cif: ow.dniCif,
        telefono: ow.telefono || '',
        email: ow.email || '',
        direccion: ow.direccion || '',
        municipio: ow.municipio || 'Hinojos',
        codigo_rega: ow.codigoRega || '',
        asociacion: ow.asociacion || '',
        notas: ow.notas || '',
      }));
    }

    if (ownersToInsert.length > 0) {
      for (let i = 0; i < ownersToInsert.length; i += 50) {
        const batch = ownersToInsert.slice(i, i + 50);
        const { error } = await supabase.from('owners').insert(batch);
        if (error) throw error;
      }
    }

    // 3. Traspasar animales
    let animalsToProcess: any[] = [];
    if (Array.isArray(selectedAnimals) && selectedAnimals.length > 0) {
      animalsToProcess = selectedAnimals;
    } else if (cloneFromCampaign) {
      animalsToProcess = await this.getAnimals(cloneFromCampaign);
    }

    const animalsToInsert: any[] = [];
    const stallionsToInsert: any[] = [];

    if (animalsToProcess.length > 0) {
      // Ordenación según criterios oficiales municipales:
      // 1º Agrupados por especie (EQUINO antes que BOVINO)
      // 2º Alfabéticamente por el nombre del ganadero titular
      // 3º Por número de plaza / nombre
      const sortedAnimals = [...animalsToProcess].sort((a, b) => {
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

      for (const an of sortedAnimals) {
        const newId = `anm-${Date.now()}-${Math.round(Math.random() * 10000000)}`;
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

        animalsToInsert.push({
          id: newId,
          tipo: an.tipo,
          campana: nombre,
          plaza_numero: targetPlaza,
          propietario: an.propietario,
          finca: an.finca || 'HINOJOS',
          identificacion1: an.identificacion1 || '',
          identificacion2: an.identificacion2 || '',
          nombre_animal: an.tipo === 'BOVINO' ? '' : (an.nombreAnimal || ''),
          sexo: an.sexo || 'H',
          fecha_nacimiento: an.fechaNacimiento || '',
          capa: an.capa || 'TORDO',
          fecha_ultima_revision: null,
          estado_presencia: an.estadoPresencia || 'DENTRO',
          fecha_entrada_marisma: an.fechaEntradaMarisma || null,
          fecha_salida_marisma: null,
          es_semental: an.esSemental ? 1 : 0,
          es_plaza_vacante: an.esPlazaVacante ? 1 : 0,
          animal_anterior_id: an.sourceAnimalId || an.id || null,
          rastra_json: rastraVal,
          documentos_json: docsVal,
          anotaciones_json: JSON.stringify([]),
          creado_en: new Date().toISOString(),
          actualizado_en: new Date().toISOString(),
        });

        if (an.esSemental) {
          stallionsToInsert.push({
            id: `stl-${Date.now()}-${Math.round(Math.random() * 1000000)}`,
            campana: nombre,
            tipo: an.tipo,
            nombre: an.nombreAnimal || 'SEMENTAL',
            plaza_numero: targetPlaza,
            identificacion_chip: an.identificacion1 || '',
            ueln: an.identificacion2 || '',
            propietario: an.propietario,
            fecha_nacimiento: an.fechaNacimiento || '',
            capa: an.capa || '',
            estado_aprobacion: 'AUTORIZADO',
            numero_yeguas_cubiertas: 0,
            zona_marisma: '',
            observaciones: 'RENOVACIÓN CAMPAÑA',
          });
        }
      }

      if (animalsToInsert.length > 0) {
        for (let i = 0; i < animalsToInsert.length; i += 50) {
          const batch = animalsToInsert.slice(i, i + 50);
          const { error } = await supabase.from('animals').insert(batch);
          if (error) throw error;
        }
      }

      if (stallionsToInsert.length > 0) {
        for (let i = 0; i < stallionsToInsert.length; i += 50) {
          const batch = stallionsToInsert.slice(i, i + 50);
          const { error } = await supabase.from('stallions').insert(batch);
          if (error) throw error;
        }
      }
    }

    // 4. Activar inmediatamente si procede
    if (setActiveImmediately !== false) {
      await this.setSetting('active_campaign', nombre);
    }

    return {
      success: true,
      activeCampaign: nombre,
      ownersCount: ownersToInsert.length,
      animalsCount: animalsToInsert.length,
    };
  },

  async deleteCampaign(nombre: string) {
    const { error } = await supabase.from('campaigns').delete().eq('nombre', nombre);
    if (error) throw error;
  },

  // 3. BOOTSTRAP UNIFICADO
  async getBootstrap(isAdmin: boolean) {
    const [animalsRes, ownersRes, asocsRes, stallionsRes, movsRes, campaignsRes, activeCampSetting, usersRes] =
      await Promise.all([
        supabase.from('animals').select('*').order('plaza_numero', { ascending: true }),
        supabase.from('owners').select('*').order('nombre_completo', { ascending: true }),
        supabase.from('associations').select('*').order('nombre', { ascending: true }),
        supabase.from('stallions').select('*').order('nombre', { ascending: true }),
        supabase.from('movements').select('*').order('fecha', { ascending: false }),
        supabase.from('campaigns').select('nombre').order('creado_en', { ascending: false }),
        supabase.from('settings').select('value').eq('key', 'active_campaign').maybeSingle(),
        isAdmin
          ? supabase.from('users').select('*').order('nombre_completo', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

    if (animalsRes.error) throw animalsRes.error;
    if (ownersRes.error) throw ownersRes.error;
    if (asocsRes.error) throw asocsRes.error;
    if (stallionsRes.error) throw stallionsRes.error;
    if (movsRes.error) throw movsRes.error;
    if (campaignsRes.error) throw campaignsRes.error;

    const campaigns = (campaignsRes.data || []).map((r: any) => r.nombre);
    let activeCampaign = activeCampSetting?.data?.value || '';
    if (!activeCampaign || !campaigns.includes(activeCampaign)) {
      activeCampaign = campaigns[0] || '2025-2026';
      await this.setSetting('active_campaign', activeCampaign);
    }

    return {
      animals: (animalsRes.data || []).map(mapAnimalRow),
      owners: (ownersRes.data || []).map(mapOwnerRow),
      associations: (asocsRes.data || []).map((r: any) => ({
        id: r.id,
        nombre: r.nombre,
        cif: r.cif,
        creadoEn: r.creado_en,
      })),
      stallions: (stallionsRes.data || []).map(mapStallionRow),
      movements: (movsRes.data || []).map(mapMovementRow),
      campaigns,
      activeCampaign,
      users: (usersRes.data || []).map(mapUserRow),
    };
  },

  // 4. ANIMALES
  async getAnimals(campana?: string, tipo?: string): Promise<Animal[]> {
    let query = supabase.from('animals').select('*').order('plaza_numero', { ascending: true });
    if (campana) query = query.eq('campana', campana);
    if (tipo) query = query.eq('tipo', tipo);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapAnimalRow);
  },

  async getAnimalById(id: string): Promise<Animal | null> {
    const { data, error } = await supabase.from('animals').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapAnimalRow(data) : null;
  },

  async saveAnimal(animal: Animal): Promise<Animal> {
    const row = {
      id: animal.id,
      tipo: animal.tipo,
      campana: animal.campana,
      plaza_numero: animal.plazaNumero,
      propietario: animal.propietario,
      finca: animal.finca || 'HINOJOS',
      identificacion1: animal.identificacion1 || '',
      identificacion2: animal.identificacion2 || '',
      nombre_animal: animal.tipo === 'BOVINO' ? '' : animal.nombreAnimal || '',
      sexo: animal.sexo,
      fecha_nacimiento: animal.fechaNacimiento || '',
      capa: animal.capa,
      fecha_ultima_revision: animal.fechaUltimaRevision || null,
      estado_presencia: animal.estadoPresencia,
      fecha_entrada_marisma: animal.fechaEntradaMarisma || null,
      fecha_salida_marisma: animal.fechaSalidaMarisma || null,
      es_semental: animal.esSemental ? 1 : 0,
      es_plaza_vacante: animal.esPlazaVacante ? 1 : 0,
      animal_anterior_id: animal.animalAnteriorId || null,
      rastra_json: animal.rastra ? JSON.stringify(animal.rastra) : null,
      documentos_json: JSON.stringify(animal.documentos || []),
      anotaciones_json: JSON.stringify(animal.anotaciones || []),
      creado_en: animal.creadoEn || new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('animals').upsert(row).select().single();
    if (error) throw error;
    return mapAnimalRow(data);
  },

  async deleteAnimal(id: string) {
    try {
      // 1. Obtener los datos del animal para localizar todos sus documentos
      const animal = await this.getAnimalById(id);
      const filesToDelete = new Set<string>();

      if (animal && Array.isArray(animal.documentos)) {
        for (const doc of animal.documentos) {
          if (doc?.url) {
            const clean = doc.url.replace('/uploads/documents/', '').trim();
            if (clean) filesToDelete.add(clean);
          }
        }
      }

      // 2. Localizar por prefijo `${id}_` cualquier archivo en Supabase Storage
      try {
        const { data: matchedFiles } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .list('', { search: id });
        if (Array.isArray(matchedFiles)) {
          for (const f of matchedFiles) {
            if (f.name && f.name.startsWith(`${id}_`)) {
              filesToDelete.add(f.name);
            }
          }
        }
      } catch (err: any) {
        console.warn('Error listando archivos asociados al animal:', err.message);
      }

      // 3. Eliminar los archivos físicos de Supabase Storage
      if (filesToDelete.size > 0) {
        await this.deleteDocuments(Array.from(filesToDelete));
      }

      // 4. Si existen en almacenamiento local (modo offline/desarrollo), eliminarlos también
      const localDocsDir = path.resolve(process.cwd(), 'uploads', 'documents');
      for (const filename of filesToDelete) {
        const localPath = path.join(localDocsDir, filename);
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch {}
        }
      }
    } catch (cleanErr: any) {
      console.warn(`Error limpiando archivos del animal ${id}:`, cleanErr.message);
    }

    // 5. Eliminar el registro del animal en la base de datos PostgreSQL
    const { error } = await supabase.from('animals').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 5. PROPIETARIOS / GANADEROS
  async getOwners(campana?: string): Promise<Owner[]> {
    let query = supabase.from('owners').select('*').order('nombre_completo', { ascending: true });
    if (campana) query = query.eq('campana', campana);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapOwnerRow);
  },

  async saveOwner(owner: Owner): Promise<Owner> {
    const row = {
      id: owner.id,
      campana: owner.campana || '2025-2026',
      nombre_completo: owner.nombreCompleto,
      dni_cif: owner.dniCif,
      telefono: owner.telefono || '',
      email: owner.email || '',
      direccion: owner.direccion || '',
      municipio: owner.municipio || 'Hinojos',
      codigo_rega: owner.codigoRega || '',
      asociacion: owner.asociacion || '',
      notas: owner.notas || '',
    };
    const { data, error } = await supabase.from('owners').upsert(row).select().single();
    if (error) throw error;
    return mapOwnerRow(data);
  },

  async deleteOwner(id: string) {
    const { error } = await supabase.from('owners').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 6. ASOCIACIONES
  async getAssociations(): Promise<Association[]> {
    const { data, error } = await supabase.from('associations').select('*').order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      nombre: r.nombre,
      cif: r.cif,
      creadoEn: r.creado_en,
    }));
  },

  async saveAssociation(asoc: Association): Promise<Association> {
    const row = {
      id: asoc.id,
      nombre: asoc.nombre,
      cif: asoc.cif,
      creado_en: asoc.creadoEn || new Date().toISOString(),
    };
    const { data, error } = await supabase.from('associations').upsert(row).select().single();
    if (error) throw error;
    return {
      id: data.id,
      nombre: data.nombre,
      cif: data.cif,
      creadoEn: data.creado_en,
    };
  },

  async deleteAssociation(id: string) {
    const { error } = await supabase.from('associations').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 7. SEMENTALES
  async getStallions(campana?: string): Promise<Stallion[]> {
    let query = supabase.from('stallions').select('*').order('nombre', { ascending: true });
    if (campana) query = query.eq('campana', campana);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapStallionRow);
  },

  async saveStallion(stallion: Stallion): Promise<Stallion> {
    const row = {
      id: stallion.id,
      tipo: stallion.tipo,
      campana: stallion.campana,
      nombre: stallion.nombre,
      identificacion_chip: stallion.identificacionChip || '',
      ueln: stallion.ueln || '',
      propietario: stallion.propietario,
      fecha_nacimiento: stallion.fechaNacimiento || '',
      capa: stallion.capa,
      estado_aprobacion: stallion.estadoAprobacion || 'AUTORIZADO',
      numero_yeguas_cubiertas: stallion.numeroYeguasCubiertas || 0,
      zona_marisma: stallion.zonaMarisma || '',
      observaciones: stallion.observaciones || '',
    };
    const { data, error } = await supabase.from('stallions').upsert(row).select().single();
    if (error) throw error;
    return mapStallionRow(data);
  },

  async deleteStallion(id: string) {
    const { error } = await supabase.from('stallions').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  // 8. MOVIMIENTOS
  async getMovements(campana?: string): Promise<Movement[]> {
    let query = supabase.from('movements').select('*').order('fecha', { ascending: false });
    if (campana) query = query.eq('campana', campana);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapMovementRow);
  },

  async saveMovement(movement: Movement): Promise<Movement> {
    const row = {
      id: movement.id,
      animal_id: movement.animalId,
      campana: movement.campana || '',
      identificacion1: movement.identificacion1 || '',
      tipo_animal: movement.tipoAnimal,
      plaza_numero: movement.plazaNumero,
      nombre_animal: movement.tipoAnimal === 'BOVINO' ? '' : movement.nombreAnimal || '',
      propietario: movement.propietario,
      tipo_movimiento: movement.tipoMovimiento,
      fecha: movement.fecha,
      motivo: movement.motivo,
      numero_guia: movement.numeroGuia || '',
      guarda_responsable: movement.guardaResponsable || '',
      observaciones: movement.observaciones || '',
      liberar_plaza: movement.liberarPlaza ? 1 : 0,
    };
    const { data, error } = await supabase.from('movements').upsert(row).select().single();
    if (error) throw error;
    return mapMovementRow(data);
  },

  // 9. AUDITORÍA
  async getAuditLogs(limit = 500): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(mapAuditLogRow);
  },

  async recordAudit(entry: {
    usuarioId?: string;
    usuarioNombre?: string;
    usuarioRol?: string;
    accion: string;
    entidad: string;
    entidadId?: string;
    detalles?: any;
    ip?: string;
  }) {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fecha = new Date().toISOString();
    const detallesJson =
      typeof entry.detalles === 'string'
        ? entry.detalles
        : entry.detalles
        ? JSON.stringify(entry.detalles)
        : null;

    const row = {
      id,
      fecha,
      usuario_id: entry.usuarioId || null,
      usuario_nombre: entry.usuarioNombre || 'Sistema',
      usuario_rol: entry.usuarioRol || 'ADMINISTRADOR',
      accion: entry.accion,
      entidad: entry.entidad,
      entidad_id: entry.entidadId || null,
      detalles_json: detallesJson,
      ip: entry.ip || null,
    };

    const { error } = await supabase.from('audit_logs').insert(row);
    if (error) {
      console.warn('Error registrando auditoría en Supabase:', error.message);
    }
  },

  // 10. ALMACENAMIENTO DE DOCUMENTOS (SUPABASE STORAGE)
  async uploadDocument(filename: string, buffer: Buffer, mimeType: string) {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filename, buffer, {
        contentType: mimeType,
        upsert: true,
      });
    if (error) throw error;
    return data;
  },

  async downloadDocument(filename: string): Promise<{ data: Blob | null; error: any }> {
    return await supabase.storage.from(DOCUMENTS_BUCKET).download(filename);
  },

  async deleteDocument(filename: string) {
    return await supabase.storage.from(DOCUMENTS_BUCKET).remove([filename]);
  },

  async deleteDocuments(filenames: string[]) {
    if (!filenames || filenames.length === 0) return;
    return await supabase.storage.from(DOCUMENTS_BUCKET).remove(filenames);
  },

  // 11. MÓDULO ENTRADAS (COMUNICACIONES MARISMA DE HINOJOS - DOÑANA)
  async getEntradasRemesas(campana?: string): Promise<EntradaRemesa[]> {
    let query = supabase.from('entradas_remesas').select('*').order('creado_en', { ascending: false });
    if (campana) {
      query = query.eq('campana', campana);
    }
    const { data: remesasData, error: remError } = await query;
    if (remError) throw remError;
    if (!remesasData || remesasData.length === 0) return [];

    const remesaIds = remesasData.map((r: any) => r.id);

    // Obtener personas asociadas
    const { data: personasData, error: perError } = await supabase
      .from('entradas_personas')
      .select('*')
      .in('remesa_id', remesaIds)
      .order('orden_fila', { ascending: true });
    if (perError) throw perError;

    // Obtener animales asociados
    const { data: animalesData, error: aniError } = await supabase
      .from('entradas_animales')
      .select('*')
      .in('remesa_id', remesaIds);
    if (aniError) throw aniError;

    const mappedAnimales = (animalesData || []).map(mapEntradaAnimalRow);
    const mappedPersonas = (personasData || []).map((p: any) => {
      const pAnimals = mappedAnimales.filter((a) => a.personaEntradaId === p.id);
      return mapEntradaPersonaRow(p, pAnimals);
    });

    return remesasData.map((r: any) => {
      const rPersonas = mappedPersonas.filter((p) => p.remesaId === r.id);
      return mapEntradaRemesaRow(r, rPersonas);
    });
  },

  async getEntradaRemesaById(id: string): Promise<EntradaRemesa | null> {
    const { data: remesaData, error: remError } = await supabase
      .from('entradas_remesas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (remError) throw remError;
    if (!remesaData) return null;

    const { data: personasData, error: perError } = await supabase
      .from('entradas_personas')
      .select('*')
      .eq('remesa_id', id)
      .order('orden_fila', { ascending: true });
    if (perError) throw perError;

    const { data: animalesData, error: aniError } = await supabase
      .from('entradas_animales')
      .select('*')
      .eq('remesa_id', id);
    if (aniError) throw aniError;

    const mappedAnimales = (animalesData || []).map(mapEntradaAnimalRow);
    const mappedPersonas = (personasData || []).map((p: any) => {
      const pAnimals = mappedAnimales.filter((a) => a.personaEntradaId === p.id);
      return mapEntradaPersonaRow(p, pAnimals);
    });

    return mapEntradaRemesaRow(remesaData, mappedPersonas);
  },

  async saveEntradaRemesa(remesa: EntradaRemesa): Promise<EntradaRemesa> {
    const remesaRow = {
      id: remesa.id,
      campana: remesa.campana || '2025-2026',
      tipo_remesa: remesa.tipoRemesa || 'ORDINARIA',
      titulo_oficial: remesa.tituloOficial,
      fechas_json: JSON.stringify(remesa.fechas || []),
      dias_texto: remesa.diasTexto || '',
      estado: remesa.estado || 'BORRADOR',
      archivo_ods_nombre: remesa.archivoOdsNombre || null,
      archivo_ods_url: remesa.archivoOdsUrl || null,
      fecha_envio_email: remesa.fechaEnvioEmail || null,
      destinatarios_email: remesa.destinatariosEmail || null,
      observaciones_generales: remesa.observacionesGenerales || null,
      creado_por_usuario_id: remesa.creadoPorUsuarioId || null,
      creado_por_nombre: remesa.creadoPorNombre || null,
      creado_en: remesa.creadoEn || new Date().toISOString(),
      actualizado_en: new Date().toISOString(),
    };

    const { error: remError } = await supabase
      .from('entradas_remesas')
      .upsert(remesaRow, { onConflict: 'id' });
    if (remError) throw remError;

    // Eliminar personas y animales anteriores para reemplazar por la versión limpia actualizada
    await supabase.from('entradas_animales').delete().eq('remesa_id', remesa.id);
    await supabase.from('entradas_personas').delete().eq('remesa_id', remesa.id);

    if (remesa.personas && remesa.personas.length > 0) {
      const personasRows = remesa.personas.map((p, idx) => ({
        id: p.id,
        remesa_id: remesa.id,
        dia_semana: p.diaSemana,
        fecha: p.fecha,
        es_titular: p.esTitular ? 1 : 0,
        titular_id: p.titularId || null,
        nombre_apellidos: p.nombreApellidos,
        owner_id: p.ownerId || null,
        faena: p.faena,
        finca: p.finca || 'MARISMA DE HINOJOS',
        matriculas: p.matriculas || null,
        telefono: p.telefono || null,
        observaciones_raw: p.observacionesRaw || null,
        orden_fila: idx,
      }));

      const { error: perError } = await supabase.from('entradas_personas').insert(personasRows);
      if (perError) throw perError;

      // Extraer e insertar todos los animales de las personas
      const allAnimalesRows: any[] = [];
      for (const p of remesa.personas) {
        if (p.animales && p.animales.length > 0) {
          for (const a of p.animales) {
            allAnimalesRows.push({
              id: a.id,
              remesa_id: remesa.id,
              persona_entrada_id: p.id,
              animal_id: a.animalId || null,
              es_manual: a.esManual ? 1 : 0,
              plaza_numero: a.plazaNumero,
              identificacion_chip: a.identificacionChip,
              nombre_animal: a.nombreAnimal || null,
              propietario_nombre: a.propietarioNombre || null,
              faena: a.faena,
              guia_documento_id: a.guiaDocumentoId || null,
              guia_archivo_url: a.guiaArchivoUrl || null,
              guia_archivo_nombre: a.guiaArchivoNombre || null,
              creado_en: a.creadoEn || new Date().toISOString(),
            });
          }
        }
      }

      if (allAnimalesRows.length > 0) {
        const { error: aniError } = await supabase.from('entradas_animales').insert(allAnimalesRows);
        if (aniError) throw aniError;
      }
    }

    return (await this.getEntradaRemesaById(remesa.id)) || remesa;
  },

  async updateEntradaRemesaEstado(
    id: string,
    updates: {
      estado: EstadoRemesa;
      fechaEnvioEmail?: string | null;
      destinatariosEmail?: string | null;
      archivoOdsNombre?: string | null;
      archivoOdsUrl?: string | null;
    }
  ): Promise<void> {
    const rowUpdates: Record<string, any> = {
      estado: updates.estado,
      actualizado_en: new Date().toISOString(),
    };
    if (updates.fechaEnvioEmail !== undefined) rowUpdates.fecha_envio_email = updates.fechaEnvioEmail;
    if (updates.destinatariosEmail !== undefined) rowUpdates.destinatarios_email = updates.destinatariosEmail;
    if (updates.archivoOdsNombre !== undefined) rowUpdates.archivo_ods_nombre = updates.archivoOdsNombre;
    if (updates.archivoOdsUrl !== undefined) rowUpdates.archivo_ods_url = updates.archivoOdsUrl;

    const { error } = await supabase
      .from('entradas_remesas')
      .update(rowUpdates)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteEntradaRemesa(id: string): Promise<void> {
    try {
      // 1. Obtener animales de esta remesa que tengan guía de traslado para borrar los ficheros del hosting
      const { data: aniRows } = await supabase
        .from('entradas_animales')
        .select('id, animal_id, guia_documento_id, guia_archivo_url')
        .eq('remesa_id', id);

      if (aniRows && aniRows.length > 0) {
        const localDocsDir = path.resolve(process.cwd(), 'uploads', 'documents');
        for (const row of aniRows) {
          if (row.guia_archivo_url) {
            const parts = row.guia_archivo_url.split('/');
            const filename = parts[parts.length - 1];
            if (filename) {
              try {
                // Borrar del bucket de Supabase Storage
                await this.deleteDocument(filename);
              } catch (storageErr: any) {
                console.warn(`[deleteEntradaRemesa] Aviso al borrar archivo remoto ${filename}:`, storageErr.message);
              }

              // Borrar de almacenamiento local si existe
              try {
                const localPath = path.join(localDocsDir, filename);
                if (fs.existsSync(localPath)) {
                  fs.unlinkSync(localPath);
                }
              } catch (localErr: any) {
                console.warn(`[deleteEntradaRemesa] Aviso al borrar archivo local ${filename}:`, localErr.message);
              }
            }
          }

          // Si el animal está censado, retirar la guía de su ficha en animal.documentos
          if (row.animal_id && row.guia_documento_id) {
            try {
              const animal = await this.getAnimalById(row.animal_id);
              if (animal && animal.documentos) {
                animal.documentos = animal.documentos.filter((d: any) => d.id !== row.guia_documento_id);
                await this.saveAnimal(animal);
              }
            } catch (aniErr: any) {
              console.warn(`[deleteEntradaRemesa] Aviso al limpiar ficha animal ${row.animal_id}:`, aniErr.message);
            }
          }
        }
      }
    } catch (cleanErr: any) {
      console.warn(`[deleteEntradaRemesa] Error general en limpieza de archivos para remesa ${id}:`, cleanErr.message);
    }

    // 2. Eliminar la remesa (por cascada elimina entradas_personas y entradas_animales)
    const { error } = await supabase.from('entradas_remesas').delete().eq('id', id);
    if (error) throw error;
  },

  async getEntradasByAnimalId(animalId: string): Promise<any[]> {
    const animal = await this.getAnimalById(animalId);
    let query = supabase
      .from('entradas_animales')
      .select('*, entradas_remesas(titulo_oficial, dias_texto, estado, fecha_envio_email, fechas_json), entradas_personas(nombre_apellidos, matriculas, fecha, dia_semana)');

    if (animal && (animal.identificacion1 || animal.plazaNumero)) {
      const orClauses: string[] = [`animal_id.eq.${animal.id}`];
      if (animal.identificacion1) {
        orClauses.push(`identificacion_chip.eq.${animal.identificacion1}`);
      }
      if (animal.plazaNumero) {
        orClauses.push(`plaza_numero.eq.${animal.plazaNumero}`);
      }
      query = query.or(orClauses.join(','));
    } else {
      query = query.eq('animal_id', animalId);
    }
    const { data: aniData, error: aniError } = await query.order('creado_en', { ascending: false });
    if (aniError) throw aniError;
    return aniData || [];
  },
};
