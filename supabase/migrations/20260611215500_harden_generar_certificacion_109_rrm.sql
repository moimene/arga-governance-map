-- ITEM-015 [P1] — loop estabilización Secretaría (2026-06-11)
-- ============================================================================
-- Art. 109 RRM (BOE-A-1996-17533, literal verificado):
--   109.1.a — las certificaciones de acuerdos de órganos colegiados las
--   expide el secretario (o vicesecretario) y «se emitirán siempre con el
--   Visto Bueno del Presidente o, en su caso, del Vicepresidente» — SIN
--   distinción de tipo social.
--   109.4 — «No se podrán certificar acuerdos que no consten en actas
--   aprobadas y firmadas o en acta notarial».
-- La RPC vigente: (a) exigía el Vº Bº solo si legal_form='SA' (una SL con
-- consejo, o una 'SAU', certificaba sin Vº Bº); (b) aceptaba cualquier uuid
-- como Vº Bº sin validar cargo vigente; (c) certificaba actas sin firmar;
-- (d) la autoridad del certificante se buscaba a nivel entidad ignorando el
-- órgano del acta. Tras ITEM-003 (acción "Aprobar y firmar acta") el gate
-- 109.4 server-side ya no estrangula el flujo operativo.
-- Forward-only, misma firma; resto del cuerpo idéntico al vigente.

CREATE OR REPLACE FUNCTION public.fn_generar_certificacion(p_minute_id uuid, p_tipo text, p_agreements_certified text[], p_certificante_role text, p_visto_bueno_persona_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_cert_id        uuid;
  v_minute         RECORD;
  v_entity         entities%ROWTYPE;
  v_snapshot_hash  text;
  v_resultado_hash text;
  v_gate_hash      text;
  v_requires_vb    boolean;
  v_auth_ev_id     uuid;
  v_vb_auth_id     uuid;
BEGIN
  SELECT m.*, al.hash_sha512 AS snapshot_hash_resolved
    INTO v_minute
    FROM minutes m
    LEFT JOIN censo_snapshot c ON c.id = m.snapshot_id
    LEFT JOIN audit_log      al ON al.id = c.audit_worm_id
   WHERE m.id = p_minute_id;
  IF v_minute.id IS NULL THEN
    RAISE EXCEPTION 'minute not found: %', p_minute_id;
  END IF;

  -- ITEM-015 (RRM art. 109.4): solo se certifican acuerdos de actas
  -- aprobadas y firmadas.
  IF v_minute.signed_at IS NULL THEN
    RAISE EXCEPTION 'RRM art. 109.4: el acta % no está aprobada y firmada — usa "Aprobar y firmar acta" antes de certificar', p_minute_id;
  END IF;

  SELECT * INTO v_entity FROM entities WHERE id = v_minute.entity_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'entity not found for minute %', p_minute_id;
  END IF;

  -- ITEM-015 (RRM art. 109.1.a): el Vº Bº del Presidente/Vicepresidente se
  -- exige SIEMPRE que certifica el secretario de un órgano colegiado, con
  -- independencia del tipo social (antes: solo legal_form='SA').
  v_requires_vb := (p_certificante_role IN ('SECRETARIO', 'VICESECRETARIO'));
  IF v_requires_vb AND p_visto_bueno_persona_id IS NULL THEN
    RAISE EXCEPTION 'RRM art. 109.1.a: la certificación del secretario requiere el Vº Bº del Presidente o Vicepresidente';
  END IF;

  -- ITEM-015: el Vº Bº debe ostentar PRESIDENTE/VICEPRESIDENTE vigente en la
  -- entidad (preferentemente en el órgano del acta).
  IF v_requires_vb THEN
    SELECT id INTO v_vb_auth_id
      FROM authority_evidence
     WHERE entity_id = v_minute.entity_id
       AND person_id = p_visto_bueno_persona_id
       AND cargo IN ('PRESIDENTE', 'VICEPRESIDENTE')
       AND estado = 'VIGENTE'
       AND (v_minute.body_id IS NULL OR body_id = v_minute.body_id OR body_id IS NULL)
     ORDER BY (body_id = v_minute.body_id) DESC NULLS LAST, fecha_inicio DESC
     LIMIT 1;
    IF v_vb_auth_id IS NULL THEN
      RAISE EXCEPTION 'RRM art. 109.1.a: la persona del Vº Bº no ostenta PRESIDENTE/VICEPRESIDENTE vigente en la entidad %', v_minute.entity_id;
    END IF;
  END IF;

  -- ITEM-015: la autoridad del certificante se resuelve con preferencia por
  -- el órgano del acta (antes: cualquier AE de la entidad, sin body).
  SELECT id INTO v_auth_ev_id
    FROM authority_evidence
   WHERE entity_id = v_minute.entity_id
     AND cargo = p_certificante_role
     AND estado = 'VIGENTE'
     AND (v_minute.body_id IS NULL OR body_id = v_minute.body_id OR body_id IS NULL)
   ORDER BY (body_id = v_minute.body_id) DESC NULLS LAST, fecha_inicio DESC
   LIMIT 1;
  IF v_auth_ev_id IS NULL THEN
    RAISE EXCEPTION 'No hay autoridad vigente para cargo % en entity %',
      p_certificante_role, v_minute.entity_id;
  END IF;

  v_snapshot_hash  := COALESCE(v_minute.snapshot_hash_resolved, 'NO_SNAPSHOT_HASH');
  v_resultado_hash := encode(
    digest(
      COALESCE(array_to_string(p_agreements_certified, '|'), ''),
      'sha256'
    ),
    'hex'
  );
  v_gate_hash := encode(
    digest(
      v_snapshot_hash ||
      COALESCE(v_minute.canonical_minutes_hash, 'NO_CANONICAL_MINUTES_HASH') ||
      v_resultado_hash,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO certifications (
    tenant_id, agreement_id, agreements_certified, certifier_id,
    content, minute_id,
    tipo_certificacion, certificante_role,
    visto_bueno_persona_id, visto_bueno_fecha,
    gate_hash, authority_evidence_id,
    requires_qualified_signature, signature_status
  ) VALUES (
    v_minute.tenant_id, NULL, p_agreements_certified, NULL,
    NULL, p_minute_id,
    p_tipo, p_certificante_role,
    p_visto_bueno_persona_id,
    CASE WHEN p_visto_bueno_persona_id IS NOT NULL THEN now() ELSE NULL END,
    v_gate_hash, v_auth_ev_id,
    true, 'PENDING'
  )
  RETURNING id INTO v_cert_id;

  RETURN v_cert_id;
END;
$function$;
