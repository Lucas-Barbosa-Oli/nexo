create table public.notes (
id uuid primary key default gen_random_uuid(),
user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
kind text not null default 'note' check (kind in ('note','sheet')),
title text not null default 'Sem título' check(length(title)<=500),
content text not null default '' check(length(content)<=2000000),
folder text not null default '',
tags text[] not null default '{}',
favorite boolean not null default false,deleted_at timestamptz,
version integer not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index notes_owner on public.notes(user_id);
create table public.folders(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,path text not null check(length(path)<=500),unique(user_id,path));
alter table public.notes enable row level security;
alter table public.folders enable row level security;
revoke all on public.notes, public.folders from public, anon, authenticated;
grant select,insert,update,delete on public.notes,public.folders to authenticated;
create policy notes_select on public.notes for select to authenticated using ((select auth.uid())=user_id);
create policy notes_insert on public.notes for insert to authenticated with check ((select auth.uid())=user_id);
create policy notes_update on public.notes for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy notes_delete on public.notes for delete to authenticated using ((select auth.uid())=user_id);
create policy folders_owner on public.folders for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create function public.notes_bump_version() returns trigger language plpgsql security invoker set search_path='' as $$ begin
if new.user_id is distinct from old.user_id then raise exception 'Owner cannot change'; end if;
new.version := old.version+1; new.updated_at := now(); return new; end; $$;
create trigger notes_bump before update on public.notes for each row execute function public.notes_bump_version();
