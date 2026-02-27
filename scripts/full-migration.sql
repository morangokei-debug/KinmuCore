-- ========================================
-- KinmuCore 全マイグレーション（001 + 003 + 004 + 006 + 007）
-- ========================================

-- 001: 初期スキーマ
CREATE TABLE IF NOT EXISTS stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  name_kana TEXT,
  employment_type TEXT NOT NULL DEFAULT 'part_time',
  hourly_rate INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_store_id ON staff(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);

CREATE TABLE IF NOT EXISTS time_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  punch_type TEXT NOT NULL CHECK (punch_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  punched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_modified BOOLEAN DEFAULT false NOT NULL,
  modified_by UUID,
  modified_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_time_records_staff_id ON time_records(staff_id);
CREATE INDEX IF NOT EXISTS idx_time_records_store_id ON time_records(store_id);
CREATE INDEX IF NOT EXISTS idx_time_records_punched_at ON time_records(punched_at);
CREATE INDEX IF NOT EXISTS idx_time_records_staff_date ON time_records(staff_id, punched_at);

CREATE TABLE IF NOT EXISTS daily_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0 NOT NULL,
  working_minutes INTEGER DEFAULT 0 NOT NULL,
  overtime_minutes INTEGER DEFAULT 0 NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'holiday', 'paid_leave', 'pending')) DEFAULT 'pending',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_attendance_store_date ON daily_attendance(store_id, work_date);
CREATE INDEX IF NOT EXISTS idx_daily_attendance_staff_date ON daily_attendance(staff_id, work_date);

CREATE TABLE IF NOT EXISTS correction_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  time_record_id UUID REFERENCES time_records(id),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  punch_type TEXT NOT NULL CHECK (punch_type IN ('clock_in', 'clock_out', 'break_start', 'break_end')),
  original_time TIMESTAMPTZ,
  requested_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_correction_requests_status ON correction_requests(status);

CREATE TABLE IF NOT EXISTS policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'デフォルトポリシー',
  closing_day_type TEXT NOT NULL CHECK (closing_day_type IN ('end_of_month', 'custom')) DEFAULT 'end_of_month',
  closing_day_custom INTEGER CHECK (closing_day_custom BETWEEN 1 AND 28),
  rounding_unit INTEGER NOT NULL CHECK (rounding_unit IN (1, 5, 15)) DEFAULT 1,
  break_deduction_type TEXT NOT NULL CHECK (break_deduction_type IN ('manual', 'auto')) DEFAULT 'manual',
  auto_break_threshold_minutes INTEGER,
  auto_break_deduction_minutes INTEGER,
  enable_paid_leave BOOLEAN DEFAULT false NOT NULL,
  enable_correction_approval BOOLEAN DEFAULT true NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_store_id ON policies(store_id);

-- トリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_stores_updated_at') THEN
    CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_staff_updated_at') THEN
    CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_daily_attendance_updated_at') THEN
    CREATE TRIGGER update_daily_attendance_updated_at BEFORE UPDATE ON daily_attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_policies_updated_at') THEN
    CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies (DROP IF EXISTS then CREATE)
