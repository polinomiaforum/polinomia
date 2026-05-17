import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '~/db';

const TOKEN_TTL_MIN = 15;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createMagicToken(input: { email: string; userId: string | null; purpose: 'login' | 'register' }) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const id = randomBytes(12).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);

  await db.insert(schema.authTokens).values({
    id,
    tokenHash,
    email: input.email.toLowerCase(),
    userId: input.userId,
    purpose: input.purpose,
    expiresAt,
  });

  return { token, expiresAt };
}

export async function consumeMagicToken(token: string) {
  const tokenHash = hashToken(token);
  const [row] = await db.select().from(schema.authTokens)
    .where(and(
      eq(schema.authTokens.tokenHash, tokenHash),
      isNull(schema.authTokens.usedAt),
    ))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await db.update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(eq(schema.authTokens.id, row.id));

  return row;
}

export function magicLinkUrl(origin: string, token: string) {
  return `${origin}/api/auth/magic/verify?token=${encodeURIComponent(token)}`;
}
