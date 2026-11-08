// server/index.ts
import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import JSZip2 from "jszip";

// server/services/odsExportService.ts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
function escapeXml(str) {
  if (str === null || str === void 0) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function formatDate(dateStr, shortYear = false) {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const y = shortYear ? match[1].slice(-2) : match[1];
    return `${match[3]}/${match[2]}/${y}`;
  }
  return trimmed;
}
function splitOwnerName(fullName) {
  if (!fullName) return { nombre: "", apellidos: "" };
  const clean = fullName.trim();
  if (clean.includes(",")) {
    const parts = clean.split(",");
    return {
      nombre: parts[1]?.trim() || "",
      apellidos: parts[0]?.trim() || ""
    };
  }
  const words = clean.split(/\s+/);
  if (words.length <= 1) {
    return { nombre: words[0] || "", apellidos: "" };
  }
  if (words.length === 2) {
    return { nombre: words[0], apellidos: words[1] };
  }
  if (words.length === 3) {
    return { nombre: words[0], apellidos: `${words[1]} ${words[2]}` };
  }
  return {
    nombre: words.slice(0, words.length - 2).join(" "),
    apellidos: words.slice(-2).join(" ")
  };
}
function extractYear(dateStr) {
  if (!dateStr) return "";
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
function formatPlazaBovino(plaza) {
  if (!plaza) return "";
  const clean = plaza.trim().toUpperCase();
  const m = clean.match(/^HIN\s*(\d+)$/);
  if (m) {
    const num = m[1].padStart(3, "0");
    return `HIN ${num}`;
  }
  return clean;
}
var CUSTOM_STYLES_XML = `
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
var OdsExportService = class _OdsExportService {
  /**
   * Genera el libro ODS maestro con 4 hojas siguiendo la estética de la plantilla
   */
  static async generateEquinosWorkbook(options) {
    const { campaign, animals, stallions, movements, owners } = options;
    const templatePath = path.resolve(__dirname, "../templates/plantilla_equino.ods");
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontr\xF3 la plantilla ODS en: ${templatePath}`);
    }
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);
    let contentXml = await zip.file("content.xml").async("string");
    const autoStylesEndTag = "</office:automatic-styles>";
    const autoStylesIdx = contentXml.indexOf(autoStylesEndTag);
    if (autoStylesIdx !== -1) {
      contentXml = contentXml.substring(0, autoStylesIdx) + CUSTOM_STYLES_XML + contentXml.substring(autoStylesIdx);
    }
    const spreadsheetStartTag = "<office:spreadsheet>";
    const spreadsheetEndTag = "</office:spreadsheet>";
    const ssStartIdx = contentXml.indexOf(spreadsheetStartTag);
    const ssEndIdx = contentXml.indexOf(spreadsheetEndTag);
    if (ssStartIdx === -1 || ssEndIdx === -1) {
      throw new Error("Formato ODS inv\xE1lido: no se encontr\xF3 office:spreadsheet");
    }
    const originalSpreadsheetContent = contentXml.substring(
      ssStartIdx + spreadsheetStartTag.length,
      ssEndIdx
    );
    let hiddenPlazasTable = "";
    const hiddenTableMatch = originalSpreadsheetContent.match(
      /<table:table[^>]*table:name="PLAZAS ANCGM"[\s\S]*?<\/table:table>/
    );
    if (hiddenTableMatch) {
      hiddenPlazasTable = hiddenTableMatch[0];
    }
    const sheet1Xml = _OdsExportService.buildEquinosCampaignSheet(campaign, animals);
    const sheet2Xml = _OdsExportService.buildStallionsCampaignSheet(campaign, stallions);
    const sheet3Xml = _OdsExportService.buildExpedientesSheet(animals, movements);
    const sheet4Xml = _OdsExportService.buildLibroCronologicoSheet(movements, animals);
    const newSpreadsheetXml = spreadsheetStartTag + (hiddenPlazasTable ? "\n" + hiddenPlazasTable : "") + "\n" + sheet1Xml + "\n" + sheet2Xml + "\n" + sheet3Xml + "\n" + sheet4Xml + "\n" + spreadsheetEndTag;
    contentXml = contentXml.substring(0, ssStartIdx) + newSpreadsheetXml + contentXml.substring(ssEndIdx + spreadsheetEndTag.length);
    zip.file("content.xml", contentXml);
    return zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }
  /**
   * Genera el libro ODS oficial para Bovinos (1 sola hoja, réplica exacta de la plantilla oficial)
   */
  static async generateBovinosWorkbook(options) {
    const { campaign, animals, owners } = options;
    const templatePath = path.resolve(__dirname, "../templates/plantilla_bovino.ods");
    if (!fs.existsSync(templatePath)) {
      throw new Error(`No se encontr\xF3 la plantilla ODS de bovino en: ${templatePath}`);
    }
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = await JSZip.loadAsync(templateBuffer);
    let contentXml = await zip.file("content.xml").async("string");
    const spreadsheetStartTag = "<office:spreadsheet>";
    const spreadsheetEndTag = "</office:spreadsheet>";
    const ssStartIdx = contentXml.indexOf(spreadsheetStartTag);
    const ssEndIdx = contentXml.indexOf(spreadsheetEndTag);
    if (ssStartIdx === -1 || ssEndIdx === -1) {
      throw new Error("Formato ODS inv\xE1lido: no se encontr\xF3 office:spreadsheet");
    }
    const sheetXml = _OdsExportService.buildBovinosSheet(campaign, animals, owners);
    const newSpreadsheetXml = `${spreadsheetStartTag}
${sheetXml}
${spreadsheetEndTag}`;
    contentXml = contentXml.substring(0, ssStartIdx) + newSpreadsheetXml + contentXml.substring(ssEndIdx + spreadsheetEndTag.length);
    zip.file("content.xml", contentXml);
    return zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }
  /**
   * Hoja única: Censo oficial de Bovino con la estética exacta de la plantilla
   */
  static buildBovinosSheet(campaign, allAnimals, owners) {
    const bovinos = allAnimals.filter((a) => a.tipo === "BOVINO" && a.campana === campaign && !a.esPlazaVacante).sort((a, b) => (a.plazaNumero || "").localeCompare(b.plazaNumero || "", void 0, { numeric: true }));
    const groups = /* @__PURE__ */ new Map();
    for (const a of bovinos) {
      const ownerKey = (a.propietario || "").trim().toUpperCase() || "SIN ASIGNAR";
      if (!groups.has(ownerKey)) {
        groups.set(ownerKey, []);
      }
      groups.get(ownerKey).push(a);
    }
    let out = `<table:table table:name="Hoja1" table:style-name="ta1">
`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>
`;
    out += `  <table:table-column table:style-name="co1" table:default-cell-style-name="ce13"/>
`;
    out += `  <table:table-column table:style-name="co2" table:default-cell-style-name="ce13"/>
`;
    out += `  <table:table-column table:style-name="co3" table:default-cell-style-name="ce13"/>
`;
    out += `  <table:table-column table:style-name="co3" table:default-cell-style-name="ce13"/>
`;
    out += `  <table:table-column table:style-name="co4" table:default-cell-style-name="ce13"/>
`;
    out += `  <table:table-column table:style-name="co5" table:default-cell-style-name="ce38"/>
`;
    out += `  <table:table-column table:style-name="co6" table:default-cell-style-name="ce38"/>
`;
    out += `  <table:table-column table:style-name="co7" table:default-cell-style-name="ce13"/>
`;
    out += `  <table:table-column table:style-name="co8" table:default-cell-style-name="ce52"/>
`;
    out += `  <table:table-row table:style-name="ro1">
`;
    out += `    <table:table-cell table:style-name="ce1" office:value-type="string"><text:p>PLAZA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>TOTAL</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>NIF</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>APELLIDOS</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>A\xD1O NACIMIENTO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>N.\xBA CROTAL</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce14" office:value-type="string"><text:p>ULTIMA REVISION</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    let totalAnimals = 0;
    for (const [ownerKey, animalList] of groups.entries()) {
      const ownerObj = owners.find((o) => (o.nombreCompleto || "").trim().toUpperCase() === ownerKey) || owners.find(
        (o) => (o.nombreCompleto || "").replace(/\d+$/, "").trim().toUpperCase() === ownerKey.replace(/\d+$/, "").trim().toUpperCase()
      );
      const nif = ownerObj?.dniCif || "";
      const { nombre, apellidos } = splitOwnerName(ownerKey);
      animalList.forEach((anim, idx) => {
        totalAnimals++;
        const isLast = idx === animalList.length - 1;
        const plazaFormatted = formatPlazaBovino(anim.plazaNumero);
        const sexo = (anim.sexo || "H").toUpperCase().charAt(0);
        const birthYear = extractYear(anim.fechaNacimiento);
        const crotal = anim.identificacion1 || "";
        const revDate = formatDate(anim.fechaUltimaRevision);
        out += `  <table:table-row table:style-name="ro2">
`;
        out += `    <table:table-cell table:style-name="ce2" office:value-type="string"><text:p>${escapeXml(plazaFormatted)}</text:p></table:table-cell>
`;
        if (isLast) {
          out += `    <table:table-cell table:style-name="ce18" office:value-type="float" office:value="${animalList.length}"><text:p>${animalList.length}</text:p></table:table-cell>
`;
        } else {
          out += `    <table:table-cell table:style-name="ce15"/>
`;
        }
        out += `    <table:table-cell table:style-name="ce2" office:value-type="string"><text:p>${escapeXml(nif)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(nombre)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(apellidos)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="ce29" office:value-type="string"><text:p>${escapeXml(sexo)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(birthYear)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="ce15" office:value-type="string"><text:p>${escapeXml(crotal)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="ce45" office:value-type="string"><text:p>${escapeXml(revDate)}</text:p></table:table-cell>
`;
        out += `  </table:table-row>
`;
      });
    }
    out += `  <table:table-row table:style-name="ro2">
`;
    out += `    <table:table-cell table:style-name="ce3"/>
`;
    out += `    <table:table-cell table:style-name="ce16" table:number-columns-repeated="4"/>
`;
    out += `    <table:table-cell table:style-name="ce23"/>
`;
    out += `    <table:table-cell table:style-name="ce16" table:number-columns-repeated="2"/>
`;
    out += `    <table:table-cell table:style-name="ce46"/>
`;
    out += `  </table:table-row>
`;
    out += `  <table:table-row table:style-name="ro2">
`;
    out += `    <table:table-cell table:style-name="ce6" office:value-type="string"><text:p>TOTAL</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce21" office:value-type="float" office:value="${totalAnimals}"><text:p>${totalAnimals}</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    const now = /* @__PURE__ */ new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = String(now.getFullYear()).slice(-2);
    const nowFormatted = `${d}/${m}/${y}`;
    const nowIso = now.toISOString().slice(0, 10);
    out += `  <table:table-row table:style-name="ro2">
`;
    out += `    <table:table-cell table:style-name="ce7" office:value-type="string"><text:p>FECHA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="ce22" office:value-type="date" office:date-value="${nowIso}"><text:p>${nowFormatted}</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    out += `</table:table>
`;
    return out;
  }
  /**
   * Hoja 1: Censo de Equinos con Titulares y Crías en la Campaña Activa
   */
  static buildEquinosCampaignSheet(campaign, allAnimals) {
    const list = allAnimals.filter((a) => a.tipo === "EQUINO" && a.campana === campaign).sort((a, b) => (a.plazaNumero || "").localeCompare(b.plazaNumero || "", void 0, { numeric: true }));
    let out = `<table:table table:name="EQUINOS ${escapeXml(campaign)}" table:style-name="ta2">
`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_fca"/>
`;
    out += `  <table:table-column table:style-name="co_chp"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_chp"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-row table:style-name="ro4">
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-blue" office:value-type="string"><text:p>N\xBA PLAZA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FINCA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 1</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 2</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FN</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA UL RV</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-cell-center"/>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>PROPIETARIO RASTRA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>RASTRAS</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>UELN</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>SEX RSTRA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>FN RASTRA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>F ENTRD</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>F SALIDA</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    for (const a of list) {
      const r = a.rastra;
      out += `  <table:table-row table:style-name="ro1">
`;
      out += `    <table:table-cell table:style-name="marisma-cell-plaza" office:value-type="string"><text:p>${escapeXml(a.plazaNumero)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(a.propietario)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-finca" office:value-type="string"><text:p>${escapeXml(a.finca || "HINOJOS")}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(a.identificacion1)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.identificacion2)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.nombreAnimal)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.sexo)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(a.fechaNacimiento, true))}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.capa)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(a.actualizadoEn, true))}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center"/>
`;
      if (r) {
        const rastraPropietario = r.propietarioRastra || r.propietario || a.propietario;
        const rastraChip = r.rastrasChip || r.identificacion1 || "";
        const rastraUeln = r.ueln || r.identificacion2 || "";
        out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(rastraPropietario)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(rastraChip)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(rastraUeln)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(r.nombre)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(r.sexo)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(r.fechaNacimiento, true))}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(r.capa)}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(r.fechaEntrada, true))}</text:p></table:table-cell>
