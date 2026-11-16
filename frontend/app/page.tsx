"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const DEMO_STEPS = [
  {
    phase: "1. Misconception Challenge",
    title: "Alex opens with a plausible confusion",
    desc: "Instead of acting like an all-knowing bot, Alex acts like a student who has a genuine misconception.",
    badge: "Misconception Phase",
    speaker: "Alex (AI Student)",
    content: "“I think Binary Search works on any array, even if it's completely unsorted. You just check the middle and pick a side!”",
    role: "ai",
  },
  {
    phase: "2. Learning by Teaching",
    title: "You explain the causal 'why'",
    desc: "To help Alex, you can't just give the answer. You explain the causal mechanism behind the rule (The Feynman Technique).",
    badge: "Teaching Phase",
    speaker: "You (Teacher)",
    content: "“No, sorting is required because order is what allows one comparison to rule out half the array. If it's unsorted, knowing the middle element tells you nothing about the others!”",
    role: "user",
  },
  {
    phase: "3. Evaluator Feedback & Coaching",
    title: "AI Evaluator tracks your mastery level",
    desc: "An independent judge assesses your reasoning depth, identifies strengths, and flags gaps.",
    badge: "Evaluator Coaching",
    speaker: "Evaluator & Level Coach",
    content: "“✓ Accurate causal reasoning: You explained why order is necessary to eliminate candidates. Mastery Level: 3 / 6 (Proficient).”",
    role: "evaluator",
  },
  {
    phase: "4. The Transfer Challenge",
    title: "Apply the idea to an unseen problem",
    desc: "Can you use this in the real world? Alex gives you a new transfer problem to prove true understanding.",
    badge: "Transfer Challenge",
    speaker: "Alex (Final Test)",
    content: "“If a dictionary has 1,000,000 words, how many checks at most do you need to find any word, and why?”",
    role: "ai",
  },
];

