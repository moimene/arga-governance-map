-- Defensa en profundidad de la activación de plantillas (Codex adversarial P1-1)
--
-- El Gate PRE que exige órgano, forma de adopción y referencia legal vive en el
-- cliente. La RPC `fn_secretaria_transition_template_state` validaba únicamente
-- los datos de aprobación formal, de modo que una llamada directa (service_role,
-- o un cliente que se saltara el gate) podía dejar ACTIVA una plantilla sin
-- forma de adopción — y una plantilla sin forma de adopción queda fuera del
-- enrutado documental correcto.
--
-- Esta migración añade la comprobación en el servidor con EXACTAMENTE el mismo
-- criterio que `template-admin/metadata-policy.ts`:
--   · organo_tipo: siempre exigido.
--   · adoption_mode: exigido salvo tipos no adoptables (certificaciones,
--     informes, documentos registrales) — NON_ADOPTABLE_DOCUMENT_TYPES.
--   · referencia_legal: exigida salvo informes de soporte interno —
--     LEGAL_REFERENCE_EXEMPTIBLE_TYPES + organo_tipo SOPORTE_INTERNO.
--
-- Forward-only. No modifica filas. Verificado antes de aplicar: 0 plantillas
-- ACTIVA incumplen el criterio y 0 activaciones pendientes quedarían bloqueadas.

CREATE OR REPLACE FUNCTION public.fn_secretaria_template_activation_metadata_ok(
  p_tipo text,
  p_organo_tipo text,
  p_adoption_mode text,
  p_referencia_legal text
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT CASE
    WHEN NULLIF(btrim(COALESCE(p_organo_tipo, '')), '') IS NULL THEN 'organo_tipo'
    WHEN upper(btrim(COALESCE(p_tipo, ''))) NOT IN (
           'CERTIFICACION',
           'INFORME_PRECEPTIVO',
           'INFORME_DOCUMENTAL_PRE',
           'INFORME_GESTION',
           'DOCUMENTO_REGISTRAL',
           'SUBSANACION_REGISTRAL'
         )
         AND NULLIF(btrim(COALESCE(p_adoption_mode, '')), '') IS NULL
      THEN 'adoption_mode'
    WHEN NOT (
           upper(btrim(COALESCE(p_tipo, ''))) IN (
             'INFORME_PRECEPTIVO',
             'INFORME_DOCUMENTAL_PRE',
             'INFORME_GESTION'
           )
           AND upper(btrim(COALESCE(p_organo_tipo, ''))) = 'SOPORTE_INTERNO'
         )
         AND NULLIF(btrim(COALESCE(p_referencia_legal, '')), '') IS NULL
      THEN 'referencia_legal'
    ELSE NULL
  END
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_template_activation_metadata_ok(text, text, text, text)
  FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- Guard en el trigger de transición de estado: cubre TODO camino de escritura,
-- incluida la RPC SECURITY DEFINER y cualquier llamada con service_role.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_secretaria_guard_template_state_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_missing text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado <> 'BORRADOR'
       AND COALESCE(current_setting('app.secretaria_template_state_transition', true), '') = '' THEN
      RAISE EXCEPTION 'template state must be initialized through governed workflow'
        USING ERRCODE = '42501';
    END IF;
    -- Un INSERT autorizado por GUC tampoco puede nacer vigente sin metadatos.
    IF NEW.estado = 'ACTIVA' THEN
      v_missing := public.fn_secretaria_template_activation_metadata_ok(
        NEW.tipo, NEW.organo_tipo, NEW.adoption_mode, NEW.referencia_legal
      );
      IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION
          'ACTIVATION_METADATA_MISSING: la plantilla no puede nacer vigente sin %', v_missing
          USING ERRCODE = '23514';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'template tenant_id is immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.estado IS DISTINCT FROM NEW.estado
     AND COALESCE(current_setting('app.secretaria_template_state_transition', true), '') = '' THEN
    RAISE EXCEPTION 'direct template state transition forbidden; use governed RPC'
      USING ERRCODE = '42501';
  END IF;

  -- Codex adversarial (P1-1): metadatos mínimos para estar vigente. Espeja
  -- template-admin/metadata-policy.ts; sin esto la RPC podía activar una
  -- plantilla sin forma de adopción.
  --
  -- Se comprueba en TODA fila que quede ACTIVA, no solo al entrar en ese
  -- estado: un UPDATE ACTIVA→ACTIVA podía vaciar `adoption_mode` y dejar
  -- vigente una plantilla sin forma de adopción sin pasar por la transición.
  IF NEW.estado = 'ACTIVA' THEN
    v_missing := public.fn_secretaria_template_activation_metadata_ok(
      NEW.tipo,
      NEW.organo_tipo,
      NEW.adoption_mode,
      NEW.referencia_legal
    );
    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION
        'ACTIVATION_METADATA_MISSING: la plantilla no puede quedar vigente sin %', v_missing
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

-- ---------------------------------------------------------------------------
-- Verificación: ninguna plantilla vigente incumple el criterio recién impuesto.
-- ---------------------------------------------------------------------------

DO $verify_activation_metadata$
DECLARE
  v_bad integer;
BEGIN
  SELECT count(*) INTO v_bad
    FROM public.plantillas_protegidas
   WHERE estado = 'ACTIVA'
     AND public.fn_secretaria_template_activation_metadata_ok(
           tipo, organo_tipo, adoption_mode, referencia_legal
         ) IS NOT NULL;
  IF v_bad <> 0 THEN
    RAISE EXCEPTION
      'Guard de activación: % plantillas vigentes incumplen los metadatos mínimos; sanear antes de imponer el guard',
      v_bad;
  END IF;
END
$verify_activation_metadata$;
