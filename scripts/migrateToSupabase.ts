import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gowdixuenmfmvxdnlgpw.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'sb_secret_7p0L0wIkWojx_BezjZSciQ_OQh1trI1';

const dbPath = path.resolve(__dirname, '..', 'data', 'marisma.db');
const db = new DatabaseSync(dbPath);
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function migrateTable(tableName: string) {
  try {
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    console.log(`[${tableName}] Leyendo ${rows.length} registros de SQLite...`);
    if (rows.length === 0) return;

    // Insertar en lotes de 100 para evitar límites de payload
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase.from(tableName).upsert(batch);
      if (error) {
        console.error(`Error insertando lote en ${tableName}:`, error);
        throw error;
      }
    }

    const { count, error: countErr } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    if (countErr) {
      console.error(`Error contando en ${tableName}:`, countErr);
    } else {
      console.log(`✓ [${tableName}] Migrado con éxito. Filas en Supabase: ${count}`);
    }
  } catch (err: any) {
    console.error(`Fallo en migración de ${tableName}:`, err.message || err);
  }
}

async function runMigration() {
  console.log('Iniciando migración de SQLite a Supabase...');
  console.log('Destino:', SUPABASE_URL);

  const tables = [
    'campaigns',
    'associations',
    'owners',
    'stallions',
    'animals',
    'movements',
    'users',
    'settings',
    'audit_logs'
  ];

  for (const table of tables) {
    await migrateTable(table);
  }

  console.log('\n--- VERIFICACIÓN FINAL ---');
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`${table}: ${count} filas`);
  }
  console.log('Migración finalizada.');
}

runMigration().catch(console.error);
