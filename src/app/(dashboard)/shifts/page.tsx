'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Download, Settings } from 'lucide-react';
import type { Store, Staff, ShiftTemplate, Shift, Policy } from '@/types';
import { EMPLOYMENT_TYPE_LABELS } from '@/types';
import * as XLSX from 'xlsx';

type ShiftMap = Record<string, Record<string, Shift | undefined>>;

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
    const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('name');
    setStores(data || []);
    if (data && data.length > 0 && !selectedStore) {
      setSelectedStore(data[0].id);
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedStore) return;
    setLoading(true);

    const startDate = dateRange[0]?.toISOString().split('T')[0];
    const endDate = dateRange[dateRange.length - 1]?.toISOString().split('T')[0];

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

  const handleCellClick = (staffId: string, date: string) => {
    setSelectedCell({ staffId, date });
  };

  const assignShift = async (templateId: string | null) => {
    if (!selectedCell) return;
    const { staffId, date } = selectedCell;

    if (templateId === null) {
      // シフト削除
      const existing = shifts[staffId]?.[date];
      if (existing) {
        await supabase.from('shifts').delete().eq('id', existing.id);
      }
    } else {
      const existing = shifts[staffId]?.[date];
      if (existing) {
        await supabase.from('shifts').update({ shift_template_id: templateId }).eq('id', existing.id);
      } else {
        await supabase.from('shifts').insert({
          staff_id: staffId,
          store_id: selectedStore,
          work_date: date,
          shift_template_id: templateId,
        });
      }
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

  const getStaffSummary = (staffId: string) => {
    let totalHours = 0;
    let totalDays = 0;
    let paidLeave = 0;
    dateRange.forEach((d) => {
      const dateStr = d.toISOString().split('T')[0];
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

  // グループ分け（正社員 / パート / 業務委託）
  const fullTimeStaff = staffList.filter((s) => s.employment_type === 'full_time');
  const partTimeStaff = staffList.filter((s) => s.employment_type === 'part_time');
  const contractorStaff = staffList.filter((s) => s.employment_type === 'contractor');

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
          const dateStr = d.toISOString().split('T')[0];
          const shift = shifts[staff.id]?.[dateStr];
          const tmpl = shift?.shift_template;
          upperRow.push(tmpl?.start_time ? tmpl.start_time.substring(0, 5) : '');
          lowerRow.push(tmpl?.short_label || '');
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

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">シフト管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            {shiftStartDay}日始まり｜セルをクリックしてシフトを割り当て
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={openTemplateCreate}>
            <Settings className="mr-1 h-4 w-4" />
            区分
          </Button>
          <Button variant="outline" size="sm" onClick={exportShiftExcel}>
            <Download className="mr-1 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* 月ナビ */}
      <div className="mb-4 flex items-center justify-center gap-4">
        <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
        <h2 className="text-lg font-bold text-gray-900">{year}年{month}月</h2>
        <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
      </div>

      {/* シフト区分凡例 */}
      <div className="mb-4 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => openTemplateEdit(t)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border hover:shadow-sm transition-shadow"
            style={{ borderColor: t.color, color: t.color }}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.short_label}（{t.name}
            {t.start_time && `  ${t.start_time.substring(0, 5)}-${t.end_time?.substring(0, 5)}`}
            {t.working_hours > 0 && `  ${t.working_hours}h`}）
          </button>
        ))}
        <button
          onClick={openTemplateCreate}
          className="rounded-full border border-dashed border-gray-300 px-3 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
        >
          + 追加
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">読み込み中...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 px-2 py-2 text-left font-medium text-gray-500 min-w-[60px]">区分</th>
                <th className="sticky left-[60px] z-10 bg-gray-50 px-2 py-2 text-left font-medium text-gray-500 min-w-[80px]">名前</th>
                {dateRange.map((d) => (
                  <th key={d.toISOString()} className={`px-1 py-2 text-center font-medium min-w-[36px] ${getDayClass(d)}`}>
                    <div>{d.getDate()}</div>
                    <div className="text-[10px]">{dayLabels[d.getDay()]}</div>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium text-gray-500 min-w-[50px]">時間</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 min-w-[40px]">日数</th>
                <th className="px-2 py-2 text-center font-medium text-gray-500 min-w-[40px]">有給</th>
              </tr>
            </thead>
            <tbody>
              {/* 正社員グループ */}
              {fullTimeStaff.length > 0 && (
                <tr className="border-b border-gray-200 bg-blue-50/50">
                  <td colSpan={dateRange.length + 5} className="px-2 py-1 text-xs font-semibold text-blue-700">
                    正社員
                  </td>
                </tr>
              )}
              {fullTimeStaff.map((staff) => {
                const summary = getStaffSummary(staff.id);
                return (
                  <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-gray-400 text-[10px]">
                      {EMPLOYMENT_TYPE_LABELS[staff.employment_type]}
                    </td>
                    <td className="sticky left-[60px] z-10 bg-white px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                      {staff.name}
                    </td>
                    {dateRange.map((d) => {
                      const dateStr = d.toISOString().split('T')[0];
                      const shift = shifts[staff.id]?.[dateStr];
                      const tmpl = shift?.shift_template;
                      const isSelected = selectedCell?.staffId === staff.id && selectedCell?.date === dateStr;
                      return (
                        <td
                          key={dateStr}
                          onClick={() => handleCellClick(staff.id, dateStr)}
                          className={`px-0.5 py-1 text-center cursor-pointer transition-colors border-l border-gray-50 ${
                            getDayClass(d)
                          } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}
                        >
                          {tmpl ? (
                            <span
                              className="inline-block rounded px-1 py-0.5 text-[10px] font-bold leading-tight"
                              style={{ backgroundColor: tmpl.color + '20', color: tmpl.color }}
                            >
                              {tmpl.short_label}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center font-medium text-gray-700">{summary.totalHours}h</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{summary.totalDays}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{summary.paidLeave}</td>
                  </tr>
                );
              })}

              {/* パートグループ */}
              {partTimeStaff.length > 0 && (
                <tr className="border-b border-gray-200 bg-amber-50/50">
                  <td colSpan={dateRange.length + 5} className="px-2 py-1 text-xs font-semibold text-amber-700">
                    パート
                  </td>
                </tr>
              )}
              {partTimeStaff.map((staff) => {
                const summary = getStaffSummary(staff.id);
                return (
                  <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-gray-400 text-[10px]">
                      {EMPLOYMENT_TYPE_LABELS[staff.employment_type]}
                    </td>
                    <td className="sticky left-[60px] z-10 bg-white px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                      {staff.name}
                    </td>
                    {dateRange.map((d) => {
                      const dateStr = d.toISOString().split('T')[0];
                      const shift = shifts[staff.id]?.[dateStr];
                      const tmpl = shift?.shift_template;
                      const isSelected = selectedCell?.staffId === staff.id && selectedCell?.date === dateStr;
                      return (
                        <td
                          key={dateStr}
                          onClick={() => handleCellClick(staff.id, dateStr)}
                          className={`px-0.5 py-1 text-center cursor-pointer transition-colors border-l border-gray-50 ${
                            getDayClass(d)
                          } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}
                        >
                          {tmpl ? (
                            <span
                              className="inline-block rounded px-1 py-0.5 text-[10px] font-bold leading-tight"
                              style={{ backgroundColor: tmpl.color + '20', color: tmpl.color }}
                            >
                              {tmpl.short_label}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center font-medium text-gray-700">{summary.totalHours}h</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{summary.totalDays}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{summary.paidLeave}</td>
                  </tr>
                );
              })}

              {/* 業務委託グループ */}
              {contractorStaff.length > 0 && (
                <tr className="border-b border-gray-200 bg-purple-50/50">
                  <td colSpan={dateRange.length + 5} className="px-2 py-1 text-xs font-semibold text-purple-700">
                    業務委託
                  </td>
                </tr>
              )}
              {contractorStaff.map((staff) => {
                const summary = getStaffSummary(staff.id);
                return (
                  <tr key={staff.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-gray-400 text-[10px]">
                      {EMPLOYMENT_TYPE_LABELS[staff.employment_type]}
                    </td>
                    <td className="sticky left-[60px] z-10 bg-white px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">
                      {staff.name}
                    </td>
                    {dateRange.map((d) => {
                      const dateStr = d.toISOString().split('T')[0];
                      const shift = shifts[staff.id]?.[dateStr];
                      const tmpl = shift?.shift_template;
                      const isSelected = selectedCell?.staffId === staff.id && selectedCell?.date === dateStr;
                      return (
                        <td
                          key={dateStr}
                          onClick={() => handleCellClick(staff.id, dateStr)}
                          className={`px-0.5 py-1 text-center cursor-pointer transition-colors border-l border-gray-50 ${
                            getDayClass(d)
                          } ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-blue-50'}`}
                        >
                          {tmpl ? (
                            <span
                              className="inline-block rounded px-1 py-0.5 text-[10px] font-bold leading-tight"
                              style={{ backgroundColor: tmpl.color + '20', color: tmpl.color }}
                            >
                              {tmpl.short_label}
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-center font-medium text-gray-700">{summary.totalHours}h</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{summary.totalDays}</td>
                    <td className="px-2 py-1.5 text-center text-gray-500">{summary.paidLeave}</td>
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
    </div>
  );
}
