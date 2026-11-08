import React from 'react';
import { User } from '../types/marisma';
import { HinojosLogo } from './HinojosLogo';
import { ServerStatusPill } from './ServerStatusBanner';
import {
  FileText,
  Users,
  History,
  Settings,
  LogOut,
  Layers,
} from 'lucide-react';

export type NavTab = 'EQUINO' | 'BOVINO' | 'PROPIETARIOS' | 'HISTORICO' | 'AJUSTES';

interface HeaderProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: User;
  onOpenLoginModal?: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onOpenLoginModal,
  onLogout,
}) => {
  return (
    <header className="bg-[#0b5333] text-white shadow-md sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo & Municipal Title */}
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => onSelectTab('EQUINO')}>
            <HinojosLogo className="w-11 h-14" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg md:text-xl tracking-tight text-white">
                  Ayuntamiento de Hinojos
                </span>
              </div>
              <p className="text-xs text-emerald-200 tracking-wider font-medium uppercase">
                Control Ganadero
              </p>
            </div>
          </div>

          {/* Navigation Tabs - Fixed, no slider */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 py-2">
            <button
              onClick={() => onSelectTab('EQUINO')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'EQUINO'
                  ? 'bg-emerald-800 text-white shadow-inner font-semibold'
                  : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">🐎</span>
              <span>Equino</span>
            </button>

            <button
              onClick={() => onSelectTab('BOVINO')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'BOVINO'
                  ? 'bg-emerald-800 text-white shadow-inner font-semibold'
                  : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
              }`}
            >
              <span className="text-base">🐂</span>
              <span>Bovino</span>
            </button>

            <button
              onClick={() => onSelectTab('PROPIETARIOS')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'PROPIETARIOS'
                  ? 'bg-emerald-800 text-white shadow-inner font-semibold'
                  : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Propietarios</span>
            </button>

            <button
              onClick={() => onSelectTab('HISTORICO')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'HISTORICO'
                  ? 'bg-emerald-800 text-white shadow-inner font-semibold'
                  : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
            </button>

            <button
              onClick={() => onSelectTab('AJUSTES')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === 'AJUSTES'
                  ? 'bg-emerald-800 text-white shadow-inner font-semibold'
                  : 'text-emerald-100 hover:bg-emerald-800/60 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Ajustes</span>
            </button>
          </nav>

          {/* User profile & actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <ServerStatusPill />

            {/* User profile pill (Informativo / Solo lectura) */}
            <div
              className="flex items-center gap-2.5 bg-emerald-900/90 px-3 py-1.5 rounded-lg border border-emerald-700/60 shadow-sm select-none"
              title={`Usuario conectado: ${currentUser.nombreCompleto} (${currentUser.rol})`}
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight truncate max-w-[150px]">
                  {currentUser.nombreCompleto}
                </p>
                <p className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">
                  {currentUser.rol.replace('_', ' ')}
                </p>
              </div>

              {/* Avatar circle */}
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center border border-emerald-400 select-none">
                {currentUser.avatarInitials}
              </div>
            </div>

            {/* Botón Salir / Cerrar Sesión completamente independiente */}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-900/80 hover:bg-rose-800 text-white text-xs font-bold rounded-lg border border-rose-600/60 transition shadow-sm cursor-pointer"
              title="Cerrar sesión de forma segura"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-200" />
              <span>Salir</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar - 5 items fully visible, no slider */}
        <div className="grid grid-cols-5 md:hidden py-2 border-t border-emerald-700/60 gap-1">
          <button
            onClick={() => onSelectTab('EQUINO')}
            className={`py-1.5 px-1 rounded-md text-xs font-medium text-center truncate ${
              currentTab === 'EQUINO' ? 'bg-emerald-800 text-white font-bold' : 'text-emerald-100'
            }`}
          >
            🐎 Equino
          </button>
          <button
            onClick={() => onSelectTab('BOVINO')}
            className={`py-1.5 px-1 rounded-md text-xs font-medium text-center truncate ${
              currentTab === 'BOVINO' ? 'bg-emerald-800 text-white font-bold' : 'text-emerald-100'
            }`}
          >
            🐂 Bovino
          </button>
          <button
            onClick={() => onSelectTab('PROPIETARIOS')}
            className={`py-1.5 px-1 rounded-md text-xs font-medium text-center truncate ${
              currentTab === 'PROPIETARIOS' ? 'bg-emerald-800 text-white font-bold' : 'text-emerald-100'
            }`}
          >
            👥 Censo
          </button>
          <button
            onClick={() => onSelectTab('HISTORICO')}
            className={`py-1.5 px-1 rounded-md text-xs font-medium text-center truncate ${
              currentTab === 'HISTORICO' ? 'bg-emerald-800 text-white font-bold' : 'text-emerald-100'
            }`}
          >
            📋 Histórico
          </button>
          <button
            onClick={() => onSelectTab('AJUSTES')}
            className={`py-1.5 px-1 rounded-md text-xs font-medium text-center truncate ${
              currentTab === 'AJUSTES' ? 'bg-emerald-800 text-white font-bold' : 'text-emerald-100'
            }`}
          >
            ⚙️ Ajustes
          </button>
        </div>
      </div>
    </header>
  );
};
