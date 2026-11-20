import React, { useState, useEffect } from 'react';
import { SmtpConfig } from '../types/marisma';
import { ApiService } from '../services/apiService';
import {
  Mail,
  Server,
  Key,
  User as UserIcon,
  Send,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export const SmtpConfigView: React.FC = () => {
  const [config, setConfig] = useState<SmtpConfig>({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'Ayuntamiento de Hinojos - Control Ganadero',
    destinatarios: '',
    bcc: '',
  });

  const [hasStoredPass, setHasStoredPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    setTestResult(null);
    setSaveSuccess(false);
    try {
      const data = await ApiService.getSmtpConfig();
      setConfig({
        host: data.host || '',
        port: data.port || 587,
        secure: Boolean(data.secure),
        user: data.user || '',
        pass: data.pass || '',
        fromName: data.fromName || 'Ayuntamiento de Hinojos - Control Ganadero',
        destinatarios: data.destinatarios || '',
        bcc: data.bcc || '',
      });
      setHasStoredPass(data.hasPass);
    } catch (err: any) {
      console.error('Error al cargar configuración SMTP:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setTestResult(null);
    try {
      await ApiService.saveSmtpConfig(config);
      setSaveSuccess(true);
      setHasStoredPass(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      alert('Error guardando la configuración: ' + (err.message || 'Error del servidor'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await ApiService.testSmtpConfig({
        ...config,
        testRecipient: testRecipient.trim() || undefined,
      });
      setTestResult({
        success: true,
        message: testRecipient.trim()
          ? `Conexión verificada con éxito y correo de prueba enviado a ${testRecipient.trim()}`
          : 'Conexión con el servidor SMTP establecida correctamente.',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Fallo de autenticación o conexión con el servidor SMTP',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center justify-center gap-3 text-gray-500 shadow-xs">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
        <p className="text-sm font-medium">Cargando configuración del servidor SMTP...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera explicativa */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <Mail className="w-6 h-6 text-emerald-800" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-gray-900">
              Configuración de Envío de Permisos y Servidor SMTP
            </h2>
            <p className="text-xs text-gray-500">
              Ajustes de salida de correo oficial para la comunicación de remesas con el Espacio Natural
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 sm:p-6 space-y-6">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Sección 1: Destinatarios oficiales */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
              <Mail className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-black uppercase tracking-wider">Destinatarios Oficiales</h3>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Correos de Destino (Espacio Natural / Guardería)
              </label>
              <input
                type="text"
                value={config.destinatarios}
                onChange={(e) => setConfig({ ...config, destinatarios: e.target.value })}
                placeholder="ej. espaciodonana@juntadeandalucia.es, guarderia.donana@junta..."
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
                required
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Puede especificar uno o varios correos separados por comas. A estas direcciones se enviará el archivo .ODS oficial.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Copia Oculta Automática (BCC)
              </label>
              <input
                type="text"
                value={config.bcc}
                onChange={(e) => setConfig({ ...config, bcc: e.target.value })}
                placeholder="ej. agricultura@hinojos.es, marisma.hinojos@gmail.com"
                className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Recibirá una copia idéntica de cada comunicación para archivo y registro municipal sin que los destinatarios vean esta dirección.
              </p>
            </div>
          </div>

          {/* Sección 2: Servidor de Correo Saliente (SMTP) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-gray-900 border-b border-gray-100 pb-2">
              <Server className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-black uppercase tracking-wider">Servidor de Salida SMTP</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Servidor SMTP (Host)</label>
                <input
                  type="text"
                  value={config.host}
                  onChange={(e) => setConfig({ ...config, host: e.target.value })}
                  placeholder="ej. mail.gmx.es, smtp.gmail.com, mail.hinojos.es"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Puerto</label>
                <input
                  type="number"
                  value={config.port}
                  onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 587 })}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Usuario / Email de Conexión</label>
                <input
                  type="text"
                  value={config.user}
                  onChange={(e) => setConfig({ ...config, user: e.target.value })}
                  placeholder="usuario@dominio.es"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Contraseña / Contraseña de Aplicación
                </label>
                <input
                  type="password"
                  value={config.pass}
                  onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                  placeholder={hasStoredPass ? '•••••••• (Contraseña guardada)' : 'Introduzca contraseña'}
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 font-mono"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  {hasStoredPass
                    ? 'Deje este campo vacío si no desea modificar la contraseña actualmente almacenada.'
                    : 'La contraseña se almacena de forma segura en la base de datos.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Remitente Oficial</label>
                <input
                  type="text"
                  value={config.fromName}
                  onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                  placeholder="Ayuntamiento de Hinojos - Control Ganadero"
                  className="w-full text-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="relative flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.secure}
                    onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
                    className="w-4 h-4 text-emerald-700 rounded border-gray-300 focus:ring-emerald-600 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-gray-700">Usar SSL/TLS directo (marcar para puerto 465)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Sección 3: Prueba de conexión */}
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Comprobación de conectividad y envío de prueba
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="Email para recibir correo de prueba (opcional)"
                className="flex-1 text-xs px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !config.host || !config.user}
                className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verificando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Probar Conexión SMTP</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-300'
                    : 'bg-rose-50 text-rose-900 border border-rose-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100">
            <div>
              {saveSuccess && (
                <span className="text-xs text-emerald-800 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Configuración guardada permanentemente en la base de datos
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar Configuración SMTP</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
