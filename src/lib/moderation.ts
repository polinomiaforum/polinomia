import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '~/db';
import type { User } from '~/db/schema';

export const RULES: { n: number; label: string; short: string }[] = [
  { n: 1, label: 'Atacá ideas, nunca personas', short: 'agresión personal' },
  { n: 2, label: 'Argumentá, no afirmes', short: 'sin argumento' },
  { n: 3, label: 'Si tenés fuente, citala', short: 'fuente ausente o falsa' },
  { n: 4, label: 'Buena fe', short: 'mala fe' },
  { n: 5, label: 'Sin proselitismo ni spam', short: 'proselitismo / spam' },
];

export const DECISIONS = [
  { id: 'no_action', label: 'sin acción', desc: 'el reporte no procede' },
  { id: 'reformulate', label: 'pedir reformular', desc: 'el autor tiene 24h para editar' },
  { id: 'hide', label: 'ocultar post', desc: 'el post queda oculto, la cuenta no se sanciona' },
  { id: 'suspend_7d', label: 'suspender 7 días', desc: 'no puede postear durante una semana' },
  { id: 'suspend_30d', label: 'suspender 30 días', desc: 'no puede postear durante un mes' },
  { id: 'expel', label: 'expulsar', desc: 'la cuenta queda cerrada permanentemente' },
] as const;

export type DecisionId = typeof DECISIONS[number]['id'];

function adminEmails(): string[] {
  const raw = import.meta.env?.ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? '';
  return String(raw).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function isAdmin(user: Pick<User, 'role' | 'email'> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return adminEmails().includes(user.email.toLowerCase());
}

export function isSuspended(user: Pick<User, 'suspendedUntil' | 'expelledAt'> | null | undefined): boolean {
  if (!user) return false;
  if (user.expelledAt) return true;
  if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) return true;
  return false;
}

export function canReport(user: Pick<User, 'reportsDisabledUntil' | 'expelledAt'> | null | undefined): boolean {
  if (!user) return false;
  if (user.expelledAt) return false;
  if (user.reportsDisabledUntil && user.reportsDisabledUntil.getTime() > Date.now()) return false;
  return true;
}

export async function postsAwaitingReformulation(userId: string) {
  const rows = await db.select({ id: schema.posts.id, threadId: schema.posts.threadId, dueAt: schema.posts.reformulateDueAt })
    .from(schema.posts)
    .where(and(
      eq(schema.posts.authorId, userId),
      eq(schema.posts.needsReformulation, 1),
    ));
  return rows;
}

export async function countReportsAgainst(userId: string, days = 90) {
  const since = new Date(Date.now() - days * 86400_000);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(schema.reports)
    .where(and(
      eq(schema.reports.reportedUserId, userId),
      eq(schema.reports.resolution, 'reformulate'),
      gte(schema.reports.resolvedAt, since),
    ));
  return count;
}

export async function countDismissedReportsBy(reporterId: string, days = 60) {
  const since = new Date(Date.now() - days * 86400_000);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(schema.reports)
    .where(and(
      eq(schema.reports.reporterId, reporterId),
      eq(schema.reports.resolution, 'no_action'),
      gte(schema.reports.resolvedAt, since),
      isNotNull(schema.reports.resolvedAt),
    ));
  return count;
}

interface DecideInput {
  reportId: number;
  decision: DecisionId;
  rationale: string;
  ruleNumber: number;
  adminId: string;
}

export async function applyDecision(input: DecideInput) {
  const { reportId, decision, rationale, ruleNumber, adminId } = input;

  const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId)).limit(1);
  if (!report) throw new Error('report not found');
  if (report.status !== 'pending') throw new Error('report already resolved');

  const now = new Date();
  const status = decision === 'no_action' ? 'dismissed' : 'resolved';

  await db.update(schema.reports).set({
    status,
    resolution: decision,
    resolvedAt: now,
    resolvedById: adminId,
  }).where(eq(schema.reports.id, reportId));

  await db.insert(schema.verdicts).values({
    reportId,
    ruleNumber,
    decision,
    rationale: rationale.trim().slice(0, 400),
  });

  if (decision === 'no_action') {
    const dismissed = await countDismissedReportsBy(report.reporterId, 60);
    if (dismissed >= 3) {
      await db.update(schema.users)
        .set({ reportsDisabledUntil: new Date(Date.now() + 30 * 86400_000) })
        .where(eq(schema.users.id, report.reporterId));
    }
    return;
  }

  const sanctionBase = {
    userId: report.reportedUserId,
    reportId,
    postId: report.postId,
    ruleNumber,
    reason: rationale.trim().slice(0, 400),
    appliedById: adminId,
  };

  if (decision === 'reformulate') {
    const due = new Date(Date.now() + 24 * 3600_000);
    await db.update(schema.posts)
      .set({ needsReformulation: 1, reformulateDueAt: due, hiddenAt: now, hiddenReason: `regla ${ruleNumber}` })
      .where(eq(schema.posts.id, report.postId));
    await db.insert(schema.sanctions).values({ ...sanctionBase, type: 'reformulate', expiresAt: due });

    const accumulated = await countReportsAgainst(report.reportedUserId, 90);
    if (accumulated >= 3) {
      const until = new Date(Date.now() + 7 * 86400_000);
      await db.update(schema.users)
        .set({ suspendedUntil: until })
        .where(eq(schema.users.id, report.reportedUserId));
      await db.insert(schema.sanctions).values({
        userId: report.reportedUserId,
        reportId,
        postId: null,
        ruleNumber,
        reason: 'acumulación: 3 pedidos de reformular en 90 días',
        appliedById: adminId,
        type: 'auto_suspend_7d',
        expiresAt: until,
      });
    }
    return;
  }

  if (decision === 'hide') {
    await db.update(schema.posts)
      .set({ hiddenAt: now, hiddenReason: `regla ${ruleNumber}` })
      .where(eq(schema.posts.id, report.postId));
    await db.insert(schema.sanctions).values({ ...sanctionBase, type: 'hide_post' });
    return;
  }

  if (decision === 'suspend_7d' || decision === 'suspend_30d') {
    const days = decision === 'suspend_7d' ? 7 : 30;
    const until = new Date(Date.now() + days * 86400_000);
    await db.update(schema.posts)
      .set({ hiddenAt: now, hiddenReason: `regla ${ruleNumber}` })
      .where(eq(schema.posts.id, report.postId));
    await db.update(schema.users)
      .set({ suspendedUntil: until })
      .where(eq(schema.users.id, report.reportedUserId));
    await db.insert(schema.sanctions).values({ ...sanctionBase, type: decision, expiresAt: until });
    return;
  }

  if (decision === 'expel') {
    await db.update(schema.posts)
      .set({ hiddenAt: now, hiddenReason: `regla ${ruleNumber}` })
      .where(eq(schema.posts.id, report.postId));
    await db.update(schema.users)
      .set({ expelledAt: now })
      .where(eq(schema.users.id, report.reportedUserId));
    await db.insert(schema.sanctions).values({ ...sanctionBase, type: 'expel' });
    return;
  }
}
