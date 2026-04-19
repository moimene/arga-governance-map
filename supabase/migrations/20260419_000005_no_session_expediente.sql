-- Motor de Reglas LSC: expediente sin sesion (NO_SESSION) — flujo dominante (60-80% operaciones reales)
-- Workflow: propuesta → notificación certificada → ventana de consentimiento → cierre → proclamación

-- ============================================================================
-- 1. no_session_expedientes (mutable lifecycle table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS no_session_expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  body_id UUID NOT NULL REFERENCES governing_bodies(id) ON DELETE CASCADE,

  -- Tipo de proceso: ley + estatutos definen cuál aplica
  tipo_proceso TEXT NOT NULL CHECK (tipo_proceso IN (
    'UNANIMIDAD_ESCRITA_SL',      -- SL: todos los socios firman (LSC 629)
    'CIRCULACION_CONSEJO',         -- SA: circulación entre consejeros (LSC 623)
    'DECISION_SOCIO_UNICO_SL',     -- SL unipersonal (LSC 631)
    'DECISION_SOCIO_UNICO_SA'      -- SA unipersonal (LSC 623bis)
  )),

  -- Documentación de propuesta
  propuesta_texto TEXT,
  propuesta_documentos JSONB DEFAULT '[]'::jsonb,  -- {url, name, tipo_documento}[]
  propuesta_fecha DATE,
  propuesta_firmada_por UUID REFERENCES persons(id) ON DELETE SET NULL,

  -- Ventana de consentimiento (critical)
  ventana_inicio TIMESTAMPTZ,
  ventana_fin TIMESTAMPTZ,
  ventana_dias_habiles INTEGER,
  ventana_fuente TEXT CHECK (ventana_fuente IN ('LEY', 'ESTATUTOS', 'REGLAMENTO')),

  -- Ciclo de vida
  estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN (
    'BORRADOR',           -- Proyecto no enviado
    'NOTIFICADO',         -- Notificaciones enviadas, ventana abierta
    'ABIERTO',            -- Ventana activa, respuestas llegando
    'CERRADO_OK',         -- Ventana cerrada, condición cumplida → adopción automática
    'CERRADO_FAIL',       -- Ventana cerrada, NO cumple → rechazo
    'PROCLAMADO'          -- Proclamado en acta por rgto. interno
  )),

  -- Condición de adopción: qué se necesita
  condicion_adopcion TEXT NOT NULL CHECK (condicion_adopcion IN (
    'UNANIMIDAD_CAPITAL',          -- 100% del capital
    'UNANIMIDAD_CONSEJEROS',       -- 100% de consejeros
    'MAYORIA_CONSEJEROS_ESCRITA',  -- Mayoría de consejeros (circulación)
    'DECISION_UNICA'               -- Socio/consejero único
  )),

  -- Cierre
  fecha_cierre TIMESTAMPTZ,
  motivo_cierre TEXT,

  -- Gobernanza
  rule_pack_id TEXT,
  rule_pack_version TEXT,
  snapshot_hash TEXT,  -- Hash de propuesta + condiciones (para verificación)

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(tenant_id, agreement_id)
);

CREATE INDEX idx_no_session_expedientes_tenant_estado
  ON no_session_expedientes(tenant_id, estado);
CREATE INDEX idx_no_session_expedientes_ventana_fin
  ON no_session_expedientes(ventana_fin)
  WHERE estado IN ('NOTIFICADO', 'ABIERTO');

-- ============================================================================
-- 2. no_session_respuestas (WORM — Write-Once, juridical act)
-- ============================================================================
CREATE TABLE IF NOT EXISTS no_session_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  expediente_id UUID NOT NULL REFERENCES no_session_expedientes(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,

  -- Context: participación del firmante
  capital_participacion NUMERIC(15, 2),
  porcentaje_capital NUMERIC(5, 2),  -- % del capital
  es_consejero BOOLEAN DEFAULT false,

  -- Response: juridical act (immutable)
  sentido TEXT NOT NULL CHECK (sentido IN (
    'CONSENTIMIENTO',           -- Firma en favor
    'OBJECION',                 -- Voto en contra
    'OBJECION_PROCEDIMIENTO',   -- Voto condicionado (ej. plazo)
    'SILENCIO'                  -- No respondió (WORM, creado post-ventana)
  )),
  texto_respuesta TEXT,
  fecha_respuesta TIMESTAMPTZ DEFAULT now(),

  -- eIDAS QTSP signature (immutable evidence)
  firma_qes_ref TEXT,             -- Digital Trust API ref
  firma_qes_timestamp TIMESTAMPTZ,
  ocsp_status TEXT,               -- GOOD / REVOKED / UNKNOWN

  -- Notificación certificada (si existe)
  notificacion_certificada_ref TEXT,

  UNIQUE(expediente_id, person_id)
);

CREATE INDEX idx_no_session_respuestas_sentido
  ON no_session_respuestas(sentido);

