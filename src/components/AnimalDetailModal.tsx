import React, { useEffect } from 'react';
import { Animal, Movement, User } from '../types/marisma';
import { HinojosLogo } from './HinojosLogo';
import {
  X,
  Printer,
  FileText,
  Baby,
  Download,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Tag,
} from 'lucide-react';
import { formatDateDDMMYY } from '../utils/dateUtils';

interface AnimalDetailModalProps {
  isOpen?: boolean;
  animal: Animal | null;
  allAnimals?: Animal[];
  onClose: () => void;
  onEdit: (animal: Animal) => void;
  movements: Movement[];
  currentUser?: User | null;
}

export const AnimalDetailModal: React.FC<AnimalDetailModalProps> = ({
  isOpen = true,
  animal,
  allAnimals = [],
  onClose,
  onEdit,
  movements,
  currentUser,
}) => {
  const isReadOnly = currentUser?.rol !== 'ADMINISTRADOR';
  useEffect(() => {
    if (!isOpen || !animal) return;

    // Bloquear el scroll del fondo (body) mientras la ficha esté abierta
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, animal, onClose]);

  if (!isOpen || !animal) return null;

  // Obtener todos los IDs asociados a este mismo animal (por microchip o nombre+propietario)
  const targetChip = (animal.identificacion1 || '').trim().toUpperCase();
  const relatedAnimalIds = new Set<string>([animal.id]);
  if (targetChip && allAnimals.length > 0) {
    allAnimals.forEach((a) => {
      if ((a.identificacion1 || '').trim().toUpperCase() === targetChip) {
        relatedAnimalIds.add(a.id);
      }
    });
  }

  // Filtrar movimientos que pertenezcan a cualquiera de los IDs del animal o por coincidencia de chip o nombre y propietario
  const animalMovements = movements
    .filter((m) => {
      if (relatedAnimalIds.has(m.animalId)) return true;
      if (targetChip && m.identificacion1 && m.identificacion1.trim().toUpperCase() === targetChip) {
        return true;
      }
      if (
        animal.tipo === 'EQUINO' &&
        m.tipoAnimal === 'EQUINO' &&
        m.nombreAnimal &&
        animal.nombreAnimal &&
        m.nombreAnimal.trim().toLowerCase() === animal.nombreAnimal.trim().toLowerCase() &&
        m.propietario &&
        animal.propietario &&
        m.propietario.trim().toLowerCase() === animal.propietario.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDoc = (docName: string, url?: string, fileData?: string) => {
    const a = document.createElement('a');
    if (url) {
      a.href = url;
      a.target = '_blank';
    } else if (fileData) {
      a.href = fileData;
    } else {
      const blob = new Blob([`Documento oficial censo ganadero Hinojos: ${docName}`], {
        type: 'text/plain',
      });
      a.href = URL.createObjectURL(blob);
    }
    a.download = docName;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-hidden overscroll-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Header Bar */}
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <HinojosLogo className="w-9 h-9" />
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Ficha Oficial de Censo Ganadero · {animal.plazaNumero ? `Plaza ${animal.plazaNumero}` : 'Expediente Histórico'}
              </h2>
              <p className="text-xs text-emerald-200">
                Ayuntamiento de Hinojos · Campaña {animal.campana}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
              title="Imprimir Ficha Oficial"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir Ficha</span>
            </button>

            {!isReadOnly && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(animal);
                }}
                className="px-3 py-1.5 bg-[#008744] hover:bg-[#00743a] text-white text-xs font-semibold rounded-lg transition"
              >
                Editar
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable / View Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
          {/* Municipal Header in Print */}
          <div className="border-b-2 border-emerald-900 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <HinojosLogo className="w-14 h-14" />
              <div>
                <h1 className="text-xl font-black text-gray-900 tracking-tight">
                  AYUNTAMIENTO DE HINOJOS
                </h1>
                <p className="text-xs text-gray-500">
                  Censo Ganadero y Adjudicación de Plazas en la Marisma de Hinojos
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white font-mono font-black text-base sm:text-lg px-3 py-1 rounded">
                {animal.plazaNumero ? `PLAZA ${animal.plazaNumero}` : 'EXPEDIENTE HISTÓRICO'}
              </span>
              <p className="text-xs text-gray-500 mt-1 font-semibold">
                Campaña {animal.campana}
              </p>
            </div>
          </div>

          {/* Primary Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Animal Info Box */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                <span className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5">
                  <span>{animal.tipo === 'EQUINO' ? '🐎' : '🐂'}</span>
                  <span>Datos del Animal</span>
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                  {animal.tipo}
                </span>
              </div>

              <div className={`grid ${animal.tipo === 'EQUINO' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-3 text-xs`}>
                {animal.tipo === 'EQUINO' && (
                  <div>
                    <span className="text-gray-500 block text-[11px]">Nombre del Animal:</span>
                    <span className="font-black text-emerald-950 text-sm">
                      {animal.nombreAnimal}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 block text-[11px]">Sexo y Capa:</span>
                  <span className="font-bold text-gray-900">
                    {animal.sexo === 'H' ? 'Hembra (H)' : 'Macho (M)'} · {animal.capa}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">
                    {animal.tipo === 'BOVINO' ? 'Identificación 1 (Crotal Oficial):' : 'Identificación 1 (Microchip):'}
                  </span>
                  <span className="font-mono font-bold text-gray-800">
                    {animal.identificacion1 || 'Pendiente'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">
                    {animal.tipo === 'BOVINO' ? 'Identificación 2 (DIIA / Matrícula):' : 'Identificación 2 (UELN / Pasaporte):'}
                  </span>
                  <span className="font-mono font-bold text-gray-800">
                    {animal.identificacion2 || 'Pendiente'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Fecha de Nacimiento:</span>
                  <span className="font-medium text-gray-800">
                    {formatDateDDMMYY(animal.fechaNacimiento)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Finca Asignada:</span>
                  <span className="font-bold text-gray-800">{animal.finca || 'HINOJOS'}</span>
                </div>
              </div>
            </div>

            {/* Owner & Presence Status Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-black uppercase text-slate-900">
                  👤 Titular y Presencia
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    animal.estadoPresencia === 'DENTRO'
                      ? 'bg-emerald-100 text-emerald-800'
                      : animal.estadoPresencia === 'FUERA' && animal.plazaNumero
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {animal.estadoPresencia === 'DENTRO'
                    ? 'Dentro de la Marisma'
                    : animal.estadoPresencia === 'FUERA' && animal.plazaNumero
                    ? 'Fuera Temporal (Plaza Reservada)'
                    : 'Fuera de Marisma (Histórico / Retirado)'}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500 block text-[11px]">Propietario / Ganadero:</span>
                  <span className="font-black text-gray-900 text-sm">
                    {animal.propietario}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Última Revisión (FECHA UL RV):</span>
                    <span className="font-bold text-emerald-900">
                      {formatDateDDMMYY(animal.fechaUltimaRevision)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Entrada en Marisma:</span>
                    <span className="font-medium text-gray-800">
                      {formatDateDDMMYY(animal.fechaEntradaMarisma)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Rastra (Cría al pie) section if present */}
          {animal.rastra ? (
            <div className="bg-amber-50/60 border border-amber-300 rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2 mb-3">
                <h3 className="text-xs font-black uppercase text-amber-950 flex items-center gap-1.5">
                  <Baby className="w-4 h-4 text-amber-700" />
                  <span>Rastra al Pie (Cría de {animal.tipo === 'BOVINO' ? `Plaza ${animal.plazaNumero}` : animal.nombreAnimal})</span>
                </h3>
                <span className="text-[11px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                  REGISTRADA EN CENSO
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block text-[11px]">Nombre Cría:</span>
                  <span className="font-black text-amber-950 text-sm">
                    {animal.rastra.nombre}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Sexo y Capa:</span>
                  <span className="font-bold text-gray-900">
                    {animal.rastra.sexo === 'H' ? 'Hembra' : 'Macho'} · {animal.rastra.capa}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Chip Rastra:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {animal.rastra.rastrasChip || 'Sin chip'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">UELN Rastra:</span>
                  <span className="font-mono font-bold text-gray-800">
                    {animal.rastra.ueln || 'Sin UELN'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Propietario de Rastra:</span>
                  <span className="font-bold text-gray-800">
                    {animal.rastra.propietarioRastra}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Fecha Nacimiento:</span>
                  <span className="font-medium text-gray-800">
                    {animal.rastra.fechaNacimiento || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">F. Entrada Marisma:</span>
                  <span className="font-medium text-gray-800">
                    {animal.rastra.fechaEntrada || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">F. Salida:</span>
                  <span className="font-medium text-gray-800">
                    {animal.rastra.fechaSalida || 'En marisma'}
                  </span>
                </div>
              </div>

              {animal.rastra.observaciones && (
                <div className="mt-3 pt-2 border-t border-amber-200 text-xs text-amber-900">
                  <strong>Observaciones de la cría:</strong> {animal.rastra.observaciones}
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-center justify-between">
              <span>Este animal no tiene rastra asignada en la campaña actual.</span>
            </div>
          )}

          {/* Documents Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-700" />
              <span>Documentación Adjunta ({animal.documentos.length})</span>
            </h3>

            {animal.documentos.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay documentos cargados en el expediente.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {animal.documentos.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📄</span>
                      <div>
                        <p className="text-xs font-bold text-gray-900 truncate max-w-[200px]">
                          {doc.nombre}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {doc.tipo.replace('_', ' ')} · {doc.tamano}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadDoc(doc.nombre, doc.url, doc.fileData)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field Notes Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">
              Cuaderno de Campo y Anotaciones Oficiales ({animal.anotaciones.length})
            </h3>

            {animal.anotaciones.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Sin anotaciones de guardería registradas.</p>
            ) : (
              <div className="space-y-2">
                {animal.anotaciones.map((n) => (
                  <div key={n.id} className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">
                        {n.categoria}
                      </span>
                      <span className="text-gray-500 text-[11px]">
                        {n.autor} · {formatDateDDMMYY(n.fecha)}
                      </span>
                    </div>
                    <p className="text-gray-800 leading-relaxed">{n.texto}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Movements Timeline */}
          {animalMovements.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase text-gray-900 tracking-wider">
                Historial de Entradas y Salidas en la Marisma ({animalMovements.length})
              </h3>
              <div className="space-y-2">
                {animalMovements.map((mov) => (
                  <div
                    key={mov.id}
                    className="p-3 bg-white border border-gray-200 rounded-lg text-xs flex items-center justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          mov.tipoMovimiento === 'ENTRADA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {mov.tipoMovimiento}
                      </span>
                      {mov.campana && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                          Campaña {mov.campana}
                        </span>
                      )}
                      <span className="font-semibold text-gray-900">{formatDateDDMMYY(mov.fecha)}</span>
                      {mov.plazaNumero && (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-mono text-[10px] border border-gray-200">
                          Plaza {mov.plazaNumero}
                        </span>
                      )}
                      <span className="text-gray-500">· Motivo: {mov.motivo}</span>
                      {mov.numeroGuia && <span className="text-gray-500 font-mono">({mov.numeroGuia})</span>}
                    </div>
                    <span className="text-gray-400 text-[11px] shrink-0">Guarda: {mov.guardaResponsable}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer (Screen only) */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex items-center justify-between print:hidden">
          <span className="text-xs text-gray-500">
            Ficha oficial municipal · Ayuntamiento de Hinojos
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-lg transition shadow-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
