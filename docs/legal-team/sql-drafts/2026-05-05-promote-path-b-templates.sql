-- 2026-05-05 - Path B promotion
--
-- Purpose:
-- Promote the 16 Path B template improvements that were inserted as BORRADOR
-- after the Garrigues legal decision dated 2026-05-04.
--
-- This is a data promotion script, not a schema migration. It archives exactly
-- one previous ACTIVA predecessor per Path B template and promotes exactly one
-- BORRADOR successor to ACTIVA. It fails closed on count drift.

BEGIN;

CREATE TEMP TABLE _path_b_expected (
  tipo text NOT NULL,
  materia text NOT NULL,
  version text NOT NULL
) ON COMMIT DROP;

INSERT INTO _path_b_expected (tipo, materia, version) VALUES
  ('CONVOCATORIA', 'CONVOCATORIA_JUNTA', '1.2.0'),
  ('CONVOCATORIA_SL_NOTIFICACION', 'NOTIFICACION_CONVOCATORIA_SL', '1.2.0'),
  ('ACTA_SESION', 'JUNTA_GENERAL', '1.2.0'),
  ('ACTA_SESION', 'CONSEJO_ADMIN', '1.2.0'),
  ('CERTIFICACION', 'CERTIFICACION_ACUERDOS', '1.3.0'),
  ('INFORME_DOCUMENTAL_PRE', 'EXPEDIENTE_PRE', '1.1.0'),
  ('INFORME_PRECEPTIVO', 'CONVOCATORIA_PRE', '1.1.0'),
  ('ACTA_ACUERDO_ESCRITO', 'ACUERDO_SIN_SESION', '1.3.0'),
  ('ACTA_CONSIGNACION', 'DECISION_SOCIO_UNICO', '1.2.0'),
  ('ACTA_CONSIGNACION', 'DECISION_ADMIN_UNICO', '1.2.0'),
  ('ACTA_DECISION_CONJUNTA', 'CO_APROBACION', '1.1.0'),
  ('ACTA_ORGANO_ADMIN', 'ADMIN_SOLIDARIO', '1.1.0'),
  ('MODELO_ACUERDO', 'APROBACION_CUENTAS', '1.1.0'),
  ('MODELO_ACUERDO', 'FORMULACION_CUENTAS', '1.1.0'),
  ('MODELO_ACUERDO', 'DELEGACION_FACULTADES', '1.1.0'),
  ('MODELO_ACUERDO', 'OPERACION_VINCULADA', '1.1.0');

DO $$
DECLARE
  v_expected_count integer;
  v_draft_count integer;
  v_draft_problem_count integer;
  v_active_predecessor_count integer;
  v_active_problem_count integer;
  v_archived_count integer;
  v_promoted_count integer;
  v_duplicate_active_count integer;
