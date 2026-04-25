'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl } from '@/lib/api';

type StoredFile = {
  id: string;
  folder_id: string;
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

export default function LaporanPage() {
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [currentFolder, setCurrentFolder] = useState<{ id: string; name: string } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const folderFiles = useMemo(() => {
    if (!currentFolder) return [];
    return files;
  }, [files, currentFolder]);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/v1/report-folders');
      const data = await res.json();
      setFolders(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      const res = await apiFetch('/api/v1/audit-logs?scope=report&limit=8');
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch {
      setAuditLogs([]);
    }
  };

  const fetchFiles = async (folderId: string) => {
    setLoadingFiles(true);
    try {
      const res = await apiFetch(`/api/v1/report-folders/${folderId}/files`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchFolders();
    fetchAudit();
  }, []);

  const handleCreateFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    const res = await apiFetch('/api/v1/report-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setFolderName('');
      setIsModalOpen(false);
      fetchFolders();
      fetchAudit();
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const res = await apiFetch(`/api/v1/report-folders/${folderId}`, { method: 'DELETE' });
    if (res.ok) {
      if (currentFolder?.id === folderId) {
        setCurrentFolder(null);
        setFiles([]);
      }
      fetchFolders();
      fetchAudit();
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentFolder) return;
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    const filesArr = Array.from(selectedFiles);
    e.target.value = '';

    (async () => {
      for (const f of filesArr) {
        const fd = new FormData();
        fd.append('folder_id', currentFolder.id);
        fd.append('file', f);
        await apiFetch('/api/v1/report-files', { method: 'POST', body: fd });
      }
      fetchFiles(currentFolder.id);
      fetchAudit();
    })();
  };

  const deleteFile = async (fileId: string) => {
    const res = await apiFetch(`/api/v1/report-files/${fileId}`, { method: 'DELETE' });
    if (res.ok && currentFolder) {
      fetchFiles(currentFolder.id);
      fetchAudit();
    }
  };

  const renameFile = async (file: StoredFile) => {
    const next = window.prompt('Ubah nama file', file.filename);
    if (!next) return;
    const filename = next.trim();
    if (!filename || filename === file.filename) return;
    const res = await apiFetch(`/api/v1/report-files/${file.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    });
    if (res.ok && currentFolder) {
      fetchFiles(currentFolder.id);
      fetchAudit();
    }
  };

  return (
    <div className="p-6 bg-[#f8f9fa] min-h-screen text-gray-800">
      <div className="flex justify-between items-center mb-6">
        {!currentFolder ? (
          <h1 className="text-2xl font-semibold">Laporan</h1>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentFolder(null)} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
              Kembali
            </button>
            <h1 className="text-xl font-semibold">{currentFolder.name}</h1>
          </div>
        )}

        {!currentFolder ? (
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Folder Baru
          </button>
        ) : (
          <label className="bg-green-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-700">
            Upload File
            <input type="file" multiple accept="*/*" hidden onChange={handleUpload} />
          </label>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="p-3 text-left">Nama</th>
              <th className="p-3 text-left">Tipe</th>
              <th className="p-3 text-left">Ukuran</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!currentFolder ? (
              loading ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    Memuat...
                  </td>
                </tr>
              ) :
              folders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500">
                    Belum ada folder.
                  </td>
                </tr>
              ) : (
                folders.map((f) => (
                  <tr key={f.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <button
                        onClick={() => {
                          setCurrentFolder(f);
                          fetchFiles(f.id);
                        }}
                        className="text-blue-700 hover:underline"
                      >
                        {f.name}
                      </button>
                    </td>
                    <td className="p-3 text-gray-400">-</td>
                    <td className="p-3 text-gray-400">-</td>
                    <td className="p-3 text-right">
                      <button onClick={() => handleDeleteFolder(f.id)} className="text-red-600 hover:underline">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )
            ) : loadingFiles ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Memuat...
                </td>
              </tr>
            ) : folderFiles.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Belum ada file di folder ini.
                </td>
              </tr>
            ) : (
              folderFiles.map((file) => (
                <tr key={file.id} className="border-b hover:bg-gray-50">
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
                  <td className="p-3 text-right space-x-3">
                    <a
                      href={apiUrl(`/api/v1/report-files/${file.id}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      Buka
                    </a>
                    <a
                      href={apiUrl(`/api/v1/report-files/${file.id}?download=1`)}
                      className="text-green-700 hover:underline"
                    >
                      Download
                    </a>
                    <button onClick={() => renameFile(file)} className="text-amber-700 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => deleteFile(file.id)} className="text-red-600 hover:underline">
                      Hapus
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Buat Folder</h2>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Nama folder..."
              className="w-full border p-2 rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">
                Batal
              </button>
              <button onClick={handleCreateFolder} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
