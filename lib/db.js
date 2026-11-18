import postgres from 'postgres';

const g = globalThis;
function isValidDatabaseUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && Boolean(url.hostname)
      && url.pathname.length > 1
      && !/[<>]/.test(value);
  } catch {
    return false;
  }
}

export const isDatabaseConfigured = isValidDatabaseUrl(process.env.DATABASE_URL);
const client = isDatabaseConfigured
  ? g.__rcefSql ?? postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 20 })
  : null;

if (client && process.env.NODE_ENV !== 'production') g.__rcefSql = client;

export function sql(strings, ...values) {
  if (!client) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string.');
  }
  return client(strings, ...values);
}
