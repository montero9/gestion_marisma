import React, { useState, useEffect, useMemo } from 'react';
import { EntradaRemesa, Animal, Owner, User } from '../types/marisma';
import { ApiService } from '../services/apiService';
import { EntradaEditorModal } from './EntradaEditorModal';
import { EntradaConsultaPersonaModal } from './EntradaConsultaPersonaModal';
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

  // Acciones en curso
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadRemesas();
  }, [activeCampaign]);

  const loadRemesas = async () => {
    setIsLoading(true);
    try {
      const data = await ApiService.getEntradas(activeCampaign);
      setRemesas(data);
    } catch (err: any) {
      console.error('Error cargando remesas de entrada:', err);
    } finally {
      setIsLoading(false);
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
    if (!window.confirm(`¿Está seguro de eliminar la remesa "${remesa.tituloOficial}"?`)) {
      return;
    }
    try {
      await ApiService.deleteEntrada(remesa.id);
      setRemesas((prev) => prev.filter((r) => r.id !== remesa.id));
    } catch (err: any) {
      alert('Error eliminando la remesa: ' + err.message);
    }
  };

  const handleDownloadOds = async (remesa: EntradaRemesa) => {
    setProcessingId(remesa.id);
    try {
      const filename = `${(remesa.tituloOficial || 'Permisos_Marisma').replace(/[^\w.-]/g, '_')}.ods`;
      await ApiService.downloadEntradaOds(remesa.id, filename);
    } catch (err: any) {
      alert('Error al descargar el archivo ODS: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDirectSendEmail = async (remesa: EntradaRemesa) => {
    const confirmMsg = `¿Desea enviar la remesa "${remesa.tituloOficial}" por correo electrónico al Espacio Natural de Doñana?`;
    if (!window.confirm(confirmMsg)) return;

    setProcessingId(remesa.id);
    try {
      const res = await ApiService.enviarEntradaEmail(remesa.id);
      alert(`¡Correo enviado con éxito a Doñana!\n\nDestinatarios: ${res.sendResult?.recipients?.join(', ')}`);
      loadRemesas();
    } catch (err: any) {
      alert('Error al enviar el correo a Doñana: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkAsSent = async (remesa: EntradaRemesa) => {
    if (
      !confirm(
        `¿Desea marcar la remesa "${remesa.tituloOficial}" como ENVIADA manualmente?\n\nEsta acción cambiará su estado oficial a ENVIADO sin enviar correo (para comunicaciones telefónicas o presenciales).`
      )
    ) {
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
      alert('La remesa se ha marcado como ENVIADA con éxito.');
    } catch (err: any) {
      alert('Error al marcar la remesa como enviada: ' + err.message);
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
      if (filterEstado !== 'TODOS' && r.estado !== filterEstado) {
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

          <button
            type="button"
            onClick={handleCreateNew}
            className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Solicitud</span>
          </button>
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
            Borradores ({remesas.filter((r) => r.estado === 'BORRADOR').length})
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
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Crear Nueva Solicitud</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredRemesas.map((remesa) => {
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
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                          remesa.estado === 'ENVIADO'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {remesa.estado === 'ENVIADO'
                          ? formatEnviadoBadge(remesa.fechaEnvioEmail || remesa.actualizadoEn || remesa.creadoEn)
                          : 'BORRADOR'}
                      </span>
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
                    className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                    title="Editar remesa"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(remesa)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                    title="Eliminar remesa y sus documentos"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
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
        readOnly={isReadOnlyEditor}
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
    </div>
  );
};
