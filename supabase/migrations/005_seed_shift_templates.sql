-- サンプルシフトテンプレート（2店舗分）
-- さくら薬局 本店
INSERT INTO shift_templates (store_id, code, name, short_label, color, start_time, end_time, break_minutes, working_hours, is_paid_leave, display_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'full', '全日', '◯', '#22C55E', '09:00', '18:00', 60, 8.0, false, 1),
  ('a0000000-0000-0000-0000-000000000001', 'am', '午前', 'AM', '#3B82F6', '09:00', '13:00', 0, 4.0, false, 2),
  ('a0000000-0000-0000-0000-000000000001', 'pm', '午後', 'PM', '#F59E0B', '14:00', '18:00', 0, 4.0, false, 3),
  ('a0000000-0000-0000-0000-000000000001', 'paid_leave', '有給', '有給', '#EF4444', NULL, NULL, 0, 0, true, 10),
  ('a0000000-0000-0000-0000-000000000001', 'half_paid', '半休', '半休', '#F97316', NULL, NULL, 0, 0, true, 11);

-- さくら薬局 駅前店
INSERT INTO shift_templates (store_id, code, name, short_label, color, start_time, end_time, break_minutes, working_hours, is_paid_leave, display_order) VALUES
  ('a0000000-0000-0000-0000-000000000002', 'full', '全日', '◯', '#22C55E', '09:00', '18:00', 60, 8.0, false, 1),
  ('a0000000-0000-0000-0000-000000000002', 'am', '午前', 'AM', '#3B82F6', '09:00', '13:00', 0, 4.0, false, 2),
  ('a0000000-0000-0000-0000-000000000002', 'pm', '午後', 'PM', '#F59E0B', '14:00', '18:00', 0, 4.0, false, 3),
  ('a0000000-0000-0000-0000-000000000002', 'paid_leave', '有給', '有給', '#EF4444', NULL, NULL, 0, 0, true, 10),
  ('a0000000-0000-0000-0000-000000000002', 'half_paid', '半休', '半休', '#F97316', NULL, NULL, 0, 0, true, 11);

-- シフト開始日を11日に設定
UPDATE policies SET shift_start_day = 11;
