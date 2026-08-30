-- C1 Task 6-bis — el décimo acuerdo: rule pack del tenant Garrigues para
-- MODIFICACION_ESTATUTOS (punto 1.1 de la Junta de Socios de 06/05/2026).
--
-- ## Qué desbloquea, y qué NO afirma
--
-- Task 6 dejó el punto 1.1 sin acuerdo porque no había mayoría que citar. Hoy la
-- hay, POR DECISIÓN DEL USUARIO (2026-08-30) y **etiquetada como subsunción**, no
-- como cita directa. El registro canónico del razonamiento completo es
-- `docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md`.
--
-- Qué regula el art. 36, con dos fuentes independientes:
--
--   1. **BORME**, anuncio 338618/2026, `S 8, H M-190538, I/A 960` (13/07/2026):
--      «Se modifica el artículo 36 de los estatutos sociales, por el cambio del
--      plazo de duración de los administradores». En el repo:
--      `scripts/garrigues/borme/jya-garrigues-slp.json`, `provenance BORME_CITADO`.
--   2. **Cotejo del Comité Legal de 2026-08-05** sobre el texto vigente de los
--      Estatutos (`docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`):
--      «Mandato administradores (art. 36, Insc. 960ª): 6 años reelegibles», que
--      cuadra con el mandato de Vives 30/06/2026 → 30/06/2032.
--
--      Ojo: ese cotejo **desmiente el motivo con el que Task 6 bloqueó el punto**
--      («el art. 36 no consta en el texto entregado»). El artículo consta y su
--      objeto está documentado; lo que no constaba era la mayoría.
--
-- ## La mayoría aplicada: 2/3 del art. 30.2.a) — y por qué va INFERIDA
--
-- Decisión del usuario: el art. 30.2.a) —«el nombramiento, reelección y
-- separación de los administradores»— **alcanza** a modificar el artículo que
-- regula su plazo, de modo que la modificación del art. 36 se adopta por la
-- mayoría reforzada de 2/3.
--
-- Es una **subsunción**, no una cita: el 30.2.a) habla de nombrar administradores,
-- no de modificar el artículo de su plazo. Y hay lectura alternativa defendible:
-- el art. 30.2.f) **tasa quince artículos** (1, 2, 9, 10, 11, 12, 13, 17, 18, 19,
-- 20, 21, 26, 42 y 47) y el 36 **no figura** entre ellos, así que por esa vía la
-- modificación iría por la mayoría general del art. 30.1.
--
-- Por eso:
--   - `votacion.mayoria.SL.fuente = 'ESTATUTOS'` — la mayoría SALE de los
--     Estatutos, y `Fuente` es un tipo cerrado que no tiene 'INFERIDO'. Forzarlo
--     ahí rompería el contrato y además mentiría sobre la fuente.
--   - **lo INFERIDO es la SUBSUNCIÓN**, y vive en clave propia:
--     `reglaEspecifica.subsuncionArt36`, con la lectura aplicada Y la alternativa
--     escritas dentro. `reglaEspecifica` es Record<string, unknown> y ningún
--     engine lo lee: es registro, no comportamiento.
--
-- Si el Comité Legal discrepa mañana, la etiqueta ya lo dice y no hay captura que
-- rectificar: la ficha del acuerdo enseña las dos lecturas desde el primer día.
--
-- ## Consecuencia declarada sobre el gate del informe preceptivo
--
-- El art. 39.5.b.i hace que el Consejo de Socios informe preceptivamente sobre
-- «los acuerdos previstos en los apartados 2 y 3 del artículo 30». Si la
-- subsunción en el 30.2.a) fuera FIRME, este acuerdo entraría en ese perímetro.
-- **El gate demo NO se amplía aquí**: su config son 4 materias FIRMES
-- (`governing_bodies.config.informe_preceptivo_de`) y el propio dictamen de
-- 2026-08-04 dice que ese gate es «un subconjunto correcto del perímetro real».
-- Ampliarlo sobre una subsunción etiquetada INFERIDO convertiría lo inferido en
-- un bloqueo operativo. Queda escrito y es decisión del Comité Legal, no de esta
-- migración. La aserción 5 de abajo lo vigila: el gate sigue disparando en 4.
--
-- ## El id lleva prefijo GARR_ y la materia no
--
-- Igual que en `20260829170000`: `rule_packs.id` es PK **global** y
-- 'MODIFICACION_ESTATUTOS' ya lo ocupa ARGA (verificado en Cloud antes de
-- escribir). La resolución no depende del id — `useRulePackForMateria` casa por
-- `materia` + `tenant_id` —, así que `materia` y `payload.materia` llevan la
-- materia real y solo el id lleva el prefijo.
--
-- **Discriminante que importa:** el pack homónimo de ARGA dice para SL
-- `favor > 1/2_capital_total_con_voto`, `art. 199.a LSC`. Si el acuerdo de
-- Garrigues resolviera allí, enseñaría mayoría simple del capital en vez de los
-- 2/3 estatutarios. La aserción 4 comprueba que ese pack sigue siendo de ARGA y
-- sigue diciendo lo que decía.
--
-- ## Lo que este pack hereda y lo que no
--
-- - `constitucion`, `convocatoria` y la semántica del canal se heredan **verbatim**
--   de los packs SLP de G3 y de la migración 20260829170000: son quórum, canal y
--   plazo de convocatoria, no mayoría, y ya estaban cotejados en G3.
-- - `documentacion` SÍ suma el **derecho de información del art. 287 LSC**, que no
--   se puso en los 3 packs de Task 6 porque aquellas materias no eran modificación
--   de estatutos. Ésta lo es, y el 287 es **cita directa de ley**, no subsunción.
-- - `plazoInscripcion` se declara **30 días (art. 83 RRM)**: aquí no hay la
--   discrepancia que obligó a dejarlo NO_COTEJADO en Task 6 — `materia_catalog`
--   dice 30 y los packs SLP hermanos dicen 30. El homónimo de ARGA dice 60
--   (art. 19 RRM) y **no es fuente de este tenant**; queda anotado, no aplicado.
-- - `publicacionRequerida: false`, siguiendo a `materia_catalog`
--   (`publication_required = false` para esta materia). El pack hermano
--   NOMBRAMIENTO_ADMINISTRADOR_UNICO dice `true`: divergencia anotada dentro del
--   propio pack, no dirimida por ingeniería. El anuncio del BORME 338618/2026 es
--   publicidad registral de la inscripción, no prueba de una publicación exigida
--   como requisito del acuerdo.
--
-- Forward-only, idempotente (WHERE NOT EXISTS, mismo patrón que 20260829170000).
-- ARGA no se toca: ni un UPDATE sobre sus filas.
--
-- NOTA DE ORDEN: la aserción 5 de `20260829170000` exige CERO packs de
-- MODIFICACION_ESTATUTOS en Garrigues. Sigue siendo cierta cuando esa migración
-- corre, porque corre ANTES que ésta. No se edita una migración ya aplicada.

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_MODIFICACION_ESTATUTOS', '00000000-0000-0000-0000-000000000002'::uuid, 'MODIFICACION_ESTATUTOS', 'JUNTA_GENERAL', 'Garrigues C1 — Modificación de estatutos (materia, 2/3 del art. 30.2.a) Estatutos por subsuncion etiquetada INFERIDO)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_MODIFICACION_ESTATUTOS');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_MODIFICACION_ESTATUTOS', '1.0.0', '{"id":"GARR_MODIFICACION_ESTATUTOS","materia":"MODIFICACION_ESTATUTOS","clase":"ESTATUTARIA","organoTipo":"JUNTA_GENERAL","modosAdopcionPermitidos":["MEETING","UNIVERSAL"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_JUNTA","UNIVERSAL":"ACTA_JUNTA"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"ESTATUTOS","formula":"favor >= 2/3_votos_totales","referencia":"art. 30.2.a) Estatutos — el tenant es una S.L.P.: esta rama no se evalúa"},"SL":{"fuente":"ESTATUTOS","formula":"favor >= 2/3_votos_totales","referencia":"art. 30.2.a) Estatutos","baseComputo":"VOTOS_DE_LAS_PARTICIPACIONES_EN_QUE_SE_DIVIDE_EL_CAPITAL","procedenciaDeLaRegla":"INFERIDO","nota":"La mayoría de 2/3 se aplica por SUBSUNCIÓN del acuerdo en el art. 30.2.a) (nombramiento, reelección y separación de administradores), decidida por el usuario el 2026-08-30. NO es una cita directa: ver reglaEspecifica.subsuncionArt36, que deja escrita también la lectura alternativa. La base NO son los votos emitidos ni el capital presente."},"CONSEJO":{"fuente":"ESTATUTOS","formula":"favor >= 2/3_votos_totales","referencia":"art. 30.2.a) Estatutos — acuerdo de la Junta de Socios: esta rama no se evalúa"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SLP":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"},"SLP":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día","Extremos que han de modificarse, con la debida claridad","Derecho de examen del texto íntegro de la modificación propuesta"],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto íntegro de la propuesta","condicion":"SIEMPRE"},{"id":"texto_integro_modificacion","nombre":"Texto íntegro de la modificación propuesta (art. 287 LSC)","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta íntegra"},{"id":"derecho_informacion_287","nombre":"Derecho de información del art. 287 LSC (examen en el domicilio social del texto íntegro de la modificación)","fuente":"LEY","referencia":"art. 287 LSC","nota":"Cita directa de ley, no subsunción: esta materia SÍ es modificación de estatutos, a diferencia de las 3 materias de la migración 20260829170000."}],"ventanaDisponibilidad":{"dias":15,"fuente":"ESTATUTOS","referencia":"arts. 27.3 y 27.4 Estatutos (antelación de la convocatoria)"}},"postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":false,"plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 83 RRM","nota":"materia_catalog dice 30 y los packs SLP hermanos del tenant dicen 30 (art. 83 RRM): aquí las dos fuentes del tenant concuerdan, a diferencia de las 3 materias de 20260829170000. El pack homónimo de ARGA dice 60 (art. 19 RRM) y no es fuente de este tenant."}},"plazosMateriales":{"inscripcion":{"plazo_dias":30,"fuente":"LEY","referencia":"art. 83 RRM"},"publicacion":[]},"reglaEspecifica":{"canalAcuseLey2007":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 27.3 Estatutos (comunicación individualizada y por escrito que asegure la recepción; también entrega en mano contra recibí); LSC supletoria","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."},"subsuncionArt36":{"procedencia":"INFERIDO","decididoPor":"el usuario, 2026-08-30","objeto":"el art. 36 regula el plazo de duración de los administradores (BORME 338618/2026, I/A 960; y cotejo del Comité Legal de 2026-08-05: mandato de 6 años reelegibles)","lecturaAplicada":"El art. 30.2.a) —nombramiento, reelección y separación de los administradores— alcanza a modificar el artículo que regula su plazo, de modo que la modificación del art. 36 se adopta por la mayoría reforzada de 2/3.","lecturaAlternativa":"el art. 30.2.f) tasa quince artículos (1, 2, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 26, 42 y 47) y el 36 no figura; por esa vía la modificación iría por la mayoría general del art. 30.1","efectoSiSeRevisa":"Si el Comité Legal acoge la lectura alternativa, cambia la mayoría de este pack (2/3 → art. 30.1) y decae el perímetro del art. 39.5.b.i para este acuerdo. No hay captura emitida que rectificar: la ficha enseña las dos lecturas.","consecuenciaNoAplicada":"Bajo la lectura aplicada, el art. 39.5.b.i llevaría este acuerdo al informe preceptivo del Consejo de Socios. El gate demo NO se amplía sobre una subsunción INFERIDA: su config son 4 materias FIRMES y sigue disparando en 4.","registroCanonico":"docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md"},"publicacionRequeridaDivergencia":{"valorAplicado":false,"fuenteAplicada":"materia_catalog.publication_required = false para MODIFICACION_ESTATUTOS","divergencia":"El pack hermano NOMBRAMIENTO_ADMINISTRADOR_UNICO (G3) declara publicacionRequerida = true. Divergencia anotada, no dirimida: el anuncio BORME 338618/2026 es publicidad registral de la inscripción, no prueba de una publicación exigida como requisito del acuerdo."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_MODIFICACION_ESTATUTOS' AND is_active = true);

