# ログインできない時の確認手順

## 1. Supabase の URL 設定（本番環境でログインできない場合）

本番（Vercel）でログインできない場合、Supabase の URL 設定を確認してください。

1. [Supabase Dashboard](https://supabase.com/dashboard/project/xnbzwibqypkgvqmulptn) にログイン
2. **Authentication** → **URL Configuration** を開く
3. 以下を設定:
   - **Site URL**: `https://kinmucore-iota.vercel.app`
   - **Redirect URLs** に追加: `https://kinmucore-iota.vercel.app/**`
4. 「Save」をクリック

## 2. ログインページのエラーメッセージを確認

ログイン失敗時に表示されるエラーメッセージで原因を切り分けできます。

| エラー例 | 原因 | 対処 |
|----------|------|------|
| Invalid login credentials | メールまたはパスワードが誤り | パスワードを確認、または新規ユーザーを作成 |
| Email not confirmed | メール未認証 | Supabase Dashboard でユーザーを「Confirm」する |
| その他 | 接続・設定エラー | 下記を確認 |

## 3. ユーザーが存在するか確認

Supabase Dashboard → **Authentication** → **Users** で、ログインするメールアドレスのユーザーが存在するか確認してください。存在しない場合は「Add user」で作成するか、以下のスクリプトで作成できます。

```bash
node scripts/create-user.mjs "メールアドレス" "パスワード"
```

## 4. 環境変数の確認（Vercel）

Vercel の環境変数が正しく設定されているか確認してください。

- `NEXT_PUBLIC_SUPABASE_URL`: `https://xnbzwibqypkgvqmulptn.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 正しい anon キー
- `SUPABASE_SERVICE_ROLE_KEY`: 正しい service_role キー（Server Actions 用）

設定後は必ず再デプロイしてください。
