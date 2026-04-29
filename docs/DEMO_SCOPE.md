# TGMS Platform — Alcance del Mockup Demo vs. ETD Enterprise

> **Versión:** 1.0 · **Fecha:** 2026-04-19  
> **Propósito:** Delimitar formalmente qué está implementado como demo funcional y qué exige la ETD para una release enterprise. Este documento es la referencia para cualquier debate de alcance con el equipo técnico o con el cliente objetivo.

---

## Estado actual: Mockup Funcional de Alta Fidelidad

Lo que existe en este repositorio es un **mockup funcional** construido para:

1. Validar la filosofía de producto con Grupo ARGA antes de iniciar desarrollo real.
2. Demostrar los flujos de negocio clave (Tour 10 pasos, DORA→BdE 72h, Secretaría, AI Governance).
3. Probar la arquitectura de información y la UX Garrigues ante usuarios piloto.

**No es, ni pretende ser, una implementación ETD-conforme lista para producción.**

---

## Mapa de Alcance

| Área | Estado Demo | Requisito ETD | Brecha |
|---|---|---|---|
| Shell TGMS + navegación | ✅ Completo | ✅ Cumple diseño | — |
| Módulo Secretaría Societaria | ✅ Funcional (T1–T14) | ✅ Flujos cubiertos | Falta audit trail |
| Módulo GRC Compass | ✅ Funcional (12 tasks) | ✅ Flujos cubiertos | Falta WORM/eIDAS |
| Módulo AI Governance | ✅ Funcional (EU AI Act) | ✅ Flujos cubiertos | Falta audit trail |
| Tour guiado 10 pasos | ✅ Completo | ✅ Narrativa OK | — |
| Cross-module links | ✅ Completo | ✅ Trazabilidad OK | — |
| Multi-tenant (`tenant_id`) | ✅ Columna presente | ❌ RLS deshabilitado | **Crítico** |
| Row Level Security (RLS) | ❌ Deshabilitado | ✅ Obligatorio | **Crítico** |
| BYOK / CMK por tenant | ❌ No implementado | ✅ Obligatorio | **Crítico** |
| RBAC / SoD enterprise | ❌ No implementado | ✅ Obligatorio | **Crítico** |
| Audit log WORM / inmutable | ❌ No implementado | ✅ Obligatorio | **Crítico** |
| Evidencias SHA-512 / QTSP | ❌ No implementado | ✅ Obligatorio | **Crítico** |
| Legal hold global | ❌ No implementado | ✅ Obligatorio | **Crítico** |
| Board Pack E2E | ❌ No implementado | ✅ Obligatorio | **Alto** |
| SCIM 2.0 / IdP federation | ❌ No implementado | ✅ Obligatorio | **Alto** |
| OpenTelemetry / SIEM feed | ❌ No implementado | ✅ Obligatorio | **Alto** |
| Particionado temporal tablas | ❌ No implementado | ✅ Obligatorio | **Medio** |
| SLO P95 verificados en carga | ❌ No probado | ✅ Obligatorio | **Medio** |
| DR documentado (RPO/RTO) | ❌ No documentado | ✅ Obligatorio | **Medio** |
| WCAG 2.2 AA auditoría formal | ❌ No auditado | ✅ Obligatorio | **Medio** |

---

## Qué está habilitado solo como "patrón demo"

Los siguientes comportamientos son **intencionalmente simplificados** para el mockup y **deben revertirse** antes de cualquier release enterprise:

```
RLS = deshabilitado (Supabase)
Auth = single demo user (demo@arga-seguros.com / TGMSdemo2026!)
Tenant = hardcoded "00000000-0000-0000-0000-000000000001"
Entidad = hardcoded "00000000-0000-0000-0000-000000000010"
Cifrado at-rest = Supabase default (sin envelope encryption por tenant)
Audit log = no existe subsistema WORM
GDPR module = datos en memoria (sin tablas ROPA reales en Supabase)
Scope Switcher = UI presente pero sin filtrado real de GRC por país/entidad
Bundle size = 1.999 MB (code-splitting parcial, pendiente optimización)
```

---

## Schema Stubs ETD — Campos Obligatorios Añadidos (nullable)

