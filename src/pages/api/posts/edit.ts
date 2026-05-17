import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, schema } from '~/db';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return ctx.redirect('/login');

  const form = await ctx.request.formData();
  const postId = parseInt(String(form.get('postId') ?? ''), 10);
  const body = String(form.get('body') ?? '').trim();

  if (!Number.isFinite(postId) || body.length < 30) {
    return ctx.redirect(`/h/editar/${postId}?error=short`);
  }

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
  if (!post) return new Response('Post no encontrado', { status: 404 });
  if (post.authorId !== user.id) return new Response('No autorizado', { status: 403 });

  const mustReformulate = post.needsReformulation === 1;
  const within1h = (Date.now() - post.createdAt.getTime()) < 3600_000;
  if (!mustReformulate && !within1h) {
    return ctx.redirect(`/h/${post.threadId}?error=expired_edit`);
  }

  await db.update(schema.posts)
    .set({
      body,
      editedAt: new Date(),
      ...(mustReformulate ? { needsReformulation: 0, reformulateDueAt: null, hiddenAt: null, hiddenReason: null } : {}),
    })
    .where(eq(schema.posts.id, postId));

  return ctx.redirect(`/h/${post.threadId}#p${post.id}`);
};
