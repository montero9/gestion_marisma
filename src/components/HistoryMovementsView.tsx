import React, { useState, useMemo, useEffect } from 'react';
import { Movement, Animal, User } from '../types/marisma';
import {
  Search,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  MessageSquare,
  X,
  RotateCcw,
  FolderOpen,
  FileText,
  Tag,
  Eye,
  Layers,
  Baby,
  Calendar,
} from 'lucide-react';
import { formatDateDDMMYY } from '../utils/dateUtils';

interface HistoryMovementsViewProps {
  movements: Movement[];
  animals: Animal[];
  campaigns?: string[];
  currentUser?: User;
  onOpenMovementModal: () => void;
  onRestoreAnimal?: (animal: Animal, movement: Movement) => void;
  onViewAnimal?: (animal: Animal) => void;
}

export const HistoryMovementsView: React.FC<HistoryMovementsViewProps> = ({
  movements,
  animals,
  campaigns = [],
  currentUser,
  onOpenMovementModal,
  onRestoreAnimal,
  onViewAnimal,
}) => {
  const isReadOnly = currentUser?.rol !== 'ADMINISTRADOR';
  // Main view tab: EXPEDIENTES (Grouped by animal & microchip) vs CRONOLOGICO (Chronological log)
  const [activeTab, setActiveTab] = useState<'EXPEDIENTES' | 'CRONOLOGICO'>('EXPEDIENTES');

  // Search & Filters for Expedientes
  const [expedienteSearch, setExpedienteSearch] = useState('');
  const [expedienteEspecie, setExpedienteEspecie] = useState<'TODOS' | 'EQUINO' | 'BOVINO'>('TODOS');
  const [expedienteEstado, setExpedienteEstado] = useState<'TODOS' | 'DENTRO' | 'FUERA_TEMPORAL' | 'FUERA'>('TODOS');
  // Filtro por Campaña específica en Expedientes (por defecto 'TODAS' para mostrar todos los movimientos históricos)
  const [expedienteCampana, setExpedienteCampana] = useState<string>('TODAS');

  // Search & Filters for Chronological movements
  const [movSearch, setMovSearch] = useState('');
  const [selectedEspecie, setSelectedEspecie] = useState<'TODOS' | 'EQUINO' | 'BOVINO'>('TODOS');
  const [filterType, setFilterType] = useState<'TODOS' | 'ENTRADA' | 'SALIDA'>('TODOS');
  // Filtro por Campaña en Libro Cronológico (por defecto 'TODAS' para ver el histórico de cualquier campaña)
  const [cronologicoCampana, setCronologicoCampana] = useState<string>('TODAS');

  // Tooltip & Modal for observation notes
  const [activeModalNote, setActiveModalNote] = useState<{
    nombre: string;
    plaza: string;
    texto: string;
  } | null>(null);

  const [hoveredNote, setHoveredNote] = useState<{
    id: string;
    nombre: string;
    plaza: string;
    texto: string;
    coords: { x: number; y: number; placeAbove: boolean };
  } | null>(null);

  useEffect(() => {
    const handleScroll = () => setHoveredNote(null);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 1. Compile Unique Animal Records (Grouped by Microchip as Primary Key)
  const animalRecords = useMemo(() => {
    // Map grouped by microchip (normalized)
    const recordMap = new Map<string, {
      animal: Animal;
      movements: Movement[];
      latestPlaza: string;
      allAnimalIds: Set<string>;
    }>();

    // Helper to get normalized chip key
    const getChipKey = (chip?: string) => (chip || '').trim().toUpperCase();

    // Add all current animals from registry grouped by their unique microchip
    animals.forEach((animal) => {
      const chipKey = getChipKey(animal.identificacion1) || animal.id;
      const existing = recordMap.get(chipKey);

      if (!existing) {
        recordMap.set(chipKey, {
          animal: { ...animal },
          movements: [],
          latestPlaza: animal.plazaNumero || '',
          allAnimalIds: new Set([animal.id]),
        });
      } else {
        existing.allAnimalIds.add(animal.id);

        // Merge latest metadata: keep the most recent updated/active animal data
        const currentUpdated = new Date(existing.animal.actualizadoEn || existing.animal.creadoEn || 0).getTime();
        const incomingUpdated = new Date(animal.actualizadoEn || animal.creadoEn || 0).getTime();

        // If incoming has a valid active plaza or more recent update date, prefer incoming as primary animal view
        if (incomingUpdated >= currentUpdated || (!existing.animal.plazaNumero && animal.plazaNumero)) {
          existing.animal = {
            ...animal,
            // Merge documents and annotations without duplicates
            documentos: [
              ...(existing.animal.documentos || []),
              ...(animal.documentos || []).filter(
                (d) => !(existing.animal.documentos || []).some((ed) => ed.id === d.id || ed.nombre === d.nombre)
              ),
            ],
            anotaciones: [
              ...(existing.animal.anotaciones || []),
              ...(animal.anotaciones || []).filter(
                (a) => !(existing.animal.anotaciones || []).some((ea) => ea.id === a.id || ea.texto === a.texto)
              ),
            ],
          };
          if (animal.plazaNumero) {
            existing.latestPlaza = animal.plazaNumero;
          }
        }
      }
    });

    // Also account for movements and attach them to the corresponding unique animal
    movements.forEach((mov) => {
      // Find matching record by animalId
      let record = Array.from(recordMap.values()).find((r) => r.allAnimalIds.has(mov.animalId));

      // If not found by ID, match by microchip / crotal
      if (!record && mov.identificacion1) {
        const chipKey = getChipKey(mov.identificacion1);
        if (chipKey) {
          record = recordMap.get(chipKey);
        }
      }

      // If not found by ID or chip, match by name and owner (solo en equinos si el nombre no está vacío)
      if (!record && mov.nombreAnimal && mov.nombreAnimal.trim()) {
        record = Array.from(recordMap.values()).find(
          (r) =>
            r.animal.tipo === mov.tipoAnimal &&
            r.animal.nombreAnimal.trim().toLowerCase() === mov.nombreAnimal.trim().toLowerCase() &&
            r.animal.propietario.trim().toLowerCase() === mov.propietario.trim().toLowerCase()
        );
      }

      if (record) {
        // Prevent duplicate movement entries in the record
        if (!record.movements.some((m) => m.id === mov.id)) {
          record.movements.push(mov);
        }
        if (!record.latestPlaza && mov.plazaNumero) {
          record.latestPlaza = mov.plazaNumero;
        }
      } else {
        // Synthesize historical animal profile if completely untracked
        const syntheticAnimal: Animal = {
          id: mov.animalId || `hist-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          tipo: mov.tipoAnimal,
          plazaNumero: mov.plazaNumero || '',
          nombreAnimal: mov.nombreAnimal || '',
          propietario: mov.propietario,
          campana: mov.campana || 'Histórico',
          finca: 'HINOJOS',
          identificacion1: mov.identificacion1 || '',
          identificacion2: '',
          sexo: 'H',
          fechaNacimiento: '',
          capa: mov.tipoAnimal === 'BOVINO' ? 'OTRO' : 'TORDO',
          estadoPresencia: 'FUERA',
          documentos: [],
          anotaciones: [],
          creadoEn: mov.fecha,
          actualizadoEn: mov.fecha,
        };
        const newRecord = {
          animal: syntheticAnimal,
          movements: [mov],
          latestPlaza: mov.plazaNumero || '',
          allAnimalIds: new Set([syntheticAnimal.id]),
        };
        const chipKey = getChipKey(syntheticAnimal.identificacion1) || syntheticAnimal.id;
        recordMap.set(chipKey, newRecord);
      }
    });

    // Compile into clean list
    return Array.from(recordMap.values()).map((rec) => {
      // Sort movements descending by date
      let sortedMovs = [...rec.movements].sort(
        (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
      );

      // Si se selecciona una campaña concreta, filtrar los movimientos de esa campaña exactamente
      if (expedienteCampana !== 'TODAS') {
        sortedMovs = sortedMovs.filter((m) => {
          const movCamp = m.campana || animals.find((a) => a.id === m.animalId)?.campana || '';
          return movCamp === expedienteCampana;
        });
      }

      const entradasCount = sortedMovs.filter((m) => m.tipoMovimiento === 'ENTRADA').length;
      const salidasCount = sortedMovs.filter((m) => m.tipoMovimiento === 'SALIDA').length;
      const ultimoMovimiento = sortedMovs[0] || null;

      const isCurrentlyOutside =
        rec.animal.estadoPresencia === 'FUERA' || !rec.animal.plazaNumero;

      const canRestore =
        isCurrentlyOutside &&
        sortedMovs.some((m) => m.tipoMovimiento === 'SALIDA' && Boolean(m.liberarPlaza));

      // Encontrar la instancia específica de este animal en la campaña seleccionada si existe
      const campaignSpecificAnimal = expedienteCampana !== 'TODAS'
        ? animals.find((a) => rec.allAnimalIds.has(a.id) && a.campana === expedienteCampana)
        : null;
      const effectiveAnimal = campaignSpecificAnimal || rec.animal;

      // Effective last known plaza
      const effectivePlaza =
        (campaignSpecificAnimal && campaignSpecificAnimal.plazaNumero) ||
        rec.animal.plazaNumero ||
        (ultimoMovimiento ? ultimoMovimiento.plazaNumero : rec.latestPlaza) ||
        '-';

      return {
        key: rec.animal.identificacion1 || rec.animal.id,
        animal: effectiveAnimal,
        movements: sortedMovs,
        allCampaignMovements: rec.movements,
        totalMovimientos: sortedMovs.length,
        allCampaignTotalMovimientos: rec.movements.length,
        entradasCount,
        salidasCount,
        ultimoMovimiento,
        effectivePlaza,
        allAnimalIds: rec.allAnimalIds,
        totalDocs: effectiveAnimal.documentos?.length || 0,
        totalNotas: effectiveAnimal.anotaciones?.length || 0,
        isCurrentlyOutside,
        canRestore,
      };
    });
  }, [animals, movements, expedienteCampana]);

  // Filtered Animal Records for Expedientes Tab
  const filteredAnimalRecords = useMemo(() => {
    return animalRecords.filter((rec) => {
      // Si se filtra por campaña específica en Expedientes, solo mostrar animales que pertenezcan a esa campaña o que tengan movimientos registrados en ella
      if (expedienteCampana !== 'TODAS') {
        const belongsToCampana = animals.some(
          (a) => rec.allAnimalIds.has(a.id) && a.campana === expedienteCampana
        );
        const hasMovementsInCampana = rec.totalMovimientos > 0;
        if (!belongsToCampana && !hasMovementsInCampana) {
          return false;
        }
      }

      // Especie filter
      if (expedienteEspecie !== 'TODOS' && rec.animal.tipo !== expedienteEspecie) {
        return false;
      }

      // Estado filter
      if (expedienteEstado !== 'TODOS') {
        if (expedienteEstado === 'DENTRO' && rec.animal.estadoPresencia !== 'DENTRO') return false;
        if (expedienteEstado === 'FUERA_TEMPORAL' && (rec.animal.estadoPresencia !== 'FUERA' || !rec.animal.plazaNumero)) return false;
        if (expedienteEstado === 'FUERA' && (rec.animal.estadoPresencia !== 'FUERA' || Boolean(rec.animal.plazaNumero))) return false;
      }

      // Text search
      if (expedienteSearch.trim()) {
        const q = expedienteSearch.toLowerCase();
        const inNombre = rec.animal.nombreAnimal.toLowerCase().includes(q);
        const inPropietario = rec.animal.propietario.toLowerCase().includes(q);
        const inMicrochip = (rec.animal.identificacion1 || '').toLowerCase().includes(q);
        const inUeln = (rec.animal.identificacion2 || '').toLowerCase().includes(q);
        const inPlaza = rec.effectivePlaza.toLowerCase().includes(q);
        const inNotas = (rec.animal.anotaciones || []).some((a) =>
          a.texto.toLowerCase().includes(q)
        );
        const inDocs = (rec.animal.documentos || []).some((d) =>
          d.nombre.toLowerCase().includes(q)
        );

        if (!inNombre && !inPropietario && !inMicrochip && !inUeln && !inPlaza && !inNotas && !inDocs) {
          return false;
        }
      }

      return true;
    });
  }, [animalRecords, expedienteEspecie, expedienteEstado, expedienteSearch]);

  // Stats for Expedientes
  const totalEquinos = useMemo(
    () => animalRecords.filter((r) => r.animal.tipo === 'EQUINO').length,
    [animalRecords]
  );
  const totalBovinos = useMemo(
    () => animalRecords.filter((r) => r.animal.tipo === 'BOVINO').length,
    [animalRecords]
  );

  // Chronological Filtered Movements
  const equinoMovCount = useMemo(
    () => movements.filter((m) => m.tipoAnimal === 'EQUINO').length,
    [movements]
  );
  const bovinoMovCount = useMemo(
    () => movements.filter((m) => m.tipoAnimal === 'BOVINO').length,
    [movements]
  );

  const filteredMovements = useMemo(() => {
    const animMap = new Map<string, Animal>();
    const chipToAnimals = new Map<string, Animal[]>();
    animals.forEach((a) => {
      animMap.set(a.id, a);
      const c = (a.identificacion1 || '').trim().toUpperCase();
      if (c) {
        if (!chipToAnimals.has(c)) chipToAnimals.set(c, []);
        chipToAnimals.get(c)!.push(a);
      }
    });

    return movements
      .filter((m) => {
        if (selectedEspecie !== 'TODOS' && m.tipoAnimal !== selectedEspecie) return false;
        if (filterType !== 'TODOS' && m.tipoMovimiento !== filterType) return false;

        // Filtro por Campaña en Libro Cronológico
        if (cronologicoCampana !== 'TODAS') {
          const movCamp = m.campana || animMap.get(m.animalId)?.campana || '';
          if (movCamp !== cronologicoCampana) return false;
        }

        if (movSearch.trim()) {
          const q = movSearch.toLowerCase().trim();
          const linkedAnimal = animMap.get(m.animalId);
          const chip = (m.identificacion1 || linkedAnimal?.identificacion1 || '').toLowerCase();
          const ueln = (linkedAnimal?.identificacion2 || '').toLowerCase();
          const camp = (m.campana || linkedAnimal?.campana || '').toLowerCase();
          const guia = (m.numeroGuia || '').toLowerCase();
          const plaza = (m.plazaNumero || '').toLowerCase();
          const nombre = (m.nombreAnimal || linkedAnimal?.nombreAnimal || '').toLowerCase();
          const prop = (m.propietario || linkedAnimal?.propietario || '').toLowerCase();
          const obs = (m.observaciones || '').toLowerCase();

          // Plazas asociadas a este animal en otras campañas
          const chipKey = (m.identificacion1 || linkedAnimal?.identificacion1 || '').trim().toUpperCase();
          const siblingPlazas = chipKey && chipToAnimals.has(chipKey)
            ? chipToAnimals.get(chipKey)!.map((s) => s.plazaNumero.toLowerCase())
            : [];
          const matchesSiblingPlaza = siblingPlazas.some((p) => p.includes(q));

          return (
            plaza.includes(q) ||
            nombre.includes(q) ||
            prop.includes(q) ||
            chip.includes(q) ||
            ueln.includes(q) ||
            camp.includes(q) ||
            guia.includes(q) ||
            obs.includes(q) ||
            matchesSiblingPlaza
          );
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(a.fecha).getTime();
        const dateB = new Date(b.fecha).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (b.id || '').localeCompare(a.id || '');
      });
  }, [movements, animals, selectedEspecie, filterType, cronologicoCampana, movSearch]);

  // CSV Export for Chronological movements
  const handleExportCSV = () => {
    const headers = [
      'FECHA',
      'CAMPAÑA',
      'TIPO MOVIMIENTO',
      'ESPECIE',
      'Nº PLAZA',
      'NOMBRE / IDENTIFICACIÓN',
      'CROTAL / MICROCHIP',
      'PROPIETARIO',
      'GUÍA SANITARIA',
      'OBSERVACIONES',
    ];

    const rows = filteredMovements.map((m) => {
      const animal = animals.find((a) => a.id === m.animalId);
      const camp = m.campana || animal?.campana || '';
      const chip = m.identificacion1 || animal?.identificacion1 || '';
      const name = m.tipoAnimal === 'BOVINO' ? (chip || `Plaza ${m.plazaNumero}`) : (m.nombreAnimal || 'Sin nombre');
      return [
        `"${m.fecha}"`,
        `"${camp}"`,
        `"${m.tipoMovimiento}"`,
        `"${m.tipoAnimal}"`,
        `"${m.plazaNumero}"`,
        `"${name}"`,
        `"${chip}"`,
        `"${m.propietario}"`,
        `"${m.numeroGuia || ''}"`,
        `"${m.observaciones || ''}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Libro_Cronologico_Movimientos_Marisma_Hinojos_${cronologicoCampana !== 'TODAS' ? `Camp_${cronologicoCampana}_` : ''}${selectedEspecie}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to open animal detail from either view
  const handleOpenAnimalDossier = (targetAnimal: Animal) => {
    if (onViewAnimal) {
      onViewAnimal(targetAnimal);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                HISTÓRICO Y EXPEDIENTES
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {activeTab === 'CRONOLOGICO' && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-medium rounded-lg shadow-sm transition"
                title="Descargar histórico en Excel/CSV"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Exportar CSV</span>
              </button>
            )}

            {!isReadOnly && (
              <button
                onClick={onOpenMovementModal}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                <span>REGISTRAR MOVIMIENTO</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs Switcher and Search */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs sm:text-sm font-bold shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('EXPEDIENTES')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'EXPEDIENTES'
                  ? 'bg-white text-emerald-950 shadow-sm font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FolderOpen className={`w-4 h-4 ${activeTab === 'EXPEDIENTES' ? 'text-emerald-700' : 'text-gray-400'}`} />
              <span>Expediente por Animal</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                activeTab === 'EXPEDIENTES'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {animalRecords.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('CRONOLOGICO')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'CRONOLOGICO'
                  ? 'bg-white text-emerald-950 shadow-sm font-black'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeTab === 'CRONOLOGICO' ? 'text-emerald-700' : 'text-gray-400'}`} />
              <span>Libro Cronológico de Movimientos</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                activeTab === 'CRONOLOGICO'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {movements.length}
              </span>
            </button>
          </div>

          {/* Search Input for Expedientes - placed on the same line */}
          {activeTab === 'EXPEDIENTES' && (
            <div className="relative flex-1 min-w-[280px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={expedienteSearch}
                onChange={(e) => setExpedienteSearch(e.target.value)}
                placeholder="Buscar por Microchip, UELN, Nombre, Ganadero, Plaza o Notas..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Search Input for Cronológico - placed on the same line */}
          {activeTab === 'CRONOLOGICO' && (
            <div className="relative flex-1 min-w-[280px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={movSearch}
                onChange={(e) => setMovSearch(e.target.value)}
                placeholder="Buscar por Plaza, Nombre, Ganadero u Observación..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Expedientes Controls Row (Filters) */}
        {activeTab === 'EXPEDIENTES' && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
            {/* Especie Selector */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200">
              <button
                type="button"
                onClick={() => setExpedienteEspecie('TODOS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  expedienteEspecie === 'TODOS'
                    ? 'bg-white text-gray-900 shadow-xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todas ({animalRecords.length})
              </button>
              <button
                type="button"
                onClick={() => setExpedienteEspecie('EQUINO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  expedienteEspecie === 'EQUINO'
                    ? 'bg-emerald-700 text-white shadow-xs font-black'
                    : 'text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <span className="text-sm">🐎</span>
                <span>Equino ({totalEquinos})</span>
              </button>
              <button
                type="button"
                onClick={() => setExpedienteEspecie('BOVINO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  expedienteEspecie === 'BOVINO'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span className="text-sm">🐂</span>
                <span>Bovino ({totalBovinos})</span>
              </button>
            </div>

            {/* Estado Selector */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200">
              <button
                type="button"
                onClick={() => setExpedienteEstado('TODOS')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  expedienteEstado === 'TODOS'
                    ? 'bg-white text-gray-900 shadow-xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todos los estados
              </button>
              <button
                type="button"
                onClick={() => setExpedienteEstado('DENTRO')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  expedienteEstado === 'DENTRO'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                En Marisma
              </button>
              <button
                type="button"
                onClick={() => setExpedienteEstado('FUERA_TEMPORAL')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  expedienteEstado === 'FUERA_TEMPORAL'
                    ? 'bg-amber-500 text-white shadow-xs font-black'
                    : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                Fuera Temporal
              </button>
              <button
                type="button"
                onClick={() => setExpedienteEstado('FUERA')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  expedienteEstado === 'FUERA'
                    ? 'bg-slate-700 text-white shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Fuera / Archivados
              </button>
            </div>

            {/* Desplegable Selector de Campaña para Expedientes */}
            <div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-xl text-xs font-bold border border-gray-200">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-gray-600 font-semibold hidden sm:inline">Campaña:</span>
              <select
                value={expedienteCampana}
                onChange={(e) => setExpedienteCampana(e.target.value)}
                className="bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                title="Filtrar movimientos del expediente por una campaña específica"
              >
                <option value="TODAS">Todas las Campañas (Histórico Completo)</option>
                {campaigns.map((c) => (
                  <option key={c} value={c}>
                    Campaña {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tab 2: Chronological Controls Row (Filters) */}
        {activeTab === 'CRONOLOGICO' && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-3">
            {/* Especie Selector */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200">
              <button
                type="button"
                onClick={() => setSelectedEspecie('TODOS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedEspecie === 'TODOS'
                    ? 'bg-white text-gray-900 shadow-xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todas ({movements.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedEspecie('EQUINO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  selectedEspecie === 'EQUINO'
                    ? 'bg-emerald-700 text-white shadow-xs font-black'
                    : 'text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                <span className="text-sm">🐎</span>
                <span>Equino ({equinoMovCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedEspecie('BOVINO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  selectedEspecie === 'BOVINO'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <span className="text-sm">🐂</span>
                <span>Bovino ({bovinoMovCount})</span>
              </button>
            </div>

            {/* Type filter (Entradas / Salidas) */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold border border-gray-200">
              <button
                type="button"
                onClick={() => setFilterType('TODOS')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterType === 'TODOS'
                    ? 'bg-white text-gray-900 shadow-xs font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Todos los movimientos
              </button>
              <button
                type="button"
                onClick={() => setFilterType('ENTRADA')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterType === 'ENTRADA'
                    ? 'bg-emerald-600 text-white shadow-xs font-black'
                    : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Entradas
              </button>
              <button
                type="button"
                onClick={() => setFilterType('SALIDA')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterType === 'SALIDA'
                    ? 'bg-rose-600 text-white shadow-xs font-black'
                    : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                Salidas
              </button>
            </div>

            {/* Desplegable Selector de Campaña para Libro Cronológico */}
            <div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1 rounded-xl text-xs font-bold border border-gray-200">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-gray-600 font-semibold hidden sm:inline">Campaña:</span>
              <select
                value={cronologicoCampana}
                onChange={(e) => setCronologicoCampana(e.target.value)}
                className="bg-white border border-gray-300 text-gray-800 text-xs font-bold rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                title="Filtrar movimientos del libro cronológico por una campaña específica"
              >
                <option value="TODAS">Todas las Campañas (Histórico Completo)</option>
                {campaigns.map((c) => (
                  <option key={c} value={c}>
                    Campaña {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón para limpiar filtros en Cronológico si hay búsqueda o filtros activos */}
            {(movSearch || selectedEspecie !== 'TODOS' || filterType !== 'TODOS' || cronologicoCampana !== 'TODAS') && (
              <button
                type="button"
                onClick={() => {
                  setMovSearch('');
                  setSelectedEspecie('TODOS');
                  setFilterType('TODOS');
                  setCronologicoCampana('TODAS');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg border border-rose-200 transition font-bold cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Restablecer Filtros</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* VIEW 1: TABLA DE EXPEDIENTES POR ANIMAL Y MICROCHIP */}
      {activeTab === 'EXPEDIENTES' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#111827] text-white border-b border-gray-800 text-[11px] font-bold tracking-wider uppercase">
                  <th className="py-3 px-4">ANIMAL</th>
                  <th className="py-3 px-4">MICROCHIP / UELN</th>
                  <th className="py-3 px-4">TITULAR / GANADERO</th>
                  <th className="py-3 px-4 text-center">ESTADO Y PLAZA</th>
                  <th className="py-3 px-4 text-center">HISTORIAL MOVIMIENTOS</th>
                  <th className="py-3 px-4 text-center">EXPEDIENTE (DOCS & NOTAS)</th>
                  <th className="py-3 px-4 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredAnimalRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500 font-medium">
                      <FolderOpen className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      No se encontraron expedientes con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredAnimalRecords.map((rec) => {
                    const isEquino = rec.animal.tipo === 'EQUINO';
                    const hasMicrochip = Boolean(rec.animal.identificacion1 && rec.animal.identificacion1.trim());
                    const hasUeln = Boolean(rec.animal.identificacion2 && rec.animal.identificacion2.trim());

                    return (
                      <tr key={rec.key} className="hover:bg-slate-50 transition">
                        {/* Animal Info */}
                        <td className="py-3.5 px-4 min-w-[180px]">
                          <div className="flex items-start gap-2.5">
                            <span className="text-xl shrink-0 mt-0.5">
                              {isEquino ? '🐎' : '🐂'}
                            </span>
                            <div>
                              <button
                                type="button"
                                onClick={() => handleOpenAnimalDossier(rec.animal)}
                                className="text-left font-black text-gray-900 hover:text-emerald-700 transition flex items-center gap-1 group cursor-pointer"
                                title="Ver expediente completo de este animal"
                              >
                                <span>{rec.animal.tipo === 'BOVINO' ? (rec.animal.identificacion1 || `Plaza ${rec.animal.plazaNumero}`) : (rec.animal.nombreAnimal || 'Sin nombre')}</span>
                                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-emerald-600 transition" />
                              </button>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-gray-600">
                                <span className="font-semibold text-gray-700">
                                  {rec.animal.sexo === 'H' ? 'Hembra' : 'Macho'}
                                </span>
                                <span>·</span>
                                <span className="capitalize">{rec.animal.capa || 'Capa no def.'}</span>
                                {rec.animal.rastra && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-semibold text-[10px] border border-amber-300">
                                    <Baby className="w-2.5 h-2.5" />
                                    <span>Cría: {rec.animal.rastra.nombre}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Microchip / UELN */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {hasMicrochip ? (
                            <div>
                              <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-900 font-mono font-bold text-xs px-2.5 py-1 rounded-md border border-slate-300 shadow-2xs">
                                <Tag className="w-3 h-3 text-slate-500" />
                                <span>{rec.animal.identificacion1}</span>
                              </div>
                              {hasUeln && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5 pl-0.5">
                                  UELN: {rec.animal.identificacion2}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <span className="inline-block text-[11px] font-semibold text-gray-400 italic">
                                Sin microchip asignado
                              </span>
                              {hasUeln && (
                                <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                  UELN: {rec.animal.identificacion2}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Titular / Propietario */}
                        <td className="py-3.5 px-4 text-gray-900 font-medium">
                          <span>{rec.animal.propietario}</span>
                        </td>

                        {/* Estado y Plaza */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {rec.animal.estadoPresencia === 'DENTRO' ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                <span>En Marisma</span>
                              </span>
                              <span className="font-mono font-black text-xs text-gray-800 mt-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                                Plaza {rec.effectivePlaza}
                              </span>
                            </div>
                          ) : rec.animal.estadoPresencia === 'FUERA' && rec.animal.plazaNumero ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                <span>Fuera Temporal</span>
                              </span>
                              <span className="font-mono font-bold text-xs text-amber-900 mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                Plaza {rec.effectivePlaza} (Reservada)
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>Fuera de Marisma</span>
                              </span>
                              <span className="text-[11px] text-gray-500 mt-1 font-mono">
                                {rec.effectivePlaza !== '-' ? `Última: ${rec.effectivePlaza}` : 'Archivado'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Historial Movimientos */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 font-bold text-xs border border-gray-300">
                              <span>
                                {rec.totalMovimientos} {rec.totalMovimientos === 1 ? 'mov.' : 'movs.'}
                                {expedienteCampana !== 'TODAS' && rec.allCampaignTotalMovimientos > rec.totalMovimientos && (
                                  <span className="text-[10px] text-gray-400 font-normal ml-1">
                                    (de {rec.allCampaignTotalMovimientos} tot.)
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-gray-500 font-mono">
                                (↓{rec.entradasCount} ↑{rec.salidasCount})
                              </span>
                            </span>
                            {rec.allCampaignTotalMovimientos > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('CRONOLOGICO');
                                  setMovSearch(rec.animal.identificacion1 || rec.animal.nombreAnimal || rec.effectivePlaza);
                                  setCronologicoCampana('TODAS');
                                }}
                                className="text-[10px] text-emerald-700 hover:text-emerald-900 underline font-semibold cursor-pointer"
                                title="Ver todos los movimientos de este animal en cualquier campaña en el Libro Cronológico"
                              >
                                Ver en Libro Cronológico →
                              </button>
                            )}
                            {rec.ultimoMovimiento && (
                              <span className="text-[10px] text-gray-500 font-mono">
                                Último: {formatDateDDMMYY(rec.ultimoMovimiento.fecha)} ({rec.ultimoMovimiento.tipoMovimiento})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Documentos & Notas */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                                rec.totalDocs > 0
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-gray-50 text-gray-400 border border-gray-200'
                              }`}
                              title={`${rec.totalDocs} Documentos oficiales adjuntos en el expediente`}
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600" />
                              <span>{rec.totalDocs} docs</span>
                            </span>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${
                                rec.totalNotas > 0
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-gray-50 text-gray-400 border border-gray-200'
                              }`}
                              title={`${rec.totalNotas} Notas u observaciones registradas en cuaderno de campo`}
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{rec.totalNotas} notas</span>
                            </span>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {rec.canRestore && rec.ultimoMovimiento && onRestoreAnimal ? (
                            <button
                              type="button"
                              onClick={() => onRestoreAnimal(rec.animal, rec.ultimoMovimiento!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                              title="Reintegrar animal y adjudicarle una nueva plaza libre"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar</span>
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: LIBRO CRONOLÓGICO DE MOVIMIENTOS */}
      {activeTab === 'CRONOLOGICO' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#111827] text-white border-b border-gray-800 text-[11px] font-bold tracking-wider uppercase">
                  <th className="py-3 px-4">FECHA</th>
                  <th className="py-3 px-3 text-center">CAMPAÑA</th>
                  <th className="py-3 px-3">TIPO</th>
                  <th className="py-3 px-4 text-center">Nº PLAZA</th>
                  <th className="py-3 px-4 w-[180px] max-w-[180px] leading-tight">IDENTIFICACIÓN / ANIMAL</th>
                  <th className="py-3 px-4">PROPIETARIO / GANADERO</th>
                  <th className="py-3 px-4 text-center">OBSERVACIONES</th>
                  <th className="py-3 px-4 text-center">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-500 font-medium">
                      No hay registros de movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => {
                    const animal =
                      animals.find((a) => a.id === mov.animalId) ||
                      (mov.identificacion1
                        ? animals.find(
                            (a) =>
                              (a.identificacion1 || '').trim().toUpperCase() ===
                              (mov.identificacion1 || '').trim().toUpperCase()
                          )
                        : null) ||
                      (mov.nombreAnimal
                        ? animals.find(
                            (a) =>
                              a.tipo === mov.tipoAnimal &&
                              a.nombreAnimal.trim().toLowerCase() === mov.nombreAnimal.trim().toLowerCase()
                          )
                        : null);

                    const isCurrentlyOutOfMarisma = animal
                      ? !animal.plazaNumero || animal.estadoPresencia === 'FUERA'
                      : true;
                    const canRestore = mov.tipoMovimiento === 'SALIDA' && Boolean(mov.liberarPlaza) && isCurrentlyOutOfMarisma;
                    const isEntrada = mov.tipoMovimiento === 'ENTRADA';
                    const hasObservaciones = Boolean(mov.observaciones && mov.observaciones.trim());

                    const targetAnimal: Animal = animal || {
                      id: mov.animalId,
                      tipo: mov.tipoAnimal,
                      plazaNumero: mov.plazaNumero || '',
                      nombreAnimal: mov.nombreAnimal || '',
                      propietario: mov.propietario,
                      campana: mov.campana || 'Histórico',
                      finca: 'HINOJOS',
                      identificacion1: mov.identificacion1 || '',
                      identificacion2: '',
                      sexo: 'H',
                      fechaNacimiento: '',
                      capa: mov.tipoAnimal === 'BOVINO' ? 'OTRO' : 'TORDO',
                      estadoPresencia: 'FUERA',
                      documentos: [],
                      anotaciones: [],
                      creadoEn: mov.fecha,
                      actualizadoEn: mov.fecha,
                    };

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50 transition">
                        {/* Fecha (formato dd/mm/yy) */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-semibold text-gray-900">
                          {formatDateDDMMYY(mov.fecha)}
                        </td>

                        {/* Campaña */}
                        <td className="py-3 px-3 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {mov.campana || animal?.campana || 'General'}
                          </span>
                        </td>

                        {/* Tipo */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isEntrada
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}
                          >
                            {isEntrada ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                            <span>{mov.tipoMovimiento}</span>
                          </span>
                          {mov.liberarPlaza && (
                            <div className="text-[10px] text-rose-700 font-semibold mt-0.5">
                              Plaza liberada
                            </div>
                          )}
                        </td>

                        {/* Plaza */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-gray-900 text-center">
                          <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                            {mov.plazaNumero}
                          </span>
                        </td>

                        {/* Animal (Clickable to open dossier) */}
                        <td className="py-3 px-4 w-[180px] max-w-[180px] whitespace-normal break-words leading-snug">
                          <button
                            type="button"
                            onClick={() => handleOpenAnimalDossier(targetAnimal)}
                            className="font-bold text-emerald-950 hover:text-emerald-700 flex items-start gap-1.5 text-left group cursor-pointer"
                            title="Haga clic para ver el expediente completo de este animal"
                          >
                            <span className="shrink-0 mt-0.5">{mov.tipoAnimal === 'EQUINO' ? '🐎' : '🐂'}</span>
                            <div className="flex flex-col">
                              <span className="break-words underline-offset-2 group-hover:underline">
                                {mov.tipoAnimal === 'BOVINO'
                                  ? (mov.identificacion1 || animal?.identificacion1 || (mov.plazaNumero ? `Plaza ${mov.plazaNumero}` : 'Bovino'))
                                  : (mov.nombreAnimal || 'Sin nombre')}
                              </span>
                              {mov.tipoAnimal === 'BOVINO' && (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  Crotal: {mov.identificacion1 || animal?.identificacion1 || 'S/C'}
                                </span>
                              )}
                              {mov.tipoAnimal === 'EQUINO' && (mov.identificacion1 || animal?.identificacion1) && (
                                <span className="text-[10px] text-gray-500 font-mono">
                                  Chip: {mov.identificacion1 || animal?.identificacion1}
                                </span>
                              )}
                            </div>
                          </button>
                        </td>

                        {/* Propietario */}
                        <td className="py-3 px-4 whitespace-nowrap text-gray-800 font-medium">
                          {mov.propietario}
                        </td>

                        {/* Observaciones como botón con tooltip interactivo no recortado */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {hasObservaciones ? (
                            <div className="inline-block">
                              <button
                                type="button"
                                onMouseEnter={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const placeAbove = rect.top > 200;
                                  setHoveredNote({
                                    id: mov.id,
                                    nombre: mov.tipoAnimal === 'BOVINO' ? (mov.plazaNumero ? `Plaza ${mov.plazaNumero}` : 'Bovino') : mov.nombreAnimal,
                                    plaza: mov.plazaNumero,
                                    texto: mov.observaciones || '',
                                    coords: {
                                      x: rect.right,
                                      y: placeAbove ? rect.top : rect.bottom,
                                      placeAbove,
                                    },
                                  });
                                }}
                                onMouseLeave={() => setHoveredNote(null)}
                                onClick={() => {
                                  setHoveredNote(null);
                                  setActiveModalNote({
                                    nombre: mov.tipoAnimal === 'BOVINO' ? (mov.plazaNumero ? `Plaza ${mov.plazaNumero}` : 'Bovino') : mov.nombreAnimal,
                                    plaza: mov.plazaNumero,
                                    texto: mov.observaciones || '',
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 transition shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span>Observación</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs italic">Sin notas</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {canRestore && onRestoreAnimal ? (
                            <button
                              type="button"
                              onClick={() => onRestoreAnimal(targetAnimal, mov)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                              title="Restaurar animal a una plaza libre de la marisma"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar</span>
                            </button>
                          ) : (
                            <span className="text-gray-300 text-xs font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Floating hover popover for notes */}
      {hoveredNote && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-full transition-opacity duration-150 animate-in fade-in"
          style={{
            left: `${Math.min(window.innerWidth - 16, Math.max(340, hoveredNote.coords.x))}px`,
            ...(hoveredNote.coords.placeAbove
              ? { bottom: `${window.innerHeight - hoveredNote.coords.y + 10}px` }
              : { top: `${hoveredNote.coords.y + 10}px` }),
          }}
        >
          <div className="relative w-80 sm:w-96 p-3.5 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 text-xs">
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-gray-700/80">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Observación</span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono">
                {hoveredNote.plaza} · {hoveredNote.nombre}
              </span>
            </div>
            <p className="text-gray-200 whitespace-normal leading-relaxed text-xs">
              {hoveredNote.texto}
            </p>

            {/* Triangle indicator arrow */}
            {hoveredNote.coords.placeAbove ? (
              <div className="absolute right-6 top-full w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-gray-900" />
            ) : (
              <div className="absolute right-6 bottom-full w-0 h-0 border-x-6 border-x-transparent border-b-6 border-b-gray-900" />
            )}
          </div>
        </div>
      )}

      {/* Modal dialog for observation note on click */}
      {activeModalNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-gray-900 text-sm">
                  Observación de Movimiento
                </h3>
              </div>
              <button
                onClick={() => setActiveModalNote(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-emerald-800 mb-2">
                Animal: {activeModalNote.nombre} · Plaza: {activeModalNote.plaza}
              </p>
              <div className="text-xs sm:text-sm text-gray-800 bg-gray-50 p-3.5 rounded-xl border border-gray-200 whitespace-pre-wrap leading-relaxed">
                {activeModalNote.texto}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveModalNote(null)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
