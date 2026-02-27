import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ref = 'xnbzwibqypkgvqmulptn';
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const poolerConfigs = [
  {
    name: 'Session pooler (port 5432)',
    connectionString: `postgresql://postgres.${ref}:${serviceKey}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`,
  },
  {
    name: 'Transaction pooler (port 6543)',
    connectionString: `postgresql://postgres.${ref}:${serviceKey}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`,
  },
  {
    name: 'Direct connection',
    connectionString: `postgresql://postgres:${serviceKey}@db.${ref}.supabase.co:5432/postgres`,
  },
];

let client = null;

for (const config of poolerConfigs) {
  console.log(`Trying ${config.name}...`);
  const c = new pg.Client({
    connectionString: config.connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  try {
    await c.connect();
    const res = await c.query('SELECT 1 as test');
    console.log(`  Connected! Test: ${JSON.stringify(res.rows)}`);
    client = c;
    break;
  } catch (err) {
    console.log(`  Failed: ${err.message}`);
    try { await c.end(); } catch {}
  }
}

if (!client) {
  console.error('\nAll connection methods failed. Cannot run migration.');
  process.exit(1);
}

const migrationFiles = [
  '001_initial_schema.sql',
  '003_add_work_hours.sql',
  '004_shift_system.sql',
  '006_staff_retired_status.sql',
  '007_add_contractor_type.sql',
];

console.log('\nRunning migrations...\n');

for (const file of migrationFiles) {
  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', file), 'utf8');
  console.log(`Running ${file}...`);
  try {
    await client.query(sql);
    console.log(`  OK`);
  } catch (err) {
    console.log(`  ERROR: ${err.message}`);
    if (err.message.includes('already exists')) {
      console.log(`  (Skipping - already exists)`);
    }
  }
}

console.log('\nVerifying tables...');
const { rows } = await client.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
);
console.log('Tables:', rows.map(r => r.table_name).join(', '));

await client.end();
console.log('\nDone!');
