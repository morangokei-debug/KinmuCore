'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Store } from '@/types';

const SUPER_ADMIN_EMAILS = new Set(['logicworks.k@gmail.com']);

export type OrgContext = {
  role: 'admin' | 'staff';
  isSuperAdmin: boolean;
  organizationId: string | null;
  staffId: string | null;
};

/**
 * ログインユーザーの組織コンテキストを返す。
 * - スーパー管理者: role=admin かつ特権メール
 * - 組織管理者: role=admin かつ organization_id=UUID
 * - スタッフ: role=staff
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, staff_id, organization_id')
    .eq('user_id', user.id)
    .single();

  const role = (roleData?.role as 'admin' | 'staff' | undefined) ?? 'admin';
  const staffId = roleData?.staff_id ?? null;
  const isPrivilegedEmail = !!user.email && SUPER_ADMIN_EMAILS.has(user.email.toLowerCase());

  if (role === 'admin') {
    const organizationId = roleData?.organization_id ?? null;
    return {
      role,
      staffId: null,
      organizationId,
      isSuperAdmin: isPrivilegedEmail,
    };
  }

  if (role === 'staff' && staffId) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('store_id, store:stores(organization_id)')
      .eq('id', staffId)
      .single();

    const store = Array.isArray(staffData?.store) ? staffData?.store[0] : staffData?.store;
    return {
      role,
      staffId,
      organizationId: (store?.organization_id as string | null | undefined) ?? null,
      isSuperAdmin: false,
    };
  }

  return {
    role,
    staffId,
    organizationId: null,
    isSuperAdmin: false,
  };
}

/**
 * ログインユーザーがアクセス可能な店舗一覧を返す。
 * - スーパー管理者: 全店舗
 * - 組織管理者: 自組織の店舗のみ
 * - スタッフ: user_roles.staff_id で紐づく店舗のみ
 */
export async function getStoresForCurrentUser(): Promise<Store[]> {
  const supabase = await createServerSupabaseClient();
  const org = await getOrgContext();
  if (!org) return [];

  if (org.role === 'admin' && org.isSuperAdmin) {
    const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('name');
    return (data || []) as Store[];
  }

  if (org.role === 'admin' && org.organizationId) {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('organization_id', org.organizationId)
      .eq('is_active', true)
      .order('name');
    return (data || []) as Store[];
  }

  if (org.role === 'staff' && org.staffId) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('store_id')
      .eq('id', org.staffId)
      .single();
    if (!staffData?.store_id) return [];

    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('id', staffData.store_id)
      .eq('is_active', true)
      .order('name');
    return (data || []) as Store[];
  }

  return [];
}