`;
        out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(r.fechaSalida, true))}</text:p></table:table-cell>
`;
      } else {
        out += `    <table:table-cell table:style-name="marisma-cell-center" table:number-columns-repeated="9"/>
`;
      }
      out += `  </table:table-row>
`;
    }
    out += `</table:table>
`;
    return out;
  }
  /**
   * Hoja 2: Sementales Reproductores de la Campaña Activa
   */
  static buildStallionsCampaignSheet(campaign, allStallions) {
    const list = allStallions.filter((s) => s.tipo === "EQUINO" && s.campana === campaign).sort((a, b) => a.nombre.localeCompare(b.nombre));
    let out = `<table:table table:name="SEMENTALES EQUINOS ${escapeXml(campaign)}" table:style-name="ta2">
`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_fca"/>
`;
    out += `  <table:table-column table:style-name="co_chp"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-row table:style-name="ro6">
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string" table:number-columns-spanned="11"><text:p>SEMENTALES EQUINOS ${escapeXml(campaign)}</text:p></table:table-cell>
`;
    out += `    <table:covered-table-cell table:number-columns-repeated="10"/>
`;
    out += `  </table:table-row>
`;
    out += `  <table:table-row table:style-name="ro5">
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>APELLIDOS</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CESION ANUAL</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FINCA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 1</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>IDENTIFICACION 2</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FN</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA UL RV</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    for (const s of list) {
      const parts = (s.propietario || "").trim().split(/\s+/);
      const nombreTitular = parts.length > 1 ? parts[0] : s.propietario || "";
      const apellidosTitular = parts.length > 1 ? parts.slice(1).join(" ") : "";
      const cesion = s.cesionAnual || "";
      const finca = s.finca || s.zonaMarisma || "HINOJOS";
      const chip = s.identificacionChip || s.identificacion1 || "";
      const ueln = s.ueln || s.identificacion2 || "";
      const sexo = s.sexo || "M";
      const fechaRv = s.fechaRevision || "";
      out += `  <table:table-row table:style-name="ro1">
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(nombreTitular)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(apellidosTitular)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(cesion)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-finca" office:value-type="string"><text:p>${escapeXml(finca)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(chip)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(ueln)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(s.nombre)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(sexo)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(s.fechaNacimiento, true))}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(s.capa)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(fechaRv, true))}</text:p></table:table-cell>
`;
      out += `  </table:table-row>
`;
    }
    out += `</table:table>
`;
    return out;
  }
  /**
   * Hoja 3: Expedientes de Todos los Equinos a lo largo de Todas las Campañas
   */
  static buildExpedientesSheet(animals, movements) {
    const recordMap = /* @__PURE__ */ new Map();
    const getChipKey = (chip) => (chip || "").trim().toUpperCase();
    for (const animal of animals) {
      if (animal.tipo !== "EQUINO") continue;
      const chipKey = getChipKey(animal.identificacion1) || animal.id;
      const existing = recordMap.get(chipKey);
      if (!existing) {
        const campaigns = /* @__PURE__ */ new Set();
        if (animal.campana) campaigns.add(animal.campana);
        const notes = (animal.anotaciones || []).map((a) => a.texto).filter(Boolean).join(" | ");
        recordMap.set(chipKey, {
          animal: { ...animal },
          latestPlaza: animal.plazaNumero || "",
          campaigns,
          movementsCount: 0,
          documentsCount: (animal.documentos || []).length,
          annotationsText: notes
        });
      } else {
        if (animal.campana) existing.campaigns.add(animal.campana);
        if (animal.plazaNumero) existing.latestPlaza = animal.plazaNumero;
        if (animal.propietario) existing.animal.propietario = animal.propietario;
        if (animal.nombreAnimal) existing.animal.nombreAnimal = animal.nombreAnimal;
        if (animal.estadoPresencia) existing.animal.estadoPresencia = animal.estadoPresencia;
        if (animal.documentos) {
          existing.documentsCount = Math.max(existing.documentsCount, animal.documentos.length);
        }
        if (animal.anotaciones && animal.anotaciones.length > 0) {
          const incomingNotes = animal.anotaciones.map((a) => a.texto).filter(Boolean).join(" | ");
          if (incomingNotes && !existing.annotationsText.includes(incomingNotes)) {
            existing.annotationsText = existing.annotationsText ? `${existing.annotationsText} | ${incomingNotes}` : incomingNotes;
          }
        }
      }
    }
    for (const m of movements) {
      if (m.tipoAnimal !== "EQUINO") continue;
      let target = null;
      for (const rec of recordMap.values()) {
        if (rec.animal.id === m.animalId) {
          target = rec;
          break;
        }
        if (rec.animal.nombreAnimal.trim().toLowerCase() === m.nombreAnimal.trim().toLowerCase() && rec.animal.propietario.trim().toLowerCase() === m.propietario.trim().toLowerCase()) {
          target = rec;
          break;
        }
      }
      if (target) {
        target.movementsCount++;
        const camp = m.campana || target.animal.campana;
        if (camp) target.campaigns.add(camp);
        if (!target.latestPlaza && m.plazaNumero) target.latestPlaza = m.plazaNumero;
      }
    }
    const records = Array.from(recordMap.values()).sort(
      (a, b) => a.animal.nombreAnimal.localeCompare(b.animal.nombreAnimal)
    );
    let out = `<table:table table:name="EXPEDIENTE POR ANIMAL" table:style-name="ta2">
`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>
`;
    out += `  <table:table-column table:style-name="co_chp"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_fca"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_lrg"/>
`;
    out += `  <table:table-row table:style-name="ro4">
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>MICROCHIP</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>UELN / PASAPORTE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE ANIMAL</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>SEXO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAPA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA NACIMIENTO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TITULAR / GANADERO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>ESTADO PRESENCIA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-blue" office:value-type="string"><text:p>\xDALTIMA PLAZA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TOTAL MOVS</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>CAMPA\xD1AS HIST\xD3RICAS</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-yellow" office:value-type="string"><text:p>CR\xCDA / RASTRA ASOCIADA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>DOCS ADJUNTOS</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOTAS DEL EXPEDIENTE</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    for (const rec of records) {
      const a = rec.animal;
      const campanasStr = Array.from(rec.campaigns).sort().join(", ");
      const r = a.rastra;
      const chipRastra = r ? r.rastrasChip || r.identificacion1 || "" : "";
      const rastraStr = r ? `${r.nombre || ""} (${chipRastra})` : "";
      out += `  <table:table-row table:style-name="ro1">
`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(a.identificacion1)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.identificacion2)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(a.nombreAnimal)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.sexo)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.capa)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(a.fechaNacimiento))}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(a.propietario)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(a.estadoPresencia || "DENTRO")}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-plaza" office:value-type="string"><text:p>${escapeXml(rec.latestPlaza)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="float" office:value="${rec.movementsCount}"><text:p>${rec.movementsCount}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(campanasStr)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(rastraStr)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="float" office:value="${rec.documentsCount}"><text:p>${rec.documentsCount}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(rec.annotationsText)}</text:p></table:table-cell>
`;
      out += `  </table:table-row>
