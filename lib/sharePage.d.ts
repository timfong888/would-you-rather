export interface SharePageMeta {
  title: string; description: string; url: string; image: string;
  imageWidth: number; imageHeight: number; siteName: string;
}
export function sharePageMeta(question: { id: string; optionA: string; optionB: string }, origin: string): SharePageMeta;
