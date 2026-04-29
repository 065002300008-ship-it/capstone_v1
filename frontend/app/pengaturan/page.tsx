'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch, apiUrl } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function PengaturanPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'perusahaan' | 'notifikasi' | 'keamanan'>('perusahaan');
  const [busy, setBusy] = useState(false);

  const [company, setCompany] = useState({
    company_name: '',
    address: '',
    whatsapp: '',
    email: '',
    website: '',
    has_logo: false,
    has_stamp: false,
    updated_at: null as string | null,
  });
  const [companyMsg, setCompanyMsg] = useState('');
  const [assetVersion, setAssetVersion] = useState(0);

  const [notif, setNotif] = useState({
    email_enabled: false,
    phone_enabled: false,
    updated_at: null as string | null,
  });
  const [notifMsg, setNotifMsg] = useState('');

  const [authEmail, setAuthEmail] = useState('');
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [secMsg, setSecMsg] = useState('');

  const refreshCompany = async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/v1/company-settings');
      const data = await res.json().catch(() => ({}));
      setCompany({
        company_name: data.company_name || '',
        address: data.address || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        website: data.website || '',
        has_logo: Boolean(data.has_logo),
        has_stamp: Boolean(data.has_stamp),
        updated_at: data.updated_at || null,
      });
    } finally {
      setBusy(false);
    }
  };

  const refreshNotif = async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/v1/notification-settings');
      const data = await res.json().catch(() => ({}));
      setNotif({
        email_enabled: Boolean(data.email_enabled),
        phone_enabled: Boolean(data.phone_enabled),
        updated_at: data.updated_at || null,
      });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    refreshCompany();
    refreshNotif();
    try {
      setAuthEmail((window.localStorage.getItem('mixindo_auth_email') ?? '').trim());
    } catch {
      setAuthEmail('');
    }
  }, []);

  const saveCompany = async () => {
    const payload = {
      company_name: company.company_name.trim() || 'PT. Mixindo Abadi Karya',
      address: company.address.trim() || null,
      whatsapp: company.whatsapp.trim() || null,
      email: company.email.trim() || null,
      website: company.website.trim() || null,
    };
    setBusy(true);
    setCompanyMsg('');
    try {
      const res = await apiFetch('/api/v1/company-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompanyMsg(data.detail || 'Gagal menyimpan.');
        return;
      }
      setCompanyMsg('Perubahan tersimpan.');
      refreshCompany();
    } finally {
      setBusy(false);
      setTimeout(() => setCompanyMsg(''), 2500);
    }
  };

  const saveNotif = async () => {
    setBusy(true);
    setNotifMsg('');
    try {
      const res = await apiFetch('/api/v1/notification-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_enabled: notif.email_enabled, phone_enabled: notif.phone_enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotifMsg(data.detail || 'Gagal menyimpan.');
        return;
      }
      setNotifMsg('Perubahan tersimpan.');
      refreshNotif();
    } finally {
      setBusy(false);
      setTimeout(() => setNotifMsg(''), 2500);
    }
  };

  const changePassword = async () => {
    const email = authEmail.trim();
    if (!email) {
      setSecMsg('Email login tidak ditemukan. Silakan login ulang.');
      setTimeout(() => setSecMsg(''), 2500);
      return;
    }
    if (!oldPw.trim() || !newPw.trim()) {
      setSecMsg('Password lama & baru wajib diisi.');
      setTimeout(() => setSecMsg(''), 2500);
      return;
    }

    setBusy(true);
    setSecMsg('');
    try {
      const res = await apiFetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, old_password: oldPw, new_password: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSecMsg(data.detail || 'Gagal mengubah password.');
        return;
      }
      setOldPw('');
      setNewPw('');
      setSecMsg('Password berhasil diubah.');
    } finally {
      setBusy(false);
      setTimeout(() => setSecMsg(''), 2500);
    }
  };

  const logout = () => {
    try {
      window.localStorage.removeItem('mixindo_auth_email');
      window.localStorage.removeItem('mixindo_actor_username');
    } catch {
      // ignore
    }
    router.replace('/login');
  };

  const uploadAsset = async (kind: 'logo' | 'stamp', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    try {
      const res = await apiFetch(`/api/v1/company-settings/${kind}`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCompanyMsg(data.detail || 'Gagal upload.');
        return;
      }
      setAssetVersion((v) => v + 1);
      refreshCompany();
    } finally {
      setBusy(false);
      setTimeout(() => setCompanyMsg(''), 2500);
    }
  };

  const deleteAsset = async (kind: 'logo' | 'stamp') => {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/company-settings/${kind}`, { method: 'DELETE' });
      setAssetVersion((v) => v + 1);
      refreshCompany();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Sistem</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola konfigurasi dan preferensi sistem</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col md:flex-row overflow-hidden min-h-[500px]">
        
        {/* Sidebar Mini untuk Menu Pengaturan */}
        <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 p-4">
          <ul className="space-y-1">
            <li>
              <button
                type="button"
                onClick={() => setActiveTab('perusahaan')}
                className={`w-full text-left px-4 py-2 font-medium rounded-lg ${activeTab === 'perusahaan' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Perusahaan
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActiveTab('notifikasi')}
                className={`w-full text-left px-4 py-2 font-medium rounded-lg ${activeTab === 'notifikasi' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Notifikasi
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setActiveTab('keamanan')}
                className={`w-full text-left px-4 py-2 font-medium rounded-lg ${activeTab === 'keamanan' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                Keamanan
              </button>
            </li>
          </ul>
        </div>

        {/* Area Konten Utama: Form Informasi Perusahaan */}
        <div className="flex-1 p-8">
          {activeTab === 'perusahaan' ? (
            <>
              <h2 className="text-lg font-bold text-gray-800">Informasi Perusahaan</h2>
              <p className="text-sm text-gray-500 mb-6">Kelola informasi dasar perusahaan</p>

              <div className="max-w-3xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Perusahaan</label>
                <input
                  type="text"
                  value={company.company_name}
                  onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="text"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
              <textarea
                value={company.address}
                onChange={(e) => setCompany({ ...company, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No WhatsApp</label>
                <input
                  type="text"
                  value={company.whatsapp}
                  onChange={(e) => setCompany({ ...company, whatsapp: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">Logo (untuk PDF)</div>
                  {company.has_logo ? (
                    <button
                      type="button"
                      onClick={() => deleteAsset('logo')}
                      className="text-xs text-red-600 hover:underline"
                      disabled={busy}
                    >
                      Hapus
                    </button>
                  ) : null}
                </div>
                <div className="mt-3">
                  {company.has_logo ? (
                    <img
                      src={`${apiUrl('/api/v1/company-settings/logo')}?v=${assetVersion}`}
                      alt="Logo perusahaan"
                      className="max-h-20 object-contain bg-white border rounded p-2"
                    />
                  ) : (
                    <div className="text-xs text-gray-500">Belum ada logo.</div>
                  )}
                </div>
                <label className="mt-3 inline-flex items-center gap-2 text-sm text-blue-700 hover:underline cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) uploadAsset('logo', f);
                    }}
                  />
                </label>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-800">Cap / Stempel (untuk PDF)</div>
                  {company.has_stamp ? (
                    <button
                      type="button"
                      onClick={() => deleteAsset('stamp')}
                      className="text-xs text-red-600 hover:underline"
                      disabled={busy}
                    >
                      Hapus
                    </button>
                  ) : null}
                </div>
                <div className="mt-3">
                  {company.has_stamp ? (
                    <img
                      src={`${apiUrl('/api/v1/company-settings/stamp')}?v=${assetVersion}`}
                      alt="Cap perusahaan"
                      className="max-h-24 object-contain bg-white border rounded p-2"
                    />
                  ) : (
                    <div className="text-xs text-gray-500">Belum ada cap.</div>
                  )}
                </div>
                <label className="mt-3 inline-flex items-center gap-2 text-sm text-blue-700 hover:underline cursor-pointer">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) uploadAsset('stamp', f);
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={refreshCompany}
                className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                disabled={busy}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={saveCompany}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-300"
                disabled={busy}
              >
                Simpan Perubahan
              </button>
              {companyMsg ? <div className="text-xs text-green-700">{companyMsg}</div> : null}
              {company.updated_at ? <div className="ml-auto text-xs text-gray-400">Update: {new Date(company.updated_at).toLocaleString()}</div> : null}
            </div>
              </div>
            </>
          ) : null}

          {activeTab === 'notifikasi' ? (
            <div className="max-w-3xl space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Notifikasi</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Kirim notifikasi jika proyek 100% selesai, ada aktivitas CRUD pada laporan, atau ada aktivitas CRUD pada dokumen.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center justify-between gap-4 border rounded-xl p-4 hover:bg-gray-50">
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">Notifikasi Email</div>
                    <div className="text-xs text-gray-500">Aktif/nonaktifkan notifikasi via email.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notif.email_enabled}
                    onChange={(e) => setNotif({ ...notif, email_enabled: e.target.checked })}
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 border rounded-xl p-4 hover:bg-gray-50">
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">Notifikasi No HP</div>
                    <div className="text-xs text-gray-500">Aktif/nonaktifkan notifikasi via no HP.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notif.phone_enabled}
                    onChange={(e) => setNotif({ ...notif, phone_enabled: e.target.checked })}
                    className="h-5 w-5"
                  />
                </label>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={refreshNotif}
                  className="px-6 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                  disabled={busy}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={saveNotif}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-300"
                  disabled={busy}
                >
                  Simpan
                </button>
                {notifMsg ? <div className="text-xs text-green-700">{notifMsg}</div> : null}
                {notif.updated_at ? <div className="ml-auto text-xs text-gray-400">Update: {new Date(notif.updated_at).toLocaleString()}</div> : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'keamanan' ? (
            <div className="max-w-3xl space-y-5">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Keamanan</h2>
                <p className="text-sm text-gray-500 mt-1">Kelola password akun dan sesi login.</p>
              </div>

              <div className="border rounded-xl p-4 bg-gray-50">
                <div className="text-sm text-gray-700">
                  Email login: <span className="font-semibold">{authEmail || '-'}</span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="mt-3 px-4 py-2 border border-gray-200 rounded-lg hover:bg-white text-sm font-medium"
                >
                  Logout
                </button>
              </div>

              <div className="border rounded-xl p-4">
                <div className="font-semibold text-gray-800 text-sm">Ubah Password</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
                    <input
                      type="password"
                      value={oldPw}
                      onChange={(e) => setOldPw(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                    <input
                      type="password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={changePassword}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:bg-blue-300"
                    disabled={busy}
                  >
                    Simpan
                  </button>
                  {secMsg ? <div className="text-xs text-green-700">{secMsg}</div> : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
        
      </div>
    </div>
  );
}
