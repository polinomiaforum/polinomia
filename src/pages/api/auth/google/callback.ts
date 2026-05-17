import type { APIRoute } from 'astro';
import { exchangeCode, fetchUserInfo } from '~/lib/google';
import {
  createSession,
  createUserFromGoogle,
  findUserByEmail,
  findUserByGoogleId,
  linkGoogleToUser,
  setSessionCookie,
} from '~/lib/auth';

const STATE_COOKIE = 'polinomics_oauth_state';

export const GET: APIRoute = async (ctx) => {
  const url = ctx.url;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const expectedState = ctx.cookies.get(STATE_COOKIE)?.value;
  ctx.cookies.delete(STATE_COOKIE, { path: '/' });

  if (error) return ctx.redirect('/login?error=google_denied');
  if (!code || !state || !expectedState || state !== expectedState) {
    return ctx.redirect('/login?error=google_state');
  }

  try {
    const tokens = await exchangeCode(code);
    const info = await fetchUserInfo(tokens.access_token);
    if (!info.email || !info.email_verified) {
      return ctx.redirect('/login?error=google_email');
    }

    let user = await findUserByGoogleId(info.sub);
    if (!user) {
      const existing = await findUserByEmail(info.email);
      if (existing) {
        await linkGoogleToUser(existing.id, info.sub, info.picture ?? null);
        user = { ...existing, googleId: info.sub, avatarUrl: info.picture ?? existing.avatarUrl };
      } else {
        user = await createUserFromGoogle({
          googleId: info.sub,
          email: info.email,
          name: info.given_name ?? info.name ?? null,
          picture: info.picture ?? null,
        });
      }
    }

    const session = await createSession(user.id);
    setSessionCookie(ctx, session.id, session.expiresAt);
    return ctx.redirect('/');
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return ctx.redirect('/login?error=google_failed');
  }
};
