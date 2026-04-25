'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { alertConfirm, alertError, alertSuccess } from '@/lib/alerts';
import { apiFetch } from '@/lib/api';

type User = {
  id: string;
  username: string;
  email_or_phone?: string | null;
  status: 'active' | 'inactive';
  role: 'admin' | 'owner';
  last_seen_at?: string | null;
};

type UserForm = {
  username: string;
  email_or_phone: string;
  status: User['status'];
  role: User['role'];
};

export default function UserManagementPage() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<UserForm>({
    username: '',
    email_or_phone: '',
    status: 'active',
    role: 'admin',
  });

  const resetForm = () => setForm({ username: '', email_or_phone: '', status: 'active', role: 'admin' });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/users');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alertError('Gagal Memuat', 'Backend server tidak merespon.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openAdd = () => {
    setIsEditMode(false);
    setEditingId(null);
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (u: User) => {
    setIsEditMode(true);
    setEditingId(u.id);
    setForm({
      username: u.username,
      email_or_phone: u.email_or_phone || '',
      status: u.status,
      role: u.role,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch(isEditMode ? `/api/v1/users/${editingId}` : '/api/v1/users', {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username,
          email_or_phone: form.email_or_phone || null,
          status: form.status,
          role: form.role,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alertError('Gagal', data.detail || 'Terjadi kesalahan pada server.');
        return;
      }
      await alertSuccess('Berhasil', isEditMode ? 'User diperbarui' : 'User ditambahkan');
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error(err);
      alertError('Koneksi Gagal', 'Backend server tidak merespon.');
    }
  };

  const handleDelete = async (u: User) => {
    const ok = await alertConfirm('Hapus user?', `Hapus "${u.username}"?`, 'Ya, Hapus');
    if (!ok.isConfirmed) return;
    const res = await apiFetch(`/api/v1/users/${u.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alertError('Gagal', data.detail || 'Terjadi kesalahan pada server.');
      return;
    }
    fetchUsers();
  };

  const sorted = useMemo(() => items.slice(), [items]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500">Akses dibatasi untuk role admin/owner (sementara belum ada auth).</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold"
          >
            Refresh
          </button>
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold shadow-md transition"
          >
            + Tambah User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-700 border-b">
            <tr>
              <th className="px-6 py-4 font-semibold">Email/No Hp</th>
              <th className="px-6 py-4 font-semibold">Username</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold">Role</th>
              <th className="px-6 py-4 font-semibold">Terakhir Dilihat</th>
              <th className="px-6 py-4 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Memuat...</td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Belum ada user.</td>
              </tr>
            ) : (
              sorted.map((u) => (
                <tr key={u.id} className="border-b hover:bg-gray-50 transition">
                  <td className="px-6 py-4">{u.email_or_phone || '-'}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{u.username}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => openEdit(u)} className="text-blue-700 hover:underline font-semibold">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline font-semibold">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl text-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{isEditMode ? 'Edit User' : 'Tambah User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500 text-xl font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                className="w-full p-2.5 border rounded-lg bg-white text-black outline-none"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                disabled={isEditMode}
              />

              <input
                type="text"
                placeholder="Email / No Hp"
                className="w-full p-2.5 border rounded-lg bg-white text-black outline-none"
                value={form.email_or_phone}
                onChange={(e) => setForm({ ...form, email_or_phone: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="w-full p-2.5 border rounded-lg bg-white text-black outline-none"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as User['status'] })}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>

                <select
                  className="w-full p-2.5 border rounded-lg bg-white text-black outline-none"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as User['role'] })}
                >
                  <option value="admin">admin</option>
                  <option value="owner">owner</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500">
                  Batal
                </button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold shadow-lg">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
