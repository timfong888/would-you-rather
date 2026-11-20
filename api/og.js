// Edge function: 1200x630 Open Graph image for a question's share page.
// GET /api/og?id=<question-id>   (no id: the generic brand card, used by the home page)
// Static content only: brand + the two options. It never reads votes, sets cookies or records
// anything, so it is safe for kids questions (kf-*). Plain `.js` with createElement, like card.js (#73).
import { createElement as h } from "react";
import { ImageResponse } from "@vercel/og";
import { QUESTIONS, CATEGORIES, THEME_FOR_CATEGORY } from "./_lib/data.js";
import { LOGO_PATH, SITE_NAME } from "../lib/site.js";
export const config = { runtime: "edge" };

const THEMES = {
  bright: { bg: "linear-gradient(135deg, #F472B6 0%, #7C3AED 100%)", box: "rgba(255,255,255,0.16)", border: "rgba(255,255,255,0.3)", accentA: "#EC4899", accentB: "#7C3AED" },
  moody: { bg: "linear-gradient(135deg, #0D0D1A 0%, #1C0D30 100%)", box: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.14)", accentA: "#C9A84C", accentB: "#7B2FBE" }
};
const truncate = (t, max) => (t.length > max ? t.slice(0, max - 1) + "…" : t);

async function logoDataUri(origin) {
  try {
    const res = await Promise.race([
      fetch(origin + LOGO_PATH),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500))
    ]);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return "data:image/png;base64," + btoa(bin);
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const question = id ? QUESTIONS.find((q) => q.id === id) : null;
  if (id && !question) return new Response("Question not found", { status: 404 });

  const t = THEMES[question ? THEME_FOR_CATEGORY[question.category] === "moody" ? "moody" : "bright" : "bright"];
  const logo = await logoDataUri(url.origin);
  const flex = (style, ...children) => h("div", { style: { display: "flex", ...style } }, ...children);
  const option = (label, text, color) =>
    flex({ flex: 1, flexDirection: "column", justifyContent: "center", background: t.box, border: `2px solid ${t.border}`, borderRadius: 28, padding: "28px 36px", gap: 14 },
      flex({ color, fontSize: 26, fontWeight: 800, letterSpacing: 3, background: "#FFFFFF", borderRadius: 999, padding: "4px 18px", alignSelf: "flex-start" }, label),
      flex({ color: "#FFFFFF", fontSize: text.length > 60 ? 38 : 46, fontWeight: 800, lineHeight: 1.2 }, text));

  const header = flex({ alignItems: "center", gap: 20 },
    logo ? h("img", { src: logo, width: 72, height: 72, style: { borderRadius: 16 } }) : null,
    flex({ color: "#FFFFFF", fontSize: 38, fontWeight: 800, letterSpacing: 1 }, SITE_NAME));

  const body = question
    ? flex({ flex: 1, flexDirection: "column", gap: 16, justifyContent: "center" },
        option("A", truncate(question.optionA, 90), t.accentA),
        flex({ justifyContent: "center", color: "rgba(255,255,255,0.8)", fontSize: 28, fontWeight: 800, letterSpacing: 4 }, "OR"),
        option("B", truncate(question.optionB, 90), t.accentB))
    : flex({ flex: 1, flexDirection: "column", justifyContent: "center", gap: 18 },
        flex({ color: "#FFFFFF", fontSize: 84, fontWeight: 800, lineHeight: 1.1 }, "Pick a side."),
        flex({ color: "rgba(255,255,255,0.85)", fontSize: 40, fontWeight: 600 }, "Spark real conversations with friends and family."));

  const footer = flex({ justifyContent: "space-between", color: "rgba(255,255,255,0.8)", fontSize: 28, fontWeight: 700 },
    flex({}, question ? (CATEGORIES.find((c) => c.id === question.category)?.label ?? "") : "Free, no sign-up"),
    flex({}, "wouldyourather.fyi"));

  const image = new ImageResponse(
    flex({ width: "100%", height: "100%", flexDirection: "column", background: t.bg, padding: "44px 56px", gap: 20 }, header, body, footer),
    { width: 1200, height: 630 }
  );
  const res = new Response(image.body, image);
  // A card rendered without the logo (self-fetch failed) must not be cached for long.
  res.headers.set("cache-control", logo ? "public, max-age=3600, s-maxage=86400" : "public, max-age=60, s-maxage=60");
  return res;
}
