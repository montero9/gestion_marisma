import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { EntradaRemesa, EntradaPersona } from '../../src/types/marisma.js';
import { PLANTILLA_ENTRADAS_DONANA_BASE64 } from '../templates/embeddedTemplates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTemplateBuffer(): Buffer {
  const candidatePaths = [
    path.resolve(__dirname, '../templates/plantilla_entradas_donana.ods'),
    path.resolve(process.cwd(), 'server/templates/plantilla_entradas_donana.ods'),
    path.resolve(process.cwd(), 'templates/plantilla_entradas_donana.ods'),
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  return Buffer.from(PLANTILLA_ENTRADAS_DONANA_BASE64, 'base64');
}

function escapeXml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formatea los animales de una persona en la cadena estándar de observaciones de Doñana:
 * Ej: "HI001 (724019010080788) + HI002 (724019010064247)"
 */
export function formatAnimalesObservaciones(persona: EntradaPersona): string {
  if (!persona.esTitular) {
    return '“';
  }
  if (persona.animales && persona.animales.length > 0) {
    return persona.animales
      .map((a) => {
        const plaza = (a.plazaNumero || '').trim().toUpperCase();
        const chip = (a.identificacionChip || '').trim();
        return `${plaza} (${chip})`;
      })
      .join(' + ');
  }
  return persona.observacionesRaw || '';
}

/**
 * Genera el archivo ODS oficial con el formato exacto requerido por el Espacio Natural de Doñana.
 */
