# C2 · AI Governance (G7/AIMS) del tenant Garrigues — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.
> Ledger obligatorio en `.superpowers/sdd/2026-08-29-c2-ai-governance-garrigues/progress.md`.
> Review adversarial por tarea. Steps con checkbox (`- [ ]`).

**Goal:** que `/ai-governance` con el login de Garrigues muestre el inventario de IA real del
despacho, su evaluación, su incidente y su FRIA, con el Comité de Gobernanza de la IA como órgano
rector y PI-30 como política rectora — y que **ninguna pantalla afirme un hecho regulatorio que no
esté en base de datos**.

**Architecture:** primero se **retira la afirmación falsa**, después se corrige y aplica la
migración, y solo al final se siembra contenido. El orden no es negociable: sembrar dato real bajo
una UI que hoy afirma "AESIA Notificada: SÍ" y fabrica sellos de EAD Trust convertiría un fixture
visible en una mentira creíble.

**Tech Stack:** React 18 + TS + TanStack Query v5 + Supabase (PostgREST + RLS), `bun test`,
tokens `--g-*`, seeds idempotentes service-role con `--apply`.

**Spec:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` §4 G7 + §5 D-4/D-5.
**Estatus de carriles:** `docs/superpowers/reviews/2026-08-29-estatus-programa-garrigues-y-relevo.md` §6.

---

## Global Constraints

- **Tenants:** ARGA `00000000-0000-0000-0000-000000000001` · Garrigues `00000000-0000-0000-0000-000000000002`.
- **Contrato de cero cambio para ARGA.** Toda corrección se mide también contra ARGA.
- **Superficie de escritura:** `src/pages/ai-governance/**`, `src/components/ai-governance/**`,
  `src/lib/aims/**`, `src/hooks/useAims*`, `src/hooks/useAi*`, `scripts/garrigues/ia/**`,
  `supabase/migrations/20260828190000*`. Cloud: `ai_*`, `aims_*`.
- **Congelado sin autorización nominal:** `obligations`, `controls`, `policies`, `grc_modules`,
  `CLAUDE.md` (fuera del bullet propio), `src/components/shell/**`, `src/components/garrigues-shell/**`.
- **`git add` solo por rutas.** Nunca `-A`: hay 74 entradas sucias ajenas que son exclusiones deliberadas.
- **Cloud:** `bun run db:check-target` antes de nada; `supabase db query -f <fichero> --linked`;
  **jamás `"$(cat …)"`**; registrar versión a mano en `supabase_migrations.schema_migrations`.
- **No-regresión (regla fijada por el orquestador, 2026-08-29):** **`0 fail` siempre.**
  Pass ≥ **3461** en el árbol del usuario (con los PDF de `version garrigues/`), ≥ **3457** en
  worktree limpio o CI — `g5-mapa-penal.test.ts:12` condiciona su `describe` a dos PDF que están en
  `.gitignore`, con 4 `it` dentro. **Decir siempre dónde se midió.** lint, typecheck (`tsc -b`) y
  build exit 0.
- **Sin rama y sin commit** hasta que el orquestador lo autorice: los tres carriles comparten un
  único directorio de trabajo, así que un `git checkout -b` movería el HEAD de los tres con 74
  entradas sucias encima; y CLAUDE.md prohíbe abrir worktrees para carriles paralelos sin
  autorización expresa del usuario. **Los `git commit` de cada tarea quedan en suspenso**: se
  ejecutan cuando llegue el OK, en el orden en que están escritos.
- **Probe de escritura contra `governance_OS`: se declara antes, jamás con service-role, y se cierra
  verificando residuo 0.** (Regla del orquestador tras el precedente de una sonda service-role que
  borró perfiles reales de ARGA.)
- **Política EAD Trust:** prohibido afirmar o fabricar QES, firma, sello, ERDS, envío o entrega.
- **Copy:** nada afirma conformidad, notificación a autoridad ni precinto salvo que exista la fila.

### Procedencia — tres niveles que no se funden

| Nivel | Significado | Uso |
|---|---|---|
| `PI-30_ART_3_1_1` | Norma interna vigente (PDF Edición 02, julio 2025) | Copilot, Harvey, Garrigues GA_IA |
| `DECLARADO_USUARIO` | Declarado por el usuario, sin respaldo documental en el corpus | Acuerdos enterprise OpenAI/Anthropic |
| `PLAN_NO_DESPLEGADO` | Roadmap, no producción | Soluciones agénticas |

---

## Hallazgos que este plan cierra (T0, ya ejecutado y en el ledger)

| # | Sev | Defecto | Cierra en |
|---|---|---|---|
| 1 | P0 | Las 10 políticas RLS de la migración hardcodean ARGA → Garrigues quedaría fuera | B1 |
| 8 | P0 | `useAimsMultiregime.ts:132` escribe `tenant_id` de ARGA | A1 |
| 7 | P0 | `useAimsTechnicalFile` declara ~13 columnas inexistentes; badge **"Sin PII" falso** | A3 |
| 15 | P0 | `EvaluacionNueva`: sin contestar nada persiste 84 findings **L5 ⇒ CONFORME** + `evidence_url` EAD Trust fija | A2 |
| 16 | P0 | `SistemaDetalle` **fabrica** `QSEAL-EADTRUST-…`/`TSQ-TSA-EU-…` en cliente y los escribe en BD | A3 |
| 17 | P0 | Pestaña FRIA: `AESIA Notificada: SÍ` literal, hashes inventados, art. 27 con texto asegurador | A4 |
| 9 | P0 | `filterSystemsByScope` filtra por vocabulario asegurador (mina latente: `branding.scopes` es NULL hoy) | A5 |
| 18 | P1 | `IncidenteDetalle`: relojes de constantes, `handleCloseRegimeSubcase` `try` vacío que **miente por toast** | A6 |
| 19 | P1 | `DeclaracionConformidadModal`: declara al despacho aseguradora en Castellana 259; "CONFORME Y VALIDADO" literal | A3 |
| 2 | P1 | Migración hornea `qseal_token`/`tsq_token`/`ERDS_EADTRUST` | B1 |
| 3 | P1 | Régimen DORA para un tenant al que D-5 le oculta DORA | B1 (decisión) |
| 12 | P1 | `incident-clocks`: DORA se autocontradice, rama 24h inalcanzable, **GDPR citado como art. 34** siendo art. 33 | A6 |
| 11/13 | P1 | Hooks FRIA/multirrégimen sin `tenantId` ni en la queryKey; `isAiHighRisk` ignorado | A1/A6 |
| 4 | P2 | `governance_body` texto libre con default `'COMITE_RIESGOS'`, sin FK | B1 |
| 10 | P2 | `aims_regulatory_clocks` = schema muerto | B1 |
| 14 | P2 | Tests que asertan literales del return; scope test que no cubre su única rama | A5/A6 |
| 20 | P2 | Sin ningún cableado al órgano rector ni a PI-30 | D1 |

**Cerrado en T0 sin trabajo pendiente:** D-4. El `42501` **ya no existe** (probe con login real:
INSERT en `ai_risk_assessments` devolvió `id`). **No se escribe migración RLS para D-4.**

---

## Decisión que NO tomo yo — para el orquestador / Comité Legal

**¿Aplica DORA al tenant Garrigues?** G4/D-5 **oculta** DORA en el perfil despacho
(`branding.modules` verificado en Cloud: 12 claves, DORA no está). G6 concluyó que el despacho no
es sujeto NIS2, y que quien lo sería es su filial QTSP EAD Trust. DORA obliga a entidades
financieras y alcanza a sus proveedores TIC críticos — que un QTSP que sirve a entidades
financieras caiga ahí es cuestión jurídica, no de ingeniería.

**Opción por defecto de este plan (conservadora):** el modelo multirrégimen se mantiene extensible,
se siembran **RIA + RGPD**, y DORA queda **explícitamente etiquetado "no evaluado — fuera del
alcance declarado"**, ni silenciosamente incluido ni silenciosamente borrado. Si el Comité Legal
dice otra cosa, cambia el seed, no el schema.

---

## File Structure

| Fichero | Responsabilidad | Fase |
|---|---|---|
| `src/hooks/useAimsMultiregime.ts` | quitar hardcode ARGA, tenant en clave y filtro | A1 |
| `src/hooks/useAimsFria.ts` | tenant en clave y filtro; dejar de tragarse el error | A1 |
| `src/hooks/useAimsTechnicalFile.ts` | alinear contrato de columnas con Cloud | A3 |
| `src/pages/ai-governance/EvaluacionNueva.tsx` | sin default L5, sin `CONFORME` por omisión, sin `evidence_url` fija | A2 |
| `src/pages/ai-governance/SistemaDetalle.tsx` | quitar sello fabricado; FRIA real; escalado desde `governing_bodies` | A3/A4/D1 |
| `src/components/ai-governance/DeclaracionConformidadModal.tsx` | identidad por tenant; sin literales de conformidad | A3 |
| `src/pages/ai-governance/IncidenteDetalle.tsx` | cablear dbRegimes, persistir campos, retirar toast falso | A6 |
| `src/lib/aims/readiness.ts` | `filterSystemsByScope` no asegurador; sin "Listo" con 0 dato | A5 |
| `src/lib/aims/incident-clocks.ts` | DORA coherente, art. 33, `isAiHighRisk` respetado | A6 |
| `supabase/migrations/20260828190000_…sql` | **reescritura completa** (no aplicada ⇒ no exige versión nueva) | B1 |
| `scripts/garrigues/ia/catalogo-ia.ts` | **única fuente de verdad** del inventario, con procedencia | C1 |
| `scripts/seed-garrigues-ia.ts` | seed idempotente service-role, dry-run por defecto | C1-C4 |
| `src/test/schema/garrigues-ia-seed.test.ts` | sonda catálogo⟷Cloud con login real | E1 |
| `src/test/schema/tenant-isolation.test.ts` | ampliar de 7 a ~10 tablas con las nuevas | E1 |

---

## FASE A — Retirar la afirmación falsa (antes de sembrar nada)

### Task A1: Purgar la contaminación ARGA de los hooks AIMS

**Files:**
- Modify: `src/hooks/useAimsMultiregime.ts:13,66,82,100,124,132`
- Modify: `src/hooks/useAimsFria.ts:4,100,104,112,133,147-152,161`
- Test: `src/hooks/__tests__/useAimsTenant.test.ts` (crear)

**Interfaces:**
- Consumes: `useTenantContext()` de `@/context/TenantContext` → `{ tenantId: string | null }`.
- Produces: los hooks aceptan y filtran `tenantId`; queryKeys pasan a
  `["aims_fria_assessments", tenantId, systemId]` y `["aims_incident_regimes", tenantId, incidentId]`.

- [ ] **Step 1: Test que falla — el write no debe llevar tenant hardcodeado**

```ts
import { readFileSync } from "node:fs";
it("ningún hook AIMS hardcodea un tenant_id", () => {
  for (const f of ["src/hooks/useAimsMultiregime.ts", "src/hooks/useAimsFria.ts"]) {
    const src = readFileSync(f, "utf8");
    expect(src, `${f} hardcodea un UUID de tenant`).not.toMatch(/00000000-0000-0000-0000-00000000000[12]/);
  }
});
it("los hooks AIMS llevan tenantId en la queryKey y enabled", () => {
  for (const f of ["src/hooks/useAimsMultiregime.ts", "src/hooks/useAimsFria.ts"]) {
    const src = readFileSync(f, "utf8");
    expect(src).toContain("useTenantContext");
    expect(src).toMatch(/enabled:\s*!!tenantId/);
  }
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `bun test src/hooks/__tests__/useAimsTenant.test.ts`
Expected: FAIL — `useAimsMultiregime.ts hardcodea un UUID de tenant`.

- [ ] **Step 3: Implementar**

Borrar `const DEMO_TENANT_ID = …` de ambos ficheros. En cada hook:

```ts
const { tenantId } = useTenantContext();
return useQuery({
  queryKey: ["aims_incident_regimes", tenantId, incidentId],
  enabled: !!tenantId && !!incidentId,
  queryFn: async () => {
    const { data, error } = await supabase
      .from("aims_incident_regimes").select("*")
      .eq("tenant_id", tenantId!).eq("incident_id", incidentId!);
    if (error) throw error;      // dejar de devolver null en silencio
    return data ?? [];
  },
});
```

En `useCreateIncidentReport`, `tenant_id: tenantId!` (nunca la constante) y `.eq("tenant_id", tenantId!)`
en los `update` que hoy filtran solo por `id`. Retirar imports muertos (`useMutation`/`useQueryClient`
sin usar en `useAimsFria.ts:1`, `useAuth` sin usar en `useAimsMultiregime.ts:124`).

- [ ] **Step 4: Verde + no-regresión**

Run: `bun test src/hooks src/lib/aims` → PASS. Luego `bun run typecheck` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAimsMultiregime.ts src/hooks/useAimsFria.ts src/hooks/__tests__/useAimsTenant.test.ts
git commit -m "fix(aims): los hooks dejan de escribir el tenant de ARGA y filtran por el del contexto"
```

**Aceptación:** grep de UUID de tenant en `src/hooks/useAims*` → 0 resultados; ambos hooks con
`useTenantContext` + `enabled: !!tenantId`; typecheck verde.

---

### Task A2: `EvaluacionNueva` deja de escribir conformidad no contestada

**Files:**
- Modify: `src/pages/ai-governance/EvaluacionNueva.tsx:125-155,214,239-257,429,437`
- Test: `src/test/aims/evaluacion-nueva-defaults.test.ts` (crear)

**Interfaces:**
- Consumes: `useCreateAssessment`, `useCreateComplianceChecks` de `@/hooks/useAiAssessments`.
- Produces: `buildEvaluationPayload(evaluations, measures)` exportada, pura, que **omite** las
  medidas no contestadas en vez de imputarles `L5`.

- [ ] **Step 1: Test que falla**

```ts
import { buildEvaluationPayload } from "@/pages/ai-governance/EvaluacionNueva";
it("una medida no contestada no se persiste ni cuenta como conforme", () => {
  const out = buildEvaluationPayload({}, [{ id: "M1", requirementId: "R1" }]);
  expect(out.findings).toHaveLength(0);
  expect(out.checks.every((c) => c.status !== "CONFORME")).toBe(true);
});
it("no se inventa evidencia de EAD Trust", () => {
  const out = buildEvaluationPayload({ M1: { maturity: "L3" } }, [{ id: "M1", requirementId: "R1" }]);
  expect(JSON.stringify(out)).not.toMatch(/eadtrust|sha512-compliance-verified/i);
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `bun test src/test/aims/evaluacion-nueva-defaults.test.ts`
Expected: FAIL — `expected length 0, received 1` (hoy imputa L5).

- [ ] **Step 3: Implementar**

Extraer la construcción del payload a `export function buildEvaluationPayload(...)`. Sustituir
`evaluations[m.id] || { maturity: "L5", … }` por un filtro: las medidas sin respuesta **no generan
finding**. El estado del requisito pasa a `NO_EVALUADO` salvo que todas sus medidas estén
contestadas. Eliminar el `evidence_url` fijo de EAD Trust (queda vacío o lo introduce el usuario).
Retirar los dos botones `prefillHighMaturity` / `prefillWithGaps` (`:429`,`:437`): un botón que
rellena 84 medidas con madurez inventada no tiene sitio en una consola que persiste.

- [ ] **Step 4: Verde**

Run: `bun test src/test/aims` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ai-governance/EvaluacionNueva.tsx src/test/aims/evaluacion-nueva-defaults.test.ts
git commit -m "fix(aims): una evaluación sin contestar deja de persistirse como CONFORME en L5"
```

**Aceptación:** enviar el formulario sin contestar nada crea 0 findings y 0 requisitos `CONFORME`;
grep de `eadtrust` en el fichero → 0.

---

### Task A3: Retirar el sello fabricado y la identidad aseguradora

**Files:**
- Modify: `src/pages/ai-governance/SistemaDetalle.tsx:220-227,441,466-477,627-658,700-703`
- Modify: `src/components/ai-governance/DeclaracionConformidadModal.tsx:45-46,63,65,147`
- Modify: `src/hooks/useAimsTechnicalFile.ts:9-15,22-30,36-42,51-53,63-66`
- Test: `src/test/aims/no-fabricated-seals.test.ts` (crear)

**Interfaces:**
- Consumes: columnas reales verificadas en Cloud — `aims_technical_file_sections(section_code,
  title, content jsonb)`, `aims_system_versions(version_label)`,
  `aims_monitoring_indicators(indicator_name, metric_key, threshold_config, last_observed_at)`,
  `aims_model_registry(model_version, intended_use)`,
  `aims_dataset_registry(source_system, lawful_basis, data_categories)`.
- Produces: tipos alineados con esas columnas; la UI deja de pintar campos inexistentes.

- [ ] **Step 1: Test que falla**

```ts
it("no se fabrican tokens de sello en cliente", () => {
  const src = readFileSync("src/pages/ai-governance/SistemaDetalle.tsx", "utf8");
  expect(src).not.toMatch(/QSEAL-EADTRUST|TSQ-TSA-EU/);
});
it("la declaración no afirma conformidad ni identidad aseguradora", () => {
  const src = readFileSync("src/components/ai-governance/DeclaracionConformidadModal.tsx", "utf8");
  expect(src).not.toMatch(/CONFORME Y VALIDADO|Entidad Aseguradora|Castellana 259/);
});
it("el expediente técnico no declara columnas inexistentes", () => {
  const src = readFileSync("src/hooks/useAimsTechnicalFile.ts", "utf8");
  for (const ghost of ["section_key", "completeness_score", "version_tag", "contains_pii"]) {
    expect(src, `columna fantasma ${ghost}`).not.toContain(ghost);
  }
});
```

- [ ] **Step 2: Ejecutar y ver fallar**

Run: `bun test src/test/aims/no-fabricated-seals.test.ts`
Expected: 3 FAIL.

- [ ] **Step 3: Implementar**

Borrar la fabricación `QSEAL-EADTRUST-SHA512-${Date.now()}` / `TSQ-TSA-EU-${Date.now()}` y el
UPDATE que los persiste; el botón pasa a **"Cerrar expediente técnico"** vía la RPC real
`fn_aims_close_technical_file` (única pieza del hook cuya firma sí coincide), y la UI dice
"Expediente cerrado", no "Precintado". En la Declaración, la entidad y la dirección salen del tenant
(`useTenantBranding` / `entities`), y el estado del expediente se **lee**, no se afirma. Alinear los
tipos del hook con las columnas reales; el badge "Sin PII" solo se pinta si hay valor —
**si no hay dato, "PII no declarada"**, nunca la afirmación positiva.

- [ ] **Step 4: Verde + typecheck**

Run: `bun test src/test/aims && bun run typecheck` → PASS / exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ai-governance/SistemaDetalle.tsx src/components/ai-governance/DeclaracionConformidadModal.tsx src/hooks/useAimsTechnicalFile.ts src/test/aims/no-fabricated-seals.test.ts
git commit -m "fix(aims): sin sellos fabricados, sin identidad aseguradora y con el contrato real de columnas"
```

**Aceptación:** los 3 tests en verde; ninguna pantalla afirma precinto, conformidad ni ausencia de
PII sin fila que lo respalde. **Medido también con ARGA**, que es a quien hoy le rompe.

---

### Task A4: La pestaña FRIA deja de ser fixture

**Files:**
- Modify: `src/pages/ai-governance/SistemaDetalle.tsx:713-975`
- Test: `src/test/aims/fria-no-fixture.test.ts` (crear)

**Interfaces:**
- Consumes: `useFriaBySystem(systemId)`, `useFriaDetails(friaId)` (ya existen, hoy pedido y no usado).
- Produces: la pestaña renderiza **empty state honesto** cuando no hay FRIA, y datos reales cuando la hay.

- [ ] **Step 1: Test que falla**

```ts
it("la pestaña FRIA no afirma notificación ni hashes inventados", () => {
  const src = readFileSync("src/pages/ai-governance/SistemaDetalle.tsx", "utf8");
  expect(src).not.toMatch(/AESIA Notificada:\s*S[ÍI]/);
  expect(src).not.toMatch(/APROBADA & NOTIFICADA/);
  expect(src).not.toMatch(/SHA512:\s*8f9a2b1c/);
  expect(src).not.toMatch(/dpo@empresa\.com|ai\.officer@empresa\.com/);
});
```

- [ ] **Step 2: Ejecutar y ver fallar** — Run: `bun test src/test/aims/fria-no-fixture.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Sustituir los literales por lectura de `useFriaDetails`. Sin FRIA en BD:
*"Este sistema no tiene evaluación de impacto en derechos fundamentales (art. 27 RIA) registrada."*
`market_surveillance_notified` se pinta desde la columna; si es `false` → **"No notificada"**.
Los 6 bloques del art. 27.1 salen de `aims_fria_*`; el texto asegurador de `:789-905` desaparece.
La sección de cruces FRIA⟷EIPD se alimenta de `aims_fria_dpia_cross_references` o no se muestra.

- [ ] **Step 4: Verde** — Run: `bun test src/test/aims` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ai-governance/SistemaDetalle.tsx src/test/aims/fria-no-fixture.test.ts
git commit -m "fix(aims): la pestaña FRIA lee el expediente real y deja de afirmar notificación a AESIA"
```

**Aceptación:** con 0 filas FRIA la pestaña muestra empty state; grep de `AESIA Notificada` → 0.

---

### Task A5: `filterSystemsByScope` deja de ser un filtro asegurador

**Files:**
- Modify: `src/lib/aims/readiness.ts:632,683-724`
- Modify: `src/lib/aims/__tests__/filter-systems-scope.test.ts`, `readiness.test.ts:66`

**Interfaces:**
- Produces: `filterSystemsByScope(systems, scope)` que **no filtra** salvo que el sistema declare
  ámbito explícito; el emparejamiento por vocabulario desaparece.

- [ ] **Step 1: Test que falla — la rama que hoy nadie prueba**

```ts
it("un inventario de despacho no se vacía en un scope con nombre de país", () => {
  const sys = [{ name: "Harvey", description: "asistencia jurídica" },
               { name: "Copilot", description: "ofimática" }];
  expect(filterSystemsByScope(sys, "España")).toHaveLength(2);
});
it("cero incidentes no es conformidad", () => {
  const r = buildAimsReadiness({ systems: [], incidents: [], assessments: [] });
  expect(r.domains.find((d) => d.id === "incidents")?.status).not.toBe("ready");
});
```

- [ ] **Step 2: Ejecutar y ver fallar** — Expected: FAIL, `received length 0` (los keywords aseguradores).

- [ ] **Step 3: Implementar**

Borrar los mapas de keywords. El filtro respeta un ámbito **declarado** en el sistema; si no lo hay,
devuelve todo. Y `readiness.ts:632`: con inventario vacío el dominio no puede decir "Listo" —
pasa a `status: "unknown"`, métrica **"Sin datos"**. Actualizar `readiness.test.ts:66`, que hoy
blinda la etiqueta obsoleta `"Sin schema nuevo"`.

- [ ] **Step 4: Verde** — Run: `bun test src/lib/aims` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aims/readiness.ts src/lib/aims/__tests__/filter-systems-scope.test.ts src/lib/aims/__tests__/readiness.test.ts
git commit -m "fix(aims): el scope deja de filtrar por vocabulario asegurador y 0 datos deja de pintar Listo"
```

**Aceptación:** los dos tests nuevos en verde; con `branding.scopes` sembrado, Garrigues sigue viendo su inventario.

---

### Task A6: Relojes de incidente correctos y sin notificación fingida

**Files:**
- Modify: `src/lib/aims/incident-clocks.ts:105,111-137,150,177`
- Modify: `src/pages/ai-governance/IncidenteDetalle.tsx:35-44,64-97,128-136,582`
- Modify: `src/lib/aims/__tests__/incident-clocks.test.ts:52-58`

**Interfaces:**
- Produces: `evaluateMultiregimeIncident({ knowledgeDate, classificationDate?, isAiHighRisk, affectsPii, isIctCritical })`
  → relojes cuyo `*DeadlineDate` **se comprueba**, no solo el literal de horas.

- [ ] **Step 1: Tests que fallan — hoy el de DORA es vacuo**

```ts
it("el reloj RGPD de 72h cita el art. 33, no el 34", () => {
  const r = evaluateMultiregimeIncident({ knowledgeDate: K, affectsPii: true, highRiskPii: true });
  expect(r.gdpr?.articleRef).toContain("33");
});
it("isAiHighRisk=false no emite reloj del art. 73 RIA", () => {
  expect(evaluateMultiregimeIncident({ knowledgeDate: K, isAiHighRisk: false }).ria).toBeUndefined();
});
it("las FECHAS de DORA se comprueban, no solo las horas", () => {
  const r = calculateDoraDeadlines(K, addHours(K, 23));
  expect(new Date(r.initialDeadlineDate).getTime() - new Date(K).getTime()).toBe(24 * 3600e3);
  expect(r.initialDeadlineHours).toBe(24);   // hoy devuelve 4 fijo: se contradice
});
```

- [ ] **Step 2: Ejecutar y ver fallar** — Expected: 3 FAIL (art. 34; reloj RIA emitido igualmente; `4 !== 24`).

- [ ] **Step 3: Implementar**

`articleRef` del reloj de 72h pasa a art. 33 RGPD (el art. 34, comunicación al interesado, no tiene
plazo de 72h y no debe etiquetar este reloj). `initialDeadlineHours` se **deriva** de la fecha
elegida, no es literal. `isAiHighRisk` deja de ser decorativo: si es `false` no hay reloj del art. 73.
En `IncidenteDetalle`, `riaSeverity`/`affectsPii`/`isIctCritical` salen del incidente y se persisten
en `handleSave`; se cablean `dbRegimes`/`useUpdateIncidentRegime`/`useCreateIncidentReport`; y
`handleCloseRegimeSubcase` **escribe de verdad o no existe** — el `try` vacío con
`toast.success("… notificado y archivado con acuse")` se retira. Nada de "acuse" sin acuse.

- [ ] **Step 4: Verde** — Run: `bun test src/lib/aims src/test/aims` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aims/incident-clocks.ts src/lib/aims/__tests__/incident-clocks.test.ts src/pages/ai-governance/IncidenteDetalle.tsx
git commit -m "fix(aims): relojes de incidente coherentes, art. 33 correcto y sin notificación fingida"
```

**Aceptación:** borrar el cálculo de fechas de DORA ahora **rompe** el test (hoy no); grep de
`toast.success` en `handleCloseRegimeSubcase` → 0.

---

## FASE B — Migración corregida y aplicada

### Task B1: Reescribir `20260828190000`

**Files:** Modify: `supabase/migrations/20260828190000_aims_multiregime_incidents_and_fria.sql` (256 líneas)
**Test:** `src/test/schema/aims-migration-shape.test.ts` (crear)

- [ ] **Step 1: Test que falla**

```ts
const sql = readFileSync("supabase/migrations/20260828190000_aims_multiregime_incidents_and_fria.sql", "utf8");
it("la RLS no hardcodea ningún tenant", () => {
  expect(sql).not.toMatch(/tenant_id = '00000000-0000-0000-0000-000000000001'/);
  expect((sql.match(/fn_current_tenant_id\(\)/g) ?? []).length).toBeGreaterThanOrEqual(10);
});
it("no hornea capacidades de firma ni ERDS", () => {
  expect(sql).not.toMatch(/qseal_token|tsq_token|ERDS_EADTRUST/);
});
it("el órgano de gobierno es una arista, no texto libre", () => {
  expect(sql).not.toMatch(/DEFAULT 'COMITE_RIESGOS'/);
  expect(sql).toMatch(/governance_body_id uuid REFERENCES governing_bodies/);
});
```

- [ ] **Step 2: Ejecutar y ver fallar** — Expected: 3 FAIL.

- [ ] **Step 3: Implementar**

Las 10 políticas pasan a `USING (tenant_id = public.fn_current_tenant_id()) WITH CHECK (…)`.
Se eliminan `qseal_token`, `tsq_token` y el valor `'ERDS_EADTRUST'` del comentario de
`submission_channel` (la política EAD Trust prohíbe hornear esas capacidades).
`aims_fria_remediation_governance.governance_body` → **`governance_body_id uuid REFERENCES
governing_bodies(id)`**, sin default: el ownership es arista o no es —lección del P0 de G4—.
`aims_regulatory_clocks` se conserva **solo si A6 la persiste**; si no, se retira del DDL en vez de
crear schema muerto. Cabecera: decir **5 componentes** y enumerar 27.1 (a)(b)(c)(d)(f), con nota de
que (e) queda pendiente de cotejo legal. Reconciliar el comentario de `clock_type` con la cabecera.
**El 27.1(e) no se resuelve aquí:** se cotejará contra el texto del Reglamento y, si queda duda, se
escala al orquestador para que lo eleve al Comité Legal. No se afirma de memoria.

- [ ] **Step 4: Verde + validación sintáctica** — Run: `bun test src/test/schema/aims-migration-shape.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260828190000_aims_multiregime_incidents_and_fria.sql src/test/schema/aims-migration-shape.test.ts
git commit -m "fix(aims): la migración aísla por fn_current_tenant_id y deja de hornear firma y ERDS"
```

**Aceptación:** los 3 tests verdes. **No se aplica todavía.**

---

### Task B2: Aplicar a Cloud y registrar

- [ ] **Step 1:** `bun run db:check-target` → PASS `governance_OS`.
- [ ] **Step 2:** `supabase db query -f supabase/migrations/20260828190000_aims_multiregime_incidents_and_fria.sql --linked`
      (**nunca** `"$(cat …)"`: bash expandiría `$assert$`).
- [ ] **Step 3:** registrar la versión a mano en `supabase_migrations.schema_migrations`.
- [ ] **Step 4: Probe de discriminación con DOS logins reales**, cada cliente con
      `{auth:{persistSession:false}}` (el preload de `bun test` comparte `storageKey`):
      Garrigues inserta y lee en las 10 tablas; **ARGA no ve esas filas**; y a la inversa.
      Un write cross-tenant filtrado devuelve **0 filas sin error**, no `42501`: la aserción es
      sobre filas, no sobre el código de error.
- [ ] **Step 5:** apuntar en el ledger el head remoto nuevo.

**Aceptación:** las 10 tablas existen; el probe bidireccional pasa; head remoto = `20260828190000`.

---

## FASE C — Contenido real de Garrigues

### Task C1: Catálogo del inventario de IA (única fuente de verdad)

**Files:** Create `scripts/garrigues/ia/catalogo-ia.ts`, `scripts/seed-garrigues-ia.ts`;
Test `scripts/garrigues/ia/__tests__/catalogo-ia.test.ts`

**Interfaces:**
- Produces: `SISTEMAS_IA: SistemaIA[]` con
  `{ code, name, vendor, system_type, risk_level, use_case, provenance, owner_body_slug }`,
  `provenance ∈ {"PI-30_ART_3_1_1","DECLARADO_USUARIO","PLAN_NO_DESPLEGADO"}`.

- [ ] **Step 1: Test que falla**

```ts
it("las herramientas corporativas vienen de PI-30 §3.1.1", () => {
  const corp = SISTEMAS_IA.filter((s) => s.provenance === "PI-30_ART_3_1_1").map((s) => s.name);
  expect(corp).toEqual(expect.arrayContaining(["Copilot", "Harvey", "Garrigues GA_IA"]));
});
it("lo declarado por el usuario no se presenta como norma interna", () => {
  const ent = SISTEMAS_IA.filter((s) => /OpenAI|Anthropic/.test(s.vendor ?? ""));
  expect(ent.every((s) => s.provenance !== "PI-30_ART_3_1_1")).toBe(true);
});
it("todo sistema apunta a un órgano por slug, no por UUID", () => {
  expect(SISTEMAS_IA.every((s) => /^garrigues-/.test(s.owner_body_slug))).toBe(true);
});
```

- [ ] **Step 2: Ejecutar y ver fallar** — Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar**

Congelar el catálogo. **Corporativas (PI-30 §3.1.1, Edición 02 julio 2025):** Copilot · Harvey ·
Garrigues GA_IA (con la excepción de las funcionalidades Gemini-Google, que se rigen por §3.2).
**`DECLARADO_USUARIO`:** acuerdos enterprise OpenAI y Anthropic — PI-30 **no los menciona** y
clasifica las versiones públicas de esos proveedores como no corporativas (§3.1.2): se etiquetan,
no se presentan como aprobadas por la política. **`PLAN_NO_DESPLEGADO`:** soluciones agénticas.
`owner_body_slug = "garrigues-comite-gobernanza-ia"`. El PDF fuente **no se commitea** (gitignored).

- [ ] **Step 4: Verde** — Run: `bun test scripts/garrigues/ia` → PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/garrigues/ia/
git commit -m "feat(ia): catálogo del inventario de IA de Garrigues con procedencia por niveles"
```

**Aceptación:** los 3 tests verdes; ninguna entrada `DECLARADO_USUARIO` marcada como PI-30.

---

### Task C2: Seed idempotente del inventario, evaluación, incidente y FRIA

**Files:** `scripts/seed-garrigues-ia.ts` (dry-run por defecto, `--apply` para escribir)

- [ ] **Step 1:** Dry-run: `bun run scripts/seed-garrigues-ia.ts` → imprime el plan, **0 escrituras**.
- [ ] **Step 2:** `--apply`: siembra `ai_systems` desde el catálogo; **una** evaluación real sobre el
      catálogo AESIA (12 requisitos / 84 medidas, ya verificado como TERMINADO) para el sistema de
      mayor exposición; **un** incidente con sus subexpedientes **RIA + RGPD** (DORA queda
      etiquetado "no evaluado — fuera del alcance declarado", pendiente de Comité Legal); y **una**
      FRIA art. 27 con `governance_body_id` = Comité de Gobernanza de la IA.
- [ ] **Step 3:** Reejecutar `--apply` → **0 filas nuevas** (idempotencia).
- [ ] **Step 4:** Commit por rutas.

**Aceptación:** doble ejecución sin duplicados; ARGA con exactamente las mismas filas que antes
(8/1/7), medido antes y después.

---

## FASE D — Órgano rector

### Task D1: Cablear el Comité de Gobernanza de la IA y PI-30

**Files:** `src/pages/ai-governance/Dashboard.tsx`, `SistemaDetalle.tsx:1138-1143`, `AiLayout.tsx`

- [ ] **Step 1: Test que falla** — el enlace debe ser arista, no rótulo:

```ts
it("la consola enlaza al órgano rector por slug y a PI-30", () => {
  const src = readFileSync("src/pages/ai-governance/Dashboard.tsx", "utf8");
  expect(src).toContain("garrigues-comite-gobernanza-ia");
  expect(src).toMatch(/PI-30/);
});
```

- [ ] **Step 2: Ejecutar y ver fallar** — Expected: FAIL (0 ocurrencias hoy).
- [ ] **Step 3: Implementar** — cabecera con "Órgano rector: Comité de Gobernanza de la Inteligencia
      Artificial" enlazando a `/organos/garrigues-comite-gobernanza-ia` (**slug**, gotcha G4 nº13) y
      "Política rectora: PI-30" a su ficha. El órgano se **lee** de `governing_bodies` filtrado por
      tenant: para ARGA no debe aparecer el comité de Garrigues. El selector de escalado de
      `SistemaDetalle:1138-1143` deja de ofrecer CdA/Comisión Ejecutiva/Comisión de Auditoría
      hardcodeados y lee `useBodiesByEntity`.
- [ ] **Step 4: Verde + typecheck.**
- [ ] **Step 5: Commit.**

**Aceptación:** navegando desde `/ai-governance` se llega a la ficha del comité y a PI-30 **haciendo
clic**. Recordatorio del P0 de G4: **verificar el rótulo no prueba la arista** — el gate es el enlace.

---

## FASE E — Gates y verificación viva

### Task E1: Sondas y aislamiento

- [ ] Crear `src/test/schema/garrigues-ia-seed.test.ts`: catálogo⟷Cloud con **login real**,
      cada cliente con `{auth:{persistSession:false}}`. **Sin fallback `|| ""` en la anon key**
      (deja la sonda en graceful-skip permanente: verde sin asertar nada).
- [ ] Ampliar `src/test/schema/tenant-isolation.test.ts` con las tablas nuevas, **comprobando antes
      que ambos tenants tienen filas reales** para que las aserciones no pasen de forma vacua.
- [ ] `bun test` completo contra la línea base **3461 / 152 / 0**; `lint`, `typecheck`, `build` exit 0.
      **Los gates se corren en árbol limpio**, y en el informe se dice dónde.

### Task E2: Verificación viva con control discriminante

- [ ] Login **Garrigues** → `/ai-governance`: inventario con las herramientas de PI-30, evaluación
      con su puntuación, incidente con relojes RIA/RGPD, FRIA enlazada al comité.
- [ ] Login **ARGA** en la misma pantalla → sus 8 sistemas, sin rastro de Garrigues.
- [ ] **Comprobar qué sesión está activa en el token antes de concluir de cada medición** (dos
      pestañas comparten `localStorage` y la `storageKey` de Supabase, y "Cerrar sesión" no tiene handler).
- [ ] Barrido final: ninguna pantalla afirma conformidad, notificación a autoridad, precinto ni
      ausencia de PII sin fila que lo respalde. Buscar con `\b…\b`: `document.body.innerText`
      devuelve el texto **ya transformado por CSS** y da falsos positivos por subcadena.

---

## Self-review

- **Cobertura de la spec §4 G7:** inventario real ✓ (C1/C2) · Comité rector + PI-30 ✓ (D1) ·
  evaluaciones ✓ (C2, D-4 ya resuelto en T0) · incidentes multirrégimen ✓ (A6/B/C2) · FRIA ✓ (A4/C2).
  **Fuera de este plan y declarado:** el alcance ampliado de G7 a riesgo tecnológico, SGSI ISO 27001
  y seguimiento de certificaciones cae en `risks`/`controls`, superficie **de C3**. No lo toco.
- **Cruce `ai_*` ⟷ `aims_*`: AUTORIZADO por el orquestador (2026-08-29), por precedente verificado.**
  Consultadas las FK aplicadas en Cloud: **hay 13 claves foráneas de `aims_*` hacia `ai_*`**, todas
  por `system_id → ai_systems` salvo `aims_incident_evidence_packs.incident_id → ai_incidents`.
  Entre ellas, `aims_technical_file_sections.system_id → ai_systems`. El cruce **no es una decisión
  arquitectónica nueva: es el patrón establecido del backbone ya aplicado**, y
  `aims_fria_assessments.system_id → ai_systems.id` lo sigue al pie de la letra. Queda el rastro de
  por qué se autorizó.
- **Placeholders:** ninguno; cada paso lleva su código o su comando.
- **Consistencia de tipos:** `filterSystemsByScope`, `buildEvaluationPayload`,
  `evaluateMultiregimeIncident` y `SistemaIA` se usan con la misma firma donde aparecen.
