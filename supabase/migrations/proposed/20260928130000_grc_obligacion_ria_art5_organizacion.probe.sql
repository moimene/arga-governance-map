-- 20260928130000_grc_obligacion_ria_art5_organizacion.sql
--
-- MOI-175 (F5.T5, resto) — la segunda obligación de organización del RIA:
-- el art. 5 (prácticas de IA de riesgo inaceptable) en el registro de GRC,
-- en los dos tenants del programa, esta vez por la RPC que fija la
-- especificación (`fn_grc_alta_obligacion_organizacion_ria`), no por INSERT
-- directo como hizo el primer paso (`20260920140000`, art. 4).
--
-- POR QUÉ ESTA Y NO OTRA
-- ----------------------
-- El art. 4 (alfabetización) ya estaba de alta. La especificación (F5.T5,
-- :1555-1565) pide junto a él OBL-RIA-ORG-05 (art. 5), con el mismo órgano y
-- la misma política que el art. 4 en cada tenant: Comité de Gobernanza de la
-- IA + PI-30 en Garrigues, CATIT + PR-024 en ARGA (D-U2, aceptada por
-- Moisés el 2026-09-20). El art. 5 es la obligación de organización que
-- falta: nadie exige alfabetizar sin exigir también no desplegar prácticas
-- prohibidas.
--
-- QUÉ HACE, Y QUÉ NO
-- ------------------
--   * Crea `fn_grc_alta_obligacion_organizacion_ria`, la RPC que la
--     especificación exige para dar de alta una obligación de ORGANIZACIÓN
--     del RIA: resuelve el órgano por SLUG y la política por CÓDIGO (nunca
--     por UUID a mano), es idempotente por `(tenant_id, code)` y FALLA
--     CERRADO si el órgano o la política no existen en ese tenant — misma
--     regla que el primer paso del art. 4 y que G4. Sin GRANT a
--     `authenticated`: hoy solo la llama esta migración; el día que F6.T2
--     la invoque desde `fn_aims_completar_cuestionario_v2` (SECURITY
--     DEFINER, dueño postgres) no necesita el grant — corre con los
--     privilegios del definidor, no con los del usuario final.
--   * Da de alta `OBL-RIA-ORG-05` en Garrigues y en ARGA, por esa RPC.
--   * **NO crea ningún control** (`CTR-RIA-ALF-01`, `CTR-RIA-PI30-01/02` de
--     la especificación quedan fuera). `controls.status` solo admite
--     Efectivo, Parcial o Inefectivo: no hay valor para «declarado y
--     todavía sin probar», y MOI-174 —que decide justo esto— sigue en
--     Backlog sin resolver a fecha de esta migración. Afirmar un control
--     antes de que exista su evidencia (F5.T6, también pendiente de
--     MOI-174) sería fabricar una efectividad que nadie ha medido. Mismo
--     criterio que ya aplicó `20260920140000` al art. 4.
--   * **NO toca el tenant `…0003`** (grupo nuevo): verificado abajo. Su
--     módulo `ai` existe (`20260926115200`) pero sembrar sus obligaciones
--     del RIA es MOI-176 (F6.T2), que no ha empezado.
--   * **NO pisa ni duplica** el dato ya sembrado de Garrigues: la RPC es
--     `on conflict (tenant_id, code) do nothing` y se verifica idempotente
--     dentro de esta misma migración.
--
-- CAMBIO VISIBLE EN ARGA, DECLARADO (fila a fila, autorizado por delegación
-- de Moisés para esta tarea — igual que el primer paso de F5.T5)
-- ---------------------------------------------------------------------------
-- ANTES: `obligations` de ARGA tenía 6 filas (5 históricas + OBL-RIA-ORG-04,
--        alta declarada del 2026-09-20). Ninguna fila `OBL-RIA-ORG-05`.
-- DESPUÉS: 7 filas. Nueva fila `OBL-RIA-ORG-05` con `owner_body_id` = CATIT
--        (`comite-tecnologia`) y `policy_id` = PR-024, `criticality` =
--        'Crítico', `country_scope` = {ES}, `periodicity` = 'CONTINUA'.
--        Ninguna fila existente se modifica. `/obligaciones` pasa a mostrar
--        7 obligaciones para ARGA, la nueva "SIN CONTROL" (criterio general
--        de `obligation-coverage.ts`, sin excepción para esta fila).
-- El test que hace de registro vivo de esta declaración es
-- `src/test/schema/garrigues-obligaciones-seed.test.ts` ("ARGA no tiene más
-- altas que las declaradas en el ledger"), actualizado en el mismo commit.
--
-- CUIDADO CON EL TRIGGER Y LA FK (avisos de la tarea)
-- ----------------------------------------------------
--   * `fn_sync_obligation_to_backbone` (trigger AFTER INSERT en
--     `obligations`) ya tiene la rama `OBL-RIA-%` -> 'ai' desde
--     `20260920130000`: no se toca. Un INSERT en `obligations` con código
--     `OBL-RIA-ORG-05` dispara el trigger y crea/actualiza su espejo en
--     `grc_obligations` con `module_id = 'ai'` automáticamente.
--   * `grc_obligations(tenant_id, module_id)` tiene FK a
--     `grc_modules(tenant_id, id)`: el módulo `ai` YA EXISTE en los tres
--     grupos (`…0001`, `…0002` desde `20260920130000`; `…0003` desde
--     `20260926115200`), así que el INSERT no puede violar esa FK en
--     ninguno de los dos tenants que esta migración toca. Si el módulo no
--     existiera en un tenant, el propio trigger cae a `'risk'` (fallback ya
--     existente, no tocado aquí) en vez de romper por la FK.
--
-- Ensayo previo: `supabase/migrations/proposed/20260928130000_grc_obligacion_ria_art5_organizacion.probe.sql`,
-- ejecutado con el ejecutor seguro (BEGIN … ROLLBACK), control positivo del
-- fallo cerrado sin órgano y de la idempotencia, ambos revertidos.


-- 1. La RPC que fija la especificación.
create or replace function public.fn_grc_alta_obligacion_organizacion_ria(
  p_tenant_id uuid,
  p_code text,
  p_title text,
  p_source text,
  p_criticality text,
  p_country_scope text[],
  p_body_slug text,
  p_policy_code text,
  p_legal_reference text,
  p_periodicity text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_body uuid;
  v_policy uuid;
  v_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'SIN_TENANT: se requiere tenant_id explícito' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_code, ''))) = 0 then
    raise exception 'CODIGO_OBLIGATORIO: la obligación necesita un código' using errcode = '23514';
  end if;

  -- Falla cerrado sin órgano acreditado: una obligación de organización del
  -- RIA no se da de alta sin un responsable real. Resuelve por SLUG, no por
  -- UUID a mano (mismo criterio que 20260920140000).
  select id into v_body from public.governing_bodies
   where tenant_id = p_tenant_id and slug = p_body_slug;
  if v_body is null then
    raise exception 'SIN_ORGANO_ACREDITADO: el tenant % no tiene el órgano % — sin órgano acreditado no se da de alta la obligación', p_tenant_id, p_body_slug
      using errcode = 'P0100';
  end if;

  select id into v_policy from public.policies
   where tenant_id = p_tenant_id and policy_code = p_policy_code;
  if v_policy is null then
    raise exception 'SIN_POLITICA: el tenant % no tiene la política %', p_tenant_id, p_policy_code
      using errcode = 'P0101';
  end if;

  insert into public.obligations
    (tenant_id, code, title, source, criticality, policy_id, country_scope, owner_body_id, legal_reference, periodicity)
  values (
    p_tenant_id, p_code, p_title, p_source, p_criticality, v_policy, p_country_scope, v_body, p_legal_reference, p_periodicity
  )
  on conflict (tenant_id, code) do nothing;

  select id into v_id from public.obligations where tenant_id = p_tenant_id and code = p_code;
  return v_id;