En la migración `2026-04-19-etd-stubs.sql` se han añadido los siguientes campos a las tablas principales como **stubs nullable**, sin lógica de negocio, para establecer el contrato del modelo de datos ETD y evitar refactors mayores en desarrollo real:

| Campo | Tablas afectadas | Propósito ETD |
|---|---|---|
| `legal_hold boolean DEFAULT false` | entities, policies, obligations, incidents, agreements, meetings, certifications, hallazgos | Bloquear purga cuando hay retención legal activa |
| `retention_policy_id uuid` | entities, policies, obligations, incidents, agreements | FK a tabla `retention_policies` |
| `created_by uuid` | incidents, agreements, meetings, certifications, hallazgos, regulatory_notifications | Trazabilidad de actor (SoD) |
| `approved_by uuid` | incidents, agreements, meetings, certifications | Four-eyes / anti auto-aprobación |
| `verified_by uuid` | agreements, certifications, hallazgos | Verificación independiente |
| `evidence_id uuid` | agreements, certifications, hallazgos, regulatory_notifications | FK a subsistema de evidencias |
| `hash_sha512 text` | certifications, regulatory_notifications, audit_log | Integridad forense / WORM |

Tablas stub nuevas:
- `retention_policies` — catálogo de políticas de retención por tenant
- `audit_log` — log inmutable (stub sin triggers WORM activos)

---

## Milestone Task 0 — Enterprise Hardening

Antes de iniciar desarrollo real sobre este codebase, el Milestone Task 0 debe cerrar:

1. **RLS real** — activar y probar que queries cross-tenant son rechazadas
2. **RBAC / SoD enterprise** — roles, librería de roles tóxicos, workflow excepción
3. **Audit trail WORM** — triggers + tabla `audit_log` con hash progresivo
4. **Evidencias demo/operativas** — tabla `evidence_bundles` + hash SHA-512 + QTSP stub; no constituyen evidencia final productiva hasta cerrar audit/retention/legal hold

### Gate futuro de evidencia final productiva

El demo puede evaluar readiness futura mediante contrato puro, pero no activa promocion real. Storage, DOCX, `evidence_bundles`, `certifications.evidence_id` y `agreements.document_url` siguen siendo evidencia demo/operativa hasta que exista aprobacion expresa de audit, retention, legal hold, politica probatoria y promocion.
5. **Legal hold + retención** — activar campos stub + job de purga respetando hold
6. **Board Pack E2E** — flujo acta → KPI → evidencia en ≤ 3 clics
7. **Observabilidad base** — OpenTelemetry / SIEM feed + SLO definidos

El plan completo está en `docs/superpowers/plans/2026-04-19-task0-enterprise-hardening.md`.

---

## Veredicto del análisis de alineación ETD (2026-04-19)

> **Aprobado-Condicionado para uso como demo comercial.**  
> **No aprobado para release enterprise sin cerrar Milestone Task 0.**

Áreas fuertes: navegación contextual, cross-module links, UX Garrigues, flujos DORA/BdE, Secretaría, AI Governance.  
Áreas bloqueantes: RLS, BYOK/CMK, SoD, WORM/eIDAS, Board Pack, observabilidad.

---

## Adenda 2026-04-27 — Demo Operable

La evolución comercial del demostrador exige una capa explícita **Demo-Operable**: escenarios guiados, dataset ARGA cerrado, evidencia sandbox trazable, explainability legal y separación estricta demo/producción.

Referencia normativa de producto:

- `docs/superpowers/plans/2026-04-27-demo-operable-prd-addendum.md`

Principio rector:

```text
Demo != fake.
Demo = simulación controlada con evidencia trazable.
```

Guardrails no negociables:

- `demo_mode=true` permite simulación controlada, pero mantiene integridad, snapshots, reglas, hashes y trazas.
- `demo_mode=true` bloquea filing registral real.
- `demo_mode=true` bloquea QTSP productivo y solo permite QES/TSQ sandbox explícito.
- Toda evidencia demo debe mostrarse como sandbox y no puede presentarse como evidencia productiva final.
- La Consola ARGA puede lanzar escenarios y mostrar narrativa, pero no se convierte en owner de Secretaría, GRC o AIMS.
