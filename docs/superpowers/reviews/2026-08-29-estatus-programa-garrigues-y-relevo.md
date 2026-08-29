# Estatus del programa Garrigues, consolidación y apertura de carriles

**Fecha:** 2026-08-29 · **Alcance:** adaptación de la consola ARGA (foco en Secretaría Societaria) al tenant real del grupo Garrigues.
**Método:** todo número de este documento se verificó contra git y contra Cloud (`supabase db query --linked`) el 2026-08-29. Donde algo no se pudo verificar, se dice.
**Estado del documento:** incorpora la validación cruzada con el informe independiente del usuario (§3) y la consolidación git⟷Cloud ya ejecutada (§2).

---

## 1. Situación en una frase

El programa tiene **seis fases funcionalmente completas** (G0–G6) y el motor de Secretaría terminado, pero **Secretaría no tiene ni un solo expediente recorrido**: 0 reuniones, 0 acuerdos, 0 convocatorias en el tenant. Ese es el entregable que falta para poder enseñar la herramienta al despacho sobre su propia casa.

---

## 2. Consolidación git⟷Cloud — EJECUTADA el 2026-08-29

**El problema que había:** G5, G6 y parte de G7 estaban aplicados en Cloud pero **sin versionar en git**. Cuatro migraciones y ~120 ficheros vivían solo en el árbol de trabajo, `UNTRACKED`. Un `git clean -fdx` los habría borrado. Es el mismo patrón que en julio escaló a ~370 ficheros y costó una fase entera de reconciliación.

**Lo que se hizo,** tras verificar que el árbol completo era coherente (lint, typecheck, test y build verdes):

| Commit | Contenido |
|---|---|
| `535f084` | **G5 — núcleo penal.** Catálogo de 82 delitos × 18 columnas, seed idempotente, migraciones `risks_assessed_band` y `grc_risk_sync_no_score`, UI de riesgo que respeta `NO_EVALUADA` en vez de inventar un 3×3 |
| `01e7c5e` | **G6 — ciberseguridad/SGSI/NIS2.** Módulo `cyber` con owner acreditado, obligaciones y controles vinculados a sus órganos técnicos; la no sujeción de los abogados a NIS2 queda registrada como exención etiquetada |
| `526eaa0` | **Resto del cuerpo en curso** (107 ficheros): G7/AIMS preparado y *no* aplicado a Cloud, SII y canal interno, shell standalone del desacoplamiento, y el resto de superficies GRC tocadas |

**Corrección aplicada durante la consolidación:** los seeds de G5 y G6 introducían 5 errores de lint (`no-unused-expressions`: ternarios usados como sentencia para incrementar contadores). `main` venía con 0 errores; se corrigieron a `if/else` antes de consolidar para no degradar el estándar.

**Excluido a propósito** (no es producto): `.agents/**` (artefactos de orquestación), `docs/context/**` (contexto de otra línea de trabajo), `pkcs11.txt`, y las carpetas de datos fuente `DOC GRC/`, `Gobernanza ia/`, `version garrigues/`.

**Resultado:** el árbol pasó de 188 a 74 entradas sucias, todas exclusiones deliberadas.

---

## 3. Validación cruzada con el informe independiente

Se contrastó punto por punto contra Cloud. **Los datos del informe son exactos**, incluido el detalle fino:

| Afirmación | Verificación |
|---|---|
| 82 delitos; 8 celdas de banda alta; único rojo en contrabando | ROJO=1 → *"Delito de contrabando"*; NARANJA=7 → **7+1=8** ✓ |
| 8 hallazgos · 34 controles · 28 obligaciones | ✓ exactos |
| Módulo `cyber` con owner "Comité de Seguridad y Privacidad" | ✓ literal en `grc_modules` |
| Aislamiento RLS verificado | el gate cubre `risks`, `controls`, `obligations`, `policies`, `entities` ✓ |
| 3.461 pass / 152 skip / 0 fail | ✓ (= 3.613 ejecutados − 152 skip) |
| UI sin inventar ejes probabilidad × impacto | ✓ 11 riesgos siguen en `NO_EVALUADA`; el prerrelleno 3×3 que persistía está corregido |

**Dos correcciones al informe:**

