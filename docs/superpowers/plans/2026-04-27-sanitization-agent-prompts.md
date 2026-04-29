# 2026-04-27 — Prompts para continuar carriles bajo sanitizacion

## Aviso comun para todos los carriles

Usa este aviso antes de reactivar cualquier agente o hilo de trabajo:

```md
Aviso rector — Sanitizacion operativa TGMS

El carril puede seguir avanzando funcionalmente, pero queda sujeto al plan maestro de sanitizacion:

- Plan: `docs/superpowers/plans/2026-04-27-sanitization-master-plan.md`
- Contrato cross-module: `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md`
- Contrato AIMS-GRC: `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md`
- Contrato Secretaria: `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md`

Reglas no negociables:

1. Cloud Supabase `governance_OS` es fuente de verdad.
2. No usar `db push`.
3. No aplicar migraciones, regenerar tipos, tocar RLS/RPC/storage ni mover schema sin aprobacion explicita de Codex/integracion.
4. `000049_grc_evidence_legal_hold` sigue en HOLD absoluto hasta que Codex levante el freeze.
5. Cada cambio debe cerrar con Data contract y Verification.
6. No duplicar modelos: Secretaria no absorbe GRC/AIMS; GRC no posee expedientes societarios; AIMS no posee ledger GRC.
7. No declarar evidencia final si no hay storage/hash/bundle/audit/retention o si el nivel real es solo stub/referencia.

Cierre obligatorio:

Data contract:
- Tables used:
- Source of truth:
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint:
- Tests:
- Build:
- e2e:

Si el trabajo es solo UI/docs/tests, decirlo explicitamente. Si descubres necesidad de schema, detenerte y devolver una propuesta de migracion no destructiva, no aplicarla.
```

## Prompt para carril AIMS-GRC

```md
Carril AIMS-GRC — Continuacion bajo sanitizacion operativa

Contexto:

El carril AIMS-GRC puede seguir avanzando con consistencia, pero no puede mover schema sin gate. La prioridad ahora es consolidar producto y contratos, no crear drift nuevo.

Lee primero:

- `docs/superpowers/plans/2026-04-27-sanitization-master-plan.md`
- `docs/superpowers/contracts/2026-04-27-aims-grc-data-contract.md`
- `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md`
- `docs/superpowers/plans/2026-04-27-ruflo-supabase-architecture-mission.md`

Alcance permitido:

- UI AIMS/GRC.
- Docs, PRD, specs, tests y e2e.
- Hooks contra tablas ya confirmadas en Cloud y tipos generados.
- Adaptadores read-only legacy/backbone.
- Mapeo por pantalla de `ai_*` legacy, `aims_*`, GRC legacy y `grc_*`.
- Dashboards o vistas que declaren claramente su source posture.

Bloqueado:

- Aplicar o modificar `000049_grc_evidence_legal_hold`.
- Crear nuevas tablas/columnas.
- Regenerar tipos Supabase.
- Cambiar RLS/RPC/storage.
- Escribir `governance_module_events` o `governance_module_links` sin contrato y tests.
- Presentar evidence/legal hold como backbone probatorio unico.

Tarea inmediata recomendada:

1. Inventariar pantallas/hooks AIMS-GRC por postura:
   - `legacy_read`
   - `legacy_write`
   - `backbone_read`
   - `backbone_write`
   - `bridge_read`
   - `migration_candidate`
2. Detectar cualquier mezcla silenciosa legacy/backbone.
3. Proponer ajustes UI/docs/tests sin tocar schema.
4. Si aparece necesidad de schema, parar y documentar propuesta no destructiva.

Formato de cierre obligatorio:

Data contract:
- Screen/hook:
- Posture:
- Tables used:
- Source of truth:
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Event/link contract:
- Evidence level:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint:
- Tests:
- Build:
- e2e:

Entrega esperada:

- Lista de pantallas/hooks inventariados.
- Riesgos P0/P1.
- Cambios realizados si son UI/docs/tests.
- Propuestas bloqueadas por schema, separadas y sin aplicar.
```

## Prompt para carril Secretaria

```md
Carril Secretaria — Continuacion bajo sanitizacion operativa

Contexto:

Secretaria es el carril funcional mas avanzado y puede seguir puliendo flujos de alto valor. La regla es no romper paridad Cloud/local/types y no absorber responsabilidades GRC/AIMS.

Lee primero:

- `docs/superpowers/plans/2026-04-27-sanitization-master-plan.md`
- `docs/superpowers/contracts/2026-04-27-secretaria-data-contract.md`
- `docs/superpowers/contracts/2026-04-27-cross-module-data-contract.md`
- `docs/superpowers/plans/2026-04-27-secretaria-supabase-cleanup-handoff.md`

Alcance permitido:

- UX y navegacion de Secretaria.
- Acuerdo 360.
- Convocatorias, reuniones, actas y certificaciones.
- Gestor documental y plantillas.
- Rule packs, trazabilidad y explicabilidad si usan objetos confirmados.
- Tests unitarios/e2e.
- Documentar puentes JSON demo o contratos transitorios.

Bloqueado salvo aprobacion explicita:

- Crear schema nuevo.
- Tocar RLS/RPC/storage.
- Regenerar tipos Supabase.
- Escribir eventos cross-module sin contrato.
- Declarar documentos como evidencia final sin storage/hash/bundle/audit.
- Crear modelos propios de GRC o AIMS dentro de Secretaria.

Tarea inmediata recomendada:

1. Inventariar flujos Secretaria:
   - Acuerdo 360
   - Convocatorias
   - Reuniones
   - Actas
   - Certificaciones
   - Gestor documental
   - Plantillas PRE
   - Board Pack
2. Para cada flujo, declarar tablas owner, tablas compartidas, fuente de verdad, nivel de evidencia y riesgo de paridad.
3. Avanzar solo sobre UI/docs/tests o hooks contra tablas confirmadas.
4. Si falta schema, devolver propuesta no destructiva sin aplicarla.

Formato de cierre obligatorio:

Data contract:
- Flow:
- Tables used:
- Source of truth:
- Owner records:
- Shared records:
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Evidence level:
- Cross-module contracts:
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint:
- Tests:
- Build:
- e2e:

Entrega esperada:

- Lista de flujos revisados.
- Cambios realizados.
- Flujos que quedan listos para demo.
- Bloqueos por schema/evidencia, separados y sin aplicar.
```

## Prompt para integrador Codex

```md
Integracion Codex — Cierre y arbitraje de sanitizacion

Objetivo:

Integrar avances de AIMS-GRC y Secretaria sin perder paridad Supabase ni ownership de modulos.

Responsabilidades:

1. Revisar cierres de cada carril.
2. Confirmar que todo cambio incluye Data contract y Verification.
3. Bloquear migraciones/tipos/RLS/RPC/storage no autorizados.
4. Mantener `000049_grc_evidence_legal_hold` en HOLD hasta que cumpla el gate.
5. Consolidar docs y memoria.
6. Ejecutar verificacion final cuando haya cambios de codigo:
   - `bun run db:check-target`
   - `bunx tsc --noEmit`
   - `bun run lint`
   - `bun run test`
   - `bun run build`

Criterio:

Si un carril aporta valor funcional sin mover schema, integrarlo. Si requiere schema, aislarlo como propuesta no destructiva y decidir en bloque Supabase.
```
