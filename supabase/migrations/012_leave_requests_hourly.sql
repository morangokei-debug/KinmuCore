-- ========================================
-- 有給申請の時間単位対応
-- ========================================

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS requested_hours NUMERIC(4,2);

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

ALTER TABLE leave_requests
ADD CONSTRAINT leave_requests_leave_type_check
CHECK (leave_type IN ('full', 'half', 'hourly'));

COMMENT ON COLUMN leave_requests.requested_hours IS '時間単位有給の申請時間（hourly時のみ利用）';
