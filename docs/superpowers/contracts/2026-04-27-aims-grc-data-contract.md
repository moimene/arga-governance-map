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
