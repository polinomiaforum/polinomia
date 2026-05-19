import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { and, eq, gt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { db, schema } from '~/db';

const CHALLENGE_TTL_MIN = 5;
const RP_NAME = 'Polinomia';

function rpIdFromOrigin(origin: string) {
  return new URL(origin).hostname;
}

export async function startPasskeyRegistration(input: { origin: string; userId: string; username: string }) {
  const userPasskeys = await db.select({ credentialId: schema.passkeys.credentialId, transports: schema.passkeys.transports })
    .from(schema.passkeys)
    .where(eq(schema.passkeys.userId, input.userId));

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpIdFromOrigin(input.origin),
    userID: new TextEncoder().encode(input.userId),
    userName: input.username,
    userDisplayName: input.username,
    attestationType: 'none',
    excludeCredentials: userPasskeys.map((p) => ({
      id: p.credentialId,
      transports: (p.transports ? p.transports.split(',') : undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  await storeChallenge({ challenge: options.challenge, userId: input.userId, purpose: 'register' });
  return options;
}

export async function finishPasskeyRegistration(input: {
  origin: string;
  userId: string;
  response: RegistrationResponseJSON;
  deviceName: string | null;
}) {
  const stored = await consumeChallenge({ userId: input.userId, purpose: 'register' });
  if (!stored) throw new Error('Challenge expirado o inexistente');

  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: stored.challenge,
    expectedOrigin: input.origin,
    expectedRPID: rpIdFromOrigin(input.origin),
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registro no verificado');
  }

  const { credential } = verification.registrationInfo;
  const id = randomBytes(12).toString('hex');

  await db.insert(schema.passkeys).values({
    id,
    userId: input.userId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    transports: input.response.response.transports?.join(',') ?? null,
    deviceName: input.deviceName?.slice(0, 60) || `passkey ${new Date().toLocaleDateString('es')}`,
  });

  return { id };
}

export async function startPasskeyLogin(input: { origin: string }) {
  const options = await generateAuthenticationOptions({
    rpID: rpIdFromOrigin(input.origin),
    userVerification: 'preferred',
  });

  await storeChallenge({ challenge: options.challenge, userId: null, purpose: 'login' });
  return options;
}

export async function finishPasskeyLogin(input: { origin: string; response: AuthenticationResponseJSON }) {
  const stored = await consumeChallenge({ userId: null, purpose: 'login', challenge: input.response.response.clientDataJSON ? undefined : undefined });
  if (!stored) throw new Error('Challenge expirado o inexistente');

  const credentialId = input.response.id;
  const [pk] = await db.select().from(schema.passkeys).where(eq(schema.passkeys.credentialId, credentialId)).limit(1);
  if (!pk) throw new Error('Passkey no registrada');

  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: stored.challenge,
    expectedOrigin: input.origin,
    expectedRPID: rpIdFromOrigin(input.origin),
    credential: {
      id: pk.credentialId,
      publicKey: new Uint8Array(Buffer.from(pk.publicKey, 'base64')),
      counter: pk.counter,
      transports: (pk.transports ? pk.transports.split(',') : undefined) as AuthenticatorTransportFuture[] | undefined,
    },
  });

  if (!verification.verified) throw new Error('Autenticación no verificada');

  await db.update(schema.passkeys)
    .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
    .where(eq(schema.passkeys.id, pk.id));

  return { userId: pk.userId };
}

async function storeChallenge(input: { challenge: string; userId: string | null; purpose: 'register' | 'login' }) {
  const id = randomBytes(12).toString('hex');
  await db.insert(schema.webauthnChallenges).values({
    id,
    challenge: input.challenge,
    userId: input.userId,
    purpose: input.purpose,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MIN * 60_000),
  });
}

async function consumeChallenge(input: { userId: string | null; purpose: 'register' | 'login'; challenge?: string }) {
  const now = new Date();
  const conditions = [
    eq(schema.webauthnChallenges.purpose, input.purpose),
    gt(schema.webauthnChallenges.expiresAt, now),
  ];
  if (input.userId !== null) conditions.push(eq(schema.webauthnChallenges.userId, input.userId));

  const rows = await db.select().from(schema.webauthnChallenges).where(and(...conditions));
  if (rows.length === 0) return null;
  const latest = rows.sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];

  await db.delete(schema.webauthnChallenges).where(eq(schema.webauthnChallenges.id, latest.id));
  return latest;
}
