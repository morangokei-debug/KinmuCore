# KinmuCore - 本番環境デプロイ完了ガイド

## ✅ 完了済みの作業

以下の準備がすべて完了しました：

1. ✅ Vercel設定ファイル（`vercel.json`）の作成
2. ✅ セキュリティヘッダーの設定（XSS、Frame Options等）
3. ✅ 東京リージョン（hnd1）の設定
4. ✅ ヘルスチェックエンドポイント（`/api/health`）の作成
5. ✅ Next.js本番環境最適化設定
6. ✅ GitHubリポジトリへのプッシュ完了
7. ✅ デプロイ自動化スクリプトの作成
8. ✅ 詳細なデプロイドキュメント（DEPLOYMENT.md）の作成

## 🎯 次のステップ: Vercelへのデプロイ

### オプション1: Vercelダッシュボードからデプロイ（推奨）

このオプションは最も確実で、PharmBalanceと同じアカウントで管理できます。

#### ステップ1: Vercelダッシュボードにアクセス

1. https://vercel.com/dashboard にアクセス
2. PharmBalanceと同じアカウントでログイン

#### ステップ2: プロジェクトをインポート

1. 「Add New...」→「Project」をクリック
2. 「Import Git Repository」で `morangokei-debug/KinmuCore` を検索
3. 「Import」をクリック

#### ステップ3: プロジェクト設定

以下の設定は自動検出されます：

- **Framework Preset**: Next.js
- **Root Directory**: `.` (デフォルト)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

#### ステップ4: 環境変数の設定

「Environment Variables」セクションで以下を追加：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**重要**: 
- すべての環境（Production, Preview, Development）にチェックを入れる
- Supabaseプロジェクトの実際の値を使用

#### ステップ5: デプロイ実行

1. 「Deploy」ボタンをクリック
2. ビルドが完了するまで待機（1-3分）
3. デプロイURLを確認

### オプション2: Vercel CLIでデプロイ

現在、Vercel CLIの認証が待機中です。

**認証コード**: `XTZN-TJCS`

#### 認証手順：

1. https://vercel.com/oauth/device?user_code=XTZN-TJCS にアクセス
2. PharmBalanceと同じアカウントでログイン
3. 認証を完了

#### 認証完了後：

```bash
cd ~/KinmuCore
./deploy-to-vercel.sh
```

## 🔧 デプロイ後の設定

### 1. Supabaseのリダイレクト設定

Supabase Dashboard > Authentication > URL Configuration で以下を追加：

**Site URL:**
```
https://your-kinmucore-url.vercel.app
```

**Redirect URLs:**
```
https://your-kinmucore-url.vercel.app/auth/callback
https://*.vercel.app/auth/callback
```

### 2. カスタムドメインの設定（オプション）

PharmBalanceと同様にカスタムドメインを設定する場合：

1. Vercelプロジェクトの「Settings」→「Domains」
2. ドメインを追加
3. DNSレコードを設定

### 3. 動作確認

#### ヘルスチェック
```bash
curl https://your-kinmucore-url.vercel.app/healthz
# または
curl https://your-kinmucore-url.vercel.app/api/health
```

期待される応答:
```json
{
  "status": "ok",
  "timestamp": "2026-02-17T...",
  "service": "KinmuCore",
  "environment": "production"
}
```

#### ログインテスト
1. https://your-kinmucore-url.vercel.app/login にアクセス
2. Supabaseで作成した管理者アカウントでログイン
3. ダッシュボードが表示されることを確認

#### 打刻画面テスト
1. 店舗管理で店舗を作成
2. 打刻ページのリンクをクリック
3. タブレット用打刻画面が表示されることを確認

## 📊 継続的デプロイの確認

`main`ブランチへのプッシュで自動デプロイされます：

```bash
cd ~/KinmuCore
# 何か変更を加えてテスト
echo "# Test" >> README.md
git add README.md
git commit -m "Test auto-deploy"
git push origin main
```

Vercelダッシュボードで自動デプロイが開始されることを確認してください。

## 🎉 PharmBalanceとの統合

KinmuCoreは以下の点でPharmBalanceと同じインフラストラクチャを使用しています：

| 項目 | PharmBalance | KinmuCore |
|------|--------------|-----------|
| ホスティング | Vercel | Vercel ✅ |
| フレームワーク | Next.js 14 | Next.js 16 ✅ |
| データベース | Supabase | Supabase ✅ |
| リージョン | Tokyo (hnd1) | Tokyo (hnd1) ✅ |
| 認証 | Supabase Auth | Supabase Auth ✅ |
| デプロイ | GitHub統合 | GitHub統合 ✅ |

## 📚 参考ドキュメント

- 詳細なデプロイ手順: [DEPLOYMENT.md](./DEPLOYMENT.md)
- GitHubリポジトリ: https://github.com/morangokei-debug/KinmuCore
- PharmBalanceリポジトリ: https://github.com/morangokei-debug/PharmBalance

## ❓ トラブルシューティング

### ビルドエラーが発生する場合

```bash
# ローカルでビルドテスト
cd ~/KinmuCore
npm run build
```

### 環境変数が反映されない場合

1. Vercelダッシュボードの「Settings」→「Environment Variables」を確認
2. すべての環境（Production, Preview, Development）にチェックが入っているか確認
3. 再デプロイを実行

### データベース接続エラー

1. Supabaseプロジェクトが稼働中か確認
2. 環境変数の値が正しいか確認
3. RLSポリシーが設定されているか確認（`supabase/migrations/001_initial_schema.sql`）

## 完了チェックリスト

- [x] GitHubリポジトリ作成完了
- [ ] Vercelプロジェクトインポート完了
- [ ] 環境変数設定完了
- [ ] 初回デプロイ成功
- [ ] Supabase URL設定完了
- [ ] 本番環境での動作確認完了
- [ ] 自動デプロイの動作確認完了
- [ ] カスタムドメイン設定（オプション）

---

準備はすべて整いました。上記の手順に従ってVercelへのデプロイを完了してください！
