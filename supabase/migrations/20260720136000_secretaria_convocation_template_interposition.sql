-- Secretaría — convocatoria del Consejo sin promesa de firma electrónica.
--
-- La identidad y competencia del convocante proceden del censo/mandato
-- autoritativo. EAD Trust puede interponer, comunicar y custodiar el artefacto,
-- pero esas operaciones no son una firma electrónica ni se imprimen como tal.
--
-- La versión 1.0.0 se conserva como histórico. Esta migración crea una fila
-- nueva e inmutable 1.1.0 y mueve cualquier binding activo a esa versión.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $migration$
DECLARE
  v_old public.plantillas_protegidas%ROWTYPE;
  v_existing public.plantillas_protegidas%ROWTYPE;
  v_new_id uuid;
  v_body text := $template$SIMULACIÓN DEMO / SIN EFECTO JURÍDICO

BORRADOR OPERATIVO DE CONVOCATORIA DE SESIÓN DEL CONSEJO DE ADMINISTRACIÓN DE {{denominacion_social}}

A efectos exclusivos de simulación DEMO, se registra un borrador operativo referido al cargo vigente de {{cargo_convocante}}, ocupado según el censo autoritativo por {{nombre_convocante}}. Esta referencia acredita únicamente la titularidad del cargo y no afirma que dicha persona haya ordenado, consentido, emitido o firmado esta convocatoria.

El borrador documenta una propuesta de sesión del Consejo de Administración de {{denominacion_social}} (la «Sociedad»), al amparo de los artículos 245.2 y 246 de la Ley de Sociedades de Capital, de los Estatutos Sociales y del Reglamento del Consejo, para el día {{fecha_sesion}} a las {{hora_sesion}} en {{lugar_sesion}}, en modalidad {{modalidad_sesion}}.

ORDEN DEL DÍA

{{orden_del_dia_resumen}}

PLAZO Y FORMA DE LA CONVOCATORIA

El borrador prevé que una eventual convocatoria jurídica se remita individualmente a cada consejero por {{canal_convocatoria}}, con la antelación y por el procedimiento previstos en los Estatutos Sociales y en el Reglamento del Consejo. Esta simulación no produce remisión ni comunicación real.

DOCUMENTACIÓN DE SOPORTE

El borrador prevé que la documentación asociada al orden del día se ponga a disposición de los consejeros mediante {{canal_documentacion}}, identificada en el expediente mediante el índice {{indice_documentacion_ref}}. Esta simulación no produce puesta a disposición real ni acredita que los consejeros hayan recibido documentación.

