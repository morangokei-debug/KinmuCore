'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Store as StoreIcon, Trash2 } from 'lucide-react';
import type { Organization, Store } from '@/types';
import { createOrganization, createStore, deleteOrganization, getStorePageData, updateStore, toggleStoreActive } from './actions';

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [canManageOrganizations, setCanManageOrganizations] = useState(false);
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);
  const [deletingOrganizationId, setDeletingOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', organization_id: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStores = async () => {
    const result = await getStorePageData();
    if (!result.success) {
      setError(result.error);
      setInfoMessage(null);
      setLoading(false);
      return;
    }
    setError(null);
    setStores(result.stores || []);
    setOrganizations(result.organizations || []);
    setCanManageOrganizations(result.canManageOrganizations);
    setCurrentOrganizationId(result.organizationId);
    setCurrentUserEmail(result.currentUserEmail || '');
    setInfoMessage(result.message || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      address: '',
      phone: '',
      organization_id: currentOrganizationId || organizations[0]?.id || '',
    });
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (store: Store) => {
    setEditing(store);
    setForm({
      name: store.name,
      address: store.address || '',
      phone: store.phone || '',
      organization_id: store.organization_id || currentOrganizationId || organizations[0]?.id || '',
    });
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
      organization_id: form.organization_id || null,
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

  const handleCreateOrganization = async () => {
    if (!newOrganizationName.trim()) {
      setError('組織名を入力してください。');
      return;
    }
    setOrgSaving(true);
    setError(null);
    const result = await createOrganization(newOrganizationName);
    setOrgSaving(false);
    if (!result.success && result.error) {
      setError(result.error);
      return;
    }
    setNewOrganizationName('');
    await fetchStores();
  };

  const handleDeleteOrganization = async (organization: Organization) => {
    if (!window.confirm(`組織「${organization.name}」を削除します。よろしいですか？`)) return;
    if (!window.confirm('この操作は取り消せません。関連データがないことを確認しましたか？')) return;

    const typed = window.prompt(`最終確認です。削除する組織名「${organization.name}」を入力してください。`);
    if (typed !== organization.name) {
      alert('組織名が一致しないため、削除を中止しました。');
      return;
    }

    setDeletingOrganizationId(organization.id);
    setError(null);
    const result = await deleteOrganization(organization.id);
    setDeletingOrganizationId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await fetchStores();
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

      {currentUserEmail && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
          現在のログイン: {currentUserEmail}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {infoMessage && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {infoMessage}
        </div>
      )}

      {canManageOrganizations && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">組織管理（スーパー管理者のみ）</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                label="新しい組織名"
                value={newOrganizationName}
                onChange={(e) => setNewOrganizationName(e.target.value)}
                placeholder="例: 〇〇株式会社"
              />
              <div className="sm:pt-6">
                <Button onClick={handleCreateOrganization} loading={orgSaving} disabled={!newOrganizationName.trim()}>
                  組織を追加
                </Button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {organizations.map((organization) => (
                <div
                  key={organization.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <div className="text-sm text-gray-800">{organization.name}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteOrganization(organization)}
                    loading={deletingOrganizationId === organization.id}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    削除
                  </Button>
                </div>
              ))}
              {organizations.length === 0 && (
                <div className="text-sm text-gray-500">組織がまだありません。</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
          {organizations.length > 0 && (
            <Select
              label="所属組織"
              options={organizations.map((o) => ({ value: o.id, label: o.name }))}
              value={form.organization_id}
              onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
            />
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name || !form.organization_id}>
              {editing ? '更新する' : '登録する'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
