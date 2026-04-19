# Plan Maestro — Funcionalidades Pendientes TGMS

> **Fecha:** 2026-04-19 (actualizado 2026-04-19 PM)
> **Proyecto:** arga-governance-map (Lovable + Supabase)
> **Supabase:** `hzqwefkwsxopwrmtksbg` (governance_OS, eu-central-1)
> **QTSP:** EAD Trust (empresa tecnológica del grupo Garrigues, propietaria de la operación QTSP — Digital Trust API)
> **SIEM:** Microsoft Sentinel (decisión confirmada)
> **Estado actual:** Aprobado-Condicionado para demo comercial
> **Cliente demo:** Grupo ARGA Seguros (seudónimo de MAPFRE — nunca usar "MAPFRE" en código, datos ni commits)

---

## Resumen ejecutivo

La plataforma TGMS tiene **5 fases completadas** (Shell, Secretaría, GRC, AI Governance, Cross-module) con un motor de reglas LSC completo (16 materias, 9 plantillas, pipeline documental). El código fuente está listo pero la base de datos Supabase necesitaba sincronización — las 9 migraciones del motor de reglas se han aplicado hoy (19/04/2026).

Para pasar de "demo funcional" a "producto enterprise", quedan **4 bloques de trabajo** organizados en sprints.

---

## Estado de sincronización Supabase (completado hoy)

| Migración | Contenido | Estado |
|---|---|---|
| 000001 | Rule engine tables (rule_packs, versions, overrides, evaluations, conflictos) | ✅ Aplicada |
| 000002 | Extensión personas + mandatos (capital, representación) | ✅ Aplicada |
| 000003 | Role book secretaría + audit WORM | ✅ Aplicada |
| 000004 | Plantillas protegidas + 7 seeds Oleada 0 | ✅ Aplicada |
| 000005 | Expediente sin sesión (NO_SESSION) | ✅ Aplicada |
| 000006 | Evidence bundles ASiC-E | ✅ Aplicada |
| 000007 | Contenido jurídico Oleada 1 (capa1+capa2+capa3) | ✅ Aplicada |
| 000008 | 5 ajustes de revisión legal | ✅ Aplicada |
| 000009 | Cobertura ES 100% (2 plantillas nuevas) | ✅ Aplicada |

**Total tablas nuevas:** 10 (rule_packs, rule_pack_versions, rule_param_overrides, rule_evaluation_results, conflicto_interes, secretaria_role_assignments, rule_change_audit, no_session_expedientes/respuestas/notificaciones, evidence_bundles/artifacts)

**Plantillas en DB:** 9 (todas en estado REVISADA, con contenido jurídico completo)

---

## Pendientes organizados por prioridad

### Sprint A — Seed Data + Integración Inmediata (1-2 días)

Tareas que completan la funcionalidad existente sin nuevo código de features.

| # | Tarea | Descripción | Esfuerzo |
|---|---|---|---|
| A1 | Seed Rule Packs (16 materias) | Ejecutar `scripts/seed-rule-packs.ts` en Supabase — 16 materias LSC con quórums, mayorías, plazos por tipo social | 30min |
| A2 | Seed Demo Data | Ejecutar `scripts/seed-demo-data.ts` — 10 personas, 9 mandatos, 12 role assignments, 3 agreements, 50+ registros NO_SESSION | 30min |
| A3 | Seed ETD Stubs | Aplicar `docs/superpowers/plans/2026-04-19-etd-stubs.sql` — campos legal_hold, retention_policy_id, created_by, approved_by, evidence_id, hash_sha512 como nullable en tablas principales + tabla retention_policies | 30min |
| A4 | TramitadorStepper motor integration | Conectar `useRulePackForMateria` en pasos 2-5 del TramitadorStepper (TODO T18 en código) — inscribibilidad, instrumento requerido, canales de publicación | 4h |
| A5 | Pipeline QTSP wiring | Conectar `useQTSPSign` al paso 5 del GenerarDocumentoStepper — SHA-256 ya se computa, falta trigger de firma QES | 2h |
| A6 | Archival a Storage | Guardar DOCX generados en Supabase Storage (`matter-documents` bucket) + registrar en evidence_events | 2h |

**Criterio de salida Sprint A:** Los 3 seeds ejecutados, TramitadorStepper data-driven, pipeline documental end-to-end con firma QTSP (stub) y archivado.

