"use client";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useFetch, useUser } from "@/hooks/useUser";

export default function History() {
  const user = useUser("student");
  const { data } = useFetch<any[]>(user ? `/students/${user.id}/sessions` : null);
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">Learning history</h1>
      <ul className="mt-6 space-y-3">
        {data?.map((s) => (
          <li key={s.id}><Link href={`/student/session/${s.id}`} className="panel block hover:border-slate2/50">
            <div className="flex justify-between"><b>{s.concept}</b><span className="text-sm text-mute">{s.final_state?.replace("_", " ").toLowerCase() ?? s.status.toLowerCase()}</span></div>
            <div className="text-sm text-mute">Misconception: {s.misconception}</div>
          </Link></li>
        ))}
        {data && !data.length && <p className="text-mute">No sessions yet.</p>}
      </ul>
    </AppShell>
  );
}
