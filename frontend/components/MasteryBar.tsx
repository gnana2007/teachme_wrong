export const tone = (s: number, untested = false) =>
  untested ? "bg-slate2/20" : s >= 0.75 ? "bg-moss" : s >= 0.55 ? "bg-marker" : "bg-pencil";

export default function MasteryBar({ label, score, untested }: { label: string; score: number; untested?: boolean }) {
  const pct = Math.round(score * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="tabular-nums text-mute">{untested ? "—" : `${pct}%`}</span></div>
      <div className="h-2 rounded-full bg-slate2/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-2 rounded-full transition-all duration-700 ${tone(score, untested)}`} style={{ width: `${untested ? 4 : Math.max(pct, 3)}%` }} />
      </div>
    </div>
  );
}
