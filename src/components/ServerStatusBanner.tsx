import React, { useEffect, useState } from 'react';
import { apiClient, ServerConnectionStatus } from '../services/apiClient';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export const ServerStatusBanner: React.FC = () => {
  const [status, setStatus] = useState<ServerConnectionStatus>(apiClient.getStatus());
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showConnectedBriefly, setShowConnectedBriefly] = useState(false);

  useEffect(() => {
    let timer: any = null;
    const unsubscribe = apiClient.subscribe((newStatus, message) => {
      setStatus(newStatus);
      if (message) setStatusMessage(message);

      if (newStatus === 'ONLINE') {
        setShowConnectedBriefly(true);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => setShowConnectedBriefly(false), 3500);
      }
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (status === 'ONLINE' && !showConnectedBriefly) {
    return null;
  }

  if (status === 'ONLINE' && showConnectedBriefly) {
    return (
      <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm transition-all animate-fadeIn">
        <CheckCircle2 className="w-4 h-4 text-emerald-200" />
        <span className="font-medium">
          Servidor municipal conectado y sincronizado en tiempo real.
        </span>
      </div>
    );
  }

  if (status === 'WAKING_UP') {
    return (
      <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm shadow-inner transition-all">
        <Loader2 className="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" />
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-amber-800">Servidor en reactivación:</span>
          <span>
            {statusMessage || 'El servidor gratuito se está reactivando tras suspensión. Por favor, espere antes de guardar cambios...'}
          </span>
        </div>
        <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-mono font-medium">
          Auto-reintentando
        </span>
      </div>
    );
  }

  if (status === 'OFFLINE') {
    return (
      <div className="bg-red-50 border-b border-red-200 text-red-900 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm shadow-inner">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span className="font-semibold text-red-800">Sin conexión con el servidor:</span>
          <span>No se ha podido sincronizar con la base de datos municipal.</span>
        </div>
        <button
          onClick={() => apiClient.wakeUpServer()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reconectar ahora
        </button>
      </div>
    );
  }

  return null;
};

/**
 * Píldora compacta para mostrar en la cabecera institucional
 */
export const ServerStatusPill: React.FC = () => {
  const [status, setStatus] = useState<ServerConnectionStatus>(apiClient.getStatus());

  useEffect(() => {
    return apiClient.subscribe((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  if (status === 'ONLINE') {
    return (
      <span
        title="Servidor activo y sincronizado con base de datos SQLite"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-800/80 text-emerald-200 border border-emerald-600/50"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span className="hidden sm:inline">Servidor Activo</span>
      </span>
    );
  }

  if (status === 'WAKING_UP') {
    return (
      <span
        title="Servidor en modo reactivación (cold start)"
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-400/50"
      >
        <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
        <span className="hidden sm:inline">Reactivando</span>
      </span>
    );
  }

  return (
    <span
      title="Desconectado del servidor"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-400/50"
    >
      <span className="w-2 h-2 rounded-full bg-red-400"></span>
      <span className="hidden sm:inline">Desconectado</span>
    </span>
  );
};
