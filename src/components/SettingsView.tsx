import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Calendar,
  Download,
  Upload,
  RefreshCw,
  Plus,
  CheckCircle2,
  FileSpreadsheet,
  BarChart3,
  Users,
  Award,
  TrendingUp,
  AlertTriangle,
  Baby,
  UserCheck,
  Check,
  Sliders,
  Edit2,
  Trash2,
  Building2,
  X,
  Sparkles,
  ShieldCheck,
  Database,
} from 'lucide-react';
import { Animal, Owner, Stallion, Movement, User, Association } from '../types/marisma';
import { StorageService } from '../services/storageService';
import { ApiService } from '../services/apiService';
import { UsersView } from './UsersView';
import { AuditView } from './AuditView';
import { BackupView } from './BackupView';

interface SettingsViewProps {
  campaigns: string[];
  activeCampaign: string;
  onAddCampaign: (campaign: string, cloneFrom?: string, selectedOwners?: Owner[]) => void;
  onUpdateCampaign?: (oldName: string, newName: string) => void;
  onDeleteCampaign?: (campaign: string) => void;
  onSetActiveCampaign: (campaign: string) => void;
  onReloadAllData: () => void;
  animals: Animal[];
  owners: Owner[];
  associations?: Association[];
  stallions: Stallion[];
  movements: Movement[];
  users: User[];
  currentUser: User;
  onSaveUser: (user: User & { password?: string }) => void;
  onDeleteUser: (userId: string) => void;
  onSelectUserToLogin: (user: User) => void;
  onOpenNewCampaignWizard?: (initialName?: string) => void;
}

export type SettingsSection = 'ESTADISTICAS' | 'CAMPANAS' | 'USUARIOS' | 'AUDITORIA' | 'COPIA_SEGURIDAD' | 'CAMPANAS_BACKUP';

