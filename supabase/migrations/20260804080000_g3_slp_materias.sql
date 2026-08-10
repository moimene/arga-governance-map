-- G3 Task 4 — Materias SLP nuevas exigidas por los 12 puntos reales de la
-- Junta de Socios 2026 de Garrigues. Clasificación RESUELTA por el Comité
-- Legal el 2026-08-04 (docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md).
--
-- Criterio vinculante: ninguna de las 4 materias de socio (admisión,
-- exclusión, continuidad, retribución) es 'ESPECIAL'. `matter_class='ESPECIAL'`
-- las excluiría de `filterAgreementCompatibleMaterias` (src/lib/secretaria/
-- matter-class.ts) y por tanto del selector genérico de materias — una
-- materia reservada del gate de informe preceptivo (Task 7) que quedara
-- fuera del circuito general produciría un falso negativo silencioso: una
-- Junta que acuerda sin que el sistema pregunte nunca por el informe del
-- órgano informante. ESPECIAL queda reservada a lo que tenga un pathway
-- propio de verdad (PACTO_PARASOCIAL, EXCLUSION_SOCIO judicial, SEPARACION_SOCIO).
--
-- `materia_catalog` es tabla GLOBAL (sin tenant_id): estas filas quedan
-- visibles también para ARGA, que no las usa — cero cambio de comportamiento
-- (ARGA no tiene rule pack ni agreement que referencie estos códigos; ningún
-- selector ni regla existente de ARGA cambia).
--
-- Notas de clasificación (no exhaustivas — detalle completo en el registro
-- legal citado arriba):
--   - ADMISION_SOCIO_CUOTA / EXCLUSION_SOCIO_ESTATUTARIA: cambio de socios,
--     inscribible (art. 8 Ley 2/2007 — escritura pública + inscripción).
--   - CONTINUIDAD_SOCIO_POST_60 / RETRIBUCION_PRESTACIONES_ACCESORIAS: no
--     cambian el círculo de socios ni la administración inscrita — no
--     inscribibles (inscribable=false implica requires_notary=false y
--     requires_registry=false, patrón del resto del catálogo).
--     RETRIBUCION_PRESTACIONES_ACCESORIAS (fix round 1, contraorden sobre
--     I-2): cotejados los Estatutos REALES de la SLP, el art. 12.6 configura
--     la retribución de las prestaciones accesorias como acuerdo ANUAL de la
--     Junta de Socios (propuesta del Órgano de Administración, previo informe
--     del Consejo de Socios) — no es modificación estatutaria, no exige
--     escritura ni registro. Distinta de su hermana PRESTACIONES_ACCESORIAS
--     (true/true/true), que cubre crear/modificar el régimen estatutario
--     (arts. 86-89 LSC → art. 30.2.f Estatutos).
--   - INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA: ESTRUCTURAL (no
--     ESTATUTARIA) — aumento de capital con supresión del derecho de
--     preferencia (art. 308 LSC) para incorporar un despacho como socio.
--   - NOMBRAMIENTO_ADMINISTRADOR_UNICO: ORDINARIA e inscribible — punto 1.2
--     real de la Junta 2026 (cese + reelección de Vives, BORME I/A 960);
--     identidad nueva, no colisiona con NOMBRAMIENTO_CONSEJERO/AUDITOR/CESE/
--     REPRESENTANTE_FILIAL.
--   - El plazo de inscripción (30 días) cita el RRM (art. 83 RRM — 1 mes),
--     nunca la Ley 2/2007: esta última obliga a inscribir pero no fija plazos
--     (mismo criterio aplicado en G3 Task 3, fix C-1, sobre GARR_JUNTA_SOCIOS).

BEGIN;

INSERT INTO public.materia_catalog (
  materia,
  materia_label_es,
  requires_notary,
  requires_registry,
  inscribable,
  matter_class,
  min_majority_code,
  publication_required,
  plazo_inscripcion_dias,
  referencia_legal
)
VALUES
  ('ADMISION_SOCIO_CUOTA', 'Admisión de socio de cuota', true, true, true, 'ESTATUTARIA', 'REFORZADA_2_3', false, 30, 'arts. 9.2, 30.3.b) y 39.5.b) Estatutos (mayoría 80%); arts. 13 y 8 Ley 2/2007'),
  ('EXCLUSION_SOCIO_ESTATUTARIA', 'Exclusión estatutaria de socio (retiro a los 60)', true, true, true, 'ESTATUTARIA', 'REFORZADA_2_3', false, 30, 'art. 21.1.e Estatutos; arts. 15 y 16 Ley 2/2007; art. 83 RRM (plazo)'),
  ('CONTINUIDAD_SOCIO_POST_60', 'Continuidad del socio tras los 60', false, false, false, 'ESTATUTARIA', 'REFORZADA_2_3', false, null, 'art. 21.1.e Estatutos'),
  ('RETRIBUCION_PRESTACIONES_ACCESORIAS', 'Retribución de prestaciones accesorias', false, false, false, 'ESTATUTARIA', 'REFORZADA_2_3', false, null, 'arts. 10.7, 12 y 30.2.j) Estatutos; art. 89 LSC'),
  ('INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA', 'Integración de despacho (aumento sin derecho de preferencia)', true, true, true, 'ESTRUCTURAL', 'REFORZADA_2_3', true, 30, 'art. 296 LSC (aumento de capital); art. 308 LSC (supresión del derecho de preferencia)'),
  ('NOMBRAMIENTO_ADMINISTRADOR_UNICO', 'Nombramiento de administrador único', true, true, true, 'ORDINARIA', 'SIMPLE', false, 30, 'art. 210 LSC; art. 8 Ley 2/2007 (escritura pública e inscripción); art. 83 RRM (plazo)')
