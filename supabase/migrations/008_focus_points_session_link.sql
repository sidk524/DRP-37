-- Link each focus_session_points row to the block session it was earned in, so
-- the server can award points exactly once per session (idempotent) even when
-- multiple devices report the same session ending.
alter table public.focus_session_points
    add column if not exists block_session_id uuid references public.block_sessions(id) on delete set null;

create unique index if not exists focus_session_points_block_session_idx
    on public.focus_session_points (block_session_id)
    where block_session_id is not null;
