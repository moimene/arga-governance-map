# 2026-04-27 — Track G: Consola General ARGA / ERP Integration Shell

## Propósito

La Consola General ARGA es la primera experiencia operativa del ecosistema TGMS. Su función es convertir TGMS Core, Secretaría Societaria, GRC Compass y AIMS en un ERP de gobernanza corporativa: una vista única para priorizar, buscar, filtrar por sociedad, lanzar handoffs y navegar a los módulos propietarios.

Este documento aterriza Track G del plan rector `2026-04-27-ruflo-supabase-architecture-mission.md`. No introduce schema nuevo. Mientras la paridad Supabase siga abierta, la consola debe ser una capa de lectura y orquestación con contratos explícitos.

## Decisión arquitectónica: separar producto, compartir plataforma

AIMS 360, GRC Compass y Secretaría Societaria son bounded contexts separados y productos vendibles/desplegables de forma independiente. La Consola ARGA/TGMS Shell no debe convertirlos en un supermódulo ni absorber lógica propietaria de cada dominio.

La frontera queda así:

- **AIMS 360**: fuente de verdad de sistemas IA, versiones, AI Act, ISO 42001, expediente técnico, post-market y controles IA.
- **GRC Compass**: ledger transversal de obligaciones, riesgos, controles, evidencias, hallazgos, remediación, reporting, legal hold y retención.
- **Secretaría Societaria**: fuente formal societaria de convocatorias, reuniones, actas, certificaciones, libros y acuerdos.
- **TGMS Shell / Consola ARGA**: orquestador corporativo para clientes grandes, responsable de navegación, composición read-only, scope, búsqueda, bandeja y handoffs.

Lo compartido debe ser fino y estable: `tenant_id`/scope, identidad, RBAC base, tokens UX Garrigues, `governance_module_links`, `governance_module_events`, `evidence_bundles`, `audit_log`, legal hold y retención. La consola puede componer y enrutar, pero no puede hacer que GRC posea sistemas IA, que AIMS replique el ledger GRC ni que Secretaría incorpore lógica regulatoria no societaria.

## Decisión arquitectónica: consola del consejo y del consejero

La Consola ARGA no es solo el cockpit de gestión corporativa interna. También debe ser la **consola del consejo y del consejero**: el punto de conexión entre TGMS Core, Secretaría, GRC Compass y AIMS para cada rol de gobierno corporativo.

Cada usuario con función de gobierno debe entrar a un dashboard adaptado a su rol, sin duplicar datos ni lógicas owner:

| Rol / tipología | Dashboard esperado | Pregunta que debe responder |
|---|---|---|
| Presidente del CdA | Agenda estratégica, decisiones críticas, calidad de gobierno, riesgos materiales y asuntos a elevar | ¿Qué requiere dirección, impulso o voto de calidad? |
| Vicepresidente | Continuidad de gobierno, sustituciones, agenda delegada y seguimiento de decisiones | ¿Qué debo coordinar o respaldar antes del próximo órgano? |
| Coordinador Independiente | Independencia, conflictos, equilibrio del consejo, evaluaciones y asuntos de consejeros no ejecutivos | ¿Hay señales que afecten independencia, equilibrio o supervisión? |
| Consejero independiente | Board pack, riesgos, obligaciones, IA, evidencias, conflictos y votaciones pendientes | ¿Qué debo revisar para ejercer supervisión diligente? |
| Consejero dominical | Asuntos estratégicos, pactos, operaciones estructurales, derechos de veto y seguimiento de inversiones | ¿Qué afecta a la posición del accionista y a los pactos aplicables? |
| Consejero ejecutivo | Ejecución, riesgos operativos, controles, incidentes, remediación y compromisos con órganos | ¿Qué requiere acción ejecutiva o explicación al consejo? |
| Presidente de comisión | Agenda y KPIs de su comisión, hallazgos, controles, evidencias y decisiones pendientes | ¿Qué debe tratar mi comisión y qué evidencias lo soportan? |
| Secretario del consejo | Expedientes societarios, convocatorias, actas, certificaciones, libros, quorum, validez y trazabilidad | ¿Qué debe formalizarse y con qué seguridad jurídica? |

El Shell debe resolver el rol desde identidad/RBAC y condiciones societarias canónicas (`person_id`, `body_id`, `entity_id`, cargos/mandatos), componer una vista read-only del trabajo relevante y enrutar a los módulos propietarios. La personalización por rol no permite crear modelos paralelos de consejero ni copiar expedientes: solo filtra, prioriza y presenta datos owner.

