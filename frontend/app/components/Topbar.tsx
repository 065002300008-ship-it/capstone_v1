'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

function getStoredUsername() {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem('mixindo_actor_username') ?? '').trim();
  } catch {
    return '';
  }
}

export default function Topbar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUsername(getStoredUsername());
  }, []);

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!open) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current && !menuRef.current.contains(target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const displayUsername = (username || 'User').trim();
  const avatarLetter = useMemo(() => (displayUsername[0] || 'U').toUpperCase(), [displayUsername]);

  function logout() {
    try {
      window.localStorage.removeItem('mixindo_auth_email');
      window.localStorage.removeItem('mixindo_actor_username');
    } catch {
      // ignore
    }
    setOpen(false);
    router.replace('/login');
  }

  return (
    <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-6">
      <div className="font-semibold text-gray-700">Website Sistem Informasi Proyek</div>

      <div className="flex items-center space-x-4">
        <button className="text-gray-500 hover:text-gray-700" aria-label="Notifikasi">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center space-x-2 hover:bg-gray-50 rounded-lg px-2 py-1"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
              {avatarLetter}
            </div>
            <div className="text-sm text-right">
              <div className="font-semibold text-gray-800">{displayUsername}</div>
            </div>
            <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {open ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50"
            >
              <button
                type="button"
                role="menuitem"
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
