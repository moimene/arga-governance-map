-- 20260421_000029 — Backfill `minutes.body_id` / `minutes.entity_id`.
-- Regresión detectada en F10.2 smoke: las actas demo pre-F8.1 tenían
-- body_id/entity_id NULL, lo que hacía que EmitirCertificacionButton no
-- renderizara. Propagamos desde meetings → governing_bodies.

UPDATE minutes m
SET
  body_id = gb.id,
  entity_id = gb.entity_id
FROM meetings mt
JOIN governing_bodies gb ON gb.id = mt.body_id
WHERE m.meeting_id = mt.id
  AND (m.body_id IS NULL OR m.entity_id IS NULL);
