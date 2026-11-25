import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

export const mailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transporter = mailEnabled
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 465),
      secure: String(SMTP_SECURE || 'true') === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    })
  : null;

export async function sendMail(to, subject, html) {
  if (!mailEnabled) {
    console.log(`[邮件开发模式] 收件人: ${to}\n主题: ${subject}\n${html.replace(/<[^>]+>/g, ' ')}`);
    return;
  }
  try {
    await transporter.sendMail({ from: SMTP_FROM || SMTP_USER, to, subject, html });
  } catch (err) {
    console.error(`[邮件发送失败] ${to}: ${err.message}`);
  }
}

export function notifyMembers(emails, subject, html) {
  for (const email of emails) sendMail(email, subject, html);
}