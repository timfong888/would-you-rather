// The votes table (issue #65). Single source for the "create it on first use"
// path in votes.js. db/migrations/001_votes.sql holds the same statement with
// comments, for people and for `npm run db:migrate`; tests/unit keeps the two
// identical. Idempotent: safe to run any number of times.
export const MIGRATION_STATEMENTS = [
  `create table if not exists votes (
  id          bigint generated always as identity primary key,
  question_id text        not null,
  choice      char(1)     not null check (choice in ('A', 'B')),
  voter_key   text        not null,
  player_id   uuid,
  kids        boolean     not null default false,
  country     char(2),
  region      text        check (region is null or char_length(region) <= 3),
  created_at  timestamptz not null default now(),
  constraint votes_one_per_voter unique (question_id, voter_key),
  constraint votes_kids_anonymous check (not kids or player_id is null)
)`,
];
