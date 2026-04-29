'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Image from 'next/image';

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.detail || 'Registrasi gagal.');
        return;
      }
      router.replace('/login?registered=1');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-48px)] flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50">
      <div className="w-full max-w-md">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="bg-white rounded-xl p-2 ring-1 ring-gray-200 shadow-sm">
              <Image src="/mixindo-logo.svg" alt="Mixindo" width={44} height={44} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-gray-900">PT Mixindo Abadi Karya</div>
              <div className="text-xs text-gray-500">Sistem Informasi Proyek Terintegrasi</div>
            </div>
          </div>

          <div className="mb-5">
            <div className="text-xl font-bold text-gray-900">Registrasi</div>
            <div className="text-sm text-gray-500">Buat akun baru (email & password)</div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contoh: user@mixindo.com"
                className="mt-1 w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                type="password"
                className="mt-1 w-full px-4 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoComplete="new-password"
              />
            </div>

            {msg ? <div className="text-xs text-red-700">{msg}</div> : null}

            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-300"
            >
              {busy ? 'Memproses...' : 'Daftar'}
            </button>

            <div className="text-xs text-gray-500 text-center">
              Sudah punya akun?{' '}
              <Link href="/login" className="text-blue-700 hover:underline">
                Login
              </Link>
            </div>
          </form>
        </div>

        <div className="mt-4 text-center text-[11px] text-gray-400">© {new Date().getFullYear()} PT Mixindo Abadi Karya</div>
      </div>
    </div>
  );
}
