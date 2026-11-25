import nodemailer, { type SendMailOptions } from 'nodemailer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { SmtpConfig, EntradaRemesa, User } from '../../src/types/marisma.js';
import { dataAdapter } from '../dataAdapter.js';

// Clave y algoritmo para blindar y cifrar contraseñas en reposo (AES-256-GCM)
const secretForEncryption = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET;
if (!secretForEncryption && process.env.NODE_ENV === 'production') {
  throw new Error('[SEGURIDAD CRÍTICA] Debe configurar ENCRYPTION_SECRET o JWT_SECRET en las variables de entorno.');
}
const ENCRYPTION_KEY = crypto.scryptSync(
  secretForEncryption || 'marisma-de-hinojos-smtp-secret-key-32',
  process.env.ENCRYPTION_SALT || 'marisma_salt',
  32
);
const ALGORITHM = 'aes-256-gcm';

/**
 * Valida que un host SMTP sea una dirección externa segura y no una IP privada o metadato de nube (SSRF)
 */
export function isSafeSmtpHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const clean = host.trim().toLowerCase();

  const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '169.254.169.254', 'metadata.google.internal'];
  if (blockedHosts.includes(clean)) return false;

  if (
    /^10\./.test(clean) ||
    /^192\.168\./.test(clean) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean) ||
    /^127\./.test(clean)
  ) {
    return false;
  }

  return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean);
}

