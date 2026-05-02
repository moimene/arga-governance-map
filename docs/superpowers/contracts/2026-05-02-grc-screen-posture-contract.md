# 2026-05-02 - GRC Compass screen posture contract

## Proposito

Cerrar Slice 1 del carril GRC sin schema: inventariar cada pantalla frontend GRC conectada, declarar owner, tablas/hooks, postura legacy frente a `grc_*`, fuente de verdad, modo de mutacion y handoffs read-only.

## Reglas de este corte

- Sin migraciones, columnas, tablas, RLS, RPC, storage ni regeneracion de tipos.
- `000049_grc_evidence_legal_hold` permanece en HOLD.
- GRC no muta registros de Secretaria ni AIMS.
- AIMS no crea riesgos, controles ni planes GRC; solo navega a intake owner.
- Secretaria decide si una propuesta GRC se convierte en agenda, reunion, acuerdo, acta o certificacion.
- Sin writes a `governance_module_events` ni `governance_module_links`.
- TPRM y Penal/Anticorrupcion permanecen como backlog no conectado.

## Handoffs read-only

| ID | Source | Target | Ruta owner | Evento contractual | Mutacion |
|---|---|---|---|---|---|
| `grc-incident-secretaria` | GRC incident | Secretaria | `/secretaria/reuniones/nueva?source=grc&event=GRC_INCIDENT_MATERIAL` | `GRC_INCIDENT_MATERIAL` | Route-only |
| `grc-finding-secretaria` | GRC finding | Secretaria | `/secretaria/reuniones/nueva?source=grc&event=GRC_FINDING_BOARD_ESCALATION` | `GRC_FINDING_BOARD_ESCALATION` | Route-only |
| `aims-gap-grc` | AIMS assessment gap | GRC | `/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP` | `AIMS_TECHNICAL_FILE_GAP` | Route-only |
| `aims-incident-grc` | AIMS incident | GRC | `/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL` | `AIMS_INCIDENT_MATERIAL` | Route-only |

## Screen map