DO $$ BEGIN
  -- stores
  DROP POLICY IF EXISTS "Authenticated users can read stores" ON stores;
  DROP POLICY IF EXISTS "Authenticated users can insert stores" ON stores;
  DROP POLICY IF EXISTS "Authenticated users can update stores" ON stores;
  DROP POLICY IF EXISTS "Authenticated users can delete stores" ON stores;
  DROP POLICY IF EXISTS "Anon can read active stores" ON stores;
  CREATE POLICY "Authenticated users can read stores" ON stores FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert stores" ON stores FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authenticated users can update stores" ON stores FOR UPDATE TO authenticated USING (true);
  CREATE POLICY "Authenticated users can delete stores" ON stores FOR DELETE TO authenticated USING (true);
  CREATE POLICY "Anon can read active stores" ON stores FOR SELECT TO anon USING (is_active = true);

  -- staff
  DROP POLICY IF EXISTS "Authenticated users can read staff" ON staff;
  DROP POLICY IF EXISTS "Authenticated users can insert staff" ON staff;
  DROP POLICY IF EXISTS "Authenticated users can update staff" ON staff;
  DROP POLICY IF EXISTS "Authenticated users can delete staff" ON staff;
  DROP POLICY IF EXISTS "Anon can read active staff" ON staff;
  CREATE POLICY "Authenticated users can read staff" ON staff FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert staff" ON staff FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authenticated users can update staff" ON staff FOR UPDATE TO authenticated USING (true);
  CREATE POLICY "Authenticated users can delete staff" ON staff FOR DELETE TO authenticated USING (true);
  CREATE POLICY "Anon can read active staff" ON staff FOR SELECT TO anon USING (status = 'active');

  -- time_records
  DROP POLICY IF EXISTS "Authenticated users can read time_records" ON time_records;
  DROP POLICY IF EXISTS "Authenticated users can insert time_records" ON time_records;
  DROP POLICY IF EXISTS "Authenticated users can update time_records" ON time_records;
  DROP POLICY IF EXISTS "Anon can insert time_records" ON time_records;
  DROP POLICY IF EXISTS "Anon can read time_records" ON time_records;
  CREATE POLICY "Authenticated users can read time_records" ON time_records FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert time_records" ON time_records FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authenticated users can update time_records" ON time_records FOR UPDATE TO authenticated USING (true);
  CREATE POLICY "Anon can insert time_records" ON time_records FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "Anon can read time_records" ON time_records FOR SELECT TO anon USING (true);

  -- daily_attendance
  DROP POLICY IF EXISTS "Authenticated users can read daily_attendance" ON daily_attendance;
  DROP POLICY IF EXISTS "Authenticated users can insert daily_attendance" ON daily_attendance;
  DROP POLICY IF EXISTS "Authenticated users can update daily_attendance" ON daily_attendance;
  DROP POLICY IF EXISTS "Anon can read daily_attendance" ON daily_attendance;
  DROP POLICY IF EXISTS "Anon can insert daily_attendance" ON daily_attendance;
  DROP POLICY IF EXISTS "Anon can update daily_attendance" ON daily_attendance;
  CREATE POLICY "Authenticated users can read daily_attendance" ON daily_attendance FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert daily_attendance" ON daily_attendance FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authenticated users can update daily_attendance" ON daily_attendance FOR UPDATE TO authenticated USING (true);
  CREATE POLICY "Anon can read daily_attendance" ON daily_attendance FOR SELECT TO anon USING (true);
  CREATE POLICY "Anon can insert daily_attendance" ON daily_attendance FOR INSERT TO anon WITH CHECK (true);
  CREATE POLICY "Anon can update daily_attendance" ON daily_attendance FOR UPDATE TO anon USING (true);

  -- correction_requests
  DROP POLICY IF EXISTS "Authenticated users can read correction_requests" ON correction_requests;
  DROP POLICY IF EXISTS "Authenticated users can insert correction_requests" ON correction_requests;
  DROP POLICY IF EXISTS "Authenticated users can update correction_requests" ON correction_requests;
  CREATE POLICY "Authenticated users can read correction_requests" ON correction_requests FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert correction_requests" ON correction_requests FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authenticated users can update correction_requests" ON correction_requests FOR UPDATE TO authenticated USING (true);

  -- policies
  DROP POLICY IF EXISTS "Authenticated users can read policies" ON policies;
  DROP POLICY IF EXISTS "Authenticated users can insert policies" ON policies;
  DROP POLICY IF EXISTS "Authenticated users can update policies" ON policies;
  DROP POLICY IF EXISTS "Authenticated users can delete policies" ON policies;
  DROP POLICY IF EXISTS "Anon can read policies" ON policies;
  CREATE POLICY "Authenticated users can read policies" ON policies FOR SELECT TO authenticated USING (true);
  CREATE POLICY "Authenticated users can insert policies" ON policies FOR INSERT TO authenticated WITH CHECK (true);
  CREATE POLICY "Authenticated users can update policies" ON policies FOR UPDATE TO authenticated USING (true);
  CREATE POLICY "Authenticated users can delete policies" ON policies FOR DELETE TO authenticated USING (true);
  CREATE POLICY "Anon can read policies" ON policies FOR SELECT TO anon USING (is_active = true);
END $$;

-- 003: 始業・終業時刻の追加
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'standard_work_start_time') THEN
    ALTER TABLE policies ADD COLUMN standard_work_start_time TIME;
    ALTER TABLE policies ADD COLUMN standard_work_end_time TIME;
    ALTER TABLE policies ADD COLUMN allow_early_clock_in BOOLEAN DEFAULT true NOT NULL;
    ALTER TABLE policies ADD COLUMN count_early_minutes BOOLEAN DEFAULT true NOT NULL;
  END IF;
END $$;

-- 004: シフト管理システム
CREATE TABLE IF NOT EXISTS shift_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  short_label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0 NOT NULL,
  working_hours DECIMAL(4,2) DEFAULT 0 NOT NULL,
  is_paid_leave BOOLEAN DEFAULT false NOT NULL,
  is_absent BOOLEAN DEFAULT false NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(store_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shift_templates_store ON shift_templates(store_id);

CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_template_id UUID REFERENCES shift_templates(id),
  custom_start_time TIME,
  custom_end_time TIME,
  custom_break_minutes INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(staff_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_shifts_store_date ON shifts(store_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staff_id, work_date);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'policies' AND column_name = 'shift_start_day') THEN
    ALTER TABLE policies ADD COLUMN shift_start_day INTEGER DEFAULT 1 NOT NULL CHECK (shift_start_day BETWEEN 1 AND 28);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shift_templates_updated_at') THEN
    CREATE TRIGGER update_shift_templates_updated_at BEFORE UPDATE ON shift_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shifts_updated_at') THEN
    CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Auth users can all shift_templates" ON shift_templates;
  DROP POLICY IF EXISTS "Auth users can all shifts" ON shifts;
  DROP POLICY IF EXISTS "Anon can read shift_templates" ON shift_templates;
  DROP POLICY IF EXISTS "Anon can read shifts" ON shifts;
  CREATE POLICY "Auth users can all shift_templates" ON shift_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Auth users can all shifts" ON shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
  CREATE POLICY "Anon can read shift_templates" ON shift_templates FOR SELECT TO anon USING (is_active = true);
  CREATE POLICY "Anon can read shifts" ON shifts FOR SELECT TO anon USING (true);
END $$;

-- 006: スタッフの退職ステータス
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_status_check;
ALTER TABLE staff ADD CONSTRAINT staff_status_check CHECK (status IN ('active', 'inactive', 'retired'));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'retired_at') THEN
    ALTER TABLE staff ADD COLUMN retired_at DATE;
  END IF;
END $$;

-- 007: 業務委託タイプ追加
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_employment_type_check;
ALTER TABLE staff ADD CONSTRAINT staff_employment_type_check CHECK (employment_type IN ('full_time', 'part_time', 'contractor'));

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
