import React, { useState, useMemo } from 'react';
import { Animal, AnimalType, Owner, Association } from '../types/marisma';
import {
  Calendar,
  Users,
  Check,
  X,
  Search,
  Filter,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Building2,
  RefreshCw,
  Baby,
  Repeat,
  ShieldCheck,
  CheckSquare,
  Square,
  Sparkles,
  Info,
} from 'lucide-react';

export interface CampaignMigrationWizardProps {
  campaigns: string[];
  activeCampaign: string;
  animals: Animal[];
  owners: Owner[];
  associations: Association[];
  initialNewName?: string;
  onClose: () => void;
  onConfirm: (data: {
    nombre: string;
    cloneFromCampaign: string;
    selectedOwners: Owner[];
    selectedAnimals: any[];
    setActiveImmediately: boolean;
  }) => Promise<void>;
}

export interface AnimalMigrationState {
  sourceAnimalId: string;
  tipo: 'EQUINO' | 'BOVINO';
  plazaNumero: string;
  originalPropietario: string;
  assignedPropietario: string;
  nombreAnimal: string;
  identificacion1: string;
  identificacion2?: string;
  sexo: 'H' | 'M';
  fechaNacimiento?: string;
  capa: string;
  estadoPresencia: any;
  fechaEntradaMarisma?: string;
  esSemental?: boolean;
  esPlazaVacante?: boolean;
  selected: boolean;
  hasRastra: boolean;
  mantenerRastra: boolean;
  rastra?: any;
  documentos?: any[];
}

