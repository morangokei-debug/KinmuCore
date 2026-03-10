'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Smartphone, CalendarDays } from 'lucide-react';
import type { Store } from '@/types';
import { getStoresForCurrentUser } from '@/lib/actions/stores';

export default function PunchSelectPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoresForCurrentUser().then((data) => {
      setStores(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">読み込み中...</div>
    );
  }

  return (
    <div>
      {/* モバイル：シフトへのクイックリンク（ハンバーガーを開かなくても戻れる） */}
      <Link
        href="/shifts"
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 lg:hidden"
      >
        <CalendarDays className="h-4 w-4" />
        シフトに戻る
      </Link>

      <h1 className="text-2xl font-bold text-gray-900">打刻画面</h1>
      <p className="mt-1 text-sm text-gray-500">店舗を選択して打刻画面を開いてください</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <Card key={store.id}>
            <CardHeader className="pb-2">
              <h2 className="font-semibold text-gray-900">{store.name}</h2>
            </CardHeader>
            <CardContent>
              <Link
                href={`/punch/${store.id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                <Smartphone className="h-4 w-4" />
                打刻画面を開く
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {stores.length === 0 && (
        <Card className="mt-6">
          <CardContent className="py-12 text-center text-gray-500">
            店舗が登録されていません
          </CardContent>
        </Card>
      )}
    </div>
  );
}
