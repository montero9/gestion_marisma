import React, { useEffect, useState } from 'react';
import { Mail, Loader2, CheckCircle2, XCircle, Users, ArrowRight } from 'lucide-react';

interface EnviandoEmailModalProps {
  isOpen: boolean;
  status?: 'sending' | 'success' | 'error';
  tituloOficial?: string;
  totalSegundos?: number;
  recipients?: string[];
  bcc?: string[];
  errorMessage?: string;
  onClose?: () => void;
}

export const EnviandoEmailModal: React.FC<EnviandoEmailModalProps> = ({
  isOpen,
  status = 'sending',
  tituloOficial,
  totalSegundos = 10,
  recipients = [],
  bcc = [],
  errorMessage,
  onClose,
}) => {
  const [segundosRestantes, setSegundosRestantes] = useState<number>(totalSegundos);

  // Reiniciar contador cada vez que se abre el modal en estado 'sending'
  useEffect(() => {
    if (isOpen && status === 'sending') {
      setSegundosRestantes(totalSegundos);
      const interval = setInterval(() => {
        setSegundosRestantes((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);

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
  }, [isOpen, status, totalSegundos]);

  if (!isOpen) return null;

  const elapsed = totalSegundos - segundosRestantes;
  const progressPercent = Math.min(95, Math.round((elapsed / totalSegundos) * 92) + 8);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 select-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* ================= ESTADO 1: ENVIANDO ================= */}
        {status === 'sending' && (
          <>
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

            {tituloOficial && (
              <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md truncate max-w-[90%] mb-2">
                {tituloOficial}
              </span>
            )}

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 my-3 text-emerald-950">
              <p className="font-extrabold text-base tracking-tight text-emerald-900">
                Enviando entradas...
              </p>
              <p className="text-xs font-semibold text-emerald-800 mt-1 leading-relaxed">
                Por favor, espere unos segundos sin cerrar la ventana
              </p>
            </div>

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
          </>
        )}

        {/* ================= ESTADO 2: ÉXITO ================= */}
        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 border-2 border-emerald-300 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                ¡Correo Enviado con Éxito a Doñana!
              </h3>
              {tituloOficial && (
                <p className="text-xs text-gray-500 font-bold mt-1 truncate">
                  {tituloOficial}
                </p>
              )}
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 text-left text-xs space-y-2">
              <div>
                <span className="font-bold text-emerald-950 block text-[11px] uppercase tracking-wider">
                  Destinatarios Principales:
                </span>
                <span className="font-mono text-emerald-800 text-xs block break-all mt-0.5">
                  {recipients.length > 0 ? recipients.join(', ') : 'Espacio Natural de Doñana'}
                </span>
              </div>

              {bcc.length > 0 && (
                <div className="pt-1.5 border-t border-emerald-200/60">
                  <span className="font-bold text-emerald-950 block text-[11px] uppercase tracking-wider">
                    Copia oculta (BCC):
                  </span>
                  <span className="font-mono text-emerald-700 text-[11px] block break-all mt-0.5">
                    {bcc.join(', ') }
                  </span>
                </div>
              )}

              <p className="text-[11px] text-emerald-900 leading-relaxed pt-1">
                Se han transmitido correctamente la hoja de cálculo oficial (.ODS) y las guías sanitarias de traslado en PDF.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Aceptar y Continuar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= ESTADO 3: ERROR ================= */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-700 border-2 border-rose-300 flex items-center justify-center mx-auto shadow-sm">
              <XCircle className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900 tracking-tight">
                Error al enviar el correo
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                No se pudo completar el envío hacia el Espacio Natural de Doñana
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-left text-xs text-rose-900">
              <p className="font-medium leading-relaxed">
                {errorMessage || 'Ha ocurrido un error inesperado al conectar con el servidor SMTP.'}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
              >
                <span>Cerrar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
