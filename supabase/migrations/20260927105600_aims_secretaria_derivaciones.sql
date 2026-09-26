-- MOI-56 — Conexión persistente AIMS -> Secretaría.
--
-- Decisión D-18 (delegada por Moisés, 2026-09-27): opción a) ESTRUCTURA
-- PROPIA. Prohibido escribir en governance_module_events / governance_module_links
-- (protocolo regla 10; CLAUDE.md «No hacer»). Comparación columna a columna
-- de por qué esas dos tablas no cubren el contrato:
-- docs/superpowers/specs/2026-09-27-contrato-conexion-aims-secretaria.md.
--
-- QUÉ GUARDA
-- ----------
-- Una fila por cada vez que una alerta de AIMS (ai_incidents) se materializa
-- de verdad en una reunión o un acuerdo de Secretaría. La sola navegación
-- (src/lib/aims/handoffs.ts) sigue sin escribir nada -- esta tabla solo se
-- alimenta desde los dos puntos de creación real documentados en el contrato.
--
-- Cero cambio ARGA ni Garrigues: tabla nueva, ninguna columna existente cambia.

create table if not exists public.aims_secretaria_derivations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null,
  source_incident_id    uuid not null references public.ai_incidents(id) on delete restrict,
  source_event          text not null,
  target_meeting_id     uuid references public.meetings(id) on delete restrict,
  target_agreement_id   uuid references public.agreements(id) on delete restrict,
  status                text not null default 'LINKED'
                        check (status in ('LINKED', 'SUPERSEDED')),
  evidence_ref          text,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  constraint aims_secretaria_derivations_one_target check (
    (target_meeting_id is not null and target_agreement_id is null)
    or (target_meeting_id is null and target_agreement_id is not null)
  )
);

comment on table public.aims_secretaria_derivations is
  'MOI-56: relación persistente entre una alerta de AIMS (ai_incidents) y la reunión o el acuerdo de Secretaría que la resolvió. Estructura propia -- no gobierna governance_module_events/links.';
comment on column public.aims_secretaria_derivations.source_event is
  'Evento del contrato de handoff declarado en src/lib/aims/handoffs.ts (p.ej. AIMS_INCIDENT_MATERIAL).';
comment on column public.aims_secretaria_derivations.evidence_ref is
  'Justificante de retorno (referencia al acta/certificación). NULL en esta entrega: ninguna pantalla lo escribe todavía -- depende de la custodia final de actas (MOI-144).';

-- Idempotencia: reintentar la misma derivación (mismo incidente, mismo
-- destino) no duplica fila. Índices únicos PARCIALES porque exactamente uno
-- de los dos target_* es NOT NULL por fila (constraint de arriba).
create unique index if not exists ux_aims_secretaria_derivations_incident_meeting
  on public.aims_secretaria_derivations (source_incident_id, target_meeting_id)
  where target_meeting_id is not null;
create unique index if not exists ux_aims_secretaria_derivations_incident_agreement
  on public.aims_secretaria_derivations (source_incident_id, target_agreement_id)
  where target_agreement_id is not null;

create index if not exists ix_aims_secretaria_derivations_tenant_incident
  on public.aims_secretaria_derivations (tenant_id, source_incident_id);

-- ---------------------------------------------------------------------------
-- RLS y privilegios. Sin política ni GRANT de DELETE ni UPDATE: una
-- derivación no se borra ni se reescribe desde la aplicación en esta entrega.
-- Un GRANT es aditivo y TRUNCATE no pasa por RLS, así que se revoca
-- explícitamente lo que no se concede (MOI-205 ya lo hace por defecto para
-- tablas nuevas de postgres; se revoca igual, el instrumento se verifica).
-- ---------------------------------------------------------------------------
alter table public.aims_secretaria_derivations enable row level security;

drop policy if exists aims_secretaria_derivations_tenant_select on public.aims_secretaria_derivations;
create policy aims_secretaria_derivations_tenant_select
  on public.aims_secretaria_derivations for select to authenticated
  using (tenant_id = public.fn_current_tenant_id());

-- El aislamiento del INSERT no se apoya solo en la columna tenant_id de la
-- propia fila: exige que el incidente de origen y el destino elegido
-- (reunión o acuerdo) pertenezcan AMBOS al tenant de la sesión. Sin esto, un
-- cliente manipulado podría enlazar un incidente ajeno leído por otra vía.
drop policy if exists aims_secretaria_derivations_tenant_insert on public.aims_secretaria_derivations;
create policy aims_secretaria_derivations_tenant_insert
  on public.aims_secretaria_derivations for insert to authenticated
  with check (
    tenant_id = public.fn_current_tenant_id()
    and exists (
      select 1 from public.ai_incidents i
       where i.id = source_incident_id and i.tenant_id = public.fn_current_tenant_id()
    )
    and (
      (target_meeting_id is not null and exists (
        select 1 from public.meetings m
         where m.id = target_meeting_id and m.tenant_id = public.fn_current_tenant_id()
      ))
      or
      (target_agreement_id is not null and exists (
        select 1 from public.agreements a
         where a.id = target_agreement_id and a.tenant_id = public.fn_current_tenant_id()
      ))
    )
  );

