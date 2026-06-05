/**
 * Seeds test events into the database.
 * Run: node scripts/seed-events.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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
      if (key) process.env[key] = val;
    }
  } catch {
    console.warn('.env not found — using existing process.env');
  }
}

loadEnv();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Dates relative to today
const now = new Date();
const days = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

const events = [
  {
    slug: 'mental-health-awareness-talk-2026',
    title: 'Mental Health Awareness Talk',
    description: 'A free community talk covering stress management, burnout, and practical coping tools. Open to everyone.',
    organizer_name: 'Nawe',
    location: 'Westlands, Nairobi',
    starts_at: days(7),
    ends_at: days(7).replace('T', 'T').replace(/\d{2}:\d{2}:\d{2}/, '14:00:00'),
    is_free: true,
    price: null,
    currency: 'KES',
    capacity: 50,
    status: 'published',
  },
  {
    slug: 'anxiety-and-relationships-workshop',
    title: 'Anxiety & Relationships Workshop',
    description: 'An interactive workshop exploring how anxiety affects our relationships, with guided exercises and a licensed therapist facilitator.',
    organizer_name: 'Nawe',
    location: 'Karen, Nairobi',
    starts_at: days(14),
    ends_at: days(14).replace(/\d{2}:\d{2}:\d{2}/, '17:00:00'),
    is_free: false,
    price: 1500,
    currency: 'KES',
    capacity: 30,
    status: 'published',
  },
  {
    slug: 'self-care-sunday-session',
    title: 'Self-Care Sunday Session',
    description: 'Guided meditation, journaling prompts, and group sharing in a safe, judgement-free space. Refreshments provided.',
    organizer_name: 'Nawe',
    location: 'Kilimani, Nairobi',
    starts_at: days(21),
    ends_at: days(21).replace(/\d{2}:\d{2}:\d{2}/, '13:00:00'),
    is_free: false,
    price: 800,
    currency: 'KES',
    capacity: 20,
    status: 'published',
  },
  {
    slug: 'online-grief-support-circle',
    title: 'Online Grief Support Circle',
    description: 'A virtual safe space for those navigating loss. Facilitated by a certified grief counsellor.',
    organizer_name: 'Nawe',
    location: 'Online (Zoom)',
    starts_at: days(10),
    ends_at: days(10).replace(/\d{2}:\d{2}:\d{2}/, '20:00:00'),
    is_free: true,
    price: null,
    currency: 'KES',
    capacity: null,
    status: 'published',
  },
];

async function seed() {
  console.log(`Seeding ${events.length} events...\n`);

  for (const event of events) {
    const { data, error } = await supabase
      .from('events')
      .upsert(event, { onConflict: 'slug' })
      .select('id, slug, title, status')
      .single();

    if (error) {
      console.error(`  ✗ ${event.slug}: ${error.message}`);
    } else {
      console.log(`  ✓ ${data.title} (${data.id.slice(0, 8)}) — ${data.status}`);
    }
  }

  console.log('\nDone.');
}

seed().catch(console.error);
