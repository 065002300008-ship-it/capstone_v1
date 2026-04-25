'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type DashboardPayload = {
  projects: { total: number; by_status: Record<string, number> };
  tasks: { total: number; by_status: Record<string, number>; overdue: number; due_soon_7d: number };
  files: { report_total: number; document_total: number };
  recent_projects: Array<{
    id: string;
    project_code: string;
    name: string;
    client_name?: string | null;
    status?: string | null;
    progress?: number | null;
    deadline?: string | null;
    budget?: number | null;
  }>;
  attention_tasks: Array<{
    task_id: string;
    project_id: string;
    project_code: string;
    project_name: string;
    material_name?: string | null;
    test_name?: string | null;
    status?: string | null;
    progress?: number | null;
    deadline?: string | null;
    description?: string | null;
  }>;
  tasks_by_project: Array<{
    project_id: string;
    project_code: string;
    project_name: string;
    total: number;
    counts: { Pending: number; 'In Progress': number; Done: number; Other: number };
  }>;
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

function formatIDR(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
}

function statusBadge(status?: string | null) {
  if (!status) return 'bg-gray-200 text-gray-700';
  if (status === 'Planning') return 'bg-gray-200 text-gray-700';
  if (status === 'In Progress') return 'bg-blue-100 text-blue-700';
  if (status === 'Completed') return 'bg-green-100 text-green-700';
  return 'bg-purple-100 text-purple-700';
}

function segmentColor(status: string) {
  if (status === 'Pending') return 'bg-gray-400';
  if (status === 'In Progress') return 'bg-blue-500';
  if (status === 'Done') return 'bg-green-500';
  return 'bg-purple-500';
}

