import { Animal, Owner, Stallion, Movement, User, AnimalType, Association } from '../types/marisma';
import { INITIAL_ANIMALS, INITIAL_OWNERS, INITIAL_STALLIONS, INITIAL_MOVEMENTS, INITIAL_USERS, CAMPAIGNS, INITIAL_ASSOCIATIONS } from '../data/initialData';

const KEYS = {
  ANIMALS: 'marisma_hinojos_animals_v1',
  OWNERS: 'marisma_hinojos_owners_v1',
  ASSOCIATIONS: 'marisma_hinojos_associations_v1',
  STALLIONS: 'marisma_hinojos_stallions_v1',
  MOVEMENTS: 'marisma_hinojos_movements_v1',
  USERS: 'marisma_hinojos_users_v1',
  CURRENT_USER: 'marisma_hinojos_current_user_v1',
  CAMPAIGNS: 'marisma_hinojos_campaigns_v1',
  ACTIVE_CAMPAIGN: 'marisma_hinojos_active_campaign_v1',
};

export const StorageService = {
  // Animals
  getAnimals(): Animal[] {
    const raw = localStorage.getItem(KEYS.ANIMALS);
    if (!raw) {
      this.saveAnimals(INITIAL_ANIMALS);
      return INITIAL_ANIMALS;
    }
    try {
      const parsed: Animal[] = JSON.parse(raw);
      let changed = false;
      const migrated = parsed.map((a) => {
        if (a.tipo === 'BOVINO' && a.plazaNumero && a.plazaNumero.startsWith('BV')) {
          changed = true;
          return {
            ...a,
            plazaNumero: a.plazaNumero.replace(/^BV/, 'HIN'),
          };
        }
        return a;
      });
      if (changed) {
        this.saveAnimals(migrated);
      }
      return migrated;
    } catch {
      return INITIAL_ANIMALS;
    }
  },

  saveAnimals(animals: Animal[]): void {
    localStorage.setItem(KEYS.ANIMALS, JSON.stringify(animals));
  },

  upsertAnimal(animal: Animal): void {
    const animals = this.getAnimals();
    let list = animals;
    if (!animal.esPlazaVacante && animal.plazaNumero) {
      list = animals.filter(
        (a) =>
          !(
            a.esPlazaVacante &&
            a.campana === animal.campana &&
            a.plazaNumero.trim().toUpperCase() === animal.plazaNumero.trim().toUpperCase() &&
            a.id !== animal.id
          )
      );
    }

    const index = list.findIndex((a) => a.id === animal.id);
    if (index >= 0) {
      list[index] = { ...animal, actualizadoEn: new Date().toISOString() };
    } else {
      list.push({
        ...animal,
        creadoEn: animal.creadoEn || new Date().toISOString(),
        actualizadoEn: new Date().toISOString(),
      });
    }
    this.saveAnimals(list);
  },

  deleteAnimal(id: string): void {
    const animals = this.getAnimals().filter((a) => a.id !== id);
    this.saveAnimals(animals);
  },

  swapPlazaAnimals(
    animalAId: string,
    animalBId: string,
    motivo?: string,
    autor?: string
  ): boolean {
    const animals = this.getAnimals();
    const idxA = animals.findIndex((a) => a.id === animalAId);
    const idxB = animals.findIndex((a) => a.id === animalBId);
    if (idxA === -1 || idxB === -1) return false;

    const animalA = animals[idxA];
    const animalB = animals[idxB];

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

    // Swap plazaNumero and propietario so each owner keeps their plaza
    animals[idxA] = {
      ...animalA,
      plazaNumero: plazaB,
      propietario: propB,
      actualizadoEn: new Date().toISOString(),
      anotaciones: [
        ...(animalA.anotaciones || []),
        {
          id: `ant-${Date.now()}-a`,
          fecha: dateStr,
          autor: autor || 'Guardería / Gestión Municipal',
          categoria: 'GUARDERIA',
          texto: annotationTextA,
        },
      ],
    };

    animals[idxB] = {
      ...animalB,
      plazaNumero: plazaA,
      propietario: propA,
      actualizadoEn: new Date().toISOString(),
      anotaciones: [
        ...(animalB.anotaciones || []),
        {
          id: `ant-${Date.now()}-b`,
          fecha: dateStr,
          autor: autor || 'Guardería / Gestión Municipal',
          categoria: 'GUARDERIA',
          texto: annotationTextB,
        },
      ],
    };

    this.saveAnimals(animals);
    return true;
  },

  // Owners
  getOwners(): Owner[] {
    const raw = localStorage.getItem(KEYS.OWNERS);
    if (!raw) {
      this.saveOwners(INITIAL_OWNERS);
      return INITIAL_OWNERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_OWNERS;
    }
  },

  saveOwners(owners: Owner[]): void {
    localStorage.setItem(KEYS.OWNERS, JSON.stringify(owners));
  },

  upsertOwner(owner: Owner): void {
    const owners = this.getOwners();
    const index = owners.findIndex((o) => o.id === owner.id);
    if (index >= 0) {
      owners[index] = owner;
    } else {
      owners.push(owner);
    }
    this.saveOwners(owners);
  },

  deleteOwner(id: string): void {
    const owners = this.getOwners().filter((o) => o.id !== id);
    this.saveOwners(owners);
  },

  // Associations
  getAssociations(): Association[] {
    const raw = localStorage.getItem(KEYS.ASSOCIATIONS);
    if (!raw) {
      this.saveAssociations(INITIAL_ASSOCIATIONS);
      return INITIAL_ASSOCIATIONS;
    }
    try {
      const parsed: Association[] = JSON.parse(raw);
      let changed = false;
      for (const init of INITIAL_ASSOCIATIONS) {
        if (!parsed.some((a) => a.id === init.id || a.nombre.toLowerCase() === init.nombre.toLowerCase())) {
          parsed.push(init);
          changed = true;
        }
      }
      if (changed) {
        this.saveAssociations(parsed);
      }
      return parsed;
    } catch {
      return INITIAL_ASSOCIATIONS;
    }
  },

  saveAssociations(associations: Association[]): void {
    localStorage.setItem(KEYS.ASSOCIATIONS, JSON.stringify(associations));
  },

  upsertAssociation(association: Association): void {
    const associations = this.getAssociations();
    const index = associations.findIndex((a) => a.id === association.id);
    if (index >= 0) {
      associations[index] = association;
    } else {
      associations.push(association);
    }
    this.saveAssociations(associations);
  },

  deleteAssociation(id: string): void {
    const associations = this.getAssociations().filter((a) => a.id !== id);
    this.saveAssociations(associations);
  },

  // Stallions
  getStallions(): Stallion[] {
    const raw = localStorage.getItem(KEYS.STALLIONS);
    if (!raw) {
      this.saveStallions(INITIAL_STALLIONS);
      return INITIAL_STALLIONS;
    }
    try {
      const parsed: Stallion[] = JSON.parse(raw);
      let changed = false;
      for (const init of INITIAL_STALLIONS) {
        if (!parsed.some((s) => s.id === init.id)) {
          parsed.push(init);
          changed = true;
        }
      }
      if (changed) {
        this.saveStallions(parsed);
      }
      return parsed;
    } catch {
      return INITIAL_STALLIONS;
    }
  },

  saveStallions(stallions: Stallion[]): void {
    localStorage.setItem(KEYS.STALLIONS, JSON.stringify(stallions));
  },

  upsertStallion(stallion: Stallion): void {
    const stallions = this.getStallions();
    const index = stallions.findIndex((s) => s.id === stallion.id);
    if (index >= 0) {
      stallions[index] = stallion;
    } else {
      stallions.push(stallion);
    }
    this.saveStallions(stallions);
  },

  deleteStallion(id: string): void {
    const stallions = this.getStallions().filter((s) => s.id !== id);
    this.saveStallions(stallions);
  },

  // Movements
  getMovements(): Movement[] {
    const raw = localStorage.getItem(KEYS.MOVEMENTS);
    if (!raw) {
      this.saveMovements(INITIAL_MOVEMENTS);
      return INITIAL_MOVEMENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_MOVEMENTS;
    }
  },

  saveMovements(movements: Movement[]): void {
    localStorage.setItem(KEYS.MOVEMENTS, JSON.stringify(movements));
  },

  addMovement(movement: Movement): void {
    const movements = this.getMovements();
    movements.unshift(movement);
    this.saveMovements(movements);

    // Also update the animal presence state
    const animals = this.getAnimals();
    const animal = animals.find((a) => a.id === movement.animalId);
    if (animal) {
      if (movement.tipoMovimiento === 'ENTRADA') {
        animal.estadoPresencia = 'DENTRO';
        animal.fechaEntradaMarisma = movement.fecha;
        animal.fechaUltimaRevision = `Entrada ${movement.fecha}`;
        this.upsertAnimal(animal);
      } else {
        // SALIDA
        if (movement.liberarPlaza) {
          const originalPlaza = animal.plazaNumero;
          const originalCampana = animal.campana;
          const originalPropietario = animal.propietario;
          const originalTipo = animal.tipo;

          // Animal is retired/unlinked from this plaza, but kept in system for full history & re-entry
          animal.estadoPresencia = 'FUERA';
          animal.fechaSalidaMarisma = movement.fecha;
          animal.plazaNumero = '';
          animal.fechaUltimaRevision = `Baja de plaza ${originalPlaza} (${movement.fecha})`;
          this.upsertAnimal(animal);

          // Create a vacant plaza slot for this owner
          const vacantSlot: Animal = {
            id: `vacante-${Date.now()}-${originalPlaza.toLowerCase()}`,
            tipo: originalTipo,
            campana: originalCampana,
            plazaNumero: originalPlaza,
            propietario: originalPropietario,
            finca: 'HINOJOS',
            identificacion1: '',
            identificacion2: '',
            nombreAnimal: 'Plaza Vacante',
            sexo: 'H',
            fechaNacimiento: '',
            capa: '',
            estadoPresencia: 'PLAZA_VACANTE',
            esPlazaVacante: true,
            animalAnteriorId: animal.id,
            fechaUltimaRevision: `Liberada el ${movement.fecha}`,
            documentos: [],
            anotaciones: [
              {
                id: `note-lib-${Date.now()}`,
                fecha: movement.fecha,
                autor: movement.guardaResponsable,
                categoria: 'GUARDERIA',
                texto: `Plaza ${originalPlaza} liberada tras salida del animal "${animal.nombreAnimal}". La concesión continúa asignada al titular ${originalPropietario}.`,
              },
            ],
            creadoEn: new Date().toISOString(),
            actualizadoEn: new Date().toISOString(),
          };
          this.upsertAnimal(vacantSlot);
        } else {
          // Regular temporal salida
          animal.estadoPresencia = 'FUERA';
          animal.fechaSalidaMarisma = movement.fecha;
          animal.fechaUltimaRevision = `Salida ${movement.fecha}`;
          this.upsertAnimal(animal);
        }
      }
    }
  },

  // Assign an existing animal (e.g. re-entering an animal previously retired) to a vacant plaza
  assignAnimalToPlaza(
    vacantPlazaId: string,
    animalId: string,
    fecha: string,
    guardaResponsable: string,
    numeroGuia?: string,
    observaciones?: string
  ): void {
    const animals = this.getAnimals();
    const vacantSlot = animals.find((a) => a.id === vacantPlazaId);
    const animal = animals.find((a) => a.id === animalId);

    if (vacantSlot && animal) {
      const plazaNumero = vacantSlot.plazaNumero;
      const campana = vacantSlot.campana;
      const propietario = vacantSlot.propietario;

      // Assign animal to this plaza
      animal.plazaNumero = plazaNumero;
      animal.campana = campana;
      animal.propietario = propietario;
      animal.estadoPresencia = 'DENTRO';
      animal.fechaEntradaMarisma = fecha;
      animal.fechaUltimaRevision = `Reingreso ${fecha}`;
      animal.esPlazaVacante = false;
      animal.actualizadoEn = new Date().toISOString();

      animal.anotaciones = animal.anotaciones || [];
      animal.anotaciones.push({
        id: `note-reingreso-${Date.now()}`,
        fecha,
        autor: guardaResponsable,
        categoria: 'GUARDERIA',
        texto: `Reincorporación a la Marisma en la Plaza ${plazaNumero}.${observaciones ? ' ' + observaciones : ''}`,
      });

      // Remove the vacant slot placeholder
      const filtered = animals.filter((a) => a.id !== vacantPlazaId);
      // Upsert updated animal in filtered list
      const idx = filtered.findIndex((a) => a.id === animal.id);
      if (idx >= 0) {
        filtered[idx] = animal;
      } else {
        filtered.push(animal);
      }
      this.saveAnimals(filtered);

      // Register the ENTRADA movement
      const movement: Movement = {
        id: `mov-${Date.now()}`,
        animalId: animal.id,
        tipoAnimal: animal.tipo,
        plazaNumero: plazaNumero,
        nombreAnimal: animal.nombreAnimal,
        propietario: animal.propietario,
        tipoMovimiento: 'ENTRADA',
        fecha,
        motivo: 'ADJUDICACION',
        numeroGuia,
        guardaResponsable,
        observaciones: `Reincorporación a la marisma en plaza ${plazaNumero}.${observaciones ? ' ' + observaciones : ''}`,
      };
      const movements = this.getMovements();
      movements.unshift(movement);
      this.saveMovements(movements);
    }
  },

  // Returns animals belonging to this owner that can re-enter (no active plaza or currently FUERA)
  getReentryCandidates(propietario: string, tipo: AnimalType): Animal[] {
    const animals = this.getAnimals();
    return animals.filter(
      (a) =>
        !a.esPlazaVacante &&
        a.tipo === tipo &&
        a.propietario.trim().toLowerCase() === propietario.trim().toLowerCase() &&
        (!a.plazaNumero || a.estadoPresencia === 'FUERA')
    );
  },

  // Campaigns
  getCampaigns(): string[] {
    const raw = localStorage.getItem(KEYS.CAMPAIGNS);
    if (!raw) {
      this.saveCampaigns(CAMPAIGNS);
      return CAMPAIGNS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return CAMPAIGNS;
    }
  },

  saveCampaigns(campaigns: string[]): void {
    localStorage.setItem(KEYS.CAMPAIGNS, JSON.stringify(campaigns));
  },

  addCampaign(newCampaign: string): void {
    const list = this.getCampaigns();
    if (!list.includes(newCampaign)) {
      list.unshift(newCampaign);
      this.saveCampaigns(list);
    }
  },

  deleteCampaign(campana: string): void {
    const list = this.getCampaigns().filter((c) => c !== campana);
    this.saveCampaigns(list);

    const active = localStorage.getItem(KEYS.ACTIVE_CAMPAIGN);
    if (active === campana) {
      const nextActive = list[0] || '2025-2026';
      this.setActiveCampaign(nextActive);
    }

    // Limpiar animales, sementales y propietarios vinculados a la campaña eliminada
    const animals = this.getAnimals().filter((a) => a.campana !== campana);
    this.saveAnimals(animals);

    const stallions = this.getStallions().filter((s) => s.campana !== campana);
    this.saveStallions(stallions);

    const owners = this.getOwners().filter((o) => o.campana !== campana);
    this.saveOwners(owners);
  },

  getActiveCampaign(): string {
    const campaigns = this.getCampaigns();
    const stored = localStorage.getItem(KEYS.ACTIVE_CAMPAIGN);
    if (stored && campaigns.includes(stored)) {
      return stored;
    }
    const fallback = campaigns[0] || '2025-2026';
    localStorage.setItem(KEYS.ACTIVE_CAMPAIGN, fallback);
    return fallback;
  },

  setActiveCampaign(campana: string): void {
    localStorage.setItem(KEYS.ACTIVE_CAMPAIGN, campana);
  },

  // Users & Auth
  getUsers(): User[] {
    const raw = localStorage.getItem(KEYS.USERS);
    if (!raw) {
      this.saveUsers(INITIAL_USERS);
      return INITIAL_USERS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS;
    }
  },

  saveUsers(users: User[]): void {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUser(): User {
    const raw = localStorage.getItem(KEYS.CURRENT_USER);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    return INITIAL_USERS[0];
  },

  setCurrentUser(user: User): void {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  },

  upsertUser(user: User): void {
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    this.saveUsers(users);
  },

  deleteUser(id: string): void {
    const currentUsers = this.getUsers();
    const filtered = currentUsers.filter((u) => u.id !== id);
    this.saveUsers(filtered);

    // If current logged in user was deleted, switch to the first remaining user
    const current = this.getCurrentUser();
    if (current && current.id === id && filtered.length > 0) {
      this.setCurrentUser(filtered[0]);
    }
  },

  // Reset to default sample
  resetToFactoryDefaults(): void {
    localStorage.setItem(KEYS.ANIMALS, JSON.stringify(INITIAL_ANIMALS));
    localStorage.setItem(KEYS.OWNERS, JSON.stringify(INITIAL_OWNERS));
    localStorage.setItem(KEYS.ASSOCIATIONS, JSON.stringify(INITIAL_ASSOCIATIONS));
    localStorage.setItem(KEYS.STALLIONS, JSON.stringify(INITIAL_STALLIONS));
    localStorage.setItem(KEYS.MOVEMENTS, JSON.stringify(INITIAL_MOVEMENTS));
    localStorage.setItem(KEYS.USERS, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[0]));
    localStorage.setItem(KEYS.CAMPAIGNS, JSON.stringify(CAMPAIGNS));
    localStorage.setItem(KEYS.ACTIVE_CAMPAIGN, '2025-2026');
  },

  // CSV Export for Excel
  exportToExcelCSV(animals: Animal[], tipo: AnimalType, campana: string): void {
    const headers = tipo === 'BOVINO'
      ? [
          'Nº PLAZA',
          'NOMBRE (PROPIETARIO)',
          'CROTAL OFICIAL',
          'CROTAL 2 / REGA',
          'SEXO',
          'FN',
          'CAPA',
          'FECHA UL RV',
          'ESTADO EN MARISMA',
          'PROPIETARIO RASTRA',
          'CROTAL RASTRA',
          'UELN RASTRA',
          'NOMBRE RASTRA',
          'SEX RSTRA',
          'FN RASTRA',
          'CAPA RASTRA',
          'F ENTRD',
          'F SALIDA',
        ]
      : [
          'Nº PLAZA',
          'NOMBRE (PROPIETARIO)',
          'IDENTIFICACION 1 (CHIP)',
          'IDENTIFICACION 2 (UELN)',
          'NOMBRE ANIMAL',
          'SEXO',
          'FN',
          'CAPA',
          'FECHA UL RV',
          'ESTADO EN MARISMA',
          'PROPIETARIO RASTRA',
          'RASTRAS CHIP',
          'UELN RASTRA',
          'NOMBRE RASTRA',
          'SEX RSTRA',
          'FN RASTRA',
          'CAPA RASTRA',
          'F ENTRD',
          'F SALIDA',
        ];

    const rows = animals.map((a) => {
      const r = a.rastra;
      const baseRow = [
        `"${a.plazaNumero}"`,
        `"${a.propietario}"`,
        `"${a.identificacion1}"`,
        `"${a.identificacion2}"`,
      ];
      if (tipo === 'EQUINO') {
        baseRow.push(`"${a.nombreAnimal}"`);
      }
      baseRow.push(
        `"${a.sexo}"`,
        `"${a.fechaNacimiento}"`,
        `"${a.capa}"`,
        `"${a.fechaUltimaRevision || ''}"`,
        `"${a.estadoPresencia}"`,
        `"${r?.propietarioRastra || ''}"`,
        `"${r?.rastrasChip || ''}"`,
        `"${r?.ueln || ''}"`,
        `"${r?.nombre || ''}"`,
        `"${r?.sexo || ''}"`,
        `"${r?.fechaNacimiento || ''}"`,
        `"${r?.capa || ''}"`,
        `"${r?.fechaEntrada || ''}"`,
        `"${r?.fechaSalida || ''}"`
      );
      return baseRow.join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Marisma_Hinojos_${tipo}_${campana.replace('/', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Export full JSON backup
  exportBackupJSON(): void {
    const data = {
      animals: this.getAnimals(),
      owners: this.getOwners(),
      associations: this.getAssociations(),
      stallions: this.getStallions(),
      movements: this.getMovements(),
      campaigns: this.getCampaigns(),
      exportDate: new Date().toISOString(),
      origin: 'Ayuntamiento de Hinojos - Control Marisma',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Copia_Seguridad_Marisma_Hinojos_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // Import JSON backup
  importBackupJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.animals)) this.saveAnimals(data.animals);
      if (Array.isArray(data.owners)) this.saveOwners(data.owners);
      if (Array.isArray(data.associations)) this.saveAssociations(data.associations);
      if (Array.isArray(data.stallions)) this.saveStallions(data.stallions);
      if (Array.isArray(data.movements)) this.saveMovements(data.movements);
      if (Array.isArray(data.campaigns)) this.saveCampaigns(data.campaigns);
      return true;
    } catch {
      return false;
    }
  },
};
