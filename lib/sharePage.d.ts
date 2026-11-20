export interface SharePageMeta {
  title: string; description: string; imageAlt: string; url: string; image: string;
  imageWidth: number; imageHeight: number; siteName: string;
}
export function sharePageMeta(question: { id: string; optionA: string; optionB: string }, origin: string): SharePageMeta;
export function lowerFirst(text: string): string;
export const SHARE_TITLE: string;
