import nodemailer, { type SendMailOptions } from 'nodemailer';
import crypto from 'crypto';
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

  const diasConAno = remesa.diasTexto
    ? `${remesa.diasTexto} ${year}`
    : `${remesa.tituloOficial || 'Permisos'} ${year}`;

  const subject = `Entradas Marisma- ${diasConAno}`;

  const textBody = `Buenas tardes.

Adjunto a este email le hago llegar las entradas a la marisma de Hinojos para los días ${remesa.diasTexto || remesa.tituloOficial || ''} de ${year}.

Saludos.
`;

  const mailOptions: SendMailOptions = {
    from: `"${config.fromName}" <${config.user}>`,
    to: recipientsList,
    bcc: bccList.length > 0 ? bccList : undefined,
    subject,
    text: textBody,
    attachments: [
      {
        filename: cleanFileName,
        content: odsBuffer,
        contentType: 'application/vnd.oasis.opendocument.spreadsheet',
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);

  return {
    success: true,
    messageId: info.messageId,
    recipients: recipientsList,
    bcc: bccList,
  };
}