`;
    }
    out += `</table:table>
`;
    return out;
  }
  /**
   * Hoja 4: Libro Cronológico de Movimientos Equinos
   */
  static buildLibroCronologicoSheet(movements, allAnimals) {
    const list = movements.filter((m) => m.tipoAnimal === "EQUINO").sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
    const animalById = /* @__PURE__ */ new Map();
    for (const an of allAnimals) {
      animalById.set(an.id, an);
    }
    let out = `<table:table table:name="LIBRO CRONOLOGICO" table:style-name="ta2">
`;
    out += `  <office:forms form:automatic-focus="false" form:apply-design-mode="false"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_plz"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_chp"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_med"/>
`;
    out += `  <table:table-column table:style-name="co_sml"/>
`;
    out += `  <table:table-column table:style-name="co_nom"/>
`;
    out += `  <table:table-column table:style-name="co_lrg"/>
`;
    out += `  <table:table-row table:style-name="ro4">
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>FECHA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TIPO MOVIMIENTO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-blue" office:value-type="string"><text:p>N\xBA PLAZA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>NOMBRE ANIMAL</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>MICROCHIP</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>UELN</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>TITULAR / GANADERO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>MOTIVO / DESTINO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>GU\xCDA DE MOVIMIENTO</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>LIBER\xD3 PLAZA</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>GUARDA RESPONSABLE</text:p></table:table-cell>
`;
    out += `    <table:table-cell table:style-name="marisma-hdr-gray" office:value-type="string"><text:p>OBSERVACIONES</text:p></table:table-cell>
`;
    out += `  </table:table-row>
`;
    for (const m of list) {
      const isEntrada = m.tipoMovimiento === "ENTRADA";
      const tipoStyle = isEntrada ? "marisma-mov-entrada" : "marisma-mov-salida";
      const targetAnimal = animalById.get(m.animalId) || allAnimals.find(
        (a) => a.nombreAnimal.trim().toLowerCase() === m.nombreAnimal.trim().toLowerCase() && a.propietario.trim().toLowerCase() === m.propietario.trim().toLowerCase()
      );
      const microchip = targetAnimal?.identificacion1 || "";
      const ueln = targetAnimal?.identificacion2 || "";
      out += `  <table:table-row table:style-name="ro1">
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(formatDate(m.fecha))}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="${tipoStyle}" office:value-type="string"><text:p>${escapeXml(m.tipoMovimiento)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-plaza" office:value-type="string"><text:p>${escapeXml(m.plazaNumero)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.nombreAnimal)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-chip" office:value-type="string"><text:p>${escapeXml(microchip)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(ueln)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.propietario)}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(m.motivo || "")}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${escapeXml(m.numeroGuia || "")}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-center" office:value-type="string"><text:p>${m.liberarPlaza ? "S\xCD" : "NO"}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.guardaResponsable || "")}</text:p></table:table-cell>
`;
      out += `    <table:table-cell table:style-name="marisma-cell-left" office:value-type="string"><text:p>${escapeXml(m.observaciones || "")}</text:p></table:table-cell>
`;
      out += `  </table:table-row>
`;
    }
    out += `</table:table>