ON CONFLICT (materia) DO UPDATE SET
  materia_label_es = EXCLUDED.materia_label_es,
  requires_notary = EXCLUDED.requires_notary,
  requires_registry = EXCLUDED.requires_registry,
  inscribable = EXCLUDED.inscribable,
  matter_class = EXCLUDED.matter_class,
  min_majority_code = EXCLUDED.min_majority_code,
  publication_required = EXCLUDED.publication_required,
  plazo_inscripcion_dias = EXCLUDED.plazo_inscripcion_dias,
  referencia_legal = EXCLUDED.referencia_legal;

DO $assert$
DECLARE
  v_total integer;
  v_especial integer;
  v_socios_estatutaria integer;
  v_estructural integer;
  v_ordinaria integer;
  v_retribucion_no_inscribible integer;
BEGIN
  SELECT count(*) INTO v_total
    FROM public.materia_catalog
   WHERE materia IN (
     'ADMISION_SOCIO_CUOTA',
     'EXCLUSION_SOCIO_ESTATUTARIA',
     'CONTINUIDAD_SOCIO_POST_60',
     'RETRIBUCION_PRESTACIONES_ACCESORIAS',
     'INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA',
     'NOMBRAMIENTO_ADMINISTRADOR_UNICO'
   );

  IF v_total <> 6 THEN
    RAISE EXCEPTION 'g3 slp materias: se esperaban 6 filas en materia_catalog, encontradas=%', v_total;
  END IF;

  SELECT count(*) INTO v_especial
    FROM public.materia_catalog
   WHERE materia IN (
     'ADMISION_SOCIO_CUOTA',
     'EXCLUSION_SOCIO_ESTATUTARIA',
     'CONTINUIDAD_SOCIO_POST_60',
     'RETRIBUCION_PRESTACIONES_ACCESORIAS',
     'INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA',
     'NOMBRAMIENTO_ADMINISTRADOR_UNICO'
   )
     AND matter_class = 'ESPECIAL';

  IF v_especial <> 0 THEN
    RAISE EXCEPTION 'g3 slp materias: criterio vinculante violado — % fila(s) con matter_class=ESPECIAL (ninguna de estas 6 materias puede serlo; excluiría el gate del informe preceptivo del selector genérico)', v_especial;
  END IF;

  SELECT count(*) INTO v_socios_estatutaria
    FROM public.materia_catalog
   WHERE materia IN (
     'ADMISION_SOCIO_CUOTA',
     'EXCLUSION_SOCIO_ESTATUTARIA',
     'CONTINUIDAD_SOCIO_POST_60',
     'RETRIBUCION_PRESTACIONES_ACCESORIAS'
   )
     AND matter_class = 'ESTATUTARIA';

  IF v_socios_estatutaria <> 4 THEN
    RAISE EXCEPTION 'g3 slp materias: las 4 materias de socio deben ser ESTATUTARIA; encontradas=%', v_socios_estatutaria;
  END IF;

  SELECT count(*) INTO v_estructural
    FROM public.materia_catalog
   WHERE materia = 'INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA'
     AND matter_class = 'ESTRUCTURAL';

  IF v_estructural <> 1 THEN
    RAISE EXCEPTION 'g3 slp materias: INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA debe ser ESTRUCTURAL';
  END IF;

  SELECT count(*) INTO v_ordinaria
    FROM public.materia_catalog
   WHERE materia = 'NOMBRAMIENTO_ADMINISTRADOR_UNICO'
     AND matter_class = 'ORDINARIA'
     AND inscribable = true;

  IF v_ordinaria <> 1 THEN
    RAISE EXCEPTION 'g3 slp materias: NOMBRAMIENTO_ADMINISTRADOR_UNICO debe ser ORDINARIA e inscribable';
  END IF;

  -- Fix round 1, contraorden sobre I-2: art. 12.6 Estatutos reales — acuerdo
  -- ANUAL de la Junta, no modificación estatutaria. NO inscribible.
  SELECT count(*) INTO v_retribucion_no_inscribible
    FROM public.materia_catalog
   WHERE materia = 'RETRIBUCION_PRESTACIONES_ACCESORIAS'
     AND inscribable = false
     AND requires_notary = false
     AND requires_registry = false;

  IF v_retribucion_no_inscribible <> 1 THEN
    RAISE EXCEPTION 'g3 slp materias: RETRIBUCION_PRESTACIONES_ACCESORIAS NO debe ser inscribable (art. 12.6 Estatutos: acuerdo anual de la Junta, no modificación estatutaria)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.rule_packs
     WHERE materia IN (
       'ADMISION_SOCIO_CUOTA',
       'EXCLUSION_SOCIO_ESTATUTARIA',
       'CONTINUIDAD_SOCIO_POST_60',
       'RETRIBUCION_PRESTACIONES_ACCESORIAS',
       'INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA',
       'NOMBRAMIENTO_ADMINISTRADOR_UNICO'
     )
       AND tenant_id <> '00000000-0000-0000-0000-000000000002'::uuid
  ) THEN
    RAISE EXCEPTION 'g3 slp materias: ninguna de estas materias debe tener rule pack fuera del tenant Garrigues (cero cambio ARGA)';
  END IF;
END;
$assert$;

COMMIT;
