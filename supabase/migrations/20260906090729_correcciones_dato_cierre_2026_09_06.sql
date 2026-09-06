-- Idempotente: reaplicable sin efecto. Ya estaba aplicado en governance_OS el
-- 2026-09-06 vía execute_sql; este fichero existe para que el entorno sea
-- REPRODUCIBLE, que es la regla del repo y que yo me salté al escribir el dato
-- sin espejo. Lo señaló la review adversarial de la rama.

-- DA-12: la fecha de detección de los 8 hallazgos penales de Garrigues era la
-- fecha del seed (2026-08-29), no un hecho de la fuente. El script ya no la
-- fabrica (`opened_at: null`); esto sanea el dato ya sembrado.
update findings set opened_at = null
 where code like 'FND-GARR-PEN-%' and opened_at = '2026-08-29';

-- DA-13: el contrabando se tipifica en la LO 12/1995, no en el Código Penal, y
-- es el ÚNICO riesgo en banda roja del tenant. El valor coincide exactamente con
-- lo que produce hoy `descripcionArticulo()` para un `articulo` no numérico.
update risks set description = 'Ley de represión del contrabando'
 where code = 'RSK-GARR-PEN-069'
   and description = 'Artículos del Código Penal: Ley de represión del contrabando';

-- DA-17: cuatro evaluaciones de ARGA con una nota fabricada por un e2e el
-- 2026-07-19 que afirmaba conformidad con TODO el Reglamento de IA.
update ai_risk_assessments
   set notes = 'Fila generada automáticamente por una prueba end-to-end (2026-05-21 / 2026-07-19). No corresponde a ninguna evaluación realizada y no acredita conformidad con el Reglamento (UE) 2024/1689.'
 where id in ('137610a4-d309-4e05-a65e-fcedb2684897','f26e844b-de5f-4f21-b64c-87a8ecb7dc66',
              '802d9278-3efd-44c2-b34b-7b493756c6b2','68f23d26-9719-4fdc-9632-7949ce41f29f')
   and notes like '%cumplimiento estricto%';

-- DA-14: el módulo ESG del tenant Garrigues estaba declarado en TS y no existía
-- como fila. Misma forma que sus cuatro hermanas: `state` por defecto
-- ('Planificado') y los cuatro contadores a 0 — no se fabrica ninguna cifra. El
-- `owner` está acreditado: «Comité de Sostenibilidad» existe como
-- `governing_bodies` del tenant (slug garrigues-comite-sostenibilidad).
insert into grc_modules (tenant_id, id, name, description, owner)
values ('00000000-0000-0000-0000-000000000002','esg','Sostenibilidad y ESG',
        'Plan de Sostenibilidad y adhesión al Pacto Mundial de Naciones Unidas: principios, comités de seguimiento y compromisos ESG.',
        'Comité de Sostenibilidad')
on conflict (tenant_id, id) do nothing;
