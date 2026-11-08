import React from 'react';

interface HinojosLogoProps {
  className?: string;
  alt?: string;
}

export const HinojosLogo: React.FC<HinojosLogoProps> = ({
  className = 'w-10 h-14',
  alt = 'Escudo Oficial del Excmo. Ayuntamiento de Hinojos',
}) => {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src="/escudo-hinojos.svg"
        alt={alt}
        className="w-full h-full object-contain filter drop-shadow select-none"
        referrerPolicy="no-referrer"
        loading="eager"
      />
    </div>
  );
};
