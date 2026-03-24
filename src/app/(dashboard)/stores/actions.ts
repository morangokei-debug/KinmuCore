'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getOrgContext, getStoresForCurrentUser } from '@/lib/actions/stores';
import type { Organization, Store } from '@/types';

const SUPER_ADMIN_EMAIL = 'logicworks.k@gmail.com';
const RELATION_NOT_FOUND_CODE = '42P01';
const UNDEFINED_COLUMN_CODE = '42703';

const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

async function listOrganizationsSafe(admin: ReturnType<typeof createAdminClient>) {
  const activeQuery = await admin
    .from('organizations')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (!activeQuery.error) {
    return { data: (activeQuery.data || []) as Organization[], warning: null as string | null, errorCode: null as string | null };
  }

  if (activeQuery.error.code === UNDEFINED_COLUMN_CODE) {
    const fallbackQuery = await admin.from('organizations').select('*').order('name');
    if (fallbackQuery.error) {
      return { data: [] as Organization[], warning: fallbackQuery.error.message, errorCode: fallbackQuery.error.code || null };
    }
    return {
      data: (fallbackQuery.data || []) as Organization[],
      warning: 'organizations.is_active が未作成のため、全組織を表示しています。',
      errorCode: null as string | null,
    };
  }

  return { data: [] as Organization[], warning: activeQuery.error.message, errorCode: activeQuery.error.code || null };
}

async function ensureAuthenticated() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: 'ログインが必要です。再ログインしてください。' };
  }
  return { ok: true as const, user };
}

type StorePayload = {
  name: string;
  address?: string | null;
  phone?: string | null;
  organization_id?: string | null;
};

export async function getStorePageData(): Promise<{
  success: true;
  stores: Store[];
  organizations: Organization[];
  canManageOrganizations: boolean;
  organizationId: string | null;
  currentUserEmail: string;
  message?: string;
} | {
  success: false;
  error: string;
}> {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };
  const currentUserEmail = normalizeEmail(auth.user.email);
  const isPrivilegedEmail = currentUserEmail === SUPER_ADMIN_EMAIL;

  const admin = createAdminClient();
  const org = await getOrgContext();
  if (!org) return { success: false, error: 'ユーザー情報の取得に失敗しました。' };

  const stores = isPrivilegedEmail
    ? (((await admin.from('stores').select('*').eq('is_active', true).order('name')).data || []) as Store[])
    : await getStoresForCurrentUser();

  if (org.isSuperAdmin || isPrivilegedEmail) {
    const { data: organizations, warning, errorCode } = await listOrganizationsSafe(admin);
    if (warning) {
      if (errorCode === RELATION_NOT_FOUND_CODE) {
        return {
          success: true,
          stores,
          organizations: [],
          canManageOrganizations: true,
          organizationId: null,
          currentUserEmail,
          message: '組織機能のDB設定が未反映です。マイグレーション 013 を適用すると組織管理が表示されます。',
        };
      }
      return {
        success: true,
        stores,
        organizations,
        canManageOrganizations: true,
        organizationId: null,
        currentUserEmail,
        message: warning,
      };
    }
    return {
      success: true,
      stores,
      organizations,
      canManageOrganizations: true,
      organizationId: null,
      currentUserEmail,
    };
  }

  if (!org.organizationId) {
    return {
      success: true,
      stores,
      organizations: [],
      canManageOrganizations: false,
      organizationId: null,
      currentUserEmail,
      message: '現在のログインは組織未設定の管理者です。スーパー管理者でログインしているか確認してください。',
    };
  }

  const ownActive = await admin
    .from('organizations')
    .select('*')
    .eq('id', org.organizationId)
    .eq('is_active', true);

  let ownOrganizations = ownActive.data as Organization[] | null;
  if (ownActive.error?.code === UNDEFINED_COLUMN_CODE) {
    const ownFallback = await admin.from('organizations').select('*').eq('id', org.organizationId);
    if (ownFallback.error) return { success: false, error: ownFallback.error.message };
    ownOrganizations = ownFallback.data as Organization[] | null;
  } else if (ownActive.error) {
    if (ownActive.error.code === RELATION_NOT_FOUND_CODE) {
      return { success: false, error: 'organizations テーブルが未作成です。マイグレーション 013 を適用してください。' };
    }
    return { success: false, error: ownActive.error.message };
  }

  return {
    success: true,
    stores,
    organizations: (ownOrganizations || []) as Organization[],
    canManageOrganizations: false,
    organizationId: org.organizationId,
    currentUserEmail,
  };
}

export async function createOrganization(name: string) {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };
  const isPrivilegedEmail = normalizeEmail(auth.user.email) === SUPER_ADMIN_EMAIL;

  const org = await getOrgContext();
  if (!org?.isSuperAdmin && !isPrivilegedEmail) {
    return { success: false, error: 'スーパー管理者のみ組織を追加できます。' };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: '組織名を入力してください。' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('organizations').insert({ name: trimmedName });
  if (error) return { success: false, error: error.message };

  revalidatePath('/stores');
  return { success: true };
}

