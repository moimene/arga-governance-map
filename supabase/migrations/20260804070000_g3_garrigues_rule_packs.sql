-- G3 Task 3 — Rule packs núcleo del tenant Garrigues (motor SLP).
--
-- Antes de esta migración el tenant Garrigues ('00000000-0000-0000-0000-
-- 000000000002') tenía CERO rule packs propios: los 59 existentes en Cloud
-- son de ARGA ('...0001') y no se heredan entre tenants (RLS
-- rule_packs_tenant_isolation: tenant_id = fn_current_tenant_id()).
--
-- 4 packs núcleo, ids namespaced GARR_* (rule_packs.id es TEXT PRIMARY KEY
-- GLOBAL — sin namespacing colisionaría con los ids de ARGA):
--   - GARR_DECISION_ADMIN_UNICO  — decisión genérica del administrador único
--     de una filial SLP (adopción UNIPERSONAL_ADMIN). organo_tipo='CONSEJO'
--     porque rule-pack-organo.ts no tiene familia propia "ADMIN_UNICO": el
--     resolver mapea la administración genérica a la familia CONSEJO.
--   - GARR_JUNTA_SOCIOS          — acuerdos de la Junta de Socios de la
--     matriz. Lleva el overlay de citas FIRMES Ley 2/2007 aprobado por el
--     Comité Legal el 2026-08-04 (docs/legal/2026-08-04-decisiones-comite-
--     legal-slp-garrigues.md, Decisión 2) en reglaEspecifica.overlayLey2007,
--     más la doble mayoría de la exclusión de socio profesional anidada en
--     votacion.mayoria.sociosProfesionalesExclusion (NO nivel superior: el
--     extractor legacy extractMajorityFromRulePackParams solo lee claves de
--     primer nivel del payload y nunca ha leído nada bajo votacion.mayoria
--     en ningún pack del repo — no se toca).
--   - GARR_SOCIO_UNICO_FILIAL    — decisiones del socio único de sociedades
--     filiales (adopción UNIPERSONAL_SOCIO).
--   - GARR_CONSEJO_EAD           — Consejo de Administración colegiado de
--     EAD Trust (el único órgano colegiado real del perímetro Garrigues).
--
-- Reglas transversales aplicadas (Comité Legal 2026-08-04, Decisión 2):
--   - Granularidad: TODO string visible (tanto "referencia" como
--     "redaccion") cita el artículo únicamente ("art. 13 Ley 2/2007"). El
--     desglose por apartado (4.2/4.3 del art. 4), cuando aporta algo, vive
--     solo en comentarios de código fuente — nunca en un string del payload
--     (fix round 1, hallazgo I-1: la "redaccion" de
--     MAYORIA_SOCIOS_PROFESIONALES sí llevaba "(4.2)"/"(4.3)" en la primera
--     versión; retirados).
--   - Corrección de cita obligada: la antelación de 15 días para SL/SLP cita
--     SIEMPRE "art. 176 LSC (supletoria)", NUNCA Ley 2/2007 (que no regula
--     plazos de convocatoria) — misma cita literal que ya usa
--     prototype-rule-pack-fallback.ts:116 (Task 1 de G3).
--   - Canal de convocatoria: cita LSC supletoria + art. 27.3 Estatutos, no
--     Ley 2/2007. Cautela EAD: el acuse no se afirma como capacidad probada
--     (política 2026-07-21) — ver reglaEspecifica.canalAcuseLey2007.
--   - La doble mayoría del art. 15 Ley 2/2007 NO es requisito general de la
--     Junta: solo rige la exclusión de socio profesional (alcance explícito
--     en el propio dato).
--   - Concentración: la rama SLP de normative-framework.ts ("Ley 2/2007 +
--     LSC supletoria") sigue siendo el punto único del marco general; este
--     overlay remite a 5 citas puntuales sin repetir ese framing.
--   - No se crean parámetros de sucesión mortis causa ni de socio no
--     profesional (laguna documentada, no se rellena con regla plausible).
--   - Obligación de inscribir vs. plazo de inscripción NO son la misma cita
--     (fix round 1, hallazgo C-1): art. 8 Ley 2/2007 obliga a inscribir los
--     cambios de socios/administradores, pero no fija días; el plazo (1 mes)
--     cita "art. 83 RRM (1 mes)", mismo patrón que el pack hermano ya
--     aprobado 20260612210000_item054_rule_packs_garrigues.sql.
--   - El Consejo no es una Junta (fix round 1, hallazgo C-2): la
--     convocatoria de GARR_CONSEJO_EAD no cita art. 176 LSC (exclusivo de
--     Junta General) ni usa canales públicos (BORME/WEB) — cita art. 246 LSC
--     (sin plazo mínimo legal, convocatoria del presidente, notificación
--     individual a cada consejero).
--
-- Forward-only, idempotente (WHERE NOT EXISTS, mismo patrón que
-- 20260612210000_item054_rule_packs_garrigues.sql — pese a su nombre, esos
-- packs son del tenant ARGA; esta es la primera migración con packs bajo el
-- tenant_id de Garrigues real).
--
-- FIX ROUND 1 (revisión adversarial, ver task-3-report.md): reescribe el
-- contenido de GARR_JUNTA_SOCIOS (plazo de inscripción, redacciones M-1/I-1)
-- y GARR_CONSEJO_EAD (convocatoria completa, C-2) descrito arriba. No cambia
-- estructura de tablas, ids, organo_tipo, ni el resto de los 4 payloads.

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_DECISION_ADMIN_UNICO', '00000000-0000-0000-0000-000000000002'::uuid, 'GARR_DECISION_ADMIN_UNICO', 'CONSEJO', 'Garrigues G3 — decisión genérica del administrador único (filiales SLP)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_DECISION_ADMIN_UNICO');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_DECISION_ADMIN_UNICO', '1.0.0', '{"id":"GARR_DECISION_ADMIN_UNICO","materia":"GARR_DECISION_ADMIN_UNICO","clase":"ORDINARIA","organoTipo":"CONSEJO","modosAdopcionPermitidos":["UNIPERSONAL_ADMIN"],"acta":{"tipoActaPorModo":{"UNIPERSONAL_ADMIN":"ACTA_CONSIGNACION_ADMIN"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"LEY","formula":"decision_unica","referencia":"art. 210 LSC — administrador único (no aplica mayoría, decisión unipersonal)"},"SL":{"fuente":"LEY","formula":"decision_unica","referencia":"art. 210 LSC — administrador único (no aplica mayoría, decisión unipersonal)"},"CONSEJO":{"fuente":"LEY","formula":"decision_unica","referencia":"art. 210 LSC — administrador único (no aplica mayoría, decisión unipersonal)"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"},"SA_2a":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"},"SL":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"},"CONSEJO":{"valor":"no_aplica","fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"}}},"convocatoria":{"canales":{"SA":[],"SL":[]},"antelacionDias":{"SA":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — sin convocatoria, decisión unipersonal"},"SL":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — sin convocatoria, decisión unipersonal"}},"contenidoMinimo":[],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto de la decisión del administrador único","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"decision_consignada","nombre":"Consignación escrita de la decisión","condicion":"SIEMPRE"}],"ventanaDisponibilidad":{"dias":0,"fuente":"SISTEMA"}},"postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false},"plazosMateriales":{"publicacion":[]}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_DECISION_ADMIN_UNICO' AND is_active = true);

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_JUNTA_SOCIOS', '00000000-0000-0000-0000-000000000002'::uuid, 'GARR_JUNTA_SOCIOS', 'JUNTA_GENERAL', 'Garrigues G3 — acuerdos de la Junta de Socios de la matriz (overlay Ley 2/2007)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_JUNTA_SOCIOS');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_JUNTA_SOCIOS', '1.0.0', '{"id":"GARR_JUNTA_SOCIOS","materia":"GARR_JUNTA_SOCIOS","clase":"ESTATUTARIA","organoTipo":"JUNTA_GENERAL","modosAdopcionPermitidos":["MEETING","UNIVERSAL"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_JUNTA","UNIVERSAL":"ACTA_JUNTA"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"LEY","formula":"reforzada art. 201.2 LSC","referencia":"art. 201.2 LSC — 2/3 capital presente (tramo 25-50% en 2ª conv.)"},"SL":{"fuente":"LEY","formula":"favor > 1/2_capital_total_con_voto","referencia":"art. 199.a LSC"},"CONSEJO":{"fuente":"LEY","formula":"favor > presentes_mitad","referencia":"art. 247.1 LSC"},"sociosProfesionalesExclusion":{"fuente":"LEY","formula":"mayoria_capital_y_mayoria_socios_profesionales","referencia":"arts. 15 y 16 Ley 2/2007","alcance":"EXCLUSION_SOCIO_PROFESIONAL_UNICAMENTE — no es la mayoría general de acuerdos de la Junta","redaccion":"Acuerdo motivado de la Junta, por causas legales o estatutarias; doble mayoría de capital y de socios profesionales"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.5,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SA_2a":{"valor":0.25,"fuente":"LEY","referencia":"art. 194.1 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["BORME","WEB_INSCRITA"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":30,"fuente":"LEY","referencia":"art. 176.1 LSC"},"SL":{"valor":15,"fuente":"LEY","referencia":"art. 176 LSC (supletoria)"},"SLP":{"valor":15,"fuente":"LEY","referencia":"art. 176 LSC (supletoria)"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día","Texto íntegro de la propuesta cuando proceda"],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto íntegro de la propuesta","condicion":"SIEMPRE"},{"id":"informe_admin","nombre":"Informe del administrador único","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta íntegra"},{"id":"informe_admin_justificacion","nombre":"Informe justificativo del administrador único"},{"id":"derecho_informacion_287","nombre":"Derecho de información art. 287 LSC","condicion":"SIEMPRE"}],"ventanaDisponibilidad":{"dias":15,"fuente":"LEY"}},"postAcuerdo":{"inscribible":true,"instrumentoRequerido":"ESCRITURA","publicacionRequerida":true,"plazoInscripcion":{"dias":30,"fuente":"LEY","referencia":"art. 83 RRM (1 mes)"}},"plazosMateriales":{"inscripcion":{"plazo_dias":30,"fuente":"LEY","referencia":"art. 83 RRM"},"publicacion":["BORME"]},"reglaEspecifica":{"overlayLey2007":[{"parametro":"TRANSMISION_PARTICIPACION_SOCIO_PROFESIONAL","referencia":"art. 13 Ley 2/2007","fuente":"LEY","redaccion":"La condición de socio profesional es intransmisible salvo consentimiento de todos los socios profesionales, salvo que el contrato social lo module a mayoría de ellos"},{"parametro":"SEPARACION_SOCIO_PROFESIONAL","referencia":"art. 14 Ley 2/2007","fuente":"LEY","redaccion":"Separación libre en sociedad de duración indefinida, eficaz desde la notificación, conforme a la buena fe"},{"parametro":"EXCLUSION_SOCIO_PROFESIONAL","referencia":"arts. 15 y 16 Ley 2/2007","fuente":"LEY","redaccion":"Acuerdo motivado de la Junta, por causas legales o estatutarias; doble mayoría de capital y de socios profesionales","alcance":"La doble mayoría también se anida en votacion.mayoria.sociosProfesionalesExclusion para la ficha del acuerdo de exclusión"},{"parametro":"MAYORIA_SOCIOS_PROFESIONALES","referencia":"art. 4 Ley 2/2007","fuente":"LEY","redaccion":"La mayoría del capital y votos ha de pertenecer a socios profesionales; el administrador único de una SLP ha de ser socio profesional; la doble mayoría se exige señaladamente en la exclusión","alcance":"COMPOSICION_ORGANO_Y_JUNTA — invariante sondable (el administrador único figura también en el censo de socios), NO mayoría general de acuerdos de la Junta"},{"parametro":"INSCRIBIBILIDAD_CAMBIO_SOCIOS","referencia":"art. 8 Ley 2/2007","fuente":"LEY","redaccion":"Los cambios de socios y administradores constan en escritura pública y se inscriben","alcance":"Sostiene postAcuerdo.inscribible=true; el plazo de inscripción cita art. 83 RRM (Ley 2/2007 obliga a inscribir, no fija días)"}],"canalAcuseLey2007":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"LSC supletoria + art. 27.3 Estatutos","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_JUNTA_SOCIOS' AND is_active = true);

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_SOCIO_UNICO_FILIAL', '00000000-0000-0000-0000-000000000002'::uuid, 'GARR_SOCIO_UNICO_FILIAL', 'SOCIO_UNICO', 'Garrigues G3 — decisiones del socio único de sociedades filiales'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_SOCIO_UNICO_FILIAL');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_SOCIO_UNICO_FILIAL', '1.0.0', '{"id":"GARR_SOCIO_UNICO_FILIAL","materia":"GARR_SOCIO_UNICO_FILIAL","clase":"ORDINARIA","organoTipo":"SOCIO_UNICO","modosAdopcionPermitidos":["UNIPERSONAL_SOCIO"],"acta":{"tipoActaPorModo":{"UNIPERSONAL_SOCIO":"ACTA_CONSIGNACION_SOCIO"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"LEY","formula":"decision_unica","referencia":"art. 15 LSC — decisiones del socio único (sociedad unipersonal; no aplica mayoría)"},"SL":{"fuente":"LEY","formula":"decision_unica","referencia":"art. 15 LSC — decisiones del socio único (sociedad unipersonal; no aplica mayoría)"},"CONSEJO":{"fuente":"LEY","formula":"decision_unica","referencia":"art. 15 LSC — decisiones del socio único (sociedad unipersonal; no aplica mayoría)"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"},"SA_2a":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"},"SL":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"},"CONSEJO":{"valor":"no_aplica","fuente":"SISTEMA","referencia":"No aplica — órgano unipersonal"}}},"convocatoria":{"canales":{"SA":[],"SL":[]},"antelacionDias":{"SA":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — sin convocatoria, decisión unipersonal"},"SL":{"valor":0,"fuente":"SISTEMA","referencia":"No aplica — sin convocatoria, decisión unipersonal"}},"contenidoMinimo":[],"documentosObligatorios":[{"id":"propuesta","nombre":"Texto de la decisión del socio único","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"decision_consignada","nombre":"Consignación en el libro-registro de decisiones del socio único","condicion":"SIEMPRE"}],"ventanaDisponibilidad":{"dias":0,"fuente":"SISTEMA"}},"postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false},"plazosMateriales":{"publicacion":[]}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_SOCIO_UNICO_FILIAL' AND is_active = true);

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'GARR_CONSEJO_EAD', '00000000-0000-0000-0000-000000000002'::uuid, 'GARR_CONSEJO_EAD', 'CONSEJO', 'Garrigues G3 — Consejo de Administración colegiado de EAD Trust'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id = 'GARR_CONSEJO_EAD');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_CONSEJO_EAD', '1.0.0', '{"id":"GARR_CONSEJO_EAD","materia":"GARR_CONSEJO_EAD","clase":"ORDINARIA","organoTipo":"CONSEJO","modosAdopcionPermitidos":["MEETING"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_CONSEJO"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"LEY","formula":"favor > contra","referencia":"art. 201.1 LSC (mayoría ordinaria)"},"SL":{"fuente":"LEY","formula":"favor > 1/3_capital","referencia":"art. 198 LSC"},"CONSEJO":{"fuente":"LEY","formula":"favor > presentes_mitad","referencia":"art. 247.1 LSC"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.25,"fuente":"LEY","referencia":"art. 193.1 LSC"},"SA_2a":{"valor":0,"fuente":"LEY","referencia":"art. 193.2 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":5,"fuente":"ESTATUTOS","referencia":"art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"},"SL":{"valor":5,"fuente":"ESTATUTOS","referencia":"art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día"],"documentosObligatorios":[{"id":"propuesta","nombre":"Propuesta de acuerdo","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta de acuerdo","condicion":"SIEMPRE"}],"ventanaDisponibilidad":{"dias":0,"fuente":"SISTEMA"}},"postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false},"plazosMateriales":{"publicacion":[]},"reglaEspecifica":{"canalAcuseConsejo":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 246 LSC — convocatoria del presidente a cada consejero","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_CONSEJO_EAD' AND is_active = true);

DO $$
DECLARE v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing FROM (
    VALUES ('GARR_DECISION_ADMIN_UNICO'), ('GARR_JUNTA_SOCIOS'), ('GARR_SOCIO_UNICO_FILIAL'), ('GARR_CONSEJO_EAD')
  ) AS t(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.rule_packs rp
    JOIN public.rule_pack_versions v ON v.pack_id = rp.id AND v.is_active
    WHERE rp.id = t.id AND rp.tenant_id = '00000000-0000-0000-0000-000000000002'::uuid
  );
  IF v_missing <> 0 THEN
    RAISE EXCEPTION 'G3 Task 3 verificación fallida: % packs GARR_* sin pack activo bajo el tenant Garrigues', v_missing;
  END IF;
END $$;
