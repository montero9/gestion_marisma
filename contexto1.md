# Documento Técnico de Contexto y Transferencia de Proyecto
## Proyecto: Sistema de Gestión y Control Ganadero · Marisma de Hinojos (Doñana)
### Entidad: Ayuntamiento de Hinojos
**Estado:** Fullstack completo (Frontend React + TypeScript + Backend Express / Serverless Vercel + Base de Datos Supabase PostgreSQL + Almacenamiento Supabase Storage + Generador Oficial ODS + Envío SMTP Cifrado AES-256 + Copias de Seguridad .ZIP).

---

## 1. Objetivo General de la Aplicación

El sistema tiene como objetivo principal la gestión integral, censo oficial, adjudicación de plazas municipales, trazabilidad ganadera (equina y bovina) y tramitación oficial de permisos de entrada a los terrenos comunales de la Marisma de Hinojos, en el entorno protegido de Doñana.

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

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite (puerto 3000).
- **Backend:** Node.js, Express, TypeScript (`tsx`), Multer, JSZip y Nodemailer (puerto 3001) para entorno local; compatible con Serverless Functions (`api/index.js`) para despliegue en Vercel.
- **Base de Datos:** PostgreSQL en la nube mediante **Supabase** (tablas `animals`, `owners`, `associations`, `stallions`, `movements`, `users`, `campaigns`, `entradas_remesas`, `entradas_documentos`, `settings`).
- **Almacenamiento de Ficheros (Storage):** **Supabase Storage** (bucket `marisma-documents`) para PDFs, guías de traslado sanitario, certificados y fotografías de marcas ganaderas.
- **Seguridad Criptográfica:** Contraseñas de acceso con hash seguro, contraseñas de servidor SMTP cifradas con algoritmo **AES-256-GCM** en base de datos.
- **Autenticación:** JWT con cifrado de contraseñas, rate limiter de intentos fallidos, roles `ADMINISTRADOR` y `CONSULTA`, botón de "Salir" independiente en cabecera y verificación estricta de token en cada recarga.

---

## 3. Navegación Principal de la Aplicación

La barra superior oficial del Ayuntamiento de Hinojos (`Header.tsx`) cuenta con las siguientes pestañas:
1. 🐎 **Equino:** Censo, fichas oficiales, alta de animales y paradas de sementales.
2. 🐂 **Bovino:** Censo de vacuno sin nombre, identificado por crotal y plaza `HINxxx`.
3. 👥 **Propietarios:** Directorio de ganaderos, validación matemática de NIF/NIE/CIF y asociaciones.
4. 📜 **Histórico:** Libro cronológico de movimientos, entradas, salidas temporales y bajas.
5. 📄 **Entradas:** Módulo oficial de tramitación de permisos de acceso a la marisma.
6. ⚙️ **Ajustes:** Panel administrativo del sistema municipal.

---

## 4. Módulos y Funcionalidades

### A. Censo de Animales (Equino y Bovino)
- Tablas diferenciadas por especie con buscador en tiempo real, filtros por presencia y numeración oficial (`HIxxx` para equinos, `HINxxx` para bovinos).
- Formulario de alta con Identificación Primaria obligatoria y bloqueante (Paso 1).
- Botón de borrado directo de animal en los listados.
- Ficha oficial imprimible con escudo del Ayuntamiento de Hinojos.
- Asignación de plazas vacantes y permuta directa entre ganaderos.
- Repositorio documental por animal: visualización de guías y documentos asociados con indicación de fecha de subida (`📅 DD/MM/AAAA`).

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

### E. Módulo Oficial «Permisos de Entrada a la Marisma» (`EntradasView.tsx` / `EntradaEditorModal.tsx`)
- Tramitación de solicitudes de acceso a la marisma para faenas ganaderas (soltar, recoger o repasar), agrupadas en días oficiales (Miércoles/Jueves o Sábado/Domingo).
- **Búsqueda asistida en censo:** Autocompletado inmediato de titulares y equinos filtrados por campaña activa y deduplicados por microchip/plaza.
- **Control de duplicados:** Bloqueo automático para evitar que una misma persona o animal figure más de una vez en la misma fecha de entrada.
- **Gestión documental de Guías:** Subida de archivos PDF de guías sanitarias directamente desde la solicitud de entrada; los documentos se vinculan automáticamente a la ficha del animal en la marisma con su fecha de registro.
- **Limpieza de hosting:** Al borrar una solicitud o animal, los documentos huérfanos se eliminan de Supabase Storage para no consumir espacio innecesario.
- **Generación Oficial .ODS (LibreOffice Calc):**
  - Generado a partir de la plantilla oficial del Espacio Natural de Doñana (`server/templates/plantilla_entradas_donana.ods`).
  - Formato institucional con cabecera verde, bordes completos en todas las celdas y filas, y salto automático de línea (`fo:wrap-option="wrap"`) en la columna de observaciones para evitar desbordamientos.
  - Inclusión de línea divisoria visual entre los días consecutivos (ej. entre Sábado y Domingo).
