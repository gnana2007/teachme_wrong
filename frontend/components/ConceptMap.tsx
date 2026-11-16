"use client";
import { tone } from "./MasteryBar";

type N = { key: string; name: string; parent: string | null; score: number; status?: string; focus?: boolean };

export default function ConceptMap({ nodes, selected, onSelect }: { nodes: N[]; selected?: string | null; onSelect?: (k: string) => void }) {
  const depth = (n: N): number => { let d = 0, p = n.parent; while (p) { d++; p = nodes.find((x) => x.key === p)?.parent ?? null; } return d; };
  return (
    <ul className="space-y-1.5" aria-label="Concept map">
      {nodes.map((n) => {
        const untested = n.status === "untested";
        return (
          <li key={n.key} style={{ marginLeft: Math.min(depth(n), 3) * 14 }}>
            <button onClick={() => onSelect?.(n.key)} aria-pressed={selected === n.key}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${selected === n.key ? "border-slate2 bg-slatelt" : "border-slate2/15 bg-white hover:border-slate2/40"} ${n.focus ? "ring-2 ring-marker" : ""}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone(n.score, untested)}`} />
              <span className="flex-1">{n.name}</span>
              <span className="tabular-nums text-xs text-mute">{untested ? "—" : `${Math.round(n.score * 100)}%`}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
