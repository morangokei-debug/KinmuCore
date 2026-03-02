'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'admin' | 'staff';

/**
 * 現在のユーザーのロールを取得。
 * user_roles にレコードがなければ admin（後方互換）
 */
export function useUserRole() {
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        return;
      }

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      // レコードがなければ admin（既存ユーザーはそのまま全機能利用可能）
      setRole((data?.role as UserRole) ?? 'admin');
    };

    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return role;
}
