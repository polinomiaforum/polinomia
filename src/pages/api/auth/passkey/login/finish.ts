import type { APIRoute } from 'astro';
import { finishPasskeyLogin } from '~/lib/passkeys';
import { createSession, setSessionCookie } from '~/lib/auth';
import { publicOrigin } from '~/lib/origin';

export const POST: APIRoute = async (ctx) => {
  let body: { response: any };
  try {
    body = await ctx.request.json();
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  try {
    const { userId } = await finishPasskeyLogin({
      origin: publicOrigin(ctx),
      response: body.response,
    });
    const session = await createSession(userId);
    setSessionCookie(ctx, session.id, session.expiresAt);
    return new Response(JSON.stringify({ ok: true, redirect: '/' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey login finish:', err);
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status: 400 });
  }
};
