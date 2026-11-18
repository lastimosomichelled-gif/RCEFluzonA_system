import { redirect } from 'next/navigation';
import { sql } from './db';
import { readSession } from './session';

export async function me() {
  const uid = await readSession();
  if (!uid) return null;
  const rows = await sql`
    SELECT id, username, email, full_name, role, region
    FROM users
    WHERE id = ${uid} AND is_active = TRUE
    LIMIT 1`;

  return rows[0] ?? null;
}

export async function requireUser() {
  const u = await me();
  if (!u) redirect('/');
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/dashboard');
  return u;
}
