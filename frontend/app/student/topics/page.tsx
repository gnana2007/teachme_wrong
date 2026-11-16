"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { useFetch, useUser } from "@/hooks/useUser";

const SUBJECT_ICONS: Record<string, string> = {
  "Computer Science": "💻",
  "Mathematics": "📐",
  "Physics": "⚛️",
  "Chemistry": "🧪",
  "Biology": "🧬",
  "Economics": "📈",
  "Engineering": "⚙️",
  "General Knowledge": "🌐",
};

export default function Topics() {
  const user = useUser("student");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const { data: subjects } = useFetch<string[]>(user ? "/subjects" : null);
  const { data: concepts, error: conceptsErr } = useFetch<any[]>(
    user ? `/concepts?q=${encodeURIComponent(q)}&subject=${encodeURIComponent(subject)}` : null,
    [q, subject]
  );
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setErr("");
    setSteps(["Analyzing concept and materials…"]);
    try {
      let materialId: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const m = await api("/materials/upload", { form: fd });
        materialId = m.id;
        setSteps((s) => [...s, `✓ Extracted source material (${m.chunks} chunks)`]);
      }
      const r = await api("/concepts/custom", {
        body: { name, subject: subject || "General Knowledge", material_id: materialId },
      });
      const p = r.progress;
      setSteps((s) => [
        ...s,
        `✓ Extracted ${p.concepts} core concept nodes`,
        `✓ Built prerequisite relationship graph`,
        `✓ Generated ${p.misconceptions} validated misconceptions for Alex`,
      ]);
      setTimeout(() => router.push(`/student/topics/${r.concept.id}`), 900);
    } catch (e: any) {
      setErr(e.message);
      setBusy(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="flex flex-wrap items-baseline justify-between gap-4 pb-2 border-b border-slate2/10">
        <div>
          <h1 className="font-display text-3xl font-semibold text-slate2">Choose What to Teach</h1>
          <p className="mt-1 text-sm text-mute">
            Select a topic to start a teaching session with Alex, your confused AI student.
          </p>
        </div>
        <span className="text-xs bg-slatelt px-3 py-1 rounded-full text-slate2 font-semibold">
          {concepts ? `${concepts.length} Concepts Available` : "Loading…"}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Search topics"
            placeholder="Search concepts (e.g. Binary Search, Newton, Entropy)…"
            className="flex-1 min-w-[260px] rounded-lg border border-slate2/30 bg-white px-3.5 py-2 text-sm focus:border-slate2 focus:outline-none"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Subject filter"
            className="rounded-lg border border-slate2/30 bg-white px-3.5 py-2 text-sm focus:border-slate2 focus:outline-none"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">All Subjects</option>
            {subjects?.map((s) => (
              <option key={s} value={s}>
                {SUBJECT_ICONS[s] ? `${SUBJECT_ICONS[s]} ` : ""}{s}
              </option>
            ))}
          </select>
          {(q || subject) && (
            <button
              onClick={() => {
                setQ("");
                setSubject("");
              }}
              className="btn btn-ghost text-xs py-2 px-3 text-pencil border-pencil/30 hover:bg-pencil/10"
            >
              Reset Filters ✕
            </button>
          )}
        </div>

        {/* Subject quick-pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            onClick={() => setSubject("")}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors ${
              subject === ""
                ? "bg-slate2 text-white font-medium"
                : "bg-white border border-slate2/20 text-mute hover:text-ink"
            }`}
          >
            All Subjects
          </button>
          {subjects?.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                subject === s
                  ? "bg-slate2 text-white font-medium"
                  : "bg-white border border-slate2/20 text-mute hover:text-ink"
              }`}
            >
              <span>{SUBJECT_ICONS[s] ?? "📚"}</span>
              <span>{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Concepts Grid */}
      <div className="mt-6">
        {conceptsErr && (
          <div className="rounded-lg bg-pencil/10 p-4 text-sm text-pencil border border-pencil/20">
            Failed to load topics: {conceptsErr}
          </div>
        )}

        {concepts && concepts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {concepts.map((c) => (
              <Link
                key={c.id}
                href={`/student/topics/${c.id}`}
                className="panel block bg-white hover:border-slate2/60 transition-all hover:shadow-sm group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-mute mb-1">
                    <span className="font-semibold text-slate2 flex items-center gap-1">
                      <span>{SUBJECT_ICONS[c.subject] ?? "📚"}</span>
                      <span>{c.subject}</span>
                    </span>
                    <span className="bg-slatelt/50 px-2 py-0.5 rounded text-[11px]">
                      Level {c.difficulty}
                    </span>
                  </div>
                  <div className="font-display text-lg font-bold text-ink group-hover:text-slate2 transition-colors">
                    {c.name}
                  </div>
                  <p className="mt-1.5 text-xs text-mute line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate2/10 flex items-center justify-between text-xs text-slate2 font-medium">
                  <span>{c.node_count} ideas to explain</span>
                  <span className="group-hover:translate-x-1 transition-transform">Teach Alex →</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          concepts && concepts.length === 0 && (
            <div className="panel bg-white p-12 text-center max-w-lg mx-auto space-y-3">
              <div className="text-4xl">🔍</div>
              <h2 className="font-display text-xl font-semibold text-slate2">No concepts found</h2>
              <p className="text-sm text-mute">
                No existing topics match &ldquo;{q || subject}&rdquo;. Try another filter or create your own custom concept below!
              </p>
              <button
                onClick={() => {
                  setQ("");
                  setSubject("");
                }}
                className="btn btn-primary text-xs py-2 px-4"
              >
                Show All Subjects
              </button>
            </div>
          )
        )}
      </div>

      {/* Teach Something Else / Custom Topic Section */}
      <section className="panel mt-12 bg-white/90 border-slate2/20 max-w-2xl">
        <div className="flex items-center gap-2">
          <span className="text-xl">➕</span>
          <div>
            <h2 className="font-display text-xl font-semibold text-slate2">Teach Something Else</h2>
            <p className="text-xs text-mute">
              Want to teach a custom topic? Enter any concept name or upload class notes. Alex will generate grounded misconceptions automatically!
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate2 mb-1">Concept Name</label>
            <input
              aria-label="Concept name"
              placeholder="e.g. Photosynthesis, Dark Matter, Keynesian Multiplier, Transformers"
              className="w-full rounded-lg border border-slate2/30 bg-white px-3.5 py-2 text-sm focus:border-slate2 focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate2 mb-1">
              Optional Study Notes (PDF, PPTX, DOCX, TXT)
            </label>
            <input
              aria-label="Study material"
              type="file"
              accept=".pdf,.pptx,.docx,.txt,image/*"
              className="w-full text-xs text-mute file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slatelt file:text-slate2 hover:file:bg-slate2 hover:file:text-white"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <button
            className="btn btn-primary text-xs py-2 px-5 font-medium shadow-sm"
            disabled={!name.trim() || busy}
            onClick={create}
          >
            {busy ? "Building Concept Graph…" : "Generate Topic for Alex →"}
          </button>
        </div>

        {steps.length > 0 && (
          <ul className="mt-4 rounded-lg bg-slatelt/40 p-3 text-xs space-y-1 text-slate2 font-medium" aria-live="polite">
            {steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        )}

        {err && <p role="alert" className="mt-3 text-xs text-pencil">{err}</p>}
      </section>
    </AppShell>
  );
}
