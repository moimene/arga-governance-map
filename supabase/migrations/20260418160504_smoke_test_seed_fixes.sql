-- ==============================================================
-- Smoke test seed fixes — 2026-04-18
-- 1. Insert CAU meeting (needed for ACTA-CAU-001)
-- 2. Insert ACTA-CAU-001 minute (minutes table needs ≥2 rows)
-- 3. Fix regulatory_notifications deadline to be clearly in future
-- ==============================================================

-- 1. CAU meeting
INSERT INTO meetings (id, slug, tenant_id, body_id, meeting_type, scheduled_start, scheduled_end, status, confidentiality_level)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'cau-15-03-2026',
  'eed5e854-0759-4112-985c-585c1715c063',
  'd1b57c91-3698-4630-bb5c-e8c765049c6c',  -- Comisión de Auditoría
  'Ordinaria',
  '2026-03-15 09:00:00+00',
  '2026-03-15 11:00:00+00',
  'CELEBRADA',
  'INTERNA'
)
ON CONFLICT (id) DO NOTHING;

-- 2. ACTA-CAU-001 — minute for the CAU meeting
INSERT INTO minutes (id, tenant_id, meeting_id, content, signed_at, signed_by_secretary_id, is_locked, created_at)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'eed5e854-0759-4112-985c-585c1715c063',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'En Madrid, a 15 de marzo de 2026, siendo las 09:00 horas, se reúne la Comisión de Auditoría de ARGA Seguros, S.A. Se revisan los controles internos del ejercicio 2025 y el plan de auditoría interna para 2026. Se aprueba el informe de auditoría con 4 votos a favor, 0 en contra.',
  '2026-03-15 11:30:00+00',
  '1c05411b-6984-4b6d-a792-a828e6561961',
  true,
  '2026-04-18 05:00:00+00'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Fix regulatory_notifications deadline: update "Pendiente" row to a future date
UPDATE regulatory_notifications
SET notification_deadline = '2026-04-25 16:00:00+00'
WHERE status = 'Pendiente';
