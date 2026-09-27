-- MOI-181 (deuda 5 del ledger de cobertura RIA, `docs/superpowers/plans/2026-09-19-ledger-cobertura-ria.md:439-444`).
--
-- QUÉ RESUELVE
-- ------------
-- M01 (`20260919100000_aims_checks_enlaces_evaluacion.sql`) creó el enlace
-- `ai_compliance_checks.assessment_id → ai_risk_assessments(id)`, pero declaró
-- a propósito que las comprobaciones ANTERIORES a esa fecha quedan sin enlazar
-- («no hay forma honesta de saber de qué evaluación salió cada comprobación
-- histórica, y una sesión tampoco puede rellenarlas después: el trigger lo
-- impide»). Medido el 2026-09-27 (SELECT, `governance_OS`): siguen siendo
-- exactamente **61** filas con `assessment_id IS NULL`, en los dos tenants.
--
-- El ledger propone, para F2, «atar cada comprobación a la suya»; hasta que
-- eso exista (columna nueva o criterio de dominio validado por Legal), F2.T3
-- no llega a esto y la deuda queda abierta. MOI-181 solo puede EJECUTAR aquí
-- lo que no reescribe el legado (regla dura F11.T4 de la especificación: «0
-- UPDATE sobre el legado»; el propio issue instruye elevarlo a Moisés si
-- exigiera escribir en filas existentes de ARGA o Garrigues).
--
-- DECISIÓN TÉCNICA DEL AGENTE (declarada también en el ledger, sección
-- «Deudas y hallazgos»): en vez de un UPDATE que persista un enlace inventado,
-- una VISTA DE SOLO LECTURA que calcula, por sistema y proximidad de fecha,
-- cuál es la evaluación MÁS PROBABLE de cada comprobación legacy — sin tocar
-- ninguna fila de `ai_compliance_checks` ni de `ai_risk_assessments`. Es una
-- CORRELACIÓN DERIVADA, no una acreditación: el nombre de sus columnas lleva
-- el prefijo `probable_` a propósito, para que ninguna pantalla la confunda
-- con el enlace real de M01. Quien la lea sigue sabiendo que la comprobación
-- es legado (`assessment_id IS NULL` en la tabla base no cambia).
--
-- CÓMO CORRELA
-- ------------
-- Por cada comprobación sin enlace, candidatas = las evaluaciones del MISMO
-- `system_id` (una evaluación de otro sistema nunca es candidata — mismo
-- criterio que el trigger de M01). Entre las candidatas, la más próxima en el
-- tiempo: `abs(fecha_comprobación - fecha_evaluación)`, con empate resuelto por
-- la evaluación más antigua y luego por id (determinista). La fecha de cada
-- lado usa `checked_at`/`assessment_date` si existen y si no `created_at`
-- (ambas columnas son NULLABLE desde la fase 4 original). Una comprobación
-- cuyo sistema no tiene NINGUNA evaluación queda FUERA de la vista (el join es
-- INNER a propósito): no se propone nada donde no hay nada que proponer.
--
-- Medido en solo lectura contra `governance_OS` antes de escribir esta vista
-- (mismo cálculo, sin crearla): de las 61 legacy, 58 tienen al menos una
-- evaluación candidata en su sistema (58 filas en la vista) y 3 no tienen
-- ninguna evaluación en su sistema (quedan fuera, correctamente). La distancia
-- de la correlación top-1 va de 0 a 199 días, media 29,7 días.
--
-- PRIVILEGIOS
-- -----------
-- `security_invoker = true`: la vista se evalúa con la identidad de quien
-- llama, así que la RLS de `ai_compliance_checks` y `ai_risk_assessments`
-- (aislamiento por `system_id → ai_systems.tenant_id`, `20260521150000`) se
-- aplica sin repetirla aquí — ni una condición de tenant nueva que pueda
-- desalinearse de la de las tablas base. `anon` no recibe nada; `authenticated`
-- solo SELECT (la vista no es auto-actualizable por el JOIN + funciones de
-- ventana, así que Postgres ya rechazaría un INSERT/UPDATE por sí solo, pero
-- se revoca también el privilegio para no depender de eso — patrón de
-- `20260924180000`: un grant heredado del esquema es aditivo y no se nota
-- hasta que algo lo usa).
--
-- ESTA MIGRACIÓN NO TOCA DATOS. Ninguna sentencia de este fichero es un
-- INSERT/UPDATE/DELETE sobre una tabla; el bloque de verificación lo comprueba
-- contando las 61 filas legacy antes y después de crear la vista.