end;
$fn$;

-- Sin grant a authenticated ni a anon: hoy solo la llama esta migración
-- (como postgres). F6.T2, cuando exista, la llamará desde dentro de otra
-- función SECURITY DEFINER, que no necesita el grant.
revoke all on function public.fn_grc_alta_obligacion_organizacion_ria(
  uuid, text, text, text, text, text[], text, text, text, text
) from public, anon, authenticated;

-- 2. Alta de OBL-RIA-ORG-05 en los dos tenants del programa, por la RPC.
do $alta$
declare
  v_id uuid;
  v_ref text := 'Reglamento (UE) 2024/1689, art. 5, en la redacción del Reglamento (UE) 2026/1744. '
    || 'Las letras a), c), d), e), f), g) y h) son aplicables desde el 2-2-2025; las letras b bis) y '
    || 'b ter), y los apartados 5.1 bis y 5.1 ter, desde el 2-12-2026. Prohíbe la introducción en el '
    || 'mercado, la puesta en servicio o el uso de las prácticas de IA de riesgo inaceptable que '
    || 'enumera. Un positivo se registra como hallazgo (HALLAZGO_ART5) y exige el cese inmediato de '
    || 'la práctica; no admite excepción por medidas compensatorias ni por nivel de riesgo declarado.';
  v_title text := 'Prohibición de prácticas de inteligencia artificial de riesgo inaceptable y protocolo de cese (art. 5)';
begin
  v_id := public.fn_grc_alta_obligacion_organizacion_ria(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'OBL-RIA-ORG-05', v_title, 'RIA — Reglamento (UE) 2024/1689', 'Crítico',
    '{ES}'::text[], 'garrigues-comite-gobernanza-ia', 'PI-30', v_ref, 'CONTINUA'
  );
  if v_id is null then
    raise exception 'ALTA: no se pudo dar de alta OBL-RIA-ORG-05 en Garrigues';
  end if;

  v_id := public.fn_grc_alta_obligacion_organizacion_ria(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'OBL-RIA-ORG-05', v_title, 'RIA — Reglamento (UE) 2024/1689', 'Crítico',
    '{ES}'::text[], 'comite-tecnologia', 'PR-024', v_ref, 'CONTINUA'
  );
  if v_id is null then
    raise exception 'ALTA: no se pudo dar de alta OBL-RIA-ORG-05 en ARGA';
  end if;
