# TGMS Platform — Alcance del prototipo DEMO vs. release enterprise

> **Versión:** 2.0 · **Fecha:** 2026-07-21
> **Propósito:** Delimitar formalmente qué está demostrado en el prototipo y qué sigue pendiente para una release enterprise. Este documento no convierte una capacidad DEMO en una prestación productiva ni en un efecto jurídico.

---

## Estado actual: prototipo operativo avanzado demo-ready

Lo que existe en este repositorio es un **prototipo operativo avanzado** construido para:

1. Validar la filosofía de producto con Grupo ARGA antes de una productivización enterprise.
2. Demostrar flujos de negocio clave con persistencia real en el entorno de desarrollo-test-demo.
3. Probar la arquitectura de información y la UX Garrigues ante usuarios piloto.

**No es, ni pretende ser, una implementación ETD-conforme lista para producción.**

---

## Mapa de Alcance

| Área | Estado Demo | Objetivo enterprise | Brecha |
|---|---|---|---|
| Shell TGMS + navegación | ✅ Completo | ✅ Cumple diseño | — |
| Módulo Secretaría Societaria | ✅ Prototipo operativo avanzado; convocatoria integral UAT cerrada | Validar flujos productivos y efectos jurídicos | Validación jurídica/operativa productiva y hardening independiente |
| Módulo GRC Compass | ✅ Prototipo funcional y conectado | Profundidad productiva por dominio | Sigue siendo prototipo |
| Módulo AI Governance | ✅ Prototipo funcional y conectado | Profundidad productiva y validación regulatoria | Sigue siendo prototipo |
| Tour guiado 10 pasos | ✅ Completo | ✅ Narrativa OK | — |
| Cross-module links | ✅ Completo | ✅ Trazabilidad OK | — |
| Multi-tenant (`tenant_id`) | ✅ Scoping y RLS en tablas de dominio | Aislamiento enterprise verificado independientemente | Auditoría/pentest pendiente |
| Row Level Security (RLS) | ✅ Activa en el entorno demo | Cobertura y pruebas enterprise | Auditoría/pentest pendiente |
| BYOK / CMK por tenant | ❌ No implementado | ✅ Obligatorio | **Crítico** |
| RBAC / SoD | ✅ Implementado para el prototipo | Integración completa con identidad enterprise | **Alto** |
| Audit log WORM / inmutable | ✅ Cadena WORM operativa en el prototipo | Garantías productivas auditadas | **Alto** |
| Evidencias y custodia | ✅ Artefactos/hash/WORM y modelo de interposición/custodia DEMO | Política probatoria y servicio contratado | **Crítico** |
| Legal hold + retención | ✅ Capacidad demo implementada | Operación, gobierno y pruebas productivas | **Alto** |
| Board Pack E2E | ✅ Implementado, incluida exportación PDF | Validación productiva y de carga | **Medio** |
| SCIM 2.0 / IdP federation | ❌ No implementado | ✅ Obligatorio | **Alto** |
| OpenTelemetry / SIEM feed | ⚠️ Instrumentación/stub para Microsoft Sentinel | Integración y operación productivas | **Alto** |
| Particionado temporal tablas | ❌ No implementado | ✅ Obligatorio | **Medio** |
| SLO P95 verificados en carga | ❌ No probado | ✅ Obligatorio | **Medio** |
| DR documentado (RPO/RTO) | ❌ No documentado | ✅ Obligatorio | **Medio** |
| Accesibilidad | ✅ Remediación interna WCAG 2.1 AA | Auditoría formal WCAG 2.2 AA | **Medio** |

---

## Qué está habilitado solo como "patrón demo"

Los siguientes comportamientos siguen siendo **intencionalmente limitados** y deben revisarse antes de cualquier release enterprise:

```
Entorno = governance_OS compartido para desarrollo, test y demo
Auth = identidad demo; sin federación SCIM/IdP enterprise
Tenant = tenant demo conocido; RLS activo pero sin auditoría independiente
Entidad = identidad canónica Cloud; no usar UUID legacy como constante
Cifrado at-rest = Supabase default (sin envelope encryption por tenant)
Audit log = WORM operativo para el prototipo; no certificado como infraestructura productiva
EAD Trust = alcance modelado de interposición, mensajería básica y custodia/e-archiving; sin interacción real acreditada
Firma/QES/QSeal/ERDS/envío/entrega = no implementados ni atribuibles sin evidencia separada
GDPR module = datos en memoria (sin tablas ROPA reales en Supabase)
Filing registral real = bloqueado
```

