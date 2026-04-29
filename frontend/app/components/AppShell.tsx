'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const AUTH_ROUTES = new Set(['/login', '/register']);

function isAuthed() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean((window.localStorage.getItem('mixindo_auth_email') ?? '').trim());
  } catch {
    return false;
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (AUTH_ROUTES.has(pathname)) return;
    if (!isAuthed()) router.replace('/login');
  }, [pathname, router]);

  if (AUTH_ROUTES.has(pathname)) {
    return <main className="min-h-screen bg-gray-50 p-6">{children}</main>;
  }

  return (
    <div className="bg-gray-50 flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}

