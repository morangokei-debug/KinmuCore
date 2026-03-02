'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type LeaveRequestWithStaff = {
  id: string;
  staff_id: string;
  store_id: string;
  request_date: string;
  leave_type: 'full' | 'half';
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  staff?: { name: string };
};

export async function getPendingLeaveRequests(
  storeId: string
): Promise<{ ok: true; requests: LeaveRequestWithStaff[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, staff:staff(name)')
      .eq('store_id', storeId)
      .eq('status', 'pending')
      .order('request_date');

    if (error) return { ok: false, error: error.message };
    return { ok: true, requests: (data || []) as LeaveRequestWithStaff[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getMyStaffId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_roles')
    .select('staff_id')
    .eq('user_id', user.id)
    .single();

  return data?.staff_id ?? null;
}

export async function submitLeaveRequest(
  staffId: string,
  storeId: string,
  requestDate: string,
  leaveType: 'full' | 'half',
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'ログインが必要です' };

    const myStaffId = await getMyStaffId();
    if (!myStaffId || myStaffId !== staffId) {
      return { ok: false, error: '自分の有給申請のみ可能です' };
    }

    const { data: staffData } = await supabase.from('staff').select('store_id').eq('id', staffId).single();
    if (!staffData || staffData.store_id !== storeId) {
      return { ok: false, error: '店舗が一致しません' };
    }

    const { error } = await supabase.from('leave_requests').insert({
      staff_id: staffId,
      store_id: storeId,
      request_date: requestDate,
      leave_type: leaveType,
      reason: reason || null,
      status: 'pending',
    });

    if (error) {
      if (error.code === '23505') return { ok: false, error: 'この日付は既に申請済みです' };
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function approveLeaveRequest(
  requestId: string,
  storeId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'ログインが必要です' };

    const { data: req, error: fetchErr } = await admin
      .from('leave_requests')
      .select('*, staff:staff(id)')
      .eq('id', requestId)
      .eq('store_id', storeId)
      .eq('status', 'pending')
      .single();

    if (fetchErr || !req) return { ok: false, error: '申請が見つかりません' };

    const staffId = req.staff_id;
    const requestDate = req.request_date;
    const leaveType = req.leave_type as 'full' | 'half';

    const templateCode = leaveType === 'full' ? 'paid_leave' : 'half_paid';
    const { data: templates } = await admin
      .from('shift_templates')
      .select('id, code')
      .eq('store_id', storeId)
      .eq('is_paid_leave', true);

    const template = templates?.find((t: { code: string }) => t.code === templateCode) ?? templates?.[0];
    if (!template) return { ok: false, error: '有給テンプレートがありません。シフト区分で有給・半休を登録してください' };

    await admin.from('shifts').upsert(
      {
        staff_id: staffId,
        store_id: storeId,
        work_date: requestDate,
        shift_template_id: template.id,
      },
      { onConflict: 'staff_id,work_date' }
    );

    await admin
      .from('leave_requests')
      .update({ status: 'approved', decided_by: user.id, decided_at: new Date().toISOString() })
      .eq('id', requestId);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function rejectLeaveRequest(requestId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'ログインが必要です' };

    const { error } = await admin
      .from('leave_requests')
      .update({ status: 'rejected', decided_by: user.id, decided_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('status', 'pending');

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
