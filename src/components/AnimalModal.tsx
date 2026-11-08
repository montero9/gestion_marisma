import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Animal, AnimalType, Owner, Rastra, AnimalDocument, Annotation, User, PresenceStatus } from '../types/marisma';
import {
  CAPAS_PELAJES,
  getNextPlazaNumber,
  toInputDate,
  fromInputDate,
} from '../constants/capas';
import {
  X,
  Save,
  Baby,
  FileText,
  MessageSquare,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  AlertTriangle,
  Plus,
  Calendar,
  CheckCircle,
  Pencil,
  Check,
} from 'lucide-react';

interface AnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (animal: Animal) => void;
  initialAnimal?: Animal | null;
  existingAnimals?: Animal[];
  defaultTipo: AnimalType;
  defaultCampana: string;
  owners: Owner[];
  currentUser: User;
}

export const AnimalModal: React.FC<AnimalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAnimal,
  existingAnimals = [],
  defaultTipo,
  defaultCampana,
  owners,
  currentUser,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const isEditing = !!initialAnimal;

  // Refs for calendar date pickers
  const dateInputRef = useRef<HTMLInputElement>(null);
  const rastraDateInputRef = useRef<HTMLInputElement>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'DATOS' | 'RASTRA' | 'DOCUMENTOS' | 'ANOTACIONES'>('DATOS');

  // Animal Form State
  const [tipo, setTipo] = useState<AnimalType>(initialAnimal?.tipo || defaultTipo);
  const [campana, setCampana] = useState(initialAnimal?.campana || defaultCampana);
  const [plazaNumero, setPlazaNumero] = useState(
    initialAnimal?.plazaNumero ||
      getNextPlazaNumber(
        existingAnimals,
        initialAnimal?.campana || defaultCampana,
        (initialAnimal?.tipo || defaultTipo) === 'BOVINO' ? 'HIN' : 'HI'
      )
  );
  const [propietario, setPropietario] = useState(initialAnimal?.propietario || '');
  const [finca, setFinca] = useState(initialAnimal?.finca || 'HINOJOS');
  const [identificacion1, setIdentificacion1] = useState(initialAnimal?.identificacion1 || '');
  const [identificacion2, setIdentificacion2] = useState(initialAnimal?.identificacion2 || '');
  const [nombreAnimal, setNombreAnimal] = useState(initialAnimal?.nombreAnimal || '');
  const [sexo, setSexo] = useState<'H' | 'M'>(initialAnimal?.sexo || 'H');
  const [fechaNacimiento, setFechaNacimiento] = useState(initialAnimal?.fechaNacimiento || '');
  const [capa, setCapa] = useState(
    initialAnimal?.capa || (defaultTipo === 'BOVINO' ? 'OTRO' : 'TORDO')
  );
  const [fechaUltimaRevision, setFechaUltimaRevision] = useState(initialAnimal?.fechaUltimaRevision || '');
  const [estadoPresencia, setEstadoPresencia] = useState<PresenceStatus>(
    initialAnimal?.estadoPresencia && initialAnimal.estadoPresencia !== 'PLAZA_VACANTE'
      ? initialAnimal.estadoPresencia
      : 'DENTRO'
  );

  // Rastra (Cría) State
  const [hasRastra, setHasRastra] = useState<boolean>(!!initialAnimal?.rastra);
  const [rastraPropietario, setRastraPropietario] = useState(initialAnimal?.rastra?.propietarioRastra || '');
  const [rastraChip, setRastraChip] = useState(initialAnimal?.rastra?.rastrasChip || '');
  const [rastraUeln, setRastraUeln] = useState(initialAnimal?.rastra?.ueln || '');
  const [rastraNombre, setRastraNombre] = useState(initialAnimal?.rastra?.nombre || '');
  const [rastraSexo, setRastraSexo] = useState<'H' | 'M'>(initialAnimal?.rastra?.sexo || 'H');
  const [rastraFN, setRastraFN] = useState(initialAnimal?.rastra?.fechaNacimiento || '');
  const [rastraCapa, setRastraCapa] = useState(initialAnimal?.rastra?.capa || 'TORDO');
  const [rastraFechaEntrada, setRastraFechaEntrada] = useState(initialAnimal?.rastra?.fechaEntrada || '');
  const [rastraFechaSalida, setRastraFechaSalida] = useState(initialAnimal?.rastra?.fechaSalida || '');
  const [rastraObservaciones, setRastraObservaciones] = useState(initialAnimal?.rastra?.observaciones || '');

  // Documents State
  const [documentos, setDocumentos] = useState<AnimalDocument[]>(initialAnimal?.documentos || []);
  const [newDocTipo, setNewDocTipo] = useState<AnimalDocument['tipo']>('PASAPORTE_DIE');
  const [uploadError, setUploadError] = useState('');

  // Annotations State
  const [anotaciones, setAnotaciones] = useState<Annotation[]>(initialAnimal?.anotaciones || []);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategoria, setNewNoteCategoria] = useState<Annotation['categoria']>('REVISION');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [editingNoteCategoria, setEditingNoteCategoria] = useState<Annotation['categoria']>('REVISION');

  // Sync state whenever modal opens or initialAnimal changes
  useEffect(() => {
    if (isOpen) {
      setEditingNoteId(null);
      setEditingNoteText('');
      if (initialAnimal) {
        setPlazaNumero(initialAnimal.plazaNumero);
        setTipo(initialAnimal.tipo);
        setCampana(initialAnimal.campana);
        setPropietario(initialAnimal.propietario);
        setFinca(initialAnimal.finca);
        setIdentificacion1(initialAnimal.identificacion1);
        setIdentificacion2(initialAnimal.identificacion2);
        setNombreAnimal(initialAnimal.nombreAnimal);
        setSexo(initialAnimal.sexo);
        setFechaNacimiento(initialAnimal.fechaNacimiento);
        setCapa(initialAnimal.capa || (initialAnimal.tipo === 'BOVINO' ? 'OTRO' : 'TORDO'));
        setFechaUltimaRevision(initialAnimal.fechaUltimaRevision || '');
        setEstadoPresencia(
          initialAnimal.estadoPresencia === 'PLAZA_VACANTE' ? 'DENTRO' : initialAnimal.estadoPresencia
        );
        setHasRastra(!!initialAnimal.rastra);
        setRastraPropietario(initialAnimal.rastra?.propietarioRastra || '');
        setRastraChip(initialAnimal.rastra?.rastrasChip || '');
        setRastraUeln(initialAnimal.rastra?.ueln || '');
        setRastraNombre(initialAnimal.rastra?.nombre || '');
        setRastraSexo(initialAnimal.rastra?.sexo || 'H');
        setRastraFN(initialAnimal.rastra?.fechaNacimiento || '');
        setRastraCapa(initialAnimal.rastra?.capa || 'TORDO');
        setRastraFechaEntrada(initialAnimal.rastra?.fechaEntrada || '');
        setRastraFechaSalida(initialAnimal.rastra?.fechaSalida || '');
        setRastraObservaciones(initialAnimal.rastra?.observaciones || '');
        setDocumentos(initialAnimal.documentos || []);
        setAnotaciones(initialAnimal.anotaciones || []);
      } else {
        const prefix = defaultTipo === 'BOVINO' ? 'HIN' : 'HI';
        const nextCorrelative = getNextPlazaNumber(existingAnimals, defaultCampana, prefix);
        setPlazaNumero(nextCorrelative);
        setTipo(defaultTipo);
        setCampana(defaultCampana);
        setPropietario('');
        setFinca('HINOJOS');
        setIdentificacion1('');
        setIdentificacion2('');
        setNombreAnimal('');
        setSexo('H');
        setFechaNacimiento('');
        setCapa(defaultTipo === 'BOVINO' ? 'OTRO' : 'TORDO');
        setFechaUltimaRevision('');
        setEstadoPresencia('DENTRO');
        setHasRastra(false);
        setRastraPropietario('');
        setRastraChip('');
        setRastraUeln('');
        setRastraNombre('');
        setRastraSexo('H');
        setRastraFN('');
        setRastraCapa('TORDO');
        setRastraFechaEntrada('');
        setRastraFechaSalida('');
        setRastraObservaciones('');
        setDocumentos([]);
        setAnotaciones([]);
      }
      setActiveTab('DATOS');
    }
  }, [isOpen, initialAnimal, existingAnimals, defaultTipo, defaultCampana]);

  // Filtrar propietarios estrictamente por la campaña del animal para evitar duplicados del histórico
  const campaignOwners = useMemo(() => {
    const list = owners.filter((o) => !o.campana || o.campana === campana);
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
  }, [owners, campana]);

  const cleanId1 = (identificacion1 || '').trim().toUpperCase();
  const isChipValid = cleanId1.length >= 4;

  // Duplicado en la campaña activa actual
  const duplicateAnimalInCurrentCampaign = useMemo(() => {
    if (!cleanId1 || cleanId1.length < 4) return null;
    return existingAnimals.find((a) => {
      if (initialAnimal && a.id === initialAnimal.id) return false;
      if (a.esPlazaVacante) return false;
      if (a.campana !== campana) return false;
      const aChip = (a.identificacion1 || '').trim().toUpperCase();
      return aChip && aChip === cleanId1;
    }) || null;
  }, [existingAnimals, cleanId1, campana, initialAnimal]);

  // Coincidencia histórica en otras campañas
  const historicalAnimalMatch = useMemo(() => {
    if (!cleanId1 || cleanId1.length < 4) return null;
    if (duplicateAnimalInCurrentCampaign) return null;
    return existingAnimals.find((a) => {
      if (initialAnimal && a.id === initialAnimal.id) return false;
      if (a.esPlazaVacante) return false;
      if (a.campana === campana) return false;
      const aChip = (a.identificacion1 || '').trim().toUpperCase();
      return aChip && aChip === cleanId1;
    }) || null;
  }, [existingAnimals, cleanId1, campana, duplicateAnimalInCurrentCampaign, initialAnimal]);

  const isAnimalFormUnlocked = Boolean(isEditing || (isChipValid && !duplicateAnimalInCurrentCampaign));

  const handleLoadHistoricalAnimal = (hist: Animal) => {
    if (tipo === 'EQUINO' && hist.nombreAnimal) setNombreAnimal(hist.nombreAnimal);
    if (hist.identificacion2) setIdentificacion2(hist.identificacion2);
    if (hist.sexo) setSexo(hist.sexo);
    if (hist.capa) setCapa(hist.capa);
    if (hist.fechaNacimiento) setFechaNacimiento(hist.fechaNacimiento);
    if (hist.finca) setFinca(hist.finca);

    // Intentar asociar el propietario si está dado de alta en la campaña activa
    if (hist.propietario) {
      const ownerInCamp = campaignOwners.find(
        (o) => o.nombreCompleto.trim().toUpperCase() === hist.propietario.trim().toUpperCase()
      );
      if (ownerInCamp) {
        setPropietario(ownerInCamp.nombreCompleto);
      }
    }

    if (hist.rastra) {
      setHasRastra(true);
      setRastraNombre(hist.rastra.nombre || '');
      setRastraChip(hist.rastra.rastrasChip || '');
      setRastraUeln(hist.rastra.ueln || '');
      setRastraSexo(hist.rastra.sexo || 'H');
      setRastraFN(hist.rastra.fechaNacimiento || '');
      setRastraCapa(hist.rastra.capa || 'TORDO');
      setRastraFechaEntrada(hist.rastra.fechaEntrada || '');
      setRastraFechaSalida(hist.rastra.fechaSalida || '');
      setRastraObservaciones(hist.rastra.observaciones || '');
      if (propietario) {
        setRastraPropietario(propietario);
      }
    }
  };

  // Autocarga de datos del animal histórico al introducir un identificador existente
  useEffect(() => {
    if (!isEditing && isChipValid && !duplicateAnimalInCurrentCampaign && historicalAnimalMatch) {
      if (!nombreAnimal || nombreAnimal === historicalAnimalMatch.nombreAnimal) {
        handleLoadHistoricalAnimal(historicalAnimalMatch);
      }
    }
  }, [historicalAnimalMatch, isChipValid, duplicateAnimalInCurrentCampaign, isEditing]);

  if (!isOpen) return null;

  // Plaza input change handler: ensures prefix (HI or HIN) is maintained while allowing manual editing
  const handlePlazaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.toUpperCase().replace(/\s+/g, '');
    const isBov = tipo === 'BOVINO' || raw.startsWith('HIN') || raw.startsWith('BV');
    const pref = isBov ? 'HIN' : 'HI';
    if (raw.startsWith('BV')) {
      raw = `HIN${raw.slice(2)}`;
    }
    // Check HIN first since HI is a prefix of HIN
    if (!raw.startsWith('HIN') && !raw.startsWith('HI')) {
      const cleaned = raw.replace(/^(HIN|HI|H|I|N)/, '').replace(/[^0-9A-Z]/g, '');
      raw = `${pref}${cleaned}`;
    } else {
      const currentPref = raw.startsWith('HIN') ? 'HIN' : 'HI';
      const rest = raw.slice(currentPref.length).replace(/[^0-9A-Z]/g, '');
      raw = `${currentPref}${rest}`;
    }
    setPlazaNumero(raw);
  };

  const handlePlazaBlur = () => {
    // Check HIN first, then HI, with fallback for BV
    const match = plazaNumero.trim().toUpperCase().match(/^(HIN|HI|BV)(\d+)$/);
    if (match) {
      let pref = match[1];
      if (pref === 'BV') pref = 'HIN';
      const num = parseInt(match[2], 10);
      if (!isNaN(num)) {
        setPlazaNumero(`${pref}${String(num).padStart(3, '0')}`);
      }
    }
  };

  // Handle owner selection autofill
  const handleSelectOwner = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) {
      setPropietario(val);
      if (!rastraPropietario) {
        setRastraPropietario(val);
      }
    }
  };

  // Add Document handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setUploadError('El archivo excede el límite de 8 MB permitido.');
      return;
    }
    setUploadError('');

    const reader = new FileReader();
    reader.onload = () => {
      const newDoc: AnimalDocument = {
        id: `doc-${Date.now()}`,
        nombre: file.name,
        tipo: newDocTipo,
        fechaSubida: new Date().toLocaleDateString('es-ES'),
        tamano: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        fileData: reader.result as string,
      };
      setDocumentos((prev) => [newDoc, ...prev]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteDocument = (docId: string) => {
    setDocumentos((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleDownloadDocument = (doc: AnimalDocument) => {
    if (doc.url) {
      const a = document.createElement('a');
      a.href = doc.url;
      a.target = '_blank';
      a.download = doc.nombre;
      a.click();
    } else if (doc.fileData) {
      const a = document.createElement('a');
      a.href = doc.fileData;
      a.download = doc.nombre;
      a.click();
    } else {
      // Mock generated blob for existing demo docs
      const blob = new Blob([`Documento oficial de la Marisma de Hinojos: ${doc.nombre}`], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nombre;
      a.click();
    }
  };

  // Add Annotation handler
  const handleAddAnnotation = () => {
    if (!newNoteText.trim()) return;
    const newNote: Annotation = {
      id: `note-${Date.now()}`,
      fecha: new Date().toLocaleDateString('es-ES'),
      autor: currentUser.nombreCompleto || 'Guarda / Técnico',
      categoria: newNoteCategoria,
      texto: newNoteText.trim(),
    };
    setAnotaciones((prev) => [newNote, ...prev]);
    setNewNoteText('');
  };

  const handleDeleteAnnotation = (noteId: string) => {
    if (editingNoteId === noteId) {
      setEditingNoteId(null);
      setEditingNoteText('');
    }
    setAnotaciones((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleStartEditAnnotation = (note: Annotation) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.texto);
    setEditingNoteCategoria(note.categoria);
  };

  const handleCancelEditAnnotation = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleSaveEditAnnotation = () => {
    if (!editingNoteId || !editingNoteText.trim()) return;
    setAnotaciones((prev) =>
      prev.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              categoria: editingNoteCategoria,
              texto: editingNoteText.trim(),
            }
          : n
      )
    );
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  // Submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanPlaza = plazaNumero.trim().toUpperCase();
    if (!cleanPlaza) {
      alert(`Por favor introduzca el Nº de Plaza (ej. ${tipo === 'BOVINO' ? 'HIN001' : 'HI001'})`);
      setActiveTab('DATOS');
      return;
    }
    if ((!cleanPlaza.startsWith('HI') && !cleanPlaza.startsWith('HIN') && !cleanPlaza.startsWith('BV')) || cleanPlaza.length < 3) {
      alert('El campo plaza es obligatorio y debe contener el prefijo de la plaza (ej. HI001 o HIN001).');
      setActiveTab('DATOS');
      return;
    }

    const isSelfPlaza = Boolean(
      initialAnimal &&
      initialAnimal.plazaNumero.trim().toUpperCase() === cleanPlaza &&
      initialAnimal.campana === campana
    );

    const duplicate = isSelfPlaza
      ? undefined
      : existingAnimals.find(
          (a) =>
            a.campana === campana &&
            a.id !== initialAnimal?.id &&
            !a.esPlazaVacante &&
            a.plazaNumero.trim().toUpperCase() === cleanPlaza
        );
    if (duplicate) {
      alert(`El número de plaza "${cleanPlaza}" ya está asignado al animal "${duplicate.nombreAnimal}" (${duplicate.tipo}) en la campaña ${campana}. La numeración de plaza es un identificador único y no puede repetirse.`);
      setActiveTab('DATOS');
      return;
    }

    const cleanId1 = identificacion1.trim();
    if (!cleanId1) {
      alert(
        tipo === 'BOVINO'
          ? 'Por favor introduzca el Crotal Oficial (Identificación 1) del vacuno. Es un campo obligatorio para el censo.'
          : 'Por favor introduzca el Microchip (Identificación 1) del equino. Es un campo obligatorio para el censo municipal.'
      );
      setActiveTab('DATOS');
      return;
    }

    if (!isEditing && duplicateAnimalInCurrentCampaign) {
      alert(
        `¡Atención! Ya existe un animal registrado con este identificador en la campaña ${campana} en la Plaza ${duplicateAnimalInCurrentCampaign.plazaNumero} a nombre de "${duplicateAnimalInCurrentCampaign.propietario}". No se permiten duplicados en la misma campaña.`
      );
      setActiveTab('DATOS');
      return;
    }

    if (!propietario.trim()) {
      alert('Por favor indique el propietario del animal');
      setActiveTab('DATOS');
      return;
    }

    if (tipo === 'EQUINO' && !nombreAnimal.trim()) {
      alert('Por favor introduzca el nombre del equino');
      setActiveTab('DATOS');
      return;
    }

    let rastraData: Rastra | null = null;
    if (hasRastra && (rastraNombre.trim() || rastraChip.trim() || rastraUeln.trim())) {
      rastraData = {
        id: initialAnimal?.rastra?.id || `rastra-${Date.now()}`,
        propietarioRastra: rastraPropietario.trim() || propietario.trim(),
        rastrasChip: rastraChip.trim(),
        ueln: rastraUeln.trim(),
        nombre: rastraNombre.trim() || 'SIN NOMBRE',
        sexo: rastraSexo,
        fechaNacimiento: rastraFN.trim(),
        capa: rastraCapa.trim(),
        fechaEntrada: rastraFechaEntrada.trim(),
        fechaSalida: rastraFechaSalida.trim(),
        observaciones: rastraObservaciones.trim(),
      };
    }

    const resolvedNombre = tipo === 'BOVINO' ? '' : nombreAnimal.trim().toUpperCase();

    const savedAnimal: Animal = {
      id: initialAnimal?.id || `ani-${tipo.toLowerCase()}-${Date.now()}`,
      tipo,
      campana,
      plazaNumero: cleanPlaza,
      propietario: propietario.trim().toUpperCase(),
      finca: finca.trim().toUpperCase() || 'HINOJOS',
      identificacion1: cleanId1,
      identificacion2: identificacion2.trim(),
      nombreAnimal: resolvedNombre,
      sexo,
      fechaNacimiento: fechaNacimiento.trim(),
      capa: capa.trim().toUpperCase() || (tipo === 'BOVINO' ? 'OTRO' : 'TORDO'),
      fechaUltimaRevision: fechaUltimaRevision.trim(),
      estadoPresencia,
      rastra: rastraData,
      documentos,
      anotaciones,
      creadoEn: initialAnimal?.creadoEn || new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    onSave(savedAnimal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="bg-[#0b5333] text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{tipo === 'EQUINO' ? '🐎' : '🐂'}</span>
            <div>
              <h2 className="text-lg font-bold">
                {isEditing
                  ? `Editar ${tipo === 'BOVINO' ? 'Bovino' : 'Animal'}: ${tipo === 'BOVINO' ? (initialAnimal.identificacion1 || `Plaza ${initialAnimal.plazaNumero}`) : initialAnimal.nombreAnimal}`
                  : 'Nueva Adjudicación de Plaza'}
              </h2>
              <p className="text-xs text-emerald-200">
                Marisma de Hinojos · Campaña {campana}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-5 pt-2 gap-2 overflow-x-auto text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('DATOS')}
            className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'DATOS'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>📋 Datos del Animal</span>
          </button>

          <button
            type="button"
            disabled={!isAnimalFormUnlocked}
            onClick={() => setActiveTab('RASTRA')}
            className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              !isAnimalFormUnlocked
                ? 'opacity-40 cursor-not-allowed border-transparent text-gray-400'
                : activeTab === 'RASTRA'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Baby className="w-4 h-4 text-amber-600" />
            <span>Rastra (Cría al pie)</span>
            {hasRastra && (
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            )}
          </button>

          <button
            type="button"
            disabled={!isAnimalFormUnlocked}
            onClick={() => setActiveTab('DOCUMENTOS')}
            className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              !isAnimalFormUnlocked
                ? 'opacity-40 cursor-not-allowed border-transparent text-gray-400'
                : activeTab === 'DOCUMENTOS'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Documentos ({documentos.length})</span>
          </button>

          <button
            type="button"
            disabled={!isAnimalFormUnlocked}
            onClick={() => setActiveTab('ANOTACIONES')}
            className={`py-2 px-3 border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
              !isAnimalFormUnlocked
                ? 'opacity-40 cursor-not-allowed border-transparent text-gray-400'
                : activeTab === 'ANOTACIONES'
                ? 'border-emerald-700 text-emerald-900 bg-white rounded-t-lg shadow-xs'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>Anotaciones ({anotaciones.length})</span>
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: DATOS DEL ANIMAL */}
          {activeTab === 'DATOS' && (
            <div className="space-y-4">
              {/* CAMPO 1 OBLIGATORIO: IDENTIFICACIÓN 1 (MICROCHIP / CROTAL OFICIAL) */}
              <div className="p-4 bg-slate-50 border-2 border-emerald-500/30 rounded-xl shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-gray-800">
                    {tipo === 'BOVINO'
                      ? '1. Crotal Oficial (Identificación 1) *'
                      : '1. Microchip del Animal (Identificación 1) *'}
                  </label>
                  {!isEditing && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Paso 1: Identificador Obligatorio
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={identificacion1}
                    onChange={(e) => setIdentificacion1(e.target.value)}
                    placeholder={tipo === 'BOVINO' ? 'ej. ES011234567890' : 'ej. 724019010080788'}
                    className={`w-full text-sm px-3.5 py-2.5 border rounded-lg font-mono font-bold tracking-wider uppercase transition ${
                      duplicateAnimalInCurrentCampaign
                        ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-rose-500'
                        : historicalAnimalMatch
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 focus:ring-emerald-600'
                        : isChipValid
                        ? 'border-emerald-500 bg-white text-gray-900 focus:ring-emerald-500'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-emerald-500'
                    }`}
                    required
                    autoFocus={!isEditing}
                  />
                </div>

                {/* Feedback según el estado del chip/crotal */}
                {!isChipValid && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    <span>
                      Introduzca el {tipo === 'BOVINO' ? 'Crotal Oficial' : 'Microchip'} (mínimo 4 caracteres) para comprobar si existe en otras campañas y activar el resto del formulario.
                    </span>
                  </p>
                )}

                {duplicateAnimalInCurrentCampaign && (
                  <div className="text-xs text-rose-800 bg-rose-50 p-3 rounded-lg border border-rose-300 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <div className="space-y-0.5">
                      <p className="font-bold">¡Animal ya registrado en la campaña actual ({campana})!</p>
                      <p className="text-[11px] text-rose-700">
                        Pertenece a: <strong>{duplicateAnimalInCurrentCampaign.propietario}</strong> · Plaza: <strong>{duplicateAnimalInCurrentCampaign.plazaNumero}</strong> ({duplicateAnimalInCurrentCampaign.nombreAnimal || 'Sin nombre'}). No se permiten duplicados en la misma campaña.
                      </p>
                    </div>
                  </div>
                )}

                {!duplicateAnimalInCurrentCampaign && historicalAnimalMatch && (
                  <div className="text-xs text-emerald-900 bg-emerald-50/80 p-3 rounded-lg border border-emerald-300 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        ¡Animal encontrado en histórico (Campaña {historicalAnimalMatch.campana})!
                      </span>
                      <button
                        type="button"
                        onClick={() => handleLoadHistoricalAnimal(historicalAnimalMatch)}
                        className="text-[11px] font-bold px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded transition shadow-xs"
                      >
                        Recargar Datos
                      </button>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Datos recuperados: <strong>{historicalAnimalMatch.tipo === 'BOVINO' ? (historicalAnimalMatch.identificacion1 || `Plaza ${historicalAnimalMatch.plazaNumero}`) : (historicalAnimalMatch.nombreAnimal || 'Sin nombre')}</strong> ({historicalAnimalMatch.sexo === 'H' ? 'Hembra' : 'Macho'}, {historicalAnimalMatch.capa || 'Capa N/D'}). Propietario anterior: <em>{historicalAnimalMatch.propietario}</em>. El formulario ha sido activado para que pueda revisar o modificar los datos.
                    </p>
                  </div>
                )}

                {!duplicateAnimalInCurrentCampaign && !historicalAnimalMatch && isChipValid && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    {tipo === 'BOVINO' ? 'Crotal' : 'Microchip'} nuevo sin duplicados · Formulario desbloqueado para nuevo registro.
                  </p>
                )}
              </div>

              {/* RESTO DE CAMPOS DEL ANIMAL - BLOQUEADOS HASTA QUE SE VALIDE LA IDENTIFICACIÓN 1 */}
              <fieldset
                disabled={!isAnimalFormUnlocked}
                className={`space-y-4 transition-opacity ${
                  !isAnimalFormUnlocked ? 'opacity-40 pointer-events-none select-none' : ''
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Tipo de Ganado *
                    </label>
                    <div className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 font-bold text-gray-900">
                      {tipo === 'EQUINO' ? '🐎 EQUINO (Yeguas / Caballos)' : '🐂 BOVINO (Vacas / Toros)'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Campaña / Año *
                    </label>
                    <input
                      type="text"
                      disabled={!isAnimalFormUnlocked}
                      value={campana}
                      onChange={(e) => setCampana(e.target.value)}
                      placeholder="ej. 2025-2026"
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Nº Plaza * (ej. {tipo === 'BOVINO' ? 'HIN001' : 'HI001'})
                    </label>
                    {(() => {
                      const clean = plazaNumero.trim().toUpperCase();
                      const isSelfPlaza = Boolean(
                        initialAnimal &&
                        initialAnimal.plazaNumero.trim().toUpperCase() === clean &&
                        initialAnimal.campana === campana
                      );
                      const duplicate = isSelfPlaza
                        ? undefined
                        : existingAnimals.find(
                            (a) =>
                              a.campana === campana &&
                              a.id !== initialAnimal?.id &&
                              !a.esPlazaVacante &&
                              a.plazaNumero.trim().toUpperCase() === clean
                          );
                      const isDuplicate = Boolean(duplicate && clean);

                      return (
                        <>
                          <input
                            type="text"
                            disabled={!isAnimalFormUnlocked}
                            value={plazaNumero}
                            onChange={handlePlazaChange}
                            onBlur={handlePlazaBlur}
                            placeholder={tipo === 'BOVINO' ? 'HIN001' : 'HI001'}
                            className={`w-full text-sm px-3 py-2 border rounded-lg focus:ring-2 font-mono font-bold uppercase transition ${
                              isDuplicate
                                ? 'border-rose-500 bg-rose-50/50 text-rose-900 focus:ring-rose-500'
                                : 'border-gray-300 text-emerald-900 focus:ring-emerald-500'
                            }`}
                            required
                          />
                          {isDuplicate ? (
                            <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1 mt-1">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              ¡Plaza ya utilizada por &quot;{duplicate?.nombreAnimal}&quot;! Debe ser única.
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500 block mt-0.5">
                              Correlativo automático (editable manualmente).
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Propietario row - Solo ganaderos dados de alta en la aplicación */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Ganadero / Propietario Oficial (Dado de alta en la aplicación) *
                  </label>
                  <select
                    disabled={!isAnimalFormUnlocked}
                    value={propietario}
                    onChange={handleSelectOwner}
                    required
                    className="w-full text-xs sm:text-sm px-3 py-2.5 border border-gray-300 rounded-lg bg-white font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Seleccione un ganadero dado de alta en la campaña ({campana}) --</option>
                    {propietario && !campaignOwners.some((o) => o.nombreCompleto.toUpperCase() === propietario.toUpperCase()) && (
                      <option value={propietario}>
                        {propietario} (Actual)
                      </option>
                    )}
                    {campaignOwners.map((owner) => (
                      <option key={owner.id} value={owner.nombreCompleto}>
                        {owner.nombreCompleto} ({owner.dniCif}){owner.codigoRega ? ` · REGA: ${owner.codigoRega}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Control de censo: solo se permite escoger ganaderos dados de alta en la aplicación. No se permite entrada manual.
                  </p>
                </div>

                {/* Identifications: Finca & Identificación 2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Finca
                    </label>
                    <input
                      type="text"
                      disabled={!isAnimalFormUnlocked}
                      value={finca}
                      onChange={(e) => setFinca(e.target.value.toUpperCase())}
                      placeholder="HINOJOS"
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white uppercase font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      {tipo === 'BOVINO'
                        ? 'Identificación 2 (DIIA / Código)'
                        : 'Identificación 2 (UELN / Pasaporte)'}
                    </label>
                    <input
                      type="text"
                      disabled={!isAnimalFormUnlocked}
                      value={identificacion2}
                      onChange={(e) => setIdentificacion2(e.target.value)}
                      placeholder={tipo === 'BOVINO' ? 'ej. 1234567890' : 'ej. 724901000121842'}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-mono text-gray-800"
                    />
                  </div>
                </div>

                {/* Animal Name, Sex, Birth, Coat */}
                <div className={`grid grid-cols-2 ${tipo === 'BOVINO' ? 'sm:grid-cols-3' : 'sm:grid-cols-4'} gap-3`}>
                  {tipo === 'EQUINO' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nombre del Animal *
                      </label>
                      <input
                        type="text"
                        disabled={!isAnimalFormUnlocked}
                        value={nombreAnimal}
                        onChange={(e) => setNombreAnimal(e.target.value.toUpperCase())}
                        placeholder="ej. NIEBLA"
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-bold text-emerald-900 uppercase"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Sexo *
                    </label>
                    <select
                      disabled={!isAnimalFormUnlocked}
                      value={sexo}
                      onChange={(e) => setSexo(e.target.value as 'H' | 'M')}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-semibold"
                    >
                      <option value="H">Hembra (H)</option>
                      <option value="M">Macho (M)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Fecha Nacimiento (FN)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        ref={dateInputRef}
                        type="date"
                        disabled={!isAnimalFormUnlocked}
                        value={toInputDate(fechaNacimiento)}
                        onChange={(e) => {
                          if (e.target.value) {
                            setFechaNacimiento(fromInputDate(e.target.value));
                          } else {
                            setFechaNacimiento('');
                          }
                        }}
                        onClick={(e) => {
                          try {
                            (e.currentTarget as any).showPicker?.();
                          } catch {}
                        }}
                        className="w-full text-sm px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-white font-mono focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                        title="Haz clic para abrir el calendario"
                      />
                      <button
                        type="button"
                        disabled={!isAnimalFormUnlocked}
                        onClick={() => {
                          try {
                            dateInputRef.current?.showPicker?.();
                          } catch {
                            dateInputRef.current?.focus();
                          }
                        }}
                        className="absolute right-2 p-1.5 text-gray-400 hover:text-emerald-700 transition"
                        title="Abrir calendario"
                      >
                        <Calendar className="w-4 h-4 text-emerald-700" />
                      </button>
                    </div>
                    {fechaNacimiento && (
                      <span className="text-[11px] text-emerald-700 font-mono mt-0.5 block">
                        Registrado: {fechaNacimiento}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Capa / Pelaje *
                    </label>
                    <select
                      disabled={!isAnimalFormUnlocked}
                      value={capa}
                      onChange={(e) => setCapa(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-semibold focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      required
                    >
                      <option value="">-- Seleccionar Capa / Pelaje --</option>
                      {capa && !CAPAS_PELAJES.includes(capa) && (
                        <option value={capa}>{capa} (Actual)</option>
                      )}
                      {CAPAS_PELAJES.map((item, idx) => (
                        <option
                          key={`${item}-${idx}`}
                          value={item === '---------' ? '' : item}
                          disabled={item === '---------'}
                          className={item === '---------' ? 'font-bold text-gray-400 text-center tracking-widest' : ''}
                        >
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Revision & Marsh presence */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      FECHA UL RV (Última Revisión / Entrada)
                    </label>
                    <input
                      type="text"
                      disabled={!isAnimalFormUnlocked}
                      value={fechaUltimaRevision}
                      onChange={(e) => setFechaUltimaRevision(e.target.value)}
                      placeholder="ej. 14/05/2026 o ENTRA 26/04/26"
                      className="w-full text-sm px-3 py-2 border border-emerald-300 rounded-lg bg-white font-medium"
                    />
                    <span className="text-[11px] text-gray-500 block mt-1">
                      Última vez revisado por los guardas o anotación como &quot;ENTRA 26/04/26&quot;.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-950 mb-1">
                      Estado Actual en la Marisma
                    </label>
                    <select
                      disabled={!isAnimalFormUnlocked}
                      value={estadoPresencia}
                      onChange={(e) => setEstadoPresencia(e.target.value as any)}
                      className="w-full text-sm px-3 py-2 border border-emerald-300 rounded-lg bg-white font-semibold text-emerald-900"
                    >
                      <option value="DENTRO">🟢 Dentro de la Marisma (Presente)</option>
                      <option value="FUERA">⚪ Fuera de la Marisma (En cuadra / trasladado)</option>
                      <option value="PROGRAMADO_ENTRADA">🔵 Entrada Programada</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* TAB 2: RASTRA (CRÍA AL PIE) */}
          {activeTab === 'RASTRA' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                    <Baby className="w-4 h-4 text-amber-700" />
                    <span>Control de Rastra (Cría de este animal)</span>
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Una rastra es la cría que acompaña al animal principal al pie de la madre en la marisma.
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs bg-white px-3 py-2 rounded-lg border border-amber-300 shadow-xs">
                  <input
                    type="checkbox"
                    checked={hasRastra}
                    onChange={(e) => {
                      setHasRastra(e.target.checked);
                      if (e.target.checked && !rastraPropietario) {
                        setRastraPropietario(propietario);
                      }
                    }}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <span>Tiene Rastra al pie</span>
                </label>
              </div>

              {hasRastra ? (
                <div className="space-y-3 p-4 bg-white border border-gray-200 rounded-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Propietario de la Rastra
                      </label>
                      <input
                        type="text"
                        value={rastraPropietario}
                        onChange={(e) => setRastraPropietario(e.target.value.toUpperCase())}
                        placeholder={propietario || 'NOMBRE DEL PROPIETARIO'}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg uppercase font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Nombre de la Rastra (Cría) *
                      </label>
                      <input
                        type="text"
                        value={rastraNombre}
                        onChange={(e) => setRastraNombre(e.target.value.toUpperCase())}
                        placeholder="ej. DUDOSO, JARDINERO JR..."
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg font-bold text-amber-900 uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        RASTRAS (Microchip / Crotal Rastra)
                      </label>
                      <input
                        type="text"
                        value={rastraChip}
                        onChange={(e) => setRastraChip(e.target.value)}
                        placeholder="ej. 724019010094786"
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono text-gray-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        UELN Rastra
                      </label>
                      <input
                        type="text"
                        value={rastraUeln}
                        onChange={(e) => setRastraUeln(e.target.value)}
                        placeholder="ej. 724901000126052"
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Sexo Rastra
                      </label>
                      <select
                        value={rastraSexo}
                        onChange={(e) => setRastraSexo(e.target.value as 'H' | 'M')}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="H">Hembra (H)</option>
                        <option value="M">Macho (M)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        FN Rastra (Nacimiento)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          ref={rastraDateInputRef}
                          type="date"
                          value={toInputDate(rastraFN)}
                          onChange={(e) => {
                            if (e.target.value) {
                              setRastraFN(fromInputDate(e.target.value));
                            } else {
                              setRastraFN('');
                            }
                          }}
                          onClick={(e) => {
                            try {
                              (e.currentTarget as any).showPicker?.();
                            } catch {}
                          }}
                          className="w-full text-sm px-3 py-2 pr-10 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          title="Haz clic para abrir el calendario"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            try {
                              rastraDateInputRef.current?.showPicker?.();
                            } catch {
                              rastraDateInputRef.current?.focus();
                            }
                          }}
                          className="absolute right-2 p-1.5 text-gray-400 hover:text-emerald-700 transition"
                          title="Abrir calendario"
                        >
                          <Calendar className="w-4 h-4 text-emerald-700" />
                        </button>
                      </div>
                      {rastraFN && (
                        <span className="text-[11px] text-emerald-700 font-mono mt-0.5 block">
                          Registrado: {rastraFN}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Capa Rastra
                      </label>
                      <select
                        value={rastraCapa}
                        onChange={(e) => setRastraCapa(e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg bg-white font-semibold focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Seleccionar Capa Rastra --</option>
                        {rastraCapa && !CAPAS_PELAJES.includes(rastraCapa) && (
                          <option value={rastraCapa}>{rastraCapa} (Actual)</option>
                        )}
                        {CAPAS_PELAJES.map((item, idx) => (
                          <option
                            key={`${item}-${idx}`}
                            value={item === '---------' ? '' : item}
                            disabled={item === '---------'}
                            className={item === '---------' ? 'font-bold text-gray-400 text-center tracking-widest' : ''}
                          >
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        F ENTRD (Fecha Entrada Marisma)
                      </label>
                      <input
                        type="text"
                        value={rastraFechaEntrada}
                        onChange={(e) => setRastraFechaEntrada(e.target.value)}
                        placeholder="DD/MM/AAAA"
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        F SALIDA (Fecha Salida Marisma)
                      </label>
                      <input
                        type="text"
                        value={rastraFechaSalida}
                        onChange={(e) => setRastraFechaSalida(e.target.value)}
                        placeholder="DD/MM/AAAA (o vacío si sigue dentro)"
                        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Observaciones de la Rastra
                    </label>
                    <textarea
                      rows={2}
                      value={rastraObservaciones}
                      onChange={(e) => setRastraObservaciones(e.target.value)}
                      placeholder="Anotaciones sobre la cría, estado sanitario, pendiente de marcaje o chip..."
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500">
                  <Baby className="w-10 h-10 text-gray-400 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold">Este animal no tiene rastra asignada actualmente</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Marca la casilla superior si este animal tiene una cría al pie en la marisma.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DOCUMENTACIÓN ADJUNTA */}
          {activeTab === 'DOCUMENTOS' && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
                <h3 className="text-sm font-bold text-blue-950 flex items-center gap-1.5 mb-1">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <span>Subir Documentos del Animal</span>
                </h3>
                <p className="text-xs text-blue-800">
                  Pasaporte equino DIE, guía sanitaria de traslado, tarjeta de movimiento ganadero, certificado de saneamiento o fotografía del hierro.
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    value={newDocTipo}
                    onChange={(e) => setNewDocTipo(e.target.value as any)}
                    className="text-xs px-3 py-2 bg-white border border-blue-300 rounded-lg font-medium"
                  >
                    <option value="PASAPORTE_DIE">Pasaporte Equino (DIE)</option>
                    <option value="TARJETA_MOVIMIENTO">Tarjeta Movimiento / DIB</option>
                    <option value="GUIA_SANITARIA">Guía Sanitaria de Traslado</option>
                    <option value="CERTIFICADO_SANEAMIENTO">Certificado Saneamiento</option>
                    <option value="FOTO_HIERRO">Fotografía del Hierro / Marca</option>
                    <option value="OTRO">Otro documento</option>
                  </select>

                  <label className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Seleccionar Archivo (PDF, JPG, PNG)</span>
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                  </label>
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-600 mt-2 font-medium">{uploadError}</p>
                )}
              </div>

              {/* Document List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Documentos Registrados ({documentos.length})
                </h4>

                {documentos.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200 text-gray-500">
                    <p className="text-xs font-medium">No hay documentos adjuntos para este animal</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {documentos.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 transition shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                            📄
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900">{doc.nombre}</p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                              <span className="font-semibold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                                {doc.tipo.replace('_', ' ')}
                              </span>
                              <span>· Subido: {doc.fechaSubida}</span>
                              <span>· {doc.tamano}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(doc)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
                            title="Descargar documento"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition"
                            title="Eliminar documento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ANOTACIONES IMPORTANTES / CUADERNO DE CAMPO */}
          {activeTab === 'ANOTACIONES' && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-4 h-4 text-emerald-700" />
                  <span>Añadir Anotación / Cuaderno de Campo</span>
                </h3>
                <p className="text-xs text-emerald-800">
                  Registra observaciones veterinarias, inspecciones de guardería o incidencias específicas sobre este animal.
                </p>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700">Categoría:</span>
                    <select
                      value={newNoteCategoria}
                      onChange={(e) => setNewNoteCategoria(e.target.value as any)}
                      className="text-xs px-2.5 py-1.5 bg-white border border-emerald-300 rounded-lg font-medium"
                    >
                      <option value="REVISION">Revisión Censo</option>
                      <option value="VETERINARIA">Veterinaria / Saneamiento</option>
                      <option value="GUARDERIA">Inspección Guardería</option>
                      <option value="DOCUMENTAL">Documental / Adjudicación</option>
                      <option value="INCIDENCIA">Incidencia en Campo</option>
                      <option value="OTROS">Otros / Observaciones generales</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Escribe aquí la anotación (ej. Revisado chip en cercado norte, pendiente de vacunar la rastra...)"
                      className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddAnnotation}
                      disabled={!newNoteText.trim()}
                      className="px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 self-stretch shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Anotaciones List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Histórico de Anotaciones ({anotaciones.length})
                </h4>

                {anotaciones.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200 text-gray-500">
                    <p className="text-xs font-medium">No hay anotaciones registradas aún</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {anotaciones.map((note) => {
                      const isEditingThis = editingNoteId === note.id;

                      if (isEditingThis) {
                        return (
                          <div
                            key={note.id}
                            className="p-3 bg-amber-50/80 border-2 border-amber-400 rounded-xl space-y-2 shadow-xs transition"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                                  <Pencil className="w-3.5 h-3.5 text-amber-700" />
                                  Modificar Anotación
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  · {note.fecha} ({note.autor})
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={handleSaveEditAnnotation}
                                  disabled={!editingNoteText.trim()}
                                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition"
                                  title="Guardar cambios"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Guardar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditAnnotation}
                                  className="px-2.5 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                                  title="Cancelar edición"
                                >
                                  <X className="w-3.5 h-3.5" />
                                  <span>Cancelar</span>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-700">Categoría:</span>
                              <select
                                value={editingNoteCategoria}
                                onChange={(e) => setEditingNoteCategoria(e.target.value as any)}
                                className="text-xs px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-medium"
                              >
                                <option value="REVISION">Revisión Censo</option>
                                <option value="VETERINARIA">Veterinaria / Saneamiento</option>
                                <option value="GUARDERIA">Inspección Guardería</option>
                                <option value="DOCUMENTAL">Documental / Adjudicación</option>
                                <option value="INCIDENCIA">Incidencia en Campo</option>
                                <option value="OTROS">Otros / Observaciones generales</option>
                              </select>
                            </div>

                            <textarea
                              rows={2}
                              value={editingNoteText}
                              onChange={(e) => setEditingNoteText(e.target.value)}
                              placeholder="Modifica el texto de la anotación..."
                              className="w-full text-xs px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={note.id}
                          className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5 hover:border-emerald-300 transition"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {note.categoria}
                              </span>
                              <span className="text-xs font-semibold text-gray-700">{note.autor}</span>
                              <span className="text-[11px] text-gray-400">· {note.fecha}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditAnnotation(note)}
                                className="text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 p-1 rounded transition"
                                title="Editar anotación"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnotation(note.id)}
                                className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition"
                                title="Eliminar anotación"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-800 leading-relaxed pl-1 whitespace-pre-wrap">{note.texto}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!isAnimalFormUnlocked}
              className={`flex items-center gap-2 px-5 py-2.5 text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition active:scale-95 ${
                !isAnimalFormUnlocked
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                  : 'bg-[#008744] hover:bg-[#00743a]'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Guardar Cambios' : 'Registrar Animal'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
