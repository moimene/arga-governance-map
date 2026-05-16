-- 20260421_000029 — Backfill `minutes.body_id` / `minutes.entity_id`.
--
-- Regresión detectada en F10.2 smoke: las 2 actas demo existentes
-- (`45d23ac6-...` CdA y `b2c3d4e5-...` CAU) se crearon antes de que la
-- migración 000024 añadiera las columnas denormalizadas body_id /
-- entity_id a `minutes`. Como resultado, `EmitirCertificacionButton` en
-- `ActaDetalle.tsx` NO renderizaba porque su guard es
-- `{id && acta.entity_id ? <Button .../> : null}`.
--
-- Solución: propagar los valores desde la cadena
-- `meetings → governing_bodies → entity_id` / `meetings.body_id`. Sólo
-- actualizamos filas NULL — idempotente y safe contra re-ejecución.
--
-- No tocamos `snapshot_id` porque esas actas son pre-F8.1 (no tenían
-- motor de censo) y forzar un snapshot retroactivo rompería la cadena
-- WORM. Para certificar estas actas legacy, la RPC
-- `fn_generar_certificacion` usa COALESCE 'NO_SNAPSHOT_HASH' como gate
-- (documentado en migración 000027).

UPDATE minutes m
SET
  body_id = gb.id,
  entity_id = gb.entity_id
FROM meetings mt
JOIN governing_bodies gb ON gb.id = mt.body_id
WHERE m.meeting_id = mt.id
  AND (m.body_id IS NULL OR m.entity_id IS NULL);
