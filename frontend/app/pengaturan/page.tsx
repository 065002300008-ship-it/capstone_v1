'use client';

import React, { useState } from 'react';

export default function PengaturanPage() {
  const [actor, setActor] = useState(() => {
    try {
      return (window.localStorage.getItem('mixindo_actor_username') ?? '').trim();
    } catch {
      return '';
    }
  });
  const [savedMsg, setSavedMsg] = useState('');

  const saveActor = () => {
    const v = actor.trim();
    try {
      window.localStorage.setItem('mixindo_actor_username', v);
    } catch {
      // ignore
    }
    setSavedMsg(v ? `User aktif diset: ${v}` : 'User aktif dikosongkan');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Sistem</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola konfigurasi dan preferensi sistem</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-bold text-gray-800">User Aktif (Sementara)</h2>
        <p className="text-sm text-gray-500 mt-1">
          Untuk tracking action di modul Laporan/Dokumen tanpa login, isi username yang sedang digunakan.
        </p>
        <div className="flex flex-col md:flex-row gap-3 mt-4">
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Username (contoh: admin01)"
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={saveActor}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Simpan
          </button>
        </div>
        {savedMsg ? <div className="text-xs text-green-700 mt-2">{savedMsg}</div> : null}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        
        {/* Sidebar Mini untuk Menu Pengaturan */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 p-4">
          <ul className="space-y-1">
            <li>
              <button className="w-full text-left px-4 py-2 bg-blue-50 text-blue-700 font-medium rounded-lg">
                Perusahaan
              </button>
            </li>
            <li><button className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Notifikasi</button></li>
            <li><button className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Keamanan</button></li>
            <li><button className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Database</button></li>
            <li><button className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Email</button></li>
            <li><button className="w-full text-left px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Tampilan</button></li>
          </ul>
        </div>

        {/* Area Konten Utama: Form Informasi Perusahaan */}
        <div className="flex-1 p-8">
          <h2 className="text-lg font-bold text-gray-800">Informasi Perusahaan</h2>
          <p className="text-sm text-gray-500 mb-6">Kelola informasi dasar perusahaan</p>

          <form className="space-y-6 max-w-2xl">
            {/* Baris 1: Nama & Kode */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan</label>
                {/* Ditambahkan text-gray-900 dan bg-white agar teks hitam */}
                <input type="text" defaultValue="PT. Mixindo Abadi Karya" className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode Perusahaan</label>
                <input type="text" defaultValue="MAK-2024" className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>

            {/* Baris 2: Alamat */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
              <textarea defaultValue="Jl. Industri Raya No. 123, Jakarta" rows={3} className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
            </div>

            {/* Baris 3: Telepon & Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                <input type="text" defaultValue="+62 21 1234 5678" className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" defaultValue="info@mixindo.com" className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
            </div>

            {/* Baris 4: Website */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input type="text" defaultValue="www.mixindo.com" className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>

            {/* Tombol Aksi */}
            <div className="flex gap-4 pt-4 border-t border-gray-100">
              <button type="button" className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors">
                Reset
              </button>
              <button type="button" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
        
      </div>
    </div>
  );
}
