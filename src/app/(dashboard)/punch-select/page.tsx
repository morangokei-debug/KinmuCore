'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import type { Store } from '@/types';

export default function PunchSelectPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStores = async () => {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setStores(data || []);
      setLoading(false);
    };
    fetchStores();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500">読み込み中...</div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">打刻画面</h1>
      <p className="mt-1 text-sm text-gray-500">店舗を選択して打刻画面を開いてください</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => (
          <Card key={store.id}>
            <CardHeader className="pb-2">
              <h2 className="font-semibold text-gray-900">{store.name}</h2>
            </CardHeader>
            <CardContent>
              <a
                href={`/punch/${store.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                打刻画面を開く
              </a>
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
