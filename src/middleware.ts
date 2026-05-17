import { defineMiddleware } from 'astro:middleware';
import { getSessionUser, readSessionCookie } from '~/lib/auth';
import { canReport, isAdmin, isSuspended, postsAwaitingReformulation } from '~/lib/moderation';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const sessionId = readSessionCookie(ctx);
  if (sessionId) {
    const user = await getSessionUser(sessionId);
    if (user) {
      ctx.locals.user = user;
      ctx.locals.sessionId = sessionId;
      ctx.locals.isAdmin = isAdmin(user);
      ctx.locals.suspended = isSuspended(user);
      ctx.locals.canReport = canReport(user);
      ctx.locals.awaitingReformulation = await postsAwaitingReformulation(user.id);
    }
  }
  return next();
});
