import type { APIRoute } from 'astro';
import { consumeMagicToken } from '~/lib/magic';
import { createSession, createUserFromEmail, findUserByEmail, setSessionCookie } from '~/lib/auth';

export const GET: APIRoute = async (ctx) => {
  const token = ctx.url.searchParams.get('token');
  if (!token) return ctx.redirect('/login?error=magic_invalid');

  const row = await consumeMagicToken(token);
  if (!row) return ctx.redirect('/login?error=magic_expired');

  let userId = row.userId;
  if (!userId) {
    const existing = await findUserByEmail(row.email);
    if (existing) {
      userId = existing.id;
    } else {
      const user = await createUserFromEmail({ email: row.email });
      userId = user.id;
    }
  }

  const session = await createSession(userId);
  setSessionCookie(ctx, session.id, session.expiresAt);
  return ctx.redirect('/');
};