---

### Sprint B — Enterprise Hardening / Task 0 (3-5 días)

Bloques críticos para pasar de "demo" a "enterprise-ready". Plan detallado en `docs/superpowers/plans/2026-04-19-task0-enterprise-hardening.md`.

| # | Tarea | Tipo | Esfuerzo |
|---|---|---|---|
| B1 | **RLS real** (T0.1) | Seguridad crítica | Alto |
| | Activar RLS en TODAS las tablas de dominio, definir `auth.tenant_id()` desde JWT, crear políticas de aislamiento, test cross-tenant | |
| B2 | **RBAC / SoD** (T0.2) | Seguridad crítica | Alto |
| | Schema user_roles con 5 roles (SECRETARIO, CONSEJERO, COMPLIANCE, ADMIN_TENANT, AUDITOR), librería roles tóxicos, SodGuard component, hook useUserRole | |
| B3 | **Audit Trail WORM** (T0.3) | Seguridad crítica | Medio |
| | Triggers fn_audit_log con hash encadenado SHA-512 en agreements, incidents, certifications, meetings, hallazgos. Verificación de cadena | |
| B4 | **Evidencias SHA-512 / QTSP** (T0.4) | Seguridad crítica | Medio |
| | Generador de evidence bundles con hash SHA-512, sección "Evidencia forense" en CertificacionDetalle, stub QTSP/QSeal | |
| B5 | **Legal Hold + Retención** (T0.5) | Dato crítico | Medio |
| | Seed retention_policies (LSC 10 años, DORA 7 años, GDPR 5 años), Edge Function purge-job stub respetando legal_hold | |
| B6 | **Board Pack E2E** (T0.6) | Funcionalidad alta | Medio |
| | Nueva página `/board-pack` con vista agregada: actas recientes + KPIs GRC + hallazgos críticos + evidencias. Criterio: ≤ 3 clics a evidencia | |
| B7 | **Observabilidad** (T0.7) | NFR producción | Medio |
| | telemetry.ts (OTel stub), Edge Function **Microsoft Sentinel** SIEM feed, SLOs documentados (P95 ≤ 800ms, RPO ≤ 1h, RTO ≤ 2h) | |

**Criterio de salida Sprint B:** Test cross-tenant PASS, SodGuard bloqueando, audit_log con triggers activos, evidence_bundles con hash real, retention_policies seeded, /board-pack navegable, telemetry inicializado.

---

### Sprint C — Pulido UX + Calidad (2-3 días)

| # | Tarea | Descripción | Esfuerzo |
|---|---|---|---|
| C1 | Auditoría tokens Garrigues | Barrer TODOS los componentes Garrigues (secretaria, grc, ai-governance) buscando violaciones: hex en className, Tailwind nativos (bg-amber-*, text-white), style donde existe clase Tailwind equivalente, --g-brand (→ --g-brand-3308), --g-status-* (→ --status-*) | 4h |
| C2 | WCAG 2.1 AA audit | Ejecutar axe-core en todas las rutas Garrigues, corregir contraste, aria-labels, focus management, keyboard navigation | 4h |
| C3 | Bundle optimization | Verificar code-splitting con React.lazy() en las 14+ páginas, target ≤ 400KB initial bundle | 2h |
| C4 | Empty states + Loading | Verificar que todas las listas/tablas tienen esqueletos de carga (animate-pulse) y estados vacíos con CTA | 2h |
| C5 | Error boundaries | Verificar ErrorBoundary Garrigues en todos los módulos con "Reintentar" | 1h |
| C6 | Scope Switcher funcional | Conectar ScopeSwitcher a filtrado real de GRC por país/entidad (actualmente UI presente sin filtrado) | 4h |
| C7 | Responsive / Mobile | Verificar hamburger menus, column hiding, touch targets en todas las tablas | 3h |

**Criterio de salida Sprint C:** 0 violaciones de tokens Garrigues, WCAG AA confirmado, bundle ≤ 400KB, todos los estados cubiertos.

---

### Sprint D — Funcionalidades Avanzadas (5-10 días, opcional pre-demo)

