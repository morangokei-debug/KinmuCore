'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export type UserWithRole = {
  id: string;
  email: string | null;
  created_at: string;
  role: 'admin' | 'staff';
};

export async function listUsersWithRoles(): Promise<{ ok: true; users: UserWithRole[] } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 100 });
    if (authError) return { ok: false, error: authError.message };

    const userIds = authData.users.map((u) => u.id);
    const { data: rolesData } = await admin.from('user_roles').select('user_id, role').in('user_id', userIds);

    const roleMap = new Map<string, 'admin' | 'staff'>();
    (rolesData || []).forEach((r) => roleMap.set(r.user_id, r.role as 'admin' | 'staff'));

    const users: UserWithRole[] = authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      role: roleMap.get(u.id) ?? 'admin',
    }));

    return { ok: true, users };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function createUser(
  email: string,
  password: string,
  role: 'admin' | 'staff'
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
    });
    if (roleError) {
      if (roleError.message?.includes('already') || roleError.code === '23505') {
        await admin.from('user_roles').update({ role }).eq('user_id', user.user.id);
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
  role: 'admin' | 'staff'
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin.from('user_roles').select('id').eq('user_id', userId).single();

    if (existing) {
      const { error } = await admin.from('user_roles').update({ role }).eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await admin.from('user_roles').insert({ user_id: userId, role });
      if (error) return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