---

## Evolución desde el alcance original de abril de 2026

La primera versión de este documento describía RLS, RBAC/SoD, WORM, legal hold, retención y Board Pack como ausentes o meros stubs. Ese estado quedó superado por las oleadas de hardening del prototipo. Hoy existen implementaciones operativas en `governance_OS`, pero **siguen siendo capacidades DEMO** y no acreditan por sí mismas readiness enterprise.

- RLS y scoping por tenant: activos en tablas de dominio.
- RBAC/SoD, capability matrix y cadena de auditoría WORM: operativos en el prototipo.
- Legal hold, retención, evidence bundles y Board Pack: implementados para DEMO.
- Generación de convocatoria: server-side desde manifiesto inmutable, con set exacto de anexos WORM.

Las migraciones versionadas del repositorio y la verificación concreta de cada versión en Cloud, no el listado histórico de campos de abril, son la fuente técnica de verdad. El drift histórico impide inferir paridad global a partir de una comprobación focal.

---

## Gaps restantes para una release enterprise

El hardening del prototipo no elimina las siguientes necesidades:

1. **Seguridad enterprise independiente** — auditoría de RLS/RBAC/SoD, pentest y segregación de entornos.
2. **Identidad y cifrado enterprise** — SCIM/IdP y, si se aprueba, BYOK/CMK por tenant.
3. **Política probatoria y operación** — gobierno de retención/legal hold, controles de custodia y criterios de promoción a evidencia productiva.
4. **Contrato EAD Trust** — el alcance actual es solo interposición, mensajería básica y custodia/e-archiving. QES, QSeal, cualquier firma, ERDS, envío o entrega requieren evidencia contractual y técnica separada.
5. **Operación y resiliencia** — observabilidad/Sentinel productivos, SLO de carga, DR con RPO/RTO y auditoría formal WCAG 2.2 AA.

### Gate futuro de evidencia final productiva

El demo puede evaluar readiness futura, pero no activa promoción real. Storage, DOCX, bundles y referencias documentales siguen siendo evidencia demo/operativa hasta que exista aprobación expresa de auditoría, retención, legal hold, política probatoria y promoción.

El plan completo está en `docs/superpowers/plans/2026-04-19-task0-enterprise-hardening.md`.

---

## Veredicto actualizado (2026-07-21)

> **Aprobado-Condicionado para uso como demo comercial.**  
> **No aprobado para release enterprise ni para efectos jurídicos productivos.**

Áreas fuertes: navegación contextual, cross-module links, UX Garrigues, motor de Secretaría, RLS/RBAC/SoD demo, WORM, generación documental y Board Pack.
Áreas bloqueantes: validación jurídica y de seguridad productiva, BYOK/CMK si se exige, identidad enterprise, política probatoria, operación/DR y servicios EAD Trust fuera del alcance vigente.

### Captura canónica UAT de convocatoria integral

El 2026-07-21 se cerró en vivo una convocatoria integral de ARGA mediante los ocho pasos, con destinatarios, requisitos previos, set exacto de anexos WORM, documento server-side y reunión materializada. La captura rectificada se preservó como evidencia histórica. El cierre y sus límites están en `docs/superpowers/reviews/2026-07-21-cierre-uat-convocatoria-arga.md`.

Este resultado valida el ciclo **DEMO** observado. No implica envío, entrega, firma, ERDS, filing registral ni efectos jurídicos reales.

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
- `demo_mode=true` limita EAD Trust a interposición, mensajería básica y custodia/e-archiving; no permite atribuir QES, QSeal, firma avanzada o simple, ERDS, envío ni entrega.
- Toda evidencia demo debe mostrarse como sandbox y no puede presentarse como evidencia productiva final.
- La Consola ARGA puede lanzar escenarios y mostrar narrativa, pero no se convierte en owner de Secretaría, GRC o AIMS.
