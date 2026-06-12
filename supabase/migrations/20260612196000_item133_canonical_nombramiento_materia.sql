-- ITEM-133 — Clave de materia canónica para nombramiento de consejero.
--
-- useRulePackForMateria resuelve rule_packs por .eq('materia', X) sin filtrar
-- órgano. El keying en Cloud estaba invertido:
--   * pack NOMBRAMIENTO_CONSEJERO (Junta, 1.0.1 ACTIVE) tenía materia='NOMBRAMIENTO'
--     — clave que ningún agreement_kind usa (dato muerto inalcanzable).
--   * pack NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO (Consejo, art. 244 LSC, SIN
--     versión activa) acaparaba materia='NOMBRAMIENTO_CONSEJERO'.
-- Resultado: los agreements de nombramiento por Junta (incluidos los re-apuntados en
-- ITEM-081) resolvían contra el pack de cooptación del Consejo, que además no tiene
-- versión activa.
--
-- Fix de datos: la clave canónica 'NOMBRAMIENTO_CONSEJERO' pasa a servirla el pack de
-- Junta; el pack de cooptación recibe una clave propia 'COOPTACION_CONSEJERO' (art.
-- 244 LSC) para no colisionar. Forward-only, idempotente. (El filtro por órgano en
-- useRulePackForMateria queda como mejora de código complementaria.)

-- 1) El pack de cooptación libera la clave canónica (clave propia de cooptación).
UPDATE public.rule_packs
   SET materia = 'COOPTACION_CONSEJERO'
 WHERE id = 'NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO'
   AND materia = 'NOMBRAMIENTO_CONSEJERO';

-- 2) El pack de Junta toma la clave canónica (antes 'NOMBRAMIENTO', clave muerta).
UPDATE public.rule_packs
   SET materia = 'NOMBRAMIENTO_CONSEJERO'
 WHERE id = 'NOMBRAMIENTO_CONSEJERO'
   AND materia = 'NOMBRAMIENTO';

-- Self-verify: exactamente un pack con materia canónica NOMBRAMIENTO_CONSEJERO, y es
-- el de Junta; la clave muerta 'NOMBRAMIENTO' ya no existe.
DO $$
DECLARE v_canon integer; v_dead integer; v_junta integer;
BEGIN
  SELECT count(*) INTO v_canon FROM public.rule_packs WHERE materia='NOMBRAMIENTO_CONSEJERO';
  SELECT count(*) INTO v_dead  FROM public.rule_packs WHERE materia='NOMBRAMIENTO';
  SELECT count(*) INTO v_junta FROM public.rule_packs WHERE materia='NOMBRAMIENTO_CONSEJERO' AND id='NOMBRAMIENTO_CONSEJERO';
  IF v_canon <> 1 OR v_dead <> 0 OR v_junta <> 1 THEN
    RAISE EXCEPTION 'ITEM-133 verificación fallida: canon=%, dead=%, junta=%', v_canon, v_dead, v_junta;
  END IF;
END $$;
