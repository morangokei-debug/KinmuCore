# 店舗登録の修正 - 必須設定

店舗登録を動作させるために、**Supabaseのサービスロールキー**を設定してください。

## 原因

ブラウザとサーバー間で認証セッションが正しく共有されず、Supabase RLS（Row Level Security）によりINSERTが拒否されていました。

## 解決策

サービスロールキーを使用したAdmin クライアントで RLS をバイパスし、認証済みユーザーの操作を確実に実行するように変更しました。

---

## 設定手順

### 1. Supabaseでサービスロールキーを取得

1. https://supabase.com/dashboard/project/gfkrdvdanebsvscefcll/settings/api を開く
2. **Project API keys** セクションで **service_role** のキーを表示
3. 「Reveal」をクリックしてキーをコピー

⚠️ **重要**: サービスロールキーは絶対にクライアント（ブラウザ）に露出しないでください。サーバー専用です。

### 2. ローカル開発環境

`.env.local` に追加:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....（コピーしたキー）
```

### 3. Vercel本番環境

1. https://vercel.com/logicworks-projects/kinmucore/settings/environment-variables を開く
2. 「Add New」をクリック
3. 以下を入力:
   - **Key**: `SUPABASE_SERVICE_ROLE_KEY`
   - **Value**: コピーしたサービスロールキー
   - **Environments**: Production, Preview, Development すべてにチェック
4. 「Save」をクリック
5. **再デプロイ**を実行（Deployments タブから最新の「Redeploy」）

### 4. 動作確認

1. 本番URLにアクセス: https://kinmucore-iota.vercel.app
2. ログイン
3. 店舗管理 → 「店舗を追加」
4. 店舗名を入力して「登録する」
5. 店舗が一覧に表示されることを確認

---

## セキュリティ

- サービスロールキーは `NEXT_PUBLIC_` プレフィックスを**付けていません**
- クライアントバンドルには含まれず、サーバーサイドでのみ使用されます
- Server Action 内で「ログイン済みか」を確認した上で、Admin クライアントを使用しています
