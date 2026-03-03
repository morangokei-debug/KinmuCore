#!/usr/bin/env node
/**
 * タイムゾーンバグで1日ずれた work_date を修正する
 *
 * 全 daily_attendance レコードの work_date を +1日 する。
 * UNIQUE制約(staff_id, work_date)の競合を避けるため日付降順で処理。
 *
 * Usage:
 *   node scripts/fix-work-dates.mjs --dry-run   # 確認のみ
 *   node scripts/fix-work-dates.mjs              # 実行
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

if (!existsSync(envPath)) {
  console.error('.env.local が見つかりません');
  process.exit(1);
}

const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDryRun = process.argv.includes('--dry-run');

function addOneDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function main() {
  console.log(isDryRun ? '=== ドライラン（変更しません） ===' : '=== 本実行 ===');
  console.log('');

  const { data: records, error } = await supabase
    .from('daily_attendance')
    .select('id, staff_id, work_date, clock_in, clock_out')
    .order('work_date', { ascending: false });

  if (error) {
    console.error('取得エラー:', error.message);
    process.exit(1);
  }

  console.log(`全レコード数: ${records.length}`);
  console.log('');

  // UNIQUE制約の競合チェック
  const staffDateSet = new Set();
  const updates = [];
  const conflicts = [];

  for (const r of records) {
    const newDate = addOneDay(r.work_date);
    const uniqueKey = `${r.staff_id}_${newDate}`;

    if (staffDateSet.has(uniqueKey)) {
      conflicts.push({ id: r.id, staff_id: r.staff_id, from: r.work_date, to: newDate });
    } else {
      staffDateSet.add(uniqueKey);
      updates.push({ id: r.id, staff_id: r.staff_id, from: r.work_date, to: newDate });
    }
  }

  if (conflicts.length > 0) {
    console.log(`⚠️ UNIQUE 競合あり（${conflicts.length}件）- 中止します:`);
    for (const c of conflicts) {
      console.log(`  staff ${c.staff_id.slice(0, 8)}… : ${c.from} → ${c.to} が重複`);
    }
    process.exit(1);
  }

  console.log('修正内容:');
  console.log('─'.repeat(60));
  for (const u of updates) {
    console.log(`  ${u.from} → ${u.to}  (staff: ${u.staff_id.slice(0, 8)}…)`);
  }
  console.log('─'.repeat(60));
  console.log(`合計: ${updates.length} 件`);

  if (isDryRun) {
    console.log('\nドライランのため変更しません。実行するには --dry-run を外してください。');
    return;
  }

  let ok = 0;
  let ng = 0;

  for (const u of updates) {
    const { error: updateError } = await supabase
      .from('daily_attendance')
      .update({ work_date: u.to })
      .eq('id', u.id);

    if (updateError) {
      console.error(`  ✗ ${u.id}: ${updateError.message}`);
      ng++;
    } else {
      ok++;
    }
  }

  console.log(`\n完了: 成功 ${ok} 件, 失敗 ${ng} 件`);
}

main().catch(console.error);
