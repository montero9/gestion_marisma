export type DialogType = 'success' | 'warning' | 'error' | 'info' | 'question';

export interface DialogOptions {
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  showCancel?: boolean;
}

type DialogListener = (state: {
  isOpen: boolean;
  options: DialogOptions;
  resolve: (value: boolean) => void;
} | null) => void;

class DialogService {
  private listener: DialogListener | null = null;
  private queue: Array<{
    options: DialogOptions;
    resolve: (value: boolean) => void;
  }> = [];
  private currentDialog: {
    options: DialogOptions;
    resolve: (value: boolean) => void;
  } | null = null;

  public subscribe(listener: DialogListener): () => void {
    this.listener = listener;
    if (this.currentDialog) {
      this.listener({
        isOpen: true,
        options: this.currentDialog.options,
        resolve: this.handleResolve,
      });
    }
    return () => {
      this.listener = null;
    };
  }

  private handleResolve = (result: boolean) => {
    if (this.currentDialog) {
      this.currentDialog.resolve(result);
      this.currentDialog = null;
    }
    if (this.listener) {
      this.listener(null);
    }
    // Procesar siguiente en cola si existe
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      setTimeout(() => {
        this.open(next.options, next.resolve);
      }, 50);
    }
  };

  private open(options: DialogOptions, resolve: (value: boolean) => void) {
    if (this.currentDialog) {
      this.queue.push({ options, resolve });
      return;
    }
    this.currentDialog = { options, resolve };
    if (this.listener) {
      this.listener({
        isOpen: true,
        options,
        resolve: this.handleResolve,
      });
    } else {
      // Fallback si no está montado el modal todavía
      if (typeof window !== 'undefined') {
        const res = options.showCancel ? window.confirm(options.message) : (window.alert(options.message), true);
        resolve(res);
      } else {
        resolve(true);
      }
      this.currentDialog = null;
    }
  }

  public alert(options: DialogOptions | string): Promise<void> {
    const opts: DialogOptions =
      typeof options === 'string'
        ? { message: options, type: 'info', showCancel: false }
        : { ...options, showCancel: false };

    return new Promise<void>((resolve) => {
      this.open(opts, () => resolve());
    });
  }

  public confirm(options: DialogOptions | string): Promise<boolean> {
    const opts: DialogOptions =
      typeof options === 'string'
        ? { message: options, type: 'question', showCancel: true }
        : { ...options, showCancel: true };

    return new Promise<boolean>((resolve) => {
      this.open(opts, resolve);
    });
  }

  public showSuccess(message: string, title = 'Operación Completada'): Promise<void> {
    return this.alert({ title, message, type: 'success' });
  }

  public showError(message: string, title = 'Error'): Promise<void> {
    return this.alert({ title, message, type: 'error' });
  }

  public showWarning(message: string, title = 'Atención'): Promise<void> {
    return this.alert({ title, message, type: 'warning' });
  }

  public showInfo(message: string, title = 'Información'): Promise<void> {
    return this.alert({ title, message, type: 'info' });
  }

  public installGlobalOverride() {
    if (typeof window !== 'undefined') {
      window.alert = (msg: any) => {
        const text = String(msg ?? '');
        const lower = text.toLowerCase();
        let type: DialogType = 'info';
        let title = 'Aviso Municipal';

        if (lower.includes('error') || lower.includes('fallo') || lower.includes('no se pudo')) {
          type = 'error';
          title = 'Error';
        } else if (
          lower.includes('advertencia') ||
          lower.includes('atención') ||
          lower.includes('obligatorio') ||
          lower.includes('por favor') ||
          lower.includes('ya está asignado') ||
          lower.includes('ya pertenece') ||
          lower.includes('ya existe') ||
          lower.includes('no es posible') ||
          lower.includes('no se puede') ||
          lower.includes('debe ')
        ) {
          type = 'warning';
          title = 'Atención';
        } else if (
          lower.includes('éxito') ||
          lower.includes('correctamente') ||
          lower.includes('guardad') ||
          lower.includes('restaurad')
        ) {
          type = 'success';
          title = 'Operación Exitosa';
        }

        this.alert({
          title,
          message: text,
          type,
        });
      };
    }
  }
}

export const dialogService = new DialogService();
dialogService.installGlobalOverride();