Benchmark objetivo: combinar la productividad de board portals (agenda, board pack, aprobaciones, seguridad) con la profundidad de plataformas GRC/IRM (riesgos, controles, evidencias, auditoría) y la trazabilidad formal de Secretaría Societaria. TGMS debe diferenciarse al conectar **órgano + rol + sociedad + decisión + riesgo + evidencia**.

## Decisión go-to-market: capa Demo-Operable

Para comercializar mientras el prototipo canónico sigue cerrando paridad, WORM y QTSP productivo, la consola debe incorporar un modo **Demo-Operable** como experiencia de presentación controlada.

Referencia: `docs/superpowers/plans/2026-04-27-demo-operable-prd-addendum.md`.

Responsabilidad de la consola:

- mostrar banner global `DEMO MODE`;
- ofrecer selector de escenarios ARGA;
- ejecutar o lanzar el runner demo;
- presentar progreso del vertical `Convocatoria -> Sesión -> Gate -> Acta -> Certificación -> Evidencia`;
- mostrar explicación legal y evidencia sandbox;
- enrutar al módulo propietario para inspección.

Límites:

- no evaluar reglas societarias en el Shell;
- no generar actas/certificaciones desde el Shell;
- no llamar QTSP productivo en demo;
- no presentar evidencia sandbox como evidencia productiva;
- no persistir modelos paralelos de Secretaría, GRC o AIMS.

## 1. Mapa actual de consola/shell existente

| Área | Estado actual | Fuente / owner | Observación |
|---|---|---|---|
| Shell global rojo | `ShellLayout`, `Header`, `Sidebar`, `ScopeSwitcher`, `GlobalSearch`, `NotificationsBell` | TGMS Core | La navegación base ya agrupa gobierno, módulos Garrigues, SII y ayuda. |
| Dashboard raíz `/` | `src/pages/Dashboard.tsx` | TGMS Core / consola | Ya muestra KPIs, alertas, reuniones, módulos, ESG y actividad. Debe evolucionar a consola ERP. |
| Scope | `ScopeContext` + `ScopeSwitcher` | TGMS Core | Hoy es scope textual demo; no siempre equivale a `entity_id` canónico. |
| Búsqueda global | `components/shell/GlobalSearch.tsx` | TGMS Core | Hoy usa sugerencias estáticas. Debe pasar a read model multi-owner por ID canónico. |
| Alertas | `useDashboardAlerts()` sobre `notifications` | TGMS Core | Es la base correcta para bandeja global si cada alerta conserva ruta/source ID. |
| KPIs core | `useDashboardKpis()` | TGMS Core | Usa `entities`, `mandates`, `policies`, `findings`, `delegations`. |
| Estado módulos | `useModuleStatus()` | Consola componiendo owners | Mezcla Secretaría Cloud, GRC legacy, AIMS legacy y SII view no tipada. Debe declarar postura. |
| Secretaría | `/secretaria/*` | Secretaría | Layout propio Garrigues; consola debe enrutar, no duplicar lógica legal. |
| GRC | `/grc/*` | GRC | UI actual usa tablas operativas legacy y algunas `grc_*` como navegación. |
| AIMS | `/ai-governance/*` | AIMS | UI actual consume `ai_*`; el backbone `aims_*` está pendiente de adopción/paridad. |

## 2. Propuesta de arquitectura ERP

La consola se divide en cinco capas:

| Capa | Responsabilidad | Regla de diseño |
|---|---|---|
| Identidad y scope | Tenant, sociedad, órgano, persona, rol | Referenciar IDs canónicos de Core; nunca recrear por nombre visible. |
| Read composition | KPIs, bandeja, alertas, timeline, búsqueda | Leer de owners y mostrar fuente, timestamp y postura de evidencia. |
| Handoff | Acciones que abren módulos propietarios | La consola solo enruta o crea eventos/links compartidos cuando exista contrato. |
| Evidence spine | Evidencias verificables, hashes, audit trail | Declarar evidencia solo con `evidence_bundles` + storage/hash + `audit_log`. |
| Module launcher | Acceso operativo a Secretaría, GRC, AIMS, SII | Mantener identidad visual TGMS en shell y respetar layouts Garrigues dentro de módulos. |

Patrón recomendado para cualquier nueva pieza de consola:

1. Resolver `tenant_id` y, cuando aplique, `entity_id` desde Core.
2. Leer datos del módulo owner con filtros por ID canónico.
3. Normalizar solo para presentación en memoria, sin persistir copias.
4. Mostrar owner, tabla/fuente y postura de evidencia.
5. Para mutar, navegar al flujo owner o emitir contrato shared si existe.

## 3. Matriz de ownership de datos