-- ============================================================================
-- 3. no_session_notificaciones (WORM — Write-Once, certified delivery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS no_session_notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  expediente_id UUID NOT NULL REFERENCES no_session_expedientes(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,

  -- Canal: cómo se notificó
  canal TEXT NOT NULL CHECK (canal IN (
    'NOTIFICACION_CERTIFICADA',  -- QTSP certified (eIDAS 3/2014)
    'EMAIL_SIMPLE',              -- Standard email (para prueba)
    'BUROFAX',                   -- Fax certificado ES
    'ENTREGA_PERSONAL'           -- Hand delivery
  )),

  -- Timeline
  enviada_at TIMESTAMPTZ,
  entregada_at TIMESTAMPTZ,

  -- Evidence (immutable)
  evidencia_ref TEXT,            -- Storage bucket path
  evidencia_hash TEXT,           -- SHA-256

  -- Status
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE',   -- Scheduled for sending
    'ENVIADA',     -- Delivery initiated
    'ENTREGADA',   -- Recipient confirmed
    'FALLIDA',     -- Delivery failed (will retry)
    'RECHAZADA'    -- Recipient rejected
  ))
);

CREATE INDEX idx_no_session_notificaciones_estado
  ON no_session_notificaciones(estado);

-- ============================================================================
-- 4. Row-Level Security (RLS)
-- ============================================================================

-- no_session_expedientes: full tenant isolation
ALTER TABLE no_session_expedientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_session_expedientes_tenant_isolation"
  ON no_session_expedientes
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- no_session_respuestas: read-all, insert-own-tenant
ALTER TABLE no_session_respuestas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_session_respuestas_tenant_read"
  ON no_session_respuestas
  FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "no_session_respuestas_tenant_insert"
  ON no_session_respuestas
  FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- no_session_notificaciones: read-all, insert-own-tenant
ALTER TABLE no_session_notificaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_session_notificaciones_tenant_read"
  ON no_session_notificaciones
  FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
CREATE POLICY "no_session_notificaciones_tenant_insert"
  ON no_session_notificaciones
  FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ============================================================================
-- 5. WORM (Write-Once) protection triggers
-- ============================================================================

-- WORM: no_session_respuestas (juridical acts are immutable)
CREATE TRIGGER worm_no_session_respuestas
  BEFORE UPDATE OR DELETE ON no_session_respuestas
  FOR EACH ROW
  EXECUTE FUNCTION worm_guard();

-- WORM: no_session_notificaciones (delivery evidence is immutable)
CREATE TRIGGER worm_no_session_notificaciones
  BEFORE UPDATE OR DELETE ON no_session_notificaciones
  FOR EACH ROW
  EXECUTE FUNCTION worm_guard();

-- ============================================================================
-- 6. Automatic updated_at trigger for expedientes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_no_session_expedientes
  BEFORE UPDATE ON no_session_expedientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 7. View: expedientes with computed fields (read-only)
-- ============================================================================

CREATE OR REPLACE VIEW v_no_session_expedientes_status AS
SELECT
  nse.id,
  nse.tenant_id,
  nse.agreement_id,
  nse.entity_id,
  nse.body_id,
  nse.tipo_proceso,
  nse.estado,
  nse.condicion_adopcion,
  nse.ventana_inicio,
  nse.ventana_fin,
  nse.fecha_cierre,
  (SELECT COUNT(*) FROM no_session_respuestas WHERE expediente_id = nse.id) AS total_respuestas,
  (SELECT COUNT(*) FROM no_session_respuestas WHERE expediente_id = nse.id AND sentido = 'CONSENTIMIENTO') AS consentimientos,
  (SELECT COUNT(*) FROM no_session_respuestas WHERE expediente_id = nse.id AND sentido IN ('OBJECION', 'OBJECION_PROCEDIMIENTO')) AS objeciones,
  (SELECT COUNT(*) FROM no_session_respuestas WHERE expediente_id = nse.id AND sentido = 'SILENCIO') AS silencios,
  (SELECT COUNT(*) FROM no_session_notificaciones WHERE expediente_id = nse.id AND estado = 'ENTREGADA') AS notificaciones_entregadas,
  nse.created_at,
  nse.updated_at
FROM no_session_expedientes nse;

-- RLS on view
ALTER VIEW v_no_session_expedientes_status OWNER TO postgres;

COMMENT ON TABLE no_session_expedientes IS 'Expedientes sin sesión (LSC): flujo dominante de decisiones corporativas sin reunión (60-80% operaciones reales). Incluye unanimidad escrita, circulación consejera, decisiones unipersonales.';
COMMENT ON TABLE no_session_respuestas IS 'Respuestas de accionistas/consejeros a expedientes sin sesión (WORM). Cada respuesta es un acto jurídico inmutable registrado con firma electrónica cualificada.';
COMMENT ON TABLE no_session_notificaciones IS 'Entregas certificadas de notificaciones en expedientes sin sesión (WORM, eIDAS 3/2014). Evidencia inmutable de envío y recepción.';
