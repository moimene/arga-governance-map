-- Migration: 20260512_000059_agenda_item_kind.sql
--
-- Adds agenda_item.kind classification + cross-validation triggers + WORM audit log.
--
-- Tables/columns touched:
--   1. agenda_items.kind (text, NOT NULL, DEFAULT 'DELIBERATIVO')
--   2. agenda_items.decision_subtype (text, NULL)
--   3. meeting_resolutions.kind_resolution (text, NOT NULL, DEFAULT 'DECISION')
--   4. agenda_item_kind_changelog (NEW table — WORM audit log)
--
-- Functions / RPC:
--   - set_kind_change_context (SECURITY DEFINER) — session vars helper for T3 audit
--
-- Triggers (5 total — cross-validation + immutability + audit):
--   T1 tr_agenda_kind_immutable_after_voted     BEFORE UPDATE agenda_items
--   T2 tr_agenda_kind_immutable_after_closed    BEFORE UPDATE agenda_items
--   T3 tr_agenda_kind_audit_after_convoked      AFTER  UPDATE agenda_items (SECURITY DEFINER)
--   T4 tr_resolution_kind_matches_agenda        BEFORE INSERT/UPDATE meeting_resolutions
--   T5 tr_agreement_requires_decisorio          BEFORE INSERT/UPDATE agreements
--   (T6 dropped post-adversarial: meetings.adoption_mode no existe en schema real;
--    invariante semántico ya cubierto por data model — ver §4.10 comentario)
--
-- Spec: docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md (§4.1–4.10)
-- PR: feature/agenda-item-kind (5 rondas adversariales + 4 BLOQUEANTES post-impl)

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.1 — agenda_items: kind + decision_subtype + cross-column CHECK
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'DELIBERATIVO'
    CHECK (kind IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO')),
  ADD COLUMN IF NOT EXISTS decision_subtype text
    CHECK (decision_subtype IN ('CONSTITUTIVE', 'RATIFICATORY', 'ELEVATION', 'ACKNOWLEDGEMENT')),
  ADD CONSTRAINT agenda_items_decision_subtype_only_for_decisorio
    CHECK (kind = 'DECISORIO' OR decision_subtype IS NULL);

COMMENT ON COLUMN agenda_items.kind IS
  'Naturaleza del punto: INFORMATIVO (sin decisión), DELIBERATIVO (debate sin decisión formal), DECISORIO (sometible a votación). Solo DECISORIO puede materializar agreement. Default conservador DELIBERATIVO.';

COMMENT ON COLUMN agenda_items.decision_subtype IS
  'Subtipo opcional de DECISORIO: CONSTITUTIVE (acuerdo nuevo), RATIFICATORY (ratifica acto previo), ELEVATION (eleva a público), ACKNOWLEDGEMENT (toma de razón art. 248 LSC con votación). NULL para INFO/DELIB.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.2 — meeting_resolutions: kind_resolution
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE meeting_resolutions
  ADD COLUMN IF NOT EXISTS kind_resolution text NOT NULL DEFAULT 'DECISION'
    CHECK (kind_resolution IN ('DECISION', 'DELIBERATION_OUTCOME', 'INFORMATION_NOTED'));

COMMENT ON COLUMN meeting_resolutions.kind_resolution IS
  'Tipo de outcome: DECISION (votación adoptada/rechazada), DELIBERATION_OUTCOME (conclusión de debate sin votación), INFORMATION_NOTED (informe oído). Cross-validated bidireccional contra agenda_items.kind via trigger T4.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.3 — agenda_item_kind_changelog (audit log WORM)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda_item_kind_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agenda_item_id uuid NOT NULL REFERENCES agenda_items(id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  meeting_status_at_change text NOT NULL,
  from_kind text NOT NULL,
  to_kind text NOT NULL,
  motivo text NOT NULL CHECK (length(motivo) >= 3),
  autor uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT changelog_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE agenda_item_kind_changelog IS
  'Audit log WORM de cambios de kind. INSERT only via trigger T3. Sin set_config motivo, queda "sin_motivo_proporcionado" + autor NULL (operación bypass-hook detectable en dashboard).';

DROP TRIGGER IF EXISTS tr_worm_agenda_kind_changelog_update ON agenda_item_kind_changelog;
CREATE TRIGGER tr_worm_agenda_kind_changelog_update
  BEFORE UPDATE ON agenda_item_kind_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS tr_worm_agenda_kind_changelog_delete ON agenda_item_kind_changelog;
CREATE TRIGGER tr_worm_agenda_kind_changelog_delete
  BEFORE DELETE ON agenda_item_kind_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

CREATE INDEX IF NOT EXISTS idx_agenda_kind_changelog_item
  ON agenda_item_kind_changelog(agenda_item_id, created_at DESC);

ALTER TABLE agenda_item_kind_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_kind_changelog_tenant_read ON agenda_item_kind_changelog;
CREATE POLICY agenda_kind_changelog_tenant_read ON agenda_item_kind_changelog FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS agenda_kind_changelog_tenant_insert ON agenda_item_kind_changelog;
CREATE POLICY agenda_kind_changelog_tenant_insert ON agenda_item_kind_changelog FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.4 — RPC helper: set_kind_change_context (G-I1 RBAC support)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_kind_change_context(
  p_motivo text,
  p_user_id uuid
) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', p_user_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_kind_change_context IS
  'Setea session vars consumidas por trigger T3 audit log. Llamar inmediatamente antes de UPDATE agenda_items.kind. Si no se llama, audit log captura "sin_motivo_proporcionado" + autor NULL (detectable en dashboard).';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.5 — Trigger T1: kind inmutable post-voted (cualquier kind_resolution)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_voted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    -- B1 fix: agenda_items real column is 'order_number' (not 'index' as spec asumió)
    IF EXISTS (
      SELECT 1 FROM meeting_resolutions r
      WHERE r.meeting_id = NEW.meeting_id
        AND r.agenda_item_index = NEW.order_number
    ) THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: existe meeting_resolution apuntando al punto. Cambia primero la resolution.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_immutable_after_voted ON agenda_items;
CREATE TRIGGER tr_agenda_kind_immutable_after_voted
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_immutable_after_voted();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.6 — Trigger T2: kind inmutable post-CLOSED
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF v_meeting_status = 'CLOSED' THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: la reunión está CLOSED. Reabre la reunión via flujo formal antes de reclasificar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_immutable_after_closed ON agenda_items;
CREATE TRIGGER tr_agenda_kind_immutable_after_closed
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_immutable_after_closed();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.7 — Trigger T3: audit log post-CONVOKED
--   SECURITY DEFINER + COALESCE tenant_id (B4 fix): agenda_items.tenant_id es
--   nullable. Si NULL, usar tenant demo como default (consistente con patrón
--   sistémico del repo). SECURITY DEFINER permite INSERT al audit log incluso
--   si la sesión actual no cumple el RLS check (B3 mitigation).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_audit_after_convoked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF v_meeting_status IN ('CONVOKED', 'OPEN') THEN
      INSERT INTO agenda_item_kind_changelog (
        tenant_id, agenda_item_id, meeting_id, meeting_status_at_change,
        from_kind, to_kind, motivo, autor
      ) VALUES (
        COALESCE(NEW.tenant_id, '00000000-0000-0000-0000-000000000001'::uuid),
        NEW.id, NEW.meeting_id, v_meeting_status,
        OLD.kind, NEW.kind,
        COALESCE(current_setting('app.kind_change_motivo', true),
                 'sin_motivo_proporcionado'),
        NULLIF(current_setting('app.user_id', true), '')::uuid
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_agenda_kind_audit_after_convoked ON agenda_items;
CREATE TRIGGER tr_agenda_kind_audit_after_convoked
  AFTER UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_audit_after_convoked();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.8 — Trigger T4: cross-validation BIDIRECCIONAL resolution↔agenda (D1)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolution_kind_matches_agenda()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
BEGIN
  -- B1 fix: agenda_items real column is 'order_number' (not 'index')
  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.meeting_id
    AND order_number = NEW.agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'meeting_resolutions.agenda_item_index=% no corresponde a ningún agenda_item de la reunión %', NEW.agenda_item_index, NEW.meeting_id;
  END IF;

  -- Bidireccional D1: cada kind_resolution requiere su agenda kind
  IF NEW.kind_resolution = 'DECISION' AND v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'kind_resolution=DECISION requiere agenda_items.kind=DECISORIO (actual: %). Reclasifica el punto antes de votar.', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'DELIBERATION_OUTCOME' AND v_agenda_kind != 'DELIBERATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=DELIBERATION_OUTCOME requiere agenda_items.kind=DELIBERATIVO (actual: %). El outcome de deliberación pertenece a un punto deliberativo.', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'INFORMATION_NOTED' AND v_agenda_kind != 'INFORMATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=INFORMATION_NOTED requiere agenda_items.kind=INFORMATIVO (actual: %). Informe oído pertenece a un punto informativo.', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_resolution_kind_matches_agenda ON meeting_resolutions;
CREATE TRIGGER tr_resolution_kind_matches_agenda
  BEFORE INSERT OR UPDATE ON meeting_resolutions
  FOR EACH ROW EXECUTE FUNCTION resolution_kind_matches_agenda();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.9 — Trigger T5: agreement requiere DECISORIO si parent_meeting_id (D2 NULL guard)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agreement_requires_decisorio()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
  v_agenda_item_index int;
BEGIN
  IF NEW.parent_meeting_id IS NULL THEN
    RETURN NEW; -- No-MEETING agreement (NO_SESSION, UNIPERSONAL_*, etc.)
  END IF;

  -- D2 fix: NULL guard explícito en lugar de implícito
  IF NEW.execution_mode IS NULL THEN
    RETURN NEW; -- Legacy agreement sin execution_mode populated
  END IF;

  v_agenda_item_index := (NEW.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int;
  IF v_agenda_item_index IS NULL THEN
    RETURN NEW; -- Sin trazabilidad de punto explícita (compatibilidad legacy)
  END IF;

  -- B1 fix: agenda_items real column is 'order_number' (not 'index')
  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.parent_meeting_id
    AND order_number = v_agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'agreement.parent_meeting_id no tiene agenda_item con order_number=%', v_agenda_item_index;
  END IF;

  IF v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'agreement requiere agenda_item.kind=DECISORIO (actual: %). Punto informativo/deliberativo no puede materializar Acuerdo360.', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agreement_requires_decisorio ON agreements;
CREATE TRIGGER tr_agreement_requires_decisorio
  BEFORE INSERT OR UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION agreement_requires_decisorio();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.10 — Trigger T6: DROPPED (B2 fix)
--   El spec asumía meetings.adoption_mode pero esa columna NO EXISTE en el
--   schema real (verified contra supabase/functions/_types/database.ts:2792).
--   adoption_mode existe en agreements y plantillas_protegidas, no en meetings.
--
--   Decisión arquitectónica: T6 no es implementable como spec'd. Sin embargo,
--   el invariante semántico que T6 quería enforce (agenda_items solo existen
--   para meetings tipo MEETING) ya está garantizado por el data model:
--   - meetings es la tabla de reuniones formales (MEETING mode)
--   - Los otros modos (NO_SESSION, UNIPERSONAL_*, CO_APROBACION, SOLIDARIO)
--     NO tienen registro en meetings; tienen sus propias tablas
--     (no_session_resolutions, unipersonal_decisions, etc.)
--   - Por tanto, si agenda_items.meeting_id apunta a una fila válida en
--     meetings, automáticamente es modo MEETING.
--
--   T6 queda OUT OF SCOPE de v1. Si en el futuro meetings añade adoption_mode
--   o se introduce otra tabla con agenda + adoption mode mixto, reactivar.
-- ──────────────────────────────────────────────────────────────────────────────
-- (no trigger defined here — invariante cubierto por data model)
-- B2 fix: DROP defensivo del trigger por si una versión previa lo creó.
DROP TRIGGER IF EXISTS tr_agenda_kind_only_for_meeting_mode ON agenda_items;

COMMIT;
