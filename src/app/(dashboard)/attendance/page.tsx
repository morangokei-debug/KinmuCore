'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Clock, ChevronLeft, ChevronRight, Pencil, ExternalLink } from 'lucide-react';
import { formatDate, formatTime, minutesToHoursMinutes } from '@/lib/utils';
import type { DailyAttendance, Store, Staff, AttendanceStatus } from '@/types';
import { ATTENDANCE_STATUS_LABELS } from '@/types';

export default function AttendancePage() {
  const [attendances, setAttendances] = useState<(DailyAttendance & { staff: Staff; store: Store })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filterStore, setFilterStore] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DailyAttendance | null>(null);
  const [editForm, setEditForm] = useState({ clock_in: '', clock_out: '', break_minutes: '', note: '' });
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    let query = supabase
      .from('daily_attendance')
      .select('*, staff:staff(*), store:stores(*)')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false })
      .order('staff(name)');

    if (filterStore) {
      query = query.eq('store_id', filterStore);
    }

    const { data } = await query;
    setAttendances((data as (DailyAttendance & { staff: Staff; store: Store })[]) || []);
    setLoading(false);
  };

  const fetchStores = async () => {
    const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('name');
    setStores(data || []);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchData();
  }, [year, month, filterStore]);

  const prevMonth = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const openEdit = (record: DailyAttendance) => {
    setEditingRecord(record);
    setEditForm({
      clock_in: record.clock_in ? new Date(record.clock_in).toTimeString().slice(0, 5) : '',
      clock_out: record.clock_out ? new Date(record.clock_out).toTimeString().slice(0, 5) : '',
      break_minutes: record.break_minutes.toString(),
      note: record.note || '',
    });
    setEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingRecord) return;

    const workDate = editingRecord.work_date;
    const clockIn = editForm.clock_in ? new Date(`${workDate}T${editForm.clock_in}:00`).toISOString() : null;
    const clockOut = editForm.clock_out ? new Date(`${workDate}T${editForm.clock_out}:00`).toISOString() : null;
    const breakMinutes = parseInt(editForm.break_minutes) || 0;

    let workingMinutes = 0;
    if (clockIn && clockOut) {
      const totalMs = new Date(clockOut).getTime() - new Date(clockIn).getTime();
      workingMinutes = Math.max(0, Math.floor(totalMs / 60000) - breakMinutes);
    }

    await supabase
      .from('daily_attendance')
      .update({
        clock_in: clockIn,
        clock_out: clockOut,
        break_minutes: breakMinutes,
        working_minutes: workingMinutes,
        note: editForm.note || null,
      })
      .eq('id', editingRecord.id);

    setEditModal(false);
    fetchData();
  };

  const statusBadgeVariant = (status: AttendanceStatus) => {
    const map: Record<AttendanceStatus, 'success' | 'danger' | 'default' | 'info' | 'warning'> = {
      present: 'success',
      absent: 'danger',
      holiday: 'default',
      paid_leave: 'info',
      pending: 'warning',
    };
    return map[status];
  };

  // 月間サマリーの計算
  const totalWorkingMinutes = attendances.reduce((sum, a) => sum + a.working_minutes, 0);
  const totalDays = new Set(attendances.filter((a) => a.status === 'present').map((a) => a.work_date)).size;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">勤怠管理</h1>
          <p className="mt-1 text-sm text-gray-500">日別の勤怠記録を確認・修正できます</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={[{ value: '', label: '全店舗' }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* 月選択 */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={prevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-bold text-gray-900">
          {year}年{month}月
        </h2>
        <Button variant="ghost" onClick={nextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* サマリーカード */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-gray-500">出勤日数</p>
            <p className="text-2xl font-bold text-gray-900">{totalDays}日</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-gray-500">総勤務時間</p>
            <p className="text-2xl font-bold text-gray-900">{minutesToHoursMinutes(totalWorkingMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-sm text-gray-500">レコード数</p>
            <p className="text-2xl font-bold text-gray-900">{attendances.length}件</p>
          </CardContent>
        </Card>
      </div>

      {/* 打刻ページリンク */}
      {stores.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-sm font-medium text-gray-700">打刻ページ（店舗端末で開いてください）</p>
          <div className="flex flex-wrap gap-2">
            {stores.map((store) => (
              <a
                key={store.id}
                href={`/punch/${store.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {store.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 勤怠テーブル */}
      {loading ? (
        <div className="py-12 text-center text-gray-500">読み込み中...</div>
      ) : attendances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">この月の勤怠データがありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">日付</th>
                <th className="px-4 py-3 font-medium">スタッフ</th>
                <th className="px-4 py-3 font-medium">店舗</th>
                <th className="px-4 py-3 font-medium">出勤</th>
                <th className="px-4 py-3 font-medium">退勤</th>
                <th className="px-4 py-3 font-medium">休憩</th>
                <th className="px-4 py-3 font-medium">実働</th>
                <th className="px-4 py-3 font-medium">状態</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendances.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatDate(record.work_date, 'MM/dd (E)')}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{record.staff?.name}</td>
                  <td className="px-4 py-3 text-gray-500">{record.store?.name}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {record.clock_in ? formatTime(record.clock_in) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {record.clock_out ? formatTime(record.clock_out) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{record.break_minutes}分</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {minutesToHoursMinutes(record.working_minutes)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(record.status)}>
                      {ATTENDANCE_STATUS_LABELS[record.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 編集モーダル */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="勤怠データを修正">
        <div className="space-y-4">
          <Input
            label="出勤時刻"
            type="time"
            value={editForm.clock_in}
            onChange={(e) => setEditForm({ ...editForm, clock_in: e.target.value })}
          />
          <Input
            label="退勤時刻"
            type="time"
            value={editForm.clock_out}
            onChange={(e) => setEditForm({ ...editForm, clock_out: e.target.value })}
          />
          <Input
            label="休憩時間（分）"
            type="number"
            value={editForm.break_minutes}
            onChange={(e) => setEditForm({ ...editForm, break_minutes: e.target.value })}
          />
          <Input
            label="備考"
            value={editForm.note}
            onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
            placeholder="修正理由など"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setEditModal(false)}>
              キャンセル
            </Button>
            <Button onClick={handleEditSave}>保存する</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
