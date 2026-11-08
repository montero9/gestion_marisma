/**
 * Gestor de Conexión y Resiliencia con el Servidor Backend
 * Especialmente diseñado para soportar hosting gratuito con suspensión (cold start)
 * como Render, Fly.io, Railway, Koyeb, etc.
 */

export type ServerConnectionStatus = 'ONLINE' | 'WAKING_UP' | 'OFFLINE';

type StatusListener = (status: ServerConnectionStatus, message?: string) => void;

class ApiClient {
  private baseUrl = window.location.port === '3000' 
    ? `http://${window.location.hostname || 'localhost'}:3001` 
    : '';
  private status: ServerConnectionStatus = 'ONLINE';
  private listeners: Set<StatusListener> = new Set();
  private heartbeatTimer: any = null;
  private isWakingUp = false;
  private token: string | null = null;

  constructor() {
    try {
      this.token = localStorage.getItem('marisma_auth_token');
    } catch {}
    this.startHeartbeat();
  }

  public setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('marisma_auth_token', token);
      } else {
        localStorage.removeItem('marisma_auth_token');
      }
    } catch {}
  }

  public getToken(): string | null {
    return this.token;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getStatus(): ServerConnectionStatus {
    return this.status;
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(newStatus: ServerConnectionStatus, message?: string) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.listeners.forEach((listener) => listener(newStatus, message));
    }
  }

  /**
   * Ping de salud al servidor para despertar instancias dormidas
   */
  public async wakeUpServer(maxAttempts = 20, intervalMs = 2500): Promise<boolean> {
    if (this.isWakingUp) return false;
    this.isWakingUp = true;
    this.setStatus('WAKING_UP', 'Reactivando el servidor municipal...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(`${this.baseUrl}/api/health`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          this.setStatus('ONLINE');
          this.isWakingUp = false;
          return true;
        }
      } catch (err) {
        // En proceso de arranque
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }

    this.setStatus('OFFLINE', 'No se pudo contactar con el servidor');
    this.isWakingUp = false;
    return false;
  }

  /**
   * Petición HTTP con auto-reintento inteligente para soportar suspensión del servidor
   */
  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 6
  ): Promise<T> {
    let retries = 0;
    const url = `${this.baseUrl}${endpoint}`;

    while (retries < maxRetries) {
      try {
        const controller = new AbortController();
        // Timeout más amplio si el servidor puede estar suspendido (15 segundos)
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const headers: Record<string, string> = {
          ...(options.headers as Record<string, string>),
        };

        if (this.token && !headers['Authorization']) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Si responde con 502, 503 o 504 suele ser el proxy de hosting esperando al contenedor
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          throw new Error(`Servidor suspendido (HTTP ${response.status})`);
        }

        if (!response.ok) {
          // Errores de cliente (400, 401, 403, 404, 422, etc.): el servidor ESTÁ conectado
          if (response.status >= 400 && response.status < 500) {
            this.setStatus('ONLINE');
            const errData = await response.json().catch(() => ({}));
            const clientError = new Error(errData.error || `Error en la petición (${response.status}): ${response.statusText}`);
            (clientError as any).isClientError = true;
            (clientError as any).status = response.status;
            throw clientError;
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Servidor no disponible (HTTP ${response.status})`);
        }

        // Si la petición tuvo éxito, confirmar estado ONLINE
        this.setStatus('ONLINE');
        return (await response.json()) as T;
      } catch (error: any) {
        // Si es un error de cliente (4xx como 401 Credenciales inválidas), lanzarlo de inmediato sin reintentos
        if (error.isClientError || (error.status && error.status >= 400 && error.status < 500)) {
          throw error;
        }

        retries++;
        console.warn(`[ApiClient] Intento ${retries}/${maxRetries} fallido para ${endpoint}:`, error.message);

        // Notificar que el servidor se está reactivando
        this.setStatus('WAKING_UP', 'El servidor se está reactivando tras suspensión. Reintentando...');

        if (retries >= maxRetries) {
          this.setStatus('OFFLINE', 'Servidor no disponible');
          throw error;
        }

        // Espera progresiva antes de reintentar (2s, 3s, 4s...)
        const delay = Math.min(2000 * Math.pow(1.2, retries), 8000);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw new Error('Número máximo de reintentos alcanzado');
  }

  /**
   * Petición para subida de archivos multipart/form-data
   */
  public async uploadFile<T = any>(
    endpoint: string,
    formData: FormData
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * Heartbeat para evitar que el servidor gratuito entre en suspensión mientras la app está abierta
   */
  private startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    // Cada 4 minutos (los hosting suelen suspender a los 15 minutos de inactividad)
    this.heartbeatTimer = setInterval(async () => {
      // Solo hacer ping si la ventana está activa
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          await fetch(`${this.baseUrl}/api/health`, { cache: 'no-store' });
          if (this.status !== 'ONLINE') this.setStatus('ONLINE');
        } catch {
          // Si falla, el siguiente request gestionará el reintento
        }
      }
    }, 4 * 60 * 1000);
  }
}

export const apiClient = new ApiClient();
