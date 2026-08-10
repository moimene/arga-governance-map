-- G3 Task 7 — Gate del informe preceptivo del Consejo de Socios (pieza
-- central de G3). art. 39.5.b Estatutos J&A Garrigues SLP: "El Consejo de
-- Socios… b) Informar preceptivamente a la Junta de Socios, antes de que
-- ésta adopte la correspondiente decisión…". Cotejado contra el texto
-- vigente de los Estatutos el 2026-08-05 — las 4 entradas de abajo son
-- FIRMES (docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md,
-- sección "COTEJO CON EL TEXTO VIGENTE DE LOS ESTATUTOS").
--
-- Extiende fn_refresh_agreement_document_requirements (creada en
-- 20260620045834_secretaria_informes_certificaciones.sql:1430) con un bloque
-- NUEVO INFORME_PRECEPTIVO_ORGANO, insertado DESPUÉS del bloque existente
-- INFORME_PRECEPTIVO_MATERIA (:1487-1509) — esa rama NO se toca. El resto de
-- la función es byte-idéntico al original salvo:
--   1. `gb.config AS body_config` añadido al SELECT INTO v_agreement.
--   2. Dos variables nuevas (v_organo_informante / v_organo_informante_nombre)
--      calculadas antes del WITH.
--   3. El UNION ALL nuevo descrito arriba.
--
-- El requisito solo se emite cuando el órgano ADOPTANTE del acuerdo es la
-- Junta (body_type='JUNTA') y su `config.informe_preceptivo_de` trae una
-- entrada para la materia del acuerdo. ARGA no tiene esa clave en ningún
-- órgano → v_organo_informante siempre NULL → cero filas nuevas, cero cambio
-- ARGA. blocking_policy='BLOCKING' y fase='PRE_CONVOCATORIA' porque el
-- informe debe estar a disposición de los socios CON la convocatoria, no
-- aportarse en la sesión (arts. 4.2/8 Ley 2/2007: todo cambio del círculo de
-- socios afecta a un requisito legal de composición y accede al Registro).
--
-- Ámbito: el config.informe_preceptivo_de SOLO se siembra en
-- garrigues-junta-socios (matriz). Las filiales SLP no tienen Consejo de
-- Socios propio — no reciben esta clave.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_refresh_agreement_document_requirements(
  p_agreement_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_agreement RECORD;
  v_total integer;
  v_organo_informante text;
  v_organo_informante_nombre text;
BEGIN
  SELECT
    a.id,
    a.tenant_id,
    a.entity_id,
    a.body_id,
    a.agreement_kind,
    a.matter_class,
    a.adoption_mode,
    a.inscribable,
    e.legal_form,
    e.jurisdiction,
    gb.body_type,
    gb.config AS body_config
  INTO v_agreement
  FROM public.agreements a
  LEFT JOIN public.entities e ON e.id = a.entity_id
  LEFT JOIN public.governing_bodies gb ON gb.id = a.body_id
  WHERE a.id = p_agreement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'agreement not found: %', p_agreement_id;
  END IF;

  PERFORM public.fn_secretaria_assert_tenant_access(v_agreement.tenant_id);

  -- G3 Task 7: solo la Junta puede disparar el gate (defensa en profundidad —
  -- hoy informe_preceptivo_de solo vive en el config de la Junta, pero el
  -- criterio no debe depender solo de qué config le llegue).
  IF v_agreement.body_type = 'JUNTA' THEN
    SELECT elem->>'organo_informante'
      INTO v_organo_informante
      FROM jsonb_array_elements(
             COALESCE(v_agreement.body_config->'informe_preceptivo_de', '[]'::jsonb)
           ) elem
     WHERE elem->>'materia' = v_agreement.agreement_kind
     LIMIT 1;
  END IF;

  IF v_organo_informante IS NOT NULL THEN
    SELECT gb2.name
      INTO v_organo_informante_nombre
      FROM public.governing_bodies gb2
     WHERE gb2.tenant_id = v_agreement.tenant_id
       AND gb2.slug = v_organo_informante;
  END IF;

  WITH requirement_rows AS (
    SELECT
      v_agreement.tenant_id AS tenant_id,
      v_agreement.id AS agreement_id,
      v_agreement.agreement_kind AS matter_code,
      'CERT_ACUERDO_360'::text AS requirement_code,
      'CERTIFICACION_SOPORTE'::text AS document_kind,
      'Certificación del acuerdo'::text AS title,
      'OBLIGATORIO'::text AS required_level,
      'BLOCKING'::text AS blocking_policy,
      'CERTIFICACION'::text AS fase,
      'RRM arts. 108-109; trazabilidad TGMS/QTSP'::text AS legal_basis,
      jsonb_build_object('always', true) AS condition,
      ARRAY['CERTIFICACION','REGISTRO','EXPEDIENTE']::text[] AS annex_targets,
      jsonb_build_object('source_hash_required', true, 'qtsp', 'EAD_TRUST') AS evidence_policy,
      'CERTIFICACION_ACUERDO'::text AS template_binding_key,
      'MOTOR_LSC'::text AS source_layer,
      'fn_refresh_agreement_document_requirements@2026-06-20'::text AS source_ref,
      jsonb_build_object('reason', 'Todo acuerdo materializado debe poder certificarse con fuente y evidencia enlazada.') AS explain

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_PRECEPTIVO_MATERIA',
      'INFORME_PRECEPTIVO',
      'Informe preceptivo de la materia',
      'OBLIGATORIO_SI_APLICA',
      'OVERRIDE_REQUIRED',
      'CONVOCATORIA',
      'LSC y normativa especial aplicable por materia',
      jsonb_build_object(
        'matter_class', v_agreement.matter_class,
        'agreement_kind', v_agreement.agreement_kind,
        'applies', true
      ),
      ARRAY['CONVOCATORIA','ACTA','CERTIFICACION','REGISTRO','EXPEDIENTE']::text[],
      jsonb_build_object('source_hash_required', true, 'legal_review_required', true),
      'INFORME_PRECEPTIVO:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'Materia estructural/estatutaria o capital requiere informe o justificación documental previa.')
    WHERE v_agreement.matter_class IN ('ESTRUCTURAL', 'ESTATUTARIA')
       OR v_agreement.agreement_kind IN (
         'AUMENTO_CAPITAL',
         'AMPLIACION_CAPITAL',
         'REDUCCION_CAPITAL',
         'MODIFICACION_ESTATUTOS',
         'MOD_ESTATUTOS',
         'FUSION',
         'ESCISION',
         'DISOLUCION',
         'OPERACION_ESTRUCTURAL',
         'EMISION_OBLIGACIONES'
       )

    UNION ALL

    -- G3 Task 7 — NUEVO. art. 39.5.b Estatutos: el Consejo de Socios (u otro
    -- órgano configurado) informa preceptivamente a la Junta antes de que
    -- ésta decida sobre esta materia. Distinto de INFORME_PRECEPTIVO_MATERIA
    -- (arriba): ese bloque es una regla genérica por matter_class/kind con
    -- override; este es un requisito estatutario concreto, nombrado, BLOCKING
    -- de verdad y en fase PRE_CONVOCATORIA (debe acompañar a la convocatoria,
    -- no aportarse en la sesión). Ambos pueden coexistir en el mismo acuerdo
    -- (requirement_code distinto → sin conflicto en el ON CONFLICT de abajo).
    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_PRECEPTIVO_ORGANO',
      'INFORME_PRECEPTIVO',
      'Informe preceptivo — ' || COALESCE(v_organo_informante_nombre, v_organo_informante),
      'OBLIGATORIO',
      'BLOCKING',
      'PRE_CONVOCATORIA',
      'art. 39.5.b Estatutos: el ' || COALESCE(v_organo_informante_nombre, v_organo_informante)
        || ' informa preceptivamente a la Junta de Socios antes de que ésta decida; el informe '
        || 'debe acompañar a la convocatoria y estar a disposición de los socios desde ese momento.',
      jsonb_build_object(
        'agreement_kind', v_agreement.agreement_kind,
        'organo_adoptante_body_type', v_agreement.body_type,
        'organo_informante_slug', v_organo_informante,
        'applies', true
      ),
      ARRAY['CONVOCATORIA','EXPEDIENTE']::text[],
      jsonb_build_object('source_hash_required', true, 'legal_review_required', true),
      'INFORME_PRECEPTIVO_ORGANO:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-08-05',
      jsonb_build_object('reason', 'art. 39.5.b Estatutos: informe preceptivo del órgano informante configurado para esta materia y este órgano adoptante.')
    WHERE v_organo_informante IS NOT NULL

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_GESTION_CUENTAS',
      'INFORME_GESTION',
      'Informe de gestión vinculado a cuentas',
      'OBLIGATORIO_SI_APLICA',
      'WARNING',
      'PRE_REUNION',
      'LSC cuentas anuales e informe de gestión cuando proceda',
      jsonb_build_object('agreement_kind', v_agreement.agreement_kind, 'applies', true),
      ARRAY['REUNION','ACTA','BOARD_PACK','EXPEDIENTE']::text[],
      jsonb_build_object('board_pack_required', true),
      'INFORME_GESTION:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'La materia de cuentas debe dejar trazabilidad del informe de gestión o de su no exigibilidad.')
    WHERE v_agreement.agreement_kind IN (
      'APROBACION_CUENTAS',
      'FORMULACION_CUENTAS',
      'CUENTAS_ANUALES',
      'INFORME_GESTION',
      'EINF'
    )

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'INFORME_DOCUMENTAL_PRE_REGISTRO',
      'INFORME_DOCUMENTAL_PRE',
      'Informe documental PRE para registro',
      'RECOMENDADO',
      'WARNING',
      'REGISTRO',
      'Control interno de completitud registral',
      jsonb_build_object('inscribable', v_agreement.inscribable, 'applies', true),
      ARRAY['REGISTRO','EXPEDIENTE']::text[],
      jsonb_build_object('registry_preflight', true),
      'INFORME_DOCUMENTAL_PRE:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'Acuerdo inscribible: se recomienda checklist documental PRE antes de tramitación registral.')
    WHERE v_agreement.inscribable IS TRUE

    UNION ALL

    SELECT
      v_agreement.tenant_id,
      v_agreement.id,
      v_agreement.agreement_kind,
      'DOCUMENTO_REGISTRAL_FINAL',
      'DOCUMENTO_REGISTRAL',
      'Documento registral final',
      'OBLIGATORIO_SI_APLICA',
      'BLOCKING',
      'REGISTRO',
      'RRM y práctica registral aplicable',
      jsonb_build_object('inscribable', v_agreement.inscribable, 'applies', true),
      ARRAY['REGISTRO','EXPEDIENTE']::text[],
      jsonb_build_object('registry_receipt_required', true),
      'DOCUMENTO_REGISTRAL:' || v_agreement.agreement_kind,
      'MOTOR_LSC',
      'fn_refresh_agreement_document_requirements@2026-06-20',
      jsonb_build_object('reason', 'Acuerdo inscribible: el expediente debe conservar presentación/inscripción o subsanación.')
    WHERE v_agreement.inscribable IS TRUE
  )
  INSERT INTO public.agreement_document_requirements (
    tenant_id,
    agreement_id,
    matter_code,
    requirement_code,
    document_kind,
    title,
    required_level,
    blocking_policy,
    fase,
    legal_basis,
    condition,
    annex_targets,
    evidence_policy,
    template_binding_key,
    source_layer,
    source_ref,
    explain
  )
  SELECT
    tenant_id,
    agreement_id,
    matter_code,
    requirement_code,
    document_kind,
    title,
    required_level,
    blocking_policy,
    fase,
    legal_basis,
    condition,
    annex_targets,
    evidence_policy,
    template_binding_key,
    source_layer,
    source_ref,
    explain
  FROM requirement_rows
  ON CONFLICT (tenant_id, agreement_id, requirement_code, matter_code, fase) DO UPDATE SET
    document_kind = EXCLUDED.document_kind,
    title = EXCLUDED.title,
    required_level = EXCLUDED.required_level,
    blocking_policy = EXCLUDED.blocking_policy,
    legal_basis = EXCLUDED.legal_basis,
    condition = EXCLUDED.condition,
    annex_targets = EXCLUDED.annex_targets,
    evidence_policy = EXCLUDED.evidence_policy,
    template_binding_key = EXCLUDED.template_binding_key,
    source_layer = EXCLUDED.source_layer,
    source_ref = EXCLUDED.source_ref,
    explain = EXCLUDED.explain,
    updated_at = now();

  UPDATE public.agreement_document_requirements req
     SET status = 'SATISFIED',
         updated_at = now()
   WHERE req.tenant_id = v_agreement.tenant_id
     AND req.agreement_id = v_agreement.id
     AND EXISTS (
       SELECT 1
         FROM public.agreement_document_links link
         JOIN public.secretaria_document_artifacts artifact
           ON artifact.id = link.artifact_id
          AND artifact.tenant_id = link.tenant_id
        WHERE link.tenant_id = req.tenant_id
          AND link.requirement_id = req.id
          AND artifact.status IN ('SOURCE_LOCKED', 'GENERATED', 'IN_REVIEW', 'APPROVED', 'SIGNED', 'ARCHIVED', 'ATTACHED')
     );

  SELECT count(*)
    INTO v_total
    FROM public.agreement_document_requirements req
   WHERE req.tenant_id = v_agreement.tenant_id
     AND req.agreement_id = v_agreement.id
     AND req.status <> 'SUPERSEDED';

  INSERT INTO public.audit_log (tenant_id, action, object_type, object_id, delta)
  VALUES (
    v_agreement.tenant_id,
    'AGREEMENT_DOCUMENT_REQUIREMENTS_REFRESHED',
    'agreements',
    v_agreement.id,
    jsonb_build_object('agreement_kind', v_agreement.agreement_kind, 'requirements', v_total)
  );

  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.fn_refresh_agreement_document_requirements(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_refresh_agreement_document_requirements(uuid) TO authenticated, service_role;

-- Siembra config.informe_preceptivo_de SOLO en garrigues-junta-socios (matriz
-- Garrigues, tenant 00000000-0000-0000-0000-000000000002). `||` hace merge
-- superficial: preserva naturaleza/fuente/censo_socios ya sembrados por G2
-- (scripts/seed-garrigues-bodies.ts) y solo añade/reemplaza esta clave —
-- idempotente ante reaplicación. Ninguna filial recibe esta clave.
UPDATE public.governing_bodies
   SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object(
     'informe_preceptivo_de',
     '[
       {"materia": "ADMISION_SOCIO_CUOTA", "organo_informante": "garrigues-consejo-de-socios", "fuente": "ESTATUTOS", "referencia": "arts. 39.5.b.i y 30.3.b Estatutos (mayoría 80%)", "firmeza": "FIRME"},
       {"materia": "EXCLUSION_SOCIO_ESTATUTARIA", "organo_informante": "garrigues-consejo-de-socios", "fuente": "ESTATUTOS", "referencia": "arts. 39.5.b.i y 30.2.g Estatutos", "firmeza": "FIRME"},
       {"materia": "CONTINUIDAD_SOCIO_POST_60", "organo_informante": "garrigues-consejo-de-socios", "fuente": "ESTATUTOS", "referencia": "arts. 21.1.e, 30.2.m y 39.5.b.i Estatutos", "firmeza": "FIRME"},
       {"materia": "NOMBRAMIENTO_ADMINISTRADOR_UNICO", "organo_informante": "garrigues-consejo-de-socios", "fuente": "ESTATUTOS", "referencia": "art. 39.5.b.ii Estatutos", "firmeza": "FIRME"}
     ]'::jsonb
   )
 WHERE tenant_id = '00000000-0000-0000-0000-000000000002'
   AND slug = 'garrigues-junta-socios';

DO $assert$
DECLARE
  v_rows integer;
  v_entries integer;
BEGIN
  SELECT count(*) INTO v_rows
    FROM public.governing_bodies
   WHERE tenant_id = '00000000-0000-0000-0000-000000000002'
     AND slug = 'garrigues-junta-socios';
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'g3 informe preceptivo gate: se esperaba 1 fila garrigues-junta-socios, encontradas=%', v_rows;
  END IF;

  SELECT jsonb_array_length(config->'informe_preceptivo_de') INTO v_entries
    FROM public.governing_bodies
   WHERE tenant_id = '00000000-0000-0000-0000-000000000002'
     AND slug = 'garrigues-junta-socios';
  IF v_entries <> 4 THEN
    RAISE EXCEPTION 'g3 informe preceptivo gate: se esperaban 4 entradas informe_preceptivo_de, encontradas=%', v_entries;
  END IF;

  -- Ninguna otra fila (filiales, otros tenants) debe recibir la clave.
  SELECT count(*) INTO v_rows
    FROM public.governing_bodies
   WHERE slug <> 'garrigues-junta-socios'
     AND config ? 'informe_preceptivo_de';
  IF v_rows <> 0 THEN
    RAISE EXCEPTION 'g3 informe preceptivo gate: informe_preceptivo_de se filtró fuera de garrigues-junta-socios, filas=%', v_rows;
  END IF;
END;
$assert$;

COMMIT;
