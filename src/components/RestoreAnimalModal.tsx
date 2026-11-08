import React, { useState, useMemo } from 'react';
import { Animal, Movement, Owner, User } from '../types/marisma';
import { X, RotateCcw, AlertCircle, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RestoreAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal | null;
  previousMovement?: Movement | null;
  owners: Owner[];
  animals: Animal[];
  activeCampaign: string;
  currentUser: User;
  onConfirmRestore: (
    updatedAnimal: Animal,
    newMovement: Movement,
    vacantPlazaIdToRemove?: string
  ) => void;
}

export const RestoreAnimalModal: React.FC<RestoreAnimalModalProps> = ({
  isOpen,
  onClose,
  animal,
  previousMovement,
  owners,
  animals,
  activeCampaign,
  currentUser,
  onConfirmRestore,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !animal) return null;

  const [propietario, setPropietario] = useState<string>(
    animal.propietario || previousMovement?.propietario || ''
  );
  const [plazaInput, setPlazaInput] = useState<string>(
    previousMovement?.plazaNumero || animal.plazaNumero || (animal.tipo === 'BOVINO' ? 'HIN001' : 'HI001')
  );
  const [fecha, setFecha] = useState<string>(new Date().toISOString().slice(0, 10));
  const [numeroGuia, setNumeroGuia] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>(
    `Reincorporación a la marisma tras baja definitiva previa.`
  );

  // Propietarios únicos filtrados por campaña activa
  const campaignOwners = useMemo(() => {
    const list = owners.filter((o) => !o.campana || o.campana === activeCampaign);
    const uniqueMap = new Map<string, Owner>();
    list.forEach((o) => {
      const key = (o.dniCif || o.nombreCompleto).trim().toUpperCase();
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, o);
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' })
    );
  }, [owners, activeCampaign]);

  // Available vacant plazas in this campaign
  const vacantPlazasInCampaign = useMemo(() => {
    return animals.filter(
      (a) =>
        a.campana === activeCampaign &&
        a.tipo === animal.tipo &&
        (a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE')
    );
  }, [animals, activeCampaign, animal.tipo]);

  // Clean plaza
  const cleanPlaza = plazaInput.trim().toUpperCase();

  // Check if plaza is already occupied by an active animal inside the marisma
  const occupyingAnimal = useMemo(() => {
    if (!cleanPlaza) return null;
    return animals.find(
      (a) =>
        a.campana === activeCampaign &&
        !a.esPlazaVacante &&
        a.id !== animal.id &&
        a.plazaNumero.trim().toUpperCase() === cleanPlaza &&
        a.estadoPresencia === 'DENTRO'
    );
  }, [animals, activeCampaign, animal.id, cleanPlaza]);

  // Check if plaza matches an existing vacant placeholder in this campaign
  const matchingVacantSlot = useMemo(() => {
    if (!cleanPlaza) return null;
    return animals.find(
      (a) =>
        a.campana === activeCampaign &&
        a.esPlazaVacante &&
        a.plazaNumero.trim().toUpperCase() === cleanPlaza
    );
  }, [animals, activeCampaign, cleanPlaza]);

  const isPlazaFree = Boolean(cleanPlaza && !occupyingAnimal);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!cleanPlaza) {
      alert('Por favor introduzca el número de plaza a asignar.');
      return;
    }

    if (!propietario.trim()) {
      alert('Por favor indique el propietario del animal.');
      return;
    }

    // MANDATORY CHECK: Plaza must be free
    if (occupyingAnimal) {
      alert(
        `La plaza ${cleanPlaza} no está libre. Actualmente está ocupada por "${occupyingAnimal.nombreAnimal}" (${occupyingAnimal.propietario}). Debe asignar una plaza libre para poder reactivar al animal.`
      );
      return;
    }

    const updatedAnimal: Animal = {
      ...animal,
      plazaNumero: cleanPlaza,
      propietario: propietario.trim(),
      campana: activeCampaign,
      estadoPresencia: 'DENTRO',
      fechaEntradaMarisma: fecha,
      fechaUltimaRevision: `Reingreso ${fecha}`,
      esPlazaVacante: false,
      actualizadoEn: new Date().toISOString(),
      anotaciones: [
        ...(animal.anotaciones || []),
        {
          id: `note-restaurar-${Date.now()}`,
          fecha,
          autor: currentUser.nombreCompleto || 'Guarda de Marisma',
          categoria: 'GUARDERIA',
          texto: `Animal restaurado y reincorporado a la Marisma en la Plaza ${cleanPlaza} a nombre de ${propietario.trim()}.${
            observaciones ? ' ' + observaciones.trim() : ''
          }`,
        },
      ],
    };

    const newMovement: Movement = {
      id: `mov-${Date.now()}`,
      animalId: animal.id,
      tipoAnimal: animal.tipo,
      plazaNumero: cleanPlaza,
      nombreAnimal: animal.nombreAnimal,
      propietario: propietario.trim(),
      tipoMovimiento: 'ENTRADA',
      fecha,
      motivo: 'ADJUDICACION',
      numeroGuia: numeroGuia.trim() || undefined,
      guardaResponsable: currentUser.nombreCompleto || 'Guarda de Marisma',
      observaciones: observaciones.trim() || undefined,
    };

    onConfirmRestore(updatedAnimal, newMovement, matchingVacantSlot?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-emerald-200">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Restaurar Animal a la Marisma</h2>
              <p className="text-xs text-emerald-200">Reincorporación oficial desde el Histórico</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          {/* Animal Card Summary */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-black text-sm flex items-center justify-center shrink-0">
              {animal.tipo === 'EQUINO' ? '🐎' : '🐂'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900 truncate text-sm">{animal.nombreAnimal}</h4>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 uppercase">
                  {animal.tipo}
                </span>
              </div>
              <p className="text-xs text-gray-600 font-mono mt-0.5">
                Microchip: {animal.identificacion1 || 'S/N'} · Capa: {animal.capa || 'TORDO'} · {animal.sexo === 'H' ? 'Hembra' : 'Macho'}
              </p>
            </div>
          </div>

          {/* Propietario Assignment */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Ganadero / Titular de la Concesión *
            </label>
            <div className="space-y-1.5">
              <select
                value={campaignOwners.some((o) => o.nombreCompleto === propietario) ? propietario : '__CUSTOM__'}
                onChange={(e) => {
                  if (e.target.value !== '__CUSTOM__') {
                    setPropietario(e.target.value);
                  }
                }}
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium"
              >
                <option value="" disabled>Seleccione un ganadero de la campaña ({activeCampaign})...</option>
                {campaignOwners.map((o) => (
                  <option key={o.id} value={o.nombreCompleto}>
                    {o.nombreCompleto} (DNI/CIF: {o.dniCif})
                  </option>
                ))}
                <option value="__CUSTOM__">Otro ganadero / Escribir manualmente...</option>
              </select>

              <input
                type="text"
                value={propietario}
                onChange={(e) => setPropietario(e.target.value.toUpperCase())}
                placeholder="Nombre completo del titular"
                className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg uppercase"
                required
              />
              <p className="text-[11px] text-gray-500">
                El animal puede reincorporarse a nombre del mismo titular o transferirse a otro ganadero.
              </p>
            </div>
          </div>

          {/* Plaza Assignment with Mandatory Free Check */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">
                Nº de Plaza a Asignar (Campaña {activeCampaign}) *
              </label>
              {vacantPlazasInCampaign.length > 0 && (
                <span className="text-[11px] text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                  {vacantPlazasInCampaign.length} vacantes disponibles
                </span>
              )}
            </div>

            {/* Quick picker for vacant plazas in this campaign */}
            {vacantPlazasInCampaign.length > 0 && (
              <div className="mb-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setPlazaInput(e.target.value);
                    }
                  }}
                  defaultValue=""
                  className="w-full text-xs px-3 py-1.5 border border-amber-300 bg-amber-50/60 rounded-lg text-amber-950 font-medium"
                >
                  <option value="">Seleccionar de entre las plazas vacantes actuales...</option>
                  {vacantPlazasInCampaign.map((vp) => (
                    <option key={vp.id} value={vp.plazaNumero}>
                      Plaza {vp.plazaNumero} (Titular: {vp.propietario})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input
              type="text"
              value={plazaInput}
              onChange={(e) => setPlazaInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
              placeholder="ej. HI001 o HIN001"
              className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg font-mono font-bold uppercase transition ${
                occupyingAnimal
                  ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                  : 'border-gray-300 text-gray-900 focus:ring-emerald-500'
              }`}
              required
            />

            {/* Mandatory Free Check Feedback */}
            <div className="mt-1.5">
              {occupyingAnimal ? (
                <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <strong className="block font-bold">¡Plaza no disponible!</strong>
                    <span>
                      La plaza <strong>{cleanPlaza}</strong> ya está ocupada en la marisma por &quot;{occupyingAnimal.nombreAnimal}&quot; ({occupyingAnimal.propietario}). Debe elegir una plaza libre.
                    </span>
                  </div>
                </div>
              ) : cleanPlaza ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Plaza {cleanPlaza} comprobada: LIBRE y disponible para ocupar.</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Date & Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Fecha de Reingreso *
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

          {/* Observaciones */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Observaciones</label>
            <textarea
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Detalles del reingreso, estado del animal o pase oficial..."
              className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isPlazaFree}
              className={`flex items-center gap-1.5 px-4 py-2 font-bold rounded-lg text-xs sm:text-sm shadow-xs transition ${
                isPlazaFree
                  ? 'bg-[#008744] hover:bg-[#00743a] text-white cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>Confirmar Reingreso en Marisma</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
