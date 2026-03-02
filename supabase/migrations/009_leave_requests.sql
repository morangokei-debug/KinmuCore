-- ========================================
-- 有給申請
-- 既存テーブル・既存データには一切触れません（ADD COLUMN のみ）
-- ========================================

-- user_roles に staff_id を追加（スタッフユーザーと従業員の紐付け）
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_staff_id ON user_roles(staff_id);

-- 有給申請テーブル
CREATE TABLE leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('full', 'half')),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_leave_requests_store_status ON leave_requests(store_id, status);
CREATE INDEX idx_leave_requests_staff_date ON leave_requests(staff_id, request_date);
CREATE UNIQUE INDEX idx_leave_requests_unique ON leave_requests(staff_id, request_date);

COMMENT ON TABLE leave_requests IS '有給申請。full=1日、half=半日';

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can all leave_requests" ON leave_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
