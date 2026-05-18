-- Backfill conservador del Matter Registry para ARGA.
--
-- Alcance:
-- - Solo inserta/actualiza bindings en public.materia_template_binding.
-- - No modifica plantillas ni rule packs.
-- - Solo vincula contextos con rule_pack_version activa y plantilla ACTIVA.
-- - Los aliases quedan documentados en selection_reason.

WITH candidate_bindings AS (
  SELECT *
  FROM (
    VALUES
      (
        'APROBACION_CUENTAS',
        'JUNTA_GENERAL',
        'APROBACION_CUENTAS',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo APROBACION_CUENTAS + plantilla ACTIVA.'
      ),
      (
        'APROBACION_PLAN_NEGOCIO',
        'CONSEJO',
        'APROBACION_PLAN_NEGOCIO',
        'CONSEJO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: rule pack CONSEJO normalizado contra plantilla ACTIVA CONSEJO_ADMIN.'
      ),
      (
        'AUMENTO_CAPITAL',
        'JUNTA_GENERAL',
        'AUMENTO_CAPITAL',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo AUMENTO_CAPITAL + plantilla ACTIVA.'
      ),
      (
        'AUMENTO_CAPITAL_NO_DINERARIO',
        'JUNTA_GENERAL',
        'AUMENTO_CAPITAL',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: subtipo no dinerario cubierto por la plantilla ACTIVA AUMENTO_CAPITAL con modalidad de aportación.'
      ),
      (
        'AUTORIZACION_GARANTIA',
        'JUNTA_GENERAL',
        'AUTORIZACION_GARANTIA',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo AUTORIZACION_GARANTIA de Junta + plantilla ACTIVA.'
      ),
      (
        'CESE_CONSEJERO',
        'JUNTA_GENERAL',
        'CESE_CONSEJERO',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo CESE_CONSEJERO de Junta + plantilla ACTIVA.'
      ),
      (
        'CESION_GLOBAL_ACTIVO',
        'JUNTA_GENERAL',
        'FUSION_ESCISION',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: alias documentado CESION_GLOBAL_ACTIVO -> FUSION_ESCISION para modificaciones estructurales RDL 5/2023.'
      ),
      (
        'COOPTACION',
        'CONSEJO',
        'NOMBRAMIENTO_CONSEJERO',
        'CONSEJO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: subtipo COOPTACION cubierto por plantilla ACTIVA NOMBRAMIENTO_CONSEJERO de Consejo.'
      ),
      (
        'DELEGACION_FACULTADES',
        'CONSEJO',
        'DELEGACION_FACULTADES',
        'CONSEJO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: rule pack CONSEJO normalizado contra plantilla ACTIVA CONSEJO_ADMIN.'
      ),
      (
        'DISTRIBUCION_DIVIDENDOS',
        'JUNTA_GENERAL',
        'DISTRIBUCION_DIVIDENDOS',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo DISTRIBUCION_DIVIDENDOS + plantilla ACTIVA.'
      ),
      (
        'ESCISION',
        'JUNTA_GENERAL',
        'FUSION_ESCISION',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: alias documentado ESCISION -> FUSION_ESCISION para modificaciones estructurales RDL 5/2023.'
      ),
      (
        'FORMULACION_CUENTAS',
        'CONSEJO',
        'FORMULACION_CUENTAS',
        'ORGANO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: rule pack CONSEJO cubierto por plantilla ACTIVA de ORGANO_ADMIN para formulación de cuentas.'
      ),
      (
        'FUSION',
        'JUNTA_GENERAL',
        'FUSION_ESCISION',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: alias documentado FUSION -> FUSION_ESCISION para modificaciones estructurales RDL 5/2023.'
      ),
      (
        'INFORME_GESTION',
        'CONSEJO',
        'GESTION_SOCIEDAD',
        'ORGANO_ADMIN',
        'ANY',
        'MEETING',
        'INFORME_GESTION',
        0,
        'Backfill Matter Registry: rule pack INFORME_GESTION vinculado a plantilla ACTIVA GESTION_SOCIEDAD de tipo INFORME_GESTION.'
      ),
      (
        'MOD_ESTATUTOS',
        'JUNTA_GENERAL',
        'MODIFICACION_ESTATUTOS',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: alias documentado MOD_ESTATUTOS -> MODIFICACION_ESTATUTOS.'
      ),
      (
        'MODIFICACION_ESTATUTOS',
        'JUNTA_GENERAL',
        'MODIFICACION_ESTATUTOS',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo MODIFICACION_ESTATUTOS + plantilla ACTIVA.'
      ),
      (
        'NOMBRAMIENTO',
        'JUNTA_GENERAL',
        'NOMBRAMIENTO_CONSEJERO',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: alias documentado NOMBRAMIENTO -> NOMBRAMIENTO_CONSEJERO para Junta General.'
      ),
      (
        'NOMBRAMIENTO_AUDITOR',
        'JUNTA_GENERAL',
        'NOMBRAMIENTO_AUDITOR',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo NOMBRAMIENTO_AUDITOR + plantilla ACTIVA.'
      ),
      (
        'NOMBRAMIENTO_CONSEJERO',
        'CONSEJO',
        'NOMBRAMIENTO_CONSEJERO',
        'CONSEJO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto de materia con rule pack CONSEJO normalizado contra plantilla ACTIVA CONSEJO_ADMIN.'
      ),
      (
        'OPERACION_VINCULADA',
        'CONSEJO',
        'OPERACION_VINCULADA',
        'CONSEJO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: rule pack CONSEJO normalizado contra plantilla ACTIVA CONSEJO_ADMIN.'
      ),
      (
        'RATIFICACION_ACTOS',
        'CONSEJO',
        'RATIFICACION_ACTOS',
        'CONSEJO_ADMIN',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: rule pack CONSEJO normalizado contra plantilla ACTIVA CONSEJO_ADMIN.'
      ),
      (
        'REDUCCION_CAPITAL',
        'JUNTA_GENERAL',
        'REDUCCION_CAPITAL',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo REDUCCION_CAPITAL + plantilla ACTIVA.'
      ),
      (
        'RETRIBUCION_ADMIN',
        'JUNTA_GENERAL',
        'POLITICA_REMUNERACION',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: alias funcional RETRIBUCION_ADMIN -> POLITICA_REMUNERACION por cobertura expresa de arts. 217-219 LSC.'
      ),
      (
        'SOCIEDAD_UNIPERSONAL',
        'SOCIO_UNICO',
        'DECISION_SOCIO_UNICO',
        'SOCIO_UNICO',
        'ANY',
        'UNIPERSONAL_SOCIO',
        'ACTA_CONSIGNACION',
        0,
        'Backfill Matter Registry: SOCIEDAD_UNIPERSONAL usa plantilla ACTIVA DECISION_SOCIO_UNICO con adoption_mode UNIPERSONAL_SOCIO.'
      ),
      (
        'TRANSFORMACION',
        'JUNTA_GENERAL',
        'TRANSFORMACION',
        'JUNTA_GENERAL',
        'ANY',
        'MEETING',
        'MODELO_ACUERDO',
        0,
        'Backfill Matter Registry: match exacto desde rule pack activo TRANSFORMACION + plantilla ACTIVA específica.'
      )
  ) AS v(
    materia,
    rule_organo_tipo,
    template_materia,
    template_organo_tipo,
    tipo_social,
    adoption_mode,
    doc_type,
    priority,
    selection_reason
  )
),
active_rule_contexts AS (
  SELECT DISTINCT
    rp.tenant_id,
    rp.materia,
    COALESCE(rp.organo_tipo, 'ANY') AS organo_tipo
  FROM public.rule_packs rp
  JOIN public.rule_pack_versions rpv
    ON rpv.pack_id = rp.id
   AND rpv.is_active = true
  WHERE rp.tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
),
selected_templates AS (
  SELECT DISTINCT ON (
    arc.tenant_id,
    cb.materia,
    cb.rule_organo_tipo,
    cb.tipo_social,
    cb.adoption_mode,
    cb.doc_type,
    cb.priority
  )
    arc.tenant_id,
    cb.materia,
    cb.rule_organo_tipo,
    cb.tipo_social,
    cb.adoption_mode,
    cb.doc_type,
    cb.priority,
    cb.selection_reason,
    p.id AS template_id
  FROM candidate_bindings cb
  JOIN active_rule_contexts arc
    ON arc.materia = cb.materia
   AND arc.organo_tipo = cb.rule_organo_tipo
  JOIN public.plantillas_protegidas p
    ON p.tenant_id = arc.tenant_id
   AND p.estado = 'ACTIVA'
   AND p.tipo = cb.doc_type
   AND COALESCE(p.materia_acuerdo, p.materia) = cb.template_materia
   AND COALESCE(p.organo_tipo, 'ANY') = cb.template_organo_tipo
   AND COALESCE(p.adoption_mode, cb.adoption_mode) = cb.adoption_mode
  ORDER BY
    arc.tenant_id,
    cb.materia,
    cb.rule_organo_tipo,
    cb.tipo_social,
    cb.adoption_mode,
    cb.doc_type,
    cb.priority,
    p.fecha_aprobacion DESC NULLS LAST,
    p.created_at DESC NULLS LAST,
    p.version DESC NULLS LAST,
    p.id
)
INSERT INTO public.materia_template_binding (
  tenant_id,
  materia,
  organo_tipo,
  tipo_social,
  jurisdiccion,
  adoption_mode,
  doc_type,
  template_id,
  priority,
  active,
  selection_reason
)
SELECT
  tenant_id,
  materia,
  rule_organo_tipo,
  tipo_social,
  'ES',
  adoption_mode,
  doc_type,
  template_id,
  priority,
  true,
  selection_reason
FROM selected_templates
ON CONFLICT (
  tenant_id,
  materia,
  jurisdiccion,
  tipo_social,
  organo_tipo,
  adoption_mode,
  doc_type,
  priority
)
WHERE active = true
DO UPDATE SET
  template_id = EXCLUDED.template_id,
  active = true,
  selection_reason = EXCLUDED.selection_reason;
