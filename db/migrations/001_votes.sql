-- Real vote storage (issue #65). Neon Postgres. Idempotent: safe to run twice.
--
-- One row per counted vote, kept as raw rows (not counters) so votes can be
-- sliced by question, time and coarse region later. There is no IP column.

create table if not exists votes (
  id          bigint generated always as identity primary key,
  question_id text        not null,
  choice      char(1)     not null check (choice in ('A', 'B')),
  -- One vote per voter per question. Not kids: the anonymous visitor UUID.
  -- Kids: an HMAC of visitor UUID + question id, so two kids' votes cannot be
  -- joined to one device (see docs/specs/would-you-rather-mvp-spec.md 3.4).
  voter_key   text        not null,
  -- Anonymous per-device ID, queryable per player. Always NULL for kids' votes.
  player_id   uuid,
  kids        boolean     not null default false,
  country     char(2),
  region      text        check (region is null or char_length(region) <= 3),
  created_at  timestamptz not null default now(),
  constraint votes_one_per_voter unique (question_id, voter_key),
  constraint votes_kids_anonymous check (not kids or player_id is null)
);
