import type { APIRoute } from 'astro';
import { startPasskeyRegistration } from '~/lib/passkeys';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return new Response('No autorizado', { status: 401 });

  try {
    const options = await startPasskeyRegistration({
      origin: ctx.url.origin,
      userId: user.id,
      username: user.username,
    });
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey register start:', err);
    return new Response(JSON.stringify({ error: 'no se pudo iniciar el registro' }), { status: 500 });
  }
};
