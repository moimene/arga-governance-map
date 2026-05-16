-- T16 Backfill: capital_holdings desde mandates.porcentaje_capital
-- ON CONFLICT DO NOTHING (sin target) salta violaciones del índice parcial
-- ux_capital_holdings_vigente en re-apply. share_class_id queda NULL (el
-- index usa COALESCE(share_class_id, zero-uuid) para deduplicar).
INSERT INTO capital_holdings(
  tenant_id, entity_id, holder_person_id,
  numero_titulos, porcentaje_capital, voting_rights, effective_from
)
SELECT m.tenant_id, gb.entity_id, m.person_id,
       COALESCE(m.capital_participacion, 0),
       m.porcentaje_capital,
       COALESCE(m.tiene_derecho_voto, true),
       COALESCE(m.start_date, CURRENT_DATE)
FROM mandates m
JOIN governing_bodies gb ON gb.id = m.body_id
WHERE m.porcentaje_capital IS NOT NULL
ON CONFLICT DO NOTHING;
