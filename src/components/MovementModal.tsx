import React, { useState, useMemo } from 'react';
import { Animal, Movement, User } from '../types/marisma';
import { X, ArrowLeftRight, Check, Calendar, AlertTriangle } from 'lucide-react';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveMovement: (movement: Movement) => void;
  animals: Animal[];
  selectedAnimal?: Animal | null;
  activeCampaign?: string;
  currentUser: User;
}

export const MovementModal: React.FC<MovementModalProps> = ({
  isOpen,
  onClose,
  onSaveMovement,
  animals,
  selectedAnimal,
  activeCampaign,
  currentUser,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const targetCampaign = selectedAnimal?.campana || activeCampaign;

  // Filtrar estrictamente por la campaña de trabajo activa y ordenar por plaza
  const selectableAnimals = useMemo(() => {
    const list = animals.filter(
      (a) => !a.esPlazaVacante && (!targetCampaign || a.campana === targetCampaign)
    );
    return list.sort((a, b) => {
      const matchA = a.plazaNumero.trim().match(/^([A-Z]+)(\d+)/i);
      const matchB = b.plazaNumero.trim().match(/^([A-Z]+)(\d+)/i);
      if (matchA && matchB) {
        if (matchA[1].toUpperCase() !== matchB[1].toUpperCase()) {
          return matchA[1].localeCompare(matchB[1]);
        }
        return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
      }
      return a.plazaNumero.localeCompare(b.plazaNumero, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [animals, targetCampaign]);

  const [animalId, setAnimalId] = useState(selectedAnimal?.id || (selectableAnimals[0]?.id || ''));
  const [tipoMovimiento, setTipoMovimiento] = useState<'ENTRADA' | 'SALIDA'>(
    selectedAnimal?.estadoPresencia === 'DENTRO' ? 'SALIDA' : 'ENTRADA'
  );
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<Movement['motivo']>('ADJUDICACION');
  const [numeroGuia, setNumeroGuia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [liberarPlaza, setLiberarPlaza] = useState<boolean>(false);

  if (!isOpen) return null;

  const targetAnimal = selectableAnimals.find((a) => a.id === animalId) || selectedAnimal;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAnimal) {
      alert('Seleccione un animal');
      return;
    }

    const movement: Movement = {
      id: `mov-${Date.now()}`,
      animalId: targetAnimal.id,
      campana: targetAnimal.campana || targetCampaign || activeCampaign || '',
      identificacion1: targetAnimal.identificacion1 || '',
      tipoAnimal: targetAnimal.tipo,
      plazaNumero: targetAnimal.plazaNumero,
      nombreAnimal: targetAnimal.tipo === 'BOVINO' ? '' : targetAnimal.nombreAnimal,
      propietario: targetAnimal.propietario,
      tipoMovimiento,
      fecha,
      motivo,
      numeroGuia: numeroGuia.trim() || undefined,
      guardaResponsable: currentUser.nombreCompleto || 'Guarda de Marisma',
      observaciones: observaciones.trim() || undefined,
      liberarPlaza: tipoMovimiento === 'SALIDA' ? liberarPlaza : false,
    };

    onSaveMovement(movement);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <ArrowLeftRight className="w-5 h-5 text-emerald-300" />
            <div>
              <h2 className="text-base font-bold">Registrar Entrada / Salida</h2>
              <p className="text-xs text-emerald-200">Control de movimientos de la Marisma de Hinojos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          {/* Movement Type Toggle */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Movimiento *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoMovimiento('ENTRADA')}
                className={`py-2.5 px-3 rounded-lg font-bold border transition flex items-center justify-center gap-2 ${
                  tipoMovimiento === 'ENTRADA'
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <span>🟢 Entrada en Marisma</span>
              </button>

              <button
                type="button"
                onClick={() => setTipoMovimiento('SALIDA')}
                className={`py-2.5 px-3 rounded-lg font-bold border transition flex items-center justify-center gap-2 ${
                  tipoMovimiento === 'SALIDA'
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                    : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                <span>🔴 Salida de Marisma</span>
              </button>
            </div>
          </div>

          {/* Animal Select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">Animal Seleccionado *</label>
              {targetCampaign && (
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Campaña {targetCampaign}
                </span>
              )}
            </div>
            <select
              value={animalId}
              onChange={(e) => setAnimalId(e.target.value)}
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium"
              required
            >
              {selectableAnimals.length === 0 ? (
                <option value="">No hay animales registrados en la campaña {targetCampaign}</option>
              ) : (
                selectableAnimals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.plazaNumero ? `${a.plazaNumero} - ` : ''}{a.tipo === 'BOVINO' ? (a.identificacion1 || 'Bovino') : a.nombreAnimal} ({a.propietario}) [{a.tipo}] {a.estadoPresencia === 'FUERA' ? '(FUERA)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Liberar plaza option when SALIDA */}
          {tipoMovimiento === 'SALIDA' && targetAnimal && (
            <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs font-bold text-amber-900">
                  ¿Quiere dejar la plaza {targetAnimal.plazaNumero || ''} sin ocupar (vacante)?
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLiberarPlaza(false)}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                    !liberarPlaza
                      ? 'bg-white border-amber-600 ring-2 ring-amber-500/20 font-bold text-gray-900 shadow-xs'
                      : 'bg-amber-100/50 border-amber-200 text-gray-600 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-gray-900">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>No, mantener plaza reservada</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-normal leading-tight">
                    Salida temporal (paridera, cura). El animal queda en estado &quot;FUERA&quot;, pero conserva su plaza asignada.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setLiberarPlaza(true)}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                    liberarPlaza
                      ? 'bg-white border-rose-600 ring-2 ring-rose-500/20 font-bold text-rose-950 shadow-xs'
                      : 'bg-amber-100/50 border-amber-200 text-gray-600 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-rose-800">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    <span>Sí, dejar plaza sin ocupar</span>
                  </div>
                  <span className="text-[10px] text-gray-500 font-normal leading-tight">
                    El animal pasa al Histórico. La plaza queda vacante a nombre de {targetAnimal.propietario} para poder reasignarla cuando desee.
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Date & Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Fecha del Movimiento *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Motivo *</label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as any)}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white"
              >
                <option value="ADJUDICACION">Adjudicación Temporada</option>
                <option value="SANEAMIENTO">Saneamiento Veterinario</option>
                <option value="PARIDERA">Parto / Paridera</option>
                <option value="VENTA">Venta / Transferencia</option>
                <option value="RETIRADA_TEMPORAL">Retirada Temporal</option>
                <option value="TRASLADO_CUADRA">Traslado a Cuadra Particular</option>
                <option value="FALLECIMIENTO">Baja / Fallecimiento</option>
                <option value="OTRO">Otro motivo</option>
              </select>
            </div>
          </div>

          {/* Guide number */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nº de Guía de Traslado / Pase de Marisma
            </label>
            <input
              type="text"
              value={numeroGuia}
              onChange={(e) => setNumeroGuia(e.target.value)}
              placeholder="ej. GUIA-2026-2104-0099"
              className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-mono"
            />
          </div>

          {/* Observations */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Punto de acceso (Raya Real, Laguna...), estado físico al salir/entrar..."
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
              className="flex items-center gap-1.5 px-4 py-2 bg-[#008744] hover:bg-[#00743a] text-white font-bold rounded-lg shadow-xs"
            >
              <Check className="w-4 h-4" />
              <span>Confirmar Movimiento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
