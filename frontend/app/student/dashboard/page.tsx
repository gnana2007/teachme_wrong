"use client";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import MasteryBar from "@/components/MasteryBar";
import { useFetch, useUser } from "@/hooks/useUser";

export default function Dashboard() {
  const user = useUser("student");
  const { data } = useFetch<any>(user ? `/students/${user.id}/dashboard` : null);
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">Welcome back, {user?.name.split(" ")[0]}</h1>
      {data && (
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <section className="panel lg:col-span-2">
            <h2 className="font-display text-xl font-semibold">Where your understanding stands</h2>
            <div className="mt-4 space-y-6">
              {data.concepts.map((c: any) => (
                <div key={c.concept_id}>
                  <div className="mb-2 flex items-baseline justify-between"><h3 className="font-medium">{c.name}</h3><span className="text-sm text-mute">{Math.round(c.mastery * 100)}% mastery</span></div>
                  <div className="grid gap-2 sm:grid-cols-2">{c.nodes.map((n: any) => <MasteryBar key={n.key} label={n.name} score={n.score} />)}</div>
                </div>
              ))}
              {!data.concepts.length && <p className="text-mute">No sessions yet. Pick a topic and teach Alex your first concept.</p>}
            </div>
          </section>
          <aside className="space-y-5">
            <div className="panel">
              <h2 className="font-display text-lg font-semibold">Work on next</h2>
              {data.recommended ? (<><p className="mt-2 text-sm text-mute">{data.recommended.node} in {data.recommended.concept} is your weakest idea ({Math.round(data.recommended.score * 100)}%).</p>
                <Link href={`/student/topics/${data.recommended.concept_id}`} className="btn btn-primary mt-3">Practice it</Link></>) : <p className="mt-2 text-sm text-mute">Nothing weak right now.</p>}
            </div>
            <div className="panel">
              <h2 className="font-display text-lg font-semibold">Misconceptions you met</h2>
              <ul className="mt-2 space-y-2 text-sm">{data.misconceptions.map((m: any, i: number) => <li key={i}>{m.corrected ? "Corrected: " : "Still open: "}{m.statement}</li>)}
                {!data.misconceptions.length && <li className="text-mute">None recorded yet.</li>}</ul>
            </div>
            <div className="panel text-sm"><b>{data.streak_days}</b>-day learning streak · Mastered: {data.mastered.join(", ") || "none yet"}</div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
