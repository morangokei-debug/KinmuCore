'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type RoleType = 'admin' | 'staff';

async function getCurrentRole() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_roles')
    .select('role, can_edit_shifts')
    .eq('user_id', user.id)
    .single();

  const role = (data?.role as RoleType | undefined) ?? 'admin';
  const canEditShifts = role === 'admin' || !!data?.can_edit_shifts;
  return { role, canEditShifts };
}

export async function getShiftEditPermission(): Promise<{
  ok: true;
  role: RoleType;
  canEditShifts: boolean;
} | {
  ok: false;
  error: string;
}> {
  try {
    const permission = await getCurrentRole();
    if (!permission) return { ok: false, error: 'ログインが必要です' };
    return { ok: true, role: permission.role, canEditShifts: permission.canEditShifts };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function saveShiftAssignment(params: {
  staffId: string;
  storeId: string;
  workDate: string;
  templateId: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const permission = await getCurrentRole();
    if (!permission) return { ok: false, error: 'ログインが必要です' };
    if (!permission.canEditShifts) return { ok: false, error: 'シフト編集権限がありません' };

    const admin = createAdminClient();

    const { data: staffRow, error: staffError } = await admin
      .from('staff')
      .select('id, store_id')
      .eq('id', params.staffId)
      .single();
    if (staffError || !staffRow || staffRow.store_id !== params.storeId) {
      return { ok: false, error: '対象スタッフが見つかりません' };
    }

    if (params.templateId) {
      const { data: templateRow, error: templateError } = await admin
        .from('shift_templates')
        .select('id, store_id, is_active')
        .eq('id', params.templateId)
        .single();
      if (templateError || !templateRow || templateRow.store_id !== params.storeId || !templateRow.is_active) {
        return { ok: false, error: 'シフト区分が無効です' };
      }
    }

    if (params.templateId === null) {
      const { error } = await admin
        .from('shifts')
        .delete()
        .eq('staff_id', params.staffId)
        .eq('store_id', params.storeId)
        .eq('work_date', params.workDate);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const { error } = await admin
      .from('shifts')
      .upsert(
        {
          staff_id: params.staffId,
          store_id: params.storeId,
          work_date: params.workDate,
          shift_template_id: params.templateId,
        },
        { onConflict: 'staff_id,work_date' }
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
