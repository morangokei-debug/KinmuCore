'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Store as StoreIcon } from 'lucide-react';
import type { Store } from '@/types';
import { createStore, updateStore, toggleStoreActive } from './actions';

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchStores = async () => {
    const { data, error: fetchError } = await supabase.from('stores').select('*').order('created_at');
    if (fetchError) {
      console.error('stores fetch error:', fetchError);
    }
    setStores(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', address: '', phone: '' });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (store: Store) => {
    setEditing(store);
    setForm({ name: store.name, address: store.address || '', phone: store.phone || '' });
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const payload = {
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
    };

    const result = editing
      ? await updateStore(editing.id, payload)
      : await createStore(payload);

    if (!result.success && result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    await fetchStores();
  };

  const handleToggleActive = async (store: Store) => {
    const result = await toggleStoreActive(store.id, store.is_active);
    if (result.success) {
      await fetchStores();
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">店舗管理</h1>
          <p className="mt-1 text-sm text-gray-500">店舗の登録・編集を行います</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          店舗を追加
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">読み込み中...</div>
      ) : stores.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <StoreIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">店舗が登録されていません</p>
            <Button onClick={openCreate} className="mt-4">
              最初の店舗を登録する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Card key={store.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{store.name}</h3>
                  <Badge variant={store.is_active ? 'success' : 'default'}>
                    {store.is_active ? '有効' : '無効'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {store.address && (
                  <p className="text-sm text-gray-500">{store.address}</p>
                )}
                {store.phone && (
                  <p className="text-sm text-gray-500">{store.phone}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(store)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    編集
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(store)}
                  >
                    {store.is_active ? '無効にする' : '有効にする'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? '店舗を編集' : '新しい店舗を登録'}
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Input
            label="店舗名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="〇〇薬局 本店"
            required
          />
          <Input
            label="住所"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="東京都..."
          />
          <Input
            label="電話番号"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="03-1234-5678"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>
              {editing ? '更新する' : '登録する'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