| # | Tarea | Descripción | Prioridad | Esfuerzo |
|---|---|---|---|---|
| D1 | Gestión completa de plantillas | UI para transición de estado (REVISADA → APROBADA → ACTIVA), historial de versiones, diff entre versiones | Alta | 3d |
| D2 | Firma QES real (EAD Trust) | Integrar EAD Trust Digital Trust API (QTSP del grupo Garrigues) en lugar de stubs. Flujo: enviar documento → webhook firma completada → sellar evidence bundle. Arquitectura ya validada en NDA Suite (sr_tools + orchestrator) | Alta | 3d |
| D3 | Notificación certificada real | Integrar ERDS (eIDAS) para notificaciones certificadas en expedientes NO_SESSION. Flujo: enviar → evidencia entrega → WORM | Alta | 2d |
| D4 | Dashboard ejecutivo mejorado | Métricas cross-module: % acuerdos compliant, tiempo medio de tramitación, alertas de legalización de libros, tendencias GRC | Media | 2d |
| D5 | Exportación PDF/DOCX informes | Generar informes de compliance por entidad/órgano exportables para Consejo | Media | 2d |
| D6 | Calendario de vencimientos | Vista calendario con deadlines: legalizaciones libros, renovaciones mandatos, revisiones de políticas, vencimientos DORA | Media | 2d |
| D7 | Workflow de aprobación | Flujo multi-step: secretario propone → comité legal revisa → presidente aprueba → firma QES | Media | 3d |
| D8 | Búsqueda global avanzada | Full-text search cross-module (acuerdos, políticas, hallazgos, incidentes) con filtros y highlights | Baja | 2d |

---

### Sprint E — Post-GA / Multi-jurisdicción (futuro, NO prioridad actual)

**Nota arquitectónica:** Aunque el desarrollo de jurisdicciones adicionales queda aplazado, el diseño debe contemplar desde ahora una **Matriz de Normalización Jurisdiccional** que permita coordinar y dar seguimiento a los mismos procesos societarios a nivel local en cada jurisdicción. Esta matriz mapea conceptos equivalentes (quórum, mayorías, plazos, documentación obligatoria, inscripción registral) entre las leyes societarias de cada país, permitiendo un dashboard unificado de cumplimiento multi-jurisdicción.

| # | Tarea | Descripción | Dependencia |
|---|---|---|---|
| E0 | **Matriz de Normalización Jurisdiccional** | Diseñar tabla `jurisdiction_concept_map` que mapee cada concepto del motor LSC (quórum, mayoría, plazo convocatoria, instrumento público, registro mercantil) a su equivalente en BR/MX/PT. Permite: (a) dashboard unificado cross-jurisdicción, (b) seguimiento centralizado de cumplimiento por entidad/país, (c) alertas de deadline normalizadas. Estructura: `concept_code` (ES canonical) → `jurisdiction` → `local_law_ref` → `local_params` JSONB | Diseño previo a E1-E3 |
| E1 | Jurisdicción Brasil | LSAB (Lei 6.404/76): assembleia geral, conselho de administração, diretoria. Rule Packs BR con quórums/mayorías brasileñas, templates PT-BR. Mapear a matriz normalización | Legal BR |
| E2 | Jurisdicción México | LGSM (Ley General de Sociedades Mercantiles): asamblea de accionistas, consejo de administración, comisario. Rule Packs MX, templates ES-MX. Mapear a matriz normalización | Legal MX |
| E3 | Jurisdicción Portugal | CSC (Código das Sociedades Comerciais): assembleia geral, conselho de administração, conselho fiscal. Rule Packs PT, templates PT-PT. Mapear a matriz normalización | Legal PT |
| E4 | SCIM 2.0 / IdP federation | Entra ID + Okta SSO, provisioning automático de usuarios | Infra |
| E5 | BYOK / CMK per tenant | Supabase Vault integration, envelope encryption | Supabase Pro |
| E6 | Particionado temporal | PARTITION BY RANGE (created_at) en audit_log, incidents, evidence_bundles | Volumen datos |
| E7 | Segregación repos por módulo | Separar Secretaría, GRC, AI Governance a repos independientes (Garrigues standalone) | Decisión comercial |
| E8 | DMS connectors reales | iManage, SharePoint, Google Drive — actualmente stubs | Credenciales API |
| E9 | Multi-tenant real | Eliminar hardcoded tenant_id, auth JWT con tenant claim dinámico, tenant provisioning | Sprint B complete |

---

