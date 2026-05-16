CREATE TABLE IF NOT EXISTS capability_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  action text NOT NULL CHECK (action IN ('SNAPSHOT_CREATION','VOTE_EMISSION','CERTIFICATION')),
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role, action)
);

ALTER TABLE capability_matrix ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_all_capability" ON capability_matrix;
CREATE POLICY "read_all_capability" ON capability_matrix FOR SELECT USING (true);

INSERT INTO capability_matrix (role, action, enabled, reason) VALUES
  ('SECRETARIO',   'SNAPSHOT_CREATION', true,  'Titular de la ordenación de la sesión (art. 106 RRM).'),
  ('ADMIN_TENANT', 'SNAPSHOT_CREATION', true,  'Rol administrativo del tenant.'),
  ('CONSEJERO',    'SNAPSHOT_CREATION', false, 'El consejero no congela el censo; lo hace el Secretario.'),
  ('CONSEJERO',    'VOTE_EMISSION',     true,  'Facultad natural del consejero.'),
  ('SECRETARIO',   'VOTE_EMISSION',     true,  'Secretario consejero vota si tiene condición CONSEJERO vigente.'),
  ('ADMIN_TENANT', 'VOTE_EMISSION',     true,  'Para operativa excepcional.'),
  ('SECRETARIO',   'CERTIFICATION',     true,  'Facultad certificante (art. 109 RRM).'),
  ('ADMIN_TENANT', 'CERTIFICATION',     true,  'Rol administrativo excepcional.'),
  ('CONSEJERO',    'CERTIFICATION',     false, 'No certifica salvo que ostente cargo de Secretario.'),
  ('COMPLIANCE',   'SNAPSHOT_CREATION', false, NULL),
  ('COMPLIANCE',   'VOTE_EMISSION',     false, NULL),
  ('COMPLIANCE',   'CERTIFICATION',     false, NULL),
  ('AUDITOR',      'SNAPSHOT_CREATION', false, NULL),
  ('AUDITOR',      'VOTE_EMISSION',     false, NULL),
  ('AUDITOR',      'CERTIFICATION',     false, NULL)
ON CONFLICT (role, action) DO NOTHING;