export const CampaignMigrationWizard: React.FC<CampaignMigrationWizardProps> = ({
  campaigns,
  activeCampaign,
  animals,
  owners,
  associations,
  initialNewName = '',
  onClose,
  onConfirm,
}) => {
  // Current Step in the Wizard: 1: Datos & Ganaderos, 2: Animales, 3: Resumen
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Campaign Configuration
  const [newCampaignName, setNewCampaignName] = useState(initialNewName);
  const [sourceCampaign, setSourceCampaign] = useState(activeCampaign || campaigns[0] || '2025-2026');
  const [setActiveImmediately, setSetActiveImmediately] = useState(true);

  // Owners from source campaign
  const sourceOwners = useMemo(() => {
    return owners.filter((o) => !o.campana || o.campana === sourceCampaign);
  }, [owners, sourceCampaign]);

  // Selected Owners map: ownerId -> { selected: boolean; asociacion: string; ... }
  const [ownerStates, setOwnerStates] = useState<Map<string, { selected: boolean; asociacion: string }>>(() => {
    const map = new Map<string, { selected: boolean; asociacion: string }>();
    sourceOwners.forEach((o) => {
      map.set(o.id, { selected: true, asociacion: o.asociacion || '' });
    });
    return map;
  });

  // Re-sync owner states if sourceCampaign changes
  const handleSourceCampaignChange = (newSource: string) => {
    setSourceCampaign(newSource);
    const newSourceOwners = owners.filter((o) => !o.campana || o.campana === newSource);
    const map = new Map<string, { selected: boolean; asociacion: string }>();
    newSourceOwners.forEach((o) => {
      map.set(o.id, { selected: true, asociacion: o.asociacion || '' });
    });
    setOwnerStates(map);

    // Also re-initialize animals
    const newSourceAnimals = animals.filter((a) => a.campana === newSource && !a.esPlazaVacante);
    const animMap = new Map<string, AnimalMigrationState>();
    newSourceAnimals.forEach((a) => {
      animMap.set(a.id, {
        sourceAnimalId: a.id,
        tipo: a.tipo,
        plazaNumero: a.plazaNumero,
        originalPropietario: a.propietario,
        assignedPropietario: a.propietario,
        nombreAnimal: a.nombreAnimal,
        identificacion1: a.identificacion1,
        identificacion2: a.identificacion2,
        sexo: a.sexo,
        fechaNacimiento: a.fechaNacimiento,
        capa: a.capa,
        estadoPresencia: a.estadoPresencia,
        fechaEntradaMarisma: a.fechaEntradaMarisma,
        esSemental: a.esSemental,
        esPlazaVacante: a.esPlazaVacante,
        selected: true,
        hasRastra: Boolean(a.rastra),
        mantenerRastra: false, // Por defecto se reinician las crías
        rastra: a.rastra,
        documentos: a.documentos,
      });
    });
    setAnimalStates(animMap);
  };

  // Search in owners list
  const [ownerSearch, setOwnerSearch] = useState('');

  // Selected owners list for the new campaign
  const selectedOwnersList = useMemo(() => {
    return sourceOwners
      .filter((o) => ownerStates.get(o.id)?.selected)
      .map((o) => {
        const state = ownerStates.get(o.id);
        return {
          ...o,
          asociacion: state?.asociacion ?? o.asociacion,
        };
      });
  }, [sourceOwners, ownerStates]);

  const selectedOwnerNames = useMemo(() => {
    return selectedOwnersList.map((o) => o.nombreCompleto);
  }, [selectedOwnersList]);

  // Animals from source campaign
  const sourceAnimals = useMemo(() => {
    return animals.filter((a) => a.campana === sourceCampaign && !a.esPlazaVacante);
  }, [animals, sourceCampaign]);

  // Animal States Map: animalId -> AnimalMigrationState
  const [animalStates, setAnimalStates] = useState<Map<string, AnimalMigrationState>>(() => {
    const map = new Map<string, AnimalMigrationState>();
    sourceAnimals.forEach((a) => {
      map.set(a.id, {
        sourceAnimalId: a.id,
        tipo: a.tipo,
        plazaNumero: a.plazaNumero,
        originalPropietario: a.propietario,
        assignedPropietario: a.propietario,
        nombreAnimal: a.nombreAnimal,
        identificacion1: a.identificacion1,
        identificacion2: a.identificacion2,
        sexo: a.sexo,
        fechaNacimiento: a.fechaNacimiento,
        capa: a.capa,
        estadoPresencia: a.estadoPresencia,
        fechaEntradaMarisma: a.fechaEntradaMarisma,
        esSemental: a.esSemental,
        esPlazaVacante: a.esPlazaVacante,
        selected: true,
        hasRastra: Boolean(a.rastra),
        mantenerRastra: false,
        rastra: a.rastra,
        documentos: a.documentos,
      });
    });
    return map;
  });

  // Filters for Step 2 (Animals)
  const [animalTypeFilter, setAnimalTypeFilter] = useState<'TODOS' | 'EQUINO' | 'BOVINO'>('TODOS');
  const [animalOwnerFilter, setAnimalOwnerFilter] = useState<string>('TODOS');
  const [animalTransferFilter, setAnimalTransferFilter] = useState<'TODOS' | 'SELECTED' | 'UNSELECTED' | 'CHANGED_OWNER'>('TODOS');
  const [animalSearch, setAnimalSearch] = useState('');

  // Is Submitting
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Toggle single owner selection
  const handleToggleOwner = (ownerId: string) => {
    setOwnerStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(ownerId);
      if (cur) {
        const newSelected = !cur.selected;
        next.set(ownerId, { ...cur, selected: newSelected });

        // Auto-update animals belonging to this owner: if owner is deselected, we unselect their animals by default
        const targetOwner = sourceOwners.find((o) => o.id === ownerId);
        if (targetOwner) {
          setAnimalStates((aPrev) => {
            const aNext = new Map(aPrev);
            aNext.forEach((st, id) => {
              if (st.originalPropietario.trim().toLowerCase() === targetOwner.nombreCompleto.trim().toLowerCase()) {
                aNext.set(id, { ...st, selected: newSelected });
              }
            });
            return aNext;
          });
        }
      }
      return next;
    });
  };

  // Toggle all owners
  const handleToggleAllOwners = (select: boolean) => {
    setOwnerStates((prev) => {
      const next = new Map(prev);
      sourceOwners.forEach((o) => {
        const cur = next.get(o.id) || { selected: false, asociacion: o.asociacion || '' };
        next.set(o.id, { ...cur, selected: select });
      });
      return next;
    });

    setAnimalStates((aPrev) => {
      const aNext = new Map(aPrev);
      aNext.forEach((st, id) => {
        aNext.set(id, { ...st, selected: select });
      });
      return aNext;
    });
  };

  // Change owner association
  const handleOwnerAsocChange = (ownerId: string, asoc: string) => {
    setOwnerStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(ownerId) || { selected: true, asociacion: '' };
      next.set(ownerId, { ...cur, asociacion: asoc });
      return next;
    });
  };

  // Toggle animal selection
  const handleToggleAnimal = (animalId: string) => {
    setAnimalStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(animalId);
      if (cur) {
        next.set(animalId, { ...cur, selected: !cur.selected });
      }
      return next;
    });
  };

  // Change assigned owner for an animal
  const handleChangeAnimalOwner = (animalId: string, newOwner: string) => {
    setAnimalStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(animalId);
      if (cur) {
        next.set(animalId, { ...cur, assignedPropietario: newOwner });
      }
      return next;
    });
  };

  // Toggle keep rastra
  const handleToggleMantenerRastra = (animalId: string) => {
    setAnimalStates((prev) => {
      const next = new Map(prev);
      const cur = next.get(animalId);
      if (cur) {
        next.set(animalId, { ...cur, mantenerRastra: !cur.mantenerRastra });
      }
      return next;
    });
  };

  // Filtered Animals for Table in Step 2
  const filteredAnimalList = useMemo(() => {
    return sourceAnimals.filter((a) => {
      const st = animalStates.get(a.id);
      if (!st) return false;

      // Type filter
      if (animalTypeFilter !== 'TODOS' && a.tipo !== animalTypeFilter) return false;

      // Owner filter (check both original and assigned)
      if (animalOwnerFilter !== 'TODOS') {
        const matchOriginal = a.propietario.trim().toLowerCase() === animalOwnerFilter.trim().toLowerCase();
        const matchAssigned = st.assignedPropietario.trim().toLowerCase() === animalOwnerFilter.trim().toLowerCase();
        if (!matchOriginal && !matchAssigned) return false;
      }

      // Transfer filter
      if (animalTransferFilter === 'SELECTED' && !st.selected) return false;
      if (animalTransferFilter === 'UNSELECTED' && st.selected) return false;
      if (animalTransferFilter === 'CHANGED_OWNER') {
        if (!st.selected) return false;
        if (st.originalPropietario.trim().toLowerCase() === st.assignedPropietario.trim().toLowerCase()) return false;
      }

      // Text Search
      if (animalSearch.trim()) {
        const q = animalSearch.toLowerCase().trim();
        const matchPlaza = a.plazaNumero.toLowerCase().includes(q);
        const matchOwner = a.propietario.toLowerCase().includes(q) || st.assignedPropietario.toLowerCase().includes(q);
        const matchId1 = a.identificacion1.toLowerCase().includes(q);
        const matchId2 = (a.identificacion2 || '').toLowerCase().includes(q);
        const matchNombre = a.nombreAnimal.toLowerCase().includes(q);
        if (!matchPlaza && !matchOwner && !matchId1 && !matchId2 && !matchNombre) return false;
      }

      return true;
    });
  }, [sourceAnimals, animalStates, animalTypeFilter, animalOwnerFilter, animalTransferFilter, animalSearch]);

  // Bulk actions for visible animals
  const handleSetSelectedForVisible = (select: boolean) => {
    setAnimalStates((prev) => {
      const next = new Map(prev);
      filteredAnimalList.forEach((a) => {
        const cur = next.get(a.id);
        if (cur) {
          next.set(a.id, { ...cur, selected: select });
        }
      });
      return next;
    });
  };

  // Global toggle for all rastras
  const handleSetAllRastras = (mantener: boolean) => {
    setAnimalStates((prev) => {
      const next = new Map(prev);
      next.forEach((cur, id) => {
        if (cur.hasRastra) {
          next.set(id, { ...cur, mantenerRastra: mantener });
        }
      });
      return next;
    });
  };

  // Summary counts
  const summary = useMemo(() => {
    let equinos = 0;
    let bovinos = 0;
    let totalSelected = 0;
    let changedOwners = 0;
    let orphans = 0; // selected animal whose owner is not in the new campaign

    const validOwnerSet = new Set(selectedOwnerNames.map((n) => n.trim().toLowerCase()));

    animalStates.forEach((st) => {
      if (st.selected) {
        totalSelected++;
        if (st.tipo === 'EQUINO') equinos++;
        if (st.tipo === 'BOVINO') bovinos++;

        if (st.originalPropietario.trim().toLowerCase() !== st.assignedPropietario.trim().toLowerCase()) {
          changedOwners++;
        }

        // Check if assigned owner exists in selected owners list
        if (!validOwnerSet.has(st.assignedPropietario.trim().toLowerCase())) {
          orphans++;
        }
      }
    });

    return {
      totalSelected,
      equinos,
      bovinos,
      changedOwners,
      unselected: sourceAnimals.length - totalSelected,
      orphans,
      ownersCount: selectedOwnersList.length,
    };
  }, [animalStates, sourceAnimals, selectedOwnerNames, selectedOwnersList]);

  // Cálculo de nuevas plazas correlativas para la nueva campaña:
  // Agrupadas por tipo (EQUINO / BOVINO), ordenadas alfabéticamente por el titular asignado
  const projectedPlazas = useMemo(() => {
    const map = new Map<string, string>();
    const selectedList: {
      id: string;
      tipo: AnimalType;
      assignedPropietario: string;
      plazaNumero: string;
      nombreAnimal: string;
    }[] = [];

    animalStates.forEach((st, id) => {
      if (st.selected) {
        selectedList.push({
          id,
          tipo: st.tipo,
          assignedPropietario: st.assignedPropietario.trim().toUpperCase(),
          plazaNumero: st.plazaNumero,
          nombreAnimal: st.nombreAnimal,
        });
      }
    });

    selectedList.sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === 'EQUINO' ? -1 : 1;
      const compOwner = a.assignedPropietario.localeCompare(b.assignedPropietario, 'es', { sensitivity: 'base' });
      if (compOwner !== 0) return compOwner;
      const numA = parseInt((a.plazaNumero.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.plazaNumero.match(/\d+/) || ['0'])[0], 10);
      if (numA !== numB) return numA - numB;
      return a.nombreAnimal.localeCompare(b.nombreAnimal, 'es', { sensitivity: 'base' });
    });

    let nextEq = 1;
    let nextBv = 1;
    selectedList.forEach((item) => {
      const prefix = item.tipo === 'BOVINO' ? 'HIN' : 'HI';
      const idx = item.tipo === 'BOVINO' ? nextBv++ : nextEq++;
      map.set(item.id, `${prefix}${String(idx).padStart(3, '0')}`);
    });

    return map;
  }, [animalStates]);

  // Validate step 1 before proceeding to step 2
  const handleProceedToStep2 = () => {
    setErrorMessage(null);
    if (!newCampaignName.trim()) {
      setErrorMessage('Debe introducir el nombre de la nueva campaña (ej. 2028-2029).');
      return;
    }
    const cleanName = newCampaignName.trim();
    if (campaigns.some((c) => c.toLowerCase() === cleanName.toLowerCase())) {
      setErrorMessage(`La campaña "${cleanName}" ya existe en el sistema. Elija otro nombre.`);
      return;
    }
    if (selectedOwnersList.length === 0) {
      setErrorMessage('Debe seleccionar al menos un ganadero para la nueva campaña.');
      return;
    }
    setCurrentStep(2);
  };

  // Validate step 2 before proceeding to step 3
  const handleProceedToStep3 = () => {
    setErrorMessage(null);
    if (summary.orphans > 0) {
      setErrorMessage(
        `Hay ${summary.orphans} animal(es) seleccionados con un titular que no continuará en la nueva campaña. Debe reasignarlos a un titular activo o desmarcarlos.`
      );
      return;
    }
    setCurrentStep(3);
  };

  // Final Submit
  const handleConfirmCreation = async () => {
    setErrorMessage(null);
    if (summary.orphans > 0) {
      setErrorMessage(`Existen animales sin un titular válido en la nueva campaña.`);
      return;
    }

    setIsSubmitting(true);
    try {
      // Build selected animals payload
      const animalsToTransfer: any[] = [];
      animalStates.forEach((st) => {
        if (st.selected) {
          const newPlaza = projectedPlazas.get(st.sourceAnimalId) || st.plazaNumero;
          animalsToTransfer.push({
            sourceAnimalId: st.sourceAnimalId,
            tipo: st.tipo,
            plazaNumero: newPlaza,
            propietario: st.assignedPropietario.trim().toUpperCase(),
            identificacion1: st.identificacion1,
            identificacion2: st.identificacion2,
            nombreAnimal: st.nombreAnimal,
            sexo: st.sexo,
            fechaNacimiento: st.fechaNacimiento,
            capa: st.capa,
            estadoPresencia: st.estadoPresencia,
            fechaEntradaMarisma: st.fechaEntradaMarisma,
            esSemental: st.esSemental,
            esPlazaVacante: st.esPlazaVacante,
            mantenerRastra: st.mantenerRastra,
            rastra: st.rastra,
            documentos: st.documentos,
          });
        }
      });

      await onConfirm({
        nombre: newCampaignName.trim(),
        cloneFromCampaign: sourceCampaign,
        selectedOwners: selectedOwnersList,
        selectedAnimals: animalsToTransfer,
        setActiveImmediately,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al crear la campaña y traspasar los datos.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                <Sparkles className="w-5 h-5 text-emerald-700" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  Asistente de Traspaso y Creación de Campaña
                </h1>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="self-start lg:self-center flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs sm:text-sm font-semibold transition"
          >
            <X className="w-4 h-4 text-gray-500" />
            <span>Cancelar y Volver a Ajustes</span>
          </button>
        </div>

        {/* Wizard Steps Navigation Bar */}
        <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Step 1 Tab */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              currentStep === 1
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === 1 ? 'bg-[#008744] text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              1
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Paso 1</div>
              <div className="text-sm font-extrabold text-gray-900">Campaña y Ganaderos</div>
            </div>
          </button>

          {/* Step 2 Tab */}
          <button
            type="button"
            onClick={() => handleProceedToStep2()}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              currentStep === 2
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === 2 ? 'bg-[#008744] text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              2
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Paso 2 (Principal)</div>
              <div className="text-sm font-extrabold text-gray-900">Censo de Animales</div>
            </div>
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            onClick={() => handleProceedToStep3()}
            className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
              currentStep === 3
                ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                currentStep === 3 ? 'bg-[#008744] text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              3
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider">Paso 3</div>
              <div className="text-sm font-extrabold text-gray-900">Resumen y Creación</div>
            </div>
          </button>
        </div>
      </div>

      {/* Error banner if any */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-center gap-3 text-rose-900 font-semibold text-xs sm:text-sm animate-in fade-in">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:text-rose-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* PASO 1: DATOS BÁSICOS Y SELECCIÓN DE GANADEROS                 */}
      {/* ============================================================== */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-700" />
              <span>Configuración General de la Nueva Campaña</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nombre de la Nueva Campaña *
                </label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProceedToStep2();
                    }
                  }}
                  placeholder="ej. 2028-2029"
                  className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded-xl font-bold bg-white focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
                  required
                />
                <p className="text-[11px] text-gray-500 mt-1">Formato recomendado: AÑO-AÑO (ej. 2028-2029)</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Campaña de Referencia / Origen de Datos
                </label>
                <select
                  value={sourceCampaign}
                  onChange={(e) => handleSourceCampaignChange(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 border border-gray-300 rounded-xl font-semibold bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  {campaigns.map((camp) => (
                    <option key={camp} value={camp}>
                      {camp} {camp === activeCampaign ? '(Campaña Activa Actual)' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Se cargarán los titulares y animales registrados en esta campaña para revisarlos
                </p>
              </div>
            </div>
          </div>

          {/* Owners Selection Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-700" />
                  <span>Titulares / Ganaderos a Mantener en la Nueva Campaña</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Marca qué ganaderos continúan este año. Por defecto están todos seleccionados para agilizar el trabajo.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleAllOwners(true)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllOwners(false)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={ownerSearch}
                  onChange={(e) => setOwnerSearch(e.target.value)}
                  placeholder="Buscar titular por nombre, DNI o asociación..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-xl bg-white"
                />
              </div>

              <span className="text-xs font-extrabold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl whitespace-nowrap">
                {selectedOwnersList.length} de {sourceOwners.length} ganaderos seleccionados
              </span>
            </div>

            {/* Owners table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white font-bold text-xs uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12">INCLUIR</th>
                    <th className="py-2.5 px-3">NOMBRE COMPLETO</th>
                    <th className="py-2.5 px-3">DNI / CIF</th>
                    <th className="py-2.5 px-3">ASOCIACIÓN EN NUEVA CAMPAÑA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {sourceOwners
                    .filter((ow) => {
                      if (!ownerSearch.trim()) return true;
                      const q = ownerSearch.toLowerCase();
                      return (
                        ow.nombreCompleto.toLowerCase().includes(q) ||
                        ow.dniCif.toLowerCase().includes(q) ||
                        (ow.asociacion && ow.asociacion.toLowerCase().includes(q))
                      );
                    })
                    .map((ow) => {
                      const state = ownerStates.get(ow.id) || { selected: true, asociacion: ow.asociacion || '' };
                      return (
                        <tr
                          key={ow.id}
                          className={`hover:bg-gray-50 transition ${state.selected ? 'bg-white' : 'bg-gray-50/70 opacity-60'}`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={state.selected}
                              onChange={() => handleToggleOwner(ow.id)}
                              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-gray-900">
                            <span
                              onClick={() => handleToggleOwner(ow.id)}
                              className="cursor-pointer hover:text-emerald-700"
                            >
                              {ow.nombreCompleto}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-gray-600">{ow.dniCif}</td>
                          <td className="py-2.5 px-3">
                            <select
                              value={state.asociacion}
                              onChange={(e) => handleOwnerAsocChange(ow.id, e.target.value)}
                              disabled={!state.selected}
                              className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400"
                            >
                              <option value="">-- Sin Asociación / Particular --</option>
                              {associations.map((a) => (
                                <option key={a.id} value={a.nombre}>
                                  {a.nombre}
                                </option>
                              ))}
                              {state.asociacion && !associations.some((a) => a.nombre === state.asociacion) && (
                                <option value={state.asociacion}>{state.asociacion}</option>
                              )}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition"
              >
                <span>Siguiente: Revisar Animales</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PASO 2: CENSO DE ANIMALES A PANTALLA COMPLETA                   */}
      {/* ============================================================== */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {/* Controls & Filter Header */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                  <span>Revisión y Traspaso de Animales a la Campaña {newCampaignName}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Marca qué animales se conservan y asigna el titular definitivo. Puedes cambiar de propietario en cualquier animal.
                </p>
              </div>

              {/* Summary counters in header */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="bg-emerald-100 text-emerald-900 px-3 py-1.5 rounded-xl border border-emerald-300">
                  {summary.totalSelected} Animales a Traspasar
                </span>
                <span className="bg-blue-50 text-blue-900 px-2.5 py-1.5 rounded-xl border border-blue-200">
                  🐴 {summary.equinos} Equinos
                </span>
                <span className="bg-amber-50 text-amber-900 px-2.5 py-1.5 rounded-xl border border-amber-200">
                  🐂 {summary.bovinos} Bovinos
                </span>
                {summary.changedOwners > 0 && (
                  <span className="bg-indigo-50 text-indigo-900 px-2.5 py-1.5 rounded-xl border border-indigo-200">
                    🔄 {summary.changedOwners} Cambios de titular
                  </span>
                )}
                {summary.orphans > 0 && (
                  <span className="bg-rose-100 text-rose-900 px-2.5 py-1.5 rounded-xl border border-rose-300 animate-pulse">
                    ⚠️ {summary.orphans} Sin titular válido
                  </span>
                )}
              </div>
            </div>

            {/* Filter controls row */}
            <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2.5">
              {/* Type Filter Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAnimalTypeFilter('TODOS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    animalTypeFilter === 'TODOS' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Todos ({sourceAnimals.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAnimalTypeFilter('EQUINO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    animalTypeFilter === 'EQUINO' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Equinos
                </button>
                <button
                  type="button"
                  onClick={() => setAnimalTypeFilter('BOVINO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    animalTypeFilter === 'BOVINO' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Bovinos
                </button>
              </div>

              {/* Owner Filter (Crucial for reviewing owner by owner!) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-600 whitespace-nowrap">Filtrar por Ganadero:</span>
                <select
                  value={animalOwnerFilter}
                  onChange={(e) => setAnimalOwnerFilter(e.target.value)}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-xl bg-white font-semibold max-w-[220px]"
                >
                  <option value="TODOS">-- Todos los ganaderos ({sourceOwners.length}) --</option>
                  {sourceOwners.map((o) => (
                    <option key={o.id} value={o.nombreCompleto}>
                      {o.nombreCompleto}
                    </option>
                  ))}
                </select>
              </div>

              {/* Transfer status filter */}
              <select
                value={animalTransferFilter}
                onChange={(e) => setAnimalTransferFilter(e.target.value as any)}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-xl bg-white font-semibold"
              >
                <option value="TODOS">Estado: Todos</option>
                <option value="SELECTED">Solo Marcados para Traspaso</option>
                <option value="UNSELECTED">Solo NO Marcados</option>
                <option value="CHANGED_OWNER">Solo con Cambio de Titular</option>
              </select>

              {/* Text search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={animalSearch}
                  onChange={(e) => setAnimalSearch(e.target.value)}
                  placeholder="Buscar plaza, chip, crotal, nombre..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-300 rounded-xl bg-white"
                />
              </div>

              {/* Bulk actions */}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => handleSetSelectedForVisible(true)}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition"
                  title="Marcar todos los animales que cumplen el filtro actual"
                >
                  Marcar Visibles
                </button>
                <button
                  type="button"
                  onClick={() => handleSetSelectedForVisible(false)}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg transition"
                  title="Desmarcar todos los animales que cumplen el filtro actual"
                >
                  Desmarcar Visibles
                </button>
              </div>
            </div>

            {/* Global Rastras policy bar */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <Baby className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-medium">
                  <strong>Tratamiento de Rastras (Crías al pie):</strong> Por defecto, se reinicia el ciclo de crías para la nueva campaña.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllRastras(false)}
                  className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded-md font-semibold text-[11px]"
                >
                  Reiniciar todas las crías (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllRastras(true)}
                  className="px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded-md font-semibold text-[11px]"
                >
                  Conservar todas las crías
                </button>
              </div>
            </div>

          </div>

          {/* Big Interactive Animals Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#111827] text-white font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-center w-12">TRASPASAR</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">NUEVA PLAZA</th>
                    <th className="py-2.5 px-2 text-center whitespace-nowrap">TIPO</th>
                    <th className="py-2.5 px-2.5 whitespace-nowrap">IDENTIFICACIÓN (CHIP/CROTAL)</th>
                    <th className="py-2.5 px-2.5">NOMBRE ANIMAL</th>
                    <th className="py-2.5 px-2 whitespace-nowrap">SEXO / CAPA</th>
                    <th className="py-2.5 px-3 w-80 min-w-[280px]">
                      TITULAR ASIGNADO EN NUEVA CAMPAÑA (INTERACTIVO)
                    </th>
                    <th className="py-2.5 px-2.5 text-center whitespace-nowrap">CRÍA / RASTRA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAnimalList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500 font-semibold">
                        No se encontraron animales con los filtros seleccionados
                      </td>
                    </tr>
                  ) : (
                    filteredAnimalList.map((animal) => {
                      const st = animalStates.get(animal.id)!;
                      const isOwnerChanged =
                        st.originalPropietario.trim().toLowerCase() !== st.assignedPropietario.trim().toLowerCase();
                      const isOriginalOwnerValid = selectedOwnerNames.some(
                        (n) => n.trim().toLowerCase() === st.originalPropietario.trim().toLowerCase()
                      );
                      const isAssignedOwnerValid = selectedOwnerNames.some(
                        (n) => n.trim().toLowerCase() === st.assignedPropietario.trim().toLowerCase()
                      );

                      return (
                        <tr
                          key={animal.id}
                          className={`transition ${
                            !st.selected
                              ? 'bg-gray-50/70 opacity-50'
                              : !isAssignedOwnerValid
                              ? 'bg-rose-50/60 border-l-4 border-l-rose-500'
                              : isOwnerChanged
                              ? 'bg-indigo-50/40 border-l-4 border-l-indigo-500'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={st.selected}
                              onChange={() => handleToggleAnimal(animal.id)}
                              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          {/* Plaza */}
                          <td className="py-2.5 px-2 text-center font-mono font-bold whitespace-nowrap">
                            {st.selected ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded border border-emerald-300 text-xs font-black shadow-2xs">
                                  {projectedPlazas.get(animal.id) || st.plazaNumero}
                                </span>
                                {projectedPlazas.get(animal.id) && projectedPlazas.get(animal.id) !== st.plazaNumero && (
                                  <span className="text-[10px] text-gray-500 font-semibold line-through">
                                    {st.plazaNumero}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="bg-gray-100 text-gray-400 px-2 py-0.5 rounded border border-gray-200 text-xs">
                                {st.plazaNumero}
                              </span>
                            )}
                          </td>

                          {/* Tipo */}
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                st.tipo === 'EQUINO'
                                  ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                  : 'bg-amber-100 text-amber-950 border border-amber-200'
                              }`}
                            >
                              {st.tipo}
                            </span>
                          </td>

                          {/* Identificación */}
                          <td className="py-2.5 px-2.5 font-mono text-xs whitespace-nowrap">
                            <span className="font-bold text-gray-900">{st.identificacion1}</span>
                            {st.identificacion2 && (
                              <div className="text-[10px] text-gray-500">{st.identificacion2}</div>
                            )}
                          </td>

                          {/* Nombre */}
                          <td className="py-2.5 px-2.5 font-semibold text-gray-900 whitespace-nowrap">
                            {st.tipo === 'BOVINO' ? (
                              <span className="text-gray-400 italic text-[11px]">-</span>
                            ) : (
                              st.nombreAnimal || <span className="text-gray-400 italic">Sin nombre</span>
                            )}
                          </td>

                          {/* Sexo / Capa */}
                          <td className="py-2.5 px-2 whitespace-nowrap text-xs text-gray-700">
                            <span className="font-bold">{st.sexo}</span> · {st.capa}
                          </td>

                          {/* Interactive Owner Selection Dropdown */}
                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <select
                                value={st.assignedPropietario}
                                onChange={(e) => handleChangeAnimalOwner(animal.id, e.target.value)}
                                disabled={!st.selected}
                                className={`w-full text-xs px-2.5 py-1.5 border rounded-lg font-bold bg-white focus:ring-2 focus:ring-emerald-500 ${
                                  !isAssignedOwnerValid
                                    ? 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-400'
                                    : isOwnerChanged
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-950 font-black'
                                    : 'border-gray-300 text-gray-900'
                                }`}
                              >
                                {selectedOwnersList.map((o) => (
                                  <option key={o.id} value={o.nombreCompleto}>
                                    {o.nombreCompleto} (DNI: {o.dniCif})
                                  </option>
                                ))}
                                {/* If assigned owner is not in list, keep option to show error */}
                                {!isAssignedOwnerValid && (
                                  <option value={st.assignedPropietario}>
                                    ⚠️ {st.assignedPropietario} (NO CONTINÚA EN LA CAMPAÑA)
                                  </option>
                                )}
                              </select>

                              {/* Owner status badges */}
                              {isOwnerChanged && isAssignedOwnerValid && (
                                <div className="text-[10px] text-indigo-800 font-bold flex items-center gap-1">
                                  <Repeat className="w-3 h-3 text-indigo-600" />
                                  <span>Traspasado de: {st.originalPropietario}</span>
                                </div>
                              )}

                              {!isOriginalOwnerValid && !isOwnerChanged && (
                                <div className="text-[10px] text-rose-700 font-extrabold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>Titular original no continuará. Selecciona nuevo titular.</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Rastra (Cría) */}
                          <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                            {st.hasRastra ? (
                              <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={st.mantenerRastra}
                                  onChange={() => handleToggleMantenerRastra(animal.id)}
                                  disabled={!st.selected}
                                  className="w-3.5 h-3.5 text-emerald-600 rounded border-gray-300"
                                />
                                <span className="text-[11px] font-semibold text-gray-700">
                                  {st.mantenerRastra ? 'Mantener cría' : 'Reiniciar'}
                                </span>
                              </label>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom table footer bar */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 bg-white border border-gray-300 rounded-xl transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Ganaderos</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600">
                  Mostrando <strong>{filteredAnimalList.length}</strong> de {sourceAnimals.length} animales
                </span>
                <button
                  type="button"
                  onClick={handleProceedToStep3}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition"
                >
                  <span>Siguiente: Resumen Final</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PASO 3: RESUMEN Y CONFIRMACIÓN FINAL                           */}
      {/* ============================================================== */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div>
              <h2 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-700" />
                <span>Resumen Oficial de la Campaña {newCampaignName}</span>
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Verifica el desglose definitivo antes de formalizar la creación de la nueva campaña en el censo municipal
              </p>
            </div>

            {/* Metric KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-emerald-800 uppercase">Campaña Nueva</div>
                <div className="text-lg font-black text-emerald-950 font-mono mt-1">{newCampaignName}</div>
                <div className="text-[10px] text-emerald-700 mt-0.5">Origen: {sourceCampaign}</div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-slate-700 uppercase">Ganaderos</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{summary.ownersCount}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Titulares activos</div>
              </div>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-blue-800 uppercase">Equinos</div>
                <div className="text-2xl font-black text-blue-950 mt-1">{summary.equinos}</div>
                <div className="text-[10px] text-blue-600 mt-0.5">Censo caballar</div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-amber-800 uppercase">Bovinos</div>
                <div className="text-2xl font-black text-amber-950 mt-1">{summary.bovinos}</div>
                <div className="text-[10px] text-amber-700 mt-0.5">Censo vacuno</div>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-indigo-800 uppercase">Traspasos</div>
                <div className="text-2xl font-black text-indigo-950 mt-1">{summary.changedOwners}</div>
                <div className="text-[10px] text-indigo-700 mt-0.5">Cambio de titular</div>
              </div>

              <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
                <div className="text-xs font-bold text-rose-800 uppercase">Bajas Censo</div>
                <div className="text-2xl font-black text-rose-950 mt-1">{summary.unselected}</div>
                <div className="text-[10px] text-rose-700 mt-0.5">No continúan</div>
              </div>
            </div>

            {/* List of animals with transferred owners */}
            {summary.changedOwners > 0 && (
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-2">
                <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-indigo-700" />
                  <span>Detalle de Animales con Cambio de Ganadero ({summary.changedOwners})</span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
                  {Array.from(animalStates.values())
                    .filter(
                      (st) =>
                        st.selected &&
                        st.originalPropietario.trim().toLowerCase() !== st.assignedPropietario.trim().toLowerCase()
                    )
                    .map((st) => (
                      <div
                        key={st.sourceAnimalId}
                        className="bg-white p-2 rounded-lg border border-indigo-100 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                            {projectedPlazas.get(st.sourceAnimalId) || st.plazaNumero}
                          </span>
                          <span className="font-bold text-gray-900">{st.tipo === 'BOVINO' ? st.identificacion1 : (st.nombreAnimal || st.identificacion1)}</span>
                          <span className="text-[11px] text-gray-500 font-mono">({st.identificacion1})</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-gray-500 line-through">{st.originalPropietario}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-black text-indigo-950 bg-indigo-100 px-2 py-0.5 rounded">
                            {st.assignedPropietario}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-3">
              <input
                type="checkbox"
                id="setActiveImmediately"
                checked={setActiveImmediately}
                onChange={(e) => setSetActiveImmediately(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="setActiveImmediately" className="text-xs sm:text-sm font-bold text-gray-800 cursor-pointer">
                Establecer inmediatamente la campaña {newCampaignName} como la Campaña Activa de trabajo del sistema
              </label>
            </div>

            {/* Final Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200 bg-white border border-gray-300 rounded-xl transition disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a Revisar Animales</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmCreation}
                disabled={isSubmitting || summary.orphans > 0}
                className="flex items-center gap-2 px-8 py-3 bg-[#008744] hover:bg-[#00743a] text-white font-black text-sm rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Creando Campaña y Traspasando Censo...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 stroke-[2.5]" />
                    <span>Confirmar y Crear Campaña Oficial {newCampaignName}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
