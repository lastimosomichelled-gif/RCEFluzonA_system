import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const MAX_AGE = 60 * 60 * 24 * 7;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be set to a random value of at least 32 characters.');
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(uid) {
  const token = await new SignJWT({ uid })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(key());
  cookies().set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function readSession() {
  const token = cookies().get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return Number(payload.uid) || null;
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().delete('session');
}
