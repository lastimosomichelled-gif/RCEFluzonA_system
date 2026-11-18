'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { isDatabaseConfigured, sql } from '@/lib/db';
import { createSession, destroySession } from '@/lib/session';
import { requireAdmin, requireUser } from '@/lib/auth';

const str = (fd, k) => String(fd.get(k) ?? '').trim();
const q = (s) => encodeURIComponent(s);

export async function login(formData) {
  if (!isDatabaseConfigured) {
    redirect('/?error=' + q('Set a valid PostgreSQL DATABASE_URL in .env.local, then restart the app.'));
  }

  const username = str(formData, 'username');
  const password = String(formData.get('password') ?? '');
  let rows;
  try {
    rows = await sql`
      SELECT id, password_hash
      FROM users
      WHERE username = ${username} AND is_active = TRUE
      LIMIT 1`;
  } catch (error) {
    console.error('Login database lookup failed:', error);
    redirect('/?error=' + q('Could not connect to PostgreSQL. Check DATABASE_URL and confirm the schema is applied.'));
  }
  const user = rows[0];

  if (!user?.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    redirect('/?error=' + q('Username or password is incorrect.'));
  }

  await createSession(user.id);
  redirect('/dashboard');
}

export async function register(formData) {
  if (!isDatabaseConfigured) {
    redirect('/register?error=' + q('Set a valid PostgreSQL DATABASE_URL in .env.local, then restart the app.'));
  }

  const name = str(formData, 'full_name');
  const username = str(formData, 'username');
  const email = str(formData, 'email').toLowerCase();
  const region = str(formData, 'region');
  const pw = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !/^[A-Za-z0-9_.]{3,50}$/.test(username) || !emailOk || pw.length < 8 || pw !== confirm) {
    redirect('/register?error=' + q('Check your details and ensure both passwords match (8 characters minimum).'));
  }

  let dup;
  try {
    dup = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email}`;
  } catch (error) {
    console.error('Registration database lookup failed:', error);
    redirect('/register?error=' + q('Could not connect to PostgreSQL. Check DATABASE_URL and confirm the schema is applied.'));
  }
  if (dup.length) {
    redirect('/register?error=' + q('Username or email is already registered.'));
  }

  let user;
  try {
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM users`;
    const role = count === 0 ? 'admin' : 'staff';
    const passwordHash = await bcrypt.hash(pw, 12);
    [user] = await sql`
      INSERT INTO users (username, email, full_name, region, role, password_hash)
      VALUES (${username}, ${email}, ${name}, ${region || null}, ${role}, ${passwordHash})
      RETURNING id`;
  } catch (error) {
    console.error('Registration failed while creating the account:', error);
    redirect('/register?error=' + q('Could not create the account. Check the PostgreSQL connection and users table schema.'));
  }

  await createSession(user.id);
  redirect('/dashboard');
}

export async function logout() {
  destroySession();
  redirect('/');
}

export async function updateUser(formData) {
  const admin = await requireAdmin();
  const id = Number(formData.get('id')) || 0;
  const role = formData.get('role') === 'admin' ? 'admin' : 'staff';
  const active = formData.get('active') === 'on';

  if (id === admin.id && (!active || role !== 'admin')) {
    redirect('/users?error=' + q('You cannot deactivate or demote your own current admin account.'));
  }
  await sql`UPDATE users SET role = ${role}, is_active = ${active} WHERE id = ${id}`;
  revalidatePath('/users');
  redirect('/users?ok=' + q('User permissions updated.'));
}

