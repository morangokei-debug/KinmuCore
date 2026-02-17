-- ========================================
-- サンプルデータ（テスト用）
-- Supabase SQL Editorで実行してください
-- ========================================

-- 店舗データ
INSERT INTO stores (id, name, address, phone) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'さくら薬局 本店', '東京都新宿区西新宿1-1-1', '03-1234-5678'),
  ('a0000000-0000-0000-0000-000000000002', 'さくら薬局 駅前店', '東京都新宿区新宿3-2-1', '03-2345-6789');

-- スタッフデータ
INSERT INTO staff (id, store_id, name, name_kana, employment_type, hourly_rate, status, display_order) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '山田 花子', 'ヤマダ ハナコ', 'full_time', NULL, 'active', 1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '鈴木 太郎', 'スズキ タロウ', 'part_time', 1200, 'active', 2),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', '佐藤 美咲', 'サトウ ミサキ', 'part_time', 1100, 'active', 3),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', '田中 一郎', 'タナカ イチロウ', 'full_time', NULL, 'active', 1),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', '高橋 和子', 'タカハシ カズコ', 'part_time', 1150, 'active', 2);

-- ポリシーデータ
INSERT INTO policies (store_id, name, closing_day_type, rounding_unit, break_deduction_type, enable_correction_approval, effective_from) VALUES
  ('a0000000-0000-0000-0000-000000000001', '本店ポリシー', 'end_of_month', 15, 'manual', true, '2026-01-01'),
  ('a0000000-0000-0000-0000-000000000002', '駅前店ポリシー', 'end_of_month', 5, 'manual', true, '2026-01-01');

-- サンプル勤怠データ（今月分）
DO $$
DECLARE
  staff_ids UUID[] := ARRAY[
    'b0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000005'
  ];
  store_ids UUID[] := ARRAY[
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000002'
  ];
  d DATE;
  i INTEGER;
  clock_in_time TIME;
  clock_out_time TIME;
  break_min INTEGER;
  work_min INTEGER;
  dow INTEGER;
BEGIN
  FOR d IN SELECT generate_series(
    date_trunc('month', CURRENT_DATE)::date,
    LEAST(CURRENT_DATE - INTERVAL '1 day', (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day'))::date,
    '1 day'::interval
  )::date LOOP
    dow := EXTRACT(DOW FROM d);
    -- 土日は休み
    IF dow = 0 OR dow = 6 THEN
      CONTINUE;
    END IF;

    FOR i IN 1..5 LOOP
      -- パートは週3日程度
      IF (staff_ids[i] IN (
        'b0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000003',
        'b0000000-0000-0000-0000-000000000005'
      )) AND (dow IN (2, 4)) THEN
        CONTINUE;
      END IF;

      -- 正社員は9:00-18:00、パートは10:00-16:00
      IF staff_ids[i] IN (
        'b0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000004'
      ) THEN
        clock_in_time := '09:00'::TIME + (random() * INTERVAL '15 minutes');
        clock_out_time := '18:00'::TIME + (random() * INTERVAL '30 minutes');
        break_min := 60;
      ELSE
        clock_in_time := '10:00'::TIME + (random() * INTERVAL '15 minutes');
        clock_out_time := '16:00'::TIME + (random() * INTERVAL '15 minutes');
        break_min := 30;
      END IF;

      work_min := EXTRACT(EPOCH FROM (clock_out_time - clock_in_time))::INTEGER / 60 - break_min;

      -- 打刻レコード
      INSERT INTO time_records (staff_id, store_id, punch_type, punched_at) VALUES
        (staff_ids[i], store_ids[i], 'clock_in', d + clock_in_time),
        (staff_ids[i], store_ids[i], 'clock_out', d + clock_out_time);

      -- 日次勤怠
      INSERT INTO daily_attendance (staff_id, store_id, work_date, clock_in, clock_out, break_minutes, working_minutes, status) VALUES
        (staff_ids[i], store_ids[i], d, d + clock_in_time, d + clock_out_time, break_min, work_min, 'present');
    END LOOP;
  END LOOP;
END $$;