## Inventario de archivos y estado

### Motor de Reglas (src/lib/rules-engine/) — 15 archivos, 15 tests

| Archivo | Función | Tests |
|---|---|---|
| types.ts | Tipos base (RulePack, EvalResult, etc.) | — |
| jerarquia-normativa.ts | Resolver LEY > ESTATUTOS > PACTO | ✅ |
| convocatoria-engine.ts | Plazos, canales, documentos | ✅ |
| constitucion-engine.ts | Quórum por tipo social + conflictos | ✅ |
| majority-evaluator.ts | Parser de fórmulas de mayoría | ✅ |
| votacion-engine.ts | 6 gates: modo → elegibilidad → quórum → mayoría → unanimidad → vetos | ✅ |
| no-session-engine.ts | 5 gates específicos NO_SESSION | ✅ |
| documentacion-engine.ts | Checklist por materia | ✅ |
| orquestador.ts | componerPerfilSesion() + evaluar() | ✅ |
| bordes-no-computables.ts | Casos no automatizables (alertas) | ✅ |
| plantillas-engine.ts | Gate PRE (STRICT/FALLBACK/DISABLED) | ✅ |
| plantillas-gate-config.ts | Configuración go-live | — |
| evidence-bundle.ts | ASiC-E + verificación integridad | ✅ |
| qtsp-integration.ts | Stubs firma QES + timestamp | ✅ |
| index.ts | Re-exports | — |

### Pipeline Documental (src/lib/doc-gen/) — 3 archivos

| Archivo | Función |
|---|---|
| template-renderer.ts | Handlebars + helpers ES + pre-processing |
| variable-resolver.ts | 7 fuentes (ENTIDAD, ORGANO, REUNION, EXPEDIENTE, MOTOR, SISTEMA, USUARIO) |
| docx-generator.ts | DOCX con branding Garrigues + SHA-256 |

### Hooks Secretaría — 16 hooks

| Hook | Función |
|---|---|
| useJurisdiccionRules.ts | Reglas por jurisdicción + quórum + plazos |
| useConvocatorias.ts | CRUD convocatorias |
| useReunionSecretaria.ts | CRUD reuniones + asistentes + votos |
| useActas.ts | CRUD actas + certificaciones |
| useTramitador.ts | Workflow tramitación registral |
| useAcuerdosSinSesion.ts | CRUD acuerdos sin sesión |
| useDecisionesUnipers.ts | Decisiones unipersonales |
| useLibros.ts | Libros obligatorios + alertas legalización |
| usePlantillas.ts | Templates de documentos |
| usePlantillasProtegidas.ts | CRUD + transiciones de estado plantillas |
| usePlantillasMetrics.ts | Métricas leading/lagging |
| useAgreements.ts | CRUD agreements (agregado raíz) |
| useAgreementCompliance.ts | Motor compliance V2 (ENGINE_V2) |
| useNoSessionExpediente.ts | Expediente sin sesión |
| useQTSPSign.ts | Firma QES (stub) |
| useQTSPVerification.ts | Verificación integridad (stub) |

### Páginas Secretaría — 23 archivos

Todas en `src/pages/secretaria/` con SecretariaLayout (tokens --g-*).

---

## Orden de ejecución recomendado

```
Sprint A (1-2 días) ──→ Sprint B (3-5 días) ──→ Sprint C (2-3 días)
     │                        │                        │
     ▼                        ▼                        ▼
  Seeds +              Enterprise              UX polish
  Integración          Hardening               WCAG AA
  Pipeline E2E         RLS + RBAC              Tokens audit
                       WORM + Evidence
                       Board Pack
                                    ┌──────────────────┐
                                    │   Sprint D       │
                                    │   (opcional)      │
                                    │   Firma real      │
                                    │   ERDS            │
                                    │   Dashboard v2    │
                                    └──────────────────┘
                                    ┌──────────────────┐
                                    │   Sprint E       │
                                    │   (post-GA)      │
                                    │   Multi-jurisd.  │
                                    │   SCIM / BYOK    │
                                    └──────────────────┘
```

**Timeline estimado hasta demo MAPFRE:**
- Sprint A: inmediato (seeds + integración)
- Sprint B: 1 semana (hardening enterprise)
- Sprint C: 3 días (pulido UX)
- **Total pre-demo: ~2 semanas**

