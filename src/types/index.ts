// ========================================
// 薬局用勤怠管理システム 型定義
// ========================================

// --- 店舗 ---
export interface Store {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- スタッフ ---
export type EmploymentType = 'full_time' | 'part_time' | 'contractor';
export type StaffStatus = 'active' | 'inactive' | 'retired';

export interface Staff {
  id: string;
  store_id: string;
  name: string;
  name_kana: string | null;
  employment_type: EmploymentType;
  hourly_rate: number | null;
  status: StaffStatus;
  retired_at: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
  store?: Store;
}

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: '在籍',
  inactive: '休職中',
  retired: '退職',
};

// --- 打刻 ---
export type PunchType = 'clock_in' | 'clock_out' | 'break_start' | 'break_end';

export interface TimeRecord {
  id: string;
  staff_id: string;
  store_id: string;
  punch_type: PunchType;
  punched_at: string;
  is_modified: boolean;
  modified_by: string | null;
  modified_reason: string | null;
  created_at: string;
  staff?: Staff;
  store?: Store;
}

// --- 日次勤怠サマリー ---
export interface DailyAttendance {
  id: string;
  staff_id: string;
  store_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_minutes: number;
  working_minutes: number;
  overtime_minutes: number;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  staff?: Staff;
  store?: Store;
}

export type AttendanceStatus = 'present' | 'absent' | 'holiday' | 'paid_leave' | 'pending';

// --- 打刻修正申請 ---
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface CorrectionRequest {
  id: string;
  time_record_id: string | null;
  staff_id: string;
  store_id: string;
  work_date: string;
  punch_type: PunchType;
  original_time: string | null;
  requested_time: string;
  reason: string;
  status: CorrectionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// --- ポリシー ---
export type RoundingUnit = 1 | 5 | 15;
export type BreakDeductionType = 'manual' | 'auto';
export type ClosingDay = 'end_of_month' | 'custom';

export interface Policy {
  id: string;
  store_id: string;
  name: string;
  closing_day_type: ClosingDay;
  closing_day_custom: number | null;
  rounding_unit: RoundingUnit;
  break_deduction_type: BreakDeductionType;
  auto_break_threshold_minutes: number | null;
  auto_break_deduction_minutes: number | null;
  enable_paid_leave: boolean;
  enable_correction_approval: boolean;
  standard_work_start_time: string | null;
  standard_work_end_time: string | null;
  allow_early_clock_in: boolean;
  count_early_minutes: boolean;
  shift_start_day: number;
  effective_from: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  store?: Store;
}

// --- シフトテンプレート ---
export interface ShiftTemplate {
  id: string;
  store_id: string;
  code: string;
  name: string;
  short_label: string;
  color: string;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  working_hours: number;
  is_paid_leave: boolean;
  is_absent: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// --- シフト ---
export interface Shift {
  id: string;
  staff_id: string;
  store_id: string;
  work_date: string;
  shift_template_id: string | null;
  custom_start_time: string | null;
  custom_end_time: string | null;
  custom_break_minutes: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  shift_template?: ShiftTemplate;
  staff?: Staff;
}

// --- 月次集計 ---
export interface MonthlyAttendanceSummary {
  staff_id: string;
  staff_name: string;
  store_name: string;
  employment_type: EmploymentType;
  year: number;
  month: number;
  total_working_days: number;
  total_working_minutes: number;
  total_break_minutes: number;
  total_overtime_minutes: number;
  hourly_rate: number | null;
  daily_records: DailyAttendance[];
}

// --- 打刻画面用 ---
export interface PunchScreenStaff {
  id: string;
  name: string;
  current_status: 'not_working' | 'working' | 'on_break';
  last_punch?: {
    punch_type: PunchType;
    punched_at: string;
  };
}

// --- UI用 ---
export interface SelectOption {
  value: string;
  label: string;
}

export const PUNCH_TYPE_LABELS: Record<PunchType, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: '正社員',
  part_time: 'パート',
  contractor: '業務委託',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: '出勤',
  absent: '欠勤',
  holiday: '休日',
  paid_leave: '有給',
  pending: '未確定',
};
