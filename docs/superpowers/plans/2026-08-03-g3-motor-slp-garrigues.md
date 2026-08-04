# G3 — Motor jurídico Garrigues: SLP + unipersonal + gate preceptivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al tenant Garrigues un motor de reglas propio para su forma social real (SLP), su gobierno unipersonal (administrador único que certifica sin VºBº) y el gate procedimental del informe preceptivo del Consejo de Socios, de modo que la Secretaría deje de servir reglas/plantillas de ARGA y refleje la casa Garrigues con precisión jurídica.

**Architecture:** Se ensancha el tipo `TipoSocial` con `'SLP'` (forma de familia limitada: reutiliza los primitivos computacionales de SL —participaciones, quórum— pero con identidad legal propia y overlay Ley 2/2007 vía rule packs). Se siembran rule packs y materias propios del tenant Garrigues (`…0002`) sin heredar los 59 de ARGA. La cadena de certificación unipersonal ya está resuelta en la RPC (`fn_generar_certificacion` acepta `ADMIN_UNICO` con VºBº NULL); G3 cablea la UI y añade sonda. El gate de informe preceptivo se implementa extendiendo el framework existente `agreement_document_requirements` para que lea `governing_bodies.config.informe_preceptivo_de`.

**Tech Stack:** React 18 + TS relajado (noImplicitAny:false, strictNullChecks:false) + Vite + Supabase JS v2 + TanStack Query v5 + bun. Motor de reglas en `src/lib/rules-engine/` y `src/lib/secretaria/`. Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`).

## Global Constraints

- **CONTRATO "cero cambio ARGA":** el tenant ARGA (`00000000-0000-0000-0000-000000000001`) NO se altera ni en datos, ni en reglas, ni visualmente. `TipoSocial += 'SLP'` no cambia ninguna rama existente SA/SL/SLU/SAU. Los packs/materias nuevos van bajo el tenant Garrigues; las materias globales nuevas no rompen ARGA (que no las usa).
- **Tenant Garrigues** = `00000000-0000-0000-0000-000000000002`; **entidad matriz J&A Garrigues SLP** = `00000000-0000-0000-0002-000000000001`.
- **SLP NO es SL:** una SLP presentada como SL rompe la demo (audiencia = mercantilistas). SLP reutiliza primitivos SL donde la ley no diverge (participaciones, quórum), pero conserva label "Sociedad Limitada Profesional", referencia Ley 2/2007 de sociedades profesionales, y sus materias propias.
- **Órganos de administración unipersonales:** la matriz y las filiales españolas adoptan por `UNIPERSONAL_ADMIN`/`SOCIO_UNICO`; solo EAD Trust tiene CdA colegiado. `AdoptionMode`/`TipoOrgano`/`organo_tipo` son ejes ortogonales a `TipoSocial` y NO se tocan.
- **Certificación unipersonal (art. 109 RRM):** administrador único certifica SIN VºBº (`p_visto_bueno_persona_id` NULL). La RPC `fn_generar_certificacion` (vigente en `20260720120000_authoritative_legal_artifact_gates.sql:3736`) ya lo acepta y **rechaza** un VºBº no nulo para certificantes no-secretario. No redefinir la RPC.
- **No tocar el extractor de mayoría de ARGA:** `extractMajorityFromRulePackParams` (`rule-pack-params.ts:136`) solo lee primer nivel y los payloads reales anidan la mayoría bajo `votacion.mayoria`. Los packs Garrigues siguen ese shape (mayoría en `votacion.mayoria.{SA|SL|CONSEJO}`); la lectura efectiva la hace `branchFromPayload` (`materia-catalog-ux.ts:585`). No "arreglar" el extractor (Comité Legal).
- **Contenido legal RESUELTO por el Comité Legal (2026-08-04)** — registro canónico: `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md` (dos dictámenes; la versión demo es la operativa). Reglas vinculantes: (a) citas del overlay Ley 2/2007 **firmes a nivel de artículo** (13 transmisión / 14 separación / 15 exclusión + 16 reembolso / 4 composición / 8 inscribibilidad); (b) **granularidad**: artículo en la interfaz, apartado solo en comentario interno del payload; (c) la antelación de 15 días cita **SOLO la LSC supletoria** — la Ley 2/2007 no regula plazos de convocatoria y citarla ahí es el error que un mercantilista detecta en la demo; (d) la **doble mayoría NO es general**: el art. 4 es regla de composición (invariantes 4.2/4.3), la doble mayoría solo aplica a la exclusión (art. 15); (e) gate preceptivo = **4 materias** con etiqueta única `firmeza:"DEMO_PILOTO"` + `fuente:"ESTATUTOS_ART_21_1"`, **limitado a la Junta de la matriz**; el texto estatutario sigue sin obrar en el expediente → nunca presentar la lista como transcripción. La demo enseña el gate y la procedencia; lo estatutario queda etiquetado hasta cotejo (piloto).
- **`rule_packs.id` es TEXT PRIMARY KEY GLOBAL:** los packs Garrigues necesitan ids namespaced (prefijo `GARR_`) además de `tenant_id='…0002'`.
- **RLS verificada (pre-flight, 2026-08-03):** `rule_packs` en Cloud usa `USING (tenant_id = fn_current_tenant_id())` (per-tenant, NO hardcode ARGA). `rule_pack_versions` `SELECT USING(true)`. → packs Garrigues bajo `…0002` son legibles por el login Garrigues. `materia_catalog` NO tiene `tenant_id` (global). `entities.tipo_social` es TEXT sin CHECK (admite 'SLP' sin migración de columna).
- **Gates de cada fase:** `bun run db:check-target` (governance_OS) antes de tocar Cloud; `bun test`, `bun run lint`, `bun run typecheck` (`tsc -b`), `bun run build`. `tsc -b` cubre solo `src/` no-test (tests/scripts/edge/e2e fuera).
- **Árbol compartido:** usar `git add <rutas>` específicas, nunca `-A` (persisten strays `docs/context/*`, `pkcs11.txt`, `version garrigues/`). Gates que dependan de Cloud, medir en worktree limpio si el árbol se vuelve a ensuciar.

---

## File Structure

**Motor de tipos y normalización (Task 1–2):**
- Modify `src/lib/rules-engine/types.ts:16` — `TipoSocial += 'SLP'` (unión canónica).
- Modify `src/lib/secretaria/sociedad-onboarding/types.ts:1` — `TipoSocial += 'SLP'` (unión duplicada; fuente de `mesa-control-societaria.ts`).
- Modify `src/lib/secretaria/mesa-control-societaria.ts:710` — clave `SLP` en `LEGAL_BASELINE_BY_TIPO_SOCIAL` (rotura dura TS2741).
- Modify `src/lib/secretaria/prototype-rule-pack-fallback.ts:37,109,115` — `SLP` en `tipoSocialValues` y `antelacionDias` (rotura dura + hueco silencioso).
- Modify `src/lib/secretaria/sociedad-onboarding/defaults.ts:8,26-32` — `SLP` en `TIPO_SOCIAL_VALUES` y `legalFormFromTipo` (label "Sociedad Limitada Profesional").
- Modify `src/lib/secretaria/tipo-social.ts:24-33` — `deriveTipoSocial` reconoce SLP (no lo colapsa a "SL").
- Modify `src/lib/rules-engine/effective-rule.ts:89` — SLP mapea a rama de mayoría 'SL'.
- Modify `src/lib/secretaria/normative-framework.ts:225-235` — marco normativo SLP (Ley 2/2007 + LSC supletoria).
- Modify `src/pages/secretaria/sociedad-nueva/StepIdentificacionLegal.tsx:8-11` — opción SLP en el dropdown de alta.
- Test: `src/lib/rules-engine/__tests__/tipo-social-slp.test.ts` (nuevo).

**Rule packs y materias del tenant (Task 3–5):**
- Create `supabase/migrations/<ts>_g3_garrigues_rule_packs.sql` — packs bajo `…0002`, ids `GARR_*`.
- Create `supabase/migrations/<ts>_g3_slp_materias.sql` — materias SLP en `materia_catalog` (global).
- Modify `src/lib/secretaria/agenda-materias.ts:58+` — materias SLP en `AGENDA_MATERIAS`.
- Create `scripts/seed-garrigues-rule-packs.ts` — seed service-role idempotente (espejo del SQL).
- Test: `src/test/schema/garrigues-rule-packs-seed.test.ts` (sonda Cloud, nuevo).

**Cadena de certificación unipersonal (Task 6):**
- Modify `src/components/secretaria/EmitirCertificacionButton.tsx:162,322-324` — flujo ADMIN_UNICO (no exige VºBº, no envía presidente).
- Modify `src/pages/secretaria/ActaDetalle.tsx:1224+` — pasar `certificanteRole="ADMIN_UNICO"` cuando la entidad es de administración unipersonal.
- Test: `src/test/schema/garrigues-admin-unico-certificacion.test.ts` (sonda, nuevo) + `src/components/secretaria/__tests__/EmitirCertificacionButton-adminunico.test.tsx`.

**Gate informe preceptivo (Task 7):**
- Create `supabase/migrations/<ts>_g3_informe_preceptivo_gate.sql` — extiende `fn_refresh_agreement_document_requirements` para leer `governing_bodies.config.informe_preceptivo_de`.
- Create `src/lib/secretaria/informe-preceptivo-gate.ts` — helper puro que resuelve, dada una materia + órgano adoptante, si hay informe preceptivo pendiente.
- Modify `src/components/secretaria/AgreementDocumentRequirementsPanel.tsx` — superficie del requisito preceptivo.
- Test: `src/lib/secretaria/__tests__/informe-preceptivo-gate.test.ts` + `src/test/schema/garrigues-informe-preceptivo.test.ts` (sonda).

**Plantillas núcleo (Task 8):**
- Create `scripts/seed-garrigues-templates.ts` — decisión admin único, acta consignación, convocatoria/acta Junta, certificación, **informe del órgano informante a la Junta** (satisface el gate de Task 7).
- Test: `src/test/schema/garrigues-templates-seed.test.ts` (sonda).

**Cierre (Task 9):**
- Modify `CLAUDE.md` (sección Tenant Garrigues, patrón reconstruir-desde-HEAD si el árbol está sucio).

---

## Pre-flight (hecho al escribir el plan — no re-ejecutar)

- `db:check-target`: pass contra `governance_OS`.
- RLS `rule_packs` = per-tenant (`fn_current_tenant_id()`) — packs Garrigues legibles bajo `…0002`. Garrigues tiene 0 packs hoy; ARGA 59.
- `TipoSocial` canónica `types.ts:16` = `'SA'|'SL'|'SLU'|'SAU'`; duplicado `sociedad-onboarding/types.ts:1`. `tsc -b` rompe en exactamente 2 object-literals (`mesa-control-societaria.ts:710`, `prototype-rule-pack-fallback.ts:109`).
- `fn_generar_certificacion` (vigente) acepta ADMIN_UNICO con VºBº NULL y rechaza VºBº no-nulo para no-secretarios. `config.informe_preceptivo_de` no se lee en ningún sitio; el framework operativo es `agreement_document_requirements` + `fn_refresh_agreement_document_requirements` (ya emite `INFORME_PRECEPTIVO_MATERIA` por `matter_class`, no por config de órgano).
- **Sondas 2026-08-04 (post-dictamen):** slug del informante de nombramientos VERIFICADO en Cloud = `garrigues-comite-nominaciones` (sin "de"); `garrigues-consejo-de-socios` confirmado; NO existe comité de retribuciones entre las 19. `materia_catalog` sin colisión con las 6 materias nuevas (`NOMBRAMIENTO_ADMINISTRADOR_UNICO` no existe — las próximas: NOMBRAMIENTO_CONSEJERO/AUDITOR/CESE/REPRESENTANTE_FILIAL, ninguna sirve para admin único).

---

### Task 1: `TipoSocial += 'SLP'` — sweep de tipos hasta typecheck verde

**Files:**
- Modify: `src/lib/rules-engine/types.ts:16`, `src/lib/secretaria/sociedad-onboarding/types.ts:1`
- Modify: `src/lib/secretaria/mesa-control-societaria.ts:710`, `src/lib/secretaria/prototype-rule-pack-fallback.ts:37,109,115`, `src/lib/secretaria/sociedad-onboarding/defaults.ts:8,26-32`
- Test: `src/lib/rules-engine/__tests__/tipo-social-slp.test.ts`

**Interfaces:**
- Produces: `TipoSocial` incluye `'SLP'` en ambas uniones; `LEGAL_BASELINE_BY_TIPO_SOCIAL.SLP`, `prototype-rule-pack-fallback` con `SLP`, `legalFormFromTipo('SLP') === 'Sociedad Limitada Profesional'`.
- Consumes: nada de tareas previas.

- [ ] **Step 1: Escribir el test que fija el contrato SLP**

```typescript
// src/lib/rules-engine/__tests__/tipo-social-slp.test.ts
import { describe, it, expect } from "vitest";
import { LEGAL_BASELINE_BY_TIPO_SOCIAL } from "@/lib/secretaria/mesa-control-societaria";
import { legalFormFromTipo } from "@/lib/secretaria/sociedad-onboarding/defaults";
import { buildPrototypeRulePack } from "@/lib/secretaria/prototype-rule-pack-fallback";

describe("TipoSocial soporta SLP como forma limitada-profesional", () => {
  it("SLP tiene baseline legal (reutiliza primitivos de SL, identidad propia)", () => {
    const slp = LEGAL_BASELINE_BY_TIPO_SOCIAL.SLP;
    expect(slp).toBeDefined();
    // SLP reutiliza quórum/mayoría de la familia limitada
    expect(slp.quorumPrimeraConvocatoria).toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.quorumPrimeraConvocatoria);
  });
  it("legalFormFromTipo etiqueta SLP como Sociedad Limitada Profesional (no 'Limitada')", () => {
    expect(legalFormFromTipo("SLP")).toBe("Sociedad Limitada Profesional");
  });
  it("el rule pack de prototipo tiene antelación y canales para SLP", () => {
    const pack = buildPrototypeRulePack("SLP");
    expect(pack.convocatoria.antelacionDias.SLP).toBeDefined();
    expect(pack.convocatoria.canales.SLP).toBeDefined();
  });
});
```

> Nota: si `buildPrototypeRulePack` no existe con esa firma exacta, el implementer localiza el builder real en `prototype-rule-pack-fallback.ts` y adapta el test a su API (el objetivo es afirmar que `antelacionDias.SLP`/`canales.SLP` existen).

- [ ] **Step 2: Ejecutar el test — debe fallar** (`bun test src/lib/rules-engine/__tests__/tipo-social-slp.test.ts`). Esperado: falla por falta de `SLP`.

- [ ] **Step 3: Ensanchar las dos uniones**

```typescript
// src/lib/rules-engine/types.ts:16
export type TipoSocial = 'SA' | 'SL' | 'SLU' | 'SAU' | 'SLP';
```
```typescript
// src/lib/secretaria/sociedad-onboarding/types.ts:1
export type TipoSocial = "SA" | "SL" | "SAU" | "SLU" | "SLP";
```

- [ ] **Step 4: Cerrar las 2 roturas duras + 3 huecos silenciosos**

En `mesa-control-societaria.ts` (dentro de `LEGAL_BASELINE_BY_TIPO_SOCIAL`, tras la clave `SLU`), añadir `SLP` copiando los valores de `SL` (familia limitada) pero con `referenciaLegal` propia:
```typescript
  SLP: {
    // SLP: primitivos de la familia limitada (participaciones, quórum SL) con
    // identidad profesional. La divergencia real (transmisión/exclusión de socio
    // profesional, mayoría de socios profesionales) vive en los rule packs, no aquí.
    ...LEGAL_BASELINE_BY_TIPO_SOCIAL_SL_VALUES, // el implementer inlinea los mismos campos que la entrada SL
    referenciaLegal: "Ley 2/2007 de sociedades profesionales; LSC supletoria",
  },
```
> El implementer copia literalmente la forma del objeto `SL` de esa misma tabla (mismos campos: noticeDays, mayorías, quórums), cambiando solo `referenciaLegal`. No introducir un helper de un solo uso.

En `prototype-rule-pack-fallback.ts:37`: `const tipoSocialValues: TipoSocial[] = ["SA","SAU","SL","SLU","SLP"];`
En `prototype-rule-pack-fallback.ts:109-113` (`antelacionDias`): añadir `SLP: param(15, "art. 176 LSC (supletoria)"),` con el mismo `param(...)` helper del bloque (15 días = antelación de junta no-SA). **Comité Legal 2026-08-04: la referencia de antelación NUNCA cita la Ley 2/2007** — no regula plazos de convocatoria; solo LSC supletoria.

En `sociedad-onboarding/defaults.ts:8`: `const TIPO_SOCIAL_VALUES: TipoSocial[] = ["SA","SL","SAU","SLU","SLP"];`
En `sociedad-onboarding/defaults.ts:26-32` (`legalFormFromTipo`): añadir `SLP: "Sociedad Limitada Profesional",` al literal.

- [ ] **Step 5: Ejecutar typecheck** (`bun run typecheck`). Esperado: 0 errores. Si aparece un TS2741 nuevo, es otro `Record<TipoSocial>` no inventariado: añadir su clave `SLP` con el valor de la familia SL.

- [ ] **Step 6: Ejecutar el test — debe pasar** + `bun test` completo verde (no romper ARGA).

- [ ] **Step 7: Commit** (`git add` de los 6 ficheros + el test).

```bash
git add src/lib/rules-engine/types.ts src/lib/secretaria/sociedad-onboarding/types.ts src/lib/secretaria/mesa-control-societaria.ts src/lib/secretaria/prototype-rule-pack-fallback.ts src/lib/secretaria/sociedad-onboarding/defaults.ts src/lib/rules-engine/__tests__/tipo-social-slp.test.ts
git commit -m "feat(g3): TipoSocial soporta SLP (forma limitada-profesional)"
```

---

### Task 2: Normalizadores SLP — identidad legal propia, primitivos SL

**Files:**
- Modify: `src/lib/secretaria/tipo-social.ts:24-33` (`deriveTipoSocial`), `src/lib/rules-engine/effective-rule.ts:89`, `src/lib/secretaria/normative-framework.ts:225-235`
- Test: extender `src/lib/rules-engine/__tests__/tipo-social-slp.test.ts`

**Interfaces:**
- Consumes: Task 1 (`TipoSocial` con SLP).
- Produces: `deriveTipoSocial(entity)` devuelve `'SLP'` cuando `entities.tipo_social === 'SLP'` (no lo aplasta a `'SL'`); marco normativo SLP = Ley 2/2007 + LSC supletoria.

- [ ] **Step 1: Test** — añadir al fichero de Task 1:

```typescript
import { deriveTipoSocial } from "@/lib/secretaria/tipo-social";
it("deriveTipoSocial reconoce SLP y NO lo colapsa a SL", () => {
  expect(deriveTipoSocial({ tipo_social: "SLP" } as any)).toBe("SLP");
});
```

- [ ] **Step 2: Ejecutar — falla** (hoy `deriveTipoSocial` cae a `return "SL"` para SLP).

- [ ] **Step 3: Implementar** — en `tipo-social.ts:24-33`, añadir `"SLP"` a la whitelist de formas reconocidas (junto a SA/SL/SLU/SAU) antes del fallback `return "SL"`. En `effective-rule.ts:89`, extender el ternario para que `tipoSocial === 'SLP'` mapee a la rama `'SL'` de `mayoria` (`Record<'SA'|'SL'|'CONSEJO'>` es conjunto cerrado — SLP NO añade clave, mapea a 'SL'). En `normative-framework.ts:225-235`, añadir rama SLP que devuelva marco "Ley 2/2007 (sociedades profesionales) + LSC supletoria".

- [ ] **Step 4: Ejecutar test + typecheck + `bun test`** — verde.

- [ ] **Step 5: Commit.**

---

### Task 3: Rule packs del tenant Garrigues

**Files:**
- Create: `supabase/migrations/<ts>_g3_garrigues_rule_packs.sql`
- Create: `scripts/seed-garrigues-rule-packs.ts`
- Test: `src/test/schema/garrigues-rule-packs-seed.test.ts`

**Interfaces:**
- Consumes: Task 1 (SLP), tenant/entidad Garrigues (constantes en `scripts/garrigues/entities-catalog.ts` + `supabase-test-client.ts`: `GARRIGUES_TENANT`, `GARRIGUES_MATRIZ_UUID`).
- Produces: packs bajo `…0002` con ids `GARR_*`, legibles por el login Garrigues.

**Payload (shape obligatorio, mayoría anidada):** cada pack = `INSERT INTO rule_packs(id, tenant_id, materia, organo_tipo, descripcion)` + `INSERT INTO rule_pack_versions(pack_id, version, payload, is_active, status, effective_from)`. Payload JSONB con `votacion.mayoria.{SA|SL|CONSEJO}` (cada uno `{fuente, formula, referencia}`), `constitucion.quorum.{SA_1a,SA_2a,SL,CONSEJO}`, `convocatoria.{antelacionDias,canales,contenidoMinimo}`, `modosAdopcionPermitidos[]`, `acta.tipoActaPorModo`, `postAcuerdo{inscribible,instrumentoRequerido,...}`. Espejo del shape de `scripts/seed-rule-packs.ts:11-79`.

**Packs núcleo (4), ids namespaced:**
- `GARR_DECISION_ADMIN_UNICO` — materia genérica de decisión del administrador único; `organo_tipo='CONSEJO'` (el resolver lo mapea; adoption `UNIPERSONAL_ADMIN`); `modosAdopcionPermitidos:['UNIPERSONAL_ADMIN']`; `acta.tipoActaPorModo.UNIPERSONAL_ADMIN='ACTA_CONSIGNACION_ADMIN'`.
- `GARR_JUNTA_SOCIOS` — acuerdos de Junta de Socios; `organo_tipo='JUNTA_GENERAL'`; antelación 15 días (**referencia: "art. 176 LSC (supletoria)" — nunca Ley 2/2007**), canal individual con acuse (semántica EAD interposición, etiquetada; cita del canal: LSC supletoria + art. 27.3 Estatutos); mayoría bajo `votacion.mayoria.SL` + overlay socios profesionales con citas firmes (ver tabla del overlay).
- `GARR_SOCIO_UNICO_FILIAL` — decisiones de socio único de filiales; `organo_tipo='SOCIO_UNICO'`; `modosAdopcionPermitidos:['UNIPERSONAL_SOCIO']`.
- `GARR_CONSEJO_EAD` — CdA colegiado de EAD Trust; `organo_tipo='CONSEJO'`; `modosAdopcionPermitidos:['MEETING']`; quórum/mayoría de consejo.

**Overlay Ley 2/2007 — citas FIRMES (Comité Legal 2026-08-04, tabla completa en `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`):** como `rule_param_overrides` o dentro del payload, `fuente:'LEY'`, cada parámetro con su cita y redacción operativa:

| Parámetro | Referencia | Redacción (verbatim al sistema) |
|---|---|---|
| Transmisión participación socio profesional | `"art. 13 Ley 2/2007"` | Intransmisible salvo consentimiento de todos los socios profesionales, salvo que el contrato social lo module a mayoría de ellos |
| Separación socio profesional | `"art. 14 Ley 2/2007"` | Separación libre en sociedad de duración indefinida, eficaz desde la notificación, conforme a la buena fe |
| Exclusión socio profesional | `"arts. 15 y 16 Ley 2/2007"` | Acuerdo motivado de la Junta, causas legales o estatutarias; **doble mayoría** de capital y de socios profesionales; reembolso ex art. 16 |
| Mayoría socios profesionales | `"art. 4 Ley 2/2007"` | Composición: mayoría de capital y votos en socios profesionales (4.2); el administrador único ha de ser socio profesional (4.3). **NO presentar como mayoría general de acuerdos** — la doble mayoría solo rige la exclusión (art. 15) |
| Inscribibilidad cambio de socios | `"art. 8 Ley 2/2007"` | Cambios de socios y administradores en escritura pública e inscritos → sostiene `postAcuerdo.inscribible` |

Reglas: **granularidad** (artículo en strings visibles; apartados solo en comentarios internos del payload); **concentración** (la rama SLP de `normative-framework` es la fuente única — los packs remiten, no repiten literales); **no crear** parámetros de sucesión mortis causa ni socio no profesional (laguna documentada). Sonda extra recomendada (art. 4.3): Vives es ADMIN_UNICO ∧ figura en el censo de socios — verificable en Cloud.

- [ ] **Step 1: Escribir la sonda Cloud** (patrón graceful-skip de `garrigues-gobierno-seed.test.ts`):

```typescript
// src/test/schema/garrigues-rule-packs-seed.test.ts  (cabecera/beforeAll = patrón garrigues-gobierno-seed.test.ts)
it("Garrigues ve sus 4 packs núcleo bajo su tenant (RLS per-tenant)", async () => {
  if (!authed || !garr) { expect(true).toBe(true); return; }
  const { data, error } = await garr.from("rule_packs").select("id, organo_tipo").like("id", "GARR_%");
  expect(error).toBeNull();
  const ids = (data ?? []).map((r) => r.id);
  expect(ids).toEqual(expect.arrayContaining(["GARR_DECISION_ADMIN_UNICO","GARR_JUNTA_SOCIOS","GARR_SOCIO_UNICO_FILIAL","GARR_CONSEJO_EAD"]));
});
it("ARGA no ve los packs GARR_ (aislamiento) y conserva sus 59", async () => {
  if (!argaAuthed || !arga) { expect(true).toBe(true); return; }
  const { data: garrRows } = await arga.from("rule_packs").select("id").like("id", "GARR_%");
  expect((garrRows ?? []).length).toBe(0);
});
```

- [ ] **Step 2: Escribir la migración** con los 4 packs (payload completo, mayoría en `votacion.mayoria`), idempotente `WHERE NOT EXISTS`, tenant `…0002`. **Step 3:** escribir `scripts/seed-garrigues-rule-packs.ts` (espejo service-role idempotente, patrón `scripts/seed-garrigues-*.ts`, dry-run por defecto).

- [ ] **Step 4: (Controller) aplicar en Cloud** — `db:check-target`, luego aplicar la migración vía MCP `apply_migration` o el canal de reconciliación; verificar con la sonda logueada como Garrigues. **Step 5:** ejecutar la sonda — verde (Garrigues 4 packs, ARGA 59 intactos). **Step 6: Commit.**

---

### Task 4: Materias SLP nuevas en el catálogo

**Files:**
- Create: `supabase/migrations/<ts>_g3_slp_materias.sql`
- Modify: `src/lib/secretaria/agenda-materias.ts:58+`
- Test: `src/lib/secretaria/__tests__/agenda-materias-slp.test.ts`

**Interfaces:**
- Consumes: `materia_catalog` (global, sin tenant), Task 3 packs.
- Produces: materias SLP en `materia_catalog` + `AGENDA_MATERIAS`.

**Materias (6), exigidas por los 12 puntos de la Junta 2026 — clasificación RESUELTA por el Comité Legal (2026-08-04):**
- `ADMISION_SOCIO_CUOTA` (**ESTATUTARIA**, inscribible — art. 8 Ley 2/2007)
- `EXCLUSION_SOCIO_ESTATUTARIA` (**ESTATUTARIA**, inscribible) — retiro a los 60, art. 21.1.e Estatutos
- `CONTINUIDAD_SOCIO_POST_60` (**ESTATUTARIA**)
- `RETRIBUCION_PRESTACIONES_ACCESORIAS` (**ESTATUTARIA** — las prestaciones accesorias son estatutarias)
- `INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA` (**ESTRUCTURAL**, inscribible) — aumento sin derecho de preferencia
- `NOMBRAMIENTO_ADMINISTRADOR_UNICO` (**ORDINARIA**, inscribible) — punto 1.2 real de la Junta 2026 (cese + reelección de Vives, BORME I/A 960); NUEVA, no colisiona (sonda 2026-08-04: solo existen NOMBRAMIENTO_CONSEJERO/AUDITOR/CESE/REPRESENTANTE_FILIAL)

**Criterio del dictamen (vinculante): NINGUNA de las 4 materias de socio es ESPECIAL.** `filterAgreementCompatibleMaterias` excluye ESPECIAL del selector genérico; una materia reservada del gate preceptivo fuera del circuito general produciría un **falso negativo silencioso** (una Junta que acuerda sin informe porque el sistema nunca preguntó). ESPECIAL queda reservada a lo que tenga verdadero pathway propio.

⚠️ **Los cambios de clasificación tocan todos los read-paths** (routing de adopción, intakes `?materia=`, cobertura de plantillas). El revisor de esta tarea debe ser adversarial sobre: selectores del orden del día, `filterAgreementCompatibleMaterias`, la página CatalogoMaterias, y expresamente que **ninguna materia con informe preceptivo queda huérfana de pathway**.

- [ ] **Step 1: Test** — asserta que `AGENDA_MATERIAS` contiene las 6 materias con su `tipo` e `inscribible` correctos, y que las 4 materias de socio **pasan** `filterAgreementCompatibleMaterias` (son ESTATUTARIA, permanecen en el selector genérico — criterio vinculante del dictamen).
- [ ] **Step 2:** migración `INSERT INTO materia_catalog (...) ON CONFLICT (materia) DO UPDATE` (patrón `20260720128000_secretaria_informative_matter_taxonomy.sql`). **Step 3:** alta en `AGENDA_MATERIAS` (`agenda-materias.ts`), con `MATERIA_USAGE_NOTES` si aplica.
- [ ] **Step 4:** (Controller) aplicar migración en Cloud + verificar. **Step 5:** test + `bun test` verde. **Step 6: Commit.**

---

### Task 5: Parámetros de convocatoria de Junta SLP (H11)

**Files:**
- Modify: el pack `GARR_JUNTA_SOCIOS` (Task 3) — `convocatoria.antelacionDias.SLP=15`, `canales.SLP=[comunicación individual + acuse etiquetado]`.
- Test: `src/lib/rules-engine/__tests__/convocatoria-slp-junta.test.ts`

**Interfaces:**
- Consumes: Task 1 (`antelacionDias`/`canales` con clave SLP), Task 3 (pack Junta).
- Produces: `evaluarConvocatoria` para una Junta SLP exige 15 días y el canal individual con acuse (semántica EAD interposición, sin afirmar acuse como capacidad probada).

- [ ] **Step 1: Test** — `evaluarConvocatoria({ tipoSocial:'SLP', organoTipo:'JUNTA_GENERAL', ... }, [packGarrJunta], [])` devuelve `antelacionDiasRequerida === 15` y `canalesExigidos` incluye el canal de comunicación individual. Usar el patrón de `convocatoria-engine` tests existentes.
- [ ] **Step 2: Ejecutar — falla** si el pack no aporta los parámetros.
- [ ] **Step 3: Implementar** — completar el payload de `GARR_JUNTA_SOCIOS` con `convocatoria.antelacionDias` (incluida `SLP`, referencia `"art. 176 LSC (supletoria)"`) y `canales`. La antelación por defecto del motor para junta no-SA ya es 15 (`convocatoria-engine.ts:423`), así que el pack la confirma; el foco es el canal. **Cita del canal (Comité Legal): LSC supletoria + art. 27.3 Estatutos — nunca Ley 2/2007.** El "acuse" se modela con la semántica de `ead-channel-semantics.ts` (etiquetado como externalidad no verificada; NO afirmar acuse probado — el sanitizer lo despoja de las trazas EAD nuevas; el dictamen suscribe esta cautela: presentar como acreditado un acuse no trazado expondría la demo a una objeción de fondo).
- [ ] **Step 4: test + typecheck + `bun test`** verde. **Step 5: Commit.**

---

### Task 6: Cadena de certificación del administrador único (UI + sonda)

**Files:**
- Modify: `src/components/secretaria/EmitirCertificacionButton.tsx:162,322-324`
- Modify: `src/pages/secretaria/ActaDetalle.tsx:1224+`
- Test: `src/test/schema/garrigues-admin-unico-certificacion.test.ts` (sonda) + `src/components/secretaria/__tests__/EmitirCertificacionButton-adminunico.test.tsx`

**Interfaces:**
- Consumes: `fn_generar_certificacion` (ya acepta ADMIN_UNICO + VºBº NULL), `useGenerateAuthoritativeCertification` (`useActas.ts:431`).
- Produces: el botón, cuando `certificanteRole==='ADMIN_UNICO'`, envía `vistoBuenoPersonaId: null` **incondicionalmente** (no cae a `presidenteAE?.person_id`), y no bloquea por VºBº faltante.

- [ ] **Step 1: Test de componente** — montar `EmitirCertificacionButton` con `certificanteRole="ADMIN_UNICO"` y un `presidenteAE` mock no-nulo; afirmar que la llamada RPC recibe `vistoBuenoPersonaId: null` (no el del presidente). Esto cubre el **coupling latente** detectado: hoy la línea 322-324 cae a `presidenteAE?.person_id ?? null`, que con un presidente presente enviaría VºBº no-nulo y la RPC haría RAISE para un no-secretario.
- [ ] **Step 2: Ejecutar — falla** (hoy enviaría el presidente).
- [ ] **Step 3: Implementar** — en `EmitirCertificacionButton.tsx`:
  - Definir `const esAdminUnico = certificanteRole === "ADMIN_UNICO" || certificanteRole === "ADMIN_SOLIDARIO";`
  - En la construcción de `vistoBuenoPersonaId` (322-324): `vistoBuenoPersonaId: esAdminUnico ? null : (vistoBuenoAE?.person_id ?? presidenteAE?.person_id ?? null)`.
  - Mantener `flujoConVistoBueno = certificanteRole === "SECRETARIO"` (ya correcto: ADMIN_UNICO no exige VºBº).
- [ ] **Step 4: Cablear ActaDetalle** — cuando la entidad del acta es de administración unipersonal (derivar de `condiciones_persona`/config del órgano: existe `ADMIN_UNICO` VIGENTE y no hay CdA colegiado), montar el botón con `certificanteRole="ADMIN_UNICO"`. Para ARGA (SA con secretario+presidente) se mantiene el default `"SECRETARIO"` → **cero cambio ARGA**.
- [ ] **Step 5: Sonda Cloud** — verifica que, para la matriz Garrigues, `fn_generar_certificacion(p_certificante_role:'ADMIN_UNICO', p_visto_bueno_persona_id:null, ...)` NO lanza el error de VºBº (probar contra un acta demo apta o afirmar el contrato de la RPC con un probe que acepte cualquier error salvo el de VºBº). Patrón: probe de existencia/contrato, no mutación real si no hay acta apta.
- [ ] **Step 6: `bun test` + typecheck verde.** **Step 7: Commit.**

---

### Task 7: Gate de informe preceptivo del Consejo de Socios

**Files:**
- Create: `supabase/migrations/<ts>_g3_informe_preceptivo_gate.sql`
- Create: `src/lib/secretaria/informe-preceptivo-gate.ts`
- Modify: `src/components/secretaria/AgreementDocumentRequirementsPanel.tsx`
- Test: `src/lib/secretaria/__tests__/informe-preceptivo-gate.test.ts` + `src/test/schema/garrigues-informe-preceptivo.test.ts`

**Interfaces:**
- Consumes: `governing_bodies.config.informe_preceptivo_de: [{materia, organo_informante}]` (dato sembrado en G2 vía config; verificar/añadir), framework `agreement_document_requirements` + `fn_refresh_agreement_document_requirements` (`20260620045834_...:1430`).
- Produces: cuando la Junta adopta una materia reservada, se emite un requisito `INFORME_PRECEPTIVO_ORGANO` (fase `PRE_CONVOCATORIA`, `blocking_policy='BLOCKING'`) que exige el informe del órgano informante (Consejo de Socios / Comité de Nominaciones) antes de emitir.

**Contenido EXACTO de `config.informe_preceptivo_de` (Comité Legal 2026-08-04 — verbatim, slugs verificados en Cloud), sembrado SOLO en `garrigues-junta-socios`:**

```json
[
  { "materia": "ADMISION_SOCIO_CUOTA",             "organo_informante": "garrigues-consejo-de-socios",   "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" },
  { "materia": "EXCLUSION_SOCIO_ESTATUTARIA",      "organo_informante": "garrigues-consejo-de-socios",   "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" },
  { "materia": "CONTINUIDAD_SOCIO_POST_60",        "organo_informante": "garrigues-consejo-de-socios",   "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" },
  { "materia": "NOMBRAMIENTO_ADMINISTRADOR_UNICO", "organo_informante": "garrigues-comite-nominaciones", "fuente": "ESTATUTOS_ART_21_1", "firmeza": "DEMO_PILOTO" }
]
```

Reglas del dictamen: dos órganos informantes distintos a propósito (demuestra informante variable); las claves `fuente`/`firmeza` son metadatos transparentes al helper (que solo casa materia + adoptante Junta); **ámbito exclusivo de la matriz** — las filiales (unipersonales/socio único, sin Consejo de Socios; G-Advisory incluida) NO reciben `informe_preceptivo_de`; quedan fuera del gate demo la retribución de prestaciones accesorias, la designación de senior partner y el aumento sin preferencia (informe legal del admin único — art. 308 LSC — no estatutario del Consejo). Registro completo: `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`.

- [ ] **Step 1: Test del helper puro** — `informe-preceptivo-gate.ts` exporta `resolveInformePreceptivo(materia: string, organoAdoptante: string, config: BodyConfig): { requerido: boolean; organoInformante: string | null }`. Tests: `ADMISION_SOCIO_CUOTA` + Junta → `requerido:true, organoInformante:'garrigues-consejo-de-socios'`; `NOMBRAMIENTO_ADMINISTRADOR_UNICO` + Junta → `organoInformante:'garrigues-comite-nominaciones'` (informante variable); materia no reservada → `requerido:false`; órgano no-Junta → `requerido:false`; entradas con claves extra `fuente`/`firmeza` → transparentes (no rompen el matching).
- [ ] **Step 2: Ejecutar — falla.** **Step 3: Implementar** el helper puro (lee `config.informe_preceptivo_de`, casa materia + que el adoptante sea la Junta).
- [ ] **Step 4: Migración** que extiende `fn_refresh_agreement_document_requirements`: tras el bloque existente `INFORME_PRECEPTIVO_MATERIA` (línea ~1487), añadir un requisito `INFORME_PRECEPTIVO_ORGANO` cuando el `governing_bodies.config.informe_preceptivo_de` del órgano adoptante contiene la materia del acuerdo — `blocking_policy='BLOCKING'`, `fase='PRE_CONVOCATORIA'`, `template_binding_key='INFORME_PRECEPTIVO_ORGANO:'||agreement_kind`. Idempotente, forward-only, espejo en repo. NO tocar la rama `INFORME_PRECEPTIVO_MATERIA` existente (cero cambio ARGA: ARGA no tiene `informe_preceptivo_de` en sus órganos).
- [ ] **Step 5: Superficie UI** — `AgreementDocumentRequirementsPanel.tsx` ya renderiza requisitos por `blocking_policy`/`fase`; verificar que el nuevo `INFORME_PRECEPTIVO_ORGANO` aparece como bloqueante en PRE_CONVOCATORIA con copy que **nombra al órgano informante y explicita que el informe debe acompañar a la convocatoria** (razón jurídica de la fase: el informe ilustra el voto, debe estar a disposición de los socios con la convocatoria — coherente con el art. 308 LSC en el aumento sin preferencia). Añadir copy si falta.
- [ ] **Step 6: Consultivos no adoptan** — la frontera que el gate dibuja ("el Consejo de Socios informa, no acuerda") exige que ningún órgano `config.naturaleza='CONSULTIVO'` aparezca como órgano de adopción. Probe: con login Garrigues, revisar los selectores de órgano de los steppers de adopción/convocatoria (Convocatorias, Reuniones, Tramitador, AcuerdoSinSesion) — ¿ofrecen los 19 COMITE consultivos? Si sí: excluir `naturaleza==='CONSULTIVO'` en el punto común (candidato: `isOperationalSecretariaBody` en `src/lib/secretaria/operational-bodies.ts`, que ya filtra `useBodiesList`/`useEntityBodies`; si el filtro común rompiera ARGA, filtrar en los selectores). ARGA sin config → cero cambio. Test unitario del filtro.
- [ ] **Step 7: Sonda Cloud** — (Controller) aplicar migración; sembrar `config.informe_preceptivo_de` en `garrigues-junta-socios` (vía SQL con GUC autoritativo si `governing_bodies` está protegido, o UPDATE directo si no lo está); verificar que el gate **discrimina**: para CADA una de las 4 materias reservadas, un acuerdo demo adoptado por la Junta emite el requisito BLOCKING vía `fn_refresh_agreement_document_requirements`; una materia NO reservada (p.ej. `RETRIBUCION_PRESTACIONES_ACCESORIAS`, excluida a propósito) NO lo emite; un acuerdo ARGA equivalente NO lo emite.
- [ ] **Step 8: `bun test` + typecheck verde.** **Step 9: Commit.**

---

### Task 8: Plantillas núcleo del tenant

**Files:**
- Create: `scripts/seed-garrigues-templates.ts`
- Test: `src/test/schema/garrigues-templates-seed.test.ts`

**Interfaces:**
- Consumes: infraestructura de plantillas (`plantillas` / template-admin), tenant Garrigues.
- Produces: **5 plantillas núcleo ACTIVA** bajo el tenant Garrigues: decisión de administrador único, acta de consignación (admin único), convocatoria/acta de Junta de Socios, certificación (art. 109 RRM sin VºBº), y **informe del órgano informante a la Junta** (exigida por el dictamen: el gate de Task 7 bloquea con `template_binding_key='INFORME_PRECEPTIVO_ORGANO:'||agreement_kind` — sin plantilla que lo satisfaga, el requisito bloquea **sin salida**; cubrir el binding para las 4 materias reservadas; el informe estatutario no tiene forma legalmente tasada → tri-capa con contenido demo etiquetado).

- [ ] **Step 1: Sonda** — verifica que Garrigues ve las 5 plantillas ACTIVA por su `functional_key`/materia (incluida la de informe con su binding) y que ARGA no las ve (aislamiento por tenant).
- [ ] **Step 2:** `scripts/seed-garrigues-templates.ts` service-role idempotente (capa1 inmutable + capa2 variables + capa3 editables; contenido legal = demo etiquetado; el texto literal de la carta de convocatoria real de §3.6 como capa 1). Vía TemplateImportWizard (ADMIN_TENANT de G0) o seed directo.
- [ ] **Step 3:** (Controller) ejecutar seed en Cloud. **Step 4:** sonda verde. **Step 5: Commit.**

---

### Task 9: Verificación viva, gates y cierre de fase

**Files:** Modify `CLAUDE.md` (sección Tenant Garrigues — reconstruir-desde-HEAD si el árbol está sucio + misma edición al árbol).

- [ ] **Step 1: Gates completos** — `db:check-target`; `bun test`, `bun run lint`, `bun run build`; `bun run typecheck` (`tsc -b`, gate real). Si el árbol compartido está sucio, medir en worktree limpio.
- [ ] **Step 2: Verificación viva Garrigues** (preview): dar de alta / abrir una entidad SLP y comprobar que se presenta como "Sociedad Limitada Profesional" (no "Limitada"); en el Tramitador, un acuerdo de la Junta de Socios ya **no cae en `FALLBACK_ORGANO_DISTINTO`** (usa pack propio `GARR_JUNTA_SOCIOS`, sin aviso de procedencia "OTRO_ORGANO"); una certificación de la matriz se emite como **administrador único sin VºBº**; el **gate de informe preceptivo discrimina**: detiene la emisión de las materias reservadas, no detiene una no reservada, y **se satisface aportando el informe con la 5ª plantilla** (bloqueo con salida); la **mayoría de socios profesionales se muestra** en la ficha del acuerdo de exclusión (anida en `votacion.mayoria` y el extractor legacy no la lee — verificar que el camino `branchFromPayload` la exhibe; si no aparece, es hallazgo, no motivo para tocar el extractor); **ningún órgano consultivo se oferta como órgano de adopción** en los steppers. Screenshots.
- [ ] **Step 3: Verificación viva ARGA** — SA con secretario+presidente certifica igual que siempre (VºBº requerido); sus materias/packs/plantillas intactos; ningún gate preceptivo nuevo. Cero cambio.
- [ ] **Step 4: CLAUDE.md** — bullet G3 en la sección del tenant (SLP, packs propios Garrigues, cert admin único, gate preceptivo, plantillas núcleo; RLS per-tenant verificada; gotchas). **Step 5: Commit final.**

---

## Self-review del plan (hecho)

- **Cobertura spec §4 G3:** `TipoSocial += 'SLP'` + sweep (Task 1–2, con los 2 breaks + 3 huecos exactos del pre-flight) ✓ · rule packs del tenant con `organo_tipo` correcto y mayoría anidada sin tocar el extractor (Task 3) ✓ · overlay Ley 2/2007 como parámetros etiquetados (Task 3) ✓ · cadena de certificación unipersonal art. 109 RRM — RPC ya lista, se cablea UI + coupling latente `presidenteAE` + sonda (Task 6) ✓ · materias SLP nuevas de los 12 puntos de la Junta 2026 con review adversarial de read-paths (Task 4) ✓ · parámetros de convocatoria 15 días + canal individual (Task 5) ✓ · gate de informe preceptivo del Consejo de Socios extendiendo el framework real `agreement_document_requirements` (Task 7) ✓ · plantillas núcleo (Task 8) ✓ · el selector deja de caer en FALLBACK con packs propios (verificado en Task 9) ✓ · verificación viva con ARGA intacta (Task 9) ✓.
- **Placeholders:** RESUELTOS el 2026-08-04 — las dos decisiones legales abiertas (materias preceptivas, citas Ley 2/2007) están fijadas por dictamen del Comité Legal con contenido verbatim en el plan (JSONB de 4 entradas en Task 7, tabla de citas en Task 3) y registro en `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`. Solo queda etiquetado `DEMO_PILOTO` lo estatutario (el texto de los Estatutos no obra en el expediente — cotejo en piloto, fuera de G3). El valor `SLP` de `LEGAL_BASELINE` copia literalmente la entrada `SL` (Task 1 Step 4). Firmas y file:line vienen del pre-flight verificado.
- **Consistencia:** `TipoSocial` con SLP en ambas uniones (Task 1) consumido por normalizadores (Task 2), packs (Task 3), convocatoria (Task 5); ids `GARR_*` namespaced coherentes entre migración (Task 3) y sonda; `certificanteRole="ADMIN_UNICO"` coherente entre botón (Task 6) y RPC (ya vigente); `config.informe_preceptivo_de` coherente entre helper (Task 7 Step 3) y migración (Task 7 Step 4).
- **Riesgo transversal anotado:** el puente órgano→adoption_mode está duplicado en ≥6 sitios (no se centraliza en G3; se respeta el existente). Materias globales (sin tenant) visibles para ARGA pero no usadas por él (no rompe cero-cambio). Verificar en vivo que sembrar packs bajo `…0002` es legible (RLS per-tenant ya confirmada en pre-flight).
