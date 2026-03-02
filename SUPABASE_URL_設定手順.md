# KinmuCore「サーバーに接続できません」の修正手順

## 原因
Supabase の Authentication > URL Configuration に `kinmucore.vercel.app` が登録されていない場合に発生します。

## 手順（約1分）

1. **Supabase ダッシュボードを開く**
   - https://supabase.com/dashboard/project/qxlucyxzfyqpmypmbokd/auth/url-configuration

2. **「Redirect URLs」セクションで「Add URL」をクリック**

3. **以下の URL を入力して追加**
   ```
   https://kinmucore.vercel.app/**
   ```

4. **「Save」をクリック**

5. **KinmuCore のログインを再試行**
   - https://kinmucore.vercel.app/login

---

## Vercel 環境変数の確認（上記で直らない場合）

1. https://vercel.com/logicworks-projects/kinmucore/settings/environment-variables を開く
2. 以下が Production に設定されているか確認：
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://qxlucyxzfyqpmypmbokd.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: LogicPharm と同じ anon key
3. 変更した場合は **Redeploy** を実行（Deployments → 最新の ... → Redeploy）
