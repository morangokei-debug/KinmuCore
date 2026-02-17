'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  Users,
  Store,
  BarChart3,
  Settings,
  Download,
  LogOut,
  Menu,
  X,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const navigation = [
  { name: '勤怠管理', href: '/attendance', icon: Clock },
  { name: 'シフト', href: '/shifts', icon: CalendarDays },
  { name: 'スタッフ', href: '/staff', icon: Users },
  { name: '店舗管理', href: '/stores', icon: Store },
  { name: 'ポリシー', href: '/policies', icon: Settings },
  { name: 'データ出力', href: '/export', icon: Download },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const NavContent = () => (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <BarChart3 className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-base font-bold text-gray-900">勤怠管理</h1>
          <p className="text-xs text-gray-500">KinmuCore</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon className={cn('h-5 w-5', isActive ? 'text-blue-600' : 'text-gray-400')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-5 w-5 text-gray-400" />
          ログアウト
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* モバイルハンバーガーメニュー */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4">
        <button onClick={() => setMobileOpen(true)} className="p-2 text-gray-600">
          <Menu className="h-6 w-6" />
        </button>
        <div className="ml-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-gray-900">勤怠管理</span>
        </div>
      </div>

      {/* モバイルサイドバーオーバーレイ */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative flex h-full w-64 flex-col bg-white">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 p-1 text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent />
          </div>
        </div>
      )}

      {/* デスクトップサイドバー */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-gray-200 bg-white">
        <NavContent />
      </div>
    </>
  );
}
