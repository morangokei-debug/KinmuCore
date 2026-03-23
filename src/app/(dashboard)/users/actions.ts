'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export async function listStaff(): Promise<{ id: string; name: string; store_id: string; store?: { name: string } }[]> {
  const admin = createAdminClient();
  const { data } = await admin.from('staff').select('id, name, store_id, store:stores(name)').eq('status', 'active').order('store_id').order('name');
  return (data || []) as unknown as { id: string; name: string; store_id: string; store?: { name: string } }[];
}

export type UserWithRole = {
  id: string;
  email: string | null;
  created_at: string;
  role: 'admin' | 'staff';
  staff_id: string | null;
  can_edit_shifts: boolean;
  organization_id?: string | null;
};

export async function listUsersWithRoles(): Promise<{ ok: true; users: UserWithRole[] } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 100 });
    if (authError) return { ok: false, error: authError.message };

    const userIds = authData.users.map((u) => u.id);
    const { data: rolesData } = await admin.from('user_roles').select('user_id, role, staff_id, can_edit_shifts').in('user_id', userIds);

    const roleMap = new Map<string, { role: 'admin' | 'staff'; staff_id: string | null; can_edit_shifts: boolean }>();
    (rolesData || []).forEach((r) =>
      roleMap.set(r.user_id, {
        role: r.role as 'admin' | 'staff',
        staff_id: r.staff_id ?? null,
        can_edit_shifts: !!r.can_edit_shifts,
      })
    );

    const users: UserWithRole[] = authData.users.map((u) => {
      const r = roleMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        role: r?.role ?? 'admin',
        staff_id: r?.staff_id ?? null,
        can_edit_shifts: r?.can_edit_shifts ?? false,
        organization_id: undefined,
      };
    });

    return { ok: true, users };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'staff',
  staffId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: user, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) return { ok: false, error: createError.message };
    if (!user.user) return { ok: false, error: 'ユーザー作成に失敗しました' };

    const { error: roleError } = await admin.from('user_roles').insert({
      user_id: user.user.id,
      role,
      staff_id: role === 'staff' ? staffId || null : null,
      can_edit_shifts: false,
    });
    if (roleError) {
      if (roleError.message?.includes('already') || roleError.code === '23505') {
        await admin
          .from('user_roles')
          .update({ role, staff_id: role === 'staff' ? staffId || null : null })
          .eq('user_id', user.user.id);
      } else {
        return { ok: false, error: roleError.message };
      }
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function setUserRole(
  userId: string,
  role: 'admin' | 'staff',
  staffId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('user_roles')
      .select('id, staff_id, can_edit_shifts')
      .eq('user_id', userId)
      .single();

    const staffIdToSet =
      role === 'admin'
        ? null
        : staffId !== undefined
          ? staffId || null
          : existing?.staff_id ?? null;

    const payload = {
      role,
      staff_id: staffIdToSet,
      can_edit_shifts: role === 'admin' ? false : existing?.can_edit_shifts ?? false,
    };

    if (existing) {
      const { error } = await admin.from('user_roles').update(payload).eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from('user_roles').insert({ user_id: userId, ...payload });
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function setShiftEditPermission(
  userId: string,
  canEditShifts: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('user_roles')
      .select('id, role, staff_id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      if (existing.role !== 'staff') {
        return { ok: false, error: 'スタッフ権限のユーザーのみ設定できます' };
      }
      const { error } = await admin
        .from('user_roles')
        .update({ can_edit_shifts: canEditShifts })
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const { error } = await admin.from('user_roles').insert({
      user_id: userId,
      role: 'staff',
      staff_id: null,
      can_edit_shifts: canEditShifts,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
