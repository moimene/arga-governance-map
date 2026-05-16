-- Extend validate_capa3_override trigger with deny-list of protected field names.
-- Reported by human PR review (H5): without a deny-list, a malformed plantilla
-- or an admin with capa3_editables write access could declare a capa3 field with
-- the same name as a protected MOTOR/SISTEMA/QTSP/entity variable, then create
-- an entity-scoped override that wins in mergeVariables — overwriting the
-- compliance snapshot, tenant_id, agreement_id, etc. in generated documents.
--
-- Defense: reject the override row at trigger level if `campo` matches any
-- protected name or prefix.

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
  -- Caso especial: 'tenant_id', 'entity_id', 'agreement_id' coinciden exactos.
  FOREACH v_prefix IN ARRAY v_protected_prefixes
  LOOP
    IF NEW.campo = v_prefix OR NEW.campo LIKE v_prefix || '%' THEN
      RAISE EXCEPTION 'Override rechazado: campo "%" usa prefijo protegido "%". Capa 3 no puede sobrescribir variables MOTOR/SISTEMA/identificadores. Renombra el campo en capa3_editables.', NEW.campo, v_prefix;
    END IF;
  END LOOP;

  -- Campo debe existir en capa3_editables (parameterized jsonpath)
  IF v_plantilla.capa3_editables IS NOT NULL THEN
    SELECT jsonb_path_exists(
      v_plantilla.capa3_editables,
      '$[*] ? (@.campo == $c)'::jsonpath,
      jsonb_build_object('c', NEW.campo)
    ) INTO v_campo_exists;
    IF NOT v_campo_exists THEN
      RAISE EXCEPTION 'campo=% no existe en capa3_editables de plantilla_id=%', NEW.campo, NEW.plantilla_id;
    END IF;
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
      RAISE EXCEPTION 'default_value_override % no esta en opciones_override %', NEW.default_value_override, NEW.opciones_override;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
