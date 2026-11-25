import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  FileText,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';

export interface DocumentToView {
  nombre: string;
  url?: string;
  fileData?: string;
  tipo?: string;
  fechaSubida?: string;
  tamano?: string;
}

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentToView | null;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  document: doc,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  // Bloquear scroll de fondo mientras esté abierto
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    setZoom(100);
    setRotation(0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !doc) return null;

  const resolvedUrl = doc.url
    ? apiClient.getAuthenticatedUrl(doc.url)
    : doc.fileData || '';

  const filename = doc.nombre.toLowerCase();
  const isPdf =
    filename.endsWith('.pdf') ||
    doc.tipo?.toLowerCase().includes('pdf') ||
    doc.fileData?.startsWith('data:application/pdf');
  const isImage =
    filename.endsWith('.jpg') ||
    filename.endsWith('.jpeg') ||
    filename.endsWith('.png') ||
    filename.endsWith('.webp') ||
    filename.endsWith('.svg') ||
    doc.fileData?.startsWith('data:image/');

  const handleDownload = () => {
    const a = window.document.createElement('a');
    if (doc.url) {
      a.href = apiClient.getAuthenticatedUrl(doc.url);
      a.target = '_blank';
    } else if (doc.fileData) {
      a.href = doc.fileData;
    } else {
      const blob = new Blob([`Documento oficial censo ganadero Hinojos: ${doc.nombre}`], {
        type: 'text/plain',
      });
      a.href = URL.createObjectURL(blob);
    }
    a.download = doc.nombre;
    a.click();
  };

  const handlePrint = () => {
    if (isImage) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head><title>${doc.nombre}</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
              <img src="${resolvedUrl}" style="max-width:100%;max-height:100vh;" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } else {
      window.open(resolvedUrl, '_blank');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera institucional del Visor */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 flex items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold truncate max-w-md" title={doc.nombre}>
                  {doc.nombre}
                </h3>
                {doc.tipo && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-emerald-300 border border-slate-700">
                    {doc.tipo.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {doc.fechaSubida ? `Fecha: ${doc.fechaSubida}` : 'Documento oficial de censo'}
                {doc.tamano ? ` · ${doc.tamano}` : ''}
              </p>
            </div>
          </div>

          {/* Barra de Herramientas y Acciones */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isImage && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(50, prev - 25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Alejar"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-400 px-1">{zoom}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(250, prev + 25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Acercar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                  title="Girar 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-slate-700 mx-1 hidden sm:block" />
              </>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Imprimir documento"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Descargar archivo en este equipo"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition cursor-pointer ml-1"
              title="Cerrar visor (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Visualizable */}
        <div className="flex-1 bg-slate-100/90 relative overflow-auto flex items-center justify-center p-2 sm:p-4">
          {resolvedUrl ? (
            isPdf ? (
              <iframe
                src={`${resolvedUrl}#toolbar=1&navpanes=0`}
                title={doc.nombre}
                className="w-full h-full rounded-xl bg-white shadow-inner border border-gray-200"
              />
            ) : isImage ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                <img
                  src={resolvedUrl}
                  alt={doc.nombre}
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease-out',
                  }}
                  className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-md border border-gray-200 bg-white"
                />
              </div>
            ) : (
              <div className="text-center p-8 bg-white rounded-2xl border border-gray-200 shadow-sm max-w-md">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h4 className="font-bold text-gray-900 text-sm mb-1">{doc.nombre}</h4>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                  Este formato de documento no dispone de vista previa interactiva en el navegador. Puede descargarlo o abrirlo externamente.
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar archivo</span>
                  </button>
                  <a
                    href={resolvedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir enlace</span>
                  </a>
                </div>
              </div>
            )
          ) : (
            <div className="text-center p-6 text-gray-500">
              <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-medium">No se ha podido cargar el origen del documento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
