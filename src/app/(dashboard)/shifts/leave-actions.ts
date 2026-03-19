'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type LeaveRequestWithStaff = {
  id: string;
  staff_id: string;
  store_id: string;
  request_date: string;
  leave_type: 'full' | 'half' | 'hourly';
  requested_hours: number | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  decided_at?: string | null;
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

export async function getRecentLeaveRequests(
  storeId: string
): Promise<{ ok: true; requests: LeaveRequestWithStaff[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, staff:staff(name)')
      .eq('store_id', storeId)
      .order('requested_at', { ascending: false })
      .limit(50);

    if (error) return { ok: false, error: error.message };
    return { ok: true, requests: (data || []) as LeaveRequestWithStaff[] };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function getMyLeaveRequests(
  staffId: string
): Promise<{ ok: true; requests: LeaveRequestWithStaff[] } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const myStaffId = await getMyStaffId();
    if (!myStaffId || myStaffId !== staffId) {
      return { ok: false, error: '自分の申請のみ確認できます' };
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*, staff:staff(name)')
      .eq('staff_id', staffId)
      .order('requested_at', { ascending: false })
      .limit(30);

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
  leaveType: 'full' | 'half' | 'hourly',
  requestedHours?: number,
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

    const normalizedHours = leaveType === 'hourly' ? Number(requestedHours || 0) : null;
    if (leaveType === 'hourly' && (!normalizedHours || normalizedHours <= 0 || normalizedHours > 8)) {
      return { ok: false, error: '時間有給は0.5〜8時間で指定してください' };
    }

    const { error } = await supabase.from('leave_requests').insert({
      staff_id: staffId,
      store_id: storeId,
      request_date: requestDate,
      leave_type: leaveType,
      requested_hours: normalizedHours,
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
    const leaveType = req.leave_type as 'full' | 'half' | 'hourly';
    const requestedHours = req.requested_hours as number | null;

    const { data: templates } = await admin
      .from('shift_templates')
      .select('id, code, name, short_label, working_hours, is_paid_leave, is_active')
      .eq('store_id', storeId)
      .eq('is_active', true);

    const normalize = (v: string | null | undefined) => (v || '').toLowerCase();
    const safeTemplates =
      templates?.map((t) => ({
        ...t,
        codeNormalized: normalize(t.code),
        nameNormalized: normalize(t.name),
        labelNormalized: normalize(t.short_label),
      })) || [];

    const paidLeaveTemplates = safeTemplates.filter((t) => t.is_paid_leave);
    const fullPaidTemplate =
      paidLeaveTemplates.find((t) => t.codeNormalized === 'paid_leave') ??
      paidLeaveTemplates[0];

    let template: (typeof safeTemplates)[number] | undefined;
    if (leaveType === 'full') {
      template = fullPaidTemplate;
    } else if (leaveType === 'hourly') {
      template =
        paidLeaveTemplates.find((t) => t.codeNormalized === 'hourly_paid') ??
        paidLeaveTemplates.find((t) => t.codeNormalized.includes('hourly')) ??
        fullPaidTemplate;
    } else {
      const halfFromCode = paidLeaveTemplates.find(
        (t) => t.codeNormalized === 'half_paid' || t.codeNormalized === 'h.rest'
      );
      const halfFromName = paidLeaveTemplates.find(
        (t) => t.nameNormalized.includes('半日') || t.labelNormalized.includes('半休')
      );
      template = halfFromCode ?? halfFromName ?? fullPaidTemplate;
    }

    if (!template) return { ok: false, error: '有給テンプレートがありません。シフト区分で有給・半休を登録してください' };

    await admin.from('shifts').upsert(
      {
        staff_id: staffId,
        store_id: storeId,
        work_date: requestDate,
        shift_template_id: template.id,
        note: leaveType === 'hourly' && requestedHours ? `時間有給(${requestedHours}h)` : null,
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

export async function cancelLeaveRequest(
  requestId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const myStaffId = await getMyStaffId();
    if (!myStaffId) return { ok: false, error: 'ログインが必要です' };

    const { data: req } = await supabase
      .from('leave_requests')
      .select('id, staff_id, status')
      .eq('id', requestId)
      .single();

    if (!req) return { ok: false, error: '申請が見つかりません' };
    if (req.staff_id !== myStaffId) return { ok: false, error: '自分の申請のみ取り消しできます' };
    if (req.status !== 'pending') return { ok: false, error: '承認待ちの申請のみ取り消しできます' };

    const admin = createAdminClient();
    const { error } = await admin
      .from('leave_requests')
      .delete()
      .eq('id', requestId)
      .eq('staff_id', myStaffId)
      .eq('status', 'pending');

    if (error) return { ok: false, error: error.message };
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
