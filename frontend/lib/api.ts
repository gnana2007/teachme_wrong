const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getUserId(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem("tmw_user_id");
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const uid = getUserId();
  if (uid) headers["X-User-Id"] = uid; // dev auth; production sends the Supabase access token as Bearer
  if (opts.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), headers,
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}
