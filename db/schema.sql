-- Rebusløpet – databaseskjema. Trygt å kjøre flere ganger.

create table if not exists settings (
  key text primary key,
  value text not null default ''
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique,
  costume_theme text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  gps_tested_at timestamptz,
  last_checkin_attempt_at timestamptz
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists players_team_name on players (team_id, lower(name));

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  title text not null,
  clue_text text not null default '',
  cipher_type text not null default 'none',
  cipher_key text not null default '',
  key_hint text not null default '',
  task_text text not null default '',
  lat double precision,
  lng double precision,
  radius_m int not null default 75,
  proof_type text not null default 'photo',
  emergency_text text not null default '',
  emergency_penalty_min int not null default 15,
  active boolean not null default true,
  is_finale boolean not null default false,
  admin_note text not null default ''
);

create table if not exists progress (
  team_id uuid not null references teams(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  status text not null default 'clue', -- clue | arrived | done
  clue_at timestamptz not null default now(),
  arrived_at timestamptz,
  done_at timestamptz,
  emergency_opened_at timestamptz,
  manual_unlock boolean not null default false,
  answer_text text not null default '',
  primary key (team_id, post_id)
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  mime text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);
create index if not exists photos_team_post on photos (team_id, post_id);

create table if not exists adjustments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  minutes int not null, -- positiv = straff, negativ = bonus
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists positions (
  id bigint generated always as identity primary key,
  team_id uuid not null references teams(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  accuracy double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists positions_team_time on positions (team_id, created_at desc);

-- Supabase eksponerer public-skjemaet via et automatisk REST-API. Med RLS på og ingen
-- policies er tabellene stengt der; appen kobler til direkte som eier og påvirkes ikke.
alter table settings enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table posts enable row level security;
alter table progress enable row level security;
alter table photos enable row level security;
alter table adjustments enable row level security;
alter table positions enable row level security;
