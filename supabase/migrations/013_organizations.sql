-- ========================================
-- 組織分離（マルチテナント）
-- ========================================

-- 1) 組織テーブル
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_name_unique ON organizations(name);

-- updated_at トリガー（既存関数を利用）
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2) stores に organization_id 追加
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE RESTRICT;

-- 3) user_roles に organization_id 追加
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- 4) 既存データ移行用のデフォルト組織を作成
INSERT INTO organizations (name)
SELECT '既存組織'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE name = '既存組織');

-- 5) 既存店舗を既存組織へ紐づけ
UPDATE stores
SET organization_id = o.id
FROM organizations o
WHERE o.name = '既存組織'
  AND stores.organization_id IS NULL;

-- organization_id を必須化（店舗は必ずどこかの組織に所属）
ALTER TABLE stores
  ALTER COLUMN organization_id SET NOT NULL;

-- 6) 既存ユーザー権限へ組織を付与
-- 管理者は既存組織へ（後でスーパー管理者だけNULLに戻す）
UPDATE user_roles
SET organization_id = o.id
FROM organizations o
WHERE o.name = '既存組織'
  AND user_roles.role = 'admin'
  AND user_roles.organization_id IS NULL;

-- スーパー管理者は NULL 扱い（全組織アクセス）
UPDATE user_roles ur
SET organization_id = NULL
FROM auth.users au
WHERE ur.user_id = au.id
  AND au.email = 'logicworks.k@gmail.com';

-- スタッフ権限は staff -> stores から組織を逆引き
UPDATE user_roles ur
SET organization_id = s.organization_id
FROM staff st
JOIN stores s ON s.id = st.store_id
WHERE ur.staff_id = st.id
  AND (ur.organization_id IS NULL OR ur.role = 'staff');

-- 7) インデックス
CREATE INDEX IF NOT EXISTS idx_stores_organization_id ON stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);

COMMENT ON TABLE organizations IS '企業・法人単位のテナント';
COMMENT ON COLUMN stores.organization_id IS '店舗の所属組織';
COMMENT ON COLUMN user_roles.organization_id IS 'ユーザーの所属組織（NULLはスーパー管理者）';
