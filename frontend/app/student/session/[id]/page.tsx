"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import ConceptMap from "@/components/ConceptMap";
import MasteryBar from "@/components/MasteryBar";
import { api } from "@/lib/api";
import { useUser } from "@/hooks/useUser";
import type { Feedback, HintResponse, SessionView } from "@/types";

const LEVEL_INFO: Record<number, { title: string; desc: string; icon: string }> = {
  1: { title: "Foundations", desc: "Basic recall & terms", icon: "🌱" },
  2: { title: "Core Mechanism", desc: "Step-by-step logic", icon: "🔍" },
  3: { title: "Concrete Examples", desc: "Walking through traces", icon: "🧩" },
  4: { title: "Boundary & Edge Cases", desc: "Pointers & bounds", icon: "⚡" },
  5: { title: "Causal Proof", desc: "Mathematical reasoning", icon: "🔬" },
  6: { title: "Transfer Mastery", desc: "Novel problem solving", icon: "🏆" },
};

export default function Session() {
  const { id } = useParams<{ id: string }>();
  const user = useUser("student");
  const [s, setS] = useState<SessionView | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fb, setFb] = useState<Feedback | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [rec, setRec] = useState(false);

  // Pedagogical guidance / hint state
  const [hint, setHint] = useState<HintResponse | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const end = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const data = await api<SessionView>(`/sessions/${id}`);
      setS(data);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  useEffect(() => {
    if (user && id) {
      void load();
    }
  }, [user, id]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [s?.messages.length]);

  async function fetchHint() {
    setHintLoading(true);
    setErr("");
    try {
      const data = await api<HintResponse>(`/sessions/${id}/hint`);
      setHint(data);
      setShowHint(true);
    } catch (e: any) {
      setErr(e.message);
    }
    setHintLoading(false);
  }

  async function send() {
    if (!text.trim() || !s) return;
    setBusy(true);
    setErr("");
    const body = { input: { type: "text", content: text } };
    try {
      if (s.phase === "TRANSFER") {
        await api(`/sessions/${id}/transfer-test/answer`, { body });
      } else {
        const r = await api(`/sessions/${id}/message`, { body });
        setFb(r.feedback);
      }
      setText("");
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  async function startTransfer() {
    setBusy(true);
    try {
      await api(`/sessions/${id}/transfer-test`, { method: "POST" });
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  function voice() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return setErr("Voice input is not supported in this browser.");
    const r = new SR();
    r.onresult = (e: any) => setText((t) => `${t} ${e.results[0][0].transcript}`.trim());
    r.onstart = () => setRec(true);
    r.onend = () => setRec(false);
    r.start();
  }

  if (!s) {
    return (
      <AppShell user={user}>
        {err ? <p role="alert" className="text-pencil">{err}</p> : <div className="p-8 text-mute">Loading session…</div>}
      </AppShell>
    );
  }

  // Active selected node or currently focused node
  const activeFocusKey = s.progress.find((n) => n.focus)?.key;
  const currentKey = sel ?? activeFocusKey ?? s.progress[0]?.key;
  const node = s.progress.find((n) => n.key === currentKey);
  const isMis = node && s.current_misconception && activeFocusKey === node.key;

  // Final summary screen
  if (s.phase === "COMPLETE" && s.final) {
    const f = s.final;
    const label = f.state.replace("_", " ");
    return (
      <AppShell user={user}>
        <div className="mx-auto max-w-2xl">
          <div className="text-sm text-mute">{s.concept.name}</div>
          <h1 className="font-display text-4xl font-semibold capitalize">{label.toLowerCase()}</h1>
          <p className="mt-4 text-lg">{f.explanation}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="panel border-moss/30 bg-moss/5">
              <h2 className="font-medium text-moss flex items-center gap-1.5">
                <span>✓</span> Strong Concepts
              </h2>
              <ul className="mt-2 text-sm space-y-1">
                {(f.strong ?? []).map((x) => (
                  <li key={x}>✓ {x}</li>
                ))}
                {!f.strong?.length && <li className="text-mute">None flagged yet</li>}
              </ul>
            </div>
            <div className="panel border-pencil/30 bg-pencil/5">
              <h2 className="font-medium text-pencil flex items-center gap-1.5">
                <span>⚠</span> Needs Reinforcement
              </h2>
              <ul className="mt-2 text-sm space-y-1">
                {(f.needs_reinforcement ?? []).map((x) => (
                  <li key={x}>⚠ {x}</li>
                ))}
                {!f.needs_reinforcement?.length && <li className="text-mute">None flagged</li>}
              </ul>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate2/15 bg-white p-4 text-sm">
            <div className="font-medium">Summary & Level Verdict</div>
            <p className="mt-1 text-mute">
              Alex&apos;s misconception was <b>{f.misconception_corrected ? "successfully corrected" : "not fully corrected"}</b>.
              Transfer challenge: <b>{f.transfer_passed ? "Passed" : "Not yet passed"}</b>.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href={`/student/topics/${s.concept.id}`}>
              Teach Again
            </Link>
            <Link className="btn btn-ghost" href="/student/mastery">
              Practice Weak Concepts
            </Link>
            <Link className="btn btn-ghost" href="/student/dashboard">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // Calculate overall concept mastery score
  const testedNodes = s.progress.filter((n) => n.status !== "untested");
  const avgScore = testedNodes.length
    ? Math.round((testedNodes.reduce((acc, curr) => acc + curr.score, 0) / testedNodes.length) * 100)
    : 0;

  return (
    <AppShell user={user}>
      <div className="grid gap-5 lg:grid-cols-[270px_1fr_300px]">
        {/* Left Column: Concept Map & Quick Study Guide */}
        <aside className="panel order-2 lg:order-1 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate2/10">
              <h2 className="font-display text-lg font-semibold">{s.concept.name}</h2>
              <span className="text-xs bg-slatelt px-2 py-0.5 rounded text-slate2 font-medium">Concept Map</span>
            </div>
            <p className="mt-2 text-xs text-mute">Click any idea below to learn its definition and coaching tips.</p>
            <div className="mt-3">
              <ConceptMap nodes={s.progress} selected={currentKey} onSelect={setSel} />
            </div>

            {node && (
              <div className="mt-4 rounded-xl border border-slate2/15 bg-white p-3.5 text-sm shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate2">{node.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      node.status === "strong"
                        ? "bg-moss/15 text-moss"
                        : node.status === "developing"
                        ? "bg-marker/20 text-ink"
                        : node.status === "weak"
                        ? "bg-pencil/15 text-pencil"
                        : "bg-slate2/10 text-mute"
                    }`}
                  >
                    {node.status === "untested" ? "Untested" : `${Math.round(node.score * 100)}%`}
                  </span>
                </div>
                {node.description && <p className="mt-1.5 text-xs text-ink/80 leading-relaxed">{node.description}</p>}
                {isMis && (
                  <div className="mt-2 rounded bg-marker/15 p-2 text-xs text-ink font-medium border border-marker/30">
                    🎯 Alex is currently confused about this exact idea!
                  </div>
                )}
                {node.status === "weak" && (
                  <p className="mt-2 text-xs text-pencil">
                    💡 Tip: Explain the causal reasoning (why it works), not just the rule.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate2/10">
            <button
              type="button"
              onClick={showHint ? () => setShowHint(false) : fetchHint}
              disabled={busy || hintLoading}
              className="w-full btn bg-marker/20 hover:bg-marker/30 text-ink text-xs font-medium py-2 rounded-lg border border-marker/40 flex items-center justify-center gap-1.5"
            >
              <span>💡</span>
              {hintLoading ? "Loading Tutor Primer…" : showHint ? "Close Concept Guide" : "Study Concept / Get Hint"}
            </button>
          </div>
        </aside>

        {/* Middle Column: Teaching Conversation & Tutor Explainer */}
        <section className="panel order-1 flex min-h-[75vh] flex-col lg:order-2">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate2/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-marker font-display text-lg font-semibold text-ink shadow-sm">
                A
              </div>
              <div>
                <div className="font-medium text-slate2">{s.student_tagline}</div>
                {s.current_misconception && (
                  <div className="text-xs text-mute flex items-center gap-1">
                    <span className="text-pencil font-medium">Believes:</span> “{s.current_misconception}”
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-full bg-slatelt px-2.5 py-1 text-xs font-medium text-slate2">
                Turn {s.turn} · Level {s.difficulty}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto py-4" aria-live="polite">
            {s.messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.sender === "student" ? "ml-auto bg-slate2 text-white" : "bg-marker/20 text-ink border border-marker/30"
                }`}
              >
                {m.sender === "ai" && <div className="text-[11px] font-semibold text-slate2 mb-0.5">Alex (Student)</div>}
                {m.content}
              </div>
            ))}

            {s.phase === "TRANSFER" && s.transfer_question && (
              <div className="rounded-xl border-2 border-marker bg-white p-4 text-sm shadow-sm">
                <div className="mb-1 font-semibold text-slate2 flex items-center gap-1.5">
                  <span>🏆</span> Final Transfer Challenge
                </div>
                <p className="text-ink">{s.transfer_question}</p>
                <p className="mt-2 text-xs text-mute">
                  Apply your knowledge to this novel scenario to prove your mastery!
                </p>
              </div>
            )}
            <div ref={end} />
          </div>

          {/* Interactive Pedagogical Hint & Concept Tutor Card */}
          {showHint && hint && (
            <div className="mb-3 rounded-xl border border-marker/50 bg-marker/10 p-4 text-sm shadow-sm transition-all animate-fadeIn">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎓</span>
                  <div>
                    <h3 className="font-semibold text-slate2">
                      Concept Primer: <span className="text-ink">{hint.node_name}</span>
                    </h3>
                    <p className="text-xs text-mute">{hint.node_description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHint(false)}
                  className="text-mute hover:text-ink text-xs px-2 py-1 rounded bg-white/70"
                >
                  ✕ Close
                </button>
              </div>

              {/* Analogy */}
              {hint.analogy && (
                <div className="mt-3 rounded-lg bg-white/90 p-3 text-xs leading-relaxed border border-marker/25">
                  <span className="font-semibold text-slate2">💡 Everyday Analogy: </span>
                  {hint.analogy}
                </div>
              )}

              {/* Intuition / Causal why */}
              {hint.guidance && (
                <div className="mt-2 text-xs leading-relaxed text-ink/90">
                  <span className="font-semibold text-slate2">🧠 Core Intuition: </span>
                  {hint.guidance}
                </div>
              )}

              {/* Key points to explain */}
              {hint.key_points && hint.key_points.length > 0 && (
                <div className="mt-2.5">
                  <div className="text-[11px] font-semibold text-slate2 uppercase tracking-wide">
                    Key points to teach Alex:
                  </div>
                  <ul className="mt-1 space-y-1 text-xs">
                    {hint.key_points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-ink/80">
                        <span className="text-marker font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Level Tip */}
              {hint.level_tip && (
                <div className="mt-2.5 rounded bg-slatelt/50 p-2 text-xs text-slate2 font-medium">
                  📈 Level {hint.difficulty} Tip: {hint.level_tip}
                </div>
              )}
            </div>
          )}

          {/* Evaluator Coaching Card */}
          {fb && s.phase === "TEACHING" && (
            <div className="mb-3 rounded-xl border border-slate2/15 bg-white p-3.5 text-sm shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs tracking-wide uppercase text-slate2 flex items-center gap-1.5">
                  <span>📊</span> Evaluator Coaching & Feedback
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    fb.misconception_corrected
                      ? "bg-moss/15 text-moss"
                      : "bg-marker/20 text-ink"
                  }`}
                >
                  {fb.misconception_corrected ? "🎉 Misconception Dispelled" : "🤔 Alex Still Questioning"}
                </span>
              </div>

              <p className="text-xs text-ink/90 leading-relaxed">{fb.text}</p>

              {/* Strengths & Needs Work Badges */}
              <div className="grid gap-2 sm:grid-cols-2 pt-1">
                {fb.strengths && fb.strengths.length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium text-moss">✓ Nailed it:</span>{" "}
                    <span className="text-mute">{fb.strengths.join(", ")}</span>
                  </div>
                )}
                {fb.needs_work && fb.needs_work.length > 0 && (
                  <div className="text-xs">
                    <span className="font-medium text-pencil">⚠ Focus next:</span>{" "}
                    <span className="text-mute">{fb.needs_work.join(", ")}</span>
                  </div>
                )}
              </div>

              {/* Detailed Scores Bar */}
              {fb.scores && (
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate2/10 text-[11px] text-mute">
                  <div>
                    Accuracy: <b className="text-ink">{Math.round(fb.scores.accuracy * 100)}%</b>
                  </div>
                  <div>
                    Reasoning: <b className="text-ink">{Math.round(fb.scores.reasoning * 100)}%</b>
                  </div>
                  <div>
                    Coverage: <b className="text-ink">{Math.round(fb.scores.concept_coverage * 100)}%</b>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ready for Transfer Banner */}
          {s.phase === "TEACHING" && s.ready_for_transfer && (
            <div className="mb-3 rounded-xl bg-moss/10 border border-moss/30 p-3 text-sm flex items-center justify-between">
              <div>
                <div className="font-semibold text-moss">🎉 Ready for Transfer Challenge!</div>
                <div className="text-xs text-ink/80">You have explained the core ideas thoroughly. Take the final test to prove mastery.</div>
              </div>
              <button className="btn bg-moss text-white hover:bg-moss/90 text-xs px-3 py-1.5" disabled={busy} onClick={startTransfer}>
                Start Challenge →
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="flex flex-col gap-2 pt-2 border-t border-slate2/10">
            <textarea
              aria-label="Your explanation"
              rows={3}
              className="w-full resize-none rounded-lg border border-slate2/30 bg-white px-3 py-2 text-sm focus:border-slate2 focus:ring-1 focus:ring-slate2"
              value={text}
              placeholder={
                s.phase === "TRANSFER"
                  ? "Solve the transfer challenge in your own words, justifying your reasoning…"
                  : "Explain the idea to Alex in your own words (explain WHY, not just the rule)…"
              }
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={showHint ? () => setShowHint(false) : fetchHint}
                  disabled={busy || hintLoading}
                >
                  <span>💡</span>
                  <span>{hintLoading ? "Tutor..." : showHint ? "Hide Hint" : "Need a Hint / Teach Me"}</span>
                </button>
                <button
                  type="button"
                  className={`btn btn-ghost text-xs py-1.5 px-3 ${rec ? "bg-pencil/20 text-pencil" : ""}`}
                  onClick={voice}
                  aria-pressed={rec}
                >
                  {rec ? "Listening…" : "🎤 Voice"}
                </button>
              </div>

              <button
                type="button"
                className="btn btn-primary text-xs py-2 px-5 font-medium shadow-sm"
                disabled={busy || !text.trim()}
                onClick={send}
              >
                {busy ? "Alex is thinking…" : s.phase === "TRANSFER" ? "Submit Solution" : "Send Explanation"}
              </button>
            </div>
          </div>

          {err && <p role="alert" className="mt-2 text-sm text-pencil">{err}</p>}
        </section>

        {/* Right Column: Student Understanding & Level Breakdown */}
        <aside className="panel order-3 flex flex-col gap-5">
          {/* Understanding Level Card */}
          <div className="rounded-xl border border-slate2/15 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate2/10">
              <h2 className="font-display text-base font-semibold text-slate2">Your Learning Level</h2>
              <span className="text-xs font-bold text-marker bg-marker/15 px-2 py-0.5 rounded">
                Tier {s.difficulty} / 6
              </span>
            </div>

            {/* Level Step Progress Bar */}
            <div className="mt-3 flex items-center justify-between gap-1">
              {[1, 2, 3, 4, 5, 6].map((lvl) => (
                <div
                  key={lvl}
                  className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                    lvl <= s.difficulty ? "bg-slate2" : "bg-slate2/15"
                  }`}
                  title={`Level ${lvl}: ${LEVEL_INFO[lvl]?.title}`}
                />
              ))}
            </div>

            {/* Active Level Detail */}
            <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-slatelt/40 p-2.5">
              <span className="text-2xl">{LEVEL_INFO[s.difficulty]?.icon ?? "📚"}</span>
              <div>
                <div className="text-xs font-semibold text-slate2">
                  Level {s.difficulty}: {LEVEL_INFO[s.difficulty]?.title}
                </div>
                <div className="text-[11px] text-mute mt-0.5">{LEVEL_INFO[s.difficulty]?.desc}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-mute pt-2 border-t border-slate2/10">
              <span>Overall Concept Mastery:</span>
              <span className="font-bold text-slate2 tabular-nums">{avgScore}%</span>
            </div>
          </div>

          {/* Live Node Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-sm font-semibold text-slate2">Sub-concept Mastery</h3>
              <span className="text-[11px] text-mute">{s.progress.length} components</span>
            </div>
            <div className="space-y-3">
              {s.progress.map((n) => (
                <MasteryBar key={n.key} label={n.name} score={n.score} untested={n.status === "untested"} />
              ))}
            </div>
          </div>

          {/* Pedagogical Guidance Tip */}
          <div className="rounded-xl bg-paper p-3 text-xs text-ink/80 border border-slate2/10">
            <div className="font-medium text-slate2 mb-1 flex items-center gap-1">
              <span>🎯</span> How TeachMeWrong Works
            </div>
            <p className="leading-relaxed">
              You learn best by teaching! Alex challenges your understanding with misconceptions. If you get stuck, use <b>Teach Me / Hint</b> to review the mental model, then explain it in your own words.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
