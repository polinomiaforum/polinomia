import type { APIRoute } from 'astro';
import { startPasskeyLogin } from '~/lib/passkeys';

export const POST: APIRoute = async (ctx) => {
  try {
    const options = await startPasskeyLogin({ origin: ctx.url.origin });
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey login start:', err);
    return new Response(JSON.stringify({ error: 'no se pudo iniciar el login' }), { status: 500 });
  }
};
