'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { formatDate, minutesToDecimalHours } from '@/lib/utils';
import type { Store, Staff, DailyAttendance } from '@/types';
import { EMPLOYMENT_TYPE_LABELS, ATTENDANCE_STATUS_LABELS } from '@/types';
import * as XLSX from 'xlsx';

export default function ExportPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [exporting, setExporting] = useState(false);
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
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

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

  const buildExportRows = (data: (DailyAttendance & { staff: Staff; store: Store })[]) => {
    return data.map((record) => ({
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
      時給: record.staff?.hourly_rate || '',
      備考: record.note || '',
    }));
  };

  const buildSummaryRows = (data: (DailyAttendance & { staff: Staff; store: Store })[]) => {
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
        });
      }
    });

    return Array.from(staffMap.values()).map((s) => ({
      スタッフ名: s.name,
      店舗: s.store,
      雇用形態: s.employment_type,
      出勤日数: s.days,
      '総勤務時間（分）': s.totalWorking,
      '総勤務時間（時間）': minutesToDecimalHours(s.totalWorking),
      '総休憩時間（分）': s.totalBreak,
      '総残業時間（分）': s.totalOvertime,
      時給: s.hourly_rate || '',
      概算給与: s.hourly_rate ? Math.round((s.totalWorking / 60) * s.hourly_rate) : '',
    }));
  };

  const buildStaffDetailSheets = (data: (DailyAttendance & { staff: Staff; store: Store })[]) => {
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
      const rows = staffData.records.map((record) => ({
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
        備考: record.note || '',
      }));

      // 合計行を追加
      const totalWorking = staffData.records.reduce((sum, r) => sum + r.working_minutes, 0);
      const totalBreak = staffData.records.reduce((sum, r) => sum + r.break_minutes, 0);
      const totalDays = staffData.records.filter((r) => r.status === 'present').length;

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
      const data = await fetchExportData();
      const rows = buildExportRows(data);
      const summaryRows = buildSummaryRows(data);
      const staffDetails = buildStaffDetailSheets(data);

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
      const data = await fetchExportData();
      const rows = buildExportRows(data);

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
