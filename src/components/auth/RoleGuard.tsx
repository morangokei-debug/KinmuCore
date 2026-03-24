'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';

const STAFF_ALLOWED_PATHS = ['/shifts', '/punch-select'];

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useUserRole();
  const isSuperAdmin = useIsSuperAdmin();

  useEffect(() => {
    if (role !== 'staff') return;

    const isAllowed = STAFF_ALLOWED_PATHS.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      router.replace('/shifts');
    }
  }, [role, pathname, router]);

  useEffect(() => {
    if (!pathname.startsWith('/users')) return;
    if (role === null) return;
    if (!isSuperAdmin) {
      router.replace('/attendance');
    }
  }, [pathname, role, isSuperAdmin, router]);

  return <>{children}</>;
}
