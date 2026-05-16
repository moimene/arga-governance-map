CREATE OR REPLACE FUNCTION fn_refresh_parte_votante_entity(p_entity_id UUID)
RETURNS VOID AS $$
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
      THEN COALESCE(ch.porcentaje_capital, 0) * COALESCE(sc.votes_per_title, 1)
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
$$ LANGUAGE plpgsql;
