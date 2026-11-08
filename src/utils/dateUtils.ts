/**
 * Formats any date string (ISO YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, or text like "ENTRA 26/04/26")
 * into the required municipal standard format: dd/mm/yy (e.g. 26/04/26).
 */
export function formatDateDDMMYY(val?: string | null): string {
  if (!val || typeof val !== 'string' || !val.trim()) return '-';
  let str = val.trim();

  // Strip prefix words like "ENTRA", "ENTRADA", "REV", "REVISION", "LIBERADA", "SALIDA"
  str = str.replace(/^(entra\s*|entrada\s*|rev\s*|revisión\s*|revision\s*|liberada\s*|salida\s*)/i, '').trim();
  if (!str) return '-';

  // Check if YYYY-MM-DD (e.g. 2025-05-18)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1].slice(-2);
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  // Check if DD/MM/YYYY (e.g. 26/04/2026 or 26-04-2026)
  const dmy4Match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmy4Match) {
    const day = dmy4Match[1].padStart(2, '0');
    const month = dmy4Match[2].padStart(2, '0');
    const year = dmy4Match[3].slice(-2);
    return `${day}/${month}/${year}`;
  }

  // Check if DD/MM/YY (e.g. 26/04/26 or 26-04-26)
  const dmy2Match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (dmy2Match) {
    const day = dmy2Match[1].padStart(2, '0');
    const month = dmy2Match[2].padStart(2, '0');
    const year = dmy2Match[3];
    return `${day}/${month}/${year}`;
  }

  // Try parsing with standard Date object
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = String(parsed.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  }

  return str;
}
