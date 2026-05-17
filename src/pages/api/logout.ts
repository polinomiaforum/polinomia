import type { APIRoute } from 'astro';
import { clearSessionCookie, destroySession } from '~/lib/auth';

export const POST: APIRoute = async (ctx) => {
  const sid = ctx.locals.sessionId;
  if (sid) await destroySession(sid);
  clearSessionCookie(ctx);
  return ctx.redirect('/');
};
