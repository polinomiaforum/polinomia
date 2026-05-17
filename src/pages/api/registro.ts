import type { APIRoute } from 'astro';
import { createSession, createUser, findUserByEmail, findUserByUsername, setSessionCookie } from '~/lib/auth';

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const username = String(form.get('username') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const accept = form.get('accept');

  if (!username || !email || !password || !accept) {
    return ctx.redirect('/registro?error=invalid');
  }
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return ctx.redirect('/registro?error=invalid');
  }
  if (password.length < 8) {
    return ctx.redirect('/registro?error=short');
  }

  if (await findUserByEmail(email) || await findUserByUsername(username)) {
    return ctx.redirect('/registro?error=exists');
  }

  const user = await createUser({ username, email, password });
  const session = await createSession(user.id);
  setSessionCookie(ctx, session.id, session.expiresAt);
  return ctx.redirect('/');
};
