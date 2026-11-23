import React, { useEffect, useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';

interface EnviandoEmailModalProps {
  isOpen: boolean;
  tituloOficial?: string;
  totalSegundos?: number;
}

export const EnviandoEmailModal: React.FC<EnviandoEmailModalProps> = ({
  isOpen,
  tituloOficial,
  totalSegundos = 10,
}) => {
  const [segundosRestantes, setSegundosRestantes] = useState<number>(totalSegundos);

  // Reiniciar contador cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setSegundosRestantes(totalSegundos);
      const interval = setInterval(() => {
        setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

      // Bloquear cierre o recarga accidental de la pestaña durante el envío
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = 'Hay un envío de correo oficial en curso. Si recarga o cierra la ventana podría interrumpirse el proceso.';
        return e.returnValue;
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isOpen, totalSegundos]);

  if (!isOpen) return null;

  // Cálculo del porcentaje de la barra de progreso (máximo 95% hasta que termine el servidor)
  const elapsed = totalSegundos - segundosRestantes;
  const progressPercent = Math.min(95, Math.round((elapsed / totalSegundos) * 92) + 8);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enviando-email-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Icono animado */}
        <div className="relative mx-auto w-16 h-16 mb-4 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-40" />
          <div className="relative w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500/40 flex items-center justify-center shadow-inner">
            <Mail className="w-8 h-8 text-emerald-700 animate-pulse" />
          </div>
          <div className="absolute -top-1 -right-1 bg-emerald-600 rounded-full p-1 shadow">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          </div>
        </div>

        {/* Título de la remesa si existe */}
        {tituloOficial && (
          <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md truncate max-w-[90%] mb-2">
            {tituloOficial}
          </span>
        )}

        {/* Mensaje solicitado por el usuario */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 my-3 text-emerald-950">
          <p className="font-extrabold text-base tracking-tight text-emerald-900">
            Enviando entradas...
          </p>
          <p className="text-xs font-semibold text-emerald-800 mt-1 leading-relaxed">
            Por favor, espere unos segundos sin cerrar la ventana
          </p>
        </div>

        {/* Contador y barra de progreso */}
        <div className="mt-4 mb-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600 mb-1.5 px-0.5">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {segundosRestantes > 0
                ? 'Generando ODS y transmitiendo...'
                : 'Finalizando confirmación en Doñana...'}
            </span>
            <span className="font-mono text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded text-[11px]">
              {segundosRestantes > 0 ? `~${segundosRestantes}s` : 'Un momento...'}
            </span>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner border border-slate-200">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-1000 ease-linear shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