export default function Landing() {
  const [activeStep, setActiveStep] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsLoggedIn(Boolean(localStorage.getItem("tmw_user_id")));
    }
  }, []);

  const scrollToHow = (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById("how");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <header className="border-b border-slate2/15 bg-white/70 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="font-display text-xl font-semibold text-slate2 flex items-center gap-2">
            <span>🧠</span> TeachMeWrong
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#how" onClick={scrollToHow} className="text-mute hover:text-ink font-medium">
              How It Works
            </a>
            <Link href="/about" className="text-mute hover:text-ink">
              About
            </Link>
            {isLoggedIn ? (
              <Link href="/student/dashboard" className="btn btn-primary text-xs py-1.5 px-3">
                Go to Dashboard →
              </Link>
            ) : (
              <Link href="/login" className="btn btn-ghost text-xs py-1.5 px-3 text-slate2">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 md:grid-cols-2 md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-marker/20 px-3 py-1 text-xs font-semibold text-slate2 mb-4 border border-marker/40">
            <span>✨</span> The Protégé Effect / Feynman Technique
          </div>
          <h1 className="font-display text-5xl font-semibold leading-[1.08] tracking-tight md:text-6xl text-slate2">
            Teach the AI. <br />
            <span className="text-ink">Master the concept.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-mute leading-relaxed">
            Turn the AI from a boring answer machine into a confused student named <b>Alex</b> that <i>you</i> must teach.
            Correct Alex&apos;s misconceptions, discover your real knowledge level, and learn concepts deeply.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={isLoggedIn ? "/student/topics" : "/signup"}
              className="btn btn-primary text-base py-3 px-6 shadow-sm"
            >
              {isLoggedIn ? "Continue Teaching →" : "Start Teaching Now"}
            </Link>
            <button
              onClick={scrollToHow}
              id="see-how-it-works-btn"
              className="btn btn-ghost text-base py-3 px-6"
            >
              See How It Works ↓
            </button>
          </div>

          <div className="mt-8 flex items-center gap-6 text-xs text-mute">
            <div className="flex items-center gap-1.5">
              <span>✓</span> Free & instant demo
            </div>
            <div className="flex items-center gap-1.5">
              <span>✓</span> 8 Subjects supported
            </div>
            <div className="flex items-center gap-1.5">
              <span>✓</span> AI Evaluator & Tutor hints
            </div>
          </div>
        </div>

        {/* Hero Interactive Dialog Preview */}
        <div className="panel space-y-3.5 bg-white p-6 shadow-md border-slate2/20">
          <div className="flex items-center justify-between pb-2 border-b border-slate2/10 text-xs">
            <span className="font-semibold text-slate2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-moss inline-block" /> Live Teaching Session
            </span>
            <span className="text-mute bg-slatelt px-2 py-0.5 rounded">Topic: Binary Search</span>
          </div>

          <div className="space-y-3 text-sm">
            <div className="max-w-[88%] rounded-2xl bg-marker/20 p-3.5 border border-marker/30">
              <div className="text-[11px] font-bold text-slate2 mb-0.5">Alex (AI Student)</div>
              “I think binary search works on any array, even if it&apos;s not sorted. You just check the middle and go from there!”
            </div>

            <div className="max-w-[88%] ml-auto rounded-2xl bg-slate2 text-white p-3.5 shadow-sm">
              <div className="text-[11px] font-bold text-slatelt mb-0.5">You (Student Teacher)</div>
              “No! Sorting is required because ordering allows one comparison to rule out half the remaining candidates.”
            </div>

            <div className="max-w-[88%] rounded-2xl bg-slatelt/50 p-3 border border-slate2/15 text-xs text-ink/90">
              <div className="font-semibold text-slate2 mb-0.5 flex items-center gap-1">
                <span>📊</span> AI Evaluator Feedback
              </div>
              “Great causal explanation. You explained why ordering enables elimination. Alex&apos;s understanding increased!”
            </div>
          </div>

          <div className="pt-2 text-center">
            <Link href={isLoggedIn ? "/student/topics" : "/signup"} className="text-xs font-semibold text-slate2 hover:underline">
              Try teaching Alex now →
            </Link>
          </div>
        </div>
      </section>

      {/* Detailed "How It Works" Section */}
      <section id="how" className="border-t border-slate2/15 bg-white/70 py-20 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-slate2 bg-slatelt px-3 py-1 rounded-full">
              Pedagogical Loop
            </span>
            <h2 className="font-display text-4xl font-semibold mt-3 text-slate2">How TeachMeWrong Works</h2>
            <p className="mt-3 text-mute">
              Cognitive science shows that explaining a concept to someone else produces significantly higher retention than just reading answers.
            </p>
          </div>

          {/* Interactive Step Switcher */}
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {DEMO_STEPS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  activeStep === idx
                    ? "border-slate2 bg-slatelt/40 ring-2 ring-slate2 shadow-sm"
                    : "border-slate2/15 bg-white hover:border-slate2/40"
                }`}
              >
                <div className="text-xs font-bold text-slate2 mb-1">{s.phase}</div>
                <div className="font-semibold text-sm text-ink">{s.title}</div>
              </button>
            ))}
          </div>

          {/* Active Step Showcase */}
          <div className="mt-8 panel bg-white p-8 border-slate2/20 shadow-sm grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-marker/20 text-ink border border-marker/40">
                {DEMO_STEPS[activeStep].badge}
              </span>
              <h3 className="font-display text-2xl font-bold mt-3 text-slate2">
                {DEMO_STEPS[activeStep].title}
              </h3>
              <p className="mt-3 text-sm text-mute leading-relaxed">
                {DEMO_STEPS[activeStep].desc}
              </p>

              <div className="mt-6 flex gap-3">
                <Link href={isLoggedIn ? "/student/topics" : "/signup"} className="btn btn-primary text-xs py-2 px-4">
                  Experience This in a Session →
                </Link>
                {activeStep < 3 ? (
                  <button
                    onClick={() => setActiveStep((prev) => (prev + 1) % 4)}
                    className="btn btn-ghost text-xs py-2 px-4"
                  >
                    Next Step →
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveStep(0)}
                    className="btn btn-ghost text-xs py-2 px-4"
                  >
                    Restart Tour ↺
                  </button>
                )}
              </div>
            </div>

            {/* Visual Chat Card for this Step */}
            <div className="rounded-xl border border-slate2/15 bg-paper p-5">
              <div className="text-xs font-semibold text-slate2 mb-2 flex items-center justify-between">
                <span>{DEMO_STEPS[activeStep].speaker}</span>
                <span className="text-[11px] text-mute">Simulated Step {activeStep + 1} of 4</span>
              </div>
              <div
                className={`rounded-xl p-4 text-sm leading-relaxed ${
                  DEMO_STEPS[activeStep].role === "user"
                    ? "bg-slate2 text-white"
                    : DEMO_STEPS[activeStep].role === "evaluator"
                    ? "bg-white border border-moss/40 text-ink"
                    : "bg-marker/25 text-ink border border-marker/40"
                }`}
              >
                {DEMO_STEPS[activeStep].content}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate2/15 bg-white py-8">
        <div className="mx-auto max-w-6xl px-5 flex flex-wrap items-center justify-between gap-4 text-xs text-mute">
          <div>
            <b>TeachMeWrong</b> · An active-learning platform built with Next.js & FastAPI.
          </div>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-ink">About</Link>
            <Link href="/login" className="hover:text-ink">Sign in</Link>
            <Link href="/signup" className="hover:text-ink">Create Account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
