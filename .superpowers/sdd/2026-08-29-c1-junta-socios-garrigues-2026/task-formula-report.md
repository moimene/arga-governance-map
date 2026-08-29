# Opción (2) — `parte_votante_current` se pondera por títulos

**Estado: APLICADA.** Migración `20260829150000_c1_parte_votante_por_titulos.sql`, registrada y verificada
leyendo la fila por su nombre.

## El defecto

`fn_refresh_parte_votante_entity` calculaba `voting_weight = porcentaje_capital × votes_per_title`.
Con **una** clase de participaciones eso es proporcional a `títulos × votos/título` y coincide salvo
constante — por eso ha sido invisible desde que existe la tabla (2026-04-21). Con **dos** clases de
nominal distinto deja de coincidir: en la matriz de Garrigues un socio de clase A pesaba **800.000**
veces uno de clase B, cuando el art. 7 de sus Estatutos dice **50**.

## Antes de aplicar: probe con ROLLBACK

La fórmula nueva se midió **en transacción, con ROLLBACK**, sobre los dos tenants. No se aplicó nada
hasta ver los números:

```
ARGA  Cartera ARGA S.L.U.  69,6900 → 69,6775   (−0,012528)
ARGA  Mercado libre         30,3100 → 30,3225   (+0,012528)
GARR  ratio clase A / B     800.000,00 → 50,00  (art. 7 dice 50)
```

## Después de aplicar: idénticos

```
ARGA  Cartera ARGA S.L.U.  69.6900 -> 69.6775  (delta -0.012528)
ARGA  Mercado libre         30.3100 -> 30.3225  (delta  0.012528)
GARR  ratio A/B = 50.00  (antes 800000)
GARR  Σ voting = 100.000000 | Σ denom = 97.406342 | presenciales_voting = 0.887154 %
WORM POST censo_snapshot ARGA: filas=24 | hash_concat=d3af45ba2d88b2c7b232789c8208e9ef
CARGO intacto: filas=256 | Σ voting=256.0000 | peso_exactamente_1=256
```

**Los `censo_snapshot` WORM de ARGA no se han movido**, y está **enseñado**, no deducido: el
`md5` del concatenado de `id‖capital_total_base‖total_partes` de las 24 filas es
`d3af45ba2d88b2c7b232789c8208e9ef` **antes y después**.

**La rama `CARGO` está intacta**: 256 filas, todas con peso exactamente 1. Un consejero no tiene
títulos y `fn_secretaria_evaluate_meeting_vote` exige que cada asiento pese 1; esa rama vive en
`fn_refresh_parte_votante_body`, que **no se ha tocado**.

## Qué NO se cambió, y por qué

`denominator_weight` sigue siendo `porcentaje_capital`. `fn_crear_censo_snapshot` lo agrega en
`capital_total_base`, que viaja a registros **WORM**: mover su semántica cambiaría el significado de un
campo ya emitido en 24 snapshots de ARGA.

## Consecuencia que hay que tener presente en Task 5

`presenciales_voting = 0,887154 %` en la proyección. El acta declara **0,8875 %**, que es el criterio de
cómputo sobre los votos de **clase A no autocartera** (16.900). La proyección normaliza sobre **todos**
los votos computables (16.908), y por eso da 0,8872 %. **No es una discrepancia nueva:** es exactamente
la divergencia de 8 votos documentada en `docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md`
§4, y la base declarada del expediente vive en `meeting-census.ts` y en `quorum_data`, no aquí.

## Barrido previo de conteos pinados de ARGA

19 ocurrencias de `69.69` / `30.31` en el repo: **17 son fixtures en memoria** (no leen Cloud) y
`canonical-bootstrap.test.ts:278` lee `capital_holdings.porcentaje_capital`, que esta migración no toca.
De los tests que leen `parte_votante_current` contra Cloud, **ninguno pina un valor**. Cero gates en
riesgo, verificado antes de aplicar.

## Gates

Suite completa, corrida **una sola vez en frío** en `/private/tmp/c1-secretaria` (worktree aislado con
`version garrigues` enlazado y `.env` copiado), en la ventana concedida por el orquestador:

```
3647 pass · 152 skip · 0 fail · 18.202 expects · 3799 tests
```

Base `804dbb2` = 3612 / 152 / 0 / 3764. **Δ = +35 pass, +35 tests, 0 skip nuevos**, y los 35 están
enteros: `garrigues-capital-firme` 7 + `garrigues-capital-seed-arista` 13 + `garrigues-junta-2026-seed`
15. Sin residuo.
