'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Plus, Pencil, Settings } from 'lucide-react';
import type { Policy, Store, RoundingUnit, BreakDeductionType, ClosingDay } from '@/types';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<(Policy & { store: Store })[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    store_id: '',
    name: 'デフォルトポリシー',
    closing_day_type: 'end_of_month' as ClosingDay,
    closing_day_custom: '',
    rounding_unit: '1' as string,
    break_deduction_type: 'manual' as BreakDeductionType,
    auto_break_threshold_minutes: '',
    auto_break_deduction_minutes: '',
    enable_paid_leave: false,
    enable_correction_approval: true,
    standard_work_start_time: '',
    standard_work_end_time: '',
    allow_early_clock_in: true,
    count_early_minutes: true,
    shift_start_day: '1',
    effective_from: new Date().toISOString().split('T')[0],
  });
  const supabase = createClient();

  const fetchData = async () => {
    const [policiesRes, storesRes] = await Promise.all([
      supabase.from('policies').select('*, store:stores(*)').order('created_at', { ascending: false }),
      supabase.from('stores').select('*').eq('is_active', true).order('name'),
    ]);
    setPolicies((policiesRes.data as (Policy & { store: Store })[]) || []);
    setStores(storesRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      store_id: stores[0]?.id || '',
      name: 'デフォルトポリシー',
      closing_day_type: 'end_of_month',
      closing_day_custom: '',
      rounding_unit: '1',
      break_deduction_type: 'manual',
      auto_break_threshold_minutes: '',
      auto_break_deduction_minutes: '',
      enable_paid_leave: false,
      enable_correction_approval: true,
      standard_work_start_time: '',
      standard_work_end_time: '',
      allow_early_clock_in: true,
      count_early_minutes: true,
      shift_start_day: '1',
      effective_from: new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const openEdit = (policy: Policy) => {
    setEditing(policy);
    setForm({
      store_id: policy.store_id,
      name: policy.name,
      closing_day_type: policy.closing_day_type,
      closing_day_custom: policy.closing_day_custom?.toString() || '',
      rounding_unit: policy.rounding_unit.toString(),
      break_deduction_type: policy.break_deduction_type,
      auto_break_threshold_minutes: policy.auto_break_threshold_minutes?.toString() || '',
      auto_break_deduction_minutes: policy.auto_break_deduction_minutes?.toString() || '',
      enable_paid_leave: policy.enable_paid_leave,
      enable_correction_approval: policy.enable_correction_approval,
      standard_work_start_time: policy.standard_work_start_time || '',
      standard_work_end_time: policy.standard_work_end_time || '',
      allow_early_clock_in: policy.allow_early_clock_in,
      count_early_minutes: policy.count_early_minutes,
      shift_start_day: policy.shift_start_day?.toString() || '1',
      effective_from: policy.effective_from,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      store_id: form.store_id,
      name: form.name,
      closing_day_type: form.closing_day_type,
      closing_day_custom: form.closing_day_type === 'custom' ? parseInt(form.closing_day_custom) || null : null,
      rounding_unit: parseInt(form.rounding_unit) as RoundingUnit,
      break_deduction_type: form.break_deduction_type,
      auto_break_threshold_minutes:
        form.break_deduction_type === 'auto' ? parseInt(form.auto_break_threshold_minutes) || null : null,
      auto_break_deduction_minutes:
        form.break_deduction_type === 'auto' ? parseInt(form.auto_break_deduction_minutes) || null : null,
      enable_paid_leave: form.enable_paid_leave,
      enable_correction_approval: form.enable_correction_approval,
      standard_work_start_time: form.standard_work_start_time || null,
      standard_work_end_time: form.standard_work_end_time || null,
      allow_early_clock_in: form.allow_early_clock_in,
      count_early_minutes: form.count_early_minutes,
      shift_start_day: parseInt(form.shift_start_day) || 1,
      effective_from: form.effective_from,
    };

    if (editing) {
      await supabase.from('policies').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('policies').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    fetchData();
  };

  const roundingLabels: Record<string, string> = {
    '1': '1分単位',
    '5': '5分単位',
    '15': '15分単位',
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ポリシー管理</h1>
          <p className="mt-1 text-sm text-gray-500">店舗ごとの就業ルールを設定します</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          ポリシーを追加
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">読み込み中...</div>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Settings className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-4 text-gray-500">ポリシーが設定されていません</p>
            <Button onClick={openCreate} className="mt-4">
              ポリシーを作成する
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                    <p className="text-sm text-gray-500">{policy.store?.name}</p>
                  </div>
                  <Badge variant={policy.is_active ? 'success' : 'default'}>
                    {policy.is_active ? '有効' : '無効'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <dt className="text-gray-500">締め日</dt>
                  <dd className="text-gray-900">
                    {policy.closing_day_type === 'end_of_month'
                      ? '月末'
                      : `${policy.closing_day_custom}日`}
                  </dd>
                  <dt className="text-gray-500">丸め単位</dt>
                  <dd className="text-gray-900">{roundingLabels[policy.rounding_unit.toString()]}</dd>
                  <dt className="text-gray-500">休憩控除</dt>
                  <dd className="text-gray-900">
                    {policy.break_deduction_type === 'manual' ? '手動' : '自動'}
                  </dd>
                  <dt className="text-gray-500">有給機能</dt>
                  <dd className="text-gray-900">{policy.enable_paid_leave ? 'ON' : 'OFF'}</dd>
                  <dt className="text-gray-500">修正承認</dt>
                  <dd className="text-gray-900">
                    {policy.enable_correction_approval ? 'ON' : 'OFF'}
                  </dd>
                  <dt className="text-gray-500">シフト開始日</dt>
                  <dd className="text-gray-900">{policy.shift_start_day}日</dd>
                  <dt className="text-gray-500">適用開始</dt>
                  <dd className="text-gray-900">{policy.effective_from}</dd>
                </dl>
                <div className="mt-4">
                  <Button variant="outline" size="sm" onClick={() => openEdit(policy)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    編集
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
        title={editing ? 'ポリシーを編集' : 'ポリシーを作成'}
        className="max-w-xl"
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <Input
            label="ポリシー名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Select
            label="対象店舗"
            options={stores.map((s) => ({ value: s.id, label: s.name }))}
            value={form.store_id}
            onChange={(e) => setForm({ ...form, store_id: e.target.value })}
          />
          <Select
            label="締め日"
            options={[
              { value: 'end_of_month', label: '月末' },
              { value: 'custom', label: '任意の日' },
            ]}
            value={form.closing_day_type}
            onChange={(e) => setForm({ ...form, closing_day_type: e.target.value as ClosingDay })}
          />
          {form.closing_day_type === 'custom' && (
            <Input
              label="締め日（日）"
              type="number"
              min={1}
              max={28}
              value={form.closing_day_custom}
              onChange={(e) => setForm({ ...form, closing_day_custom: e.target.value })}
            />
          )}
          <Select
            label="勤怠丸め単位"
            options={[
              { value: '1', label: '1分単位' },
              { value: '5', label: '5分単位' },
              { value: '15', label: '15分単位' },
            ]}
            value={form.rounding_unit}
            onChange={(e) => setForm({ ...form, rounding_unit: e.target.value })}
          />
          <Select
            label="休憩控除方法"
            options={[
              { value: 'manual', label: '手動（打刻ベース）' },
              { value: 'auto', label: '自動控除' },
            ]}
            value={form.break_deduction_type}
            onChange={(e) => setForm({ ...form, break_deduction_type: e.target.value as BreakDeductionType })}
          />
          {form.break_deduction_type === 'auto' && (
            <>
              <Input
                label="自動控除の閾値（分）"
                type="number"
                value={form.auto_break_threshold_minutes}
                onChange={(e) => setForm({ ...form, auto_break_threshold_minutes: e.target.value })}
                placeholder="例: 360（6時間以上で控除）"
              />
              <Input
                label="自動控除時間（分）"
                type="number"
                value={form.auto_break_deduction_minutes}
                onChange={(e) => setForm({ ...form, auto_break_deduction_minutes: e.target.value })}
                placeholder="例: 60"
              />
            </>
          )}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">勤務時間設定（早出・残業制御）</h3>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="標準始業時刻"
                type="time"
                value={form.standard_work_start_time}
                onChange={(e) => setForm({ ...form, standard_work_start_time: e.target.value })}
                placeholder="09:00"
              />
              <Input
                label="標準終業時刻"
                type="time"
                value={form.standard_work_end_time}
                onChange={(e) => setForm({ ...form, standard_work_end_time: e.target.value })}
                placeholder="18:00"
              />
            </div>
            <div className="mt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.allow_early_clock_in}
                  onChange={(e) => setForm({ ...form, allow_early_clock_in: e.target.checked })}
                  className="rounded border-gray-300"
                />
                始業時刻前の打刻を許可する
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={form.count_early_minutes}
                  onChange={(e) => setForm({ ...form, count_early_minutes: e.target.checked })}
                  className="rounded border-gray-300"
                />
                始業時刻前の時間を勤務時間にカウントする
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              ※設定した標準始業時刻より前の時間を勤務時間から除外できます（シフト連携の基盤）
            </p>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">シフト設定</h3>
            <Input
              label="シフト表の月開始日"
              type="number"
              min={1}
              max={28}
              value={form.shift_start_day}
              onChange={(e) => setForm({ ...form, shift_start_day: e.target.value })}
              placeholder="例: 11（11日始まり）"
            />
            <p className="mt-1 text-xs text-gray-500">
              ※シフト表の月表示範囲が変わります（例: 11→11日〜翌月10日）
            </p>
          </div>
          <Input
            label="適用開始日"
            type="date"
            value={form.effective_from}
            onChange={(e) => setForm({ ...form, effective_from: e.target.value })}
          />
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enable_correction_approval}
                onChange={(e) => setForm({ ...form, enable_correction_approval: e.target.checked })}
                className="rounded border-gray-300"
              />
              打刻修正の承認フローを有効にする
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enable_paid_leave}
                onChange={(e) => setForm({ ...form, enable_paid_leave: e.target.checked })}
                className="rounded border-gray-300"
              />
              有給管理機能を有効にする（将来機能）
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.store_id || !form.name}>
              {editing ? '更新する' : '作成する'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
