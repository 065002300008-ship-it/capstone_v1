'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { alertConfirm, alertError, alertSuccess } from '@/lib/alerts';
import { apiFetch, apiUrl } from '@/lib/api';

type MaterialTest = {
  id: string;
  material_no?: string | null;
  material_name: string;
  test_no?: number | null;
  test_name: string;
  display_no?: string | null;
};

export default function TesMaterialPage() {
  const [items, setItems] = useState<MaterialTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string>('');
  const [formData, setFormData] = useState({
    material_no: '',
    material_name: '',
    test_no: '',
    test_name: '',
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/v1/material-tests');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
      alertError('Gagal Memuat', 'Backend server tidak merespon (port 8000).');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      const no = (x.display_no || '').toLowerCase();
      return (
        no.includes(q) ||
        x.material_name.toLowerCase().includes(q) ||
        x.test_name.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const openAdd = () => {
    setIsEditMode(false);
    setEditingId('');
    setFormData({ material_no: '', material_name: '', test_no: '', test_name: '' });
    setIsModalOpen(true);
  };

  const openEdit = (x: MaterialTest) => {
    setIsEditMode(true);
    setEditingId(x.id);
    setFormData({
      material_no: x.material_no || '',
      material_name: x.material_name || '',
      test_no: x.test_no != null ? String(x.test_no) : '',
      test_name: x.test_name || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_name.trim() || !formData.test_name.trim()) {
      alertError('Field Tidak Lengkap', 'Jenis Material dan Jenis Pengujian wajib diisi.');
      return;
    }

    const payload = {
      material_no: formData.material_no.trim() || null,
      material_name: formData.material_name.trim(),
      test_no: formData.test_no.trim() ? Number(formData.test_no) : null,
      test_name: formData.test_name.trim(),
    };

    try {
    const url = isEditMode
        ? apiUrl(`/api/v1/material-tests/${editingId}`)
        : apiUrl('/api/v1/material-tests');
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertError('Gagal Menyimpan', data.detail || 'Terjadi kesalahan pada server.');
        return;
      }

      await alertSuccess('Berhasil', isEditMode ? 'Data tes material diperbarui.' : 'Data tes material ditambahkan.');
      setIsModalOpen(false);
      await fetchItems();
    } catch (err) {
      console.error(err);
      alertError('Koneksi Gagal', 'Backend server tidak merespon.');
    }
  };

  const handleDelete = async (x: MaterialTest) => {
    const confirm = await alertConfirm(
      'Hapus Tes Material?',
      `Hapus "${x.material_name}" - "${x.test_name}"?`,
      'Ya, Hapus'
    );
    if (!confirm.isConfirmed) return;

    try {
      const res = await apiFetch(`/api/v1/material-tests/${x.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertError('Gagal Menghapus', data.detail || 'Terjadi kesalahan.');
        return;
      }
      await alertSuccess('Terhapus', 'Data tes material berhasil dihapus.');
      await fetchItems();
    } catch (err) {
      console.error(err);
      alertError('Koneksi Gagal', 'Backend server tidak merespon.');
    }
  };

  const inputStyle =
    'w-full border p-2 rounded bg-white text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-400 outline-none';

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Tes Material</h1>
          <p className="text-sm text-gray-500">Master data tes material (CRUD)</p>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari material / pengujian..."
              className="border px-3 py-2 rounded-l-lg w-[280px] bg-white text-gray-800 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => {}}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-r-lg text-sm"
              aria-label="Search"
              title="Search"
            >
              🔍
            </button>
          </div>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            + Tambah
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700 border-b">
            <tr>
              <th className="p-4 text-left w-[90px]">No</th>
              <th className="p-4 text-left">Jenis Material</th>
              <th className="p-4 text-left">Jenis Pengujian</th>
              <th className="p-4 text-left w-[160px]">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400 italic">
                  Memuat...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-400 italic">
                  Tidak ada data
                </td>
              </tr>
            ) : (
              filtered.map((x) => (
                <tr key={x.id} className="border-b hover:bg-gray-50">
                  <td className="p-4 font-mono text-blue-700">{x.display_no || '-'}</td>
                  <td className="p-4 text-gray-800 font-semibold">{x.material_name}</td>
                  <td className="p-4 text-gray-700">{x.test_name}</td>
                  <td className="p-4 flex gap-2">
                    <button
                      onClick={() => openEdit(x)}
                      className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded text-xs font-semibold"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(x)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl text-gray-800 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl font-bold"
            >
              ✕
            </button>

            <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Edit Tes Material' : 'Tambah Tes Material'}</h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="No Material (I/II/III)"
                  className={inputStyle}
                  value={formData.material_no}
                  onChange={(e) => setFormData({ ...formData, material_no: e.target.value })}
                />
                <input
                  placeholder="No Tes (1/2/3)"
                  className={inputStyle}
                  value={formData.test_no}
                  onChange={(e) => setFormData({ ...formData, test_no: e.target.value })}
                />
              </div>

              <input
                placeholder="Jenis Material"
                className={inputStyle}
                value={formData.material_name}
                onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
                required
              />

              <textarea
                placeholder="Jenis Pengujian"
                className={inputStyle}
                value={formData.test_name}
                onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                required
              />

              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full py-2 rounded-lg">
                Simpan
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
