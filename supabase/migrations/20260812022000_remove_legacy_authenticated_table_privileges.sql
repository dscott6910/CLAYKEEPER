-- Remove legacy non-CRUD table privileges from authenticated users.
--
-- Authenticated application sessions do not need TRUNCATE, REFERENCES,
-- or TRIGGER privileges on public application tables.
--
-- Normal SELECT / INSERT / UPDATE / DELETE privileges remain unchanged,
-- and row-level security continues to enforce application authorization.
--
-- This cleanup applies to every current table in the public schema so that
-- legacy tables have the same privilege shape as newer application tables.

do $$
declare
  v_table record;
begin
  for v_table in
    select tablename
    from pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute format(
      'revoke truncate, references, trigger on table public.%I from authenticated',
      v_table.tablename
    );
  end loop;
end
$$;