BEGIN
  SELECT count(*) INTO v_expected_count FROM _path_b_expected;
  IF v_expected_count <> 16 THEN
    RAISE EXCEPTION 'Path B promotion expected 16 rows, got %', v_expected_count;
  END IF;

  WITH drafts AS (
    SELECT p.id, p.tenant_id, p.tipo, p.materia, p.version
    FROM plantillas_protegidas p
    JOIN _path_b_expected e
      ON e.tipo = p.tipo
     AND e.materia = p.materia
     AND e.version = p.version
    WHERE p.estado = 'BORRADOR'
      AND p.aprobada_por = 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)'
      AND p.fecha_aprobacion = '2026-05-02'
  )
  SELECT count(*) INTO v_draft_count FROM drafts;

  IF v_draft_count <> 16 THEN
    RAISE EXCEPTION 'Path B promotion requires exactly 16 BORRADOR successors, got %', v_draft_count;
  END IF;

  WITH per_expected AS (
    SELECT e.tipo, e.materia, e.version, count(p.id) AS draft_count
    FROM _path_b_expected e
    LEFT JOIN plantillas_protegidas p
      ON p.tipo = e.tipo
     AND p.materia = e.materia
     AND p.version = e.version
     AND p.estado = 'BORRADOR'
     AND p.aprobada_por = 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)'
     AND p.fecha_aprobacion = '2026-05-02'
    GROUP BY e.tipo, e.materia, e.version
  )
  SELECT count(*) INTO v_draft_problem_count
  FROM per_expected
  WHERE draft_count <> 1;

  IF v_draft_problem_count <> 0 THEN
    RAISE EXCEPTION 'Path B promotion found % draft groups without exactly one successor', v_draft_problem_count;
  END IF;

  WITH drafts AS (
    SELECT p.id, p.tenant_id, p.tipo, p.materia, p.version
    FROM plantillas_protegidas p
    JOIN _path_b_expected e
      ON e.tipo = p.tipo
     AND e.materia = p.materia
     AND e.version = p.version
    WHERE p.estado = 'BORRADOR'
      AND p.aprobada_por = 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)'
      AND p.fecha_aprobacion = '2026-05-02'
  ),
  predecessors AS (
    SELECT a.id, a.tipo, a.materia, a.version
    FROM plantillas_protegidas a
    JOIN drafts d
      ON d.tenant_id = a.tenant_id
     AND d.tipo = a.tipo
     AND d.materia = a.materia
    WHERE a.estado = 'ACTIVA'
      AND a.id <> d.id
  )
  SELECT count(*) INTO v_active_predecessor_count FROM predecessors;

  IF v_active_predecessor_count <> 16 THEN
    RAISE EXCEPTION 'Path B promotion requires exactly 16 ACTIVA predecessors, got %', v_active_predecessor_count;
  END IF;

  WITH drafts AS (
    SELECT p.id, p.tenant_id, p.tipo, p.materia, p.version
    FROM plantillas_protegidas p
    JOIN _path_b_expected e
      ON e.tipo = p.tipo
     AND e.materia = p.materia
     AND e.version = p.version
    WHERE p.estado = 'BORRADOR'
      AND p.aprobada_por = 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)'
      AND p.fecha_aprobacion = '2026-05-02'
  ),
  per_draft AS (
    SELECT d.id, d.tipo, d.materia, count(a.id) AS active_count
    FROM drafts d
    LEFT JOIN plantillas_protegidas a
      ON d.tenant_id = a.tenant_id
     AND d.tipo = a.tipo
     AND d.materia = a.materia
     AND a.estado = 'ACTIVA'
     AND a.id <> d.id
    GROUP BY d.id, d.tipo, d.materia
  )
  SELECT count(*) INTO v_active_problem_count
  FROM per_draft
  WHERE active_count <> 1;

  IF v_active_problem_count <> 0 THEN
    RAISE EXCEPTION 'Path B promotion found % draft groups without exactly one active predecessor', v_active_problem_count;
  END IF;

  WITH drafts AS (
    SELECT p.id, p.tenant_id, p.tipo, p.materia, p.version
    FROM plantillas_protegidas p
    JOIN _path_b_expected e
      ON e.tipo = p.tipo
     AND e.materia = p.materia
     AND e.version = p.version
    WHERE p.estado = 'BORRADOR'
      AND p.aprobada_por = 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)'
      AND p.fecha_aprobacion = '2026-05-02'
  ),
  archived AS (
    UPDATE plantillas_protegidas old
    SET estado = 'ARCHIVADA',
        version_history = coalesce(old.version_history, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'from', old.version,
            'to', d.version,
            'at', now(),
            'by', 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
            'reason', 'Path B promotion: archive predecessor before activating approved successor'
          )
        )
    FROM drafts d
    WHERE old.tenant_id = d.tenant_id
      AND old.tipo = d.tipo
      AND old.materia = d.materia
      AND old.estado = 'ACTIVA'
      AND old.id <> d.id
    RETURNING old.id
  )
  SELECT count(*) INTO v_archived_count FROM archived;

  IF v_archived_count <> 16 THEN
    RAISE EXCEPTION 'Path B promotion archived %, expected 16', v_archived_count;
  END IF;

  WITH promoted AS (
    UPDATE plantillas_protegidas p
    SET estado = 'ACTIVA',
        version_history = coalesce(p.version_history, '[]'::jsonb) || jsonb_build_array(
          jsonb_build_object(
            'from', 'BORRADOR',
            'to', 'ACTIVA',
            'at', now(),
            'by', 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)',
            'reason', 'Path B approved successor promoted after predecessor archival'
          )
        )
    FROM _path_b_expected e
    WHERE p.tipo = e.tipo
      AND p.materia = e.materia
      AND p.version = e.version
      AND p.estado = 'BORRADOR'
      AND p.aprobada_por = 'Comité Legal ARGA — Secretaría Societaria (demo-operativo)'
      AND p.fecha_aprobacion = '2026-05-02'
    RETURNING p.id
  )
  SELECT count(*) INTO v_promoted_count FROM promoted;

  IF v_promoted_count <> 16 THEN
    RAISE EXCEPTION 'Path B promotion promoted %, expected 16', v_promoted_count;
  END IF;

  WITH expected_active AS (
    SELECT p.tenant_id, p.tipo, p.materia, count(*) AS active_count
    FROM plantillas_protegidas p
    JOIN _path_b_expected e
      ON e.tipo = p.tipo
     AND e.materia = p.materia
    WHERE p.estado = 'ACTIVA'
    GROUP BY p.tenant_id, p.tipo, p.materia
  )
  SELECT count(*) INTO v_duplicate_active_count
  FROM expected_active
  WHERE active_count <> 1;

  IF v_duplicate_active_count <> 0 THEN
    RAISE EXCEPTION 'Path B promotion left % active duplicate/missing groups', v_duplicate_active_count;
  END IF;

  RAISE NOTICE 'Path B promotion complete: archived %, promoted %', v_archived_count, v_promoted_count;
END $$;

SELECT
  p.tipo,
  p.materia,
  p.version,
  p.estado,
  p.aprobada_por,
  p.fecha_aprobacion
FROM plantillas_protegidas p
JOIN _path_b_expected e
  ON e.tipo = p.tipo
 AND e.materia = p.materia
 AND e.version = p.version
ORDER BY p.tipo, p.materia, p.version;

COMMIT;
