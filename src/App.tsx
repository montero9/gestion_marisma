import React, { useState, useEffect } from 'react';
import { Animal, AnimalType, Owner, Stallion, Movement, User, Association } from './types/marisma';
import { StorageService } from './services/storageService';
import { ApiService } from './services/apiService';
import { Header, NavTab } from './components/Header';
import { Footer } from './components/Footer';
import { AnimalTable } from './components/AnimalTable';
import { AnimalModal } from './components/AnimalModal';
import { AnimalDetailModal } from './components/AnimalDetailModal';
import { MovementModal } from './components/MovementModal';
import { OwnersView } from './components/OwnersView';
import { StallionsView } from './components/StallionsView';
import { HistoryMovementsView } from './components/HistoryMovementsView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { AssignPlazaModal } from './components/AssignPlazaModal';
import { RestoreAnimalModal } from './components/RestoreAnimalModal';
import { CampaignMigrationWizard } from './components/CampaignMigrationWizard';
import { ServerStatusBanner } from './components/ServerStatusBanner';
import { HinojosLogo } from './components/HinojosLogo';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Navigation & Campaign - Persistencia de pestaña activa para no reiniciar a EQUINO tras modificaciones
  const [currentTab, setCurrentTab] = useState<NavTab>(() => {
    try {
      const saved = localStorage.getItem('marisma_active_tab') as NavTab | null;
      if (saved && ['EQUINO', 'BOVINO', 'PROPIETARIOS', 'HISTORICO', 'AJUSTES'].includes(saved)) {
        return saved;
      }
    } catch {}
    return 'EQUINO';
  });

  const handleSelectTab = (tab: NavTab) => {
    setCurrentTab(tab);
    try {
      localStorage.setItem('marisma_active_tab', tab);
    } catch {}
    if (tab === 'EQUINO') setEquinoSubView('TABLA');
    if (tab === 'BOVINO') setBovinoSubView('TABLA');
  };

  const [equinoSubView, setEquinoSubView] = useState<'TABLA' | 'SEMENTALES'>('TABLA');
  const [bovinoSubView, setBovinoSubView] = useState<'TABLA' | 'SEMENTALES'>('TABLA');
  const [stallionsInitialType, setStallionsInitialType] = useState<'TODOS' | 'EQUINO' | 'BOVINO'>('TODOS');
  const [activeCampaign, setActiveCampaign] = useState<string>('2025-2026');
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Core Data
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [associations, setAssociations] = useState<Association[]>([]);
  const [stallions, setStallions] = useState<Stallion[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  // User & Auth
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Modals
  const [isAnimalModalOpen, setIsAnimalModalOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingAnimal, setViewingAnimal] = useState<Animal | null>(null);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementTargetAnimal, setMovementTargetAnimal] = useState<Animal | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [assigningVacantPlaza, setAssigningVacantPlaza] = useState<Animal | null>(null);
  const [restoringAnimalData, setRestoringAnimalData] = useState<{
    animal: Animal;
    movement: Movement;
  } | null>(null);
  const [isNewCampaignWizardOpen, setIsNewCampaignWizardOpen] = useState(false);
  const [wizardInitialCampaignName, setWizardInitialCampaignName] = useState('');

  // Load data exclusively from SQLite via ApiService (Fuente única de verdad)
  const loadAllData = async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    try {
      // No se solicita ningún dato municipal hasta disponer de una sesión
      // válida. La pantalla de acceso es la única vía pública de la SPA.
      const token = ApiService.getToken();
      const savedUser = ApiService.getCurrentUser();
      if (!token || !savedUser) {
        setCurrentUser(null);
        return;
      }
      const data = await ApiService.getBootstrap();
      setAnimals(data.animals);
      setOwners(data.owners);
      setAssociations(data.associations);
      setStallions(data.stallions);
      setMovements(data.movements);
      setCampaigns(data.campaigns);
      // Comprobar si hay sesión real activa verificando con el backend
      setUsers(data.users);
      let effectiveActiveCamp = data.activeCampaign;

      if (token && savedUser) {
        try {
          const authRes = await ApiService.getMe();
          setCurrentUser(authRes.user);
          ApiService.setCurrentUser(authRes.user);
          if (authRes.user.campanaActiva && data.campaigns.includes(authRes.user.campanaActiva)) {
            effectiveActiveCamp = authRes.user.campanaActiva;
          }
        } catch {
          // Token inválido o expirado
          await ApiService.logout();
          setCurrentUser(null);
        }
      } else {
        // No hay sesión activa o falta token: limpiar por completo
        await ApiService.logout();
        setCurrentUser(null);
      }

      // IMPORTANTE: Garantizar que la campaña activa siempre sea una existente
      if (!data.campaigns.includes(effectiveActiveCamp) && data.campaigns.length > 0) {
        effectiveActiveCamp = data.campaigns[0];
      }

      setActiveCampaign(effectiveActiveCamp);
    } catch (err) {
      console.error('Error al conectar con la base de datos municipal:', err);
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAllData(true);
  }, []);

  // Handler for campaign switch
  const handleChangeCampaign = async (campana: string) => {
    setActiveCampaign(campana);
    try {
      // 1. Guardar en el perfil del usuario activo si está autenticado
      if (currentUser) {
        await ApiService.setUserActiveCampaign(campana);
        const updatedUser = { ...currentUser, campanaActiva: campana };
        setCurrentUser(updatedUser);
        ApiService.setCurrentUser(updatedUser);
      }
      // 2. Mantener también sincronizada la configuración general
      await ApiService.setActiveCampaign(campana);
    } catch (e) {
      console.warn('Error al sincronizar campaña activa:', e);
    }
  };

  const handleAddCampaign = async (
    campana: string,
    cloneFrom?: string,
    selectedOwners?: Owner[],
    selectedAnimals?: any[],
    setActiveImmediately: boolean = true
  ) => {
    try {
      await ApiService.addCampaign(campana, cloneFrom, selectedOwners, selectedAnimals, setActiveImmediately);
      await loadAllData(false);
      if (setActiveImmediately) {
        setActiveCampaign(campana);
      }
    } catch (e: any) {
      console.warn('Error al registrar campaña en el servidor:', e);
      alert(`Error al registrar campaña: ${e.message}`);
      throw e;
    }
  };

  const handleUpdateCampaign = async (oldName: string, newName: string) => {
    try {
      await ApiService.updateCampaign(oldName, newName);
      await loadAllData(false);
    } catch (e: any) {
      console.warn('Error al actualizar campaña:', e);
      alert(`Error al actualizar campaña: ${e.message}`);
    }
  };

  const handleDeleteCampaign = async (campana: string) => {
    try {
      const res = await ApiService.deleteCampaign(campana);

      // 1. Sincronizar en StorageService
      StorageService.deleteCampaign(campana);

      // 2. Determinar la siguiente campaña activa válida
      const remainingCampaigns = campaigns.filter((c) => c !== campana);
      const nextActiveCampaign =
        res?.nuevaCampanaActiva ||
        remainingCampaigns[0] ||
        '2025-2026';

      // 3. Si la campaña eliminada era la activa en pantalla o ya no existe
      if (activeCampaign === campana || !remainingCampaigns.includes(activeCampaign)) {
        setActiveCampaign(nextActiveCampaign);
        if (currentUser) {
          const updatedUser = { ...currentUser, campanaActiva: nextActiveCampaign };
          setCurrentUser(updatedUser);
          ApiService.setCurrentUser(updatedUser);
        }
      }

      await loadAllData(false);
    } catch (e: any) {
      console.warn('Error al eliminar campaña:', e);
      alert(`Error al eliminar campaña: ${e.message}`);
    }
  };

  // Animal CRUD
  const handleAddAnimalClick = () => {
    setEditingAnimal(null);
    setIsAnimalModalOpen(true);
  };

  const handleEditAnimalClick = (animal: Animal) => {
    setEditingAnimal(animal);
    setIsAnimalModalOpen(true);
  };

  const handleViewAnimalClick = (animal: Animal) => {
    setViewingAnimal(animal);
    setIsDetailModalOpen(true);
  };

  const handleDeleteAnimal = async (animal: Animal) => {
    try {
      await ApiService.deleteAnimal(animal.id);
      setAnimals((prev) => prev.filter((a) => a.id !== animal.id));
    } catch (e: any) {
      alert(`Error al eliminar en la base de datos municipal: ${e.message}`);
    }
  };

  const handleSaveAnimal = async (animal: Animal) => {
    try {
      const saved = await ApiService.upsertAnimal(animal);
      setIsAnimalModalOpen(false);

      const updatedList = await ApiService.getAnimals();
      setAnimals(updatedList);

      if (viewingAnimal?.id === saved.id) {
        setViewingAnimal(saved);
      }
    } catch (e: any) {
      alert(`Error al guardar en la base de datos municipal: ${e.message}`);
    }
  };

  // Movement handlers
  const handleRegisterMovementClick = (animal: Animal) => {
    setMovementTargetAnimal(animal);
    setIsMovementModalOpen(true);
  };

  const handleSaveMovement = async (movement: Movement) => {
    try {
      await ApiService.registerMovement(movement);
      const b = await ApiService.getBootstrap();
      setAnimals(b.animals);
      setMovements(b.movements);
    } catch (e: any) {
      alert(`Error al registrar movimiento en la base de datos municipal: ${e.message}`);
    }
  };

  const handleOpenAssignPlaza = (vacantPlaza: Animal) => {
    setAssigningVacantPlaza(vacantPlaza);
  };

  const handleConfirmReentry = async (
    vacantPlazaId: string,
    animalId: string,
    fecha: string,
    numeroGuia?: string,
    observaciones?: string
  ) => {
    try {
      const vacant = animals.find((a) => a.id === vacantPlazaId);
      const target = animals.find((a) => a.id === animalId);
      if (vacant && target) {
        const updatedAnimal: Animal = {
          ...target,
          plazaNumero: vacant.plazaNumero,
          campana: vacant.campana,
          propietario: vacant.propietario,
          estadoPresencia: 'DENTRO',
          fechaEntradaMarisma: fecha,
          esPlazaVacante: false,
          actualizadoEn: new Date().toISOString(),
        };
        await ApiService.deleteAnimal(vacantPlazaId);
        await ApiService.upsertAnimal(updatedAnimal);
        await ApiService.registerMovement({
          id: `mov-${Date.now()}`,
          animalId: target.id,
          campana: vacant.campana || activeCampaign,
          identificacion1: target.identificacion1 || '',
          tipoAnimal: target.tipo,
          plazaNumero: vacant.plazaNumero,
          nombreAnimal: target.tipo === 'BOVINO' ? '' : target.nombreAnimal,
          propietario: target.propietario,
          tipoMovimiento: 'ENTRADA',
          fecha,
          motivo: 'ADJUDICACION',
          numeroGuia,
          guardaResponsable: currentUser?.nombreCompleto || 'Guarda de Marisma',
          observaciones: `Reincorporación a la marisma en plaza ${vacant.plazaNumero}.${observaciones ? ' ' + observaciones : ''}`,
        });
        const b = await ApiService.getBootstrap();
        setAnimals(b.animals);
        setMovements(b.movements);
      }
    } catch (e) {
      console.warn('Error al reasignar plaza en backend:', e);
    }
  };

  const handleConfirmRestoreAnimal = async (
    updatedAnimal: Animal,
    newMovement: Movement,
    vacantPlazaIdToRemove?: string
  ) => {
    setRestoringAnimalData(null);
    try {
      if (vacantPlazaIdToRemove) {
        await ApiService.deleteAnimal(vacantPlazaIdToRemove);
      }
      await ApiService.upsertAnimal(updatedAnimal);
      await ApiService.registerMovement(newMovement);
      const b = await ApiService.getBootstrap();
      setAnimals(b.animals);
      setMovements(b.movements);
    } catch (e) {
      console.warn('Error al restaurar animal en backend:', e);
    }
  };

  const handleSwapPlazas = async (
    animalAId: string,
    animalBId: string,
    motivo?: string
  ) => {
    try {
      const res = await ApiService.swapPlazas(
        animalAId,
        animalBId,
        motivo,
        currentUser?.nombreCompleto || 'Gestión Municipal'
      );
      if (res.success) {
        const updatedList = await ApiService.getAnimals();
        setAnimals(updatedList);
      }
    } catch (e) {
      console.warn('Error al permutar plazas en el servidor:', e);
    }
  };

  const handleOpenCreateNewForPlaza = (vacantPlaza: Animal) => {
    setEditingAnimal({
      id: `ani-${Date.now()}`,
      tipo: vacantPlaza.tipo,
      campana: vacantPlaza.campana,
      plazaNumero: vacantPlaza.plazaNumero,
      propietario: vacantPlaza.propietario,
      finca: 'HINOJOS',
      identificacion1: '',
      identificacion2: '',
      nombreAnimal: '',
      sexo: 'H',
      fechaNacimiento: '',
      capa: vacantPlaza.tipo === 'BOVINO' ? 'OTRO' : 'TORDO',
      estadoPresencia: 'DENTRO',
      documentos: [],
      anotaciones: [],
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    });
    setIsAnimalModalOpen(true);
  };

  // Owner CRUD — SQLite como única fuente de verdad
  const handleSaveOwner = async (owner: Owner) => {
    try {
      await ApiService.upsertOwner(owner);
      // Recargar propietarios y animales (por si cambió el nombre y se actualizó en cascada)
      const [updatedOwners, updatedAnimals] = await Promise.all([
        ApiService.getOwners(),
        ApiService.getAnimals(),
      ]);
      setOwners(updatedOwners);
      setAnimals(updatedAnimals);
    } catch (e: any) {
      console.warn('Error al guardar propietario en backend:', e);
      try { setOwners(await ApiService.getOwners()); } catch {}
      throw e;
    }
  };

  const handleDeleteOwner = async (ownerId: string, reassignAnimalesTo?: string) => {
    try {
      await ApiService.deleteOwner(ownerId, reassignAnimalesTo);
      // Recargar propietarios y animales tras la reasignación
      const [updatedOwners, updatedAnimals] = await Promise.all([
        ApiService.getOwners(),
        ApiService.getAnimals(),
      ]);
      setOwners(updatedOwners);
      setAnimals(updatedAnimals);
    } catch (e: any) {
      console.warn('Error al eliminar propietario en backend:', e);
      try { setOwners(await ApiService.getOwners()); } catch {}
      throw e;
    }
  };

  // Association CRUD — SQLite como única fuente de verdad
  const handleSaveAssociation = async (asoc: Association, isUpdate = false) => {
    try {
      if (isUpdate) {
        await ApiService.updateAssociation(asoc.id, asoc);
      } else {
        await ApiService.createAssociation(asoc);
      }
      // Recargar asociaciones y propietarios (por si se actualizaron en cascada)
      const [updatedAsocs, updatedOwners] = await Promise.all([
        ApiService.getAssociations(),
        ApiService.getOwners(),
      ]);
      setAssociations(updatedAsocs);
      setOwners(updatedOwners);
    } catch (e: any) {
      console.warn('Error al guardar asociación en backend:', e);
      alert(`Error al guardar asociación: ${e.message}`);
      try {
        setAssociations(await ApiService.getAssociations());
      } catch {}
      throw e;
    }
  };

  const handleDeleteAssociation = async (associationId: string, reassignTo?: string) => {
    try {
      await ApiService.deleteAssociation(associationId, reassignTo);
      // Recargar asociaciones y propietarios tras la reasignación
      const [updatedAsocs, updatedOwners] = await Promise.all([
        ApiService.getAssociations(),
        ApiService.getOwners(),
      ]);
      setAssociations(updatedAsocs);
      setOwners(updatedOwners);
    } catch (e: any) {
      console.warn('Error al eliminar asociación en backend:', e);
      alert(`Error al eliminar asociación: ${e.message}`);
      try {
        setAssociations(await ApiService.getAssociations());
      } catch {}
      throw e;
    }
  };

  // Stallion CRUD — SQLite como única fuente de verdad
  const handleSaveStallion = async (stallion: Stallion) => {
    setStallions((prev) => {
      const idx = prev.findIndex((s) => s.id === stallion.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = stallion; return next; }
      return [...prev, stallion];
    });
    try {
      await ApiService.upsertStallion(stallion);
      const updated = await ApiService.getStallions();
      setStallions(updated);
    } catch (e) {
      console.warn('Error al guardar semental en backend:', e);
      try { setStallions(await ApiService.getStallions()); } catch {}
    }
  };

  const handleDeleteStallion = async (id: string) => {
    setStallions((prev) => prev.filter((s) => s.id !== id));
    try {
      await ApiService.deleteStallion(id);
    } catch (e) {
      console.warn('Error al eliminar semental en backend:', e);
      try { setStallions(await ApiService.getStallions()); } catch {}
    }
  };

  // Users & Auth — SQLite como única fuente de verdad
  const handleSaveUser = async (user: User & { password?: string }) => {
    try {
      await ApiService.saveUser(user);
      const updated = await ApiService.getUsers();
      setUsers(updated);
    } catch (e: any) {
      console.error('Error al guardar usuario en backend:', e);
      alert(`Error al guardar usuario: ${e.message}`);
      try { setUsers(await ApiService.getUsers()); } catch {}
      throw e;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (users.length <= 1) {
      alert('No es posible eliminar el único usuario del sistema. Debe existir al menos una cuenta registrada.');
      return;
    }

    const isCurrent = currentUser?.id === userId;
    setUsers((prev) => prev.filter((u) => u.id !== userId));

    if (isCurrent) {
      const remaining = users.filter((u) => u.id !== userId);
      if (remaining.length > 0) {
        const next = remaining[0];
        setCurrentUser(next);
        ApiService.setCurrentUser(next);
      }
    }

    try {
      await ApiService.deleteUser(userId);
    } catch (e) {
      console.warn('Error al eliminar usuario en backend:', e);
      try { setUsers(await ApiService.getUsers()); } catch {}
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    ApiService.setCurrentUser(user);
    setIsLoginModalOpen(false);
    // Establecer la campaña activa guardada para este usuario
    if (user.campanaActiva) {
      setActiveCampaign(user.campanaActiva);
    }
    // Si el usuario que inicia sesión es de solo lectura (CONSULTA), nos aseguramos de que no mantenga subsecciones de administración
    if (user.rol !== 'ADMINISTRADOR') {
      try {
        localStorage.setItem('marisma_settings_section', 'ESTADISTICAS');
      } catch {}
    }
  };

  const handleSwitchUser = async (user: User) => {
    try {
      const res = await ApiService.switchUser(user.id);
      handleLogin(res.user);
    } catch {
      handleLogin(user);
    }
  };

  const handleLogout = async () => {
    setIsLoginModalOpen(false);
    try {
      await ApiService.logout();
    } catch {}
    setCurrentUser(null);
    setCurrentTab('EQUINO');
    try {
      localStorage.removeItem('marisma_auth_token');
      localStorage.removeItem('marisma_hinojos_current_user_v1');
      localStorage.removeItem('marisma_active_tab');
      localStorage.removeItem('marisma_settings_section');
      sessionStorage.clear();
    } catch {}
  };

  // Export for current table (ODS oficial para EQUINO y BOVINO)
  const handleExportTableCSV = async (tipo: AnimalType) => {
    if (tipo === 'EQUINO') {
      try {
        await ApiService.exportEquinosODS(activeCampaign);
      } catch (err) {
        console.error('Error generando libro ODS de equinos, recurriendo a CSV:', err);
        const list = animals.filter((a) => a.tipo === tipo && a.campana === activeCampaign);
        StorageService.exportToExcelCSV(list, tipo, activeCampaign);
      }
    } else {
      try {
        await ApiService.exportBovinosODS(activeCampaign);
      } catch (err) {
        console.error('Error generando libro ODS de bovinos, recurriendo a CSV:', err);
        const list = animals.filter((a) => a.tipo === tipo && a.campana === activeCampaign);
        StorageService.exportToExcelCSV(list, tipo, activeCampaign);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b5333] text-white p-6 select-none">
        <HinojosLogo className="w-16 h-20 mb-4 animate-pulse" />
        <h1 className="text-xl font-bold tracking-tight mb-1 text-center">Ayuntamiento de Hinojos</h1>
        <p className="text-xs text-emerald-200 mb-6 font-medium uppercase tracking-wider text-center">
          Control Ganadero · Marisma de Hinojos (Doñana)
        </p>
        <div className="flex items-center gap-3 bg-emerald-900/80 border border-emerald-700/60 px-5 py-3 rounded-xl shadow-lg backdrop-blur-xs">
          <Loader2 className="w-5 h-5 text-emerald-300 animate-spin flex-shrink-0" />
          <span className="text-sm font-medium text-emerald-100">
            Conectando con la base de datos municipal SQLite...
          </span>
        </div>
      </div>
    );
  }

  // Si no hay sesión autenticada, pantalla de Login oficial obligatoria
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0b5333] text-white p-4">
        <LoginModal
          isOpen={true}
          isMandatory={true}
          onLoginSuccess={(user) => {
            handleLogin(user);
            loadAllData(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f2] text-gray-900 font-sans antialiased">
      {/* Top Municipal Navigation Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Banner de Estado del Servidor (maneja reactivación tras suspensión en hosting gratuito) */}
      <ServerStatusBanner />

      {/* Main Content Body */}
      <main className={`flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 ${isDetailModalOpen ? 'print:hidden' : ''}`}>
        {/* TAB: EQUINO */}
        {currentTab === 'EQUINO' && (
          <>
            {equinoSubView === 'TABLA' ? (
              <AnimalTable
                tipo="EQUINO"
                animals={animals}
                owners={owners}
                campaigns={campaigns}
                activeCampaign={activeCampaign}
                currentUser={currentUser}
                onChangeCampaign={handleChangeCampaign}
                onAddAnimal={handleAddAnimalClick}
                onEditAnimal={handleEditAnimalClick}
                onViewAnimal={handleViewAnimalClick}
                onDeleteAnimal={handleDeleteAnimal}
                onRegisterMovement={handleRegisterMovementClick}
                onAssignPlaza={handleOpenAssignPlaza}
                onExportCSV={() => handleExportTableCSV('EQUINO')}
                onOpenStallions={() => {
                  setStallionsInitialType('EQUINO');
                  setEquinoSubView('SEMENTALES');
                }}
                onSwapPlazas={handleSwapPlazas}
              />
            ) : (
              <StallionsView
                stallions={stallions.filter((s) => s.campana === activeCampaign)}
                allStallions={stallions}
                animals={animals}
                owners={owners}
                activeCampaign={activeCampaign}
                currentUser={currentUser}
                initialType={stallionsInitialType}
                backLabel="← Volver al Listado de Equinos"
                onSaveStallion={handleSaveStallion}
                onDeleteStallion={handleDeleteStallion}
                onBack={() => setEquinoSubView('TABLA')}
              />
            )}
          </>
        )}

        {/* TAB: BOVINO */}
        {currentTab === 'BOVINO' && (
          <>
            {bovinoSubView === 'TABLA' ? (
              <AnimalTable
                tipo="BOVINO"
                animals={animals}
                owners={owners}
                campaigns={campaigns}
                activeCampaign={activeCampaign}
                currentUser={currentUser}
                onChangeCampaign={handleChangeCampaign}
                onAddAnimal={handleAddAnimalClick}
                onEditAnimal={handleEditAnimalClick}
                onViewAnimal={handleViewAnimalClick}
                onDeleteAnimal={handleDeleteAnimal}
                onRegisterMovement={handleRegisterMovementClick}
                onAssignPlaza={handleOpenAssignPlaza}
                onExportCSV={() => handleExportTableCSV('BOVINO')}
                onOpenStallions={() => {
                  setStallionsInitialType('BOVINO');
                  setBovinoSubView('SEMENTALES');
                }}
                onSwapPlazas={handleSwapPlazas}
              />
            ) : (
              <StallionsView
                stallions={stallions.filter((s) => s.campana === activeCampaign)}
                allStallions={stallions}
                animals={animals}
                owners={owners}
                activeCampaign={activeCampaign}
                currentUser={currentUser}
                initialType={stallionsInitialType}
                backLabel="← Volver al Listado de Bovinos"
                onSaveStallion={handleSaveStallion}
                onDeleteStallion={handleDeleteStallion}
                onBack={() => setBovinoSubView('TABLA')}
              />
            )}
          </>
        )}

        {/* TAB: PROPIETARIOS */}
        {currentTab === 'PROPIETARIOS' && (
          <OwnersView
            owners={owners}
            associations={associations}
            animals={animals}
            activeCampaign={activeCampaign}
            currentUser={currentUser}
            onSaveOwner={handleSaveOwner}
            onDeleteOwner={handleDeleteOwner}
            onSaveAssociation={handleSaveAssociation}
            onDeleteAssociation={handleDeleteAssociation}
            onViewAnimal={handleViewAnimalClick}
          />
        )}

        {/* TAB: HISTÓRICO */}
        {currentTab === 'HISTORICO' && (
          <HistoryMovementsView
            movements={movements}
            animals={animals}
            campaigns={campaigns}
            currentUser={currentUser}
            onOpenMovementModal={() => {
              const activeList = animals.filter(
                (a) => a.campana === activeCampaign && !a.esPlazaVacante
              );
              setMovementTargetAnimal(activeList[0] || null);
              setIsMovementModalOpen(true);
            }}
            onRestoreAnimal={(animal, movement) => {
              setRestoringAnimalData({ animal, movement });
            }}
            onViewAnimal={handleViewAnimalClick}
          />
        )}

        {/* TAB: AJUSTES */}
        {currentTab === 'AJUSTES' && (
          isNewCampaignWizardOpen ? (
            <CampaignMigrationWizard
              campaigns={campaigns}
              activeCampaign={activeCampaign}
              animals={animals}
              owners={owners}
              associations={associations}
              initialNewName={wizardInitialCampaignName}
              onClose={() => {
                setIsNewCampaignWizardOpen(false);
                setWizardInitialCampaignName('');
              }}
              onConfirm={async (params) => {
                await handleAddCampaign(
                  params.nombre,
                  params.cloneFromCampaign,
                  params.selectedOwners,
                  params.selectedAnimals,
                  params.setActiveImmediately
                );
                setIsNewCampaignWizardOpen(false);
                setWizardInitialCampaignName('');
              }}
            />
          ) : (
            <SettingsView
              campaigns={campaigns}
              activeCampaign={activeCampaign}
              onAddCampaign={handleAddCampaign}
              onUpdateCampaign={handleUpdateCampaign}
              onDeleteCampaign={handleDeleteCampaign}
              onSetActiveCampaign={handleChangeCampaign}
              onReloadAllData={loadAllData}
              animals={animals}
              owners={owners}
              associations={associations}
              stallions={stallions}
              movements={movements}
              users={users}
              currentUser={currentUser}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              onSelectUserToLogin={handleSwitchUser}
              onOpenNewCampaignWizard={(initialName) => {
                setWizardInitialCampaignName(initialName || '');
                setIsNewCampaignWizardOpen(true);
              }}
            />
          )
        )}
      </main>

      {/* Modals */}
      {/* 1. Animal Create/Edit Modal */}
      {isAnimalModalOpen && (
        <AnimalModal
          isOpen={isAnimalModalOpen}
          onClose={() => setIsAnimalModalOpen(false)}
          onSave={handleSaveAnimal}
          initialAnimal={editingAnimal}
          existingAnimals={animals}
          defaultTipo={currentTab === 'BOVINO' ? 'BOVINO' : 'EQUINO'}
          defaultCampana={activeCampaign}
          owners={owners}
          currentUser={currentUser!}
        />
      )}

      {/* 2. Animal Detail & Print Modal */}
      {isDetailModalOpen && viewingAnimal && (
        <AnimalDetailModal
          isOpen={isDetailModalOpen}
          animal={viewingAnimal}
          allAnimals={animals}
          currentUser={currentUser}
          onClose={() => {
            setIsDetailModalOpen(false);
            setViewingAnimal(null);
          }}
          onEdit={(animal) => {
            setIsDetailModalOpen(false);
            handleEditAnimalClick(animal);
          }}
          movements={movements}
        />
      )}

      {/* 3. Register Movement Modal */}
      {isMovementModalOpen && (
        <MovementModal
          isOpen={isMovementModalOpen}
          onClose={() => setIsMovementModalOpen(false)}
          onSaveMovement={handleSaveMovement}
          animals={animals}
          selectedAnimal={movementTargetAnimal}
          activeCampaign={activeCampaign}
          currentUser={currentUser!}
        />
      )}

      {/* 4. Login Modal para cambiar de usuario */}
      {isLoginModalOpen && (
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLogin}
        />
      )}

      {/* 5. Assign Animal to Vacant Plaza Modal */}
      {assigningVacantPlaza && (
        <AssignPlazaModal
          isOpen={!!assigningVacantPlaza}
          onClose={() => setAssigningVacantPlaza(null)}
          vacantPlaza={assigningVacantPlaza}
          candidateAnimals={StorageService.getReentryCandidates(
            assigningVacantPlaza.propietario,
            assigningVacantPlaza.tipo
          )}
          currentUser={currentUser}
          onConfirmReentry={handleConfirmReentry}
          onOpenCreateNew={handleOpenCreateNewForPlaza}
        />
      )}

      {/* 6. Restore Animal to Free Plaza Modal */}
      {restoringAnimalData && (
        <RestoreAnimalModal
          isOpen={!!restoringAnimalData}
          onClose={() => setRestoringAnimalData(null)}
          animal={restoringAnimalData.animal}
          previousMovement={restoringAnimalData.movement}
          owners={owners}
          animals={animals}
          activeCampaign={activeCampaign}
          currentUser={currentUser!}
          onConfirmRestore={handleConfirmRestoreAnimal}
        />
      )}

      {/* Bottom Municipal Footer */}
      <div className="print:hidden">
        <Footer currentUser={currentUser} />
      </div>
    </div>
  );
}
