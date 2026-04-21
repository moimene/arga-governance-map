-- supabase/migrations/20260421_000023_capability_matrix.sql
-- T20.F1.1 — Separation of Actions (SoA) via capability_matrix.
--
-- MOTIVO: el par (SECRETARIO, CONSEJERO) WARN añadido en T19.5 era
-- jurídicamente incorrecto (la figura Secretario Consejero votante es
-- legal en LSC). Se revirtió en T19.5.1. La separación que importa no
-- es "quién es" sino "qué acción hace sobre qué acto", y eso se
-- controla con una matriz de capacidades por (role, action).
--
-- 3 acciones controladas:
--   - SNAPSHOT_CREATION: crear censo_snapshot para una sesión
--   - VOTE_EMISSION:     emitir voto en un acuerdo
--   - CERTIFICATION:     firmar una certificación (acta/acuerdo)
--
-- Principio: el motor runtime consultará capability_matrix antes de
-- permitir una acción. Si hay conflicto por (role, action, session),
-- SodGuard bloqueará la acción contextual, no el co-role en sí.
--
-- Applied to Cloud via MCP apply_migration (name: t20_1_capability_matrix)
-- on 2026-04-21. Mirrored here.

CREATE TABLE IF NOT EXISTS capability_matrix (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role       text NOT NULL,
  action     text NOT NULL CHECK (action IN ('SNAPSHOT_CREATION','VOTE_EMISSION','CERTIFICATION')),
  enabled    boolean NOT NULL DEFAULT true,
  reason     text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role, action)
);

ALTER TABLE capability_matrix ENABLE ROW LEVEL SECURITY;

-- Policy: la matriz es global (no tenant-scoped) — todos los usuarios autenticados leen.
DROP POLICY IF EXISTS p_capability_read ON capability_matrix;
CREATE POLICY p_capability_read ON capability_matrix
  FOR SELECT
  USING (true);

-- Seed: 15 filas (5 roles × 3 acciones)
INSERT INTO capability_matrix (role, action, enabled, reason) VALUES
  -- SECRETARIO: crea snapshot, certifica; NO vota (no consejero por defecto)
  ('SECRETARIO', 'SNAPSHOT_CREATION', true,  'Secretario crea el censo de la sesión'),
  ('SECRETARIO', 'VOTE_EMISSION',     false, 'Secretario no consejero no vota; si es consejero también, usar rol CONSEJERO'),
  ('SECRETARIO', 'CERTIFICATION',     true,  'Secretario firma certificaciones de acta y acuerdo'),

  -- CONSEJERO: vota; NO crea snapshot ni certifica
  ('CONSEJERO', 'SNAPSHOT_CREATION', false, 'Consejero no crea el censo; lo hace el Secretario'),
  ('CONSEJERO', 'VOTE_EMISSION',     true,  'Consejero emite voto en acuerdos'),
  ('CONSEJERO', 'CERTIFICATION',     false, 'Consejero no certifica salvo delegación expresa vía authority_evidence'),

  -- ADMIN_TENANT: superadmin, todas las acciones
  ('ADMIN_TENANT', 'SNAPSHOT_CREATION', true, 'Admin tenant puede crear snapshot (demo/soporte)'),
  ('ADMIN_TENANT', 'VOTE_EMISSION',     true, 'Admin tenant puede emitir voto (demo/soporte)'),
  ('ADMIN_TENANT', 'CERTIFICATION',     true, 'Admin tenant puede certificar (demo/soporte)'),

  -- COMPLIANCE: read-only sobre oversight; no actúa
  ('COMPLIANCE', 'SNAPSHOT_CREATION', false, 'Compliance supervisa, no actúa'),
  ('COMPLIANCE', 'VOTE_EMISSION',     false, 'Compliance supervisa, no actúa'),
  ('COMPLIANCE', 'CERTIFICATION',     false, 'Compliance supervisa, no actúa'),

  -- AUDITOR: read-only; jamás actúa
  ('AUDITOR', 'SNAPSHOT_CREATION', false, 'Auditor audita, no actúa'),
  ('AUDITOR', 'VOTE_EMISSION',     false, 'Auditor audita, no actúa'),
  ('AUDITOR', 'CERTIFICATION',     false, 'Auditor audita, no actúa')
ON CONFLICT (role, action) DO NOTHING;
