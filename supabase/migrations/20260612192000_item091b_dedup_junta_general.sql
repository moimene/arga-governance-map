-- ITEM-091b — Deduplicación de la Junta General de Accionistas de ARGA.
--
-- Existían dos órganos 'Junta General de Accionistas' en ARGA Seguros:
--   * 4d7996ad-...-04dcf04d4c (slug junta-general-arga-seguros) — CANÓNICO: tiene
--     los 2 miembros (condiciones VIGENTE) y UUID determinista de seed.
--   * e288fe36-...-89fe35405b50 (slug junta-accionistas) — DUPLICADO: 0 miembros,
--     pero con 2 meetings reales de demo (1 CELEBRADA, 1 CONVOCADA) y 1 libro.
--
-- Se consolidan reapuntando los meetings y el libro del duplicado al canónico y se
-- elimina el duplicado (que queda sin dependientes). Los meetings conservan sus
-- hijos (actas/resoluciones/agreements referencian meeting_id, no body_id). El
-- libro no cambia su clave única (entity_id/book_kind/period/volume), solo su
-- body_id. Forward-only, idempotente.

UPDATE public.meetings
   SET body_id = '4d7996ad-d4ca-5a4f-a182-6044dcf04d4c'
 WHERE body_id = 'e288fe36-3846-49ba-91d8-89fe35405b50';

UPDATE public.mandatory_books
   SET body_id = '4d7996ad-d4ca-5a4f-a182-6044dcf04d4c'
 WHERE body_id = 'e288fe36-3846-49ba-91d8-89fe35405b50';

DELETE FROM public.governing_bodies
 WHERE id = 'e288fe36-3846-49ba-91d8-89fe35405b50';

-- Self-verify: una sola JGA en ARGA y el duplicado eliminado.
DO $$
DECLARE v_dup integer; v_jga integer;
BEGIN
  SELECT count(*) INTO v_dup FROM public.governing_bodies WHERE id = 'e288fe36-3846-49ba-91d8-89fe35405b50';
  SELECT count(*) INTO v_jga FROM public.governing_bodies
   WHERE entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602' AND name = 'Junta General de Accionistas';
  IF v_dup <> 0 OR v_jga <> 1 THEN
    RAISE EXCEPTION 'ITEM-091b verificación fallida: duplicado=%, jga_count=%', v_dup, v_jga;
  END IF;
END $$;
