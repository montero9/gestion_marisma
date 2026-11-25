import React, { useState, useEffect, useMemo } from 'react';
import { EntradaRemesa, Animal, Owner, User } from '../types/marisma';
import { ApiService } from '../services/apiService';
import { dialogService } from '../services/dialogService';
import { EntradaEditorModal } from './EntradaEditorModal';
import { EntradaConsultaPersonaModal } from './EntradaConsultaPersonaModal';
import { EnviandoEmailModal } from './EnviandoEmailModal';
import {
  FileText,
  Plus,
  Settings,
  Download,
  Send,
  Trash2,
  Edit3,
  Calendar,
  Users,
  Search,
  CheckCircle,
  Clock,
  Car,
  Loader2,
  Mail,
  ShieldCheck,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

// Formateador para badge de remesa enviada: "ENVIADO MARTES 17/11/26"
const formatEnviadoBadge = (fechaIso?: string): string => {
  if (!fechaIso) return 'ENVIADO';
  try {
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return 'ENVIADO';
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' }).toUpperCase();
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return `ENVIADO ${weekday} ${dateStr}`;
  } catch {
    return 'ENVIADO';
  }
};

interface EntradasViewProps {
  activeCampaign: string;
  currentUser: User;
  animals: Animal[];
  owners: Owner[];
  onOpenAnimalDetail?: (animal: Animal) => void;
  onAnimalsUpdated?: () => void;
}

export const EntradasView: React.FC<EntradasViewProps> = ({
  activeCampaign,
  currentUser,
  animals,
  owners,
  onOpenAnimalDetail,
  onAnimalsUpdated,
}) => {
  const [remesas, setRemesas] = useState<EntradaRemesa[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filterEstado, setFilterEstado] = useState<'TODOS' | 'BORRADOR' | 'ENVIADO'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modales
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isReadOnlyEditor, setIsReadOnlyEditor] = useState(false);
  const [editingRemesa, setEditingRemesa] = useState<EntradaRemesa | null>(null);
  const [isConsultaOpen, setIsConsultaOpen] = useState(false);

  const isReadOnlyUser = currentUser.rol !== 'ADMINISTRADOR';

  // Acciones en curso
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [sendingModalData, setSendingModalData] = useState<{
    isOpen: boolean;
    status: 'sending' | 'success' | 'error';
    titulo: string;
    recipients?: string[];
    bcc?: string[];
    errorMessage?: string;
  }>({
    isOpen: false,
    status: 'sending',
    titulo: '',
  });

  useEffect(() => {
    loadRemesas();
  }, [activeCampaign]);

  // Si alguna remesa está en estado ENVIANDO (ej. tras recargar la página), refrescar automáticamente cada 3s
  useEffect(() => {
    const hasEnviando = remesas.some((r) => r.estado === 'ENVIANDO');
    if (!hasEnviando) return;

    const intervalId = setInterval(() => {
      loadRemesas(true); // silent refresh sin activar loader general
    }, 3000);

    return () => clearInterval(intervalId);
  }, [remesas, activeCampaign]);

  const loadRemesas = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await ApiService.getEntradas(activeCampaign);
      setRemesas(data);
    } catch (err: any) {
      console.error('Error cargando remesas de entrada:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingRemesa(null);
    setIsReadOnlyEditor(false);
    setIsEditorOpen(true);
  };

  const handleEdit = (remesa: EntradaRemesa) => {
    setEditingRemesa(remesa);
    setIsReadOnlyEditor(false);
    setIsEditorOpen(true);
  };

  const handleView = (remesa: EntradaRemesa) => {
    setEditingRemesa(remesa);
    setIsReadOnlyEditor(true);
    setIsEditorOpen(true);
  };

  const handleDelete = async (remesa: EntradaRemesa) => {
    const confirmed = await dialogService.confirm({
      title: 'Eliminar Solicitud',
      message: `¿Está seguro de eliminar la remesa "${remesa.tituloOficial}"?`,
      isDestructive: true,
      confirmText: 'Eliminar',
    });
    if (!confirmed) {
      return;
    }
    try {
      await ApiService.deleteEntrada(remesa.id);
      setRemesas((prev) => prev.filter((r) => r.id !== remesa.id));
    } catch (err: any) {
      dialogService.showError('Error eliminando la remesa: ' + err.message);
    }
  };

  const handleDownloadOds = async (remesa: EntradaRemesa) => {
    setProcessingId(remesa.id);
    try {
      const filename = `${(remesa.tituloOficial || 'Permisos_Marisma').replace(/[^\w.-]/g, '_')}.ods`;
      await ApiService.downloadEntradaOds(remesa.id, filename);
    } catch (err: any) {
      dialogService.showError('Error al descargar el archivo ODS: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDirectSendEmail = async (remesa: EntradaRemesa) => {
    setProcessingId(remesa.id);
    setSendingModalData({
      isOpen: true,
      status: 'sending',
      titulo: remesa.tituloOficial,
    });
    try {
      const res = await ApiService.enviarEntradaEmail(remesa.id);
      setSendingModalData({
        isOpen: true,
        status: 'success',
        titulo: remesa.tituloOficial,
        recipients: res.sendResult?.recipients || [],
        bcc: res.sendResult?.bcc || [],
      });
      loadRemesas(true);
    } catch (err: any) {
      setSendingModalData({
        isOpen: true,
        status: 'error',
        titulo: remesa.tituloOficial,
        errorMessage: err.message || 'Error al enviar el correo a Doñana',
      });
      loadRemesas(true);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsSent = async (remesa: EntradaRemesa) => {
    const confirmed = await dialogService.confirm({
      title: 'Marcar como Enviada',
      message: `¿Desea marcar la remesa "${remesa.tituloOficial}" como ENVIADA manualmente?\n\nEsta acción cambiará su estado oficial a ENVIADO sin enviar correo (para comunicaciones telefónicas o presenciales).`,
      confirmText: 'Marcar como Enviada',
    });
    if (!confirmed) {
      return;
    }
    setProcessingId(remesa.id);
    try {
      const updated: EntradaRemesa = {
        ...remesa,
        estado: 'ENVIADO',
        fechaEnvioEmail: new Date().toISOString(),
        destinatariosEmail: 'Comunicación manual / presencial',
        actualizadoEn: new Date().toISOString(),
      };
      await ApiService.saveEntrada(updated);
      handleSavedRemesa(updated);
      dialogService.showSuccess('La remesa se ha marcado como ENVIADA con éxito.');
    } catch (err: any) {
      dialogService.showError('Error al marcar la remesa como enviada: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleSavedRemesa = (saved: EntradaRemesa) => {
    setRemesas((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      if (exists) {
        return prev.map((r) => (r.id === saved.id ? saved : r));
      }
      return [saved, ...prev];
    });
  };

  // Filtrado de remesas
  const filteredRemesas = useMemo(() => {
    return remesas.filter((r) => {
      if (filterEstado === 'BORRADOR' && r.estado !== 'BORRADOR' && r.estado !== 'ENVIANDO') {
        return false;
      }
      if (filterEstado === 'ENVIADO' && r.estado !== 'ENVIADO') {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesTitulo = r.tituloOficial.toLowerCase().includes(q);
        const matchesDias = (r.diasTexto || '').toLowerCase().includes(q);
        const matchesPersonas = (r.personas || []).some(
          (p) =>
            p.nombreApellidos.toLowerCase().includes(q) ||
            (p.matriculas || '').toLowerCase().includes(q) ||
            (p.animales || []).some(
              (a) =>
                a.plazaNumero.toLowerCase().includes(q) ||
                a.identificacionChip.toLowerCase().includes(q)
            )
        );
        if (!matchesTitulo && !matchesDias && !matchesPersonas) {
          return false;
        }
      }
      return true;
    });
  }, [remesas, filterEstado, searchTerm]);

  // Paginación (máximo 15 remesas por página)
  const ITEMS_PER_PAGE = 15;
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCampaign, filterEstado, searchTerm]);

  const totalPages = Math.ceil(filteredRemesas.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRemesas = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRemesas.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRemesas, currentPage]);

  return (
    <div className="space-y-6">
      {/* Cabecera del Módulo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Permisos de Entrada a la Marisma
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setIsConsultaOpen(true)}
            className="flex-1 md:flex-none px-3.5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            title="Consultar historial de accesos de una persona concreta para informes a superiores"
          >
            <Users className="w-4 h-4 text-emerald-700" />
            <span>Consultar por Ganadero</span>
          </button>

          {!isReadOnlyUser && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Solicitud</span>
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filtros de estado */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setFilterEstado('TODOS')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              filterEstado === 'TODOS'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todas ({remesas.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('BORRADOR')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              filterEstado === 'BORRADOR'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Borradores ({remesas.filter((r) => r.estado === 'BORRADOR' || r.estado === 'ENVIANDO').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterEstado('ENVIADO')}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
              filterEstado === 'ENVIADO'
                ? 'bg-white text-emerald-950 shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Enviados ({remesas.filter((r) => r.estado === 'ENVIADO').length})
          </button>
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ganadero, matrícula, plaza..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Lista de Remesas */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
          <p className="text-sm">Cargando permisos de entrada...</p>
        </div>
      ) : filteredRemesas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-700">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-800">No se encontraron remesas de entrada</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              {searchTerm || filterEstado !== 'TODOS'
                ? 'Pruebe a cambiar los filtros o el término de búsqueda.'
                : 'Cree la primera solicitud de acceso para Miércoles/Jueves o Sábado/Domingo.'}
            </p>
          </div>
          {!isReadOnlyUser && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Nueva Solicitud</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedRemesas.map((remesa) => {
            const personas = remesa.personas || [];
            const countRepasar = personas.filter((p) => p.esTitular && p.faena === 'REPASAR').length;
            const countSoltar = personas.filter((p) => p.esTitular && p.faena === 'SOLTAR').length;
            const countRecoger = personas.filter((p) => p.esTitular && p.faena === 'RECOGER').length;
            const countAcompanantes = personas.filter((p) => !p.esTitular).length;

            const isProcessing = processingId === remesa.id;

            return (
              <div
                key={remesa.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-xs transition px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 group"
              >
                {/* Bloque Izquierdo: Icono, Título y Días */}
                <div
                  onClick={() => handleView(remesa)}
                  className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  title="Haga clic para ver los detalles de esta solicitud"
                >
                  <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl group-hover:bg-emerald-100 transition shrink-0">
                    <Calendar className="w-5 h-5 text-emerald-700" />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-900 transition truncate">
                        {remesa.tituloOficial}
                      </h3>
                      {remesa.estado === 'ENVIANDO' ? (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5 animate-pulse shadow-xs">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                          ENVIANDO...
                        </span>
                      ) : remesa.estado === 'ENVIADO' ? (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {formatEnviadoBadge(remesa.fechaEnvioEmail || remesa.actualizadoEn || remesa.creadoEn)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-900 border border-amber-300">
                          BORRADOR
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {remesa.diasTexto} · Campaña {remesa.campana}
                    </p>
                  </div>
                </div>

                {/* Bloque Central: Píldoras de resumen de personas y faenas */}
                <div
                  onClick={() => handleView(remesa)}
                  className="flex flex-wrap items-center gap-1.5 text-[11px] cursor-pointer"
                >
                  <span className="bg-gray-100 text-gray-800 font-bold px-2 py-1 rounded-md">
                    👥 {personas.length} pers. {countAcompanantes > 0 ? `(${personas.length - countAcompanantes}+${countAcompanantes})` : ''}
                  </span>
                  {countRepasar > 0 && (
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md">
                      🔍 {countRepasar} repaso
                    </span>
                  )}
                  {countSoltar > 0 && (
                    <span className="bg-emerald-50 text-emerald-800 font-semibold px-2 py-1 rounded-md">
                      🐎 {countSoltar} soltar
                    </span>
                  )}
                  {countRecoger > 0 && (
                    <span className="bg-amber-50 text-amber-900 font-semibold px-2 py-1 rounded-md">
                      🐎 {countRecoger} recoger
                    </span>
                  )}
                </div>

                {/* Bloque Derecho: Botonera de Acciones compacta */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleView(remesa)}
                    className="px-2.5 py-1.5 bg-gray-50 hover:bg-emerald-50 text-emerald-800 border border-gray-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Ver solicitud en modo consulta (solo lectura)"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Ver</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadOds(remesa)}
                    disabled={isProcessing}
                    className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    title="Descargar archivo oficial .ODS"
                  >
                    <Download className="w-3.5 h-3.5 text-gray-600" />
                    <span className="hidden lg:inline text-[11px]">ODS</span>
                  </button>

                  {isReadOnlyUser ? (
                    <button
                      type="button"
                      onClick={() => handleView(remesa)}
                      className="px-2.5 py-1.5 bg-gray-50 hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Ver detalles de la solicitud (Solo lectura)"
                    >
                      <Eye className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-[11px]">Ver Solicitud</span>
                    </button>
                  ) : (
                    <>
                      {remesa.estado === 'ENVIANDO' ? (
                        <button
                          type="button"
                          disabled={true}
                          className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-not-allowed opacity-90 shadow-2xs"
                          title="Envío en progreso a Doñana..."
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[11px]">Enviando...</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDirectSendEmail(remesa)}
                          disabled={isProcessing}
                          className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs disabled:opacity-50"
                          title={remesa.estado === 'ENVIADO' ? 'Reenviar a Doñana' : 'Enviar a Doñana'}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span className="text-[11px]">{remesa.estado === 'ENVIADO' ? 'Reenviar' : 'Enviar'}</span>
                        </button>
                      )}

                      {remesa.estado === 'BORRADOR' && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsSent(remesa)}
                          disabled={isProcessing}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Marcar como enviado manualmente (comunicación telefónica o presencial)"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-[11px] hidden sm:inline">Marcar Enviado</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleEdit(remesa)}
                        disabled={remesa.estado === 'ENVIANDO'}
                        className={`p-1.5 rounded-lg transition ${
                          remesa.estado === 'ENVIANDO'
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer'
                        }`}
                        title={remesa.estado === 'ENVIANDO' ? 'Envío en curso...' : 'Editar remesa'}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(remesa)}
                        disabled={isProcessing || remesa.estado === 'ENVIANDO'}
                        className={`p-1.5 rounded-lg transition ${
                          remesa.estado === 'ENVIANDO'
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer'
                        }`}
                        title={remesa.estado === 'ENVIANDO' ? 'Envío en curso...' : 'Eliminar remesa y sus documentos'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paginación de Remesas (máximo 15 por página) */}
      {!isLoading && filteredRemesas.length > ITEMS_PER_PAGE && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
          <div className="text-xs text-gray-500 font-medium">
            Mostrando{' '}
            <span className="font-bold text-gray-800">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>{' '}
            a{' '}
            <span className="font-bold text-gray-800">
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredRemesas.length)}
            </span>{' '}
            de{' '}
            <span className="font-bold text-gray-800">
              {filteredRemesas.length}
            </span>{' '}
            solicitudes
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Si hay más de 7 páginas, compactar con puntos suspensivos
                if (
                  totalPages > 7 &&
                  page !== 1 &&
                  page !== totalPages &&
                  Math.abs(page - currentPage) > 2
                ) {
                  if (page === 2 || page === totalPages - 1) {
                    return (
                      <span key={page} className="px-1 text-gray-400 text-xs font-bold">
                        ...
                      </span>
                    );
                  }
                  return null;
                }

                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                      currentPage === page
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Editor / Consulta */}
      <EntradaEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        remesa={editingRemesa}
        onSaved={handleSavedRemesa}
        animals={animals}
        owners={owners}
        activeCampaign={activeCampaign}
        currentUser={currentUser}
        readOnly={isReadOnlyEditor || isReadOnlyUser}
        onAnimalsUpdated={onAnimalsUpdated}
      />

      {/* Modal Consulta de Accesos por Ganadero (para superiores) */}
      <EntradaConsultaPersonaModal
        isOpen={isConsultaOpen}
        onClose={() => setIsConsultaOpen(false)}
        remesas={remesas}
        owners={owners}
        activeCampaign={activeCampaign}
        onVerEntrada={(remesa) => handleView(remesa)}
      />

      {/* Modal oficial de envío de entradas con cuenta atrás y confirmación */}
      <EnviandoEmailModal
        isOpen={sendingModalData.isOpen}
        status={sendingModalData.status}
        tituloOficial={sendingModalData.titulo}
        recipients={sendingModalData.recipients}
        bcc={sendingModalData.bcc}
        errorMessage={sendingModalData.errorMessage}
        onClose={() => setSendingModalData({ isOpen: false, status: 'sending', titulo: '' })}
      />
    </div>
  );
};
