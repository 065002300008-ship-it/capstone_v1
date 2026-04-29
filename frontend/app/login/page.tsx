'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [registered, setRegistered] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const canSubmit = useMemo(() => email.trim() && password.trim(), [email, password]);

  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('registered') === '1';
      setRegistered(v);
    } catch {
      setRegistered(false);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.detail || 'Login gagal.');
        return;
      }
      try {
        window.localStorage.setItem('mixindo_auth_email', email.trim());
        // Reuse actor username for audit headers.
        window.localStorage.setItem('mixindo_actor_username', (data.actor_username || email.trim()) as string);
      } catch {
        // ignore
      }
      router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-48px)] flex items-center justify-center">
      <div className="w-full max-w-md bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="mb-5">
          <div className="text-xl font-bold text-gray-900">Login</div>
          <div className="text-sm text-gray-500">Masuk ke sistem PT Mixindo Abadi Karya</div>
          {registered ? <div className="mt-2 text-xs text-green-700">Registrasi berhasil. Silakan login.</div> : null}
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
              autoComplete="current-password"
            />
          </div>

          {msg ? <div className="text-xs text-red-700">{msg}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:bg-blue-300"
          >
            {busy ? 'Memproses...' : 'Login'}
          </button>

          <div className="text-xs text-gray-500 text-center">
            Belum punya akun?{' '}
            <Link href="/register" className="text-blue-700 hover:underline">
              Registrasi
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
