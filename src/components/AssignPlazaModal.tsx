import React, { useState } from 'react';
import { Animal, AnimalType, User } from '../types/marisma';
import { X, ArrowRight, Check, Plus, AlertCircle, Calendar, Sparkles } from 'lucide-react';

interface AssignPlazaModalProps {
  isOpen: boolean;
  onClose: () => void;
  vacantPlaza: Animal | null;
  candidateAnimals: Animal[];
  currentUser: User;
  onConfirmReentry: (
    vacantPlazaId: string,
    animalId: string,
    fecha: string,
    numeroGuia?: string,
    observaciones?: string
  ) => void;
  onOpenCreateNew: (vacantPlaza: Animal) => void;
}

export const AssignPlazaModal: React.FC<AssignPlazaModalProps> = ({
  isOpen,
  onClose,
  vacantPlaza,
  candidateAnimals,
  currentUser: _currentUser,
  onConfirmReentry,
  onOpenCreateNew,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !vacantPlaza) return null;

  const [mode, setMode] = useState<'SELECT' | 'FORM'>('SELECT');
  const [selectedAnimalId, setSelectedAnimalId] = useState<string>(candidateAnimals[0]?.id || '');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [numeroGuia, setNumeroGuia] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const selectedAnimal = candidateAnimals.find((a) => a.id === selectedAnimalId);

  const handleSubmitReentry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAnimal) {
      alert('Por favor selecciona un animal para reincorporar a la plaza.');
      return;
    }
    onConfirmReentry(vacantPlaza.id, selectedAnimal.id, fecha, numeroGuia.trim(), observaciones.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-amber-950 font-black font-mono text-xs px-2 py-0.5 rounded">
                PLAZA {vacantPlaza.plazaNumero}
              </span>
              <h2 className="text-base font-bold">Asignar Animal a Plaza Vacante</h2>
            </div>
            <p className="text-xs text-emerald-200 mt-0.5">
              Titular: {vacantPlaza.propietario} · Campaña {vacantPlaza.campana}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          {/* Choice Mode Selector */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('SELECT')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                mode === 'SELECT'
                  ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20 font-bold text-gray-900'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="text-xs font-bold text-gray-900">Reingreso de Animal</span>
              </div>
              <span className="text-[11px] text-gray-500 font-normal leading-tight">
                Reincorporar un animal que ya estuvo en la marisma ({candidateAnimals.length} disponibles)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCreateNew(vacantPlaza);
              }}
              className="p-3 rounded-xl border text-left transition border-gray-200 hover:border-emerald-500 hover:bg-gray-50 flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Plus className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-xs font-bold text-gray-900">Registrar Nuevo Animal</span>
              </div>
              <span className="text-[11px] text-gray-500 font-normal leading-tight">
                Dar de alta un nuevo animal que no estaba en el censo para esta plaza
              </span>
            </button>
          </div>

          {/* Reentry Mode Form */}
          {mode === 'SELECT' && (
            <form onSubmit={handleSubmitReentry} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Selecciona el Animal para Ocupar la Plaza *
                </label>
                {candidateAnimals.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-xs text-amber-800 space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      No hay animales registrados de este ganadero fuera de la marisma.
                    </p>
                    <p className="text-gray-600">
                      Puedes registrar un nuevo animal haciendo clic en &quot;Registrar Nuevo Animal&quot; arriba.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {candidateAnimals.map((candidate) => {
                      const isSelected = candidate.id === selectedAnimalId;
                      return (
                        <div
                          key={candidate.id}
                          onClick={() => setSelectedAnimalId(candidate.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {candidate.tipo === 'EQUINO' ? '🐎' : '🐂'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-gray-900 text-xs sm:text-sm">
                                  {candidate.nombreAnimal}
                                </h4>
                                <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                                  {candidate.sexo === 'H' ? 'Hembra' : 'Macho'}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 font-mono">
                                Microchip: {candidate.identificacion1 || 'S/N'} · Capa: {candidate.capa}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {isSelected ? 'Seleccionado' : 'Elegir'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {candidateAnimals.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Fecha de Entrada / Reincorporación *
                      </label>
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nº Guía / Pase de Entrada
                      </label>
                      <input
                        type="text"
                        value={numeroGuia}
                        onChange={(e) => setNumeroGuia(e.target.value)}
                        placeholder="ej. GUIA-2026-REING-001"
                        className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Observaciones de Reingreso
                    </label>
                    <textarea
                      rows={2}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Punto de acceso, estado corporal o motivo de reincorporación..."
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#008744] hover:bg-[#00743a] text-white font-bold rounded-lg shadow-xs transition"
                    >
                      <Check className="w-4 h-4" />
                      <span>Confirmar Reingreso en Plaza {vacantPlaza.plazaNumero}</span>
                    </button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
