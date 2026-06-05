create table if not exists public.focus_session_points (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    mode text not null check (mode in ('breathing', 'reflect', 'hard')),
    actual_ms integer not null default 0 check (actual_ms >= 0),
    planned_ms integer not null default 0 check (planned_ms >= 0),
    blocked_apps_count integer not null default 1 check (blocked_apps_count > 0),
    points integer not null default 0 check (points >= 0),
    ended_at timestamptz not null,
    created_at timestamptz not null default now()
);

alter table public.focus_session_points enable row level security;

create policy "Users can read their own focus session points"
on public.focus_session_points
for select
using (auth.uid() = user_id);

create policy "Users can create their own focus session points"
on public.focus_session_points
for insert
with check (auth.uid() = user_id);

create index if not exists focus_session_points_user_ended_at_idx
on public.focus_session_points (user_id, ended_at desc);
