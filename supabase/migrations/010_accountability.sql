create table if not exists public.accountability_preferences (
    user_id uuid primary key references auth.users(id) on delete cascade,
    share_activity boolean not null default true,
    receive_friend_alerts boolean not null default true,
    updated_at timestamptz not null default now()
);

create table if not exists public.accountability_attempts (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid not null references auth.users(id) on delete cascade,
    block_session_id uuid not null references public.block_sessions(id) on delete cascade,
    target_type text not null check (target_type in ('app', 'domain')),
    target_key text not null,
    target_label text not null check (char_length(target_label) between 1 and 120),
    mode text not null check (mode in ('breathing', 'reflect', 'hard')),
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
    created_at timestamptz not null default now(),
    unique (actor_user_id, idempotency_key)
);

create table if not exists public.accountability_attempt_groups (
    attempt_id uuid not null references public.accountability_attempts(id) on delete cascade,
    group_id uuid not null references public.leaderboard_groups(id) on delete cascade,
    group_name text not null,
    primary key (attempt_id, group_id)
);

create table if not exists public.accountability_notifications (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null references public.accountability_attempts(id) on delete cascade,
    recipient_user_id uuid not null references auth.users(id) on delete cascade,
    shared_groups jsonb not null default '[]'::jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now(),
    unique (attempt_id, recipient_user_id)
);

create table if not exists public.accountability_messages (
    id uuid primary key default gen_random_uuid(),
    attempt_id uuid not null references public.accountability_attempts(id) on delete cascade,
    sender_user_id uuid not null references auth.users(id) on delete cascade,
    recipient_user_id uuid not null references auth.users(id) on delete cascade,
    preset_key text check (preset_key is null or preset_key in ('lock_in', 'stay_focused', 'youve_got_this')),
    body text not null check (char_length(body) between 1 and 280),
    read_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists accountability_notifications_recipient_idx on public.accountability_notifications (recipient_user_id, created_at desc);
create index if not exists accountability_messages_recipient_idx on public.accountability_messages (recipient_user_id, created_at desc);
create index if not exists accountability_attempt_groups_group_idx on public.accountability_attempt_groups (group_id);

alter table public.accountability_preferences enable row level security;
alter table public.accountability_attempts enable row level security;
alter table public.accountability_attempt_groups enable row level security;
alter table public.accountability_notifications enable row level security;
alter table public.accountability_messages enable row level security;
