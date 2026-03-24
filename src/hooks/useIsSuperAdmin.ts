'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SUPER_ADMIN_EMAIL = 'logicworks.k@gmail.com';

export function useIsSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = (user?.email || '').trim().toLowerCase();
      setIsSuperAdmin(email === SUPER_ADMIN_EMAIL);
    };

    check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => subscription.unsubscribe();
  }, []);

  return isSuperAdmin;
}