1. **"COMPLETADA AL 100 %" no se sostenía para G5/G6** en el momento del informe: no estaban en git, **no existe ledger SDD** para ninguna de las dos (sí lo hay para G2, G3 y G4) y el plan de G5 tiene 59 casillas sin marcar. Tras la consolidación de §2, la formulación correcta es: **funcionalmente completas, verificadas en Cloud y ya versionadas — pero sin haber pasado el ciclo de review adversarial** que sí pasaron G0–G4. Ese ciclo, en G3, cazó dos defectos que ninguna otra capa vio.
2. **Los 12 puntos del orden del día estaban mal descritos.** El informe los enumera como una Junta ordinaria genérica de SA ("aprobación de cuentas, informe de gestión, reelección de consejeros"). Los reales de la Junta de Garrigues de 2026 (spec §3.6) son otros: reelección del administrador único (punto 1.2), **exclusión / continuidad / admisión de socios**, Centro de Estudios, **integración de BSVV con aumento sin derecho de preferencia**, cuentas, sostenibilidad, gestión, auditor, **retribución de prestaciones accesorias**, delegación de facultades y acta. No es matiz de redacción: con los puntos genéricos, el caso canónico **no ejercitaría ninguna de las materias SLP que G3 construyó** ni dispararía el gate del informe preceptivo — justo lo que hace la demo defendible ante un mercantilista.

---

## 4. Coordenadas

| Qué | Valor |
|---|---|
| Repo | `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map` |
| Rama de consolidación | `feature/g5-nucleo-penal-garrigues` → pendiente de merge a `main` |
| `main` antes de consolidar | `f306a2a` (G0–G4) |
| Cloud | `governance_OS` · `hzqwefkwsxopwrmtksbg` · head **`20260820130000`** |
| Tenant Garrigues / ARGA | `…0002` / `…0001` |
| Login demo | `/login?tenant=garrigues` → `demo@garrigues-demo.dev` / `TGMSdemo2026!` |
| Gates | lint 0 · typecheck 0 · **3613 test / 152 skip / 0 fail** · build OK |

**Dato vivo en Cloud (tenant Garrigues):** 33 entidades · 22 órganos · 346 socios · 10 rule packs · 6 plantillas ACTIVA · 39 políticas · 28 obligaciones · 34 controles · 82 riesgos · **0 reuniones · 0 acuerdos**.
**ARGA intacto:** 59 packs, 72 plantillas, 52 órganos; aislamiento verificado bidireccionalmente.

---

## 5. Secretaría Garrigues: las cuatro capas

```
Capa 1 · Identidad y datos maestros ......................... COMPLETA (G0-G1)
         33 entidades con procedencia, theming por tenant
Capa 2 · Gobierno de la matriz .............................. COMPLETA (G2)
         346 socios, administrador único, 19 consultivas, CdA EAD
Capa 3 · Motor jurídico SLP ................................. COMPLETA (G3)
         10 rule packs con mayorías estatutarias reales (80% admisión,
         doble mayoría exclusión), gate del informe preceptivo del
         Consejo de Socios (art. 39.5.b), certificación del
         administrador único sin VºBº, 6 plantillas núcleo
Capa 4 · Expediente vivo — caso canónico §3.6 ............... PENDIENTE
         0 reuniones · 0 acuerdos · 0 convocatorias
```

**Qué falta exactamente:** materializar la Junta General de Socios real del **6 de mayo de 2026** — convocatoria a 15 días estatutarios (arts. 27.3/27.4) por comunicación individual, censo de 346 socios (3 presenciales + 343 representados, autocartera 2,59 % excluida), mesa Zarza/Delgado, **los 12 puntos reales** del orden del día (§3 corrección 2), acta, certificación del administrador único sin VºBº, y elevación con inscripción BORME del 13/07/2026. ARGA tiene su equivalente (UAT del 21/07); Garrigues no.

---

## 6. Carriles paralelos — diseño de la orquestación

Los tres carriles se abren **desde `main` ya consolidado**, con superficie deliberadamente disjunta.

