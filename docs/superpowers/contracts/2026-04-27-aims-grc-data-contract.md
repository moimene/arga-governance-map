# 2026-04-27 — Contrato de datos AIMS-GRC

## Proposito

Permitir que AIMS 360 y GRC Compass avancen de forma consistente mientras se sanea la coexistencia entre modelos legacy, backbone nuevo y contratos compartidos con Secretaria.

Este contrato cubre el carril conjunto **AIMS-GRC** porque ambos comparten evidencia, controles, riesgos, eventos materiales y potencial escalado a organos de gobierno.

## Estado rector

- AIMS legacy `ai_*` y backbone `aims_*` coexisten.
- GRC legacy operativo y backbone `grc_*` coexisten.
- `governance_module_events` y `governance_module_links` existen como backbone de integracion, pero los writes quedan sujetos a contrato y pruebas.
- `000049_grc_evidence_legal_hold` esta en HOLD absoluto para schema.
- El carril puede avanzar en UI, docs, tests y hooks contra tablas confirmadas.

## Ownership

| Area | Owner | Tablas/familias | Consumidores |
|---|---|---|---|
| Inventario IA legacy | AIMS | `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents` | Shell, GRC, Secretaria read-only |
| Backbone AIMS | AIMS | `aims_*` | Shell, GRC, Secretaria via events/links |
| GRC operativo legacy | GRC | `risks`, `controls`, `incidents`, `findings`, `action_plans`, `evidences`, `obligations` | Shell, Secretaria, AIMS read-only |
| Backbone GRC | GRC | `grc_*` | Shell, AIMS, Secretaria via events/links |
| Integracion | Plataforma | `governance_module_events`, `governance_module_links` | Todos |
| Evidencia compartida | Plataforma + owner del acto | `evidence_bundles`, `evidence_bundle_artifacts`, `audit_log`, storage | Todos segun permisos |

## Regla legacy/backbone

Cada pantalla o hook AIMS-GRC debe declarar una de estas posturas:

- `legacy_read`: lee `ai_*` o GRC legacy sin mutar backbone.
- `legacy_write`: mantiene compatibilidad demo con legacy y lo declara.
- `backbone_read`: lee `aims_*` o `grc_*` confirmadas.
- `backbone_write`: solo permitido si la tabla esta en Cloud, tipos, RLS y tests.
- `bridge_read`: compone legacy/backbone sin escribir.
- `migration_candidate`: requiere decision antes de implementacion.

No se permite mezclar legacy y backbone de forma silenciosa.

## Trabajo permitido ahora

- Mejorar UX AIMS/GRC.
- Crear dashboards y read models con source posture visible en docs.
- Crear tests de contrato.
- Crear adapters read-only.
- Documentar mapeos legacy/backbone.
- Preparar prompts o specs para futura migracion.

## Trabajo bloqueado ahora

- Aplicar `000049_grc_evidence_legal_hold`.
- Crear nuevas tablas/columnas AIMS/GRC sin gate.
- Regenerar tipos por este carril.
- Cambiar RLS/RPC/storage.
- Declarar legal hold/evidence como backbone unico probatorio.
- Escribir `governance_module_events/links` desde UI sin contrato y tests.

## Evidence/legal hold

El carril AIMS-GRC puede mostrar evidencia en modo demo si declara el nivel:

| Nivel | Significado | Permitido en UI |
|---|---|---|
| `REFERENCE` | Link o referencia documental sin bundle completo | Mostrar como referencia |
| `BUNDLE_STUB` | Bundle o manifest stub sin cadena completa | Mostrar como demo/stub |
| `AUDITED_BUNDLE` | Hash + bundle + audit + owner record | Mostrar como evidencia verificable |
| `LEGAL_HOLD_READY` | Audited bundle + retention/legal hold contract | Mostrar como sujeto a legal hold |

Hasta levantar `000049`, el nivel maximo por defecto es `AUDITED_BUNDLE` solo si el flujo concreto lo prueba. Si no, debe marcarse como `REFERENCE` o `BUNDLE_STUB`.

## Eventos hacia Secretaria

Eventos candidatos:

