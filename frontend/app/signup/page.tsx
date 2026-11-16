"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Signup() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", role: "student" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.email.trim()) return setErr("Email is required");
    setBusy(true);
    setErr("");
    try {
      // API will return existing user or create a new user
      const u = await api("/auth/signup", { body: f });
      localStorage.setItem("tmw_user_id", u.id);
      router.push(u.role === "professor" ? "/professor/dashboard" : "/student/dashboard");
    } catch (x: any) {
      // In case of conflict, auto-login seamlessly
      try {
        const u = await api("/auth/login", { body: { email: f.email } });
        localStorage.setItem("tmw_user_id", u.id);
        router.push(u.role === "professor" ? "/professor/dashboard" : "/student/dashboard");
        return;
      } catch (e: any) {
        setErr(x.message || "Failed to create account.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <div className="mb-2">
        <Link href="/" className="text-xs text-mute hover:text-ink">← Back to home</Link>
      </div>
      <h1 className="font-display text-3xl font-semibold text-slate2">Create your account</h1>
      <p className="mt-1 text-sm text-mute">Start teaching AI and mastering foundational concepts.</p>

      <div className="panel mt-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate2 mb-1">Your Name</label>
          <input
            aria-label="Name"
            placeholder="e.g. Alex Smith"
            className="w-full rounded-lg border border-slate2/30 px-3 py-2 text-sm focus:border-slate2 focus:outline-none"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate2 mb-1">Email Address</label>
          <input
            aria-label="Email"
            placeholder="e.g. alex@example.edu"
            type="email"
            className="w-full rounded-lg border border-slate2/30 px-3 py-2 text-sm focus:border-slate2 focus:outline-none"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate2 mb-1">I am joining as</label>
          <select
            aria-label="Role"
            className="w-full rounded-lg border border-slate2/30 px-3 py-2 text-sm focus:border-slate2 focus:outline-none bg-white"
            value={f.role}
            onChange={(e) => setF({ ...f, role: e.target.value })}
          >
            <option value="student">Student (Teach AI & Master Topics)</option>
            <option value="professor">Professor (View Class Analytics & Misconceptions)</option>
          </select>
        </div>

        <button
          className="btn btn-primary w-full text-sm py-2.5 font-medium"
          disabled={busy || !f.email.trim()}
          onClick={submit}
        >
          {busy ? "Signing in…" : "Create account or Sign in"}
        </button>

        {err && (
          <div className="rounded-lg bg-pencil/10 p-3 text-xs text-pencil border border-pencil/20">
            {err}
            <div className="mt-2">
              <Link href="/login" className="font-semibold underline">
                Go to Sign In page →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-mute">
        <span>Already have an account?</span>
        <Link href="/login" className="font-medium text-slate2 hover:underline">
          Sign in here
        </Link>
      </div>

      <div className="panel mt-6 space-y-2 border-dashed">
        <p className="text-xs text-mute font-medium">Quick Demo Access (no password needed):</p>
        <div className="flex gap-2">
          <Link href="/login" className="btn btn-ghost text-xs flex-1 py-1.5">
            Continue as demo student
          </Link>
        </div>
      </div>
    </div>
  );
}