`;
    return out;
  }
};

// server/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
var SUPABASE_URL = process.env.SUPABASE_URL || "https://gowdixuenmfmvxdnlgpw.supabase.co";
var SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "sb_secret_7p0L0wIkWojx_BezjZSciQ_OQh1trI1";
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("[SUPABASE] ADVERTENCIA: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no est\xE1n configurados.");
}
var supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
var DOCUMENTS_BUCKET = "marisma-documents";

// server/mappers.ts
function mapAnimalRow(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    campana: row.campana,
    plazaNumero: row.plaza_numero,
    propietario: row.propietario,
    finca: row.finca,
    identificacion1: row.identificacion1 || "",
    identificacion2: row.identificacion2 || "",
    nombreAnimal: row.tipo === "BOVINO" ? "" : row.nombre_animal || "",
    sexo: row.sexo,
    fechaNacimiento: row.fecha_nacimiento || "",
    capa: row.capa,
    fechaUltimaRevision: row.fecha_ultima_revision || void 0,
    estadoPresencia: row.estado_presencia,
    fechaEntradaMarisma: row.fecha_entrada_marisma || void 0,
    fechaSalidaMarisma: row.fecha_salida_marisma || void 0,
    esSemental: Boolean(row.es_semental),
    esPlazaVacante: Boolean(row.es_plaza_vacante),
    animalAnteriorId: row.animal_anterior_id || void 0,
    rastra: row.rastra_json ? typeof row.rastra_json === "string" ? JSON.parse(row.rastra_json) : row.rastra_json : null,
    documentos: row.documentos_json ? typeof row.documentos_json === "string" ? JSON.parse(row.documentos_json) : row.documentos_json : [],
    anotaciones: row.anotaciones_json ? typeof row.anotaciones_json === "string" ? JSON.parse(row.anotaciones_json) : row.anotaciones_json : [],
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en
  };
}
function mapOwnerRow(row) {
  return {
    id: row.id,
    campana: row.campana || "2025-2026",
    nombreCompleto: row.nombre_completo,
    dniCif: row.dni_cif,
    telefono: row.telefono || "",
    email: row.email || "",
    direccion: row.direccion || "",
    municipio: row.municipio || "",
    codigoRega: row.codigo_rega || void 0,
    asociacion: row.asociacion || void 0,
    notas: row.notas || void 0
  };
}
function mapStallionRow(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    campana: row.campana,
    nombre: row.nombre,
    identificacionChip: row.identificacion_chip || "",
    ueln: row.ueln || "",
    propietario: row.propietario,
    fechaNacimiento: row.fecha_nacimiento || "",
    capa: row.capa,
    estadoAprobacion: row.estado_aprobacion,
    numeroYeguasCubiertas: row.numero_yeguas_cubiertas || 0,
    zonaMarisma: row.zona_marisma || void 0,
    observaciones: row.observaciones || void 0
  };
}
function mapMovementRow(row) {
  return {
    id: row.id,
    animalId: row.animal_id,
    campana: row.campana || "",
    identificacion1: row.identificacion1 || "",
    tipoAnimal: row.tipo_animal,
    plazaNumero: row.plaza_numero,
    nombreAnimal: row.tipo_animal === "BOVINO" ? "" : row.nombre_animal || "",
    propietario: row.propietario,
    tipoMovimiento: row.tipo_movimiento,
    fecha: row.fecha,
    motivo: row.motivo,
    numeroGuia: row.numero_guia || void 0,
    guardaResponsable: row.guarda_responsable || "",
    observaciones: row.observaciones || void 0,
    liberarPlaza: Boolean(row.liberar_plaza)
  };
}
function mapUserRow(row) {
  return {
    id: row.id,
    username: row.username,
    nombreCompleto: row.nombre_completo,
    rol: row.rol,
    cargo: row.cargo || "",
    email: row.email || "",
    avatarInitials: row.avatar_initials || "",
    activo: Boolean(row.activo),
    campanaActiva: row.campana_activa || "2025-2026"
  };
}
function mapAuditLogRow(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    usuarioId: row.usuario_id || void 0,
    usuarioNombre: row.usuario_nombre || "Sistema",
    usuarioRol: row.usuario_rol || "CONSULTA",
    accion: row.accion,
    entidad: row.entidad,
    entidadId: row.entidad_id || void 0,
    detallesJson: row.detalles_json || void 0,
    ip: row.ip || void 0
  };
}

// server/dataAdapter.ts
var dataAdapter = {
  // 1. USUARIOS
  async getUsers() {
    const { data, error } = await supabase.from("users").select("*").order("nombre_completo", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapUserRow);
  },
  async getUserById(id) {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async getUserByUsername(username) {
    const { data, error } = await supabase.from("users").select("*").eq("username", username).maybeSingle();
    if (error) throw error;
    return data || null;
  },
  async saveUser(user) {
    const row = {
      id: user.id,
      username: user.username,
      nombre_completo: user.nombreCompleto,
      rol: user.rol,
      cargo: user.cargo || "",
      email: user.email || "",
      avatar_initials: user.avatarInitials || "",
      activo: user.activo ? 1 : 0,
      campana_activa: user.campanaActiva || "2025-2026"
    };
    if (user.passwordHash) {
      row.password_hash = user.passwordHash;
    }
    const { data, error } = await supabase.from("users").upsert(row).select().single();
    if (error) throw error;
    return mapUserRow(data);
  },
  async deleteUser(id) {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  // 2. CONFIGURACIÓN Y CAMPAÑAS
  async getSettings() {
    const { data, error } = await supabase.from("settings").select("*");
    if (error) throw error;
    const res = {};
    (data || []).forEach((row) => {
      res[row.key] = row.value;
    });
    return res;
  },
  async getSetting(key) {
    const { data, error } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  },
  async setSetting(key, value) {
    const { error } = await supabase.from("settings").upsert({ key, value });
    if (error) throw error;
  },
  async getCampaigns() {
    const { data, error } = await supabase.from("campaigns").select("nombre").order("creado_en", { ascending: false });
    if (error) throw error;
    return (data || []).map((r) => r.nombre);
  },
  async saveCampaign(nombre, activa = 0) {
    const { error } = await supabase.from("campaigns").upsert({
      nombre,
      activa,
      creado_en: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (error) throw error;
  },
  async deleteCampaign(nombre) {
    const { error } = await supabase.from("campaigns").delete().eq("nombre", nombre);
    if (error) throw error;
  },
  // 3. BOOTSTRAP UNIFICADO
  async getBootstrap(isAdmin) {
    const [animalsRes, ownersRes, asocsRes, stallionsRes, movsRes, campaignsRes, activeCampSetting, usersRes] = await Promise.all([
      supabase.from("animals").select("*").order("plaza_numero", { ascending: true }),
      supabase.from("owners").select("*").order("nombre_completo", { ascending: true }),
      supabase.from("associations").select("*").order("nombre", { ascending: true }),
      supabase.from("stallions").select("*").order("nombre", { ascending: true }),
      supabase.from("movements").select("*").order("fecha", { ascending: false }),
      supabase.from("campaigns").select("nombre").order("creado_en", { ascending: false }),
      supabase.from("settings").select("value").eq("key", "active_campaign").maybeSingle(),
      isAdmin ? supabase.from("users").select("*").order("nombre_completo", { ascending: true }) : Promise.resolve({ data: [], error: null })
    ]);
    if (animalsRes.error) throw animalsRes.error;
    if (ownersRes.error) throw ownersRes.error;
    if (asocsRes.error) throw asocsRes.error;
    if (stallionsRes.error) throw stallionsRes.error;
    if (movsRes.error) throw movsRes.error;
    if (campaignsRes.error) throw campaignsRes.error;
    const campaigns = (campaignsRes.data || []).map((r) => r.nombre);
    let activeCampaign = activeCampSetting?.data?.value || "";
    if (!activeCampaign || !campaigns.includes(activeCampaign)) {
      activeCampaign = campaigns[0] || "2025-2026";
      await this.setSetting("active_campaign", activeCampaign);
    }
    return {
      animals: (animalsRes.data || []).map(mapAnimalRow),
      owners: (ownersRes.data || []).map(mapOwnerRow),
      associations: (asocsRes.data || []).map((r) => ({
        id: r.id,
        nombre: r.nombre,
        cif: r.cif,
        creadoEn: r.creado_en
      })),
      stallions: (stallionsRes.data || []).map(mapStallionRow),
      movements: (movsRes.data || []).map(mapMovementRow),
      campaigns,
      activeCampaign,
      users: (usersRes.data || []).map(mapUserRow)
    };
  },
  // 4. ANIMALES
  async getAnimals(campana, tipo) {
    let query = supabase.from("animals").select("*").order("plaza_numero", { ascending: true });
    if (campana) query = query.eq("campana", campana);
    if (tipo) query = query.eq("tipo", tipo);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapAnimalRow);
  },
  async getAnimalById(id) {
    const { data, error } = await supabase.from("animals").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapAnimalRow(data) : null;
  },
  async saveAnimal(animal) {
    const row = {
      id: animal.id,
      tipo: animal.tipo,
      campana: animal.campana,
      plaza_numero: animal.plazaNumero,
      propietario: animal.propietario,
      finca: animal.finca || "HINOJOS",
      identificacion1: animal.identificacion1 || "",
      identificacion2: animal.identificacion2 || "",
      nombre_animal: animal.tipo === "BOVINO" ? "" : animal.nombreAnimal || "",
      sexo: animal.sexo,
      fecha_nacimiento: animal.fechaNacimiento || "",
      capa: animal.capa,
      fecha_ultima_revision: animal.fechaUltimaRevision || null,
      estado_presencia: animal.estadoPresencia,
      fecha_entrada_marisma: animal.fechaEntradaMarisma || null,
      fecha_salida_marisma: animal.fechaSalidaMarisma || null,
      es_semental: animal.esSemental ? 1 : 0,
      es_plaza_vacante: animal.esPlazaVacante ? 1 : 0,
      animal_anterior_id: animal.animalAnteriorId || null,
      rastra_json: animal.rastra ? JSON.stringify(animal.rastra) : null,
      documentos_json: JSON.stringify(animal.documentos || []),
      anotaciones_json: JSON.stringify(animal.anotaciones || []),
      creado_en: animal.creadoEn || (/* @__PURE__ */ new Date()).toISOString(),
      actualizado_en: (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabase.from("animals").upsert(row).select().single();
    if (error) throw error;
    return mapAnimalRow(data);
  },
  async deleteAnimal(id) {
    const { error } = await supabase.from("animals").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  // 5. PROPIETARIOS / GANADEROS
  async getOwners(campana) {
    let query = supabase.from("owners").select("*").order("nombre_completo", { ascending: true });
    if (campana) query = query.eq("campana", campana);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapOwnerRow);
  },
  async saveOwner(owner) {
    const row = {
      id: owner.id,
      campana: owner.campana || "2025-2026",
      nombre_completo: owner.nombreCompleto,
      dni_cif: owner.dniCif,
      telefono: owner.telefono || "",
      email: owner.email || "",
      direccion: owner.direccion || "",
      municipio: owner.municipio || "Hinojos",
      codigo_rega: owner.codigoRega || "",
      asociacion: owner.asociacion || "",
      notas: owner.notas || ""
    };
    const { data, error } = await supabase.from("owners").upsert(row).select().single();
    if (error) throw error;
    return mapOwnerRow(data);
  },
  async deleteOwner(id) {
    const { error } = await supabase.from("owners").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  // 6. ASOCIACIONES
  async getAssociations() {
    const { data, error } = await supabase.from("associations").select("*").order("nombre", { ascending: true });
    if (error) throw error;
    return (data || []).map((r) => ({
      id: r.id,
      nombre: r.nombre,
      cif: r.cif,
      creadoEn: r.creado_en
    }));
  },
  async saveAssociation(asoc) {
    const row = {
      id: asoc.id,
      nombre: asoc.nombre,
      cif: asoc.cif,
      creado_en: asoc.creadoEn || (/* @__PURE__ */ new Date()).toISOString()
    };
    const { data, error } = await supabase.from("associations").upsert(row).select().single();
    if (error) throw error;
    return {
      id: data.id,
      nombre: data.nombre,
      cif: data.cif,
      creadoEn: data.creado_en
    };
  },
  async deleteAssociation(id) {
    const { error } = await supabase.from("associations").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  // 7. SEMENTALES
  async getStallions(campana) {
    let query = supabase.from("stallions").select("*").order("nombre", { ascending: true });
    if (campana) query = query.eq("campana", campana);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapStallionRow);
  },
  async saveStallion(stallion) {
    const row = {
      id: stallion.id,
      tipo: stallion.tipo,
      campana: stallion.campana,
      nombre: stallion.nombre,
      identificacion_chip: stallion.identificacionChip || "",
      ueln: stallion.ueln || "",
      propietario: stallion.propietario,
      fecha_nacimiento: stallion.fechaNacimiento || "",
      capa: stallion.capa,
      estado_aprobacion: stallion.estadoAprobacion || "AUTORIZADO",
      numero_yeguas_cubiertas: stallion.numeroYeguasCubiertas || 0,
      zona_marisma: stallion.zonaMarisma || "",
      observaciones: stallion.observaciones || ""
    };
    const { data, error } = await supabase.from("stallions").upsert(row).select().single();
    if (error) throw error;
    return mapStallionRow(data);
  },
  async deleteStallion(id) {
    const { error } = await supabase.from("stallions").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
  // 8. MOVIMIENTOS
  async getMovements(campana) {
    let query = supabase.from("movements").select("*").order("fecha", { ascending: false });
    if (campana) query = query.eq("campana", campana);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapMovementRow);
  },
  async saveMovement(movement) {
    const row = {
      id: movement.id,
      animal_id: movement.animalId,
      campana: movement.campana || "",
      identificacion1: movement.identificacion1 || "",
      tipo_animal: movement.tipoAnimal,
      plaza_numero: movement.plazaNumero,
      nombre_animal: movement.tipoAnimal === "BOVINO" ? "" : movement.nombreAnimal || "",
      propietario: movement.propietario,
      tipo_movimiento: movement.tipoMovimiento,
      fecha: movement.fecha,
      motivo: movement.motivo,
      numero_guia: movement.numeroGuia || "",
      guarda_responsable: movement.guardaResponsable || "",
      observaciones: movement.observaciones || "",
      liberar_plaza: movement.liberarPlaza ? 1 : 0
    };
    const { data, error } = await supabase.from("movements").upsert(row).select().single();
    if (error) throw error;
    return mapMovementRow(data);
  },
  // 9. AUDITORÍA
  async getAuditLogs(limit = 500) {
    const { data, error } = await supabase.from("audit_logs").select("*").order("fecha", { ascending: false }).limit(limit);
    if (error) throw error;
    return (data || []).map(mapAuditLogRow);
  },
  async recordAudit(entry) {
    const id = `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fecha = (/* @__PURE__ */ new Date()).toISOString();
    const detallesJson = typeof entry.detalles === "string" ? entry.detalles : entry.detalles ? JSON.stringify(entry.detalles) : null;
    const row = {
      id,
      fecha,
      usuario_id: entry.usuarioId || null,
      usuario_nombre: entry.usuarioNombre || "Sistema",
      usuario_rol: entry.usuarioRol || "ADMINISTRADOR",
      accion: entry.accion,
      entidad: entry.entidad,
      entidad_id: entry.entidadId || null,
      detalles_json: detallesJson,
      ip: entry.ip || null
    };
    const { error } = await supabase.from("audit_logs").insert(row);
    if (error) {
      console.warn("Error registrando auditor\xEDa en Supabase:", error.message);
    }
  },
  // 10. ALMACENAMIENTO DE DOCUMENTOS (SUPABASE STORAGE)
  async uploadDocument(filename, buffer, mimeType) {
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(filename, buffer, {
      contentType: mimeType,
      upsert: true
    });
    if (error) throw error;
    return data;
  },
  async downloadDocument(filename) {
    return await supabase.storage.from(DOCUMENTS_BUCKET).download(filename);
  },
  async deleteDocument(filename) {
    return await supabase.storage.from(DOCUMENTS_BUCKET).remove([filename]);
  }
};

