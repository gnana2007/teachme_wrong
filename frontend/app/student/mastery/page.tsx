"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import ConceptMap from "@/components/ConceptMap";
import { api } from "@/lib/api";
import { useFetch, useUser } from "@/hooks/useUser";

export default function Mastery() {
  const user = useUser("student");
  const router = useRouter();
  const { data } = useFetch<any[]>(user ? `/students/${user.id}/mastery` : null);
  const [sel, setSel] = useState<{ c: string; k: string } | null>(null);
  async function practice(cid: string) { const s = await api("/sessions", { body: { concept_id: cid } }); router.push(`/student/session/${s.id}`); }
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">Mastery graph</h1>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {data?.map((c) => {
          const node = sel && sel.c === c.concept_id ? c.nodes.find((n: any) => n.key === sel.k) : null;
          return (
            <div key={c.concept_id} className="panel">
              <div className="mb-3 flex justify-between"><h2 className="font-display text-xl font-semibold">{c.name}</h2><span className="text-sm text-mute">{Math.round(c.mastery * 100)}%</span></div>
              <ConceptMap nodes={c.nodes} selected={sel && sel.c === c.concept_id ? sel.k : null} onSelect={(k) => setSel({ c: c.concept_id, k })} />
              {node && (
                <div className="mt-3 rounded-lg bg-slatelt p-3 text-sm">
                  <b>{node.name}</b> is at {Math.round(node.score * 100)}%.{node.score < 0.6 ? " Alex's questions about this idea exposed gaps in your explanation of cause and effect." : " You explained this well."}
                  <div><button className="btn btn-primary mt-2" onClick={() => practice(c.concept_id)}>Practice this concept</button></div>
                </div>
              )}
            </div>
          );
        })}
        {data && !data.length && <p className="text-mute">Complete a session to see your mastery graph.</p>}
      </div>
    </AppShell>
  );
}
