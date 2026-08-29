# Estatus del programa Garrigues y prompt de relevo

**Fecha:** 2026-08-29 · **Alcance:** adaptación de la consola ARGA (con foco en el módulo Secretaría Societaria) al tenant real del grupo Garrigues.
**Método:** todos los números de este documento se verificaron el 2026-08-29 contra git y contra Cloud (`supabase db query --linked`), no contra memoria ni contra informes previos. Donde algo no se pudo verificar, se dice.

---

## 0. Lo primero que hay que saber (por orden de urgencia)

1. **Hay desfase git⟷Cloud ACTIVO y sin commitear.** Cuatro migraciones viven solo en el árbol de trabajo, `UNTRACKED`, fuera de `main` y fuera incluso de la rama actual. Tres de ellas **ya están aplicadas en Cloud**. Es el mismo patrón que en julio obligó a una reconciliación de 363 ficheros. Detalle en §5.1. **Atenderlo antes de abrir fase nueva.**
2. **El módulo Secretaría de Garrigues tiene el motor completo pero cero expedientes.** 0 reuniones y 0 acuerdos en el tenant. Todo lo que se enseña hoy es configuración y capacidad; no hay un solo recorrido de punta a punta como sí lo tiene ARGA. Detalle en §3.
3. `main` está verde y sincronizado: `f306a2a` == `origin/main`, typecheck 0, **3613 tests / 152 skip / 0 fail**.

---

## 1. Coordenadas

| Qué | Valor verificado |
|---|---|
| Repo | `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` |
| `main` == `origin/main` | `f306a2a` (merge de G4, 2026-08-16) |
| Rama actual | `feature/g5-nucleo-penal-garrigues` — **4 commits por encima de main, todos de documentación** (diseño+plan G5, diseño G6, prompt de arranque paralelo G6) |
| Cloud | `governance_OS` · `hzqwefkwsxopwrmtksbg` · head de migraciones **`20260820130000`** |
| Tenant Garrigues | `00000000-0000-0000-0000-000000000002` · matriz `00000000-0000-0000-0002-000000000001` |
| Tenant ARGA | `00000000-0000-0000-0000-000000000001` (intacto — ver §4) |
| Login demo | `/login?tenant=garrigues` → `demo@garrigues-demo.dev` / `TGMSdemo2026!` |
| Árbol de trabajo | 185 entradas sucias (mezcla de strays inertes y WIP de G5/G6 — ver §5.1) |

**Cronología real de merges a main** (reconciliada; hay sesiones trabajando en paralelo sobre este repo):

```
c3df611  2026-08-03  G0 fundación del tenant + theming
3ff431a  2026-08-03  G1 espejo societario (33 entidades)
4dd9c6f  2026-08-03  G2 gobierno de la matriz
c2b7a9b  2026-08-03  reconciliación del cierre de convocatoria (git ⟷ Cloud)
e376c86  2026-08-10  G3 motor jurídico SLP
f306a2a  2026-08-16  G4 sistema normativo interno + PBC/FT
```

---

## 2. Dato vivo en Cloud, por tenant (2026-08-29)

| Objeto | Garrigues | ARGA | Lectura |
|---|---|---|---|
| Entidades | 33 | — | perímetro societario completo |
| Órganos | 22 | 52 | 1 Junta + 2 CdA + 19 consultivas |
| Socios VIGENTE | 346 | — | censo real del acta 06/05/2026 |
| Rule packs | **10** | 59 | 4 de órgano + 6 por-materia |
| Plantillas ACTIVA | **6** | 72 | núcleo del tenant |
| Políticas | 39 | — | sistema normativo interno (G4) |
| Obligaciones | 28 | — | PBC/FT + las de G5 ya sembradas |
| Controles | 34 | — | PPD + G5 |
| Riesgos | **82** | — | mapa penal de G5 **ya sembrado en Cloud** |
| **Reuniones** | **0** | — | ⚠️ ningún expediente recorrido |
| **Acuerdos** | **0** | — | ⚠️ ídem |

---

## 3. El módulo Secretaría: qué está adaptado y qué no

Esta es la pregunta central. La adaptación se hizo por capas; tres de las cuatro están completas.

### 3.1 Capa de identidad y datos maestros — COMPLETA (G0–G2)

- Theming por tenant (`tenants.branding`), login `?tenant=garrigues`, shell verde, labels de grupo.
- 33 entidades con cadena de control y `data_provenance` (badges de procedencia gateados).
- Topología real: **Junta de Socios** (346 socios), **administrador único** (Vives, 2026→2032, I/A 960), **19 estructuras consultivas** con badge "Consultivo — no adopta acuerdos", **CdA de EAD Trust** (único colegiado).
- Capital canónico 11.104.008 €, 347 holdings, autocartera `is_treasury`, 2 libros, 2 delegaciones.
- Toda condición/censo entró por la RPC autoritativa `fn_designar_cargo`.