| Dato / input / hecho | Owner canónico | Tabla/fuente de verdad | ID estable | Consumidores | Mutación permitida desde consola | Postura de evidencia |
|---|---|---|---|---|---|---|
| Tenant, sociedad, órgano, persona | TGMS Core | `tenants`, `entities`, `governing_bodies`, `persons` | `tenant_id`, `entity_id`, `body_id`, `person_id` | Todos los módulos | Selección/filtro; alta/edición por owner | Referencia de identidad, no evidencia final |
| Alertas globales | TGMS Core | `notifications` | `notification.id`, `route`, source IDs en payload futuro | Consola, módulos | Marcar leída solo por Core | Vista operativa; no evidencia por sí sola |
| Expediente/acuerdo legal | Secretaría | `agreements`, `convocatorias`, `meetings`, `minutes`, `certifications` | UUID owner | Consola, Board Pack, GRC/AIMS si linkado | Abrir flujo owner; no escribir estado legal desde consola | Derivada hasta bundle/audit |
| Certificación / acta emitida | Secretaría + backbone evidencia | `certifications`, `evidence_bundles`, `audit_log` | `certification_id`, `evidence_id`, `audit_log.id` | Secretaría, GRC, AIMS, auditoría | Ninguna; emisión vía Secretaría/QTSP | Verificable solo si bundle/hash/audit/storage están completos |
| Incidente GRC | GRC | `incidents`, `regulatory_notifications` | `incident.id` | Consola, GRC, Secretaría si material | Abrir GRC; futura escalada por event/link | Legacy operativo; evidencia si enlaza bundle |
| Riesgo/control/evidencia GRC | GRC | `risks`, `controls`, `evidences` | UUID owner / code owner | Consola, GRC, AIMS, Secretaría | Abrir GRC; no recalcular workflows | Legacy operativo hasta decisión Track D |
| Sistema IA / evaluación / incidente | AIMS | `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`, `ai_incidents` | UUID owner | Consola, AIMS, GRC, Secretaría | Abrir AIMS; no crear shadow inventory | Legacy compatibility hasta Track E |
| Link cross-module | Core integration backbone | `governance_module_links` | `link.id`, source/target IDs | Todos | Pendiente: solo cuando tabla exista en Cloud/local/types | Contrato de trazabilidad, no evidencia final |
| Evento cross-module | Core integration backbone | `governance_module_events` | `event.id`, payload versionado | Todos | Pendiente: emitir por owner o Edge/RPC controlada | Evidencia solo si también hay bundle/audit |
| Evidence bundle | Backbone evidencia | `evidence_bundles` | `evidence_bundle.id`, hashes | Todos | Crear vía owner/documental, no desde panel genérico | Potencialmente verificable; paridad aún sensible |
| Audit trail | TGMS Core / backbone WORM | `audit_log` | `audit_log.id`, `hash_sha512` | Auditoría, SIEM, evidencia | Solo triggers/RPC owner | Verificable si cadena pasa `fn_verify_audit_chain` |

## 4. Pantallas y componentes

| Crear/modificar | Path | Objetivo | Mutaciones |
|---|---|---|---|
| Modificar | `src/pages/Dashboard.tsx` | Convertir `/` en primera consola ERP: bandeja integrada, contratos visibles y handoffs cross-module. | Ninguna |
| Crear | `src/components/arga-console/ErpConsolePanel.tsx` | Panel de composición read-only con work queue derivada y linaje de datos. | Ninguna |
| Crear | `src/lib/arga-console/contracts.ts` | Registro UI de ownership, source posture y journeys. No almacena datos operativos. | Ninguna |
| Futuro | `src/hooks/useArgaConsoleSearch.ts` | Búsqueda global contra owners con IDs canónicos. | Ninguna en fase 1 |
| Futuro | `src/hooks/useConsoleInbox.ts` | Bandeja unificada desde `notifications` + eventos owner. | Marcar leída en Core únicamente |
| Futuro | `src/hooks/useCrossModuleLinks.ts` | Leer/escribir links cuando exista paridad de `governance_module_links`. | Solo contrato shared |

## 5. Contratos cross-module requeridos

| Contrato | Uso prioritario | Payload mínimo | Estado |
|---|---|---|---|
| `governance_module_events` | Evento material de un módulo para otro | `tenant_id`, `source_module`, `source_table`, `source_id`, `event_type`, `target_module`, `entity_id`, `severity`, `payload_version`, `payload`, `created_at` | Requerido; no aparece en tipos generados locales al 2026-04-27 |
| `governance_module_links` | Relación persistente entre registros owner | `tenant_id`, `source_module`, `source_table`, `source_id`, `target_module`, `target_table`, `target_id`, `link_type`, `status`, `created_at` | Requerido; no aparece en tipos generados locales al 2026-04-27 |
| `evidence_bundles` | Consumir actas, certificaciones, controles o technical files como evidencia | `tenant_id`, owner IDs, manifest/hash, QTSP metadata, status | Existe; paridad de storage/hash/audit todavía sensible |
| `audit_log` | Trazabilidad WORM y SIEM | `tenant_id`, `object_type`, `object_id`, `action`, `delta`, `hash_sha512`, `previous_hash` | Existe; `fn_verify_audit_chain` figura como riesgo Track F |

