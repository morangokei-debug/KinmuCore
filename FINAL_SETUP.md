# 🎯 KinmuCore 最終設定ガイド（2ステップで完了）

デプロイは完了しました！本番環境: **https://kinmucore.vercel.app**

以下の2つの設定を完了させれば、全て完了です。

---

## ✅ ステップ1: GitHub自動デプロイの有効化

### 設定URL
👉 **https://vercel.com/morangokei-debugs-projects/kinmucore/settings/git**

### 手順
1. 上記URLをブラウザで開く
2. 「**Connect Git Repository**」ボタンをクリック
3. 「**GitHub**」を選択
4. 「**morangokei-debug/KinmuCore**」リポジトリを選択
5. 「**Connect**」をクリック

### 完了後の動作
- `git push` するだけで自動的にVercelにデプロイされます
- プルリクエストごとにプレビュー環境が自動作成されます

---

## ✅ ステップ2: Supabase認証の設定

### 設定URL
👉 **https://supabase.com/dashboard/project/qxlucyxzfyqpmypmbokd/auth/url-configuration**

### 設定内容

#### Site URL
```
https://kinmucore.vercel.app
```

#### Redirect URLs（既存のものに追加）
```
https://kinmucore.vercel.app/auth/callback
https://*.vercel.app/auth/callback
```

### 手順
1. 上記URLをブラウザで開く
2. **Site URL** フィールドに `https://kinmucore.vercel.app` を入力
3. **Redirect URLs** セクションで「**Add URL**」をクリック
4. `https://kinmucore.vercel.app/auth/callback` を入力して追加
5. もう一度「**Add URL**」をクリック
6. `https://*.vercel.app/auth/callback` を入力して追加（ワイルドカード対応）
7. 最下部の「**Save**」ボタンをクリック

### 完了後の動作
- ログイン/ログアウトが正常に動作します
- 認証リダイレクトエラーが解消されます

---

## 🧪 動作確認

設定完了後、以下で確認してください：

### 1. ログインページ
```
https://kinmucore.vercel.app/login
```

### 2. ヘルスチェック
```
https://kinmucore.vercel.app/api/health
```

### 3. 自動デプロイのテスト
```bash
cd ~/KinmuCore
echo '# Auto-deploy test' >> README.md
git add README.md
git commit -m 'Test auto-deploy'
git push origin main
```

Vercelダッシュボードで自動デプロイが始まることを確認：
https://vercel.com/morangokei-debugs-projects/kinmucore

---

## 📊 完成した環境

| 項目 | 内容 |
|------|------|
| **本番URL** | https://kinmucore.vercel.app |
| **Vercelプロジェクト** | https://vercel.com/morangokei-debugs-projects/kinmucore |
| **GitHubリポジトリ** | https://github.com/morangokei-debug/KinmuCore |
| **Supabaseプロジェクト** | https://qxlucyxzfyqpmypmbokd.supabase.co |
| **デプロイ方法** | `git push` で自動デプロイ（設定後） |
| **リージョン** | Tokyo (hnd1) |

---

## 🎉 PharmBalanceとの統合完了

KinmuCoreはPharmBalanceと同じプラットフォーム（Vercel、Supabase）で運用されています：

- ✅ 同じVercelアカウント（morangokei-debug）
- ✅ 同じGitHubアカウント（morangokei-debug）
- ✅ 同じSupabaseインフラ
- ✅ 同じ東京リージョン（hnd1）
- ✅ 同じセキュリティ設定

すべて準備完了です！
