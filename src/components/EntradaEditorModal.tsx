import React, { useState, useEffect, useMemo } from 'react';
import {
  EntradaRemesa,
  EntradaPersona,
  EntradaAnimal,
  Animal,
  Owner,
  User,
} from '../types/marisma';
import { ApiService } from '../services/apiService';
import { apiClient } from '../services/apiClient';
import { EnviandoEmailModal } from './EnviandoEmailModal';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Users,
  Send,
  Download,
  FileText,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Car,
  Phone,
  Search,
  Paperclip,
  Loader2,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';

interface EntradaEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  remesa: EntradaRemesa | null;
  onSaved: (saved: EntradaRemesa) => void;
  animals: Animal[];
  owners: Owner[];
  activeCampaign: string;
  currentUser: User;
  readOnly?: boolean;
  onAnimalsUpdated?: () => void;
}

export const EntradaEditorModal: React.FC<EntradaEditorModalProps> = ({
  isOpen,
  onClose,
  remesa,
  onSaved,
  animals,
  owners,
  activeCampaign,
  currentUser,
  readOnly: readOnlyProp = false,
  onAnimalsUpdated,
}) => {
  const readOnly = readOnlyProp || currentUser.rol !== 'ADMINISTRADOR';
  // Solo equinos censados de la campaña correspondiente, desduplicados por microchip / plaza
  const equinos = useMemo(() => {
    const targetCamp = remesa?.campana || activeCampaign;
    let list = animals.filter(
      (a) => a.tipo === 'EQUINO' && (!a.campana || a.campana === targetCamp) && !a.esPlazaVacante
    );
    if (list.length === 0) {
      list = animals.filter((a) => a.tipo === 'EQUINO' && !a.esPlazaVacante);
    }
    const map = new Map<string, Animal>();
    for (const a of list) {
      const chip = (a.identificacion1 || '').trim().toUpperCase();
      const plaza = (a.plazaNumero || '').trim().toUpperCase();
      const key = chip || plaza || a.id;
      if (!map.has(key)) {
        map.set(key, a);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.plazaNumero || '').localeCompare(b.plazaNumero || '', undefined, { numeric: true })
    );
  }, [animals, remesa?.campana, activeCampaign]);

  // Ganaderos únicos desduplicados por DNI y nombre normalizado
  const uniqueOwners = useMemo(() => {
    const targetCamp = remesa?.campana || activeCampaign;
    let list = owners.filter((o) => !o.campana || o.campana === targetCamp);
    if (list.length === 0) list = owners;

    const map = new Map<string, Owner>();
    for (const o of list) {
      const normName = (o.nombreCompleto || '')
        .trim()
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

      const normDni = (o.dniCif || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      const key = normDni || normName;
      if (!key) continue;

      const existing = map.get(key);
      if (!existing || (!existing.telefono && o.telefono) || (!existing.dniCif && o.dniCif)) {
        map.set(key, o);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es', { sensitivity: 'base' })
    );
  }, [owners, remesa?.campana, activeCampaign]);

  const [activeTab, setActiveTab] = useState<'DATOS' | 'PREVIEW'>('DATOS');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);

  // Estado del formulario
  const [formData, setFormData] = useState<EntradaRemesa>({
    id: '',
    campana: activeCampaign,
    tipoRemesa: 'ORDINARIA',
    tituloOficial: '',
    fechas: [],
    diasTexto: '',
    estado: 'BORRADOR',
    creadoEn: '',
    actualizadoEn: '',
    personas: [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [sendingModalData, setSendingModalData] = useState<{
    isOpen: boolean;
    status: 'sending' | 'success' | 'error';
    titulo: string;
    recipients?: string[];
    bcc?: string[];
    errorMessage?: string;
    savedRemesa?: EntradaRemesa;
  }>({
    isOpen: false,
    status: 'sending',
    titulo: '',
  });
  const isSending = sendingModalData.isOpen;
  const [uploadingAnimalId, setUploadingAnimalId] = useState<string | null>(null);

  // Buscador de equinos
  const [animalSearchQuery, setAnimalSearchQuery] = useState('');
  const [activePersonaForAnimal, setActivePersonaForAnimal] = useState<string | null>(null);

  // Buscador de ganaderos censados
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [activePersonaForOwner, setActivePersonaForOwner] = useState<string | null>(null);
  const [activeAcompananteVehicleId, setActiveAcompananteVehicleId] = useState<string | null>(null);

  // Carga inicial o reseteo
  useEffect(() => {
    if (isOpen) {
      if (remesa) {
        setFormData({
          ...remesa,
          personas: remesa.personas ? JSON.parse(JSON.stringify(remesa.personas)) : [],
        });
        setSelectedDayIndex(0);
      } else {
        initNewRemesa('MIE_JUE');
      }
      setActiveTab(readOnly ? 'PREVIEW' : 'DATOS');
      setAnimalSearchQuery('');
      setActivePersonaForAnimal(null);
      setOwnerSearchQuery('');
      setActivePersonaForOwner(null);
      setActiveAcompananteVehicleId(null);
    }
  }, [isOpen, remesa]);

  // Asistente de cálculo de fechas próximas
  const getNextDates = (day1Index: number, day2Index: number): [Date, Date] => {
    const now = new Date();
    const d1 = new Date(now);
    const diff1 = (day1Index + 7 - now.getDay()) % 7;
    d1.setDate(now.getDate() + (diff1 === 0 ? 7 : diff1));

    const d2 = new Date(d1);
    const diff2 = (day2Index + 7 - d1.getDay()) % 7;
    d2.setDate(d1.getDate() + (diff2 === 0 ? 1 : diff2));

    return [d1, d2];
  };

  const formatDateYMD = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDateDM = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${m}`;
  };

  const getDayName = (d: Date): string => {
    const names = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    return names[d.getDay()];
  };

  const getMonthName = (monthIdx: number): string => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthIdx];
  };

  const initNewRemesa = (tipo: 'MIE_JUE' | 'SAB_DOM' | 'LIBRE') => {
    let dates: Date[] = [];
    let diasTexto = '';

    if (tipo === 'MIE_JUE') {
      dates = getNextDates(3, 4); // Miércoles = 3, Jueves = 4
      diasTexto = `Miércoles ${dates[0].getDate()} y Jueves ${dates[1].getDate()} de ${getMonthName(dates[0].getMonth())}`;
    } else if (tipo === 'SAB_DOM') {
      dates = getNextDates(6, 0); // Sábado = 6, Domingo = 0
      diasTexto = `Sábado ${dates[0].getDate()} y Domingo ${dates[1].getDate()} de ${getMonthName(dates[0].getMonth())}`;
    } else {
      const today = new Date();
      dates = [today];
      diasTexto = `${getDayName(today)} ${today.getDate()} de ${getMonthName(today.getMonth())}`;
    }

    const fechasStr = dates.map(formatDateYMD);
    const titulo = `PERMISOS PARA EL ${dates.map(formatDateDM).join(' Y ')}`;

    setFormData({
      id: `REM-${Date.now()}`,
      campana: activeCampaign,
      tipoRemesa: tipo === 'LIBRE' ? 'EXTRAORDINARIA' : 'ORDINARIA',
      tituloOficial: titulo,
      fechas: fechasStr,
      diasTexto,
      estado: 'BORRADOR',
      creadoPorUsuarioId: currentUser.id,
      creadoPorNombre: currentUser.nombreCompleto,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      personas: [],
    });
    setSelectedDayIndex(0);
  };

  // Días activos de la remesa
  const activeDays = useMemo(() => {
    return formData.fechas.map((fStr) => {
      const [y, m, d] = fStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return {
        fecha: fStr,
        diaSemana: getDayName(dateObj),
        label: `${getDayName(dateObj)} ${d}/${m}`,
      };
    });
  }, [formData.fechas]);

  const currentDay = activeDays[selectedDayIndex] || activeDays[0];

  // Personas autorizadas del día seleccionado
  const personasDelDia = useMemo(() => {
    if (!currentDay) return [];
    return (formData.personas || []).filter((p) => p.fecha === currentDay.fecha);
  }, [formData.personas, currentDay]);

  const cupoCount = personasDelDia.length;
  const cupoExcedido = cupoCount > 7;

  // Titulares del día seleccionado
  const titularesDelDia = useMemo(() => {
    return personasDelDia.filter((p) => p.esTitular);
  }, [personasDelDia]);

  // Acompañantes asociados a un titular concreto
  const getAcompanantesForTitular = (titularId: string) => {
    return personasDelDia.filter((p) => !p.esTitular && p.titularId === titularId);
  };

  // Validación para evitar duplicados de persona en el mismo día
  const validateDuplicates = (): boolean => {
    for (const d of activeDays) {
      const dayPersons = (formData.personas || []).filter(
        (p) => p.fecha === d.fecha && p.nombreApellidos && p.nombreApellidos.trim().length > 0
      );
      const seen = new Set<string>();
      for (const p of dayPersons) {
        const norm = p.nombreApellidos.trim().toUpperCase();
        if (seen.has(norm)) {
          alert(
            `ADVERTENCIA: La persona "${p.nombreApellidos}" figura registrada más de una vez el día ${d.label}.\n\nNo se permite autorizar a una misma persona varias veces en el mismo día. Por favor, elimine la entrada duplicada antes de continuar.`
          );
          return false;
        }
        seen.add(norm);
      }
    }
    return true;
  };

  // Añadir Titular al día actual
  const handleAddTitular = () => {
    if (!currentDay) return;
    const newPersona: EntradaPersona = {
      id: `per-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      remesaId: formData.id,
      diaSemana: currentDay.diaSemana,
      fecha: currentDay.fecha,
      esTitular: true,
      nombreApellidos: '',
      faena: 'REPASAR',
      finca: 'MARISMA DE HINOJOS',
      matriculas: '',
      telefono: '',
      ordenFila: (formData.personas || []).length,
      animales: [],
    };

    setFormData({
      ...formData,
      personas: [...(formData.personas || []), newPersona],
    });
  };

  // Añadir Acompañante vinculado a un titular
  const handleAddAcompanante = (titular: EntradaPersona) => {
    if (!currentDay) return;
    const newAcompanante: EntradaPersona = {
      id: `per-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      remesaId: formData.id,
      diaSemana: currentDay.diaSemana,
      fecha: currentDay.fecha,
      esTitular: false,
      titularId: titular.id,
      nombreApellidos: '',
      faena: titular.faena,
      finca: 'MARISMA DE HINOJOS',
      matriculas: titular.matriculas,
      telefono: '',
      ordenFila: (formData.personas || []).length,
      animales: [],
    };

    setFormData({
      ...formData,
      personas: [...(formData.personas || []), newAcompanante],
    });
  };

  // Eliminar persona (si es titular elimina también a sus acompañantes)
  const handleRemovePersona = (personaId: string) => {
    setFormData({
      ...formData,
      personas: (formData.personas || []).filter((p) => p.id !== personaId && p.titularId !== personaId),
    });
  };

  // Actualizar campo de persona (si el titular cambia matrícula o faena, sincronizar con acompañantes)
  const handleUpdatePersona = (personaId: string, updates: Partial<EntradaPersona>) => {
    setFormData((prev) => {
      const updatedPersonas = (prev.personas || []).map((p) => {
        if (p.id === personaId) {
          const updated = { ...p, ...updates };
          if (updates.faena === 'REPASAR') {
            updated.animales = [];
          }
          return updated;
        }
        if (p.titularId === personaId) {
          const syncUpdates: Partial<EntradaPersona> = {};
          if (updates.matriculas !== undefined) syncUpdates.matriculas = updates.matriculas;
          if (updates.faena !== undefined) syncUpdates.faena = updates.faena;
          return { ...p, ...syncUpdates };
        }
        return p;
      });
      return { ...prev, personas: updatedPersonas };
    });
  };

  // Autocompletar datos al seleccionar ganadero censado
  const handleSelectOwner = (personaId: string, owner: Owner) => {
    const isDup = (formData.personas || []).some(
      (p) =>
        p.fecha === currentDay?.fecha &&
        p.id !== personaId &&
        p.nombreApellidos.trim().toUpperCase() === owner.nombreCompleto.trim().toUpperCase()
    );
    if (isDup) {
      alert(
        `La persona "${owner.nombreCompleto}" ya figura registrada en este mismo día (${currentDay?.label}).\n\nUna persona no puede registrarse dos veces el mismo día.`
      );
      return;
    }

    handleUpdatePersona(personaId, {
      nombreApellidos: owner.nombreCompleto,
      telefono: owner.telefono || '',
      ownerId: owner.id || null,
    });
  };

  // Añadir Acompañante desde el censo a un vehículo/titular concreto (sin cerrar el buscador)
  const handleAddAcompananteFromOwner = (titular: EntradaPersona, owner: Owner) => {
    // Control de duplicado: verificar si ya está asignado en este mismo día
    const isDup = (formData.personas || []).some(
      (p) =>
        p.fecha === titular.fecha &&
        p.nombreApellidos.trim().toUpperCase() === owner.nombreCompleto.trim().toUpperCase()
    );
    if (isDup) {
      alert(
        `La persona "${owner.nombreCompleto}" ya figura registrada en este mismo día (${currentDay?.label}).\n\nUna persona no puede registrarse dos veces el mismo día.`
      );
      return;
    }

    // Comprobar si ya existe una fila de acompañante vacía para este titular
    const existingEmptyAcomp = (formData.personas || []).find(
      (p) =>
        p.fecha === titular.fecha &&
        p.titularId === titular.id &&
        !p.esTitular &&
        !p.nombreApellidos.trim()
    );

    if (existingEmptyAcomp) {
      handleUpdatePersona(existingEmptyAcomp.id, {
        nombreApellidos: owner.nombreCompleto,
        telefono: owner.telefono || '',
        ownerId: owner.id || null,
      });
    } else {
      const newAcomp: EntradaPersona = {
        id: `per-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        remesaId: formData.id,
        diaSemana: titular.diaSemana,
        fecha: titular.fecha,
        esTitular: false,
        titularId: titular.id,
        nombreApellidos: owner.nombreCompleto,
        ownerId: owner.id || null,
        faena: titular.faena,
        finca: titular.finca,
        matriculas: titular.matriculas || '',
        telefono: owner.telefono || '',
        ordenFila: (formData.personas || []).length + 1,
        animales: [],
      };

      setFormData((prev) => ({
        ...prev,
        personas: [...(prev.personas || []), newAcomp],
      }));
    }
    // NOTA: Para acompañantes, NO cerramos el buscador para permitir seguir añadiendo más acompañantes seguidos
  };

  // Añadir Equino a una persona
  const handleAddAnimalToPersona = (personaId: string, animal: Animal) => {
    const persona = (formData.personas || []).find((p) => p.id === personaId);
    if (!persona) return;

    // Evitar duplicar el mismo animal en la misma persona
    if (persona.animales?.some((a) => a.animalId === animal.id)) {
      return;
    }

    const newAnimal: EntradaAnimal = {
      id: `ani-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      remesaId: formData.id,
      personaEntradaId: personaId,
      animalId: animal.id,
      esManual: false,
      plazaNumero: animal.plazaNumero,
      identificacionChip: animal.identificacion1,
      nombreAnimal: animal.nombreAnimal,
      propietarioNombre: animal.propietario,
      faena: persona.faena === 'RECOGER' ? 'RECOGER' : 'SOLTAR',
    };

    handleUpdatePersona(personaId, {
      animales: [...(persona.animales || []), newAnimal],
    });

    // Si es RECOGER, NO cerramos el listado para permitir marcar varios equinos seguidos
    if (persona.faena === 'RECOGER') {
      // Mantenemos el buscador abierto
    } else {
      setAnimalSearchQuery('');
      setActivePersonaForAnimal(null);
    }
  };

  // Añadir Equino Manual (no censado / excepcional)
  const handleAddManualAnimal = (personaId: string) => {
    const plaza = prompt('Introduzca número de plaza (ej. HI999 o texto explicativo):', 'HI');
    if (!plaza) return;
    const chip = prompt('Introduzca Microchip oficial de 15 dígitos:', '');
    if (!chip) return;

    const persona = (formData.personas || []).find((p) => p.id === personaId);
    if (!persona) return;

    const newAnimal: EntradaAnimal = {
      id: `ani-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      remesaId: formData.id,
      personaEntradaId: personaId,
      animalId: null,
      esManual: true,
      plazaNumero: plaza.trim().toUpperCase(),
      identificacionChip: chip.trim(),
      nombreAnimal: 'No censado',
      faena: persona.faena === 'RECOGER' ? 'RECOGER' : 'SOLTAR',
    };

    handleUpdatePersona(personaId, {
      animales: [...(persona.animales || []), newAnimal],
    });
  };

  // Eliminar equino de la persona
  const handleRemoveAnimal = (personaId: string, animalEntryId: string) => {
    const persona = (formData.personas || []).find((p) => p.id === personaId);
    if (!persona) return;

    handleUpdatePersona(personaId, {
      animales: (persona.animales || []).filter((a) => a.id !== animalEntryId),
    });
  };

  // Subir Guía de Traslado para un equino
  const handleUploadGuia = async (
    personaId: string,
    animalEntry: EntradaAnimal,
    file: File
  ) => {
    setUploadingAnimalId(animalEntry.id);
    try {
      const upData = new FormData();
      upData.append('file', file);
      if (animalEntry.animalId) upData.append('animalId', animalEntry.animalId);
      upData.append('remesaId', formData.id);
      upData.append('personaEntradaId', personaId);
      upData.append('faena', animalEntry.faena);
      upData.append('plazaNumero', animalEntry.plazaNumero);
      upData.append('chip', animalEntry.identificacionChip);

      const res = await ApiService.uploadGuiaTraslado(upData);

      // Actualizar el equino con la guía subida
      const persona = (formData.personas || []).find((p) => p.id === personaId);
      if (persona) {
        const updatedAnimals = (persona.animales || []).map((a) => {
          if (a.id === animalEntry.id) {
            return {
              ...a,
              guiaDocumentoId: res.documentId,
              guiaArchivoUrl: res.documentUrl,
              guiaArchivoNombre: res.documentName,
            };
          }
          return a;
        });
        handleUpdatePersona(personaId, { animales: updatedAnimals });
        onAnimalsUpdated?.();
      }
    } catch (err: any) {
      alert('Error al subir la guía de traslado: ' + err.message);
    } finally {
      setUploadingAnimalId(null);
    }
  };

  // Guardar Borrador
  const handleSave = async (silent = false) => {
    if (!validateDuplicates()) return null;
    setIsSaving(true);
    try {
      const saved = await ApiService.saveEntrada(formData);
      setFormData(saved);
      onSaved(saved);
      if (!silent) {
        alert('Remesa guardada correctamente.');
      }
      return saved;
    } catch (err: any) {
      alert('Error guardando la remesa: ' + err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Descargar ODS directo
  const handleDownloadOds = async () => {
    try {
      const saved = await handleSave(true);
      if (!saved) return;
      const cleanFileName = `${(saved.tituloOficial || 'Permisos_Marisma').replace(/[^\w.-]/g, '_')}.ods`;
      await ApiService.downloadEntradaOds(saved.id, cleanFileName);
    } catch (err: any) {
      alert('Error al descargar el archivo ODS: ' + err.message);
    }
  };

  // Enviar por Correo Electrónico
  const handleSendEmail = async () => {
    if (!validateDuplicates()) return;

    if ((formData.personas || []).length === 0) {
      alert('Debe añadir al menos una persona autorizada antes de enviar el correo.');
      return;
    }

    setSendingModalData({
      isOpen: true,
      status: 'sending',
      titulo: formData.tituloOficial,
    });

    try {
      const saved = await handleSave(true);
      if (!saved) {
        setSendingModalData({ isOpen: false, status: 'sending', titulo: '' });
        return;
      }

      const res = await ApiService.enviarEntradaEmail(saved.id);
      setFormData(res.remesa);
      setSendingModalData({
        isOpen: true,
        status: 'success',
        titulo: res.remesa.tituloOficial,
        recipients: res.sendResult?.recipients || [],
        bcc: res.sendResult?.bcc || [],
        savedRemesa: res.remesa,
      });
    } catch (err: any) {
      setSendingModalData({
        isOpen: true,
        status: 'error',
        titulo: formData.tituloOficial,
        errorMessage: err.message || 'Error al enviar el correo a Doñana',
      });
    }
  };

  // Marcar directamente como ENVIADO (manual / presencial)
  const handleMarkManualSent = async () => {
    if (!validateDuplicates()) return;
    if (
      !confirm(
        '¿Desea marcar esta solicitud directamente como ENVIADA?\n\nEsta opción formaliza la solicitud sin enviar correo electrónico (útil si la comunicación se ha realizado telefónica o presencialmente).'
      )
    ) {
      return;
    }
    setIsSaving(true);
    try {
      const updated: EntradaRemesa = {
        ...formData,
        estado: 'ENVIADO',
        fechaEnvioEmail: new Date().toISOString(),
        destinatariosEmail: 'Comunicación manual / presencial',
        actualizadoEn: new Date().toISOString(),
      };
      const saved = await ApiService.saveEntrada(updated);
      setFormData(saved);
      onSaved(saved);
      onClose();
    } catch (err: any) {
      alert('Error al marcar la remesa como enviada: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Nombres de personas ya asignadas en el día actual (para excluirlas de las sugerencias del censo)
  const personasYaAsignadasEnDia = useMemo(() => {
    const set = new Set<string>();
    for (const p of personasDelDia) {
      if (p.nombreApellidos && p.nombreApellidos.trim()) {
        set.add(p.nombreApellidos.trim().toUpperCase());
      }
    }
    return set;
  }, [personasDelDia]);

  // Animales ya añadidos a la remesa completa (para no volver a sugerirlos)
  const animalesYaAsignados = useMemo(() => {
    const idSet = new Set<string>();
    const plazaSet = new Set<string>();
    for (const p of formData.personas || []) {
      for (const a of p.animales || []) {
        if (a.animalId) idSet.add(a.animalId);
        if (a.plazaNumero) plazaSet.add(a.plazaNumero.trim().toUpperCase());
      }
    }
    return { idSet, plazaSet };
  }, [formData.personas]);

  // Filtrado de equinos en el buscador (excluye los ya añadidos y muestra los primeros si está vacío)
  const filteredEquinos = useMemo(() => {
    const disponibles = equinos.filter(
      (a) =>
        !animalesYaAsignados.idSet.has(a.id) &&
        !animalesYaAsignados.plazaSet.has((a.plazaNumero || '').trim().toUpperCase())
    );

    if (!animalSearchQuery.trim()) {
      return disponibles.slice(0, 10);
    }
    const q = animalSearchQuery.toLowerCase().trim();
    return disponibles
      .filter(
        (a) =>
          a.plazaNumero.toLowerCase().includes(q) ||
          a.identificacion1.toLowerCase().includes(q) ||
          a.nombreAnimal.toLowerCase().includes(q) ||
          a.propietario.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [equinos, animalSearchQuery, animalesYaAsignados]);

  // Filtrado de ganaderos censados en el buscador (excluye los ya asignados ese día)
  const filteredOwners = useMemo(() => {
    const disponibles = uniqueOwners.filter(
      (o) => !personasYaAsignadasEnDia.has((o.nombreCompleto || '').trim().toUpperCase())
    );

    if (!ownerSearchQuery.trim()) {
      return disponibles.slice(0, 10);
    }
    const q = ownerSearchQuery.toLowerCase().trim();
    return disponibles
      .filter(
        (o) =>
          o.nombreCompleto.toLowerCase().includes(q) ||
          (o.dniCif && o.dniCif.toLowerCase().includes(q)) ||
          (o.telefono && o.telefono.includes(q))
      )
      .slice(0, 10);
  }, [uniqueOwners, ownerSearchQuery, personasYaAsignadasEnDia]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full border border-gray-100 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Cabecera */}
        <div className="bg-[#0b5333] text-white px-5 py-3.5 flex items-center justify-between select-none shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-800/90 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">
                  {readOnly
                    ? 'Consulta de Permisos de Entrada'
                    : remesa
                    ? 'Editar Permisos de Entrada'
                    : 'Nueva Solicitud de Entrada a Marisma'}
                </h2>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    formData.estado === 'ENVIANDO'
                      ? 'bg-blue-400 text-blue-950 animate-pulse'
                      : formData.estado === 'ENVIADO'
                      ? 'bg-emerald-400 text-emerald-950'
                      : 'bg-amber-400 text-amber-950'
                  }`}
                >
                  {formData.estado === 'ENVIANDO' && <Loader2 className="w-3 h-3 animate-spin" />}
                  {formData.estado}
                </span>
              </div>
              <p className="text-xs text-emerald-200 truncate max-w-md">
                {formData.diasTexto || formData.tituloOficial}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pestañas Editor / Previsualización */}
            <div className="bg-emerald-900/80 p-0.5 rounded-lg flex text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('DATOS')}
                className={`px-3 py-1.5 rounded-md font-bold transition ${
                  activeTab === 'DATOS' ? 'bg-white text-emerald-900 shadow-xs' : 'text-emerald-200 hover:text-white'
                }`}
              >
                Formulario
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('PREVIEW')}
                className={`px-3 py-1.5 rounded-md font-bold transition ${
                  activeTab === 'PREVIEW' ? 'bg-white text-emerald-900 shadow-xs' : 'text-emerald-200 hover:text-white'
                }`}
              >
                Vista Oficial ODS
              </button>
            </div>

            {readOnly && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-emerald-600/70"
                title="Volver a la consulta de ganadero"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la Consulta</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-800/60 transition cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'DATOS' ? (
            <>
              {/* Selector Rápido de Tipo de Remesa y Título */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-bold text-gray-700">Asistente rápido de fechas:</span>
                    <button
                      type="button"
                      onClick={() => initNewRemesa('MIE_JUE')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-md font-semibold text-gray-800 transition cursor-pointer"
                    >
                      Miércoles y Jueves
                    </button>
                    <button
                      type="button"
                      onClick={() => initNewRemesa('SAB_DOM')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-md font-semibold text-gray-800 transition cursor-pointer"
                    >
                      Sábado y Domingo
                    </button>
                    <button
                      type="button"
                      onClick={() => initNewRemesa('LIBRE')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-md font-semibold text-gray-800 transition cursor-pointer"
                    >
                      Día Extraordinario
                    </button>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Campaña {formData.campana}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Título Oficial en el Archivo ODS
                    </label>
                    <input
                      type="text"
                      value={formData.tituloOficial}
                      onChange={(e) => setFormData({ ...formData, tituloOficial: e.target.value })}
                      className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg font-bold text-gray-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Descripción de Días Autorizados
                    </label>
                    <input
                      type="text"
                      value={formData.diasTexto}
                      onChange={(e) => setFormData({ ...formData, diasTexto: e.target.value })}
                      className="w-full text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              {/* Selector de Pestañas por Día de la Remesa */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2">
                    {activeDays.map((d, idx) => {
                      const countDia = (formData.personas || []).filter((p) => p.fecha === d.fecha).length;
                      return (
                        <button
                          key={d.fecha}
                          type="button"
                          onClick={() => {
                            setSelectedDayIndex(idx);
                            setActivePersonaForAnimal(null);
                            setActivePersonaForOwner(null);
                            setActiveAcompananteVehicleId(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            selectedDayIndex === idx
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{d.label}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                              selectedDayIndex === idx
                                ? 'bg-emerald-900 text-emerald-100'
                                : 'bg-gray-300 text-gray-800'
                            }`}
                          >
                            {countDia}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Indicador de Cupo Diario */}
                  <div
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-lg border ${
                      cupoExcedido
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    }`}
                  >
                    {cupoExcedido ? (
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Users className="w-4 h-4 text-emerald-700" />
                    )}
                    <span>
                      Cupo: {cupoCount} / 7 personas {cupoExcedido && '(Excepcional)'}
                    </span>
                  </div>
                </div>

                {/* Lista de Personas del Día (Agrupadas por Vehículo / Titular y Acompañantes) */}
                <div className="space-y-4">
                  {titularesDelDia.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 border border-dashed border-gray-300 rounded-xl space-y-2">
                      <Users className="w-8 h-8 mx-auto text-gray-400" />
                      <p className="text-xs font-bold text-gray-600">
                        No hay vehículos ni personas registradas para {currentDay?.label}
                      </p>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={handleAddTitular}
                          className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Añadir Primer Titular</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    titularesDelDia.map((titular, tIdx) => {
                      const acompanantes = getAcompanantesForTitular(titular.id);
                      const requiresAnimals = titular.faena === 'SOLTAR' || titular.faena === 'RECOGER';

                      return (
                        <div
                          key={titular.id}
                          className="rounded-2xl border border-gray-300 bg-white shadow-xs p-4 space-y-3.5 transition"
                        >
                          {/* Cabecera del Vehículo / Titular */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-gray-100">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[11px] font-black uppercase px-2.5 py-1 rounded-md bg-emerald-800 text-white tracking-wide flex items-center gap-1">
                                <Car className="w-3.5 h-3.5" />
                                <span>Vehículo #{tIdx + 1} (Titular)</span>
                              </span>

                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] font-bold text-gray-500">Faena:</label>
                                <select
                                  disabled={readOnly}
                                  value={titular.faena}
                                  onChange={(e) => handleUpdatePersona(titular.id, { faena: e.target.value })}
                                  className="text-xs font-bold bg-white border border-gray-300 rounded-md px-2 py-1 text-gray-800 focus:ring-1 focus:ring-emerald-600 disabled:bg-gray-50"
                                >
                                  <option value="REPASAR">REPASAR (Revisión)</option>
                                  <option value="SOLTAR">SOLTAR (Entrada de ganado)</option>
                                  <option value="RECOGER">RECOGER (Salida de ganado)</option>
                                  <option value="SANEAMIENTO">SANEAMIENTO</option>
                                  <option value="OTRO">OTRA FAENA</option>
                                </select>
                              </div>
                            </div>

                            {!readOnly && (
                              <button
                                type="button"
                                onClick={() => handleRemovePersona(titular.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer flex items-center gap-1 text-xs"
                                title="Eliminar este titular y sus acompañantes"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-bold">Eliminar Vehículo</span>
                              </button>
                            )}
                          </div>

                          {/* Datos del Titular: Nombre, Matrículas, Teléfono */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            {/* Nombre y apellidos */}
                            <div className="sm:col-span-5">
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="block text-[10px] font-black text-gray-500 uppercase">
                                  Nombre y Apellidos Titular
                                </label>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActivePersonaForOwner(
                                        activePersonaForOwner === titular.id ? null : titular.id
                                      );
                                      setOwnerSearchQuery('');
                                    }}
                                    className="text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                                    title="Buscar en el censo oficial de ganaderos"
                                  >
                                    <Search className="w-2.5 h-2.5" />
                                    <span>Buscar en Censo</span>
                                  </button>
                                )}
                              </div>
                              <input
                                type="text"
                                disabled={readOnly}
                                value={titular.nombreApellidos}
                                onChange={(e) => handleUpdatePersona(titular.id, { nombreApellidos: e.target.value })}
                                placeholder="Escriba o busque en el censo..."
                                className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 font-medium disabled:bg-gray-50"
                                required
                              />
                            </div>

                            {/* Matrículas */}
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-black text-gray-500 uppercase mb-0.5 flex items-center gap-1">
                                <Car className="w-3 h-3" />
                                <span>Matrículas del Vehículo</span>
                              </label>
                              <input
                                type="text"
                                disabled={readOnly}
                                value={titular.matriculas || ''}
                                onChange={(e) => handleUpdatePersona(titular.id, { matriculas: e.target.value })}
                                placeholder="1633HRP 1030HLX"
                                className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 font-mono disabled:bg-gray-50"
                              />
                            </div>

                            {/* Teléfono */}
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] font-black text-gray-500 uppercase mb-0.5 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                <span>Teléfono Titular</span>
                              </label>
                              <input
                                type="text"
                                disabled={readOnly}
                                value={titular.telefono || ''}
                                onChange={(e) => handleUpdatePersona(titular.id, { telefono: e.target.value })}
                                placeholder="600112233"
                                className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-50"
                              />
                            </div>
                          </div>

                          {/* Buscador Desplegable de Ganaderos para Titular */}
                          {activePersonaForOwner === titular.id && (
                            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Seleccionar Ganadero Censado para Titular</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActivePersonaForOwner(null);
                                    setOwnerSearchQuery('');
                                  }}
                                  className="p-1 text-gray-400 hover:text-gray-700 rounded-md transition cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="relative">
                                <Search className="w-4 h-4 text-emerald-700 absolute left-2.5 top-2" />
                                <input
                                  type="text"
                                  autoFocus
                                  value={ownerSearchQuery}
                                  onChange={(e) => setOwnerSearchQuery(e.target.value)}
                                  placeholder="Buscar por Nombre, Apellidos o DNI..."
                                  className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                                />
                              </div>

                              {filteredOwners.length > 0 ? (
                                <div className="space-y-1">
                                  {!ownerSearchQuery.trim() && (
                                    <p className="text-[11px] text-emerald-800 font-semibold italic px-1">
                                      Ganaderos censados (primeros resultados · escriba para filtrar por nombre o DNI):
                                    </p>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pt-1">
                                    {filteredOwners.map((owner) => (
                                      <button
                                        key={owner.id}
                                        type="button"
                                        onClick={() => {
                                          handleSelectOwner(titular.id, owner);
                                          setActivePersonaForOwner(null);
                                          setOwnerSearchQuery('');
                                        }}
                                        className="p-2 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-left transition flex items-center justify-between cursor-pointer group"
                                      >
                                        <div>
                                          <p className="text-xs font-bold text-emerald-950 group-hover:text-emerald-900">
                                            {owner.nombreCompleto}
                                          </p>
                                          <p className="text-[10px] text-gray-500 font-mono">
                                            {owner.dniCif ? `DNI: ${owner.dniCif}` : ''}
                                            {owner.telefono ? ` · Tel: ${owner.telefono}` : ''}
                                          </p>
                                        </div>
                                        <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : ownerSearchQuery.trim() ? (
                                <div className="p-2 text-center text-xs text-gray-500 space-y-1">
                                  <p className="italic">No se encontró ningún ganadero en el censo con ese criterio.</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdatePersona(titular.id, { nombreApellidos: ownerSearchQuery.trim() });
                                      setActivePersonaForOwner(null);
                                      setOwnerSearchQuery('');
                                    }}
                                    className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                                  >
                                    Usar "{ownerSearchQuery.trim()}" como nombre
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[11px] text-emerald-800 italic">
                                  Escriba el nombre, apellidos o DNI para filtrar la lista de ganaderos censados.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Sub-bloque de Equinos para SOLTAR / RECOGER */}
                          {requiresAnimals && (
                            <div className="pt-2 border-t border-gray-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                                  <span>🐎</span>
                                  <span>
                                    Equinos a {titular.faena === 'RECOGER' ? 'Recoger' : 'Soltar'} (
                                    {titular.animales?.length || 0})
                                  </span>
                                </span>

                                {!readOnly && (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePersonaForAnimal(
                                          activePersonaForAnimal === titular.id ? null : titular.id
                                        );
                                        setAnimalSearchQuery('');
                                      }}
                                      className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Search className="w-3 h-3" />
                                      <span>Buscar en Censo</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleAddManualAnimal(titular.id)}
                                      className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md transition cursor-pointer"
                                      title="Añadir equino no registrado en la base de datos"
                                    >
                                      + No censado
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Desplegable Buscador de Equinos */}
                              {activePersonaForAnimal === titular.id && (
                                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                                      <span>🐎</span>
                                      <span>
                                        {titular.faena === 'RECOGER'
                                          ? 'Seleccionar Equinos a Recoger (puede marcar varios sin cerrar)'
                                          : 'Seleccionar Equino a Soltar'}
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActivePersonaForAnimal(null);
                                        setAnimalSearchQuery('');
                                      }}
                                      className="px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:text-gray-900 bg-gray-200 hover:bg-gray-300 rounded transition cursor-pointer flex items-center gap-1"
                                      title="Cerrar buscador de equinos"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Cerrar</span>
                                    </button>
                                  </div>

                                  <div className="relative">
                                    <Search className="w-4 h-4 text-emerald-700 absolute left-2.5 top-2" />
                                    <input
                                      type="text"
                                      autoFocus
                                      value={animalSearchQuery}
                                      onChange={(e) => setAnimalSearchQuery(e.target.value)}
                                      placeholder="Buscar por Plaza (HIxxx), Microchip o Nombre de caballo..."
                                      className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                                    />
                                  </div>

                                  {filteredEquinos.length > 0 ? (
                                    <div className="space-y-1">
                                      {!animalSearchQuery.trim() && (
                                        <p className="text-[11px] text-emerald-800 font-semibold italic px-1">
                                          Equinos censados (primeros resultados · escriba para filtrar por plaza o microchip):
                                        </p>
                                      )}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pt-1">
                                        {filteredEquinos.map((eq) => (
                                          <button
                                            key={eq.id}
                                            type="button"
                                            onClick={() => handleAddAnimalToPersona(titular.id, eq)}
                                            className="p-2 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-left transition flex items-center justify-between cursor-pointer"
                                          >
                                            <div>
                                              <p className="text-xs font-bold text-emerald-950">
                                                {eq.plazaNumero} · {eq.nombreAnimal || 'Sin nombre'}
                                              </p>
                                              <p className="text-[10px] text-gray-500 font-mono">
                                                {eq.identificacion1} · {eq.propietario}
                                              </p>
                                            </div>
                                            <Plus className="w-4 h-4 text-emerald-700" />
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : animalSearchQuery.trim() ? (
                                    <p className="text-xs text-gray-500 italic p-1">
                                      No se encontraron equinos censados con ese criterio.
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-emerald-800 italic">
                                      Escriba el número de plaza (ej. HI001) o microchip para seleccionarlo.
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Lista de Equinos seleccionados */}
                              {titular.animales && titular.animales.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  {titular.animales.map((ani) => (
                                    <div
                                      key={ani.id}
                                      className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-2"
                                    >
                                      <div className="truncate">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-xs text-gray-900">
                                            {ani.plazaNumero}
                                          </span>
                                          {ani.nombreAnimal && (
                                            <span className="text-xs text-gray-600 truncate">
                                              · {ani.nombreAnimal}
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 font-mono">
                                          Chip: {ani.identificacionChip}
                                        </p>

                                        {/* Estado de Guía de Traslado */}
                                        <div className="pt-1">
                                          {ani.guiaArchivoUrl ? (
                                            <a
                                              href={apiClient.getAuthenticatedUrl(ani.guiaArchivoUrl)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900"
                                            >
                                              <Paperclip className="w-3 h-3" />
                                              <span className="truncate max-w-[120px]">
                                                {ani.guiaArchivoNombre || 'Guía Adjunta'}
                                              </span>
                                            </a>
                                          ) : !readOnly ? (
                                            <label className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 cursor-pointer">
                                              <Upload className="w-3 h-3" />
                                              <span>
                                                {uploadingAnimalId === ani.id
                                                  ? 'Subiendo...'
                                                  : '+ Adjuntar Guía'}
                                              </span>
                                              <input
                                                type="file"
                                                accept=".pdf,image/png,image/jpeg"
                                                disabled={uploadingAnimalId === ani.id}
                                                className="hidden"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) handleUploadGuia(titular.id, ani, file);
                                                }}
                                              />
                                            </label>
                                          ) : (
                                            <span className="text-[10px] text-gray-400 italic">Sin guía adjunta</span>
                                          )}
                                        </div>
                                      </div>

                                      {!readOnly && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAnimal(titular.id, ani.id)}
                                          className="p-1 text-gray-400 hover:text-rose-600 rounded transition"
                                          title="Quitar equino"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-bloque de Acompañantes en este Vehículo */}
                          <div className="mt-3 pt-3 border-t border-emerald-100 bg-emerald-50/40 rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Acompañantes en este vehículo ({acompanantes.length})</span>
                              </span>
                              {!readOnly && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAcompananteVehicleId(
                                        activeAcompananteVehicleId === titular.id ? null : titular.id
                                      );
                                      setOwnerSearchQuery('');
                                    }}
                                    className="text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Buscar en el censo y marcar varios acompañantes seguidos sin cerrar el listado"
                                  >
                                    <Search className="w-3 h-3 text-emerald-700" />
                                    <span>Buscar en Censo</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAddAcompanante(titular)}
                                    className="text-[11px] font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 px-2.5 py-1 rounded-lg transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                    title="Añadir fila de acompañante no censado manualmente"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Manual</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Buscador Desplegable para Acompañantes (multiselección continua sin cierre) */}
                            {activeAcompananteVehicleId === titular.id && (
                              <div className="p-3 bg-white border border-emerald-300 rounded-xl space-y-2 shadow-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Seleccionar Acompañantes del Censo (puede marcar varios sin cerrar)</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveAcompananteVehicleId(null);
                                      setOwnerSearchQuery('');
                                    }}
                                    className="px-2 py-0.5 text-[10px] font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition cursor-pointer flex items-center gap-1"
                                    title="Cerrar buscador de acompañantes"
                                  >
                                    <X className="w-3 h-3" />
                                    <span>Cerrar</span>
                                  </button>
                                </div>

                                <div className="relative">
                                  <Search className="w-4 h-4 text-emerald-700 absolute left-2.5 top-2" />
                                  <input
                                    type="text"
                                    autoFocus
                                    value={ownerSearchQuery}
                                    onChange={(e) => setOwnerSearchQuery(e.target.value)}
                                    placeholder="Buscar por Nombre, Apellidos o DNI..."
                                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-600"
                                  />
                                </div>

                                {filteredOwners.length > 0 ? (
                                  <div className="space-y-1">
                                    {!ownerSearchQuery.trim() && (
                                      <p className="text-[11px] text-emerald-800 font-semibold italic px-1">
                                        Ganaderos censados (primeros resultados · pulse para añadir a este vehículo):
                                      </p>
                                    )}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pt-1">
                                      {filteredOwners.map((owner) => (
                                        <button
                                          key={owner.id}
                                          type="button"
                                          onClick={() => handleAddAcompananteFromOwner(titular, owner)}
                                          className="p-2 bg-white hover:bg-emerald-100 border border-emerald-200 rounded-lg text-left transition flex items-center justify-between cursor-pointer group"
                                        >
                                          <div>
                                            <p className="text-xs font-bold text-emerald-950 group-hover:text-emerald-900">
                                              {owner.nombreCompleto}
                                            </p>
                                            <p className="text-[10px] text-gray-500 font-mono">
                                              {owner.dniCif ? `DNI: ${owner.dniCif}` : ''}
                                              {owner.telefono ? ` · Tel: ${owner.telefono}` : ''}
                                            </p>
                                          </div>
                                          <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : ownerSearchQuery.trim() ? (
                                  <div className="p-2 text-center text-xs text-gray-500 space-y-1">
                                    <p className="italic">No se encontró ningún ganadero en el censo con ese criterio.</p>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleAddAcompanante(titular);
                                        setFormData((prev) => {
                                          const personas = [...(prev.personas || [])];
                                          const last = personas[personas.length - 1];
                                          if (last) {
                                            last.nombreApellidos = ownerSearchQuery.trim();
                                          }
                                          return { ...prev, personas };
                                        });
                                        setOwnerSearchQuery('');
                                      }}
                                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                                    >
                                      Añadir "{ownerSearchQuery.trim()}" como acompañante
                                    </button>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-emerald-800 italic">
                                    Escriba el nombre, apellidos o DNI para filtrar y seleccionar acompañantes.
                                  </p>
                                )}
                              </div>
                            )}

                            {acompanantes.length === 0 ? (
                              <p className="text-[11px] text-gray-500 italic pl-1">
                                No viajan acompañantes en este vehículo.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {acompanantes.map((acomp, aIdx) => (
                                  <div
                                    key={acomp.id}
                                    className="bg-white border border-emerald-200/90 rounded-xl p-3 space-y-2 shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                                          <span>↳</span> Acompañante #{aIdx + 1}
                                        </span>
                                        <span className="text-[10px] text-gray-500 font-mono">
                                          Matrícula: {titular.matriculas || '“ Compartida con titular'}
                                        </span>
                                      </div>

                                      {!readOnly && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemovePersona(acomp.id)}
                                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                          title="Eliminar acompañante"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                                      <div className="sm:col-span-8">
                                        <div className="flex items-center justify-between mb-0.5">
                                          <label className="block text-[10px] font-bold text-gray-500 uppercase">
                                            Nombre y Apellidos Acompañante
                                          </label>
                                          {!readOnly && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveAcompananteVehicleId(
                                                  activeAcompananteVehicleId === titular.id ? null : titular.id
                                                );
                                                setOwnerSearchQuery('');
                                              }}
                                              className="text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                                              title="Buscar en el censo para este vehículo"
                                            >
                                              <Search className="w-2.5 h-2.5" />
                                              <span>Buscar en Censo</span>
                                            </button>
                                          )}
                                        </div>
                                        <input
                                          type="text"
                                          disabled={readOnly}
                                          value={acomp.nombreApellidos}
                                          onChange={(e) => handleUpdatePersona(acomp.id, { nombreApellidos: e.target.value })}
                                          placeholder="Nombre y apellidos del acompañante..."
                                          className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 font-medium disabled:bg-gray-50"
                                          required
                                        />
                                      </div>

                                      <div className="sm:col-span-4">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-0.5">
                                          Teléfono
                                        </label>
                                        <input
                                          type="text"
                                          disabled={readOnly}
                                          value={acomp.telefono || ''}
                                          onChange={(e) => handleUpdatePersona(acomp.id, { telefono: e.target.value })}
                                          placeholder="600112233"
                                          className="w-full text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 disabled:bg-gray-50"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {titularesDelDia.length > 0 && !readOnly && (
                    <button
                      type="button"
                      onClick={handleAddTitular}
                      className="w-full py-2.5 bg-gray-50 hover:bg-emerald-50 text-emerald-800 border border-dashed border-gray-300 hover:border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Añadir Otro Vehículo / Titular a {currentDay?.label}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Vista Previa Oficial ODS */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-800">
                    Previsualización Exacta del Documento Oficial
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadOds}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar .ODS</span>
                </button>
              </div>

              {/* Tabla estética idéntica al ODS */}
              <div className="border border-gray-300 rounded-xl overflow-hidden shadow-xs">
                {/* Cabecera del Documento */}
                <div className="bg-[#f2f2f2] p-3 text-center border-b border-gray-300">
                  <span className="font-bold text-sm text-gray-900 tracking-wide uppercase">
                    {formData.tituloOficial || 'PERMISOS PARA EL ACCESO A LA MARISMA'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#e6e6e6] text-gray-800 font-bold border-b border-gray-300 text-[11px]">
                      <tr>
                        <th className="p-2 border-r border-gray-300">DIA ENTRADA</th>
                        <th className="p-2 border-r border-gray-300">NOMBRE Y APELLIDOS</th>
                        <th className="p-2 border-r border-gray-300 text-center">FAENA</th>
                        <th className="p-2 border-r border-gray-300">FINCA</th>
                        <th className="p-2 border-r border-gray-300 font-mono">MATRICULAS</th>
                        <th className="p-2 border-r border-gray-300">TELEFONO</th>
                        <th className="p-2 font-mono">OBSERVACIONES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(formData.personas || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-400 italic">
                            No hay personas asignadas en la remesa.
                          </td>
                        </tr>
                      ) : (
                        (formData.personas || []).map((p) => {
                          const faenaStr = p.esTitular ? p.faena.toUpperCase() : '“';
                          const matriculasStr = p.esTitular ? p.matriculas || '' : '“';
                          const telefonoStr = p.esTitular ? p.telefono || '' : '“';
                          const obsStr = p.esTitular
                            ? (p.animales || [])
                                .map((a) => `${a.plazaNumero} (${a.identificacionChip})`)
                                .join(' + ') || (p.faena === 'REPASAR' ? '' : p.observacionesRaw || '')
                            : '“';

                          return (
                            <tr key={p.id} className="hover:bg-gray-50/80">
                              <td className="p-2 font-bold border-r border-gray-200">{p.diaSemana}</td>
                              <td className="p-2 border-r border-gray-200 font-medium">
                                {p.nombreApellidos || '—'}
                              </td>
                              <td className="p-2 text-center border-r border-gray-200 font-bold">
                                {faenaStr}
                              </td>
                              <td className="p-2 border-r border-gray-200">MARISMA DE HINOJOS</td>
                              <td className="p-2 border-r border-gray-200 font-mono text-[11px]">
                                {matriculasStr}
                              </td>
                              <td className="p-2 border-r border-gray-200">{telefonoStr}</td>
                              <td className="p-2 font-mono text-[11px] text-gray-700">{obsStr}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Acciones */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">
              Total autorizaciones: <strong>{(formData.personas || []).length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {readOnly && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la Consulta</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadOds}
              disabled={isSaving || isSending}
              className="px-3.5 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Descargar .ODS</span>
            </button>

            {!readOnly && (
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving || isSending || formData.estado === 'ENVIANDO'}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Guardar Borrador</span>
              </button>
            )}

            {!readOnly && formData.estado === 'BORRADOR' && (
              <button
                type="button"
                onClick={handleMarkManualSent}
                disabled={isSaving || isSending}
                className="px-3.5 py-2 bg-amber-50 hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                title="Marcar solicitud formalmente como ENVIADA (sin enviar correo)"
              >
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Marcar como Enviado</span>
              </button>
            )}

            {!readOnly && (
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={isSaving || sendingModalData.isOpen || formData.estado === 'ENVIANDO'}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
              >
                {sendingModalData.isOpen || formData.estado === 'ENVIANDO' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando a Doñana...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Enviar por Correo a Doñana</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal oficial de envío de entradas */}
      <EnviandoEmailModal
        isOpen={sendingModalData.isOpen}
        status={sendingModalData.status}
        tituloOficial={sendingModalData.titulo}
        recipients={sendingModalData.recipients}
        bcc={sendingModalData.bcc}
        errorMessage={sendingModalData.errorMessage}
        onClose={() => {
          const wasSuccess = sendingModalData.status === 'success';
          const updated = sendingModalData.savedRemesa;
          setSendingModalData({ isOpen: false, status: 'sending', titulo: '' });
          if (wasSuccess && updated) {
            onSaved(updated);
            onClose();
          }
        }}
      />
    </div>
  );
};
