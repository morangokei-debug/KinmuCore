import type { SupabaseClient } from '@supabase/supabase-js';
import type { Store } from '@/types';

const SUPER_ADMIN_EMAIL = 'logicworks.k@gmail.com';

export async function getAccessibleStoresForCurrentUser(
  supabase: SupabaseClient
): Promise<{ stores: Store[]; isSuperAdmin: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { stores: [], isSuperAdmin: false };

  const email = (user.email || '').trim().toLowerCase();
  const isSuperAdmin = email === SUPER_ADMIN_EMAIL;

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role, staff_id, organization_id')
    .eq('user_id', user.id)
    .single();

  const role = (roleData?.role as 'admin' | 'staff' | undefined) ?? 'admin';
  const staffId = roleData?.staff_id ?? null;
  const organizationId = roleData?.organization_id ?? null;

  if (isSuperAdmin) {
    const { data } = await supabase.from('stores').select('*').eq('is_active', true).order('name');
    return { stores: (data || []) as Store[], isSuperAdmin: true };
  }

  if (role === 'admin') {
    if (!organizationId) return { stores: [], isSuperAdmin: false };
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');
    return { stores: (data || []) as Store[], isSuperAdmin: false };
  }

  if (role === 'staff' && staffId) {
    const { data: staffData } = await supabase.from('staff').select('store_id').eq('id', staffId).single();
    if (!staffData?.store_id) return { stores: [], isSuperAdmin: false };
    const { data } = await supabase
      .from('stores')
      .select('*')
      .eq('id', staffData.store_id)
      .eq('is_active', true);
    return { stores: (data || []) as Store[], isSuperAdmin: false };
  }

  return { stores: [], isSuperAdmin: false };
}
