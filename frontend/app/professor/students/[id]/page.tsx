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
  const { data } = useFetch<any>(user ? `/professor/courses/${course}/students/${id}` : null);
  return (
    <AppShell user={user}>
      {data && (<>
        <h1 className="font-display text-3xl font-semibold">{data.student.name}</h1>
        <div className="mt-6 grid gap-5 md:grid-cols-2">{data.mastery.map((c: any) => (
          <div key={c.concept_id} className="panel space-y-2"><h2 className="font-medium">{c.name}</h2>{c.nodes.map((n: any) => <MasteryBar key={n.key} label={n.name} score={n.score} />)}</div>))}</div></>)}
    </AppShell>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
