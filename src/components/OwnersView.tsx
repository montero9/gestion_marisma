import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Owner, Animal, Association, User } from '../types/marisma';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  Edit2,
  Trash2,
  X,
  Save,
  Check,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  Info,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface OwnersViewProps {
  owners: Owner[];
  associations: Association[];
  animals: Animal[];
  activeCampaign: string;
  currentUser?: User;
  onSaveOwner: (owner: Owner) => Promise<void> | void;
  onDeleteOwner: (ownerId: string, reassignAnimalesTo?: string) => Promise<void> | void;
  onSaveAssociation: (association: Association, isUpdate?: boolean) => Promise<void>;
  onDeleteAssociation: (associationId: string, reassignTo?: string) => Promise<void>;
  onViewAnimal: (animal: Animal) => void;
}

export const OwnersView: React.FC<OwnersViewProps> = ({
  owners,
  associations,
  animals,
  activeCampaign,
  currentUser,
  onSaveOwner,
  onDeleteOwner,
  onSaveAssociation,
  onDeleteAssociation,
  onViewAnimal,
}) => {
  const isReadOnly = currentUser?.rol !== 'ADMINISTRADOR';
  const [search, setSearch] = useState('');
  const [selectedOwnerForModal, setSelectedOwnerForModal] = useState<Owner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssociationModalOpen, setIsAssociationModalOpen] = useState(false);
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [ownerToDelete, setOwnerToDelete] = useState<Owner | null>(null);
  const [targetOwnerForAnimals, setTargetOwnerForAnimals] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered owners: pertenecen a la campaña activa (o sin campaña asignada para compatibilidad)
  const campaignOwners = useMemo(() => {
    return owners.filter((o) => !o.campana || o.campana === activeCampaign);
  }, [owners, activeCampaign]);

  // Filtered owners by search query
  const filteredOwners = useMemo(() => {
    if (!search.trim()) return campaignOwners;
    const q = search.toLowerCase();
    return campaignOwners.filter(
      (o) =>
        o.nombreCompleto.toLowerCase().includes(q) ||
        o.dniCif.toLowerCase().includes(q) ||
        o.telefono.includes(q) ||
        (o.asociacion && o.asociacion.toLowerCase().includes(q)) ||
        (o.codigoRega && o.codigoRega.toLowerCase().includes(q))
    );
  }, [campaignOwners, search]);

  const handleOpenAdd = () => {
    setSelectedOwnerForModal(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (owner: Owner) => {
    setSelectedOwnerForModal(owner);
    setIsModalOpen(true);
  };

  const handleInitiateDeleteOwner = (owner: Owner) => {
    setFeedback(null);
    const otherOwners = campaignOwners.filter((o) => o.id !== owner.id);
    setTargetOwnerForAnimals(otherOwners.length > 0 ? otherOwners[0].nombreCompleto : '');
    setOwnerToDelete(owner);
  };

  const executeDeleteOwner = async (ownerId: string, reassignAnimalesTo?: string) => {
    setIsDeleting(true);
    try {
      await onDeleteOwner(ownerId, reassignAnimalesTo);
      setOwnerToDelete(null);
      setFeedback({
        type: 'success',
        message: reassignAnimalesTo
          ? `Ganadero eliminado y sus animales reasignados exitosamente a "${reassignAnimalesTo}".`
          : 'Ganadero eliminado correctamente del censo.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al eliminar el ganadero.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Feedback Banner Global */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : 'bg-rose-50 border-rose-300 text-rose-950'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight whitespace-nowrap">
              CENSO DE PROPIETARIOS
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-300 whitespace-nowrap">
              {campaignOwners.length} Titulares ({activeCampaign})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search - justo antes de asociaciones */}
            <div className="relative w-56 sm:w-64 lg:w-72">
              <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por Nombre, DNI, REGA..."
                className="w-full pl-8 pr-7 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsAssociationModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs sm:text-sm font-bold rounded-lg shadow-xs transition whitespace-nowrap"
              title="Gestionar asociaciones de propietarios y comunitarias"
            >
              <Building2 className="w-4 h-4 text-emerald-700" />
              <span>ASOCIACIONES ({associations.length})</span>
            </button>

            {!isReadOnly && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#008744] hover:bg-[#00743a] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>NUEVO PROPIETARIO</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Owners List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOwners.map((owner) => {
          // Get animals belonging to this owner
          const ownerAnimals = animals.filter(
            (a) =>
              a.propietario.trim().toLowerCase() === owner.nombreCompleto.trim().toLowerCase() ||
              (a.rastra &&
                a.rastra.propietarioRastra.trim().toLowerCase() ===
                  owner.nombreCompleto.trim().toLowerCase())
          );
          const currentCampaignAnimals = ownerAnimals.filter((a) => a.campana === activeCampaign);
          const isExpanded = expandedOwnerId === owner.id;

          return (
            <div
              key={owner.id}
              className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden hover:border-emerald-300 transition"
            >
              <div className="p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-gray-900 leading-snug">
                      {owner.nombreCompleto}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                      <span className="font-mono font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                        DNI/CIF: {owner.dniCif}
                      </span>
                      {owner.codigoRega && (
                        <span className="font-mono text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          REGA: {owner.codigoRega}
                        </span>
                      )}
                      {owner.asociacion && (
                        <span className="text-[11px] bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-semibold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-700" />
                          <span>{owner.asociacion}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {!isReadOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(owner)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar datos del propietario"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleInitiateDeleteOwner(owner)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                        title="Eliminar ganadero"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{owner.telefono || 'Sin teléfono'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{owner.email || 'Sin email'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">
                      {owner.direccion ? `${owner.direccion}, ` : ''}
                      {owner.municipio || 'Hinojos'}
                    </span>
                  </div>
                </div>

                {owner.notas && (
                  <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded border border-gray-100">
                    &quot;{owner.notas}&quot;
                  </p>
                )}

                {/* Animal count indicator & accordion button */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                    <span>
                      {currentCampaignAnimals.length} animales registrados en Campaña {activeCampaign}
                    </span>
                  </div>

                  <button
                    onClick={() => setExpandedOwnerId(isExpanded ? null : owner.id)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 transition cursor-pointer"
                  >
                    <span>{isExpanded ? 'Ocultar ganado' : 'Ver ganado'}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Accordion List of Animals */}
                {isExpanded && (
                  <div className="pt-3 border-t border-dashed border-gray-200 space-y-2">
                    {currentCampaignAnimals.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2 text-center">
                        No tiene animales asignados en la campaña {activeCampaign}.
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100 bg-gray-50/60 rounded-lg border border-gray-200 overflow-hidden">
                        {currentCampaignAnimals.map((ani) => (
                          <div
                            key={ani.id}
                            className="p-2.5 flex items-center justify-between text-xs hover:bg-white transition"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-emerald-900 bg-emerald-100/70 px-1.5 py-0.5 rounded text-[11px]">
                                {ani.plazaNumero}
                              </span>
                              <span className="font-bold text-gray-900">{ani.nombreAnimal}</span>
                              <span className="text-[10px] text-gray-500 font-medium">
                                ({ani.tipo} · {ani.capa})
                              </span>
                              {ani.rastra && (
                                <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-1.5 py-0.2 rounded">
                                  🍼 Cría
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => onViewAnimal(ani)}
                              className="text-xs text-emerald-700 hover:text-emerald-950 font-semibold underline"
                            >
                              Ver Ficha
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Owner Modal */}
      {isModalOpen && (
        <OwnerModal
          owner={selectedOwnerForModal}
          associations={associations}
          activeCampaign={activeCampaign}
          campaignOwners={campaignOwners}
          allOwners={owners}
          onClose={() => setIsModalOpen(false)}
          onSave={async (owner) => {
            try {
              await onSaveOwner(owner);
              setIsModalOpen(false);
              setFeedback({
                type: 'success',
                message: selectedOwnerForModal
                  ? `Ganadero "${owner.nombreCompleto}" actualizado correctamente. Los animales asociados en la campaña ${activeCampaign} se han sincronizado con el nuevo nombre.`
                  : `Ganadero "${owner.nombreCompleto}" registrado exitosamente en la campaña ${activeCampaign}.`,
              });
              setTimeout(() => setFeedback(null), 6000);
            } catch (err: any) {
              setFeedback({
                type: 'error',
                message: err.message || 'Error al guardar el ganadero.',
              });
            }
          }}
        />
      )}

      {/* Delete / Reassign Animals Modal */}
      {ownerToDelete && (
        <DeleteOwnerModal
          owner={ownerToDelete}
          animals={animals}
          campaignOwners={campaignOwners}
          activeCampaign={activeCampaign}
          isDeleting={isDeleting}
          onClose={() => setOwnerToDelete(null)}
          onConfirm={(targetOwner) => executeDeleteOwner(ownerToDelete.id, targetOwner)}
        />
      )}

      {/* Associations Management Modal */}
      {isAssociationModalOpen && (
        <AssociationsModal
          associations={associations}
          owners={owners}
          onClose={() => setIsAssociationModalOpen(false)}
          onSaveAssociation={onSaveAssociation}
          onDeleteAssociation={onDeleteAssociation}
        />
      )}
    </div>
  );
};

// Delete Owner & Reassign Animals Modal Component
interface DeleteOwnerModalProps {
  owner: Owner;
  animals: Animal[];
  campaignOwners: Owner[];
  activeCampaign: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: (targetOwnerName?: string) => void;
}

const DeleteOwnerModal: React.FC<DeleteOwnerModalProps> = ({
  owner,
  animals,
  campaignOwners,
  activeCampaign,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Animales asignados a este propietario en esta campaña
  const assignedAnimals = useMemo(() => {
    const cleanName = owner.nombreCompleto.trim().toLowerCase();
    return animals.filter(
      (a) =>
        a.campana === activeCampaign &&
        (a.propietario.trim().toLowerCase() === cleanName ||
          (a.rastra && a.rastra.propietarioRastra.trim().toLowerCase() === cleanName))
    );
  }, [animals, owner, activeCampaign]);

  // Candidatos a recibir los animales (otros ganaderos en la campaña)
  const candidateOwners = useMemo(() => {
    return campaignOwners.filter((o) => o.id !== owner.id);
  }, [campaignOwners, owner]);

  const [selectedRecipient, setSelectedRecipient] = useState<string>(
    candidateOwners.length > 0 ? candidateOwners[0].nombreCompleto : ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const hasAnimals = assignedAnimals.length > 0;

  const handleConfirm = () => {
    if (hasAnimals) {
      if (!selectedRecipient) {
        setErrorMsg('Debe seleccionar obligatoriamente un ganadero receptor para los animales.');
        return;
      }
      onConfirm(selectedRecipient);
    } else {
      onConfirm(undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        <div
          className={`px-5 py-4 flex items-center justify-between shrink-0 text-white ${
            hasAnimals ? 'bg-amber-700' : 'bg-rose-700'
          }`}
        >
          <div className="flex items-center gap-2 font-bold text-sm sm:text-base">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>
              {hasAnimals
                ? 'Reasignación Obligatoria de Animales'
                : 'Confirmar Eliminación de Ganadero'}
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-1 rounded text-white/80 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs sm:text-sm">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-medium">
              {errorMsg}
            </div>
          )}

          <div>
            <p className="text-gray-700 font-medium">
              Ganadero a dar de baja:{' '}
              <strong className="text-gray-900 font-bold">{owner.nombreCompleto}</strong>{' '}
              <span className="font-mono text-gray-500 font-normal">({owner.dniCif})</span>
            </p>
            <p className="text-gray-500 text-xs mt-0.5">
              Campaña de actuación: <strong>{activeCampaign}</strong>
            </p>
          </div>

          {hasAnimals ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2 text-amber-950">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Este ganadero tiene {assignedAnimals.length} animal(es) asignados
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-amber-900/90">
                  En el sistema <strong className="font-bold">ningún animal puede quedar sin ganadero vinculado</strong>.
                  Para poder eliminar este titular, es obligatorio transferir todos sus animales registrados en la campaña actual a otro ganadero.
                </p>
              </div>

              {candidateOwners.length === 0 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-950 font-medium text-xs leading-relaxed">
                  No existen otros ganaderos registrados en la campaña <strong>{activeCampaign}</strong> a los que reasignar los animales. Debe crear previamente otro ganadero antes de poder dar de baja este registro.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-800">
                    Seleccionar nuevo titular para los {assignedAnimals.length} animales *
                  </label>
                  <select
                    value={selectedRecipient}
                    onChange={(e) => {
                      setSelectedRecipient(e.target.value);
                      setErrorMsg(null);
                    }}
                    disabled={isDeleting}
                    className="w-full text-xs sm:text-sm px-3 py-2.5 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {candidateOwners.map((c) => (
                      <option key={c.id} value={c.nombreCompleto}>
                        {c.nombreCompleto} (DNI: {c.dniCif}
                        {c.asociacion ? ` - ${c.asociacion}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-xs leading-relaxed">
              Este ganadero no tiene animales asignados en la campaña <strong>{activeCampaign}</strong>. Al confirmar, será retirado del censo de esta campaña.
            </div>
          )}

          <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting || (hasAnimals && candidateOwners.length === 0)}
              className={`flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed ${
                hasAnimals
                  ? 'bg-amber-700 hover:bg-amber-800'
                  : 'bg-rose-700 hover:bg-rose-800'
              }`}
            >
              {isDeleting ? (
                <span>Procesando...</span>
              ) : hasAnimals ? (
                <>
                  <ArrowRight className="w-4 h-4" />
                  <span>Reasignar Animales y Eliminar</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar Ganadero</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function normalizeOwnerName(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

// Owner Modal Component
interface OwnerModalProps {
  owner: Owner | null;
  associations: Association[];
  activeCampaign: string;
  campaignOwners: Owner[];
  allOwners: Owner[];
  onClose: () => void;
  onSave: (owner: Owner) => Promise<void> | void;
}

const OwnerModal: React.FC<OwnerModalProps> = ({
  owner,
  associations,
  activeCampaign,
  campaignOwners,
  allOwners,
  onClose,
  onSave,
}) => {
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const [nombreCompleto, setNombreCompleto] = useState(owner?.nombreCompleto || '');
  const [dniCif, setDniCif] = useState(owner?.dniCif || '');
  const [telefono, setTelefono] = useState(owner?.telefono || '');
  const [email, setEmail] = useState(owner?.email || '');
  const [direccion, setDireccion] = useState(owner?.direccion || '');
  const [municipio, setMunicipio] = useState(owner?.municipio || 'Hinojos (Huelva)');
  const [codigoRega, setCodigoRega] = useState(owner?.codigoRega || '');
  const [asociacion, setAsociacion] = useState(owner?.asociacion || '');
  const [notas, setNotas] = useState(owner?.notas || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Validación oficial de letra y formato de DNI, NIE y CIF español
  const validateDniNieCif = (val: string): { isValid: boolean; message?: string; expectedLetter?: string } => {
    const clean = (val || '').trim().toUpperCase().replace(/[-\s]/g, '');
    if (!clean) return { isValid: false, message: 'DNI/CIF no puede estar vacío.' };

    const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

    // 1. DNI Estándar Español (8 dígitos + 1 letra de control)
    const dniMatch = clean.match(/^([0-9]{8})([A-Z])$/);
    if (dniMatch) {
      const num = parseInt(dniMatch[1], 10);
      const expected = DNI_LETTERS.charAt(num % 23);
      const letter = dniMatch[2];
      if (letter !== expected) {
        return {
          isValid: false,
          expectedLetter: expected,
          message: `La letra "${letter}" no es válida para el DNI ${dniMatch[1]}. La letra oficial correcta es "${expected}".`,
        };
      }
      return { isValid: true };
    }

    // 2. NIE Español (X, Y o Z + 7 dígitos + 1 letra de control)
    const nieMatch = clean.match(/^([XYZ])([0-9]{7})([A-Z])$/);
    if (nieMatch) {
      const prefix = nieMatch[1];
      const prefixNum = prefix === 'X' ? '0' : prefix === 'Y' ? '1' : '2';
      const num = parseInt(prefixNum + nieMatch[2], 10);
      const expected = DNI_LETTERS.charAt(num % 23);
      const letter = nieMatch[3];
      if (letter !== expected) {
        return {
          isValid: false,
          expectedLetter: expected,
          message: `La letra "${letter}" no es válida para el NIE ${prefix}${nieMatch[2]}. La letra oficial correcta es "${expected}".`,
        };
      }
      return { isValid: true };
    }

    // 3. CIF Español (Sociedades, Entidades, Asociaciones: Letra + 7 dígitos + Control)
    const cifMatch = clean.match(/^([ABCDEFGHJNPQRSUVW])([0-9]{7})([0-9A-J])$/);
    if (cifMatch) {
      const firstLetter = cifMatch[1];
      const digits = cifMatch[2];
      const control = cifMatch[3];

      let evenSum = 0;
      let oddSum = 0;
      for (let i = 0; i < 7; i++) {
        const d = parseInt(digits[i], 10);
        if (i % 2 === 1) {
          evenSum += d;
        } else {
          const doubled = d * 2;
          oddSum += Math.floor(doubled / 10) + (doubled % 10);
        }
      }
      const total = evenSum + oddSum;
      const mod = total % 10;
      const controlDigit = mod === 0 ? 0 : 10 - mod;
      const controlLetter = 'JABCDEFGHI'[controlDigit];

      const onlyLetters = ['P', 'Q', 'S', 'R', 'W'];
      const onlyNumbers = ['A', 'B', 'E', 'H'];

      if (onlyLetters.includes(firstLetter)) {
        if (control !== controlLetter) {
          return {
            isValid: false,
            expectedLetter: controlLetter,
            message: `Carácter de control incorrecto para CIF. Se esperaba la letra "${controlLetter}".`,
          };
        }
      } else if (onlyNumbers.includes(firstLetter)) {
        if (control !== String(controlDigit)) {
          return {
            isValid: false,
            expectedLetter: String(controlDigit),
            message: `Dígito de control incorrecto para CIF. Se esperaba el número "${controlDigit}".`,
          };
        }
      } else {
        if (control !== String(controlDigit) && control !== controlLetter) {
          return {
            isValid: false,
            expectedLetter: `${controlDigit} o ${controlLetter}`,
            message: `Carácter de control incorrecto para CIF.`,
          };
        }
      }
      return { isValid: true };
    }

    // 4. Si ha introducido 8 números sin letra, calculamos la letra correspondiente
    if (/^[0-9]{8}$/.test(clean)) {
      const num = parseInt(clean, 10);
      const expected = DNI_LETTERS.charAt(num % 23);
      return {
        isValid: false,
        expectedLetter: expected,
        message: `Falta la letra del DNI. Para los números ${clean}, la letra oficial que le corresponde es la "${expected}".`,
      };
    }

    // 5. Si ha introducido NIE de 7 números sin letra
    if (/^[XYZ][0-9]{7}$/.test(clean)) {
      const prefix = clean.charAt(0);
      const prefixNum = prefix === 'X' ? '0' : prefix === 'Y' ? '1' : '2';
      const num = parseInt(prefixNum + clean.slice(1), 10);
      const expected = DNI_LETTERS.charAt(num % 23);
      return {
        isValid: false,
        expectedLetter: expected,
        message: `Falta la letra del NIE. La letra oficial correspondiente es "${expected}".`,
      };
    }

    return {
      isValid: false,
      message: 'Formato de DNI no válido. Debe constar de 8 números y su letra de control correcta.',
    };
  };

  const cleanDni = dniCif.trim().toUpperCase();
  const cleanName = nombreCompleto.trim().toUpperCase();

  const dniValidation = useMemo(() => {
    if (owner) return { isValid: true };
    return validateDniNieCif(dniCif);
  }, [dniCif, owner]);

  const isDniValid = dniValidation.isValid;

  // Buscar si ya existe este DNI en la campaña actual (normalizando espacios, puntos y guiones)
  const duplicateInCurrentCampaign = useMemo(() => {
    const normInput = (dniCif || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!normInput || normInput.length < 3) return null;
    return campaignOwners.find((o) => {
      if (owner && o.id === owner.id) return false;
      const normOwnerDni = (o.dniCif || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return normOwnerDni === normInput;
    }) || null;
  }, [campaignOwners, dniCif, owner]);

  // Buscar coincidencia histórica por DNI en otras campañas (no en la actual)
  const historicalMatch = useMemo(() => {
    const normInput = (dniCif || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!normInput || normInput.length < 3) return null;
    if (duplicateInCurrentCampaign) return null;
    return allOwners.find((o) => {
      if (owner && o.id === owner.id) return false;
      const isCurrentCamp = !o.campana || o.campana === activeCampaign;
      if (isCurrentCamp) return false;
      const normOwnerDni = (o.dniCif || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return normOwnerDni === normInput;
    }) || null;
  }, [allOwners, dniCif, owner, activeCampaign, duplicateInCurrentCampaign]);

  // Si encontramos ganadero histórico al escribir un DNI válido, autocompletar automáticamente
  useEffect(() => {
    if (!owner && isDniValid && !duplicateInCurrentCampaign && historicalMatch) {
      if (!nombreCompleto || nombreCompleto === historicalMatch.nombreCompleto) {
        setNombreCompleto(historicalMatch.nombreCompleto);
        setTelefono(historicalMatch.telefono || '');
        setEmail(historicalMatch.email || '');
        setDireccion(historicalMatch.direccion || '');
        setMunicipio(historicalMatch.municipio || 'Hinojos (Huelva)');
        setCodigoRega(historicalMatch.codigoRega || '');
        setAsociacion(historicalMatch.asociacion || '');
        setNotas(historicalMatch.notas || '');
      }
    }
  }, [historicalMatch, isDniValid, duplicateInCurrentCampaign, owner]);

  const isFormUnlocked = Boolean(owner || (isDniValid && !duplicateInCurrentCampaign));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cDni = dniCif.trim().toUpperCase();
    const cName = nombreCompleto.trim().toUpperCase();

    if (!cName || !cDni) {
      setErrorMsg('Nombre completo y DNI/CIF son campos obligatorios');
      return;
    }

    // Validación oficial de la letra del DNI/CIF si es nuevo registro
    if (!owner) {
      const val = validateDniNieCif(cDni);
      if (!val.isValid) {
        setErrorMsg(val.message || 'La letra del DNI no es correcta.');
        return;
      }
    }

    // 1. Evitar duplicar el mismo DNI en la misma campaña
    if (duplicateInCurrentCampaign) {
      setErrorMsg(
        `El DNI/CIF "${cDni}" ya está registrado en la campaña actual (${activeCampaign}) para "${duplicateInCurrentCampaign.nombreCompleto}".`
      );
      return;
    }

    // 2. Control de unicidad histórica: el DNI no puede asignarse a un titular con nombre distinto
    if (historicalMatch) {
      const matchNameNorm = normalizeOwnerName(historicalMatch.nombreCompleto);
      const curNameNorm = normalizeOwnerName(cName);
      if (matchNameNorm !== curNameNorm) {
        setErrorMsg(
          `Conflicto de DNI: El DNI/CIF "${cDni}" ya pertenece en el censo histórico a "${historicalMatch.nombreCompleto}". No se permite registrar este DNI a nombre de "${cName}" para no alterar las estadísticas ni duplicar la identidad del titular.`
        );
        return;
      }
    }

    const saved: Owner = {
      id: owner?.id || `owner-${Date.now()}`,
      campana: owner?.campana || activeCampaign,
      nombreCompleto: cName,
      dniCif: cDni,
      telefono: telefono.trim(),
      email: email.trim(),
      direccion: direccion.trim(),
      municipio: municipio.trim(),
      codigoRega: codigoRega.trim().toUpperCase(),
      asociacion: asociacion.trim(),
      notas: notas.trim(),
    };

    setIsSaving(true);
    setErrorMsg(null);
    try {
      await onSave(saved);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar los datos');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-base font-bold">
            {owner ? `Editar Propietario: ${owner.nombreCompleto}` : 'Nuevo Propietario'}
          </h2>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs sm:text-sm overflow-y-auto overscroll-contain flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CAMPO 1: DNI / CIF (Primer campo obligatorio para desbloquear el formulario) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-800">
                1. DNI / CIF del Titular *
              </label>
              {isDniValid && !duplicateInCurrentCampaign && !historicalMatch && (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>DNI Válido (Nuevo Titular)</span>
                </span>
              )}
            </div>

            <input
              type="text"
              value={dniCif}
              onChange={(e) => {
                setDniCif(e.target.value.toUpperCase());
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="ej. 29871234A o B12345678"
              className={`w-full text-xs sm:text-sm px-3.5 py-2.5 border rounded-lg uppercase font-mono font-bold transition ${
                duplicateInCurrentCampaign
                  ? 'border-rose-500 bg-rose-50/70 text-rose-950 ring-2 ring-rose-400'
                  : !isDniValid && dniCif.trim().length > 0
                  ? 'border-amber-400 bg-amber-50/40 text-amber-950'
                  : isDniValid
                  ? 'border-emerald-500 bg-emerald-50/30 text-emerald-950'
                  : 'border-gray-300 bg-white'
              }`}
              required
            />

            {/* Guía si no hay DNI introducido */}
            {!owner && !dniCif.trim() && (
              <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                <span>ℹ️</span>
                <span>Introduzca un DNI o CIF con formato válido (ej. 12345678A) para habilitar el resto del formulario.</span>
              </p>
            )}

            {/* Aviso de letra de DNI incorrecta o formato incompleto */}
            {!owner && dniCif.trim().length > 0 && !isDniValid && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-start gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{dniValidation.message || 'Formato o letra de DNI/CIF no válido.'}</span>
                </div>
                {dniValidation.expectedLetter && (
                  <button
                    type="button"
                    onClick={() => {
                      const clean = dniCif.trim().toUpperCase().replace(/[-\s]/g, '');
                      if (/^[0-9]{8}$/.test(clean)) {
                        setDniCif(`${clean}${dniValidation.expectedLetter}`);
                      } else if (/^[0-9]{8}[A-Z]$/.test(clean)) {
                        setDniCif(`${clean.slice(0, 8)}${dniValidation.expectedLetter}`);
                      } else if (/^[XYZ][0-9]{7}[A-Z]$/.test(clean)) {
                        setDniCif(`${clean.slice(0, 8)}${dniValidation.expectedLetter}`);
                      } else if (/^[XYZ][0-9]{7}$/.test(clean)) {
                        setDniCif(`${clean}${dniValidation.expectedLetter}`);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 rounded transition cursor-pointer shadow-2xs"
                  >
                    <span>Asignar letra oficial correcta: <strong>{dniValidation.expectedLetter}</strong></span>
                  </button>
                )}
              </div>
            )}

            {/* Alerta si ya existe en esta campaña activa */}
            {duplicateInCurrentCampaign && (
              <div className="p-3 bg-rose-50 border-2 border-rose-400 rounded-lg text-rose-950 font-bold text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-rose-900 font-black">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>¡DNI YA REGISTRADO EN ESTA CAMPAÑA!</span>
                </div>
                <p className="text-[11px] text-rose-800 font-medium">
                  Ya existe un propietario registrado en la campaña <strong>{activeCampaign}</strong> con este mismo DNI a nombre de:
                </p>
                <div className="bg-white p-2 rounded border border-rose-300 font-black text-rose-950 uppercase text-xs">
                  {duplicateInCurrentCampaign.nombreCompleto} ({duplicateInCurrentCampaign.dniCif})
                </div>
              </div>
            )}

            {/* Alerta de ganadero histórico en otras campañas */}
            {!duplicateInCurrentCampaign && historicalMatch && (
              <div className="p-3 bg-emerald-100/80 border border-emerald-400 rounded-lg text-emerald-950 text-xs space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-emerald-900">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>GANADERO LOCALIZADO EN CAMPAÑAS ANTERIORES</span>
                  </div>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded">
                    Campaña {historicalMatch.campana || 'Histórica'}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-900 leading-snug">
                  Se ha reconocido a <strong>{historicalMatch.nombreCompleto}</strong>. Los datos de su ficha han sido cargados automáticamente.
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              value={nombreCompleto}
              disabled={!isFormUnlocked}
              onChange={(e) => {
                setNombreCompleto(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="APELLIDOS Y NOMBRE DEL TITULAR"
              className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg uppercase font-semibold transition ${
                !isFormUnlocked
                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Código REGA</label>
              <input
                type="text"
                value={codigoRega}
                disabled={!isFormUnlocked}
                onChange={(e) => setCodigoRega(e.target.value)}
                placeholder="ES2104..."
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg uppercase font-mono transition ${
                  !isFormUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={telefono}
                disabled={!isFormUnlocked}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="600 00 00 00"
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg transition ${
                  !isFormUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                disabled={!isFormUnlocked}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.es"
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg transition ${
                  !isFormUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Dirección</label>
              <input
                type="text"
                value={direccion}
                disabled={!isFormUnlocked}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle y número"
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg transition ${
                  !isFormUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Municipio</label>
              <input
                type="text"
                value={municipio}
                disabled={!isFormUnlocked}
                onChange={(e) => setMunicipio(e.target.value)}
                placeholder="Hinojos (Huelva)"
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg transition ${
                  !isFormUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Asociación de Pertenencia
              </label>
              <select
                value={asociacion}
                disabled={!isFormUnlocked}
                onChange={(e) => setAsociacion(e.target.value)}
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-lg font-medium focus:ring-2 focus:ring-emerald-500 transition ${
                  !isFormUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
              >
                <option value="">-- Sin Asociación / Particular --</option>
                {associations.map((a) => (
                  <option key={a.id} value={a.nombre}>
                    {a.nombre} (CIF: {a.cif})
                  </option>
                ))}
                {asociacion && !associations.some((a) => a.nombre === asociacion) && (
                  <option value={asociacion}>{asociacion} (Personalizada)</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Notas / Observaciones</label>
            <textarea
              rows={2}
              value={notas}
              disabled={!isFormUnlocked}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Historial, marcas o anotaciones relevantes del titular..."
              className={`w-full text-xs px-3 py-2 border rounded-lg transition ${
                !isFormUnlocked
                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
            />
          </div>

          <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isFormUnlocked || isSaving || Boolean(duplicateInCurrentCampaign)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#008744] hover:bg-[#00743a] text-white font-bold rounded-lg shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Propietario'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Associations Management Modal Component
interface AssociationsModalProps {
  associations: Association[];
  owners: Owner[];
  onClose: () => void;
  onSaveAssociation: (association: Association, isUpdate?: boolean) => Promise<void>;
  onDeleteAssociation: (id: string, reassignTo?: string) => Promise<void>;
}

const AssociationsModal: React.FC<AssociationsModalProps> = ({
  associations,
  owners,
  onClose,
  onSaveAssociation,
  onDeleteAssociation,
}) => {
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const [nombre, setNombre] = useState('');
  const [cif, setCif] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para modal de confirmación inteligente de eliminación
  const [associationToDelete, setAssociationToDelete] = useState<Association | null>(null);
  const [reassignChoice, setReassignChoice] = useState<'SIN_ASOCIACION' | 'OTRA_ASOCIACION'>('SIN_ASOCIACION');
  const [targetAssociationNombre, setTargetAssociationNombre] = useState<string>('');

  const handleStartEdit = (asoc: Association) => {
    setEditingId(asoc.id);
    setNombre(asoc.nombre);
    setCif(asoc.cif);
    setFeedback(null);
  };

  const handleResetForm = () => {
    setEditingId(null);
    setNombre('');
    setCif('');
    setFeedback(null);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !cif.trim()) {
      setFeedback({ type: 'error', message: 'El nombre y el CIF son campos obligatorios.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const isUpdate = Boolean(editingId);
    const saved: Association = {
      id: editingId || `asoc-${Date.now()}`,
      nombre: nombre.trim(),
      cif: cif.trim().toUpperCase(),
      creadoEn: new Date().toISOString(),
    };

    try {
      await onSaveAssociation(saved, isUpdate);
      setEditingId(null);
      setNombre('');
      setCif('');
      setFeedback({
        type: 'success',
        message: isUpdate
          ? `Asociación "${saved.nombre}" actualizada correctamente.`
          : `Asociación "${saved.nombre}" creada y registrada con éxito.`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al guardar la asociación.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inicio de proceso de eliminación
  const handleInitiateDelete = (asoc: Association) => {
    setFeedback(null);
    const associatedCount = owners.filter(
      (o) => o.asociacion?.trim().toLowerCase() === asoc.nombre.trim().toLowerCase()
    ).length;

    if (associatedCount === 0) {
      // Si no tiene socios, confirmación simple estándar
      if (window.confirm(`¿Estás seguro de eliminar la asociación "${asoc.nombre}"?`)) {
        executeDelete(asoc.id);
      }
    } else {
      // Si tiene socios, abrir el diálogo interactivo de reasignación
      setAssociationToDelete(asoc);
      setReassignChoice('SIN_ASOCIACION');
      // Por defecto la primera otra asociación si existe
      const otherAsocs = associations.filter((a) => a.id !== asoc.id);
      setTargetAssociationNombre(otherAsocs.length > 0 ? otherAsocs[0].nombre : '');
    }
  };

  const executeDelete = async (id: string, reassignTo?: string) => {
    setIsSubmitting(true);
    try {
      await onDeleteAssociation(id, reassignTo);
      setAssociationToDelete(null);
      setFeedback({
        type: 'success',
        message: 'Asociación eliminada correctamente.',
      });
      if (editingId === id) {
        handleResetForm();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Error al eliminar la asociación.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmInteractiveDelete = () => {
    if (!associationToDelete) return;
    const reassignTo = reassignChoice === 'SIN_ASOCIACION' ? '' : targetAssociationNombre;
    executeDelete(associationToDelete.id, reassignTo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-300" />
            <h2 className="text-base font-bold">
              Gestión de Asociaciones de Propietarios
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-emerald-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto overscroll-contain flex-1">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Form to Add / Edit Association */}
          <form
            onSubmit={handleFormSubmit}
            className={`p-4 rounded-xl border space-y-3 text-xs sm:text-sm transition ${
              editingId
                ? 'bg-blue-50/70 border-blue-200'
                : 'bg-emerald-50/60 border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className={`font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 ${
                editingId ? 'text-blue-900' : 'text-emerald-950'
              }`}>
                {editingId ? (
                  <>
                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Modificar Asociación</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Añadir Nueva Asociación</span>
                  </>
                )}
              </h3>
              {editingId && (
                <span className="text-[11px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                  Modo Edición
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nombre de la Asociación *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej. Asociación de Ganaderos de Hinojos"
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  CIF *
                </label>
                <input
                  type="text"
                  value={cif}
                  onChange={(e) => setCif(e.target.value)}
                  placeholder="ej. G21458921"
                  className="w-full text-xs sm:text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white uppercase font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              {editingId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                  disabled={isSubmitting}
                >
                  Cancelar edición
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-lg shadow-xs transition disabled:opacity-50 ${
                  editingId
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-[#008744] hover:bg-[#00743a]'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {isSubmitting
                    ? 'Guardando...'
                    : editingId
                    ? 'Actualizar Asociación'
                    : 'Guardar Asociación'}
                </span>
              </button>
            </div>
          </form>

          {/* List of Registered Associations */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                Asociaciones Registradas ({associations.length})
              </h3>
              <span className="text-[11px] text-gray-400">
                Gestión en tiempo real
              </span>
            </div>

            {associations.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No hay asociaciones registradas. Añade la primera con el formulario superior.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {associations.map((asoc) => {
                  const associatedOwnersCount = owners.filter(
                    (o) => o.asociacion?.trim().toLowerCase() === asoc.nombre.trim().toLowerCase()
                  ).length;
                  const isCurrentEditing = editingId === asoc.id;

                  return (
                    <div
                      key={asoc.id}
                      className={`p-3 flex items-center justify-between gap-3 text-xs transition ${
                        isCurrentEditing ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                          <span className="truncate">{asoc.nombre}</span>
                          <span className="font-mono text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                            CIF: {asoc.cif}
                          </span>
                        </div>
                        <p className="text-gray-500 text-[11px] flex items-center gap-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${associatedOwnersCount > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                          <span className="font-medium text-gray-700">{associatedOwnersCount}</span> socios ganaderos vinculados
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEdit(asoc)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Editar asociación"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleInitiateDelete(asoc)}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Eliminar asociación"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-800 text-xs font-bold rounded-lg transition shadow-xs"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>

      {/* Sub-modal: Confirmación interactiva de eliminación con socios vinculados */}
      {associationToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-rose-200">
            <div className="bg-rose-600 text-white px-5 py-4 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold">
                Eliminar Asociación con Socios Vinculados
              </h3>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-900">
                <p className="font-semibold text-xs leading-relaxed">
                  La asociación <span className="font-bold underline">{associationToDelete.nombre}</span> tiene{' '}
                  <span className="font-black text-rose-700">
                    {
                      owners.filter(
                        (o) =>
                          o.asociacion?.trim().toLowerCase() ===
                          associationToDelete.nombre.trim().toLowerCase()
                      ).length
                    }{' '}
                    socio(s) ganadero(s)
                  </span>{' '}
                  asignados.
                </p>
                <p className="mt-1 text-[11px] text-rose-700">
                  Para proceder con la eliminación, debes indicar qué hacer con dichos socios:
                </p>
              </div>

              {/* Opciones de destino para los socios */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="reassignChoice"
                    checked={reassignChoice === 'SIN_ASOCIACION'}
                    onChange={() => setReassignChoice('SIN_ASOCIACION')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-gray-900 block text-xs">
                      1. Dejar como "Sin Asociación / Particular"
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      Se desvinculará a los ganaderos de esta asociación, dejándolos como titulares particulares sin pertenencia a ninguna entidad.
                    </span>
                  </div>
                </label>

                {associations.filter((a) => a.id !== associationToDelete.id).length > 0 && (
                  <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="reassignChoice"
                      checked={reassignChoice === 'OTRA_ASOCIACION'}
                      onChange={() => setReassignChoice('OTRA_ASOCIACION')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <span className="font-bold text-gray-900 block text-xs">
                        2. Traspasar y reasignar todos los socios a otra asociación
                      </span>
                      <span className="text-[11px] text-gray-500 block mb-2">
                        Se actualizará automáticamente la ficha de todos los ganaderos afectados a la asociación que elijas a continuación:
                      </span>

                      {reassignChoice === 'OTRA_ASOCIACION' && (
                        <select
                          value={targetAssociationNombre}
                          onChange={(e) => setTargetAssociationNombre(e.target.value)}
                          className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500"
                        >
                          {associations
                            .filter((a) => a.id !== associationToDelete.id)
                            .map((a) => (
                              <option key={a.id} value={a.nombre}>
                                {a.nombre} (CIF: {a.cif})
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </label>
                )}
              </div>

              {/* Botones de acción del submodal */}
              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssociationToDelete(null)}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInteractiveDelete}
                  disabled={
                    isSubmitting ||
                    (reassignChoice === 'OTRA_ASOCIACION' && !targetAssociationNombre)
                  }
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg shadow-xs transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Eliminando...' : 'Confirmar y Eliminar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
