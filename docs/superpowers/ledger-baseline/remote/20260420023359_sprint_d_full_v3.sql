-- ─── D1: Workflow columns ────────────────────────────────────────────────────

ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS review_date timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS approved_by_role text,
  ADD COLUMN IF NOT EXISTS approval_checklist jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS version_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash_sha256 text,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

ALTER TABLE plantillas_protegidas
  DROP CONSTRAINT IF EXISTS plantillas_protegidas_estado_check;
ALTER TABLE plantillas_protegidas
  ADD CONSTRAINT plantillas_protegidas_estado_check
  CHECK (estado IN ('BORRADOR','REVISADA','APROBADA','ACTIVA','ARCHIVADA'));

ALTER TABLE plantillas_protegidas
  DROP CONSTRAINT IF EXISTS plantillas_protegidas_approved_by_role_check;
ALTER TABLE plantillas_protegidas
  ADD CONSTRAINT plantillas_protegidas_approved_by_role_check
  CHECK (approved_by_role IS NULL OR approved_by_role IN ('COMITE_LEGAL','SECRETARIO','ADMINISTRADOR'));

CREATE OR REPLACE FUNCTION fn_plantilla_version_history()
RETURNS trigger AS $$
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    NEW.version_history = COALESCE(OLD.version_history, '[]'::jsonb) || jsonb_build_object(
      'from', OLD.estado, 'to', NEW.estado,
      'at', now()::text,
      'by', COALESCE(NEW.aprobada_por, NEW.reviewed_by, 'system')
    );
  END IF;
  IF NEW.estado = 'ACTIVA' AND OLD.estado != 'ACTIVA' THEN
    NEW.activated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_plantilla_version_history ON plantillas_protegidas;
CREATE TRIGGER trg_plantilla_version_history
  BEFORE UPDATE ON plantillas_protegidas
  FOR EACH ROW EXECUTE FUNCTION fn_plantilla_version_history();

UPDATE plantillas_protegidas
SET
  estado = 'APROBADA',
  reviewed_by = 'Lucía Martín',
  review_date = now() - interval '7 days',
  review_notes = 'Revisión completa — contenido jurídico validado por equipo legal.',
  aprobada_por = 'Comité Legal ARGA',
  approved_by_role = 'COMITE_LEGAL',
  fecha_aprobacion = now() - interval '3 days',
  approval_checklist = '[
    {"check": "Contenido jurídico verificado", "passed": true},
    {"check": "Variables capa2 completas", "passed": true},
    {"check": "Referencia legal actualizada", "passed": true},
    {"check": "Compatible con motor de reglas", "passed": true},
    {"check": "Sin errores tipográficos", "passed": true}
  ]'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND estado = 'REVISADA';

UPDATE plantillas_protegidas
SET estado = 'ACTIVA'
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND estado = 'APROBADA'
  AND tipo IN (
    'ACTA_SESION_JUNTA','ACTA_SESION_CONSEJO','ACTA_CONSIGNACION_SOCIO',
    'CERTIFICACION','ACTA_ACUERDO_ESCRITO','CONVOCATORIA','CONVOCATORIA_SL_NOTIFICACION'
  );

-- ─── D3: ERDS columns ────────────────────────────────────────────────────────

ALTER TABLE no_session_notificaciones
  ADD COLUMN IF NOT EXISTS erds_evidence_id uuid,
  ADD COLUMN IF NOT EXISTS erds_delivery_ref text,
  ADD COLUMN IF NOT EXISTS erds_evidence_hash text,
  ADD COLUMN IF NOT EXISTS erds_tsq_token text,
  ADD COLUMN IF NOT EXISTS erds_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS erds_status text DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS erds_error_message text;

ALTER TABLE no_session_notificaciones
  DROP CONSTRAINT IF EXISTS no_session_notificaciones_erds_status_check;
ALTER TABLE no_session_notificaciones
  ADD CONSTRAINT no_session_notificaciones_erds_status_check
  CHECK (erds_status IN ('PENDING','PROCESSING','COMPLETED','ERROR'));

-- ─── D4: Pactos parasociales ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pactos_parasociales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  entity_id uuid REFERENCES entities(id),
  titulo text NOT NULL,
  tipo_clausula text NOT NULL,
  descripcion text,
  firmantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  materias_aplicables text[] DEFAULT '{}',
  umbral_activacion numeric,
  capital_minimo_pct numeric,
  titular_veto text,
  condicion_detallada text,
  fecha_inicio date NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin date,
  estado text NOT NULL DEFAULT 'VIGENTE',
  documento_ref text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pactos_tipo_clausula_check
    CHECK (tipo_clausula IN ('VETO','MAYORIA_REFORZADA_PACTADA','CONSENTIMIENTO_INVERSOR','TAG_ALONG','DRAG_ALONG','LOCK_UP','SINDICACION_VOTO')),
  CONSTRAINT pactos_estado_check
    CHECK (estado IN ('VIGENTE','SUSPENDIDO','EXPIRADO','RESUELTO'))
);

