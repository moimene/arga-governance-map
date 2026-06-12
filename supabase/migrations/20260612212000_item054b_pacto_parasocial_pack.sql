-- ITEM-054b — rule pack PACTO_PARASOCIAL (ESPECIAL, art. 29 LSC). Cierra la 15a materia.
-- El pacto vincula a las partes firmantes (contractual); la ratificacion societaria es
-- mayoria ordinaria y NO es inscribible (no oponible a la sociedad). Forward-only, idempotente.

INSERT INTO public.rule_packs (id, tenant_id, materia, organo_tipo, descripcion)
SELECT 'PACTO_PARASOCIAL', '00000000-0000-0000-0000-000000000001'::uuid, 'PACTO_PARASOCIAL', 'JUNTA_GENERAL', 'Garrigues/Comite Legal — PACTO_PARASOCIAL (art. 29 LSC)'
WHERE NOT EXISTS (SELECT 1 FROM public.rule_packs WHERE id='PACTO_PARASOCIAL');

INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)
SELECT 'PACTO_PARASOCIAL', '1.0.0', '{"id": "PACTO_PARASOCIAL", "materia": "PACTO_PARASOCIAL", "clase": "ESPECIAL", "organoTipo": "JUNTA_GENERAL", "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL", "NO_SESSION"], "acta": {"tipoActaPorModo": {"MEETING": "ACTA_JUNTA", "UNIVERSAL": "ACTA_JUNTA"}, "requiereConformidadConjunta": false, "requiereTranscripcionLibroActas": true}, "votacion": {"mayoria": {"SA": {"fuente": "LEY", "formula": "favor > contra", "referencia": "art. 29 LSC — el pacto vincula contractualmente a las partes firmantes (unanimidad de las partes del pacto), NO es oponible a la sociedad; la ratificacion societaria se adopta por mayoria ordinaria"}, "SL": {"fuente": "LEY", "formula": "favor > 1/3_capital", "referencia": "art. 198 LSC"}, "CONSEJO": {"fuente": "LEY", "formula": "favor > presentes_mitad", "referencia": "art. 247.1 LSC"}}, "abstenciones": "no_cuentan", "votoCalidadPermitido": true}, "constitucion": {"quorum": {"SL": {"valor": 0, "fuente": "LEY", "referencia": "art. 198 LSC"}, "SA_1a": {"valor": 0.25, "fuente": "LEY", "referencia": "art. 193.1 LSC"}, "SA_2a": {"valor": 0, "fuente": "LEY", "referencia": "art. 193.2 LSC"}, "CONSEJO": {"valor": "mayoria_miembros", "fuente": "LEY", "referencia": "art. 247.1 LSC"}}}, "convocatoria": {"canales": {"SA": ["BORME", "WEB_INSCRITA"], "SL": ["COMUNICACION_INDIVIDUAL_ESCRITA"]}, "antelacionDias": {"SA": {"valor": 30, "fuente": "LEY", "referencia": "art. 176.1 LSC"}, "SL": {"valor": 15, "fuente": "LEY", "referencia": "art. 176.1 LSC"}}, "contenidoMinimo": ["Fecha hora y lugar", "Texto del pacto o de su modificacion"], "documentosObligatorios": [{"id": "texto_pacto", "nombre": "Texto integro del pacto parasocial", "condicion": "SIEMPRE"}]}, "documentacion": {"obligatoria": [{"id": "texto_pacto", "nombre": "Texto integro del pacto", "condicion": "SIEMPRE"}], "ventanaDisponibilidad": {"dias": 0}}, "postAcuerdo": {"inscribible": false, "instrumentoRequerido": "NINGUNO", "publicacionRequerida": false, "referencia": "art. 29 LSC — los pactos parasociales no se inscriben ni son oponibles a la sociedad"}, "plazosMateriales": {"inscripcion": {"plazo_dias": null}, "publicacion": []}}'::jsonb, true, 'ACTIVE', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM public.rule_pack_versions WHERE pack_id='PACTO_PARASOCIAL' AND is_active=true);

DO $$
DECLARE v integer;
BEGIN
  SELECT count(*) INTO v FROM public.rule_packs rp JOIN public.rule_pack_versions pv ON pv.pack_id=rp.id AND pv.is_active
   WHERE rp.materia='PACTO_PARASOCIAL';
  IF v<1 THEN RAISE EXCEPTION 'ITEM-054b verificacion fallida'; END IF;
END $$;