export function encryptPassword(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptPassword(cipherText: string): string {
  if (!cipherText) return '';
  if (!cipherText.startsWith('enc:')) {
    // Si aún no estaba cifrado, devolver en texto plano para compatibilidad
    return cipherText;
  }
  try {
    const [, ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Error descifrando contraseña SMTP:', err);
    return '';
  }
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const host = process.env.SMTP_HOST || (await dataAdapter.getSetting('entradas_smtp_host')) || '';
  const port = parseInt(
    process.env.SMTP_PORT || (await dataAdapter.getSetting('entradas_smtp_port')) || '587',
    10
  );
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : (await dataAdapter.getSetting('entradas_smtp_secure')) === 'true';
  const user = process.env.SMTP_USER || (await dataAdapter.getSetting('entradas_smtp_user')) || '';

  // Primero verificar si está en variables de entorno (máxima seguridad)
  let pass = process.env.SMTP_PASS || '';
  if (!pass) {
    const rawPass = (await dataAdapter.getSetting('entradas_smtp_pass')) || '';
    pass = decryptPassword(rawPass);
  }

  const fromName =
    process.env.SMTP_FROM_NAME ||
    (await dataAdapter.getSetting('entradas_smtp_from_name')) ||
    'Ayuntamiento de Hinojos - Control Ganadero';
  const destinatarios =
    process.env.SMTP_DESTINATARIOS ||
    (await dataAdapter.getSetting('entradas_email_destinatarios')) ||
    '';
  const bcc =
    process.env.SMTP_BCC || (await dataAdapter.getSetting('entradas_email_bcc')) || '';

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    destinatarios,
    bcc,
  };
}

export async function testSmtpConnection(config: SmtpConfig, testRecipient?: string) {
  if (!config.host || !config.user) {
    throw new Error('Faltan datos de configuración SMTP (servidor o usuario)');
  }

  if (!isSafeSmtpHost(config.host)) {
    throw new Error('El servidor SMTP especificado no es una dirección de host externa válida o está restringida.');
  }

  if (config.port && (config.port < 1 || config.port > 65535)) {
    throw new Error('El puerto SMTP debe ser un número válido entre 1 y 65535.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.secure ?? (config.port === 465),
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production' && process.env.SMTP_ALLOW_SELFSIGNED !== 'true',
    },
  });

  await transporter.verify();

  if (testRecipient && testRecipient.trim()) {
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.user}>`,
      to: testRecipient.trim(),
      subject: 'Prueba de Conexión SMTP - Control Ganadero Hinojos',
      text: 'Este es un mensaje de prueba emitido desde la aplicación de Gestión Marisma de Hinojos para verificar la correcta configuración del servidor de correo.',
    });
  }

  return { success: true, message: 'Conexión SMTP verificada correctamente' };
}

export async function sendEntradaEmail(params: {
  remesa: EntradaRemesa;
  odsBuffer: Buffer;
  destinatariosOverride?: string;
  user: User;
}) {
  const { remesa, odsBuffer, destinatariosOverride, user } = params;
  const config = await getSmtpConfig();

  if (!config.host || !config.user) {
    throw new Error('El servidor SMTP no está configurado en Ajustes. Configure primero las credenciales de correo.');
  }

  const targetRecipients = destinatariosOverride && destinatariosOverride.trim()
    ? destinatariosOverride.trim()
    : config.destinatarios;

  if (!targetRecipients) {
    throw new Error('No se han definido destinatarios para el Espacio Natural de Doñana.');
  }

  const recipientsList = targetRecipients
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  if (recipientsList.length === 0) {
    throw new Error('La lista de destinatarios está vacía.');
  }

  // Lista BCC para copia oculta: configurada + opcionalmente el email del usuario logueado
  const bccList: string[] = [];
  if (config.bcc) {
    config.bcc.split(/[,;]+/).forEach((e) => {
      const clean = e.trim();
      if (clean && !bccList.includes(clean)) bccList.push(clean);
    });
  }
  if (user.email && user.email.includes('@') && !bccList.includes(user.email.trim())) {
    bccList.push(user.email.trim());
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port || 587,
    secure: config.secure ?? (config.port === 465),
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production' && process.env.SMTP_ALLOW_SELFSIGNED !== 'true',
    },
  });

  const cleanFileName = (remesa.archivoOdsNombre || `${remesa.tituloOficial || 'Permisos_Marisma_Hinojos'}.ods`)
    .replace(/[^\w.-]/g, '_');

  const year =
    remesa.fechas && remesa.fechas.length > 0 && remesa.fechas[0]
      ? remesa.fechas[0].split('-')[0]
      : new Date().getFullYear().toString();

  let diasFormateados = (remesa.diasTexto || remesa.tituloOficial || '').trim();
  if (diasFormateados && !diasFormateados.includes(year)) {
    diasFormateados = `${diasFormateados} de ${year}`;
  }
  // Normalizar días y meses a minúsculas
  diasFormateados = diasFormateados
    .replace(/\bMiércoles\b/g, 'miércoles')
    .replace(/\bMiercoles\b/g, 'miércoles')
    .replace(/\bJueves\b/g, 'jueves')
    .replace(/\bSábado\b/g, 'sábado')
    .replace(/\bSabado\b/g, 'sábado')
    .replace(/\bDomingo\b/g, 'domingo')
    .replace(/\bNoviembre\b/g, 'noviembre')
    .replace(/\bDiciembre\b/g, 'diciembre')
    .replace(/\bEnero\b/g, 'enero')
    .replace(/\bFebrero\b/g, 'febrero')
    .replace(/\bMarzo\b/g, 'marzo')
    .replace(/\bAbril\b/g, 'abril')
    .replace(/\bMayo\b/g, 'mayo')
    .replace(/\bJunio\b/g, 'junio')
    .replace(/\bJulio\b/g, 'julio')
    .replace(/\bAgosto\b/g, 'agosto')
    .replace(/\bSeptiembre\b/g, 'septiembre')
    .replace(/\bOctubre\b/g, 'octubre');

  const diasConAno = diasFormateados || `${remesa.tituloOficial || 'Permisos'} ${year}`;

  // Preparar lista de archivos adjuntos (hoja ODS principal + guías sanitarias y documentos de animales)
  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [
    {
      filename: cleanFileName,
      content: odsBuffer,
      contentType: 'application/vnd.oasis.opendocument.spreadsheet',
    },
  ];

  // Recopilar guías y documentos adjuntos de cada animal incluido en la remesa
  const attachedFilesSet = new Set<string>();
  const attachedGuideNames: string[] = [];

  if (Array.isArray(remesa.personas)) {
    for (const persona of remesa.personas) {
      if (Array.isArray(persona.animales)) {
        for (const animal of persona.animales) {
          if (animal.guiaArchivoUrl) {
            const rawFilename = path.basename(animal.guiaArchivoUrl);
            if (rawFilename && !attachedFilesSet.has(rawFilename)) {
              attachedFilesSet.add(rawFilename);

              let fileBuffer: Buffer | null = null;
              // 1. Intentar descargar de Supabase Storage
              try {
                const { data, error } = await dataAdapter.downloadDocument(rawFilename);
                if (data && !error) {
                  const arrayBuffer = await data.arrayBuffer();
                  fileBuffer = Buffer.from(arrayBuffer);
                }
              } catch (storageErr) {
                console.warn(`[sendEntradaEmail] Error recuperando documento ${rawFilename} de storage:`, storageErr);
              }

              // 2. Si no se descargó de Storage, probar en almacenamiento local (uploads/documents)
              if (!fileBuffer) {
                try {
                  const localPath = path.resolve(process.cwd(), 'uploads', 'documents', rawFilename);
                  if (fs.existsSync(localPath)) {
                    fileBuffer = fs.readFileSync(localPath);
                  }
                } catch (localErr) {
                  console.warn(`[sendEntradaEmail] Error leyendo documento local ${rawFilename}:`, localErr);
                }
              }

              if (fileBuffer) {
                // Nombre legible para el archivo adjunto en el correo
                const baseDisplayName = animal.guiaArchivoNombre || rawFilename;
                let cleanDisplayName = baseDisplayName.replace(/[^\w.-]/g, '_');
                if (!cleanDisplayName.toLowerCase().endsWith('.pdf') && !cleanDisplayName.toLowerCase().endsWith('.png') && !cleanDisplayName.toLowerCase().endsWith('.jpg')) {
                  cleanDisplayName = `${cleanDisplayName}.pdf`;
                }
                const contentType = cleanDisplayName.toLowerCase().endsWith('.png')
                  ? 'image/png'
                  : cleanDisplayName.toLowerCase().endsWith('.jpg') || cleanDisplayName.toLowerCase().endsWith('.jpeg')
                  ? 'image/jpeg'
                  : 'application/pdf';

                attachments.push({
                  filename: cleanDisplayName,
                  content: fileBuffer,
                  contentType,
                });
                attachedGuideNames.push(cleanDisplayName);
              }
            }
          }
        }
      }
    }
  }

  const subject = `Entradas Marisma- ${diasConAno}`;

  // Saludo dinámico según la hora en la zona horaria española (Europe/Madrid)
  const hourStr = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    hour: 'numeric',
    hour12: false,
  }).format(new Date());
  const hour = parseInt(hourStr, 10);
  const saludo = hour >= 6 && hour < 14 ? 'Buenos días:' : hour >= 14 && hour < 21 ? 'Buenas tardes:' : 'Buenas noches:';

  const textBody = `${saludo}

Adjunto a este correo le remito las entradas para acceder a la Marisma de Hinojos correspondientes a los días ${diasFormateados}.

Un saludo.
`;

  const mailOptions: SendMailOptions = {
    from: `"${config.fromName}" <${config.user}>`,
    to: recipientsList,
    bcc: bccList.length > 0 ? bccList : undefined,
    subject,
    text: textBody,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId,
    recipients: recipientsList,
    bcc: bccList,
  };
}