ALTER TABLE pactos_parasociales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pactos_parasociales_tenant ON pactos_parasociales;
CREATE POLICY pactos_parasociales_tenant ON pactos_parasociales FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

-- Seeds — entity_id = ARGA Seguros real UUID
INSERT INTO pactos_parasociales (
  tenant_id, entity_id, titulo, tipo_clausula, descripcion,
  firmantes, materias_aplicables, titular_veto, condicion_detallada,
  fecha_inicio, documento_ref, notas
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'Pacto parasocial Fundación ARGA — Derecho de veto',
  'VETO',
  'La Fundación ARGA, como accionista de control a través de Cartera ARGA S.L.U. (69,69%), tiene derecho de veto sobre operaciones estructurales.',
  '[{"nombre": "Fundación ARGA", "tipo": "JURIDICA", "capital_pct": 69.69, "via": "Cartera ARGA S.L.U."}]'::jsonb,
  ARRAY['FUSION','ESCISION','DISOLUCION','VENTA_ACTIVOS_SUSTANCIALES','TRANSFORMACION'],
  'Fundación ARGA',
  'Veto aplicable cuando la operación afecte a más del 15% del patrimonio neto. Requiere consentimiento escrito previo.',
  '2020-01-01',
  'Pacto de accionistas Fundación ARGA — Cartera ARGA S.L.U., 15 de enero de 2020',
  'Pacto demo ARGA. La Fundación actúa a través de Cartera ARGA S.L.U. (69,69% capital).'
) ON CONFLICT DO NOTHING;

INSERT INTO pactos_parasociales (
  tenant_id, entity_id, titulo, tipo_clausula, descripcion,
  firmantes, materias_aplicables, umbral_activacion, condicion_detallada,
  fecha_inicio, documento_ref
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'Pacto parasocial — Mayoría reforzada operaciones vinculadas',
  'MAYORIA_REFORZADA_PACTADA',
  'Mayoría reforzada del 75% del capital presente para operaciones con partes vinculadas > 5% activos.',
  '[{"nombre": "Fundación ARGA", "tipo": "JURIDICA", "capital_pct": 69.69},{"nombre": "Free float institucional", "tipo": "COLECTIVO", "capital_pct": 30.31}]'::jsonb,
  ARRAY['OPERACION_VINCULADA'],
  0.75,
  'Mayoría del 75% del capital presente. Se excluyen del voto los vinculados (art. 231 LSC).',
  '2020-01-01',
  'Pacto de accionistas Fundación ARGA, Anexo II — Operaciones vinculadas'
) ON CONFLICT DO NOTHING;

INSERT INTO pactos_parasociales (
  tenant_id, entity_id, titulo, tipo_clausula, descripcion,
  firmantes, materias_aplicables, capital_minimo_pct, titular_veto, condicion_detallada,
  fecha_inicio, documento_ref
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '6d7ed736-f263-4531-a59d-c6ca0cd41602',
  'Pacto parasocial — Consentimiento inversor dilución',
  'CONSENTIMIENTO_INVERSOR',
  'Emisión de acciones requiere consentimiento previo de accionistas >= 50% capital.',
  '[{"nombre": "Fundación ARGA", "tipo": "JURIDICA", "capital_pct": 69.69}]'::jsonb,
  ARRAY['AMPLIACION_CAPITAL','EMISION_CONVERTIBLES','EXCLUSION_PREFERENTE'],
  50.0,
  'Fundación ARGA',
  'Consentimiento por escrito >= 15 días antes de la convocatoria.',
  '2020-01-01',
  'Pacto de accionistas Fundación ARGA, Anexo III — Protección antidilución'
) ON CONFLICT DO NOTHING;

-- ─── D2: QTSP signature requests ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS qtsp_signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  agreement_id uuid REFERENCES agreements(id),
  document_hash text NOT NULL,
  document_type text NOT NULL,
  sr_id text,
  sr_status text DEFAULT 'DRAFT',
  document_id text,
  signatories jsonb DEFAULT '[]'::jsonb,
  evidence_id uuid,
  evidence_status text,
  requested_at timestamptz DEFAULT now(),
  activated_at timestamptz,
  completed_at timestamptz,
  created_by text,
  error_message text,
  CONSTRAINT qtsp_sr_status_check
    CHECK (sr_status IN ('DRAFT','ACTIVE','COMPLETED','CANCELLED','ERROR','EXPIRED'))
);

ALTER TABLE qtsp_signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qtsp_sr_tenant ON qtsp_signature_requests;
CREATE POLICY qtsp_sr_tenant ON qtsp_signature_requests FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001');

CREATE INDEX IF NOT EXISTS idx_pactos_entity ON pactos_parasociales(entity_id);
CREATE INDEX IF NOT EXISTS idx_pactos_tipo ON pactos_parasociales(tipo_clausula);
CREATE INDEX IF NOT EXISTS idx_pactos_estado ON pactos_parasociales(estado);
CREATE INDEX IF NOT EXISTS idx_qtsp_sr_agreement ON qtsp_signature_requests(agreement_id);
CREATE INDEX IF NOT EXISTS idx_qtsp_sr_status ON qtsp_signature_requests(sr_status);
