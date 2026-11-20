import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const PORT = 9444;
const USER_DATA = path.resolve(__dirname, '..', '.chrome-data');

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await new Promise<string>((resolve, reject) => {
        http.get(`http://127.0.0.1:${PORT}/json/version`, (r) => {
          let data = '';
          r.on('data', chunk => data += chunk);
          r.on('end', () => resolve(data));
        }).on('error', reject);
      });
      const json = JSON.parse(res);
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Chrome remote debugging did not respond');
}

class CDPClient {
  private ws!: WebSocket;
  private id = 1;
  private callbacks = new Map<number, (res: any) => void>();

  async connect(url: string) {
    this.ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        this.callbacks.get(msg.id)!(msg);
        this.callbacks.delete(msg.id);
      }
    };
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.id++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async close() {
    this.ws.close();
  }
}

async function run() {
  const screenshotsDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  console.log('Iniciando navegador headless para capturar pantallas actualizadas...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1440,960',
    'about:blank'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const browserClient = new CDPClient();
    await browserClient.connect(wsUrl);

    const { targetId } = await browserClient.send('Target.createTarget', { url: 'about:blank' });
    const pagesRes = await new Promise<string>((resolve) => {
      http.get(`http://127.0.0.1:${PORT}/json`, (r) => {
        let d = '';
        r.on('data', chunk => d += chunk);
        r.on('end', () => resolve(d));
      });
    });
    const pages = JSON.parse(pagesRes);
    const pageTarget = pages.find((p: any) => p.id === targetId) || pages[0];

    const pageClient = new CDPClient();
    await pageClient.connect(pageTarget.webSocketDebuggerUrl);

    await pageClient.send('Page.enable');
    await pageClient.send('Runtime.enable');
    await pageClient.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const adminUser = {
      id: 'user-1',
      username: 'antonio',
      nombreCompleto: 'Administrador del Sistema',
      rol: 'ADMINISTRADOR',
      cargo: 'Administrador Municipal',
      email: 'informatica@hinojos.es',
      avatarInitials: 'AD',
      activo: true,
      campanaActiva: '2025-2026'
    };
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItMSIsInVzZXJuYW1lIjoiYW50b25pbyIsInJvbCI6IkFETUlOSVNUUkFET1IiLCJpYXQiOjE3OTUwMjY5NDEsImV4cCI6MTc5NTYzMTc0MX0.twFQkC-hRWKSo66Zw1ah_XD-0LB9LH5ahEUS9oKaDa0';

    async function navigateTo(tab: string, settingsSec: string = 'ESTADISTICAS') {
      await pageClient.send('Runtime.evaluate', {
        expression: `
          localStorage.setItem('marisma_auth_token', '${token}');
          localStorage.setItem('marisma_hinojos_current_user_v1', JSON.stringify(${JSON.stringify(adminUser)}));
          localStorage.setItem('marisma_active_tab', '${tab}');
          localStorage.setItem('marisma_settings_section', '${settingsSec}');
          window.location.href = 'http://127.0.0.1:3000';
        `
      });
      await sleep(2500);
    }

    // Navegar primero a la aplicación para tener el origen http://127.0.0.1:3000 establecido
    console.log('Navegando a http://127.0.0.1:3000...');
    await pageClient.send('Page.navigate', { url: 'http://127.0.0.1:3000' });
    await sleep(3000);

    // 1. CENSO EQUINO (con nueva cabecera con pestaña Entradas)
    console.log('1. Capturando Censo Equino actualizado...');
    await navigateTo('EQUINO');
    const equinoShot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, '02_censo_equino.png'), Buffer.from(equinoShot.result.data, 'base64'));

    // 2. MÓDULO ENTRADAS (Listado de remesas)
    console.log('2. Capturando Módulo Oficial de Entradas a la Marisma...');
    await navigateTo('ENTRADAS');
    await sleep(2000);
    const entradasShot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, '17_entradas_view.png'), Buffer.from(entradasShot.result.data, 'base64'));

    // 3. MODAL EDITOR DE ENTRADA
    console.log('3. Capturando Formulario de Solicitud de Entrada...');
    await pageClient.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Nueva Solicitud') || b.textContent.includes('Nueva Solicitud'));
        if (btn) btn.click();
      `
    });
    await sleep(2500);
    const editorEntradaShot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, '18_editor_entrada.png'), Buffer.from(editorEntradaShot.result.data, 'base64'));

    // 4. MODAL CONSULTA DE ACCESOS POR GANADERO
    console.log('4. Capturando Consulta de Accesos por Ganadero...');
    await navigateTo('ENTRADAS');
    await sleep(2000);
    await pageClient.send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Consultar por Ganadero'));
        if (btn) btn.click();
      `
    });
    await sleep(2500);
    const consultaPersonaShot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, '19_consulta_persona_entradas.png'), Buffer.from(consultaPersonaShot.result.data, 'base64'));

    // Cerrar modal de consulta
    await pageClient.send('Runtime.evaluate', {
      expression: `
        const closeBtn = document.querySelector('button[title="Cerrar"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cerrar') || b.textContent.includes('✕'));
        if (closeBtn) closeBtn.click();
      `
    });
    await sleep(1000);

    // 5. AJUSTES - CONFIGURACIÓN SMTP
    console.log('5. Capturando Configuración SMTP en Ajustes...');
    await navigateTo('AJUSTES', 'SMTP');
    await sleep(2000);
    const smtpShot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, '20_ajustes_smtp.png'), Buffer.from(smtpShot.result.data, 'base64'));

    // 6. FICHA DETALLE ANIMAL (con fecha de subida de documentos)
    console.log('6. Capturando Ficha Detalle Animal con fechas de documentos...');
    await navigateTo('EQUINO');
    await sleep(1500);
    await pageClient.send('Runtime.evaluate', {
      expression: `
        const viewIcons = Array.from(document.querySelectorAll('table tbody tr button')).filter(b => b.querySelector('svg.lucide-eye') || b.title?.includes('ficha'));
        if (viewIcons.length > 0) viewIcons[0].click();
      `
    });
    await sleep(1500);
    const detailShot = await pageClient.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotsDir, '12_ficha_detalle_animal.png'), Buffer.from(detailShot.result.data, 'base64'));

    await pageClient.close();
    await browserClient.close();
    console.log('✅ Todas las nuevas capturas de pantalla han sido generadas con éxito.');
  } finally {
    chromeProc.kill();
  }
}

run().catch(console.error);