end $alta$;

-- 3. Control positivo REVERTIDO: la RPC falla cerrado sin órgano acreditado
--    y no deja residuo (subtransacción que se deshace, sin tocar audit_log:
--    el fallo ocurre ANTES del INSERT en `obligations`, así que el trigger
--    WORM ni se dispara).
do $control_fail_closed$
begin
  begin
    perform public.fn_grc_alta_obligacion_organizacion_ria(
      '00000000-0000-0000-0000-000000000001'::uuid,
      'OBL-RIA-VERIF-ORG05', 'control positivo (no debe persistir)', 'RIA — Reglamento (UE) 2024/1689',
      'Bajo', '{ES}'::text[], 'organo-inexistente-verif-moi175', 'PR-024', 'control positivo', 'CONTINUA'
    );
    raise exception 'V_CONTROL: la RPC no falló cerrado sin órgano acreditado';
  exception when sqlstate 'P0100' then
    null; -- esperado
  end;

  if exists (select 1 from public.obligations where code = 'OBL-RIA-VERIF-ORG05') then
    raise exception 'V_CONTROL: quedó residuo del control positivo en obligations';
  end if;
end $control_fail_closed$;

-- 4. Control de idempotencia: repetir la llamada no duplica la fila.
do $control_idempotente$
declare
  v_before int;
  v_after int;
  v_id uuid;
begin
  select count(*) into v_before from public.obligations where code = 'OBL-RIA-ORG-05';
  v_id := public.fn_grc_alta_obligacion_organizacion_ria(
    '00000000-0000-0000-0000-000000000002'::uuid,
    'OBL-RIA-ORG-05', 'reintento (no debe cambiar nada)', 'RIA — Reglamento (UE) 2024/1689', 'Crítico',
    '{ES}'::text[], 'garrigues-comite-gobernanza-ia', 'PI-30', 'reintento', 'CONTINUA'
  );
  select count(*) into v_after from public.obligations where code = 'OBL-RIA-ORG-05';
  if v_after <> v_before then
    raise exception 'V_IDEMPOTENTE: la segunda llamada cambió el número de filas (% -> %)', v_before, v_after;
  end if;
  if v_id is null then
    raise exception 'V_IDEMPOTENTE: la segunda llamada no devolvió el id de la fila existente';
  end if;
end $control_idempotente$;

-- 5. Verificación final que ABORTA.
do $verificacion$
declare
  v_obl int;
  v_ai int;
  v_sin_organo int;
  v_otros int;
  v_grupo_nuevo int;
begin
  select count(*) into v_obl from public.obligations where code = 'OBL-RIA-ORG-05';
  if v_obl <> 2 then raise exception 'V1: se esperaban 2 obligaciones del art. 5 y hay %', v_obl; end if;

  -- Va al módulo 'ai' del espejo (FK a grc_modules ya satisfecha: el módulo
  -- existe en los dos tenants desde 20260920130000).
  select count(*) into v_ai from public.grc_obligations
   where reference = 'OBL-RIA-ORG-05' and module_id = 'ai';
  if v_ai <> 2 then raise exception 'V2: solo % de las 2 llegaron al módulo ai', v_ai; end if;

  -- Ninguna queda sin órgano: es la condición de alta de la propia RPC.
  select count(*) into v_sin_organo from public.obligations
   where code = 'OBL-RIA-ORG-05' and owner_body_id is null;
  if v_sin_organo <> 0 then raise exception 'V3: % obligaciones del art. 5 sin órgano', v_sin_organo; end if;

  -- Control negativo: no se ha sembrado en ningún otro tenant.
  select count(*) into v_otros from public.obligations
   where code = 'OBL-RIA-ORG-05'
     and tenant_id not in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002');
  if v_otros <> 0 then raise exception 'V4: se ha sembrado en % tenants ajenos al programa', v_otros; end if;

  -- El grupo nuevo (…0003) no se toca: sembrar su OBL-RIA-* es MOI-176.
  select count(*) into v_grupo_nuevo from public.obligations
   where tenant_id = '00000000-0000-0000-0000-000000000003' and code like 'OBL-RIA-%';
  if v_grupo_nuevo <> 0 then raise exception 'V5: se ha sembrado OBL-RIA-%% en el grupo nuevo (…0003): %', v_grupo_nuevo; end if;

  -- ARGA conserva exactamente sus 6 filas previas (5 históricas + art. 4) más
  -- esta: 7. No se ha perdido ni duplicado nada.
  if (select count(*) from public.obligations where tenant_id = '00000000-0000-0000-0000-000000000001') <> 7 then
    raise exception 'V6: ARGA no tiene 7 obligaciones tras el alta';
  end if;

  raise notice 'MOI-175 F5.T5 OK: art. 5 dado de alta en los dos tenants por RPC, con órgano, en el módulo ai, sin residuo del control fail-closed';
end $verificacion$;

