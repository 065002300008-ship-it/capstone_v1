'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { alertSuccess, alertConfirm, alertError } from '@/lib/alerts';
import { apiFetch, apiUrl } from '@/lib/api';

type MaterialTest = {
  id: string;
  material_no?: string | null;
  material_name: string;
  test_no?: number | null;
  test_name: string;
  display_no?: string | null;
};

type Project = {
  id: string;
  project_code: string;
  name: string;
  description?: string | null;
  client_name?: string | null;
  status?: string | null;
  progress?: number | null;
  start_date?: string | null;
  deadline?: string | null;
};

type Task = {
  id: string;
  material_test_id?: string | null;
  material_name?: string | null;
  test_name?: string | null;
  title?: string | null;
  description?: string | null;
  progress?: number | null;
  deadline?: string | null;
  status: string;
};

export default function ProjectDetailPage() {
  const [search, setSearch] = useState('');
  const [checklistSearch, setChecklistSearch] = useState('');
  const { id } = useParams();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materialTests, setMaterialTests] = useState<MaterialTest[]>([]);
  const [filter, setFilter] = useState('All');

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');

  const [editDescription, setEditDescription] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [editDeadline, setEditDeadline] = useState('');

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('Pending');
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkDeadline, setBulkDeadline] = useState('');
  const [bulkDescription, setBulkDescription] = useState('');
  const [bulkApplyStatus, setBulkApplyStatus] = useState(true);
  const [bulkApplyProgress, setBulkApplyProgress] = useState(true);
  const [bulkApplyDeadline, setBulkApplyDeadline] = useState(false);
  const [bulkApplyDescription, setBulkApplyDescription] = useState(false);

  const fetchData = async () => {
    try {
      const [resProject, resTasks, resMaster] = await Promise.all([
        apiFetch(`/api/v1/projects/${id}`),
        apiFetch(`/api/v1/projects/${id}/tasks`),
        apiFetch('/api/v1/material-tests'),
      ]);

      const projectData = await resProject.json();
      const taskData = await resTasks.json();
      const masterData = await resMaster.json();

      setProject(projectData);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setMaterialTests(Array.isArray(masterData) ? masterData : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  useEffect(() => {
    try {
      const f = (new URLSearchParams(window.location.search).get('filter') || '').trim();
      if (!f) return;
      if (['All', 'Pending', 'In Progress', 'Done'].includes(f)) setFilter(f);
    } catch {
      // ignore
    }
  }, []);

  const committedTaskByMaterialTestId = new Map<string, Task>(
    tasks
      .filter((t) => t.material_test_id)
      .map((t) => [String(t.material_test_id), t])
  );

  const committedSelectedSet = new Set<string>(committedTaskByMaterialTestId.keys());
  const [pendingSelectedSet, setPendingSelectedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPendingSelectedSet(new Set(committedSelectedSet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  const isSelected = (materialTestId: string) => pendingSelectedSet.has(materialTestId);

  const checklistQuery = checklistSearch.trim().toLowerCase();
  const visibleMaterialTests = checklistQuery
    ? materialTests.filter((x) => {
        const material = (x.material_name || '').toLowerCase();
        const test = (x.test_name || '').toLowerCase();
        return material.includes(checklistQuery) || test.includes(checklistQuery);
      })
    : materialTests;

  const checklistDirty =
    committedSelectedSet.size !== pendingSelectedSet.size ||
    Array.from(pendingSelectedSet).some((x) => !committedSelectedSet.has(x)) ||
    Array.from(committedSelectedSet).some((x) => !pendingSelectedSet.has(x));

  const handleCancelChecklist = () => {
    setPendingSelectedSet(new Set(committedSelectedSet));
  };

  const handleConfirmChecklist = async () => {
    const toAdd = Array.from(pendingSelectedSet).filter((x) => !committedSelectedSet.has(x));
    const toRemove = Array.from(committedSelectedSet).filter((x) => !pendingSelectedSet.has(x));

    if (toAdd.length === 0 && toRemove.length === 0) return;

    try {
      // Remove first (so re-adding stays consistent if needed)
      for (const materialTestId of toRemove) {
        const existing = committedTaskByMaterialTestId.get(materialTestId);
        if (!existing?.id) continue;
        // eslint-disable-next-line no-await-in-loop
        await apiFetch(`/api/v1/tasks/${existing.id}`, { method: 'DELETE' });
      }

      for (const materialTestId of toAdd) {
        // eslint-disable-next-line no-await-in-loop
        const res = await apiFetch('/api/v1/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: id,
            material_test_id: materialTestId,
            description: '',
            progress: 0,
            deadline: null,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alertError('Gagal', data.detail || 'Terjadi kesalahan pada server.');
          return;
        }
      }

      await alertSuccess('Berhasil', 'Checklist disimpan');
      fetchData();
    } catch (e) {
      console.error(e);
      alertError('Koneksi Gagal', 'Backend server tidak merespon.');
    }
  };

  const toggleOne = (materialTestId: string, nextChecked: boolean) => {
    setPendingSelectedSet((prev) => {
      const next = new Set(prev);
      if (nextChecked) next.add(materialTestId);
      else next.delete(materialTestId);
      return next;
    });
  };

  const toggleMaterial = (materialName: string, nextChecked: boolean) => {
    const group = visibleMaterialTests.filter((x) => x.material_name === materialName);
    if (group.length === 0) return;

    setPendingSelectedSet((prev) => {
      const next = new Set(prev);
      for (const x of group) {
        if (nextChecked) next.add(x.id);
        else next.delete(x.id);
      }
      return next;
    });
  };

  // ================= START EDIT =================
  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditStatus(task.status);

    setEditDescription(task.description || '');
    setEditProgress(task.progress || 0);
    setEditDeadline(task.deadline || '');
  };

  // ================= SAVE EDIT =================
  const handleSaveEdit = async () => {
    if (!editingTaskId) return;

    const confirm = await alertConfirm(
      "Simpan perubahan?",
      "Perubahan pengujian akan disimpan",
      "Ya, Simpan"
    );

    if (!confirm.isConfirmed) return;

    await apiFetch(`/api/v1/tasks/${editingTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: editDescription,
        progress: editProgress,
        deadline: editDeadline || null,
        status: editStatus
      })
    });

    setEditingTaskId(null);

    await alertSuccess("Berhasil", "Pengujian diperbarui");
    fetchData();
  };

  // ================= DELETE =================
  const handleDelete = async (taskId: string) => {
    const confirm = await alertConfirm(
      "Hapus pengujian?",
      "Data akan dihapus permanen",
      "Ya, Hapus"
    );

    if (!confirm.isConfirmed) return;

    await apiFetch(`/api/v1/tasks/${taskId}`, {
      method: 'DELETE'
    });

    await alertSuccess("Berhasil", "Pengujian dihapus");
    fetchData();
  };

  const openBulkEdit = () => {
    const first = tasks[0];
    setBulkStatus(first?.status || 'Pending');
    setBulkProgress(typeof first?.progress === 'number' ? first.progress : 0);
    setBulkDeadline(first?.deadline || '');
    setBulkDescription(first?.description || '');
    setBulkApplyStatus(true);
    setBulkApplyProgress(true);
    setBulkApplyDeadline(false);
    setBulkApplyDescription(false);
    setIsBulkModalOpen(true);
  };

  const handleBulkSave = async () => {
    if (tasks.length === 0) return;

    const confirm = await alertConfirm(
      'Simpan perubahan massal?',
      `Perubahan akan diterapkan ke ${tasks.length} pengujian`,
      'Ya, Simpan'
    );
    if (!confirm.isConfirmed) return;

    try {
      for (const t of tasks) {
        const body = {
          description: bulkApplyDescription ? bulkDescription : (t.description ?? ''),
          progress: bulkApplyProgress ? bulkProgress : (t.progress ?? 0),
          deadline: bulkApplyDeadline ? (bulkDeadline || null) : (t.deadline || null),
          status: bulkApplyStatus ? bulkStatus : (t.status || 'Pending'),
        };

        // eslint-disable-next-line no-await-in-loop
        const res = await apiFetch(`/api/v1/tasks/${t.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          alertError('Gagal', data.detail || 'Terjadi kesalahan pada server.');
          return;
        }
      }

      setIsBulkModalOpen(false);
      await alertSuccess('Berhasil', 'Semua pengujian diperbarui');
      fetchData();
    } catch (e) {
      console.error(e);
      alertError('Koneksi Gagal', 'Backend server tidak merespon.');
    }
  };

  // ================= STATUS COLOR =================
  const getStatusColor = (status: string) => {
    if (status === "Pending") return "bg-gray-200 text-gray-700";
    if (status === "In Progress") return "bg-blue-100 text-blue-700";
    if (status === "Done") return "bg-green-100 text-green-700";
    return "bg-red-100 text-red-700";
  };

  if (!project) return <div className="p-6">Loading...</div>;

  const filteredTasks = tasks
    .filter((t) => {
      const matchFilter = filter === 'All' || t.status === filter;
      const label = (t.test_name || t.title || '').toLowerCase();
      const matchSearch = label.includes(search.toLowerCase());
      return matchFilter && matchSearch;
    })
    .sort((a, b) => {
      if (a.status === 'Done' && b.status !== 'Done') return 1;
      if (a.status !== 'Done' && b.status === 'Done') return -1;
      return 0;
    });

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'Done').length;
  const pending = total - done;

  const pendingCount = tasks.filter(t => t.status === 'Pending').length;
  const progressCount = tasks.filter(t => t.status === 'In Progress').length;
  const doneCount = tasks.filter(t => t.status === 'Done').length;

  const maxValue = Math.max(pendingCount, progressCount, doneCount, 1);

  return (
    <div className="p-6 bg-gray-50 min-h-screen text-gray-800">

      {/* BACK */}
      <button
        onClick={() => router.back()}
        className="mb-4 text-blue-600 hover:underline"
      >
        &lt;- Kembali
      </button>

      {/* DOWNLOAD LAPORAN */}
      <button
        onClick={() =>
          window.open(apiUrl(`/api/v1/projects/${project.id}/report`))
        }
        className="bg-purple-600 hover:bg-purple-700 text-white shadow fixed right-6 top-20 z-50 rounded-full px-3 py-2 text-sm"
        
      >
        Download Laporan
      </button>

      {/* HEADER */}
      <h1 className="text-3xl font-bold text-blue-700">
        {project.name}
      </h1>

      <p className="text-sm text-gray-500 mb-4">
        Kode Proyek:
        <span className="ml-2 font-mono text-blue-600">
          {project.project_code}
        </span>
      </p>

      {/* PROGRESS */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 h-4 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-400 to-green-600 h-4 rounded-full transition-all duration-700 ease-in-out"
            style={{ width: `${project.progress}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-600 mt-1">
          <span>Progress</span>
          <span className="font-semibold">{project.progress}%</span>
        </div>
      </div>

      {/* INFO */}
      <div className="space-y-1">
        <p><b>Client:</b> {project.client_name}</p>
        <p><b>Status:</b> {project.status}</p>
        <p><b>Deskripsi:</b> {project.description || '-'}</p>
      </div>

      {/* ================= PENGUJIAN ================= */}

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Pilih Tes Material (Checklist)</h2>

          <div className="flex items-center gap-2">
            <input
              id="checklist-search"
              value={checklistSearch}
              onChange={(e) => setChecklistSearch(e.target.value)}
              placeholder="Cari Material/Tes"
              className="border rounded-lg px-3 py-2 w-full md:w-80 bg-white text-black placeholder:text-gray-400 focus:ring-2 focus:ring-green-400 outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('checklist-search');
                if (el instanceof HTMLInputElement) el.focus();
              }}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"
              aria-label="Cari"
            >
              Cari
            </button>
          </div>
        </div>

        {materialTests.length === 0 ? (
          <p className="text-gray-400">Master Tes Material belum ada / belum bisa dimuat.</p>
        ) : (
          <div className="space-y-3">
            {Array.from(new Set(visibleMaterialTests.map((x) => x.material_name))).map((materialName) => {
              const group = visibleMaterialTests.filter((x) => x.material_name === materialName);
              const allChecked = group.length > 0 && group.every((x) => isSelected(x.id));

              return (
                <div key={materialName} className="border rounded-lg p-4 bg-gray-50">
                  <label className="flex items-center gap-2 font-semibold text-gray-800">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleMaterial(materialName, e.target.checked)}
                    />
                    {materialName}
                    <span className="text-xs text-gray-500 font-normal">({group.length} tes)</span>
                  </label>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.map((x) => (
                      <label key={x.id} className="flex items-start gap-2 text-sm bg-white border rounded p-2">
                        <input
                          type="checkbox"
                          checked={isSelected(x.id)}
                          onChange={(e) => toggleOne(x.id, e.target.checked)}
                        />
                        <div>
                          <div className="font-medium">
                            {x.display_no ? <span className="font-mono text-blue-700 mr-2">{x.display_no}</span> : null}
                            {x.test_name}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* ACTIONS */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={handleCancelChecklist}
                disabled={!checklistDirty}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  !checklistDirty
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmChecklist}
                disabled={!checklistDirty}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  !checklistDirty
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow mb-6">

        <h3 className="text-md font-semibold mb-3">Statistik Pengujian</h3>

        {/* Pending */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span>Pending</span>
            <span>{pendingCount}</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded">
            <div
              className="bg-gray-500 h-3 rounded transition-all duration-500"
              style={{ width: `${(pendingCount / maxValue) * 100}%` }}
            />
          </div>
        </div>

        {/* In Progress */}
        <div className="mb-2">
          <div className="flex justify-between text-xs mb-1">
            <span>In Progress</span>
            <span>{progressCount}</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded">
            <div
              className="bg-blue-500 h-3 rounded transition-all duration-500"
              style={{ width: `${(progressCount / maxValue) * 100}%` }}
            />
          </div>
        </div>

        {/* Done */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span>Done</span>
            <span>{doneCount}</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded">
            <div
              className="bg-green-500 h-3 rounded transition-all duration-500"
              style={{ width: `${(doneCount / maxValue) * 100}%` }}
            />
          </div>
        </div>

      </div>

      <div className="bg-white p-6 rounded-xl shadow mt-6">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold">Pengujian</h2>
          <button
            type="button"
            onClick={openBulkEdit}
            disabled={tasks.length === 0}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tasks.length === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            Edit All
          </button>
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Cari pengujian..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-400 outline-none"
          />
        </div>
        <div className="flex gap-4 mb-4 text-sm">
          <div className="bg-gray-100 px-3 py-2 rounded">
            Total: <b>{total}</b>
          </div>

          <div className="bg-green-100 text-green-700 px-3 py-2 rounded">
            Done: <b>{done}</b>
          </div>

          <div className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded">
            Pending: <b>{pending}</b>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          {['All', 'Pending', 'In Progress', 'Done'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* LIST */}
        {tasks.length === 0 ? (
          <p className="text-gray-400">Belum ada pengujian</p>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((t) => {
              return (
                <div
                  key={t.id}
                  className="flex justify-between items-center border p-4 rounded-lg hover:shadow-md transition"
                >
                  {editingTaskId === t.id ? (
                    <>
                      <div className="flex-1 space-y-2">
                        <div className="font-semibold text-gray-800">{t.test_name || t.title}</div>

                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Keterangan / deskripsi"
                          className="border p-2 rounded w-full"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            value={editProgress}
                            onChange={(e) => setEditProgress(Number(e.target.value))}
                            className="border p-2 rounded"
                            placeholder="Progress (%)"
                          />

                          <input
                            type="date"
                            value={editDeadline}
                            onChange={(e) => setEditDeadline(e.target.value)}
                            className="border p-2 rounded"
                          />
                        </div>
                      </div>

                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="border p-2 rounded"
                      >
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Done</option>
                      </select>

                      <button
                        onClick={handleSaveEdit}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                      >
                        Simpan
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
  <p className="font-medium">{t.test_name || t.title}</p>

  <p className="text-xs text-gray-500">
    {t.description || '-'}
  </p>

  <p className="text-xs text-gray-400">
    Progress: {t.progress || 0}% | Deadline: {t.deadline || '-'}
  </p>

  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(t.status)}`}>
    {t.status}
  </span>
</div>

                      <div className="flex gap-3 items-center">
                        <button
                          onClick={() => startEdit(t)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Hapus
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl text-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Edit All Pengujian</h3>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="text-gray-400 hover:text-red-500 text-xl font-bold"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-xl p-4">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={bulkApplyStatus} onChange={(e) => setBulkApplyStatus(e.target.checked)} />
                    Status
                  </label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    disabled={!bulkApplyStatus}
                    className="mt-2 w-full border p-2 rounded bg-white disabled:bg-gray-100"
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Done</option>
                  </select>
                </div>

                <div className="border rounded-xl p-4">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={bulkApplyProgress} onChange={(e) => setBulkApplyProgress(e.target.checked)} />
                    Progress (%)
                  </label>
                  <input
                    type="number"
                    value={bulkProgress}
                    onChange={(e) => setBulkProgress(Number(e.target.value))}
                    disabled={!bulkApplyProgress}
                    className="mt-2 w-full border p-2 rounded bg-white disabled:bg-gray-100"
                    min={0}
                    max={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-xl p-4">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={bulkApplyDeadline} onChange={(e) => setBulkApplyDeadline(e.target.checked)} />
                    Deadline
                  </label>
                  <input
                    type="date"
                    value={bulkDeadline}
                    onChange={(e) => setBulkDeadline(e.target.value)}
                    disabled={!bulkApplyDeadline}
                    className="mt-2 w-full border p-2 rounded bg-white disabled:bg-gray-100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Kosongkan untuk menghapus deadline</p>
                </div>

                <div className="border rounded-xl p-4">
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" checked={bulkApplyDescription} onChange={(e) => setBulkApplyDescription(e.target.checked)} />
                    Detail / Deskripsi
                  </label>
                  <textarea
                    value={bulkDescription}
                    onChange={(e) => setBulkDescription(e.target.value)}
                    disabled={!bulkApplyDescription}
                    className="mt-2 w-full border p-2 rounded bg-white disabled:bg-gray-100"
                    rows={3}
                    placeholder="Detail kecil pengujian..."
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBulkSave}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
