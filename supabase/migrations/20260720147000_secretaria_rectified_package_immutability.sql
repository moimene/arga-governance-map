-- Secretaría — inmutabilidad autoritativa de anexos de convocatoria.
--
-- Un anexo solo puede incorporarse mientras la convocatoria y su paquete
-- siguen abiertos. La regla vive en la tabla para cubrir por igual la Edge
-- Function, el RPC de registro verificado y cualquier futuro escritor con
-- privilegios de servicio. Las reejecuciones idempotentes que no cambian la
-- identidad de un anexo ya registrado siguen permitidas.

BEGIN;

CREATE OR REPLACE FUNCTION secretaria_private.fn_supporting_attachment_open_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_convocatoria_state text;
BEGIN
  IF NEW.convocatoria_id IS NULL
     OR NEW.artifact_kind IS DISTINCT FROM 'SUPPORTING_DOCUMENT' THEN
    RETURN NEW;
  END IF;

  -- Una actualización puramente técnica de verificación no incorpora ni
  -- reubica un anexo y conserva la idempotencia del registro autoritativo.
  IF TG_OP = 'UPDATE'
     AND NEW.tenant_id IS NOT DISTINCT FROM OLD.tenant_id
     AND NEW.convocatoria_id IS NOT DISTINCT FROM OLD.convocatoria_id
     AND NEW.artifact_kind IS NOT DISTINCT FROM OLD.artifact_kind THEN
    RETURN NEW;
  END IF;

  -- Mismo orden de serialización que emisión, armado, dispatch y lifecycle.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'COMMUNICATION:CONVOCATORIA:'
        || NEW.tenant_id::text || ':' || NEW.convocatoria_id::text,
      0
    )
  );

  SELECT convocatoria.estado
    INTO v_convocatoria_state
    FROM public.convocatorias convocatoria
   WHERE convocatoria.id = NEW.convocatoria_id
     AND convocatoria.tenant_id = NEW.tenant_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SUPPORTING_ATTACHMENT_CONVOCATORIA_TENANT_MISMATCH'
      USING ERRCODE = '23514';
  END IF;

  IF v_convocatoria_state IN ('RECTIFICADA', 'CANCELADA') THEN
    RAISE EXCEPTION 'TERMINAL_CONVOCATION_SUPPORTING_ATTACHMENTS_ARE_IMMUTABLE'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.convocation_manifests manifest
     WHERE manifest.tenant_id = NEW.tenant_id
       AND manifest.convocatoria_id = NEW.convocatoria_id
       AND manifest.immutable_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'IMMUTABLE_CONVOCATION_MANIFEST_FREEZES_SUPPORTING_ATTACHMENTS'
      USING ERRCODE = '55000';
  END IF;

  -- La existencia del agregado de comunicación significa que el paquete ya
  -- fue ensamblado. CANCELADA no reabre ese histórico ni habilita mutaciones.
  IF EXISTS (
    SELECT 1
      FROM public.communications communication
     WHERE communication.tenant_id = NEW.tenant_id
       AND communication.convocatoria_id = NEW.convocatoria_id
       AND communication.tipo_comunicacion = 'CONVOCATORIA'
  ) THEN
    RAISE EXCEPTION 'ASSEMBLED_CONVOCATION_PACKAGE_FREEZES_SUPPORTING_ATTACHMENTS'
      USING ERRCODE = '55000';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION secretaria_private.fn_supporting_attachment_open_guard()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_supporting_attachment_open_insert_guard
  ON public.attachments;
CREATE TRIGGER trg_00_supporting_attachment_open_insert_guard
  BEFORE INSERT ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_supporting_attachment_open_guard();

DROP TRIGGER IF EXISTS trg_00_supporting_attachment_open_rebind_guard
  ON public.attachments;
CREATE TRIGGER trg_00_supporting_attachment_open_rebind_guard
  BEFORE UPDATE OF tenant_id, convocatoria_id, artifact_kind ON public.attachments
  FOR EACH ROW
  EXECUTE FUNCTION secretaria_private.fn_supporting_attachment_open_guard();

COMMENT ON FUNCTION secretaria_private.fn_supporting_attachment_open_guard() IS
  'Impide incorporar o reubicar anexos cuando la convocatoria es terminal, existe manifiesto WORM o el paquete de comunicación ya fue ensamblado; serializa con el lifecycle de convocatoria.';

COMMIT;
