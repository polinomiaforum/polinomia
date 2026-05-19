import { Resend } from 'resend';

function envVar(key: string): string | undefined {
  return import.meta.env?.[key] ?? process.env[key];
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = envVar('RESEND_API_KEY');
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

interface SendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(input: SendInput) {
  const from = envVar('EMAIL_FROM') ?? 'Polinomia <auth@polinomia.local>';
  const resend = getResend();

  if (!resend) {
    console.log('\n=== EMAIL (dev mode, RESEND_API_KEY no configurado) ===');
    console.log(`from: ${from}`);
    console.log(`to: ${input.to}`);
    console.log(`subject: ${input.subject}`);
    console.log('---');
    console.log(input.text);
    console.log('=== /EMAIL ===\n');
    return { dev: true };
  }

  const { error } = await resend.emails.send({
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return { dev: false };
}

export function magicLinkEmail(link: string, purpose: 'login' | 'register') {
  const action = purpose === 'register' ? 'crear tu cuenta' : 'iniciar sesión';
  const subject = purpose === 'register' ? 'Bienvenido a Polinomia' : 'Tu link de acceso a Polinomia';
  const text = `Hacé click en este link para ${action} en Polinomia (vence en 15 minutos):

${link}

Si no fuiste vos, ignorá este mensaje.

— polinomia`;

  const html = `<!doctype html>
<html><body style="font-family: ui-monospace, Menlo, Consolas, monospace; max-width: 520px; margin: 40px auto; padding: 0 24px; color: #0a0a0a;">
  <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #6b6b6b;">// polinomia · auth</p>
  <h1 style="font-size: 22px; margin: 8px 0 16px;">Tu link para ${action}</h1>
  <p style="font-size: 14px; line-height: 1.55;">Hacé click en el botón para ${action}. El link vence en 15 minutos.</p>
  <p style="margin: 28px 0;">
    <a href="${link}" style="display: inline-block; background: #0a0a0a; color: #fff; padding: 12px 20px; text-decoration: none; border: 1px solid #0a0a0a; box-shadow: 3px 3px 0 #1d4ed8; font-weight: 600;">→ ${action}</a>
  </p>
  <p style="font-size: 12px; color: #6b6b6b;">o copialo a mano:<br><span style="word-break: break-all;">${link}</span></p>
  <p style="font-size: 12px; color: #6b6b6b; margin-top: 32px;">Si no fuiste vos, ignorá este mensaje. Nadie pudo entrar a tu cuenta.</p>
  <p style="font-size: 12px; color: #1d4ed8; margin-top: 32px;">// polinomia</p>
</body></html>`;

  return { subject, text, html };
}
