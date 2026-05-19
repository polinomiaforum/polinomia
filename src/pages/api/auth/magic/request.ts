import type { APIRoute } from 'astro';
import { findUserByEmail } from '~/lib/auth';
import { createMagicToken, magicLinkUrl } from '~/lib/magic';
import { magicLinkEmail, sendMail } from '~/lib/email';
import { publicOrigin } from '~/lib/origin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return ctx.redirect('/login?error=email_invalid');
  }

  const existing = await findUserByEmail(email);
  const purpose: 'login' | 'register' = existing ? 'login' : 'register';

  const { token } = await createMagicToken({
    email,
    userId: existing?.id ?? null,
    purpose,
  });

  const link = magicLinkUrl(publicOrigin(ctx), token);
  const mail = magicLinkEmail(link, purpose);
  await sendMail({ to: email, ...mail });

  return ctx.redirect(`/auth/magic/enviado?email=${encodeURIComponent(email)}`);
};
