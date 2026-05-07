# Secretaria Societaria - saneamiento global seguro post-seed

Fecha: 2026-05-06  
Repositorio: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`  
Target Cloud: Supabase `governance_OS` (`hzqwefkwsxopwrmtksbg`)  
Tenant demo: `00000000-0000-0000-0000-000000000001`

## Objetivo

Ejecutar un saneamiento global acotado de coherencia societaria sobre el entorno demo Cloud, sin aplicar migraciones ni inferencias ambiguas, para separar:

- Reparaciones inequivocas que pueden aplicarse de forma idempotente.
- Bloqueos que requieren decision funcional o datos societarios adicionales.
- Sociedades que deben quedar como `reference_only` hasta que tengan contrato operativo completo.

## Herramienta

Script principal:

`scripts/secretaria-repair-demo-entity-coherence.ts`

Modos anadidos:

- `--all --plan`: simula reparaciones seguras para todas las sociedades demo.
- `--all --apply-safe`: aplica solo reparaciones globales inequivocas.
- `--entity <id> --plan`: simula reparaciones seguras de una sociedad concreta.

La reparacion global destructiva sigue bloqueada. `--apply` continua exigiendo `--entity`.

## Verificacion previa

- `bun run db:check-target`: pass contra `governance_OS`.
- `bunx --bun tsc --noEmit --pretty false`: pass.
- `scripts/secretaria-repair-demo-entity-coherence.ts --all --plan`: pass.

## Mutaciones aplicadas en Cloud

Comando:

```bash
bun scripts/secretaria-repair-demo-entity-coherence.ts --all --apply-safe
```

Mutaciones seguras:

- `certifications/f5328212-ca29-5f7e-83b1-af35d4e5fe72`: vinculada a `authority_evidence/6f56c54a-30a2-4a63-b585-73f9e4a5adda`.
- `meetings/01c35fdd-e40c-5a48-9526-af7685d4df73`: creado censo economico `ccc25d72-aaae-4bb5-b85a-3d27486f2640` desde 3 holdings canonicos.
- `agreements/e36788ed-18dd-4d21-afc6-b25373b2f716`: backfill de `body_id` desde `agreement_kind`.
- `agreements/78ccb725-ca60-442c-991d-b957f5d87a3b`: backfill de `body_id` desde `agreement_kind`.
- `agreements/a26d7dbd-0f79-4486-87a4-13a3e3fce549`: backfill de `body_id` desde `agreement_kind`.
- `agreements/bab3fea4-34e9-48d4-978a-e2639ac7c943`: backfill de `body_id` desde `agreement_kind`.
- `certifications/420e910e-ea13-5c63-9b55-cf0a489d2b4f`: vinculada a `authority_evidence/92406653-49f2-4f29-ad78-5060f664b037`.
- `meetings/3100fcf7-cb4b-526e-b07b-67c1eb46cead`: creado censo economico `248e8877-cc01-4458-9551-4c543e5e44b2` desde 1 holding canonico.

## Resultado global post-aplicacion

Resumen de sociedades:

| Estado | Numero |
|---|---:|
| Completa | 3 |
| Parcial | 6 |
| Rota | 12 |
| No usable para flujo | 11 |

Issues post-aplicacion:

| Severidad | Numero |
|---|---:|
| BLOCKING | 37 |
| WARNING | 23 |

Idempotencia:

- `--all --plan` post-aplicacion no encuentra mutaciones seguras pendientes.
- Solo quedan skips de censo por ausencia de fuente canonica `condiciones_persona`.

## Sociedades desbloqueadas

Despues del saneamiento seguro quedan completas:

- ARGA Reaseguros, S.A.
- ARGA Servicios Corporativos S.L.
- Cartera ARGA S.L.U.

## Estado ARGA Seguros golden path

ARGA Seguros, S.A. mejora, pero no queda completa porque persisten bloqueos manuales.

Bloqueos principales:

- `agreements/00000000-0000-0000-0000-000000000202`: `APROBACION_CUENTAS` sin `entity_id` o `body_id`. El contenido parece corresponder a una filial SLU, no a ARGA Seguros.
- `agreements/00000000-0000-0000-0000-000000000203`: `NOMBRAMIENTO_CESE` sin `entity_id` o `body_id` y sin plantilla activa compatible. El contenido parece corresponder a una filial SL, no a ARGA Seguros.

Warnings principales:

- 4 reuniones de ARGA Seguros sin `censo_snapshot`, no reparadas por falta de fuente canonica en `condiciones_persona`.
- Varios acuerdos `APROBACION_POLITICA` sin plantilla activa compatible.
- Certificacion legacy `ff224b50-c2cb-5d5f-ad88-90e7ba6cf98c` sin `authority_evidence_id`.

### Actualizacion posterior 2026-05-06/07

Este diagnostico global quedo superado para ARGA Seguros S.A. por el carril especifico de golden path documentado en:

- `docs/superpowers/plans/2026-05-06-arga-seguros-golden-path-consolidation.md`
- `docs/superpowers/plans/2026-05-07-secretaria-carril-memoria-avances.md`

Resultado posterior para ARGA:

- `Completa`: 1.
- `blocking`: 0.
- `warnings`: 0.
- Acuerdos legacy `...0202` y `...0203` retirados del golden path ARGA y reasignados a sociedades compatibles.
- Certificacion `ff224b50-c2cb-5d5f-ad88-90e7ba6cf98c` vinculada a authority evidence vigente.
- Ficha societaria endurecida y verificada por E2E.

El criterio de este documento sigue vigente para el resto de sociedades: no ejecutar reparacion global destructiva; cerrar sociedad por sociedad con fuente canonica y plan/apply idempotente.

## Decisiones pendientes

P0 - Scope legacy ARGA:

- Decidir si los acuerdos `...0202` y `...0203` se mueven a sus filiales reales, se archivan/quarantinan fuera del golden path o se completan manualmente con organo inequívoco.

P0 - Censos de consejo/comisiones:

- Cargar `condiciones_persona` canonicas para las reuniones sin censo o marcar dichas reuniones como historicas/reference-only.

P1 - Plantillas:

- Resolver compatibilidad de `APROBACION_POLITICA` mediante plantilla activa, mapping de materia o archivado de los acuerdos legacy.

P1 - Certificaciones legacy:

- Vincular `authority_evidence_id` solo cuando exista certificante y organo inequívoco.

## Criterio operativo

No se debe ejecutar una reparacion global destructiva. A partir de este punto, el sistema ya agoto las reparaciones seguras. Lo pendiente debe cerrarse sociedad por sociedad, con decision funcional expresa por cada dato ambiguo.

## Verificacion

- `db:check-target`: pass.
- `tsc --noEmit`: pass.
- `--all --plan`: pass.
- `--all --apply-safe`: pass.
- `--all --plan` post-aplicacion: pass, sin mutaciones seguras pendientes.

No se han guardado secretos en este documento.
