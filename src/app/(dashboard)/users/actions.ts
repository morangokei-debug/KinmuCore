'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { getOrgContext } from '@/lib/actions/stores';

const SUPER_ADMIN_EMAIL = 'logicworks.k@gmail.com';
const UNDEFINED_COLUMN_CODE = '42703';
const RELATION_NOT_FOUND_CODE = '42P01';

export async function listStaff(): Promise<{ id: string; name: string; store_id: string; store?: { name: string } }[]> {
  const access = await ensureUserManagementAccess();
  if (!access.ok) return [];

  const admin = createAdminClient();

  let query = admin
    .from('staff')
    .select('id, name, store_id, store:stores!inner(name, organization_id)')
    .eq('status', 'active');

  if (!access.access.isSuperAdmin) {
    if (!access.access.organizationId) return [];
    query = query.eq('store.organization_id', access.access.organizationId);
  }

  const { data } = await query.order('store_id').order('name');
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

type UserManagementAccess = {
  isSuperAdmin: boolean;
  organizationId: string | null;
};

async function ensureUserManagementAccess(): Promise<
  { ok: true; access: UserManagementAccess } | { ok: false; error: string }
> {
  const org = await getOrgContext();
  if (!org) {
    return { ok: false, error: 'ユーザー情報の取得に失敗しました。' };
  }
  if (org.role !== 'admin') {
    return { ok: false, error: '管理者のみ実行できます。' };
  }
  return {
    ok: true,
    access: {
      isSuperAdmin: org.isSuperAdmin,
      organizationId: org.organizationId,
    },
  };
}

export type OrganizationOption = {
  id: string;
  name: string;
};

async function listOrganizationsSafe() {
  const admin = createAdminClient();
  const activeQuery = await admin
    .from('organizations')
    .select('id, name')
    .eq('is_active', true)
    .order('name');

  if (!activeQuery.error) {
    return { data: (activeQuery.data || []) as OrganizationOption[], error: null as string | null, errorCode: null as string | null };
  }

  if (activeQuery.error.code === UNDEFINED_COLUMN_CODE) {
    const fallbackQuery = await admin.from('organizations').select('id, name').order('name');
    if (fallbackQuery.error) {
      return { data: [] as OrganizationOption[], error: fallbackQuery.error.message, errorCode: fallbackQuery.error.code || null };
    }
    return { data: (fallbackQuery.data || []) as OrganizationOption[], error: null as string | null, errorCode: null as string | null };
  }

  return { data: [] as OrganizationOption[], error: activeQuery.error.message, errorCode: activeQuery.error.code || null };
}

export async function listOrganizationsForUser(): Promise<{
  ok: true;
  organizations: OrganizationOption[];
} | {
  ok: false;
  error: string;
}> {
  try {
    const allow = await ensureUserManagementAccess();
    if (!allow.ok) return { ok: false, error: allow.error };
    const access = allow.access;

    const { data: allOrganizations, error, errorCode } = await listOrganizationsSafe();
    if (error) {
      if (errorCode === RELATION_NOT_FOUND_CODE) {
        return { ok: true, organizations: [] };
      }
      return { ok: false, error };
    }

    if (access.isSuperAdmin) {
      return { ok: true, organizations: allOrganizations };
    }

    if (!access.organizationId) return { ok: true, organizations: [] };
    return { ok: true, organizations: allOrganizations.filter((o) => o.id === access.organizationId) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function listUsersWithRoles(): Promise<{ ok: true; users: UserWithRole[] } | { ok: false; error: string }> {
  try {
    const allow = await ensureUserManagementAccess();
    if (!allow.ok) return { ok: false, error: allow.error };
    const access = allow.access;

    const admin = createAdminClient();
    let rolesQuery = admin
      .from('user_roles')
      .select('user_id, role, staff_id, can_edit_shifts, organization_id');

    if (!access.isSuperAdmin) {
      if (!access.organizationId) return { ok: true, users: [] };
      rolesQuery = rolesQuery.eq('organization_id', access.organizationId);
    }

    const { data: rolesData, error: rolesError } = await rolesQuery;
    if (rolesError) return { ok: false, error: rolesError.message };

    const userIds = (rolesData || []).map((r) => r.user_id);
    if (userIds.length === 0) return { ok: true, users: [] };

    const { data: authData, error: authError } = await admin.auth.admin.listUsers({ perPage: 100 });
    if (authError) return { ok: false, error: authError.message };
    const usersById = new Map(authData.users.map((u) => [u.id, u]));

    const roleMap = new Map<
      string,
      { role: 'admin' | 'staff'; staff_id: string | null; can_edit_shifts: boolean; organization_id: string | null }
    >();
    (rolesData || []).forEach((r) =>
      roleMap.set(r.user_id, {
        role: r.role as 'admin' | 'staff',
        staff_id: r.staff_id ?? null,
        can_edit_shifts: !!r.can_edit_shifts,
        organization_id: r.organization_id ?? null,
      })
    );

    const users: UserWithRole[] = userIds
      .map((id) => usersById.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => {
      const r = roleMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        role: r?.role ?? 'admin',
        staff_id: r?.staff_id ?? null,
        can_edit_shifts: r?.can_edit_shifts ?? false,
        organization_id: r?.organization_id ?? null,
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
    const allow = await ensureUserManagementAccess();
    if (!allow.ok) return { ok: false, error: allow.error };
    const access = allow.access;

    const admin = createAdminClient();

    let targetOrganizationId: string | null = access.organizationId ?? null;
    if (!access.isSuperAdmin && !targetOrganizationId) {
      return { ok: false, error: 'あなたの組織情報が未設定です。' };
    }

    if (!access.isSuperAdmin && email.trim().toLowerCase() === SUPER_ADMIN_EMAIL) {
      return { ok: false, error: 'このメールアドレスは作成できません。' };
    }

    if (role === 'staff' && staffId) {
      const { data: staffOrg } = await admin
        .from('staff')
        .select('store:stores(organization_id)')
        .eq('id', staffId)
        .single();
      const store = Array.isArray(staffOrg?.store) ? staffOrg.store[0] : staffOrg?.store;
      const staffOrganizationId = (store?.organization_id as string | null | undefined) ?? null;
      if (!access.isSuperAdmin && staffOrganizationId !== targetOrganizationId) {
        return { ok: false, error: '自組織以外のスタッフは紐づけできません。' };
      }
      targetOrganizationId = staffOrganizationId ?? targetOrganizationId;
    }

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
      organization_id: targetOrganizationId,
    });
    if (roleError) {
      if (roleError.message?.includes('already') || roleError.code === '23505') {
        await admin
          .from('user_roles')
          .update({
            role,
            staff_id: role === 'staff' ? staffId || null : null,
            organization_id: targetOrganizationId,
          })
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
    const allow = await ensureUserManagementAccess();
    if (!allow.ok) return { ok: false, error: allow.error };
    const access = allow.access;

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('user_roles')
      .select('id, staff_id, can_edit_shifts, organization_id')
      .eq('user_id', userId)
      .single();

    if (!access.isSuperAdmin) {
      if (!access.organizationId) return { ok: false, error: 'あなたの組織情報が未設定です。' };
      if (!existing || existing.organization_id !== access.organizationId) {
        return { ok: false, error: '自組織のユーザーのみ変更できます。' };
      }
    }

    const { data: targetAuthUser } = await admin.auth.admin.getUserById(userId);
    const targetEmail = (targetAuthUser.user?.email || '').trim().toLowerCase();
    if (targetEmail === SUPER_ADMIN_EMAIL) {
      return { ok: false, error: 'スーパー管理者は変更できません。' };
    }

    const staffIdToSet =
      role === 'admin'
        ? null
        : staffId !== undefined
          ? staffId || null
          : existing?.staff_id ?? null;

    let targetOrganizationId = access.isSuperAdmin
      ? existing?.organization_id ?? access.organizationId ?? null
      : access.organizationId;
    if (role === 'staff' && staffIdToSet) {
      const { data: staffOrg } = await admin
        .from('staff')
        .select('store:stores(organization_id)')
        .eq('id', staffIdToSet)
        .single();
      const store = Array.isArray(staffOrg?.store) ? staffOrg.store[0] : staffOrg?.store;
      const staffOrganizationId = (store?.organization_id as string | null | undefined) ?? null;
      if (!access.isSuperAdmin && staffOrganizationId !== access.organizationId) {
        return { ok: false, error: '自組織以外のスタッフは紐づけできません。' };
      }
      targetOrganizationId = staffOrganizationId ?? targetOrganizationId;
    }

    const payload = {
      role,
      staff_id: staffIdToSet,
      can_edit_shifts: role === 'admin' ? false : existing?.can_edit_shifts ?? false,
      organization_id: targetOrganizationId,
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
    const allow = await ensureUserManagementAccess();
    if (!allow.ok) return { ok: false, error: allow.error };
    const access = allow.access;

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from('user_roles')
      .select('id, role, staff_id, organization_id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      if (!access.isSuperAdmin && existing.organization_id !== access.organizationId) {
        return { ok: false, error: '自組織のユーザーのみ設定できます。' };
      }
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
      organization_id: access.isSuperAdmin ? null : access.organizationId,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function setUserOrganization(
  userId: string,
  organizationId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const allow = await ensureUserManagementAccess();
    if (!allow.ok) return { ok: false, error: allow.error };
    const access = allow.access;

    const admin = createAdminClient();

    const { data: roleData } = await admin
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single();

    if (roleData?.role !== 'admin') {
      return { ok: false, error: '管理者ユーザーのみ組織を設定できます。' };
    }

    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const targetEmail = (authUser.user?.email || '').trim().toLowerCase();
    if (targetEmail === SUPER_ADMIN_EMAIL) {
      return { ok: false, error: 'スーパー管理者の組織は変更できません。' };
    }

    // 組織管理者は自組織のみ設定可。未設定（NULL）への変更は不可。
    if (!access.isSuperAdmin) {
      if (!access.organizationId) {
        return { ok: false, error: 'あなたの組織情報が未設定です。' };
      }
      if (organizationId !== access.organizationId) {
        return { ok: false, error: '自組織以外には設定できません。' };
      }
      if (roleData?.organization_id !== access.organizationId) {
        return { ok: false, error: '自組織のユーザーのみ変更できます。' };
      }
    }

    const { error } = await admin.from('user_roles').update({ organization_id: organizationId }).eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