### 3.2 Capa de motor jurídico — COMPLETA (G3)

- `TipoSocial += 'SLP'` con identidad propia en toda superficie ("Sociedad Limitada Profesional", nunca "SL").
- **10 rule packs propios** del tenant. Los 6 por-materia llevan **mayorías estatutarias reales cotejadas**: admisión de socio 80 % (art. 30.3.b), exclusión con doble mayoría (arts. 30.2.g + 15 Ley 2/2007), resto 2/3 con su letra del art. 30.2.
- **Gate del informe preceptivo del Consejo de Socios**, vivo y discriminante: `INFORME_PRECEPTIVO_ORGANO`, BLOCKING en `PRE_CONVOCATORIA`, solo en la Junta de la matriz, con salida por plantilla. Base literal: art. 39.5.b de los Estatutos.
- Certificación del **administrador único sin VºBº** (art. 109 RRM + art. 31.3 Estatutos).
- 6 materias SLP `fail-closed` (jamás se ofertan a ARGA), consultivos fuera de los selectores de adopción.
- Convocatoria de Junta SLP: 15 días estatutarios (arts. 27.3/27.4), canal individual con la fórmula literal del 27.3.

### 3.3 Capa normativa y de cumplimiento — COMPLETA (G4)

39 documentos normativos con ownership real por comité y navegación bidireccional, 21 obligaciones PBC/FT con las 21 citas cotejadas contra el BOE, 23 controles del PPD, y ocultación de módulos no aplicables al perfil despacho (DORA, packs de país, Board Pack).

### 3.4 Capa de expediente vivo — **PENDIENTE**

Aquí está el hueco. **Garrigues tiene 0 reuniones y 0 acuerdos.** Existen el motor, las reglas, las plantillas, los gates y los datos — pero ningún expediente los ha recorrido. En concreto, no está hecho el **caso canónico §3.6**: la Junta de Socios real del 6 de mayo de 2026 (convocatoria 15 días → censo 346 con 3 presenciales + 343 representados → mesa Zarza/Delgado → 12 puntos del orden del día → acta → certificación del administrador único → elevación e inscripción con las fechas BORME reales del 13/07/2026).

ARGA sí tiene su equivalente (la Convocatoria integral UAT del 21/07/2026, con DOCX server-side y 9/9 anexos WORM). **Garrigues no.** Para una demo al despacho sobre su propia casa, este es el entregable de mayor valor pendiente: es lo único que convierte "tenemos las reglas de vuestra SLP" en "aquí está vuestra Junta de 2026 dentro del sistema".

---

## 4. Contrato "cero cambio ARGA"

Verificado y sostenido en las cuatro fases. ARGA conserva 59 packs, 72 plantillas ACTIVA y 52 órganos; no tiene `config.naturaleza`, ni `informe_preceptivo_de`, ni materias `soloTipoSocial`, ni `tipo_social='SLP'`. Los mecanismos nuevos son opt-in (`adoptingOnly`) o fail-closed (`soloTipoSocial`). La review final de G3 lo confirmó en datos, reglas, motor y visual.

---

## 5. Riesgos abiertos

### 5.1 Desfase git⟷Cloud (el importante)

Cuatro migraciones están en el árbol de trabajo **sin trackear en git**:

| Migración | En main | En Cloud |
|---|---|---|
| `20260820120000_risks_assessed_band.sql` | no | **sí, aplicada** |
| `20260820121000_grc_risk_sync_no_score.sql` | no | **sí, aplicada** |
| `20260820130000_g6_cyber_module_and_sync.sql` | no | **sí, aplicada** |
| `20260828190000_aims_multiregime_incidents_and_fria.sql` | no | no |

Cloud corre por delante de git otra vez. Los 82 riesgos del mapa penal y el módulo cyber de G6 ya viven en la base sin respaldo versionado. Además hay una migración de AIMS (`20260828…`) que sugiere trabajo de G7 en curso.

**Precedente:** en julio esto mismo escaló a ~370 ficheros y 48 migraciones no commiteadas, y hubo que dedicar una fase entera a reconciliar. La lección que quedó escrita: auditar coherencia (build + test), separar strays y consolidar por rutas específicas — **nunca `git add -A`**.

### 5.2 Deuda técnica catalogada (no bloqueante, ordenada por riesgo)

