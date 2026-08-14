import { getDb } from './db.js'

let nodemailer = null

// Import dinamic — dacă nodemailer nu e instalat, serverul pornește oricum
async function getNodemailer() {
  if (nodemailer) return nodemailer
  try {
    nodemailer = (await import('nodemailer')).default
  } catch {
    // nodemailer nu e disponibil — emailurile sunt dezactivate
  }
  return nodemailer
}

function createTransport(nm) {
  const host = process.env.SMTP_HOST
  if (!host || !nm) return null
  return nm.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

function getAlertEmail() {
  try {
    const row = getDb().prepare("SELECT value FROM settings WHERE key = 'alert_email'").get()
    return row?.value || ''
  } catch {
    return ''
  }
}

async function send(subject, text) {
  const nm = await getNodemailer()
  const transport = createTransport(nm)
  const to = getAlertEmail()
  if (!transport || !to) return
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
    })
    console.log(`[alert] Email trimis: ${subject}`)
  } catch (err) {
    console.error('[alert] Eroare email:', err.message)
  }
}

export function sendOfflineAlert(tvLabel, agencyName) {
  const time = new Date().toLocaleString('ro-RO')
  return send(
    `[DisplayIQ] TV offline: ${tvLabel} — ${agencyName}`,
    `TV-ul "${tvLabel}" de la agenția "${agencyName}" este offline.\n\nDetectat la: ${time}\n\nAcest mesaj a fost trimis automat de DisplayIQ.`
  )
}

export function sendReconnectedAlert(tvLabel, agencyName) {
  const time = new Date().toLocaleString('ro-RO')
  return send(
    `[DisplayIQ] TV reconectat: ${tvLabel} — ${agencyName}`,
    `TV-ul "${tvLabel}" de la agenția "${agencyName}" s-a reconectat.\n\nLa: ${time}\n\nAcest mesaj a fost trimis automat de DisplayIQ.`
  )
}
