import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Stallion, Owner, AnimalType, Animal, User } from '../types/marisma';
import { CAPAS_PELAJES, toInputDate, fromInputDate } from '../constants/capas';
import {
  Award,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  ArrowLeft,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Check,
} from 'lucide-react';
import { formatDateDDMMYY } from '../utils/dateUtils';

interface StallionsViewProps {
  stallions: Stallion[];
  allStallions?: Stallion[];
  animals?: Animal[];
  owners: Owner[];
  activeCampaign: string;
  currentUser?: User;
  initialType?: 'TODOS' | AnimalType;
  backLabel?: string;
  onSaveStallion: (stallion: Stallion) => void;
  onDeleteStallion: (id: string) => void;
  onBack?: () => void;
}

export const StallionsView: React.FC<StallionsViewProps> = ({
  stallions,
  allStallions = [],
  animals = [],
  owners,
  activeCampaign,
  currentUser,
  initialType = 'TODOS',
  backLabel,
  onSaveStallion,
  onDeleteStallion,
  onBack,
}) => {
  const isReadOnly = currentUser?.rol !== 'ADMINISTRADOR';
  const [selectedType, setSelectedType] = useState<'TODOS' | AnimalType>(initialType);
  const [search, setSearch] = useState('');
  const [selectedStallion, setSelectedStallion] = useState<Stallion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Counts by species
  const counts = useMemo(() => {
    return {
      todos: stallions.length,
      equinos: stallions.filter((s) => s.tipo === 'EQUINO').length,
      bovinos: stallions.filter((s) => s.tipo === 'BOVINO').length,
    };
  }, [stallions]);

  // Filtered by species tab first, then search query
  const filteredStallions = useMemo(() => {
    return stallions
      .filter((s) => {
        if (selectedType === 'TODOS') return true;
        return s.tipo === selectedType;
      })
      .filter(
        (s) =>
          s.nombre.toLowerCase().includes(search.toLowerCase()) ||
          s.propietario.toLowerCase().includes(search.toLowerCase()) ||
          s.identificacionChip.includes(search) ||
          s.capa.toLowerCase().includes(search.toLowerCase())
      );
  }, [stallions, selectedType, search]);

  const defaultModalType: AnimalType =
    selectedType === 'BOVINO' ? 'BOVINO' : 'EQUINO';

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3.5 py-1.5 rounded-lg transition mb-3 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel || '← Volver al Listado de Ganado'}</span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                SEMENTALES AUTORIZADOS · HINOJOS
              </h1>
              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full border border-amber-300">
                Campaña {activeCampaign}
              </span>
            </div>
          </div>

          {!isReadOnly && (
            <button
              onClick={() => {
                setSelectedStallion(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white text-sm font-bold rounded-lg shadow-sm transition"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
              <span>NUEVO SEMENTAL</span>
            </button>
          )}
        </div>

        {/* Species Selector Tabs */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Todos tab */}
            <button
              type="button"
              onClick={() => setSelectedType('TODOS')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                selectedType === 'TODOS'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Todos los Sementales</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedType === 'TODOS'
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {counts.todos}
              </span>
            </button>

            {/* Equinos tab */}
            <button
              type="button"
              onClick={() => setSelectedType('EQUINO')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                selectedType === 'EQUINO'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span className="text-base leading-none">🐎</span>
              <span>Sementales Equinos (Caballos)</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedType === 'EQUINO'
                    ? 'bg-amber-950 text-white'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {counts.equinos}
              </span>
            </button>

            {/* Bovinos tab */}
            <button
              type="button"
              onClick={() => setSelectedType('BOVINO')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                selectedType === 'BOVINO'
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <span className="text-base leading-none">🐂</span>
              <span>Sementales Bovinos (Toros)</span>
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                  selectedType === 'BOVINO'
                    ? 'bg-emerald-950 text-white'
                    : 'bg-emerald-200 text-emerald-900'
                }`}
              >
                {counts.bovinos}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                selectedType === 'BOVINO'
                  ? 'Buscar por Toro, Ganadero, Crotal...'
                  : selectedType === 'EQUINO'
                  ? 'Buscar por Caballo, Ganadero, Chip...'
                  : 'Buscar semental, ganadero, chip, crotal...'
              }
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stallions Grid */}
      {filteredStallions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
          <p className="text-2xl mb-2">{selectedType === 'BOVINO' ? '🐂' : '🐎'}</p>
          <p className="text-base font-bold text-gray-800">
            {selectedType === 'BOVINO'
              ? 'No hay toros sementales bovinos que coincidan'
              : selectedType === 'EQUINO'
              ? 'No hay caballos sementales equinos que coincidan'
              : 'No hay sementales que coincidan'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {search
              ? 'Prueba a cambiar el texto de búsqueda.'
              : 'Puedes registrar un nuevo semental reproductor con el botón superior.'}
          </p>
          <button
            onClick={() => {
              setSelectedStallion(null);
              setIsModalOpen(true);
            }}
            className="mt-4 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>
              Registrar {selectedType === 'BOVINO' ? 'Toro Bovino' : 'Semental'}
            </span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStallions.map((st) => (
            <div
              key={st.id}
              className={`bg-white rounded-xl shadow-xs border transition overflow-hidden hover:shadow-md ${
                st.tipo === 'BOVINO'
                  ? 'border-emerald-200 hover:border-emerald-400'
                  : 'border-amber-200 hover:border-amber-400'
              }`}
            >
              {/* Species banner ribbon */}
              <div
                className={`px-4 py-1.5 text-[11px] font-bold flex items-center justify-between border-b ${
                  st.tipo === 'BOVINO'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-100'
                    : 'bg-amber-50 text-amber-900 border-amber-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{st.tipo === 'BOVINO' ? '🐂' : '🐎'}</span>
                  <span>{st.tipo === 'BOVINO' ? 'TORO SEMENTAL BOVINO' : 'CABALLO SEMENTAL EQUINO'}</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase ${
                    st.estadoAprobacion === 'AUTORIZADO'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {st.estadoAprobacion}
                </span>
              </div>

              <div className="p-5 space-y-3">
                <div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">
                    {st.nombre}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Capa: <strong>{st.capa}</strong> · Nacimiento: <strong>{formatDateDDMMYY(st.fechaNacimiento)}</strong>
                  </p>
                </div>

                <div
                  className={`space-y-1.5 text-xs p-3 rounded-lg border font-medium ${
                    st.tipo === 'BOVINO'
                      ? 'bg-emerald-50/40 text-gray-700 border-emerald-100'
                      : 'bg-amber-50/40 text-gray-700 border-amber-100'
                  }`}
                >
                  <div>
                    <span className="text-gray-500 text-[11px] block">Propietario / Ganadero:</span>
                    <span className="font-bold text-gray-900">{st.propietario}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 text-[11px] block">
                      {st.tipo === 'BOVINO' ? 'Identificación Crotal:' : 'Identificación Microchip:'}
                    </span>
                    <span className="font-mono text-gray-800 font-semibold">{st.identificacionChip}</span>
                  </div>
                  {st.ueln && st.ueln !== st.identificacionChip && (
                    <div>
                      <span className="text-gray-500 text-[11px] block">UELN / Pasaporte:</span>
                      <span className="font-mono text-gray-600 text-[11px]">{st.ueln}</span>
                    </div>
                  )}
                </div>

                {st.observaciones && (
                  <p className="text-xs text-gray-600 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    &quot;{st.observaciones}&quot;
                  </p>
                )}

                {!isReadOnly && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setSelectedStallion(st);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      title="Editar semental"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Eliminar al semental ${st.nombre}?`)) {
                          onDeleteStallion(st.id);
                        }
                      }}
                      className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                      title="Eliminar semental"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <StallionModal
          stallion={selectedStallion}
          defaultType={defaultModalType}
          lockedTipo={selectedType !== 'TODOS'}
          owners={owners}
          allStallions={allStallions.length > 0 ? allStallions : stallions}
          animals={animals}
          activeCampaign={activeCampaign}
          onClose={() => setIsModalOpen(false)}
          onSave={(st) => {
            onSaveStallion(st);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

interface StallionModalProps {
  stallion: Stallion | null;
  defaultType: AnimalType;
  lockedTipo?: boolean;
  owners: Owner[];
  allStallions: Stallion[];
  animals: Animal[];
  activeCampaign: string;
  onClose: () => void;
  onSave: (st: Stallion) => void;
}

const StallionModal: React.FC<StallionModalProps> = ({
  stallion,
  defaultType,
  lockedTipo = false,
  owners,
  allStallions,
  animals,
  activeCampaign,
  onClose,
  onSave,
}) => {
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const isEditing = Boolean(stallion);
  const [tipo, setTipo] = useState<AnimalType>(stallion?.tipo || defaultType);
  const [nombre, setNombre] = useState(stallion?.nombre || '');
  const [campana, setCampana] = useState(stallion?.campana || activeCampaign);
  const [propietario, setPropietario] = useState(stallion?.propietario || '');
  const [chip, setChip] = useState(stallion?.identificacionChip || '');
  const [ueln, setUeln] = useState(stallion?.ueln || '');
  const [fechaNacimiento, setFechaNacimiento] = useState(stallion?.fechaNacimiento || '');
  const [capa, setCapa] = useState(stallion?.capa || (tipo === 'BOVINO' ? 'CÁRDENA' : 'CASTAÑA'));
  const [estadoAprobacion, setEstadoAprobacion] = useState<'AUTORIZADO' | 'PENDIENTE_VALORACION' | 'NO_AUTORIZADO'>(
    stallion?.estadoAprobacion || 'AUTORIZADO'
  );
  const [observaciones, setObservaciones] = useState(stallion?.observaciones || '');

  // Propietarios filtrados por la campaña del semental y desduplicados
  const campaignOwners = React.useMemo(() => {
    const list = owners.filter((o) => !o.campana || o.campana === campana);
    const uniqueMap = new Map<string, Owner>();
    list.forEach((o) => {
      const key = (o.dniCif || o.nombreCompleto).trim().toUpperCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, o);
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' })
    );
  }, [owners, campana]);

  // Normalización del identificador microchip / crotal
  const cleanChip = (chip || '').trim().toUpperCase();
  const isChipValid = Boolean(isEditing || cleanChip.length >= 4);

  // 1. Control de duplicados en la campaña actual entre sementales
  const duplicateStallionInCurrentCampaign = useMemo(() => {
    if (isEditing || !cleanChip || cleanChip.length < 4) return null;
    return (
      allStallions.find(
        (s) =>
          s.campana === campana &&
          s.id !== stallion?.id &&
          (s.identificacionChip || '').trim().toUpperCase() === cleanChip
      ) || null
    );
  }, [allStallions, cleanChip, campana, isEditing, stallion]);

  // 2. Control de duplicados en la campaña actual entre animales del censo
  const duplicateAnimalInCurrentCampaign = useMemo(() => {
    if (isEditing || !cleanChip || cleanChip.length < 4) return null;
    return (
      animals.find(
        (a) =>
          a.campana === campana &&
          !a.esPlazaVacante &&
          (a.identificacion1 || '').trim().toUpperCase() === cleanChip
      ) || null
    );
  }, [animals, cleanChip, campana, isEditing]);

  // 3. Búsqueda de semental en histórico de otras campañas
  const historicalStallionMatch = useMemo(() => {
    if (isEditing || !cleanChip || cleanChip.length < 4) return null;
    if (duplicateStallionInCurrentCampaign || duplicateAnimalInCurrentCampaign) return null;
    return (
      allStallions.find(
        (s) =>
          s.campana !== campana &&
          s.id !== stallion?.id &&
          (s.identificacionChip || '').trim().toUpperCase() === cleanChip
      ) || null
    );
  }, [allStallions, cleanChip, campana, isEditing, duplicateStallionInCurrentCampaign, duplicateAnimalInCurrentCampaign, stallion]);

  // 4. Búsqueda en censo de animales (en caso de que estuviera registrado como animal general)
  const historicalAnimalMatch = useMemo(() => {
    if (isEditing || !cleanChip || cleanChip.length < 4) return null;
    if (duplicateStallionInCurrentCampaign || duplicateAnimalInCurrentCampaign || historicalStallionMatch) return null;
    return (
      animals.find(
        (a) =>
          a.campana !== campana &&
          !a.esPlazaVacante &&
          (a.identificacion1 || '').trim().toUpperCase() === cleanChip
      ) || null
    );
  }, [animals, cleanChip, campana, isEditing, duplicateStallionInCurrentCampaign, duplicateAnimalInCurrentCampaign, historicalStallionMatch]);

  const isStallionFormUnlocked = Boolean(
    isEditing || (isChipValid && !duplicateStallionInCurrentCampaign && !duplicateAnimalInCurrentCampaign)
  );

  // Manejador de carga de datos desde semental histórico
  const handleLoadHistoricalStallion = (st: Stallion) => {
    if (st.nombre) setNombre(st.nombre);
    if (st.tipo) setTipo(st.tipo);
    if (st.capa) setCapa(st.capa);
    if (st.fechaNacimiento) setFechaNacimiento(st.fechaNacimiento);
    if (st.ueln) setUeln(st.ueln);
    if (st.observaciones) setObservaciones(st.observaciones);
    if (st.propietario) {
      const matchOwner = campaignOwners.find(
        (o) => o.nombreCompleto.trim().toUpperCase() === st.propietario.trim().toUpperCase()
      );
      if (matchOwner) {
        setPropietario(matchOwner.nombreCompleto);
      }
    }
  };

  // Manejador de carga de datos desde animal histórico
  const handleLoadHistoricalAnimal = (anim: Animal) => {
    if (anim.nombreAnimal) setNombre(anim.nombreAnimal);
    if (anim.tipo) setTipo(anim.tipo);
    if (anim.capa) setCapa(anim.capa);
    if (anim.fechaNacimiento) setFechaNacimiento(anim.fechaNacimiento);
    if (anim.identificacion2) setUeln(anim.identificacion2);
    if (anim.propietario) {
      const matchOwner = campaignOwners.find(
        (o) => o.nombreCompleto.trim().toUpperCase() === anim.propietario.trim().toUpperCase()
      );
      if (matchOwner) {
        setPropietario(matchOwner.nombreCompleto);
      }
    }
  };

  // Autocarga de datos al detectar histórico
  useEffect(() => {
    if (!isEditing && isChipValid && isStallionFormUnlocked) {
      if (historicalStallionMatch && (!nombre || nombre === historicalStallionMatch.nombre)) {
        handleLoadHistoricalStallion(historicalStallionMatch);
      } else if (historicalAnimalMatch && (!nombre || nombre === historicalAnimalMatch.nombreAnimal)) {
        handleLoadHistoricalAnimal(historicalAnimalMatch);
      }
    }
  }, [historicalStallionMatch, historicalAnimalMatch, isChipValid, isStallionFormUnlocked, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStallionFormUnlocked) return;

    if (duplicateStallionInCurrentCampaign) {
      alert(`El identificador ya está asignado al semental "${duplicateStallionInCurrentCampaign.nombre}" en esta campaña.`);
      return;
    }
    if (duplicateAnimalInCurrentCampaign) {
      alert(`El identificador ya pertenece al animal "${duplicateAnimalInCurrentCampaign.nombreAnimal}" en esta campaña.`);
      return;
    }
    if (!nombre.trim() || !propietario.trim() || !chip.trim()) {
      alert('Identificación, nombre y propietario son obligatorios.');
      return;
    }

    const saved: Stallion = {
      id: stallion?.id || `sta-${Date.now()}`,
      tipo,
      campana,
      nombre: nombre.trim().toUpperCase(),
      propietario: propietario.trim().toUpperCase(),
      identificacionChip: chip.trim().toUpperCase(),
      ueln: ueln.trim() || chip.trim().toUpperCase(),
      fechaNacimiento: fechaNacimiento.trim(),
      capa: capa.trim().toUpperCase(),
      estadoAprobacion,
      observaciones: observaciones.trim(),
    };
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-300" />
            <h2 className="text-base font-bold">
              {stallion
                ? `Editar Semental: ${stallion.nombre}`
                : `Nuevo Semental Reproductor (${tipo === 'BOVINO' ? 'Toro Bovino' : 'Caballo Equino'})`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          {/* CAMPO 1 OBLIGATORIO: MICROCHIP / CROTAL IDENTIFICATIVO */}
          <div className="p-3.5 bg-slate-50 border-2 border-emerald-500/30 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800">
                {tipo === 'BOVINO'
                  ? '1. Crotal Oficial del Semental *'
                  : '1. Microchip Identificativo del Semental *'}
              </label>
              {!isEditing && (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Paso 1: Identificador Obligatorio
                </span>
              )}
            </div>

            <input
              type="text"
              value={chip}
              onChange={(e) => setChip(e.target.value.toUpperCase())}
              placeholder={tipo === 'BOVINO' ? 'ej. ES012104000999...' : 'ej. 724019010080788'}
              className={`w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-lg uppercase font-mono font-bold tracking-wider transition ${
                duplicateStallionInCurrentCampaign || duplicateAnimalInCurrentCampaign
                  ? 'border-rose-500 bg-rose-50 text-rose-950 focus:ring-rose-500'
                  : historicalStallionMatch || historicalAnimalMatch
                  ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 focus:ring-emerald-600'
                  : isChipValid
                  ? 'border-emerald-500 bg-white text-gray-900 focus:ring-emerald-500'
                  : 'border-gray-300 bg-white text-gray-900'
              }`}
              required
              autoFocus={!isEditing}
            />

            {/* Ayuda si aún no se ha ingresado un chip válido */}
            {!isEditing && !isChipValid && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Introduzca el {tipo === 'BOVINO' ? 'Crotal' : 'Microchip'} (mínimo 4 caracteres) para comprobar si existe en otras campañas y activar el resto del formulario.
                </span>
              </p>
            )}

            {/* Alerta de duplicado en la campaña activa (como semental) */}
            {duplicateStallionInCurrentCampaign && (
              <div className="text-xs text-rose-800 bg-rose-50 p-3 rounded-lg border border-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-0.5">
                  <p className="font-bold">¡Semental ya registrado en esta campaña ({campana})!</p>
                  <p className="text-[11px] text-rose-700">
                    Pertenece a: <strong>{duplicateStallionInCurrentCampaign.propietario}</strong> · Nombre: <strong>{duplicateStallionInCurrentCampaign.nombre}</strong>. No se permiten duplicados en la misma campaña.
                  </p>
                </div>
              </div>
            )}

            {/* Alerta de duplicado en la campaña activa (como animal del censo) */}
            {!duplicateStallionInCurrentCampaign && duplicateAnimalInCurrentCampaign && (
              <div className="text-xs text-rose-800 bg-rose-50 p-3 rounded-lg border border-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-0.5">
                  <p className="font-bold">¡Microchip ya asignado a un animal del censo en esta campaña ({campana})!</p>
                  <p className="text-[11px] text-rose-700">
                    Animal: <strong>{duplicateAnimalInCurrentCampaign.nombreAnimal}</strong> · Ganadero: <strong>{duplicateAnimalInCurrentCampaign.propietario}</strong> (Plaza {duplicateAnimalInCurrentCampaign.plazaNumero}).
                  </p>
                </div>
              </div>
            )}

            {/* Coincidencia con semental histórico */}
            {!duplicateStallionInCurrentCampaign && !duplicateAnimalInCurrentCampaign && historicalStallionMatch && (
              <div className="text-xs text-emerald-900 bg-emerald-50/80 p-3 rounded-lg border border-emerald-300 space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ¡Semental encontrado en histórico (Campaña {historicalStallionMatch.campana})!
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadHistoricalStallion(historicalStallionMatch)}
                    className="text-[11px] font-bold px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition shadow-xs"
                  >
                    Recargar Datos
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Datos recuperados: <strong>{historicalStallionMatch.nombre}</strong> ({historicalStallionMatch.capa}). Propietario anterior: <em>{historicalStallionMatch.propietario}</em>. Puede revisar y guardar.
                </p>
              </div>
            )}

            {/* Coincidencia con animal histórico del censo */}
            {!duplicateStallionInCurrentCampaign && !duplicateAnimalInCurrentCampaign && !historicalStallionMatch && historicalAnimalMatch && (
              <div className="text-xs text-emerald-900 bg-emerald-50/80 p-3 rounded-lg border border-emerald-300 space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ¡Animal localizado en censo histórico (Campaña {historicalAnimalMatch.campana})!
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLoadHistoricalAnimal(historicalAnimalMatch)}
                    className="text-[11px] font-bold px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition shadow-xs"
                  >
                    Recargar Datos
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Datos cargados: <strong>{historicalAnimalMatch.nombreAnimal}</strong> ({historicalAnimalMatch.capa}). Propietario: <em>{historicalAnimalMatch.propietario}</em>.
                </p>
              </div>
            )}

            {/* Chip nuevo válido */}
            {!duplicateStallionInCurrentCampaign && !duplicateAnimalInCurrentCampaign && !historicalStallionMatch && !historicalAnimalMatch && isChipValid && !isEditing && (
              <p className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                {tipo === 'BOVINO' ? 'Crotal' : 'Microchip'} nuevo sin duplicados · Formulario activado.
              </p>
            )}
          </div>

          {/* RESTO DEL FORMULARIO: BLOQUEADO HASTA VALIDAR EL MICROCHIP / CROTAL */}
          <fieldset
            disabled={!isStallionFormUnlocked}
            className={`space-y-3.5 transition-opacity ${
              !isStallionFormUnlocked ? 'opacity-40 pointer-events-none select-none' : ''
            }`}
          >
            {/* Species Selector buttons or locked banner */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Especie de Semental *
              </label>
              {lockedTipo ? (
                <div className="w-full text-xs font-bold py-2.5 px-3 rounded-lg border bg-gray-100 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-gray-900 text-sm">
                    <span>{tipo === 'BOVINO' ? '🐂' : '🐎'}</span>
                    <span>{tipo === 'BOVINO' ? 'Semental Bovino (Toro)' : 'Semental Equino (Caballo)'}</span>
                  </span>
                  <span className="text-[10px] text-gray-500 font-semibold bg-white px-2 py-0.5 rounded border border-gray-200">
                    Exclusivo según filtro activo
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!isStallionFormUnlocked}
                    onClick={() => setTipo('EQUINO')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      tipo === 'EQUINO'
                        ? 'bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-400'
                        : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">🐎</span>
                    <span>Equino (Caballo)</span>
                  </button>

                  <button
                    type="button"
                    disabled={!isStallionFormUnlocked}
                    onClick={() => setTipo('BOVINO')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      tipo === 'BOVINO'
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-500 ring-2 ring-emerald-500'
                        : 'bg-gray-50 text-gray-600 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">🐂</span>
                    <span>Bovino (Toro)</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Campaña</label>
                <input
                  type="text"
                  disabled={!isStallionFormUnlocked}
                  value={campana}
                  onChange={(e) => setCampana(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  F.N. (Nacimiento)
                </label>
                <div className="relative flex items-center">
                  <input
                    type="date"
                    disabled={!isStallionFormUnlocked}
                    value={toInputDate(fechaNacimiento)}
                    onChange={(e) => {
                      if (e.target.value) {
                        setFechaNacimiento(fromInputDate(e.target.value));
                      } else {
                        setFechaNacimiento('');
                      }
                    }}
                    onClick={(e) => {
                      try {
                        (e.currentTarget as any).showPicker?.();
                      } catch {}
                    }}
                    className="w-full text-xs sm:text-sm px-3 py-2 pr-9 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    title="Haz clic para abrir el calendario"
                  />
                  <Calendar className="w-4 h-4 text-emerald-700 absolute right-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Nombre del {tipo === 'BOVINO' ? 'Toro' : 'Semental'} *
              </label>
              <input
                type="text"
                disabled={!isStallionFormUnlocked}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder={tipo === 'BOVINO' ? 'ej. BRAVÍO HINOJOS' : 'ej. FARAÓN HI'}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg uppercase font-bold text-gray-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Propietario / Ganadero *</label>
              <select
                disabled={!isStallionFormUnlocked}
                value={propietario}
                onChange={(e) => setPropietario(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium"
                required
              >
                <option value="">-- Seleccionar Ganadero de la Campaña ({campana}) --</option>
                {propietario && !campaignOwners.some((o) => o.nombreCompleto === propietario) && (
                  <option value={propietario}>{propietario} (Actual)</option>
                )}
                {campaignOwners.map((o) => (
                  <option key={o.id} value={o.nombreCompleto}>
                    {o.nombreCompleto} {o.codigoRega ? `(${o.codigoRega})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Capa / Pelaje *</label>
                <select
                  disabled={!isStallionFormUnlocked}
                  value={capa}
                  onChange={(e) => setCapa(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-semibold cursor-pointer"
                  required
                >
                  <option value="">-- Seleccionar Capa --</option>
                  {capa && !CAPAS_PELAJES.includes(capa) && (
                    <option value={capa}>{capa} (Actual)</option>
                  )}
                  {CAPAS_PELAJES.map((item, idx) => (
                    <option
                      key={`${item}-${idx}`}
                      value={item === '---------' ? '' : item}
                      disabled={item === '---------'}
                      className={item === '---------' ? 'font-bold text-gray-400 text-center tracking-widest' : ''}
                    >
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  UELN / Pasaporte Equino
                </label>
                <input
                  type="text"
                  disabled={!isStallionFormUnlocked}
                  value={ueln}
                  onChange={(e) => setUeln(e.target.value)}
                  placeholder="ej. 724901000..."
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Estado Autorización *</label>
                <select
                  disabled={!isStallionFormUnlocked}
                  value={estadoAprobacion}
                  onChange={(e) => setEstadoAprobacion(e.target.value as any)}
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg font-semibold"
                >
                  <option value="AUTORIZADO">🟢 AUTORIZADO</option>
                  <option value="PENDIENTE_VALORACION">🟡 PENDIENTE VALORACIÓN</option>
                  <option value="NO_AUTORIZADO">🔴 NO AUTORIZADO</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Observaciones</label>
              <textarea
                disabled={!isStallionFormUnlocked}
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Anotaciones de genealogía, comportamiento, etc."
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </fieldset>

          <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isStallionFormUnlocked}
              className={`flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg shadow-xs transition active:scale-95 ${
                !isStallionFormUnlocked
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                  : 'bg-[#008744] hover:bg-[#00743a]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Guardar Cambios' : 'Guardar Semental'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
