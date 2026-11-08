/**
 * Listado oficial de capas y pelajes equinos y bovinos para el censo de la Marisma de Hinojos
 */
export const CAPAS_SEPARATOR = '---------';

export const CAPAS_PELAJES: string[] = [
  'OTRO',
  'TORDO',
  'CASTAÑO',
  'NEGRO',
  'ALAZÁN',
  '---------',
  'ALAZÁN CLARO',
  'ALAZÁN DORADO',
  'ALAZÁN OSCURO',
  'ALAZÁN RUANO',
  'ALAZÁN TOSTADO',
  'ALOBUNADO',
  'APPALOOSA',
  'APPALOOSA BARNIZADO',
  'APPALOOSA COPO DE NIEVE',
  'APPALOOSA LEOPARDO',
  'APPALOOSA MANTA',
  'APPALOOSA MOTEADO',
  'APPALOOSA RUANO',
  'BAYO',
  'BAYO AMARILLO',
  'BAYO CEBRADO',
  'BAYO CEBRUNO',
  'BAYO CLARO',
  'BAYO DORADO',
  'BAYO OSCURO',
  'BLANCO',
  'BOCIFUEGO',
  'CABALLUNO',
  'CAPINO',
  'CASTAÑO CLARO',
  'CASTAÑO ENCENDIDO',
  'CASTAÑO MORCILLO',
  'CASTAÑO OSCURO',
  'CASTAÑO RUANO',
  'CERVUNO',
  'CERVUNO CLARO',
  'CERVUNO OSCURO',
  'CHAMPÁN',
  'CHAMPÁN ÁMBAR',
  'CHAMPÁN CLÁSICO',
  'CHAMPÁN DORADO',
  'CHAMPÁN SABLE',
  'COLORADO',
  'CREMELLO',
  'CREMELLO AHUMADO',
  'DUN',
  'FLOR DE ROMERO',
  'GATEADO',
  'GRIS',
  'GRULLO',
  'GRULLO CLARO',
  'GRULLO OSCURO',
  'ISABELO',
  'ISABELO CLARO',
  'ISABELO OSCURO',
  'LAVANDA',
  'LOBERO',
  'LOBERO CLARO',
  'LOBERO OSCURO',
  'MANCHADO',
  'MELADO',
  'MORCILLO',
  'MOSQUEADO',
  'NEGRO AZABACHE',
  'NEGRO MORCILLO',
  'NEGRO PECEÑO',
  'OVERO',
  'PALOMINO',
  'PALOMINO CLARO',
  'PALOMINO DORADO',
  'PALOMINO TOSTADO',
  'PANGARÉ',
  'PECEÑO',
  'PERLA',
  'PERLINO',
  'PERLINO AHUMADO',
  'PÍO',
  'PÍO ALAZÁN',
  'PÍO CASTAÑO',
  'PÍO NEGRO',
  'PÍO OVERO',
  'PÍO SABINO',
  'PÍO TOBIANO',
  'PLATA',
  'PLATA ALAZÁN',
  'PLATA CASTAÑO',
  'PLATA NEGRO',
  'RATONERO',
  'RATONERO CLARO',
  'RATONERO OSCURO',
  'RETINTO',
  'RODADO',
  'ROSILLO',
  'RUANO',
  'RUANO AZUL',
  'RUANO CASTAÑO',
  'RUANO FRESA',
  'RUANO NEGRO',
  'RUANO ROJO',
  'SABINO',
  'TOBIANO',
  'TORDO APIZARRADO',
  'TORDO ATRUCHADO',
  'TORDO AZULADO',
  'TORDO BLANCO',
  'TORDO MOSQUEADO',
  'TORDO PLATEADO',
  'TORDO RODADO',
  'TORDO SUCIO',
  'TORDO VINOSO',
  'TOSTADO',
  'VINOSO',
  'ZAINO',
  'ZAÍNO OSCURO',
];

/**
 * Calcula el siguiente número de plaza correlativo asegurando el prefijo HI o HIN
 * Busca el número más alto existente con formato HIxxx o HINxxx y suma 1, rellenando con ceros (ej. HI001... / HIN001...)
 */
export function getNextPlazaNumber(
  existingAnimals: { plazaNumero?: string; campana?: string }[] = [],
  targetCampana?: string,
  prefix: 'HI' | 'HIN' = 'HI'
): string {
  let maxNumber = 0;
  for (const animal of existingAnimals) {
    if (!animal.plazaNumero) continue;
    if (targetCampana && animal.campana && animal.campana !== targetCampana) continue;
    const pattern = prefix === 'HIN' ? '^(?:HIN|BV)(\\d+)$' : `^${prefix}(\\d+)$`;
    const regex = new RegExp(pattern, 'i');
    const match = animal.plazaNumero.trim().toUpperCase().match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }
  const nextNumber = maxNumber + 1;
  return `${prefix}${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Formatea una fecha DD/MM/AAAA o DD/MM/AA a YYYY-MM-DD para el input type="date"
 */
export function toInputDate(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[-/]/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) {
      const num = parseInt(year, 10);
      year = num > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month}-${day}`;
  }
  return '';
}

/**
 * Convierte una fecha YYYY-MM-DD al formato legible español DD/MM/AAAA
 */
export function fromInputDate(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }
  return trimmed;
}
