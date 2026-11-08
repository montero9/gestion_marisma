// ==============================================================================
// GESTIÓN MARISMA - SUPABASE ADAPTER STUB
// ==============================================================================
// Toda la base de datos se encuentra migrada y gestionada en Supabase PostgreSQL.
// Este archivo stub mantiene la compatibilidad sin dependencias de SQLite en disco.

export const db: any = new Proxy({}, {
  get(_target, _prop) {
    return () => ({
      all: () => [],
      get: () => null,
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
    });
  },
});

export function initDatabase() {
  // Sin operaciones locales: la base de datos es Supabase Cloud
}

export function checkpointDb() {}
export function reloadDbFromFile() {}
export function validateDatabaseBuffer() { return true; }
