import type { APIRoute } from 'astro';
import { applyDecision, type DecisionId, DECISIONS } from '~/lib/moderation';

const validDecisions = new Set(DECISIONS.map((d) => d.id));

export const POST: APIRoute = async (ctx) => {
  if (!ctx.locals.isAdmin || !ctx.locals.user) {
    return new Response('No autorizado', { status: 403 });
  }

  const form = await ctx.request.formData();
  const reportId = parseInt(String(form.get('reportId') ?? ''), 10);
  const ruleNumber = parseInt(String(form.get('ruleNumber') ?? ''), 10);
  const decision = String(form.get('decision') ?? '') as DecisionId;
  const rationale = String(form.get('rationale') ?? '').trim();

  if (!Number.isFinite(reportId) || !validDecisions.has(decision) || rationale.length < 10) {
    return ctx.redirect(`/moderacion/caso/${reportId}?error=invalid`);
  }

  try {
    await applyDecision({
      reportId,
      decision,
      rationale,
      ruleNumber,
      adminId: ctx.locals.user.id,
    });
  } catch (err) {
    console.error(err);
    return ctx.redirect(`/moderacion/caso/${reportId}?error=failed`);
  }

  return ctx.redirect('/moderacion/casos');
};