| Evento | Source | Target | Criterio |
|---|---|---|---|
| `GRC_INCIDENT_MATERIAL` | GRC | Secretaria | Incidente critico que requiere conocimiento o decision de organo |
| `GRC_FINDING_BOARD_ESCALATION` | GRC | Secretaria | Hallazgo critico o vencido que requiere agenda |
| `AIMS_TECHNICAL_FILE_GAP` | AIMS | GRC | Gap AI Act/ISO que exige control o plan |
| `AIMS_INCIDENT_MATERIAL` | AIMS | GRC/Secretaria | Incidente IA con riesgo material o regulatorio |

Reglas:

- GRC/AIMS emiten evento o propuesta.
- Secretaria decide si crea agenda, convocatoria o expediente.
- El estado societario solo lo muta Secretaria.

## Consumo de evidencia Secretaria

AIMS-GRC pueden consumir evidencia de Secretaria cuando exista:

- `certifications.id`;
- `minutes.id`;
- `agreements.id`;
- `evidence_bundle_id` o manifest equivalente;
- hash/storage/audit verificable.

Uso permitido:

- enlazar a control, hallazgo, incidente o expediente tecnico;
- mostrar en dashboard;
- incluir en reporting.

Uso prohibido:

- modificar certificacion/acta;
- recalcular validez societaria;
- copiar el documento como evidencia propietaria distinta sin link.

## Gate para levantar `000049`

Antes de mover `000049_grc_evidence_legal_hold`:

- contrato evidence/legal hold completo;
- lista de tablas afectadas;
- RLS/RPC/storage revisados;
- migracion no destructiva;
- tests schema;
- advisor security revisado;
- tipos regenerados;
- cierre con `tsc`, `lint`, `test`, `build`.

## Data contract de cierre AIMS-GRC

```md
Data contract:
- Screen/hook:
- Posture: legacy_read | legacy_write | backbone_read | backbone_write | bridge_read | migration_candidate
- Tables used:
- Source of truth:
- Migration required:
- Types affected:
- RLS/RPC/storage affected:
- Event/link contract:
- Evidence level: REFERENCE | BUNDLE_STUB | AUDITED_BUNDLE | LEGAL_HOLD_READY
- Parity risk:

Verification:
- db:check-target:
- Typecheck:
- Lint:
- Tests:
- Build:
```

## Cierre 2026-04-30 — P0 readiness no_schema

Se ha completado una tanda P0 de UX ejecutiva para AIMS-GRC sin mover schema:

- GRC Compass añade `Readiness ejecutivo P0` con seis superficies realmente conectadas en frontend: GDPR/canal interno vía vistas GDPR, DORA/ICT, Cyber, ERM/Auditoría, Trabajo/Alertas/Excepciones y Packs país.
- AI Governance añade `AIMS P0 readiness` con dominios: inventario, evaluaciones AI Act, incidentes, controles derivados, evidencias operativas y migración `ai_* -> aims_*`.
- Ambos paneles usan contratos locales puros y no crean queries, tablas, columnas, RPC, RLS, storage ni tipos nuevos.
- TPRM y Penal/Anticorrupción salen del readiness principal porque no tienen pantalla GRC específica conectada; quedan como backlog visible `No conectado ahora`. AIMS queda marcado como `legacy-ai` hasta activar backbone `aims_*`.
- Evidence/legal hold sigue fuera de la tanda: `000049` permanece en HOLD y `finalEvidence=false`.

Data contract:

- Screen/hook: `/grc`, `/ai-governance`.
- Posture: `legacy_read` + contrato local derivado.
- Tables used: GRC dashboard mantiene queries existentes; AIMS dashboard mantiene `ai_systems`, `ai_risk_assessments`, `ai_incidents`.
- Source of truth: Cloud para datos vivos existentes; contrato local para readiness P0.
- Migration required: no.
- Types affected: no.
- RLS/RPC/storage affected: no.
- Event/link contract: solo visible como postura; sin writes.
- Evidence level: `REFERENCE` / operativa demo; no evidencia final productiva.
- Parity risk: bajo para UX actual; medio para writes futuros a `governance_module_events` / `governance_module_links`.

Verification:

- `bun run db:check-target`: pass.
- `bun test src/lib/grc/__tests__/dashboard-readiness.test.ts src/lib/aims/__tests__/readiness.test.ts src/lib/arga-console/__tests__/platform-readiness.test.ts`: pass, 11/11.
- `bunx eslint` focalizado sobre dashboards, contratos y smoke: pass.
- `bunx tsc --noEmit --pretty false`: pass.
- `PLAYWRIGHT_PORT=5189 bunx playwright test e2e/16-sanitization-smoke.spec.ts e2e/10-grc.spec.ts --project=chromium --reporter=list`: pass, 11/11.

