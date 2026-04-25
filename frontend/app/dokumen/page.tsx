'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { alertConfirm, alertError, alertSuccess } from '@/lib/alerts';
import { apiFetch, apiUrl } from '@/lib/api';

type DocumentFile = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at?: string | null;
  last_action?: string | null;
  last_actor_username?: string | null;
  last_action_at?: string | null;
};

type AuditLog = {
  id: string;
  actor_username?: string | null;
  scope: string;
  action: string;
  entity_type: string;
  entity_label?: string | null;
  created_at?: string | null;
};

type SortKey = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc';

export default function DokumenPage() {
  const [items, setItems] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('date_desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/document-files');
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      alertError('Gagal Memuat', 'Backend server tidak merespon.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await apiFetch('/api/v1/audit-logs?scope=document&limit=8');
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch {
      setAuditLogs([]);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchAudit();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    let next = items.slice();
    if (q) next = next.filter((x) => (x.filename || '').toLowerCase().includes(q));
    if (from) next = next.filter((x) => x.created_at ? new Date(x.created_at) >= from : true);
    if (to) next = next.filter((x) => x.created_at ? new Date(x.created_at) <= to : true);

    next.sort((a, b) => {
      if (sort === 'date_desc') return (b.created_at || '').localeCompare(a.created_at || '');
      if (sort === 'date_asc') return (a.created_at || '').localeCompare(b.created_at || '');
      if (sort === 'name_asc') return (a.filename || '').localeCompare(b.filename || '');
      if (sort === 'name_desc') return (b.filename || '').localeCompare(a.filename || '');
      return 0;
    });
    return next;
  }, [items, search, dateFrom, dateTo, sort]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((x) => selected.has(x.id));

  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const x of filtered) next.delete(x.id);
      } else {
        for (const x of filtered) next.add(x.id);
      }
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    const filesArr = Array.from(selectedFiles);
    e.target.value = '';

    (async () => {
      try {
        for (const f of filesArr) {
          const fd = new FormData();
          fd.append('file', f);
          const res = await apiFetch('/api/v1/document-files', { method: 'POST', body: fd });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            alertError('Gagal Upload', data.detail || 'Terjadi kesalahan pada server.');
            return;
          }
        }
        await alertSuccess('Berhasil', 'File diupload');
        fetchItems();
        fetchAudit();
      } catch (err) {
        console.error(err);
        alertError('Koneksi Gagal', 'Backend server tidak merespon.');
      }
    })();
  };

  const deleteOne = async (id: string) => {
    const item = items.find((x) => x.id === id);
    const ok = await alertConfirm('Hapus file?', `Hapus "${item?.filename || id}"?`, 'Ya, Hapus');
    if (!ok.isConfirmed) return;
    const res = await apiFetch(`/api/v1/document-files/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchItems();
      fetchAudit();
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    const ok = await alertConfirm('Hapus file terpilih?', `Hapus ${selected.size} file?`, 'Ya, Hapus');
    if (!ok.isConfirmed) return;

    for (const id of Array.from(selected)) {
      // eslint-disable-next-line no-await-in-loop
      await apiFetch(`/api/v1/document-files/${id}`, { method: 'DELETE' });
    }
    fetchItems();
    fetchAudit();
  };

  const renameOne = async (file: DocumentFile) => {
    const next = window.prompt('Ubah nama file', file.filename);
    if (!next) return;
    const filename = next.trim();
    if (!filename || filename === file.filename) return;
    const res = await apiFetch(`/api/v1/document-files/${file.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (res.ok) {
      fetchItems();
      fetchAudit();
    }
  };

  return (
    <div className="p-6 bg-[#f8f9fa] min-h-screen text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Dokumen</h1>
        <label className="bg-green-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-700">
          Upload File
          <input type="file" multiple accept="*/*" hidden onChange={handleUpload} />
        </label>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nama file..."
            className="border p-2 rounded bg-white text-gray-800 placeholder:text-gray-400"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="border p-2 rounded bg-white">
            <option value="date_desc">Tanggal (Terbaru)</option>
            <option value="date_asc">Tanggal (Terlama)</option>
            <option value="name_asc">Nama (A-Z)</option>
            <option value="name_desc">Nama (Z-A)</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border p-2 rounded bg-white" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border p-2 rounded bg-white" />
        </div>

        <div className="flex justify-between items-center mt-3">
          <div className="text-sm text-gray-600">
            {selected.size > 0 ? `${selected.size} terpilih` : `${filtered.length} item`}
          </div>
          <div className="flex gap-2">
            <button
              onClick={deleteSelected}
              disabled={selected.size === 0}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                selected.size === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              Hapus Terpilih
            </button>
            <button
              onClick={fetchItems}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-200 hover:bg-gray-300 text-gray-700"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-3 text-left w-10">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} />
              </th>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Tipe</th>
              <th className="p-3 text-left">Ukuran</th>
              <th className="p-3 text-left">Tanggal</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">Memuat...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">Belum ada file.</td>
              </tr>
            ) : (
              filtered.map((file) => (
                <tr key={file.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(file.id)}
                      onChange={(e) => toggleOne(file.id, e.target.checked)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-gray-800">{file.filename}</div>
                    <div className="text-[11px] text-gray-500">
                      {file.last_action ? (
                        <>
                          Terakhir: {file.last_action} {file.last_actor_username ? `oleh ${file.last_actor_username}` : ''}{' '}
                          {file.last_action_at ? `• ${new Date(file.last_action_at).toLocaleString()}` : ''}
                        </>
                      ) : (
                        'Terakhir: -'
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-gray-500">{file.content_type || 'application/octet-stream'}</td>
                  <td className="p-3 text-gray-500">{(file.size_bytes / 1024).toFixed(1)} KB</td>
                  <td className="p-3 text-gray-500">{file.created_at ? new Date(file.created_at).toLocaleString() : '-'}</td>
                  <td className="p-3 text-right space-x-3">
                    <a
                      href={apiUrl(`/api/v1/document-files/${file.id}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      Buka
                    </a>
                    <a
                      href={apiUrl(`/api/v1/document-files/${file.id}?download=1`)}
                      className="text-green-700 hover:underline"
                    >
                      Download
                    </a>
                    <button onClick={() => deleteOne(file.id)} className="text-red-600 hover:underline">
                      Hapus
                    </button>
                    <button onClick={() => renameOne(file)} className="text-amber-700 hover:underline">
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Aktivitas Terakhir</h3>
          <button onClick={fetchAudit} className="text-xs text-blue-700 hover:underline">Refresh</button>
        </div>
        {auditLogs.length === 0 ? (
          <div className="text-xs text-gray-500 mt-2">Belum ada aktivitas.</div>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {auditLogs.map((x) => (
              <li key={x.id}>
                <span className="font-semibold">{x.action}</span>{' '}
                <span className="text-gray-500">{x.entity_label || x.entity_type}</span>{' '}
                <span className="text-gray-400">
                  {x.actor_username ? `• ${x.actor_username}` : ''}{x.created_at ? ` • ${new Date(x.created_at).toLocaleString()}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
