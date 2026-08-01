// Vercel Edge Function — generates a branded PNG share card for a question.
// Routes: GET /api/card?id=<question-id>&ratio=<9x16|1.91x1>
// Returns a cached PNG image.
import { ImageResponse } from '@vercel/og';
import { QUESTIONS, CATEGORIES, THEME_FOR_CATEGORY } from './_lib/data.js';

export const config = { runtime: 'edge' };

const BRIGHT = {
  bg: 'linear-gradient(135deg, #F472B6 0%, #7C3AED 100%)',
  optionBg: 'rgba(255,255,255,0.15)',
  optionBorder: 'rgba(255,255,255,0.28)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.78)',
  textMuted: 'rgba(255,255,255,0.5)',
  badgeBg: 'rgba(255,255,255,0.18)',
  labelA: '#EC4899',
  labelB: '#7C3AED',
  blurBg: 'rgba(0,0,0,0.28)',
  blurOverlay: 'rgba(100,30,120,0.86)',
};

const MOODY = {
  bg: 'linear-gradient(135deg, #0D0D1A 0%, #1C0D30 100%)',
  optionBg: 'rgba(255,255,255,0.06)',
  optionBorder: 'rgba(255,255,255,0.11)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textMuted: 'rgba(255,255,255,0.4)',
  badgeBg: 'rgba(255,255,255,0.07)',
  labelA: '#C9A84C',
  labelB: '#7B2FBE',
  blurBg: 'rgba(200,168,76,0.08)',
  blurOverlay: 'rgba(8,6,18,0.90)',
};

