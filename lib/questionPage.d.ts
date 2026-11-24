export const RELATED_COUNT: number;
type Q = { id: string; category: string; optionA: string; optionB: string };
type C = { id: string; label: string; audience?: string; ages?: readonly number[] };
export function relatedQuestions(question: Q, questions: Q[], count?: number): Q[];
export function questionPageHtml(args: { question: Q; category: C | undefined; related: Q[]; origin: string; paid?: boolean }): string;
