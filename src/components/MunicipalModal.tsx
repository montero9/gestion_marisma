import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  HelpCircle,
  X,
} from 'lucide-react';
import { dialogService, DialogOptions } from '../services/dialogService';

export const MunicipalModal: React.FC = () => {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: DialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  useEffect(() => {
    // Instalar override global para interceptar cualquier window.alert residual
    dialogService.installGlobalOverride();

    const unsubscribe = dialogService.subscribe((state) => {
      setDialogState(state);
    });
    return unsubscribe;
  }, []);

  // Manejo de teclado (Enter para confirmar, Esc para cancelar)
  useEffect(() => {
    if (!dialogState?.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dialogState.resolve(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        dialogState.resolve(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogState]);

  if (!dialogState?.isOpen) return null;

  const { options, resolve } = dialogState;
  const type = options.type || 'info';

  const getTheme = () => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-700" />,
          iconBg: 'bg-emerald-100 border-emerald-300',
          titleColor: 'text-emerald-950',
          confirmBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20',
          defaultTitle: 'Operación Exitosa',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-8 h-8 text-amber-700" />,
          iconBg: 'bg-amber-100 border-amber-300',
          titleColor: 'text-amber-950',
          confirmBtn: 'bg-amber-700 hover:bg-amber-800 text-white shadow-amber-700/20',
          defaultTitle: 'Aviso Municipal',
        };
      case 'error':
        return {
          icon: <XCircle className="w-8 h-8 text-rose-700" />,
          iconBg: 'bg-rose-100 border-rose-300',
          titleColor: 'text-rose-950',
          confirmBtn: 'bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/20',
          defaultTitle: 'Error en la Operación',
        };
      case 'question':
        return {
          icon: <HelpCircle className="w-8 h-8 text-teal-700" />,
          iconBg: 'bg-teal-100 border-teal-300',
          titleColor: 'text-teal-950',
          confirmBtn: options.isDestructive
            ? 'bg-rose-700 hover:bg-rose-800 text-white shadow-rose-700/20'
            : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20',
          defaultTitle: 'Confirmación Requerida',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-8 h-8 text-emerald-700" />,
          iconBg: 'bg-emerald-100 border-emerald-300',
          titleColor: 'text-emerald-950',
          confirmBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20',
          defaultTitle: 'Información Oficial',
        };
    }
  };

  const theme = getTheme();
  const title = options.title || theme.defaultTitle;
  const confirmText = options.confirmText || (options.showCancel ? 'Aceptar' : 'Entendido');
  const cancelText = options.cancelText || 'Cancelar';

  return (
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Cerrar al hacer clic en el backdrop
        if (e.target === e.currentTarget) {
          resolve(false);
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 text-center animate-in zoom-in-95 duration-150 relative">
        {/* Botón cerrar X superior derecho */}
        <button
          type="button"
          onClick={() => resolve(false)}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          title="Cerrar ventana"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icono temático */}
        <div
          className={`w-14 h-14 rounded-full border-2 flex items-center justify-center mx-auto mb-3 shadow-xs ${theme.iconBg}`}
        >
          {theme.icon}
        </div>

        {/* Subtítulo institucional */}
        <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-md tracking-wider uppercase mb-1.5">
          Ayuntamiento de Hinojos · Control Ganadero
        </span>

        {/* Título */}
        <h3 className={`text-lg font-black tracking-tight ${theme.titleColor}`}>
          {title}
        </h3>

        {/* Mensaje */}
        <div className="mt-3 mb-5 px-1 max-h-60 overflow-y-auto">
          <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-line text-center">
            {options.message}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {options.showCancel && (
            <button
              type="button"
              onClick={() => resolve(false)}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={() => resolve(true)}
            autoFocus
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer ${theme.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
