-- Migration: 20260419_000004_plantillas_protegidas.sql
-- Purpose: Create protected document templates table with RLS and seed Oleada 0 skeletons
-- Tenant: TGMS demo (00000000-0000-0000-0000-000000000001)

-- ============================================================================
-- TABLE: plantillas_protegidas
-- ============================================================================

CREATE TABLE IF NOT EXISTS plantillas_protegidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ACTA_SESION', 'ACTA_CONSIGNACION', 'ACTA_ACUERDO_ESCRITO', 'CERTIFICACION', 'CONVOCATORIA')),
  materia TEXT,
  jurisdiccion TEXT NOT NULL DEFAULT 'ES',
  version TEXT NOT NULL DEFAULT '0.1.0',
  estado TEXT NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'REVISADA', 'APROBADA', 'ACTIVA', 'DEPRECADA')),
  aprobada_por TEXT,
  fecha_aprobacion TIMESTAMPTZ,
  contenido_template TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  protecciones JSONB DEFAULT '{}'::jsonb,
  snapshot_rule_pack_required BOOLEAN DEFAULT true,
  adoption_mode TEXT CHECK (adoption_mode IN ('MEETING', 'UNIVERSAL', 'NO_SESSION', 'UNIPERSONAL_SOCIO', 'UNIPERSONAL_ADMIN')),
  organo_tipo TEXT,
  contrato_variables_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE plantillas_protegidas IS 'Protected document templates for Secretaría Societaria module with snapshot immutability zones';
COMMENT ON COLUMN plantillas_protegidas.tipo IS 'Template document type (ACTA_SESION, ACTA_CONSIGNACION, ACTA_ACUERDO_ESCRITO, CERTIFICACION, CONVOCATORIA)';
COMMENT ON COLUMN plantillas_protegidas.estado IS 'Template lifecycle state (BORRADOR→REVISADA→APROBADA→ACTIVA→DEPRECADA)';
COMMENT ON COLUMN plantillas_protegidas.protecciones IS 'JSON config for immutable sections (e.g. {"secciones_inmutables": ["SNAPSHOT"]})';
COMMENT ON COLUMN plantillas_protegidas.snapshot_rule_pack_required IS 'Whether template requires rule pack compliance snapshot injection';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE plantillas_protegidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_plantillas_protegidas" ON plantillas_protegidas
  FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ============================================================================
-- SEED DATA: Oleada 0 Skeleton Templates
-- ============================================================================

-- 1. Acta de sesión — Junta General
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, adoption_mode, organo_tipo, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ACTA_SESION',
  'MEETING',
  'JUNTA_GENERAL',
  'ACTA DE LA JUNTA GENERAL {{tipo_junta}} DE {{denominacion_social}}

Fecha: {{fecha}}
Lugar: {{lugar}}

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
--- FIN SECCION PROTEGIDA ---

ASISTENTES:
{{lista_asistentes}}

ORDEN DEL DIA:
{{orden_dia}}

DELIBERACIONES Y VOTACIONES:
{{deliberaciones}}

ACUERDOS ADOPTADOS:
{{acuerdos}}

Sin más asuntos que tratar, se levanta la sesión.

El Secretario: {{secretario}}
VºBº El Presidente: {{presidente}}',
  '["snapshot_hash", "resultado_gate", "denominacion_social", "tipo_junta", "fecha", "lugar", "lista_asistentes", "orden_dia", "deliberaciones", "acuerdos", "secretario", "presidente"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- 2. Acta de sesión — Consejo
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, adoption_mode, organo_tipo, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ACTA_SESION',
  'MEETING',
  'CONSEJO',
  'ACTA DE LA REUNION DEL CONSEJO DE ADMINISTRACION DE {{denominacion_social}}

Fecha: {{fecha}}
Lugar: {{lugar}}

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
--- FIN SECCION PROTEGIDA ---

ASISTENTES:
{{lista_consejeros}}

ORDEN DEL DIA:
{{orden_dia}}

DELIBERACIONES:
{{deliberaciones}}

ACUERDOS:
{{acuerdos}}

El Secretario: {{secretario}}
VºBº El Presidente: {{presidente}}',
  '["snapshot_hash", "resultado_gate", "denominacion_social", "fecha", "lugar", "lista_consejeros", "orden_dia", "deliberaciones", "acuerdos", "secretario", "presidente"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- 3. Acta de consignación — Socio único
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, adoption_mode, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ACTA_CONSIGNACION',
  'UNIPERSONAL_SOCIO',
  'DECISION DEL SOCIO UNICO DE {{denominacion_social}}

Fecha: {{fecha}}

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
--- FIN SECCION PROTEGIDA ---

El socio unico, {{identidad_decisor}}, en ejercicio de las competencias que le atribuye el art. 15 LSC, adopta la siguiente decision:

{{texto_decision}}