Sprint D y E son post-demo, según feedback de MAPFRE.

---

## Decisiones ya tomadas

| # | Decisión | Resolución | Fecha |
|---|---|---|---|
| ✅ 1 | Proveedor QTSP producción | **EAD Trust** — empresa tecnológica del grupo Garrigues, propietaria de la operación QTSP. Digital Trust API. Mismo proveedor que NDA Suite (arquitectura sr_tools + orchestrator ya validada) | 2026-04-19 |
| ✅ 2 | SIEM proveedor | **Microsoft Sentinel** — feed OTel vía Edge Function | 2026-04-19 |
| ✅ 3 | Cliente demo | **Grupo ARGA Seguros** — seudónimo de MAPFRE. Nunca usar "MAPFRE" en código, datos ni commits. Todos los datos demo deben ser coherentes con la estructura de gobierno corporativo de ARGA | 2026-04-19 |

---

## Decisiones pendientes (requieren input legal/negocio)

### Pendientes de negocio

| # | Decisión | Contexto | Impacto |
|---|---|---|---|
| P1 | **Roles demo ARGA** | ¿Qué roles mostrar en la demo? Candidatos: SECRETARIO, CONSEJERO, COMPLIANCE, ADMIN_TENANT, AUDITOR. ¿Hay roles específicos de la estructura ARGA que añadir? | Sprint B (RBAC/SoD) |
| P2 | **Board Pack contenido** | ¿Qué KPIs quiere ver el Consejo de ARGA? Candidatos: % acuerdos compliant, tramitaciones pendientes, hallazgos GRC abiertos, alertas DORA, vencimientos | Sprint B (Board Pack) |
| P3 | **Jurisdicciones fase 2** | ¿Priorizar Brasil o México después de España? Depende de qué filiales de ARGA se incluyan primero en la demo | Sprint E |

### 6 decisiones legales del motor de reglas — TODAS RESUELTAS ✅

Resueltas el 2026-04-19. Detalle completo en `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`.

| # | Decisión | Resolución | Urgencia | Cambio código |
|---|---|---|---|---|
| ✅ DL-1 | Alcance jurisdiccional Rule Packs | **ES para demo + PT como preview.** 16 Rule Packs ES intactos. PT como primer override vía `rule_param_overrides` (CSC portugués). BR/MX post-GA vía Matriz de Normalización Jurisdiccional | Baja | No (infra ya existe) |
| ✅ DL-2 | Entidades cotizadas | **NO bloquear.** Motor evalúa LSC normalmente + añade capa de advertencias LMV (CNMV, MAR art. 17, operaciones vinculadas art. 231 LSC). ARGA Seguros es SA cotizada — el BLOQUEO actual impide la demo | **ALTA** | **Sí** — `bordes-no-computables.ts` |
| ✅ DL-3 | Pactos parasociales | **Un pacto demo** (Fundación ARGA 69.69% — derecho de veto en operaciones estructurales). Lógica de evaluación post-GA; para demo solo dato visible | Media | No (solo seed data) |
| ✅ DL-4 | Plantilla Convocatoria SA/SL | **Selección automática** por `tipo_social` en Gate PRE. SA→Plantilla 6 (BORME+web), SL→Plantilla 9 (notificación individual art. 173.2). Override manual permitido con audit log | **ALTA** | **Sí** — Gate PRE en `plantillas-engine.ts` |
| ✅ DL-5 | Voto de calidad presidente | **CdA: Sí. Comité Ejecutivo: Sí. Comisiones delegadas (Auditoría, Riesgos, Nombramientos, Retribuciones): No.** Config en `governing_bodies.config` JSONB | Media | Sí — seed `governing_bodies` |
| ✅ DL-6 | Retribución consejeros valores | **Valores derivados del IAR 2025.** No ejecutivos: VP 220K€, Vocal 115K€. Ejecutivos: RF Presidente 1.091K€, VP 535K€. RVA: 100% BN + ROE ±5%. ILP 2026-2028: TSR 30% + ROE 25% + RCGNV 25% + CSM 5% + ESG 15%. Techo JGA 4M€ | Media | Sí — Rule Pack seed |

**Prioridad de implementación:** DL-2 y DL-4 desbloquean el flujo principal de la demo para ARGA Seguros (SA cotizada). Los demás enriquecen pero no bloquean.
