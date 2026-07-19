-- Paridad de normalización cliente/servidor en el guard de activación.
--
-- `20260718140000` impuso en el servidor los metadatos mínimos para que una
-- plantilla quede vigente, pero comparaba el tipo con `upper(btrim(...))` a
-- secas, mientras el cliente normaliza con `normalizeMetadataCode`
-- (template-admin/metadata-policy.ts): sin tildes y con puntos, espacios,
-- barras y guiones colapsados a "_".
--
-- La divergencia: un `tipo` como "informe-preceptivo" queda exento en el
-- cliente, pero el servidor lo trataba como tipo desconocido y exigía forma de
-- adopción. Es decir, las dos capas contaban cosas distintas — justo lo que este
-- guard existe para evitar.
--
-- Forward-only: reemplaza las dos funciones por su versión con normalización
-- canónica y no modifica ninguna fila. Verificado antes de aplicar: las 72
-- plantillas vigentes siguen cumpliendo el criterio.

CREATE OR REPLACE FUNCTION public.fn_secretaria_normalize_metadata_code(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $function$
  -- `translate` en vez de la extensión `unaccent`: es IMMUTABLE sin depender de
  -- un diccionario instalado, y el vocabulario de códigos es ASCII + tildes
  -- castellanas.
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        upper(btrim(translate(
          COALESCE(p_value, ''),
          'ÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇáàäâãéèëêíìïîóòöôõúùüûñç',
          'AAAAAEEEEIIIIOOOOOUUUUNCaaaaaeeeeiiiiooooouuuunc'
        ))),
        '[.[:space:]/-]+', '_', 'g'
      ),
      '_+', '_', 'g'
    ),
    '_'
  )
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_normalize_metadata_code(text) FROM PUBLIC, anon;

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
    WHEN public.fn_secretaria_normalize_metadata_code(p_tipo) NOT IN (
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
           public.fn_secretaria_normalize_metadata_code(p_tipo) IN (
             'INFORME_PRECEPTIVO',
             'INFORME_DOCUMENTAL_PRE',
             'INFORME_GESTION'
           )
           AND public.fn_secretaria_normalize_metadata_code(p_organo_tipo) = 'SOPORTE_INTERNO'
         )
         AND NULLIF(btrim(COALESCE(p_referencia_legal, '')), '') IS NULL
      THEN 'referencia_legal'
    ELSE NULL
  END
$function$;

REVOKE ALL ON FUNCTION public.fn_secretaria_template_activation_metadata_ok(text, text, text, text)
  FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- Verificación: ninguna plantilla vigente incumple el criterio normalizado.
-- ---------------------------------------------------------------------------

DO $verify_normalization_parity$
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
      'Paridad de normalización: % plantillas vigentes incumplen el criterio; sanear antes de aplicar',
      v_bad;
  END IF;
END
$verify_normalization_parity$;
