'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Download, Settings, CalendarPlus, Check, X, Printer, ArrowUp, ArrowDown } from 'lucide-react';
import type { Store, Staff, ShiftTemplate, Shift, Policy } from '@/types';
import { toLocalDateStr } from '@/lib/utils';
import { EMPLOYMENT_TYPE_LABELS } from '@/types';
import * as XLSX from 'xlsx';
import { useUserRole } from '@/hooks/useUserRole';
import {
  getPendingLeaveRequests,
  getRecentLeaveRequests,
  getMyLeaveRequests,
  getMyStaffId,
  submitLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from './leave-actions';
import type { LeaveRequestWithStaff } from './leave-actions';
import { getStoresForCurrentUser } from '@/lib/actions/stores';
import { getShiftEditPermission, saveShiftAssignment } from './actions';

type ShiftMap = Record<string, Record<string, Shift | undefined>>;
type StaffSortMode = 'display_order' | 'name' | 'hours_desc' | 'hours_asc';
type LeaveTypeKey = 'full' | 'half' | 'hourly';

export default function ShiftsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [shifts, setShifts] = useState<ShiftMap>({});
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ staffId: string; date: string } | null>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    code: '', name: '', short_label: '', color: '#3B82F6',
    start_time: '', end_time: '', break_minutes: '0', working_hours: '0',
    is_paid_leave: false,
  });
  const supabase = createClient();
  const role = useUserRole();
  const isAdmin = role !== 'staff';
  const [canEditShifts, setCanEditShifts] = useState(false);
  const canManageShifts = isAdmin || canEditShifts;

  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<LeaveRequestWithStaff[]>([]);
  const [recentLeaveRequests, setRecentLeaveRequests] = useState<LeaveRequestWithStaff[]>([]);
  const [myLeaveRequests, setMyLeaveRequests] = useState<LeaveRequestWithStaff[]>([]);
  const [historyFilterStaff, setHistoryFilterStaff] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('');
  const [myStaffId, setMyStaffId] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    request_date: '',
    leave_type: 'full' as 'full' | 'half' | 'hourly',
    requested_hours: '1',
    reason: '',
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [staffSortMode, setStaffSortMode] = useState<StaffSortMode>('display_order');
  const [orderSaving, setOrderSaving] = useState(false);

  const shiftStartDay = policy?.shift_start_day || 1;

  const dateRange = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(year, month - 1, shiftStartDay);
    const end = new Date(year, month, shiftStartDay - 1);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }, [year, month, shiftStartDay]);

  const fetchStores = useCallback(async () => {
    const data = await getStoresForCurrentUser();
    setStores(data);
    if (data.length > 0) {
      setSelectedStore((prev) => {
        if (prev && data.some((s) => s.id === prev)) return prev;
        return data[0].id;
      });
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);

    const startDate = dateRange[0] ? toLocalDateStr(dateRange[0]) : '';
    const endDate = dateRange[dateRange.length - 1] ? toLocalDateStr(dateRange[dateRange.length - 1]) : '';

    const [staffRes, templateRes, shiftRes, policyRes] = await Promise.all([
      supabase.from('staff').select('*').eq('store_id', selectedStore).eq('status', 'active').order('display_order').order('name'),
      supabase.from('shift_templates').select('*').eq('store_id', selectedStore).eq('is_active', true).order('display_order'),
      supabase.from('shifts').select('*, shift_template:shift_templates(*)').eq('store_id', selectedStore).gte('work_date', startDate).lte('work_date', endDate),
      supabase.from('policies').select('*').eq('store_id', selectedStore).eq('is_active', true).order('effective_from', { ascending: false }).limit(1).single(),
    ]);

    setStaffList(staffRes.data || []);
    setTemplates(templateRes.data || []);
    setPolicy(policyRes.data);

    const shiftMap: ShiftMap = {};
    (shiftRes.data || []).forEach((s: Shift) => {
      if (!shiftMap[s.staff_id]) shiftMap[s.staff_id] = {};
      shiftMap[s.staff_id][s.work_date] = s;
    });
    setShifts(shiftMap);
    setLoading(false);
  }, [selectedStore, dateRange]);

  useEffect(() => { fetchStores(); }, []);
  useEffect(() => { if (selectedStore) fetchData(); }, [selectedStore, year, month, fetchData]);

  useEffect(() => {
    if (selectedStore && isAdmin) {
      Promise.all([getPendingLeaveRequests(selectedStore), getRecentLeaveRequests(selectedStore)]).then(([pending, recent]) => {
        if (pending.ok) setPendingLeaveRequests(pending.requests);
        if (recent.ok) setRecentLeaveRequests(recent.requests);
      });
    } else {
      setPendingLeaveRequests([]);
      setRecentLeaveRequests([]);
    }
  }, [selectedStore, isAdmin, fetchData]);

  useEffect(() => {
    if (!isAdmin) {
      getMyStaffId().then((id) => {
        setMyStaffId(id);
        if (id) {
          getMyLeaveRequests(id).then((r) => r.ok && setMyLeaveRequests(r.requests));
        }
      });
    }
  }, [isAdmin]);

  useEffect(() => {
    if (role === null) return;
    getShiftEditPermission().then((res) => {
      if (res.ok) {
        setCanEditShifts(res.canEditShifts);
      } else {
        setCanEditShifts(false);
      }
    });
  }, [role]);

  const handleSubmitLeave = async () => {
    if (!myStaffId || !selectedStore || !leaveForm.request_date) return;
    setLeaveError('');
    setLeaveSubmitting(true);
    const res = await submitLeaveRequest(
      myStaffId,
      selectedStore,
      leaveForm.request_date,
      leaveForm.leave_type,
      leaveForm.leave_type === 'hourly' ? parseFloat(leaveForm.requested_hours) : undefined,
      leaveForm.reason || undefined
    );
    setLeaveSubmitting(false);
    if (res.ok) {
      setLeaveModalOpen(false);
      setLeaveForm({ request_date: '', leave_type: 'full', requested_hours: '1', reason: '' });
      fetchData();
    } else {
      setLeaveError(res.error);
    }
  };

  const handleApproveLeave = async (requestId: string) => {
    if (!selectedStore) return;
    const res = await approveLeaveRequest(requestId, selectedStore);
    if (res.ok) {
      setPendingLeaveRequests((prev) => prev.filter((r) => r.id !== requestId));
      fetchData();
    }
  };

  const handleRejectLeave = async (requestId: string) => {
    const res = await rejectLeaveRequest(requestId);
    if (res.ok) setPendingLeaveRequests((prev) => prev.filter((r) => r.id !== requestId));
  };

  const handleCellClick = (staffId: string, date: string) => {
    if (!canManageShifts) return;
    setSelectedCell({ staffId, date });
  };

  const assignShift = async (templateId: string | null) => {
    if (!selectedCell || !selectedStore) return;
    const { staffId, date } = selectedCell;
    const res = await saveShiftAssignment({
      staffId,
      storeId: selectedStore,
      workDate: date,
      templateId,
    });

    if (!res.ok) {
      alert(res.error);
      return;
    }

    setSelectedCell(null);
    fetchData();
  };

  const prevMonth = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else { setMonth(month - 1); } };
  const nextMonth = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else { setMonth(month + 1); } };

  const getDayClass = (date: Date) => {
    const dow = date.getDay();
    if (dow === 0) return 'text-red-500 bg-red-50';
    if (dow === 6) return 'text-blue-500 bg-blue-50';
    return '';
  };

  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
  const normalize = (v?: string | null) => (v || '').toLowerCase();
  const formatDateTime = (v?: string | null) => {
    if (!v) return '-';
    return new Date(v).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const sortByDisplayOrder = useCallback((a: Staff, b: Staff) => {
    const byOrder = (a.display_order ?? 0) - (b.display_order ?? 0);
    if (byOrder !== 0) return byOrder;
    return a.name.localeCompare(b.name, 'ja');
  }, []);

  const getStaffSummary = (staffId: string) => {
    let totalHours = 0;
    let totalDays = 0;
    let paidLeave = 0;
    dateRange.forEach((d) => {
      const dateStr = toLocalDateStr(d);
      const shift = shifts[staffId]?.[dateStr];
      if (shift?.shift_template) {
        if (shift.shift_template.is_paid_leave) {
          paidLeave++;
        } else if (!shift.shift_template.is_absent) {
          totalDays++;
          totalHours += shift.shift_template.working_hours;
        }
      }
    });
    return { totalHours, totalDays, paidLeave };
  };

  const leaveLinkedTemplates = useMemo(() => {
    const paid = templates.filter((t) => t.is_paid_leave);
    const full =
      paid.find((t) => normalize(t.code) === 'paid_leave') ??
      paid.find((t) => normalize(t.name).includes('有給') && !normalize(t.name).includes('半')) ??
      paid[0];
    const half =
      paid.find((t) => normalize(t.code) === 'half_paid' || normalize(t.code) === 'h.rest') ??
      paid.find((t) => normalize(t.name).includes('半日') || normalize(t.short_label).includes('半休'));
    const hourly =
      paid.find((t) => normalize(t.code) === 'hourly_paid') ??
      paid.find((t) => normalize(t.name).includes('時間') || normalize(t.short_label).includes('時間'));
    return { full, half, hourly };
  }, [templates]);

  const getLeaveTypeText = (type: LeaveTypeKey) => {
    if (type === 'hourly') return `時間（選択値を反映: ${leaveForm.requested_hours}時間）`;
    const tmpl = leaveLinkedTemplates[type];
    if (!tmpl) return type === 'full' ? '1日（未設定）' : '半日（未設定）';
    return `${type === 'full' ? '1日' : '半日'}（${tmpl.working_hours}時間 / ${tmpl.short_label}）`;
  };

  const sortStaffGroup = useCallback(
    (group: Staff[]) => {
      const sorted = [...group];
      if (staffSortMode === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
      } else if (staffSortMode === 'hours_desc') {
        sorted.sort((a, b) => getStaffSummary(b.id).totalHours - getStaffSummary(a.id).totalHours);
      } else if (staffSortMode === 'hours_asc') {
        sorted.sort((a, b) => getStaffSummary(a.id).totalHours - getStaffSummary(b.id).totalHours);
      } else {
        sorted.sort(sortByDisplayOrder);
      }
      return sorted;
    },
    [staffSortMode, shifts, dateRange, sortByDisplayOrder]
  );

  // グループ分け（正社員 / パート / 業務委託）
  const fullTimeStaff = sortStaffGroup(staffList.filter((s) => s.employment_type === 'full_time'));
  const partTimeStaff = sortStaffGroup(staffList.filter((s) => s.employment_type === 'part_time'));
  const contractorStaff = sortStaffGroup(staffList.filter((s) => s.employment_type === 'contractor'));
  const sortedStaffList = sortStaffGroup(staffList);
  // A4横の印刷領域を人数で均等割りして、下の空白を減らす
  const printRowHeightMm = useMemo(() => {
    const printableHeightMm = 194; // 210mm - top 10mm - bottom 6mm
    const headerBlockMm = 38; // タイトル帯 + テーブルヘッダー + バッファ
    const rows = Math.max(1, sortedStaffList.length);
    const candidate = (printableHeightMm - headerBlockMm) / rows;
    return Math.max(4.8, Number(candidate.toFixed(2)));
  }, [sortedStaffList.length]);
  const manualOrderedStaff = useMemo(() => [...staffList].sort(sortByDisplayOrder), [staffList, sortByDisplayOrder]);
  const manualOrderIndexMap = useMemo(
    () => new Map(manualOrderedStaff.map((staff, index) => [staff.id, index])),
    [manualOrderedStaff]
  );

  // テンプレート管理
  const openTemplateCreate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      code: '', name: '', short_label: '', color: '#3B82F6',
      start_time: '', end_time: '', break_minutes: '0', working_hours: '0',
      is_paid_leave: false,
    });
    setTemplateModalOpen(true);
  };

  const openTemplateEdit = (t: ShiftTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      code: t.code, name: t.name, short_label: t.short_label, color: t.color,
      start_time: t.start_time || '', end_time: t.end_time || '',
      break_minutes: t.break_minutes.toString(), working_hours: t.working_hours.toString(),
      is_paid_leave: t.is_paid_leave,
    });
    setTemplateModalOpen(true);
  };

  const saveTemplate = async () => {
    const payload = {
      store_id: selectedStore,
      code: templateForm.code,
      name: templateForm.name,
      short_label: templateForm.short_label,
      color: templateForm.color,
      start_time: templateForm.start_time || null,
      end_time: templateForm.end_time || null,
      break_minutes: parseInt(templateForm.break_minutes) || 0,
      working_hours: parseFloat(templateForm.working_hours) || 0,
      is_paid_leave: templateForm.is_paid_leave,
    };
    if (editingTemplate) {
      await supabase.from('shift_templates').update(payload).eq('id', editingTemplate.id);
    } else {
      await supabase.from('shift_templates').insert(payload);
    }
    setTemplateModalOpen(false);
    fetchData();
  };

  // Excel出力
  const exportShiftExcel = () => {
    const wb = XLSX.utils.book_new();
    const storeName = stores.find((s) => s.id === selectedStore)?.name || '';

    const renderGroup = (groupName: string, staffGroup: Staff[]) => {
      if (staffGroup.length === 0) return [];
      const rows: (string | number)[][] = [];

      staffGroup.forEach((staff, idx) => {
        const summary = getStaffSummary(staff.id);
        // 上段：名前 + 出勤時間
        const upperRow: (string | number)[] = [
          idx === 0 ? groupName : '',
          staff.name,
        ];
        // 下段：空 + シフト区分
        const lowerRow: (string | number)[] = ['', ''];

        dateRange.forEach((d) => {
          const dateStr = toLocalDateStr(d);
          const shift = shifts[staff.id]?.[dateStr];
          const tmpl = shift?.shift_template;
          upperRow.push(tmpl?.start_time ? tmpl.start_time.substring(0, 5) : '');
          if (tmpl?.is_paid_leave && shift?.note?.includes('時間有給')) {
            lowerRow.push(shift.note);
          } else {
            lowerRow.push(tmpl?.short_label || '');
          }
        });

        // 集計列
        upperRow.push(summary.totalHours);
        upperRow.push(summary.totalDays);
        upperRow.push(summary.paidLeave);
        lowerRow.push('', '', '');

        rows.push(upperRow);
        rows.push(lowerRow);
      });

      return rows;
    };

    // ヘッダー行
    const headerRow1: (string | number)[] = ['', '', ...dateRange.map((d) => d.getDate())];
    headerRow1.push('予定時間', '出勤日数', '有給');
    const headerRow2: (string | number)[] = ['', '', ...dateRange.map((d) => dayLabels[d.getDay()])];
    headerRow2.push('', '', '');

    const allRows = [
      [`${storeName}  ${year}年${month}月シフト表（${shiftStartDay}日始まり）`],
      headerRow1,
      headerRow2,
      ...renderGroup('正社員', fullTimeStaff),
      [''],
      ...renderGroup('パート', partTimeStaff),
      [''],
      ...renderGroup('業務委託', contractorStaff),
    ];

    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // 列幅設定
    const cols = [{ wch: 8 }, { wch: 10 }];
    dateRange.forEach(() => cols.push({ wch: 5 }));
    cols.push({ wch: 10 }, { wch: 8 }, { wch: 6 });
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, 'シフト表');
    XLSX.writeFile(wb, `シフト表_${storeName}_${year}年${month}月.xlsx`);
  };

  const printShiftTable = () => {
    window.print();
  };

  const moveStaffOrder = async (staffId: string, direction: 'up' | 'down') => {
    if (!isAdmin || !selectedStore) return;

    // 任意順は display_order ベースで保存する
    if (staffSortMode !== 'display_order') {
      setStaffSortMode('display_order');
    }

    const ordered = [...staffList].sort(sortByDisplayOrder);
    const currentIndex = ordered.findIndex((s) => s.id === staffId);
    if (currentIndex < 0) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= ordered.length) return;

    [ordered[currentIndex], ordered[targetIndex]] = [ordered[targetIndex], ordered[currentIndex]];
    const normalized = ordered.map((staff, index) => ({ ...staff, display_order: index + 1 }));
    setStaffList(normalized);
    setOrderSaving(true);

    try {
      const results = await Promise.all(
        normalized.map((staff, index) =>
          supabase
            .from('staff')
            .update({ display_order: index + 1 })
            .eq('id', staff.id)
            .eq('store_id', selectedStore)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        alert(`並び順の保存に失敗しました: ${failed.error.message}`);
        fetchData();
      }
    } finally {
      setOrderSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            {shiftStartDay}日始まり｜
            {canManageShifts ? 'セルをクリックしてシフトを割り当て' : '閲覧のみ（編集権限があるスタッフのみ編集可）'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-40"
          />
          <Select
            options={[
              { value: 'display_order', label: '並べ替え: 任意順(手動)' },
              { value: 'name', label: '並べ替え: 名前順' },
              { value: 'hours_desc', label: '並べ替え: 勤務時間(多い順)' },
              { value: 'hours_asc', label: '並べ替え: 勤務時間(少ない順)' },
            ]}
            value={staffSortMode}
            onChange={(e) => setStaffSortMode(e.target.value as StaffSortMode)}
            className="w-48"
          />
          {isAdmin && staffSortMode === 'display_order' && (
            <span className="text-xs text-gray-500">
              名前の右の↑↓で任意順を保存できます{orderSaving ? '（保存中...）' : ''}
            </span>
          )}
          {!myStaffId && !isAdmin && (
            <span className="text-xs text-amber-600">有給申請するにはユーザー管理でスタッフを紐づけてください</span>
          )}
          {myStaffId && (
            <Button variant="outline" size="sm" onClick={() => setLeaveModalOpen(true)}>
              <CalendarPlus className="mr-1 h-4 w-4" />
              有給を申請
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={printShiftTable}>
            <Printer className="mr-1 h-4 w-4" />
            印刷
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={openTemplateCreate}>
                <Settings className="mr-1 h-4 w-4" />
                区分
              </Button>
              <Button variant="outline" size="sm" onClick={exportShiftExcel}>
                <Download className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 有給申請通知（管理者のみ） */}
      {isAdmin && pendingLeaveRequests.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 print:hidden">
          <h3 className="font-semibold text-amber-800">有給申請が{pendingLeaveRequests.length}件あります</h3>
          <div className="mt-2 space-y-2">
            {pendingLeaveRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded bg-white px-3 py-2 text-sm">
                <span>
                  {(req.staff as { name?: string })?.name || 'スタッフ'} - {req.request_date}（
                  {req.leave_type === 'full' ? '1日' : req.leave_type === 'half' ? '半日' : `${req.requested_hours ?? 0}時間`}）
                  <span className="ml-2 text-gray-500">申請: {formatDateTime(req.requested_at)}</span>
                  {req.reason && <span className="ml-2 text-gray-500">理由: {req.reason}</span>}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleApproveLeave(req.id)}>
                    <Check className="mr-1 h-3 w-3" />
                    承認
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => handleRejectLeave(req.id)}>
                    <X className="mr-1 h-3 w-3" />
                    却下
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 有給申請履歴（管理者向け） */}
      {isAdmin && (() => {
        const staffNames = Array.from(new Set(
          recentLeaveRequests.map((r) => (r.staff as { name?: string })?.name).filter(Boolean)
        )) as string[];

        const filtered = recentLeaveRequests.filter((req) => {
          const name = (req.staff as { name?: string })?.name || '';
          if (historyFilterStaff && name !== historyFilterStaff) return false;
          if (historyFilterStatus && req.status !== historyFilterStatus) return false;
          return true;
        });

        return (
          <Card className="mb-4 print:hidden">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-semibold text-gray-900">有給申請履歴</h3>
                <select
                  value={historyFilterStaff}
                  onChange={(e) => setHistoryFilterStaff(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                >
                  <option value="">全スタッフ</option>
                  {staffNames.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <select
                  value={historyFilterStatus}
                  onChange={(e) => setHistoryFilterStatus(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                >
                  <option value="">全状態</option>
                  <option value="pending">承認待ち</option>
                  <option value="approved">承認済み</option>
                  <option value="rejected">却下</option>
                </select>
                <span className="text-xs text-gray-400">{filtered.length}件</span>
              </div>
            </CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-sm text-gray-500">該当する履歴はありません</p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">申請日時</th>
                        <th className="px-3 py-2 font-medium">スタッフ</th>
                        <th className="px-3 py-2 font-medium">希望日</th>
                        <th className="px-3 py-2 font-medium">種別</th>
                        <th className="px-3 py-2 font-medium">状態</th>
                        <th className="px-3 py-2 font-medium">承認日時</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((req) => (
                        <tr key={req.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{formatDateTime(req.requested_at)}</td>
                          <td className="px-3 py-2 text-gray-900">{(req.staff as { name?: string })?.name || 'スタッフ'}</td>
                          <td className="px-3 py-2 text-gray-700">{req.request_date}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {req.leave_type === 'full' ? '1日' : req.leave_type === 'half' ? '半日' : `${req.requested_hours ?? 0}時間`}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                req.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : req.status === 'rejected'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {req.status === 'approved' ? '承認済み' : req.status === 'rejected' ? '却下' : '承認待ち'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{formatDateTime(req.decided_at || null)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* 自分の有給申請履歴（スタッフ本人向け） */}
      {!isAdmin && myStaffId && (
        <Card className="mb-4 print:hidden">
          <CardHeader>
            <h3 className="text-base font-semibold text-gray-900">あなたの有給申請履歴</h3>
          </CardHeader>
          <CardContent>
            {myLeaveRequests.length === 0 ? (
              <p className="text-sm text-gray-500">申請履歴はまだありません</p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">申請日時</th>
                      <th className="px-3 py-2 font-medium">希望日</th>
                      <th className="px-3 py-2 font-medium">種別</th>
                      <th className="px-3 py-2 font-medium">状態</th>
                      <th className="px-3 py-2 font-medium">承認日時</th>
                      <th className="px-3 py-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {myLeaveRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{formatDateTime(req.requested_at)}</td>
                        <td className="px-3 py-2 text-gray-700">{req.request_date}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {req.leave_type === 'full' ? '1日' : req.leave_type === 'half' ? '半日' : `${req.requested_hours ?? 0}時間`}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs ${
                              req.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {req.status === 'approved' ? '承認済み' : req.status === 'rejected' ? '却下' : '承認待ち'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{formatDateTime(req.decided_at || null)}</td>
                        <td className="px-3 py-1">
                          {req.status === 'pending' && (
                            <button
                              onClick={async () => {
                                if (!confirm('この申請を取り消しますか？')) return;
                                const res = await cancelLeaveRequest(req.id);
                                if (res.ok) {
                                  setMyLeaveRequests((prev) => prev.filter((r) => r.id !== req.id));
                                } else {
                                  alert(res.error);
                                }
                              }}
                              className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                            >
                              取り消し
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 月ナビ */}
      <div className="mb-4 flex items-center justify-center gap-4 print:hidden">
        <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
        <h2 className="text-lg font-bold text-gray-900">{year}年{month}月</h2>
        <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {/* シフト区分凡例（管理者のみ編集可能） */}
      <div className="mb-4 flex flex-wrap gap-2 print:hidden">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => isAdmin && openTemplateEdit(t)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border hover:shadow-sm transition-shadow"
            style={{ borderColor: t.color, color: t.color }}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.short_label}（{t.name}
            {t.start_time && `  ${t.start_time.substring(0, 5)}-${t.end_time?.substring(0, 5)}`}
            {t.working_hours > 0 && `  ${t.working_hours}h`}）
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={openTemplateCreate}
            className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
          >
            + 追加
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">読み込み中...</div>
      ) : (
        <div
          className="shift-print-area overflow-x-auto rounded-xl border border-gray-200 bg-white print:overflow-visible print:rounded-none print:border-0"
          style={
            {
              ['--shift-print-staff-rows' as string]: String(Math.max(1, sortedStaffList.length)),
              ['--shift-print-row-height-mm' as string]: `${printRowHeightMm}mm`,
            } as CSSProperties
          }
        >
          <div className="hidden print:block shift-print-banner">
            <div className="mb-3 rounded-lg border border-gray-300 bg-gradient-to-r from-slate-50 to-white px-4 py-3 print:mb-1.5 print:py-2">
              <div className="text-center text-lg font-semibold tracking-wide text-gray-900 print:text-base">
                {stores.find((s) => s.id === selectedStore)?.name || ''} シフト表
              </div>
              <div className="text-center text-sm text-gray-600 print:text-xs">
                {year}年{month}月（{shiftStartDay}日始まり）
              </div>
            </div>
          </div>
          <table className="w-full text-xs print:table-fixed print:text-[8px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-2 py-2 text-left font-medium text-gray-500 min-w-[60px] print:min-w-[34px] print:px-1 print:py-1">区分</th>
                <th className="sticky left-[60px] z-10 bg-gray-50 px-2 py-2 text-left font-medium text-gray-500 min-w-[80px] print:min-w-[54px] print:px-1 print:py-1">名前</th>
                {dateRange.map((d) => (
                  <th key={d.toISOString()} className={`px-1 py-2 text-center font-medium min-w-[36px] print:min-w-[18px] print:px-0.5 print:py-1 ${getDayClass(d)}`}>
                    <div>{d.getDate()}</div>
                    <div className="text-[10px] print:text-[8px]">{dayLabels[d.getDay()]}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium text-gray-500 min-w-[50px] print:min-w-[24px] print:px-1 print:py-1">時間</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 min-w-[40px] print:min-w-[24px] print:px-1 print:py-1">日数</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 min-w-[40px] print:min-w-[24px] print:px-1 print:py-1">有給</th>
              </tr>
            </thead>
            <tbody>
              {sortedStaffList.map((staff) => {
                const summary = getStaffSummary(staff.id);
                return (
                  <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-gray-400 text-[10px] print:text-[8px] print:px-1 print:py-0.5">
                      {EMPLOYMENT_TYPE_LABELS[staff.employment_type]}
                    </td>
                    <td className="sticky left-[60px] z-10 bg-white px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap print:px-1 print:py-1">
                      <div className="flex items-center justify-between gap-2">
                        <span>{staff.name}</span>
                        {isAdmin && staffSortMode === 'display_order' && (
                          <span className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveStaffOrder(staff.id, 'up');
                              }}
                              disabled={orderSaving || (manualOrderIndexMap.get(staff.id) ?? 0) === 0}
                              className="rounded border border-gray-200 p-0.5 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
                              title="上へ"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveStaffOrder(staff.id, 'down');
                              }}
                              disabled={
                                orderSaving ||
                                (manualOrderIndexMap.get(staff.id) ?? 0) === manualOrderedStaff.length - 1
                              }
                              className="rounded border border-gray-200 p-0.5 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 print:hidden"
                              title="下へ"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </td>
                    {dateRange.map((d) => {
                      const dateStr = toLocalDateStr(d);
                      const shift = shifts[staff.id]?.[dateStr];
                      const tmpl = shift?.shift_template;
                      const isSelected = selectedCell?.staffId === staff.id && selectedCell?.date === dateStr;
                      return (
                        <td
                          key={dateStr}
                          onClick={() => canManageShifts && handleCellClick(staff.id, dateStr)}
                          className={`px-0.5 py-1 text-center transition-colors border-l border-gray-50 print:px-0.5 print:py-1 ${
                            getDayClass(d)
                          } ${canManageShifts ? 'cursor-pointer' : 'cursor-default'} ${
                            isSelected ? 'ring-2 ring-blue-500 ring-inset' : canManageShifts ? 'hover:bg-blue-50' : ''
                          }`}
                        >
                          {tmpl ? (
                            <span
                              className="inline-block rounded px-1 py-0.5 text-[10px] font-bold leading-tight print:px-0.5 print:py-0 print:text-[8px] print:leading-tight"
                              style={{ backgroundColor: tmpl.color + '20', color: tmpl.color }}
                            >
                              {tmpl.short_label}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center font-medium text-gray-700 print:px-1 print:py-1">{summary.totalHours}h</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 print:px-1 print:py-1">{summary.totalDays}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500 print:px-1 print:py-1">{summary.paidLeave}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* シフト割当ポップオーバー */}
      {selectedCell && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xl">
            <span className="mr-2 text-sm font-medium text-gray-700">
              {staffList.find((s) => s.id === selectedCell.staffId)?.name} - {selectedCell.date}
            </span>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => assignShift(t.id)}
                className="rounded-lg px-3 py-2 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: t.color + '20', color: t.color, border: `1px solid ${t.color}` }}
              >
                {t.short_label}
              </button>
            ))}
            <button
              onClick={() => assignShift(null)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              休み
            </button>
            <button
              onClick={() => setSelectedCell(null)}
              className="ml-2 rounded-lg px-2 py-2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* テンプレート編集モーダル */}
      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title={editingTemplate ? 'シフト区分を編集' : 'シフト区分を追加'}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Input label="コード" value={templateForm.code} onChange={(e) => setTemplateForm({ ...templateForm, code: e.target.value })} placeholder="am" />
            <Input label="名称" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="午前" />
            <Input label="ラベル" value={templateForm.short_label} onChange={(e) => setTemplateForm({ ...templateForm, short_label: e.target.value })} placeholder="AM" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="開始時刻" type="time" value={templateForm.start_time} onChange={(e) => setTemplateForm({ ...templateForm, start_time: e.target.value })} />
            <Input label="終了時刻" type="time" value={templateForm.end_time} onChange={(e) => setTemplateForm({ ...templateForm, end_time: e.target.value })} />
            <Input label="休憩（分）" type="number" value={templateForm.break_minutes} onChange={(e) => setTemplateForm({ ...templateForm, break_minutes: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="勤務時間(h)" type="number" step="0.5" value={templateForm.working_hours} onChange={(e) => setTemplateForm({ ...templateForm, working_hours: e.target.value })} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">色</label>
              <input type="color" value={templateForm.color} onChange={(e) => setTemplateForm({ ...templateForm, color: e.target.value })} className="h-10 w-full rounded cursor-pointer" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={templateForm.is_paid_leave} onChange={(e) => setTemplateForm({ ...templateForm, is_paid_leave: e.target.checked })} className="rounded" />
            有給休暇
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setTemplateModalOpen(false)}>キャンセル</Button>
            <Button onClick={saveTemplate} disabled={!templateForm.code || !templateForm.name || !templateForm.short_label}>
              {editingTemplate ? '更新' : '追加'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 有給申請モーダル（スタッフ用） */}
      <Modal open={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} title="有給を申請">
        <div className="space-y-4">
          <Input
            label="希望日"
            type="date"
            value={leaveForm.request_date}
            onChange={(e) => setLeaveForm({ ...leaveForm, request_date: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">種別</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="leave_type"
                  checked={leaveForm.leave_type === 'full'}
                  onChange={() => setLeaveForm({ ...leaveForm, leave_type: 'full' })}
                  className="rounded"
                />
                {getLeaveTypeText('full')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="leave_type"
                  checked={leaveForm.leave_type === 'half'}
                  onChange={() => setLeaveForm({ ...leaveForm, leave_type: 'half' })}
                  className="rounded"
                />
                {getLeaveTypeText('half')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="leave_type"
                  checked={leaveForm.leave_type === 'hourly'}
                  onChange={() => setLeaveForm({ ...leaveForm, leave_type: 'hourly' })}
                  className="rounded"
                />
                {getLeaveTypeText('hourly')}
              </label>
            </div>
            {leaveForm.leave_type !== 'hourly' && !leaveLinkedTemplates[leaveForm.leave_type] && (
              <p className="mt-2 text-xs text-amber-600">
                この種別に対応する有給シフト区分が未設定です。`区分` から登録してください。
              </p>
            )}
          </div>
          {leaveForm.leave_type === 'hourly' && (
            <Select
              label="時間（0.5時間単位）"
              options={[
                { value: '0.5', label: '0.5時間' },
                { value: '1', label: '1時間' },
                { value: '1.5', label: '1.5時間' },
                { value: '2', label: '2時間' },
                { value: '2.5', label: '2.5時間' },
                { value: '3', label: '3時間' },
                { value: '3.5', label: '3.5時間' },
                { value: '4', label: '4時間' },
                { value: '4.5', label: '4.5時間' },
                { value: '5', label: '5時間' },
                { value: '5.5', label: '5.5時間' },
                { value: '6', label: '6時間' },
                { value: '6.5', label: '6.5時間' },
                { value: '7', label: '7時間' },
                { value: '7.5', label: '7.5時間' },
                { value: '8', label: '8時間' },
              ]}
              value={leaveForm.requested_hours}
              onChange={(e) => setLeaveForm({ ...leaveForm, requested_hours: e.target.value })}
            />
          )}
          <Input
            label="理由（任意）"
            value={leaveForm.reason}
            onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
            placeholder="例: 私用"
          />
          {leaveError && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{leaveError}</div>}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>キャンセル</Button>
            <Button onClick={handleSubmitLeave} loading={leaveSubmitting} disabled={!leaveForm.request_date}>
              申請する
            </Button>
          </div>
        </div>
      </Modal>
      {/* タブレット向けフローティング印刷ボタン */}
      <button
        onClick={printShiftTable}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-lg transition-all hover:bg-[var(--accent-hover)] hover:shadow-xl active:scale-95 sm:hidden md:flex lg:hidden print:hidden"
        aria-label="シフトを印刷"
      >
        <Printer className="h-6 w-6" />
      </button>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm 6mm 6mm 6mm;
          }
          body {
            background: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .shift-print-area .sticky {
            position: static !important;
            left: auto !important;
          }
          .shift-print-area {
            overflow: visible !important;
            max-width: 100% !important;
            margin-top: 2mm !important;
          }
          .shift-print-area table {
            width: 100% !important;
            table-layout: fixed !important;
            font-size: 7px !important;
            border-collapse: collapse !important;
          }
          .shift-print-area thead tr {
            height: auto !important;
          }
          .shift-print-area tbody tr {
            height: var(--shift-print-row-height-mm, 6mm) !important;
            max-height: none !important;
            box-sizing: border-box !important;
          }
          .shift-print-area tbody td {
            height: var(--shift-print-row-height-mm, 6mm) !important;
          }
          .shift-print-area th,
          .shift-print-area td {
            padding: 2px 3px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.2 !important;
            vertical-align: middle !important;
          }
        }
      `}</style>
    </div>
  );
}
