#!/usr/bin/env node
/**
 * Applies db/migrations/*.sql to the database in DATABASE_URL (Neon Postgres).
 * Every migration is idempotent, so running this twice is safe.
 *
 *   DATABASE_URL=postgres://... npm run db:migrate
 *
 * Or skip the script: paste db/migrations/001_votes.sql into the Neon SQL Editor.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('db:migrate: DATABASE_URL is not set');
  process.exit(1);
}
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
const sql = neon(url);
for (const f of files) {
  // One statement per call: the HTTP driver runs a single statement at a time.
  const statements = (await readFile(join(dir, f), 'utf8'))
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) await sql.query(stmt);
  console.log(`db:migrate: applied ${f} (${statements.length} statement${statements.length === 1 ? '' : 's'})`);
}
