"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AppShell from "@/components/AppShell";
import MasteryBar from "@/components/MasteryBar";
import { useFetch, useUser } from "@/hooks/useUser";

function Inner() {
  const { id } = useParams<{ id: string }>();
  const course = useSearchParams().get("course") ?? "course-ds";
  const user = useUser("professor");
  const { data } = useFetch<any>(user ? `/professor/courses/${course}/concepts/${id}` : null);
  return (
    <AppShell user={user}>
      {data && (<>
        <h1 className="font-display text-3xl font-semibold">{data.name}</h1>
        {data.root_issue && <p className="mt-2 text-mute">{data.root_issue} {data.reteach}</p>}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="panel space-y-3"><h2 className="font-display text-lg font-semibold">By knowledge node</h2>
            {data.nodes.map((n: any) => <MasteryBar key={n.key} label={n.name} score={n.understanding ?? 0} untested={n.understanding == null} />)}</section>
          <section className="panel"><h2 className="font-display text-lg font-semibold">Common misconceptions</h2>
            <ul className="mt-3 space-y-3 text-sm">{data.misconceptions.map((m: any) => <li key={m.id}><b>{m.statement}</b> ({m.students} students)<br /><span className="text-mute">{m.reteach}</span></li>)}
              {!data.misconceptions.length && <li className="text-mute">None recorded.</li>}</ul></section>
        </div></>)}
    </AppShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
