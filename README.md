<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Gestión Ganadera · Marisma de Hinojos

Aplicación React 19 y Express con SQLite para el censo, trazabilidad y gestión municipal.

## Puesta en marcha

1. Instala las dependencias: `npm install`.
2. Copia `.env.example` a `.env` y define `JWT_SECRET` e `INITIAL_ADMIN_PASSWORD` con valores seguros. Son obligatorios al crear una base de datos y en producción.
3. Inicia el backend: `npm run server`.
4. En otra terminal, inicia la interfaz: `npm run dev`.

Las cuentas de consulta sólo pueden leer. Las operaciones de alta, modificación, baja, administración, restauración y campañas requieren una cuenta administradora.