| Pantalla/ruta | Owner | Tablas/hooks | Postura legacy vs `grc_*` | Fuente de verdad | Modo | Handoff |
|---|---|---|---|---|---|---|
| `/grc` | GRC | `risks`, `incidents`, `exceptions`, `regulatory_notifications`; `useGrcKpis` | `legacy_read`; `grc_*` candidato | Cloud operational GRC + contrato local | Read-only | AIMS->GRC, GRC->Secretaria |
| `/grc/risk-360` | GRC | `risks`, `obligations`, `findings`; `useRisks` | `legacy_read`; `grc_*` candidato | `risks` | Read-only | AIMS gap -> GRC intake |
| `/grc/packs` | GRC | `country_packs`, `pack_rules`; `useCountryPacks` | `legacy_read` | `country_packs`, `pack_rules` | Read-only | No |
| `/grc/packs/:countryCode` | GRC | `country_packs`, `pack_rules`, `incidents`, `risks`, `regulatory_notifications`; `useCountryPackDetail` | `legacy_read` | Pack + KPIs GRC existentes | Read-only | No |
| `/grc/incidentes` | GRC | `incidents`, `obligations`, `regulatory_notifications`; `useIncidents` | `legacy_read` | `incidents` | Read-only | AIMS incident -> GRC intake; GRC incident -> Secretaria |
| `/grc/incidentes/nuevo` | GRC | `incidents`; `useCreateIncident` | `legacy_write` owner | `incidents` | Owner-write | No |
| `/grc/incidentes/:id` | GRC | `incidents`, `obligations`, `regulatory_notifications`; `useIncident` | `legacy_read` | `incidents` + notifications | Read-only | GRC incident -> Secretaria |
| `/grc/mywork` | GRC | `incidents`, `action_plans`, `findings`, `exceptions`; local `useMyWork` | `legacy_read` | Cola derivada GRC | Read-only | No |
| `/grc/alertas` | GRC | `regulatory_notifications`, `incidents`, `bcm_plans`, `exceptions`, `obligations`; local `useAlerts` | `legacy_read` | Deadlines GRC | Read-only | GRC incident -> Secretaria |
| `/grc/excepciones` | GRC | `exceptions`, `obligations`; local `useExceptions` | `legacy_read` | `exceptions` | Read-only; boton write deshabilitado | No |
| `/grc/m/:moduleId` | GRC | `grc_module_nav`; `useModuleNav` | `legacy_read` nav | `grc_module_nav` | Read-only | No |
| `/grc/m/:moduleId/dashboard` | GRC | `grc_module_nav`; `useModuleNav` | `legacy_read` nav | `grc_module_nav` | Read-only | No |
| `/grc/m/dora/operate/incidents` | GRC | `incidents`, `obligations`, `regulatory_notifications`; `useIncidents("DORA")` | `legacy_read` | `incidents` filtered DORA | Read-only | GRC incident -> Secretaria |
| `/grc/m/dora/operate/bcm` | GRC | `bcm_bia`, `bcm_plans`; local `useBcm` | `legacy_read` | `bcm_bia`, `bcm_plans` | Read-only | No |
| `/grc/m/dora/operate/rto` | GRC | `bcm_bia`; local `useBia` | `legacy_read` | `bcm_bia` | Read-only | No |
| `/grc/m/dora/governance/policies` | GRC | Target `policies`; no local query | `tgms_handoff` | TGMS policy owner route | Read-only route | No |
| `/grc/m/dora/config/thresholds` | GRC | Ninguna | `backlog_placeholder` | No connected threshold table | Backlog | No |
| `/grc/m/gdpr/operate/ropa` | GRC | Ninguna; constants locales | `local_demo_read` | Demo local | Read-only | No |
| `/grc/m/gdpr/operate/dpias` | GRC | Ninguna; constants locales | `local_demo_read` | Demo local; AIMS sigue owner IA | Read-only | AIMS gap candidate |
| `/grc/m/gdpr/operate/dsars` | GRC | Ninguna; constants locales | `local_demo_read` | Demo local | Read-only | No |
| `/grc/m/gdpr/governance/dpo` | GRC | Ninguna | `backlog_placeholder` | No connected DPO workflow | Backlog | No |
| `/grc/m/cyber/operate/vulnerabilities` | GRC | `vulnerabilities`; local `useVulnerabilities` | `legacy_read` | `vulnerabilities` | Read-only | No |
| `/grc/m/cyber/operate/incidents` | GRC | `incidents`, `obligations`, `regulatory_notifications`; `useIncidents("CYBER")` | `legacy_read` | `incidents` filtered CYBER | Read-only | GRC incident -> Secretaria |
| `/grc/m/cyber/governance/soc` | GRC | Ninguna | `backlog_placeholder` | No SOC integration | Backlog | No |
| `/grc/m/audit/operate/findings` | GRC | `findings`, `action_plans`; local `useAuditFindings` | `legacy_read` | `findings` filtered `AuditInterna` | Read-only | GRC finding -> Secretaria |
| `/grc/m/audit/operate/plans` | GRC | `action_plans`, `findings`; local `useAuditActionPlans` | `legacy_read` | `action_plans` + finding origin | Read-only | GRC finding -> Secretaria |
| `/grc/m/audit/governance/program` | GRC | Ninguna | `backlog_placeholder` | No connected audit program | Backlog | No |

## Backlog no conectado

| Dominio | Estado | Razon |
|---|---|---|
| TPRM | No conectado | No hay pantalla TPRM especifica conectada en frontend GRC actual. |
| Penal / Anticorrupcion | No conectado | No hay modulo penal/anticorrupcion conectado en rutas GRC actuales. |

## Data contract

- Tables used: `risks`, `controls` via existing TGMS hooks only where linked, `incidents`, `regulatory_notifications`, `exceptions`, `action_plans`, `findings`, `obligations`, `country_packs`, `pack_rules`, `grc_module_nav`, `bcm_bia`, `bcm_plans`, `vulnerabilities`, and target handoff `policies`.
- Source of truth: Cloud operational legacy GRC tables for connected data; local constants only for GDPR demo screens; no `grc_*` adoption in this slice.
- Migration required: no.
- Types affected: no generated Supabase types; local TypeScript contracts only.
- Cross-module contracts: route-only handoffs for `GRC_INCIDENT_MATERIAL`, `GRC_FINDING_BOARD_ESCALATION`, `AIMS_TECHNICAL_FILE_GAP`, `AIMS_INCIDENT_MATERIAL`.
- Evidence posture: reference/readiness only; no final evidence or legal hold.
- Parity risk: low for read-only routes; medium for any future write probe to `governance_module_events` or `governance_module_links`.

## Code references

- `src/lib/grc/dashboard-readiness.ts`
- `src/pages/grc/Dashboard.tsx`
- `src/pages/grc/Risk360.tsx`
- `src/pages/grc/IncidentesList.tsx`
- `src/pages/grc/IncidenteDetalle.tsx`
- `src/pages/grc/modules/audit/Findings.tsx`
- `src/pages/ai-governance/Evaluaciones.tsx`
- `src/pages/ai-governance/Incidentes.tsx`