{{#if entidad_cotizada}}SOCIEDAD COTIZADA

Una eventual preparación y celebración jurídica de la sesión deberá sujetarse asimismo a las especialidades legales aplicables a las sociedades cotizadas y al Reglamento del Consejo de la Sociedad.{{/if}}

En {{lugar_emision}}, a {{fecha_emision}}.

Registro técnico realizado por la Secretaría Societaria en el entorno DEMO. Referencia de competencia: cargo de {{cargo_convocante}} ocupado por {{nombre_convocante}}, sin atribuirle actuación personal.

Documento demo/operativo sin efecto jurídico. No constituye una convocatoria emitida ni evidencia final productiva. La eventual interposición, mensajería o custodia electrónica por EAD Trust se registra separadamente en el expediente y no constituye ni sustituye la actuación, el consentimiento o la firma jurídica del convocante.$template$;
  v_capa2 jsonb := jsonb_build_array(
    jsonb_build_object('fuente', 'entities.name', 'variable', 'denominacion_social', 'condicion', 'SIEMPRE'),
    jsonb_build_object('fuente', 'authority_evidence.person_id', 'variable', 'nombre_convocante', 'condicion', 'SIEMPRE'),
    jsonb_build_object('fuente', 'authority_evidence.cargo', 'variable', 'cargo_convocante', 'condicion', 'SIEMPRE'),
    jsonb_build_object('fuente', 'SISTEMA.lugar_emision', 'variable', 'lugar_emision', 'condicion', 'SIEMPRE'),
    jsonb_build_object('fuente', 'SISTEMA.fecha_emision', 'variable', 'fecha_emision', 'condicion', 'SIEMPRE')
  );
  v_capa3 jsonb := $json$[
    {"tipo":"date","campo":"fecha_sesion","label":"Fecha de la sesión","obligatoriedad":"OBLIGATORIO"},
    {"tipo":"text","campo":"hora_sesion","label":"Hora de la sesión (HH:MM)","obligatoriedad":"OBLIGATORIO"},
    {"tipo":"text","campo":"lugar_sesion","label":"Lugar de la sesión (físico o virtual)","obligatoriedad":"OBLIGATORIO"},
    {"tipo":"select","campo":"modalidad_sesion","label":"Modalidad de la sesión","opciones":["PRESENCIAL","TELEMATICA","MIXTA"],"obligatoriedad":"OBLIGATORIO"},
    {"tipo":"textarea","campo":"orden_del_dia_resumen","label":"Orden del día","obligatoriedad":"OBLIGATORIO"},
    {"tipo":"text","campo":"canal_convocatoria","label":"Canal de convocatoria a consejeros","obligatoriedad":"OBLIGATORIO"},
    {"tipo":"text","campo":"canal_documentacion","label":"Canal de puesta a disposición de documentación","obligatoriedad":"RECOMENDADO"},
    {"tipo":"text","campo":"indice_documentacion_ref","label":"Referencia del índice documental","obligatoriedad":"OPCIONAL"},
    {"tipo":"boolean","campo":"entidad_cotizada","label":"¿La sociedad es cotizada?","obligatoriedad":"OBLIGATORIO"}
  ]$json$::jsonb;
  v_hash text;
BEGIN
  v_hash := encode(digest(convert_to(v_body, 'UTF8'), 'sha256'), 'hex');

  SELECT *
    INTO v_existing
    FROM public.plantillas_protegidas
   WHERE tenant_id = '00000000-0000-0000-0000-000000000001'::uuid
     AND tipo = 'CONVOCATORIA'
     AND materia = 'CONVOCATORIA_CDA'
     AND version = '1.1.0'
   ORDER BY created_at DESC
   LIMIT 1;

  IF FOUND THEN
    IF v_existing.capa1_inmutable IS DISTINCT FROM v_body
       OR v_existing.capa2_variables IS DISTINCT FROM v_capa2
       OR v_existing.capa3_editables IS DISTINCT FROM v_capa3
       OR v_existing.content_hash_sha256 IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION 'CONVOCATORIA_CDA 1.1.0 exists with different immutable content';
    END IF;

    -- La repetición inmediata debe reconciliar el predecesor y sus bindings,
    -- pero nunca reactivar una versión 1.1.0 que otro despliegue posterior ya
    -- hubiera archivado formalmente.
    IF v_existing.estado = 'ACTIVA' THEN
      PERFORM set_config('app.secretaria_template_state_transition', 'migration-20260720136000', true);

      UPDATE public.plantillas_protegidas
         SET estado = 'ARCHIVADA'
       WHERE id = 'c955d5b5-5548-4951-80d9-af1478b9e23d'::uuid
         AND estado = 'ACTIVA';

      UPDATE public.materia_template_binding
         SET template_id = v_existing.id,
             selection_reason = concat_ws(
               ' · ',
               nullif(selection_reason, ''),
               'CONVOCATORIA_CDA 1.1.0 sin firma electrónica; interposición EAD separada'
             )
       WHERE tenant_id = v_existing.tenant_id
         AND template_id = 'c955d5b5-5548-4951-80d9-af1478b9e23d'::uuid;
    END IF;
    RETURN;
  END IF;

  SELECT *
    INTO v_old
    FROM public.plantillas_protegidas
   WHERE id = 'c955d5b5-5548-4951-80d9-af1478b9e23d'::uuid
   FOR UPDATE;

  IF NOT FOUND
     OR v_old.tipo IS DISTINCT FROM 'CONVOCATORIA'
     OR v_old.materia IS DISTINCT FROM 'CONVOCATORIA_CDA'
     OR v_old.version IS DISTINCT FROM '1.0.0'
     OR v_old.estado IS DISTINCT FROM 'ACTIVA' THEN
    RAISE EXCEPTION 'expected active CONVOCATORIA_CDA 1.0.0 predecessor not found';
  END IF;

  PERFORM set_config('app.secretaria_template_state_transition', 'migration-20260720136000', true);

  UPDATE public.plantillas_protegidas
     SET estado = 'ARCHIVADA'
   WHERE id = v_old.id
     AND estado = 'ACTIVA';

  INSERT INTO public.plantillas_protegidas (
    id, tenant_id, tipo, materia, jurisdiccion, version, estado,
    aprobada_por, fecha_aprobacion, contenido_template, variables,
    protecciones, snapshot_rule_pack_required, adoption_mode, organo_tipo,
    contrato_variables_version, created_at, capa1_inmutable, capa2_variables,
    capa3_editables, referencia_legal, notas_legal, reviewed_by, review_date,
    review_notes, approved_by_role, approval_checklist, version_history,
    content_hash_sha256, activated_at, materia_acuerdo,
    requiere_comunicacion, comunicacion_config, tipo_social
  )
  SELECT
    gen_random_uuid(), v_old.tenant_id, v_old.tipo, v_old.materia,
    v_old.jurisdiccion, '1.1.0', 'ACTIVA',
    'Responsable del prototipo TGMS (remediación autorizada)', now(),
    v_old.contenido_template, v_old.variables, v_old.protecciones,
    v_old.snapshot_rule_pack_required, v_old.adoption_mode, v_old.organo_tipo,
    v_old.contrato_variables_version, now(), v_body, v_capa2, v_capa3,
    'Arts. 245.2 y 246 LSC; Estatutos Sociales y Reglamento del Consejo',
    concat_ws(
      E'\n',
      nullif(v_old.notas_legal, ''),
      'v1.1.0: simulación DEMO sin efecto jurídico. El cargo se deriva del censo únicamente como referencia y no se atribuye al Presidente orden, consentimiento, emisión ni firma. EAD Trust queda limitado a interposición, mensajería y e-archiving trazados separadamente.'
    ),
    'Revisión técnica-jurídica TGMS', now(),
    'Referencia legal corregida: el funcionamiento del Consejo se apoya en el art. 245.2 LSC; el art. 245.3 regula su frecuencia mínima. Esta versión operativa admite únicamente la convocatoria por el Presidente acreditado conforme al art. 246.1 LSC; la ruta excepcional del art. 246.2 queda fuera hasta disponer de un expediente probatorio específico.',
    'ADMINISTRADOR',
    jsonb_build_array(
      jsonb_build_object('check', 'CENSO_AUTORITATIVO_CONVOCANTE', 'passed', true),
      jsonb_build_object('check', 'RUTA_ART_246_1_PRESIDENTE', 'passed', true),
      jsonb_build_object('check', 'SIN_ATRIBUCION_ACTUACION_PRESIDENTE', 'passed', true),
      jsonb_build_object('check', 'SIN_FIRMA_ELECTRONICA_PROMETIDA', 'passed', true),
      jsonb_build_object('check', 'INTERPOSICION_EN_METADATA', 'passed', true)
    ),
    coalesce(v_old.version_history, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object(
        'from', '1.0.0',
        'to', '1.1.0',
        'at', now(),
        'by', 'migration-20260720136000'
      )
    ),
    v_hash, now(), v_old.materia_acuerdo, v_old.requiere_comunicacion,
    v_old.comunicacion_config, v_old.tipo_social
  RETURNING id INTO v_new_id;

  UPDATE public.materia_template_binding
     SET template_id = v_new_id,
         selection_reason = concat_ws(
           ' · ',
           nullif(selection_reason, ''),
           'CONVOCATORIA_CDA 1.1.0 sin firma electrónica; interposición EAD separada'
         )
   WHERE tenant_id = v_old.tenant_id
     AND template_id = v_old.id;

  INSERT INTO public.plantilla_changelog (
    tenant_id, plantilla_id, from_version, to_version, bump_type,
    motivo, autor, diff_summary
  ) VALUES (
    v_old.tenant_id,
    v_new_id,
    '1.0.0',
    '1.1.0',
    'MINOR',
    'Alinear la convocatoria con la política de interposición, mensajería y e-archiving sin firma electrónica.',
    'migration-20260720136000',
    'Nueva versión inmutable; se retiran firma_convocante_ref y sello_tiempo_ref, se corrige la referencia a los arts. 245.2 y 246 LSC y se separa la evidencia EAD del cuerpo visible.'
  );
END;
$migration$;

COMMIT;
