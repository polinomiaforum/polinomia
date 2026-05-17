import type { APIRoute } from 'astro';
import { db, schema } from '~/db';
import { eq } from 'drizzle-orm';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return ctx.redirect('/login');
  if (ctx.locals.suspended) return ctx.redirect('/cuenta/sancionada');
  if ((ctx.locals.awaitingReformulation?.length ?? 0) > 0) {
    return ctx.redirect('/cuenta/sancionada?pendiente=1');
  }

  const form = await ctx.request.formData();
  const threadId = parseInt(String(form.get('threadId') ?? ''), 10);
  const body = String(form.get('body') ?? '').trim();

  if (!Number.isFinite(threadId) || body.length < 30) {
    return ctx.redirect(`/h/${threadId}?error=short`);
  }

  const [thread] = await db.select().from(schema.threads).where(eq(schema.threads.id, threadId)).limit(1);
  if (!thread) return new Response('Hilo no encontrado', { status: 404 });

  const [post] = await db.insert(schema.posts).values({
    threadId,
    authorId: user.id,
    body,
  }).returning();

  const sources: { postId: number; threadId: number; citation: string; url: string | null }[] = [];
  for (let i = 0; i < 5; i++) {
    const citation = String(form.get(`source_citation_${i}`) ?? '').trim();
    const url = String(form.get(`source_url_${i}`) ?? '').trim();
    if (citation) {
      sources.push({ postId: post.id, threadId, citation, url: url || null });
    }
  }
  if (sources.length > 0) await db.insert(schema.sources).values(sources);

  await db.update(schema.threads)
    .set({ lastActivityAt: new Date() })
    .where(eq(schema.threads.id, threadId));

  return ctx.redirect(`/h/${threadId}#p${post.id}`);
};
