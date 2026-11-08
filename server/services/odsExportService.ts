import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { Animal, Stallion, Movement, Owner, Rastra } from '../../src/types/marisma';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to escape XML special characters
function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Format date to DD/MM/YYYY or DD/MM/YY
function formatDate(dateStr?: string, shortYear = false): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  // Already DD/MM/YYYY or DD/MM/YY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    return trimmed;
  }
  // ISO date YYYY-MM-DD
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = shortYear ? match[1].slice(-2) : match[1];
    return `${match[3]}/${match[2]}/${y}`;
  }
  return trimmed;
}

// Split owner full name into Nombre and Apellidos
function splitOwnerName(fullName: string): { nombre: string; apellidos: string } {
  if (!fullName) return { nombre: '', apellidos: '' };
  const clean = fullName.trim();
  if (clean.includes(',')) {
    const parts = clean.split(',');
    return {
      nombre: parts[1]?.trim() || '',
      apellidos: parts[0]?.trim() || '',
    };
  }
  const words = clean.split(/\s+/);
  if (words.length <= 1) {
    return { nombre: words[0] || '', apellidos: '' };
  }
  if (words.length === 2) {
    return { nombre: words[0], apellidos: words[1] };
  }
  if (words.length === 3) {
    return { nombre: words[0], apellidos: `${words[1]} ${words[2]}` };
  }
  return {
    nombre: words.slice(0, words.length - 2).join(' '),
    apellidos: words.slice(-2).join(' '),
  };
}

// Extract 4-digit birth year (handles YYYY, DD/MM/YYYY, DD/MM/YY)
function extractYear(dateStr?: string): string {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const m4 = clean.match(/\b(19\d\d|20\d\d)\b/);
  if (m4) return m4[1];
  const m2 = clean.match(/\/\d{1,2}\/(\d{2})$/);
  if (m2) {
    const yr = parseInt(m2[1], 10);
    return yr > 50 ? `19${m2[1]}` : `20${m2[1]}`;
  }
  return clean;
}

// Format plaza to "HIN 001" template standard
function formatPlazaBovino(plaza?: string): string {
  if (!plaza) return '';
  const clean = plaza.trim().toUpperCase();
  const m = clean.match(/^HIN\s*(\d+)$/);
  if (m) {
    const num = m[1].padStart(3, '0');
    return `HIN ${num}`;
  }
  return clean;
}

// Custom styles XML to inject into <office:automatic-styles>
const CUSTOM_STYLES_XML = `
<!-- CUSTOM MARISMA STYLES -->
<style:style style:name="marisma-hdr-gray" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#b2b2b2" fo:border="0.74pt solid #000000" style:vertical-align="middle" fo:wrap-option="no-wrap"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#000000" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-hdr-blue" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#afabab" fo:border="0.74pt solid #000000" style:vertical-align="middle" fo:wrap-option="no-wrap"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#000000" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-hdr-yellow" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#ffc000" fo:border="0.74pt solid #000000" style:vertical-align="middle" fo:wrap-option="no-wrap"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#000000" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-cell-plaza" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#35539f" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#ffffff" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-cell-finca" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#ffe994" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:color="#1b1b1b" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-cell-chip" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#81d41a" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:color="#1b1b1b" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-cell-center" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="transparent" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:color="#000000" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-cell-left" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="transparent" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="left" fo:margin-left="0.15cm"/>
  <style:text-properties fo:font-size="11pt" fo:color="#000000" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-mov-entrada" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#d1fae5" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#065f46" style:font-name="Calibri"/>
</style:style>

<style:style style:name="marisma-mov-salida" style:family="table-cell" style:parent-style-name="Default">
  <style:table-cell-properties fo:background-color="#fee2e2" fo:border="0.74pt solid #000000" style:vertical-align="middle"/>
  <style:paragraph-properties fo:text-align="center"/>
  <style:text-properties fo:font-size="11pt" fo:font-weight="bold" fo:color="#991b1b" style:font-name="Calibri"/>
</style:style>

<!-- Custom Column Width Styles -->
<style:style style:name="co_plz" style:family="table-column">
  <style:table-column-properties style:column-width="2.3cm"/>
</style:style>
<style:style style:name="co_nom" style:family="table-column">
  <style:table-column-properties style:column-width="6.5cm"/>
</style:style>
<style:style style:name="co_fca" style:family="table-column">
  <style:table-column-properties style:column-width="3.2cm"/>
</style:style>
<style:style style:name="co_chp" style:family="table-column">
  <style:table-column-properties style:column-width="4.8cm"/>
</style:style>
<style:style style:name="co_med" style:family="table-column">
  <style:table-column-properties style:column-width="4.0cm"/>
</style:style>
<style:style style:name="co_sml" style:family="table-column">
  <style:table-column-properties style:column-width="2.0cm"/>
</style:style>
<style:style style:name="co_lrg" style:family="table-column">
  <style:table-column-properties style:column-width="8.0cm"/>
</style:style>
`;