// server/auth.ts
import crypto from "node:crypto";
var developmentSecret = crypto.randomBytes(48).toString("base64url");
function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  return developmentSecret;
}
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}
function verifyPassword(password, storedHash) {
  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, "hex");
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}
function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1e3);
  const data = Buffer.from(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + 7 * 24 * 60 * 60
      // 7 días de validez
    })
  ).toString("base64url");
  const signature = crypto.createHmac("sha256", getSecret()).update(`${header}.${data}`).digest("base64url");
  return `${header}.${data}.${signature}`;
}
function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, data, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", getSecret()).update(`${header}.${data}`).digest("base64url");
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Acceso no autorizado: Se requiere token de sesi\xF3n" });
  }
  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Sesi\xF3n expirada o token inv\xE1lido" });
  }
  req.user = payload;
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Acceso no autorizado" });
  }
  if (req.user.rol !== "ADMINISTRADOR") {
    return res.status(403).json({ error: "Permisos insuficientes: Requiere rol Administrador" });
  }
  next();
}

// server/index.ts
dotenv.config();
var app = express();
var PORT = process.env.PORT || 3001;
app.disable("x-powered-by");
app.use((req, res, next) => {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  if (process.env.NODE_ENV === "production" && !isHttps) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.supabase.co ws: wss:;"
  );
  next();
});
var configuredOrigins = new Set(
  (process.env.CORS_ORIGIN || "").split(",").map((origin) => origin.trim()).filter(Boolean)
);
app.use(cors({
  origin(origin, callback) {
    const isLocalDevelopment = process.env.NODE_ENV !== "production" && (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
    if (!origin || configuredOrigins.has(origin) || isLocalDevelopment) return callback(null, true);
    return callback(null, true);
  }
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
var loginRateLimitStore = /* @__PURE__ */ new Map();
function recordFailedLogin(ip, maxFailedAttempts = 5, blockDurationMs = 2 * 60 * 1e3) {
  const now = Date.now();
  const record = loginRateLimitStore.get(ip) || { failedAttempts: 0, blockedUntil: 0 };
  record.failedAttempts++;
  if (record.failedAttempts >= maxFailedAttempts) {
    record.blockedUntil = now + blockDurationMs;
    console.warn(`[SEGURIDAD] IP ${ip} bloqueada por ${blockDurationMs / 1e3}s tras ${record.failedAttempts} fallos.`);
  }
  loginRateLimitStore.set(ip, record);
}
function resetFailedLogin(ip) {
  loginRateLimitStore.delete(ip);
}
function isIpBlocked(ip) {
  if (process.env.NODE_ENV !== "production") return false;
  const record = loginRateLimitStore.get(ip);
  return Boolean(record && record.blockedUntil > Date.now());
}
app.use("/api", async (req, res, next) => {
  if (req.path === "/health" || req.path === "/auth/login") return next();
  requireAuth(req, res, async () => {
    try {
      const user = await dataAdapter.getUserById(req.user.id);
      if (!user || !user.activo) return res.status(401).json({ error: "La cuenta no est\xE1 activa" });
      req.user = { id: user.id, username: user.username, rol: user.rol };
      const readOnlyMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
      const ownAccountWrite = req.method === "POST" && req.path === "/auth/logout" || req.method === "PUT" && req.path === "/users/me/active-campaign" || req.method === "POST" && req.path === "/auth/change-password";
      if (!readOnlyMethod && !ownAccountWrite && req.user.rol !== "ADMINISTRADOR") {
        return res.status(403).json({ error: "Permisos insuficientes: esta operaci\xF3n requiere rol Administrador" });
      }
      next();
    } catch (err) {
      res.status(500).json({ error: "Error validando sesi\xF3n: " + err.message });
    }
  });
});
async function auditLog(req, accion, entidad, entidadId, detalles) {
  await dataAdapter.recordAudit({
    usuarioId: req.user?.id,
    usuarioNombre: req.user?.username || "Sistema",
    usuarioRol: req.user?.rol || "ADMINISTRADOR",
    accion,
    entidad,
    entidadId,
    detalles,
    ip: String(req.ip || req.socket.remoteAddress || "")
  });
}
var uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /* @__PURE__ */ new Set(["application/pdf", "image/jpeg", "image/png"]);
    if (!allowed.has(file.mimetype)) return cb(new Error("S\xF3lo se permiten PDF, JPG y PNG"));
    cb(null, true);
  }
});
function hasValidSignature(buffer, mimeType) {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mimeType === "image/png") {
    return buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71 && buffer[4] === 13 && buffer[5] === 10 && buffer[6] === 26 && buffer[7] === 10;
  }
  return false;
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    server: "Sistema Ganadero Marisma de Hinojos API",
    database: "Supabase PostgreSQL + Storage"
  });
});
app.get("/api/bootstrap", async (req, res) => {
  try {
    const isAdmin = req.user?.rol === "ADMINISTRADOR";
    const data = await dataAdapter.getBootstrap(isAdmin);
    res.json(data);
  } catch (error) {
    console.error("Error en /api/bootstrap:", error);
    res.status(500).json({ error: error.message || "Error al obtener datos iniciales" });
  }
});
app.get("/api/animals", async (req, res) => {
  try {
    const { campana, tipo } = req.query;
    const animals = await dataAdapter.getAnimals(campana, tipo);
    res.json(animals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/animals/:id", async (req, res) => {
  try {
    const animal = await dataAdapter.getAnimalById(req.params.id);
    if (!animal) return res.status(404).json({ error: "Animal no encontrado" });
    res.json(animal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/animals", async (req, res) => {
  try {
    const a = req.body;
    if (a.tipo === "BOVINO") a.nombreAnimal = "";
    const saved = await dataAdapter.saveAnimal(a);
    await auditLog(req, "ALTA", "ANIMAL", saved.plazaNumero || saved.id, {
      tipo: saved.tipo,
      plaza: saved.plazaNumero,
      nombre: saved.nombreAnimal,
      titular: saved.propietario,
      crotal: saved.identificacion1,
      campana: saved.campana
    });
    res.status(201).json(saved);
  } catch (error) {
    console.error("Error en POST /api/animals:", error);
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/animals/:id", async (req, res) => {
  try {
    const a = req.body;
    a.id = req.params.id;
    if (a.tipo === "BOVINO") a.nombreAnimal = "";
    const saved = await dataAdapter.saveAnimal(a);
    await auditLog(req, "MODIFICACION", "ANIMAL", saved.plazaNumero || saved.id, {
      tipo: saved.tipo,
      plaza: saved.plazaNumero,
      nombre: saved.nombreAnimal,
      titular: saved.propietario,
      campana: saved.campana
    });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/animals/:id", async (req, res) => {
  try {
    const animal = await dataAdapter.getAnimalById(req.params.id);
    await dataAdapter.deleteAnimal(req.params.id);
    if (animal) {
      await auditLog(req, "BAJA", "ANIMAL", animal.plazaNumero || animal.id, {
        tipo: animal.tipo,
        plaza: animal.plazaNumero,
        nombre: animal.nombreAnimal,
        titular: animal.propietario
      });
    }
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/animals/swap", async (req, res) => {
  try {
    const { animalAId, animalBId, motivo, autor } = req.body;
    if (!animalAId || !animalBId) {
      return res.status(400).json({ error: "Se requieren animalAId y animalBId" });
    }
    const animalA = await dataAdapter.getAnimalById(animalAId);
    const animalB = await dataAdapter.getAnimalById(animalBId);
    if (!animalA || !animalB) {
      return res.status(404).json({ error: "Uno o ambos animales no existen" });
    }
    const plazaA = animalA.plazaNumero;
    const propA = animalA.propietario;
    const plazaB = animalB.plazaNumero;
    const propB = animalB.propietario;
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const annotationTextA = motivo?.trim() ? `Permuta de plaza: El animal pasa a la Plaza ${plazaB} (Titular: ${propB}). Motivo: ${motivo.trim()}` : `Permuta de plaza: El animal pasa a la Plaza ${plazaB} (Titular: ${propB}).`;
    const annotationTextB = motivo?.trim() ? `Permuta de plaza: El animal pasa a la Plaza ${plazaA} (Titular: ${propA}). Motivo: ${motivo.trim()}` : `Permuta de plaza: El animal pasa a la Plaza ${plazaA} (Titular: ${propA}).`;
    animalA.anotaciones = [
      ...animalA.anotaciones || [],
      {
        id: `ant-${Date.now()}-1`,
        fecha: dateStr,
        autor: autor || req.user?.username || "Administrador",
        categoria: "DOCUMENTAL",
        texto: annotationTextA
      }
    ];
    animalA.plazaNumero = plazaB;
    animalA.propietario = propB;
    animalB.anotaciones = [
      ...animalB.anotaciones || [],
      {
        id: `ant-${Date.now()}-2`,
        fecha: dateStr,
        autor: autor || req.user?.username || "Administrador",
        categoria: "DOCUMENTAL",
        texto: annotationTextB
      }
    ];
    animalB.plazaNumero = plazaA;
    animalB.propietario = propA;
    await dataAdapter.saveAnimal(animalA);
    await dataAdapter.saveAnimal(animalB);
    await auditLog(req, "PERMUTA", "ANIMAL", `${plazaA} <-> ${plazaB}`, {
      animalA: { id: animalA.id, nombre: animalA.nombreAnimal, plazaAnterior: plazaA, plazaNueva: plazaB },
      animalB: { id: animalB.id, nombre: animalB.nombreAnimal, plazaAnterior: plazaB, plazaNueva: plazaA },
      motivo: motivo || "Permuta municipal"
    });
    res.json({ success: true, animalA, animalB });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/animals/:id/documents", uploadMemory.single("file"), async (req, res) => {
  try {
    const animalId = req.params.id;
    const file = req.file;
    const { tipo, nombre } = req.body;
    if (!file) return res.status(400).json({ error: "No se ha subido ning\xFAn archivo" });
    if (!hasValidSignature(file.buffer, file.mimetype)) {
      return res.status(400).json({ error: "El contenido del archivo no coincide con un PDF, JPG o PNG v\xE1lido" });
    }
    const animal = await dataAdapter.getAnimalById(animalId);
    if (!animal) return res.status(404).json({ error: "Animal no encontrado" });
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storageFilename = `${animalId}_${Date.now()}_${cleanName}`;
    await dataAdapter.uploadDocument(storageFilename, file.buffer, file.mimetype);
    const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;
    const newDoc = {
      id: `doc-${Date.now()}`,
      nombre: nombre || file.originalname,
      tipo: tipo || "OTRO",
      fechaSubida: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      tamano: sizeStr,
      url: `/uploads/documents/${storageFilename}`
    };
    animal.documentos = [...animal.documentos || [], newDoc];
    const saved = await dataAdapter.saveAnimal(animal);
    await auditLog(req, "ALTA", "DOCUMENTO", newDoc.id, {
      animalId,
      plaza: animal.plazaNumero,
      documento: newDoc.nombre,
      tipo: newDoc.tipo
    });
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/animals/:id/documents/:docId", async (req, res) => {
  try {
    const { id: animalId, docId } = req.params;
    const animal = await dataAdapter.getAnimalById(animalId);
    if (!animal) return res.status(404).json({ error: "Animal no encontrado" });
    const doc = (animal.documentos || []).find((d) => d.id === docId);
    if (doc?.url) {
      const filename = doc.url.replace("/uploads/documents/", "");
      await dataAdapter.deleteDocument(filename);
    }
    animal.documentos = (animal.documentos || []).filter((d) => d.id !== docId);
    const saved = await dataAdapter.saveAnimal(animal);
    await auditLog(req, "BAJA", "DOCUMENTO", docId, { animalId, documento: doc?.nombre });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/animals/:id/annotations", async (req, res) => {
  try {
    const animalId = req.params.id;
    const { autor, categoria, texto } = req.body;
    if (!texto || !texto.trim()) return res.status(400).json({ error: "El texto es obligatorio" });
    const animal = await dataAdapter.getAnimalById(animalId);
    if (!animal) return res.status(404).json({ error: "Animal no encontrado" });
    const newAnnotation = {
      id: `ant-${Date.now()}`,
      fecha: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      autor: autor || req.user?.username || "Administrador",
      categoria: categoria || "OTROS",
      texto: texto.trim()
    };
    animal.anotaciones = [...animal.anotaciones || [], newAnnotation];
    const saved = await dataAdapter.saveAnimal(animal);
    await auditLog(req, "ALTA", "ANOTACION", newAnnotation.id, { animalId, categoria });
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/uploads/documents/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const { data, error } = await dataAdapter.downloadDocument(filename);
    if (error || !data) return res.status(404).send("Documento no encontrado");
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (filename.endsWith(".pdf")) res.setHeader("Content-Type", "application/pdf");
    else if (filename.endsWith(".png")) res.setHeader("Content-Type", "image/png");
    else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) res.setHeader("Content-Type", "image/jpeg");
    res.send(buffer);
  } catch (err) {
    res.status(500).send("Error recuperando documento");
  }
});
app.get("/api/owners", async (req, res) => {
  try {
    const { campana } = req.query;
    const owners = await dataAdapter.getOwners(campana);
    res.json(owners);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/owners", async (req, res) => {
  try {
    const o = req.body;
    o.id = o.id || `own-${Date.now()}`;
    const saved = await dataAdapter.saveOwner(o);
    await auditLog(req, "ALTA", "GANADERO", saved.id, { nombre: saved.nombreCompleto, dni: saved.dniCif });
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/owners/:id", async (req, res) => {
  try {
    const o = req.body;
    o.id = req.params.id;
    const saved = await dataAdapter.saveOwner(o);
    await auditLog(req, "MODIFICACION", "GANADERO", saved.id, { nombre: saved.nombreCompleto });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/owners/:id", async (req, res) => {
  try {
    await dataAdapter.deleteOwner(req.params.id);
    await auditLog(req, "BAJA", "GANADERO", req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/associations", async (_req, res) => {
  try {
    const associations = await dataAdapter.getAssociations();
    res.json(associations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/associations", async (req, res) => {
  try {
    const a = req.body;
    a.id = a.id || `asc-${Date.now()}`;
    const saved = await dataAdapter.saveAssociation(a);
    await auditLog(req, "ALTA", "ASOCIACION", saved.id, { nombre: saved.nombre, cif: saved.cif });
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/associations/:id", async (req, res) => {
  try {
    const a = req.body;
    a.id = req.params.id;
    const saved = await dataAdapter.saveAssociation(a);
    await auditLog(req, "MODIFICACION", "ASOCIACION", saved.id, { nombre: saved.nombre });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/associations/:id", async (req, res) => {
  try {
    await dataAdapter.deleteAssociation(req.params.id);
    await auditLog(req, "BAJA", "ASOCIACION", req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/stallions", async (req, res) => {
  try {
    const { campana } = req.query;
    const stallions = await dataAdapter.getStallions(campana);
    res.json(stallions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/stallions", async (req, res) => {
  try {
    const s = req.body;
    s.id = s.id || `stl-${Date.now()}`;
    const saved = await dataAdapter.saveStallion(s);
    await auditLog(req, "ALTA", "SEMENTAL", saved.id, { nombre: saved.nombre, propietario: saved.propietario });
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/stallions/:id", async (req, res) => {
  try {
    const s = req.body;
    s.id = req.params.id;
    const saved = await dataAdapter.saveStallion(s);
    await auditLog(req, "MODIFICACION", "SEMENTAL", saved.id, { nombre: saved.nombre });
    res.json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/stallions/:id", async (req, res) => {
  try {
    await dataAdapter.deleteStallion(req.params.id);
    await auditLog(req, "BAJA", "SEMENTAL", req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/movements", async (req, res) => {
  try {
    const { campana } = req.query;
    const movements = await dataAdapter.getMovements(campana);
    res.json(movements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/movements", async (req, res) => {
  try {
    const m = req.body;
    m.id = m.id || `mov-${Date.now()}`;
    if (m.tipoAnimal === "BOVINO") m.nombreAnimal = "";
    const animal = await dataAdapter.getAnimalById(m.animalId);
    if (!animal) return res.status(404).json({ error: "El animal indicado no existe" });
    m.campana = animal.campana;
    m.identificacion1 = animal.identificacion1;
    const savedMovement = await dataAdapter.saveMovement(m);
    if (m.tipoMovimiento === "SALIDA") {
      animal.estadoPresencia = "FUERA";
      animal.fechaSalidaMarisma = m.fecha;
      if (m.liberarPlaza) {
        animal.esPlazaVacante = true;
      }
    } else if (m.tipoMovimiento === "ENTRADA") {
      animal.estadoPresencia = "DENTRO";
      animal.fechaEntradaMarisma = m.fecha;
      animal.fechaSalidaMarisma = void 0;
      animal.esPlazaVacante = false;
    }
    await dataAdapter.saveAnimal(animal);
    await auditLog(req, "MOVIMIENTO", "MOVIMIENTO", savedMovement.id, {
      tipo: m.tipoMovimiento,
      animalId: m.animalId,
      plaza: m.plazaNumero,
      titular: m.propietario,
      motivo: m.motivo,
      guia: m.numeroGuia
    });
    res.status(201).json(savedMovement);
  } catch (error) {
    console.error("Error en POST /api/movements:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/campaigns", async (_req, res) => {
  try {
    const campaigns = await dataAdapter.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/campaigns", async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: "El nombre es obligatorio" });
    await dataAdapter.saveCampaign(nombre.trim(), 0);
    await auditLog(req, "NUEVA_CAMPANA", "CAMPANA", nombre.trim(), {});
    res.status(201).json({ success: true, nombre: nombre.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/campaigns/:nombre", async (req, res) => {
  try {
    await dataAdapter.deleteCampaign(req.params.nombre);
    await auditLog(req, "ELIMINAR_CAMPANA", "CAMPANA", req.params.nombre, {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/campaigns/active", async (req, res) => {
  try {
    const { campana } = req.body;
    if (!campana) return res.status(400).json({ error: "Campa\xF1a no especificada" });
    await dataAdapter.setSetting("active_campaign", campana);
    await auditLog(req, "MODIFICACION", "CONFIGURACION", "active_campaign", { campana });
    res.json({ success: true, activeCampaign: campana });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = String(req.ip || req.socket.remoteAddress || "");
    if (isIpBlocked(ip)) {
      return res.status(429).json({ error: "Demasiados intentos fallidos. Espere 2 minutos." });
    }
    if (!username || !password) {
      return res.status(400).json({ error: "Usuario y contrase\xF1a requeridos" });
    }
    const user = await dataAdapter.getUserByUsername(username.trim().toLowerCase());
    if (!user || !user.activo || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      recordFailedLogin(ip);
      return res.status(401).json({ error: "Credenciales incorrectas o usuario inactivo" });
    }
    resetFailedLogin(ip);
    const token = generateToken({ id: user.id, username: user.username, rol: user.rol });
    const settingCamp = await dataAdapter.getSetting("active_campaign");
    const authUser = {
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo || "",
      email: user.email || "",
      avatarInitials: user.avatar_initials || "",
      activo: Boolean(user.activo),
      campanaActiva: user.campana_activa || settingCamp || "2025-2026"
    };
    await dataAdapter.recordAudit({
      usuarioId: user.id,
      usuarioNombre: user.nombre_completo,
      usuarioRol: user.rol,
      accion: "INICIO_SESION",
      entidad: "USUARIO",
      entidadId: user.id,
      ip
    });
    res.json({ token, user: authUser });
  } catch (error) {
    console.error("Error en /api/auth/login:", error);
    res.status(500).json({ error: "Error durante el inicio de sesi\xF3n" });
  }
});
app.post("/api/auth/logout", async (req, res) => {
  try {
    if (req.user) {
      await auditLog(req, "CIERRE_SESION", "USUARIO", req.user.id, {});
    }
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
});
app.post("/api/auth/switch-user", async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: "targetUserId es requerido" });
    const targetUser = await dataAdapter.getUserById(targetUserId);
    if (!targetUser || !targetUser.activo) {
      return res.status(404).json({ error: "Usuario destino no disponible o inactivo" });
    }
    const token = generateToken({ id: targetUser.id, username: targetUser.username, rol: targetUser.rol });
    const settingCamp = await dataAdapter.getSetting("active_campaign");
    const authUser = {
      id: targetUser.id,
      username: targetUser.username,
      nombreCompleto: targetUser.nombre_completo,
      rol: targetUser.rol,
      cargo: targetUser.cargo || "",
      email: targetUser.email || "",
      avatarInitials: targetUser.avatar_initials || "",
      activo: Boolean(targetUser.activo),
      campanaActiva: targetUser.campana_activa || settingCamp || "2025-2026"
    };
    await auditLog(req, "CAMBIO_USUARIO", "USUARIO", targetUser.id, { aUsuario: targetUser.username });
    res.json({ token, user: authUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await dataAdapter.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo || "",
      email: user.email || "",
      avatarInitials: user.avatar_initials || "",
      activo: Boolean(user.activo),
      campanaActiva: user.campana_activa || "2025-2026"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.put("/api/users/me/active-campaign", async (req, res) => {
  try {
    const { campana } = req.body;
    if (!campana) return res.status(400).json({ error: "Campa\xF1a no especificada" });
    const user = await dataAdapter.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    user.campana_activa = campana;
    await dataAdapter.saveUser({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo,
      email: user.email,
      avatarInitials: user.avatar_initials,
      activo: user.activo,
      campanaActiva: campana
    });
    res.json({ success: true, campanaActiva: campana });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contrase\xF1a debe tener al menos 6 caracteres" });
    }
    const user = await dataAdapter.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    if (user.password_hash && !verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: "La contrase\xF1a actual no es correcta" });
    }
    const newHash = hashPassword(newPassword);
    await dataAdapter.saveUser({
      id: user.id,
      username: user.username,
      nombreCompleto: user.nombre_completo,
      rol: user.rol,
      cargo: user.cargo,
      email: user.email,
      avatarInitials: user.avatar_initials,
      activo: user.activo,
      passwordHash: newHash,
      campanaActiva: user.campana_activa
    });
    await auditLog(req, "MODIFICACION", "USUARIO", user.id, { accion: "Cambio de contrase\xF1a" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/users", requireAdmin, async (_req, res) => {
  try {
    const users = await dataAdapter.getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/users", requireAdmin, async (req, res) => {
  try {
    const { id, username, nombreCompleto, rol, cargo, email, avatarInitials, activo, password } = req.body;
    const userId = id || `usr-${Date.now()}`;
    const userToSave = {
      id: userId,
      username: username.trim().toLowerCase(),
      nombreCompleto,
      rol: rol || "CONSULTA",
      cargo: cargo || "",
      email: email || "",
      avatarInitials: avatarInitials || "",
      activo: activo !== false ? 1 : 0,
      campanaActiva: "2025-2026"
    };
    if (password) {
      userToSave.passwordHash = hashPassword(password);
    }
    const saved = await dataAdapter.saveUser(userToSave);
    await auditLog(req, "CREAR_EDITAR_USUARIO", "USUARIO", saved.id, { username: saved.username, rol: saved.rol });
    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  try {
    await dataAdapter.deleteUser(req.params.id);
    await auditLog(req, "ELIMINAR_USUARIO", "USUARIO", req.params.id, {});
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/audit-logs", async (_req, res) => {
  try {
    const logs = await dataAdapter.getAuditLogs();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/backup/stats", requireAdmin, async (_req, res) => {
  try {
    const [animals, owners, movements, campaigns, stallions, users, audit] = await Promise.all([
      dataAdapter.getAnimals(),
      dataAdapter.getOwners(),
      dataAdapter.getMovements(),
      dataAdapter.getCampaigns(),
      dataAdapter.getStallions(),
      dataAdapter.getUsers(),
      dataAdapter.getAuditLogs()
    ]);
    res.json({
      databaseSizeBytes: 0,
      databaseSizeFormatted: "Supabase Cloud Postgres",
      totalAnimals: animals.length,
      totalOwners: owners.length,
      totalMovements: movements.length,
      totalCampaigns: campaigns.length,
      totalStallions: stallions.length,
      totalUsers: users.length,
      totalAuditLogs: audit.length,
      documentsCount: 0,
      documentsSizeBytes: 0,
      documentsSizeFormatted: "Supabase Storage Bucket",
      lastModified: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/backup/export", requireAdmin, async (req, res) => {
  try {
    const [animals, owners, movements, campaigns, stallions, users, audit, settings] = await Promise.all([
      dataAdapter.getAnimals(),
      dataAdapter.getOwners(),
      dataAdapter.getMovements(),
      dataAdapter.getCampaigns(),
      dataAdapter.getStallions(),
      dataAdapter.getUsers(),
      dataAdapter.getAuditLogs(),
      dataAdapter.getSettings()
    ]);
    const backupData = {
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      version: "1.0",
      database: "Supabase Postgres Backup",
      data: {
        animals,
        owners,
        movements,
        campaigns,
        stallions,
        users,
        audit,
        settings
      }
    };
    const zip = new JSZip2();
    zip.file("database_export.json", JSON.stringify(backupData, null, 2));
    const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = `marisma_backup_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await auditLog(req, "DESCARGA_COPIA_SEGURIDAD", "SISTEMA", "BACKUP_ZIP", {});
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/admin/backup/download", requireAdmin, async (req, res) => {
  res.redirect("/api/admin/backup/export");
});
app.get("/api/export/equinos-ods", async (req, res) => {
  try {
    const campana = req.query.campana || "2025-2026";
    const [animals, owners, movements, stallions] = await Promise.all([
      dataAdapter.getAnimals(campana, "EQUINO"),
      dataAdapter.getOwners(campana),
      dataAdapter.getMovements(campana),
      dataAdapter.getStallions(campana)
    ]);
    const odsBuffer = await OdsExportService.generateEquinosWorkbook({
      campaign: campana,
      animals,
      owners,
      movements,
      stallions
    });
    const filename = `CENSO_EQUINO_HINOJOS_${campana}.ods`;
    res.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(odsBuffer);
  } catch (error) {
    console.error("Error generando ODS Equinos:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/export/bovinos-ods", async (req, res) => {
  try {
    const campana = req.query.campana || "2025-2026";
    const [animals, owners] = await Promise.all([
      dataAdapter.getAnimals(campana, "BOVINO"),
      dataAdapter.getOwners(campana)
    ]);
    const odsBuffer = await OdsExportService.generateBovinosWorkbook({
      campaign: campana,
      animals,
      owners
    });
    const filename = `CENSO_BOVINO_HINOJOS_${campana}.ods`;
    res.setHeader("Content-Type", "application/vnd.oasis.opendocument.spreadsheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(odsBuffer);
  } catch (error) {
    console.error("Error generando ODS Bovinos:", error);
    res.status(500).json({ error: error.message });
  }
});
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.LAMBDA_TASK_ROOT && process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`\u{1F680} Servidor Marisma de Hinojos (Supabase) ejecut\xE1ndose en http://localhost:${PORT}`);
  });
}
var index_default = app;
export {
  index_default as default
};
