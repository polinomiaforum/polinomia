import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { buildAuthUrl } from '~/lib/google';

const STATE_COOKIE = 'polinomics_oauth_state';

export const GET: APIRoute = async (ctx) => {
  const state = randomBytes(24).toString('hex');
  ctx.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    maxAge: 60 * 10,
  });
  try {
    return ctx.redirect(buildAuthUrl(state));
  } catch (err) {
    console.error(err);
    return ctx.redirect('/login?error=google_config');
  }
};
