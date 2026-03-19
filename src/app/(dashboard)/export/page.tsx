'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertTriangle, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { formatDate, minutesToDecimalHours, toLocalDateStr } from '@/lib/utils';
import type { Store, Staff, DailyAttendance } from '@/types';
import { EMPLOYMENT_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';
import * as XLSX from 'xlsx';

type LeaveRequestExport = {
  id: string;
  staff_id: string;
  store_id: string;
  request_date: string;
  leave_type: 'full' | 'half' | 'hourly';
  requested_hours: number | null;
  status: 'pending' | 'approved' | 'rejected';
  staff?: {
    name: string;
    name_kana: string | null;
    employment_type: Staff['employment_type'];
    hourly_rate: number | null;
  };
  store?: { name: string };
};

type LeaveRequestRaw = Omit<LeaveRequestExport, 'staff' | 'store'> & {
  staff?: LeaveRequestExport['staff'] | LeaveRequestExport['staff'][];
  store?: LeaveRequestExport['store'] | LeaveRequestExport['store'][];
};

type PaidLeaveTemplate = {
  store_id: string;
  code: string;
  working_hours: number;
  display_order: number;
  is_paid_leave: boolean;
};

type PaidLeaveShiftRaw = {
  staff_id: string;
  work_date: string;
  shift_template?: { working_hours: number; is_paid_leave: boolean } | { working_hours: number; is_paid_leave: boolean }[];
};

type MissingPunchIssue = {
  id: string;
  work_date: string;
  staffName: string;
  storeName: string;
  missingFields: string[];
};

export default function ExportPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [exporting, setExporting] = useState(false);
  const [checkingMissing, setCheckingMissing] = useState(false);
  const [missingPunchIssues, setMissingPunchIssues] = useState<MissingPunchIssue[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchStores = async () => {
      const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('name');
      setStores(data || []);
    };
    fetchStores();
  }, []);

  const fetchExportData = async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = toLocalDateStr(new Date(year, month, 0));

    let query = supabase
      .from('daily_attendance')
      .select('*, staff:staff(*), store:stores(*)')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date')
      .order('staff(name)');

    if (selectedStore) {
      query = query.eq('store_id', selectedStore);
    }

    const { data } = await query;
    return (data as (DailyAttendance & { staff: Staff; store: Store })[]) || [];
  };

  const fetchLeaveRequests = async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = toLocalDateStr(new Date(year, month, 0));

    let query = supabase
      .from('leave_requests')
      .select('id, staff_id, store_id, request_date, leave_type, requested_hours, status, staff:staff(name,name_kana,employment_type,hourly_rate), store:stores(name)')
      .gte('request_date', startDate)
      .lte('request_date', endDate)
      .in('status', ['approved', 'pending'])
      .order('request_date')
      .order('staff_id');

    if (selectedStore) {
      query = query.eq('store_id', selectedStore);
    }

    const { data } = await query;
    const normalized = ((data || []) as LeaveRequestRaw[]).map((req) => ({
      ...req,
      staff: Array.isArray(req.staff) ? req.staff[0] : req.staff,
      store: Array.isArray(req.store) ? req.store[0] : req.store,
    }));
    return normalized as LeaveRequestExport[];
  };

  const leaveTypeLabel = (type: LeaveRequestExport['leave_type'], hours: number | null) => {
    if (type === 'full') return '1日';
    if (type === 'half') return '半日';
    return `${hours ?? 0}時間`;
  };

  const getLeaveTemplateCodes = (type: LeaveRequestExport['leave_type']) => {
    if (type === 'full') return ['paid_leave'];
    if (type === 'half') return ['half_paid', 'h.rest'];
    return ['hourly_paid'];
  };

  const getLeaveHours = (
    req: LeaveRequestExport,
    paidLeaveShiftHoursByStaffDate: Map<string, number>,
    templateHoursByStoreCode: Map<string, number>,
    fallbackTemplateHoursByStore: Map<string, number>
  ): number | '' => {
    const approvedShiftHours = paidLeaveShiftHoursByStaffDate.get(`${req.staff_id}_${req.request_date}`);
    if (typeof approvedShiftHours === 'number') return approvedShiftHours;

    if (req.leave_type === 'hourly') return req.requested_hours ?? '';

    const getTemplateHours = (code: string) => templateHoursByStoreCode.get(`${req.store_id}_${code}`);

    const codes = getLeaveTemplateCodes(req.leave_type);
    for (const code of codes) {
      const byCode = getTemplateHours(code);
      if (typeof byCode === 'number') return byCode;
    }

    const fallback = fallbackTemplateHoursByStore.get(req.store_id);
    return typeof fallback === 'number' ? fallback : '';
  };

  const fetchPaidLeaveTemplates = async () => {
    let query = supabase
      .from('shift_templates')
      .select('store_id, code, working_hours, display_order, is_paid_leave')
      .eq('is_active', true)
      .order('store_id')
      .order('display_order');

    if (selectedStore) {
      query = query.eq('store_id', selectedStore);
    }

    const { data } = await query;
    const templates = (data || []) as PaidLeaveTemplate[];
    const templateHoursByStoreCode = new Map<string, number>();
    const fallbackTemplateHoursByStore = new Map<string, number>();

    templates.forEach((tmpl) => {
      templateHoursByStoreCode.set(`${tmpl.store_id}_${tmpl.code}`, Number(tmpl.working_hours) || 0);
      if (tmpl.is_paid_leave && !fallbackTemplateHoursByStore.has(tmpl.store_id)) {
        fallbackTemplateHoursByStore.set(tmpl.store_id, Number(tmpl.working_hours) || 0);
      }
    });

    return { templateHoursByStoreCode, fallbackTemplateHoursByStore };
  };

  const fetchPaidLeaveShiftHours = async () => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = toLocalDateStr(new Date(year, month, 0));

    let query = supabase
      .from('shifts')
      .select('staff_id, work_date, shift_template:shift_templates(working_hours, is_paid_leave)')
      .gte('work_date', startDate)
      .lte('work_date', endDate);

    if (selectedStore) {
      query = query.eq('store_id', selectedStore);
    }

    const { data } = await query;
    const map = new Map<string, number>();
    const rows = (data || []) as PaidLeaveShiftRaw[];

    rows.forEach((row) => {
      const tmpl = Array.isArray(row.shift_template) ? row.shift_template[0] : row.shift_template;
      if (!tmpl?.is_paid_leave) return;
      map.set(`${row.staff_id}_${row.work_date}`, Number(tmpl.working_hours) || 0);
    });

    return map;
  };

  const validateMissingPunches = (records: (DailyAttendance & { staff: Staff; store: Store })[]) => {
    const today = toLocalDateStr(new Date());
    const issues: MissingPunchIssue[] = [];

    records.forEach((record) => {
      if (record.status === 'absent' || record.status === 'holiday' || record.status === 'paid_leave') return;

      // 出力締め時点で未完了になりやすい「当日pending」は除外
      const needCheck = record.status === 'present' || (record.status === 'pending' && record.work_date < today);
      if (!needCheck) return;

      const missingFields: string[] = [];
      if (!record.clock_in) missingFields.push('出勤時刻');
      if (!record.clock_out) missingFields.push('退勤時刻');

      if (missingFields.length > 0) {
        issues.push({
          id: record.id,
          work_date: record.work_date,
          staffName: record.staff?.name || '不明スタッフ',
          storeName: record.store?.name || '不明店舗',
          missingFields,
        });
      }
    });

    return issues.sort((a, b) => a.work_date.localeCompare(b.work_date) || a.staffName.localeCompare(b.staffName));
  };

  const runMissingCheck = async () => {
    setCheckingMissing(true);
    try {
      const data = await fetchExportData();
      const issues = validateMissingPunches(data);
      setMissingPunchIssues(issues);
      return { data, issues };
    } finally {
      setCheckingMissing(false);
    }
  };

  useEffect(() => {
    runMissingCheck();
  }, [year, month, selectedStore]);

  const buildExportRows = (
    data: (DailyAttendance & { staff: Staff; store: Store })[],
    leaveRequests: LeaveRequestExport[],
    paidLeaveShiftHoursByStaffDate: Map<string, number>,
    templateHoursByStoreCode: Map<string, number>,
    fallbackTemplateHoursByStore: Map<string, number>
  ) => {
    const leaveMap = new Map<string, LeaveRequestExport>();
    leaveRequests.forEach((req) => leaveMap.set(`${req.staff_id}_${req.request_date}`, req));

    const rows = data.map((record) => {
      const leave = leaveMap.get(`${record.staff_id}_${record.work_date}`);
      const leaveHours = leave
        ? getLeaveHours(leave, paidLeaveShiftHoursByStaffDate, templateHoursByStoreCode, fallbackTemplateHoursByStore)
        : '';
      return {
      日付: record.work_date,
      スタッフ名: record.staff?.name || '',
      フリガナ: record.staff?.name_kana || '',
      店舗: record.store?.name || '',
      雇用形態: record.staff ? EMPLOYMENT_TYPE_LABELS[record.staff.employment_type] : '',
      出勤時刻: record.clock_in
        ? new Date(record.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : '',
      退勤時刻: record.clock_out
        ? new Date(record.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
        : '',
      '休憩（分）': record.break_minutes,
      '実働（分）': record.working_minutes,
      '実働（時間）': minutesToDecimalHours(record.working_minutes),
      '残業（分）': record.overtime_minutes,
      状態: ATTENDANCE_STATUS_LABELS[record.status],
      有給申請: leave ? leaveTypeLabel(leave.leave_type, leave.requested_hours) : '',
      '有給申請時間（h）': leaveHours,
      時給: record.staff?.hourly_rate || '',
      備考: record.note || '',
      申請ステータス: leave?.status === 'pending' ? '承認待ち' : leave ? '承認済み' : '',
    };
    });

    const attendanceKeys = new Set(data.map((record) => `${record.staff_id}_${record.work_date}`));
    const leaveOnlyRows = leaveRequests
      .filter((req) => !attendanceKeys.has(`${req.staff_id}_${req.request_date}`))
      .map((req) => ({
        日付: req.request_date,
        スタッフ名: req.staff?.name || '',
        フリガナ: req.staff?.name_kana || '',
        店舗: req.store?.name || '',
        雇用形態: req.staff ? EMPLOYMENT_TYPE_LABELS[req.staff.employment_type] : '',
        出勤時刻: '',
        退勤時刻: '',
        '休憩（分）': '',
        '実働（分）': '',
        '実働（時間）': '',
        '残業（分）': '',
        状態: '有給申請',
        有給申請: leaveTypeLabel(req.leave_type, req.requested_hours),
        '有給申請時間（h）': getLeaveHours(
          req,
          paidLeaveShiftHoursByStaffDate,
          templateHoursByStoreCode,
          fallbackTemplateHoursByStore
        ),
        時給: req.staff?.hourly_rate || '',
        備考: '',
        申請ステータス: req.status === 'pending' ? '承認待ち' : '承認済み',
      }));

    return [...rows, ...leaveOnlyRows];
  };

  const buildSummaryRows = (
    data: (DailyAttendance & { staff: Staff; store: Store })[],
    leaveRequests: LeaveRequestExport[]
  ) => {
    const staffMap = new Map<
      string,
      {
        name: string;
        store: string;
        employment_type: string;
        hourly_rate: number | null;
        days: number;
        totalWorking: number;
        totalBreak: number;
        totalOvertime: number;
        paidLeaveDays: number;
        paidLeaveHours: number;
      }
    >();

    data.forEach((record) => {
      const key = record.staff_id;
      const existing = staffMap.get(key);
      if (existing) {
        if (record.status === 'present') existing.days++;
        existing.totalWorking += record.working_minutes;
        existing.totalBreak += record.break_minutes;
        existing.totalOvertime += record.overtime_minutes;
      } else {
        staffMap.set(key, {
          name: record.staff?.name || '',
          store: record.store?.name || '',
          employment_type: record.staff ? EMPLOYMENT_TYPE_LABELS[record.staff.employment_type] : '',
          hourly_rate: record.staff?.hourly_rate || null,
          days: record.status === 'present' ? 1 : 0,
          totalWorking: record.working_minutes,
          totalBreak: record.break_minutes,
          totalOvertime: record.overtime_minutes,
          paidLeaveDays: 0,
          paidLeaveHours: 0,
        });
      }
    });

    leaveRequests.forEach((req) => {
      if (!staffMap.has(req.staff_id) && req.staff) {
        staffMap.set(req.staff_id, {
          name: req.staff.name,
          store: req.store?.name || '',
          employment_type: EMPLOYMENT_TYPE_LABELS[req.staff.employment_type],
          hourly_rate: req.staff.hourly_rate || null,
          days: 0,
          totalWorking: 0,
          totalBreak: 0,
          totalOvertime: 0,
          paidLeaveDays: 0,
          paidLeaveHours: 0,
        });
      }
      const existing = staffMap.get(req.staff_id);
      if (!existing) return;
      if (req.leave_type === 'hourly') {
        existing.paidLeaveHours += req.requested_hours || 0;
      } else {
        existing.paidLeaveDays += req.leave_type === 'full' ? 1 : 0.5;
      }
    });

    return Array.from(staffMap.values()).map((s) => ({
      スタッフ名: s.name,
      店舗: s.store,
      雇用形態: s.employment_type,
      出勤日数: s.days,
      '総勤務時間（分）': s.totalWorking,
      '総勤務時間（時間）': minutesToDecimalHours(s.totalWorking),
      '有給（日）': s.paidLeaveDays,
      '有給（時間）': s.paidLeaveHours,
      '総休憩時間（分）': s.totalBreak,
      '総残業時間（分）': s.totalOvertime,
      時給: s.hourly_rate || '',
      概算給与: s.hourly_rate ? Math.round((s.totalWorking / 60) * s.hourly_rate) : '',
    }));
  };

  const buildStaffDetailSheets = (
    data: (DailyAttendance & { staff: Staff; store: Store })[],
    leaveRequests: LeaveRequestExport[],
    paidLeaveShiftHoursByStaffDate: Map<string, number>,
    templateHoursByStoreCode: Map<string, number>,
    fallbackTemplateHoursByStore: Map<string, number>
  ) => {
    const staffMap = new Map<string, { name: string; records: (DailyAttendance & { staff: Staff; store: Store })[] }>();

    data.forEach((record) => {
      const key = record.staff_id;
      const existing = staffMap.get(key);
      if (existing) {
        existing.records.push(record);
      } else {
        staffMap.set(key, {
          name: record.staff?.name || '',
          records: [record],
        });
      }
    });

    return Array.from(staffMap.entries()).map(([staffId, staffData]) => {
      const leaveMap = new Map<string, LeaveRequestExport>();
      leaveRequests
        .filter((req) => req.staff_id === staffId)
        .forEach((req) => leaveMap.set(req.request_date, req));

      const rowsWithDateKey: Array<{
        dateKey: string;
        row: {
          日付: string;
          曜日: string;
          出勤時刻: string;
          退勤時刻: string;
          '休憩（分）': number | string;
          '実働（分）': number | string;
          '実働（時間）': string;
          '残業（分）': number | string;
          状態: string;
          有給申請: string;
          '有給申請時間（h）': number | string;
          備考: string;
        };
      }> = [];

      const attendanceDates = new Set<string>();

      staffData.records.forEach((record) => {
        attendanceDates.add(record.work_date);
        const leaveForDay = leaveMap.get(record.work_date);
        const leaveHours = leaveForDay
          ? getLeaveHours(
              leaveForDay,
              paidLeaveShiftHoursByStaffDate,
              templateHoursByStoreCode,
              fallbackTemplateHoursByStore
            )
          : '';
        rowsWithDateKey.push({
          dateKey: record.work_date,
          row: {
            日付: formatDate(record.work_date, 'MM/dd (E)'),
            曜日: new Date(record.work_date + 'T00:00:00').toLocaleDateString('ja-JP', { weekday: 'short' }),
            出勤時刻: record.clock_in
              ? new Date(record.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              : '',
            退勤時刻: record.clock_out
              ? new Date(record.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
              : '',
            '休憩（分）': record.break_minutes,
            '実働（分）': record.working_minutes,
            '実働（時間）': minutesToDecimalHours(record.working_minutes),
            '残業（分）': record.overtime_minutes,
            状態: ATTENDANCE_STATUS_LABELS[record.status],
            有給申請: leaveForDay ? leaveTypeLabel(leaveForDay.leave_type, leaveForDay.requested_hours) : '',
            '有給申請時間（h）': leaveHours,
            備考: record.note || '',
          },
        });
      });

      leaveRequests
        .filter((req) => req.staff_id === staffId && !attendanceDates.has(req.request_date))
        .forEach((req) => {
          rowsWithDateKey.push({
            dateKey: req.request_date,
            row: {
              日付: formatDate(req.request_date, 'MM/dd (E)'),
              曜日: new Date(req.request_date + 'T00:00:00').toLocaleDateString('ja-JP', { weekday: 'short' }),
              出勤時刻: '',
              退勤時刻: '',
              '休憩（分）': '',
              '実働（分）': '',
              '実働（時間）': '',
              '残業（分）': '',
              状態: '有給申請',
              有給申請: leaveTypeLabel(req.leave_type, req.requested_hours),
              '有給申請時間（h）': getLeaveHours(
                req,
                paidLeaveShiftHoursByStaffDate,
                templateHoursByStoreCode,
                fallbackTemplateHoursByStore
              ),
              備考: req.status === 'pending' ? '承認待ち' : '承認済み',
            },
          });
        });

      rowsWithDateKey.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      const rows = rowsWithDateKey.map((r) => r.row);

      // 合計行を追加
      const totalWorking = staffData.records.reduce((sum, r) => sum + r.working_minutes, 0);
      const totalBreak = staffData.records.reduce((sum, r) => sum + r.break_minutes, 0);
      const totalDays = staffData.records.filter((r) => r.status === 'present').length;
      const totalLeaveDays = leaveRequests
        .filter((req) => req.staff_id === staffId && req.leave_type !== 'hourly')
        .reduce((sum, req) => sum + (req.leave_type === 'full' ? 1 : 0.5), 0);
      const totalLeaveHours = leaveRequests
        .filter((req) => req.staff_id === staffId)
        .reduce((sum, req) => {
          const leaveHours = getLeaveHours(
            req,
            paidLeaveShiftHoursByStaffDate,
            templateHoursByStoreCode,
            fallbackTemplateHoursByStore
          );
          return sum + (typeof leaveHours === 'number' ? leaveHours : 0);
        }, 0);

      rows.push({
        日付: '合計',
        曜日: '',
        出勤時刻: '',
        退勤時刻: '',
        '休憩（分）': totalBreak,
        '実働（分）': totalWorking,
        '実働（時間）': minutesToDecimalHours(totalWorking),
        '残業（分）': staffData.records.reduce((sum, r) => sum + r.overtime_minutes, 0),
        状態: `出勤${totalDays}日`,
        有給申請: totalLeaveDays > 0 ? `${totalLeaveDays}日` : '',
        '有給申請時間（h）': totalLeaveHours > 0 ? totalLeaveHours : '',
        備考: '',
      });

      return {
        sheetName: staffData.name,
        data: rows,
      };
    });
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { data, issues } = await runMissingCheck();
      if (issues.length > 0) {
        alert(`打刻漏れが${issues.length}件あります。修正後に出力してください。`);
        return;
      }
      const leaveRequests = await fetchLeaveRequests();
      const paidLeaveShiftHoursByStaffDate = await fetchPaidLeaveShiftHours();
      const { templateHoursByStoreCode, fallbackTemplateHoursByStore } = await fetchPaidLeaveTemplates();
      const rows = buildExportRows(
        data,
        leaveRequests,
        paidLeaveShiftHoursByStaffDate,
        templateHoursByStoreCode,
        fallbackTemplateHoursByStore
      );
      const summaryRows = buildSummaryRows(data, leaveRequests);
      const staffDetails = buildStaffDetailSheets(
        data,
        leaveRequests,
        paidLeaveShiftHoursByStaffDate,
        templateHoursByStoreCode,
        fallbackTemplateHoursByStore
      );

      const wb = XLSX.utils.book_new();

      // 勤怠一覧シート
      const ws1 = XLSX.utils.json_to_sheet(rows);
      ws1['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 15 }));
      XLSX.utils.book_append_sheet(wb, ws1, '勤怠一覧');

      // スタッフ別集計シート
      const ws2 = XLSX.utils.json_to_sheet(summaryRows);
      ws2['!cols'] = Object.keys(summaryRows[0] || {}).map(() => ({ wch: 18 }));
      XLSX.utils.book_append_sheet(wb, ws2, 'スタッフ別集計');

      // スタッフ別詳細シート（各スタッフ1シートずつ）
      staffDetails.forEach((detail) => {
        const ws = XLSX.utils.json_to_sheet(detail.data);
        ws['!cols'] = [
          { wch: 12 }, // 日付
          { wch: 6 },  // 曜日
          { wch: 10 }, // 出勤時刻
          { wch: 10 }, // 退勤時刻
          { wch: 10 }, // 休憩
          { wch: 10 }, // 実働（分）
          { wch: 12 }, // 実働（時間）
          { wch: 10 }, // 残業
          { wch: 8 },  // 状態
          { wch: 12 }, // 有給申請
          { wch: 12 }, // 有給申請時間
          { wch: 20 }, // 備考
        ];
        // シート名は最大31文字に制限
        const sheetName = detail.sheetName.length > 31 ? detail.sheetName.substring(0, 31) : detail.sheetName;
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      const storeName = selectedStore
        ? stores.find((s) => s.id === selectedStore)?.name || ''
        : '全店舗';
      XLSX.writeFile(wb, `勤怠データ_${storeName}_${year}年${month}月.xlsx`);
    } catch (e) {
      console.error('Export error:', e);
      alert('出力に失敗しました');
    }
    setExporting(false);
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const { data, issues } = await runMissingCheck();
      if (issues.length > 0) {
        alert(`打刻漏れが${issues.length}件あります。修正後に出力してください。`);
        return;
      }
      const leaveRequests = await fetchLeaveRequests();
      const paidLeaveShiftHoursByStaffDate = await fetchPaidLeaveShiftHours();
      const { templateHoursByStoreCode, fallbackTemplateHoursByStore } = await fetchPaidLeaveTemplates();
      const rows = buildExportRows(
        data,
        leaveRequests,
        paidLeaveShiftHoursByStaffDate,
        templateHoursByStoreCode,
        fallbackTemplateHoursByStore
      );

      const headers = Object.keys(rows[0] || {});
      const csvContent =
        '\uFEFF' +
        headers.join(',') +
        '\n' +
        rows.map((row) => headers.map((h) => `"${(row as Record<string, unknown>)[h] ?? ''}"`).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const storeName = selectedStore
        ? stores.find((s) => s.id === selectedStore)?.name || ''
        : '全店舗';
      a.download = `勤怠データ_${storeName}_${year}年${month}月.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export error:', e);
      alert('出力に失敗しました');
    }
    setExporting(false);
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const y = new Date().getFullYear() - 2 + i;
    return { value: y.toString(), label: `${y}年` };
  });

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: (i + 1).toString(),
    label: `${i + 1}月`,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">データ出力</h1>
        <p className="mt-1 text-sm text-gray-500">
          勤怠データをExcel・CSV形式で出力します（社労士提出用）
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">出力条件</h2>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="対象年"
              options={yearOptions}
              value={year.toString()}
              onChange={(e) => setYear(parseInt(e.target.value))}
            />
            <Select
              label="対象月"
              options={monthOptions}
              value={month.toString()}
              onChange={(e) => setMonth(parseInt(e.target.value))}
            />
            <Select
              label="対象店舗"
              options={[{ value: '', label: '全店舗' }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">打刻漏れチェック</h2>
            <Button variant="ghost" size="sm" loading={checkingMissing} onClick={runMissingCheck}>
              再チェック
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {missingPunchIssues.length === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              打刻漏れはありません。このままCSV/Excel出力できます。
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                打刻漏れが{missingPunchIssues.length}件あります。出力前に修正してください。
              </div>
              <div className="max-h-56 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">日付</th>
                      <th className="px-3 py-2 font-medium">スタッフ</th>
                      <th className="px-3 py-2 font-medium">店舗</th>
                      <th className="px-3 py-2 font-medium">未入力項目</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {missingPunchIssues.map((issue) => (
                      <tr key={issue.id}>
                        <td className="px-3 py-2 text-gray-700">{formatDate(issue.work_date, 'yyyy/MM/dd')}</td>
                        <td className="px-3 py-2 text-gray-900">{issue.staffName}</td>
                        <td className="px-3 py-2 text-gray-700">{issue.storeName}</td>
                        <td className="px-3 py-2 text-red-600">{issue.missingFields.join('・')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={exportExcel}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <FileSpreadsheet className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Excel出力</h3>
              <p className="text-sm text-gray-500">勤怠一覧 + スタッフ別集計シート付き</p>
            </div>
            <Button variant="primary" loading={exporting} onClick={exportExcel}>
              <Download className="mr-2 h-4 w-4" />
              出力
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={exportCSV}>
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">CSV出力</h3>
              <p className="text-sm text-gray-500">汎用フォーマット・他システム連携用</p>
            </div>
            <Button variant="primary" loading={exporting} onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />
              出力
            </Button>
          </CardContent>
        </Card>
      </div>

        <div className="mt-6 rounded-lg bg-blue-50 p-4">
        <h3 className="text-sm font-medium text-blue-800">出力内容について</h3>
        <ul className="mt-2 list-disc pl-5 text-sm text-blue-700 space-y-1">
          <li>Excel: 「勤怠一覧」「スタッフ別集計」「各スタッフ詳細」シート</li>
          <li>スタッフ別詳細シートには日別の勤怠と月間合計を表示</li>
          <li>CSV: 日別の勤怠一覧データ</li>
          <li>集計にはスタッフの時給情報がある場合、概算給与も算出されます</li>
        </ul>
      </div>
    </div>
  );
}
