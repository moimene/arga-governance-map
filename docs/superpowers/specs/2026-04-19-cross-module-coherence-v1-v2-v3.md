# Coherencia Cross-Module TGMS Platform — V1 / V2 / V3

**Fecha:** 2026-04-19
**Estado:** Referencia activa — actualizar en cada ciclo de desarrollo
**Aplica a:** Shell TGMS + Secretaría Societaria + GRC Compass + AI Governance (AIMS)

---

## 1. Principio fundamental

La plataforma no es cuatro módulos separados. Es un único sistema de gobernanza corporativa con cuatro lentes sobre los mismos datos. Un evento en un módulo DEBE ser visible y accionable en los demás.

**Ejemplo canónico**: Una no-conformidad en AI Governance (FraudGuard sin XAI) crea un hallazgo en GRC (HALL-011), que escala al CdA como punto de agenda en Secretaría, que aparece en el Board Pack generado desde Shell.

---

## 2. Mapa de datos compartidos (fuente única de verdad)

| Objeto | Propietario principal | Consumidores |
|---|---|---|
| `entities` | Shell | Secretaría (libro actas por entidad), GRC (perímetro de riesgos), AI Gov (catálogo de sistemas) |
| `governing_bodies` + `mandates` | Shell / Secretaría | Shell (governance map, composición), GRC (propietarios de controles), AI Gov (CATIT) |
| `persons` | Shell | Todos los módulos (owner_id, responsible_id, checked_by_id) |
| `policies` | Shell | GRC (fuente de obligaciones), Secretaría (aprobación CdA) |
| `obligations` | Shell / GRC | GRC (controles vinculados), Shell (countdown regulatorio), Secretaría (puntos de agenda) |
| `findings` (HALL-xxx) | Shell / GRC | Shell (dashboard alertas), GRC (planes de acción), Secretaría (agenda CdA), AI Gov (origen hallazgo) |
| `meetings` + `agenda_items` | Secretaría | Shell (Board Pack), GRC (items de cumplimiento), AI Gov (items de IA) |
| `attestations` | Shell | Secretaría (F&P campaña), Shell (dashboard idoneidad) |
| `delegations` | Shell | Secretaría (poderes notariales), Shell (matriz de autorización) |
| `ai_systems` | AI Gov | Shell (registro de sistemas), GRC (riesgo de modelo), Secretaría (informe CATIT al CdA) |
| `ai_compliance_checks` | AI Gov | GRC (findings HALL-011, HALL-012), Secretaría (puntos agenda) |
| `ai_incidents` | AI Gov | GRC (riesgo materializado), Secretaría (información CdA) |
| `incidents` | GRC | Shell (alertas dashboard), Secretaría (info CdA), regulatory_notifications |
| `controls` | GRC | GRC (cadencia testing), Shell (estado del control en Board Pack) |
| `regulatory_notifications` | Shell / GRC | Shell (countdown DORA), Secretaría (acción regulatoria en acta) |

---

## 3. Conexiones cross-module activas (V1 — estado 2026-04-19)

### 3.1 Shell ↔ GRC
| Evento origen (GRC) | Objeto vinculado | Visibilidad Shell |
|---|---|---|
| OBL-DORA-003 | INC-2026-001 → regulatory_notification BdE | Countdown activo en dashboard |
| HALL-008 (Crítico) | 6 action_plans (0-40% progreso) | Lista hallazgos, alerta dashboard |
| HALL-010 (Alto) | 2 action_plans (65-100%) | Lista hallazgos |
| HALL-011 (Alto) | Origen: AI Governance | Lista hallazgos, badge "AI Gov" |
| HALL-012 (Alto) | Origen: AI Governance | Lista hallazgos, badge "AI Gov" |
| CTR-008 (Inefectivo) | Vinculado OBL-SII-001 | Semáforo rojo en Board Pack sección controles |

### 3.2 GRC ↔ Secretaría
| Evento origen (GRC) | Objeto vinculado | Visibilidad Secretaría |
|---|---|---|
| HALL-008 Crítico | Agenda item #5 CDA-22-04-2026 | Punto de deliberación CdA |
| OBL-ORSA-001 nueva | Agenda item #8 CDA-22-04-2026 | Encargo CEO coordinación |
| INC-2026-001 (DORA) | regulatory_notification BdE activa | Información CdA en acta |
| INC-2026-002 (GDPR) → OBL-GDPR-001 | Vinculado en DB | Trazabilidad cumplimiento |

### 3.3 AI Governance ↔ GRC
| Evento origen (AI Gov) | Objeto vinculado (GRC) | Estado |
|---|---|---|
| FraudGuard AIA-13 No conforme | HALL-011 (severidad Alto) | Activo, due 2026-09-01 |
| ARGA Score sesgo (ai_incident) | HALL-012 (severidad Alto) | Activo, due 2026-06-30 |
| InvestmentAdvisor AIA-11 No conforme | — (pendiente HALL-013) | A crear en siguiente sprint |

