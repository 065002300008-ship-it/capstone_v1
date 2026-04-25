const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? '').replace(/\/$/, '');

export function apiUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalized}`;
}

function getActorUsername() {
  if (typeof window === 'undefined') return '';
  try {
    return (window.localStorage.getItem('mixindo_actor_username') ?? '').trim();
  } catch {
    return '';
  }
}

export function apiFetch(path: string, init?: RequestInit) {
  const actor = getActorUsername();
  const headers = new Headers(init?.headers || undefined);
  if (actor && !headers.has('X-Actor-Username')) headers.set('X-Actor-Username', actor);
  return fetch(apiUrl(path), { ...init, headers });
}
