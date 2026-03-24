'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useUserRole } from '@/hooks/useUserRole';

const STAFF_ALLOWED_PATHS = ['/shifts', '/punch-select'];

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const role = useUserRole();

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
    if (role !== 'admin') {
      router.replace('/attendance');
    }
  }, [pathname, role, router]);

  return <>{children}</>;
}
