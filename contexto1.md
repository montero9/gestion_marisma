# Documento Técnico de Contexto y Transferencia de Proyecto
## Proyecto: Sistema de Gestión y Control Ganadero · Marisma de Hinojos (Doñana)
### Entidad: Ayuntamiento de Hinojos
**Estado:** Fullstack completo (Frontend React + TypeScript + Backend Express + Base de Datos SQLite WAL + Auditoría Municipal + Copias de Seguridad .ZIP).

---

## 1. Objetivo General de la Aplicación

El sistema tiene como objetivo principal la gestión integral, censo oficial, adjudicación de plazas municipales y control de trazabilidad ganadera (equina y bovina) en los terrenos comunales de la Marisma de Hinojos, en el entorno protegido de Doñana.

### Principios y Normativa Técnica Municipal Incorporada:
1. **Cómputo estricto de cupo:** El censo oficial contabiliza únicamente las plazas ordinarias asignadas (ocupadas o vacantes).
2. **Animales reproductores y crías (exentos de cómputo de cupo):**
   - Los sementales reproductores autorizados (parada comunal/libro de cubrición) pastan en la marisma pero no descuentan ni computan plazas del cupo ordinario.
   - Las rastras al pie (crías lactantes) acompañan a la madre con plaza pero tampoco descuentan ni computan plazas.
3. **Gestión por Campañas Anuales:** Cada año ganadero formaliza una campaña (ej. `2024-2025`, `2025-2026`, `2026-2027`), permitiendo consultar y auditar censos históricos sin sobrescribir ejercicios anteriores.
4. **Orden de Campañas:** En el panel de Ajustes y Administración, las campañas se listan cronológicamente con la más reciente arriba y la más antigua abajo.
5. **Regla de los Bovinos:** Los bovinos **no tienen nombre**, se identifican exclusivamente por Crotal Oficial y Plaza (`HINxxx`).
6. **Trazabilidad de Ausencias:** Los animales en estado Fuera Temporal conservan su derecho a reingreso y mantienen reservada su plaza municipal.

---

## 2. Arquitectura del Sistema

- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite (puerto 3000).
- **Backend:** Node.js, Express, TypeScript (`tsx`), Multer y JSZip (puerto 3001).
- **Base de Datos:** SQLite (`data/marisma.db`) con modo WAL (`PRAGMA journal_mode = WAL;`).
- **Autenticación:** JWT con cifrado de contraseñas, rate limiter de intentos fallidos, roles `ADMINISTRADOR` y `CONSULTA`, endpoints `/api/auth/logout` y `/api/auth/switch-user`, botón de "Salir" independiente en cabecera y verificación estricta de token en cada recarga.
- **Almacenamiento de Ficheros:** Carpeta local `uploads/documents/` para PDFs, certificados sanitarios y fotografías de marcas.

---

## 3. Módulos y Funcionalidades

### A. Censo de Animales (Equino y Bovino)
- Tablas diferenciadas por especie con buscador en tiempo real, filtros por presencia y numeración oficial (`HIxxx` para equinos, `HINxxx` para bovinos).
- Formulario de alta con Identificación Primaria obligatoria y bloqueante (Paso 1).
- Botón de borrado directo de animal en los listados.
- Ficha oficial imprimible con escudo del Ayuntamiento de Hinojos.
- Asignación de plazas vacantes y permuta directa entre ganaderos.

### B. Ganaderos y Asociaciones
- Directorio de ganaderos con validación matemática oficial de DNI / NIE / CIF (Módulo 23).
- Asistente de cálculo y corrección de letra de control.
- Censo agrupado por asociaciones ganaderas.

### C. Libro de Sementales
- Registro de reproductores autorizados (equinos y bovinos).
- Validación de microchip/crotal contra censo y lista de sementales.

### D. Trazabilidad de Movimientos
- Registro de entradas, salidas temporales, reingresos y bajas definitivas.
- **Histórico por animal:** Filtrable por campaña individual o por todas las campañas.
- **Libro cronológico:** Visualización de todos los movimientos históricos de cualquier campaña.

### E. Módulo «Auditoría»
- Registro inmutable de operaciones en la tabla `audit_logs` (altas, bajas, modificaciones, permutas, movimientos, campañas, usuarios, ganaderos, copias de seguridad).
- Buscador por texto, filtros por acción y entidad, modal con JSON de cambios y exportación a informe oficial en CSV con UTF-8 BOM.
- Pestaña oficial en Ajustes: **Auditoría**.

### F. Módulo «Copia de Seguridad»
- Respaldo completo bajo demanda en 1 solo clic en formato `.ZIP` (contiene `marisma.db` con checkpoint WAL consolidado, `manifest.json` oficial con metadatos y carpeta `documents/` con todos los PDFs y fotografías).
- Restauración segura con generación automática de copia de emergencia (`marisma.db.bak-<timestamp>`) previa a la sobreescritura.
- Exclusión deliberada de copias periódicas automáticas (solo bajo demanda).
- Pestaña oficial en Ajustes: **Copia de Seguridad**.

### G. Exportación de Libros Oficiales ODS (LibreOffice / OpenDocument)
- **Equinos:** Libro maestro de 4 hojas (`Censo Equino`, `Sementales`, `Expediente Histórico`, `Libro de Movimientos`).
- **Bovinos:** Libro oficial de 1 hoja idéntica a la plantilla municipal.

---

## 4. Estructura de Pestañas en Ajustes y Administración (`SettingsView.tsx`)
1. **Estadísticas** (Censo, cupos y presencia)
2. **Campañas** (Creación con traspaso, edición y activación)
3. **Usuarios** (Gestión de cuentas y accesos)
4. **Auditoría** (Historial y trazabilidad de operaciones)
5. **Copia de Seguridad** (Descarga y restauración en 1 clic de archivos .ZIP)

---

## 5. Guía de Ejecución Rápida

```powershell
# 1. Servidor Backend (Express + SQLite en puerto 3001)
node ./node_modules/tsx/dist/cli.mjs server/index.ts

# 2. Frontend de Desarrollo (Vite en puerto 3000)
node ./node_modules/vite/bin/vite.js --port=3000 --host=0.0.0.0
```
