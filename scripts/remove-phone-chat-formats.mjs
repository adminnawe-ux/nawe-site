/**
 * One-off: strip 'Phone Call' and 'Chat / Messaging' from every therapist's
 * session_formats, now that those are no longer offered as session formats.
 *
 * Dry run (default): prints what would change, writes nothing.
 * Run: node scripts/remove-phone-chat-formats.mjs
 *
 * Apply: node scripts/remove-phone-chat-formats.mjs --apply
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* rely on shell */ }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const REMOVE = ['Phone Call', 'Chat / Messaging'];
const APPLY = process.argv.includes('--apply');

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const res = await fetch(
  `${SUPABASE_URL}/rest/v1/therapists?select=id,session_formats`,
  { headers }
);
if (!res.ok) {
  console.error('Fetch failed:', res.status, await res.text());
  process.exit(1);
}

const rows = await res.json();
const affected = rows
  .map((r) => ({
    id: r.id,
    before: r.session_formats ?? [],
    after: (r.session_formats ?? []).filter((f) => !REMOVE.includes(f)),
  }))
  .filter((r) => r.before.length !== r.after.length);

if (affected.length === 0) {
  console.log('No therapists have Phone Call or Chat / Messaging in session_formats. Nothing to do.');
  process.exit(0);
}

console.log(`${affected.length} therapist(s) to update${APPLY ? '' : ' (dry run — pass --apply to write)'}:\n`);
for (const r of affected) {
  console.log(`  ${r.id.slice(0, 8)}  ${JSON.stringify(r.before)} -> ${JSON.stringify(r.after)}`);
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to write these changes.');
  process.exit(0);
}

let okCount = 0;
for (const r of affected) {
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/therapists?id=eq.${r.id}`,
    {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify({ session_formats: r.after }),
    }
  );
  if (patchRes.ok) {
    okCount++;
  } else {
    console.error(`  Failed to update ${r.id}:`, patchRes.status, await patchRes.text());
  }
}

console.log(`\nUpdated ${okCount}/${affected.length} therapist(s).`);
