-- FORMULACION_CUENTAS: reancla el binding canónico de Consejo a la
-- plantilla v1.2.0 ACTIVA. La plantilla v1.1.0 ARCHIVADA se conserva intacta
-- para trazabilidad histórica.
--
-- Forward-only e idempotente:
--   * valida los UUIDs y el contexto observado en governance_OS;
--   * desactiva eventuales bindings hermanos del mismo contexto;
--   * actualiza únicamente materia_template_binding;
--   * exige una sola fila activa CONSEJO_ADMIN / MEETING al terminar.
--
-- ✅ ESTADO 2026-07-11: APLICADA en Cloud governance_OS mediante Management
-- API (el MCP execute_sql disponible estaba en modo read-only) y registrada
-- en supabase_migrations.schema_migrations como 20260711123000. Verificación:
-- un único binding activo babd5bda… apunta a bc49965f… v1.2.0 ACTIVA; la
-- plantilla histórica c90edc8c… v1.1.0 permanece ARCHIVADA e intacta.

BEGIN;

DO $formulacion_cuentas_binding$
DECLARE
  v_tenant_id constant uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_binding_id constant uuid := 'babd5bda-0b6c-4cd4-b081-48bb58eabd80'::uuid;
  v_target_template_id constant uuid := 'bc49965f-2c0b-4778-9751-163f87fcbff6'::uuid;
  v_active_count integer;
BEGIN
  -- Fail closed si la plantilla destino dejó de ser la versión aprobada y activa
  -- contrastada antes de preparar esta migración.
  PERFORM 1
    FROM public.plantillas_protegidas p
   WHERE p.id = v_target_template_id
     AND p.tenant_id = v_tenant_id
     AND p.tipo = 'MODELO_ACUERDO'
     AND p.materia = 'FORMULACION_CUENTAS'
     AND p.materia_acuerdo = 'FORMULACION_CUENTAS'
     AND p.jurisdiccion = 'ES'
     AND p.organo_tipo = 'CONSEJO_ADMIN'
     AND p.adoption_mode = 'MEETING'
     AND p.version = '1.2.0'
     AND p.estado = 'ACTIVA'
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'FORMULACION_CUENTAS: target % no es la plantilla CONSEJO_ADMIN/MEETING v1.2.0 ACTIVA esperada',
      v_target_template_id;
  END IF;

  -- El binding se identifica por su UUID real. No se infiere a partir del órgano
  -- de la plantilla histórica, que es ORGANO_ADMIN y permanece sin cambios.
  PERFORM 1
    FROM public.materia_template_binding b
   WHERE b.id = v_binding_id
     AND b.tenant_id = v_tenant_id
     AND b.materia = 'FORMULACION_CUENTAS'
     AND b.organo_tipo = 'CONSEJO_ADMIN'
     AND b.tipo_social = 'ANY'
     AND b.jurisdiccion = 'ES'
     AND b.adoption_mode = 'MEETING'
     AND b.doc_type = 'MODELO_ACUERDO'
     AND b.priority = 0
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'FORMULACION_CUENTAS: binding canónico % ausente o con contexto distinto del verificado',
      v_binding_id;
  END IF;

  -- La clave única histórica incluye priority, por lo que podrían coexistir
  -- alternativas activas con otra prioridad. Se preservan como filas históricas,
  -- pero se desactivan para dejar un único binding activo del contexto canónico.
  UPDATE public.materia_template_binding
     SET active = false,
         selection_reason = concat(
           selection_reason,
           ' Desactivado por 20260711123000: sustituido por el binding canónico de FORMULACION_CUENTAS v1.2.0.'
         )
   WHERE tenant_id = v_tenant_id
     AND materia = 'FORMULACION_CUENTAS'
     AND organo_tipo = 'CONSEJO_ADMIN'
     AND tipo_social = 'ANY'
     AND jurisdiccion = 'ES'
     AND adoption_mode = 'MEETING'
     AND doc_type = 'MODELO_ACUERDO'
     AND active = true
     AND id <> v_binding_id;

  UPDATE public.materia_template_binding
     SET organo_tipo = 'CONSEJO_ADMIN',
         tipo_social = 'ANY',
         jurisdiccion = 'ES',
         adoption_mode = 'MEETING',
         doc_type = 'MODELO_ACUERDO',
         template_id = v_target_template_id,
         priority = 0,
         active = true,
         selection_reason =
           'FORMULACION_CUENTAS: Consejo de Administración cubierto por la plantilla ACTIVA v1.2.0 (binding reanclado por 20260711123000).'
   WHERE id = v_binding_id
     AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'FORMULACION_CUENTAS: no se pudo actualizar el binding %',
      v_binding_id;
  END IF;

  SELECT count(*)
    INTO v_active_count
    FROM public.materia_template_binding b
   WHERE b.tenant_id = v_tenant_id
     AND b.materia = 'FORMULACION_CUENTAS'
     AND b.organo_tipo = 'CONSEJO_ADMIN'
     AND b.tipo_social = 'ANY'
     AND b.jurisdiccion = 'ES'
     AND b.adoption_mode = 'MEETING'
     AND b.doc_type = 'MODELO_ACUERDO'
     AND b.active = true;

  IF v_active_count <> 1 THEN
    RAISE EXCEPTION
      'FORMULACION_CUENTAS: se esperaba 1 binding activo canónico y se encontraron %',
      v_active_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.materia_template_binding b
      JOIN public.plantillas_protegidas p ON p.id = b.template_id
     WHERE b.id = v_binding_id
       AND b.active = true
       AND b.template_id = v_target_template_id
       AND p.estado = 'ACTIVA'
       AND p.version = '1.2.0'
       AND p.organo_tipo = 'CONSEJO_ADMIN'
       AND p.adoption_mode = 'MEETING'
  ) THEN
    RAISE EXCEPTION
      'FORMULACION_CUENTAS: verificación post-migración fallida para binding %',
      v_binding_id;
  END IF;
END
$formulacion_cuentas_binding$;

COMMIT;
