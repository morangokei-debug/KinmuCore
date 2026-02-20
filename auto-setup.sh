#!/bin/bash
# 最終設定を自動で開始するスクリプト

set -e

echo "🚀 KinmuCore 最終設定を開始します"
echo ""
echo "デプロイ完了: https://kinmucore.vercel.app"
echo ""

# ステップ1: GitHub連携
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ステップ1: GitHub自動デプロイ設定"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ブラウザでVercel設定ページを開きます..."
sleep 1

# macOSでブラウザを開く
if command -v open &> /dev/null; then
    open "https://vercel.com/morangokei-debugs-projects/kinmucore/settings/git"
else
    echo "URLを手動で開いてください:"
    echo "https://vercel.com/morangokei-debugs-projects/kinmucore/settings/git"
fi

echo ""
echo "📝 手順:"
echo "  1. 「Connect Git Repository」をクリック"
echo "  2. 「GitHub」を選択"
echo "  3. 「morangokei-debug/KinmuCore」を選択"
echo "  4. 「Connect」をクリック"
echo ""
read -p "設定が完了したら Enter を押してください..."
echo ""
echo "✅ GitHub連携完了！"
echo ""
sleep 1

# ステップ2: Supabase設定
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ステップ2: Supabase認証設定"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ブラウザでSupabase設定ページを開きます..."
sleep 1

if command -v open &> /dev/null; then
    open "https://supabase.com/dashboard/project/qxlucyxzfyqpmypmbokd/auth/url-configuration"
else
    echo "URLを手動で開いてください:"
    echo "https://supabase.com/dashboard/project/qxlucyxzfyqpmypmbokd/auth/url-configuration"
fi

echo ""
echo "📝 設定内容:"
echo ""
echo "  【Site URL】"
echo "    https://kinmucore.vercel.app"
echo ""
echo "  【Redirect URLs】（追加）"
echo "    https://kinmucore.vercel.app/auth/callback"
echo "    https://*.vercel.app/auth/callback"
echo ""
echo "📝 手順:"
echo "  1. Site URLを入力"
echo "  2. Redirect URLsを追加"
echo "  3. 「Save」をクリック"
echo ""
read -p "設定が完了したら Enter を押してください..."
echo ""
echo "✅ Supabase設定完了！"
echo ""

# 動作確認
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 動作確認"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "ヘルスチェックを実行中..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "https://kinmucore.vercel.app/api/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" = "200" ] || [ "$HEALTH_CHECK" = "307" ]; then
    echo "✅ アプリケーションは正常に動作しています"
else
    echo "⚠️  ヘルスチェック: HTTP $HEALTH_CHECK"
fi

echo ""
echo "ログインページを開きます..."
sleep 1

if command -v open &> /dev/null; then
    open "https://kinmucore.vercel.app/login"
else
    echo "URLを手動で開いてください:"
    echo "https://kinmucore.vercel.app/login"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 全ての設定が完了しました！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 KinmuCore 本番環境"
echo ""
echo "  本番URL:       https://kinmucore.vercel.app"
echo "  Vercel管理:    https://vercel.com/morangokei-debugs-projects/kinmucore"
echo "  GitHub:        https://github.com/morangokei-debug/KinmuCore"
echo ""
echo "今後は git push するだけで自動デプロイされます！"
echo ""
