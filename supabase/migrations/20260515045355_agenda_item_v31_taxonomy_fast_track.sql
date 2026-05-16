-- Migration: 20260515045355_agenda_item_v31_taxonomy_fast_track.sql
--
-- Secretaría 360 v3.1 — agenda item taxonomy + agreement anchoring.
--
-- Extends agenda_items.kind from the v1.3 triad
--   INFORMATIVO / DELIBERATIVO / DECISORIO
-- to the legal-operational taxonomy validated for Motor de Acuerdos:
--   DECISORIO, INFORMATIVO, TOMA_DE_RAZON, DELIBERATIVO,
--   ACEPTACION_INFORME, RUEGOS_PREGUNTAS.
--
-- Also adds a first-class agreements.agenda_item_id anchor while preserving the
-- legacy execution_mode.agenda_item_index path for already materialized data.

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- agenda_items: v3.1 taxonomy + operational metadata
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_kind_check;

ALTER TABLE agenda_items
  ADD CONSTRAINT agenda_items_kind_check
  CHECK (kind IN (
    'DECISORIO',
    'INFORMATIVO',
    'TOMA_DE_RAZON',
    'DELIBERATIVO',
    'ACEPTACION_INFORME',
    'RUEGOS_PREGUNTAS'
  ));

ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS requires_attachments boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_vote text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

ALTER TABLE agenda_items
  DROP CONSTRAINT IF EXISTS agenda_items_requires_vote_check;

ALTER TABLE agenda_items
  ADD CONSTRAINT agenda_items_requires_vote_check
  CHECK (requires_vote IN ('NONE', 'ASSENT', 'BINDING'));

COMMENT ON COLUMN agenda_items.kind IS
  'Naturaleza jurídica-operativa del punto: DECISORIO produce Acuerdo 360; INFORMATIVO/TOMA_DE_RAZON/DELIBERATIVO/ACEPTACION_INFORME/RUEGOS_PREGUNTAS se reflejan en acta como constancia sin FULL_GATE de validez societaria.';
COMMENT ON COLUMN agenda_items.requires_attachments IS
  'Indica si el punto requiere documentación soporte previa o anexa (informes, documentación de soporte, preguntas/respuestas).';
COMMENT ON COLUMN agenda_items.requires_vote IS
  'Solo para ACEPTACION_INFORME: NONE, ASSENT o BINDING. ASSENT/BINDING documentan conformidad sin materializar Acuerdo 360 salvo reclasificación a DECISORIO.';

-- ──────────────────────────────────────────────────────────────────────────────
-- meeting_resolutions: outcome vocabulary for non-decision agenda items
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE meeting_resolutions
  DROP CONSTRAINT IF EXISTS meeting_resolutions_kind_resolution_check;

ALTER TABLE meeting_resolutions
  ADD CONSTRAINT meeting_resolutions_kind_resolution_check
  CHECK (kind_resolution IN (
    'DECISION',
    'INFORMATION_NOTED',
    'ACKNOWLEDGEMENT_NOTED',
    'DELIBERATION_OUTCOME',
    'REPORT_ACCEPTED',
    'QUESTIONS_ANSWERS'
  ));

COMMENT ON COLUMN meeting_resolutions.kind_resolution IS
  'Outcome del punto: DECISION solo para agenda_items.kind=DECISORIO; el resto documenta constancias no decisorias sin Acuerdo 360.';

-- ──────────────────────────────────────────────────────────────────────────────
-- Constancia enriquecida para puntos no decisorios
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda_item_constancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agenda_item_id uuid NOT NULL REFERENCES agenda_items(id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'INFORMATIVO',
    'TOMA_DE_RAZON',
    'DELIBERATIVO',
    'ACEPTACION_INFORME',
    'RUEGOS_PREGUNTAS'
  )),
  summary text,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agenda_item_constancias_kind_matches_non_decision
    CHECK (kind <> 'DECISORIO')
);

CREATE INDEX IF NOT EXISTS idx_agenda_item_constancias_meeting
  ON agenda_item_constancias(tenant_id, meeting_id, agenda_item_id);

ALTER TABLE agenda_item_constancias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_item_constancias_tenant_read ON agenda_item_constancias;
CREATE POLICY agenda_item_constancias_tenant_read ON agenda_item_constancias FOR SELECT
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

