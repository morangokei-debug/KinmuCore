'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Shield, User } from 'lucide-react';
import { listUsersWithRoles, createUser, setUserRole, listStaff } from './actions';
import type { UserWithRole } from './actions';

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', role: 'staff' as 'admin' | 'staff', staff_id: '' });
  const [staffList, setStaffList] = useState<{ id: string; name: string; store_id: string; store?: { name: string } }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    const res = await listUsersWithRoles();
    if (res.ok) {
      setUsers(res.users);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    listStaff().then(setStaffList);
  }, []);

  const handleCreate = async () => {
    setError('');
    if (!createForm.email || !createForm.password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    setSaving(true);
    const res = await createUser(createForm.email, createForm.password, createForm.role, createForm.staff_id || null);
    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      setCreateForm({ email: '', password: '', role: 'staff', staff_id: '' });
      fetchUsers();
    } else {
      setError(res.error);
    }
  };

  const handleRoleChange = async (userId: string, role: 'admin' | 'staff', staffId?: string | null) => {
    const res = await setUserRole(userId, role, staffId);
    if (res.ok) {
      fetchUsers();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
          <p className="mt-1 text-sm text-gray-500">ログインユーザーの作成と権限設定</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          ユーザーを追加
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-semibold text-gray-900">登録ユーザー一覧</h2>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">読み込み中...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="px-4 py-3 font-medium">メールアドレス</th>
                    <th className="px-4 py-3 font-medium">権限</th>
                    <th className="px-4 py-3 font-medium">紐づけスタッフ</th>
                    <th className="px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-gray-900">{user.email || '(未設定)'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                          {user.role === 'admin' ? '管理者' : 'スタッフ'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {user.role === 'staff' && (
                          <select
                            value={user.staff_id || ''}
                            onChange={(e) => handleRoleChange(user.id, 'staff', e.target.value || null)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            <option value="">未設定</option>
                            {staffList.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRoleChange(user.id, 'admin')}
                            className={`rounded px-2 py-1 text-xs ${user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            <Shield className="inline h-3 w-3 mr-1" />
                            管理者
                          </button>
                          <button
                            onClick={() => handleRoleChange(user.id, 'staff', user.staff_id ?? undefined)}
                            className={`rounded px-2 py-1 text-xs ${user.role === 'staff' ? 'bg-gray-200 text-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
                          >
                            <User className="inline h-3 w-3 mr-1" />
                            スタッフ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="ユーザーを追加">
        <div className="space-y-4">
          <Input
            id="new-email"
            label="メールアドレス"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            placeholder="staff@example.com"
          />
          <Input
            id="new-password"
            label="パスワード"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            placeholder="••••••••"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">権限</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  checked={createForm.role === 'admin'}
                  onChange={() => setCreateForm({ ...createForm, role: 'admin', staff_id: '' })}
                  className="rounded"
                />
                管理者
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="role"
                  checked={createForm.role === 'staff'}
                  onChange={() => setCreateForm({ ...createForm, role: 'staff' })}
                  className="rounded"
                />
                スタッフ
              </label>
            </div>
          </div>
          {createForm.role === 'staff' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">紐づけるスタッフ（有給申請に必要）</label>
              <select
                value={createForm.staff_id}
                onChange={(e) => setCreateForm({ ...createForm, staff_id: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">選択してください</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.store && `(${(s.store as { name?: string }).name})`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              作成
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
