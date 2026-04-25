import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Memanggil komponen dari folder terdekat (satu level di dalam folder app)
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

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
      <body className={`${inter.className} bg-gray-50 flex h-screen overflow-hidden`}>
        {/* Sidebar Kiri */}
        <Sidebar />
        
        {/* Area Konten Kanan */}
        <div className="flex-1 flex flex-col">
          <Topbar />
          
          {/* Main Content (Dashboard, Proyek, dll akan dirender di sini) */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
