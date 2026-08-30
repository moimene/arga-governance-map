-- C1 Task 6 — 3 rule packs POR MATERIA del tenant Garrigues para las materias
-- de la Junta de Socios de 06/05/2026 que hasta hoy **solo existían en ARGA**:
-- APROBACION_CUENTAS, NOMBRAMIENTO_AUDITOR y DELEGACION_FACULTADES.
--
-- ## Por qué hacen falta
--
-- El plan las llamaba «genéricas». Medido contra Cloud, es falso: `rule_packs`
-- está aislada por RLS (`rule_packs_tenant_isolation`, tenant_id =
-- fn_current_tenant_id()) y las tres filas homónimas pertenecen al tenant ARGA
-- (00000000-…-0001). Un login de Garrigues no las ve, así que
-- `useRulePackForMateria` —que filtra por `rule_packs.tenant_id` y
-- `rule_packs.materia`— devolvía null y esas tres materias del orden del día se
-- quedaban sin regla. Y menos mal que no las veía: la mayoría de los packs de
-- ARGA es la supletoria de la LSC (art. 198/201.1), que **no es** la regla de
-- esta sociedad.
--
-- ## Por qué el id lleva prefijo GARR_ y la materia no
--
-- `rule_packs.id` es PK **global**, no por tenant: 'APROBACION_CUENTAS' ya está
-- ocupado por ARGA. Los 6 packs SLP de G3 (20260805120000) pudieron usar la
-- materia como id porque esas materias no existían en ARGA; estas tres no.
-- La resolución NO depende del id: `useRulePackForMateria` casa por
-- `rule_packs.materia` + `rule_packs.tenant_id`, y `rule-resolution.ts` casa por
-- `version.materia` (que sale del payload). Por eso `materia` y
-- `payload.materia` llevan la materia real y solo el id lleva el prefijo.
--
-- ## La mayoría: art. 30.1 de los Estatutos, cero supletoria LSC
--
-- Literal del art. 30.1 aportado por el usuario:
--
--   «Para que los acuerdos sean aprobados por la Junta de Socios será necesario,
--    sin perjuicio de las mayorías que la Ley de Sociedades Profesionales o la
--    Ley de Sociedades de Capital establecen como inmodificables y las mayorías
--    que se establecen en los apartados siguientes, el voto favorable de la
--    mayoría de los votos correspondientes en cada caso a las participaciones
--    sociales en las que se divide el capital social.»
--
-- Ninguna de las tres materias figura entre las de mayoría reforzada de 2/3 del
-- art. 30.2 ni entre las del 80 % del art. 30.3, así que les aplica la cláusula
-- general. **Ojo a la base de cómputo:** son los votos de las participaciones en
-- que se divide el capital social, NO los votos emitidos ni el capital presente.
-- Citar el art. 198 o el 201.1 LSC sería atribuir a la ley lo que dicen los
-- Estatutos, y además con otra base. Por eso `fuente = 'ESTATUTOS'` y el bloque
-- DO de abajo falla si aparece «LSC» en la referencia de la mayoría.
--
-- Las ramas SA y CONSEJO existen para satisfacer el Record cerrado del contrato
-- (`isRulePackPayload`, ConvocatoriasStepper.tsx:305) y dicen la verdad: el
-- tenant es una S.L.P. y `effective-rule.ts:89` resuelve SLP → rama SL, así que
-- no se evalúan.
--
-- ## Lo que este pack NO afirma
--
-- El **plazo de inscripción** de las dos materias inscribibles queda sin fijar:
-- `materia_catalog` dice 10 días sin cita y los packs SLP hermanos de este mismo
-- tenant dicen 30 (art. 83 RRM). Es una discrepancia de contenido legal, del
-- Comité Legal y no de ingeniería; hasta que se resuelva el pack lo dice en
-- `reglaEspecifica.plazoInscripcion` en vez de elegir un número.
--
-- Los bloques `acta`, `constitucion` y `convocatoria.antelacionDias/canales` se
-- heredan **verbatim** de los 6 packs SLP de G3 (que a su vez clonan
-- GARR_JUNTA_SOCIOS v1.1.0): son quórum, canal y plazo de convocatoria, no
-- mayoría, y ya estaban cotejados en G3. La rama SL del quórum conserva su cita
-- del art. 198 LSC heredada de G3: el literal estatutario de este encargo cubre
-- la MAYORÍA, no el quórum de constitución, y cambiarlo aquí sería inventar.
--
-- `documentacion.obligatoria` se reduce a la propuesta: los packs SLP incluyen
-- el derecho de información del art. 287 LSC (modificación de estatutos) y un
-- informe del administrador único «SIEMPRE», y ninguna de las dos cosas está
-- acreditada para estas tres materias.
--
-- Forward-only, idempotente (WHERE NOT EXISTS, mismo patrón que 20260805120000).
-- ARGA no se toca: ni un UPDATE sobre sus filas.

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_APROBACION_CUENTAS', '00000000-0000-0000-0000-000000000002'::uuid, 'APROBACION_CUENTAS', 'JUNTA_GENERAL', 'Garrigues C1 — Aprobación de cuentas anuales (materia, mayoría del art. 30.1 Estatutos)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_APROBACION_CUENTAS');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_APROBACION_CUENTAS', '1.0.0', '{"id":"GARR_APROBACION_CUENTAS","materia":"APROBACION_CUENTAS","clase":"ORDINARIA","organoTipo":"JUNTA_GENERAL","modosAdopcionPermitidos":["MEETING","UNIVERSAL"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_JUNTA","UNIVERSAL":"ACTA_JUNTA"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos — el tenant es una S.L.P.: esta rama no se evalúa"},"SL":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos: voto favorable de la mayoría de los votos correspondientes a las participaciones sociales en las que se divide el capital social","baseComputo":"VOTOS_DE_LAS_PARTICIPACIONES_EN_QUE_SE_DIVIDE_EL_CAPITAL","nota":"Cláusula general del art. 30.1. La materia no figura entre las de mayoría reforzada del art. 30.2 (2/3) ni entre las del art. 30.3 (80%). La base NO son los votos emitidos ni el capital presente."},"CONSEJO":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos — acuerdo de la Junta de Socios: esta rama no se evalúa"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SLP":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"},"SLP":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día","Texto íntegro de la propuesta cuando proceda"],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto íntegro de la propuesta","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta íntegra"}],"ventanaDisponibilidad":{"dias":15,"fuente":"ESTATUTOS","referencia":"arts. 27.3 y 27.4 Estatutos (antelación de la convocatoria)"}},"postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false,"deposito_cuentas":{"obligatorio":true,"instrumento":"CERTIFICACION","plazoDias":30,"referencia":"art. 279 LSC (depósito dentro del mes siguiente a la aprobación)"}},"plazosMateriales":{"inscripcion":null,"publicacion":[]},"reglaEspecifica":{"canalAcuseLey2007":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 27.3 Estatutos (comunicación individualizada y por escrito que asegure la recepción; también entrega en mano contra recibí); LSC supletoria","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_APROBACION_CUENTAS' AND is_active = true);

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_NOMBRAMIENTO_AUDITOR', '00000000-0000-0000-0000-000000000002'::uuid, 'NOMBRAMIENTO_AUDITOR', 'JUNTA_GENERAL', 'Garrigues C1 — Nombramiento/reelección de auditor (materia, mayoría del art. 30.1 Estatutos)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_NOMBRAMIENTO_AUDITOR');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_NOMBRAMIENTO_AUDITOR', '1.0.0', '{"id":"GARR_NOMBRAMIENTO_AUDITOR","materia":"NOMBRAMIENTO_AUDITOR","clase":"ORDINARIA","organoTipo":"JUNTA_GENERAL","modosAdopcionPermitidos":["MEETING","UNIVERSAL"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_JUNTA","UNIVERSAL":"ACTA_JUNTA"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos — el tenant es una S.L.P.: esta rama no se evalúa"},"SL":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos: voto favorable de la mayoría de los votos correspondientes a las participaciones sociales en las que se divide el capital social","baseComputo":"VOTOS_DE_LAS_PARTICIPACIONES_EN_QUE_SE_DIVIDE_EL_CAPITAL","nota":"Cláusula general del art. 30.1. La materia no figura entre las de mayoría reforzada del art. 30.2 (2/3) ni entre las del art. 30.3 (80%). La base NO son los votos emitidos ni el capital presente."},"CONSEJO":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos — acuerdo de la Junta de Socios: esta rama no se evalúa"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SLP":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"},"SLP":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día","Texto íntegro de la propuesta cuando proceda"],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto íntegro de la propuesta","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta íntegra"}],"ventanaDisponibilidad":{"dias":15,"fuente":"ESTATUTOS","referencia":"arts. 27.3 y 27.4 Estatutos (antelación de la convocatoria)"}},"postAcuerdo":{"inscribible":true,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false},"plazosMateriales":{"publicacion":[]},"reglaEspecifica":{"canalAcuseLey2007":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 27.3 Estatutos (comunicación individualizada y por escrito que asegure la recepción; también entrega en mano contra recibí); LSC supletoria","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."},"plazoInscripcion":{"estado":"NO_COTEJADO","nota":"Este pack no afirma plazo de inscripción: materia_catalog dice 10 días sin cita y los packs SLP hermanos del tenant dicen 30 (art. 83 RRM). Discrepancia de contenido legal pendiente del Comité Legal."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_NOMBRAMIENTO_AUDITOR' AND is_active = true);

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_DELEGACION_FACULTADES', '00000000-0000-0000-0000-000000000002'::uuid, 'DELEGACION_FACULTADES', 'JUNTA_GENERAL', 'Garrigues C1 — Delegación de facultades para elevar a público (materia, mayoría del art. 30.1 Estatutos)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_DELEGACION_FACULTADES');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_DELEGACION_FACULTADES', '1.0.0', '{"id":"GARR_DELEGACION_FACULTADES","materia":"DELEGACION_FACULTADES","clase":"ORDINARIA","organoTipo":"JUNTA_GENERAL","modosAdopcionPermitidos":["MEETING","UNIVERSAL"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_JUNTA","UNIVERSAL":"ACTA_JUNTA"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos — el tenant es una S.L.P.: esta rama no se evalúa"},"SL":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos: voto favorable de la mayoría de los votos correspondientes a las participaciones sociales en las que se divide el capital social","baseComputo":"VOTOS_DE_LAS_PARTICIPACIONES_EN_QUE_SE_DIVIDE_EL_CAPITAL","nota":"Cláusula general del art. 30.1. La materia no figura entre las de mayoría reforzada del art. 30.2 (2/3) ni entre las del art. 30.3 (80%). La base NO son los votos emitidos ni el capital presente."},"CONSEJO":{"fuente":"ESTATUTOS","formula":"favor > 1/2_votos_capital","referencia":"art. 30.1 Estatutos — acuerdo de la Junta de Socios: esta rama no se evalúa"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SLP":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"},"SLP":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día","Texto íntegro de la propuesta cuando proceda"],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto íntegro de la propuesta","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta íntegra"}],"ventanaDisponibilidad":{"dias":15,"fuente":"ESTATUTOS","referencia":"arts. 27.3 y 27.4 Estatutos (antelación de la convocatoria)"}},"postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":false},"plazosMateriales":{"publicacion":[]},"reglaEspecifica":{"canalAcuseLey2007":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 27.3 Estatutos (comunicación individualizada y por escrito que asegure la recepción; también entrega en mano contra recibí); LSC supletoria","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."},"plazoInscripcion":{"estado":"NO_COTEJADO","nota":"Este pack no afirma plazo de inscripción: materia_catalog dice 10 días sin cita y los packs SLP hermanos del tenant dicen 30 (art. 83 RRM). Discrepancia de contenido legal pendiente del Comité Legal."},"elevacionInstrumentoPublico":{"referencia":"art. 31.3 Estatutos","redaccion":"La elevación a instrumento público corresponde a las personas que tienen facultad para certificar los acuerdos y también podrá realizarse por cualquiera de los administradores sin necesidad de delegación expresa.","nota":"Con Administrador Único que además certifica, la delegación no es necesaria: el acuerdo es de cobertura."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_DELEGACION_FACULTADES' AND is_active = true);

