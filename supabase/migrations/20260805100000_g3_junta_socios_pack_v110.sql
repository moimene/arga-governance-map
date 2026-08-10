-- G3 Task 5 — GARR_JUNTA_SOCIOS sube a v1.1.0: referencias estatutarias
-- FIRMES de convocatoria (Comité Legal 2026-08-04 + cotejo con los Estatutos
-- vigentes de J&A Garrigues, S.L.P. 2026-08-05,
-- docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md, sección
-- "COTEJO CON EL TEXTO VIGENTE DE LOS ESTATUTOS").
--
-- v1.0.0 (migración 20260804070000_g3_garrigues_rule_packs.sql, YA APLICADA
-- en Cloud) citaba la antelación de 15 días de SL/SLP únicamente a
-- "art. 176 LSC (supletoria)" — correcto pero incompleto: el cotejo confirma
-- que el plazo es TAMBIÉN estatutario firme (art. 27.4 Estatutos) y que el
-- canal individual con acuse es FIRME (art. 27.3 Estatutos), no solo LSC
-- supletoria. NUNCA se muta el payload de v1.0.0 ya aplicada: esta migración
-- añade una fila de versión nueva. Cambios exactos de payload (todo lo demás
-- se conserva byte a byte, incluido el overlay Ley 2/2007 completo de T3):
--   1. convocatoria.antelacionDias.SL / .SLP → fuente 'ESTATUTOS' (antes
--      'LEY'), referencia "arts. 27.4 Estatutos y 176 LSC (supletoria)"
--      (antes "art. 176 LSC (supletoria)"). valor se mantiene en 15.
--   2. convocatoria.canales.SLP — clave nueva. v1.0.0 solo traía SA/SL;
--      calcularCanales (convocatoria-engine.ts) indexa
--      pack.convocatoria.canales[input.tipoSocial], así que una Junta SLP
--      sin esta clave no recibía ningún canal de este pack. Mismo canal que
--      SL: ["COMUNICACION_INDIVIDUAL_CON_ACUSE"] (art. 27.3 Estatutos).
--   3. reglaEspecifica.antelacionAmpliada — clave nueva y puramente
--      documental (ningún engine lee reglaEspecifica hoy: types.ts la
--      declara Record<string, unknown> sin consumidor). Registra que el
--      art. 27.4 Estatutos amplía el plazo a un mes cuando el orden del día
--      incluye modificación estructural u otro asunto que legalmente lo
--      exija — la materia INTEGRACION (clase ESTRUCTURAL) la dispararía.
--      valor:30 es la misma aproximación de display que el motor ya usa
--      para "un mes" en la junta SA por defecto (convocatoria-engine.ts,
--      calcularAntelacion/restarUnMes). Vive en reglaEspecifica, no como
--      clave hermana de ReglaConvocatoria (types.ts), para no ensanchar ese
--      tipo con un campo que el motor todavía no aplica.
--   4. reglaEspecifica.canalAcuseLey2007.referencia → cita completa con el
--      texto estatutario literal ("art. 27.3 Estatutos (comunicación
--      individualizada y por escrito que asegure la recepción; también
--      entrega en mano contra recibí); LSC supletoria", antes "LSC
--      supletoria + art. 27.3 Estatutos"). codigo, semanticaAcuse y nota
--      (cautela EAD, política 2026-07-21) intactos.
--
-- Mecánica de versión (mismo patrón que 20260804070000, nunca se muta el
-- payload de una versión ya aplicada):
--   (a) INSERT de rule_pack_versions v1.1.0, is_active=true, status='ACTIVE'.
--   (b) UPDATE de la fila v1.0.0 existente → is_active=false,
--       status='DEPRECATED'. El payload de la fila v1.0.0 NO se toca.
-- Forward-only, idempotente (WHERE NOT EXISTS / WHERE ... AND is_active).
-- Espejo en scripts/seed-garrigues-rule-packs.ts
-- (JUNTA_SOCIOS_V110_PAYLOAD + ensureJuntaSociosV110Upgrade), payload
-- verificado por JSON round-trip contra este mismo objeto TS.

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_JUNTA_SOCIOS', '1.1.0', '{"id":"GARR_JUNTA_SOCIOS","materia":"GARR_JUNTA_SOCIOS","clase":"ESTATUTARIA","organoTipo":"JUNTA_GENERAL","modosAdopcionPermitidos":["MEETING","UNIVERSAL"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_JUNTA","UNIVERSAL":"ACTA_JUNTA"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"LEY","formula":"reforzada art. 201.2 LSC","referencia":"art. 201.2 LSC — 2/3 capital presente (tramo 25-50% en 2ª conv.)"},"SL":{"fuente":"LEY","formula":"favor > 1/2_capital_total_con_voto","referencia":"art. 199.a LSC"},"CONSEJO":{"fuente":"LEY","formula":"favor > presentes_mitad","referencia":"art. 247.1 LSC"},"sociosProfesionalesExclusion":{"fuente":"LEY","formula":"mayoria_capital_y_mayoria_socios_profesionales","referencia":"arts. 15 y 16 Ley 2/2007","alcance":"EXCLUSION_SOCIO_PROFESIONAL_UNICAMENTE — no es la mayoría general de acuerdos de la Junta","redaccion":"Acuerdo motivado de la Junta, por causas legales o estatutarias; doble mayoría de capital y de socios profesionales"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SLP":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"},"SLP":{"valor":15,"fuente":"ESTATUTOS","referencia":"arts. 27.4 Estatutos y 176 LSC (supletoria)"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día","Texto íntegro de la propuesta cuando proceda"],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto íntegro de la propuesta","condicion":"SIEMPRE"},{"id":"informe_admin","nombre":"Informe del administrador único","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta íntegra"},{"id":"informe_admin_justificacion","nombre":"Informe justificativo del administrador único"},{"id":"derecho_informacion_287","nombre":"Derecho de información art. 287 LSC","condicion":"SIEMPRE"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}},"postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true,"plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 83 RRM (1 mes)"}},"plazosMateriales":{"inscripcion":{"plazo_dias":30,"fuente":"LEY","referencia":"art. 83 RRM"},"publicacion":["BORME"]},"reglaEspecifica":{"overlayLey2007":[{"parametro":"TRANSMISION_PARTICIPACION_SOCIO_PROFESIONAL","referencia":"art. 13 Ley 2/2007","fuente":"LEY","redaccion":"La condición de socio profesional es intransmisible salvo consentimiento de todos los socios profesionales, salvo que el contrato social lo module a mayoría de ellos"},{"parametro":"SEPARACION_SOCIO_PROFESIONAL","referencia":"art. 14 Ley 2/2007","fuente":"LEY","redaccion":"Separación libre en sociedad de duración indefinida, eficaz desde la notificación, conforme a la buena fe"},{"parametro":"EXCLUSION_SOCIO_PROFESIONAL","referencia":"arts. 15 y 16 Ley 2/2007","fuente":"LEY","redaccion":"Acuerdo motivado de la Junta, por causas legales o estatutarias; doble mayoría de capital y de socios profesionales","alcance":"La doble mayoría también se anida en votacion.mayoria.sociosProfesionalesExclusion para la ficha del acuerdo de exclusión"},{"parametro":"MAYORIA_SOCIOS_PROFESIONALES","referencia":"art. 4 Ley 2/2007","fuente":"LEY","redaccion":"La mayoría del capital y votos ha de pertenecer a socios profesionales; el administrador único de una SLP ha de ser socio profesional; la doble mayoría se exige señaladamente en la exclusión","alcance":"COMPOSICION_ORGANO_Y_JUNTA — invariante sondable (el administrador único figura también en el censo de socios), NO mayoría general de acuerdos de la Junta"},{"parametro":"INSCRIBIBILIDAD_CAMBIO_SOCIOS","referencia":"art. 8 Ley 2/2007","fuente":"LEY","redaccion":"Los cambios de socios y administradores constan en escritura pública y se inscriben","alcance":"Sostiene postAcuerdo.inscribible=true; el plazo de inscripción cita art. 83 RRM (Ley 2/2007 obliga a inscribir, no fija días)"}],"canalAcuseLey2007":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 27.3 Estatutos (comunicación individualizada y por escrito que asegure la recepción; también entrega en mano contra recibí); LSC supletoria","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."},"antelacionAmpliada":{"valor":30,"condicion":"MODIFICACION_ESTRUCTURAL_EN_ORDEN_DEL_DIA","fuente":"ESTATUTOS","referencia":"art. 27.4 Estatutos (el plazo se amplía a un mes si el orden del día incluye modificación estructural u otro asunto que legalmente lo exija)"}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_JUNTA_SOCIOS' AND version = '1.1.0'
);

UPDATE public.rule_pack_versions
SET is_active = false, status = 'DEPRECATED'
WHERE pack_id = 'GARR_JUNTA_SOCIOS' AND version = '1.0.0' AND is_active = true;

DO $$
DECLARE
  v_active_v110 integer;
  v_active_total integer;
BEGIN
  SELECT count(*) INTO v_active_v110
  FROM public.rule_pack_versions
  WHERE pack_id = 'GARR_JUNTA_SOCIOS' AND version = '1.1.0' AND is_active = true;

  IF v_active_v110 <> 1 THEN
    RAISE EXCEPTION 'G3 Task 5 verificación fallida: GARR_JUNTA_SOCIOS no tiene v1.1.0 activa (count=%)', v_active_v110;
  END IF;

  SELECT count(*) INTO v_active_total
  FROM public.rule_pack_versions
  WHERE pack_id = 'GARR_JUNTA_SOCIOS' AND is_active = true;

  IF v_active_total <> 1 THEN
    RAISE EXCEPTION 'G3 Task 5 verificación fallida: GARR_JUNTA_SOCIOS tiene % versiones activas simultáneas (esperado 1)', v_active_total;
  END IF;
END $$;
