import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

import AppShell from './components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dashboard - PT Mixindo Abadi Karya',
  description: 'Sistem Informasi Proyek Terintegrasi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
