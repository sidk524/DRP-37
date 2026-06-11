create table if not exists public.block_groups (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(trim(name)) > 0 and char_length(name) <= 80),
    system_key text check (system_key in ('social_media', 'messaging', 'streaming')),
    targets text[] not null default '{}',
    apps_blocked text[] not null default '{}',
    domains_blocked text[] not null default '{}',
    canonical_targets text[] not null default '{}',
    expanded_apps_blocked text[] not null default '{}',
    expanded_domains_blocked text[] not null default '{}',
    process_tokens text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        cardinality(expanded_apps_blocked) > 0
        or cardinality(expanded_domains_blocked) > 0
        or cardinality(process_tokens) > 0
    )
);

create unique index if not exists block_groups_user_system_key_idx
on public.block_groups (user_id, system_key)
where system_key is not null;

create index if not exists block_groups_user_id_idx
on public.block_groups (user_id);

alter table public.block_sessions
add column if not exists block_group_id uuid references public.block_groups(id) on delete set null;

alter table public.block_groups enable row level security;

create policy "Users can read their own block groups"
on public.block_groups
for select
using (auth.uid() = user_id);

create policy "Users can create their own block groups"
on public.block_groups
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own block groups"
on public.block_groups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own custom block groups"
on public.block_groups
for delete
using (auth.uid() = user_id and system_key is null);