export async function deleteOrganization(organizationId: string): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };
  const isPrivilegedEmail = normalizeEmail(auth.user.email) === SUPER_ADMIN_EMAIL;

  const org = await getOrgContext();
  if (!org?.isSuperAdmin && !isPrivilegedEmail) {
    return { success: false, error: 'スーパー管理者のみ組織を削除できます。' };
  }

  if (!organizationId) {
    return { success: false, error: '削除対象の組織が指定されていません。' };
  }

  const admin = createAdminClient();

  const { data: targetOrg, error: targetError } = await admin
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .single();

  if (targetError || !targetOrg) {
    return { success: false, error: '削除対象の組織が見つかりません。' };
  }

  const allOrgCount = await admin.from('organizations').select('id', { count: 'exact', head: true });
  if (typeof allOrgCount.count === 'number' && allOrgCount.count <= 1) {
    return { success: false, error: '最後の1組織は削除できません。' };
  }

  const storesCountRes = await admin
    .from('stores')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);
  if (storesCountRes.error) {
    return { success: false, error: storesCountRes.error.message };
  }
  if ((storesCountRes.count || 0) > 0) {
    return { success: false, error: '店舗が紐づいているため削除できません。先に店舗を移動または削除してください。' };
  }

  const usersCountRes = await admin
    .from('user_roles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId);
  if (usersCountRes.error && usersCountRes.error.code !== UNDEFINED_COLUMN_CODE) {
    return { success: false, error: usersCountRes.error.message };
  }
  if ((usersCountRes.count || 0) > 0) {
    return { success: false, error: 'ユーザーが紐づいているため削除できません。先にユーザーの所属組織を変更してください。' };
  }

  const { error: deleteError } = await admin.from('organizations').delete().eq('id', organizationId);
  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  revalidatePath('/stores');
  return { success: true };
}

export async function createStore(formData: StorePayload) {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };
  const isPrivilegedEmail = normalizeEmail(auth.user.email) === SUPER_ADMIN_EMAIL;

  const org = await getOrgContext();
  if (!org) return { success: false, error: 'ユーザー情報の取得に失敗しました。' };

  const organizationId = (org.isSuperAdmin || isPrivilegedEmail)
    ? formData.organization_id ?? null
    : org.organizationId;

  if (!organizationId) {
    return { success: false, error: '組織を選択してください。' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('stores').insert({
    name: formData.name,
    address: formData.address || null,
    phone: formData.phone || null,
    organization_id: organizationId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/stores');
  return { success: true };
}

export async function updateStore(
  id: string,
  formData: StorePayload
) {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };
  const isPrivilegedEmail = normalizeEmail(auth.user.email) === SUPER_ADMIN_EMAIL;

  const org = await getOrgContext();
  if (!org) return { success: false, error: 'ユーザー情報の取得に失敗しました。' };

  const admin = createAdminClient();
  const { data: targetStore, error: targetError } = await admin
    .from('stores')
    .select('id, organization_id')
    .eq('id', id)
    .single();

  if (targetError || !targetStore) {
    return { success: false, error: '対象店舗が見つかりません。' };
  }

  if (!org.isSuperAdmin && !isPrivilegedEmail && targetStore.organization_id !== org.organizationId) {
    return { success: false, error: '他組織の店舗は更新できません。' };
  }

  const nextOrganizationId = (org.isSuperAdmin || isPrivilegedEmail)
    ? formData.organization_id ?? targetStore.organization_id
    : org.organizationId;

  if (!nextOrganizationId) {
    return { success: false, error: '組織を設定してください。' };
  }

  const { error } = await admin
    .from('stores')
    .update({
      name: formData.name,
      address: formData.address || null,
      phone: formData.phone || null,
      organization_id: nextOrganizationId,
    })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/stores');
  return { success: true };
}

export async function toggleStoreActive(id: string, isActive: boolean) {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };
  const isPrivilegedEmail = normalizeEmail(auth.user.email) === SUPER_ADMIN_EMAIL;

  const org = await getOrgContext();
  if (!org) return { success: false, error: 'ユーザー情報の取得に失敗しました。' };

  const admin = createAdminClient();
  if (!org.isSuperAdmin && !isPrivilegedEmail) {
    const { data: targetStore } = await admin.from('stores').select('organization_id').eq('id', id).single();
    if (!targetStore || targetStore.organization_id !== org.organizationId) {
      return { success: false, error: '他組織の店舗は変更できません。' };
    }
  }

  const { error } = await admin.from('stores').update({ is_active: !isActive }).eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/stores');
  return { success: true };
}
