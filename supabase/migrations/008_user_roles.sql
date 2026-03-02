-- ========================================
-- ユーザーロール（スタッフ権限）
-- 既存テーブル・既存データには一切触れません
-- ========================================

-- 新規テーブルのみ作成
CREATE TABLE user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')) DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

COMMENT ON TABLE user_roles IS 'ログインユーザーの権限。admin=全機能、staff=打刻・シフトのみ';

-- RLS: 認証済みユーザーは自分のロールを読める
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role" ON user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 挿入・更新・削除は service_role（admin client）で実行。RLS をバイパスするためポリシー不要
