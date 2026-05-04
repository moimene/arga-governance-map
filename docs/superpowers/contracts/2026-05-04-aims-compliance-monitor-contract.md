# AIMS Compliance Monitor Contract

Fecha: 2026-05-04  
Owner: AIMS 360 / AI Governance  
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`

## Objetivo

Ampliar AIMS desde inventario/evaluaciones/incidentes hacia una mesa de cumplimiento continua, sin abrir schema ni mezclar ownership con GRC o Secretaría.

## Fuentes actuales

| Fuente | Uso | Postura |
|---|---|---|
| `ai_systems` | Inventario, clasificación de riesgo, proveedor, estado, uso previsto | `legacy_read`; owner-write solo en alta AIMS |
| `ai_risk_assessments` | Evaluaciones AI Act / ISO 42001, score, findings | `legacy_read`; write futuro limitado a AIMS |
| `ai_compliance_checks` | Controles/requisitos de cumplimiento por sistema | `legacy_read`; monitor derivado |
| `ai_incidents` | Incidentes IA, materialidad, causa raíz, acciones correctivas | `legacy_read`; owner-write en alta incidente AIMS |

No se leen ni escriben tablas `aims_*` en esta rebanada. No se crean riesgos/controles GRC ni actos de Secretaría.

## Dominios monitorizados

| Dominio | Área | Fuente preferente | Handoff |
|---|---|---|---|
| Gobierno, roles y accountability | ISO 42001 | Derivado de evaluaciones/checks | No |
| Inventario y clasificación de riesgo | EU AI Act | `ai_systems` | No |
| Prácticas prohibidas | EU AI Act | `ai_systems` + checks | No |
| Obligaciones alto riesgo | EU AI Act | `ai_risk_assessments` | No |
| Expediente técnico | EU AI Act | `ai_risk_assessments` + checks | `AIMS_TECHNICAL_FILE_GAP` |
| Gobierno del dato | EU AI Act | `ai_compliance_checks` | No |
| Transparencia e información al usuario | EU AI Act | `ai_compliance_checks` | No |
| Supervisión humana | EU AI Act | `ai_compliance_checks` | No |
| Precisión, robustez y ciberseguridad | EU AI Act | `ai_incidents` + checks | No |
| Proveedor y terceros | Operativo AIMS | `ai_systems` | `AIMS_VENDOR_CONTEXT` futuro |
| Post-market monitoring | EU AI Act | `ai_incidents` | No |
| Reporting de incidentes y escalado | Cross-module | `ai_incidents` | `AIMS_INCIDENT_MATERIAL` |
| Derechos fundamentales / DPIA | Cross-module | checks + evaluaciones | `AIMS_GDPR_CONTEXT` futuro |
| Sistema de gestión ISO 42001 | ISO 42001 | `ai_risk_assessments` | No |
| Evidencia y recordkeeping | Operativo AIMS | `ai_compliance_checks` + incidentes | No |

## Reglas de estado

- Si hay `ai_compliance_checks` relevantes por código/título/descripción, el monitor usa esos estados.
- `CONFORME`, `APROBADO`, `OK`, `CERRADO`, `COMPLETO` => listo si todos los checks relevantes cumplen.
- `EN_CURSO`, `EN_REVISION`, `PENDIENTE`, `PARCIAL`, `BORRADOR` => vigilancia.
- `NO_CONFORME`, `ABIERTO`, `BLOQUEADO`, `VENCIDO`, `CRITICO` => gap.
- Si no hay checks específicos, el monitor cae a heurísticas derivadas de sistemas, evaluaciones e incidentes.

## Límites

- No hay migración.
- No hay typegen Supabase.
- No hay writes a `governance_module_events` ni `governance_module_links`.
- Los handoffs son rutas de lectura/intake. GRC decide riesgos/controles; Secretaría decide actos formales.
- Evidencia AIMS sigue como referencia/demo operativa salvo contrato probatorio separado.

