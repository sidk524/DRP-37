alter table public.leaderboard_groups
alter column created_by drop not null;

alter table public.leaderboard_groups
add column if not exists default_group_key text;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'leaderboard_groups_default_group_key_check'
    ) then
        alter table public.leaderboard_groups
        add constraint leaderboard_groups_default_group_key_check
        check (
            default_group_key is null
            or default_group_key in ('late_night', 'first_thing_morning', 'meals', 'work_hours')
        );
    end if;
end $$;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'leaderboard_groups_default_group_key_key'
    ) then
        alter table public.leaderboard_groups
        add constraint leaderboard_groups_default_group_key_key
        unique (default_group_key);
    end if;
end $$;

insert into public.leaderboard_groups (name, invite_code, created_by, default_group_key)
values
    ('Late night', 'LATENITE', null, 'late_night'),
    ('First thing morning', 'MORNING1', null, 'first_thing_morning'),
    ('Meals', 'MEALS000', null, 'meals'),
    ('Work hours', 'WORKHOUR', null, 'work_hours')
on conflict (default_group_key) do update
set name = excluded.name,
    invite_code = excluded.invite_code;

do $$
begin
    if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
        and tablename = 'group_members'
        and policyname = 'Users can delete their own group memberships'
    ) then
        create policy "Users can delete their own group memberships"
        on public.group_members
        for delete
        using (auth.uid() = user_id);
    end if;
end $$;