Journeys prioritarios:

| Journey | Flujo | Escritura permitida |
|---|---|---|
| GRC incidente -> Secretaría agenda | GRC detecta incidente material, emite evento, Secretaría crea propuesta/expediente owner. | GRC emite evento/link; Secretaría muta expediente. |
| AIMS hallazgo -> GRC control/workflow | AIMS cierra evaluación o technical file con gap, GRC crea control/workflow owner. | AIMS emite evento/link; GRC muta control/workflow. |
| Secretaría certificación -> evidencia GRC/AIMS | Secretaría emite certificación, crea bundle/audit, GRC/AIMS consumen por `evidence_id`. | Secretaría/QTSP crea evidencia; consumidores solo referencian. |
| Sociedad seleccionada -> filtros globales | Consola propaga `entity_id` a owners. | Ninguna; filtros por ID canónico. |

## 6. Riesgos de paridad Supabase

| Riesgo | Impacto | Postura Track G |
|---|---:|---|
| `governance_module_links/events` no visibles en migraciones/tipos locales | Alto | Documentar contrato antes de UI persistente; no escribir links/events todavía. |
| `useModuleStatus()` usa GRC/AIMS legacy | Medio | Mantener lectura, etiquetar source posture como legacy y no mezclar con `grc_*`/`aims_*` sin Track D/E. |
| Scope textual no siempre equivale a `entity_id` | Alto | Fase 2 debe pasar a selector entidad canónica y query params compatibles. |
| Búsqueda global estática | Medio | Fase 2 debe leer owners por ID; mientras tanto no tratar sugerencias como fuente de verdad. |
| Evidence backbone incompleto | Alto | La consola no debe llamar evidencia verificable salvo bundle/hash/audit comprobados. |
| Worktree con cambios paralelos | Medio | Mantener cambios de Track G en paths propios y no tocar refactors de Secretaría. |

## 7. Plan incremental

### Fase G1 — Consola read-only con contratos visibles

- Añadir panel ERP en `/` con bandeja derivada de `notifications` + `useModuleStatus()`.
- Mostrar owner/fuente/postura de cada acción.
- Sustituir tareas locales UI-only por journeys/handoffs documentados.
- Sin schema nuevo, sin Supabase writes.

Verificación:

- `bun run db:check-target` como gate de entorno.
- `bunx tsc --noEmit --pretty false`.
- `bun run build`.

### Fase G2 — Scope canónico por entidad

- Evolucionar `ScopeContext` para transportar `entity_id`, jurisdicción y label.
- Reutilizar `entities` y `governing_bodies`; no crear scope paralelo.
- Propagar `entity_id` a rutas Secretaría/GRC/AIMS con query params o contexto compartido.

Verificación:

- Tests de selector y navegación por sociedad.
- Smoke entidad -> módulos con filtros aplicados.

### Fase G3 — Búsqueda global canónica

- Reemplazar sugerencias estáticas por queries owner con resultados tipados.
- Cada resultado debe incluir `owner`, `source_table`, `source_id`, `route` y `entity_id`.
- No indexar en tabla nueva hasta cerrar contrato de read model.

Verificación:

- Tests de búsqueda por entidad, acuerdo, incidente, sistema IA y evidencia.

### Fase G4 — Inbox y handoffs persistentes

- Cuando existan Cloud/local/types, añadir lectura de `governance_module_events` y `governance_module_links`.
- Handoffs persistentes solo mediante owner paths o contrato shared.
- Añadir schema probes para contratos.

Verificación:

- `db:check-target`, schema probes, typecheck, build.

## 8. Estado de esta tanda

Implementación G1 propuesta:

- Crear registro estático de contratos en `src/lib/arga-console/contracts.ts`.
- Crear `ErpConsolePanel` como panel read-only.
- Montar el panel en `Dashboard`.
- Reemplazar tareas locales demo por handoffs/journeys, evitando presentar datos UI-only como trabajo real.

Data posture:

- Source of truth: Cloud para Core/Secretaría existentes; legacy para GRC/AIMS actuales; none para contratos `governance_module_links/events` hasta paridad.
- Migration required: no.
- Types affected: no.
- Cross-module contracts: documentados, no persistidos.
