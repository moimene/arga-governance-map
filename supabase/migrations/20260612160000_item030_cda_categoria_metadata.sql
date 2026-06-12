-- ITEM-030 — Composición del CdA: etiquetado de categoría (paquete legal Comité
-- Legal + Garrigues). Parte FUNDAMENTADA y SEGURA (additiva, sin cambiar cómputos
-- de vocales/quórum ni la estructura del censo):
--
-- Se añade metadata.categoria + cargo_consejo en las condiciones DETERMINABLES
-- con certeza:
--   * Presidente del CdA → categoria EJECUTIVO, cargo PRESIDENTE (la presidencia
--     ejecutiva de ARGA es retribuida como ejecutiva; CLAUDE.md). El presidente del
--     consejo es consejero (art. 529 sexies LSC: «designado de entre sus miembros»);
--     la condición CONSEJERO paralela y el recuento a 15 miembros se difieren al
--     dato de seed nominal (ver nota).
--   * Persona jurídica consejera (ARGA Capital Inversiones SL) → categoria DOMINICAL.
--
-- NO se asignan categorías a los 14 consejeros restantes ni VICEPRESIDENTE/
-- CONSEJERO_COORDINADOR: el reparto nominal 9 IND / 5 EJE / 1 DOM y la identidad de
-- las dos vicepresidencias y del coordinador independiente son una DECISIÓN DE
-- ESTRUCTURA DEMO (datos nominales) que no consta y que no debe inventarse —
-- requiere la estructura corporativa declarada a nivel de nombre. La secretaria no
-- consejera ya queda fuera del cómputo de vocales (ITEM-028, computeVocalPersonIds).
-- Forward-only, idempotente.

UPDATE public.condiciones_persona
   SET metadata = COALESCE(metadata, '{}'::jsonb)
                  || '{"categoria":"EJECUTIVO","cargo_consejo":"PRESIDENTE","source":"item030"}'::jsonb
 WHERE body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
   AND tipo_condicion = 'PRESIDENTE'
   AND estado = 'VIGENTE'
   AND (metadata ->> 'categoria') IS NULL;

UPDATE public.condiciones_persona
   SET metadata = COALESCE(metadata, '{}'::jsonb)
                  || '{"categoria":"DOMINICAL","cargo_consejo":"VOCAL","source":"item030"}'::jsonb
 WHERE body_id = 'fe05ddd9-ce3e-47b0-8948-5b975c79ab59'
   AND tipo_condicion = 'CONSEJERO'
   AND estado = 'VIGENTE'
   AND person_id = '00000000-0000-0000-0000-000000000110'
   AND (metadata ->> 'categoria') IS NULL;
