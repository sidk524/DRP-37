create table if not exists public.block_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    apps_blocked text[] not null default '{}',
    total_duration_seconds integer not null check (total_duration_seconds > 0),
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.block_sessions enable row level security;

create policy "Users can read their own block sessions"
on public.block_sessions
for select
using (auth.uid() = user_id);

create policy "Users can create their own block sessions"
on public.block_sessions
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own block sessions"
on public.block_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists block_sessions_user_started_at_idx
on public.block_sessions (user_id, started_at desc);

create index if not exists block_sessions_active_user_idx
on public.block_sessions (user_id)
where ended_at is null;

create unique index if not exists block_sessions_one_active_per_user_idx
on public.block_sessions (user_id)
where ended_at is null;
