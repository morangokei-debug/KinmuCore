# 🚀 ワンクリックデプロイガイド

KinmuCoreをVercelに最も簡単にデプロイする方法です。

## 方法1: Deploy Buttonを使用（最も簡単）

### ステップ1: ボタンをクリック

README.mdの「Deploy with Vercel」ボタンをクリック、または以下のリンクにアクセス：

👉 https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmorangokei-debug%2FKinmuCore&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY&envDescription=Supabase%E3%81%AE%E6%8E%A5%E7%B6%9A%E6%83%85%E5%A0%B1%E3%82%92%E5%85%A5%E5%8A%9B%E3%81%97%E3%81%A6%E3%81%8F%E3%81%A0%E3%81%95%E3%81%84&project-name=kinmucore&repository-name=KinmuCore

### ステップ2: GitHubアカウントでログイン

PharmBalanceと同じアカウントでログインしてください。

### ステップ3: リポジトリのフォーク（または既存を選択）

- 新規の場合: 「Clone」を選択
- 既存リポジトリがある場合: そのまま選択

### ステップ4: 環境変数を入力

以下の2つの環境変数を入力：

```
NEXT_PUBLIC_SUPABASE_URL=https://qxlucyxzfyqpmypmbokd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdma3JkdmRhbmVic3ZzY2VmY2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Nzc4MTQsImV4cCI6MjA4NjE1MzgxNH0.N777EExtkb8xRC0AlDLj01bLoPGQ-NIa9feH9-HbiAE
```

### ステップ5: Deploy をクリック

「Deploy」ボタンをクリックして、デプロイを開始します。

### ステップ6: 完了を待つ

1-3分でデプロイが完了します。完了したらURLが表示されます。

---

## 方法2: Vercelダッシュボードから手動インポート

### ステップ1: Vercelダッシュボードにアクセス

https://vercel.com/dashboard

### ステップ2: 新規プロジェクト作成

1. 「Add New...」→「Project」をクリック
2. 「Import Git Repository」で `KinmuCore` を検索
3. 「Import」をクリック

### ステップ3: 環境変数を設定

「Environment Variables」で以下を追加：

```
NEXT_PUBLIC_SUPABASE_URL=https://qxlucyxzfyqpmypmbokd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdma3JkdmRhbmVic3ZzY2VmY2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Nzc4MTQsImV4cCI6MjA4NjE1MzgxNH0.N777EExtkb8xRC0AlDLj01bLoPGQ-NIa9feH9-HbiAE
```

### ステップ4: Deploy

「Deploy」ボタンをクリック

---

## デプロイ後の設定

### 1. Supabaseのリダイレクト設定

デプロイが完了したら、VercelのURLをコピーして：

1. https://supabase.com/dashboard にアクセス
2. プロジェクト選択 > Authentication > URL Configuration
3. 以下を追加：

**Site URL:**
```
https://your-kinmucore-url.vercel.app
```

**Redirect URLs:**
```
https://your-kinmucore-url.vercel.app/auth/callback
https://*.vercel.app/auth/callback
```

### 2. 動作確認

1. デプロイされたURLにアクセス
2. `/healthz` にアクセスしてヘルスチェック
3. `/login` でログインテスト

---

## トラブルシューティング

### ビルドエラーが発生する場合

環境変数が正しく設定されているか確認してください。

### 認証エラーが発生する場合

Supabaseのリダイレクト設定が完了しているか確認してください。

---

## 完了！

これでKinmuCoreがVercelにデプロイされました。PharmBalanceと同じプラットフォームで運用されています。

🎉 お疲れ様でした！
