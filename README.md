# KinmuCore - 薬局用クラウド勤怠管理システム

薬局向けのシンプルな勤怠管理システムです。店舗設置タブレットからの打刻、勤怠集計、Excel/CSV出力に対応しています。

## 機能一覧

| 機能 | 説明 |
|------|------|
| 打刻 | 出勤・退勤・休憩開始/終了（2タップで完了） |
| 勤怠管理 | 日別・月別の勤怠記録の確認・修正 |
| スタッフ管理 | スタッフの登録・編集・雇用形態管理 |
| 店舗管理 | 複数店舗の登録・管理 |
| ポリシー管理 | 店舗ごとの就業ルール設定（締め日・丸め単位等） |
| データ出力 | Excel（.xlsx）/ CSV形式での勤怠データ出力 |

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **バックエンド**: Supabase (PostgreSQL + Auth + RLS)
- **ホスティング**: Vercel（予定）

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/morangokei-debug/KinmuCore.git
cd KinmuCore
npm install
```

### 2. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/) にログイン
2. 「New Project」でプロジェクトを作成
3. Project Settings > API から以下を取得:
   - **Project URL** (`NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public key** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)

### 3. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` を編集して、Supabaseの接続情報を入力:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. データベースのセットアップ

Supabase Dashboard の **SQL Editor** で以下のファイルを順番に実行:

1. `supabase/migrations/001_initial_schema.sql` - テーブル・RLS作成
2. `supabase/seed.sql` - サンプルデータ投入（任意）

### 5. 管理者ユーザーの作成

Supabase Dashboard > Authentication > Users で管理者ユーザーを作成:

1. 「Add user」をクリック
2. メールアドレスとパスワードを入力
3. 「Create user」で作成

### 6. 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 でアクセスできます。

## 画面構成

### 管理画面（認証必要）

| URL | 画面 |
|-----|------|
| `/login` | ログイン |
| `/attendance` | 勤怠管理（トップページ） |
| `/staff` | スタッフ管理 |
| `/stores` | 店舗管理 |
| `/policies` | ポリシー管理 |
| `/export` | データ出力 |

### 打刻画面（認証不要）

| URL | 画面 |
|-----|------|
| `/punch/{storeId}` | 店舗別打刻画面（タブレット用） |

> 打刻画面のURLは、勤怠管理ページの「打刻ページ」リンクから取得できます。

## ポリシー（就業ルール）設計

店舗ごとに異なる就業ルールをデータとして管理します。

- **締め日**: 月末 or 任意の日
- **丸め単位**: 1分 / 5分 / 15分
- **休憩控除**: 手動（打刻ベース）/ 自動控除
- **有給管理**: ON/OFF（将来機能）
- **修正承認フロー**: ON/OFF

## 将来の拡張予定

- [ ] 有給管理（労務規定確定後）
- [ ] 扶養壁管理（103万/130万）
- [ ] シフト連携
- [ ] 複数法人一元管理
- [ ] 労務分析ダッシュボード

## Vercelへのデプロイ

このプロジェクトはVercelでホスティングされています。

詳細なデプロイ手順は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

### 自動デプロイスクリプト（推奨）

#### 方法1: ワンステップデプロイ

```bash
# 1. GitHub認証（初回のみ）
gh auth login -h github.com --web

# 2. GitHubリポジトリ作成 & プッシュ
./deploy-to-github.sh

# 3. Vercelにデプロイ
./deploy-to-vercel.sh
```

#### 方法2: 手動デプロイ

詳細は [DEPLOYMENT.md](./DEPLOYMENT.md) を参照してください。

### 必要な環境変数

- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトのURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseの公開API Key

Vercelは`main`ブランチへのプッシュで自動デプロイされます。

## ディレクトリ構造

```
src/
├── app/
│   ├── (auth)/login/         # ログイン画面
│   ├── (dashboard)/          # 管理画面（サイドバー付きレイアウト）
│   │   ├── attendance/       # 勤怠管理
│   │   ├── staff/            # スタッフ管理
│   │   ├── stores/           # 店舗管理
│   │   ├── policies/         # ポリシー管理
│   │   └── export/           # データ出力
│   └── punch/[storeId]/      # 打刻画面（認証不要）
├── components/
│   ├── layout/               # サイドバー等
│   └── ui/                   # 共通UIコンポーネント
├── lib/
│   ├── supabase/             # Supabaseクライアント
│   └── utils.ts              # ユーティリティ関数
└── types/
    └── index.ts              # 型定義
```
