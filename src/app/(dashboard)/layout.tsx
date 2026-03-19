import { Sidebar } from '@/components/layout/sidebar';
import { RoleGuard } from '@/components/auth/RoleGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard>
      <div className="min-h-screen">
        <Sidebar />
        <main className="lg:pl-64 print:!pl-0">
          <div className="pt-14 lg:pt-0 print:!pt-0">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 print:!max-w-none print:!px-0 print:!py-0">{children}</div>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
