'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Users, Trash2, UserX } from 'lucide-react';
import type { Staff, Store, EmploymentType, StaffStatus } from '@/types';
import { EMPLOYMENT_TYPE_LABELS, STAFF_STATUS_LABELS } from '@/types';

export default function StaffPage() {
  const [staffList, setStaffList] = useState<(Staff & { store: Store })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [retireModalOpen, setRetireModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [targetStaff, setTargetStaff] = useState<Staff | null>(null);
  const [filterStore, setFilterStore] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [retireDate, setRetireDate] = useState(new Date().toISOString().split('T')[0]);
  const [form, setForm] = useState({
    name: '',
    name_kana: '',
    store_id: '',
    employment_type: 'part_time' as EmploymentType,
    hourly_rate: '',
  });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  const fetchData = async () => {
    const [staffRes, storesRes] = await Promise.all([
      supabase.from('staff').select('*, store:stores(*)').order('display_order').order('name'),
      supabase.from('stores').select('*').eq('is_active', true).order('name'),
    ]);
    setStaffList((staffRes.data as (Staff & { store: Store })[]) || []);
    setStores(storesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      name_kana: '',
      store_id: stores[0]?.id || '',
      employment_type: 'part_time',
      hourly_rate: '',
    });
    setModalOpen(true);
  };

  const openEdit = (staff: Staff) => {
    setEditing(staff);
    setForm({
      name: staff.name,
      name_kana: staff.name_kana || '',
      store_id: staff.store_id,
      employment_type: staff.employment_type,
      hourly_rate: staff.hourly_rate?.toString() || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      name_kana: form.name_kana || null,
      store_id: form.store_id,
      employment_type: form.employment_type,
      hourly_rate: form.hourly_rate ? parseInt(form.hourly_rate) : null,
    };

    if (editing) {
      await supabase.from('staff').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('staff').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  // 退職処理
  const openRetire = (staff: Staff) => {
    setTargetStaff(staff);
    setRetireDate(new Date().toISOString().split('T')[0]);
    setRetireModalOpen(true);
  };

  const handleRetire = async () => {
    if (!targetStaff) return;
    await supabase
      .from('staff')
      .update({ status: 'retired', retired_at: retireDate })
      .eq('id', targetStaff.id);
    setRetireModalOpen(false);
    setTargetStaff(null);
    fetchData();
  };

  // 復帰処理
  const handleReactivate = async (staff: Staff) => {
    await supabase
      .from('staff')
      .update({ status: 'active', retired_at: null })
      .eq('id', staff.id);
    fetchData();
  };

  // 休職処理
  const handleInactivate = async (staff: Staff) => {
    await supabase.from('staff').update({ status: 'inactive' }).eq('id', staff.id);
    fetchData();
  };

  // 削除処理
  const openDelete = (staff: Staff) => {
    setTargetStaff(staff);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!targetStaff) return;
    const { error } = await supabase.from('staff').delete().eq('id', targetStaff.id);
    if (error) {
      alert('このスタッフには勤怠データが紐付いているため削除できません。\n代わりに「退職」処理をご利用ください。');
    }
    setDeleteModalOpen(false);
    setTargetStaff(null);
    fetchData();
  };

  const filtered = staffList.filter((s) => {
    if (filterStore && s.store_id !== filterStore) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const statusBadgeVariant = (status: StaffStatus) => {
    const map: Record<StaffStatus, 'success' | 'warning' | 'default'> = {
      active: 'success',
      inactive: 'warning',
      retired: 'default',
    };
    return map[status];
  };

  const activeCount = staffList.filter((s) => s.status === 'active').length;
  const retiredCount = staffList.filter((s) => s.status === 'retired').length;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">スタッフ管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            全{staffList.length}名（在籍: {activeCount}名 / 退職: {retiredCount}名）
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            options={[
              { value: '', label: '全状態' },
              { value: 'active', label: '在籍' },
              { value: 'inactive', label: '休職中' },
              { value: 'retired', label: '退職' },
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-28"
          />
          <Select
            options={[{ value: '', label: '全店舗' }, ...stores.map((s) => ({ value: s.id, label: s.name }))]}
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="w-40"
          />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            追加
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">
              {filterStatus === 'active' ? 'スタッフが登録されていません' : '該当するスタッフがいません'}
            </p>
            {filterStatus === 'active' && (
              <Button onClick={openCreate} className="mt-4">
                スタッフを登録する
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">氏名</th>
                <th className="px-4 py-3 font-medium">フリガナ</th>
                <th className="px-4 py-3 font-medium">所属店舗</th>
                <th className="px-4 py-3 font-medium">雇用形態</th>
                <th className="px-4 py-3 font-medium">時給</th>
                <th className="px-4 py-3 font-medium">状態</th>
                <th className="px-4 py-3 font-medium">退職日</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((staff) => (
                <tr key={staff.id} className={`hover:bg-gray-50 ${staff.status === 'retired' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{staff.name}</td>
                  <td className="px-4 py-3 text-gray-500">{staff.name_kana || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{staff.store?.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={staff.employment_type === 'full_time' ? 'info' : 'default'}>
                      {EMPLOYMENT_TYPE_LABELS[staff.employment_type]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {staff.hourly_rate ? `¥${staff.hourly_rate.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusBadgeVariant(staff.status)}>
                      {STAFF_STATUS_LABELS[staff.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {staff.retired_at || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(staff)} title="編集">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {staff.status === 'active' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleInactivate(staff)} title="休職にする">
                            休職
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openRetire(staff)} title="退職処理" className="text-red-500 hover:text-red-700">
                            <UserX className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {staff.status === 'inactive' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => handleReactivate(staff)}>
                            復帰
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openRetire(staff)} className="text-red-500 hover:text-red-700">
                            <UserX className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {staff.status === 'retired' && (
                        <Button variant="ghost" size="sm" onClick={() => handleReactivate(staff)}>
                          復帰
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openDelete(staff)} title="削除" className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 登録・編集モーダル */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'スタッフを編集' : 'スタッフを追加'}
      >
        <div className="space-y-4">
          <Input
            label="氏名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="山田 太郎"
            required
          />
          <Input
            label="フリガナ"
            value={form.name_kana}
            onChange={(e) => setForm({ ...form, name_kana: e.target.value })}
            placeholder="ヤマダ タロウ"
          />
          <Select
            label="所属店舗"
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
            value={form.store_id}
            onChange={(e) => setForm({ ...form, store_id: e.target.value })}
          />
          <Select
            label="雇用形態"
            options={[
              { value: 'full_time', label: '正社員' },
              { value: 'part_time', label: 'パート' },
              { value: 'contractor', label: '業務委託' },
            ]}
            value={form.employment_type}
            onChange={(e) => setForm({ ...form, employment_type: e.target.value as EmploymentType })}
          />
          <Input
            label="時給（円）"
            type="number"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
            placeholder="1200"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name || !form.store_id}>
              {editing ? '更新する' : '登録する'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 退職モーダル */}
      <Modal
        open={retireModalOpen}
        onClose={() => setRetireModalOpen(false)}
        title="退職処理"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{targetStaff?.name}</span> さんを退職処理します。
          </p>
          <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
            退職処理を行うと、シフトや打刻画面にこのスタッフが表示されなくなります。
            勤怠データは保持されます。必要に応じて「復帰」も可能です。
          </div>
          <Input
            label="退職日"
            type="date"
            value={retireDate}
            onChange={(e) => setRetireDate(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRetireModalOpen(false)}>
              キャンセル
            </Button>
            <Button variant="danger" onClick={handleRetire}>
              退職処理を実行
            </Button>
          </div>
        </div>
      </Modal>

      {/* 削除確認モーダル */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="スタッフ削除"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{targetStaff?.name}</span> さんを完全に削除しますか？
          </p>
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">注意</p>
            <ul className="mt-1 list-disc pl-4 space-y-1">
              <li>この操作は取り消せません</li>
              <li>勤怠データが紐付いている場合は削除できません</li>
              <li>通常は「退職処理」をおすすめします</li>
            </ul>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)}>
              キャンセル
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              完全に削除する
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
