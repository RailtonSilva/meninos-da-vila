import { Resend } from 'resend';
import { captureError } from './sentry.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const emailConfigurado = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** Moldura visual dos e-mails (cores do escudo). `corpo` já deve vir escapado. */
export function moldura(corpo) {
  return `
  <div style="background:#f4f6fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f1430">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="background:#1a1fd0;padding:24px 28px;border-bottom:6px solid #3be36a">
        <div style="color:#fff;font-size:20px;font-weight:bold;letter-spacing:.5px">MENINOS DA VILA</div>
        <div style="color:#b9f5c9;font-size:12px;letter-spacing:3px">FUTEBOL CLUBE</div>
      </div>
      <div style="padding:28px;line-height:1.5">${corpo}</div>
    </div>
  </div>`;
}

/** Envia e-mail avulso. Não lança erro: avisos são "melhor esforço". Retorna true se enviou. */
export async function enviarEmail({ to, subject, html }) {
  if (!emailConfigurado() || !to || (Array.isArray(to) && !to.length)) return false;
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.EMAIL_FROM, to, subject, html });
    if (error) throw new Error(`Resend: ${error.message}`);
    return true;
  } catch (err) {
    captureError(err, { onde: 'enviarEmail', subject });
    return false;
  }
}

/** Endereço do site (para links nos e-mails). */
export function urlSite(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  return host ? `https://${host}` : '';
}
