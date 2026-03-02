import Link from 'next/link';
import Image from 'next/image';
import { BarChart3, LogIn, Smartphone, Calendar, FileSpreadsheet } from 'lucide-react';

const PRODUCTION_URL = 'https://kinmucore-iota.vercel.app';

export default function ManualPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーロー */}
      <header className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <BarChart3 className="mx-auto h-16 w-16 mb-4 opacity-90" />
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">KinmuCore 操作マニュアル</h1>
          <p className="text-indigo-100 text-lg mb-8">
            薬局向けクラウド勤怠管理システムの使い方ガイド
          </p>
          <Link
            href={PRODUCTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-indigo-600 shadow-lg hover:bg-indigo-50 transition-colors"
          >
            アプリを開く
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* できること */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-6">できること</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: LogIn, title: 'ログイン', desc: 'メールとパスワードで安全にログイン' },
              { icon: Calendar, title: 'シフト管理', desc: 'シフト表の確認・有給申請' },
              { icon: Smartphone, title: '打刻', desc: '出勤・退勤・休憩を2タップで記録' },
              { icon: FileSpreadsheet, title: 'データ出力', desc: 'Excel/CSVで勤怠データを出力' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <Icon className="h-8 w-8 text-indigo-600 mb-3" />
                <h3 className="font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600 mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 目次 */}
        <section className="mb-16">
          <h2 className="text-xl font-bold text-gray-900 mb-4">目次</h2>
          <nav className="rounded-xl border border-gray-200 bg-white p-6">
            <ul className="space-y-2">
              {[
                { id: 'step01', label: 'STEP 01 ログイン' },
                { id: 'step02', label: 'STEP 02 管理者の基本操作' },
                { id: 'step03', label: 'STEP 03 スタッフの基本操作' },
                { id: 'step04', label: 'STEP 04 打刻の方法' },
                { id: 'step05', label: 'STEP 05 シフト管理' },
                { id: 'step06', label: 'STEP 06 勤怠・データ出力' },
                { id: 'faq', label: 'よくある質問' },
              ].map(({ id, label }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        {/* STEP 01 */}
        <section id="step01" className="mb-16 scroll-mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-700">
              1
            </span>
            <h2 className="text-2xl font-bold text-gray-900">ログイン</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <Image
              src="/manual/step01-login.png"
              alt="ログイン画面"
              width={800}
              height={500}
              className="rounded-xl border shadow-md w-full h-auto"
            />
            <ol className="mt-6 space-y-3 list-decimal list-inside text-gray-700">
              <li>ブラウザで {PRODUCTION_URL} にアクセス</li>
              <li>メールアドレスとパスワードを入力</li>
              <li>「ログイン」ボタンをクリック</li>
            </ol>
            <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              💡 <strong>ポイント</strong> スマホでは左上の「≡」メニューから各画面に移動できます。
            </div>
          </div>
        </section>

        {/* STEP 02 */}
        <section id="step02" className="mb-16 scroll-mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-700">
              2
            </span>
            <h2 className="text-2xl font-bold text-gray-900">管理者の基本操作</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <p className="text-gray-700 mb-4">
              PCでは画面左側にメニューが表示されます。
            </p>
            <ul className="space-y-1 text-gray-700 list-disc list-inside">
              <li><strong>勤怠管理</strong> … 日別の勤怠記録を確認・修正</li>
              <li><strong>シフト</strong> … シフト表・有給申請の承認</li>
              <li><strong>スタッフ</strong> … 従業員の登録・編集</li>
              <li><strong>店舗管理</strong> … 店舗の登録・編集</li>
              <li><strong>ポリシー</strong> … 就業ルールの設定</li>
              <li><strong>ユーザー管理</strong> … ログインユーザーの作成・権限</li>
              <li><strong>データ出力</strong> … Excel/CSV出力</li>
            </ul>
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
              ⚠️ <strong>スマホ</strong> 画面上部の「≡」をタップするとメニューが開きます。
            </div>
          </div>
        </section>

        {/* STEP 03 */}
        <section id="step03" className="mb-16 scroll-mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-700">
              3
            </span>
            <h2 className="text-2xl font-bold text-gray-900">スタッフの基本操作</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <p className="text-gray-700 mb-4">
              スタッフ権限の方は <strong>シフト</strong> と <strong>打刻</strong> のみ利用できます。
            </p>
            <ol className="space-y-2 list-decimal list-inside text-gray-700">
              <li>メニューから「打刻」をタップ</li>
              <li>店舗を選択して「打刻画面を開く」をタップ</li>
              <li>打刻専用画面で出勤・退勤などを記録</li>
            </ol>
            <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
              💡 <strong>シフトに戻る</strong> 打刻画面の青い「シフトに戻る」バーをタップしてください。
            </div>
          </div>
        </section>

        {/* STEP 04 */}
        <section id="step04" className="mb-16 scroll-mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-700">
              4
            </span>
            <h2 className="text-2xl font-bold text-gray-900">打刻の方法</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <ol className="space-y-2 list-decimal list-inside text-gray-700 mb-4">
              <li>自分の名前をタップ</li>
              <li>表示されるボタン（出勤・休憩開始・休憩終了・退勤）をタップ</li>
            </ol>
            <p className="text-gray-600 text-sm">
              1日の例: 出勤 → 休憩開始 → 休憩終了 → 退勤
            </p>
          </div>
        </section>

        {/* STEP 05 */}
        <section id="step05" className="mb-16 scroll-mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-700">
              5
            </span>
            <h2 className="text-2xl font-bold text-gray-900">シフト管理</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <p className="text-gray-700">
              メニューから「シフト」をクリックし、年月・店舗で表示を切り替えられます。
              スタッフは有給申請、管理者は承認・却下が可能です。
            </p>
          </div>
        </section>

        {/* STEP 06 */}
        <section id="step06" className="mb-16 scroll-mt-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-xl font-bold text-indigo-700">
              6
            </span>
            <h2 className="text-2xl font-bold text-gray-900">勤怠・データ出力</h2>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-lg">
            <p className="text-gray-700 mb-4">
              「勤怠管理」で記録を確認、「データ出力」でExcel/CSVをダウンロードできます。
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-16 scroll-mt-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">よくある質問</h2>
          <div className="space-y-4">
            {[
              {
                q: 'ログインできない',
                a: 'メールアドレスとパスワードを確認し、大文字・小文字も正確に入力してください。',
              },
              {
                q: '打刻を忘れた',
                a: '店長または管理者に連絡してください。手動で勤怠記録を登録できます。',
              },
              {
                q: 'スマホでシフト画面に戻れない',
                a: '打刻画面の青い「シフトに戻る」バー、または打刻選択画面の「シフトに戻る」リンクをタップしてください。',
              },
            ].map(({ q, a }) => (
              <details
                key={q}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm [&_summary]:cursor-pointer"
              >
                <summary className="font-semibold text-gray-900">{q}</summary>
                <p className="mt-2 text-gray-600 text-sm">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* フッター */}
        <footer className="border-t border-gray-200 pt-8 text-center text-gray-500 text-sm">
          <Link
            href={PRODUCTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline"
          >
            {PRODUCTION_URL}
          </Link>
          <p className="mt-2">KinmuCore 操作マニュアル</p>
        </footer>
      </main>
    </div>
  );
}