export async function generateEntradaOds(remesa: EntradaRemesa): Promise<Buffer> {
  const templateBuffer = getTemplateBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);

  const contentXmlFile = zip.file('content.xml');
  if (!contentXmlFile) {
    throw new Error('No se encontró content.xml en la plantilla ODS de Doñana');
  }

  let contentXml = await contentXmlFile.async('string');

  // 1. Actualizar el título oficial en la Fila 2 (ej. "PERMISOS PARA EL 24/10 Y 25/10")
  const tituloOficial = remesa.tituloOficial || 'PERMISOS DE ENTRADA A LA MARISMA DE HINOJOS';
  contentXml = contentXml.replace(
    /(<text:p>)PERMISOS PARA EL [^<]*(<\/text:p>)/i,
    `$1${escapeXml(tituloOficial)}$2`
  );

  // Inyectar estilos personalizados para asegurar que todas las celdas tengan bordes completos
  // y que la línea vertical entre FAENA y FINCA no falte.
  const customStylesXml = `
    <style:style style:name="ce_entr_dia" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="1.76pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="none" fo:border-bottom="none" style:vertical-align="middle"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="9pt" fo:color="#000000"/>
    </style:style>
    <style:style style:name="ce_entr_mid" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="none" fo:border-bottom="none" style:vertical-align="middle" fo:wrap-option="wrap"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="10pt" fo:color="#000000"/>
    </style:style>
    <style:style style:name="ce_entr_faena" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="none" fo:border-bottom="none" style:vertical-align="middle"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="10pt" fo:color="#ff0000"/>
    </style:style>
    <style:style style:name="ce_entr_obs" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="1.76pt solid #000000" fo:border-top="none" fo:border-bottom="none" style:vertical-align="middle" fo:wrap-option="wrap"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="10pt" fo:color="#000000"/>
    </style:style>
    <style:style style:name="ce_entr_sep_dia" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="1.76pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="0.74pt solid #000000" fo:border-bottom="0.74pt solid #000000" style:vertical-align="middle"/>
    </style:style>
    <style:style style:name="ce_entr_sep_mid" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="0.74pt solid #000000" fo:border-bottom="0.74pt solid #000000" style:vertical-align="middle"/>
    </style:style>
    <style:style style:name="ce_entr_sep_obs" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="1.76pt solid #000000" fo:border-top="0.74pt solid #000000" fo:border-bottom="0.74pt solid #000000" style:vertical-align="middle"/>
    </style:style>
    <style:style style:name="ce_entr_last_dia" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="1.76pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="none" fo:border-bottom="1.76pt solid #000000" style:vertical-align="middle"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="9pt" fo:color="#000000"/>
    </style:style>
    <style:style style:name="ce_entr_last_mid" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="none" fo:border-bottom="1.76pt solid #000000" style:vertical-align="middle" fo:wrap-option="wrap"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="10pt" fo:color="#000000"/>
    </style:style>
    <style:style style:name="ce_entr_last_faena" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="0.74pt solid #000000" fo:border-top="none" fo:border-bottom="1.76pt solid #000000" style:vertical-align="middle"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="10pt" fo:color="#ff0000"/>
    </style:style>
    <style:style style:name="ce_entr_last_obs" style:family="table-cell" style:parent-style-name="Default">
      <style:table-cell-properties fo:border-left="0.74pt solid #000000" fo:border-right="1.76pt solid #000000" fo:border-top="none" fo:border-bottom="1.76pt solid #000000" style:vertical-align="middle" fo:wrap-option="wrap"/>
      <style:paragraph-properties fo:text-align="center"/>
      <style:text-properties fo:font-name="Arial" fo:font-size="10pt" fo:color="#000000"/>
    </style:style>
  `;
  contentXml = contentXml.replace('</office:automatic-styles>', `${customStylesXml}\n</office:automatic-styles>`);

  // 2. Extraer las filas de cabecera (Filas 1 a 6) antes de la primera fila de datos reales
  // En la plantilla, la Fila 5 tiene la cabecera 'DIA ENTRADA' y la Fila 6 es un separador vacío
  const tableStartMatch = contentXml.match(/<table:table\b[^>]*>/);
  if (!tableStartMatch) {
    throw new Error('No se encontró elemento table:table en content.xml');
  }

  // Localizar dónde terminan las filas de cabecera (buscando después de 'OBSERVACIONES' y el cierre de fila)
  const obsIndex = contentXml.indexOf('OBSERVACIONES');
  if (obsIndex === -1) {
    throw new Error('No se encontró la cabecera OBSERVACIONES en content.xml');
  }

  // Buscar el cierre de la fila que contiene OBSERVACIONES y la fila separadora posterior
  const headerRowEnd = contentXml.indexOf('</table:table-row>', obsIndex);
  // Buscar la siguiente fila que es la fila vacía separadora (Fila 6)
  const separatorRowEnd = contentXml.indexOf('</table:table-row>', headerRowEnd + '</table:table-row>'.length);
  const dataInsertPoint = separatorRowEnd + '</table:table-row>'.length;

  const xmlBeforeData = contentXml.slice(0, dataInsertPoint);
  const tableEndIndex = contentXml.lastIndexOf('</table:table>');
  const xmlAfterData = contentXml.slice(tableEndIndex);

  // 3. Generar las filas de datos según las personas autorizadas
  const personas = remesa.personas || [];
  let dataRowsXml = '';

  // Agrupar por fecha/día para mantener separación estética limpia entre días si hay más de uno
  const groupedByDate: { [date: string]: EntradaPersona[] } = {};
  for (const p of personas) {
    const key = p.fecha || p.diaSemana || 'GENERAL';
    if (!groupedByDate[key]) groupedByDate[key] = [];
    groupedByDate[key].push(p);
  }

  const dateKeys = Object.keys(groupedByDate);
  dateKeys.forEach((dKey, dIndex) => {
    // Si no es el primer grupo de días, agregar una fila separadora con bordes completos
    if (dIndex > 0) {
      dataRowsXml += `
        <table:table-row table:style-name="ro1">
          <table:table-cell/>
          <table:table-cell table:style-name="ce_entr_sep_dia"/>
          <table:table-cell table:number-columns-repeated="5" table:style-name="ce_entr_sep_mid"/>
          <table:table-cell table:style-name="ce_entr_sep_obs"/>
        </table:table-row>`;
    }

    const groupPersons = groupedByDate[dKey];
    groupPersons.sort((a, b) => (a.ordenFila ?? 0) - (b.ordenFila ?? 0));

    const isLastGroup = dIndex === dateKeys.length - 1;

    for (let pIdx = 0; pIdx < groupPersons.length; pIdx++) {
      const persona = groupPersons[pIdx];
      const isLastRowOfTable = isLastGroup && pIdx === groupPersons.length - 1;

      const dia = (persona.diaSemana || '').toUpperCase();
      const nombre = (persona.nombreApellidos || '').toUpperCase();
      const faena = persona.esTitular ? (persona.faena || 'REPASAR').toUpperCase() : '“';
      const finca = 'MARISMA DE HINOJOS';
      const matriculas = persona.esTitular ? (persona.matriculas || '').toUpperCase() : '“';
      const telefono = persona.esTitular ? (persona.telefono || '') : '“';
      const obs = formatAnimalesObservaciones(persona);

      const styleDia = isLastRowOfTable ? 'ce_entr_last_dia' : 'ce_entr_dia';
      const styleMid = isLastRowOfTable ? 'ce_entr_last_mid' : 'ce_entr_mid';
      const styleFaena = isLastRowOfTable ? 'ce_entr_last_faena' : 'ce_entr_faena';
      const styleObs = isLastRowOfTable ? 'ce_entr_last_obs' : 'ce_entr_obs';

      dataRowsXml += `
        <table:table-row table:style-name="ro1">
          <table:table-cell/>
          <table:table-cell office:value-type="string" table:style-name="${styleDia}">
            <text:p>${escapeXml(dia)}</text:p>
          </table:table-cell>
          <table:table-cell office:value-type="string" table:style-name="${styleMid}">
            <text:p>${escapeXml(nombre)}</text:p>
          </table:table-cell>
          <table:table-cell office:value-type="string" table:style-name="${styleFaena}">
            <text:p>${escapeXml(faena)}</text:p>
          </table:table-cell>
          <table:table-cell office:value-type="string" table:style-name="${styleMid}">
            <text:p>${escapeXml(finca)}</text:p>
          </table:table-cell>
          <table:table-cell office:value-type="string" table:style-name="${styleMid}">
            <text:p>${escapeXml(matriculas)}</text:p>
          </table:table-cell>
          <table:table-cell office:value-type="string" table:style-name="${styleMid}">
            <text:p>${escapeXml(telefono)}</text:p>
          </table:table-cell>
          <table:table-cell office:value-type="string" table:style-name="${styleObs}">
            <text:p>${escapeXml(obs)}</text:p>
          </table:table-cell>
        </table:table-row>`;
    }
  });

  // Ensamblar el nuevo XML
  const finalContentXml = xmlBeforeData + dataRowsXml + '\n' + xmlAfterData;
  zip.file('content.xml', finalContentXml);

  return await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
