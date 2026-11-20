import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BROWSER_PATH = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const docsDir = path.resolve(__dirname, '..', 'docs');

const files = [
  {
    html: path.join(docsDir, 'manual_tecnico.html'),
    pdf: path.join(docsDir, 'MANUAL_TECNICO_GESTION_MARISMA.pdf'),
    name: 'Manual Técnico para Programadores'
  },
  {
    html: path.join(docsDir, 'manual_usuario.html'),
    pdf: path.join(docsDir, 'MANUAL_USUARIO_GESTION_MARISMA.pdf'),
    name: 'Manual de Usuario para Operadores y Personal Municipal'
  }
];

console.log('Compilando manuales a formato PDF de alta fidelidad con motor Chromium...');

for (const f of files) {
  console.log(`\nGenerando: ${f.name}...`);
  const cmd = `"${BROWSER_PATH}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${f.pdf}" "${f.html}"`;
  execSync(cmd, { stdio: 'inherit' });
  if (fs.existsSync(f.pdf)) {
    const stats = fs.statSync(f.pdf);
    console.log(`✅ Generado con éxito: ${path.basename(f.pdf)} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.error(`❌ Error: No se encontró el archivo ${f.pdf}`);
  }
}

console.log('\nTodos los manuales PDF han sido generados satisfactoriamente.');
