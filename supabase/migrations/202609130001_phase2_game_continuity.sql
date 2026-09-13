-- Phase 2 continuity fields for the active batting slot and plate appearance.
-- Apply this migration to a non-production Supabase project before deploying
-- the matching develop-branch application code.

alter table public.live_games
  add column if not exists away_current_batter_slot smallint not null default 1,
  add column if not exists home_current_batter_slot smallint not null default 1,
  add column if not exists away_pitch_sequence jsonb not null default '[]'::jsonb,
  add column if not exists home_pitch_sequence jsonb not null default '[]'::jsonb,
  add column if not exists away_pa_start_pitch_count integer,
  add column if not exists home_pa_start_pitch_count integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_games_away_current_batter_slot_check'
      and conrelid = 'public.live_games'::regclass
  ) then
    alter table public.live_games
      add constraint live_games_away_current_batter_slot_check
      check (away_current_batter_slot between 1 and 12);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_games_home_current_batter_slot_check'
      and conrelid = 'public.live_games'::regclass
  ) then
    alter table public.live_games
      add constraint live_games_home_current_batter_slot_check
      check (home_current_batter_slot between 1 and 12);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_games_away_pitch_sequence_check'
      and conrelid = 'public.live_games'::regclass
  ) then
    alter table public.live_games
      add constraint live_games_away_pitch_sequence_check
      check (jsonb_typeof(away_pitch_sequence) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_games_home_pitch_sequence_check'
      and conrelid = 'public.live_games'::regclass
  ) then
    alter table public.live_games
      add constraint live_games_home_pitch_sequence_check
      check (jsonb_typeof(home_pitch_sequence) = 'array');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_games_away_pa_start_pitch_count_check'
      and conrelid = 'public.live_games'::regclass
  ) then
    alter table public.live_games
      add constraint live_games_away_pa_start_pitch_count_check
      check (
        away_pa_start_pitch_count is null or
        away_pa_start_pitch_count >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'live_games_home_pa_start_pitch_count_check'
      and conrelid = 'public.live_games'::regclass
  ) then
    alter table public.live_games
      add constraint live_games_home_pa_start_pitch_count_check
      check (
        home_pa_start_pitch_count is null or
        home_pa_start_pitch_count >= 0
      );
  end if;
end
$$;

comment on column public.live_games.away_current_batter_slot is
  'Persisted batting-order slot for the away team current batter.';
comment on column public.live_games.home_current_batter_slot is
  'Persisted batting-order slot for the home team current batter.';
comment on column public.live_games.away_pitch_sequence is
  'Ordered pitch symbols for the away team active plate appearance.';
comment on column public.live_games.home_pitch_sequence is
  'Ordered pitch symbols for the home team active plate appearance.';
comment on column public.live_games.away_pa_start_pitch_count is
  'Pitcher total when the away team active plate appearance began.';
comment on column public.live_games.home_pa_start_pitch_count is
  'Pitcher total when the home team active plate appearance began.';
