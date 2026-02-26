'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

async function ensureAuthenticated() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, error: 'ログインが必要です。再ログインしてください。' };
  }
  return { ok: true as const };
}

export async function createStore(formData: { name: string; address?: string | null; phone?: string | null }) {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin.from('stores').insert({
    name: formData.name,
    address: formData.address || null,
    phone: formData.phone || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/stores');
  return { success: true };
}

export async function updateStore(
  id: string,
  formData: { name: string; address?: string | null; phone?: string | null }
) {
  const auth = await ensureAuthenticated();
  if (!auth.ok) return { success: false, error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from('stores')
    .update({
      name: formData.name,
      address: formData.address || null,
      phone: formData.phone || null,
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

  const admin = createAdminClient();
  const { error } = await admin.from('stores').update({ is_active: !isActive }).eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/stores');
  return { success: true };
}