DROP POLICY IF EXISTS agenda_item_constancias_tenant_write ON agenda_item_constancias;
CREATE POLICY agenda_item_constancias_tenant_write ON agenda_item_constancias FOR ALL
  USING (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id())
  WITH CHECK (fn_secretaria_is_service_role() OR tenant_id = fn_secretaria_current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON agenda_item_constancias TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- agreements.agenda_item_id: explicit anchor to DECISORIO agenda item
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS agenda_item_id uuid REFERENCES agenda_items(id) ON DELETE SET NULL;

UPDATE agreements a
SET agenda_item_id = ai.id
FROM agenda_items ai
WHERE a.agenda_item_id IS NULL
  AND a.parent_meeting_id = ai.meeting_id
  AND COALESCE(
    (a.execution_mode ->> 'agenda_item_index')::int,
    (a.execution_mode #>> '{agreement_360,agenda_item_index}')::int
  ) = ai.order_number;

CREATE UNIQUE INDEX IF NOT EXISTS ux_agreements_agenda_item_id
  ON agreements(tenant_id, agenda_item_id)
  WHERE agenda_item_id IS NOT NULL
    AND adoption_mode = 'MEETING';

COMMENT ON INDEX ux_agreements_agenda_item_id IS
  'Impide duplicar acuerdos sobre el mismo punto en sesiones MEETING. UNIVERSAL queda fuera para mantener compatibilidad con acuerdos históricos agrupados hasta completar su normalización explícita.';
COMMENT ON COLUMN agreements.agenda_item_id IS
  'Anchor explícito al punto DECISORIO que materializa el Acuerdo 360. Compatibilidad legacy: también se deriva de execution_mode.agenda_item_index.';

-- ──────────────────────────────────────────────────────────────────────────────
-- T4: resolution kind ↔ agenda kind mapping
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolution_kind_matches_agenda()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
BEGIN
  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.meeting_id
    AND order_number = NEW.agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'meeting_resolutions.agenda_item_index=% no corresponde a ningún agenda_item de la reunión %', NEW.agenda_item_index, NEW.meeting_id;
  END IF;

  IF NEW.kind_resolution = 'DECISION' AND v_agenda_kind <> 'DECISORIO' THEN
    NEW.kind_resolution := CASE v_agenda_kind
      WHEN 'INFORMATIVO' THEN 'INFORMATION_NOTED'
      WHEN 'TOMA_DE_RAZON' THEN 'ACKNOWLEDGEMENT_NOTED'
      WHEN 'DELIBERATIVO' THEN 'DELIBERATION_OUTCOME'
      WHEN 'ACEPTACION_INFORME' THEN 'REPORT_ACCEPTED'
      WHEN 'RUEGOS_PREGUNTAS' THEN 'QUESTIONS_ANSWERS'
      ELSE NEW.kind_resolution
    END;
  END IF;

  IF NEW.kind_resolution = 'DECISION' AND v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'kind_resolution=DECISION requiere agenda_items.kind=DECISORIO (actual: %). Reclasifica el punto antes de votar.', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'INFORMATION_NOTED' AND v_agenda_kind != 'INFORMATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=INFORMATION_NOTED requiere agenda_items.kind=INFORMATIVO (actual: %).', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'ACKNOWLEDGEMENT_NOTED' AND v_agenda_kind != 'TOMA_DE_RAZON' THEN
    RAISE EXCEPTION 'kind_resolution=ACKNOWLEDGEMENT_NOTED requiere agenda_items.kind=TOMA_DE_RAZON (actual: %).', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'DELIBERATION_OUTCOME' AND v_agenda_kind != 'DELIBERATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=DELIBERATION_OUTCOME requiere agenda_items.kind=DELIBERATIVO (actual: %).', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'REPORT_ACCEPTED' AND v_agenda_kind != 'ACEPTACION_INFORME' THEN
    RAISE EXCEPTION 'kind_resolution=REPORT_ACCEPTED requiere agenda_items.kind=ACEPTACION_INFORME (actual: %).', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'QUESTIONS_ANSWERS' AND v_agenda_kind != 'RUEGOS_PREGUNTAS' THEN
    RAISE EXCEPTION 'kind_resolution=QUESTIONS_ANSWERS requiere agenda_items.kind=RUEGOS_PREGUNTAS (actual: %).', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────────────────────
-- RPC: reclassify supports all v3.1 kinds; P7 still blocks only elevation to
-- DECISORIO in formal non-universal Junta already convened/held.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reclassify_agenda_item_kind(
  p_agenda_item_id uuid,
  p_meeting_id uuid,
  p_new_kind text,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_agenda_tenant_id uuid;
  v_has_secretario_role boolean;
  v_meeting_status text;
  v_is_universal boolean;
  v_body_type text;
  v_body_type_upper text;
  v_current_kind text;
BEGIN
  IF p_motivo IS NULL OR length(p_motivo) < 3 THEN
    RAISE EXCEPTION 'motivo debe tener al menos 3 caracteres';
  END IF;

  IF p_new_kind NOT IN (
    'DECISORIO',
    'INFORMATIVO',
    'TOMA_DE_RAZON',
    'DELIBERATIVO',
    'ACEPTACION_INFORME',
    'RUEGOS_PREGUNTAS'
  ) THEN
    RAISE EXCEPTION 'p_new_kind invalido: %', p_new_kind;
  END IF;

  IF fn_secretaria_is_service_role() THEN
    v_user_id := NULL;
  ELSE
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION '401: usuario no autenticado';
    END IF;
  END IF;

  SELECT tenant_id, kind INTO v_agenda_tenant_id, v_current_kind
  FROM agenda_items
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;
  IF v_agenda_tenant_id IS NULL THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;

  IF NOT fn_secretaria_is_service_role() THEN
    PERFORM fn_secretaria_assert_tenant_access(v_agenda_tenant_id);

    SELECT EXISTS (
      SELECT 1
      FROM rbac_user_roles ur
      JOIN rbac_roles r ON r.id = ur.role_id
      WHERE ur.user_id = v_user_id
        AND ur.tenant_id = v_agenda_tenant_id
        AND ur.is_active = true
        AND r.role_code = 'SECRETARIO'
    ) INTO v_has_secretario_role;

    IF NOT v_has_secretario_role THEN
      RAISE EXCEPTION '403: usuario % no tiene rol SECRETARIO en tenant %', v_user_id, v_agenda_tenant_id;
    END IF;
  END IF;

  IF v_current_kind = p_new_kind THEN
    RAISE EXCEPTION 'P7: el punto ya está clasificado como % — reclasificación no-op rechazada (no contamina WORM audit).', p_new_kind;
  END IF;

  SELECT
    m.status,
    COALESCE((m.quorum_data->>'is_universal')::boolean, false),
    gb.body_type
  INTO v_meeting_status, v_is_universal, v_body_type
  FROM meetings m
  LEFT JOIN governing_bodies gb ON gb.id = m.body_id
  WHERE m.id = p_meeting_id;

  IF v_meeting_status = 'CANCELADA' THEN
    RAISE EXCEPTION 'P7: reclasificación bloqueada (meeting CANCELADA). Reabre via flujo formal antes de reclasificar.';
  END IF;

  IF v_meeting_status IN ('CONVOCADA', 'CELEBRADA') THEN
    v_body_type_upper := UPPER(COALESCE(v_body_type, ''));
    IF v_body_type_upper IN ('JUNTA', 'JUNTA_GENERAL', 'JGA', 'JUNTA_ACCIONISTAS')
       AND v_is_universal = false
       AND p_new_kind = 'DECISORIO' THEN
      RAISE EXCEPTION 'P7: junta convocada formalmente — no se puede elevar a DECISORIO sin reconvocar (alteración del orden del día, art. 175 LSC). Solo admisible en Junta Universal con unanimidad de los presentes.';
    END IF;
  END IF;

  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', COALESCE(v_user_id::text, ''), true);

  UPDATE agenda_items
  SET kind = p_new_kind,
      decision_subtype = CASE WHEN p_new_kind = 'DECISORIO' THEN decision_subtype ELSE NULL END,
      requires_vote = CASE WHEN p_new_kind = 'ACEPTACION_INFORME' THEN requires_vote ELSE 'NONE' END,
      updated_at = now(),
      updated_by = v_user_id
  WHERE id = p_agenda_item_id
    AND meeting_id = p_meeting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agenda_item % no encontrado en meeting %', p_agenda_item_id, p_meeting_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reclassify_agenda_item_kind(uuid, uuid, text, text) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- T5: agreement must anchor to DECISORIO agenda item. BEFORE trigger derives
-- agreements.agenda_item_id from execution_mode.agenda_item_index when omitted.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agreement_requires_decisorio()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
  v_agenda_item_index int;
  v_agenda_item_id uuid;
BEGIN
  IF NEW.parent_meeting_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.agenda_item_id IS NOT NULL THEN
    SELECT id, kind INTO v_agenda_item_id, v_agenda_kind
    FROM agenda_items
    WHERE id = NEW.agenda_item_id
      AND meeting_id = NEW.parent_meeting_id;
  ELSE
    v_agenda_item_index := COALESCE(
      (NEW.execution_mode->>'agenda_item_index')::int,
      (NEW.execution_mode->'agreement_360'->>'agenda_item_index')::int
    );

    IF v_agenda_item_index IS NULL THEN
      RAISE EXCEPTION 'agreement.parent_meeting_id requiere agenda_item_id o execution_mode.agenda_item_index';
    END IF;

    SELECT id, kind INTO v_agenda_item_id, v_agenda_kind
    FROM agenda_items
    WHERE meeting_id = NEW.parent_meeting_id
      AND order_number = v_agenda_item_index;
  END IF;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'agreement.parent_meeting_id no tiene agenda_item compatible';
  END IF;

  IF v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'agreement requiere agenda_item.kind=DECISORIO (actual: %). Punto no decisorio no puede materializar Acuerdo360.', v_agenda_kind;
  END IF;

  NEW.agenda_item_id := v_agenda_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
