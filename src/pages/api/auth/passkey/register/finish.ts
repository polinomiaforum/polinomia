import type { APIRoute } from 'astro';
import { finishPasskeyRegistration } from '~/lib/passkeys';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return new Response('No autorizado', { status: 401 });

  let body: { response: any; deviceName?: string };
  try {
    body = await ctx.request.json();
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  try {
    const result = await finishPasskeyRegistration({
      origin: ctx.url.origin,
      userId: user.id,
      response: body.response,
      deviceName: body.deviceName ?? null,
    });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey register finish:', err);
    return new Response(JSON.stringify({ error: String((err as Error).message) }), { status: 400 });
  }
};
