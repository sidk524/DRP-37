-- Adds the friction `mode` to block sessions so it can be synced across devices,
-- plus an `updated_at` column that the real-time sync hub uses as a revision clock.
alter table public.block_sessions
    add column if not exists mode text not null default 'reflect'
        check (mode in ('breathing', 'reflect', 'hard')),
    add column if not exists updated_at timestamptz not null default now();
