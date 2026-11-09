import { supabase, DOCUMENTS_BUCKET } from './supabaseClient.js';
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
  mapAnimalRow,
  mapOwnerRow,
  mapStallionRow,
  mapMovementRow,
  mapUserRow,
  mapAuditLogRow,
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
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
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
};
