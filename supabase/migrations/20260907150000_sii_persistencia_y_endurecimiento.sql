-- 20260907150000_sii_persistencia_y_endurecimiento.sql
--
-- PERSISTIR EL CANAL INTERNO (SII) EN CLOUD, Y ENDURECER `sii.*` ANTES.
--
-- Deroga la decisión D-1 del cierre de 2026-09-05 («el canal NO se hace
-- operable contra Cloud; cero migraciones sobre sii.*») por orden expresa del
-- usuario de 2026-09-07: el dato simulado del tenant Garrigues debe PERSISTIR.
--
-- ESTADO DE PARTIDA, MEDIDO EN CLOUD EL 2026-09-07 (lectura por MCP):
--
--   · `sii.cases`, `sii.evidences`, `sii.audit_log`: relrowsecurity = false y
--     CERO políticas. Lo único que hoy las protege es la ausencia de GRANT:
--     has_table_privilege('anon','sii.cases','SELECT') = false, y lo mismo para
--     `authenticated`. Solo `postgres` tiene privilegios.
--   · Las tres vistas de `public` (`sii_cases_view`, `sii_evidences_view`,
--     `sii_actions_view`) SÍ conceden a `anon` y a `authenticated` DELETE,
--     INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE y UPDATE. Son
--     `security_invoker=true`, así que hoy esos grants son INERTES: el acceso
--     se comprueba contra la tabla base, donde no hay privilegio. No es una
--     fuga abierta; es una trampa cargada — el día que alguien conceda la
--     tabla o quite `security_invoker`, `anon` hereda DELETE y TRUNCATE sobre
--     denuncias. Se retiran.
--   · `sii.cases` tiene UNA fila, `CASO-SII-001`, cuyo `tenant_id`
--     (eed5e854-0759-4112-985c-585c1715c063) NO existe en `public.tenants`.
--     Sin evidencias ni asientos de auditoría asociados.
--
-- QUÉ SE HACE CON LA FILA HUÉRFANA: NADA. No se borra porque no puedo
-- justificar que sea basura —es el único rastro del seed original del canal— y
-- con RLS activa ninguna sesión la ve: `fn_current_tenant_id()` jamás devuelve
-- un tenant que no existe. Por lo mismo NO se añade FK de `sii.cases.tenant_id`
-- a `tenants`: la añadiría a costa de borrar esa fila. Queda declarada.
--
-- QUÉ NECESITA `anon`: NADA. Medido en `src/App.tsx`: las cinco rutas /sii/*
-- cuelgan de `<ProtectedShell>` y además de `<RequireModule moduleKey="sii">`.
-- No existe portal de alta anónimo: para registrar una comunicación hay que
-- estar autenticado. Así que `anon` no recibe INSERT tampoco.
--
-- QUÉ NO SE TOCA, A PROPÓSITO: los GRANT de SELECT de `authenticated` sobre las
-- tres vistas legacy. `src/test/schema/console-read-model.test.ts` mide en vivo
-- que `sii_cases_view` deniega a Garrigues con HTTP 403 y código 42501
-- («permission denied for table cases»), y de esa medición depende que la
-- tarjeta del SII en la consola se pinte «no medido» y nunca 0. Dejando el
-- SELECT de la vista, la denegación sigue naciendo de la tabla base, que es
-- exactamente lo medido. Lo que se retira de `authenticated` son las escrituras.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLA DE PERSISTENCIA DEL CANAL
-- ─────────────────────────────────────────────────────────────────────────────
-- Tabla NUEVA, no se reutiliza `sii.cases`: su forma no es la del expediente
-- que el producto maneja (no tiene mensajes, subexpedientes, recusaciones,
-- registro anti-represalias ni asiento de Libro-registro) y su UNIQUE sobre
-- `case_ref` es GLOBAL, con lo que los dos tenants colisionarían en cuanto
-- ambos generasen `SII-2026-08-004`.
--
-- El expediente se guarda como documento JSONB porque es un agregado que la
-- aplicación lee y escribe SIEMPRE entero: cada mutación del hook carga el
-- expediente, lo modifica y lo vuelve a guardar. Normalizarlo en seis tablas
-- sería reescribir el módulo para consultas que nadie hace.
-- ponytail: documento JSONB, sin consultas por campo ni filtrado servidor más
-- allá del tenant. Si algún día hay que buscar por categoría o listar 10.000
-- expedientes, se normaliza.
create table if not exists sii.reports (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id),
  code        text not null,
  -- CATALOGO = sembrado desde el catálogo del módulo; ALTA = registrado por el
  -- usuario. Lo consume `reaplicarCamposDelCatalogo`, que solo puede reescribir
  -- lo que el catálogo posee.
  origen      text not null default 'ALTA' check (origen in ('CATALOGO', 'ALTA')),
  -- Orden de presentación. Reproduce lo que hacía el almacén local: el catálogo
  -- en el orden en que está escrito y las altas por delante. Sin esto habría que
  -- inventar un criterio de ordenación (los tres de ARGA no están ordenados por
  -- fecha de entrada) y las tres fichas demo cambiarían de sitio.
  orden       integer not null default 0,
  report      jsonb not null,
  created_at  timestamptz not null default now()
);

comment on table sii.reports is
  'Expedientes del canal interno de información (Ley 2/2023). Documento JSONB por expediente, aislado por tenant. DATO DE DEMOSTRACIÓN: sin cifrado, sin custodia cualificada y sin eficacia jurídica.';

-- Un código por tenant. Es también el backstop de la carrera de alta: el hook
-- deriva el correlativo del máximo existente, así que dos altas simultáneas
-- pedirían el mismo código y la segunda FALLA EN VOZ ALTA en vez de duplicar en
-- silencio.
create unique index if not exists ux_sii_reports_tenant_code
  on sii.reports (tenant_id, code);

create index if not exists ix_sii_reports_tenant_orden
  on sii.reports (tenant_id, orden);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS EN LAS CUATRO TABLAS DE `sii`
-- ─────────────────────────────────────────────────────────────────────────────
alter table sii.cases     enable row level security;
alter table sii.evidences enable row level security;
alter table sii.audit_log enable row level security;
alter table sii.reports   enable row level security;

-- 2.a. `sii.cases` y `sii.reports` llevan `tenant_id` propio.
drop policy if exists sii_cases_tenant_isolation on sii.cases;
create policy sii_cases_tenant_isolation on sii.cases
  for all to authenticated
  using      (tenant_id = public.fn_current_tenant_id())
  with check (tenant_id = public.fn_current_tenant_id());

drop policy if exists sii_reports_tenant_select on sii.reports;
create policy sii_reports_tenant_select on sii.reports
  for select to authenticated
  using (tenant_id = public.fn_current_tenant_id());

drop policy if exists sii_reports_tenant_insert on sii.reports;
create policy sii_reports_tenant_insert on sii.reports
  for insert to authenticated
  with check (tenant_id = public.fn_current_tenant_id());

drop policy if exists sii_reports_tenant_update on sii.reports;
create policy sii_reports_tenant_update on sii.reports
  for update to authenticated
  using      (tenant_id = public.fn_current_tenant_id())
  with check (tenant_id = public.fn_current_tenant_id());

-- Sin política de DELETE y sin GRANT de DELETE: un expediente del canal no se
-- borra desde la aplicación. No hay camino en el producto que lo pida.

-- 2.b. `sii.evidences` y `sii.audit_log` NO tienen `tenant_id` —comprobado en
--      `information_schema.columns`: evidences es (id, case_id, title,
--      file_url, is_encrypted, uploaded_at) y audit_log es (id, case_id,
--      actor_id, action, details, previous_hash, current_hash, created_at)—.
--      Heredan el scoping por `case_id`, así que la política va por join.
drop policy if exists sii_evidences_tenant_isolation on sii.evidences;
create policy sii_evidences_tenant_isolation on sii.evidences
  for all to authenticated
  using (exists (
    select 1 from sii.cases c
    where c.id = evidences.case_id
      and c.tenant_id = public.fn_current_tenant_id()
  ))
  with check (exists (
    select 1 from sii.cases c
    where c.id = evidences.case_id
      and c.tenant_id = public.fn_current_tenant_id()
  ));

-- `audit_log.case_id` es NULLABLE. Un asiento sin caso no tiene tenant que
-- resolver, así que el EXISTS es falso y queda denegado: fail-closed.
drop policy if exists sii_audit_log_tenant_isolation on sii.audit_log;
create policy sii_audit_log_tenant_isolation on sii.audit_log
  for all to authenticated
  using (exists (
    select 1 from sii.cases c
    where c.id = audit_log.case_id
      and c.tenant_id = public.fn_current_tenant_id()
  ))
  with check (exists (
    select 1 from sii.cases c
    where c.id = audit_log.case_id
      and c.tenant_id = public.fn_current_tenant_id()
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VISTA PÚBLICA DEL NUEVO ALMACÉN
-- ─────────────────────────────────────────────────────────────────────────────
-- El esquema `sii` no está expuesto en la API. Mismo patrón que las vistas de
-- 20260417151006: vista en `public` con `security_invoker=true`, de modo que
-- las políticas de arriba se evalúan con la identidad de quien llama y no con
-- la del propietario de la vista. Es auto-actualizable (SELECT plano de una
-- sola tabla), así que INSERT y UPDATE viajan a la tabla base.
create or replace view public.sii_reports
  with (security_invoker = true) as
  select id, tenant_id, code, origen, orden, report, created_at
  from sii.reports;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PRIVILEGIOS: `anon` fuera; `authenticated` solo lo que el producto usa
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on sii.cases, sii.evidences, sii.audit_log, sii.reports
  from anon, authenticated;
revoke all on public.sii_reports from anon, authenticated;
revoke all on public.sii_cases_view, public.sii_evidences_view, public.sii_actions_view
  from anon;

-- De `authenticated` se retiran las ESCRITURAS sobre las vistas legacy. El
-- SELECT se conserva a propósito (ver cabecera): la denegación tiene que seguir
-- naciendo de la tabla base para no mover la postura que mide la consola.
revoke insert, update, delete, truncate, references, trigger
  on public.sii_cases_view, public.sii_evidences_view, public.sii_actions_view
  from authenticated;

-- USAGE sobre el esquema `sii`: medido hoy, `authenticated` NO lo tiene
-- (has_schema_privilege = false para los tres roles de la API). Una vista
-- `security_invoker` comprueba los privilegios del llamante también sobre el
-- ESQUEMA de la tabla base, así que sin esto `public.sii_reports` devolvería
-- «permission denied for schema sii». USAGE por sí solo no concede acceso a
-- ninguna tabla: las otras tres siguen sin privilegio y siguen denegando con el
-- mismo 42501 / HTTP 403 que la consola mide.
grant usage on schema sii to authenticated;

grant select, insert, update on sii.reports        to authenticated;
grant select, insert, update on public.sii_reports to authenticated;

-- `sii.cases`, `sii.evidences` y `sii.audit_log` NO reciben privilegio alguno:
-- la aplicación no las usa y su denegación actual es la postura medida.

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. VERIFICACIÓN QUE ABORTA
-- ─────────────────────────────────────────────────────────────────────────────
-- Dentro de la misma transacción del fichero, a propósito: si algo de arriba no
-- quedó como debe, la excepción deshace la migración ENTERA en vez de dejar el
-- canal a medio endurecer. No hay `begin;`/`commit;` explícitos porque el
-- runner de migraciones ya envuelve el fichero.
do $verificacion$
declare
  v_tabla   text;
  v_rls     boolean;
  v_faltan  text[] := '{}';
begin
  -- 5.a. RLS activa en las cuatro tablas.
  foreach v_tabla in array array['cases', 'evidences', 'audit_log', 'reports'] loop
    select c.relrowsecurity into v_rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'sii' and c.relname = v_tabla;

    if v_rls is distinct from true then
      v_faltan := v_faltan || format('sii.%s SIN RLS', v_tabla);
    end if;

    if (select count(*) from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'sii' and c.relname = v_tabla) = 0 then
      v_faltan := v_faltan || format('sii.%s SIN POLÍTICAS', v_tabla);
    end if;
  end loop;

  -- 5.b. `anon` no conserva DELETE ni TRUNCATE en ninguna superficie del canal.
  foreach v_tabla in array array[
    'sii.cases', 'sii.evidences', 'sii.audit_log', 'sii.reports',
    'public.sii_reports', 'public.sii_cases_view',
    'public.sii_evidences_view', 'public.sii_actions_view'
  ] loop
    if has_table_privilege('anon', v_tabla, 'DELETE') then
      v_faltan := v_faltan || format('anon conserva DELETE en %s', v_tabla);
    end if;
    if has_table_privilege('anon', v_tabla, 'TRUNCATE') then
      v_faltan := v_faltan || format('anon conserva TRUNCATE en %s', v_tabla);
    end if;
    -- Y tampoco lectura: el canal no tiene portal anónimo.
    if has_table_privilege('anon', v_tabla, 'SELECT') then
      v_faltan := v_faltan || format('anon conserva SELECT en %s', v_tabla);
    end if;
  end loop;

  -- 5.c. Control positivo del propio instrumento: si `has_table_privilege`
  --      devolviera siempre false, 5.b pasaría sin comprobar nada. Este
  --      privilegio SÍ tiene que existir.
  if not has_table_privilege('authenticated', 'public.sii_reports', 'SELECT') then
    v_faltan := v_faltan
      || 'la verificación no mide: authenticated no puede leer public.sii_reports';
  end if;

  -- 5.d. La postura que mide `console-read-model.test.ts` no se ha movido:
  --      `authenticated` sigue SIN poder leer la tabla base de las vistas
  --      legacy, que es de donde nace el 42501 que esa sonda exige.
  foreach v_tabla in array array['sii.cases', 'sii.evidences', 'sii.audit_log'] loop
    if has_table_privilege('authenticated', v_tabla, 'SELECT') then
      v_faltan := v_faltan || format(
        '%s concede SELECT a authenticated: la tarjeta del SII de la consola pasaría a medir 0', v_tabla);
    end if;
  end loop;

  if array_length(v_faltan, 1) > 0 then
    raise exception 'SII: el endurecimiento no quedó aplicado -> %',
      array_to_string(v_faltan, ' | ');
  end if;

  raise notice 'SII: RLS activa en las 4 tablas, anon sin acceso, authenticated con lectura del nuevo almacén.';
end
$verificacion$;
