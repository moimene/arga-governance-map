-- Alineación final de las 72 plantillas activas con el Gate PRE reforzado.

BEGIN;

UPDATE public.plantillas_protegidas
SET version = '1.3.3',
    capa1_inmutable = replace(
      replace(
        capa1_inmutable,
        'Si {{ACUERDO.carril_tipo}} es “CONSEJO_POR_ESCRITO”',
        'Si {{ACUERDO.carril_tipo}} es “Consejo por escrito y sin sesión”'
      ),
      'Si {{ACUERDO.carril_tipo}} es “SOCIOS_UNANIMIDAD_ESCRITA”',
      'Si {{ACUERDO.carril_tipo}} es “Acuerdo unánime escrito de los socios”'
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.3.3: los carriles de adopción se expresan con etiquetas jurídicas y no como enums técnicos.'
    )
WHERE id = '2c15640c-de2f-41ea-aa8d-304147124a6e'
  AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET version = '1.1.3',
    capa1_inmutable = replace(
      capa1_inmutable,
      'Si ENTIDAD.es_cotizada = SÍ: verificaciones cotizadas: {{MOTOR.verificacion_cotizada_resumen}}.',
      '{{#if ENTIDAD.es_cotizada}}Verificaciones aplicables a sociedad cotizada: {{MOTOR.verificacion_cotizada_resumen}}.{{/if}}'
    ),
    notas_legal = concat_ws(
      E'\n',
      nullif(notas_legal, ''),
      'v1.1.3: la condición de cotizada se resuelve como condicional y no imprime pseudocódigo.'
    )
WHERE id = '24e1b9cb-9c4c-49a2-9259-d49b5b6647a1'
  AND estado = 'ACTIVA';

UPDATE public.plantillas_protegidas
SET content_hash_sha256 = encode(digest(convert_to(capa1_inmutable, 'UTF8'), 'sha256'), 'hex')
WHERE id IN (
  '2c15640c-de2f-41ea-aa8d-304147124a6e',
  '24e1b9cb-9c4c-49a2-9259-d49b5b6647a1'
)
  AND estado = 'ACTIVA';

COMMIT;