- **Consulta de Accesos por Ganadero (`EntradaConsultaPersonaModal.tsx`):**
  - Herramienta específica para mandos y superiores municipales para auditar cuántas veces ha entrado una persona concreta en un periodo o campaña determinada.
  - Estadísticas detalladas de entradas como titular, acompañante y desglose por faenas.
  - Botón directo **[Ver]** para inspeccionar la solicitud completa en modo solo lectura con retorno rápido a la consulta.
- **Estados de Remesa y Distintivo en Listado:**
  - Estados: `BORRADOR` (amarillo/ámbar) y `ENVIADO` (verde esmeralda).
  - Posibilidad de enviar por correo oficial o de **Marcar como enviado** manualmente (para trámites presenciales o telefónicos).
  - Distintivo unificado en el título del listado con el formato:
    `ENVIADO [DÍA_SEMANA] DD/MM/AA` (ej. `ENVIADO MARTES 17/11/26`).

### F. Módulo «Configuración SMTP» (`SmtpConfigView.tsx`)
- Integrado directamente en el menú de **Ajustes y Administración**.
- Configuración de salida de correo oficial para la remisión de informes .ODS a la guardería del Espacio Natural de Doñana.
- Campos de administración:
  - Servidor SMTP (Host, Puerto, SSL/TLS).
  - Credenciales (Usuario y Contraseña protegida).
  - Nombre del remitente oficial.
  - Destinatarios oficiales (múltiples correos separados por comas) y copias ocultas (BCC).
  - Botón de verificación y prueba de conexión en tiempo real.
- **Persistencia y Seguridad:** Todos los parámetros se guardan de forma permanente en la tabla `settings` de Supabase PostgreSQL; la contraseña se almacena cifrada con algoritmo **AES-256-GCM**.
- **Formato de Comunicación Oficial:** Asunto dinámico normalizado (`Entradas Marisma- [Días] [Año]`) y cuerpo de mensaje protocolario formal del Ayuntamiento de Hinojos.

### G. Módulo «Copia de Seguridad» (`BackupView.tsx`)
- Respaldo completo bajo demanda en 1 solo clic en formato `.ZIP` (contiene volcado de datos, manifiesto oficial y documentos).
- Restauración segura con generación automática de copia de emergencia previa a la sobreescritura.
- Pestaña oficial en Ajustes: **Copia de Seguridad**.

### H. Exportación de Libros Oficiales ODS (LibreOffice / OpenDocument)
- **Equinos:** Libro maestro de 4 hojas (`Censo Equino`, `Sementales`, `Expediente Histórico`, `Libro de Movimientos`).
- **Bovinos:** Libro oficial de 1 hoja idéntica a la plantilla municipal.
- **Entradas a la Marisma:** Generación oficial de la hoja de remesa semanal para el Espacio Natural.

---

## 5. Estructura de Pestañas en Ajustes y Administración (`SettingsView.tsx`)

1. 📊 **Estadísticas** (Censo, cupos y presencia)
2. 📅 **Campañas** (Creación con traspaso, edición y activación)
3. 👥 **Usuarios** (Gestión de cuentas y accesos)
4. ✉️ **Configuración SMTP** (Servidor de correo, credenciales cifradas y destinatarios oficiales)
5. 💾 **Copia de Seguridad** (Descarga y restauración en 1 clic de archivos .ZIP)

---

## 6. Guía de Ejecución Rápida

### En Entorno Local (Windows / PowerShell):

```powershell
# 1. Servidor Backend (Express + Supabase en puerto 3001)
cmd.exe /c "npm run server"

# 2. Frontend de Desarrollo (Vite en puerto 3000)
cmd.exe /c "npm run dev"

# 3. Comprobación de Tipos TypeScript
cmd.exe /c "npm run lint"

# 4. Compilación de Producción (Cliente + Servidor Serverless)
cmd.exe /c "npm run build"
```
