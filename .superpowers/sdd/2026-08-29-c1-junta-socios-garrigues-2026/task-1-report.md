# Task 1 — informe de cierre

**Estado: COMPLETA.** Migración aplicada en Cloud, verificada con pre/post-probe y residuo, gates verdes.

## Qué se entregó

| Fichero | Cambio |
|---|---|
| `supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql` | nuevo — INSERT de v1.1.0 + archivado de v1.0.0 + bloque `DO $$` de verificación |
| `scripts/seed-garrigues-rule-packs.ts` | espejo del payload, versión por pack, archivado de versiones antiguas |
| `src/test/schema/garrigues-rule-packs-seed.test.ts` | 2 sondas Cloud nuevas |
| `src/test/schema/garrigues-consejo-ead-pack-paridad.test.ts` | nuevo — 5 tests puros de paridad migración↔seed |
| `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md` | nuevo — registro canónico del criterio de cómputo (Task 2, adelantado por exigencia del orquestador) |

## Review adversarial: 4 P1 + 9 P2. Los 4 P1 corregidos.

| Hallazgo | Corrección |
|---|---|
| **P1** El seed podía dejar **dos versiones activas**: insertaba v1.1.0 activa sin archivar la v1.0.0, y ningún índice único lo impide. Los lectores no desempatan (`useAgreementCompliance` usa `.find()` sin ORDER BY; `useRulePackForMateria` toma `versions[0]`). | `ensureRulePack` archiva toda otra versión de un pack que declare `version` propia. Generaliza lo que `ensureJuntaSociosV110Upgrade` hacía a mano para un solo pack; los otros 9 packs no lo activan. |
| **P1** El test "queda archivada, no mutada" **no detectaba mutación**: `expect(…antelacionConsejo).toBeUndefined()` pasa igual con el payload a `null`, vacío o sustituido por otro pack. Comprobado por el revisor con 4 escenarios: los 4 pasaban. | Aserciones de **contenido positivo** sobre la v1.0.0 (id, mayoría art. 247.1, referencia del art. 246, cautela EAD) y una invariante dura que se exige siempre: exactamente una versión activa y es la 1.1.0. |
| **P1** **Ningún test ataba los artefactos del repo a la aserción.** Una vez aplicada la migración, borrarla y revertir el seed dejaba todo en verde. La paridad migración↔seed no tenía guardián, en un programa donde la triple copia SQL/seed/fixture ya es deuda catalogada. | `garrigues-consejo-ead-pack-paridad.test.ts`: puro, sin red, parsea el literal de las dos migraciones e importa `PACKS`. Asierta paridad seed↔migración, que v1.1.0 solo añade `antelacionConsejo` sobre v1.0.0, y que los 5 días no se presentan como plazo legal en ninguna copia. |
| **P1** `rule_pack_versions` **no tiene RLS por tenant** (deuda pre-existente; el aislamiento lo da `rule_packs`). Verificado por el revisor: con login ARGA, `rule_packs LIKE 'GARR_%'` → 0 filas, pero `rule_pack_versions` de `GARR_CONSEJO_EAD` → 1 fila con payload legible. Esta tarea depositaba ahí **provenance atribuida**: cargo de quien confirmó y ruta a un documento legal interno. | La clave `antelacionConsejo` se recorta al hecho operativo: `{valorDias, naturaleza, fechaConfirmacion, nota}`. El quién y el dónde pasan a la cabecera de la migración y a `docs/legal/`. Un test asierta que la clave no contiene `docs/legal` ni la atribución nominal. La deuda RLS se reporta al orquestador; no se arregla aquí. |

P2 aplicados por baratos: `UPDATE` de archivado sin `AND is_active = true` (`rule-resolution.ts` da precedencia a `status` sobre `is_active`, así que una fila `ACTIVE`/`false` quedaba incoherente y sin corregir); cabecera decía "bytes" donde eran caracteres; cadena de anon key ampliada a `VITE_SUPABASE_ANON_KEY || ANON_PUBLIC || <literal>`; nota del payload dice "la entidad titular de este pack" en vez de nombrar a EAD Trust (el pack no tiene binding de entidad en el esquema).

P2 **no** aplicados, anotados como deuda: `payload_hash`, `effective_to` y `supersedes_version_id` siguen NULL, igual que en `20260805100000` — deuda heredada consistente con el precedente, no se crece; y el gate de aislamiento cross-tenant sigue sin cubrir `rule_pack_versions`.

## Verificación en Cloud (controller)

```
PRE   GARR_CONSEJO_EAD@1.0.0 active=true  status=ACTIVE
POST  GARR_CONSEJO_EAD@1.0.0 active=false status=DEPRECATED antelacion=AUSENTE
POST  GARR_CONSEJO_EAD@1.1.0 active=true  status=ACTIVE     antelacion=PRACTICA_SOCIETARIA_CONFIRMADA
RESIDUO head_migracion=20260829120000
RESIDUO packs_ARGA=59        ← intacta
RESIDUO packs_GARR=10
RESIDUO activas_CONSEJO_EAD=1
```

La v1.0.0 no ganó la clave nueva: su payload no fue mutado.

## Gates — medidos en `/private/tmp/c1-secretaria`

Worktree aislado **con `version garrigues` enlazado y `.env` copiado**, es decir el lado "con carpetas fuente" del listón (el gate `g5-mapa-penal` SÍ corre aquí).

```
bun test       3468 pass / 152 skip / 0 fail   (3620 ejecutados, 16130 expect)
bun run lint       exit 0, sin salida
bun run typecheck  exit 0, sin salida
bun run build      exit 0
```

Línea base del orquestador: 3461 / 152 / 0 sobre 3613. **+7 pass, +7 total, 0 skip nuevos** = exactamente los 7 tests añadidos (5 de paridad + 2 sondas Cloud). Sin regresión.
