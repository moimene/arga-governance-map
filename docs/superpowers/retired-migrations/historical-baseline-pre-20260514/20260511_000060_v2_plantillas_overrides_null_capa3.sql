-- ============================================================================
-- Migration: 20260511_000060_v2_plantillas_overrides_null_capa3.sql
-- Purpose: Cerrar hallazgo Codex P2 — overrides aceptados sobre plantillas con
--          capa3_editables IS NULL (sin campo canónico al que aplicar).
--
-- Context:
--   La 000058 valida que NEW.campo exista en plantilla.capa3_editables, pero
--   envuelve la comprobación en:
--     IF v_plantilla.capa3_editables IS NOT NULL THEN ...
--   Cuando una plantilla legacy o BORRADOR sin capa3 declarado tiene
--   capa3_editables = NULL, la guarda salta en silencio y deja overrides
--   activos sin campo canónico de destino. El motor mergeVariables podría
--   entonces aplicar default_value_override/opciones_override sobre un campo
--   "fantasma" (no presente en UI ni en la composición), o el campo aparecer
--   en mergedCapa3 solo desde la rama overrides → desalineación.
--
-- Fix:
--   Antes de la existence check, rechazar explícitamente cualquier override
--   cuando v_plantilla.capa3_editables IS NULL. Una plantilla sin capa3
--   declarado no admite overrides — la corrección de negocio es promover
--   capa3_editables a un array vacío `[]` o popularlo con el campo y luego
--   crear el override.
--
-- Sin nuevas tablas, sin nuevas columnas. CREATE OR REPLACE FUNCTION;
-- el trigger tr_validate_capa3_override de 000058 sigue activo.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION validate_capa3_override()
RETURNS TRIGGER AS $$
DECLARE
  v_plantilla plantillas_protegidas%ROWTYPE;
  v_campo_exists boolean;
  v_protected_prefixes text[] := ARRAY[
    'snapshot_', 'resultado_', 'rule_pack', 'normative_',
    'tenant_id', 'entity_id', 'agreement_id',
    'entities.', 'agreements.', 'meetings.', 'mandates.',
    'SISTEMA', 'QTSP', 'MOTOR', 'firma_qes', 'tsq_'
  ];
  v_prefix text;
BEGIN
  SELECT * INTO v_plantilla FROM plantillas_protegidas WHERE id = NEW.plantilla_id;

  -- R11: plantilla debe estar ACTIVA
  IF v_plantilla.estado <> 'ACTIVA' THEN
    RAISE EXCEPTION 'No se permite override sobre plantilla con estado=% (debe ser ACTIVA)', v_plantilla.estado;
  END IF;

  -- H5 deny-list: rechazar campos con prefijo protegido (snapshot, resultado,
  -- tenant/entity/agreement ids, dotted entity sources, MOTOR/SISTEMA/QTSP).
  -- Sin esto, una plantilla mal configurada (o un admin con write a capa3_editables)
  -- podría declarar un campo capa3 con el mismo nombre que una variable
  -- auto-resuelta del MOTOR LSC y sobrescribirla en mergeVariables.
  FOREACH v_prefix IN ARRAY v_protected_prefixes
  LOOP
    IF NEW.campo = v_prefix OR NEW.campo LIKE v_prefix || '%' THEN
      RAISE EXCEPTION 'Override rechazado: campo "%" usa prefijo protegido "%". Capa 3 no puede sobrescribir variables MOTOR/SISTEMA/identificadores. Renombra el campo en capa3_editables.', NEW.campo, v_prefix;
    END IF;
  END LOOP;

  -- 000060: Si capa3_editables IS NULL, rechazar overrides explícitamente.
  -- Antes 000058 saltaba en silencio (IF capa3_editables IS NOT NULL THEN…),
  -- permitiendo overrides huérfanos sobre plantillas legacy sin campo canónico.
  IF v_plantilla.capa3_editables IS NULL THEN
    RAISE EXCEPTION 'No se pueden registrar overrides en plantilla sin capa3_editables (plantilla %). Promueve capa3_editables a array primero.', NEW.plantilla_id;
  END IF;

  -- Campo debe existir en capa3_editables (ahora garantizado no-NULL)
  SELECT jsonb_path_exists(
    v_plantilla.capa3_editables,
    '$[*] ? (@.campo == $c)'::jsonpath,
    jsonb_build_object('c', NEW.campo)
  ) INTO v_campo_exists;
  IF NOT v_campo_exists THEN
    RAISE EXCEPTION 'campo=% no existe en capa3_editables de plantilla_id=%', NEW.campo, NEW.plantilla_id;
  END IF;

  -- F5: opciones_override = [] vacío rechazado
  IF NEW.opciones_override IS NOT NULL THEN
    IF jsonb_typeof(NEW.opciones_override) <> 'array' THEN
      RAISE EXCEPTION 'opciones_override debe ser array JSON';
    END IF;
    IF jsonb_array_length(NEW.opciones_override) = 0 THEN
      RAISE EXCEPTION 'opciones_override no puede ser array vacío (rompe UI)';
    END IF;
  END IF;

  -- default_value_override debe estar en opciones_override (si ambos definidos)
  IF NEW.default_value_override IS NOT NULL AND NEW.opciones_override IS NOT NULL THEN
    IF NOT (NEW.opciones_override @> jsonb_build_array(NEW.default_value_override)) THEN
      RAISE EXCEPTION 'default_value_override % no está en opciones_override %', NEW.default_value_override, NEW.opciones_override;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION validate_capa3_override() IS 'capa3 override guard hardened (000060): rechaza overrides sobre plantillas con capa3_editables IS NULL (antes saltaba en silencio).';

COMMIT;

-- ============================================================================
-- END migration 20260511_000060_v2_plantillas_overrides_null_capa3
-- ============================================================================
