export type User = { id: string; name: string; email: string; role: "student" | "professor" };
export type NodeProgress = { key: string; name: string; parent: string | null; score: number; status: "untested" | "weak" | "developing" | "strong"; focus?: boolean; description?: string };
export type Msg = { id: string; sender: "ai" | "student"; content: string };
export type Feedback = {
  text: string;
  strengths: string[];
  needs_work: string[];
  misconception_corrected: boolean;
  scores?: { accuracy: number; reasoning: number; completeness: number; concept_coverage: number };
};
export type Final = { state: "MASTERED" | "PARTIALLY_MASTERED" | "NEEDS_REINFORCEMENT"; explanation: string; strong?: string[]; needs_reinforcement?: string[];
  misconception_corrected?: boolean; misconception?: string; transfer_passed?: boolean };
export type SessionView = { id: string; concept: { id: string; name: string }; phase: "TEACHING" | "TRANSFER" | "COMPLETE"; difficulty: number; turn: number;
  student_tagline: string; current_misconception: string | null; messages: Msg[]; progress: NodeProgress[]; ready_for_transfer: boolean;
  transfer_question: string | null; final: Final | null };
export type HintResponse = {
  concept: string;
  node_key: string;
  node_name: string;
  node_description: string;
  difficulty: number;
  misconception: string;
  analogy: string;
  guidance: string;
  key_points: string[];
  level_tip: string;
};
