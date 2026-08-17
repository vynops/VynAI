import nodemailer from 'nodemailer'

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export function parseRecipients(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function sendEmail(config: SmtpConfig, to: string[], subject: string, text: string): Promise<void> {
  if (!config.host || !config.port || !config.user || !config.pass || !config.from) {
    throw new Error('SMTP settings are incomplete')
  }
  if (!to.length) {
    throw new Error('No recipient provided')
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
  })

  await transporter.sendMail({
    from: config.from,
    to: to.join(','),
    subject,
    text,
  })
}
