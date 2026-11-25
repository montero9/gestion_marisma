import React, { useState, useEffect, useMemo } from 'react';
import { AuditLog } from '../types/marisma';
import { ApiService } from '../services/apiService';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Calendar,
  User,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileSpreadsheet,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('TODAS');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 15;

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res: any = await ApiService.getAuditLogs({ limit: 1000 });
      const rawLogs = Array.isArray(res) ? res : res?.logs || [];
      setLogs(rawLogs);
    } catch (err) {
      console.error('Error al cargar logs de auditoría:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  // Formato de acción legible en español con colores semánticos
  const getActionBadge = (accion: string) => {
    const act = (accion || '').toUpperCase();
    if (act.includes('ENVIO_PERMISOS') || act.includes('ENVIADO')) {
      return { label: 'Envío a Doñana', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    }
    if (act.includes('ALTA') || act.includes('CREAR')) {
      return { label: 'Alta / Creación', bg: 'bg-teal-100 text-teal-800 border-teal-300' };
    }
    if (act.includes('BAJA') || act.includes('ELIMINAR')) {
      return { label: 'Eliminación', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
    }
    if (act.includes('LOGIN_FALLIDO')) {
      return { label: 'Acceso Denegado', bg: 'bg-rose-100 text-rose-900 border-rose-400' };
    }
    if (act.includes('MODIFICACION') || act.includes('MODIFICAR') || act.includes('EDITAR')) {
      return { label: 'Modificación', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
    if (act.includes('INICIO_SESION') || act.includes('CAMBIO_USUARIO')) {
      return { label: 'Acceso al Sistema', bg: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
    }
    if (act.includes('CIERRE_SESION')) {
      return { label: 'Cierre de Sesión', bg: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
    if (act.includes('MOVIMIENTO') || act.includes('PERMUTA')) {
      return { label: 'Movimiento Ganado', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
    }
    if (act.includes('BACKUP') || act.includes('COPIA')) {
      return { label: 'Copia / Respaldo', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
    if (act.includes('ODS')) {
      return { label: 'Exportación ODS', bg: 'bg-cyan-100 text-cyan-800 border-cyan-300' };
    }
    return { label: act.replace(/_/g, ' '), bg: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  // Formato amigable de fecha y hora
  const formatDateTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoDate;
    }
  };

  // Parsear y resumir detalles JSON en texto legible
  const parseDetailsSummary = (detallesJson?: string): { summary: string; full: Record<string, any> | null } => {
    if (!detallesJson) return { summary: 'Sin detalles adicionales', full: null };
    try {
      const obj = JSON.parse(detallesJson);
      const parts: string[] = [];

      if (obj.titulo) parts.push(`"${obj.titulo}"`);
      if (obj.nombre) parts.push(`Nombre: ${obj.nombre}`);
      if (obj.titular) parts.push(`Titular: ${obj.titular}`);
      if (obj.plaza) parts.push(`Plaza: ${obj.plaza}`);
      if (obj.crotal) parts.push(`Crotal/Chip: ${obj.crotal}`);
      if (obj.destinatarios) {
        const dest = Array.isArray(obj.destinatarios) ? obj.destinatarios.join(', ') : obj.destinatarios;
        parts.push(`Dest: ${dest}`);
      }
      if (obj.motivo) parts.push(`Motivo: ${obj.motivo}`);
      if (obj.username) parts.push(`Usuario: @${obj.username}`);
      if (obj.rol) parts.push(`Rol: ${obj.rol}`);
      if (obj.aUsuario) parts.push(`Cambio a: @${obj.aUsuario}`);

      const summary = parts.length > 0 ? parts.join(' · ') : JSON.stringify(obj).replace(/[{}\"]/g, '').slice(0, 80);
      return { summary, full: obj };
    } catch {
      return { summary: detallesJson.slice(0, 80), full: null };
    }
  };

  // Filtrado de eventos
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filtro por categoría
      if (filterCategory !== 'TODAS') {
        const ent = (log.entidad || '').toUpperCase();
        const acc = (log.accion || '').toUpperCase();
        if (filterCategory === 'ENTRADAS' && !ent.includes('ENTRADA') && !acc.includes('ENTRADA') && !acc.includes('DONANA')) return false;
        if (filterCategory === 'CENSO' && !ent.includes('ANIMAL') && !acc.includes('ALTA') && !acc.includes('BAJA') && !acc.includes('MOVIMIENTO')) return false;
        if (filterCategory === 'GANADEROS' && !ent.includes('GANADERO') && !ent.includes('OWNER')) return false;
        if (filterCategory === 'SEGURIDAD' && !acc.includes('LOGIN') && !acc.includes('SESION') && !ent.includes('USUARIO')) return false;
        if (filterCategory === 'COPIAS' && !acc.includes('BACKUP') && !acc.includes('COPIA')) return false;
      }

      // Buscador general
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesUser = (log.usuarioNombre || '').toLowerCase().includes(q);
        const matchesAccion = (log.accion || '').toLowerCase().includes(q);
        const matchesEntidad = (log.entidad || '').toLowerCase().includes(q);
        const matchesId = (log.entidadId || '').toLowerCase().includes(q);
        const matchesDetalles = (log.detallesJson || '').toLowerCase().includes(q);
        const matchesIp = (log.ip || '').toLowerCase().includes(q);

        if (!matchesUser && !matchesAccion && !matchesEntidad && !matchesId && !matchesDetalles && !matchesIp) {
          return false;
        }
      }
      return true;
    });
  }, [logs, filterCategory, searchTerm]);

  // Paginación
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE) || 1;
  const currentLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, searchTerm]);

  // Exportar logs a JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registro_auditoria_hinojos_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Registro Oficial de Auditoría y Trazabilidad
              </h1>
              <p className="text-xs text-gray-500">
                Historial inmutable de accesos, modificaciones y permisos conforme al Esquema Nacional de Seguridad (ENS)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportJson}
              disabled={filteredLogs.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-lg transition shadow-2xs disabled:opacity-50 cursor-pointer"
              title="Descargar informe completo de auditoría en formato JSON"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Exportar Informe</span>
            </button>

            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="Actualizar registro de eventos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Nota legal / informativa */}
        <div className="mt-4 p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Garantía de Integridad:</strong> Todos los eventos son registrados cronológicamente en la base de datos PostgreSQL de Supabase protegidos por el disparador inmutable municipal. Cada registro documenta el responsable, la acción exacta, la fecha y la dirección IP de conexión.
          </div>
        </div>

        {/* Filtros y Buscador */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Categorías */}
          <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-lg">
            {[
              { id: 'TODAS', label: `Todos (${logs.length})` },
              { id: 'ENTRADAS', label: 'Entradas Doñana' },
              { id: 'CENSO', label: 'Censo y Ganado' },
              { id: 'GANADEROS', label: 'Ganaderos' },
              { id: 'SEGURIDAD', label: 'Seguridad y Usuarios' },
              { id: 'COPIAS', label: 'Copias de Seguridad' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setFilterCategory(cat.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                  filterCategory === cat.id
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar usuario, plaza, crotal, acción..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Tabla de Auditoría */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-700" />
            <p className="text-sm font-semibold">Cargando eventos de auditoría...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-2">
            <ShieldCheck className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">No se encontraron eventos registrados</p>
            <p className="text-xs text-gray-400">Prueba a cambiar los filtros o el término de búsqueda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 whitespace-nowrap">Fecha y Hora</th>
                  <th className="py-3 px-3 whitespace-nowrap">Responsable</th>
                  <th className="py-3 px-3 whitespace-nowrap">Acción</th>
                  <th className="py-3 px-3 whitespace-nowrap">Elemento Afectado</th>
                  <th className="py-3 px-4">Detalles de la Operación</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentLogs.map((log) => {
                  const badge = getActionBadge(log.accion);
                  const isExpanded = expandedLogId === log.id;
                  const { summary, full } = parseDetailsSummary(log.detallesJson);

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`hover:bg-gray-50/80 transition ${
                          isExpanded ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        {/* Fecha */}
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-gray-700 font-medium">
                          {formatDateTime(log.fecha)}
                        </td>

                        {/* Usuario */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{log.usuarioNombre || 'Sistema'}</span>
                            {log.usuarioRol && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-semibold uppercase">
                                {log.usuarioRol === 'ADMINISTRADOR' ? 'Admin' : 'Consulta'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Acción */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                        </td>

                        {/* Entidad */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold text-gray-800">{log.entidad}</span>
                          {log.entidadId && (
                            <span className="block font-mono text-[10px] text-gray-500 truncate max-w-[140px]">
                              {log.entidadId}
                            </span>
                          )}
                        </td>

                        {/* Resumen de detalles */}
                        <td className="py-3 px-4 text-gray-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate max-w-md block" title={summary}>
                              {summary}
                            </span>
                            {full && Object.keys(full).length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold shrink-0 flex items-center gap-0.5 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Menos</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    <span>Ver datos</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* IP */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-[11px] text-gray-400">
                          {log.ip || '-'}
                        </td>
                      </tr>

                      {/* Fila expandible con el desglose completo de detalles */}
                      {isExpanded && full && (
                        <tr className="bg-gray-50 border-y border-emerald-200">
                          <td colSpan={6} className="p-4">
                            <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 text-xs">
                              <span className="font-bold text-gray-800 block text-[11px] uppercase tracking-wider">
                                Desglose íntegro del registro de auditoría:
                              </span>
                              <pre className="bg-gray-50 p-2.5 rounded font-mono text-[11px] text-gray-800 overflow-x-auto max-h-48 border border-gray-100">
                                {JSON.stringify(full, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginador */}
        {!isLoading && filteredLogs.length > ITEMS_PER_PAGE && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-gray-500 font-medium">
              Mostrando <span className="font-bold text-gray-800">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> a{' '}
              <span className="font-bold text-gray-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredLogs.length)}</span> de{' '}
              <span className="font-bold text-gray-800">{filteredLogs.length}</span> eventos
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
              <span className="px-2 font-semibold text-gray-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
              >
                <span>Siguiente</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
