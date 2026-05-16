-- supabase/migrations/20260421_000024_authority_evidence_and_extensions.sql
-- T20.F1.2 + F1.3 — authority_evidence + extensiones minutes/certifications.
--
-- Corrige respecto al plan original:
--   - condiciones_persona.tipo_condicion (NO `role`)
--   - estado = 'VIGENTE' (NO 'ACTIVE')
--
-- authority_evidence es el libro computable de cargos vigentes con
-- capacidad certificante. Se alimenta desde condiciones_persona vía
-- trigger fn_sync_authority_evidence que solo actúa para cargos
-- certificantes: ADMIN_UNICO/SOLIDARIO/MANCOMUNADO, PRESIDENTE,
-- VICEPRESIDENTE, SECRETARIO, CONSEJERO_COORDINADOR.
--
-- UNIQUE INDEX con COALESCE(body_id, sentinel) porque body_id
-- puede ser NULL (administradores no-colegiados) y los índices
-- parciales separados complicarían los conflictos ON CONFLICT.
--
-- minutes gana: snapshot_id, content_hash, rules_applied, body_id, entity_id
-- certifications gana: tipo_certificacion, certificante_role,
--   visto_bueno_persona_id/_fecha, tsq_token, gate_hash,
--   hash_certificacion, authority_evidence_id
--
-- Applied to Cloud via MCP apply_migration
-- (name: t20_1_authority_evidence_and_extensions) on 2026-04-21.
-- Mirrored here.

-- ============================================================
-- F1.2a — authority_evidence
-- ============================================================
CREATE TABLE IF NOT EXISTS authority_evidence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL,
  entity_id           uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body_id             uuid REFERENCES governing_bodies(id) ON DELETE CASCADE,
  person_id           uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  cargo               text NOT NULL,
  fecha_inicio        date NOT NULL,
  fecha_fin           date,
  fuente_designacion  text NOT NULL CHECK (
    fuente_designacion IN ('ACTA_NOMBRAMIENTO','ESCRITURA','DECISION_UNIPERSONAL','BOOTSTRAP')
  ),
  inscripcion_rm_referencia text,
  inscripcion_rm_fecha date,
  estado              text NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE','CESADO')),
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_authority_vigente
  ON authority_evidence (
    tenant_id, entity_id,
    COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid),
    person_id, cargo
  )
  WHERE estado = 'VIGENTE';

CREATE INDEX IF NOT EXISTS idx_authority_entity_body
  ON authority_evidence (entity_id, body_id)
  WHERE estado = 'VIGENTE';

CREATE INDEX IF NOT EXISTS idx_authority_person
  ON authority_evidence (person_id)
  WHERE estado = 'VIGENTE';

