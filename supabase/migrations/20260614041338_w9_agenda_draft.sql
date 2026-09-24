-- W9 — borradores de punto de agenda (automatización cross-módulo, G7) (2026-06-14).
-- ============================================================================
-- Bandeja persistida de puntos propuestos desde GRC/AIMS/Compliance. El
-- Secretario es el garante (I-2): aprueba/pospone/rechaza; solo un APROBADO se
-- puede convocar. La emisión automática desde los otros módulos y los cron de
-- escalado son follow-up; aquí se entrega el backbone + el seed demo. El estado
-- solo se muta vía RPC (trigger guard, patrón W4). Forward-only, idempotente.

CREATE TABLE IF NOT EXISTS agenda_draft (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid,
  origen_modulo text NOT NULL CHECK (origen_modulo IN ('GRC','AIMS','COMPLIANCE','SECRETARIA')),
  origen_evento text,
  origen_ref text,
  titulo text NOT NULL,
  descripcion text,
  evidencia jsonb,
  materia text,
  owner_id uuid,
  estado text NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE','APROBADO','POSPUESTO','RECHAZADO','CONVOCADO')),
  decidido_by uuid,
  decidido_at timestamptz,
  convocatoria_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_draft_tenant_estado
  ON agenda_draft (tenant_id, estado);

ALTER TABLE agenda_draft ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='agenda_draft' AND policyname='agenda_draft_tenant_isolation') THEN
    CREATE POLICY agenda_draft_tenant_isolation ON agenda_draft FOR ALL TO authenticated
      USING (tenant_id = fn_current_tenant_id());
  END IF;
END $$;

-- Trigger guard: el estado solo cambia vía RPC (flag de sesión) o service_role.
CREATE OR REPLACE FUNCTION public.fn_agenda_draft_estado_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.fn_secretaria_is_service_role() THEN RETURN NEW; END IF;
  IF COALESCE(current_setting('app.agenda_draft_rpc', true), '') = '1' THEN RETURN NEW; END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'agenda_draft.estado solo se modifica vía RPC fn_agenda_draft_transicion'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_agenda_draft_estado_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_agenda_draft_estado_guard() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_agenda_draft_estado_guard ON public.agenda_draft;
CREATE TRIGGER trg_agenda_draft_estado_guard
  BEFORE UPDATE ON public.agenda_draft FOR EACH ROW
  EXECUTE FUNCTION public.fn_agenda_draft_estado_guard();

-- RPC de transición (espeja la máquina pura agenda-draft.ts).
CREATE OR REPLACE FUNCTION public.fn_agenda_draft_transicion(
  p_draft_id uuid,
  p_action   text,
  p_convocatoria_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE d public.agenda_draft%ROWTYPE; v_next text;
BEGIN
  SELECT * INTO d FROM public.agenda_draft WHERE id = p_draft_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'borrador % no encontrado', p_draft_id; END IF;
  IF public.fn_secretaria_is_service_role() IS NOT TRUE THEN
    IF public.fn_assert_current_tenant_id() <> d.tenant_id THEN
      RAISE EXCEPTION 'agenda_draft tenant mismatch' USING ERRCODE = '42501'; END IF;
  END IF;
  v_next := CASE
    WHEN p_action = 'APROBAR'  AND d.estado IN ('PENDIENTE','POSPUESTO') THEN 'APROBADO'
    WHEN p_action = 'POSPONER' AND d.estado = 'PENDIENTE' THEN 'POSPUESTO'
    WHEN p_action = 'RECHAZAR' AND d.estado IN ('PENDIENTE','POSPUESTO') THEN 'RECHAZADO'
    WHEN p_action = 'CONVOCAR' AND d.estado = 'APROBADO' THEN 'CONVOCADO'
    ELSE NULL END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'transición de borrador inválida: % desde %', p_action, d.estado; END IF;

  PERFORM set_config('app.agenda_draft_rpc', '1', true);
  UPDATE public.agenda_draft
     SET estado = v_next,
         decidido_by = auth.uid(),
         decidido_at = now(),
         convocatoria_id = CASE WHEN p_action = 'CONVOCAR' THEN COALESCE(p_convocatoria_id, convocatoria_id) ELSE convocatoria_id END
   WHERE id = p_draft_id;
  RETURN jsonb_build_object('draft_id', p_draft_id, 'estado', v_next);
END; $function$;

REVOKE ALL ON FUNCTION public.fn_agenda_draft_transicion(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_agenda_draft_transicion(uuid, text, uuid) TO authenticated, service_role;

-- Seed demo: 2 borradores propuestos (GRC + AIMS), PENDIENTE, sobre ARGA Seguros.
INSERT INTO agenda_draft (tenant_id, entity_id, origen_modulo, origen_evento, titulo, descripcion, materia, estado)
SELECT '00000000-0000-0000-0000-000000000001', '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'GRC', 'GRC_INCIDENT_MATERIAL',
  'Elevar al Consejo incidente DORA material',
  'Incidente operativo material detectado en GRC; se propone su elevación al Consejo de Administración para toma de razón y plan de acción.',
  'RATIFICACION_ACTOS', 'PENDIENTE'
WHERE NOT EXISTS (SELECT 1 FROM agenda_draft WHERE origen_evento='GRC_INCIDENT_MATERIAL' AND entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602');

INSERT INTO agenda_draft (tenant_id, entity_id, origen_modulo, origen_evento, titulo, descripcion, materia, estado)
SELECT '00000000-0000-0000-0000-000000000001', '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'AIMS', 'AIMS_TECHNICAL_FILE_GAP',
  'Revisar gap de technical file de sistema IA de alto riesgo',
  'AIMS reporta un gap en el technical file de un sistema de IA de alto riesgo; se propone su revisión por el órgano competente.',
  'RATIFICACION_ACTOS', 'PENDIENTE'
WHERE NOT EXISTS (SELECT 1 FROM agenda_draft WHERE origen_evento='AIMS_TECHNICAL_FILE_GAP' AND entity_id='6d7ed736-f263-4531-a59d-c6ca0cd41602');