### 3.4 AI Governance ↔ Secretaría
| Evento origen (AI Gov) | Objeto vinculado (Secretaría) | Estado |
|---|---|---|
| ai_incident sesgo ARGA Score | Agenda item #6 CDA-22-04-2026 | CATIT informa al CdA |
| Aprobación sistemas Alto Riesgo | — (pendiente: acuerdo CdA para ARGA Score) | A crear en siguiente sprint |

### 3.5 Shell ↔ Secretaría
| Evento origen (Shell) | Objeto vinculado (Secretaría) | Estado |
|---|---|---|
| PR-008 DORA Approval Pending | Agreement CDA-22-04-2026, CERTIFIED | Aprobación → certificación ✅ |
| F&P 2026 — 4 pendientes | Agenda item #7 CDA-22-04-2026 | Plazo 15 días |
| DEL-001 CADUCADA | — (pendiente renovación) | Alerta activa |

---

## 4. Roadmap V1 → V2 → V3 por módulo y dimensión

### V1 — Sistema de Registro (estado actual)
**Objetivo**: Todo queda registrado, trazado y visible. Cada objeto tiene su fuente de verdad. Las conexiones entre módulos son FK en base de datos.

| Dimensión | Shell TGMS | Secretaría | GRC Compass | AI Governance |
|---|---|---|---|---|
| **Entidades** | 26 entidades, jerarquía Fundación→Cartera→ARGA | Libro de actas por entidad | Perímetro de riesgo por entidad/jurisdicción | Sistemas IA catalogados por entidad |
| **Órganos/Personas** | 20 órganos, CdA 15 miembros tipificados (9I+5E+1D) | Sesiones, asistencia, secretaria | Propietarios de riesgos y controles | CATIT como órgano asesor, owners de sistemas |
| **Políticas/Normas** | 25 políticas (Políticas > Normas > Procedimientos) | Aprobación CdA + certificación | Fuente de obligaciones y controles | PR-024 IA Responsable |
| **Obligaciones** | 5 OBL con criticidad y country_scope | Puntos de agenda derivados | 8 controles vinculados a OBL | EU AI Act como marco OBL (6 requisitos Art. 9-17) |
| **Incidentes/Hallazgos** | HALL-008/010/011/012 en dashboard | Info CdA en actas + agenda | INC-DORA/GDPR/CYBER + 8 controles | ai_incident sesgo ARGA Score + 11 compliance checks |
| **Idoneidad** | 15 F&P 2026 (11 hechas, 4 pendientes) | Campaña + seguimiento secretaría | — | Declaraciones de conformidad AI Act |
| **Delegaciones** | 4 DEL: 1 caducada + 3 vigentes | Poderes notariales en libro | — | — |

**Gaps V1 a cerrar**:
- HALL-013: InvestmentAdvisor AIA-11 → finding GRC (pendiente)
- Acuerdo CdA aprobando sistemas IA Alto Riesgo (ARGA Score, FraudGuard) → Secretaría
- OBL-LGPD-001 y OBL-GDPR-001 sin policy_id vinculada

---

### V2 — Sistema de Acción (próximo desarrollo)
**Objetivo**: La plataforma no solo registra — activa workflows. Un evento crea tareas, notifica personas, actualiza estados automáticamente.

| Dimensión | Shell TGMS | Secretaría | GRC Compass | AI Governance |
|---|---|---|---|---|
| **Alertas automáticas** | Dashboard semáforo: hallazgos críticos, deadlines, F&P pendiente | Recordatorio convocatoria 21 días antes, recordatorio firma acta | Alerta propietario control próximo a vencer, finding sin plan >30 días | Alerta compliance check no conforme, drift modelo |
| **Board Pack** | Botón "Generar Board Pack" en reunión → PDF con 9 secciones de datos reales | Envío digital a consejeros, confirmación lectura | Sección riesgos + controles auto-incluida | Sección sistemas IA + compliance status |
| **Firma digital** | Certificaciones con hash blockchain | Actas + delegaciones con EAD Trust QES | Evidencias de control firmadas electrónicamente | Declaraciones EU AI Act firmadas |
| **Workflows cross-module** | Hallazgo CRÍTICO → crea agenda item CdA automáticamente | Acuerdo CdA aprobado → actualiza status policy en Shell | Control INEFECTIVO → crea finding + notifica propietario | AI non-conformity → crea finding GRC + notifica CATIT |
| **Calendario de gobernanza** | Vista anual: 8 CdA + 6 CACN + 4 Com.Sos. + deadlines regulatorios | Planificación sesiones anuales + book de convocatorias | Calendario testing controles (trimestral, semestral, anual) | Calendario re-evaluación sistemas IA (anual) |
| **Campaña F&P** | Estado en tiempo real por consejero | Envío automático, recordatorio +7 días, escalado Secretaria | — | Campaña paralela para responsables sistemas IA |

