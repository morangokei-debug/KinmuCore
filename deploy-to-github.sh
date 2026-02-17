#!/bin/bash
# KinmuCore - GitHubリポジトリ作成 & Vercelデプロイ クイックスタート

set -e  # エラーが発生したら停止

echo "🚀 KinmuCore - GitHubリポジトリ作成スクリプト"
echo ""

# 現在のディレクトリ確認
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📂 作業ディレクトリ: $(pwd)"
echo ""

# GitHub CLIの認証状態確認
echo "🔐 GitHub認証状態を確認中..."
if ! gh auth status &>/dev/null; then
    echo "❌ GitHub認証が必要です"
    echo ""
    echo "以下のコマンドを実行して認証してください："
    echo "  gh auth login -h github.com --web"
    echo ""
    exit 1
fi

echo "✅ GitHub認証済み"
echo ""

# Gitステータス確認
echo "📊 Gitステータス確認中..."
git status --short
echo ""

# GitHubリポジトリ作成（プライベート）
echo "📦 GitHubリポジトリを作成中..."
echo ""
echo "リポジトリ名: KinmuCore"
echo "可視性: private"
echo ""

read -p "続行しますか？ (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ キャンセルされました"
    exit 1
fi

# リポジトリ作成
gh repo create KinmuCore --private --source=. --push

echo ""
echo "✅ GitHubリポジトリの作成とプッシュが完了しました"
echo ""
echo "📋 次のステップ:"
echo "  1. https://vercel.com/dashboard にアクセス"
echo "  2. 'Add New...' → 'Project' をクリック"
echo "  3. 'KinmuCore' リポジトリをインポート"
echo "  4. 環境変数を設定:"
echo "     - NEXT_PUBLIC_SUPABASE_URL"
echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  5. 'Deploy' をクリック"
echo ""
echo "詳細は DEPLOYMENT.md を参照してください"
echo ""
