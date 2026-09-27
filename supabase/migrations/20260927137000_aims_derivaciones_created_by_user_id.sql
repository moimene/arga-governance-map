-- Orquestador (27-09-2026), tras aplicar F2 (MOI-170, enmienda E-01).
--
-- En AIMS, desde 20260927131000, `created_by` es PERSONA (FK a persons, E-01).
-- La tabla de derivaciones AIMS→Secretaría de MOI-56 (20260927105600) usaba
-- `created_by DEFAULT auth.uid()`, es decir, un USUARIO de Auth con el mismo
-- nombre. No es una FK a persons, pero mezclar usuario y persona bajo el mismo
-- nombre en el mismo módulo es la confusión que E-01 prohíbe (y la prueba
-- estática E-01, que trabaja por nombre de columna, lo detecta). Se renombra a
-- `created_by_user_id`, que dice lo que guarda. La tabla está vacía (medido: 0
-- filas) y ningún código la escribe explícitamente (se rellena por DEFAULT).

do $renombre$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'aims_secretaria_derivations' and column_name = 'created_by'
  ) then
    alter table public.aims_secretaria_derivations rename column created_by to created_by_user_id;
  end if;
end
$renombre$;

do $verificacion$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'aims_secretaria_derivations' and column_name = 'created_by'
  ) then
    raise exception 'VERIFICACION: la columna created_by sigue existiendo';
  end if;
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'aims_secretaria_derivations'
       and column_name = 'created_by_user_id' and column_default like '%auth.uid()%'
  ) then
    raise exception 'VERIFICACION: created_by_user_id no existe o perdió su DEFAULT auth.uid()';
  end if;
  raise notice 'VERIFICACION OK: aims_secretaria_derivations.created_by_user_id';
end
$verificacion$;