Firma: {{firma_socio}}',
  '["snapshot_hash", "resultado_gate", "denominacion_social", "fecha", "identidad_decisor", "texto_decision", "firma_socio"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- 4. Acta de consignación — Administrador único
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, adoption_mode, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ACTA_CONSIGNACION',
  'UNIPERSONAL_ADMIN',
  'DECISION DEL ADMINISTRADOR UNICO DE {{denominacion_social}}

Fecha: {{fecha}}

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
--- FIN SECCION PROTEGIDA ---

El administrador unico, {{identidad_decisor}}, adopta la siguiente decision en materias de su competencia:

{{texto_decision}}

Firma: {{firma_administrador}}',
  '["snapshot_hash", "resultado_gate", "denominacion_social", "fecha", "identidad_decisor", "texto_decision", "firma_administrador"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- 5. Acta de acuerdo escrito — Sin sesión (NO_SESSION) — flujo dominante
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, adoption_mode, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'ACTA_ACUERDO_ESCRITO',
  'NO_SESSION',
  'ACTA DE ACUERDO ADOPTADO SIN CELEBRACION DE SESION
{{denominacion_social}}

Fecha de cierre: {{fecha_cierre}}
Tipo de proceso: {{tipo_proceso}}
Condicion de adopcion: {{condicion_adopcion}}

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
Snapshot expediente: {{snapshot_expediente}}
--- FIN SECCION PROTEGIDA ---

PROPUESTA:
{{propuesta_texto}}

RELACION DE RESPUESTAS:
{{relacion_respuestas}}

RESULTADO:
{{resultado_evaluacion}}

El acuerdo ha sido {{estado_acuerdo}} conforme al procedimiento establecido.

El Secretario: {{secretario}}
VºBº El Presidente: {{presidente}}',
  '["snapshot_hash", "resultado_gate", "snapshot_expediente", "denominacion_social", "fecha_cierre", "tipo_proceso", "condicion_adopcion", "propuesta_texto", "relacion_respuestas", "resultado_evaluacion", "estado_acuerdo", "secretario", "presidente"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- 6. Certificación de acuerdos (todos los modos)
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'CERTIFICACION',
  'CERTIFICACION DE ACUERDOS

{{secretario_nombre}}, Secretario del {{organo}} de {{denominacion_social}}, CERTIFICO:

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
Conformidad conjunta: {{conformidad_conjunta}}
--- FIN SECCION PROTEGIDA ---

Que en {{tipo_sesion}} celebrada/adoptada el dia {{fecha}}, se adopto el siguiente acuerdo:

{{texto_acuerdo}}

Y para que conste, expido la presente certificacion.

Firma: {{firma_secretario}}
VºBº: {{firma_presidente}}',
  '["snapshot_hash", "resultado_gate", "conformidad_conjunta", "secretario_nombre", "organo", "denominacion_social", "tipo_sesion", "fecha", "texto_acuerdo", "firma_secretario", "firma_presidente"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- 7. Convocatoria — SA + SL
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, adoption_mode, contenido_template, variables, protecciones
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'CONVOCATORIA',
  'MEETING',
  'CONVOCATORIA DE {{tipo_junta}} DE {{denominacion_social}}

El {{organo_convocante}} de {{denominacion_social}} convoca a los señores {{destinatarios}} a la {{tipo_junta}} que se celebrara:

Fecha: {{fecha}}
Hora: {{hora}}
Lugar: {{lugar}}

--- SECCION PROTEGIDA: SNAPSHOT ---
Hash del ruleset: {{snapshot_hash}}
Resultado Gate: {{resultado_gate}}
--- FIN SECCION PROTEGIDA ---

ORDEN DEL DIA:
{{orden_dia}}

DOCUMENTACION DISPONIBLE:
{{documentacion}}

{{texto_derecho_informacion}}

En {{ciudad}}, a {{fecha_emision}}

El {{cargo_firmante}}: {{firma}}',
  '["snapshot_hash", "resultado_gate", "tipo_junta", "denominacion_social", "organo_convocante", "destinatarios", "fecha", "hora", "lugar", "orden_dia", "documentacion", "texto_derecho_informacion", "ciudad", "fecha_emision", "cargo_firmante", "firma"]'::jsonb,
  '{"secciones_inmutables": ["SNAPSHOT"]}'::jsonb
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_plantillas_protegidas_tenant_id ON plantillas_protegidas(tenant_id);
CREATE INDEX idx_plantillas_protegidas_tipo ON plantillas_protegidas(tipo);
CREATE INDEX idx_plantillas_protegidas_estado ON plantillas_protegidas(estado);
CREATE INDEX idx_plantillas_protegidas_adoption_mode ON plantillas_protegidas(adoption_mode);
CREATE INDEX idx_plantillas_protegidas_organo_tipo ON plantillas_protegidas(organo_tipo);