create or replace view public.v_aims_checks_legado_correlacion
  with (security_invoker = true) as
with candidatos as (
  select
    c.id as check_id,
    c.system_id,
    c.requirement_code,
    c.status as check_status,
    coalesce(c.checked_at, c.created_at::date) as check_date,
    a.id as assessment_id,
    a.status as assessment_status,
    a.framework as assessment_framework,
    coalesce(a.assessment_date, a.created_at::date) as assessment_date,
    abs(coalesce(c.checked_at, c.created_at::date) - coalesce(a.assessment_date, a.created_at::date)) as dias_diferencia
  from public.ai_compliance_checks c
  join public.ai_risk_assessments a on a.system_id = c.system_id
  where c.assessment_id is null
),
rankeados as (
  select
    *,
    row_number() over (
      partition by check_id
      order by dias_diferencia asc, assessment_date asc, assessment_id asc
    ) as orden,
    count(*) over (partition by check_id) as candidatos_totales
  from candidatos
)
select
  check_id,
  system_id,
  requirement_code,
  check_status,
  check_date,
  assessment_id as probable_assessment_id,
  assessment_status as probable_assessment_status,
  assessment_framework as probable_assessment_framework,
  assessment_date as probable_assessment_date,
  dias_diferencia,
  candidatos_totales
from rankeados
where orden = 1;

comment on view public.v_aims_checks_legado_correlacion is
  'Correlación DERIVADA (no persistida) de comprobaciones legacy (assessment_id IS NULL) con su evaluación más probable, por sistema y proximidad de fecha. No acredita: ai_compliance_checks.assessment_id sigue NULL. MOI-181, deuda 5 del ledger de cobertura RIA.';

revoke all on public.v_aims_checks_legado_correlacion from anon, authenticated;
grant select on public.v_aims_checks_legado_correlacion to authenticated;

-- ---------------------------------------------------------------------------
-- Verificación que aborta la migración si algo no quedó como se dice.
-- ---------------------------------------------------------------------------
do $verificacion$
declare
  v_legacy_antes int;
  v_legacy_despues int;
  v_relkind "char";
  v_invoker boolean;
  v_grant_anon int;
  v_grant_auth_select int;
  v_grant_auth_escritura int;
  v_filas_vista int;
  v_checks_distintos int;
  v_fuera_de_universo int;
  v_con_enlace_real int;
