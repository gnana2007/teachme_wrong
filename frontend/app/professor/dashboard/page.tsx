"use client";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useFetch, useUser } from "@/hooks/useUser";

export default function ProfDash() {
  const user = useUser("professor");
  const { data: courses } = useFetch<any[]>(user ? "/professor/courses" : null);
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">What does your class misunderstand?</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {courses?.map((c) => <Link key={c.id} href={`/professor/courses/${c.id}`} className="panel hover:border-slate2/50"><div className="font-display text-xl font-semibold">{c.name}</div><div className="text-sm text-mute">{c.students} students</div></Link>)}
      </div>
    </AppShell>
  );
}
