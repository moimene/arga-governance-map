begin;

-- MOI-164 (F8.T1 adelantado): enlace risks -> ai_systems.
--
-- CONTEXTO: `risks` no tenía columna hacia `ai_systems`. ARGA tiene tres
-- riesgos de IA (RSK-TECH-005, RSK-TECH-006, RSK-STRA-005) sin sistema, sin
-- obligación y sin owner; la relación con AIMS solo constaba escrita a mano
-- en la descripción de RSK-TECH-005 ("Handoff AIMS"). Este es el mecanismo
-- de enlace de F8.T1 (columna nullable con FK), no la tabla `grc_ai_links`
-- de F8.T2 (many-to-many), porque el issue MOI-164 encarga explícitamente
-- F8.T1 y F8.T3; F8.T2 completo (rebaja de residual en el editor de riesgos)
-- queda en MOI-180.
--
-- DECLARADO (MOI-164, "no inventar enlaces que la fuente no permita deducir
-- con certeza"): medido en Cloud el 2026-09-26, NINGUNO de los tres riesgos
-- de IA de ARGA se enlaza en esta migración —
--   * RSK-TECH-005 "AI Act sistemas no clasificados" nombra TRES categorías
--     de sistema en plural ("scoring fraude, pricing, claims handling"): no
--     hay un único sistema inventariado que la descripción señale con
--     certeza, y una columna singular no puede representar una relación
--     plural sin inventar cuál de los varios candidatos (ARGA Score,
--     FraudGuard, Motor de triaje) es "el" sistema.
--   * RSK-TECH-006 "Shadow IT uso GenAI sin gobierno" describe el uso NO
--     gobernado de herramientas externas (ChatGPT, Copilot) por el propio
--     negocio: por construcción no es ninguno de los sistemas inventariados
--     en `ai_systems`, que están todos dados de alta y gobernados.
--   * RSK-STRA-005 "Pricing automatizado ML modelo único": no hay ningún
--     sistema de pricing de automóvil inventariado en `ai_systems` (medido:
--     0 filas con ese use_case), tal y como ya recogía la especificación
--     F8.T2 (docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md).
-- El mecanismo queda construido y probado para cuando exista un enlace
-- cierto; la columna nace NULL en las tres filas conocidas.

-- 1. Columna nullable con FK a ai_systems. ON DELETE SET NULL: borrar un
--    sistema no debe arrastrar ni bloquear el riesgo que lo describía.
ALTER TABLE public.risks
  ADD COLUMN IF NOT EXISTS ai_system_id uuid REFERENCES public.ai_systems(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.risks.ai_system_id IS
  'Sistema de IA (ai_systems.id) que este riesgo describe, MOI-164 F8.T1. '
  'NULL salvo que la descripción del riesgo señale un único sistema con '
  'certeza — no se infiere ni se adivina. Coherencia de tenant forzada por '
  'trg_risks_ai_system_tenant_guard.';

CREATE INDEX IF NOT EXISTS idx_risks_ai_system_id
  ON public.risks (ai_system_id)
  WHERE ai_system_id IS NOT NULL;

-- 2. Coherencia de tenant. Un CHECK no puede mirar otra tabla en Postgres;
--    el guardia va por trigger, mismo patrón que
--    fn_secretaria_book_section_tenant_guard (20260719140000).
CREATE OR REPLACE FUNCTION public.fn_risks_ai_system_tenant_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_system_tenant uuid;
BEGIN
  IF NEW.ai_system_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id INTO v_system_tenant
    FROM public.ai_systems
   WHERE id = NEW.ai_system_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'risks.ai_system_id: sistema % no encontrado', NEW.ai_system_id
      USING ERRCODE = '23503';
  END IF;

  IF v_system_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'risks.ai_system_id: sistema % pertenece a otro tenant', NEW.ai_system_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_risks_ai_system_tenant_guard ON public.risks;
CREATE TRIGGER trg_risks_ai_system_tenant_guard
  BEFORE INSERT OR UPDATE OF ai_system_id, tenant_id ON public.risks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_risks_ai_system_tenant_guard();

REVOKE EXECUTE ON FUNCTION public.fn_risks_ai_system_tenant_guard() FROM anon, authenticated;

-- 3. Defensivo, aunque ya sin efecto: `risks` no concedía TRUNCATE/TRIGGER/
--    REFERENCES a anon/authenticated antes de esta migración (medido), y
--    20260924180000 los revocó ya en TODAS las tablas de public más el
--    default privileges de `postgres` para tablas futuras. Este ALTER TABLE
--    no vuelve a conceder nada (no crea la tabla, solo añade una columna) —
--    se deja explícito por claridad de la migración, no porque haga falta.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON public.risks FROM anon, authenticated;

-- 4. Verificación que aborta si el resultado no es el esperado, con control
--    positivo del propio instrumento (el guardia SÍ bloquea un cross-tenant,
--    y SÍ deja pasar un enlace del mismo tenant).
DO $verificacion$
DECLARE
  v_col_existe boolean;
  v_fk_existe boolean;
  v_residuales int;
  v_arga_tenant uuid := '00000000-0000-0000-0000-000000000001';
  v_garrigues_tenant uuid := '00000000-0000-0000-0000-000000000002';
  v_arga_system uuid;
  v_garrigues_system uuid;
  v_probe_id uuid := '00000000-0000-0000-0000-0000d00e0164';
  v_bloqueo_disparado boolean := false;
  v_insert_no_bloqueado boolean := false;
  v_tras_ok uuid;
BEGIN
  -- 4.1 La columna existe con el tipo correcto.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'risks'
       AND column_name = 'ai_system_id' AND data_type = 'uuid'
  ) INTO v_col_existe;
  IF NOT v_col_existe THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: risks.ai_system_id no existe o no es uuid';
  END IF;

  -- 4.2 La FK hacia ai_systems existe.
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.risks'::regclass
       AND confrelid = 'public.ai_systems'::regclass
       AND contype = 'f'
  ) INTO v_fk_existe;
  IF NOT v_fk_existe THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: falta la FK risks.ai_system_id -> ai_systems.id';
  END IF;

  -- 4.3 Ningún privilegio residual de TRUNCATE/TRIGGER/REFERENCES sobre risks.
  SELECT count(*) INTO v_residuales
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'risks'
     AND grantee IN ('anon', 'authenticated')
     AND privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  IF v_residuales <> 0 THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: risks conserva % privilegios residuales', v_residuales;
  END IF;

  -- 4.4 Control positivo del guardia de tenant: un sistema de cada tenant.
  SELECT id INTO v_arga_system FROM public.ai_systems WHERE tenant_id = v_arga_tenant LIMIT 1;
  SELECT id INTO v_garrigues_system FROM public.ai_systems WHERE tenant_id = v_garrigues_tenant LIMIT 1;

  IF v_arga_system IS NULL OR v_garrigues_system IS NULL THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: no hay sistema de prueba en alguno de los dos tenants (arga=%, garrigues=%)',
      v_arga_system, v_garrigues_system;
  END IF;

  -- Fila de prueba de ARGA enlazada a un sistema de Garrigues: el guardia
  -- debe RECHAZARLO. La detección de "no se rechazó" vive FUERA de este
  -- bloque: un RAISE EXCEPTION disparado dentro caería en su propio
  -- EXCEPTION WHEN OTHERS y quedaría absorbido como si fuera el bloqueo
  -- esperado, dejando pasar el propio fallo que se quiere detectar.
  BEGIN
    INSERT INTO public.risks (id, tenant_id, code, title, ai_system_id)
    VALUES (v_probe_id, v_arga_tenant, '__PROBE_MOI164__', 'Sonda temporal MOI-164', v_garrigues_system);
    v_insert_no_bloqueado := true;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'risks.ai_system_id:%pertenece a otro tenant%' THEN
        v_bloqueo_disparado := true;
      ELSE
        RAISE;
      END IF;
  END;

  IF v_insert_no_bloqueado THEN
    DELETE FROM public.risks WHERE id = v_probe_id;
    RAISE EXCEPTION 'VERIFICACION MOI-164: el guardia de tenant NO bloqueó un enlace cross-tenant';
  END IF;

  IF NOT v_bloqueo_disparado THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: el guardia de tenant no se disparó como se esperaba';
  END IF;

  -- Control positivo simétrico: el mismo tenant SÍ debe poder enlazar.
  INSERT INTO public.risks (id, tenant_id, code, title, ai_system_id)
  VALUES (v_probe_id, v_arga_tenant, '__PROBE_MOI164__', 'Sonda temporal MOI-164', v_arga_system)
  RETURNING ai_system_id INTO v_tras_ok;

  DELETE FROM public.risks WHERE id = v_probe_id;

  IF v_tras_ok IS DISTINCT FROM v_arga_system THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: un enlace del mismo tenant no se aceptó como se esperaba';
  END IF;

  -- Ninguna fila de sonda debe sobrevivir a esta migración.
  IF EXISTS (SELECT 1 FROM public.risks WHERE id = v_probe_id) THEN
    RAISE EXCEPTION 'VERIFICACION MOI-164: quedó residuo de la sonda en risks';
  END IF;
END;
$verificacion$;


-- Comprobaciones adicionales del ensayo (además del bloque de verificación de la propia migración).
select column_name, data_type from information_schema.columns where table_schema='public' and table_name='risks' and column_name='ai_system_id';
select count(*) as fk_count from pg_constraint where conrelid='public.risks'::regclass and confrelid='public.ai_systems'::regclass and contype='f';
select code, ai_system_id from public.risks where code in ('RSK-TECH-005','RSK-TECH-006','RSK-STRA-005') order by code;

rollback;
