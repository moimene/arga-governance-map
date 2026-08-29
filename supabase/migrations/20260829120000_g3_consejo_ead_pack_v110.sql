-- C1 Task 1 — GARR_CONSEJO_EAD sube a v1.1.0: los 5 días de antelación del
-- Consejo de Administración de EAD Trust dejan de ser un placeholder sin
-- verificar y pasan a ser práctica societaria CONFIRMADA de la entidad.
--
-- Decisión del usuario (OF COUNSEL de Garrigues y consejero de EAD Trust),
-- 2026-08-29. Registro canónico:
-- docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-ead.md,
-- Decisión A.
--
-- QUÉ CAMBIA — exactamente una clave, nueva y puramente documental:
--   reglaEspecifica.antelacionConsejo = { valorDias, naturaleza,
--   confirmadoPor, registro, nota }. `reglaEspecifica` está declarada
--   `Record<string, unknown>` en src/lib/rules-engine/types.ts y ningún
--   engine la lee hoy: es el mismo hueco documental que usó G3 Task 5 para
--   `antelacionAmpliada`. Registra que los 5 días son práctica acreditada de
--   la entidad, no suelo legal.
--
-- DÓNDE VIVE LA ATRIBUCIÓN — y por qué no en el payload:
--   `rule_pack_versions` NO tiene RLS por tenant (deuda pre-existente
--   documentada; el aislamiento real lo da `rule_packs`). Verificado con
--   login de ARGA: `rule_packs LIKE 'GARR_%'` devuelve 0 filas, pero
--   `rule_pack_versions` con pack_id='GARR_CONSEJO_EAD' devuelve la fila y su
--   payload legible. Por eso la clave `antelacionConsejo` lleva SOLO el hecho
--   operativo (valorDias, naturaleza, fechaConfirmacion, nota) y no el nombre
--   ni el cargo de quien lo confirmó ni la ruta al registro interno.
--   Quién lo confirmó: el usuario, OF COUNSEL de Garrigues y consejero de EAD
--   Trust, el 2026-08-29. Registro:
--   docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-ead.md, Decisión A.
--
-- QUÉ NO CAMBIA — y es donde un revisor debe mirar primero:
--   convocatoria.antelacionDias.SA y .SL conservan BYTE A BYTE
--   valor:5, fuente:"ESTATUTOS" y
--   referencia:"art. 246 LSC — sin plazo legal mínimo; convocatoria por el
--   presidente". El art. 246 LSC NO fija plazo mínimo de convocatoria del
--   Consejo, así que el 5 no puede presentarse como cita legal de plazo: la
--   referencia sigue negando el mínimo. `fuente` sigue siendo 'ESTATUTOS' y
--   no 'PRACTICA_SOCIETARIA' porque ese valor no existe en el tipo cerrado
--   `Fuente` de rules-engine/types.ts. Todo el resto del payload —mayoría
--   art. 247.1, quórum, votoCalidadPermitido:false,
--   reglaEspecifica.canalAcuseConsejo con la cautela EAD de la política
--   2026-07-21— se conserva idéntico. El payload de esta migración se
--   obtuvo copiando el literal de v1.0.0 desde
--   20260804070000_g3_garrigues_rule_packs.sql y añadiéndole solo la clave
--   nueva; los 2106 primeros caracteres son el prefijo exacto de aquel.
--
-- Mecánica de versión (patrón de G3 Task 5,
-- 20260805100000_g3_junta_socios_pack_v110.sql): NUNCA se muta el payload de
-- una versión ya aplicada.
--   (a) INSERT de rule_pack_versions v1.1.0, is_active=true, status='ACTIVE'.
--   (b) UPDATE de la fila v1.0.0 existente → is_active=false,
--       status='DEPRECATED'. Su payload NO se toca: la v1.0.0 no gana la
--       clave nueva.
-- Forward-only e idempotente (WHERE NOT EXISTS / WHERE ... AND is_active).
-- Espejo en scripts/seed-garrigues-rule-packs.ts (CONSEJO_EAD_PAYLOAD).

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'GARR_CONSEJO_EAD', '1.1.0', '{"id":"GARR_CONSEJO_EAD","materia":"GARR_CONSEJO_EAD","clase":"ORDINARIA","organoTipo":"CONSEJO","modosAdopcionPermitidos":["MEETING"],"acta":{"tipoActaPorModo":{"MEETING":"ACTA_CONSEJO"},"requiereConformidadConjunta":false,"requiereTranscripcionLibroActas":true},"votacion":{"mayoria":{"SA":{"fuente":"LEY","formula":"favor > contra","referencia":"art. 201.1 LSC (mayoría ordinaria)"},"SL":{"fuente":"LEY","formula":"favor > 1/3_capital","referencia":"art. 198 LSC"},"CONSEJO":{"fuente":"LEY","formula":"favor > presentes_mitad","referencia":"art. 247.1 LSC"}},"abstenciones":"no_cuentan","votoCalidadPermitido":false},"constitucion":{"quorum":{"SA_1a":{"valor":0.25,"fuente":"LEY","referencia":"art. 193.1 LSC"},"SA_2a":{"valor":0,"fuente":"LEY","referencia":"art. 193.2 LSC"},"SL":{"valor":0,"fuente":"LEY","referencia":"art. 198 LSC"},"CONSEJO":{"valor":"mayoria_miembros","fuente":"LEY","referencia":"art. 247.1 LSC"}}},"convocatoria":{"canales":{"SA":["COMUNICACION_INDIVIDUAL_CON_ACUSE"],"SL":["COMUNICACION_INDIVIDUAL_CON_ACUSE"]},"antelacionDias":{"SA":{"valor":5,"fuente":"ESTATUTOS","referencia":"art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"},"SL":{"valor":5,"fuente":"ESTATUTOS","referencia":"art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"}},"contenidoMinimo":["Fecha hora y lugar","Orden del día"],"documentosObligatorios":[{"id":"propuesta","nombre":"Propuesta de acuerdo","condicion":"SIEMPRE"}]},"documentacion":{"obligatoria":[{"id":"propuesta","nombre":"Propuesta de acuerdo","condicion":"SIEMPRE"}],"ventanaDisponibilidad":{"dias":0,"fuente":"SISTEMA"}},"postAcuerdo":{"inscribible":false,"instrumentoRequerido":"NINGUNO","publicacionRequerida":false},"plazosMateriales":{"publicacion":[]},"reglaEspecifica":{"canalAcuseConsejo":{"codigo":"COMUNICACION_INDIVIDUAL_CON_ACUSE","referencia":"art. 246 LSC — convocatoria del presidente a cada consejero","semanticaAcuse":"EAD_INTERPOSICION_ETIQUETADA","nota":"El acuse usa la semántica de interposición EAD Trust; no se afirma como capacidad de entrega/acuse probada (política 2026-07-21)."},"antelacionConsejo":{"valorDias":5,"naturaleza":"PRACTICA_SOCIETARIA_CONFIRMADA","fechaConfirmacion":"2026-08-29","nota":"El art. 246 LSC no fija plazo mínimo de convocatoria del Consejo. Los 5 días son práctica acreditada de la entidad titular de este pack, no suelo legal."}}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (
  SELECT 1 FROM public.rule_pack_versions WHERE pack_id = 'GARR_CONSEJO_EAD' AND version = '1.1.0'
);

UPDATE public.rule_pack_versions
SET is_active = false, status = 'DEPRECATED'
WHERE pack_id = 'GARR_CONSEJO_EAD' AND version = '1.0.0';

DO $$
DECLARE
  v_active_v110 integer;
  v_active_total integer;
BEGIN
  SELECT count(*) INTO v_active_v110
  FROM public.rule_pack_versions
  WHERE pack_id = 'GARR_CONSEJO_EAD' AND version = '1.1.0' AND is_active = true;

  IF v_active_v110 <> 1 THEN
    RAISE EXCEPTION 'C1 Task 1 verificación fallida: GARR_CONSEJO_EAD no tiene v1.1.0 activa (count=%)', v_active_v110;
  END IF;

  SELECT count(*) INTO v_active_total
  FROM public.rule_pack_versions
  WHERE pack_id = 'GARR_CONSEJO_EAD' AND is_active = true;

  IF v_active_total <> 1 THEN
    RAISE EXCEPTION 'C1 Task 1 verificación fallida: GARR_CONSEJO_EAD tiene % versiones activas simultáneas (esperado 1)', v_active_total;
  END IF;
END $$;