revoke all on table public.aims_secretaria_derivations from public, anon;
grant select, insert on table public.aims_secretaria_derivations to authenticated;
revoke delete, update, truncate, references, trigger on table public.aims_secretaria_derivations from authenticated;

-- ---------------------------------------------------------------------------
-- Verificación. Aborta la migración si el instrumento no quedó como se
-- describe -- incluye un control positivo (una tabla nueva sin blindar SÍ
-- dispararía esta misma verificación, para que el chequeo no sea vacuo).
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_cols int;
  v_check int;
  v_idx_unique int;
  v_rls boolean;
  v_pol int;
  v_pol_delete int;
  v_pol_update int;
  v_grants_anon int;
  v_grants_auth_malos int;
  v_grants_auth_buenos int;
  v_probe_cols int;
begin
  select count(*) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'aims_secretaria_derivations';
  if v_cols <> 10 then
    raise exception 'VERIFICACION MOI-56: columnas esperadas 10, encontradas %', v_cols;
  end if;

  select count(*) into v_check
    from pg_constraint
   where conrelid = 'public.aims_secretaria_derivations'::regclass and contype = 'c';
  if v_check < 2 then
    raise exception 'VERIFICACION MOI-56: CHECK esperados (status + un_solo_destino), encontrados %', v_check;
  end if;

  select count(*) into v_idx_unique
    from pg_indexes
   where schemaname = 'public' and tablename = 'aims_secretaria_derivations'
     and indexname in ('ux_aims_secretaria_derivations_incident_meeting', 'ux_aims_secretaria_derivations_incident_agreement');
  if v_idx_unique <> 2 then
    raise exception 'VERIFICACION MOI-56: índices únicos de idempotencia esperados 2, encontrados %', v_idx_unique;
  end if;

  select relrowsecurity into v_rls from pg_class where oid = 'public.aims_secretaria_derivations'::regclass;
  if not v_rls then
    raise exception 'VERIFICACION MOI-56: RLS no habilitada';
  end if;

  select count(*) into v_pol
    from pg_policies
   where schemaname = 'public' and tablename = 'aims_secretaria_derivations';
  select count(*) into v_pol_delete
    from pg_policies
   where schemaname = 'public' and tablename = 'aims_secretaria_derivations' and cmd = 'DELETE';
  select count(*) into v_pol_update
    from pg_policies
   where schemaname = 'public' and tablename = 'aims_secretaria_derivations' and cmd = 'UPDATE';
  if v_pol <> 2 or v_pol_delete <> 0 or v_pol_update <> 0 then
    raise exception 'VERIFICACION MOI-56: políticas esperadas 2 (select+insert), sin delete ni update; encontradas % (delete: %, update: %)', v_pol, v_pol_delete, v_pol_update;
  end if;

  select count(*) into v_grants_anon
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_secretaria_derivations' and grantee = 'anon';
  if v_grants_anon <> 0 then
    raise exception 'VERIFICACION MOI-56: anon conserva % privilegios', v_grants_anon;
  end if;

  select count(*) into v_grants_auth_malos
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_secretaria_derivations'
     and grantee = 'authenticated'
     and privilege_type in ('DELETE', 'UPDATE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if v_grants_auth_malos <> 0 then
    raise exception 'VERIFICACION MOI-56: authenticated conserva % privilegios que no se conceden', v_grants_auth_malos;
  end if;

  select count(*) into v_grants_auth_buenos
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'aims_secretaria_derivations'
     and grantee = 'authenticated' and privilege_type in ('SELECT', 'INSERT');
  if v_grants_auth_buenos <> 2 then
    raise exception 'VERIFICACION MOI-56: authenticated debería tener SELECT e INSERT; encontrados %', v_grants_auth_buenos;
  end if;

  -- Control positivo del propio instrumento: una tabla de prueba SIN blindar
  -- (creada igual que ésta pero sin los REVOKE) sí debe mostrar privilegios
  -- residuales -- si no los muestra, la consulta de arriba es vacua y no
  -- estaría probando nada.
  execute 'create table public.__probe_moi56_sin_blindar (id int)';
  execute 'grant select, insert, update, delete on table public.__probe_moi56_sin_blindar to authenticated';
  select count(*) into v_probe_cols
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = '__probe_moi56_sin_blindar'
     and grantee = 'authenticated' and privilege_type = 'DELETE';
  execute 'drop table public.__probe_moi56_sin_blindar';
  if v_probe_cols <> 1 then
    raise exception 'VERIFICACION MOI-56: el control positivo no encontró lo que sí existe -- el instrumento es vacuo';
  end if;

  raise notice 'VERIFICACION MOI-56: OK (% columnas, % políticas sin delete/update, % índices de idempotencia, control positivo confirmado)', v_cols, v_pol, v_idx_unique;
end;
$verificacion$;