export const SettingsView: React.FC<SettingsViewProps> = ({
  campaigns,
  activeCampaign,
  onAddCampaign,
  onUpdateCampaign,
  onDeleteCampaign,
  onSetActiveCampaign,
  onReloadAllData,
  animals,
  owners,
  associations = [],
  stallions,
  movements,
  users,
  currentUser,
  onSaveUser,
  onDeleteUser,
  onSelectUserToLogin,
  onOpenNewCampaignWizard,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(() => {
    // Si el usuario no es ADMINISTRADOR, JAMÁS debe abrir en secciones administrativas
    if (currentUser.rol !== 'ADMINISTRADOR') {
      return 'ESTADISTICAS';
    }
    try {
      const saved = localStorage.getItem('marisma_settings_section') as SettingsSection | null;
      if (saved && ['ESTADISTICAS', 'CAMPANAS', 'USUARIOS', 'AUDITORIA', 'COPIA_SEGURIDAD', 'CAMPANAS_BACKUP'].includes(saved)) {
        return saved === 'CAMPANAS_BACKUP' ? 'CAMPANAS' : saved;
      }
    } catch {}
    return 'ESTADISTICAS';
  });

  // Si el usuario cambia o su rol no es ADMINISTRADOR, asegurar que se redirija inmediatamente a ESTADISTICAS
  useEffect(() => {
    if (currentUser.rol !== 'ADMINISTRADOR' && activeSection !== 'ESTADISTICAS') {
      setActiveSection('ESTADISTICAS');
      try {
        localStorage.setItem('marisma_settings_section', 'ESTADISTICAS');
      } catch {}
    }
  }, [currentUser.rol, activeSection]);

  const handleSelectSection = (sec: SettingsSection) => {
    setActiveSection(sec);
    try {
      localStorage.setItem('marisma_settings_section', sec);
    } catch {}
  };
  const [newCampaignName, setNewCampaignName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [statsCampaign, setStatsCampaign] = useState<string>(activeCampaign);

  useEffect(() => {
    if (!campaigns.includes(statsCampaign) && campaigns.length > 0) {
      setStatsCampaign(activeCampaign && campaigns.includes(activeCampaign) ? activeCampaign : campaigns[campaigns.length - 1]);
    }
  }, [campaigns, activeCampaign, statsCampaign]);

  // Asistente de creación de campaña con traspaso de socios
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardSourceCampaign, setWizardSourceCampaign] = useState<string>(activeCampaign);
  const [wizardSelectedOwners, setWizardSelectedOwners] = useState<Map<string, { selected: boolean; asociacion: string }>>(new Map());

  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [editingCampaignNewName, setEditingCampaignNewName] = useState('');

  const handleStartEditCampaign = (camp: string) => {
    setEditingCampaign(camp);
    setEditingCampaignNewName(camp);
  };

  const handleSaveEditCampaign = async () => {
    if (!editingCampaign || !editingCampaignNewName.trim() || !onUpdateCampaign) return;
    const clean = editingCampaignNewName.trim();
    if (clean === editingCampaign) {
      setEditingCampaign(null);
      return;
    }
    onUpdateCampaign(editingCampaign, clean);
    setEditingCampaign(null);
  };

  const handleDeleteCampaignPrompt = (camp: string) => {
    if (!onDeleteCampaign) return;
    const countAnimals = animals.filter((a) => a.campana === camp).length;
    const countStallions = stallions.filter((s) => s.campana === camp).length;

    const confirmMsg =
      `⚠️ ATENCIÓN: ACCIÓN IRREVERSIBLE\n\n` +
      `¿Está completamente seguro de eliminar la campaña "${camp}"?\n\n` +
      `Al eliminar esta campaña, se BORRARÁN PERMANENTEMENTE de la base de datos:\n` +
      `• ${countAnimals} animales censados/plazas de esta campaña\n` +
      `• ${countStallions} sementales autorizados\n` +
      `• Todos los movimientos históricos asociados a estos animales\n\n` +
      `¿Desea proceder con la eliminación definitiva?`;

    if (window.confirm(confirmMsg)) {
      onDeleteCampaign(camp);
    }
  };

  // Filter animals by selected stats campaign
  const campaignAnimals = useMemo(() => {
    return animals.filter((a) => a.campana === statsCampaign);
  }, [animals, statsCampaign]);

  // General Statistics Calculation based on Hinojos municipal rules:
  // - Plazas Municipales: Cupo oficial asignado de la campaña (Equinas y Bovinas), ocupadas vs vacantes/libres.
  // - Carga Ganadera en Campo: Animales reales pastando (Titulares dentro + Rastras al pie + Sementales autorizados).
  // - REGLA TÉCNICA CLAVE: Ni las rastras ni los sementales computan ni descuentan plazas del cupo oficial.
  const stats = useMemo(() => {
    // 1. Auditoría Oficial de Plazas de la Campaña
    const totalPlazas = campaignAnimals.length;
    const plazasEquinas = campaignAnimals.filter((a) => a.tipo === 'EQUINO').length;
    const plazasBovinas = campaignAnimals.filter((a) => a.tipo === 'BOVINO').length;

    const plazasLibres = campaignAnimals.filter(
      (a) => a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE'
    ).length;
    const plazasLibresEquinas = campaignAnimals.filter(
      (a) => a.tipo === 'EQUINO' && (a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE')
    ).length;
    const plazasLibresBovinas = campaignAnimals.filter(
      (a) => a.tipo === 'BOVINO' && (a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE')
    ).length;

    const plazasOcupadas = campaignAnimals.filter(
      (a) => !a.esPlazaVacante && a.estadoPresencia !== 'PLAZA_VACANTE'
    ).length;
    const plazasOcupadasEquinas = campaignAnimals.filter(
      (a) => a.tipo === 'EQUINO' && !a.esPlazaVacante && a.estadoPresencia !== 'PLAZA_VACANTE'
    ).length;
    const plazasOcupadasBovinas = campaignAnimals.filter(
      (a) => a.tipo === 'BOVINO' && !a.esPlazaVacante && a.estadoPresencia !== 'PLAZA_VACANTE'
    ).length;
    const porcentajeOcupacion = totalPlazas > 0 ? Math.round((plazasOcupadas / totalPlazas) * 100) : 0;

    // 2. Presencia Física de Animales Titulares con Plaza
    const titularesDentro = campaignAnimals.filter(
      (a) => a.estadoPresencia === 'DENTRO' && !a.esPlazaVacante
    ).length;
    const titularesEquinosDentro = campaignAnimals.filter(
      (a) => a.tipo === 'EQUINO' && a.estadoPresencia === 'DENTRO' && !a.esPlazaVacante
    ).length;
    const titularesBovinosDentro = campaignAnimals.filter(
      (a) => a.tipo === 'BOVINO' && a.estadoPresencia === 'DENTRO' && !a.esPlazaVacante
    ).length;

    const fueraTemporal = campaignAnimals.filter(
      (a) => a.estadoPresencia === 'FUERA' && !a.esPlazaVacante
    ).length;
    const fueraTemporalEquinos = campaignAnimals.filter(
      (a) => a.tipo === 'EQUINO' && a.estadoPresencia === 'FUERA' && !a.esPlazaVacante
    ).length;
    const fueraTemporalBovinos = campaignAnimals.filter(
      (a) => a.tipo === 'BOVINO' && a.estadoPresencia === 'FUERA' && !a.esPlazaVacante
    ).length;

    // 3. Rastras al Pie (Crías dependientes - NO computan plaza municipal)
    const rastrasTotal = campaignAnimals.filter((a) => !!a.rastra && !a.esPlazaVacante).length;
    const rastrasEquinas = campaignAnimals.filter(
      (a) => a.tipo === 'EQUINO' && !!a.rastra && !a.esPlazaVacante
    ).length;
    const rastrasBovinas = campaignAnimals.filter(
      (a) => a.tipo === 'BOVINO' && !!a.rastra && !a.esPlazaVacante
    ).length;
    let rastrasMachos = 0;
    let rastrasHembras = 0;
    campaignAnimals.forEach((a) => {
      if (a.rastra && !a.esPlazaVacante) {
        if (a.rastra.sexo === 'M') rastrasMachos++;
        if (a.rastra.sexo === 'H') rastrasHembras++;
      }
    });

    const hembras = campaignAnimals.filter((a) => a.sexo === 'H' && !a.esPlazaVacante).length;
    const machos = campaignAnimals.filter((a) => a.sexo === 'M' && !a.esPlazaVacante).length;
    const tasaParicion = hembras > 0 ? Math.round((rastrasTotal / hembras) * 100) : 0;

    // 4. Sementales Reproductores Autorizados (NO computan plaza ordinaria)
    const campaignStallions = stallions.filter((s) => s.campana === statsCampaign);
    const equinoStallions = campaignStallions.filter((s) => s.tipo === 'EQUINO').length;
    const bovinoStallions = campaignStallions.filter((s) => s.tipo === 'BOVINO').length;

    // 5. Carga Ganadera Total en Terreno (Biomasa Viva en Marisma)
    // Animales titulares dentro + Rastras en campo + Sementales autorizados
    const cargaTotalEnCampo = titularesDentro + rastrasTotal + campaignStallions.length;
    const cargaEquinaEnCampo = titularesEquinosDentro + rastrasEquinas + equinoStallions;
    const cargaBovinaEnCampo = titularesBovinosDentro + rastrasBovinas + bovinoStallions;

    // 6. Revision status
    const revisionesPendientes = campaignAnimals.filter((a) => {
      if (a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE') return false;
      const rv = a.fechaUltimaRevision || '';
      return !rv || rv.toLowerCase().includes('entra') || rv.toLowerCase().includes('pendiente');
    }).length;
    const revisionesAlDia = plazasOcupadas - revisionesPendientes;

    // 7. Capas / Pelajes distribution (Untouched)
    const capasCount: Record<string, number> = {};
    campaignAnimals.forEach((a) => {
      if (!a.esPlazaVacante && a.estadoPresencia !== 'PLAZA_VACANTE') {
        const c = a.capa ? a.capa.toUpperCase().trim() : 'NO ESPECIFICADA';
        capasCount[c] = (capasCount[c] || 0) + 1;
      }
    });
    const sortedCapas = Object.entries(capasCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // 8. Top Ganaderos / Propietarios in this campaign with plazas and rastras
    const ganaderosCount: Record<
      string,
      {
        totalPlazas: number;
        equino: number;
        bovino: number;
        ocupadas: number;
        libres: number;
        dentro: number;
        fuera: number;
        rastras: number;
      }
    > = {};

    campaignAnimals.forEach((a) => {
      const prop = a.propietario.trim() || 'SIN ASIGNAR';
      if (!ganaderosCount[prop]) {
        ganaderosCount[prop] = {
          totalPlazas: 0,
          equino: 0,
          bovino: 0,
          ocupadas: 0,
          libres: 0,
          dentro: 0,
          fuera: 0,
          rastras: 0,
        };
      }
      ganaderosCount[prop].totalPlazas += 1;
      if (a.tipo === 'EQUINO') ganaderosCount[prop].equino += 1;
      if (a.tipo === 'BOVINO') ganaderosCount[prop].bovino += 1;

      if (a.esPlazaVacante || a.estadoPresencia === 'PLAZA_VACANTE') {
        ganaderosCount[prop].libres += 1;
      } else {
        ganaderosCount[prop].ocupadas += 1;
        if (a.estadoPresencia === 'DENTRO') ganaderosCount[prop].dentro += 1;
        if (a.estadoPresencia === 'FUERA') ganaderosCount[prop].fuera += 1;
      }
      if (a.rastra) ganaderosCount[prop].rastras += 1;
    });

    const sortedGanaderos = Object.entries(ganaderosCount)
      .sort((a, b) => b[1].totalPlazas - a[1].totalPlazas)
      .slice(0, 10);

    // Movements
    const entradas = movements.filter((m) => m.tipoMovimiento === 'ENTRADA').length;
    const salidas = movements.filter((m) => m.tipoMovimiento === 'SALIDA').length;

    // Official Identification & Documents
    const occupiedAnimals = campaignAnimals.filter(
      (a) => !a.esPlazaVacante && a.estadoPresencia !== 'PLAZA_VACANTE'
    );
    const withChip = occupiedAnimals.filter((a) => a.identificacion1 && a.identificacion1.trim()).length;
    const withUeln = occupiedAnimals.filter((a) => a.identificacion2 && a.identificacion2.trim()).length;
    const totalDocs = occupiedAnimals.reduce((acc, a) => acc + (a.documentos?.length || 0), 0);
    const totalAnnotations = occupiedAnimals.reduce((acc, a) => acc + (a.anotaciones?.length || 0), 0);

    return {
      totalAnimals: totalPlazas,
      totalPlazas,
      plazasEquinas,
      plazasBovinas,
      equinos: plazasEquinas,
      bovinos: plazasBovinas,
      plazasOcupadas,
      plazasOcupadasEquinas,
      plazasOcupadasBovinas,
      plazasLibres,
      plazasLibresEquinas,
      plazasLibresBovinas,
      porcentajeOcupacion,
      titularesDentro,
      titularesEquinosDentro,
      titularesBovinosDentro,
      fueraTemporal,
      fueraTemporalEquinos,
      fueraTemporalBovinos,
      dentro: titularesDentro,
      fuera: fueraTemporal + plazasLibres,
      porcentajeDentro: totalPlazas > 0 ? Math.round((titularesDentro / totalPlazas) * 100) : 0,
      rastrasTotal,
      conRastra: rastrasTotal,
      rastrasEquinas,
      rastrasBovinas,
      rastrasMachos,
      rastrasHembras,
      hembras,
      machos,
      tasaParicion,
      campaignStallionsCount: campaignStallions.length,
      equinoStallions,
      bovinoStallions,
      cargaTotalEnCampo,
      cargaEquinaEnCampo,
      cargaBovinaEnCampo,
      revisionesPendientes,
      revisionesAlDia,
      sortedCapas,
      sortedGanaderos,
      entradas,
      salidas,
      withChip,
      withUeln,
      totalDocs,
      totalAnnotations,
    };
  }, [campaignAnimals, stallions, statsCampaign, movements]);

  // Association Breakdown: Equinos, Bovinos, Plazas Ocupadas/Libres y Rastras por asociación
  const associationStats = useMemo(() => {
    const ownerByName = new Map<string, Owner>();
    owners.forEach((o) => {
      ownerByName.set(o.nombreCompleto.trim().toLowerCase(), o);
    });

    interface AsocStatItem {
      id?: string;
      nombre: string;
      cif: string;
      propietariosCount: number;
      equinos: number;
      bovinos: number;
      total: number;
      ocupadas: number;
      libres: number;
      rastras: number;
      percent: number;
    }

    const map: Record<string, AsocStatItem> = {};

    // Initialize with registered associations
    associations.forEach((asoc) => {
      const ownersInAsoc = owners.filter(
        (o) => o.asociacion && o.asociacion.trim().toLowerCase() === asoc.nombre.trim().toLowerCase()
      ).length;

      map[asoc.nombre.trim().toLowerCase()] = {
        id: asoc.id,
        nombre: asoc.nombre.trim(),
        cif: asoc.cif,
        propietariosCount: ownersInAsoc,
        equinos: 0,
        bovinos: 0,
        total: 0,
        ocupadas: 0,
        libres: 0,
        rastras: 0,
        percent: 0,
      };
    });

    let sinAsocEquinos = 0;
    let sinAsocBovinos = 0;
    let sinAsocOcupadas = 0;
    let sinAsocLibres = 0;
    let sinAsocRastras = 0;
    const sinAsocOwners = owners.filter((o) => !o.asociacion || !o.asociacion.trim()).length;

    campaignAnimals.forEach((animal) => {
      const owner = ownerByName.get(animal.propietario.trim().toLowerCase());
      const asocKey = owner?.asociacion?.trim().toLowerCase();
      const isLibre = animal.esPlazaVacante || animal.estadoPresencia === 'PLAZA_VACANTE';

      if (asocKey && map[asocKey]) {
        if (animal.tipo === 'EQUINO') map[asocKey].equinos += 1;
        if (animal.tipo === 'BOVINO') map[asocKey].bovinos += 1;
        map[asocKey].total += 1;
        if (isLibre) {
          map[asocKey].libres += 1;
        } else {
          map[asocKey].ocupadas += 1;
        }
        if (animal.rastra) map[asocKey].rastras += 1;
      } else {
        if (animal.tipo === 'EQUINO') sinAsocEquinos += 1;
        if (animal.tipo === 'BOVINO') sinAsocBovinos += 1;
        if (isLibre) {
          sinAsocLibres += 1;
        } else {
          sinAsocOcupadas += 1;
        }
        if (animal.rastra) sinAsocRastras += 1;
      }
    });

    const totalCenso = campaignAnimals.length;

    const list: AsocStatItem[] = Object.values(map).map((item) => ({
      ...item,
      percent: totalCenso > 0 ? Math.round((item.total / totalCenso) * 100) : 0,
    }));

    list.sort((a, b) => b.total - a.total);

    const sinAsocItem: AsocStatItem = {
      nombre: 'Particulares / Sin Asociación',
      cif: 'N/A',
      propietariosCount: sinAsocOwners,
      equinos: sinAsocEquinos,
      bovinos: sinAsocBovinos,
      total: sinAsocEquinos + sinAsocBovinos,
      ocupadas: sinAsocOcupadas,
      libres: sinAsocLibres,
      rastras: sinAsocRastras,
      percent: totalCenso > 0 ? Math.round(((sinAsocEquinos + sinAsocBovinos) / totalCenso) * 100) : 0,
    };

    return {
      list,
      sinAsoc: sinAsocItem,
      totalEquinos: stats.plazasEquinas,
      totalBovinos: stats.plazasBovinas,
      totalOcupadas: stats.plazasOcupadas,
      totalLibres: stats.plazasLibres,
      totalRastras: stats.rastrasTotal,
      totalCenso,
    };
  }, [campaignAnimals, owners, associations, stats.plazasEquinas, stats.plazasBovinas, stats.plazasOcupadas, stats.plazasLibres, stats.rastrasTotal]);

  // Propietarios disponibles en la campaña seleccionada como origen del traspaso
  const sourceCampaignOwners = useMemo(() => {
    return owners.filter((o) => !o.campana || o.campana === wizardSourceCampaign);
  }, [owners, wizardSourceCampaign]);

  // Al abrir el asistente o cambiar la campaña origen, inicializar selección con todos marcados
  const handleOpenWizard = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (onOpenNewCampaignWizard) {
      onOpenNewCampaignWizard(newCampaignName.trim());
      return;
    }
    if (!newCampaignName.trim()) {
      alert('Por favor introduce el nombre de la nueva campaña (ej. 2026-2027)');
      return;
    }
    const cleanName = newCampaignName.trim();
    if (campaigns.some((c) => c.toLowerCase() === cleanName.toLowerCase())) {
      alert(`La campaña "${cleanName}" ya existe en el sistema.`);
      return;
    }

    const initialMap = new Map<string, { selected: boolean; asociacion: string }>();
    sourceCampaignOwners.forEach((o) => {
      initialMap.set(o.id, { selected: true, asociacion: o.asociacion || '' });
    });
    setWizardSelectedOwners(initialMap);
    setIsWizardOpen(true);
  };

  const handleToggleSelectAll = (select: boolean) => {
    setWizardSelectedOwners((prev) => {
      const next = new Map(prev);
      sourceCampaignOwners.forEach((o) => {
        const current = next.get(o.id) || { selected: false, asociacion: o.asociacion || '' };
        next.set(o.id, { ...current, selected: select });
      });
      return next;
    });
  };

  const handleToggleOwner = (ownerId: string) => {
    setWizardSelectedOwners((prev) => {
      const next = new Map(prev);
      const current = next.get(ownerId);
      if (current) {
        next.set(ownerId, { ...current, selected: !current.selected });
      }
      return next;
    });
  };

  const handleOwnerAsocChange = (ownerId: string, newAsoc: string) => {
    setWizardSelectedOwners((prev) => {
      const next = new Map(prev);
      const current = next.get(ownerId);
      if (current) {
        next.set(ownerId, { ...current, asociacion: newAsoc });
      }
      return next;
    });
  };

  const handleConfirmCreateCampaignWithOwners = () => {
    if (!newCampaignName.trim()) return;

    // Construir la lista de propietarios seleccionados con su asociación (posiblemente modificada)
    const ownersToTransfer: Owner[] = [];
    sourceCampaignOwners.forEach((o) => {
      const state = wizardSelectedOwners.get(o.id);
      if (state && state.selected) {
        ownersToTransfer.push({
          ...o,
          campana: newCampaignName.trim(),
          asociacion: state.asociacion,
        });
      }
    });

    onAddCampaign(newCampaignName.trim(), wizardSourceCampaign, ownersToTransfer);
    setFeedbackMsg(`Campaña ${newCampaignName.trim()} creada con éxito con ${ownersToTransfer.length} socio(s) traspasados.`);
    setNewCampaignName('');
    setIsWizardOpen(false);
    setTimeout(() => setFeedbackMsg(''), 5000);
  };

  const handleBackupExport = async () => {
    try {
      const backup = await ApiService.exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_marisma_hinojos_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      StorageService.exportBackupJSON();
    }
  };

  const handleRestoreImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        await ApiService.restoreBackup(parsed);
        setFeedbackMsg('Copia de seguridad restaurada correctamente en el servidor.');
        onReloadAllData();
      } catch (err: any) {
        alert('Error al restaurar la copia de seguridad: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetDefaults = () => {
    if (
      confirm(
        '¿Desea restablecer todos los datos a la plantilla original de la Marisma de Hinojos (según la captura de Excel)? Los cambios no respaldados se perderán.'
      )
    ) {
      StorageService.resetToFactoryDefaults();
      onReloadAllData();
      setFeedbackMsg('Datos restablecidos con éxito a la hoja original de Hinojos.');
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card with Navigation Subtabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                PANEL DE AJUSTES Y ADMINISTRACIÓN
              </h1>
            </div>
          </div>
        </div>

        {/* Feedback message */}
        {feedbackMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-emerald-900 text-xs sm:text-sm font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Subtabs for Settings */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
          <button
            onClick={() => handleSelectSection('ESTADISTICAS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
              activeSection === 'ESTADISTICAS'
                ? 'bg-[#008744] text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Estadísticas de la Marisma</span>
          </button>

          {currentUser.rol === 'ADMINISTRADOR' && (
            <>
              <button
                onClick={() => handleSelectSection('CAMPANAS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                  activeSection === 'CAMPANAS' || activeSection === 'CAMPANAS_BACKUP'
                    ? 'bg-[#008744] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Campañas</span>
              </button>

              <button
                onClick={() => handleSelectSection('USUARIOS')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                  activeSection === 'USUARIOS'
                    ? 'bg-[#008744] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Usuarios ({users.length})</span>
              </button>

              <button
                onClick={() => handleSelectSection('AUDITORIA')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                  activeSection === 'AUDITORIA'
                    ? 'bg-[#008744] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Auditoría</span>
              </button>

              <button
                onClick={() => handleSelectSection('COPIA_SEGURIDAD')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${
                  activeSection === 'COPIA_SEGURIDAD'
                    ? 'bg-[#008744] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Copia de Seguridad</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* SECTION 1: ESTADISTICAS */}
      {activeSection === 'ESTADISTICAS' && (
        <div className="space-y-6">
          {/* Campaign Selector for Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              <span className="text-sm font-bold text-gray-800">
                Visualizando Estadísticas para la Campaña:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statsCampaign}
                onChange={(e) => setStatsCampaign(e.target.value)}
                className="text-xs sm:text-sm font-bold bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {campaigns.map((c) => (
                  <option key={c} value={c}>
                    Campaña {c} {c === activeCampaign ? '(Activa en el sistema)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Censo de Plazas Municipales */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
                <span>Censo Oficial Plazas</span>
                <span className="text-lg">🏛️</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-gray-900">
                  {stats.totalPlazas}
                </span>
                <span className="text-xs text-gray-500 font-bold">plazas cupo</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100 font-semibold">
                <span>🐎 {stats.plazasEquinas} Equinas</span>
                <span>🐂 {stats.plazasBovinas} Bovinas</span>
              </div>
            </div>

            {/* Card 2: Estado de Plazas (Ocupadas vs Libres) */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
                <span>Estado Plazas</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  {stats.porcentajeOcupacion}% Ocupación
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-800">
                  {stats.plazasOcupadas}
                </span>
                <span className="text-xs text-gray-500 font-bold">ocupadas</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                <span className="text-emerald-700 font-bold">
                  {stats.titularesDentro} dentro / {stats.fueraTemporal} fuera temp.
                </span>
                <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-[11px]">
                  {stats.plazasLibres} Libres
                </span>
              </div>
            </div>

            {/* Card 3: Rastras y Sementales (Sin Plaza) */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold uppercase tracking-wider">
                <span>Sin Cómputo Plaza</span>
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                  Crías / Sementales
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-amber-900">
                  {stats.rastrasTotal + stats.campaignStallionsCount}
                </span>
                <span className="text-xs text-gray-500 font-bold">reproductores + crías</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100 font-semibold">
                <span className="text-amber-800">
                  👶 {stats.rastrasTotal} Rastras
                </span>
                <span className="text-purple-800">
                  🏆 {stats.campaignStallionsCount} Sementales
                </span>
              </div>
            </div>
          </div>

          {/* Cuadro Técnico Desglosado: Balance de Plazas vs Carga Animal */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide flex items-center gap-2">
                  <span className="text-emerald-700">⚖️</span>
                  <span>Balance Anual: Censo Oficial y Disponibilidad de Plazas</span>
                </h3>
              </div>
              <span className="text-xs bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded-lg border border-gray-200 self-start sm:self-auto">
                Campaña {statsCampaign}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Bloque 1: Censo Oficial de Plazas */}
              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between font-black text-emerald-950 uppercase pb-2 border-b border-emerald-200">
                  <span>1. Auditoría de Plazas Asignadas</span>
                  <span className="font-mono text-sm">{stats.totalPlazas} plazas</span>
                </div>
                <div className="space-y-1.5 text-gray-700 font-medium">
                  <div className="flex justify-between">
                    <span>Plazas Ocupadas:</span>
                    <span className="font-bold text-emerald-900">{stats.plazasOcupadas} ({stats.porcentajeOcupacion}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plazas Libres / Vacantes:</span>
                    <span className="font-bold text-rose-700">{stats.plazasLibres} ({100 - stats.porcentajeOcupacion}%)</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-emerald-200/60">
                    <span>🐎 Plazas Equinas:</span>
                    <span className="font-bold text-gray-900">{stats.plazasEquinas} ({stats.plazasOcupadasEquinas} ocup. / {stats.plazasLibresEquinas} libres)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🐂 Plazas Bovinas:</span>
                    <span className="font-bold text-gray-900">{stats.plazasBovinas} ({stats.plazasOcupadasBovinas} ocup. / {stats.plazasLibresBovinas} libres)</span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-800 italic pt-1">
                  * Capacidad legal adjudicada por el Ayuntamiento.
                </p>
              </div>

              {/* Bloque 2: Plazas Vacantes y Ausencias Temporales */}
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-200 space-y-2.5">
                <div className="flex items-center justify-between font-black text-blue-950 uppercase pb-2 border-b border-blue-200">
                  <span>2. Plazas Vacantes y Ausencias Temporales</span>
                  <span className="font-mono text-sm">{stats.fueraTemporal + stats.plazasLibres}</span>
                </div>
                <div className="space-y-1.5 text-gray-700 font-medium">
                  <div className="flex justify-between">
                    <span>Fuera Temporal (Plaza reservada):</span>
                    <span className="font-bold text-blue-900">{stats.fueraTemporal} animales</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-[11px] pl-2">
                    <span>🐎 Equinos / 🐂 Bovinos fuera:</span>
                    <span className="font-mono font-semibold">{stats.fueraTemporalEquinos} / {stats.fueraTemporalBovinos}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-blue-200/60">
                    <span>Plazas Vacantes Disponibles:</span>
                    <span className="font-bold text-rose-700">{stats.plazasLibres} plazas</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-[11px] pl-2">
                    <span>Disponibles Equino / Bovino:</span>
                    <span className="font-mono font-semibold">{stats.plazasLibresEquinas} / {stats.plazasLibresBovinas}</span>
                  </div>
                </div>
                <p className="text-[11px] text-blue-800 italic pt-1">
                  * Animales fuera temporal conservan derecho a reingreso.
                </p>
              </div>
            </div>
          </div>

          {/* Capas / Pelajes Distribution */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                Distribución de Capas y Pelajes
              </h3>
              <span className="text-xs text-gray-500 font-medium">Más frecuentes</span>
            </div>

            {stats.sortedCapas.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No hay datos suficientes.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {stats.sortedCapas.map(([capa, count]) => {
                  const percentage = stats.totalAnimals > 0 ? Math.round((count / stats.totalAnimals) * 100) : 0;
                  return (
                    <div key={capa} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-gray-800 font-bold">{capa}</span>
                        <span className="text-gray-600">
                          {count} animales ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 rounded-full"
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Censo y Cupo de Plazas por Asociación de Propietarios */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                    Censo y Cupo de Plazas por Asociación · Campaña {statsCampaign}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Desglose de plazas adjudicadas (equinas y bovinas), estado de ocupación y rastras al pie (crías) según la asociación del titular.
                </p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200 self-start sm:self-auto">
                {associations.length} Asociaciones registradas
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                    <th className="py-2.5 px-3">Asociación</th>
                    <th className="py-2.5 px-3 text-center">CIF</th>
                    <th className="py-2.5 px-3 text-center">Ganaderos</th>
                    <th className="py-2.5 px-3 text-center">🐎 Plazas Equinas</th>
                    <th className="py-2.5 px-3 text-center">🐂 Plazas Bovinas</th>
                    <th className="py-2.5 px-3 text-center font-bold">Total Plazas</th>
                    <th className="py-2.5 px-3 text-center">Ocupadas / Libres</th>
                    <th className="py-2.5 px-3 text-center">👶 Rastras</th>
                    <th className="py-2.5 px-3 text-right">% Plazas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {associationStats.list.map((asoc) => (
                    <tr key={asoc.nombre} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-3 font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{asoc.nombre}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-gray-600">
                        {asoc.cif || '---'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">
                        {asoc.propietariosCount}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-800">
                        <span className="bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          🐎 {asoc.equinos}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-800">
                        <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          🐂 {asoc.bovinos}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-gray-900 text-sm">
                        {asoc.total}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold">
                        <span className="text-emerald-700 font-bold">{asoc.ocupadas}</span>
                        <span className="text-gray-400 mx-1">/</span>
                        <span className={asoc.libres > 0 ? "text-rose-700 font-bold" : "text-gray-400"}>{asoc.libres}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-amber-800 font-bold">
                        {asoc.rastras > 0 ? `👶 ${asoc.rastras}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-gray-700">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${Math.min(asoc.percent, 100)}%` }}
                            />
                          </div>
                          <span>{asoc.percent}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Particulares / Sin Asociación */}
                  <tr className="bg-gray-50/60 hover:bg-gray-50/90 text-gray-700 border-t border-dashed border-gray-200">
                    <td className="py-3 px-3 italic font-semibold text-gray-600 flex items-center gap-2">
                      <span className="text-gray-400">👤</span>
                      <span>{associationStats.sinAsoc.nombre}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-gray-400 text-[11px]">
                      {associationStats.sinAsoc.cif}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-gray-600">
                      {associationStats.sinAsoc.propietariosCount}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-gray-600">
                      🐎 {associationStats.sinAsoc.equinos}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-semibold text-gray-600">
                      🐂 {associationStats.sinAsoc.bovinos}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-gray-700">
                      {associationStats.sinAsoc.total}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-xs">
                      <span className="text-emerald-700 font-bold">{associationStats.sinAsoc.ocupadas}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className={associationStats.sinAsoc.libres > 0 ? "text-rose-700 font-bold" : "text-gray-400"}>
                        {associationStats.sinAsoc.libres}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-amber-800 font-bold">
                      {associationStats.sinAsoc.rastras > 0 ? `👶 ${associationStats.sinAsoc.rastras}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-gray-500">
                      {associationStats.sinAsoc.percent}%
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-900 text-white font-bold text-xs">
                    <td className="py-2.5 px-3 uppercase tracking-wider">
                      TOTALES GENERALES
                    </td>
                    <td className="py-2.5 px-3 text-center text-[10px] text-emerald-200 font-mono">
                      ---
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {owners.length} Ganaderos
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-200">
                      🐎 {associationStats.totalEquinos}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-emerald-200">
                      🐂 {associationStats.totalBovinos}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">
                      {associationStats.totalCenso} Plazas
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs text-emerald-100">
                      {associationStats.totalOcupadas} ocup. / {associationStats.totalLibres} lib.
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-amber-200">
                      👶 {associationStats.totalRastras}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Ranking de Propietarios */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
                  Propietarios con Mayor Asignación de Plazas · Campaña {statsCampaign}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Titulares de adjudicación con mayor número de plazas asignadas en el término municipal de Hinojos.
                </p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-md border border-emerald-200">
                {stats.sortedGanaderos.length} Titulares en ranking
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold border-b border-gray-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Titular / Ganadero</th>
                    <th className="py-2.5 px-3 text-center">Plazas Asignadas</th>
                    <th className="py-2.5 px-3 text-center">🐎 Equinas</th>
                    <th className="py-2.5 px-3 text-center">🐂 Bovinas</th>
                    <th className="py-2.5 px-3 text-center">Ocupadas / Libres</th>
                    <th className="py-2.5 px-3 text-center">👶 Rastras</th>
                    <th className="py-2.5 px-3 text-right">% Censo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.sortedGanaderos.map(([nombre, gStats], idx) => {
                    const percent = stats.totalPlazas > 0 ? Math.round((gStats.totalPlazas / stats.totalPlazas) * 100) : 0;
                    return (
                      <tr key={nombre} className="hover:bg-gray-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {nombre}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-emerald-900">
                          <span className="bg-emerald-50 px-2 py-0.5 rounded font-mono">
                            {gStats.totalPlazas}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-gray-600 font-mono">
                          {gStats.equino}
                        </td>
                        <td className="py-2.5 px-3 text-center text-gray-600 font-mono">
                          {gStats.bovino}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-xs">
                          <span className="text-emerald-700 font-bold">{gStats.ocupadas}</span>
                          <span className="text-gray-400 mx-1">/</span>
                          <span className={gStats.libres > 0 ? "text-rose-700 font-bold" : "text-gray-400"}>{gStats.libres}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-amber-800 font-bold">
                          {gStats.rastras > 0 ? `👶 ${gStats.rastras}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-gray-600">
                          {percent}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: GESTIÓN DE USUARIOS - Solo visible para ADMINISTRADOR */}
      {activeSection === 'USUARIOS' && currentUser.rol === 'ADMINISTRADOR' && (
        <div className="space-y-4">
          <UsersView
            users={users}
            currentUser={currentUser}
            onSaveUser={onSaveUser}
            onDeleteUser={onDeleteUser}
            onSelectUserToLogin={onSelectUserToLogin}
          />
        </div>
      )}

      {/* SECTION 3: CAMPAÑAS DE ADJUDICACIÓN - Solo visible para ADMINISTRADOR */}
      {(activeSection === 'CAMPANAS' || activeSection === 'CAMPANAS_BACKUP') && currentUser.rol === 'ADMINISTRADOR' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Campaign Management */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <Calendar className="w-5 h-5 text-emerald-700" />
                <h2 className="text-base font-bold text-gray-900">
                  Campañas de Adjudicación Anual
                </h2>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => onOpenNewCampaignWizard ? onOpenNewCampaignWizard('') : handleOpenWizard()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#008744] hover:bg-[#00743a] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear nueva campaña con traspaso</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Campañas Registradas en el Sistema:
                </h3>
                <div className="space-y-1.5">
                  {campaigns.map((camp) => (
                    <div
                      key={camp}
                      className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold gap-2"
                    >
                      {editingCampaign === camp ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={editingCampaignNewName}
                            onChange={(e) => setEditingCampaignNewName(e.target.value)}
                            className="text-xs px-2 py-1 border border-emerald-500 rounded font-mono bg-white flex-1"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveEditCampaign}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditingCampaign(null)}
                            className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-900 text-sm">{camp}</span>
                            {activeCampaign === camp ? (
                              <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold">
                                Campaña Activa
                              </span>
                            ) : (
                              <button
                                onClick={() => onSetActiveCampaign(camp)}
                                className="text-emerald-700 hover:underline text-xs"
                              >
                                Activar vista
                              </button>
                            )}
                          </div>

                          {currentUser.rol === 'ADMINISTRADOR' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleStartEditCampaign(camp)}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Editar nombre de la campaña"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {campaigns.length > 1 && (
                                <button
                                  onClick={() => handleDeleteCampaignPrompt(camp)}
                                  className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                  title="Eliminar campaña y registros asociados"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Backup & Data Tools */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <h2 className="text-base font-bold text-gray-900">
                  Copias de Seguridad y Respaldo
                </h2>
              </div>

              <p className="text-xs text-gray-600">
                Descarga una copia de seguridad íntegra de toda la base de datos (animales, propietarios, sementales, movimientos y documentos) en formato JSON para archivar en el Ayuntamiento o transferir a otro equipo.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={handleBackupExport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-lg transition shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Copia de Seguridad Completa (.JSON)</span>
                </button>

                <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs sm:text-sm font-bold rounded-lg transition cursor-pointer shadow-xs">
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>Restaurar desde Copia de Seguridad (.JSON)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreImport}
                    className="hidden"
                  />
                </label>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={handleResetDefaults}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold rounded-lg transition"
                  >
                    <RefreshCw className="w-4 h-4 text-rose-600" />
                    <span>Restablecer Datos Originales (Excel Hinojos)</span>
                  </button>
                  <p className="text-[11px] text-gray-400 text-center mt-1">
                    Recarga los datos de Abel Valero, Cándido Naranjo, rastra Dudoso, etc.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: AUDITORÍA - Solo visible para ADMINISTRADOR */}
      {activeSection === 'AUDITORIA' && currentUser.rol === 'ADMINISTRADOR' && (
        <AuditView />
      )}

      {/* SECTION 5: COPIA DE SEGURIDAD - Solo visible para ADMINISTRADOR */}
      {activeSection === 'COPIA_SEGURIDAD' && currentUser.rol === 'ADMINISTRADOR' && (
        <BackupView onReloadAllData={onReloadAllData} />
      )}

      {/* Asistente Modal de Creación de Campaña con Traspaso de Socios */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overscroll-contain">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-200 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-[#0b5333] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="text-base font-bold">
                    Asistente de Creación de Campaña: {newCampaignName}
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Paso de socios, asignación de asociaciones y renovación del censo anual
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="p-1 rounded-lg text-emerald-200 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto overscroll-contain flex-1 space-y-5 text-xs sm:text-sm">
              {/* Campaign origin selector */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-950 uppercase tracking-wide mb-1">
                    Campaña origen de referencia:
                  </label>
                  <p className="text-xs text-emerald-800">
                    Se cargarán los socios y sus asociaciones de esta campaña para que decidas cuáles traspasar.
                  </p>
                </div>
                <select
                  value={wizardSourceCampaign}
                  onChange={(e) => {
                    const newSource = e.target.value;
                    setWizardSourceCampaign(newSource);
                    const sourceList = owners.filter((o) => !o.campana || o.campana === newSource);
                    const newMap = new Map<string, { selected: boolean; asociacion: string }>();
                    sourceList.forEach((o) => {
                      newMap.set(o.id, { selected: true, asociacion: o.asociacion || '' });
                    });
                    setWizardSelectedOwners(newMap);
                  }}
                  className="px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500 shrink-0"
                >
                  {campaigns.map((c) => (
                    <option key={c} value={c}>
                      Campaña {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action bar and counters */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div>
                  <span className="font-bold text-gray-900 text-xs uppercase tracking-wide">
                    Listado de Socios / Ganaderos ({sourceCampaignOwners.length})
                  </span>
                  <p className="text-[11px] text-gray-500">
                    Marca o desmarca los socios que renovarán para la campaña {newCampaignName}. Puedes ajustar su asociación directamente.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(true)}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
                  >
                    Marcar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleSelectAll(false)}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
                  >
                    Desmarcar todos
                  </button>
                </div>
              </div>

              {/* Table of Owners with Checkbox and Association selector */}
              {sourceCampaignOwners.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No se encontraron socios registrados en la campaña {wizardSourceCampaign}.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">Traspasar</th>
                        <th className="py-2.5 px-3">Ganadero / Titular</th>
                        <th className="py-2.5 px-3 font-mono">DNI / CIF</th>
                        <th className="py-2.5 px-3">Asociación para {newCampaignName}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {sourceCampaignOwners.map((ow) => {
                        const state = wizardSelectedOwners.get(ow.id) || {
                          selected: false,
                          asociacion: ow.asociacion || '',
                        };

                        return (
                          <tr
                            key={ow.id}
                            className={`transition ${
                              state.selected ? 'hover:bg-emerald-50/40' : 'bg-gray-50/70 opacity-60'
                            }`}
                          >
                            <td className="py-2 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={state.selected}
                                onChange={() => handleToggleOwner(ow.id)}
                                className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2 px-3 font-semibold text-gray-900">
                              <span
                                onClick={() => handleToggleOwner(ow.id)}
                                className="cursor-pointer select-none hover:text-emerald-800"
                              >
                                {ow.nombreCompleto}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-600 text-[11px]">
                              {ow.dniCif}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                value={state.asociacion}
                                onChange={(e) => handleOwnerAsocChange(ow.id, e.target.value)}
                                disabled={!state.selected}
                                className="w-full text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white font-medium focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400"
                              >
                                <option value="">-- Sin Asociación / Particular --</option>
                                {(associations || []).map((asoc) => (
                                  <option key={asoc.id} value={asoc.nombre}>
                                    {asoc.nombre}
                                  </option>
                                ))}
                                {state.asociacion &&
                                  !(associations || []).some((a) => a.nombre === state.asociacion) && (
                                    <option value={state.asociacion}>{state.asociacion}</option>
                                  )}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Informative summary banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-slate-700">
                <span className="font-medium">
                  Socios seleccionados para renovar en {newCampaignName}:{' '}
                  <strong className="text-emerald-800 font-bold">
                    {Array.from(wizardSelectedOwners.values()).filter((v) => v.selected).length} de {sourceCampaignOwners.length}
                  </strong>
                </span>
                <span className="text-[11px] text-slate-500">
                  Las plazas y animales de {wizardSourceCampaign} se clonarán a la nueva campaña
                </span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
              <button
                type="button"
                onClick={() => setIsWizardOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateCampaignWithOwners}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#008744] hover:bg-[#00743a] text-white text-xs sm:text-sm font-bold rounded-lg shadow-sm transition"
              >
                <Check className="w-4 h-4" />
                <span>
                  Crear Campaña {newCampaignName} y Traspasar Socios
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
