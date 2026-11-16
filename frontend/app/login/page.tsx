"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: string) {
    if (!e.trim()) return setErr("Please enter an email address.");
    setBusy(true);
    setErr("");
    try {
      const u = await api("/auth/login", { body: { email: e.trim() } });
      localStorage.setItem("tmw_user_id", u.id);
      router.push(u.role === "professor" ? "/professor/dashboard" : "/student/dashboard");
    } catch (x: any) {
      setErr(x.message || "Failed to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <div className="mb-2">
        <Link href="/" className="text-xs text-mute hover:text-ink">← Back to home</Link>
      </div>
      <h1 className="font-display text-3xl font-semibold text-slate2">Sign in</h1>
      <p className="mt-1 text-sm text-mute">Access your TeachMeWrong dashboard and learning progress.</p>

      <div className="panel mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate2 mb-1">Your Email</label>
          <input
            className="w-full rounded-lg border border-slate2/30 px-3 py-2 text-sm focus:border-slate2 focus:outline-none"
            placeholder="e.g. student@demo.edu or your email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go(email)}
          />
        </div>

        <button
          className="btn btn-primary w-full text-sm py-2.5 font-medium"
          disabled={busy || !email.trim()}
          onClick={() => go(email)}
        >
          {busy ? "Signing in…" : "Sign in / Continue"}
        </button>

        {err && <p role="alert" className="text-xs text-pencil">{err}</p>}
      </div>

      <div className="panel mt-4 space-y-2.5 bg-slate2/5">
        <p className="text-xs text-mute font-medium">Quick Demo Accounts (instant test data):</p>
        <button
          className="btn btn-ghost w-full text-xs py-2 bg-white flex items-center justify-center gap-1.5"
          onClick={() => go("student@demo.edu")}
        >
          <span>🎓</span> Continue as demo student (Alex session ready)
        </button>
        <button
          className="btn btn-ghost w-full text-xs py-2 bg-white flex items-center justify-center gap-1.5"
          onClick={() => go("prof@demo.edu")}
        >
          <span>📊</span> Continue as demo professor (32-student analytics)
        </button>
      </div>

      <p className="mt-5 text-center text-sm text-mute">
        New here?{" "}
        <Link href="/signup" className="font-medium text-slate2 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
