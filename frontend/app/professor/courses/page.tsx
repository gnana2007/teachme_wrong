"use client";
import Link from "next/link";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useFetch, useUser } from "@/hooks/useUser";

export default function Courses() {
  const user = useUser("professor");
  const [n, setN] = useState(""), [k, setK] = useState(0);
  const { data } = useFetch<any[]>(user ? "/professor/courses" : null, [k]);
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">Courses</h1>
      <div className="mt-5 flex max-w-md gap-2">
        <input aria-label="Course name" placeholder="New course name" className="flex-1 rounded-lg border border-slate2/30 bg-white px-3 py-2" value={n} onChange={(e) => setN(e.target.value)} />
        <button className="btn btn-primary" disabled={!n} onClick={async () => { await api("/professor/courses", { body: { name: n } }); setN(""); setK(k + 1); }}>Create</button>
      </div>
      <ul className="mt-6 space-y-3">{data?.map((c) => <li key={c.id}><Link className="panel block hover:border-slate2/50" href={`/professor/courses/${c.id}`}>{c.name} · {c.students} students</Link></li>)}</ul>
    </AppShell>
  );
}
