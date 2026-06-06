-- Libros societarios v2: cartera completa de libros legales y registros
-- auxiliares de gobernanza para sociedades ARGA. Idempotente y compatible
-- con los book_kind legacy ya consumidos por demo/E2E.

BEGIN;

ALTER TABLE public.mandatory_books
  ADD COLUMN IF NOT EXISTS body_id uuid REFERENCES public.governing_bodies(id),
  ADD COLUMN IF NOT EXISTS book_group text NOT NULL DEFAULT 'LIBRO_MERCANTIL',
  ADD COLUMN IF NOT EXISTS legal_basis text,
  ADD COLUMN IF NOT EXISTS custodian_role text,
  ADD COLUMN IF NOT EXISTS requires_legalization boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS legalization_requirement text NOT NULL DEFAULT 'OBLIGATORIA',
  ADD COLUMN IF NOT EXISTS legalization_mode text,
  ADD COLUMN IF NOT EXISTS maintenance_model text,
  ADD COLUMN IF NOT EXISTS content_route text,
  ADD COLUMN IF NOT EXISTS supervision_tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS is_auxiliary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entries_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_entry_at timestamptz;

CREATE INDEX IF NOT EXISTS ix_mandatory_books_body
  ON public.mandatory_books(body_id);

CREATE INDEX IF NOT EXISTS ix_mandatory_books_group
  ON public.mandatory_books(tenant_id, entity_id, book_group);