function Donut({
  items,
  total,
  onSelect,
}: {
  items: Array<{ label: string; value: number; stroke: string }>;
  total: number;
  onSelect: (label: string) => void;
}) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const segments = (() => {
    const out: Array<{ label: string; stroke: string; dash: string; offset: string }> = [];
    let running = 0;
    for (const x of items) {
      const frac = total > 0 ? x.value / total : 0;
      const dash = `${(frac * circumference).toFixed(4)} ${circumference.toFixed(4)}`;
      const offset = (-running * circumference).toFixed(4);
      running += frac;
      out.push({ label: x.label, stroke: x.stroke, dash, offset });
    }
    return out;
  })();

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r={radius} fill="transparent" stroke="#f3f4f6" strokeWidth="4" />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx="18"
              cy="18"
              r={radius}
              fill="transparent"
              stroke={s.stroke}
              strokeWidth="4"
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              className="cursor-pointer"
              onClick={() => onSelect(s.label)}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-800">{total}</span>
          <span className="text-xs text-gray-500">Total</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 text-sm">
        {items.map((x) => {
          const pct = total > 0 ? Math.round((x.value / total) * 100) : 0;
          return (
            <button
              key={x.label}
              onClick={() => onSelect(x.label)}
              className="w-full flex justify-between items-center text-left hover:bg-gray-50 rounded px-2 py-1"
            >
              <span className="flex items-center gap-2 text-gray-700">
                <span className="w-3 h-3 rounded-full" style={{ background: x.stroke }} />
                {x.label}
              </span>
              <span className="font-semibold text-gray-800">
                {x.value}{' '}
                <span className="text-gray-400 text-xs font-normal">
                  ({pct}%)
                </span>
              </span>
            </button>
          );
        })}
        <div className="text-xs text-gray-400 pt-1">Klik untuk membuka filter di menu Proyek.</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [resDash, resAudit] = await Promise.all([
        apiFetch('/api/v1/dashboard'),
        apiFetch('/api/v1/audit-logs?limit=8'),
      ]);
      const d = await resDash.json();
      const a = await resAudit.json();
      setData(d);
      setAudit(Array.isArray(a) ? a : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const donutItems = useMemo(() => {
    const by = data?.projects.by_status || {};
    const keys = Object.keys(by);
    const colors: Record<string, string> = {
      Planning: '#9ca3af',
      'In Progress': '#3b82f6',
      Completed: '#10b981',
      Unknown: '#a855f7',
    };
    return keys
      .sort((a, b) => by[b] - by[a])
      .map((k) => ({ label: k, value: by[k], stroke: colors[k] || '#a855f7' }));
  }, [data]);

  if (!data) {
    return <div className="p-6 text-gray-600">{loading ? 'Memuat dashboard...' : 'Dashboard belum tersedia.'}</div>;
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Ringkasan proyek, pengujian, dokumen, dan aktivitas.</p>
        </div>
        <button
          onClick={fetchAll}
          className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold"
        >
          Refresh
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <button
          onClick={() => router.push('/proyek')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center text-left hover:shadow-md transition"
        >
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Total Proyek</p>
            <p className="text-3xl font-bold text-gray-800">{data.projects.total}</p>
          </div>
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center text-2xl">📋</div>
        </button>

        <button
          onClick={() => router.push('/proyek')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center text-left hover:shadow-md transition"
        >
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Total Pengujian</p>
            <p className="text-3xl font-bold text-gray-800">{data.tasks.total}</p>
            <p className="text-xs text-gray-400 mt-1">Pending/In Progress/Done</p>
          </div>
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center text-2xl">🧪</div>
        </button>

        <button
          onClick={() => router.push('/proyek')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center text-left hover:shadow-md transition"
        >
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">Overdue</p>
            <p className="text-3xl font-bold text-gray-800">{data.tasks.overdue}</p>
            <p className="text-xs text-gray-400 mt-1">Due 7 hari: {data.tasks.due_soon_7d}</p>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-lg flex items-center justify-center text-2xl">⏰</div>
        </button>

        <button
          onClick={() => router.push('/dokumen')}
          className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center text-left hover:shadow-md transition"
        >
          <div>
            <p className="text-sm text-gray-500 font-medium mb-1">File</p>
            <p className="text-3xl font-bold text-gray-800">{data.files.document_total + data.files.report_total}</p>
            <p className="text-xs text-gray-400 mt-1">Dokumen {data.files.document_total} • Laporan {data.files.report_total}</p>
          </div>
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center text-2xl">📄</div>
        </button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Status Proyek</h2>
          <Donut
            items={donutItems}
            total={data.projects.total}
            onSelect={(status) => router.push(`/proyek?status=${encodeURIComponent(status)}`)}
          />
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Pengujian per Proyek (Stacked)</h2>
          <div className="space-y-3">
            {data.tasks_by_project.length === 0 ? (
              <div className="text-sm text-gray-500">Belum ada pengujian.</div>
            ) : (
              data.tasks_by_project.map((p) => {
                const total = p.total || 1;
                const segs: Array<{ label: 'Pending' | 'In Progress' | 'Done' | 'Other'; value: number }> = [
                  { label: 'Pending', value: p.counts.Pending },
                  { label: 'In Progress', value: p.counts['In Progress'] },
                  { label: 'Done', value: p.counts.Done },
                  { label: 'Other', value: p.counts.Other },
                ];

                return (
                  <div key={p.project_id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <button
                        onClick={() => router.push(`/proyek/${p.project_id}`)}
                        className="text-sm font-semibold text-blue-700 hover:underline text-left"
                      >
                        {p.project_name} <span className="font-mono text-xs text-gray-500 ml-2">{p.project_code}</span>
                      </button>
                      <div className="text-xs text-gray-500">{p.total} tes</div>
                    </div>

                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
                      {segs.map((s) => {
                        if (s.value <= 0) return null;
                        const w = `${Math.max(2, Math.round((s.value / total) * 100))}%`;
                        return (
                          <button
                            key={s.label}
                            title={`${s.label}: ${s.value}`}
                            onClick={() => router.push(`/proyek/${p.project_id}?filter=${encodeURIComponent(s.label)}`)}
                            className={`${segmentColor(s.label)} h-3`}
                            style={{ width: w }}
                          />
                        );
                      })}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600">
                      {segs
                        .filter((s) => s.value > 0)
                        .map((s) => (
                          <button
                            key={s.label}
                            onClick={() => router.push(`/proyek/${p.project_id}?filter=${encodeURIComponent(s.label)}`)}
                            className="px-2 py-1 bg-white border rounded hover:bg-gray-50"
                          >
                            {s.label}: <span className="font-semibold">{s.value}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })
            )}
            <div className="text-xs text-gray-400">Klik segment untuk membuka filter status di detail proyek.</div>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Proyek Terbaru</h2>
            <button onClick={() => router.push('/proyek')} className="text-sm text-blue-700 hover:underline">
              Lihat semua
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-semibold">Kode</th>
                  <th className="px-6 py-4 font-semibold">Nama</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Budget</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_projects.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-6 text-center text-gray-500">Belum ada proyek.</td>
                  </tr>
                ) : (
                  data.recent_projects.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono text-blue-700">{p.project_code}</td>
                      <td className="px-6 py-4">
                        <button onClick={() => router.push(`/proyek/${p.id}`)} className="font-semibold text-blue-700 hover:underline">
                          {p.name}
                        </button>
                        <div className="text-xs text-gray-400">{p.client_name || '-'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge(p.status)}`}>
                          {p.status || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-700">{formatIDR(Number(p.budget || 0))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">Pengujian Perlu Perhatian</h2>
            <div className="text-xs text-gray-500">Overdue & due 7 hari</div>
          </div>
          <div className="p-4 space-y-3">
            {data.attention_tasks.length === 0 ? (
              <div className="text-sm text-gray-500 p-2">Tidak ada pengujian dengan deadline.</div>
            ) : (
              data.attention_tasks.map((t) => (
                <div key={t.task_id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">
                        {t.test_name || '-'} {t.material_name ? <span className="text-xs text-gray-500">• {t.material_name}</span> : null}
                      </div>
                      <button
                        onClick={() => router.push(`/proyek/${t.project_id}?filter=${encodeURIComponent(t.status || 'All')}`)}
                        className="text-xs text-blue-700 hover:underline"
                      >
                        {t.project_name} <span className="font-mono text-gray-400 ml-1">{t.project_code}</span>
                      </button>
                      <div className="text-xs text-gray-500 mt-1">
                        Deadline: <span className="font-semibold">{t.deadline || '-'}</span> • Progress: <span className="font-semibold">{t.progress || 0}%</span>
                      </div>
                      {t.description ? <div className="text-xs text-gray-400 mt-1">{t.description}</div> : null}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${t.status === 'Done' ? 'bg-green-100 text-green-700' : t.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                      {t.status || '-'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Activity (small) */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Aktivitas Terakhir</h3>
          <div className="flex gap-3 text-xs">
            <button onClick={() => router.push('/laporan')} className="text-blue-700 hover:underline">Laporan</button>
            <button onClick={() => router.push('/dokumen')} className="text-blue-700 hover:underline">Dokumen</button>
          </div>
        </div>
        {audit.length === 0 ? (
          <div className="text-xs text-gray-500 mt-2">Belum ada aktivitas.</div>
        ) : (
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {audit.map((x) => (
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
