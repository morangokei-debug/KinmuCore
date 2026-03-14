-- ========================================
-- スタッフごとのシフト編集権限
-- ========================================

ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS can_edit_shifts BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_roles_can_edit_shifts ON user_roles(can_edit_shifts);