CREATE OR REPLACE FUNCTION public.fn_upsert_mandatory_book_v2(
  p_tenant_id uuid,
  p_entity_id uuid,
  p_body_id uuid,
  p_book_kind text,
  p_period integer,
  p_deadline date,
  p_book_group text,
  p_legal_basis text,
  p_custodian_role text,
  p_requires_legalization boolean,
  p_legalization_requirement text,
  p_legalization_mode text,
  p_maintenance_model text,
  p_content_route text,
  p_supervision_tags text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  INSERT INTO public.mandatory_books (
    tenant_id,
    entity_id,
    body_id,
    book_kind,
    volume_number,
    period,
    status,
    opened_at,
    legalization_deadline,
    legalization_status,
    book_group,
    legal_basis,
    custodian_role,
    requires_legalization,
    legalization_requirement,
    legalization_mode,
    maintenance_model,
    content_route,
    supervision_tags,
    is_auxiliary
  )
  VALUES (
    p_tenant_id,
    p_entity_id,
    p_body_id,
    p_book_kind,
    1,
    p_period,
    'OPEN',
    CURRENT_DATE,
    CASE WHEN p_requires_legalization THEN p_deadline ELSE NULL END,
    CASE WHEN p_requires_legalization THEN 'PENDIENTE' ELSE 'NO_APLICA' END,
    p_book_group,
    p_legal_basis,
    p_custodian_role,
    p_requires_legalization,
    p_legalization_requirement,
    p_legalization_mode,
    p_maintenance_model,
    p_content_route,
    COALESCE(p_supervision_tags, '{}'::text[]),
    p_book_group = 'REGISTRO_AUXILIAR'
  )
  ON CONFLICT (entity_id, book_kind, period, volume_number)
  DO UPDATE SET
    body_id = COALESCE(public.mandatory_books.body_id, EXCLUDED.body_id),
    book_group = EXCLUDED.book_group,
    legal_basis = EXCLUDED.legal_basis,
    custodian_role = EXCLUDED.custodian_role,
    requires_legalization = EXCLUDED.requires_legalization,
    legalization_requirement = EXCLUDED.legalization_requirement,
    legalization_mode = EXCLUDED.legalization_mode,
    maintenance_model = EXCLUDED.maintenance_model,
    content_route = EXCLUDED.content_route,
    supervision_tags = EXCLUDED.supervision_tags,
    is_auxiliary = EXCLUDED.is_auxiliary,
    legalization_deadline = COALESCE(public.mandatory_books.legalization_deadline, EXCLUDED.legalization_deadline);
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_acta_book_kind_for_body(p_body_type text, p_body_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_type text := upper(coalesce(p_body_type, ''));
  v_name text := upper(coalesce(p_body_name, ''));
BEGIN
  IF v_type = 'JUNTA' OR v_name LIKE '%JUNTA%' THEN
    RETURN 'LIBRO_ACTAS_JUNTA_GENERAL';
  ELSIF v_type = 'CDA' OR v_name LIKE '%CONSEJO%' THEN
    RETURN 'LIBRO_ACTAS_CONSEJO_ADMINISTRACION';
  ELSIF v_name LIKE '%AUDITOR%' THEN
    RETURN 'LIBRO_ACTAS_COMISION_AUDITORIA';
  ELSIF v_name LIKE '%NOMBRAM%' OR v_name LIKE '%RETRIB%' THEN
    RETURN 'LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES';
  ELSIF v_name LIKE '%RIESG%' THEN
    RETURN 'LIBRO_ACTAS_COMISION_RIESGOS';
  ELSIF v_name LIKE '%EJECUT%' THEN
    RETURN 'LIBRO_ACTAS_COMISION_EJECUTIVA';
  ELSIF v_type IN ('COMISION', 'COMITE') THEN
    RETURN 'LIBRO_ACTAS_COMISION_DELEGADA';
  END IF;

  RETURN 'LIBRO_ACTAS';
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_seed_mandatory_books(p_entity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_entity record;
  v_tipo text;
  v_period integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
  v_deadline date := make_date(v_period + 1, 4, 30);
  v_body record;
  v_is_insurance_listed boolean;
BEGIN
  SELECT id, tenant_id, tipo_social, legal_form, es_cotizada, regulated_sector
    INTO v_entity
    FROM public.entities
   WHERE id = p_entity_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_tipo := upper(coalesce(nullif(v_entity.tipo_social, ''), v_entity.legal_form, ''));
  v_is_insurance_listed := coalesce(v_entity.es_cotizada, false)
    AND upper(coalesce(v_entity.regulated_sector, '')) LIKE '%SEGURO%';

  -- Legacy compatibility: existing tests and flows expect LIBRO_ACTAS.
  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'LIBRO_ACTAS', v_period, v_deadline,
    'LIBRO_MERCANTIL', 'arts. 202 y 250 LSC; arts. 97-107 y 109 RRM',
    'Secretario societario', true, 'OBLIGATORIA', 'Legalizacion telematica anual',
    'Contenedor legacy; seccionado por organo desde meetings/minutes.',
    '/secretaria/actas', ARRAY['LSC', 'RRM']::text[]
  );

  FOR v_body IN
    SELECT id, name, body_type
      FROM public.governing_bodies
     WHERE entity_id = p_entity_id
       AND tenant_id = v_entity.tenant_id
  LOOP
    PERFORM public.fn_upsert_mandatory_book_v2(
      v_entity.tenant_id,
      p_entity_id,
      v_body.id,
      public.fn_acta_book_kind_for_body(v_body.body_type, v_body.name),
      v_period,
      v_deadline,
      'LIBRO_MERCANTIL',
      CASE public.fn_acta_book_kind_for_body(v_body.body_type, v_body.name)
        WHEN 'LIBRO_ACTAS_JUNTA_GENERAL' THEN 'arts. 202-203 LSC; arts. 97-107 RRM'
        WHEN 'LIBRO_ACTAS_CONSEJO_ADMINISTRACION' THEN 'art. 250 LSC; art. 109 RRM'
        WHEN 'LIBRO_ACTAS_COMISION_AUDITORIA' THEN 'art. 529 quaterdecies LSC; Ley 22/2015'
        WHEN 'LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES' THEN 'art. 529 quindecies LSC'
        WHEN 'LIBRO_ACTAS_COMISION_RIESGOS' THEN 'arts. 65-66 Ley 20/2015; arts. 44-46 RD 1060/2015; reglamento del Consejo'
        WHEN 'LIBRO_ACTAS_COMISION_EJECUTIVA' THEN 'art. 249 LSC; art. 249 bis LSC'
        ELSE 'art. 250 LSC por analogia; reglamento del Consejo'
      END,
      CASE WHEN public.fn_acta_book_kind_for_body(v_body.body_type, v_body.name)
        IN ('LIBRO_ACTAS_JUNTA_GENERAL', 'LIBRO_ACTAS_CONSEJO_ADMINISTRACION')
        THEN 'Secretario del Consejo de Administracion'
        ELSE 'Secretario de la comision'
      END,
      true,
      CASE WHEN public.fn_acta_book_kind_for_body(v_body.body_type, v_body.name)
        IN ('LIBRO_ACTAS_JUNTA_GENERAL', 'LIBRO_ACTAS_CONSEJO_ADMINISTRACION')
        THEN 'OBLIGATORIA'
        ELSE 'RECOMENDADA'
      END,
      CASE WHEN public.fn_acta_book_kind_for_body(v_body.body_type, v_body.name)
        IN ('LIBRO_ACTAS_JUNTA_GENERAL', 'LIBRO_ACTAS_CONSEJO_ADMINISTRACION')
        THEN 'Legalizacion telematica anual'
        ELSE 'Libro separado o seccion del libro del Consejo segun criterio RM'
      END,
      'Asientos desde actas vinculadas al organo; sin voto de calidad en comisiones tecnicas.',
      '/secretaria/actas',
      CASE public.fn_acta_book_kind_for_body(v_body.body_type, v_body.name)
        WHEN 'LIBRO_ACTAS_COMISION_RIESGOS' THEN ARRAY['LSC', 'DGSFP', 'Solvencia II']::text[]
        WHEN 'LIBRO_ACTAS_COMISION_AUDITORIA' THEN ARRAY['LSC', 'CNMV']::text[]
        WHEN 'LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES' THEN ARRAY['LSC', 'CNMV']::text[]
        ELSE ARRAY['LSC', 'RRM']::text[]
      END
    );
  END LOOP;

  IF v_tipo IN ('SL', 'SLU') THEN
    PERFORM public.fn_upsert_mandatory_book_v2(
      v_entity.tenant_id, p_entity_id, NULL, 'LIBRO_REGISTRO_SOCIOS', v_period, v_deadline,
      'LIBRO_MERCANTIL', 'art. 104 LSC', 'Organo de administracion',
      true, 'OBLIGATORIA', 'Legalizacion telematica anual',
      'Asientos WORM desde capital_movements y capital_holdings vigentes.',
      '/secretaria/libro-socios', ARRAY['LSC']::text[]
    );
  ELSIF v_tipo IN ('SA', 'SAU') THEN
    PERFORM public.fn_upsert_mandatory_book_v2(
      v_entity.tenant_id, p_entity_id, NULL, 'LIBRO_ACCIONES_NOMINATIVAS', v_period, v_deadline,
      'LIBRO_MERCANTIL', 'art. 116 LSC; normativa de anotaciones en cuenta para cotizadas',
      'Organo de administracion', true, 'OBLIGATORIA', 'Legalizacion telematica anual',
      'Asientos desde capital_movements y conciliacion con registro de valores en cotizadas.',
      '/secretaria/libro-socios', ARRAY['LSC', 'CNMV']::text[]
    );
  END IF;

  IF v_tipo IN ('SLU', 'SAU') THEN
    PERFORM public.fn_upsert_mandatory_book_v2(
      v_entity.tenant_id, p_entity_id, NULL, 'LIBRO_CONTRATOS_SOCIO_UNICO', v_period, v_deadline,
      'LIBRO_MERCANTIL', 'art. 16 LSC', 'Organo de administracion',
      true, 'OBLIGATORIA', 'Legalizacion telematica anual',
      'Contratos socio unico-sociedad y decisiones del art. 15 LSC.',
      '/secretaria/decisiones-unipersonales', ARRAY['LSC']::text[]
    );
  END IF;

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'LIBRO_DIARIO', v_period, v_deadline,
    'LIBRO_MERCANTIL', 'arts. 25 y ss. CCom', 'Direccion financiera',
    true, 'OBLIGATORIA', 'Legalizacion telematica anual',
    'Registro contable fuera del flujo societario; visible para gobierno documental.',
    '/secretaria/libros', ARRAY['CCom']::text[]
  );

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'LIBRO_INVENTARIOS_CUENTAS_ANUALES', v_period, v_deadline,
    'LIBRO_MERCANTIL', 'arts. 25 y ss. CCom; arts. 253 y 279 LSC',
    'Direccion financiera', true, 'OBLIGATORIA', 'Legalizacion telematica anual',
    'Coordinado con formulacion de cuentas, aprobacion por Junta y deposito.',
    '/secretaria/libros', ARRAY['CCom', 'LSC']::text[]
  );

  -- Registros auxiliares: no sustituyen al libro legal ni se legalizan.
  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_PERSONAS_CARGOS', v_period, NULL,
    'REGISTRO_AUXILIAR', 'arts. 109 y 124 RRM; arts. 214 y 529 sexies LSC',
    'Secretaria societaria', false, 'NO_APLICA', 'No legalizable; registro auxiliar',
    'SSOT de condiciones_persona, autoridad certificante e inscripcion RM.',
    '/secretaria/personas', ARRAY['RRM', 'LSC']::text[]
  );

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_CONFLICTOS_OPERACIONES_VINCULADAS', v_period, NULL,
    'REGISTRO_AUXILIAR', 'arts. 228-230 y 529 ter LSC',
    'Secretaria societaria / Cumplimiento', false, 'NO_APLICA', 'No legalizable; evidencia de compliance',
    'Snapshot de conflictos por punto y abstenciones verificables.',
    '/secretaria/reglas-aplicables', ARRAY['LSC', 'CNMV', 'D&O']::text[]
  );

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_DELEGACIONES_FACULTADES', v_period, NULL,
    'REGISTRO_AUXILIAR', 'arts. 249 y 249 bis LSC', 'Secretaria societaria',
    false, 'NO_APLICA', 'No legalizable; la delegacion puede ser inscribible',
    'Control de alcance, limites, escritura e inscripcion.',
    '/delegaciones', ARRAY['LSC', 'RRM']::text[]
  );

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_PODERES_REPRESENTACIONES', v_period, NULL,
    'REGISTRO_AUXILIAR', 'arts. 184 y 212 bis LSC; practica registral',
    'Secretaria societaria', false, 'NO_APLICA', 'No legalizable; soporte notarial/registral',
    'Poderes generales, especiales, pleitos y representantes permanentes.',
    '/secretaria/personas', ARRAY['LSC', 'RRM']::text[]
  );

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_PACTOS_PARASOCIALES', v_period, NULL,
    'REGISTRO_AUXILIAR', 'practica de buen gobierno; arts. 530-535 LSC para cotizadas',
    'Secretaria societaria', false, 'NO_APLICA', 'No legalizable; fuente contractual de warnings',
    'Vetos, compromisos de voto y alertas no invalidantes.',
    '/secretaria/reglas-aplicables', ARRAY['LSC', 'Pacto parasocial']::text[]
  );

  PERFORM public.fn_upsert_mandatory_book_v2(
    v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_COMUNICACIONES_REGULATORIAS', v_period, NULL,
    'REGISTRO_AUXILIAR', 'LOSSEAR, Solvencia II, LMV y RD 1060/2015',
    'Secretaria societaria / Cumplimiento', false, 'NO_APLICA', 'No legalizable; trazabilidad supervisora',
    'Comunicaciones DGSFP/CNMV y estado de respuesta.',
    '/secretaria/comunicaciones', ARRAY['DGSFP', 'CNMV', 'Solvencia II']::text[]
  );

  IF v_is_insurance_listed THEN
    PERFORM public.fn_upsert_mandatory_book_v2(
      v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_IDONEIDAD_FIT_PROPER', v_period, NULL,
      'REGISTRO_AUXILIAR', 'art. 38 Ley 20/2015; RD 1060/2015',
      'Secretaria societaria / Cumplimiento', false, 'NO_APLICA', 'No legalizable; expediente supervisor',
      'Idoneidad, honorabilidad, comunicaciones y renovaciones.',
      '/secretaria/personas', ARRAY['DGSFP', 'Solvencia II']::text[]
    );

    PERFORM public.fn_upsert_mandatory_book_v2(
      v_entity.tenant_id, p_entity_id, NULL, 'REGISTRO_SOLVENCIA_II_SUPERVISION', v_period, NULL,
      'REGISTRO_AUXILIAR', 'Ley 20/2015; Reglamento Delegado UE 2015/35',
      'Cumplimiento / Riesgos / Secretaria', false, 'NO_APLICA', 'No legalizable; soporte de Pilar 3',
      'SFCR, RSR, evidencias de supervision y requerimientos.',
      '/sii', ARRAY['DGSFP', 'Solvencia II']::text[]
    );
  END IF;