export async function saveMachinery(formData) {
  const user = await requireUser();
  const id = Number(formData.get('id')) || 0;
  const fca = str(formData, 'fca');
  const type = str(formData, 'machinery_type') || 'Other';
  const region = str(formData, 'region');
  const province = str(formData, 'province');
  const yearRaw = str(formData, 'fund_year');
  const year = yearRaw ? Number(yearRaw) : null;
  const quantity = Number(formData.get('quantity'));
  const status = str(formData, 'status');
  const lastUpdate = str(formData, 'last_update');
  const remarks = str(formData, 'remarks');

  if (!region || !province || !Number.isInteger(quantity) || quantity < 1
      || !['Functional', 'Operational', 'Non-Operational'].includes(status)
      || !/^\d{4}-\d{2}-\d{2}$/.test(lastUpdate)
      || (year !== null && (!Number.isInteger(year) || year < 2019 || year > 2031))) {
    redirect('/machinery?error=' + q('Check required fields, quantity, dates, status, and fund year.'));
  }

  if (id > 0) {
    const rows = await sql`
      UPDATE machinery
      SET fca = ${fca || null}, machinery_type = ${type}, fund_year = ${year},
          region = ${region}, province = ${province || null},
          quantity = ${quantity}, status = ${status}, last_update = ${lastUpdate},
          remarks = ${remarks || null}, updated_by = ${user.id}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id`;
    if (!rows.length) redirect('/machinery?error=' + q('Machinery record was not found.'));
  } else {
    await sql`
      INSERT INTO machinery (
        fca, machinery_type, fund_year, region, province,
        quantity, status, last_update, remarks, created_by, updated_by
      )
      VALUES (
        ${fca || null}, ${type}, ${year}, ${region}, ${province || null},
        ${quantity}, ${status},
        ${lastUpdate}, ${remarks || null}, ${user.id}, ${user.id}
      )`;
  }

  revalidatePath('/machinery');
  revalidatePath('/dashboard');
  redirect('/machinery?ok=' + q(id ? 'Machinery record updated.' : 'Machinery record added.'));
}

export async function deleteMachinery(formData) {
  await requireAdmin();
  const id = Number(formData.get('id')) || 0;
  if (!Number.isInteger(id) || id < 1) redirect('/machinery?error=' + q('Invalid machinery record.'));
  const rows = await sql`DELETE FROM machinery WHERE id = ${id} RETURNING id`;
  if (!rows.length) redirect('/machinery?error=' + q('Machinery record was not found.'));
  revalidatePath('/machinery');
  revalidatePath('/dashboard');
  redirect('/machinery?ok=' + q('Machinery record deleted.'));
}

const DOCUMENT_FLAGS = ['eval', 'val', 'letter', 'board', 'certacc', 'members', 'mach', 'certreg'];

export async function saveFcaDocument(formData) {
  const user = await requireUser();
  const id = Number(formData.get('id')) || 0;
  const fcaName = str(formData, 'fca_name');
  const region = str(formData, 'region');
  const province = str(formData, 'province');
  if (!fcaName || !region || !province || !province) {
    redirect('/fca_documents?error=' + q('FCA name, region, and province are required.'));
  }

  const flags = Object.fromEntries(DOCUMENT_FLAGS.map((key) => [key, formData.get(key) === 'on' ? 1 : 0]));
  if (id > 0) {
    const rows = await sql`
      UPDATE fca_documents
      SET fca_name = ${fcaName}, region = ${region}, province = ${province},
          fund_source = ${str(formData, 'fund_source') || null},
          eval = ${flags.eval}, val = ${flags.val}, letter = ${flags.letter},
          board = ${flags.board}, certacc = ${flags.certacc}, members = ${flags.members},
          mach = ${flags.mach}, certreg = ${flags.certreg},
          remarks = ${str(formData, 'remarks') || null},
          updated_by = ${user.id}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id`;
    if (!rows.length) redirect('/fca_documents?error=' + q('FCA document record was not found.'));
  } else {
    await sql`
      INSERT INTO fca_documents (
        fca_name, region, province, fund_source, eval, val, letter, board,
        certacc, members, mach, certreg, remarks, created_by, updated_by
      )
      VALUES (
        ${fcaName}, ${region}, ${province}, ${str(formData, 'fund_source') || null},
        ${flags.eval}, ${flags.val}, ${flags.letter}, ${flags.board},
        ${flags.certacc}, ${flags.members}, ${flags.mach}, ${flags.certreg},
        ${str(formData, 'remarks') || null}, ${user.id}, ${user.id}
      )`;
  }

  revalidatePath('/fca_documents');
  revalidatePath('/dashboard');
  revalidatePath('/fca_requirements');
  redirect('/fca_documents?ok=' + q('FCA document record saved.'));
}

export async function deleteFcaDocument(formData) {
  await requireAdmin();
  const id = Number(formData.get('id')) || 0;
  if (!Number.isInteger(id) || id < 1) redirect('/fca_documents?error=' + q('Invalid FCA document record.'));
  const rows = await sql`DELETE FROM fca_documents WHERE id = ${id} RETURNING id`;
  if (!rows.length) redirect('/fca_documents?error=' + q('FCA document record was not found.'));
  revalidatePath('/fca_documents');
  revalidatePath('/dashboard');
  revalidatePath('/fca_requirements');
  redirect('/fca_documents?ok=' + q('FCA document record deleted.'));
}