ALTER TABLE authority_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_authority_tenant ON authority_evidence;
CREATE POLICY p_authority_tenant ON authority_evidence
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ============================================================
-- F1.2b — fn_cargo_vigente helper
-- ============================================================
CREATE OR REPLACE FUNCTION fn_cargo_vigente(
  p_person_id uuid,
  p_entity_id uuid,
  p_body_id   uuid,
  p_cargos    text[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM authority_evidence
    WHERE person_id = p_person_id
      AND entity_id = p_entity_id
      AND COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(p_body_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND cargo = ANY (p_cargos)
      AND estado = 'VIGENTE'
  );
$$;

-- ============================================================
-- F1.2c — Extend condiciones_persona con fuente_designacion + inscripcion_rm
-- ============================================================
ALTER TABLE condiciones_persona
  ADD COLUMN IF NOT EXISTS fuente_designacion text,
  ADD COLUMN IF NOT EXISTS inscripcion_rm_referencia text,
  ADD COLUMN IF NOT EXISTS inscripcion_rm_fecha date;

ALTER TABLE condiciones_persona
  DROP CONSTRAINT IF EXISTS chk_condicion_fuente_designacion;
ALTER TABLE condiciones_persona
  ADD CONSTRAINT chk_condicion_fuente_designacion
  CHECK (fuente_designacion IS NULL OR fuente_designacion IN (
    'ACTA_NOMBRAMIENTO','ESCRITURA','DECISION_UNIPERSONAL','BOOTSTRAP'
  ));

-- ============================================================
-- F1.2d — fn_sync_authority_evidence trigger
-- ============================================================
CREATE OR REPLACE FUNCTION fn_sync_authority_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cargos_certificantes text[] := ARRAY[
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','CONSEJERO_COORDINADOR'
  ];
BEGIN
  IF TG_OP = 'INSERT' AND NEW.tipo_condicion = ANY (v_cargos_certificantes) THEN
    INSERT INTO authority_evidence (
      tenant_id, entity_id, body_id, person_id, cargo,
      fecha_inicio, fecha_fin,
      fuente_designacion, estado
    ) VALUES (
      NEW.tenant_id, NEW.entity_id, NEW.body_id, NEW.person_id, NEW.tipo_condicion,
      NEW.fecha_inicio, NEW.fecha_fin,
      COALESCE(NEW.fuente_designacion, 'BOOTSTRAP'),
      NEW.estado
    )
    ON CONFLICT (tenant_id, entity_id,
      (COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)),
      person_id, cargo)
    WHERE estado = 'VIGENTE'
    DO NOTHING;

  ELSIF TG_OP = 'UPDATE' AND NEW.tipo_condicion = ANY (v_cargos_certificantes) THEN
    IF NEW.estado = 'CESADO' AND OLD.estado = 'VIGENTE' THEN
      UPDATE authority_evidence
      SET estado = 'CESADO', fecha_fin = COALESCE(NEW.fecha_fin, CURRENT_DATE), updated_at = now()
      WHERE tenant_id = NEW.tenant_id
        AND entity_id = NEW.entity_id
        AND COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(NEW.body_id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND person_id = NEW.person_id
        AND cargo = NEW.tipo_condicion
        AND estado = 'VIGENTE';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_authority_evidence ON condiciones_persona;
CREATE TRIGGER trg_sync_authority_evidence
  AFTER INSERT OR UPDATE ON condiciones_persona
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_authority_evidence();

-- ============================================================
-- F1.2e — Backfill desde condiciones_persona VIGENTES
-- ============================================================
INSERT INTO authority_evidence (
  tenant_id, entity_id, body_id, person_id, cargo,
  fecha_inicio, fecha_fin, fuente_designacion, estado
)
SELECT
  cp.tenant_id, cp.entity_id, cp.body_id, cp.person_id, cp.tipo_condicion,
  cp.fecha_inicio, cp.fecha_fin,
  'BOOTSTRAP',
  cp.estado
FROM condiciones_persona cp
WHERE cp.tipo_condicion IN (
  'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
  'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','CONSEJERO_COORDINADOR'
)
  AND cp.estado = 'VIGENTE'
ON CONFLICT DO NOTHING;

-- ============================================================
-- F1.3a — Extend minutes
-- ============================================================
ALTER TABLE minutes
  ADD COLUMN IF NOT EXISTS snapshot_id uuid REFERENCES censo_snapshot(id),
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS rules_applied jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS body_id uuid REFERENCES governing_bodies(id),
  ADD COLUMN IF NOT EXISTS entity_id uuid REFERENCES entities(id);

CREATE INDEX IF NOT EXISTS idx_minutes_snapshot ON minutes(snapshot_id) WHERE snapshot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_minutes_body_entity ON minutes(body_id, entity_id);

-- ============================================================
-- F1.3b — Extend certifications
-- ============================================================
ALTER TABLE certifications
  ADD COLUMN IF NOT EXISTS tipo_certificacion text
    CHECK (tipo_certificacion IS NULL OR tipo_certificacion IN (
      'ACTA','ACUERDO','ACUERDO_EXTRAIDO','UNIPERSONAL','NO_SESSION'
    )),
  ADD COLUMN IF NOT EXISTS certificante_role text
    CHECK (certificante_role IS NULL OR certificante_role IN (
      'SECRETARIO','PRESIDENTE','VICEPRESIDENTE','VICESECRETARIO',
      'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','CONSEJERO_COORDINADOR'
    )),
  ADD COLUMN IF NOT EXISTS visto_bueno_persona_id uuid REFERENCES persons(id),
  ADD COLUMN IF NOT EXISTS visto_bueno_fecha timestamptz,
  ADD COLUMN IF NOT EXISTS tsq_token bytea,
  ADD COLUMN IF NOT EXISTS gate_hash text,
  ADD COLUMN IF NOT EXISTS hash_certificacion text,
  ADD COLUMN IF NOT EXISTS authority_evidence_id uuid REFERENCES authority_evidence(id);

CREATE INDEX IF NOT EXISTS idx_certifications_authority
  ON certifications(authority_evidence_id)
  WHERE authority_evidence_id IS NOT NULL;
