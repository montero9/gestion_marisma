import React from 'react';
import { User } from '../types/marisma';

interface FooterProps {
  currentUser?: User | null;
}

export const Footer: React.FC<FooterProps> = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-3.5 px-4 sm:px-6 lg:px-8 text-xs text-gray-500 shadow-sm mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="font-semibold text-gray-700 flex items-center gap-2">
          <span>Ayuntamiento de Hinojos</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500 font-normal">Control Ganadero</span>
        </div>

        <div className="text-gray-400 text-[11px]">
          © {new Date().getFullYear()} Excmo. Ayuntamiento de Hinojos
        </div>
      </div>
    </footer>
  );
};
