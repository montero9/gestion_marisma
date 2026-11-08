import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  FileCheck2,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { ApiService } from '../services/apiService';

interface BackupViewProps {
  onReloadAllData: () => void;
  onNotify?: (msg: string) => void;
}

interface BackupStats {
  databaseSize: number;
  databaseLastModified: string;
  documentsCount: number;
  documentsTotalSize: number;
  animalsCount: number;
  movementsCount: number;
  ownersCount: number;
  auditLogsCount: number;
  campaignsCount: number;
}

export const BackupView: React.FC<BackupViewProps> = ({ onReloadAllData, onNotify }) => {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isRestoringZip, setIsRestoringZip] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal de confirmación para restauración
  const [selectedFileForRestore, setSelectedFileForRestore] = useState<File | null>(null);
  const [isConfirmRestoreOpen, setIsConfirmRestoreOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copia JSON secundaria legacy
  const [isExportingJson, setIsExportingJson] = useState(false);
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const data = await ApiService.getBackupStats();
      setStats(data);
    } catch (err: any) {
      console.warn('Error al obtener estadísticas de backup:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    setFeedbackMsg({ text: 'Consolidando base de datos y empaquetando archivos...', type: 'info' });
    try {
      await ApiService.downloadBackupZip();
      setFeedbackMsg({
        text: 'Copia de seguridad (.ZIP) generada y descargada con éxito.',
        type: 'success',
      });
      fetchStats();
    } catch (err: any) {
      console.error('Error al descargar copia de seguridad zip:', err);
      setFeedbackMsg({
        text: `Error al generar copia de seguridad: ${err.message || 'Error desconocido'}`,
        type: 'error',
      });
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('El archivo debe ser un archivo comprimido .ZIP');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFileForRestore(file);
    setIsConfirmRestoreOpen(true);
  };

  const executeRestoreZip = async () => {
    if (!selectedFileForRestore) return;
    setIsRestoringZip(true);
    setIsConfirmRestoreOpen(false);
    setFeedbackMsg({ text: 'Restaurando base de datos y documentos...', type: 'info' });

    try {
      const res = await ApiService.restoreBackupZip(selectedFileForRestore);
      setFeedbackMsg({
        text: `Copia de seguridad restaurada correctamente. ${res.documentosRestaurados ? `${res.documentosRestaurados} documento(s) restaurados.` : ''}`,
        type: 'success',
      });
      if (onNotify) onNotify('Base de datos restaurada correctamente');
      await fetchStats();
      onReloadAllData();
    } catch (err: any) {
      console.error('Error restaurando copia de seguridad zip:', err);
      setFeedbackMsg({
        text: `Error crítico al restaurar copia de seguridad: ${err.message || 'Archivo no válido'}`,
        type: 'error',
      });
    } finally {
      setIsRestoringZip(false);
      setSelectedFileForRestore(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Exportar JSON secundario
  const handleExportJson = async () => {
    setIsExportingJson(true);
    try {
      const data = await ApiService.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_marisma_hinojos_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedbackMsg({ text: 'Respaldo JSON descargado correctamente.', type: 'success' });
    } catch (err: any) {
      setFeedbackMsg({ text: `Error al exportar JSON: ${err.message}`, type: 'error' });
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-800 rounded-xl border border-blue-200">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Copia de Seguridad
              </h1>
            </div>
          </div>

          <button
            onClick={fetchStats}
            disabled={isLoadingStats}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition self-start md:self-auto disabled:opacity-50"
            title="Actualizar estado del almacenamiento"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin' : ''}`} />
            <span>Actualizar Estado</span>
          </button>
        </div>

        {/* Tarjetas de Diagnóstico del Sistema */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-gray-100">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Base de Datos</span>
              <div className="font-bold text-gray-900 text-sm mt-1">{formatBytes(stats.databaseSize)}</div>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> SQLite WAL Consolidado
              </span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Documentos Adjuntos</span>
              <div className="font-bold text-gray-900 text-sm mt-1">{stats.documentsCount} archivos</div>
              <span className="text-[10px] text-gray-500 mt-0.5 block">{formatBytes(stats.documentsTotalSize)} en disco</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Censo y Movimientos</span>
              <div className="font-bold text-gray-900 text-sm mt-1">
                {stats.animalsCount} animales · {stats.movementsCount} movs
              </div>
              <span className="text-[10px] text-gray-500 mt-0.5 block">{stats.ownersCount} ganaderos registrados</span>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Registro de Auditoría</span>
              <div className="font-bold text-gray-900 text-sm mt-1">{stats.auditLogsCount} eventos</div>
              <span className="text-[10px] text-gray-500 mt-0.5 block">{stats.campaignsCount} campañas archivadas</span>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : feedbackMsg.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {feedbackMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {feedbackMsg.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            {feedbackMsg.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Acciones Principales de Respaldo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* TARJETA 1: DESCARGA DE COPIA DE SEGURIDAD (.ZIP) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Download className="w-5 h-5 text-emerald-700" />
              <h2 className="text-base font-bold text-gray-900">
                Descargar Copia de Seguridad (.ZIP)
              </h2>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Genera en un solo clic un archivo <span className="font-mono font-bold text-gray-800">.ZIP</span> oficial bajo demanda para archivar en las dependencias municipales o conservar de forma externa.
            </p>

            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 space-y-2 text-xs text-emerald-950">
              <span className="font-bold block text-emerald-900">Contenido del archivo ZIP de copia:</span>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-emerald-800">
                <li><span className="font-mono font-semibold">marisma.db</span>: Base de datos SQLite consolidada (WAL checkpoint).</li>
                <li><span className="font-mono font-semibold">manifest.json</span>: Certificado municipal con fecha, recuentos y versión.</li>
                <li><span className="font-mono font-semibold">documents/</span>: Todos los PDFs adjuntos, certificados y fotografías.</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${isExportingZip ? 'animate-bounce' : ''}`} />
              <span>{isExportingZip ? 'Generando Copia de Seguridad...' : '📥 Descargar Copia de Seguridad Completa (.ZIP)'}</span>
            </button>
          </div>
        </div>

        {/* TARJETA 2: RESTAURAR COPIA DE SEGURIDAD (.ZIP) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Upload className="w-5 h-5 text-rose-700" />
              <h2 className="text-base font-bold text-gray-900">
                Restaurar Copia de Seguridad (.ZIP)
              </h2>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Carga un archivo de respaldo <span className="font-mono font-bold text-gray-800">.ZIP</span> previamente descargado para recuperar todos los datos, campañas, usuarios y documentos adjuntos.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1 text-xs text-amber-900">
              <span className="font-bold flex items-center gap-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" />
                Protección Automática de Emergencia:
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Antes de sobreescribir la base de datos, el servidor genera de forma automática una copia de seguridad previa de emergencia (<span className="font-mono">marisma.db.bak</span>) para evitar cualquier pérdida accidental.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoringZip}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Upload className={`w-4 h-4 ${isRestoringZip ? 'animate-spin' : ''}`} />
              <span>{isRestoringZip ? 'Restaurando Base de Datos...' : 'Restaurar Copia de Seguridad (.ZIP)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN DE RESTAURACIÓN */}
      {isConfirmRestoreOpen && selectedFileForRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">¿Confirmar Restauración de Datos?</h3>
                <p className="text-xs text-gray-500">Operación crítica de administración del sistema</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
              <div>
                <span className="text-gray-500 font-medium">Archivo seleccionado:</span>
                <span className="font-mono font-bold text-gray-900 ml-2 block truncate">
                  {selectedFileForRestore.name} ({formatBytes(selectedFileForRestore.size)})
                </span>
              </div>
              <p className="text-gray-600 leading-relaxed pt-1">
                La base de datos actual será reemplazada por los registros contenidos en este archivo ZIP. Los documentos oficiales que no existan serán restaurados.
              </p>
              <p className="text-emerald-700 font-bold flex items-center gap-1 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Se creará una copia de seguridad previa de emergencia antes de ejecutar.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsConfirmRestoreOpen(false);
                  setSelectedFileForRestore(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeRestoreZip}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                Sí, Restaurar Base de Datos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección Secundaria: Exportación JSON de compatibilidad */}
      <div className="bg-gray-50/70 rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-gray-800 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-500" />
              Respaldo Alternativo en Formato JSON
            </span>
            <p className="text-gray-500 text-[11px] mt-0.5">
              Exportación en texto plano compatible con scripts externos o migraciones de base de datos relacionales.
            </p>
          </div>
          <button
            onClick={handleExportJson}
            disabled={isExportingJson}
            className="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded-lg border border-gray-300 transition text-xs shadow-2xs self-start sm:self-auto"
          >
            {isExportingJson ? 'Exportando...' : 'Descargar JSON'}
          </button>
        </div>
      </div>
    </div>
  );
};
