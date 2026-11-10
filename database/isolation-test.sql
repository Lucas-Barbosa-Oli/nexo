-- Run as a database administrator. All fixtures are rolled back.
begin;
select set_config('nexo.test_a', gen_random_uuid()::text, true),
       set_config('nexo.test_b', gen_random_uuid()::text, true),
       set_config('nexo.note_a', gen_random_uuid()::text, true),
       set_config('nexo.note_b', gen_random_uuid()::text, true),
       set_config('nexo.folder_a', gen_random_uuid()::text, true),
       set_config('nexo.folder_b', gen_random_uuid()::text, true);

insert into auth.users(id) values
  (current_setting('nexo.test_a')::uuid), (current_setting('nexo.test_b')::uuid);
set local role authenticated;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('nexo.test_a'), 'role', 'authenticated')::text, true);
insert into public.notes(id, title, content)
values (current_setting('nexo.note_a')::uuid, 'Nota de A', 'Fixture transacional');
insert into public.folders(id, path)
values (current_setting('nexo.folder_a')::uuid, 'Mesmo nome');

select set_config('request.jwt.claims', json_build_object('sub', current_setting('nexo.test_b'), 'role', 'authenticated')::text, true);
insert into public.notes(id, kind, title)
values (current_setting('nexo.note_b')::uuid, 'sheet', 'Planilha de B');
insert into public.folders(id, path)
values (current_setting('nexo.folder_b')::uuid, 'Mesmo nome');

do $$
begin
  if (select count(*) from public.notes) <> 1
     or not exists (select 1 from public.notes where id = current_setting('nexo.note_b')::uuid and kind = 'sheet')
     or (select count(*) from public.folders) <> 1
     or not exists (select 1 from public.folders where id = current_setting('nexo.folder_b')::uuid) then
    raise exception 'B não consegue ler seus dados ou enxerga dados de outro usuário';
  end if;

  update public.notes set content = 'Intrusão' where id = current_setting('nexo.note_a')::uuid;
  if found then raise exception 'B alterou a nota de A'; end if;
  delete from public.notes where id = current_setting('nexo.note_a')::uuid;
  if found then raise exception 'B excluiu a nota de A'; end if;
  update public.folders set path = 'Intrusão' where id = current_setting('nexo.folder_a')::uuid;
  if found then raise exception 'B alterou a pasta de A'; end if;
  delete from public.folders where id = current_setting('nexo.folder_a')::uuid;
  if found then raise exception 'B excluiu a pasta de A'; end if;

  begin
    insert into public.notes(user_id, title) values (current_setting('nexo.test_a')::uuid, 'Intrusão');
    raise exception 'B criou uma nota em nome de A';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.folders(user_id, path) values (current_setting('nexo.test_a')::uuid, 'Intrusão');
    raise exception 'B criou uma pasta em nome de A';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.folders set user_id = current_setting('nexo.test_a')::uuid, path = 'Intrusão'
    where id = current_setting('nexo.folder_b')::uuid;
    raise exception 'B conseguiu transferir uma pasta para A';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('nexo.test_a'), 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from public.notes) <> 1
     or not exists (select 1 from public.notes where id = current_setting('nexo.note_a')::uuid)
     or (select count(*) from public.folders) <> 1
     or not exists (select 1 from public.folders where id = current_setting('nexo.folder_a')::uuid) then
    raise exception 'A não consegue ler seus dados ou enxerga dados de outro usuário';
  end if;

  update public.notes set content = 'Versão 2' where id = current_setting('nexo.note_a')::uuid and version = 1;
  if not found or not exists (select 1 from public.notes where id = current_setting('nexo.note_a')::uuid and version = 2) then
    raise exception 'A não conseguiu editar sua nota e avançar a versão';
  end if;

  update public.notes set content = 'Versão antiga' where id = current_setting('nexo.note_a')::uuid and version = 1;
  if found then raise exception 'Uma edição desatualizada foi aceita'; end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.notes;
    raise exception 'Acesso anônimo a notas foi aceito';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.folders;
    raise exception 'Acesso anônimo a pastas foi aceito';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  if has_table_privilege('authenticated', 'public.notes', 'truncate, references, trigger, maintain')
     or has_table_privilege('authenticated', 'public.folders', 'truncate, references, trigger, maintain') then
    raise exception 'O papel authenticated tem privilégios além dos necessários';
  end if;
end $$;
select true as isolation_checks_passed;
rollback;
