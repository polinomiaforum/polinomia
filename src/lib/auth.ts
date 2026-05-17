import { hash, verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, schema } from '~/db';
import type { APIContext } from 'astro';

const SESSION_COOKIE = 'polinomics_session';
const SESSION_DAYS = 30;

const argonOpts = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export async function hashPassword(password: string) {
  return hash(password, argonOpts);
}

export async function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password, argonOpts);
}

export function generateId(bytes = 16) {
  return randomBytes(bytes).toString('hex');
}

export async function createUser(input: { username: string; email: string; password: string }) {
  const id = generateId();
  const passwordHash = await hashPassword(input.password);
  const [user] = await db.insert(schema.users).values({
    id,
    username: input.username,
    email: input.email.toLowerCase(),
    passwordHash,
  }).returning();
  return user;
}

export async function findUserByEmail(email: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase())).limit(1);
  return u ?? null;
}

export async function findUserByUsername(username: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
  return u ?? null;
}

export async function findUserByGoogleId(googleId: string) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.googleId, googleId)).limit(1);
  return u ?? null;
}

export async function linkGoogleToUser(userId: string, googleId: string, avatarUrl: string | null) {
  await db.update(schema.users)
    .set({ googleId, avatarUrl: avatarUrl ?? undefined })
    .where(eq(schema.users.id, userId));
}

function sanitizeUsername(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
}

async function uniqueUsername(base: string) {
  const clean = sanitizeUsername(base) || 'user';
  const padded = clean.length < 3 ? `${clean}_${randomBytes(2).toString('hex')}` : clean;
  if (!(await findUserByUsername(padded))) return padded;
  for (let i = 0; i < 20; i++) {
    const suffix = randomBytes(2).toString('hex');
    const candidate = `${padded.slice(0, 28)}_${suffix}`.slice(0, 32);
    if (!(await findUserByUsername(candidate))) return candidate;
  }
  throw new Error('No se pudo generar un username único');
}

export async function createUserFromEmail(input: { email: string }) {
  const base = input.email.split('@')[0];
  const username = await uniqueUsername(base);
  const id = generateId();
  const [user] = await db.insert(schema.users).values({
    id,
    username,
    email: input.email.toLowerCase(),
    passwordHash: null,
  }).returning();
  return user;
}

export async function createUserFromGoogle(input: { googleId: string; email: string; name?: string | null; picture?: string | null }) {
  const base = (input.name && input.name.trim()) || input.email.split('@')[0];
  const username = await uniqueUsername(base);
  const id = generateId();
  const [user] = await db.insert(schema.users).values({
    id,
    username,
    email: input.email.toLowerCase(),
    googleId: input.googleId,
    avatarUrl: input.picture ?? null,
    passwordHash: null,
  }).returning();
  return user;
}

export async function createSession(userId: string) {
  const id = generateId(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(schema.sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function getSessionUser(sessionId: string) {
  const [row] = await db
    .select({ user: schema.users, session: schema.sessions })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(eq(schema.sessions.id, sessionId))
    .limit(1);
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
    return null;
  }
  return row.user;
}

export async function destroySession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId));
}

export function setSessionCookie(ctx: APIContext, sessionId: string, expiresAt: Date) {
  ctx.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: import.meta.env.PROD,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(ctx: APIContext) {
  ctx.cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function readSessionCookie(ctx: APIContext) {
  return ctx.cookies.get(SESSION_COOKIE)?.value ?? null;
}
