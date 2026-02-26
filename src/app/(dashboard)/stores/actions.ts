'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createStore(formData: { name: string; address?: string | null; phone?: string | null }) {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('stores').insert({
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
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
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
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from('stores').update({ is_active: !isActive }).eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/stores');
  return { success: true };
}
