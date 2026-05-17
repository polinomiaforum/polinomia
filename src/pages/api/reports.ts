import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '~/db';
import { canReport } from '~/lib/moderation';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return ctx.redirect('/login');
  if (!canReport(user)) return ctx.redirect('/cuenta/sancionada?reportes=1');

  const form = await ctx.request.formData();
  const postId = parseInt(String(form.get('postId') ?? ''), 10);
  const ruleNumber = parseInt(String(form.get('ruleNumber') ?? ''), 10);
  const context = String(form.get('context') ?? '').trim();

  if (!Number.isFinite(postId) || !Number.isFinite(ruleNumber) || ruleNumber < 1 || ruleNumber > 5) {
    return ctx.redirect('/?error=report');
  }
  if (context.length < 20) {
    return ctx.redirect(`/h/reportar/${postId}?error=short`);
  }

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, postId)).limit(1);
  if (!post) return new Response('Post no encontrado', { status: 404 });
  if (post.authorId === user.id) {
    return ctx.redirect(`/h/${post.threadId}?error=self_report`);
  }

  const [existing] = await db.select({ id: schema.reports.id })
    .from(schema.reports)
    .where(and(
      eq(schema.reports.postId, postId),
      eq(schema.reports.reporterId, user.id),
      eq(schema.reports.status, 'pending'),
    ))
    .limit(1);
  if (existing) {
    return ctx.redirect(`/h/${post.threadId}?reportado=1`);
  }

  await db.insert(schema.reports).values({
    postId,
    threadId: post.threadId,
    reporterId: user.id,
    reportedUserId: post.authorId,
    ruleNumber,
    context: context.slice(0, 1000),
  });

  return ctx.redirect(`/h/${post.threadId}?reportado=1`);
};
