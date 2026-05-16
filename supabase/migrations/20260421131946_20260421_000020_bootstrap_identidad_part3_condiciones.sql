-- T15 Backfill: condiciones_persona from mandates.role
-- mandates.role on Cloud has free-text with mixed casing and parentheticals
-- (e.g. "Consejera Delegada (CEO)", "presidente", "Secretaria no Consejera").
-- Normalize to the tipo_condicion CHECK vocabulary via case-insensitive LIKE.
-- VICEPRESIDENTE pattern is checked BEFORE PRESIDENTE because the former is
-- a superstring of the latter.
-- mandates.status on Cloud is 'Activo' (Spanish), not plan's 'ACTIVE'.
-- ON CONFLICT DO NOTHING (no target) skips unique violations on ux_condicion_vigente.
INSERT INTO condiciones_persona(
  tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fecha_fin
)
SELECT m.tenant_id, m.person_id, gb.entity_id, m.body_id,
       CASE
         WHEN LOWER(m.role) LIKE '%vicepresidente%'  THEN 'VICEPRESIDENTE'
         WHEN LOWER(m.role) LIKE '%presidente%'      THEN 'PRESIDENTE'
         WHEN LOWER(m.role) LIKE '%secretari%'       THEN 'SECRETARIO'
         ELSE 'CONSEJERO'
       END,
       CASE
         WHEN UPPER(COALESCE(m.status, 'ACTIVO')) IN ('ACTIVE','ACTIVO') THEN 'VIGENTE'
         ELSE 'CESADO'
       END,
       COALESCE(m.start_date, CURRENT_DATE),
       m.end_date
FROM mandates m
JOIN governing_bodies gb ON gb.id = m.body_id
WHERE m.role IS NOT NULL
ON CONFLICT DO NOTHING;
