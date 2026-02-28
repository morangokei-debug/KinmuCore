# KinmuCore - Vercelデプロイ手順書

このドキュメントでは、KinmuCoreをPharmBalanceと同じVercelアカウントにデプロイする手順を説明します。

## 前提条件

- GitHubアカウント（morangokei-debug）
- Vercelアカウント（PharmBalanceと同じアカウント）
- Supabaseプロジェクトの作成済み

## ステップ1: GitHubリポジトリの作成

### 1-1. GitHub CLIで認証（推奨）

```bash
gh auth login -h github.com
```

指示に従って認証を完了してください。

### 1-2. GitHubリポジトリを作成してプッシュ

```bash
cd ~/KinmuCore

# リポジトリを作成（プライベート）
gh repo create KinmuCore --private --source=. --push

# または、パブリックにする場合
# gh repo create KinmuCore --public --source=. --push
```

### 代替方法: GitHub Webインターフェースから作成

1. https://github.com/new にアクセス
2. Repository name: `KinmuCore`
3. プライベート/パブリックを選択
4. 「Create repository」をクリック
5. ターミナルで以下を実行：

```bash
cd ~/KinmuCore
git remote add origin https://github.com/morangokei-debug/KinmuCore.git
git branch -M main
git push -u origin main
```

## ステップ2: Vercelへのデプロイ

### 2-1. Vercelダッシュボードにアクセス

1. https://vercel.com/dashboard にログイン
2. PharmBalanceと同じチーム/アカウントを選択

### 2-2. 新規プロジェクトのインポート

1. 「Add New...」→「Project」をクリック
2. 「Import Git Repository」セクションで KinmuCore リポジトリを選択
3. リポジトリが表示されない場合は「Adjust GitHub App Permissions」で権限を付与

### 2-3. プロジェクト設定

**Framework Preset:** Next.js（自動検出されます）

**Root Directory:** `.` (デフォルト)

**Build and Output Settings:**
- Build Command: `npm run build` (デフォルト)
- Output Directory: `.next` (デフォルト)
- Install Command: `npm install` (デフォルト)

### 2-4. 環境変数の設定

「Environment Variables」セクションで以下を追加：

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key-here` | Production, Preview, Development |

**重要:** Supabaseプロジェクトの実際の値を入力してください。

### 2-5. デプロイ実行

1. 「Deploy」ボタンをクリック
2. デプロイが完了するまで待機（通常1-3分）
3. デプロイ成功後、プロダクションURLが表示されます

## ステップ3: カスタムドメインの設定（オプション）

PharmBalanceと同様にカスタムドメインを設定する場合：

1. Vercelプロジェクトの「Settings」→「Domains」
2. ドメインを入力して「Add」
3. DNSレコードの設定（ドメインプロバイダー側で設定）

## ステップ4: 継続的デプロイの確認

`main` ブランチへのプッシュで自動デプロイされることを確認：

```bash
cd ~/KinmuCore

# 何か変更を加えてテスト
echo "# Test" >> README.md
git add README.md
git commit -m "Test auto-deploy"
git push origin main
```

Vercelダッシュボードでデプロイが自動的に開始されることを確認してください。

## Supabaseの本番環境設定

### 許可されたリダイレクトURLの追加

Supabase Dashboard > Authentication > URL Configuration で以下を追加：

**Site URL:**
```
https://your-kinmucore-domain.vercel.app
```

**Redirect URLs:**
```
https://your-kinmucore-domain.vercel.app/auth/callback
https://*.vercel.app/auth/callback
```

### Row Level Security (RLS) の確認

本番環境では RLS が正しく設定されていることを確認してください。
`supabase/migrations/001_initial_schema.sql` にRLSポリシーが含まれています。

## トラブルシューティング

### ビルドエラーが発生する場合

1. ローカルで `npm run build` を実行してエラーを確認
2. 環境変数が正しく設定されているか確認
3. Vercelのビルドログを確認

### 認証が動作しない場合

1. Supabaseの環境変数が正しいか確認
2. SupabaseダッシュボードでリダイレクトURLが設定されているか確認
3. ブラウザのコンソールでエラーメッセージを確認

### 「Failed to fetch」が表示される場合

ログイン時に「Failed to fetch」が出る場合、以下の順に確認してください：

1. **Vercel 環境変数**: `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が Production に設定されているか確認。未設定や `your-project.supabase.co` のままの場合に発生します。

2. **Supabase プロジェクト**: LogicPharm/PharmBalance と同じ Supabase（例: `qxlucyxzfyqpmypmbokd.supabase.co`）を使用しているか確認。

3. **Supabase URL Configuration**: Supabase Dashboard → Authentication → URL Configuration で以下を追加：
   - **Site URL**: `https://kinmucore.vercel.app`
   - **Redirect URLs**: `https://kinmucore.vercel.app/**` または `https://kinmucore.vercel.app/auth/callback`

4. **再デプロイ**: 環境変数を変更した場合は、Vercel で「Redeploy」を実行してください（NEXT_PUBLIC_ はビルド時に埋め込まれるため）。

### データベースに接続できない場合

1. Supabase RLSポリシーが正しく設定されているか確認
2. マイグレーションファイルが実行されているか確認
3. Supabaseプロジェクトのステータスを確認

## 参考リンク

- PharmBalanceリポジトリ: https://github.com/morangokei-debug/PharmBalance
- Vercel Documentation: https://vercel.com/docs
- Next.js Deployment: https://nextjs.org/docs/deployment
- Supabase Docs: https://supabase.com/docs

## 完了チェックリスト

- [ ] GitHubリポジトリ作成完了
- [ ] Vercelプロジェクトインポート完了
- [ ] 環境変数設定完了
- [ ] 初回デプロイ成功
- [ ] カスタムドメイン設定（オプション）
- [ ] Supabase URL設定完了
- [ ] 本番環境での動作確認完了
- [ ] 自動デプロイの動作確認完了
