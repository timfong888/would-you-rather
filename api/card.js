// Edge function: branded PNG share card for a question.
// GET /api/card?id=<question-id>&ratio=<9x16|1.91x1>
// The card never shows anyone's pick (#188): it ignores any `voted` parameter.
// Must stay a plain `.js` file: Vercel does not build `.jsx` entries in api/ (#73),
// so the markup is written with createElement (`h`) instead of JSX.
import { createElement as h } from "react";
import { ImageResponse } from "@vercel/og";
import { QUESTIONS, CATEGORIES, THEME_FOR_CATEGORY } from "./_lib/data.js";
import { getStore } from "./_lib/votes.js";
import { formatResult } from "../lib/results.js";
export const config = { runtime: "edge" };
const BRIGHT = {
  bg: "linear-gradient(135deg, #F472B6 0%, #7C3AED 100%)",
  optionBg: "rgba(255,255,255,0.15)",
  optionBorder: "rgba(255,255,255,0.28)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.78)",
  textMuted: "rgba(255,255,255,0.5)",
  badgeBg: "rgba(255,255,255,0.18)",
  labelA: "#EC4899",
  labelB: "#7C3AED",
  blurBg: "rgba(0,0,0,0.28)",
  blurOverlay: "rgba(100,30,120,0.86)"
};
const MOODY = {
  bg: "linear-gradient(135deg, #0D0D1A 0%, #1C0D30 100%)",
  optionBg: "rgba(255,255,255,0.06)",
  optionBorder: "rgba(255,255,255,0.11)",
  textPrimary: "#FFFFFF",
  textSecondary: "rgba(255,255,255,0.72)",
  textMuted: "rgba(255,255,255,0.4)",
  badgeBg: "rgba(255,255,255,0.07)",
  labelA: "#C9A84C",
  labelB: "#7B2FBE",
  blurBg: "rgba(200,168,76,0.08)",
  blurOverlay: "rgba(8,6,18,0.90)"
};
function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const ratio = url.searchParams.get("ratio") || "9x16";
  const question = QUESTIONS.find((q) => q.id === id);
  if (!question) {
    return new Response("Question not found", { status: 404 });
  }
  const category = CATEGORIES.find((c) => c.id === question.category);
  const themeName = THEME_FOR_CATEGORY[question.category] || "bright";
  const t = themeName === "moody" ? MOODY : BRIGHT;
  let tally = null;
  try {
    const store = await getStore(process.env);
    if (store) tally = (await Promise.race([
      store.tallies([question.id]),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500))
    ]))[question.id] ?? null;
  } catch {
    tally = null;
  }
  const result = formatResult(tally);
  const hasData = result.kind === "percent";
  const totalVotes = hasData ? result.total : 0;
  const pctA = hasData ? result.a : 0;
  const pctB = hasData ? result.b : 0;
  const majorityPct = Math.max(pctA, pctB);
  const majorityOption = pctA >= pctB ? "A" : "B";
  const consensusText = `${majorityPct}% chose Option ${majorityOption}`;
  const baseUrl = new URL(req.url).origin;
  const shareUrl = `${baseUrl}/p/${id}`;
  const voteCountLabel = totalVotes >= 1e3 ? `${(totalVotes / 1e3).toFixed(1)}k` : totalVotes.toLocaleString();
  const isLandscape = ratio === "1.91x1";
  const width = isLandscape ? 1200 : 540;
  const height = isLandscape ? 628 : 960;
  const optA = truncate(question.optionA, isLandscape ? 90 : 130);
  const optB = truncate(question.optionB, isLandscape ? 90 : 130);
  const VoteCta = /* @__PURE__ */ h("div", { style: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: isLandscape ? 8 : 10
  } }, hasData && /* @__PURE__ */ h("div", { style: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  } }, /* @__PURE__ */ h("div", { style: { fontSize: isLandscape ? 13 : 12, display: "flex" } }, "🔥"), /* @__PURE__ */ h("div", { style: {
    color: t.textSecondary,
    fontSize: isLandscape ? 12 : 11,
    fontWeight: 600,
    display: "flex"
  } }, voteCountLabel, " people voted — where do you stand?")), /* @__PURE__ */ h("div", { style: {
    width: "100%",
    borderRadius: isLandscape ? 14 : 18,
    background: "linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: isLandscape ? "15px 18px" : "20px 24px",
    gap: 5
  } }, /* @__PURE__ */ h("div", { style: {
    color: "#FFFFFF",
    fontSize: isLandscape ? 17 : 16,
    fontWeight: 900,
    letterSpacing: 1,
    display: "flex"
  } }, "VOTE NOW →"), /* @__PURE__ */ h("div", { style: {
    color: "rgba(255,255,255,0.82)",
    fontSize: isLandscape ? 12 : 11,
    fontWeight: 600,
    display: "flex"
  } }, hasData ? "Unlock the full breakdown" : "Be first to weigh in")));
  if (isLandscape) {
    return new ImageResponse(
      /* @__PURE__ */ h("div", { style: {
        width: "100%",
        height: "100%",
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        padding: "44px 60px",
        fontFamily: "sans-serif",
        gap: 0
      } }, /* @__PURE__ */ h("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 32 } }, /* @__PURE__ */ h("div", { style: {
        width: 32,
        height: 32,
        borderRadius: 8,
        background: "linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      } }, /* @__PURE__ */ h("span", { style: { color: "#fff", fontSize: 13, fontWeight: 900, letterSpacing: -0.5, display: "flex" } }, "WYR")), /* @__PURE__ */ h("div", { style: {
        background: t.badgeBg,
        borderRadius: 9999,
        padding: "5px 16px",
        display: "flex"
      } }, /* @__PURE__ */ h("span", { style: { color: t.textSecondary, fontSize: 12, letterSpacing: 2, fontWeight: 700 } }, "WOULD YOU RATHER")), category && /* @__PURE__ */ h("div", { style: {
        background: t.badgeBg,
        borderRadius: 9999,
        padding: "5px 14px",
        display: "flex",
        alignItems: "center",
        gap: 6
      } }, /* @__PURE__ */ h("span", { style: { fontSize: 14, display: "flex" } }, category.emoji), /* @__PURE__ */ h("span", { style: { color: t.textSecondary, fontSize: 12, display: "flex" } }, category.label))), /* @__PURE__ */ h("div", { style: { display: "flex", flex: 1, gap: 44, alignItems: "center" } }, /* @__PURE__ */ h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 14 } }, /* @__PURE__ */ h("div", { style: {
        background: t.optionBg,
        borderRadius: 14,
        border: `1.5px solid ${t.optionBorder}`,
        padding: "18px 22px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14
      } }, /* @__PURE__ */ h("div", { style: {
        background: t.labelA,
        borderRadius: 8,
        padding: "2px 10px",
        display: "flex",
        flexShrink: 0
      } }, /* @__PURE__ */ h("span", { style: { color: "#fff", fontSize: 12, fontWeight: 800 } }, "A")), /* @__PURE__ */ h("span", { style: { color: t.textPrimary, fontSize: 18, lineHeight: 1.45, display: "flex" } }, optA)), /* @__PURE__ */ h("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ h("div", { style: { flex: 1, height: 1, background: t.optionBorder } }), /* @__PURE__ */ h("span", { style: { color: t.textMuted, fontSize: 13, fontWeight: 800, display: "flex" } }, "OR"), /* @__PURE__ */ h("div", { style: { flex: 1, height: 1, background: t.optionBorder } })), /* @__PURE__ */ h("div", { style: {
        background: t.optionBg,
        borderRadius: 14,
        border: `1.5px solid ${t.optionBorder}`,
        padding: "18px 22px",
        display: "flex",
        alignItems: "flex-start",
        gap: 14
      } }, /* @__PURE__ */ h("div", { style: {
        background: t.labelB,
        borderRadius: 8,
        padding: "2px 10px",
        display: "flex",
        flexShrink: 0
      } }, /* @__PURE__ */ h("span", { style: { color: "#fff", fontSize: 12, fontWeight: 800 } }, "B")), /* @__PURE__ */ h("span", { style: { color: t.textPrimary, fontSize: 18, lineHeight: 1.45, display: "flex" } }, optB))), /* @__PURE__ */ h("div", { style: { width: 280, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" } }, VoteCta, /* @__PURE__ */ h("div", { style: {
        background: t.badgeBg,
        borderRadius: 9999,
        padding: "8px 18px",
        display: "flex"
      } }, /* @__PURE__ */ h("span", { style: { color: t.textMuted, fontSize: 12, display: "flex" } }, shareUrl))))),
      {
        width,
        height,
        headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" }
      }
    );
  }
  return new ImageResponse(
    /* @__PURE__ */ h("div", { style: {
      width: "100%",
      height: "100%",
      background: t.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "64px 36px 52px",
      fontFamily: "sans-serif"
    } }, /* @__PURE__ */ h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 48 } }, /* @__PURE__ */ h("div", { style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: "linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    } }, /* @__PURE__ */ h("span", { style: { color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: -0.5, display: "flex" } }, "WYR")), /* @__PURE__ */ h("div", { style: {
      background: t.badgeBg,
      borderRadius: 9999,
      padding: "8px 18px",
      display: "flex"
    } }, /* @__PURE__ */ h("span", { style: { color: t.textSecondary, fontSize: 12, letterSpacing: 2, fontWeight: 700 } }, "WOULD YOU RATHER")), category && /* @__PURE__ */ h("span", { style: { fontSize: 22, display: "flex" } }, category.emoji)), /* @__PURE__ */ h("div", { style: {
      flex: 1,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 18
    } }, /* @__PURE__ */ h("div", { style: {
      background: t.optionBg,
      borderRadius: 18,
      border: `1.5px solid ${t.optionBorder}`,
      padding: "22px 26px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    } }, /* @__PURE__ */ h("div", { style: {
      background: t.labelA,
      borderRadius: 8,
      padding: "3px 12px",
      alignSelf: "flex-start",
      display: "flex"
    } }, /* @__PURE__ */ h("span", { style: { color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1 } }, "OPTION A")), /* @__PURE__ */ h("span", { style: { color: t.textPrimary, fontSize: 20, fontWeight: 700, lineHeight: 1.38, display: "flex" } }, optA)), /* @__PURE__ */ h("div", { style: { display: "flex", alignItems: "center", gap: 14 } }, /* @__PURE__ */ h("div", { style: { flex: 1, height: 1, background: t.optionBorder } }), /* @__PURE__ */ h("span", { style: { color: t.textMuted, fontSize: 16, fontWeight: 800, letterSpacing: 2, display: "flex" } }, "OR"), /* @__PURE__ */ h("div", { style: { flex: 1, height: 1, background: t.optionBorder } })), /* @__PURE__ */ h("div", { style: {
      background: t.optionBg,
      borderRadius: 18,
      border: `1.5px solid ${t.optionBorder}`,
      padding: "22px 26px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    } }, /* @__PURE__ */ h("div", { style: {
      background: t.labelB,
      borderRadius: 8,
      padding: "3px 12px",
      alignSelf: "flex-start",
      display: "flex"
    } }, /* @__PURE__ */ h("span", { style: { color: "#fff", fontSize: 11, fontWeight: 800, letterSpacing: 1 } }, "OPTION B")), /* @__PURE__ */ h("span", { style: { color: t.textPrimary, fontSize: 20, fontWeight: 700, lineHeight: 1.38, display: "flex" } }, optB))), /* @__PURE__ */ h("div", { style: { width: "100%", marginTop: 28, display: "flex" } }, VoteCta), /* @__PURE__ */ h("div", { style: {
      marginTop: 22,
      background: t.badgeBg,
      borderRadius: 9999,
      padding: "10px 22px",
      display: "flex"
    } }, /* @__PURE__ */ h("span", { style: { color: t.textMuted, fontSize: 13, display: "flex" } }, shareUrl))),
    {
      width,
      height,
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" }
    }
  );
}
