import type { APIRoute } from 'astro';
import { startPasskeyLogin } from '~/lib/passkeys';
import { publicOrigin } from '~/lib/origin';

export const POST: APIRoute = async (ctx) => {
  try {
    const options = await startPasskeyLogin({ origin: publicOrigin(ctx) });
    return new Response(JSON.stringify(options), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('passkey login start:', err);
    return new Response(JSON.stringify({ error: 'no se pudo iniciar el login' }), { status: 500 });
  }
};
