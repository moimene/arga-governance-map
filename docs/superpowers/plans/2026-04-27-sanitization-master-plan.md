# 2026-04-27 — Plan maestro de sanitizacion operativa Supabase

## Proposito

Este plan convierte la sanitizacion Supabase en una disciplina operativa para que los dos carriles principales, **AIMS-GRC** y **Secretaria Societaria**, sigan avanzando sin crear drift silencioso entre Cloud, migraciones locales, tipos generados, hooks, UI, storage, RLS/RPC y evidencia.

No es un freeze funcional del producto. Es un gate de integracion: el producto puede avanzar, pero cada avance debe declarar su contrato de datos y su verificacion.

## Estado rector

- Supabase Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`) es la fuente de verdad.
- El carril Supabase base quedo cerrado el 2026-04-27 con:
  - `20260427000100` / `supabase_sanitization_gate`
  - `20260427000101` / `supabase_sanitization_advisors`
- El carril vivo de control del entorno queda en `docs/superpowers/plans/2026-04-29-supabase-environment-control-lane.md`.
- El snapshot de paridad vigente queda en `docs/superpowers/plans/2026-04-29-supabase-parity-inventory.md`.
- El smoke funcional vigente queda en `docs/superpowers/plans/2026-04-29-lane-smoke-verification.md`.
- Tipos generados actuales incluyen `aims_*`, `grc_*`, `governance_module_*`, trazas de reglas y lifecycle de rule packs.
- El advisor de seguridad restante es `auth_leaked_password_protection`, configuracion Auth fuera de SQL.
- Los advisors de performance quedan en backlog salvo que bloqueen demo o creen riesgo funcional.
- `000049_grc_evidence_legal_hold` permanece en HOLD absoluto para schema hasta levantarlo explicitamente.

## Decisiones de gobierno

1. **Cloud primero.** No se toma una migracion local como verdad hasta comprobar Cloud.
2. **No `db push` para reconciliar.** Los cambios Supabase se aplican como migraciones no destructivas y acotadas.
3. **Tipos despues de paridad.** `supabase/functions/_types/database.ts` se regenera solo cuando Cloud/local estan claros.
4. **Carriles vivos, schema controlado.** AIMS-GRC y Secretaria pueden avanzar en UI, docs, tests y hooks contra tablas confirmadas.
5. **Sin modelos sombra.** Secretaria no duplica GRC/AIMS; GRC no posee expedientes societarios; AIMS no posee ledger GRC.
6. **Evidencia final requiere cadena completa.** No se declara evidencia definitiva sin storage object, hash, bundle, audit linkage y contrato de retencion/legal hold.
7. **Codex queda como owner de integracion.** Cualquier cambio en migraciones, RLS, RPC, storage o tipos pasa por este plan.

## Carriles

| Carril | Puede avanzar | Gateado |
|---|---|---|
| AIMS-GRC | UI, docs, tests, hooks contra tablas confirmadas, mapeo legacy/backbone, dashboards demo | Migraciones nuevas, `000049`, RLS/RPC/storage, tipos generados |
| Secretaria | Flujos UX, gestor documental, reuniones, acuerdos, rule packs, doc-gen, tests, e2e | Nuevas tablas sin contrato, evidence final sin bundle/hash/audit, cambios storage/RPC no coordinados |
| Plataforma compartida | Docs, contratos, probes, read models confirmados | `governance_module_events/links` writes si no hay contrato y tests |

## Fase 0 — Baseline obligatorio

Antes de tocar un carril:

```bash
bun run db:check-target
```

Registrar en el cierre:

- proyecto Supabase objetivo;
- si el cambio toca Cloud, migraciones, tipos, RLS/RPC o storage;
- si hay freeze activo;
- si el trabajo es solo UI/docs/tests.

Salida esperada:

```md
Baseline:
- Supabase target:
- Workstream:
- Scope:
- Schema touch: yes/no
- Types touch: yes/no
- Storage/RPC/RLS touch: yes/no
- Freeze dependency:
```

## Fase 1 — Inventario por carril

### AIMS-GRC

Inventariar por pantalla y hook:

- tablas legacy `ai_*`;
- tablas backbone `aims_*`;
- tablas GRC legacy operativas;
- tablas backbone `grc_*`;
- `governance_module_events` y `governance_module_links`;
- `evidence_bundles`, `audit_log`, retention/legal hold.

Cada pantalla debe declarar:

- si consume legacy, backbone o ambos;
- si escribe datos;
- si necesita migracion;
- si puede funcionar en modo demo read-only.

### Secretaria

Inventariar por flujo:

- Acuerdo 360;
- reuniones y agenda;
- convocatorias y trazas;
- actas/certificaciones;
- plantillas y gestor documental;
- rule packs y overrides;
- pactos parasociales;
- storage documental;
- evidence bundle y audit trail.

Cada flujo debe declarar:

- tablas owner;
- tablas compartidas;
- fuente de verdad;
- fallback demo;
- riesgos de paridad.

## Fase 2 — Contratos de datos

Los contratos vivos de este plan son:

- `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md`
- `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md`
- `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md`

Los prompts operativos para reactivar agentes/carriles viven en:

- `docs/superpowers/plans/2026-04-27-sanitization-agent-prompts.md`

Todo cambio que toque AIMS-GRC, Secretaria o integracion debe cerrar con:

```md
Data contract:
- Tables used:
- Source of truth: Cloud | local pending | legacy | generated types only | none
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Cross-module contracts:
- Parity risk:
```

## Fase 3 — Paridad Cloud/local/types

Secuencia obligatoria:

1. Leer Cloud via MCP o SQL controlado.
2. Comparar migraciones locales.
3. Clasificar cada objeto:
   - `applied_and_tracked`
   - `materialized_drift`
   - `local_pending`
   - `hold`
   - `obsolete`
4. Aplicar solo migracion no destructiva y acotada si procede.
5. Registrar migracion remota.
6. Regenerar tipos.
7. Correr `tsc`.

No se permite aplicar una tanda amplia de migraciones locales por conveniencia.

## Fase 4 — Sanitizacion AIMS-GRC

Objetivo: permitir avance consistente sin mover schema bajo el resto del sistema.

Permitido:

- UI y navegacion AIMS/GRC;
- docs y PRD;
- tests unitarios y e2e;
- hooks contra tablas confirmadas en tipos;
- dashboards que declaren fuente legacy o backbone;
- adapters read-only entre legacy/backbone con contrato explicito.

Bloqueado hasta nuevo gate:

- `000049_grc_evidence_legal_hold`;
- nuevas tablas o columnas;
- RLS/RPC/storage;
- cambios en generated types;
- declarar evidence/legal hold como backbone unico probatorio.

Gate de salida AIMS-GRC:

- mapeo legacy/backbone por pantalla;
- contrato de eventos hacia Secretaria;
- contrato de consumo de evidencia de Secretaria;
- decision escrita sobre `000049`;
- tests y build limpios.

## Fase 5 — Sanitizacion Secretaria

Objetivo: estabilizar el carril mas avanzado funcionalmente sin que absorba GRC/AIMS.

Permitido:

- mejorar flujos operativos;
- completar Acuerdo 360;
- refinar gestor documental;
- usar rule packs ya confirmados;
- e2e golden path;
- documentar puentes JSON demo.

Bloqueado salvo gate explicito:

- crear nuevo schema no coordinado;
- escribir eventos cross-module sin contrato;
- tratar documentos como evidencia final sin bundle/hash/audit/storage;
- introducir dependencias de AIMS/GRC no confirmadas.

Gate de salida Secretaria:

- Cloud/local/types coherentes para tablas usadas;
- contrato de Acuerdo 360 documentado;
- contrato documental/QTSP/evidence documentado;
- e2e Secretaria golden path;
- tests, tsc, lint y build limpios.

## Fase 6 — Integracion cross-module

Solo despues de los contratos:

- GRC incidente material -> propuesta de agenda Secretaria.
- AIMS gap tecnico -> workflow/control GRC.
- Secretaria certificacion emitida -> evidencia consumible por GRC/AIMS.
- Board Pack -> lectura compuesta, sin mutar owners.

Regla: el modulo owner muta su estado. El shell o consola solo compone, enlaza y enruta.

## Verificacion obligatoria

Para declarar cerrado un bloque:

```bash
bun run db:check-target
bunx tsc --noEmit
bun run lint
bun run test
bun run build
```

Cuando aplique:

- probes schema/RPC especificos;
- Supabase advisors triaged;
- e2e focalizado del carril;
- contrato actualizado.

## Definition of Done

Un carril esta sanitizado cuando:

- no depende de objetos Cloud no comprobados;
- no mezcla legacy/backbone sin declararlo;
- no escribe fuera de su ownership;
- no introduce schema sin migracion no destructiva;
- no requiere tipos generados obsoletos;
- no llama evidencia final a artefactos incompletos;
- deja docs, contrato y verificacion.

## Registro de riesgos activos

| Riesgo | Estado | Mitigacion |
|---|---|---|
| `000049_grc_evidence_legal_hold` | HOLD | No mover hasta contrato evidence/legal hold completo |
| AIMS legacy `ai_*` vs backbone `aims_*` | Abierto | Mapear pantalla por pantalla |
| GRC legacy vs `grc_*` | Abierto | Mapear workflows y owner tables |
| `governance_module_events/links` | Requiere contrato | No writes hasta tests/probes |
| Evidence final | Parcial | Exigir storage/hash/bundle/audit/retention |
| Performance advisors | Backlog | No arreglar masivamente durante sanitizacion funcional |

## Cierre obligatorio de cada tarea

```md
Documentation and memory:
- Project docs updated:
- Memory key:
- Stable lesson recorded:
- No secrets stored: yes/no

Data contract:
- Tables used:
- Source of truth:
- Migration required:
- Types affected:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint:
- Tests:
- Build:
- e2e:
```
