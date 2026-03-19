-- ========================================
-- スタッフごとの打刻画面表示フラグ
-- ========================================

ALTER TABLE staff
ADD COLUMN IF NOT EXISTS show_in_punch BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_staff_show_in_punch ON staff(show_in_punch);
