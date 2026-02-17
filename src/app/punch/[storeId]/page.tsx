'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Coffee, LogIn, LogOut, ArrowLeft } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import type { PunchScreenStaff, PunchType, Store } from '@/types';

export default function PunchPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const [store, setStore] = useState<Store | null>(null);
  const [staffList, setStaffList] = useState<PunchScreenStaff[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<PunchScreenStaff | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [punching, setPunching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const supabase = createClient();

  const fetchStaffStatus = useCallback(async () => {
    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .single();
    setStore(storeData);

    const { data: staffData } = await supabase
      .from('staff')
      .select('id, name')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('display_order')
      .order('name');

    if (!staffData) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const statuses: PunchScreenStaff[] = await Promise.all(
      staffData.map(async (staff: { id: string; name: string }) => {
        const { data: records } = await supabase
          .from('time_records')
          .select('punch_type, punched_at')
          .eq('staff_id', staff.id)
          .gte('punched_at', today.toISOString())
          .order('punched_at', { ascending: false })
          .limit(1);

        const lastPunch = records?.[0];
        let currentStatus: PunchScreenStaff['current_status'] = 'not_working';

        if (lastPunch) {
          if (lastPunch.punch_type === 'clock_in' || lastPunch.punch_type === 'break_end') {
            currentStatus = 'working';
          } else if (lastPunch.punch_type === 'break_start') {
            currentStatus = 'on_break';
          } else {
            currentStatus = 'not_working';
          }
        }

        return {
          id: staff.id,
          name: staff.name,
          current_status: currentStatus,
          last_punch: lastPunch
            ? { punch_type: lastPunch.punch_type as PunchType, punched_at: lastPunch.punched_at }
            : undefined,
        };
      })
    );

    setStaffList(statuses);
  }, [storeId]);

  useEffect(() => {
    fetchStaffStatus();
    const interval = setInterval(fetchStaffStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStaffStatus]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handlePunch = async (punchType: PunchType) => {
    if (!selectedStaff) return;
    setPunching(true);
    setMessage(null);

    try {
      const { error } = await supabase.from('time_records').insert({
        staff_id: selectedStaff.id,
        store_id: storeId,
        punch_type: punchType,
      });

      if (error) throw error;

      const punchLabels: Record<PunchType, string> = {
        clock_in: '出勤',
        clock_out: '退勤',
        break_start: '休憩開始',
        break_end: '休憩終了',
      };

      setMessage({
        type: 'success',
        text: `${selectedStaff.name}さんの${punchLabels[punchType]}を記録しました`,
      });

      // 日次勤怠レコードを更新
      await updateDailyAttendance(selectedStaff.id, storeId, punchType);

      setTimeout(() => {
        setSelectedStaff(null);
        setMessage(null);
        fetchStaffStatus();
      }, 2000);
    } catch {
      setMessage({ type: 'error', text: '打刻に失敗しました。もう一度お試しください。' });
    }
    setPunching(false);
  };

  const updateDailyAttendance = async (staffId: string, storeId: string, punchType: PunchType) => {
    const today = new Date().toISOString().split('T')[0];

    if (punchType === 'clock_in') {
      const { data: existing } = await supabase
        .from('daily_attendance')
        .select('id')
        .eq('staff_id', staffId)
        .eq('work_date', today)
        .single();

      if (!existing) {
        await supabase.from('daily_attendance').insert({
          staff_id: staffId,
          store_id: storeId,
          work_date: today,
          clock_in: new Date().toISOString(),
          status: 'present',
        });
      }
    } else if (punchType === 'clock_out') {
      const now = new Date();
      const { data: attendance } = await supabase
        .from('daily_attendance')
        .select('*')
        .eq('staff_id', staffId)
        .eq('work_date', today)
        .single();

      if (attendance) {
        const clockIn = new Date(attendance.clock_in);
        const totalMinutes = Math.floor((now.getTime() - clockIn.getTime()) / 60000);
        const workingMinutes = Math.max(0, totalMinutes - (attendance.break_minutes || 0));

        await supabase
          .from('daily_attendance')
          .update({
            clock_out: now.toISOString(),
            working_minutes: workingMinutes,
          })
          .eq('id', attendance.id);
      }
    } else if (punchType === 'break_start' || punchType === 'break_end') {
      if (punchType === 'break_end') {
        // 休憩終了時に休憩時間を計算
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const { data: breakStartRecord } = await supabase
          .from('time_records')
          .select('punched_at')
          .eq('staff_id', staffId)
          .eq('punch_type', 'break_start')
          .gte('punched_at', todayStart.toISOString())
          .order('punched_at', { ascending: false })
          .limit(1)
          .single();

        if (breakStartRecord) {
          const breakStart = new Date(breakStartRecord.punched_at);
          const breakMinutes = Math.floor((new Date().getTime() - breakStart.getTime()) / 60000);

          const { data: attendance } = await supabase
            .from('daily_attendance')
            .select('break_minutes')
            .eq('staff_id', staffId)
            .eq('work_date', today)
            .single();

          if (attendance) {
            await supabase
              .from('daily_attendance')
              .update({ break_minutes: (attendance.break_minutes || 0) + breakMinutes })
              .eq('staff_id', staffId)
              .eq('work_date', today);
          }
        }
      }
    }
  };

  const getAvailablePunchTypes = (staff: PunchScreenStaff): PunchType[] => {
    switch (staff.current_status) {
      case 'not_working':
        return ['clock_in'];
      case 'working':
        return ['break_start', 'clock_out'];
      case 'on_break':
        return ['break_end'];
      default:
        return ['clock_in'];
    }
  };

  const punchButtonConfig: Record<PunchType, { icon: React.ReactNode; color: string; label: string }> = {
    clock_in: { icon: <LogIn className="h-8 w-8" />, color: 'bg-green-600 hover:bg-green-700', label: '出勤' },
    clock_out: { icon: <LogOut className="h-8 w-8" />, color: 'bg-red-600 hover:bg-red-700', label: '退勤' },
    break_start: { icon: <Coffee className="h-8 w-8" />, color: 'bg-yellow-500 hover:bg-yellow-600', label: '休憩開始' },
    break_end: { icon: <Coffee className="h-8 w-8" />, color: 'bg-blue-600 hover:bg-blue-700', label: '休憩終了' },
  };

  const statusLabels: Record<string, { text: string; variant: 'success' | 'warning' | 'default' }> = {
    working: { text: '勤務中', variant: 'success' },
    on_break: { text: '休憩中', variant: 'warning' },
    not_working: { text: '未出勤', variant: 'default' },
  };

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">店舗情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{store.name}</h1>
            <p className="text-sm text-gray-500">打刻画面</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-gray-900">
              {currentTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm text-gray-500">
              {currentTime.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        {message && (
          <div
            className={`mb-6 rounded-xl p-4 text-center text-lg font-medium ${
              message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {selectedStaff ? (
          <div>
            <button
              onClick={() => setSelectedStaff(null)}
              className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              スタッフ一覧に戻る
            </button>

            <Card className="mb-6">
              <CardContent className="py-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900">{selectedStaff.name}</h2>
                <Badge className="mt-2" variant={statusLabels[selectedStaff.current_status].variant}>
                  {statusLabels[selectedStaff.current_status].text}
                </Badge>
                {selectedStaff.last_punch && (
                  <p className="mt-2 text-sm text-gray-500">
                    最終打刻: {formatTime(selectedStaff.last_punch.punched_at)}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              {getAvailablePunchTypes(selectedStaff).map((punchType) => {
                const config = punchButtonConfig[punchType];
                return (
                  <button
                    key={punchType}
                    onClick={() => handlePunch(punchType)}
                    disabled={punching}
                    className={`flex flex-col items-center justify-center rounded-2xl p-8 text-white shadow-lg transition-transform active:scale-95 disabled:opacity-50 ${config.color}`}
                  >
                    {config.icon}
                    <span className="mt-3 text-2xl font-bold">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-gray-700">
              <Clock className="mr-2 inline h-5 w-5" />
              名前を選択してください
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {staffList.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => setSelectedStaff(staff)}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-blue-300 hover:shadow-md active:scale-[0.98]"
                >
                  <span className="text-lg font-medium text-gray-900">{staff.name}</span>
                  <Badge variant={statusLabels[staff.current_status].variant}>
                    {statusLabels[staff.current_status].text}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
