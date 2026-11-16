import Link from "next/link";
export default function About() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <Link href="/" className="text-sm text-slate2">Back</Link>
      <h1 className="mt-4 font-display text-4xl font-semibold">Students prove what they know by teaching an AI that doesn&apos;t understand.</h1>
      <p className="mt-5 text-mute">The question we care about is whether a student can explain, defend, and apply a concept, not whether they can recognize the right answer. Alex, the AI student, never lectures. A separate evaluator tracks understanding for each idea inside a concept, and professors see which misconceptions the class holds, not only scores.</p>
    </div>
  );
}
