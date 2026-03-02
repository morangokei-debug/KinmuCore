# kinmucore.vercel.app と kinmucore-iota.vercel.app について

## 状況

KinmuCore には **2つの本番URL** が存在します：

| URL | 説明 |
|-----|------|
| **https://kinmucore.vercel.app** | 別のVercelプロジェクト（GitHub連携で自動デプロイ） |
| **https://kinmucore-iota.vercel.app** | logicworks-projects のプロジェクト（CLIデプロイ） |

## ログインできない場合の対処

### 1. kinmucore.vercel.app でログインできない場合

**原因**: そのプロジェクトのVercel環境変数が未設定または誤っている可能性があります。

**手順**:
1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. **kinmucore.vercel.app** を配信しているプロジェクトを開く
3. **Settings** → **Environment Variables** を開く
4. 以下を設定（Production / Preview / Development すべて）:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://xnbzwibqypkgvqmulptn.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = （Supabase Dashboard > Project Settings > API の anon key）
   - `SUPABASE_SERVICE_ROLE_KEY` = （同上の service_role key）
5. **Redeploy** を実行

### 2. 確実にログインしたい場合

**https://kinmucore-iota.vercel.app/login** を使用してください。  
こちらは環境変数が正しく設定済みです。

### 3. Supabase URL Configuration

どちらのURLを使う場合も、Supabase の **Authentication > URL Configuration** に以下を追加してください：

- **Site URL**: 使用するURL（例: `https://kinmucore.vercel.app` または `https://kinmucore-iota.vercel.app`）
- **Redirect URLs**: `https://kinmucore.vercel.app/**` および `https://kinmucore-iota.vercel.app/**`
