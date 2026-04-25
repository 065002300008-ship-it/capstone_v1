'use client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { alertSuccess, alertError, alertConfirm, toastSuccess } from '@/lib/alerts';
import { apiFetch, apiUrl } from '@/lib/api';

type Project = {
  id: string;
  project_code: string;
  name: string;
  description?: string | null;
  client_name?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  status: string;
  budget?: number | null;
  progress?: number | null;
};

export default function ProjectPage() {
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(''); // ✅ ID disimpan di sini
  const router = useRouter();
  const [statusParam, setStatusParam] = useState('');

  useEffect(() => {
    try {
      const next = (new URLSearchParams(window.location.search).get('status') || '').trim();
      setStatusParam(next);
    } catch {
      setStatusParam('');
    }
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_name: '',
    start_date: '',
    deadline: '',
    status: 'Planning',
    budget: 0,
    progress: 0
  });

  const fetchProjects = async () => {
    try {
      const res = await apiFetch('/api/v1/projects');
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Fetch error:", e);
      setProjects([]);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // TAMBAH
  const handleAddClick = () => {
    setIsEditMode(false);
    setSelectedId('');
    setFormData({
      name: '',
      description: '',
      client_name: '',
      start_date: '',
      deadline: '',
      status: 'Planning',
      budget: 0,
      progress: 0
    });
    setIsModalOpen(true);
  };

  // EDIT
  const handleEditClick = (project: Project) => {
    setIsEditMode(true);
    setSelectedId(project.id); // ✅ simpan ID di sini

    setFormData({
      name: project.name || '',
      description: project.description || '',
      client_name: project.client_name || '',
      start_date: project.start_date || '',
      deadline: project.deadline || '',
      status: project.status || 'Planning',
      budget: project.budget || 0,
      progress: project.progress || 0
    });

    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = isEditMode
      ? apiUrl(`/api/v1/projects/${selectedId}`)
      : apiUrl('/api/v1/projects');

    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData), // ✅ tidak ada ID
      });

      const data = await res.json();

      if (!res.ok) {
        alertError("Gagal Menyimpan", data.detail || "Terjadi kesalahan pada server");
        return;
      }

      await alertSuccess(
        isEditMode ? "Proyek Diperbarui! 🔄" : "Proyek Berhasil Ditambahkan! ✨",
        `Proyek "${formData.name}" telah tersimpan.`
      );

      setIsModalOpen(false);
      fetchProjects();

    } catch (error) {
      alertError("Koneksi Gagal", "Pastikan backend server berjalan di port 8000.");
    }
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    const result = await alertConfirm("Hapus Proyek?", `Hapus proyek "${projectName}"?`, "Ya, Hapus");
    if (!result.isConfirmed) return;

    try {
      const res = await apiFetch(`/api/v1/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();

      toastSuccess("Data berhasil dihapus");
      fetchProjects();
    } catch (error) {
      alertError("Gagal Menghapus", "Terjadi kesalahan koneksi.");
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "Planning") return "bg-gray-200 text-gray-700";
    if (status === "In Progress") return "bg-blue-100 text-blue-700";
    if (status === "Completed") return "bg-green-100 text-green-700";
    return "bg-red-100 text-red-700";
  };

  const inputStyle = "w-full border p-2 rounded bg-white text-gray-800 focus:ring-2 focus:ring-blue-400 outline-none";
  const formatIDR = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);

  const filteredProjects = projects.filter((p) => {
    if (statusParam && (p.status || '') !== statusParam) return false;
    if (!search) return true;
    return (
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.project_code || '').toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="p-6 bg-gray-50 min-h-screen">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 text-gray-800">

  {/* LEFT SIDE */}
  <div className="w-full">
    <h1 className="text-3xl font-bold text-blue-700">Daftar Proyek</h1>
    <p className="text-gray-500 text-sm mb-3">Kelola semua proyek Mixindo</p>

    {statusParam ? (
      <div className="mb-3">
        <span className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
          Filter status: {statusParam}
          <button
            onClick={() => {
              setStatusParam('');
              router.push('/proyek');
            }}
            className="text-blue-700 hover:underline font-bold"
            aria-label="Hapus filter"
          >
            ✕
          </button>
        </span>
      </div>
    ) : null}

    {/* SEARCH */}
    <div className="w-full md:w-[400px]">
      <input
        type="text"
        placeholder="🔍 Cari nama proyek / kode proyek..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border px-4 py-2 rounded-xl shadow-sm 
                   focus:ring-2 focus:ring-blue-400 outline-none
                   transition-all duration-200"
      />
    </div>
  </div>

  {/* RIGHT SIDE */}
  <button
    onClick={handleAddClick}
    className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-bold shadow h-fit"
  >
    + Tambah Proyek
  </button>

</div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-gray-700 font-semibold text-left">
            <tr>
              <th className="p-4">ID</th>
              <th>Nama Proyek</th>
              <th>Client</th>
              <th>Status</th>
              <th>Budget</th>
              <th>Progress</th>
              <th className="text-center">Aksi</th>
            </tr>
          </thead>

          <tbody>
  {filteredProjects.length > 0 ? (
    filteredProjects.map((p) => (
      <tr key={p.id} className="border-b hover:bg-gray-50 text-gray-700">
        
        <td className="p-4 text-blue-600 font-bold">
          {p.project_code}
        </td>

        <td
          className="font-medium text-blue-600 cursor-pointer hover:underline"
          onClick={() => router.push(`/proyek/${p.id}`)}
        >
          {p.name}
        </td>

        <td>{p.client_name}</td>

        <td>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(p.status)}`}>
            {p.status}
          </span>
        </td>

        <td className="text-gray-700 font-semibold">
          {formatIDR(Number(p.budget || 0))}
        </td>

        <td className="w-[150px]">
          <div className="w-full bg-gray-200 h-2 rounded-full mb-1">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${p.progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{p.progress}%</span>
        </td>

        <td className="p-4 text-center space-x-2">

  <button
    onClick={() => router.push(`/proyek/${p.id}`)}
    className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white px-3 py-1 rounded text-sm font-semibold"
  >
    🔍 Detail
  </button>

  <button
    onClick={() => handleEditClick(p)}
    className="bg-amber-500 hover:bg-amber-600 active:scale-95 transition text-white px-3 py-1 rounded text-sm font-semibold"
  >
    ✏️ Edit
  </button>

  <button
    onClick={() => handleDelete(p.id, p.name)}
    className="bg-red-500 hover:bg-red-600 active:scale-95 transition text-white px-3 py-1 rounded text-sm font-semibold"
  >
    🗑️ Hapus
  </button>

  <button
    onClick={() => {
      window.open(apiUrl(`/api/v1/projects/${p.id}/report`), '_blank');
    }}
    className="bg-purple-600 hover:bg-purple-700 active:scale-95 transition text-white px-3 py-1 rounded text-sm font-semibold"
  >
    📄 Laporan
  </button>

</td>

      </tr>
    ))
  ) : (
    <tr>
      <td colSpan={7} className="text-center p-6 text-gray-400 italic">
        🔍 Tidak ada proyek ditemukan
      </td>
    </tr>
  )}
</tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4 text-gray-800">
          <div className="bg-white p-6 rounded-2xl w-full max-w-lg shadow-2xl relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 text-xl font-bold"
              >
                ✕
            </button>

            <h2 className="text-xl font-bold mb-4">
              {isEditMode ? "Edit Proyek" : "Tambah Proyek"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">

              <input placeholder="Nama Proyek" className={inputStyle}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <textarea placeholder="Deskripsi" className={inputStyle}
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />

              <input placeholder="Client" className={inputStyle}
                value={formData.client_name}
                onChange={e => setFormData({ ...formData, client_name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={inputStyle}
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                />
                <input type="date" className={inputStyle}
                  value={formData.deadline}
                  onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <select
                  className={inputStyle}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Planning">Planning</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
                <input
                  type="number"
                  placeholder="Budget (IDR)"
                  className={inputStyle}
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                  min={0}
                />
              </div>

              <button type="submit" className="bg-blue-600 text-white w-full py-2 rounded">
                {isEditMode ? "Update" : "Tambah"}
              </button>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
