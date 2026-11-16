"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import AppShell from "@/components/AppShell";
import ConceptMap from "@/components/ConceptMap";
import { api } from "@/lib/api";
import { useFetch, useUser } from "@/hooks/useUser";

export default function Topic() {
  const { id } = useParams<{ id: string }>();
  const user = useUser("student");
  const router = useRouter();
  const { data } = useFetch<any>(user ? `/concepts/${id}` : null);
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try { const s = await api("/sessions", { body: { concept_id: id } }); router.push(`/student/session/${s.id}`); }
    catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return (
    <AppShell user={user}>
      {data && (
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="text-sm text-mute">{data.subject}</div>
            <h1 className="font-display text-4xl font-semibold">{data.name}</h1>
            <p className="mt-3 text-mute">{data.description}</p>
            <p className="mt-4 text-sm">Alex will start with a misunderstanding about this topic. Your job is to correct it, defend your reasoning, and then apply the idea to a new problem.</p>
            <button className="btn btn-primary mt-6" disabled={busy} onClick={start}>Start teaching Alex</button>
            {err && <p role="alert" className="mt-3 text-sm text-pencil">{err}</p>}
          </div>
          <div className="panel"><h2 className="mb-3 font-display text-lg font-semibold">Ideas you will need to explain</h2>
            <ConceptMap nodes={data.nodes.map((n: any) => ({ ...n, status: n.score ? "ok" : "untested" }))} /></div>
        </div>
      )}
    </AppShell>
  );
}
