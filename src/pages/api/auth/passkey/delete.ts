import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '~/db';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return ctx.redirect('/login');

  const form = await ctx.request.formData();
  const passkeyId = String(form.get('passkeyId') ?? '');
  if (!passkeyId) return ctx.redirect(`/u/${user.username}`);

  await db.delete(schema.passkeys).where(and(
    eq(schema.passkeys.id, passkeyId),
    eq(schema.passkeys.userId, user.id),
  ));

  return ctx.redirect(`/u/${user.username}?passkey=removed`);
};
