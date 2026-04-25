import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-[#1e3a8a] text-white min-h-screen p-4 flex flex-col">
      <div className="font-bold text-lg mb-8 p-2 border-b border-blue-700">
        PT. Mixindo Abadi Karya
      </div>
      
      <nav className="flex-1 space-y-2">
        <Link href="/" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          Dashboard
        </Link>
        <Link href="/proyek" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          Proyek
        </Link>
        <Link href="/laporan" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          Laporan
        </Link>
        <Link href="/dokumen" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          Dokumen
        </Link>
        <Link href="/tes-material" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          Daftar Tes Material
        </Link>
        <Link href="/users" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          User Management
        </Link>
        
        {/* Ini dia tombol Pengaturan yang baru ditambahkan */}
        <Link href="/pengaturan" className="block p-3 hover:bg-blue-800 rounded-lg text-sm font-medium transition-colors">
          Pengaturan
        </Link>
      </nav>
    </aside>
  );
}
