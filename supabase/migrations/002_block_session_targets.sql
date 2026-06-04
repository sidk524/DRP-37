alter table public.block_sessions
add column if not exists canonical_targets text[] not null default '{}',
add column if not exists domains_blocked text[] not null default '{}',
add column if not exists process_tokens text[] not null default '{}';

create index if not exists block_sessions_canonical_targets_idx
on public.block_sessions using gin (canonical_targets);

create index if not exists block_sessions_domains_blocked_idx
on public.block_sessions using gin (domains_blocked);
