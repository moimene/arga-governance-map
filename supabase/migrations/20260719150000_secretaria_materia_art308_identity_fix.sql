-- D5 — Art. 308 LSC: sinónimo de presentación, identidades funcionales distintas.
--
-- EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE y SUPRESION_PREFERENTE conservan
-- sus dos filas de materia_catalog, packs y plantillas. Esta migración solo
-- elimina su equiparación dentro de la clave funcional server-side y reconstruye
-- el índice que materializa esa semántica.

DO $preflight_art308$
DECLARE
  v_catalog_rows integer;
BEGIN
  SELECT count(DISTINCT materia)
    INTO v_catalog_rows
    FROM public.materia_catalog
   WHERE materia IN (
     'EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE',
     'SUPRESION_PREFERENTE'
   );

  IF v_catalog_rows <> 2 THEN
    RAISE EXCEPTION
      'D5: se esperaban las dos materias del art. 308 en materia_catalog; encontradas=%',
      v_catalog_rows;
  END IF;
END
$preflight_art308$;

CREATE OR REPLACE FUNCTION public.fn_secretaria_template_functional_key(
  p_tipo text,
  p_jurisdiccion text,
  p_materia text,
  p_organo_tipo text,
  p_adoption_mode text,
  p_tipo_social text
) RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  SELECT
    jsonb_build_array(
      upper(btrim(COALESCE(p_tipo, ''))),
      upper(btrim(COALESCE(p_jurisdiccion, ''))),
      CASE upper(btrim(COALESCE(p_materia, '')))
        WHEN 'AMPLIACION_CAPITAL' THEN 'AUMENTO_CAPITAL'
        WHEN 'MOD_ESTATUTOS' THEN 'MODIFICACION_ESTATUTOS'
        WHEN 'NOMBRAMIENTO_CESE' THEN 'NOMBRAMIENTO_CONSEJERO'
        WHEN 'APROBACION_PRESUPUESTOS' THEN 'APROBACION_PRESUPUESTO'
        ELSE upper(btrim(COALESCE(p_materia, '')))
      END,
      CASE upper(btrim(COALESCE(p_organo_tipo, '')))
        WHEN 'JUNTA' THEN 'JUNTA_GENERAL'
        WHEN 'CONSEJO_ADMINISTRACION' THEN 'CONSEJO_ADMIN'
        WHEN 'CONSEJO' THEN 'CONSEJO_ADMIN'
        WHEN 'ADMIN_CONJUNTA' THEN 'ADMIN_CONJUNTA_O_COAPROBADORES'
        WHEN 'ADMIN_SOLIDARIO' THEN 'ADMIN_SOLIDARIOS'
        ELSE upper(btrim(COALESCE(p_organo_tipo, '')))
      END,
      upper(btrim(COALESCE(p_adoption_mode, ''))),
      CASE upper(btrim(COALESCE(p_tipo_social, '')))
        WHEN '' THEN 'ANY'
        WHEN 'ANY' THEN 'ANY'
        ELSE upper(btrim(p_tipo_social))
      END
    )::text
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_template_functional_key(text, text, text, text, text, text)
  FROM PUBLIC, anon;

COMMENT ON FUNCTION public.fn_secretaria_template_functional_key(text, text, text, text, text, text)
  IS 'Clave funcional de plantilla. D5: EXCLUSION y SUPRESION del derecho de preferencia mantienen identidades distintas.';

-- El índice de expresión conserva valores calculados con la versión anterior
-- de la función; debe reconstruirse después del CREATE OR REPLACE.
REINDEX INDEX public.ux_plantillas_active_functional_identity;

DO $verify_art308$
DECLARE
  v_catalog_rows integer;
  v_same_identity boolean;
  v_duplicate_identities integer;
BEGIN
  SELECT count(DISTINCT materia)
    INTO v_catalog_rows
    FROM public.materia_catalog
   WHERE materia IN (
     'EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE',
     'SUPRESION_PREFERENTE'
   );

  IF v_catalog_rows <> 2 THEN
    RAISE EXCEPTION
      'D5: la migración no preservó las dos materias del art. 308; encontradas=%',
      v_catalog_rows;
  END IF;

  SELECT
    public.fn_secretaria_template_functional_key(
      'MODELO_ACUERDO',
      'ES',
      'EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE',
      'JUNTA_GENERAL',
      'MEETING',
      'ANY'
    ) =
    public.fn_secretaria_template_functional_key(
      'MODELO_ACUERDO',
      'ES',
      'SUPRESION_PREFERENTE',
      'JUNTA_GENERAL',
      'MEETING',
      'ANY'
    )
    INTO v_same_identity;

  IF v_same_identity THEN
    RAISE EXCEPTION 'D5: EXCLUSION y SUPRESION siguen compartiendo identidad funcional';
  END IF;

  SELECT count(*)
    INTO v_duplicate_identities
    FROM (
      SELECT
        tenant_id,
        public.fn_secretaria_template_functional_key(
          tipo,
          jurisdiccion,
          COALESCE(NULLIF(btrim(materia_acuerdo), ''), materia),
          organo_tipo,
          adoption_mode,
          tipo_social
        ) AS functional_key
        FROM public.plantillas_protegidas
       WHERE estado = 'ACTIVA'
       GROUP BY 1, 2
      HAVING count(*) > 1
    ) duplicates;

  IF v_duplicate_identities <> 0 THEN
    RAISE EXCEPTION
      'D5: quedan % identidades funcionales activas duplicadas tras reconstruir el índice',
      v_duplicate_identities;
  END IF;
END
$verify_art308$;
