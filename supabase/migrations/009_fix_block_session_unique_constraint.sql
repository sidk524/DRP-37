-- Migration 008 created a partial unique index (WHERE block_session_id IS NOT NULL)
-- which PostgREST cannot target with ON CONFLICT (block_session_id) — PostgreSQL
-- requires the WHERE clause to be spelled out for partial indexes.  Replace it with
-- a full unique constraint instead.  PostgreSQL allows multiple NULLs in a unique
-- constraint (NULL != NULL), so existing rows with block_session_id = NULL are fine.
drop index if exists focus_session_points_block_session_idx;

alter table public.focus_session_points
    add constraint focus_session_points_block_session_id_key unique (block_session_id);
