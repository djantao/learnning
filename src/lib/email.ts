import { prisma } from "./db"
import nodemailer from "nodemailer"

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.FROM_EMAIL || "notify@learnning.app"

interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  to: string
}

async function getUserSmtpConfig(userId: string): Promise<SmtpConfig | null> {
  try {
    const profile = await prisma.learningProfile.findUnique({ where: { userId } })
    if (!profile?.preferences) return null
    const prefs = JSON.parse(profile.preferences)
    if (!prefs.smtpHost || !prefs.smtpUser || !prefs.smtpPass) return null
    return {
      host: prefs.smtpHost,
      port: parseInt(prefs.smtpPort || "465", 10),
      user: prefs.smtpUser,
      pass: prefs.smtpPass,
      to: prefs.smtpTo || prefs.smtpUser,
    }
  } catch {
    return null
  }
}

export async function sendReminderEmail(userId: string, to: string, subject: string, html: string) {
  const smtp = await getUserSmtpConfig(userId)
  if (smtp) {
    try {
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      })
      await transport.sendMail({
        from: `MindForge <${smtp.user}>`,
        to: smtp.to,
        subject,
        html,
      })
      return
    } catch {
      // SMTP failed, fall through to Resend
    }
  }

  if (!RESEND_API_KEY) return
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `MindForge <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      }),
    })
  } catch {
    // non-critical
  }
}
