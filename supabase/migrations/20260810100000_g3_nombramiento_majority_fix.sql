-- Review final G3 I-2 — corrige el guardrail de mayoría de
-- NOMBRAMIENTO_ADMINISTRADOR_UNICO. El seed 20260804080000_g3_slp_materias.sql
-- (migración ya aplicada, no se muta) insertó min_majority_code='SIMPLE',
-- que contradice el pack activo (rule_pack_versions payload de
-- NOMBRAMIENTO_ADMINISTRADOR_UNICO: votacion.mayoria.SL.formula =
-- "favor >= 2/3_votos_totales", referencia "art. 30.2.a) Estatutos").
--
-- fn_majority_level/fn_validar_no_rebaja_ley (migración 000034) usan esta
-- columna como suelo de trg_agreements_majority_check: con min_majority_code
-- ='SIMPLE' (nivel 1) el guardrail dejaría pasar un acuerdo aprobado por
-- mayoría simple aunque el pack exija 2/3 (nivel 2). Corrige el suelo a
-- REFORZADA_2_3 para que coincida con el pack.
--
-- Forward-only, idempotente (WHERE acota al valor erróneo — mismo patrón que
-- 20260612100000_item014_transmision_participaciones_mayoria_ordinaria.sql).

UPDATE public.materia_catalog
SET min_majority_code = 'REFORZADA_2_3'
WHERE materia = 'NOMBRAMIENTO_ADMINISTRADOR_UNICO'
  AND min_majority_code = 'SIMPLE';

DO $assert$
DECLARE
  v_code text;
BEGIN
  SELECT min_majority_code INTO v_code
    FROM public.materia_catalog
   WHERE materia = 'NOMBRAMIENTO_ADMINISTRADOR_UNICO';

  IF v_code IS DISTINCT FROM 'REFORZADA_2_3' THEN
    RAISE EXCEPTION 'g3 nombramiento majority fix: min_majority_code esperado REFORZADA_2_3, encontrado %', v_code;
  END IF;
END;
$assert$;
