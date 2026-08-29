# Task 2 — informe de cierre

**Estado: COMPLETA.** Módulo puro con la regresión del acta dentro, migración de `share_classes` aplicada en Cloud con pre/post-probe, gates verdes.

## Qué se entregó

| Fichero | Qué es |
|---|---|
| `scripts/garrigues/capital/estructura-art7.ts` | módulo puro, **única fuente de verdad** de la estructura del art. 7: clases, nominales, votos, autocartera, bases de cómputo y reparto del censo. Sin red. |
| `src/test/schema/capital-art7.test.ts` | 20 casos puros: 4 comprobaciones cruzadas + **REGRESIÓN OBLIGATORIA** + reparto del censo real |
| `supabase/migrations/20260829130000_c1_share_class_nominal.sql` | `nominal_value` y `total_titulos` en `share_classes`, NULLABLE |

## Por qué hacía falta la migración

`share_classes` **no tiene columna de nominal** y `entity_capital_profile.valor_nominal` es único por entidad. Con dos clases de 16.000 € y 1 €, el art. 7 literalmente no cabía en el esquema. Autorizado nominalmente por el orquestador con cuatro condiciones, las cuatro cumplidas.

## Los números que produce el módulo

| Magnitud | Valor | Contraste con el acta |
|---|---|---|
| Capital derivado de las clases | 11.104.008 € | = capital registral ✓ |
| Votos totales | 17.358 | 694×25 + 8×1 |
| Autocartera | 450 votos (18 A) | 2,592465 % → **2,59 %** ✓ |
| Base **declarada** (clase A no autocartera) | **16.900** | |
| Base alternativa (todas las clases) | 16.908 | **diferencia = 8 votos** |
| Presenciales (3 × 2A × 25) | 150 votos | |
| % presenciales sobre 16.900 | **0,887574 %** | → **0,8875 %** por truncamiento ✓ |
| % presenciales sobre 16.908 | 0,887154 % | → 0,8872 % ✗ (no es el acta) |
| Censo repartido | 338 A + 8 B = 346 | ✓ |
| Σ % capital + autocartera | 100,000000 % (\|Σ−100\| = 4,4e-13) | ✓ |

El revisor recalculó las siete magnitudes con `fractions.Fraction` (aritmética exacta, sin floats) y **coinciden las tres fuentes** — módulo, test y `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md` — al decimal. Ni un decimal mal en el registro legal.

## Review adversarial: prueba de mutación con 12 mutantes

Los 8 exigidos se cazan todos. **El revisor añadió 4 propios y 2 escapaban.** Los dos escapes eran hallazgos reales:

| Mutante | Antes | Ahora |
|---|---|---|
| (i) se borra el `sort` de `repartirCenso` | **escapaba** 16/16 verdes | **cazado** — nuevo caso que reparte con el listado invertido y exige los mismos 8 de clase B |
| (j) `votos: titulos * 25` para todos los holdings | **escapaba** 16/16 verdes | **cazado** por 2 casos — los 8 de clase B valen 1 voto cada uno, y Σ votos + autocartera = 17.358 |

El (j) era **P1**: nadie asertaba `Holding.votos`, así que aplicar la tasa de clase A a todas las filas —incluidos los 8 de clase B— pasaba en verde. Son exactamente los 8 votos de los que depende la decisión legal de la base de cómputo.

**Aviso metodológico del propio revisor, que vale la pena conservar:** su primer arnés de mutación dio **5 falsos "ESCAPA"**. Contaba tests rojos en el informe JSON, y tres mutantes hacen que el fichero no llegue a ejecutar ningún test (`assertionResults` vacío se leía como "nada falla"). Lo rehizo sobre el código de salida. Un revisor que se hubiera quedado con la primera tabla habría reportado tres hallazgos inexistentes.

## Correcciones aplicadas