END;
$$;

-- Trigger remains the canonical creation path after entity insert.
CREATE OR REPLACE FUNCTION public.fn_seed_mandatory_books_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.fn_seed_mandatory_books(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entities_seed_mandatory_books ON public.entities;
CREATE TRIGGER trg_entities_seed_mandatory_books
AFTER INSERT ON public.entities
FOR EACH ROW EXECUTE FUNCTION public.fn_seed_mandatory_books_trigger();

-- Body creation can add an organ-specific acta book after onboarding.
CREATE OR REPLACE FUNCTION public.fn_seed_mandatory_book_for_body_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.entity_id IS NOT NULL THEN
    PERFORM public.fn_seed_mandatory_books(NEW.entity_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_governing_bodies_seed_mandatory_book ON public.governing_bodies;
CREATE TRIGGER trg_governing_bodies_seed_mandatory_book
AFTER INSERT ON public.governing_bodies
FOR EACH ROW EXECUTE FUNCTION public.fn_seed_mandatory_book_for_body_trigger();

DO $$
DECLARE
  v_eid uuid;
BEGIN
  FOR v_eid IN SELECT id FROM public.entities LOOP
    PERFORM public.fn_seed_mandatory_books(v_eid);
  END LOOP;
END $$;

-- Hardening (Codex review #3): estas funciones SECURITY DEFINER son helpers
-- internos, invocados por triggers y por fn_seed_mandatory_books (que corre como
-- owner via PERFORM). Aceptan tenant_id/entity_id del caller, por lo que NO deben
-- ser invocables directamente por clientes autenticados. Revocamos execute de
-- PUBLIC/anon/authenticated de forma explícita (defensa en profundidad; el owner
-- definer las sigue ejecutando). Idempotente: revoke de un grant inexistente es no-op.
REVOKE EXECUTE ON FUNCTION public.fn_upsert_mandatory_book_v2(
  uuid, uuid, uuid, text, integer, date, text, text, text, boolean, text, text, text, text, text[]
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_seed_mandatory_books(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_seed_mandatory_books_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_seed_mandatory_book_for_body_trigger() FROM PUBLIC, anon, authenticated;

COMMIT;
