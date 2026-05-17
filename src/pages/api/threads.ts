import type { APIRoute } from 'astro';
import { db, schema } from '~/db';
import { eq } from 'drizzle-orm';
import { slugify } from '~/lib/text';

export const POST: APIRoute = async (ctx) => {
  const user = ctx.locals.user;
  if (!user) return ctx.redirect('/login');
  if (ctx.locals.suspended) return ctx.redirect('/cuenta/sancionada');
  if ((ctx.locals.awaitingReformulation?.length ?? 0) > 0) {
    return ctx.redirect('/cuenta/sancionada?pendiente=1');
  }

  const form = await ctx.request.formData();
  const topicSlug = String(form.get('topicSlug') ?? '');
  const countrySlug = String(form.get('countrySlug') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const body = String(form.get('body') ?? '').trim();

  if (!topicSlug || !countrySlug || !title || body.length < 40) {
    return ctx.redirect('/h/nuevo?error=invalid');
  }

  const [topic] = await db.select().from(schema.topics).where(eq(schema.topics.slug, topicSlug)).limit(1);
  const [country] = await db.select().from(schema.countries).where(eq(schema.countries.slug, countrySlug)).limit(1);
  if (!topic || !country) return ctx.redirect('/h/nuevo?error=invalid');

  const [thread] = await db.insert(schema.threads).values({
    topicId: topic.id,
    countryId: country.id,
    authorId: user.id,
    title,
    slug: slugify(title),
  }).returning();

  const [opening] = await db.insert(schema.posts).values({
    threadId: thread.id,
    authorId: user.id,
    body,
    isOpening: 1,
  }).returning();

  const sources: { postId: number; threadId: number; citation: string; url: string | null }[] = [];
  for (let i = 0; i < 5; i++) {
    const citation = String(form.get(`source_citation_${i}`) ?? '').trim();
    const url = String(form.get(`source_url_${i}`) ?? '').trim();
    if (citation) {
      sources.push({
        postId: opening.id,
        threadId: thread.id,
        citation,
        url: url || null,
      });
    }
  }
  if (sources.length > 0) await db.insert(schema.sources).values(sources);

  return ctx.redirect(`/h/${thread.id}`);
};