export async function saveFcaRequirements(formData) {
  const user = await requireUser();
  const fcaId = Number(formData.get('fca_id')) || 0;
  const keys = [
    'moa_target', 'moa_signed', 'moa_transmitted', 'moa_received', 'moa_distributed',
    'cod_target', 'cod_signed', 'cod_transmitted', 'cod_received', 'cod_distributed',
    'dod_target', 'dod_signed', 'dod_transmitted', 'dod_received', 'dod_distributed',
    'mem_target', 'mem_uploaded',
  ];
  const values = Object.fromEntries(keys.map((key) => [key, String(formData.get(key) ?? '').trim()]));
  if (!Number.isInteger(fcaId) || fcaId < 1
      || keys.some((key) => !/^\d+$/.test(values[key]) || Number(values[key]) > 32767)) {
    redirect('/fca_requirements?error=' + q('Requirement values must be whole numbers from 0 to 32767.'));
  }

  const rows = await sql`SELECT id FROM fca_documents WHERE id = ${fcaId}`;
  if (!rows.length) redirect('/fca_requirements?error=' + q('FCA record was not found.'));

  await sql`
    INSERT INTO fca_checklists (
      fca_id, moa_target, moa_signed, moa_transmitted, moa_received, moa_distributed,
      cod_target, cod_signed, cod_transmitted, cod_received, cod_distributed,
      dod_target, dod_signed, dod_transmitted, dod_received, dod_distributed,
      mem_target, mem_uploaded, updated_by, updated_at
    )
    VALUES (
      ${fcaId}, ${Number(values.moa_target)}, ${Number(values.moa_signed)},
      ${Number(values.moa_transmitted)}, ${Number(values.moa_received)}, ${Number(values.moa_distributed)},
      ${Number(values.cod_target)}, ${Number(values.cod_signed)},
      ${Number(values.cod_transmitted)}, ${Number(values.cod_received)}, ${Number(values.cod_distributed)},
      ${Number(values.dod_target)}, ${Number(values.dod_signed)},
      ${Number(values.dod_transmitted)}, ${Number(values.dod_received)}, ${Number(values.dod_distributed)},
      ${Number(values.mem_target)}, ${Number(values.mem_uploaded)}, ${user.id}, NOW()
    )
    ON CONFLICT (fca_id) DO UPDATE
    SET moa_target = EXCLUDED.moa_target, moa_signed = EXCLUDED.moa_signed,
        moa_transmitted = EXCLUDED.moa_transmitted, moa_received = EXCLUDED.moa_received,
        moa_distributed = EXCLUDED.moa_distributed, cod_target = EXCLUDED.cod_target,
        cod_signed = EXCLUDED.cod_signed, cod_transmitted = EXCLUDED.cod_transmitted,
        cod_received = EXCLUDED.cod_received, cod_distributed = EXCLUDED.cod_distributed,
        dod_target = EXCLUDED.dod_target, dod_signed = EXCLUDED.dod_signed,
        dod_transmitted = EXCLUDED.dod_transmitted, dod_received = EXCLUDED.dod_received,
        dod_distributed = EXCLUDED.dod_distributed, mem_target = EXCLUDED.mem_target,
        mem_uploaded = EXCLUDED.mem_uploaded, updated_by = EXCLUDED.updated_by,
        updated_at = NOW()`;

  revalidatePath('/fca_requirements');
  revalidatePath('/dashboard');
  redirect('/fca_requirements?ok=' + q('FCA requirements saved.'));
}

export async function saveFundSource(formData) {
  const u = await requireUser();
  const year = Number(formData.get('fund_year')) || 0;
  const src = str(formData, 'fund_source') || 'RCEF';
  const amtRaw = str(formData, 'amount');
  const amount = amtRaw === '' || Number.isNaN(Number(amtRaw)) ? null : amtRaw;
  const notes = str(formData, 'notes');

  if (year < 2019 || year > 2031) {
    redirect('/fund_sources?error=' + q('Year must be from 2019 through 2031.'));
  }
  await sql`
    UPDATE fund_sources
    SET fund_source = ${src}, amount = ${amount}, notes = ${notes},
        updated_by = ${u.id}, updated_at = NOW()
    WHERE fund_year = ${year}`;
  revalidatePath('/fund_sources');
  redirect('/fund_sources?ok=' + q('Fund source updated.'));
}
