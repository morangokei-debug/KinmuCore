#!/bin/bash
# KinmuCore - Vercel自動デプロイスクリプト

set -e  # エラーが発生したら停止

echo "🚀 KinmuCore - Vercelデプロイスクリプト"
echo ""

# 現在のディレクトリ確認
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📂 作業ディレクトリ: $(pwd)"
echo ""

# Vercel CLIの確認
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLIがインストールされていません"
    echo ""
    echo "以下のコマンドでインストールしてください："
    echo "  npm install -g vercel"
    echo ""
    exit 1
fi

echo "✅ Vercel CLIが利用可能です"
echo ""

# Vercel認証状態確認
echo "🔐 Vercel認証状態を確認中..."
if ! vercel whoami &>/dev/null; then
    echo "❌ Vercel認証が必要です"
    echo ""
    echo "認証を開始します..."
    vercel login
    echo ""
fi

echo "✅ Vercel認証済み"
echo ""

# 環境変数の確認
echo "⚙️  環境変数の設定"
echo ""

if [ ! -f .env.local ]; then
    echo "⚠️  .env.local が見つかりません"
    echo ""
    echo ".env.local.example をコピーして設定してください："
    echo "  cp .env.local.example .env.local"
    echo "  # .env.local を編集して実際の値を設定"
    echo ""
    read -p ".env.local は既に設定済みですか？ (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 先に .env.local を設定してください"
        exit 1
    fi
fi

# Supabase環境変数の取得
if [ -f .env.local ]; then
    source .env.local
    
    if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        echo "❌ .env.local に必要な環境変数が設定されていません"
        echo ""
        echo "必要な変数:"
        echo "  - NEXT_PUBLIC_SUPABASE_URL"
        echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
        echo ""
        exit 1
    fi
    
    echo "✅ 環境変数を確認しました"
    echo "   SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:0:30}..."
fi

echo ""
echo "📦 Vercelにデプロイします"
echo ""
echo "デプロイ設定:"
echo "  - Framework: Next.js"
echo "  - Region: Tokyo (hnd1)"
echo "  - Build Command: npm run build"
echo ""

read -p "続行しますか？ (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ キャンセルされました"
    exit 1
fi

# Vercelにデプロイ（本番環境）
echo ""
echo "🔨 デプロイ中..."
vercel --prod \
    --yes \
    --env NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
    --env NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"

echo ""
echo "✅ デプロイが完了しました！"
echo ""
echo "📋 次のステップ:"
echo "  1. Vercelダッシュボードでデプロイ状況を確認"
echo "  2. カスタムドメインの設定（オプション）"
echo "  3. Supabaseで本番URLをリダイレクト許可に追加"
echo ""
echo "詳細は DEPLOYMENT.md を参照してください"
echo ""
