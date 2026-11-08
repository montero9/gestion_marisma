# RESUMEN GENERAL DEL PROYECTO · GESTIÓN MARISMA 2 (HINOJOS)
> **Fecha de consolidación de contexto:** Noviembre de 2026  
> **Propósito:** Documento de transferencia de contexto integral para inicializar nuevas sesiones de desarrollo en Google Antigravity sin pérdida de decisiones arquitectónicas, reglas municipales ni estado del sistema.

---

## 1. IDEA GENERAL Y OBJETIVOS DEL SISTEMA

### 1.1. Contexto y Propósito
**Gestión Marisma 2** es una plataforma web integral de gestión zootécnica y control de censo ganadero diseñada específicamente para la **Marisma de Hinojos (Espacio Natural de Doñana / Huelva, España)**, gestionada por el **Ayuntamiento de Hinojos**. 

El sistema digitaliza y automatiza el censo oficial, control de plazas comunales, trazabilidad de movimientos, asignación de sementales reproductores y expedientes documentales de dos especies ganaderas:
1. **Ganado Equino** (Yeguas de la Marisma, caballos, potros y rastras/crías al pie).
2. **Ganado Bovino** (Vacas marismeñas, toros, terneros y nodrizas).

### 1.2. Objetivos Principales
* **Control riguroso del censo comunal:** Garantizar que no haya animales indocumentados, que cada plaza física asignada sea unívoca por campaña y que el censo cumpla los límites de carga ganadera del Espacio Natural.
* **Trazabilidad histórica permanente:** Conectar la vida de un animal y de un ganadero a lo largo de múltiples campañas sucesivas (ej. `2024-2025`, `2025-2026`, `2026-2027`).
* **Prevención activa de duplicados e inconsistencias:** Impedir altas de chips/crotales duplicados en la misma campaña, verificar matemáticamente DNIs oficiales y evitar colisiones de plazas.
* **Cumplimiento legal y administrativo:** Generar la documentación oficial (Libro de Movimientos, Censo Oficial de Sementales, Expedientes individuales, plantillas normalizadas en formato `.ods` para la Asociación y el Ayuntamiento de Hinojos, y reportes de auditoría).

---

## 2. ARQUITECTURA TÉCNICA Y DECISIONES CLAVE DE LÓGICA

### 2.1. Stack Tecnológico
* **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite (puerto `3000`).
* **Backend:** Node.js, Express, TypeScript (`tsx`), Multer para gestión de ficheros/PDFs y JSZip para copias completas `.zip` (puerto `3001`).
* **Base de Datos Local:** SQLite (`data/marisma.db`) con modo WAL (`PRAGMA journal_mode = WAL;`) de alto rendimiento.
* **Autenticación y Seguridad:** JWT con bcrypt/scrypt para passwords, expiración, control de intentos fallidos (rate limiting), roles estrictos (`ADMINISTRADOR` y `CONSULTA`), endpoint `POST /api/auth/logout` con registro en auditoría y endpoint `POST /api/auth/switch-user` para traspaso de tokens en cambios de cuenta. Botón "Salir" independiente y visible en cabecera con limpieza atómica de almacenamiento local. En arranque/refresco, si no hay token verificado por el backend, se bloquea el acceso y se exige autenticación.

### 2.2. Decisiones Clave de Lógica de Negocio y Reglas Municipales

#### A. Identificación Primaria Obligatoria (Paso 1 Bloqueante)
En todos los formularios de alta (`AnimalModal.tsx`, `StallionsView.tsx` y `OwnersView.tsx`):
1. **Campo 1 Mandatorio:**
   * **Propietarios:** `DNI / CIF` con verificación oficial.
   * **Animales:** `Microchip` (Equino) o `Crotal Oficial` (Bovino).
   * **Sementales:** `Microchip` (Caballo) o `Crotal Oficial` (Toro).
2. **Bloqueo Reactivo:** El resto del formulario se encuentra desactivado hasta ingresar un identificador válido.
3. **Control de Duplicados en Campaña Actual:** Si el identificador ya existe en la campaña activa, se lanza alerta roja bloqueante.
4. **Autorrellenado Histórico Automático:** Si el chip o DNI existe en campañas anteriores, se detecta el registro histórico y se precargan automáticamente sus datos.

#### B. Validación Matemática Oficial de DNI / NIE / CIF
* Implementado en `OwnersView.tsx` bajo el estándar oficial del Ministerio del Interior (`Módulo 23`):
  * **DNI:** `número % 23` con letra de control.
  * **NIE:** Sustitución de `X=0`, `Y=1`, `Z=2`.
  * **CIF:** Sumas ponderadas y dígito/letra de control.
* **Asistente en tiempo real:** Botón interactivo *"Asignar letra oficial correcta: [X]"*.

#### C. Plazas Comunales (`plazaNumero`)
* Prefijo correlativo obligatorio:
  * **Equino:** `HI` seguido de 3 dígitos (ej. `HI001`, `HI002`...).
  * **Bovino:** `HIN` seguido de 3 dígitos (ej. `HIN001`, `HIN002`...).
* Unicidad estricta por campaña. Admite plazas vacantes (`esPlazaVacante: true`).

