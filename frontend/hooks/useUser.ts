"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/types";

export function useUser(role?: "student" | "professor") {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();
  useEffect(() => {
    let active = true;
    api<User>("/me")
      .then((u) => {
        if (!active) return;
        if (role && u.role !== role) router.replace("/login");
        else setUser(u);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [role, router]);
  return user;
}

export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  return { data, error };
}