## Cierre 2026-05-02 — Slice 1 AIMS standalone y handoffs read-only

Slice 1 avanza solo el carril **AIMS 360**. No fusiona AIMS con GRC ni con Secretaria, no aplica migraciones y no escribe contratos compartidos.

### Mapa de pantallas AIMS conectadas

| Pantalla/ruta | Owner | Hooks usados | Tablas usadas | Postura `ai_*` / `aims_*` | Fuente de verdad | Operacion | Handoffs candidatos |
|---|---|---|---|---|---|---|---|
| `/ai-governance` | AIMS 360 | `useAiSystemsList`, `useAiIncidentsList`, `useAllAssessments` | `ai_systems`, `ai_incidents`, `ai_risk_assessments` | `legacy_read`; no lee `aims_*` | Supabase Cloud legacy `ai_*` + contrato local `src/lib/aims/readiness.ts` | Read-only | Navegacion AIMS; referencia Secretaria con `evidence=REFERENCE` |
| `/ai-governance/sistemas` | AIMS 360 | `useAiSystemsList` | `ai_systems` | `legacy_read`; `aims_*` candidato futuro | `ai_systems` | Read-only | Drilldown owner AIMS |
| `/ai-governance/sistemas/:id` | AIMS 360 | `useAiSystemById`, `useAssessmentsBySystem`, `useComplianceChecksBySystem`, `useAiIncidentsBySystem` | `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents` | `legacy_read`; no mezcla backbone | `ai_systems` como owner; hijas `ai_*` por `system_id` | Read-only | Referencia contextual a evaluaciones/incidentes AIMS |
| `/ai-governance/evaluaciones` | AIMS 360 | `useAllAssessments` | `ai_risk_assessments`, `ai_systems` | `legacy_read` tenant-scoped por join a `ai_systems` | `ai_risk_assessments` | Read-only | `AIMS_TECHNICAL_FILE_GAP` -> `/grc/risk-360` |
| `/ai-governance/incidentes` | AIMS 360 | `useAiIncidentsList` | `ai_incidents`, `ai_systems` | `legacy_read` | `ai_incidents` | Read-only | `AIMS_INCIDENT_MATERIAL` -> `/grc/incidentes`; `AIMS_INCIDENT_MATERIAL` -> `/secretaria/reuniones/nueva` |

### Contrato de handoffs Slice 1

| Handoff | Source owner | Target owner | Ruta actual | Evento canonico | Evidencia | Mutacion |
|---|---|---|---|---|---|---|
| Gap expediente tecnico -> control/workflow GRC | AIMS 360 | GRC Compass | `/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=:id` | `AIMS_TECHNICAL_FILE_GAP` | `NOT_EVIDENCE` | Solo route handoff |
| Incidente IA material -> GRC | AIMS 360 | GRC Compass | `/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=:id` | `AIMS_INCIDENT_MATERIAL` | `NOT_EVIDENCE` | Solo route handoff |
| Incidente IA material -> Secretaria | AIMS 360 | Secretaria Societaria | `/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=:id` | `AIMS_INCIDENT_MATERIAL` | `NOT_EVIDENCE` | Solo route handoff; Secretaria decide agenda/acto |
| Certificacion/acuerdo Secretaria -> referencia AIMS | Secretaria Societaria | AIMS 360 | `/secretaria/actas?source=aims&handoff=SECRETARIA_CERTIFICATION_REFERENCE&evidence=REFERENCE` | `SECRETARIA_CERTIFICATION_ISSUED` | `REFERENCE` explicito | Solo referencia; AIMS no recalcula validez societaria |

Reglas aplicadas:

- AIMS no crea riesgos, controles, action plans ni incidentes GRC directamente.
- AIMS no crea acuerdos, actas, certificaciones ni reuniones de Secretaria.
- No hay writes a `governance_module_events` ni `governance_module_links`.
- `000049` sigue en HOLD; ninguna pantalla declara evidencia/legal hold como final productiva.
- `aims_*` sigue siendo backbone candidato por pantalla/workflow, no fuente usada por las pantallas conectadas actuales.

