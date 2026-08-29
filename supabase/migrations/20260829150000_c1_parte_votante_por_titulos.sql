-- C1 — `parte_votante_current.voting_weight` pasa a ponderarse por TÍTULOS.
--
-- EL DEFECTO. `fn_refresh_parte_votante_entity` calculaba
--     voting_weight = porcentaje_capital × votes_per_title
-- Con una sola clase de participaciones eso es proporcional a
-- (títulos × votos/título) y coincide salvo constante — por eso el defecto ha
-- sido invisible desde que existe la tabla (2026-04-21). Con DOS clases de
-- nominal distinto deja de coincidir, y de forma brutal: en la matriz de
-- Garrigues (art. 7 de sus Estatutos: clase A de 16.000 € con 25 votos, clase B
-- de 1 € con 1 voto) un socio de clase A pesaba 800.000 veces uno de clase B,
-- cuando el propio artículo dice que debe pesar 50 veces. La proyección dejaba a
-- la clase B sin voto de facto.
--
-- LA CORRECCIÓN. `voting_weight` pasa a ser la CUOTA DE VOTOS del titular,
-- normalizada a 100 sobre los votos computables de la entidad:
--     100 × (numero_titulos × votes_per_title) / Σ(numero_titulos × votes_per_title)
-- La suma sigue siendo 100 y la escala no cambia, así que ningún consumidor ve
-- un orden de magnitud nuevo.
--
-- `denominator_weight` NO se toca: sigue siendo `porcentaje_capital`. Es la base
-- de capital y `fn_crear_censo_snapshot` la agrega en `capital_total_base`;
-- cambiarla movería la semántica de un campo que ya viaja a registros WORM.
--
-- MEDIDO ANTES DE APLICAR, con probe en transacción y ROLLBACK:
--   ARGA Seguros  Cartera ARGA S.L.U.  69,6900 → 69,6775  (−0,012528)
--                 Mercado libre        30,3100 → 30,3225  (+0,012528)
--     Solo dos filas y solo centésimas: `porcentaje_capital` estaba redondeado a
--     dos decimales y los títulos son exactos. No es cambio de criterio.
--   Garrigues     ratio clase A / clase B   800.000,00 → 50,00   (art. 7 dice 50)
--
-- LO QUE NO TOCA:
--   - `fn_refresh_parte_votante_body`: las filas `source_type='CARGO'` son
--     un-miembro-un-voto y NO deben ponderarse por títulos — un consejero no
--     tiene títulos. `fn_secretaria_evaluate_meeting_vote` exige que cada asiento
--     pese exactamente 1 y consume solo censos POLITICO de órgano; esta
--     migración no altera esa rama ni ese contrato.
--   - Los `censo_snapshot` ya emitidos: son inmutables por trigger.
--
-- Autorizada por el usuario (opción 2) tras medir el impacto sobre ARGA.
-- Registro del criterio: docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md

CREATE OR REPLACE FUNCTION public.fn_refresh_parte_votante_entity(p_entity_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  DELETE FROM parte_votante_current
   WHERE entity_id = p_entity_id AND body_id IS NULL;

  INSERT INTO parte_votante_current(
    tenant_id, entity_id, body_id, person_id,
    source_type, source_id, voting_rights,
    voting_weight, denominator_weight
  )
  SELECT
    ch.tenant_id,
    ch.entity_id,
    NULL,
    COALESCE(rep.representative_person_id, ch.holder_person_id),
    'CAPITAL',
    ch.id,
    ch.voting_rights,
    CASE
      WHEN ch.voting_rights AND NOT ch.is_treasury
      THEN 100.0 * (COALESCE(ch.numero_titulos, 0) * COALESCE(sc.votes_per_title, 1))
           / NULLIF(SUM(CASE WHEN ch.voting_rights AND NOT ch.is_treasury
                             THEN COALESCE(ch.numero_titulos, 0) * COALESCE(sc.votes_per_title, 1)
                             ELSE 0 END) OVER (), 0)
      ELSE 0
    END,
    CASE
      WHEN NOT ch.is_treasury
      THEN COALESCE(ch.porcentaje_capital, 0)
      ELSE 0
    END
  FROM capital_holdings ch
  LEFT JOIN share_classes sc ON sc.id = ch.share_class_id
  LEFT JOIN LATERAL (
    SELECT r.representative_person_id
    FROM representaciones r
    WHERE r.represented_person_id = ch.holder_person_id
      AND r.entity_id = ch.entity_id
      AND r.scope = 'ADMIN_PJ_REPRESENTANTE'
      AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    ORDER BY r.effective_from DESC, r.id DESC
    LIMIT 1
  ) rep ON true
  WHERE ch.entity_id = p_entity_id
    AND ch.effective_to IS NULL;
END;
$function$;

COMMENT ON FUNCTION public.fn_refresh_parte_votante_entity(uuid) IS
  'Proyecta capital_holdings vigentes a parte_votante_current. voting_weight = cuota de VOTOS (titulos x votes_per_title, normalizada a 100); denominator_weight = porcentaje de capital. La rama CARGO (fn_refresh_parte_votante_body) es un-miembro-un-voto y no se pondera por titulos.';
