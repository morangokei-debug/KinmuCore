-- 始業・終業時刻の追加（将来のシフト連携に向けて）
ALTER TABLE policies 
ADD COLUMN standard_work_start_time TIME,
ADD COLUMN standard_work_end_time TIME,
ADD COLUMN allow_early_clock_in BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN count_early_minutes BOOLEAN DEFAULT true NOT NULL;

COMMENT ON COLUMN policies.standard_work_start_time IS '標準始業時刻（早出判定用）';
COMMENT ON COLUMN policies.standard_work_end_time IS '標準終業時刻（残業判定用）';
COMMENT ON COLUMN policies.allow_early_clock_in IS '始業時刻前の打刻を許可するか';
COMMENT ON COLUMN policies.count_early_minutes IS '始業時刻前の時間を勤務時間にカウントするか';