#### D. Regla Especial del Ganado Bovino (Sin Nombre)
* Los animales bovinos **NO tienen nombre**, únicamente se identifican por Crotal Oficial y Plaza (`HINxxx`).
* La columna "Nombre" está eliminada de las tablas de bovinos y normalizada en la base de datos a cadena vacía.

#### E. Botón de Eliminación Directa de Animal
* Implementado en los listados de censo de animales botón de eliminación con confirmación modal segura para depurar registros erróneos o bajas administrativas.

#### F. Ordenación y Gestión de Campañas
* En el panel de Ajustes y Administración, las campañas se ordenan cronológicamente de arriba a abajo (las más recientes arriba y las más antiguas abajo).
* Al eliminar una campaña, el sistema reubica automáticamente a todos los usuarios y la sesión a una campaña válida existente, impidiendo que una campaña eliminada permanezca activa.

#### G. Trazabilidad de Movimientos e Históricos
* Cada movimiento queda vinculado tanto al `animal_id` como a la `campana` y a la `identificacion1` (crotal/microchip).
* **Histórico Expediente por Animal:** Al filtrar por una campaña concreta, muestra exclusivamente los movimientos de esa campaña; al seleccionar "Todas las campañas", muestra la trayectoria histórica integral.
* **Libro Cronológico:** Muestra cronológicamente todos los movimientos de cualquier campaña.

---

## 3. NUEVOS MÓDULOS DE SEGURIDAD Y ADMINISTRACIÓN

### 3.1. «Auditoría» (Registro Oficial de Trazabilidad)
* **Tabla SQLite `audit_logs`:** Registro inmutable de cada acción relevante en el sistema:
  * `ALTA`, `MODIFICACION`, `BAJA`, `PERMUTA`, `MOVIMIENTO`
  * `NUEVA_CAMPANA`, `RENOMBRAR_CAMPANA`, `ELIMINAR_CAMPANA`
  * `CREAR_EDITAR_GANADERO`, `ELIMINAR_GANADERO`
  * `INICIO_SESION`, `CREAR_EDITAR_USUARIO`, `ELIMINAR_USUARIO`
  * `DESCARGA_COPIA_SEGURIDAD`, `RESTAURAR_COPIA_SEGURIDAD`
* **Campos almacenados:** ID único, fecha/hora ISO, ID de usuario, nombre de usuario, rol, acción, entidad afectada, ID de la entidad, IP de origen y JSON de cambios (valores antes/después).
* **Interfaz de Auditoría (`AuditView.tsx`):**
  * Título oficial: **Auditoría**.
  * Buscador rápido por usuario, plaza, crotal, motivo o detalles.
  * Filtros por Acción y por Entidad.
  * Botón para ver modal con el JSON completo del registro.
  * Exportación de informes oficiales en formato CSV con UTF-8 BOM para Excel.

### 3.2. «Copia de Seguridad» (Respaldo Manual Completo .ZIP)
* **Filosofía:** Copia de seguridad integral bajo demanda en 1 solo clic (sin copias periódicas automáticas, conforme a los requerimientos del usuario).
* **Diagnóstico en vivo:** Tamaño de la base de datos `marisma.db`, estado WAL consolidado, recuento y tamaño de documentos físicos en `uploads/documents/`, animales, movimientos, ganaderos y registros de auditoría.
* **Descarga (.ZIP):**
  1. Ejecuta `PRAGMA wal_checkpoint(TRUNCATE)` para consolidar SQLite.
  2. Empaqueta `marisma.db`.
  3. Empaqueta `manifest.json` oficial con metadatos del Ayuntamiento de Hinojos.
  4. Empaqueta la carpeta `documents/` con todos los PDFs y fotos adjuntas.
  5. Registra el evento en `audit_logs`.
* **Restauración (.ZIP):**
  1. Recibe el archivo `.ZIP` subido.
  2. **Copia de emergencia automática previa:** Genera `marisma.db.bak-<timestamp>` antes de sobreescribir.
  3. Vuelca la base de datos de forma atómica y extrae los documentos.
  4. Recarga la base de datos y la sesión en vivo.

### 3.3. Estructura de Pestañas en Ajustes y Administración (`SettingsView.tsx`)
1. **Estadísticas** (Censo, cupos y presencia)
2. **Campañas** (Creación con traspaso, edición y activación)
3. **Usuarios** (Gestión de cuentas y accesos)
4. **Auditoría** (Historial y trazabilidad de operaciones)
5. **Copia de Seguridad** (Descarga y restauración en 1 clic de archivos .ZIP)

---

## 4. GUÍA RÁPIDA DE ARRANQUE

```powershell
# 1. Servidor Backend (Express + SQLite en puerto 3001)
node ./node_modules/tsx/dist/cli.mjs server/index.ts

# 2. Frontend de Desarrollo (Vite en puerto 3000)
node ./node_modules/vite/bin/vite.js --port=3000 --host=0.0.0.0
```

* **URLs de acceso:**
  * Frontend: `http://localhost:3000`
  * Backend API: `http://localhost:3001`
  * Directorio de documentos adjuntos: `uploads/documents/`
  * Base de datos SQLite: `data/marisma.db`
