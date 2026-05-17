import type { APIRoute } from 'astro';
import { createSession, findUserByEmail, setSessionCookie, verifyPassword } from '~/lib/auth';

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return ctx.redirect('/login?error=1');

  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash) return ctx.redirect('/login?error=1');
  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) return ctx.redirect('/login?error=1');

  const session = await createSession(user.id);
  setSessionCookie(ctx, session.id, session.expiresAt);
  return ctx.redirect('/');
};