| Carril | Objetivo | Superficie propia | Cloud |
|---|---|---|---|
| **C1 · Secretaría (prioridad alta)** | Caso canónico §3.6: la Junta de 2026 recorrida punta a punta | `src/pages/secretaria/**`, `src/lib/secretaria/**`, `scripts/seed-garrigues-junta*` | `meetings`, `agreements`, `convocations`, `minutes`, `certifications` |
| **C2 · AI Governance (G7/AIMS)** | Aplicar la migración preparada, catálogo de sistemas de IA, FRIA e incidentes multirégimen | `src/pages/ai-governance/**`, `src/lib/aims/**`, `src/hooks/useAims*` | `ai_*`, `aims_*`, migración `20260828190000` |
| **C3 · GRC / ESG / SII** | ESG del Informe de Sostenibilidad 2025, canal interno (Ley 2/2023) | `src/pages/grc/**`, `src/pages/sii/**`, `src/lib/grc/**` | `risks`, `findings`, `sii.*` |

### Reglas de no colisión (aprendidas a golpes en este repo)

1. **Rama por carril** desde `main` consolidado. Sincronización **solo** por `main`: quien cierra, mergea `--no-ff`; los demás integran `main` antes de seguir.
2. **`git add` solo con rutas de la propia superficie.** Nunca `-A`. El árbol es compartido y ya ha mordido dos veces.
3. **Fronteras de escritura en Cloud:** C2 escribe en `ai_*`/`aims_*`; C3 en `risks`/`findings`/`sii.*`; C1 en las tablas de expediente. **`obligations`, `controls`, `policies` y `grc_modules` quedan congelados** salvo que el carril lo pida y se anuncie — son la superficie compartida de G4/G5/G6.
4. **`CLAUDE.md` es zona caliente:** cada carril edita solo su bullet y **reconstruyendo desde HEAD** (patrón `git hash-object` + `update-index`), nunca sobre el árbol sucio.
5. **Cada carril lleva su ledger SDD** (`.superpowers/sdd/<plan>/progress.md`) y **review adversarial por tarea**. Es exactamente lo que faltó en G5/G6 y por lo que su "100 %" no era comparable con el de G0–G4.
6. **Verificación viva obligatoria antes de cerrar.** En G3 cazó dos defectos que ninguna review había visto.
7. **Canal Cloud:** `supabase db query -f <fichero> --linked`. Nunca `"$(cat …)"` — bash expandiría `$assert$`. Registrar la versión a mano en `supabase_migrations.schema_migrations`.

---

## 7. Decisiones pendientes del usuario

1. **Antelación real del CdA de EAD Trust** — hoy hay un placeholder etiquetado de 5 días (el art. 246 LSC no fija mínimo). El usuario es consejero de la entidad.
2. **Capital G2 → FIRME con el art. 7 de los Estatutos** — 694 participaciones clase A (16.000 €, 25 votos) + 8 clase B (1 €, 1 voto); Socio de Cuota = 2A; autocartera 18A = 450/17.358 = **2,59 % exacto**, que cuadra el acta al voto. Hoy los pesos individuales están `INFERIDO`. Pase corto, no ejecutado.
3. **Alcance del caso canónico:** ¿los 12 puntos completos o un subconjunto que ejercite las materias SLP y el gate preceptivo?

---

## 8. Deuda técnica catalogada

- **5 normalizadores de tipo social en paralelo**; unificarlos tocaría la semántica SAU/SLU de ARGA → aparcado a propósito.
- `min_majority_code` no expresa el 80 % ni la doble mayoría (techo del enum); la fórmula real sí se muestra desde el pack.
- Triple copia del payload de packs (SQL/seed/fixture) sin test de paridad.
- `votacion-engine` Gate 3 sin rama SLP explícita (pre-existente; el enrutado a SL funciona).
- `rule_pack_versions` con RLS `USING(true)` (pre-existente; el aislamiento real lo da `rule_packs`).
- `scripts/import-templates-batch.ts` legacy incompatible con los guards de activación (chip `task_c4341f17`).
- **G5 y G6 sin review adversarial ni ledger** — deuda de proceso, no de código.

---

## 9. Documentos de referencia

| Documento | Para qué |
|---|---|
| `CLAUDE.md` §"Tenant Garrigues" | estado consolidado con gotchas; se carga solo en cada sesión |
| `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` | spec maestra (§3.6 = caso canónico) |
| `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md` | dictamen + cotejo con los Estatutos vigentes |
| `docs/superpowers/specs/2026-08-20-g5-…` y `2026-08-20-g6-…` | diseños de las fases consolidadas |
| `.superpowers/sdd/2026-08-03-g3-motor-slp-garrigues/progress.md` | ledger de G3: el modelo a replicar en los carriles |
