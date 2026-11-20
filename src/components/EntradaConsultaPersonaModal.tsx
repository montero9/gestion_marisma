import React, { useState, useMemo } from 'react';
import {
  EntradaRemesa,
  EntradaPersona,
  Owner,
  Animal,
} from '../types/marisma';
import {
  X,
  Search,
  Users,
  Calendar,
  Car,
  FileText,
  Printer,
  CheckCircle,
  AlertCircle,
  Clock,
  Download,
  Filter,
  Eye,
} from 'lucide-react';

interface EntradaConsultaPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  remesas: EntradaRemesa[];
  owners: Owner[];
  activeCampaign: string;
  onVerEntrada?: (remesa: EntradaRemesa) => void;
}

export const EntradaConsultaPersonaModal: React.FC<EntradaConsultaPersonaModalProps> = ({
  isOpen,
  onClose,
  remesas,
  owners,
  activeCampaign,
  onVerEntrada,
}) => {
  // Lista única de ganaderos censados
  const uniqueOwners = useMemo(() => {
    const map = new Map<string, Owner>();
    for (const o of owners) {
      const nameKey = (o.nombreCompleto || '').trim().toUpperCase();
      if (!nameKey) continue;
      const existing = map.get(nameKey);
      if (!existing || (!existing.telefono && o.telefono) || (!existing.dniCif && o.dniCif)) {
        map.set(nameKey, o);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' })
    );
  }, [owners]);

  // Estados de filtro
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingOwner, setIsSearchingOwner] = useState(false);

  // Rango de fechas (por defecto: últimos 3 meses o campaña)
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');

  const [filtroFaena, setFiltroFaena] = useState<string>('TODAS');
  const [filtroRol, setFiltroRol] = useState<string>('TODOS'); // 'TODOS' | 'TITULAR' | 'ACOMPANANTE'
  const [incluirBorradores, setIncluirBorradores] = useState<boolean>(false);

  // Filtrado de ganaderos en el buscador
  const filteredOwners = useMemo(() => {
    if (!searchQuery.trim()) {
      return uniqueOwners.slice(0, 10);
    }
    const q = searchQuery.toLowerCase().trim();
    return uniqueOwners
      .filter(
        (o) =>
          o.nombreCompleto.toLowerCase().includes(q) ||
          (o.dniCif && o.dniCif.toLowerCase().includes(q)) ||
          (o.telefono && o.telefono.includes(q))
      )
      .slice(0, 10);
  }, [uniqueOwners, searchQuery]);

  // Atajos rápidos de fecha
  const setQuickDate = (tipo: 'CAMPANA' | 'ESTE_MES' | 'ULT_30' | 'ULT_90') => {
    const now = new Date();
    const hasta = now.toISOString().slice(0, 10);
    let desde = '';

    if (tipo === 'ESTE_MES') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      desde = startOfMonth.toISOString().slice(0, 10);
    } else if (tipo === 'ULT_30') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      desde = d.toISOString().slice(0, 10);
    } else if (tipo === 'ULT_90') {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      desde = d.toISOString().slice(0, 10);
    } else {
      // Toda la campaña
      desde = '';
    }

    setFechaDesde(desde);
    setFechaHasta(hasta);
  };

  // Extraer todas las autorizaciones que coincidan con la persona seleccionada (o texto libre)
  const accesosEncontrados = useMemo(() => {
    const targetName = selectedOwner
      ? selectedOwner.nombreCompleto.trim().toUpperCase()
      : searchQuery.trim().toUpperCase();

    if (!targetName) return [];

    const results: {
      persona: EntradaPersona;
      remesa: EntradaRemesa;
      titularNombre?: string;
    }[] = [];

    for (const remesa of remesas) {
      const personas = remesa.personas || [];
      for (const p of personas) {
        const pName = (p.nombreApellidos || '').trim().toUpperCase();
        // Coincidencia exacta o contiene el nombre buscado
        const matches = selectedOwner
          ? pName === targetName
          : pName.includes(targetName);

        if (!matches) continue;

        // Por defecto, solo computar entradas enviadas / formalizadas (salvo que el usuario active ver borradores)
        if (!incluirBorradores && remesa.estado !== 'ENVIADO') continue;

        // Filtro por fecha Desde
        if (fechaDesde && p.fecha && p.fecha < fechaDesde) continue;
        // Filtro por fecha Hasta
        if (fechaHasta && p.fecha && p.fecha > fechaHasta) continue;

        // Filtro por faena
        if (filtroFaena !== 'TODAS' && p.faena !== filtroFaena) continue;

        // Filtro por rol
        if (filtroRol === 'TITULAR' && !p.esTitular) continue;
        if (filtroRol === 'ACOMPANANTE' && p.esTitular) continue;

        let titularNombre: string | undefined;
        if (!p.esTitular && p.titularId) {
          const tit = personas.find((x) => x.id === p.titularId);
          titularNombre = tit?.nombreApellidos;
        }

        results.push({ persona: p, remesa, titularNombre });
      }
    }

    // Ordenar de más reciente a más antiguo
    return results.sort((a, b) => {
      const fa = a.persona.fecha || '';
      const fb = b.persona.fecha || '';
      return fb.localeCompare(fa);
    });
  }, [remesas, selectedOwner, searchQuery, fechaDesde, fechaHasta, filtroFaena, filtroRol, incluirBorradores]);

  // Métricas agregadas
  const metrics = useMemo(() => {
    let titularCount = 0;
    let acompananteCount = 0;
    let repasoCount = 0;
    let soltarCount = 0;
    let recogerCount = 0;
    const animalesMovilizados: {
      plaza: string;
      chip: string;
      nombre?: string;
      faena: string;
      fecha: string;
    }[] = [];

    for (const item of accesosEncontrados) {
      if (item.persona.esTitular) titularCount++;
      else acompananteCount++;

      if (item.persona.faena === 'REPASAR') repasoCount++;
      else if (item.persona.faena === 'SOLTAR') soltarCount++;
      else if (item.persona.faena === 'RECOGER') recogerCount++;

      if (item.persona.animales) {
        for (const ani of item.persona.animales) {
          animalesMovilizados.push({
            plaza: ani.plazaNumero,
            chip: ani.identificacionChip,
            nombre: ani.nombreAnimal,
            faena: ani.faena,
            fecha: item.persona.fecha,
          });
        }
      }
    }

    return {
      total: accesosEncontrados.length,
      titularCount,
      acompananteCount,
      repasoCount,
      soltarCount,
      recogerCount,
      animalesCount: animalesMovilizados.length,
      animalesMovilizados,
    };
  }, [accesosEncontrados]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between select-none shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-800/90 rounded-lg">
              <Users className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Consulta y Registro de Accesos por Ganadero
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Cabecera Membretada para Imprimir (solo visible en print) */}
          <div className="hidden print:block text-center border-b pb-4 mb-4">
            <h1 className="text-lg font-black uppercase text-gray-900">
              AYUNTAMIENTO DE HINOJOS
            </h1>
            <p className="text-xs uppercase font-bold text-gray-600">
              Concejalía de Montes y Marisma de Hinojos · Espacio Natural de Doñana
            </p>
            <h2 className="text-base font-bold mt-2 text-gray-900 underline">
              INFORME OFICIAL DE AUTORIZACIONES DE ACCESO A LA MARISMA
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Fecha de emisión: {new Date().toLocaleDateString('es-ES', { dateStyle: 'long' })} · Campaña: {activeCampaign}
            </p>
          </div>

          {/* Bloque de Selección de Ganadero y Filtros */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-4 print:hidden">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center justify-between">
                <span>Seleccionar Ganadero a Consultar</span>
                {selectedOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOwner(null);
                      setSearchQuery('');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    ✕ Cambiar persona
                  </button>
                )}
              </label>

              {selectedOwner ? (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      {selectedOwner.nombreCompleto}
                    </h3>
                    <p className="text-xs text-gray-600 font-mono">
                      {selectedOwner.dniCif ? `DNI: ${selectedOwner.dniCif}` : ''}{' '}
                      {selectedOwner.telefono ? `· Tel: ${selectedOwner.telefono}` : ''}{' '}
                      {selectedOwner.codigoRega ? `· REGA: ${selectedOwner.codigoRega}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold bg-emerald-700 text-white px-3 py-1 rounded-full">
                    Ganadero Seleccionado
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsSearchingOwner(true);
                      }}
                      onFocus={() => setIsSearchingOwner(true)}
                      placeholder="Escriba el nombre, apellidos o DNI del ganadero..."
                      className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>

                  {/* Resultados sugeridos inmediatos */}
                  {isSearchingOwner && (
                    <div className="p-2.5 bg-white border border-gray-200 rounded-xl shadow-lg space-y-1.5 max-h-48 overflow-y-auto">
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-100 text-[11px] font-bold text-gray-500">
                        <span>Ganaderos censados ({filteredOwners.length})</span>
                        <button
                          type="button"
                          onClick={() => setIsSearchingOwner(false)}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>

                      {filteredOwners.map((owner) => (
                        <button
                          key={owner.id}
                          type="button"
                          onClick={() => {
                            setSelectedOwner(owner);
                            setSearchQuery('');
                            setIsSearchingOwner(false);
                          }}
                          className="w-full p-2 hover:bg-emerald-50 rounded-lg text-left transition flex items-center justify-between cursor-pointer group"
                        >
                          <div>
                            <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-900">
                              {owner.nombreCompleto}
                            </p>
                            <p className="text-[10px] text-gray-500 font-mono">
                              {owner.dniCif ? `DNI: ${owner.dniCif}` : ''}{' '}
                              {owner.telefono ? `· Tel: ${owner.telefono}` : ''}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold text-emerald-700 group-hover:underline">
                            Consultar →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rango de Fechas y Filtros rápidos */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2 border-t border-gray-200">
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Fecha Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-gray-600 mb-1">
                  Fecha Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="sm:col-span-4 flex flex-col justify-end">
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="font-semibold text-gray-500 mr-1">Rápido:</span>
                  <button
                    type="button"
                    onClick={() => setQuickDate('ESTE_MES')}
                    className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-700 cursor-pointer"
                  >
                    Este mes
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('ULT_30')}
                    className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-700 cursor-pointer"
                  >
                    30 días
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('CAMPANA')}
                    className="px-2 py-1 bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-700 cursor-pointer"
                  >
                    Campaña
                  </button>
                </div>
              </div>
            </div>

            {/* Filtros de Faena y Rol */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-600">Faena:</span>
                <select
                  value={filtroFaena}
                  onChange={(e) => setFiltroFaena(e.target.value)}
                  className="text-xs bg-white border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="TODAS">Todas las faenas</option>
                  <option value="REPASAR">Solo Repasar (Revisión)</option>
                  <option value="SOLTAR">Solo Sueltas</option>
                  <option value="RECOGER">Solo Recogidas</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-600">Rol:</span>
                <select
                  value={filtroRol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                  className="text-xs bg-white border border-gray-300 rounded-md px-2 py-1"
                >
                  <option value="TODOS">Titular o Acompañante</option>
                  <option value="TITULAR">Solo Titular (Conductor)</option>
                  <option value="ACOMPANANTE">Solo Acompañante</option>
                </select>
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-gray-700 sm:ml-auto select-none">
                <input
                  type="checkbox"
                  checked={incluirBorradores}
                  onChange={(e) => setIncluirBorradores(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span className="text-[11px] font-medium text-gray-600">Incluir solicitudes en borrador</span>
              </label>
            </div>
          </div>

          {/* Tarjeta Resumen Ejecutivo para Superiores */}
          {accesosEncontrados.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                    Total Entradas Autorizadas
                  </span>
                  <span className="text-2xl font-black text-emerald-950">
                    {metrics.total}{' '}
                    <span className="text-xs font-normal text-emerald-700">veces</span>
                  </span>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Como Titular Conductor
                  </span>
                  <span className="text-2xl font-black text-gray-900">
                    {metrics.titularCount}
                  </span>
                </div>

                <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">
                    Como Acompañante
                  </span>
                  <span className="text-2xl font-black text-gray-900">
                    {metrics.acompananteCount}
                  </span>
                </div>

                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-800 uppercase block">
                    Equinos Movilizados
                  </span>
                  <span className="text-2xl font-black text-blue-950">
                    {metrics.animalesCount}{' '}
                    <span className="text-xs font-normal text-blue-700">caballos</span>
                  </span>
                </div>
              </div>

              {/* Desglose por faena */}
              <div className="p-3 bg-white border border-gray-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-gray-700">Desglose de motivos de entrada:</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">
                    Revisión (Repaso): <strong>{metrics.repasoCount}</strong>
                  </span>
                  <span className="text-emerald-700">
                    Sueltas: <strong>{metrics.soltarCount}</strong>
                  </span>
                  <span className="text-amber-700">
                    Recogidas: <strong>{metrics.recogerCount}</strong>
                  </span>
                </div>
              </div>

              {/* Tabla Detallada Cronológica de Accesos */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="bg-gray-100 p-2.5 border-b border-gray-200 font-bold text-xs text-gray-800 flex items-center justify-between">
                  <span>Detalle Cronológico de Entradas Autorizadas</span>
                  <span className="text-[11px] text-gray-500 font-normal">
                    {accesosEncontrados.length} registros encontrados
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-50 text-gray-600 text-[11px] border-b border-gray-200">
                      <tr>
                        <th className="p-2.5">Fecha y Día</th>
                        <th className="p-2.5">Rol en Vehículo</th>
                        <th className="p-2.5">Matrícula(s)</th>
                        <th className="p-2.5">Faena</th>
                        <th className="p-2.5">Equinos Asociados</th>
                        <th className="p-2.5 text-center">Estado Doñana</th>
                        <th className="p-2.5 text-right print:hidden">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {accesosEncontrados.map((item, idx) => {
                        const p = item.persona;
                        const r = item.remesa;
                        return (
                          <tr key={`${p.id}-${idx}`} className="hover:bg-gray-50/80 transition">
                            <td className="p-2.5">
                              <span className="font-bold text-gray-900 block">
                                {p.diaSemana || ''} {p.fecha || ''}
                              </span>
                              <span className="text-[10px] text-gray-500 truncate block max-w-[140px]">
                                {r.tituloOficial}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {p.esTitular ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  Titular Conductor
                                </span>
                              ) : (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                                  Acompañante {item.titularNombre ? `de ${item.titularNombre}` : ''}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-gray-700">
                              {p.matriculas || '—'}
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`text-[11px] font-bold ${
                                  p.faena === 'SOLTAR'
                                    ? 'text-emerald-700'
                                    : p.faena === 'RECOGER'
                                    ? 'text-amber-700'
                                    : 'text-gray-700'
                                }`}
                              >
                                {p.faena}
                              </span>
                            </td>
                            <td className="p-2.5">
                              {p.animales && p.animales.length > 0 ? (
                                <div className="space-y-0.5">
                                  {p.animales.map((ani) => (
                                    <span
                                      key={ani.id}
                                      className="inline-block text-[10px] bg-emerald-50 text-emerald-950 border border-emerald-200 px-1.5 py-0.5 rounded mr-1"
                                    >
                                      {ani.plazaNumero} ({ani.identificacionChip})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[11px]">Sin ganado</span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  r.estado === 'ENVIADO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-900'
                                }`}
                              >
                                {r.estado}
                              </span>
                            </td>
                            <td className="p-2.5 text-right print:hidden">
                              {onVerEntrada && (
                                <button
                                  type="button"
                                  onClick={() => onVerEntrada(r)}
                                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Ver detalle completo de esta solicitud"
                                >
                                  <Eye className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Ver</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl space-y-2">
              <Users className="w-8 h-8 mx-auto text-gray-400" />
              <h3 className="text-xs font-bold text-gray-700">
                {selectedOwner || searchQuery
                  ? `No se encontraron autorizaciones de entrada para ${selectedOwner?.nombreCompleto || searchQuery} en el periodo seleccionado.`
                  : 'Seleccione un ganadero arriba para ver su historial completo de entradas.'}
              </h3>
              <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                Puede cambiar el rango de fechas o seleccionar 'Toda la Campaña' para buscar en toda la temporada.
              </p>
            </div>
          )}
        </div>

        {/* Pie de Acciones */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex items-center justify-between gap-3 shrink-0 print:hidden">
          <span className="text-xs text-gray-500">
            {accesosEncontrados.length > 0 && (
              <span>
                Mostrando <strong>{accesosEncontrados.length}</strong> accesos autorizados
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {accesosEncontrados.length > 0 && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / Guardar Informe PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 transition cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
