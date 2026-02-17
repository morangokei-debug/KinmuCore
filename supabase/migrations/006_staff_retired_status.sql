-- スタッフのステータスに「退職」を追加
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_status_check;
ALTER TABLE staff ADD CONSTRAINT staff_status_check 
  CHECK (status IN ('active', 'inactive', 'retired'));

-- 退職日カラムを追加
ALTER TABLE staff ADD COLUMN retired_at DATE;

COMMENT ON COLUMN staff.retired_at IS '退職日';
