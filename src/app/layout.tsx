import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '勤怠管理システム | KinmuCore',
  description: '薬局用クラウド勤怠管理システム',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
