-- ========================================
-- シフト管理システム
-- ========================================

-- シフトテンプレート（◯、AM、PM等の定義）
CREATE TABLE shift_templates (
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

CREATE INDEX idx_shift_templates_store ON shift_templates(store_id);

-- シフトデータ（スタッフ×日付ごと）
CREATE TABLE shifts (
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

CREATE INDEX idx_shifts_store_date ON shifts(store_id, work_date);
CREATE INDEX idx_shifts_staff_date ON shifts(staff_id, work_date);

-- 月の開始日設定をポリシーに追加（既存のclosing_dayとは別にシフト用）
ALTER TABLE policies
ADD COLUMN shift_start_day INTEGER DEFAULT 1 NOT NULL CHECK (shift_start_day BETWEEN 1 AND 28);

COMMENT ON COLUMN policies.shift_start_day IS 'シフト表の月開始日（例: 11 → 11日始まり）';

-- トリガー
CREATE TRIGGER update_shift_templates_updated_at BEFORE UPDATE ON shift_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can all shift_templates" ON shift_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth users can all shifts" ON shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon can read shift_templates" ON shift_templates FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "Anon can read shifts" ON shifts FOR SELECT TO anon USING (true);