- **5 normalizadores de tipo social en paralelo** (`deriveTipoSocial`, `toTipoSocial` de `useAgreementCompliance`, los dos locales de los steppers, `useJurisdiccionRules`). Unificarlos tocaría la semántica SAU/SLU de ARGA → decisión pendiente, aparcada a propósito.
- `min_majority_code` no puede expresar ni el 80 % ni la doble mayoría (techo del enum); la fórmula real sí se muestra desde el pack.
- Triple copia del payload de packs (SQL/seed/fixture) sin test de paridad.
- `votacion-engine` Gate 3 sin rama SLP explícita (pre-existente; el enrutado a la rama SL funciona).
- `rule_pack_versions` con RLS `USING(true)` (pre-existente; el aislamiento real lo da `rule_packs`).
- `scripts/import-templates-batch.ts` legacy incompatible con los guards de activación (chip `task_c4341f17` creado).
- Enums del importer JSON sin SLP ni las materias nuevas (el seed las evita por diseño).
- Inventario completo de plantillas por materia: post-demo, el catálogo marca la cobertura honestamente.

---

## 6. Decisiones pendientes del usuario

1. **Antelación real del CdA de EAD Trust.** El pack lleva un placeholder etiquetado de 5 días (el art. 246 LSC no fija mínimo). El usuario es consejero de la entidad y puede dar la práctica real.
2. **Capital G2 → FIRME con el art. 7 de los Estatutos.** Los Estatutos dan el dato exacto: 694 participaciones clase A (16.000 €, 25 votos) + 8 clase B (1 €, 1 voto); Socio de Cuota = 2A; autocartera 18A = 450/17.358 votos = **2,59 % exacto**, que cuadra el acta al voto. Hoy los pesos individuales están `INFERIDO`. Pase corto propuesto, no ejecutado.
3. **Prioridad de fase:** cerrar el caso canónico de Secretaría (§3.4) frente a seguir con G5/G6/G7.

---

## 7. Fases restantes

| Fase | Estado | Contenido |
|---|---|---|
| **G5** Penal/PBC + ESG + hallazgos | **diseñada + plan escritos; datos ya en Cloud; código sin mergear** | mapa penal 82 delitos evaluados, ESG del Informe de Sostenibilidad 2025, hallazgos y conflictos |
| **G6** Ciberseguridad/NIS2 | **diseñada** (con prompt de arranque paralelo, restringido hasta que G5 mergee) | conclusión clave del diseño: **el despacho NO es sujeto de NIS2** — lo es su filial QTSP EAD Trust, y ni hoy, porque España no ha transpuesto |
| **G7** IA + riesgo tecnológico + certificaciones | pendiente (hay una migración AIMS en el árbol) | Comité de Gobernanza de la IA, ISO 27001, eIDAS de EAD |
| **G8** Vitrina EAD Trust + runbook | pendiente | ciclo colegiado completo del CdA de EAD; narrativa circular de cierre |
| **Carril B** BORME | activo, aditivo | histórico registral por sociedad |
| **Caso canónico §3.6** | **pendiente, sin fase asignada** | la Junta real de 2026 dentro del sistema (§3.4) |

---

## 8. Método de trabajo (para continuar igual)

- **subagent-driven-development**: plan por fase (`writing-plans`) → rama `feature/gN-…` → subagente fresco por tarea → review adversarial entre tareas → fix rounds → review final de rama → merge `--no-ff` + push.
- El **controller** (sesión principal) ejecuta todo lo que toca Cloud y la verificación viva; los subagentes nunca escriben en Cloud.
- Canal Cloud: `supabase db query -f <fichero> --linked`. **Nunca** `"$(cat …)"` (bash expandiría `$assert$`). Registrar la versión a mano en `supabase_migrations.schema_migrations`.
- `bun run db:check-target` antes de cualquier trabajo Cloud.
- `git add` **solo con rutas específicas**. El árbol es compartido.
- La verificación viva no es ceremonia: en G3 cazó dos defectos que ninguna review había visto (el colapso SLP→SL de los steppers y la resolución de packs por materia).

---

## 9. Documentos de referencia

| Documento | Para qué |
|---|---|
| `CLAUDE.md` §"Tenant Garrigues" | estado consolidado G0–G4 con gotchas — se carga solo en cada sesión |
| `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` | spec maestra del programa (§3.6 = caso canónico) |
| `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md` | dictamen + cotejo con los Estatutos vigentes (fuente de todo el contenido jurídico de G3) |
| `docs/superpowers/plans/2026-08-03-g3-motor-slp-garrigues.md` | plan de G3 con el detalle de cada gate |
| `docs/superpowers/specs/2026-08-20-g5-…` y `2026-08-20-g6-…` | diseños de las fases siguientes |
| `.superpowers/sdd/2026-08-03-g3-motor-slp-garrigues/progress.md` | ledger de G3: reviews, fixes y minors con su adjudicación |
