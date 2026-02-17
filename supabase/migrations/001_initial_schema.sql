-- ========================================
-- 薬局用勤怠管理システム 初期スキーマ
-- ========================================

-- 店舗テーブル
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- スタッフテーブル
CREATE TABLE staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  name_kana TEXT,
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time')) DEFAULT 'part_time',
  hourly_rate INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_staff_store_id ON staff(store_id);
CREATE INDEX idx_staff_status ON staff(status);

-- 打刻レコードテーブル
CREATE TABLE time_records (
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

CREATE INDEX idx_time_records_staff_id ON time_records(staff_id);
CREATE INDEX idx_time_records_store_id ON time_records(store_id);
CREATE INDEX idx_time_records_punched_at ON time_records(punched_at);
CREATE INDEX idx_time_records_staff_date ON time_records(staff_id, punched_at);

-- 日次勤怠サマリーテーブル
CREATE TABLE daily_attendance (
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

CREATE INDEX idx_daily_attendance_store_date ON daily_attendance(store_id, work_date);
CREATE INDEX idx_daily_attendance_staff_date ON daily_attendance(staff_id, work_date);

-- 打刻修正申請テーブル
CREATE TABLE correction_requests (
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

CREATE INDEX idx_correction_requests_status ON correction_requests(status);

-- ポリシーテーブル（就業ルール）
CREATE TABLE policies (
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

CREATE INDEX idx_policies_store_id ON policies(store_id);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_attendance_updated_at BEFORE UPDATE ON daily_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) ポリシー
-- 認証済みユーザーのみアクセス可能
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- 管理者は全データにアクセス可能（認証済みユーザー＝管理者の前提）
CREATE POLICY "Authenticated users can read stores" ON stores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert stores" ON stores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update stores" ON stores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete stores" ON stores FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read staff" ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert staff" ON staff FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update staff" ON staff FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete staff" ON staff FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read time_records" ON time_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert time_records" ON time_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update time_records" ON time_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read daily_attendance" ON daily_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert daily_attendance" ON daily_attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update daily_attendance" ON daily_attendance FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read correction_requests" ON correction_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert correction_requests" ON correction_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update correction_requests" ON correction_requests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read policies" ON policies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert policies" ON policies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update policies" ON policies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete policies" ON policies FOR DELETE TO authenticated USING (true);

-- 打刻画面用：匿名アクセス（店舗端末からの打刻用）
-- anonキーでも打刻のINSERTと、スタッフ一覧のSELECTは許可
CREATE POLICY "Anon can read active staff" ON staff FOR SELECT TO anon USING (status = 'active');
CREATE POLICY "Anon can read active stores" ON stores FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Anon can insert time_records" ON time_records FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can read time_records" ON time_records FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can read daily_attendance" ON daily_attendance FOR SELECT TO anon USING (true);
CREATE POLICY "Anon can insert daily_attendance" ON daily_attendance FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon can update daily_attendance" ON daily_attendance FOR UPDATE TO anon USING (true);
CREATE POLICY "Anon can read policies" ON policies FOR SELECT TO anon USING (is_active = true);
