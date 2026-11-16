"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import MasteryBar from "@/components/MasteryBar";
import { useFetch, useUser } from "@/hooks/useUser";

export default function Course() {
  const { id } = useParams<{ id: string }>();
  const user = useUser("professor");
  const { data: a } = useFetch<any>(user ? `/professor/courses/${id}/analytics` : null);
  const { data: heat } = useFetch<any[]>(user ? `/professor/courses/${id}/misconceptions` : null);
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...(heat ?? []).map((h) => h.students));
  const sel = heat?.find((h) => h.id === open);
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">Class understanding</h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="panel">
          <h2 className="font-display text-xl font-semibold">Concepts</h2>
          <div className="mt-4 space-y-4">
            {a?.concepts.map((c: any) => (
              <Link key={c.concept_id} href={`/professor/concepts/${c.concept_id}?course=${id}`} className="block rounded-lg p-2 hover:bg-slatelt">
                <MasteryBar label={c.name} score={c.understanding ?? 0} untested={c.understanding == null} />
                {c.root_issue && <p className="mt-1 text-xs text-mute">{c.root_issue} {c.reteach}</p>}
              </Link>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 className="font-display text-xl font-semibold">Misconception heatmap</h2>
          <ul className="mt-4 space-y-2">
            {heat?.map((h) => (
              <li key={h.id}><button onClick={() => setOpen(h.id)} className="w-full rounded-lg border border-slate2/15 p-3 text-left text-sm" style={{ background: `rgba(194,65,45,${0.08 + 0.4 * (h.students / max)})` }}>
                <div className="flex justify-between gap-3"><span>{h.statement}</span><b className="shrink-0">{h.students} students</b></div>
                <div className="text-xs text-mute">{h.concept} · {h.node}</div>
              </button></li>
            ))}
          </ul>
          {sel && (
            <div className="mt-4 rounded-lg bg-slatelt p-4 text-sm">
              <h3 className="font-medium">{sel.statement}</h3>
              <p className="mt-1 text-mute">Concept: {sel.concept} · Knowledge node: {sel.node} · {sel.students} students</p>
              <ul className="mt-2 list-disc pl-5">{sel.samples.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              <p className="mt-2"><b>Suggested reteaching:</b> {sel.reteach}</p>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
