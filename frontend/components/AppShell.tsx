"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/types";

const NAV = {
  student: [["/student/dashboard", "Dashboard"], ["/student/topics", "Topics"], ["/student/mastery", "Mastery"], ["/student/history", "History"], ["/student/profile", "Profile"]],
  professor: [["/professor/dashboard", "Overview"], ["/professor/courses", "Courses"]],
};

export default function AppShell({ user, children }: { user: User | null; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  if (!user) return <div className="p-10 text-mute">Loading…</div>;
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate2/15 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-5 py-3">
          <Link href="/" className="font-display text-xl font-semibold text-slate2">TeachMeWrong</Link>
          <nav className="flex flex-1 gap-1 overflow-x-auto" aria-label="Main">
            {NAV[user.role].map(([href, label]) => (
              <Link key={href} href={href} className={`rounded-md px-3 py-1.5 text-sm ${path.startsWith(href) ? "bg-slatelt text-ink" : "text-mute hover:text-ink"}`}>{label}</Link>
            ))}
          </nav>
          <span className="hidden text-sm text-mute sm:block">{user.name}</span>
          <button className="btn btn-ghost" onClick={() => { localStorage.removeItem("tmw_user_id"); router.push("/"); }}>Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
