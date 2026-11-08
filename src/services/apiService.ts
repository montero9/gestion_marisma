import { apiClient } from './apiClient';
import {
  Animal,
  Owner,
  Stallion,
  Movement,
  User,
  Association,
  AnimalDocument,
  Annotation,
  AuditLog,
} from '../types/marisma';

const CURRENT_USER_KEY = 'marisma_hinojos_current_user_v1';

export const ApiService = {
  // 1. Carga inicial unificada (Bootstrap)
  async getBootstrap(): Promise<{
    animals: Animal[];
    owners: Owner[];
    associations: Association[];
    stallions: Stallion[];
    movements: Movement[];
    campaigns: string[];
    activeCampaign: string;
    users: User[];
  }> {
    return apiClient.request('/api/bootstrap');
  },

  // 2. Animales y Plazas
  async getAnimals(campana?: string, tipo?: string): Promise<Animal[]> {
    const params = new URLSearchParams();
    if (campana) params.append('campana', campana);
    if (tipo) params.append('tipo', tipo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<Animal[]>(`/api/animals${qs}`);
  },

  async getAnimalById(id: string): Promise<Animal> {
    return apiClient.request<Animal>(`/api/animals/${id}`);
  },

  async upsertAnimal(animal: Animal): Promise<Animal> {
    return apiClient.request<Animal>('/api/animals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(animal),
    });
  },

  async deleteAnimal(id: string): Promise<{ success: boolean; id: string }> {
    return apiClient.request(`/api/animals/${id}`, {
      method: 'DELETE',
    });
  },

  async swapPlazas(
    animalAId: string,
    animalBId: string,
    motivo?: string,
    autor?: string
  ): Promise<{ success: boolean; animalA: Animal; animalB: Animal }> {
    return apiClient.request('/api/animals/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animalAId, animalBId, motivo, autor }),
    });
  },

  // Subida de Archivos y Documentos
  async uploadAnimalDocument(
    animalId: string,
    file: File,
    tipo: string,
    nombre?: string
  ): Promise<{ success: boolean; document: AnimalDocument; documents: AnimalDocument[] }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    if (nombre) formData.append('nombre', nombre);

    return apiClient.uploadFile(`/api/animals/${animalId}/documents`, formData);
  },

  async deleteAnimalDocument(
    animalId: string,
    docId: string
  ): Promise<{ success: boolean; documents: AnimalDocument[] }> {
    return apiClient.request(`/api/animals/${animalId}/documents/${docId}`, {
      method: 'DELETE',
    });
  },

  async addAnimalAnnotation(
    animalId: string,
    annotation: Annotation
  ): Promise<{ success: boolean; annotation: Annotation; anotaciones: Annotation[] }> {
    return apiClient.request(`/api/animals/${animalId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    });
  },

  // 3. Propietarios / Ganaderos
  async getOwners(campana?: string): Promise<Owner[]> {
    const qs = campana ? `?campana=${encodeURIComponent(campana)}` : '';
    return apiClient.request<Owner[]>(`/api/owners${qs}`);
  },

  async upsertOwner(owner: Owner): Promise<Owner> {
    return apiClient.request<Owner>('/api/owners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(owner),
    });
  },

  async deleteOwner(
    id: string,
    reassignAnimalesTo?: string
  ): Promise<{ success: boolean; id: string; animalesReasignados?: number; nuevoPropietario?: string }> {
    return apiClient.request(`/api/owners/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignAnimalesTo }),
    });
  },

  // 4. Asociaciones
  async getAssociations(): Promise<Association[]> {
    return apiClient.request<Association[]>('/api/associations');
  },

  async createAssociation(asoc: Partial<Association>): Promise<Association> {
    return apiClient.request<Association>('/api/associations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asoc),
    });
  },

  async updateAssociation(id: string, asoc: Partial<Association>): Promise<Association> {
    return apiClient.request<Association>(`/api/associations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asoc),
    });
  },

  async deleteAssociation(
    id: string,
    reassignTo?: string
  ): Promise<{ success: boolean; id: string; sociosReasignados?: number; nuevaAsociacion?: string }> {
    return apiClient.request(`/api/associations/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reassignTo }),
    });
  },

  // 5. Sementales
  async getStallions(campana?: string, tipo?: string): Promise<Stallion[]> {
    const params = new URLSearchParams();
    if (campana) params.append('campana', campana);
    if (tipo) params.append('tipo', tipo);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return apiClient.request<Stallion[]>(`/api/stallions${qs}`);
  },

  async upsertStallion(stallion: Stallion): Promise<Stallion> {
    return apiClient.request<Stallion>('/api/stallions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stallion),
    });
  },

  async deleteStallion(id: string): Promise<{ success: boolean; id: string }> {
    return apiClient.request(`/api/stallions/${id}`, {
      method: 'DELETE',
    });
  },

  // 6. Movimientos
  async getMovements(): Promise<Movement[]> {
    return apiClient.request<Movement[]>('/api/movements');
  },

  async registerMovement(movement: Movement): Promise<Movement> {
    return apiClient.request<Movement>('/api/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movement),
    });
  },

  // 7. Campañas
  async getCampaigns(): Promise<{ campaigns: string[]; activeCampaign: string }> {
    return apiClient.request('/api/campaigns');
  },

  async addCampaign(
    nombre: string,
    cloneFromCampaign?: string,
    selectedOwners?: Owner[],
    selectedAnimals?: any[],
    setActiveImmediately: boolean = true
  ): Promise<{ success: boolean; activeCampaign: string }> {
    return apiClient.request('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, cloneFromCampaign, selectedOwners, selectedAnimals, setActiveImmediately }),
    });
  },

  async updateCampaign(
    oldName: string,
    nuevoNombre: string
  ): Promise<{ success: boolean; nuevoNombre: string }> {
    return apiClient.request(`/api/campaigns/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nuevoNombre }),
    });
  },

  async deleteCampaign(
    nombre: string
  ): Promise<{ success: boolean; campanaEliminada: string; nuevaCampanaActiva?: string }> {
    return apiClient.request(`/api/campaigns/${encodeURIComponent(nombre)}`, {
      method: 'DELETE',
    });
  },

  async setActiveCampaign(campana: string): Promise<{ success: boolean; activeCampaign: string }> {
    return apiClient.request('/api/campaigns/active', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campana }),
    });
  },

  async setUserActiveCampaign(campana: string): Promise<{ success: boolean; campanaActiva: string; user?: User }> {
    return apiClient.request('/api/users/me/active-campaign', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campana }),
    });
  },

  // 8. Usuarios y Autenticación
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await apiClient.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    apiClient.setToken(res.token);
    this.setCurrentUser(res.user);
    return res;
  },

  async switchUser(userId: string): Promise<{ token: string; user: User }> {
    const res = await apiClient.request<{ token: string; user: User }>('/api/auth/switch-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    apiClient.setToken(res.token);
    this.setCurrentUser(res.user);
    return res;
  },

  async getMe(): Promise<{ user: User }> {
    return apiClient.request<{ user: User }>('/api/auth/me');
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return apiClient.request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  async logout(): Promise<void> {
    try {
      if (apiClient.getToken()) {
        await apiClient.request('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }
    } catch {}
    apiClient.setToken(null);
    this.setCurrentUser(null);
    try {
      localStorage.removeItem('marisma_auth_token');
      localStorage.removeItem(CURRENT_USER_KEY);
      localStorage.removeItem('marisma_settings_section');
      sessionStorage.clear();
    } catch {}
  },

  getToken(): string | null {
    return apiClient.getToken();
  },

  async getUsers(): Promise<User[]> {
    return apiClient.request<User[]>('/api/users');
  },

  async saveUser(user: User & { password?: string }): Promise<User> {
    return apiClient.request<User>('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean; id: string }> {
    return apiClient.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Sesión local de usuario
  getCurrentUser(): User | null {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  },

  // 9. Backup y Restauración
  async exportBackup(): Promise<any> {
    return apiClient.request('/api/backup');
  },

  async restoreBackup(backupData: any): Promise<{ success: boolean; message: string }> {
    return apiClient.request('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData),
    });
  },

  // 10. Exportación de Libro ODS Maestro para Equinos (4 hojas con formato oficial)
  async exportEquinosODS(campaign: string): Promise<void> {
    const url = `${apiClient.getBaseUrl()}/api/export/equinos-ods?campana=${encodeURIComponent(campaign)}`;
    const token = apiClient.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Error ${res.status}: no se pudo generar el archivo ODS`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `CONTROL EQUINO ${campaign}.ods`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  // 11. Exportación de Libro ODS Oficial para Bovinos (1 hoja réplica exacta de plantilla)
  async exportBovinosODS(campaign: string): Promise<void> {
    const url = `${apiClient.getBaseUrl()}/api/export/bovinos-ods?campana=${encodeURIComponent(campaign)}`;
    const token = apiClient.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Error ${res.status}: no se pudo generar el archivo ODS de bovinos`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `CONTROL BOVINO ${campaign}.ods`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  // 12. Auditoría Municipal
  async getAuditLogs(params?: {
    search?: string;
    accion?: string;
    entidad?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.accion) q.append('accion', params.accion);
    if (params?.entidad) q.append('entidad', params.entidad);
    if (params?.limit) q.append('limit', String(params.limit));
    if (params?.offset) q.append('offset', String(params.offset));

    const qs = q.toString();
    const endpoint = `/api/audit-logs${qs ? `?${qs}` : ''}`;
    return apiClient.request<{ logs: AuditLog[]; total: number }>(endpoint);
  },

  // 13. Copia de Seguridad Integral (.ZIP)
  async getBackupStats(): Promise<{
    databaseSize: number;
    databaseLastModified: string;
    documentsCount: number;
    documentsTotalSize: number;
    animalsCount: number;
    movementsCount: number;
    ownersCount: number;
    auditLogsCount: number;
    campaignsCount: number;
  }> {
    return apiClient.request('/api/admin/backup/stats');
  },

  async downloadBackupZip(): Promise<void> {
    const url = `${apiClient.getBaseUrl()}/api/admin/backup/export`;
    const token = apiClient.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Error ${res.status}: no se pudo generar la copia de seguridad`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const nowStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `Copia_Seguridad_Marisma_Hinojos_${nowStr}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  async restoreBackupZip(file: File): Promise<{
    success: boolean;
    message: string;
    documentosRestaurados?: number;
    copiaEmergenciaPrevia?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.uploadFile('/api/admin/backup/restore-zip', formData);
  },
};