function truncate(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export default function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const ratio = url.searchParams.get('ratio') || '9x16';

  const question = QUESTIONS.find(q => q.id === id);
  if (!question) {
    return new Response('Question not found', { status: 404 });
  }

  const category = CATEGORIES.find(c => c.id === question.category);
  const themeName = THEME_FOR_CATEGORY[question.category] || 'bright';
  const t = themeName === 'moody' ? MOODY : BRIGHT;

  const totalVotes = question.votesA + question.votesB;
  const hasData = totalVotes >= 5;
  const pctA = totalVotes > 0 ? Math.round((question.votesA / totalVotes) * 100) : 0;
  const pctB = 100 - pctA;
  const majorityPct = Math.max(pctA, pctB);
  const majorityOption = pctA >= pctB ? 'A' : 'B';
  const consensusText = `${majorityPct}% chose Option ${majorityOption}`;

  const baseUrl = new URL(req.url).origin;
  const shareUrl = `${baseUrl}/p/${id}`;

  const isLandscape = ratio === '1.91x1';
  const width = isLandscape ? 1200 : 1080;
  const height = isLandscape ? 628 : 1920;

  const optA = truncate(question.optionA, isLandscape ? 90 : 160);
  const optB = truncate(question.optionB, isLandscape ? 90 : 160);

  // ── Blurred consensus strip (shared by both layouts) ──────────────────────
  // Satori doesn't support CSS filter:blur, so we simulate frosted glass by:
  //   1. showing the consensus text at near-invisible opacity (the "ghost")
  //   2. overlaying a semi-opaque panel with a 🔒 CTA
  const BlurStrip = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: isLandscape ? 64 : 120,
        borderRadius: isLandscape ? 14 : 24,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: t.blurBg,
      }}
    >
      {/* Ghost text — visible but illegible */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.11)',
        fontSize: isLandscape ? 22 : 36,
        fontWeight: 800,
        letterSpacing: 10,
      }}>
        {consensusText}
      </div>

      {/* Frosted overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: t.blurOverlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        borderRadius: isLandscape ? 14 : 24,
      }}>
        <div style={{ fontSize: isLandscape ? 18 : 30, display: 'flex' }}>🔒</div>
        <div style={{
          color: t.textSecondary,
          fontSize: isLandscape ? 15 : 26,
          fontWeight: 600,
          display: 'flex',
        }}>
          Tap the link to see results
        </div>
      </div>
    </div>
  );

  const PlaceholderStrip = (
    <div style={{
      width: '100%',
      height: isLandscape ? 64 : 120,
      borderRadius: isLandscape ? 14 : 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.optionBg,
      border: `1.5px solid ${t.optionBorder}`,
    }}>
      <div style={{ color: t.textSecondary, fontSize: isLandscape ? 16 : 28, fontWeight: 600, display: 'flex' }}>
        See what others chose →
      </div>
    </div>
  );

  const ResultStrip = hasData ? BlurStrip : PlaceholderStrip;

  if (isLandscape) {
    // ── 1200×628 OG / link-preview card ────────────────────────────────────
    return new ImageResponse(
      <div style={{
        width: '100%',
        height: '100%',
        background: t.bg,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 60px',
        fontFamily: 'sans-serif',
        gap: 0,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            background: t.badgeBg,
            borderRadius: 9999,
            padding: '5px 16px',
            display: 'flex',
          }}>
            <span style={{ color: t.textSecondary, fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
              WOULD YOU RATHER
            </span>
          </div>
          {category && (
            <div style={{
              background: t.badgeBg,
              borderRadius: 9999,
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ fontSize: 14, display: 'flex' }}>{category.emoji}</span>
              <span style={{ color: t.textSecondary, fontSize: 12, display: 'flex' }}>{category.label}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, gap: 44, alignItems: 'center' }}>
          {/* Left: options */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Option A */}
            <div style={{
              background: t.optionBg,
              borderRadius: 14,
              border: `1.5px solid ${t.optionBorder}`,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{
                background: t.labelA,
                borderRadius: 8,
                padding: '2px 10px',
                display: 'flex',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>A</span>
              </div>
              <span style={{ color: t.textPrimary, fontSize: 16, lineHeight: 1.45, display: 'flex' }}>
                {optA}
              </span>
            </div>

            {/* OR divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, height: 1, background: t.optionBorder }} />
              <span style={{ color: t.textMuted, fontSize: 13, fontWeight: 800, display: 'flex' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: t.optionBorder }} />
            </div>

            {/* Option B */}
            <div style={{
              background: t.optionBg,
              borderRadius: 14,
              border: `1.5px solid ${t.optionBorder}`,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{
                background: t.labelB,
                borderRadius: 8,
                padding: '2px 10px',
                display: 'flex',
                flexShrink: 0,
              }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>B</span>
              </div>
              <span style={{ color: t.textPrimary, fontSize: 16, lineHeight: 1.45, display: 'flex' }}>
                {optB}
              </span>
            </div>
          </div>

          {/* Right: result + link */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
            {ResultStrip}
            <div style={{
              background: t.badgeBg,
              borderRadius: 9999,
              padding: '8px 18px',
              display: 'flex',
            }}>
              <span style={{ color: t.textMuted, fontSize: 12, display: 'flex' }}>{shareUrl}</span>
            </div>
          </div>
        </div>
      </div>,
      { width, height }
    );
  }

  // ── 1080×1920 Stories / TikTok card ───────────────────────────────────────
  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      background: t.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '120px 72px 100px',
      fontFamily: 'sans-serif',
    }}>
      {/* Top branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 80 }}>
        <div style={{
          background: t.badgeBg,
          borderRadius: 9999,
          padding: '14px 32px',
          display: 'flex',
        }}>
          <span style={{ color: t.textSecondary, fontSize: 22, letterSpacing: 3, fontWeight: 700 }}>
            WOULD YOU RATHER
          </span>
        </div>
        {category && (
          <span style={{ fontSize: 40, display: 'flex' }}>{category.emoji}</span>
        )}
      </div>

      {/* Options */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 32,
      }}>
        {/* Option A */}
        <div style={{
          background: t.optionBg,
          borderRadius: 28,
          border: `2px solid ${t.optionBorder}`,
          padding: '40px 44px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div style={{
            background: t.labelA,
            borderRadius: 12,
            padding: '6px 20px',
            alignSelf: 'flex-start',
            display: 'flex',
          }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: 1.5 }}>OPTION A</span>
          </div>
          <span style={{ color: t.textPrimary, fontSize: 36, fontWeight: 700, lineHeight: 1.38, display: 'flex' }}>
            {optA}
          </span>
        </div>

        {/* OR divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1, height: 2, background: t.optionBorder }} />
          <span style={{ color: t.textMuted, fontSize: 28, fontWeight: 800, letterSpacing: 3, display: 'flex' }}>OR</span>
          <div style={{ flex: 1, height: 2, background: t.optionBorder }} />
        </div>

        {/* Option B */}
        <div style={{
          background: t.optionBg,
          borderRadius: 28,
          border: `2px solid ${t.optionBorder}`,
          padding: '40px 44px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}>
          <div style={{
            background: t.labelB,
            borderRadius: 12,
            padding: '6px 20px',
            alignSelf: 'flex-start',
            display: 'flex',
          }}>
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: 1.5 }}>OPTION B</span>
          </div>
          <span style={{ color: t.textPrimary, fontSize: 36, fontWeight: 700, lineHeight: 1.38, display: 'flex' }}>
            {optB}
          </span>
        </div>
      </div>

      {/* Result strip */}
      <div style={{ width: '100%', marginTop: 48 }}>
        {ResultStrip}
      </div>

      {/* Link */}
      <div style={{
        marginTop: 36,
        background: t.badgeBg,
        borderRadius: 9999,
        padding: '16px 36px',
        display: 'flex',
      }}>
        <span style={{ color: t.textMuted, fontSize: 24, display: 'flex' }}>{shareUrl}</span>
      </div>
    </div>,
    { width, height }
  );
}