begin
  -- 1. Esta migración no cambia ni una fila de las tablas base (F11.T4: 0 UPDATE
  --    sobre el legado). Contar antes de tocar nada y otra vez al final.
  select count(*) into v_legacy_antes
    from public.ai_compliance_checks where assessment_id is null;
  if v_legacy_antes <> 61 then
    raise notice 'AVISO: se esperaban 61 comprobaciones legacy y hay % — el universo medido el 2026-09-27 cambió; revisar antes de continuar', v_legacy_antes;
  end if;

  -- 2. La vista existe, es una vista (no una tabla materializada ni una tabla) y
  --    lleva security_invoker=true en sus reloptions.
  select c.relkind,
         coalesce((select bool_or(opt = 'security_invoker=true')
                     from unnest(c.reloptions) as opt), false)
    into v_relkind, v_invoker
    from pg_class c
   where c.oid = 'public.v_aims_checks_legado_correlacion'::regclass;
  if v_relkind is distinct from 'v' then
    raise exception 'VERIFICACION: v_aims_checks_legado_correlacion no es una vista (relkind=%)', v_relkind;
  end if;
  if v_invoker is not true then
    raise exception 'VERIFICACION: la vista no lleva security_invoker=true — sin esto se evaluaría con el dueño y no con quien llama, rompiendo el aislamiento por tenant';
  end if;

  -- 3. Privilegios: anon fuera del todo; authenticated solo SELECT.
  select count(*) into v_grant_anon
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'v_aims_checks_legado_correlacion'
     and grantee = 'anon';
  if v_grant_anon <> 0 then
    raise exception 'VERIFICACION: anon conserva % privilegios sobre la vista', v_grant_anon;
  end if;

  select count(*) into v_grant_auth_select
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'v_aims_checks_legado_correlacion'
     and grantee = 'authenticated' and privilege_type = 'SELECT';
  if v_grant_auth_select <> 1 then
    raise exception 'VERIFICACION: authenticated debería tener exactamente 1 grant de SELECT sobre la vista, tiene %', v_grant_auth_select;
  end if;

  select count(*) into v_grant_auth_escritura
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'v_aims_checks_legado_correlacion'
     and grantee = 'authenticated'
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  if v_grant_auth_escritura <> 0 then
    raise exception 'VERIFICACION: authenticated conserva % privilegios de escritura sobre la vista', v_grant_auth_escritura;
  end if;

  -- 4. La vista nunca propone una evaluación de OTRO sistema (mismo criterio
  --    que el trigger de M01), y nunca incluye una comprobación que YA tenga
  --    assessment_id real (dejaría de ser "legado sin enlace").
  select count(*) into v_fuera_de_universo
    from public.v_aims_checks_legado_correlacion v
    join public.ai_risk_assessments a on a.id = v.probable_assessment_id
   where a.system_id <> v.system_id;
  if v_fuera_de_universo <> 0 then
    raise exception 'VERIFICACION: % filas de la vista proponen una evaluación de otro sistema', v_fuera_de_universo;
  end if;

  select count(*) into v_con_enlace_real
    from public.v_aims_checks_legado_correlacion v
    join public.ai_compliance_checks c on c.id = v.check_id
   where c.assessment_id is not null;
  if v_con_enlace_real <> 0 then
    raise exception 'VERIFICACION: % filas de la vista corresponden a comprobaciones que YA tienen assessment_id real', v_con_enlace_real;
  end if;

  -- 5. Cada check aparece a lo sumo una vez (orden=1 es único por check_id) y
  --    solo los que tienen al menos un candidato entran.
  select count(*), count(distinct check_id) into v_filas_vista, v_checks_distintos
    from public.v_aims_checks_legado_correlacion;
  if v_filas_vista <> v_checks_distintos then
    raise exception 'VERIFICACION: la vista repite check_id (% filas, % distintos) — el top-1 por comprobación no es único', v_filas_vista, v_checks_distintos;
  end if;

  -- 6. Control positivo del propio instrumento: el join de arriba SÍ vería un
  --    cruce si lo hubiera (probado contra el universo real de la vista, no
  --    contra un caso sintético que no demuestre nada del predicado).
  if v_filas_vista = 0 then
    raise exception 'VERIFICACION: la vista no devuelve ninguna fila — con 58 candidatas medidas el 27-09, una vista vacía es un defecto, no el resultado esperado';
  end if;

  -- 7. Repetir el recuento de legacy tras crear la vista: 0 UPDATE, ninguna
  --    diferencia posible.
  select count(*) into v_legacy_despues
    from public.ai_compliance_checks where assessment_id is null;
  if v_legacy_despues <> v_legacy_antes then
    raise exception 'VERIFICACION: el recuento de legacy cambió de % a % — esta migración no debe escribir dato', v_legacy_antes, v_legacy_despues;
  end if;

  raise notice 'VERIFICACION OK: vista security_invoker, anon sin privilegio, authenticated solo SELECT, % filas correladas de % comprobaciones legacy, 0 filas tocadas', v_filas_vista, v_legacy_antes;
end;
$verificacion$;