Data contract:

- Screen/hook: `/ai-governance`, `/ai-governance/sistemas`, `/ai-governance/sistemas/:id`, `/ai-governance/evaluaciones`, `/ai-governance/incidentes`; hooks `useAiSystems*`, `useAiAssessments*`, `useAiIncidents*`.
- Posture: `legacy_read` para todas las pantallas conectadas.
- Tables used: `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents`.
- Source of truth: Supabase Cloud legacy `ai_*`; contrato local `src/lib/aims/readiness.ts` para mapa/readiness.
- Migration required: no.
- Types affected: no.
- RLS/RPC/storage affected: no.
- Event/link contract: rutas read-only alineadas con `AIMS_TECHNICAL_FILE_GAP`, `AIMS_INCIDENT_MATERIAL`, `SECRETARIA_CERTIFICATION_ISSUED`; sin writes.
- Evidence level: `NOT_EVIDENCE` para gaps/incidentes; `REFERENCE` explicito para referencias Secretaria -> AIMS.
- Parity risk: bajo para UI actual; medio para futuros writes a `governance_module_events` / `governance_module_links`; medio para migracion `ai_* -> aims_*`.

Verification:

- `bun run db:check-target`: pass.
- `bun test src/lib/aims/**`: pass, 5/5.
- `bun test src/lib/arga-console/__tests__/platform-readiness.test.ts`: pass, 6/6.
- `bunx tsc --noEmit --pretty false`: pass.
- `bun run lint`: pass con warnings existentes; 0 errores.
- `bun run build`: pass con warnings existentes de Browserslist/chunk size.
- `PLAYWRIGHT_PORT=5192 bunx playwright test e2e/16-sanitization-smoke.spec.ts --project=chromium --reporter=list`: pass, 4/4.

## Slice 1 GRC 2026-05-02 - Screen posture no_schema

Documento rector:

- `docs/superpowers/contracts/2026-05-02-grc-screen-posture-contract.md`

Resultado:

- GRC declara 27 pantallas/rutas frontend con owner, tablas/hooks, postura legacy frente a `grc_*`, fuente de verdad, modo de mutacion y handoffs candidatos.
- Solo `/grc/incidentes/nuevo` queda como `owner-write`, limitado a la tabla GRC-owned `incidents`.
- Las rutas placeholder (`thresholds`, `DPO`, `SOC`, `audit program`) quedan como `backlog_placeholder`.
- TPRM y Penal/Anticorrupcion permanecen fuera del mapa conectado y solo aparecen como backlog no conectado.
- AIMS -> GRC queda implementado como navegacion read-only hacia `/grc/risk-360` o `/grc/incidentes`.
- GRC -> Secretaria queda implementado como navegacion read-only hacia `/secretaria/reuniones/nueva`; Secretaria decide cualquier acto formal.
- Sin writes a `governance_module_events` ni `governance_module_links`.

Data contract:

- Screen/hook: `src/lib/grc/dashboard-readiness.ts`, `/grc`, `/grc/risk-360`, `/grc/incidentes`, `/grc/incidentes/:id`, `/grc/m/audit/operate/findings`, AIMS evaluaciones/incidentes handoff links.
- Posture: `legacy_read`, `legacy_write`, `tgms_handoff`, `local_demo_read`, `backlog_placeholder`.
- Tables used: `risks`, `incidents`, `regulatory_notifications`, `exceptions`, `action_plans`, `findings`, `obligations`, `country_packs`, `pack_rules`, `grc_module_nav`, `bcm_bia`, `bcm_plans`, `vulnerabilities`, target route `policies`.
- Source of truth: Cloud operational GRC legacy tables; local constants for GDPR demo; no `grc_*` source of truth adopted.
- Migration required: no.
- Types affected: local TypeScript contract only; no Supabase type regeneration.
- RLS/RPC/storage affected: no.
- Event/link contract: route-only candidates for `GRC_INCIDENT_MATERIAL`, `GRC_FINDING_BOARD_ESCALATION`, `AIMS_TECHNICAL_FILE_GAP`, `AIMS_INCIDENT_MATERIAL`.
- Evidence level: `REFERENCE`; no final evidence or legal hold.
- Parity risk: low for UI/read-only; medium for future shared event/link writes.
