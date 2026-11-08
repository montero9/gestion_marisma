import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  FileText,
  Clock,
  User as UserIcon,
  X,
  ChevronRight,
  Database,
  ArrowRightLeft,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { AuditLog, AuditAction, AuditEntity } from '../types/marisma';
import { ApiService } from '../services/apiService';

interface AuditViewProps {
  onNotify?: (msg: string) => void;
}

export const AuditView: React.FC<AuditViewProps> = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('TODAS');
  const [selectedEntity, setSelectedEntity] = useState<string>('TODAS');

  // Modal de detalles
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await ApiService.getAuditLogs({
        search: searchTerm,
        accion: selectedAction !== 'TODAS' ? selectedAction : undefined,
        entidad: selectedEntity !== 'TODAS' ? selectedEntity : undefined,
        limit: 300,
        offset: 0,
      });
      setLogs(res.logs || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      console.error('Error al cargar registros de auditoría:', err);
      setError(err.message || 'No se pudieron recuperar los registros de auditoría');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [selectedAction, selectedEntity]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getActionBadge = (accion: string) => {
    switch (accion) {
      case 'ALTA':
      case 'NUEVA_CAMPANA':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'MODIFICACION':
      case 'RENOMBRAR_CAMPANA':
      case 'CREAR_EDITAR_GANADERO':
      case 'CREAR_EDITAR_USUARIO':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PERMUTA':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'MOVIMIENTO':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'BAJA':
      case 'ELIMINAR_CAMPANA':
      case 'ELIMINAR_GANADERO':
      case 'ELIMINAR_USUARIO':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'INICIO_SESION':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'DESCARGA_COPIA_SEGURIDAD':
      case 'RESTAURAR_COPIA_SEGURIDAD':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatFecha = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return;

    const headers = ['Fecha y Hora', 'Usuario', 'Rol', 'Acción', 'Entidad', 'Referencia / ID', 'IP', 'Detalles'];
    const rows = logs.map((l) => [
      formatFecha(l.fecha),
      `"${(l.usuarioNombre || '').replace(/"/g, '""')}"`,
      l.usuarioRol || '',
      l.accion || '',
      l.entidad || '',
      `"${(l.entidadId || '').replace(/"/g, '""')}"`,
      l.ip || '',
      `"${(l.detallesJson || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.download = `Auditoria_Municipal_Hinojos_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper para renderizar los detalles JSON de forma legible
  const renderDetallesSummary = (detallesJson?: string) => {
    if (!detallesJson) return <span className="text-gray-400 italic">Sin detalles adicionales</span>;
    try {
      const obj = JSON.parse(detallesJson);
      const keys = Object.keys(obj);
      if (keys.length === 0) return <span className="text-gray-400 italic">Vacío</span>;

      // Resumen sintético en una línea
      const parts: string[] = [];
      if (obj.plaza) parts.push(`Plaza: ${obj.plaza}`);
      if (obj.crotal) parts.push(`Crotal: ${obj.crotal}`);
      if (obj.tipo) parts.push(`Tipo: ${obj.tipo}`);
      if (obj.titular) parts.push(`Titular: ${obj.titular}`);
      if (obj.nombre) parts.push(`Nombre: ${obj.nombre}`);
      if (obj.tipoMovimiento) parts.push(`Mov: ${obj.tipoMovimiento}`);
      if (obj.campana) parts.push(`Campaña: ${obj.campana}`);
      if (obj.nuevaCampana) parts.push(`Nueva: ${obj.nuevaCampana}`);
      if (obj.documentosIncluidos !== undefined) parts.push(`Docs: ${obj.documentosIncluidos}`);
      if (obj.username) parts.push(`User: ${obj.username}`);

      if (parts.length > 0) {
        return <span className="text-xs text-gray-700 font-mono">{parts.slice(0, 3).join(' · ')}</span>;
      }
      return <span className="text-xs text-gray-500 font-mono truncate max-w-xs">{JSON.stringify(obj)}</span>;
    } catch {
      return <span className="text-xs text-gray-500 font-mono truncate max-w-xs">{detallesJson}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado Principal */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Auditoría
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition disabled:opacity-50"
              title="Refrescar registros"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              onClick={handleExportCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Informe CSV</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col md:flex-row items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuario, plaza, crotal, motivo..."
              className="w-full pl-9 pr-9 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50/50"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setTimeout(fetchLogs, 50);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Acción:</span>
            </div>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg py-2 px-2.5 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODAS">Todas las acciones</option>
              <option value="ALTA">Altas de animal</option>
              <option value="MODIFICACION">Modificaciones</option>
              <option value="BAJA">Bajas de animal</option>
              <option value="PERMUTA">Permutas de plaza</option>
              <option value="MOVIMIENTO">Movimientos (Entrada/Salida)</option>
              <option value="NUEVA_CAMPANA">Nueva Campaña</option>
              <option value="RENOMBRAR_CAMPANA">Renombrar Campaña</option>
              <option value="ELIMINAR_CAMPANA">Eliminar Campaña</option>
              <option value="CREAR_EDITAR_GANADERO">Ganaderos (Crear/Editar)</option>
              <option value="ELIMINAR_GANADERO">Ganaderos (Eliminar)</option>
              <option value="INICIO_SESION">Inicios de sesión</option>
              <option value="CREAR_EDITAR_USUARIO">Usuarios (Crear/Editar)</option>
              <option value="ELIMINAR_USUARIO">Usuarios (Eliminar)</option>
              <option value="DESCARGA_COPIA_SEGURIDAD">Copia de Seguridad (Descarga)</option>
              <option value="RESTAURAR_COPIA_SEGURIDAD">Copia de Seguridad (Restaurar)</option>
            </select>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-2">
              <span>Entidad:</span>
            </div>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="text-xs border border-gray-300 rounded-lg py-2 px-2.5 bg-white font-medium text-gray-700 focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TODAS">Todas las entidades</option>
              <option value="ANIMAL">Animales</option>
              <option value="MOVIMIENTO">Movimientos</option>
              <option value="PLAZAS">Plazas</option>
              <option value="CAMPANA">Campañas</option>
              <option value="GANADERO">Ganaderos</option>
              <option value="USUARIO">Usuarios</option>
              <option value="SISTEMA">Sistema</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Registros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700">
            Mostrando {logs.length} registro(s) {totalCount > logs.length ? `de un total de ${totalCount}` : ''}
          </span>
          <span className="text-gray-500">Orden cronológico descendente (más recientes primero)</span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span>Consultando registro de auditoría municipal...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
            <ShieldCheck className="w-8 h-8 text-gray-300" />
            <span className="font-semibold text-gray-600">No se encontraron registros de auditoría</span>
            <span className="text-gray-400">Pruebe a cambiar los filtros de búsqueda o acción</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100/75 border-b border-gray-200 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4">Usuario</th>
                  <th className="py-3 px-4">Acción</th>
                  <th className="py-3 px-4">Entidad</th>
                  <th className="py-3 px-4">Referencia</th>
                  <th className="py-3 px-4">Resumen de Cambios</th>
                  <th className="py-3 px-4 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Fecha */}
                    <td className="py-3 px-4 whitespace-nowrap text-gray-700 font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatFecha(log.fecha)}</span>
                      </div>
                    </td>

                    {/* Usuario */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px]">
                          {log.usuarioNombre ? log.usuarioNombre.slice(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{log.usuarioNombre || 'Sistema'}</div>
                          <div className="text-[10px] text-gray-500 uppercase">{log.usuarioRol || 'ADMINISTRADOR'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Acción */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getActionBadge(
                          log.accion
                        )}`}
                      >
                        {log.accion}
                      </span>
                    </td>

                    {/* Entidad */}
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-gray-800">
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[11px] font-mono border border-gray-200">
                        {log.entidad}
                      </span>
                    </td>

                    {/* Referencia */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-bold text-gray-700">
                      {log.entidadId || <span className="text-gray-400 font-normal italic">-</span>}
                    </td>

                    {/* Resumen */}
                    <td className="py-3 px-4 max-w-xs truncate">
                      {renderDetallesSummary(log.detallesJson)}
                    </td>

                    {/* Botón Ver Detalle */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => setDetailLog(log)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DETALLES DEL REGISTRO DE AUDITORÍA */}
      {detailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Cabecera Modal */}
            <div className="p-5 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 rounded-lg text-white">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalle de Registro de Auditoría</h3>
                  <p className="text-xs text-gray-300 font-mono">ID: {detailLog.id}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailLog(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Modal */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Metadatos Generales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Fecha y Hora</span>
                  <span className="font-mono text-gray-900 font-bold text-xs">{formatFecha(detailLog.fecha)}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Usuario Responsable</span>
                  <span className="font-bold text-gray-900 text-xs">{detailLog.usuarioNombre}</span>
                  <span className="text-[10px] text-gray-500 block">({detailLog.usuarioRol})</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Acción Oficial</span>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold border ${getActionBadge(
                      detailLog.accion
                    )}`}
                  >
                    {detailLog.accion}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Entidad Afectada</span>
                  <span className="font-mono text-gray-900 font-semibold">{detailLog.entidad}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Referencia / ID</span>
                  <span className="font-mono text-gray-900 font-bold">{detailLog.entidadId || '-'}</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">IP Origen</span>
                  <span className="font-mono text-gray-900">{detailLog.ip || '127.0.0.1'}</span>
                </div>
              </div>

              {/* Bloque de Detalles JSON Completo */}
              <div>
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Carga de Datos y Cambios Registrados (JSON):</span>
                </h4>
                <div className="bg-gray-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-72 border border-gray-800">
                  <pre className="whitespace-pre-wrap break-all">
                    {detailLog.detallesJson
                      ? JSON.stringify(JSON.parse(detailLog.detallesJson), null, 2)
                      : 'Sin contenido en detallesJson'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Pie Modal */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setDetailLog(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg transition"
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
