"use client";
import AppShell from "@/components/AppShell";
import { useUser } from "@/hooks/useUser";

export default function Profile() {
  const user = useUser("student");
  return (
    <AppShell user={user}>
      <h1 className="font-display text-3xl font-semibold">Profile</h1>
      {user && <div className="panel mt-6 max-w-md space-y-1 text-sm"><div><b>Name</b> {user.name}</div><div><b>Email</b> {user.email}</div><div><b>Role</b> {user.role}</div></div>}
    </AppShell>
  );
}