| Sev | Hallazgo | Corrección |
|---|---|---|
| **P1** | `Holding.votos` sin asertar y sin persistir por nadie | 2 casos nuevos; el campo deja de ser dato muerto |
| **P2** | El `DO $assert$` **no podía fallar** en la ejecución que aplica la migración: `ADD COLUMN` sin DEFAULT deja NULL en todo, así que el `count` es 0 por construcción, hubiera o no filas de ARGA | Añadida una comprobación que sí puede fallar (las 2 columnas existen tras el DDL) y la guarda de ARGA queda con el comentario honesto de cuándo es vacua y cuál es la prueba real (la sonda de Task 3) |
| **P2** | Un fallo estructural **colapsaba el fichero entero**: `repartirCenso` se llamaba en el cuerpo del `describe`, y con 3 de los mutantes el resultado era `no tests` — 0 de 16 aserciones, incluida toda la REGRESIÓN OBLIGATORIA | El reparto pasa a función lazy; cada `it` construye el suyo |
| **P2** | `ART7_CLASES` mutable: `ART7_CLASES[0].totalTitulos = 999` cambiaba `votosTotales()` mientras `SOCIOS_CUOTA` y `CENSO_TOTAL` seguían con el valor viejo — el módulo desincronizado consigo mismo | `Object.freeze` en el array y en cada clase |
| **P2** | `repartirCenso` no rechazaba duplicados ni solapamiento presenciales∩representados | Guarda por `Set` + caso de test. El censo real está limpio (verificado: 0 duplicados), pero la función es la puerta de entrada del expediente |
| **P2** | `SOCIOS_CUOTA` derivaba de la autocartera pero el 694 estaba escrito a mano | Derivado de `ART7_CLASES`; `SOCIOS_CLASE_B` también |

## Anotado, no corregido

- **`bun run typecheck` no mira ninguno de los dos ficheros TS nuevos.** `tsconfig.app.json` incluye solo `src` y excluye `**/*.test.ts`; `scripts/` no está en ningún tsconfig. Punto ciego total: **43 `.ts` en `scripts/` + 413 `*.test.ts*` en `src/`**. Verificado inyectando `const VENENO: number = "no soy un number"` en los dos ficheros → `typecheck` exit 0 sin salida; el mismo veneno en un fichero cubierto da `TS2322`. **Es superficie compartida (tsconfig del repo): reportado al orquestador, no tocado desde aquí.**
- **`share_classes.total_titulos` es un cuarto sitio donde vive el número de títulos**, sin nada que lo reconcilie con `Σ capital_holdings.numero_titulos` ni con `entity_capital_profile.numero_titulos`. La RPC de transmisión de `000051` mueve `numero_titulos` y no sabe de `total_titulos`.
- **Cambio de comportamiento visible**, no regresión: bajo el módulo los 3 presenciales pasan a tener **0,8646 % de capital** (3 × 0,288184) y **0,8875 % de voto**. El seed viejo escribía el 0,8875 del acta en `porcentaje_capital`, **confundiendo capital con voto**. El módulo los separa. El gate G2 existente (`garrigues-gobierno-seed.test.ts:86`, "347 holdings que suman ~100") sigue verde.
- **Los 8 titulares de clase B** son la cola del listado ordenado con `localeCompare("es")`: elección determinista y arbitraria, etiquetada `INFERIDO`, y **pinada por test con los 8 nombres**. El revisor comprobó que el pin **no es circular**: con el fichero barajado e invertido salen los mismos 8, y el orden por codepoint (entorno sin ICU) daría otros — el pin lo cazaría.

## Cloud (controller)

```
PRE   columnas_nuevas=0   share_classes_ARGA=31   share_classes_GARR=1
POST  columnas_nuevas=2   share_classes_ARGA=31 con_valor=0   share_classes_GARR=1
RESIDUO head_migracion=20260829130000
```

ARGA: 31 clases, **ninguna con valor** en las columnas nuevas. Cero cambio.

## Gates — dónde se corrieron

`/private/tmp/c1-secretaria`, worktree aislado, con `version garrigues` enlazado y `.env` copiado.

```
bun test src/test/schema/capital-art7.test.ts   20 pass / 0 fail / 46 expect
bun run lint                                    exit 0
```

Prueba de mutación posterior a las correcciones, ejecutada por el controller: (j) → 2 fail; (i) → 1 fail; revertido → 20 pass. Los dos escapes están cerrados.
