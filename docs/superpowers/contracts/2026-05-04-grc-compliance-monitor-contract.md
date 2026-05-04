# GRC Compliance Monitor Contract

Fecha: 2026-05-04

## Objetivo

El dashboard `/grc` incorpora un monitor de cumplimiento para que GRC Compass deje de verse como una lista parcial de riesgos e incidentes. La vista declara dominios de supervisión, fuente actual, postura de conexión, siguiente acción y handoffs permitidos.

## Alcance

El monitor es read model de frontend. No crea tablas, columnas, RPC, policies, storage ni eventos cross-module.

Dominios cubiertos:

- Inventario normativo y obligaciones.
- Controles, evidencias y efectividad.
- RCSA, riesgos y scoring.
- Incidentes y notificación regulatoria.
- DORA e ICT risk.
- Cyber y vulnerabilidades.
- BCM y resiliencia operacional.
- GDPR y privacidad operativa.
- TPRM y outsourcing, marcado como gap.
- Penal y anticorrupción, como vista taxonómica GRC.
- Auditoría interna y planes.
- Excepciones y controles compensatorios.
- Ciclo de políticas.
- Packs país y jurisdicción.
- Escalado a órganos.
- Intake desde AIMS.

## Fuente de verdad

Tablas actuales usadas o referenciadas por contrato:

- `risks`
- `incidents`
- `regulatory_notifications`
- `obligations`
- `policies`
- `controls`
- `evidences`
- `exceptions`
- `findings`
- `action_plans`
- `vulnerabilities`
- `bcm_bia`
- `bcm_plans`
- `country_packs`
- `pack_rules`

El source of truth sigue siendo Cloud Supabase `governance_OS`. El contrato local vive en `src/lib/grc/dashboard-readiness.ts`.

## Postura de mutación

- GRC puede escribir solo en workflows owner-write ya existentes: riesgos e incidentes.
- El monitor no escribe en `governance_module_events`.
- El monitor no escribe en `governance_module_links`.
- Los handoffs hacia Secretaría y desde AIMS son rutas de solo lectura.
- TPRM no se presenta como funcional. Requiere contrato de terceros antes de activar flujo.

## Gaps declarados

P0 funcional:

- TPRM / outsourcing necesita tabla o contrato de terceros, due diligence, criticidad, SLA, owner y evidencias.

P1 funcional:

- Penal / anticorrupción debe evolucionar de vista taxonómica sobre `risks`, `obligations` y `controls` a flujo completo por delito/riesgo/control/evidencia.
- Privacidad GDPR debe pasar de módulo demo conectado a cola operativa con owners, plazos y evidencias.
- Controles necesita distinguir diseño, test, efectividad y excepción.

## Verificación

Cobertura añadida:

- Unit contract: `src/lib/grc/__tests__/dashboard-readiness.test.ts`.
- Responsive E2E: `e2e/22-grc-workbench-responsive.spec.ts`.

No hay migración requerida.
