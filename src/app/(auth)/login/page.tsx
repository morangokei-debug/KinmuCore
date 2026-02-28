'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart3 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configError, setConfigError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || url === 'https://your-project.supabase.co') {
      setConfigError('Supabase が設定されていません。Vercel の環境変数（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）を確認してください。');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (configError) return;
    setLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        const msg = authError.message || 'メールアドレスまたはパスワードが正しくありません';
        if (msg.toLowerCase().includes('fetch') || msg === 'Failed to fetch') {
          setError('サーバーに接続できません。ネットワーク接続と Vercel 環境変数（NEXT_PUBLIC_SUPABASE_*）を確認してください。また Supabase の Authentication > URL Configuration にこのサイトの URL を追加してください。');
        } else {
          setError(msg);
        }
        setLoading(false);
        return;
      }

      window.location.href = '/attendance';
    } catch (err) {
      const msg = err instanceof Error ? err.message : '接続エラーが発生しました';
      if (msg.includes('fetch') || msg.includes('Network')) {
        setError('サーバーに接続できません。Vercel の環境変数と Supabase の URL 設定を確認してください。');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">勤怠管理システム</h1>
          <p className="mt-1 text-sm text-gray-500">KinmuCore</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {configError && (
            <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 border border-amber-200">
              {configError}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              id="email"
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
            <Input
              id="password"
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <Button type="submit" loading={loading} disabled={!!configError} className="w-full">
              ログイン
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