DO $assert$
DECLARE
  v_garr uuid := '00000000-0000-0000-0000-000000000002'::uuid;
  v_arga uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_n integer;
  v_txt text;
BEGIN
  -- 1. Un solo pack activo de la materia REAL bajo el tenant Garrigues, en la
  --    Junta. El id lleva prefijo; la materia no.
  SELECT count(*) INTO v_n
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.tenant_id = v_garr
     AND rp.materia = 'MODIFICACION_ESTATUTOS'
     AND rp.organo_tipo = 'JUNTA_GENERAL'
     AND v.payload->>'materia' = 'MODIFICACION_ESTATUTOS';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: % packs activos del tenant Garrigues para la materia, esperado 1', v_n;
  END IF;

  -- 2. La mayoria es la de 2/3 del art. 30.2.a) de los Estatutos. CERO LSC en la
  --    referencia: citar el 199.a seria servir la regla del OTRO tenant.
  SELECT v.payload #>> '{votacion,mayoria,SL,referencia}' INTO v_txt
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.tenant_id = v_garr AND rp.materia = 'MODIFICACION_ESTATUTOS';
  IF v_txt IS NULL OR position('30.2.a' in v_txt) = 0 OR v_txt ILIKE '%LSC%' THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: la mayoria debe citar el art. 30.2.a) de los Estatutos y ninguna LSC; referencia=%', v_txt;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.tenant_id = v_garr AND rp.materia = 'MODIFICACION_ESTATUTOS'
     AND v.payload #>> '{votacion,mayoria,SL,fuente}' = 'ESTATUTOS'
     AND v.payload #>> '{votacion,mayoria,SL,formula}' LIKE '%2/3%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: la fuente de la mayoria debe ser ESTATUTOS y la formula 2/3';
  END IF;

  -- 3. LA ASERCION QUE IMPORTA. La etiqueta INFERIDO y la LECTURA ALTERNATIVA
  --    viajan dentro del pack. Sin esto, la subsuncion se presentaria manana
  --    como si fuera cita directa y nadie sabria que hubo una decision.
  SELECT count(*) INTO v_n
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.tenant_id = v_garr AND rp.materia = 'MODIFICACION_ESTATUTOS'
     AND v.payload #>> '{reglaEspecifica,subsuncionArt36,procedencia}' = 'INFERIDO'
     AND v.payload #>> '{reglaEspecifica,subsuncionArt36,decididoPor}' LIKE '%2026-08-30%'
     AND v.payload #>> '{reglaEspecifica,subsuncionArt36,objeto}' LIKE '%338618%'
     AND v.payload #>> '{reglaEspecifica,subsuncionArt36,lecturaAplicada}' LIKE '%30.2.a%'
     AND v.payload #>> '{reglaEspecifica,subsuncionArt36,lecturaAlternativa}' LIKE '%30.2.f%'
     AND v.payload #>> '{reglaEspecifica,subsuncionArt36,lecturaAlternativa}' LIKE '%30.1%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: falta la subsuncion etiquetada INFERIDO con su objeto (BORME 338618), la lectura aplicada (30.2.a) y la ALTERNATIVA (30.2.f -> 30.1)';
  END IF;

  -- 4. Control discriminante A: el pack homonimo de ARGA sigue siendo de ARGA y
  --    sigue diciendo OTRA COSA (art. 199.a LSC, mayoria simple del capital).
  --    Sin esto, «el acuerdo resuelve al pack correcto» no distinguiria entre
  --    resolver al de Garrigues y resolver al de ARGA.
  SELECT count(*) INTO v_n
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.id = 'MODIFICACION_ESTATUTOS'
     AND rp.tenant_id = v_arga
     AND v.payload #>> '{votacion,mayoria,SL,referencia}' ILIKE '%199%';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: el pack homonimo de ARGA debe seguir bajo ARGA citando el art. 199.a LSC (encontrados %)', v_n;
  END IF;

  -- 5. Control discriminante B: el gate del informe preceptivo NO se amplia. Su
  --    config sigue con las 4 materias FIRMES y MODIFICACION_ESTATUTOS no esta
  --    entre ellas, asi que seguira disparando en 4 acuerdos y no en 5.
  SELECT count(*) INTO v_n
    FROM public.governing_bodies gb,
         jsonb_array_elements(COALESCE(gb.config->'informe_preceptivo_de', '[]'::jsonb)) e
   WHERE gb.slug = 'garrigues-junta-socios' AND gb.tenant_id = v_garr;
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: el gate del informe preceptivo debe seguir con 4 materias, encontradas %', v_n;
  END IF;

  SELECT count(*) INTO v_n
    FROM public.governing_bodies gb,
         jsonb_array_elements(COALESCE(gb.config->'informe_preceptivo_de', '[]'::jsonb)) e
   WHERE gb.slug = 'garrigues-junta-socios' AND gb.tenant_id = v_garr
     AND e->>'materia' = 'MODIFICACION_ESTATUTOS';
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: MODIFICACION_ESTATUTOS no debe entrar en el gate demo sobre una subsuncion INFERIDA (encontradas %)', v_n;
  END IF;

  -- 6. Los 9 packs por materia que ya servian a la Junta siguen activos: esta
  --    migracion no puede haberles cambiado el numero ni el tenant.
  SELECT count(*) INTO v_n
    FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
   WHERE rp.tenant_id = v_garr
     AND rp.id IN ('ADMISION_SOCIO_CUOTA','EXCLUSION_SOCIO_ESTATUTARIA','CONTINUIDAD_SOCIO_POST_60','NOMBRAMIENTO_ADMINISTRADOR_UNICO','RETRIBUCION_PRESTACIONES_ACCESORIAS','INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA','GARR_APROBACION_CUENTAS','GARR_NOMBRAMIENTO_AUDITOR','GARR_DELEGACION_FACULTADES');
  IF v_n <> 9 THEN
    RAISE EXCEPTION 'c1 pack mod. estatutos: los 9 packs por materia de la Junta deben seguir activos, encontrados %', v_n;
  END IF;
END;
$assert$;
