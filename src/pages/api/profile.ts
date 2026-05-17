import type { APIRoute } from 'astro';
import { db, schema } from '~/db';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return ctx.redirect('/login');

  const form = await ctx.request.formData();
  const declaredView = String(form.get('declaredView') ?? '').trim().slice(0, 100) || null;
  const bio = String(form.get('bio') ?? '').trim().slice(0, 500) || null;

  await db.update(schema.users)
    .set({ declaredView, bio })
    .where(eq(schema.users.id, user.id));

  return ctx.redirect(`/u/${user.username}?saved=1`);
};
