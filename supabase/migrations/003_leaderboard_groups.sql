create table if not exists public.leaderboard_groups (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(trim(name)) > 0),
    invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
    created_by uuid not null references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create table if not exists public.group_members (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references public.leaderboard_groups(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    joined_at timestamptz not null default now(),
    unique (group_id, user_id)
);

create index if not exists group_members_user_id_idx
on public.group_members (user_id);

create index if not exists group_members_group_id_idx
on public.group_members (group_id);

alter table public.leaderboard_groups enable row level security;
alter table public.group_members enable row level security;

create policy "Users can create their own leaderboard groups"
on public.leaderboard_groups
for insert
with check (auth.uid() = created_by);

create policy "Users can read groups they belong to"
on public.leaderboard_groups
for select
using (
    exists (
        select 1
        from public.group_members
        where group_members.group_id = leaderboard_groups.id
        and group_members.user_id = auth.uid()
    )
);

create policy "Users can create their own group memberships"
on public.group_members
for insert
with check (auth.uid() = user_id);

create policy "Users can read their own group memberships"
on public.group_members
for select
using (auth.uid() = user_id);