DO $assert$
DECLARE
  v_garr uuid := '00000000-0000-0000-0000-000000000002'::uuid;
  v_arga uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_n integer;
  v_ref text;
  v_materia text;
BEGIN
  -- 1. Los 3 packs existen bajo el tenant Garrigues, en la Junta, con una sola
  --    version activa y con la materia REAL (no el id con prefijo).
  FOR v_materia IN SELECT unnest(ARRAY['APROBACION_CUENTAS','NOMBRAMIENTO_AUDITOR','DELEGACION_FACULTADES'])
  LOOP
    SELECT count(*) INTO v_n
      FROM public.rule_packs rp
      JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
     WHERE rp.tenant_id = v_garr
       AND rp.materia = v_materia
       AND rp.organo_tipo = 'JUNTA_GENERAL'
       AND v.payload->>'materia' = v_materia;
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'c1 packs junta: la materia % tiene % packs activos del tenant Garrigues, esperado 1', v_materia, v_n;
    END IF;

    -- 2. La mayoria es la del art. 30.1 de los Estatutos. CERO supletoria LSC:
    --    citar el art. 198/201.1 seria atribuir a la ley lo que dicen los
    --    Estatutos, y ademas con otra base de computo.
    SELECT v.payload #>> '{votacion,mayoria,SL,referencia}' INTO v_ref
      FROM public.rule_packs rp
      JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
     WHERE rp.tenant_id = v_garr AND rp.materia = v_materia;
    IF v_ref IS NULL OR position('30.1' in v_ref) = 0 OR v_ref ILIKE '%LSC%' THEN
      RAISE EXCEPTION 'c1 packs junta: la mayoria de % debe citar el art. 30.1 de los Estatutos y ninguna LSC; referencia=%', v_materia, v_ref;
    END IF;

    SELECT count(*) INTO v_n
      FROM public.rule_packs rp
      JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
     WHERE rp.tenant_id = v_garr AND rp.materia = v_materia
       AND v.payload #>> '{votacion,mayoria,SL,fuente}' = 'ESTATUTOS';
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'c1 packs junta: la fuente de la mayoria de % debe ser ESTATUTOS', v_materia;
    END IF;
  END LOOP;

  -- 3. Control discriminante: los 3 packs homonimos de ARGA siguen siendo de
  --    ARGA y no se han tocado. Si esta migracion los hubiera movido de tenant,
  --    la asercion 1 pasaria igual y el aislamiento estaria roto.
  SELECT count(*) INTO v_n
    FROM public.rule_packs
   WHERE id IN ('APROBACION_CUENTAS','NOMBRAMIENTO_AUDITOR','DELEGACION_FACULTADES')
     AND tenant_id = v_arga;
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'c1 packs junta: los 3 packs homonimos de ARGA deben seguir bajo el tenant ARGA, encontrados %', v_n;
  END IF;

  -- 4. Las 6 materias SLP de G3 siguen resolviendo a su propio pack: esta
  --    migracion no puede haberles cambiado el numero ni el tenant.
  SELECT count(*) INTO v_n
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.tenant_id = v_garr
     AND rp.id IN ('ADMISION_SOCIO_CUOTA','EXCLUSION_SOCIO_ESTATUTARIA','CONTINUIDAD_SOCIO_POST_60','NOMBRAMIENTO_ADMINISTRADOR_UNICO','RETRIBUCION_PRESTACIONES_ACCESORIAS','INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA');
  IF v_n <> 6 THEN
    RAISE EXCEPTION 'c1 packs junta: los 6 packs por materia SLP de G3 deben seguir activos, encontrados %', v_n;
  END IF;

  -- 5. MODIFICACION_ESTATUTOS NO se siembra para Garrigues: el acuerdo modifica
  --    el art. 36, que no consta en el texto entregado de los Estatutos, y la
  --    mayoria de 2/3 del art. 30.2.f) esta tasada para quince articulos
  --    enumerados entre los que no figura. Sin articulo no hay mayoria que citar.
  SELECT count(*) INTO v_n
    FROM public.rule_packs
   WHERE tenant_id = v_garr AND materia IN ('MODIFICACION_ESTATUTOS','MOD_ESTATUTOS');
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'c1 packs junta: MODIFICACION_ESTATUTOS no debe tener pack en Garrigues (bloqueada), encontrados %', v_n;
  END IF;
END;
$assert$;
