'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Store } from '@/types';

/**
 * ログインユーザーがアクセス可能な店舗一覧を返す。
 * - 管理者: 全店舗
 * - スタッフ: user_roles.staff_id で紐づく店舗のみ
 */
export async function getStoresForCurrentUser(): Promise<Store[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, staff_id')
    .eq('user_id', user.id)
    .single();

  const role = roleData?.role ?? 'admin';
  const staffId = roleData?.staff_id ?? null;

  if (role === 'admin') {
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('is_active', true)
      .order('name');
    return (data || []) as Store[];
  }

  if (role === 'staff' && staffId) {
    const { data: staffData } = await supabase
      .from('staff')
      .select('store_id')
      .eq('id', staffId)
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
