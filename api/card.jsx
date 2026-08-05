// Vercel Edge Function — generates a branded PNG share card for a question.
// Routes: GET /api/card?id=<question-id>&ratio=<9x16|1.91x1>[&voted=<A|B>]
// Returns a cached PNG image.
import React from 'react';
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
  // voted=A|B — when present, renders the "Share my take" card variant
  const voted = url.searchParams.get('voted');

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

  // "Share my take" mode — user's choice is known, show their position
  const isMyTakeMode = voted === 'A' || voted === 'B';
  const myPct = isMyTakeMode ? (voted === 'A' ? pctA : pctB) : 0;
  const myText = isMyTakeMode ? (voted === 'A' ? question.optionA : question.optionB) : '';
  const isMajority = isMyTakeMode && (voted === majorityOption);
  const positionLabel = hasData
    ? (isMajority ? `I'm with the ${myPct}% majority` : `I'm in the ${myPct}% minority`)
    : 'I made my choice — where do you stand?';
  const myTakeCta = 'Do you agree? →';

  const baseUrl = new URL(req.url).origin;
  const shareUrl = `${baseUrl}/p/${id}`;

  const isLandscape = ratio === '1.91x1';
  const width = isLandscape ? 1200 : 540;
  const height = isLandscape ? 628 : 960;

  const optA = truncate(question.optionA, isLandscape ? 90 : 130);
  const optB = truncate(question.optionB, isLandscape ? 90 : 130);

  // ── Blurred consensus strip (shared by both layouts) ──────────────────────
  // Satori doesn't support CSS filter:blur, so we simulate frosted glass by:
  //   1. showing the consensus text at near-invisible opacity (the "ghost")
  //   2. overlaying a semi-opaque panel with a 🔒 CTA
  const BlurStrip = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: isLandscape ? 64 : 72,
        borderRadius: 14,
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
        fontSize: isLandscape ? 22 : 20,
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
        gap: 10,
        borderRadius: 14,
      }}>
        <div style={{ fontSize: isLandscape ? 18 : 16, display: 'flex' }}>🔒</div>
        <div style={{
          color: t.textSecondary,
          fontSize: isLandscape ? 15 : 14,
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
      height: isLandscape ? 64 : 72,
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.optionBg,
      border: `1.5px solid ${t.optionBorder}`,
    }}>
      <div style={{ color: t.textSecondary, fontSize: 16, fontWeight: 600, display: 'flex' }}>
        See what others chose →
      </div>
    </div>
  );

  // "Share my take" strip — shows the user's position without blur
  const MyTakeStrip = (
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      {/* Position badge */}
      <div style={{
        width: '100%',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: isLandscape ? '12px 18px' : '14px 18px',
        background: isMajority ? 'rgba(45,158,107,0.20)' : 'rgba(214,51,132,0.18)',
        border: `1.5px solid ${isMajority ? 'rgba(45,158,107,0.55)' : 'rgba(214,51,132,0.55)'}`,
      }}>
        <div style={{ fontSize: isLandscape ? 18 : 16, display: 'flex' }}>
          {isMajority ? '🎯' : '🔥'}
        </div>
        <div style={{
          color: t.textPrimary,
          fontSize: isLandscape ? 14 : 13,
          fontWeight: 700,
          display: 'flex',
          textAlign: 'center',
        }}>
          {positionLabel}
        </div>
      </div>
      {/* CTA */}
      <div style={{
        width: '100%',
        borderRadius: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isLandscape ? '10px 18px' : '12px 18px',
        background: t.blurOverlay,
      }}>
        <div style={{
          color: t.textSecondary,
          fontSize: isLandscape ? 14 : 13,
          fontWeight: 600,
          display: 'flex',
        }}>
          {myTakeCta}
        </div>
      </div>
    </div>
  );

  const ResultStrip = isMyTakeMode ? MyTakeStrip : (hasData ? BlurStrip : PlaceholderStrip);

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
          {/* App logo mark */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: -0.5, display: 'flex' }}>WYR</span>
          </div>
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
              background: isMyTakeMode && voted === 'A' ? `${t.labelA}22` : t.optionBg,
              borderRadius: 14,
              border: isMyTakeMode && voted === 'A' ? `2px solid ${t.labelA}` : `1.5px solid ${t.optionBorder}`,
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
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>
                  {isMyTakeMode && voted === 'A' ? '✓' : 'A'}
                </span>
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
              background: isMyTakeMode && voted === 'B' ? `${t.labelB}22` : t.optionBg,
              borderRadius: 14,
              border: isMyTakeMode && voted === 'B' ? `2px solid ${t.labelB}` : `1.5px solid ${t.optionBorder}`,
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
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>
                  {isMyTakeMode && voted === 'B' ? '✓' : 'B'}
                </span>
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

  // ── 540×960 Stories / TikTok card ─────────────────────────────────────────
  return new ImageResponse(
    <div style={{
      width: '100%',
      height: '100%',
      background: t.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 36px 52px',
      fontFamily: 'sans-serif',
    }}>
      {/* Top branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
        {/* App logo mark */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 900, letterSpacing: -0.5, display: 'flex' }}>WYR</span>
        </div>
        <div style={{
          background: t.badgeBg,
          borderRadius: 9999,
          padding: '8px 18px',
          display: 'flex',
        }}>
          <span style={{ color: t.textSecondary, fontSize: 12, letterSpacing: 2, fontWeight: 700 }}>
            WOULD YOU RATHER
          </span>
        </div>
        {category && (
          <span style={{ fontSize: 22, display: 'flex' }}>{category.emoji}</span>
        )}
      </div>

      {/* Options */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 18,
      }}>
        {/* Option A */}
        <div style={{
          background: isMyTakeMode && voted === 'A' ? `${t.labelA}22` : t.optionBg,
          borderRadius: 18,
          border: isMyTakeMode && voted === 'A' ? `2px solid ${t.labelA}` : `1.5px solid ${t.optionBorder}`,
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{
            background: t.labelA,
            borderRadius: 8,
            padding: '3px 12px',
            alignSelf: 'flex-start',
            display: 'flex',
          }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
              {isMyTakeMode && voted === 'A' ? 'MY CHOICE' : 'OPTION A'}
            </span>
          </div>
          <span style={{ color: t.textPrimary, fontSize: 20, fontWeight: 700, lineHeight: 1.38, display: 'flex' }}>
            {optA}
          </span>
        </div>

        {/* OR divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ flex: 1, height: 1, background: t.optionBorder }} />
          <span style={{ color: t.textMuted, fontSize: 16, fontWeight: 800, letterSpacing: 2, display: 'flex' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: t.optionBorder }} />
        </div>

        {/* Option B */}
        <div style={{
          background: isMyTakeMode && voted === 'B' ? `${t.labelB}22` : t.optionBg,
          borderRadius: 18,
          border: isMyTakeMode && voted === 'B' ? `2px solid ${t.labelB}` : `1.5px solid ${t.optionBorder}`,
          padding: '22px 26px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{
            background: t.labelB,
            borderRadius: 8,
            padding: '3px 12px',
            alignSelf: 'flex-start',
            display: 'flex',
          }}>
            <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>
              {isMyTakeMode && voted === 'B' ? 'MY CHOICE' : 'OPTION B'}
            </span>
          </div>
          <span style={{ color: t.textPrimary, fontSize: 20, fontWeight: 700, lineHeight: 1.38, display: 'flex' }}>
            {optB}
          </span>
        </div>
      </div>

      {/* Result strip */}
      <div style={{ width: '100%', marginTop: 28 }}>
        {ResultStrip}
      </div>

      {/* Link */}
      <div style={{
        marginTop: 22,
        background: t.badgeBg,
        borderRadius: 9999,
        padding: '10px 22px',
        display: 'flex',
      }}>
        <span style={{ color: t.textMuted, fontSize: 13, display: 'flex' }}>{shareUrl}</span>
      </div>
    </div>,
    { width, height }
  );
}