**Hitos de desarrollo V2** (estimados):
1. Board Pack generator (componente React + hook useBoardPackData) — 2 sprints
2. Notification engine (Supabase Edge Functions + Resend) — 1 sprint
3. Firma digital integration (EAD Trust Digital Trust API) — 2 sprints
4. Workflow rules engine (hallazgo → agenda automático) — 2 sprints
5. Calendario de gobernanza anual — 1 sprint

---

### V3 — Sistema de Inteligencia (roadmap 6-12 meses)
**Objetivo**: La plataforma anticipa, analiza y aconseja. Inteligencia regulatoria, modelos predictivos, IA generativa aplicada a gobernanza.

| Dimensión | Shell TGMS | Secretaría | GRC Compass | AI Governance |
|---|---|---|---|---|
| **Radar regulatorio** | Detecta nueva circular BdE/DGSFP → identifica políticas y obligaciones afectadas automáticamente | Notifica al Secretario General con sugerencia de punto de agenda | Gap analysis: nueva norma → controles faltantes sugeridos | EU AI Act updates → sistemas y compliance checks afectados |
| **IA generativa** | Asistente de gobernanza: "¿Qué riesgos tiene ARGA Turquía actualmente?" | Borrador de acta desde grabación de reunión + extracción automática de acuerdos y votaciones | Sugerencia de controles para riesgo nuevo basada en catálogo interno + benchmarks | Análisis de bias en modelo sin código, lenguaje natural |
| **Predictivo** | Score de madurez de gobernanza por entidad (0-100) | Predicción de quórum basada en histórico de asistencia | Probabilidad de materialización de riesgo basada en histórico de incidentes + indicadores externos | Drift detection: alerta cuando modelo se desvía >2σ del baseline |
| **Benchmarking** | Comparativa con peer group aseguradoras europeas (Allianz, AXA, Zurich) en indicadores de gobernanza | Benchmark tiempo preparación actas (ARGA vs. sector) | KPIs GRC vs. sector: ENISA, informes BdE sobre resiliencia operativa | Posicionamiento EU AI Act: % sistemas conformes vs. media sector |
| **Automatización IA** | Auto-clasificación de hallazgos por módulo y severidad | Auto-extracción de acuerdos desde PDF actas históricas | Control testing automático para controles IT (pentest, SAST) | Continuous compliance: re-evaluación automática cuando modelo se actualiza |

**Dependencias tecnológicas V3**:
- Integración con BORME, BOE, EUR-Lex para radar regulatorio
- Modelo fine-tuned en normativa aseguradora española (DGSFP, BdE, EIOPA)
- Pipeline MLOps para monitoreo de modelos de producción
- Integración con sistemas core asegurador para datos de siniestros/suscripción

---

## 5. Narrativa de presentación ante ARGA

### Lo que ven hoy (V1)
> "La consola captura y hace visible toda la actividad de gobierno del Grupo ARGA: quién decide qué, con qué autorización, bajo qué obligación regulatoria, y con qué evidencia. Real-time. Trazable. Auditable. Y coherente entre los cuatro frentes que gestionan sus equipos de gobernanza, cumplimiento, secretaría y transformación digital."

### Lo que viene (V2 — 6 meses)
> "El Board Pack del próximo CdA se genera en un clic desde los datos que ya están en la plataforma. Las declaraciones de idoneidad se firman digitalmente y llegan al consejero sin que Secretaría envíe un solo email manual. Cuando GRC detecta un hallazgo crítico, automáticamente aparece en la agenda de la próxima sesión del Consejo."

### La visión (V3 — 12 meses)
> "La plataforma lee la última circular de la DGSFP y le dice al Secretario General: estas tres políticas del Grupo necesitan revisión antes del 30 de septiembre, y este es el impacto por jurisdicción. El modelo que suscriba pólizas de vida en Brasil ya no puede operar sin que la consola confirme que cumple el EU AI Act — y eso se audita aquí."

---

## 6. Items pendientes por prioridad

### Alta prioridad (próxima sesión)
- [ ] HALL-013: InvestmentAdvisor AIA-11 → crear finding GRC
- [ ] Acuerdo CdA aprobando sistemas IA Alto Riesgo (ARGA Score, FraudGuard) en Secretaría
- [ ] Board Pack: spec técnica de componente React + hook `useBoardPackData`
- [ ] Jerarquía normativa: añadir campo `normative_tier` a tabla `policies`

### Media prioridad (siguiente sprint)
- [ ] OBL-LGPD-001 y OBL-GDPR-001: vincular a PR-009 (GDPR) y PR-003 (Cumplimiento)
- [ ] DEL-001 renovación: crear DEL-005 como renovación de poderes LATAM
- [ ] Calendario de sesiones anuales: meetings planificados para los próximos 12 meses
- [ ] Comisión de Riesgos Regulada: añadir reunión + agenda de Q2 2026

### Baja prioridad (backlog)
- [ ] Campos `normative_tier` en UI — mostrar jerarquía normativa en listado políticas
- [ ] Solvency II ratio 210.4% — añadir como dato en entidad ARGA Seguros
- [ ] Reuniones filiales (LATAM, España) — añadir 2-3 sesiones de CdA subsidiaria
