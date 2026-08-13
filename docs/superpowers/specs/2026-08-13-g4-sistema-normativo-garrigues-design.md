# G4 — Sistema normativo interno navegable + obligaciones y controles PBC/FT (tenant Garrigues)

**Fecha:** 2026-08-13 · **Estado:** diseño aprobado, pendiente de plan
**Consume:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` §4 G4, H12, D-5
**Precede a:** plan `docs/superpowers/plans/2026-08-13-g4-sistema-normativo-garrigues.md`
**Base:** G0–G3 mergeadas (`main` = `origin/main`, `b03b245`). Cloud head `20260810100000`.
**Fuentes:** `version garrigues/Garr_politicas/` (32 PDF de políticas internas, Código Ético 2023, PPD-01, Manual PBC/FT v.10 nov-2025 + Anexos, mapas evaluados 2025, páginas de SharePoint del Sistema Normativo Interno) + sondas en vivo sobre `governance_OS`.

---

## 1. Propósito

Que el catálogo normativo del despacho — sus 32 políticas internas, su Código Ético, su Programa de Prevención de Delitos y su Manual PBC/FT — se vea dentro de la consola **con su comité responsable real**, y que las obligaciones de la Ley 10/2010 y los controles del PPD existan como dato navegable y no como rótulo.

El criterio de éxito nº4 del spec maestro fija el listón: *"El catálogo normativo navega de política → comité responsable → personas"*. Navegar exige una clave foránea real; ningún texto libre la sustituye. Ese requisito manda sobre el resto del diseño.

## 2. Decisiones cerradas en esta sesión

| # | Decisión | Elección |
|---|---|---|
| G4-D1 | Modelado de ownership por comité | **Columna nueva `owner_body_id`** (FK a `governing_bodies`), no reutilizar `approval_body_id` ni conformarse con texto libre |
| G4-D1b | Alcance de `owner_body_id` | `policies` **+ `obligations` + `controls`** (corrección sobre la propuesta inicial de dos tablas: el spec exige ownership de los controles en CACI / Prevención de Delitos / Compliance, y `controls.owner_id` solo admite persona física) |
| G4-D2 | Contenido de las políticas | **Índice + objeto** extraídos del PDF (`summary` + `content_outline`). No se vuelca el texto íntegro de 32 documentos internos a la BD demo |
| G4-D3 | Profundidad PBC/FT | **Núcleo**: ~16 obligaciones reales de la Ley 10/2010 + la exención del art. 22, y ~15 controles del PPD y de las PI |
| G4-D4 | Ubicación de D-5 | **Mecanismo completo en G4**; G5 solo añadirá claves, sin maquinaria nueva |

## 3. Hechos verificados en vivo (no inferidos)

Sondas ejecutadas sobre `governance_OS` (`hzqwefkwsxopwrmtksbg`) el 2026-08-13, tras `bun run db:check-target` en verde.

**3.1 — RLS ya está saneada. No hay bloqueante.**
`policies`, `policy_agreements`, `obligations`, `controls`, `evidences`, `risks` y `findings` tienen todas `USING (tenant_id = fn_current_tenant_id())`, rol `authenticated`. El literal `'…0001'` que aún se lee en el texto de `20260419173010_b1_rls_all_domain_tables.sql` fue reescrito en ejecución por el barrido dinámico `20260516120002_f1_g1_replace_hardcoded_policies.sql`, cuyo bucle `DO` no nombra tablas y por eso no aparece en un `grep` por nombre. **Una exploración por grep concluyó lo contrario; la sonda la desmiente.** Ninguna de estas policies declara `WITH CHECK`, de modo que en INSERT Postgres reutiliza la expresión `USING` — comportamiento correcto para el caso de dos tenants.

**3.2 — Bloqueante real: `grc_modules` vacío para Garrigues.**
`tg_sync_obligation_to_backbone` y `tg_sync_control_to_backbone` están vivos sobre `obligations` y `controls`. La función deduce `module_id` por prefijo de código y, si no existe para el tenant, **cae a `'risk'` sin volver a comprobar que ese módulo exista**. `grc_modules` tiene 13 filas, **todas de ARGA y ninguna de Garrigues**, así que el primer `INSERT INTO obligations` del tenant 2 muere por la FK `grc_obligations_tenant_id_module_id_fkey`. Debe sembrarse `grc_modules` para `…0002` **antes** de cualquier obligación.

**3.3 — El trigger fabrica ownership falso.** Escribe literales `'Compliance Manager'`, `'Control Owner'` y `'Mensual'` en `grc_obligations`/`grc_controls`. Ninguna superficie del frontend lee esas tablas (`grep` de `grc_obligations|grc_controls` en `src/` → 0), así que no contamina la demo. Queda **anotado como deuda declarada**, no descubierto más tarde.

**3.4 — Punto de partida limpio.** Garrigues: 0 políticas, 0 obligaciones, 0 controles, **22 `governing_bodies`** ya sembrados por G2. ARGA: 25 políticas, 5 obligaciones, 8 controles, 4 evidencias, 167 riesgos, 52 órganos. Esas cifras de ARGA son el contrato de no-regresión.

**3.5 — Constraints reales (verificadas contra el catálogo, no contra el repo).**

| Tabla | Constraint | Valores admitidos |
|---|---|---|
| `controls` | `controls_status_check` | `Efectivo` · `Parcial` · `Inefectivo` |
| `evidences` | `evidences_status_check` | `Aprobada` · `Rechazada` · `Pendiente` |
| `obligations` | `obligations_criticality_check` | `Crítico` · `Alto` · `Medio` · `Bajo` |
| `policies` | `policies_status_check` | 8 estados (`Draft` … `Archived`) |
| `policies` | `policies_normative_tier_check` | `POLITICA` · `NORMA` · `PROCEDIMIENTO` · `DOCUMENTO` |
| `policies` | `policies_scope_level_check` | `Corporate` · `Country` · `Entity` |

Dos desalineaciones que el seed debe respetar y la UI corregir: la interfaz pinta `Deficiente` y `No probado` para controles, y `Validada` y `Vencida` para evidencias — **valores que el CHECK rechaza en INSERT**. El bucket "DEFICIENTE" del filtro y del KPI de `/obligaciones` es hoy código muerto.

**3.6 — No existe ninguna unicidad sobre `policy_code`**, ni siquiera `(tenant_id, policy_code)`. Re-ejecutar un seed duplicaría filas en silencio, y `usePolicyByCode` usa `.maybeSingle()`, que falla con más de una fila: la página de detalle se rompería para el código duplicado.

**3.7 — Los 22 slugs de órgano de Garrigues, verificados.** Existen todos los comités que el mapa de ownership necesita: `garrigues-comite-practica-profesional`, `garrigues-caci`, `garrigues-comite-prevencion-delitos`, `garrigues-departamento-compliance`, `garrigues-comite-editorial-global`, `garrigues-comite-gobernanza-ia` (dependencia dual), `garrigues-comite-seguridad-privacidad`, `garrigues-oficina-dpo`, `garrigues-oficina-tecnica-seguridad`, `garrigues-comision-igualdad`, `garrigues-comite-sostenibilidad`, entre otros. **No existe ningún órgano "SII"**: PI-31 es la política rectora del módulo SII, no la competencia de un comité homónimo.

**3.8 — El inventario real son 32 PI, no 30.** `PI-01`…`PI-32`, completo en `OneDrive_1_2-8-2026 (1).zip`. La cifra "30 PI" del spec maestro es aproximada y queda corregida aquí. `pdftotext` extrae correctamente: la primera página de cada PI trae `Edición NN, mes AAAA`, el apartado "Objeto" y el índice de secciones.

## 4. Modelo de datos

Una sola migración forward-only, `20260813120000_g4_normative_ownership.sql`, con el contrato de G1/G2/G3: **columnas nuevas nullable, ARGA NULL ⇒ cero cambio visual**.

| Tabla | Columna | Tipo | Motivo |
|---|---|---|---|
| `policies` | `owner_body_id` | `uuid REFERENCES governing_bodies(id)` | Comité **responsable**, semánticamente distinto de `approval_body_id` (quién aprueba) |
| `policies` | `summary` | `text` | Apartado "Objeto" del PDF |
| `policies` | `content_outline` | `jsonb` | Índice de secciones del PDF |
| `obligations` | `owner_body_id` | `uuid REFERENCES governing_bodies(id)` | Hoy `obligations` no tiene **ninguna** columna de ownership |
| `obligations` | `legal_reference` | `text` | Artículo concreto. Hoy solo hay `source`, un texto libre |
| `obligations` | `periodicity` | `text` | PBC/FT es intrínsecamente periódico (formación anual, examen externo anual) |
| `controls` | `owner_body_id` | `uuid REFERENCES governing_bodies(id)` | `controls.owner_id` solo admite persona física; sin esta columna habría que inventar personas sintéticas por comité y contaminar el censo de 406 PF de G2 |

Más dos elementos estructurales:

- **Índice único parcial `(tenant_id, policy_code)`**, creado tras verificar que ARGA no arrastra duplicados. Cierra 3.6 y hace el seed idempotente por construcción.
- **Filas de `grc_modules` para `…0002`** (`aml`, `ethics`, `risk`), que desbloquean 3.2. Se siembran las tres para que cualquier rama que elija el trigger encuentre destino.

Lo que **no** se toca: `approval_body_id` conserva su semántica y no se reutiliza; `owner_function` se mantiene y se rellena en paralelo, porque tres consultas vivas ya lo pintan; los CHECK existentes no se amplían.

## 5. Catálogo normativo

**38 filas en `policies`** para el tenant `…0002`:

- **32 PI** (`PI-01`…`PI-32`), `normative_tier='POLITICA'`, con edición y fecha reales extraídas de cada PDF.
- **6 documentos del núcleo**: Código Ético 2023 · PPD-01 Manual del Sistema de Gestión de Riesgos Penales (Ed. 03, mayo 2018) · PPD-02 Modelo Organizativo · Manual PBC/FT v.10 (noviembre 2025, con sus Anexos) · Catálogo ejemplificativo de situaciones susceptibles de generar riesgos penales (`DOCUMENTO`) · Medidas para la igualdad de las personas LGTBI y protocolo (`PROCEDIMIENTO`).

**Documentos citados en fuente pero ausentes de la carpeta:** PPD-02 y el Código de Conducta del Socio. Se siembran como fila con código y título — su existencia consta en fuente — con `summary` y `content_outline` en NULL y procedencia *citado en fuente, no incorporado*. Sembrarlos vacíos y etiquetados completa el mapa normativo; inventarles contenido lo rompería.

**Procedencia:** se reutiliza el patrón `data_provenance` de G1 en vez de inventar un etiquetado nuevo. El plan verifica primero si el badge existente generaliza o hay que extraerlo a un componente compartido.

## 6. Ownership — regla de oro

`owner_body_id` se siembra **solo donde la fuente lo dice**. Donde la fuente calla: NULL, `owner_function` descriptivo y etiqueta de procedencia. Nunca inferido en silencio — criterio nº7 del spec maestro.

| Documento | Comité responsable | Fuente |
|---|---|---|
| PPD-01, PPD-02, Mapa de riesgos penales, Plan de acción, formación | senior partner (cargo) + `garrigues-comite-practica-profesional` | Manual PPD §4.1, §7, §8.1 — **literal** |
| Manual PBC/FT y sus obligaciones | `garrigues-caci` + senior partner | spec maestro §4 G4 |
| PI-14 (contenidos divulgativos) | `garrigues-comite-editorial-global` | spec maestro §4 G4 |
| PI-30 (IA generativa) | `garrigues-comite-gobernanza-ia` | spec maestro §4 G4 |
| Código Ético (consultas e interpretación) | senior partner + `garrigues-comite-practica-profesional` | página Código Ético — **literal** |
| PI-31 y las 29 PI restantes | a extraer del propio PDF; si calla → NULL etiquetado | — |

### Incidencia de dato nº10 (nueva)

El Manual del PPD (Edición 03, mayo 2018) atribuye la supervisión del Programa al **senior partner auxiliado por el Comité de Práctica Profesional**. La estructura de gobierno vigente — cargada en G2 desde el Sistema de Gobierno Corporativo — incluye además un **Comité de Prevención de Delitos** distinto, dependiente de la senior partner. Ambos órganos existen en Cloud.

Se siembra **según el documento** (Práctica Profesional para lo que el Manual le atribuye literalmente) y se etiqueta la divergencia como incidencia. No se cuadra en silencio: es exactamente el patrón de §3.5 del spec maestro. Se incorpora a esa lista.

## 7. Obligaciones y controles PBC/FT

**~16 obligaciones** de la Ley 10/2010 que el Manual v.10 implementa: identificación formal, titular real, propósito e índole de la relación, seguimiento continuo, medidas reforzadas y PRP, abstención de ejecución, examen especial, comunicación por indicio, comunicación sistemática, deber de confidencialidad, conservación de documentación, medidas de control interno, representante ante el SEPBLAC, examen externo, formación de empleados.

**La exención del art. 22 para abogados** se carga como **exclusión etiquetada, no como obligación**: la no sujeción respecto de la información obtenida al determinar la posición jurídica del cliente o en el ejercicio de su defensa. Es la primera cosa que un socio de Garrigues comprobará, y omitirla desacreditaría el módulo entero ante la audiencia.

**Cada obligación cita su artículo verificado contra el texto de la Ley 10/2010 que está en la propia carpeta** (`Documentos de interés/01. Ley 10_2010…pdf`), no de memoria. La numeración exacta no se fija en este diseño: se resuelve en implementación contra la fuente. La redacción jurídica va a revisión del Comité Legal con el mismo patrón que G3, y hasta entonces se etiqueta con la firmeza que corresponda.

**~15 controles** desde el PPD y las PI que los cubren: aceptación de nuevos clientes y asuntos (PI-01), conflictos de interés (PI-02), prohibición de cobros en efectivo (PI-05), provisiones de fondos (PI-04), medidas anticorrupción (PI-23), clasificación y aprobación de Jobs de Nivel 1, plan anual de formación, archivo centralizado en CORE, auditoría interna bienal, Canal Interno de Información (Ley 2/2023, PI-31).

**Ownership de obligaciones y controles:** CACI, Comité de Prevención de Delitos y Departamento de Compliance, vía `owner_body_id`.

**Códigos:** prefijo propio del tenant, sin colisionar con los prefijos de ARGA que el trigger ya mapea (`OBL-GDPR-`, `OBL-DORA-`, `OBL-NIS2-`, `OBL-ISO`, `OBL-LEY2-`, `OBL-EIOPA-`).

## 8. D-5 — aplicabilidad de módulos por tenant

**Mecanismo.** Clave `modules?: string[]` en `TenantBranding` (`src/context/TenantBrandContext.tsx`) y un helper puro nuevo `src/lib/tenant-modules.ts` con `isModuleEnabled(branding, key)`. Con `branding === null` devuelve `true`: ARGA y el estado de carga fallan **abierto**, que es la dirección segura.

**El matiz que hay que resolver bien:** `useTenantBranding()` devuelve `null` tanto para ARGA como mientras la query está en vuelo. En el sidebar eso solo produce un parpadeo cosmético; en el **gating de rutas** significaría pintar `/grc/packs` un tick antes de redirigir. Es el mismo flake que `tab-guards.ts:88-95` ya documenta para RBAC. Se resuelve exponiendo `isLoading` desde el contexto de branding y haciendo que el guard de ruta espere.

**Superficies:**

| Superficie | Punto de inserción |
|---|---|
| Sidebar del shell TGMS | `ShellLayout.tsx:37-55`; `ShellSidebarContent` ya lee branding en `:132` |
| Board Pack | Knob `requiresFeatureFlag` de `sidebar-visibility.ts`, **cableado, ya probado y nunca poblado**: basta alimentar `featureFlags` desde branding en `useSidebarVisibilityContext.ts:179-204` |
| Packs por país | `GrcLayout.tsx:36` |
| Tarjeta DORA | `dashboard-readiness.ts:86-102` + `Dashboard.tsx:568` |
| Rutas | `App.tsx:256-258` (board-pack), `:297-298` (packs), `:306-310` (`/grc/m/:moduleId`) |
| Seed | Clave `modules` en `BRANDING`, `seed-garrigues-tenant.ts:45-83` (upsert idempotente) |

Verificado en sesión: `requiresFeatureFlag` no lo declara **ningún** item de navegación en producción y `featureFlags` solo aparece poblado en `sidebar-visibility.test.ts:360-363`, que ya cubre su semántica (oculta si el flag falta o es `false`, muestra si es `true`). Reutilizar el knob es barato y llega con red de tests.

**Gotcha:** `SecretariaSidebarSkeleton` (`SecretariaSidebar.tsx:43-56`) replica las claves de regla del sidebar. Si se añade una nueva y no se actualiza el esqueleto, éste sobre-renderiza y la barra salta al hidratar.

**Aviso de código muerto:** `src/components/shell/sidebar-nav-items.ts`, `Sidebar.tsx` y `AppLayout.tsx` no los importa nadie fuera de su propio directorio. Editarlos no cambia nada.

## 9. Deuda de contaminación ARGA que G4 cierra

No es refactor oportunista: son defectos que se ven en la primera pantalla de la demo de Garrigues.

**P0 — rompen la demo:**

1. La pestaña **"Aplicabilidad"** de `PoliticaDetalle` itera el array estático `src/data/entities.ts`: mostraría **entidades de ARGA en cada política de Garrigues**, incluido el caso especial cableado `arga-turquia` → "EXCEPCIÓN REGULATORIA" → `/hallazgos/HALL-010`.
2. La pestaña **"Contenido"** cablea `PR008_SECTIONS` (texto ARGA/DORA) y, para todo lo demás, una frase de relleno. Queda sustituida por `summary` + `content_outline`.
3. **`ObligacionesList`** cablea tres secciones (`DORA — Resiliencia Operativa Digital`, `Solvencia II`, `Otros marcos`) y el filtro de marco (`DORA`/`Solv`/`GDPR`/`LGPD`): las obligaciones PBC/FT caerían bajo encabezados de aseguradora y el filtro no las alcanzaría. Las secciones y el filtro pasan a derivarse del dato.

**P1:** `EntidadDetalle` lista **todas** las políticas del tenant bajo cada entidad, sin filtro alguno — con 38 filas se vuelve evidente. Las query keys de `policies` **omiten `tenantId`**: un cambio de tenant sin recarga sirve la caché del anterior; RLS protege el dato, no la caché.

**P2:** el botón "Gestionar en GRC" apunta fijo a `/grc/m/dora/…`; el buscador global enlaza políticas **por UUID** contra una ruta que resuelve por `policy_code` (roto ya hoy, más visible con 38 filas); `e2e/02-shell.spec.ts` se acopla al prefijo `PR-`.

## 10. Gates y criterios de salida

- `bun run db:check-target` contra `governance_OS`; `bun test`, `bun run typecheck`, `bun run lint`, `bun run build` en verde, medidos sobre árbol limpio.
- **Sonda de datos nueva** `src/test/schema/garrigues-normativo-seed.test.ts` con logins reales (patrón `garrigues-entities-seed.test.ts` de G1 y `garrigues-gobierno-seed.test.ts` de G2): 38 políticas, ownership resuelto contra órganos reales, obligaciones con artículo y periodicidad, y **ARGA intacta** en sus cifras de §3.4.
- **Ampliación del gate de aislamiento:** `src/test/schema/tenant-isolation.test.ts` cubre hoy solo `entities`, `document_templates`, `rule_packs` y `agreements`. `policies`, `obligations` y `controls` **no están**. G4 las incorpora. Recordatorio del gotcha de G0: una escritura cruzada filtrada por RLS devuelve **0 filas sin error**, no `42501`.
- **Verificación viva:** Garrigues → `/politicas` con 38 filas; abrir PI-30 y navegar a Comité de Gobernanza de la IA y a sus personas; `/obligaciones` con marcos PBC/FT y sin encabezados de aseguradora; sidebar sin DORA, sin packs de país y sin Board Pack. ARGA → 25 políticas, menú completo, cero badges de procedencia, `/obligaciones` con su agrupación DORA/Solvencia intacta.
- Review adversarial de rama, fix, merge `--no-ff` a `main` y push.

## 11. Riesgos y salvaguardas

| Riesgo | Salvaguarda |
|---|---|
| El trigger espejo escribe owners literales en `grc_*` | Ninguna superficie del frontend lee esas tablas; queda anotado como deuda declarada |
| Seed no idempotente por falta de unicidad en `policy_code` | Índice único parcial `(tenant_id, policy_code)` en la propia migración |
| Primer INSERT de obligación muere por FK | `grc_modules` del tenant 2 sembrado **antes**, con las tres claves posibles |
| Inventar ownership donde la fuente calla | Regla de oro §6: NULL + etiqueta; jamás un comité plausible |
| Citas de artículo de memoria | Verificación contra el texto de la Ley 10/2010 de la carpeta + revisión del Comité Legal |
| Datos personales | Sin datos de personas nuevos en G4: el ownership apunta a órganos, no a individuos |
| Árbol git compartido | `git add` de rutas específicas, nunca `-A`. Strays conocidos: `docs/context/*`, `pkcs11.txt`, `version garrigues/` |
| Regresión visual en ARGA | Todas las columnas nullable; ARGA NULL ⇒ cero cambio, verificado en vivo en ambos sentidos |

## 12. Fuera de alcance

Texto íntegro de las políticas en la BD; alta o edición de políticas, obligaciones y controles por UI (la superficie es y sigue siendo de solo lectura); los mapas penales evaluados 2025 con sus puntuaciones (son **G5**, vía `/grc/risk-360`); ESG, hallazgos y conflictos (G5); el módulo SII (G6); PI-30 como sistema de gestión de IA (G7); reescritura del backbone `grc_*`; unificación de los cinco normalizadores de tipo social heredada de G3.
