// src/lib/mailer.js
import nodemailer from "nodemailer";

export function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null; // disabled

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 2525,
    secure: false, // Mailtrap uses TLS upgrade; false is correct for 2525/587
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  async function send({ to, subject, text, html }) {
    return transporter.sendMail({
      from: SMTP_FROM || "Grade Assist <no-reply@grade-assist.local>",
      to,
      subject,
      text,
      html,
    });
  }

  return { send, verify: () => transporter.verify().catch(() => false) };
}
