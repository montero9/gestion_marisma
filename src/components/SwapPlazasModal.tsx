import React, { useState, useMemo } from 'react';
import { Animal, AnimalType, User } from '../types/marisma';
import { X, ArrowLeftRight, AlertCircle, CheckCircle2, ShieldCheck, Repeat } from 'lucide-react';

interface SwapPlazasModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: AnimalType;
  campaignAnimals: Animal[];
  activeCampaign: string;
  initialAnimal?: Animal | null;
  currentUser?: User | null;
  onConfirmSwap: (animalAId: string, animalBId: string, motivo?: string) => void;
}

export const SwapPlazasModal: React.FC<SwapPlazasModalProps> = ({
  isOpen,
  onClose,
  tipo,
  campaignAnimals,
  activeCampaign,
  initialAnimal,
  currentUser: _currentUser,
  onConfirmSwap,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Filter animals that have a valid plazaNumero in this campaign & type
  const availableAnimals = useMemo(() => {
    return campaignAnimals.filter(
      (a) => a.campana === activeCampaign && a.tipo === tipo && Boolean(a.plazaNumero && a.plazaNumero.trim() !== '')
    );
  }, [campaignAnimals, activeCampaign, tipo]);

  // State for Plaza A and Plaza B
  const [selectedAId, setSelectedAId] = useState<string>(
    initialAnimal?.id || availableAnimals[0]?.id || ''
  );
  const [selectedBId, setSelectedBId] = useState<string>(
    availableAnimals.find((a) => a.id !== (initialAnimal?.id || availableAnimals[0]?.id))?.id || ''
  );
  const [motivo, setMotivo] = useState<string>('Permuta de plaza acordada entre ganaderos');
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const animalA = useMemo(
    () => availableAnimals.find((a) => a.id === selectedAId),
    [availableAnimals, selectedAId]
  );

  const animalB = useMemo(
    () => availableAnimals.find((a) => a.id === selectedBId),
    [availableAnimals, selectedBId]
  );

  if (!isOpen) return null;

  // Validation
  const isValid = Boolean(animalA && animalB && animalA.id !== animalB.id);

  const handleSwap = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !animalA || !animalB) return;

    onConfirmSwap(animalA.id, animalB.id, motivo);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-700/80 rounded-xl text-indigo-200">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">
                Intercambio de Animales entre Plazas ({tipo})
              </h3>
              <p className="text-xs text-indigo-200">
                Campaña {activeCampaign} · Los propietarios conservan la titularidad de su plaza
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleSwap} className="p-5 sm:p-6 space-y-5 overflow-y-auto overscroll-contain flex-1">
          {/* Information banner */}
          <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950">
            <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Principio de titularidad municipal:</span> Cada ganadero mantiene
              adjudicada su plaza oficial en la Marisma. Mediante esta función, los dos animales intercambian su ubicación y número de plaza de manera inmediata y trazable.
            </div>
          </div>

          {/* Selectors grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plaza A Selector */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-xs font-black uppercase text-slate-700">
                1. Primera Plaza (Plaza A)
              </label>
              <select
                value={selectedAId}
                onChange={(e) => setSelectedAId(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {availableAnimals.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === selectedBId}>
                    {a.plazaNumero} · {a.propietario} ({a.esPlazaVacante ? 'Plaza Libre' : a.tipo === 'BOVINO' ? (a.identificacion1 || 'Bovino') : a.nombreAnimal})
                  </option>
                ))}
              </select>

              {animalA && (
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-950 text-sm">{animalA.plazaNumero}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                      {animalA.esPlazaVacante ? '🔴 Libre' : animalA.tipo === 'BOVINO' ? (animalA.identificacion1 || 'Bovino') : animalA.nombreAnimal}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <span className="font-medium text-gray-500">Titular actual: </span>
                    <span className="font-semibold text-gray-900">{animalA.propietario}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Plaza B Selector */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label className="block text-xs font-black uppercase text-slate-700">
                2. Segunda Plaza (Plaza B)
              </label>
              <select
                value={selectedBId}
                onChange={(e) => setSelectedBId(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {availableAnimals.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === selectedAId}>
                    {a.plazaNumero} · {a.propietario} ({a.esPlazaVacante ? 'Plaza Libre' : a.tipo === 'BOVINO' ? (a.identificacion1 || 'Bovino') : a.nombreAnimal})
                  </option>
                ))}
              </select>

              {animalB && (
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-950 text-sm">{animalB.plazaNumero}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-800">
                      {animalB.esPlazaVacante ? '🔴 Libre' : animalB.tipo === 'BOVINO' ? (animalB.identificacion1 || 'Bovino') : animalB.nombreAnimal}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600">
                    <span className="font-medium text-gray-500">Titular actual: </span>
                    <span className="font-semibold text-gray-900">{animalB.propietario}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Swap visual comparison */}
          {isValid && animalA && animalB && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-950">
                <ArrowLeftRight className="w-4 h-4 text-emerald-700" />
                <span>Vista Previa del Resultado de la Permuta</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Result for Plaza A */}
                <div className="p-3 bg-white rounded-lg border border-emerald-300 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                    <span className="font-mono font-black text-emerald-950">{animalA.plazaNumero}</span>
                    <span className="text-[10px] text-gray-500">Mantiene titular</span>
                  </div>
                  <div className="text-[11px] text-gray-700">
                    <span className="text-gray-500">Titular: </span>
                    <strong>{animalA.propietario}</strong>
                  </div>
                  <div className="pt-1 text-emerald-900 font-bold flex items-center gap-1">
                    <span className="text-emerald-700">➔ Pasa a tener:</span>
                    <span>{animalB.esPlazaVacante ? '🔴 Plaza Libre' : animalB.tipo === 'BOVINO' ? (animalB.identificacion1 || 'Bovino') : animalB.nombreAnimal}</span>
                  </div>
                </div>

                {/* Result for Plaza B */}
                <div className="p-3 bg-white rounded-lg border border-emerald-300 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                    <span className="font-mono font-black text-emerald-950">{animalB.plazaNumero}</span>
                    <span className="text-[10px] text-gray-500">Mantiene titular</span>
                  </div>
                  <div className="text-[11px] text-gray-700">
                    <span className="text-gray-500">Titular: </span>
                    <strong>{animalB.propietario}</strong>
                  </div>
                  <div className="pt-1 text-emerald-900 font-bold flex items-center gap-1">
                    <span className="text-emerald-700">➔ Pasa a tener:</span>
                    <span>{animalA.esPlazaVacante ? '🔴 Plaza Libre' : animalA.tipo === 'BOVINO' ? (animalA.identificacion1 || 'Bovino') : animalA.nombreAnimal}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Motivo del intercambio */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Motivo u Observación de la Permuta (se añadirá a la ficha de ambos):
            </label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="ej. Permuta acordada entre ganaderos..."
              className="w-full text-xs p-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isValid || isSuccess}
              className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>¡Intercambio Realizado!</span>
                </>
              ) : (
                <>
                  <Repeat className="w-4 h-4" />
                  <span>Confirmar Intercambio</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
