-- ITEM-027 — Corrección de payloads postAcuerdo (paquete legal Comité Legal +
-- Garrigues, firmado 2026-06-12). Verificado contra BOE:
--
-- 1) APROBACION_CUENTAS: el acuerdo no es inscribible, pero genera OBLIGACIÓN DE
--    DEPÓSITO de cuentas. Art. 279 LSC (verbatim): «Dentro del mes siguiente a la
--    aprobación de las cuentas anuales, se presentará para su depósito en el
--    Registro Mercantil... certificación de los acuerdos...». Se añade bloque
--    deposito_cuentas (1 mes, certificación).
-- 2) CESE_CONSEJERO: el instrumento NO debe ser siempre ESCRITURA. Art. 142 RRM
--    (verbatim): la inscripción «podrá practicarse mediante certificación del acta
--    ... con las firmas legitimadas notarialmente, por testimonio notarial... También
--    podrá inscribirse mediante escritura pública». → instrumentoRequerido = CERTIFICACION.
-- 3) AUMENTO_CAPITAL: el plazo citaba «60 días / art. 19 RRM». La verificación BOE
--    muestra que el art. 19 RRM regula el CAMBIO DE DOMICILIO A OTRA PROVINCIA, no un
--    plazo de inscripción — cita errónea (también en la propuesta legal). Se aplica el
--    valor decidido por el Comité Legal (un mes) y se corrige la cita errónea; el
--    instrumento es escritura pública (art. 314 LSC, modificación estatutaria).
--
-- Mecanismo: jsonb_set in-place sobre la versión activa (patrón del repo; el
-- payload_hash se recalcula por trigger). La creación de versiones nuevas que pide
-- el documento legal queda como enhancement cuando exista helper de versionado.
-- Forward-only, idempotente (WHERE acota al valor a corregir).

UPDATE public.rule_pack_versions
SET payload = jsonb_set(
      payload,
      '{postAcuerdo,deposito_cuentas}',
      '{"obligatorio":true,"plazoDias":30,"instrumento":"CERTIFICACION","referencia":"art. 279 LSC (deposito dentro del mes siguiente a la aprobacion)"}'::jsonb,
      true
    )
WHERE pack_id = 'APROBACION_CUENTAS'
  AND is_active = true
  AND payload #> '{postAcuerdo,deposito_cuentas}' IS NULL;

UPDATE public.rule_pack_versions
SET payload = jsonb_set(
      jsonb_set(payload, '{postAcuerdo,instrumentoRequerido}', '"CERTIFICACION"'::jsonb, false),
      '{postAcuerdo,instrumentoReferencia}',
      '"art. 142 RRM (certificacion del acta con firmas legitimadas; la escritura es opcional, no obligatoria)"'::jsonb,
      true
    )
WHERE pack_id = 'CESE_CONSEJERO'
  AND is_active = true
  AND payload #>> '{postAcuerdo,instrumentoRequerido}' = 'ESCRITURA';

UPDATE public.rule_pack_versions
SET payload = jsonb_set(
      payload,
      '{postAcuerdo,plazoInscripcion}',
      '{"dias":30,"fuente":"LEY","referencia":"un mes (criterio Comite Legal + Garrigues 2026-06-12); escritura art. 314 LSC. La cita previa art. 19 RRM era erronea: ese articulo regula el cambio de domicilio a otra provincia."}'::jsonb,
      false
    )
WHERE pack_id = 'AUMENTO_CAPITAL'
  AND is_active = true
  AND (payload #>> '{postAcuerdo,plazoInscripcion,dias}') = '60';
