import React, { useState, useMemo } from 'react';
import { Animal, AnimalType, Owner, User } from '../types/marisma';
import { CAPAS_PELAJES } from '../constants/capas';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Filter,
  Eye,
  Edit2,
  Trash2,
  ArrowLeftRight,
  FileText,
  CheckCircle2,
  Calendar,
  Baby,
  ChevronDown,
  X,
  Award,
  Repeat,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { SwapPlazasModal } from './SwapPlazasModal';
import { formatDateDDMMYY } from '../utils/dateUtils';

interface AnimalTableProps {
  tipo: AnimalType;
  animals: Animal[];
  owners: Owner[];
  campaigns?: string[];
  activeCampaign: string;
  currentUser?: User;
  onChangeCampaign?: (campana: string) => void;
  onAddAnimal: () => void;
  onEditAnimal: (animal: Animal) => void;
  onViewAnimal: (animal: Animal) => void;
  onDeleteAnimal: (animal: Animal) => void;
  onRegisterMovement: (animal: Animal) => void;
  onAssignPlaza?: (vacantPlaza: Animal) => void;
  onExportCSV: () => void;
  onOpenStallions?: () => void;
  onSwapPlazas?: (animalAId: string, animalBId: string, motivo?: string) => void;
}

export const AnimalTable: React.FC<AnimalTableProps> = ({
  tipo,
  animals,
  owners: _owners,
  campaigns,
  activeCampaign,
  currentUser,
  onChangeCampaign,
  onAddAnimal,
  onEditAnimal,
  onViewAnimal,
  onDeleteAnimal,
  onRegisterMovement,
  onAssignPlaza,
  onExportCSV,
  onOpenStallions,
  onSwapPlazas,
}) => {
  const isReadOnly = currentUser?.rol !== 'ADMINISTRADOR';
  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'TODOS' | 'DENTRO' | 'FUERA' | 'VACANTES' | 'CON_RASTRA'>('TODOS');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [animalToDelete, setAnimalToDelete] = useState<Animal | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapTargetAnimal, setSwapTargetAnimal] = useState<Animal | null>(null);

  // Field-specific search filters
  const [filterPlaza, setFilterPlaza] = useState('');
  const [filterPropietario, setFilterPropietario] = useState('');
  const [filterId1, setFilterId1] = useState('');
  const [filterId2, setFilterId2] = useState('');
  const [filterNombre, setFilterNombre] = useState('');
  const [filterSexo, setFilterSexo] = useState('');
  const [filterCapa, setFilterCapa] = useState('');
  const [filterRastra, setFilterRastra] = useState('');

  // Sorting state: 'plaza' (por defecto) o 'propietario'
  const [sortBy, setSortBy] = useState<'plaza' | 'propietario'>('plaza');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter animals by active campaign and sort dynamically (por Nº Plaza o por Propietario)
  const campaignAnimals = useMemo(() => {
    const list = animals.filter(
      (a) => a.campana === activeCampaign && a.tipo === tipo && Boolean(a.plazaNumero && a.plazaNumero.trim() !== '')
    );

    return [...list].sort((a, b) => {
      if (sortBy === 'propietario') {
        const ownerA = (a.propietario || '').trim().toLowerCase();
        const ownerB = (b.propietario || '').trim().toLowerCase();
        const comp = ownerA.localeCompare(ownerB, 'es', { sensitivity: 'base' });
        if (comp !== 0) {
          return sortDirection === 'asc' ? comp : -comp;
        }
        // Desempate secundario por número de plaza en orden natural
        const matchA = a.plazaNumero.trim().match(/^([A-Z]+)(\d+)/i);
        const matchB = b.plazaNumero.trim().match(/^([A-Z]+)(\d+)/i);
        if (matchA && matchB) {
          if (matchA[1].toUpperCase() !== matchB[1].toUpperCase()) {
            return matchA[1].localeCompare(matchB[1]);
          }
          return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
        }
        return a.plazaNumero.localeCompare(b.plazaNumero, undefined, { numeric: true, sensitivity: 'base' });
      }

      // Orden estándar por Nº Plaza
      const matchA = a.plazaNumero.trim().match(/^([A-Z]+)(\d+)/i);
      const matchB = b.plazaNumero.trim().match(/^([A-Z]+)(\d+)/i);
      let comp = 0;
      if (matchA && matchB) {
        if (matchA[1].toUpperCase() !== matchB[1].toUpperCase()) {
          comp = matchA[1].localeCompare(matchB[1]);
        } else {
          comp = parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
        }
      } else {
        comp = a.plazaNumero.localeCompare(b.plazaNumero, undefined, { numeric: true, sensitivity: 'base' });
      }
      return sortDirection === 'asc' ? comp : -comp;
    });
  }, [animals, activeCampaign, tipo, sortBy, sortDirection]);

  // Apply search and status tab filters
  const filteredAnimals = useMemo(() => {
    return campaignAnimals.filter((animal) => {
      // Status Tab filter
      if (selectedStatusTab === 'DENTRO' && (animal.esPlazaVacante || animal.estadoPresencia !== 'DENTRO')) return false;
      if (selectedStatusTab === 'FUERA' && (animal.esPlazaVacante || animal.estadoPresencia !== 'FUERA')) return false;
      if (selectedStatusTab === 'VACANTES' && !animal.esPlazaVacante && animal.estadoPresencia !== 'PLAZA_VACANTE') return false;
      if (selectedStatusTab === 'CON_RASTRA' && !animal.rastra) return false;

      // Global text query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchGlobal =
          animal.plazaNumero.toLowerCase().includes(query) ||
          animal.propietario.toLowerCase().includes(query) ||
          animal.identificacion1.toLowerCase().includes(query) ||
          animal.identificacion2.toLowerCase().includes(query) ||
          animal.nombreAnimal.toLowerCase().includes(query) ||
          animal.capa.toLowerCase().includes(query) ||
          (animal.fechaUltimaRevision && animal.fechaUltimaRevision.toLowerCase().includes(query)) ||
          (animal.rastra?.nombre && animal.rastra.nombre.toLowerCase().includes(query)) ||
          (animal.rastra?.rastrasChip && animal.rastra.rastrasChip.toLowerCase().includes(query));

        if (!matchGlobal) return false;
      }

      // Advanced column filters
      if (filterPlaza && !animal.plazaNumero.toLowerCase().includes(filterPlaza.toLowerCase())) return false;
      if (filterPropietario && !animal.propietario.toLowerCase().includes(filterPropietario.toLowerCase())) return false;
      if (filterId1 && !animal.identificacion1.toLowerCase().includes(filterId1.toLowerCase())) return false;
      if (filterId2 && !animal.identificacion2.toLowerCase().includes(filterId2.toLowerCase())) return false;
      if (filterNombre && !animal.nombreAnimal.toLowerCase().includes(filterNombre.toLowerCase())) return false;
      if (filterSexo && animal.sexo !== filterSexo) return false;
      if (filterCapa && !animal.capa.toLowerCase().includes(filterCapa.toLowerCase())) return false;
      if (filterRastra === 'SI' && !animal.rastra) return false;
      if (filterRastra === 'NO' && animal.rastra) return false;

      return true;
    });
  }, [
    campaignAnimals,
    selectedStatusTab,
    searchQuery,
    filterPlaza,
    filterPropietario,
    filterId1,
    filterId2,
    filterNombre,
    filterSexo,
    filterCapa,
    filterRastra,
  ]);

  // Statistics counts for the tabs
  const counts = useMemo(() => {
    return {
      todos: campaignAnimals.length,
      dentro: campaignAnimals.filter((a) => !a.esPlazaVacante && a.estadoPresencia === 'DENTRO').length,
      fuera: campaignAnimals.filter((a) => !a.esPlazaVacante && a.estadoPresencia === 'FUERA').length,
      vacantes: campaignAnimals.filter((a) => a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE').length,
      conRastra: campaignAnimals.filter((a) => !a.esPlazaVacante && !!a.rastra).length,
    };
  }, [campaignAnimals]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStatusTab('TODOS');
    setFilterPlaza('');
    setFilterPropietario('');
    setFilterId1('');
    setFilterId2('');
    setFilterNombre('');
    setFilterSexo('');
    setFilterCapa('');
    setFilterRastra('');
    setSortBy('plaza');
    setSortDirection('asc');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedStatusTab !== 'TODOS' ||
    Boolean(filterPlaza) ||
    Boolean(filterPropietario) ||
    Boolean(filterId1) ||
    Boolean(filterId2) ||
    Boolean(filterNombre) ||
    Boolean(filterSexo) ||
    Boolean(filterCapa) ||
    Boolean(filterRastra);

  return (
    <div className="space-y-4">
      {/* Top Banner & Actions Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              LISTADO DE {tipo === 'EQUINO' ? 'EQUINOS' : 'BOVINOS'}
            </h1>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border transition shadow-xs ${
                showAdvancedFilters
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300'
              }`}
              title="Mostrar u ocultar filtros avanzados por columnas"
            >
              <Filter className="w-4 h-4 text-emerald-700" />
              <span>Filtros Detallados</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
            </button>

            {onOpenStallions && (
              <button
                onClick={onOpenStallions}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs sm:text-sm font-bold rounded-lg shadow-xs transition"
                title={tipo === 'BOVINO' ? 'Ver registro municipal de toros sementales autorizados' : 'Ver registro municipal de sementales autorizados'}
              >
                <Award className="w-4 h-4 text-amber-700" />
                <span>SEMENTALES</span>
              </button>
            )}

            {onSwapPlazas && (
              <button
                type="button"
                onClick={() => {
                  setSwapTargetAnimal(null);
                  setIsSwapModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200 text-xs sm:text-sm font-bold rounded-lg shadow-xs transition"
                title="Intercambiar / permutar animales entre dos plazas de la campaña"
              >
                <Repeat className="w-4 h-4 text-indigo-700" />
                <span>INTERCAMBIAR PLAZAS</span>
              </button>
            )}

            <button
              onClick={onExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium rounded-lg shadow-sm transition"
              title={
                tipo === 'EQUINO'
                  ? 'Descargar Libro Oficial ODS de Equinos (4 Hojas: Censo, Sementales, Expedientes y Movimientos)'
                  : 'Descargar Censo Oficial ODS de Bovinos (Hoja única con formato oficial Hinojos)'
              }
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Exportar Excel</span>
            </button>

            {!isReadOnly && (
              <button
                onClick={onAddAnimal}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition transform active:scale-95"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>NUEVO ANIMAL</span>
              </button>
            )}
          </div>
        </div>

        {/* Campaign badge, compact Search bar, and Status Filter Tabs consolidated in one row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
          {/* Campaign badge (Sólo lectura, cambio exclusivo desde Ajustes) */}
          <div
            className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-1.5 shrink-0 shadow-xs"
            title="Campaña activa de trabajo (modificable desde Ajustes)"
          >
            <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Campaña:</span>
            <span className="text-xs sm:text-sm font-black text-emerald-950 font-mono tracking-tight">
              {activeCampaign}
            </span>
            <span className="ml-1 text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.2 rounded-full uppercase">
              Activa
            </span>
          </div>

          {/* Narrower Search bar */}
          <div className="relative w-44 sm:w-56 md:w-60 shrink-0">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tipo === 'BOVINO' ? 'Buscar plaza, ganadero, crotal...' : 'Buscar plaza, ganadero, chip...'}
              className="w-full pl-8 pr-7 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs directly alongside the search bar */}
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-[280px]">
            <button
              onClick={() => setSelectedStatusTab('TODOS')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedStatusTab === 'TODOS'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>Todos</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${selectedStatusTab === 'TODOS' ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {counts.todos}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatusTab('DENTRO')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedStatusTab === 'DENTRO'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>En Marisma</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${selectedStatusTab === 'DENTRO' ? 'bg-emerald-800 text-white' : 'bg-emerald-200/80 text-emerald-900'}`}>
                {counts.dentro}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatusTab('FUERA')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedStatusTab === 'FUERA'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Fuera (Temporal)</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${selectedStatusTab === 'FUERA' ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-950 font-bold'}`}>
                {counts.fuera}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatusTab('VACANTES')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedStatusTab === 'VACANTES'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Plazas Vacantes</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${selectedStatusTab === 'VACANTES' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900 font-bold'}`}>
                {counts.vacantes}
              </span>
            </button>

            <button
              onClick={() => setSelectedStatusTab('CON_RASTRA')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                selectedStatusTab === 'CON_RASTRA'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Con Rastra (Cría)</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${selectedStatusTab === 'CON_RASTRA' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                {counts.conRastra}
              </span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 ml-auto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvancedFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 bg-slate-50 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Filtros por Columna Específica
              </span>
              <button
                onClick={clearAllFilters}
                className="text-xs text-rose-600 hover:underline font-medium"
              >
                Restablecer todos
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Nº Plaza:</label>
                <input
                  type="text"
                  value={filterPlaza}
                  onChange={(e) => setFilterPlaza(e.target.value)}
                  placeholder="ej. HI001"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Propietario:</label>
                <input
                  type="text"
                  value={filterPropietario}
                  onChange={(e) => setFilterPropietario(e.target.value)}
                  placeholder="ej. Candido Naranjo"
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Identificación 1 (Chip):</label>
                <input
                  type="text"
                  value={filterId1}
                  onChange={(e) => setFilterId1(e.target.value)}
                  placeholder="ej. 724019..."
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Identificación 2 (UELN):</label>
                <input
                  type="text"
                  value={filterId2}
                  onChange={(e) => setFilterId2(e.target.value)}
                  placeholder="ej. 724901..."
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {tipo === 'EQUINO' && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">Nombre Animal:</label>
                  <input
                    type="text"
                    value={filterNombre}
                    onChange={(e) => setFilterNombre(e.target.value)}
                    placeholder="ej. Niebla, Borgoña..."
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Sexo:</label>
                <select
                  value={filterSexo}
                  onChange={(e) => setFilterSexo(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Cualquiera</option>
                  <option value="H">Hembra (H)</option>
                  <option value="M">Macho (M)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Capa / Pelaje:</label>
                <input
                  type="text"
                  list="capas-filter-list"
                  value={filterCapa}
                  onChange={(e) => setFilterCapa(e.target.value)}
                  placeholder="ej. Tordo, Castaño..."
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                />
                <datalist id="capas-filter-list">
                  {CAPAS_PELAJES.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Tiene Rastra (Cría):</label>
                <select
                  value={filterRastra}
                  onChange={(e) => setFilterRastra(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Todos</option>
                  <option value="SI">Solo Con Rastra</option>
                  <option value="NO">Sin Rastra</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#111827] text-white border-b border-gray-800 text-[11px] font-bold tracking-wider uppercase leading-tight">
                <th
                  onClick={() => {
                    if (sortBy === 'plaza') {
                      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    } else {
                      setSortBy('plaza');
                      setSortDirection('asc');
                    }
                  }}
                  className={`py-2.5 px-2 text-center whitespace-nowrap cursor-pointer transition select-none group ${
                    sortBy === 'plaza'
                      ? 'bg-gray-800 text-emerald-400 font-black'
                      : 'hover:bg-gray-800/80 text-gray-200'
                  }`}
                  title="Ordenar por Nº de Plaza (haz clic para alternar ascendente/descendente o volver al orden de plazas original)"
                >
                  <div className="inline-flex items-center gap-1.5 justify-center">
                    <span>Nº PLAZA</span>
                    {sortBy === 'plaza' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-gray-400 group-hover:text-white shrink-0 opacity-70" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => {
                    if (sortBy === 'propietario') {
                      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    } else {
                      setSortBy('propietario');
                      setSortDirection('asc');
                    }
                  }}
                  className={`py-2.5 px-2 w-[180px] max-w-[180px] leading-tight cursor-pointer transition select-none group ${
                    sortBy === 'propietario'
                      ? 'bg-gray-800 text-emerald-400 font-black'
                      : 'hover:bg-gray-800/80 text-gray-200'
                  }`}
                  title="Ordenar alfabéticamente por Titular / Ganadero (agrupa todos los animales del mismo titular)"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span>PROPIETARIO / GANADERO</span>
                    {sortBy === 'propietario' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-gray-400 group-hover:text-white shrink-0 opacity-70" />
                    )}
                  </div>
                </th>
                <th className="py-2.5 px-2 whitespace-nowrap">
                  <div>IDENTIFICACIÓN</div>
                  <div className="text-[10px] text-gray-300 font-normal">
                    {tipo === 'BOVINO' ? 'CROTAL' : 'CHIP / UELN'}
                  </div>
                </th>
                {tipo === 'EQUINO' && (
                  <th className="py-2.5 px-2 w-[135px] max-w-[135px] leading-tight">NOMBRE ANIMAL</th>
                )}
                <th className="py-2.5 px-1.5 text-center whitespace-nowrap">
                  <div>F.N. / SEXO</div>
                  <div className="text-[10px] text-gray-300 font-normal">NACIMIENTO</div>
                </th>
                <th className="py-2.5 px-1.5 whitespace-nowrap">CAPA</th>
                <th className="py-2.5 px-2 whitespace-nowrap text-center">
                  <div>FECHA UL RV</div>
                  <div className="text-[10px] text-gray-300 font-normal">ESTADO</div>
                </th>
                <th className="py-2.5 px-2 whitespace-nowrap bg-emerald-950/80 text-emerald-200">
                  <div>RASTRA</div>
                  <div className="text-[10px] text-emerald-300 font-normal">(CRÍA AL PIE)</div>
                </th>
                <th className="py-2.5 px-1 text-center whitespace-nowrap">DOCS / NOTAS</th>
                <th className="py-2.5 px-1.5 text-center whitespace-nowrap">GESTIÓN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredAnimals.length === 0 ? (
                <tr>
                  <td colSpan={tipo === 'BOVINO' ? 9 : 10} className="py-12 text-center text-gray-500">
                    <p className="text-base font-semibold text-gray-700">No se encontraron animales</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {hasActiveFilters
                        ? 'Prueba a cambiar o eliminar los filtros aplicados.'
                        : 'No hay registros cargados en esta campaña.'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-3 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium"
                      >
                        Quitar todos los filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredAnimals.map((animal, idx) => {
                  const prevAnimal = idx > 0 ? filteredAnimals[idx - 1] : null;
                  const isNewOwner =
                    !prevAnimal ||
                    prevAnimal.propietario.trim().toLowerCase() !== animal.propietario.trim().toLowerCase();
                  const ownerBorderClass = idx > 0 && isNewOwner ? 'border-t-2 border-t-slate-400' : '';

                  if (animal.esPlazaVacante || animal.estadoPresencia === 'PLAZA_VACANTE') {
                    return (
                      <tr
                        key={animal.id}
                        className={`bg-rose-50/20 hover:bg-rose-50/50 transition-colors border-l-4 border-l-rose-500 ${ownerBorderClass}`}
                      >
                        {/* Nº Plaza */}
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap font-mono font-bold text-gray-900">
                          <span className="bg-rose-100 text-rose-950 px-2 py-0.5 rounded border border-rose-300 text-xs font-black">
                            {animal.plazaNumero}
                          </span>
                        </td>

                        {/* Propietario en 2 líneas sin aumentar altura */}
                        <td className="py-2 px-2 w-[170px] max-w-[170px]">
                          <div
                            className="font-bold text-gray-900 text-xs leading-tight line-clamp-2 break-words"
                            title={animal.propietario}
                          >
                            {animal.propietario}
                          </div>
                        </td>

                        {/* Identificación */}
                        <td className="py-2.5 px-2 whitespace-nowrap font-mono text-xs text-gray-400 italic">
                          (Sin identificar)
                        </td>

                        {/* Nombre Animal: vacante */}
                        {tipo === 'EQUINO' && (
                          <td className="py-2.5 px-2 text-center text-xs text-gray-400">
                            -
                          </td>
                        )}

                        {/* F.N. + Sexo */}
                        <td className="py-2.5 px-1.5 text-center text-xs text-gray-400">
                          -
                        </td>

                        {/* Capa */}
                        <td className="py-2.5 px-1.5 text-xs text-gray-400">
                          -
                        </td>

                        {/* Fecha Última Revisión / Estado: Libre */}
                        <td className="py-2.5 px-2 whitespace-nowrap text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Libre
                            </span>
                            <span className="font-mono text-xs font-semibold text-rose-950">
                              {formatDateDDMMYY(animal.fechaSalidaMarisma || animal.fechaUltimaRevision)}
                            </span>
                          </div>
                        </td>

                        {/* Rastra */}
                        <td className="py-2.5 px-2 whitespace-nowrap text-center text-xs text-gray-400">
                          -
                        </td>

                        {/* Docs */}
                        <td className="py-2.5 px-1 text-center whitespace-nowrap text-xs text-gray-400">
                          -
                        </td>

                        {/* Gestión */}
                        <td
                          className="py-2.5 px-1.5 text-center whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setAnimalToDelete(animal)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded transition cursor-pointer"
                              title="Eliminar plaza vacante del censo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  const hasRastra = !!animal.rastra;
                  const isFuera = animal.estadoPresencia === 'FUERA';
                  const leftBorderClass = isFuera
                    ? 'border-l-4 border-l-amber-500'
                    : 'border-l-4 border-l-emerald-600';
                  const bgHoverClass = isFuera ? 'hover:bg-amber-50/30' : 'hover:bg-slate-50/80';

                  return (
                    <tr
                      key={animal.id}
                      className={`${leftBorderClass} ${bgHoverClass} ${ownerBorderClass} transition-colors group`}
                    >
                      {/* Nº Plaza */}
                      <td className="py-2.5 px-1.5 text-center whitespace-nowrap font-mono font-bold text-gray-900">
                        <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-300 text-xs">
                          {animal.plazaNumero}
                        </span>
                      </td>

                      {/* Propietario en 2 líneas sin aumentar altura */}
                      <td className="py-2 px-2 w-[170px] max-w-[170px]">
                        <div
                          className="font-medium text-gray-900 text-xs leading-tight line-clamp-2 break-words"
                          title={animal.propietario}
                        >
                          {animal.propietario}
                        </div>
                      </td>

                      {/* Identificación 1 (Chip) e Identificación 2 (UELN) en segunda línea */}
                      <td className="py-2.5 px-2 whitespace-nowrap font-mono text-xs">
                        <div className="font-semibold text-gray-900">
                          {animal.identificacion1 || '-'}
                        </div>
                        {animal.identificacion2 && (
                          <div className="text-[11px] text-gray-500 font-normal">
                            {animal.identificacion2}
                          </div>
                        )}
                      </td>

                      {/* Nombre Animal (solo el nombre en equinos) */}
                      {tipo === 'EQUINO' && (
                        <td className="py-2.5 px-2 w-[135px] max-w-[135px] font-bold text-emerald-950 text-xs leading-snug break-words">
                          {animal.nombreAnimal}
                        </td>
                      )}

                      {/* F.N. + Sexo Unificado (Formato dd/mm/yy y sin color rojo) */}
                      <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                        <div className="font-mono text-xs font-semibold text-gray-800">
                          {formatDateDDMMYY(animal.fechaNacimiento)}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                              animal.sexo === 'H'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {animal.sexo === 'H' ? 'H (Hembra)' : 'M (Macho)'}
                          </span>
                        </div>
                      </td>

                      {/* Capa */}
                      <td className="py-2.5 px-1.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                          {animal.capa}
                        </span>
                      </td>

                      {/* Fecha Ultima Revision / Estado en marisma: Rectángulo arriba, fecha dd/mm/yy abajo */}
                      <td className="py-2.5 px-2 whitespace-nowrap text-center">
                        <div className="inline-flex flex-col items-center gap-1">
                          {isFuera ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300">
                              🟡 Fuera (Temporal)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              🟢 En Marisma
                            </span>
                          )}
                          <span className="font-mono text-xs font-semibold text-gray-700">
                            {formatDateDDMMYY(animal.fechaUltimaRevision || animal.fechaEntradaMarisma)}
                          </span>
                        </div>
                      </td>

                      {/* Rastra (Cría) - Sin capa */}
                      <td className="py-2.5 px-2 whitespace-nowrap bg-emerald-50/40 border-l border-r border-emerald-100">
                        {hasRastra ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <span className="font-bold text-emerald-950 text-xs">
                                🍼 {animal.rastra?.nombre}
                              </span>
                              <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1 rounded font-bold">
                                {animal.rastra?.sexo}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono">
                              {tipo === 'BOVINO' ? 'Crotal:' : 'Chip:'}{' '}
                              {animal.rastra?.rastrasChip ||
                                animal.rastra?.ueln ||
                                (tipo === 'BOVINO' ? 'Sin crotal' : 'Sin chip')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">Sin cría</span>
                        )}
                      </td>

                      {/* Docs / Notas badge */}
                      <td className="py-2.5 px-1 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                          <span
                            title={`${animal.documentos.length} documentos adjuntos`}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                              animal.documentos.length > 0
                                ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                                : 'text-gray-400'
                            }`}
                          >
                            <FileText className="w-3 h-3" />
                            <span>{animal.documentos.length}</span>
                          </span>

                          <span
                            title={`${animal.anotaciones.length} anotaciones en cuaderno`}
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                              animal.anotaciones.length > 0
                                ? 'bg-amber-50 text-amber-800 font-bold border border-amber-200'
                                : 'text-gray-400'
                            }`}
                          >
                            <span>📝</span>
                            <span>{animal.anotaciones.length}</span>
                          </span>
                        </div>
                      </td>

                      {/* Gestión / Actions */}
                      <td
                        className="py-2.5 px-1.5 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onViewAnimal(animal)}
                            className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition"
                            title="Ver Ficha Oficial de Censo"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {!isReadOnly && (
                            <>
                              <button
                                onClick={() => onEditAnimal(animal)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                                title="Editar datos del animal o rastra"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => onRegisterMovement(animal)}
                                className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded transition"
                                title="Registrar Entrada / Salida de la Marisma"
                              >
                                <ArrowLeftRight className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => setAnimalToDelete(animal)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition cursor-pointer"
                                title={`Eliminar ${tipo === 'BOVINO' ? 'bovino' : 'animal'} del censo`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer info */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-2">
          <div>
            Mostrando <strong>{filteredAnimals.length}</strong> de <strong>{campaignAnimals.length}</strong> animales en la campaña <strong>{activeCampaign}</strong>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              En Marisma: {counts.dentro}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              Fuera (Temporal): {counts.fuera}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Vacantes: {counts.vacantes}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
              Con Rastra: {counts.conRastra}
            </span>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para eliminar animal o plaza vacante */}
      {animalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-gray-900">
                  {animalToDelete.esPlazaVacante
                    ? '¿Eliminar Plaza Vacante?'
                    : `¿Eliminar ${animalToDelete.tipo === 'BOVINO' ? 'Bovino' : 'Animal'} del Censo?`}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {animalToDelete.esPlazaVacante ? (
                    <>
                      ¿Deseas retirar definitivamente la plaza vacante{' '}
                      <span className="font-mono font-bold text-gray-900">
                        {animalToDelete.plazaNumero}
                      </span>{' '}
                      adjudicada a{' '}
                      <span className="font-bold text-gray-900">
                        {animalToDelete.propietario}
                      </span>{' '}
                      del censo de la campaña{' '}
                      <span className="font-semibold text-emerald-800">
                        {activeCampaign}
                      </span>
                      ?
                    </>
                  ) : (
                    <>
                      ¿Deseas eliminar definitivamente del censo {animalToDelete.tipo === 'BOVINO' ? 'al bovino' : `al animal ${animalToDelete.nombreAnimal ? `"${animalToDelete.nombreAnimal}"` : ''}`} con plaza{' '}
                      <span className="font-mono font-bold text-gray-900">
                        {animalToDelete.plazaNumero}
                      </span>{' '}
                      perteneciente a{' '}
                      <span className="font-bold text-gray-900">
                        {animalToDelete.propietario}
                      </span>
                      {animalToDelete.identificacion1 && (
                        <> ({animalToDelete.tipo === 'BOVINO' ? 'Crotal' : 'Chip'}: <span className="font-mono font-semibold">{animalToDelete.identificacion1}</span>)</>
                      )}
                      ?
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 leading-relaxed">
              Esta acción eliminará de forma irreversible el registro del animal en la base de datos municipal para la campaña <span className="font-bold">{activeCampaign}</span>.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAnimalToDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAnimal(animalToDelete);
                  setAnimalToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{animalToDelete.esPlazaVacante ? 'Sí, Eliminar Plaza' : 'Sí, Eliminar Animal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de intercambio / permuta de plazas */}
      {isSwapModalOpen && onSwapPlazas && (
        <SwapPlazasModal
          isOpen={isSwapModalOpen}
          onClose={() => {
            setIsSwapModalOpen(false);
            setSwapTargetAnimal(null);
          }}
          tipo={tipo}
          campaignAnimals={campaignAnimals}
          activeCampaign={activeCampaign}
          initialAnimal={swapTargetAnimal}
          onConfirmSwap={(animalAId, animalBId, motivo) => {
            onSwapPlazas(animalAId, animalBId, motivo);
            setIsSwapModalOpen(false);
            setSwapTargetAnimal(null);
          }}
        />
      )}
    </div>
  );
};