export interface GenerateOdsOptions {
  campaign: string;
  animals: Animal[];
  stallions: Stallion[];
  movements: Movement[];
  owners: Owner[];
}

export interface GenerateBovinosOdsOptions {
  campaign: string;
  animals: Animal[];
  owners: Owner[];
}

export class OdsExportService {
  /**
   * Genera el libro ODS maestro con 4 hojas siguiendo la estética de la plantilla
   */
  public static async generateEquinosWorkbook(options: GenerateOdsOptions): Promise<Buffer> {
    const { campaign, animals, stallions, movements, owners } = options;

    const templatePath = path.resolve(__dirname, '../templates/plantilla_equino.ods');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontró la plantilla ODS en: ${templatePath}`);
    }

    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);

    let contentXml = await zip.file('content.xml')!.async('string');

    // 1. Inyectar estilos personalizados en <office:automatic-styles>
    const autoStylesEndTag = '</office:automatic-styles>';
    const autoStylesIdx = contentXml.indexOf(autoStylesEndTag);
    if (autoStylesIdx !== -1) {
      contentXml =
        contentXml.substring(0, autoStylesIdx) +
        CUSTOM_STYLES_XML +
        contentXml.substring(autoStylesIdx);
    }

    // 2. Localizar inicio y fin de <office:spreadsheet>
    const spreadsheetStartTag = '<office:spreadsheet>';
    const spreadsheetEndTag = '</office:spreadsheet>';
    const ssStartIdx = contentXml.indexOf(spreadsheetStartTag);
    const ssEndIdx = contentXml.indexOf(spreadsheetEndTag);

    if (ssStartIdx === -1 || ssEndIdx === -1) {
      throw new Error('Formato ODS inválido: no se encontró office:spreadsheet');
    }

    // Extraer hoja 1 si existe (PLAZAS ANCGM oculta, para preservarla intacta)
    const originalSpreadsheetContent = contentXml.substring(
      ssStartIdx + spreadsheetStartTag.length,
      ssEndIdx
    );

    let hiddenPlazasTable = '';
    const hiddenTableMatch = originalSpreadsheetContent.match(
      /<table:table[^>]*table:name="PLAZAS ANCGM"[\s\S]*?<\/table:table>/
    );
    if (hiddenTableMatch) {
      hiddenPlazasTable = hiddenTableMatch[0];
    }

    // 3. Generar Hoja 1: EQUINOS [CAMPAÑA]
    const sheet1Xml = OdsExportService.buildEquinosCampaignSheet(campaign, animals);

    // 4. Generar Hoja 2: SEMENTALES EQUINOS [CAMPAÑA]
    const sheet2Xml = OdsExportService.buildStallionsCampaignSheet(campaign, stallions);

    // 5. Generar Hoja 3: EXPEDIENTE POR ANIMAL (Histórico multi-campaña)
    const sheet3Xml = OdsExportService.buildExpedientesSheet(animals, movements);

    // 6. Generar Hoja 4: LIBRO CRONOLÓGICO DE MOVIMIENTOS
    const sheet4Xml = OdsExportService.buildLibroCronologicoSheet(movements, animals);

    // 7. Ensamblar todas las tablas dentro de <office:spreadsheet>
    const newSpreadsheetXml =
      spreadsheetStartTag +
      (hiddenPlazasTable ? '\n' + hiddenPlazasTable : '') +
      '\n' +
      sheet1Xml +
      '\n' +
      sheet2Xml +
      '\n' +
      sheet3Xml +
      '\n' +
      sheet4Xml +
      '\n' +
      spreadsheetEndTag;

    contentXml =
      contentXml.substring(0, ssStartIdx) +
      newSpreadsheetXml +
      contentXml.substring(ssEndIdx + spreadsheetEndTag.length);

    // Guardar el XML modificado en el zip
    zip.file('content.xml', contentXml);

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Genera el libro ODS oficial para Bovinos (1 sola hoja, réplica exacta de la plantilla oficial)
   */
  public static async generateBovinosWorkbook(options: GenerateBovinosOdsOptions): Promise<Buffer> {
    const { campaign, animals, owners } = options;

    const templatePath = path.resolve(__dirname, '../templates/plantilla_bovino.ods');
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontró la plantilla ODS de bovino en: ${templatePath}`);
    }

    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);

    let contentXml = await zip.file('content.xml')!.async('string');

    // Localizar inicio y fin de <office:spreadsheet>
    const spreadsheetStartTag = '<office:spreadsheet>';
    const spreadsheetEndTag = '</office:spreadsheet>';
    const ssStartIdx = contentXml.indexOf(spreadsheetStartTag);
    const ssEndIdx = contentXml.indexOf(spreadsheetEndTag);

    if (ssStartIdx === -1 || ssEndIdx === -1) {
      throw new Error('Formato ODS inválido: no se encontró office:spreadsheet');
    }

    // Generar la única hoja (Hoja1) idéntica a la plantilla
    const sheetXml = OdsExportService.buildBovinosSheet(campaign, animals, owners);

    const newSpreadsheetXml = `${spreadsheetStartTag}\n${sheetXml}\n${spreadsheetEndTag}`;
    contentXml =
      contentXml.substring(0, ssStartIdx) +
      newSpreadsheetXml +
      contentXml.substring(ssEndIdx + spreadsheetEndTag.length);

    zip.file('content.xml', contentXml);

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Hoja única: Censo oficial de Bovino con la estética exacta de la plantilla
   */
  private static buildBovinosSheet(campaign: string, allAnimals: Animal[], owners: Owner[]): string {
    const bovinos = allAnimals
      .filter((a) => a.tipo === 'BOVINO' && a.campana === campaign && !a.esPlazaVacante)
      .sort((a, b) => (a.plazaNumero || '').localeCompare(b.plazaNumero || '', undefined, { numeric: true }));

    // Agrupar por ganadero manteniendo el orden correlativo de plazas
    const groups = new Map<string, Animal[]>();
    for (const a of bovinos) {
      const ownerKey = (a.propietario || '').trim().toUpperCase() || 'SIN ASIGNAR';
      if (!groups.has(ownerKey)) {
        groups.set(ownerKey, []);
      }
      groups.get(ownerKey)!.push(a);
    }

    let out = `<table:table table:name="Hoja1" table:style-name="ta1">\n`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>\n`;
    out += `  <table:table-column table:style-name="co1" table:default-cell-style-name="ce13"/>\n`;
    out += `  <table:table-column table:style-name="co2" table:default-cell-style-name="ce13"/>\n`;
    out += `  <table:table-column table:style-name="co3" table:default-cell-style-name="ce13"/>\n`;
    out += `  <table:table-column table:style-name="co3" table:default-cell-style-name="ce13"/>\n`;
    out += `  <table:table-column table:style-name="co4" table:default-cell-style-name="ce13"/>\n`;
    out += `  <table:table-column table:style-name="co5" table:default-cell-style-name="ce38"/>\n`;
    out += `  <table:table-column table:style-name="co6" table:default-cell-style-name="ce38"/>\n`;
    out += `  <table:table-column table:style-name="co7" table:default-cell-style-name="ce13"/>\n`;
    out += `  <table:table-column table:style-name="co8" table:default-cell-style-name="ce52"/>\n`;

    // Fila 1: Encabezados (Fondo amarillo institucional #ffff00)
    out += `  <table:table-row table:style-name="ro1">\n`;
    out += `    <table:table-cell table:style-name="ce1" office:value-type="string"><text:p>PLAZA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>TOTAL</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>NIF</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>APELLIDOS</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>AÑO NACIMIENTO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>N.º CROTAL</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>ULTIMA REVISION</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    let totalAnimals = 0;
    for (const [ownerKey, animalList] of groups.entries()) {
      const ownerObj =
        owners.find((o) => (o.nombreCompleto || '').trim().toUpperCase() === ownerKey) ||
        owners.find(
          (o) =>
            (o.nombreCompleto || '').replace(/\d+$/, '').trim().toUpperCase() ===
            ownerKey.replace(/\d+$/, '').trim().toUpperCase()
        );
      const nif = ownerObj?.dniCif || '';
      const { nombre, apellidos } = splitOwnerName(ownerKey);

      animalList.forEach((anim, idx) => {
        totalAnimals++;
        const isLast = idx === animalList.length - 1;
        const plazaFormatted = formatPlazaBovino(anim.plazaNumero);
        const sexo = (anim.sexo || 'H').toUpperCase().charAt(0);
        const birthYear = extractYear(anim.fechaNacimiento);
        const crotal = anim.identificacion1 || '';
        const revDate = formatDate(anim.fechaUltimaRevision);

        out += `  <table:table-row table:style-name="ro2">\n`;
        out += `    <table:table-cell table:style-name="ce2" office:value-type="string"><text:p>${escapeXml(plazaFormatted)}</text:p></table:table-cell>\n`;
        if (isLast) {
          out += `    <table:table-cell table:style-name="ce18" office:value-type="float" office:value="${animalList.length}"><text:p>${animalList.length}</text:p></table:table-cell>\n`;
        } else {
          out += `    <table:table-cell table:style-name="ce15"/>\n`;
        }
        out += `    <table:table-cell table:style-name="ce2" office:value-type="string"><text:p>${escapeXml(nif)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(nombre)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(apellidos)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="ce29" office:value-type="string"><text:p>${escapeXml(sexo)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(birthYear)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(crotal)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="ce45" office:value-type="string"><text:p>${escapeXml(revDate)}</text:p></table:table-cell>\n`;
        out += `  </table:table-row>\n`;
      });
    }

    // Fila separadora vacía
    out += `  <table:table-row table:style-name="ro2">\n`;
    out += `    <table:table-cell table:style-name="ce3"/>\n`;
    out += `    <table:table-cell table:style-name="ce16" table:number-columns-repeated="4"/>\n`;
    out += `    <table:table-cell table:style-name="ce23"/>\n`;
    out += `    <table:table-cell table:style-name="ce16" table:number-columns-repeated="2"/>\n`;
    out += `    <table:table-cell table:style-name="ce46"/>\n`;
    out += `  </table:table-row>\n`;

    // Fila TOTAL general (fondo naranja #ff8000)
    out += `  <table:table-row table:style-name="ro2">\n`;
    out += `    <table:table-cell table:style-name="ce6" office:value-type="string"><text:p>TOTAL</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce21" office:value-type="float" office:value="${totalAnimals}"><text:p>${totalAnimals}</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    // Fila FECHA de emisión (fondo ámbar #ffbf00)
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = String(now.getFullYear()).slice(-2);
    const nowFormatted = `${d}/${m}/${y}`;
    const nowIso = now.toISOString().slice(0, 10);

    out += `  <table:table-row table:style-name="ro2">\n`;
    out += `    <table:table-cell table:style-name="ce7" office:value-type="string"><text:p>FECHA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="ce22" office:value-type="date" office:date-value="${nowIso}"><text:p>${nowFormatted}</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    out += `</table:table>\n`;
    return out;
  }

  /**
   * Hoja 1: Censo de Equinos con Titulares y Crías en la Campaña Activa
   */
  private static buildEquinosCampaignSheet(campaign: string, allAnimals: Animal[]): string {
    const list = allAnimals
      .filter((a) => a.tipo === 'EQUINO' && a.campana === campaign)
      .sort((a, b) => (a.plazaNumero || '').localeCompare(b.plazaNumero || '', undefined, { numeric: true }));

    let out = `<table:table table:name="EQUINOS ${escapeXml(campaign)}" table:style-name="ta2">\n`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>\n`;

    // Declaración de columnas (con anchos idénticos a la plantilla)
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Plaza
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Titular
    out += `  <table:table-column table:style-name="co_fca"/>\n`; // Finca
    out += `  <table:table-column table:style-name="co_chp"/>\n`; // Identificación 1 (Chip)
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Identificación 2 (UELN)
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Nombre animal
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Sexo
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // FN
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Capa
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Fecha Ul RV
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Sep
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Propietario Rastra
    out += `  <table:table-column table:style-name="co_chp"/>\n`; // Chip Rastra
    out += `  <table:table-column table:style-name="co_med"/>\n`; // UELN Rastra
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Nombre Rastra
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Sexo Rastra
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // FN Rastra
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Capa Rastra
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // F Entrd
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // F Salida

    // Fila 1: Encabezados principales + Rastras
    out += `  <table:table-row table:style-name="ro4">\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-blue" office:value-type="string"><text:p>Nº PLAZA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FINCA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 1</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 2</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FN</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA UL RV</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-cell-center"/>\n`; // Espaciador
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>PROPIETARIO RASTRA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>RASTRAS</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>UELN</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>SEX RSTRA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>FN RASTRA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>F ENTRD</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>F SALIDA</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    // Filas de datos
    for (const a of list) {
      const r = a.rastra as (Rastra & { identificacion1?: string; identificacion2?: string; propietario?: string }) | undefined;
      out += `  <table:table-row table:style-name="ro1">\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-plaza" office:value-type="string"><text:p>${escapeXml(a.plazaNumero)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(a.propietario)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-finca" office:value-type="string"><text:p>${escapeXml(a.finca || 'HINOJOS')}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(a.identificacion1)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.identificacion2)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.nombreAnimal)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.sexo)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(a.fechaNacimiento, true))}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.capa)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(a.actualizadoEn, true))}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center"/>\n`; // Separador

      // Rastra
      if (r) {
        const rastraPropietario = r.propietarioRastra || r.propietario || a.propietario;
        const rastraChip = r.rastrasChip || r.identificacion1 || '';
        const rastraUeln = r.ueln || r.identificacion2 || '';

        out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(rastraPropietario)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(rastraChip)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(rastraUeln)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(r.nombre)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(r.sexo)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(r.fechaNacimiento, true))}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(r.capa)}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(r.fechaEntrada, true))}</text:p></table:table-cell>\n`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(r.fechaSalida, true))}</text:p></table:table-cell>\n`;
      } else {
        out += `    <table:table-cell table:style-name="marisma-cell-center" table:number-columns-repeated="9"/>\n`;
      }
      out += `  </table:table-row>\n`;
    }

    out += `</table:table>\n`;
    return out;
  }

  /**
   * Hoja 2: Sementales Reproductores de la Campaña Activa
   */
  private static buildStallionsCampaignSheet(campaign: string, allStallions: Stallion[]): string {
    const list = allStallions
      .filter((s) => s.tipo === 'EQUINO' && s.campana === campaign)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    let out = `<table:table table:name="SEMENTALES EQUINOS ${escapeXml(campaign)}" table:style-name="ta2">\n`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>\n`;

    // Columnas
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Nombre Titular
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Apellidos Titular
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Cesión
    out += `  <table:table-column table:style-name="co_fca"/>\n`; // Finca
    out += `  <table:table-column table:style-name="co_chp"/>\n`; // Microchip
    out += `  <table:table-column table:style-name="co_med"/>\n`; // UELN
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Nombre Semental
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Sexo
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // FN
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Capa
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Fecha RV

    // Fila 1: Título superior
    out += `  <table:table-row table:style-name="ro6">\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string" table:number-columns-spanned="11"><text:p>SEMENTALES EQUINOS ${escapeXml(campaign)}</text:p></table:table-cell>\n`;
    out += `    <table:covered-table-cell table:number-columns-repeated="10"/>\n`;
    out += `  </table:table-row>\n`;

    // Fila 2: Cabeceras
    out += `  <table:table-row table:style-name="ro5">\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>APELLIDOS</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CESION ANUAL</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FINCA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 1</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 2</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FN</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA UL RV</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    // Filas de datos
    for (const s of list) {
      // Intentar dividir titular en nombre y apellidos
      const parts = (s.propietario || '').trim().split(/\s+/);
      const nombreTitular = parts.length > 1 ? parts[0] : (s.propietario || '');
      const apellidosTitular = parts.length > 1 ? parts.slice(1).join(' ') : '';
      const cesion = (s as any).cesionAnual || '';
      const finca = (s as any).finca || s.zonaMarisma || 'HINOJOS';
      const chip = s.identificacionChip || (s as any).identificacion1 || '';
      const ueln = s.ueln || (s as any).identificacion2 || '';
      const sexo = (s as any).sexo || 'M';
      const fechaRv = (s as any).fechaRevision || '';

      out += `  <table:table-row table:style-name="ro1">\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(nombreTitular)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(apellidosTitular)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(cesion)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-finca" office:value-type="string"><text:p>${escapeXml(finca)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(chip)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(ueln)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(s.nombre)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(sexo)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(s.fechaNacimiento, true))}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(s.capa)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(fechaRv, true))}</text:p></table:table-cell>\n`;
      out += `  </table:table-row>\n`;
    }

    out += `</table:table>\n`;
    return out;
  }

  /**
   * Hoja 3: Expedientes de Todos los Equinos a lo largo de Todas las Campañas
   */
  private static buildExpedientesSheet(animals: Animal[], movements: Movement[]): string {
    // 1. Agrupar animales equinos por Microchip (identificador único primario)
    const recordMap = new Map<
      string,
      {
        animal: Animal;
        latestPlaza: string;
        campaigns: Set<string>;
        movementsCount: number;
        documentsCount: number;
        annotationsText: string;
      }
    >();

    const getChipKey = (chip?: string) => (chip || '').trim().toUpperCase();

    // Recorrer todos los animales equinos
    for (const animal of animals) {
      if (animal.tipo !== 'EQUINO') continue;

      const chipKey = getChipKey(animal.identificacion1) || animal.id;
      const existing = recordMap.get(chipKey);

      if (!existing) {
        const campaigns = new Set<string>();
        if (animal.campana) campaigns.add(animal.campana);

        const notes = (animal.anotaciones || []).map((a) => a.texto).filter(Boolean).join(' | ');

        recordMap.set(chipKey, {
          animal: { ...animal },
          latestPlaza: animal.plazaNumero || '',
          campaigns,
          movementsCount: 0,
          documentsCount: (animal.documentos || []).length,
          annotationsText: notes,
        });
      } else {
        if (animal.campana) existing.campaigns.add(animal.campana);
        if (animal.plazaNumero) existing.latestPlaza = animal.plazaNumero;

        // Conservar datos más recientes
        if (animal.propietario) existing.animal.propietario = animal.propietario;
        if (animal.nombreAnimal) existing.animal.nombreAnimal = animal.nombreAnimal;
        if (animal.estadoPresencia) existing.animal.estadoPresencia = animal.estadoPresencia;
        if (animal.documentos) {
          existing.documentsCount = Math.max(existing.documentsCount, animal.documentos.length);
        }
        if (animal.anotaciones && animal.anotaciones.length > 0) {
          const incomingNotes = animal.anotaciones.map((a) => a.texto).filter(Boolean).join(' | ');
          if (incomingNotes && !existing.annotationsText.includes(incomingNotes)) {
            existing.annotationsText = existing.annotationsText
              ? `${existing.annotationsText} | ${incomingNotes}`
              : incomingNotes;
          }
        }
      }
    }

    // Contabilizar movimientos de cada expediente
    for (const m of movements) {
      if (m.tipoAnimal !== 'EQUINO') continue;
      // Buscar por ID de animal o por nombre/propietario
      let target: any = null;
      for (const rec of recordMap.values()) {
        if (rec.animal.id === m.animalId) {
          target = rec;
          break;
        }
        if (
          rec.animal.nombreAnimal.trim().toLowerCase() === m.nombreAnimal.trim().toLowerCase() &&
          rec.animal.propietario.trim().toLowerCase() === m.propietario.trim().toLowerCase()
        ) {
          target = rec;
          break;
        }
      }
      if (target) {
        target.movementsCount++;
        const camp = (m as any).campana || target.animal.campana;
        if (camp) target.campaigns.add(camp);
        if (!target.latestPlaza && m.plazaNumero) target.latestPlaza = m.plazaNumero;
      }
    }

    const records = Array.from(recordMap.values()).sort((a, b) =>
      a.animal.nombreAnimal.localeCompare(b.animal.nombreAnimal)
    );

    let out = `<table:table table:name="EXPEDIENTE POR ANIMAL" table:style-name="ta2">\n`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>\n`;

    // Declaración de columnas
    out += `  <table:table-column table:style-name="co_chp"/>\n`; // Microchip
    out += `  <table:table-column table:style-name="co_med"/>\n`; // UELN
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Nombre
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Sexo
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Capa
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // FN
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Titular
    out += `  <table:table-column table:style-name="co_fca"/>\n`; // Estado Presencia
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Última Plaza
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Total Movs
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Campañas
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Rastra
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Docs
    out += `  <table:table-column table:style-name="co_lrg"/>\n`; // Notas

    // Encabezados
    out += `  <table:table-row table:style-name="ro4">\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>MICROCHIP</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>UELN / PASAPORTE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE ANIMAL</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA NACIMIENTO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TITULAR / GANADERO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>ESTADO PRESENCIA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-blue" office:value-type="string"><text:p>ÚLTIMA PLAZA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TOTAL MOVS</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAMPAÑAS HISTÓRICAS</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>CRÍA / RASTRA ASOCIADA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>DOCS ADJUNTOS</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOTAS DEL EXPEDIENTE</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    // Filas de datos
    for (const rec of records) {
      const a = rec.animal;
      const campanasStr = Array.from(rec.campaigns).sort().join(', ');
      const r = a.rastra as (Rastra & { identificacion1?: string }) | undefined;
      const chipRastra = r ? (r.rastrasChip || r.identificacion1 || '') : '';
      const rastraStr = r ? `${r.nombre || ''} (${chipRastra})` : '';

      out += `  <table:table-row table:style-name="ro1">\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(a.identificacion1)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.identificacion2)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(a.nombreAnimal)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.sexo)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.capa)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(a.fechaNacimiento))}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(a.propietario)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.estadoPresencia || 'DENTRO')}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-plaza" office:value-type="string"><text:p>${escapeXml(rec.latestPlaza)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="float" office:value="${rec.movementsCount}"><text:p>${rec.movementsCount}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(campanasStr)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(rastraStr)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="float" office:value="${rec.documentsCount}"><text:p>${rec.documentsCount}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(rec.annotationsText)}</text:p></table:table-cell>\n`;
      out += `  </table:table-row>\n`;
    }

    out += `</table:table>\n`;
    return out;
  }

  /**
   * Hoja 4: Libro Cronológico de Movimientos Equinos
   */
  private static buildLibroCronologicoSheet(movements: Movement[], allAnimals: Animal[]): string {
    const list = movements
      .filter((m) => m.tipoAnimal === 'EQUINO')
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());

    // Crear mapa rápido para enriquecer movimientos con chip y ueln del animal
    const animalById = new Map<string, Animal>();
    for (const an of allAnimals) {
      animalById.set(an.id, an);
    }

    let out = `<table:table table:name="LIBRO CRONOLOGICO" table:style-name="ta2">\n`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>\n`;

    // Declaración de columnas
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Fecha
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Tipo
    out += `  <table:table-column table:style-name="co_plz"/>\n`; // Plaza
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Nombre animal
    out += `  <table:table-column table:style-name="co_chp"/>\n`; // Microchip
    out += `  <table:table-column table:style-name="co_med"/>\n`; // UELN
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Titular
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Destino / Motivo
    out += `  <table:table-column table:style-name="co_med"/>\n`; // Guía
    out += `  <table:table-column table:style-name="co_sml"/>\n`; // Liberó Plaza
    out += `  <table:table-column table:style-name="co_nom"/>\n`; // Guarda
    out += `  <table:table-column table:style-name="co_lrg"/>\n`; // Observaciones

    // Encabezados
    out += `  <table:table-row table:style-name="ro4">\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TIPO MOVIMIENTO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-blue" office:value-type="string"><text:p>Nº PLAZA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE ANIMAL</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>MICROCHIP</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>UELN</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TITULAR / GANADERO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>MOTIVO / DESTINO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>GUÍA DE MOVIMIENTO</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>LIBERÓ PLAZA</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>GUARDA RESPONSABLE</text:p></table:table-cell>\n`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>OBSERVACIONES</text:p></table:table-cell>\n`;
    out += `  </table:table-row>\n`;

    // Filas de datos
    for (const m of list) {
      const isEntrada = m.tipoMovimiento === 'ENTRADA';
      const tipoStyle = isEntrada ? 'marisma-mov-entrada' : 'marisma-mov-salida';

      const targetAnimal =
        animalById.get(m.animalId) ||
        allAnimals.find(
          (a) =>
            a.nombreAnimal.trim().toLowerCase() === m.nombreAnimal.trim().toLowerCase() &&
            a.propietario.trim().toLowerCase() === m.propietario.trim().toLowerCase()
        );

      const microchip = targetAnimal?.identificacion1 || '';
      const ueln = targetAnimal?.identificacion2 || '';

      out += `  <table:table-row table:style-name="ro1">\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(m.fecha))}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="${tipoStyle}" office:value-type="string"><text:p>${escapeXml(m.tipoMovimiento)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-plaza" office:value-type="string"><text:p>${escapeXml(m.plazaNumero)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.nombreAnimal)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(microchip)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(ueln)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.propietario)}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(m.motivo || '')}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(m.numeroGuia || '')}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${m.liberarPlaza ? 'SÍ' : 'NO'}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.guardaResponsable || '')}</text:p></table:table-cell>\n`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.observaciones || '')}</text:p></table:table-cell>\n`;
      out += `  </table:table-row>\n`;
    }

    out += `</table:table>\n`;
    return out;
  }
}
