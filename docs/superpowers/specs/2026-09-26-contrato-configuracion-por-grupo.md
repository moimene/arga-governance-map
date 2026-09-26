# Contrato de configuración por grupo — dónde vive, procedencia, precedencia

**Fecha:** 2026-09-26 · **Issue:** MOI-54 (paso 6 / Aceptación) · **Estado:** contrato fijado sobre el código ya existente (no introduce columnas ni tablas nuevas). Los valores concretos de cada grupo (órgano de IA, roles del canal, ámbitos) se deciden en MOI-150, MOI-151 y MOI-193 — este documento no los absorbe.

---

## 1. Por qué existe este documento

El código ya resuelve, grupo a grupo, marca, módulos, ámbitos, fixtures y algún rol operativo — pero cada uno lo hace con su propia forma de mirar `null`/ausente/vacío, y no había ningún sitio que dijera, para el conjunto, **dónde vive esa configuración, de dónde sale y qué gana cuando dos fuentes discrepan**. La auditoría del 25-09-2026 reabrió MOI-54 precisamente porque faltaba fijar esto (motivo de reapertura #1). Este documento lo fija mirando el código real, no proponiendo uno nuevo.

## 2. Dónde vive la configuración de un grupo

Una sola fila por tenant, columna `tenants.branding jsonb` (migración `20260802120000_tenants_branding.sql`). No hay tabla de configuración separada ni columnas dedicadas por concepto: todo lo que un grupo declara sobre sí mismo pasa por esta columna, leída una vez por sesión en `TenantBrandProvider` (`src/context/TenantBrandContext.tsx`) y expuesta a través de dos hooks — `useTenantBranding()` (el valor, o `null`) y `useTenantBrandingLoading()` (si la consulta sigue en vuelo).

`branding` es un objeto plano, sin schema declarado en Postgres (JSONB sin `CHECK` de forma). El contrato de forma vive en TypeScript, no en la base: cada módulo que lee una clave declara su propio tipo derivado de `TenantBranding` (patrón `type BrandingWithModules = TenantBranding & { modules?: unknown }`, `BrandingWithScopes`, `BrandingWithFixtures`) y valida en tiempo de lectura, nunca asume la forma. Esto es deliberado: añadir una clave nueva no exige migración, y un valor con forma inesperada no revienta la lectura, cae al lado conservador de ese concepto (ver §4).

Claves que ya viven en `branding` hoy, cada una resuelta por su propio módulo hoja (nunca inline en una pantalla):

| Clave | Módulo que la resuelve | Consumida por |
|---|---|---|
| `nombre`, `shell_label`, `scope_label`, `sii_org_label` | `src/lib/tenant-brand-labels.ts` | shell, sidebar, SII, breadcrumbs |
| `scopes` | `src/lib/tenant-scopes.ts` | selector de ámbito, saludo del dashboard |
| `modules` | `src/lib/tenant-modules.ts` | guards de ruta (`module-guards.tsx`), sidebar |
| `fixtures` | `src/lib/tenant-fixtures.ts` | `fixtures-guard.tsx`, Dashboard, Conflictos, OrganoDetalle |
| `tokens` | `applyBrandTokens` en `TenantBrandContext.tsx` | CSS custom properties del shell |

Lo que **no** vive en `branding` todavía, y sigue en programa (deuda declarada, §6): el órgano de gobierno de la IA (`src/lib/aims/governing-body.ts`) y los roles del canal interno — instructor, propietario de subexpediente, órgano que resuelve una recusación (`src/lib/sii/roles-por-tenant.ts`).

## 3. Procedencia

`branding` no tiene versión, autor ni fecha de alta como columnas propias — la procedencia hoy es **quién y cómo lo escribió**, no un campo leído en tiempo de ejecución:

- **ARGA (`…0001`) y Garrigues (`…0002`):** escrito a mano/por script one-off contra Cloud, sin exponer un value object versionado en el repo. Es dato vivo de producción; cambiarlo es un `UPDATE` directo, nunca un seed que se re-ejecuta.
- **Tenants de catálogo (Grupo Nuevo `…0003` y los que sigan ese patrón):** la procedencia SÍ es código versionado — `scripts/tenants/tenant-spec.ts` (`TenantBrandingSpec`) es la única fuente de verdad de la forma que ese script escribe, y `scripts/tenant-bootstrap.ts` la aplica de forma idempotente y aditiva contra Cloud (dry-run por defecto, `--commit` explícito). El spec en el repo es la procedencia declarada; la fila de Cloud es su proyección.

Esta asimetría es intencional y no una brecha a cerrar aquí: ARGA y Garrigues nacieron antes de que existiera el catálogo y tienen contratos propios (cero-cambio ARGA; persistencia de Garrigues, CLAUDE.md). Forzarlos al catálogo sería reescribir su historia, no fijar el contrato. Un futuro que quiera procedencia uniforme para los tres pasaría por un value object leído desde `tenant-spec.ts` también para ARGA/Garrigues — eso es trabajo nuevo, no este documento.

## 4. Precedencia — qué gana cuando falta o discrepa

La regla general, verificada en cada uno de los cinco módulos hoja: **branding `null` se trata igual que "aún no sabemos" y, para todo lo que ya usa el criterio correcto, igual que "es ARGA"; una clave ausente o con forma inválida cae al lado que no borra alcance; una lista vacía declarada a propósito es la única forma de cerrar algo.** En orden de precedencia, de más a menos específico:

1. **Valor explícito y con forma válida en `branding.<clave>`.** Manda siempre que exista y valide (string no vacío tras `trim()`, array de strings, etc.). Ejemplo: `branding.modules = ["secretaria", "grc"]` → solo esos dos módulos.
2. **Derivado de otra clave del mismo `branding`.** Cuando la clave específica falta pero hay `nombre`, varios rótulos se derivan de él en vez de caer directo al genérico (`scopeLabel`, `siiOrgLabel`, `groupFullLabel`: "sin `scope_label` pero con `nombre` → usa `nombre`"). Es precedencia intra-tenant, no herencia de otro tenant.
3. **`branding` es un objeto sin la clave, o con la clave en forma inválida (`unconfigured`).** Cada módulo decide su propio "abierto" o "cerrado por defecto" aquí, y la decisión está declarada, no es casualidad:
   - `tenant-modules.ts`: **abre** (todos los módulos visibles). Decisión T3 para Grupo Nuevo y cualquier tenant que no declare lista blanca.
   - `tenant-brand-labels.ts` / `tenant-scopes.ts`: **no hereda ARGA** — cae a un genérico neutro (`"Grupo"`, `"Entidad"`, `["<scope_label> (Global)"]`), nunca a `DEFAULT_SCOPE_LABEL` ni a `ARGA_SCOPES`. Ver §5.
   - `tenant-fixtures.ts`: **abre** (`usaFixturesDemo` devuelve `true`: se pintan los fixtures salvo declaración expresa de lo contrario).
4. **`branding` es `null` (columna sin fila, o carga en vuelo — ver §4.1).** Es el único caso que sí produce los valores de ARGA verbatim, porque `null` es precisamente cómo se representa "esta fila de `tenants` no tiene branding" y ARGA es, hoy, el único tenant real en ese estado. No es una regla de "ARGA por defecto": es que `null` y "es ARGA" coinciden en la única fila que hoy tiene `null`. Si mañana otro tenant real llegase con `branding = null`, vería exactamente lo mismo que ARGA — que es la razón por la que declarar la marca de ARGA en Cloud (§5) es la única forma de que `null` deje de significar dos cosas a la vez.
5. **`branding.<clave>` es una lista vacía declarada (`modules: []`, y el patrón es extensible a cualquier lista futura).** No es "ausente": es la única forma de decir "cerrado a propósito". `resolveTenantModulesState` lo distingue en un estado propio (`"empty"`) precisamente para no confundirlo con `unconfigured`.

### 4.1 La quinta espera: "todavía no sabemos" no es lo mismo que "es ARGA"

Hay una precedencia temporal que cruza las cuatro anteriores y que MOI-54 tuvo que corregir dos veces (guards de ruta el 24-09; Dashboard el 26-09, motivo de reapertura #3): **mientras el tenant no se ha resuelto, `branding` vale `null` exactamente igual que para ARGA ya resuelta.** Hay DOS esperas encadenadas, no una:

1. `TenantProvider` resuelve `tenantId` desde `user_profiles` (`useTenantContext().isLoading`).
2. `TenantBrandProvider` resuelve `branding` desde `tenants` para ese `tenantId` (`useTenantBrandingLoading()`, que internamente ya vale `false` mientras la primera espera sigue en curso, porque su condición es `!!tenantId && isLoading`).

Un consumidor que decida mirando solo la segunda espera pinta el valor final de ARGA durante la primera, lo cambia a un neutro de carga en cuanto empieza la segunda, y solo entonces resuelve al valor real — un parpadeo de pantalla para ARGA que nadie declaró. La regla de precedencia correcta es: **mientras CUALQUIERA de las dos esperas siga en curso, se trata como "no lo sabemos todavía"**, nunca como el valor final de ningún tenant. Los guards de ruta ya combinan las dos (`RequireModule` en `src/components/module-guards.tsx`, comentario "Hay DOS esperas, no una"); el Dashboard (`resolverSaludoDashboard`, `resolverEtiquetaMinimapa`, `src/pages/Dashboard.tsx`) sigue el mismo criterio desde este cierre — ver §7.

## 5. El caso especial de ARGA — por qué `null` significa dos cosas

`branding === null` es hoy el único valor de precedencia que **sí** produce un resultado idéntico al de un tenant real (ARGA), y esto es una decisión de contrato explícita, no un accidente de diseño: es el contrato "cero-cambio visual para ARGA" (G0, CLAUDE.md). ARGA nació antes de que existiera `branding`, y declarar su marca en Cloud — sustituir el `null` por una fila con `nombre: "Grupo ARGA"`, etc. — es un cambio de **dato de ARGA en producción**, exactamente el tipo de cambio que la puerta humana de MOI-54 reserva a Moisés. El ensayo SQL de ese `UPDATE` ya se hizo con `ROLLBACK` (comentario de cierre del 24-09) y sigue pendiente de autorización — este documento no la pide ni la asume; solo dice qué precedencia cambiaría si se autorizase: la fila 4 de la tabla de §4 dejaría de aplicar a ARGA (que pasaría a tener un `branding` no nulo con sus propios valores explícitos, fila 1) y el `null` de la columna quedaría libre para significar únicamente "no configurado", sin la ambigüedad de dos lecturas correctas pisándose.

## 6. Matriz de propiedad — núcleo común / configuración de grupo / simulación

Tres categorías, verificadas contra el schema y los hooks reales, no aspiracionales:

### 6.1 Núcleo común (mismo modelo y mismas tablas para cualquier grupo, con RLS por `tenant_id`)

Grupo/entidades societarias, personas, órganos de gobierno, cargos y condiciones, permisos (RBAC/capability matrix), documentos y plantillas, tareas y calendario, aprobaciones/workflows de acuerdos, evidencias. Todas estas tablas tienen `tenant_id` (175 de 192 tablas de `public`, medido en el diseño de tenant cero, §3 de `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md`) y el mismo motor de reglas, el mismo pipeline de actas/certificaciones y el mismo RBAC sirven a cualquier grupo sin bifurcación de código. Un grupo nuevo no necesita tocar el programa para tener sociedades, personas u órganos: los da de alta por pantalla (`/secretaria/sociedades/nueva`, alta de personas, designación de cargos).

### 6.2 Configuración de grupo (dato propio, vive en `tenants.branding` o en tablas de dominio con `tenant_id`, sin heredar de ARGA ni de Garrigues)

Marca e identidad visual (`nombre`, `shell_label`, `scope_label`, `sii_org_label`, `tokens`), módulos activos (`modules`), ámbitos del selector (`scopes`), suelo jurídico propio (`rule_packs`, `jurisdiction_rule_sets`, `plantillas_protegidas` por tenant — packs de reglas y plantillas son datos, no código, y cada tenant tiene los suyos), y las designaciones operativas que hoy siguen en programa (§7): órgano de gobierno de la IA, roles del canal interno. Cada clave de esta categoría tiene su propia precedencia (§4) y su propio módulo hoja — nunca una pantalla decide inline.

### 6.3 Simulación (fixtures estáticos de demo, nunca dato del tenant, gateados por declaración expresa)

`src/data/*` (ESG, actividad reciente, notificaciones, operaciones vinculadas/conflictos, reglamentos de órgano tipo). Es contenido de la demo de ARGA — nombres, cifras, sociedades de ese grupo concreto — que ARGA y Garrigues siguen viendo porque nunca declararon lo contrario (`usaFixturesDemo(branding)` es `true` salvo `fixtures === "none"`). Un grupo que nace en blanco declara `fixtures: "none"` para no heredar la ficción de otro grupo. Esta categoría es la única de las tres donde "no declarar nada" significa "ver la simulación", precisamente porque es el comportamiento que ARGA y Garrigues ya tenían antes de que existiera el concepto y que el contrato cero-cambio protege.

Ningún módulo o simulación exige repositorio, base de datos o Supabase project independiente por grupo: los tres viven en `governance_OS` con aislamiento por RLS (decisión T1 del diseño de tenant cero), y GRC/AIMS con madurez desigual entre módulos no bloquea que Secretaría siga operativa para un grupo — son lecturas independientes del mismo `tenant_id`, no un monolito que se activa o falla en bloque.

## 7. Lo que este cierre corrige en el contrato ya escrito

Extiende exactamente el mismo criterio de §4.1 (las dos esperas) a los dos puntos de `src/pages/Dashboard.tsx` que la auditoría del 25-09 identificó sin corregir (motivo de reapertura #3): el saludo (`resolverSaludoDashboard`) y el rótulo del nodo raíz del minimapa de Governance Map (`resolverEtiquetaMinimapa`). Antes de este cierre, los dos miraban solo `useTenantBrandingLoading()` e ignoraban `useTenantContext().isLoading`, así que durante la primera espera pintaban el valor final de ARGA ("Buen día, Lucía", "ARGA Seguros"), lo cambiaban al neutro de carga durante la segunda espera, y volvían al valor de ARGA al terminar — parpadeo de pantalla no declarado. Las dos funciones ahora combinan las dos esperas exactamente como ya lo hacía `fixturesDemo` en el mismo fichero y `RequireModule` en `module-guards.tsx`: no es un criterio nuevo, es el mismo criterio ya vigente en el repo, aplicado donde faltaba. Test de regresión en `src/test/schema/moi-54-decoupling-contract.test.ts` §6.

## 8. Deuda declarada — designaciones operativas todavía en el programa (D-14)

Dos designaciones que, por la matriz de §6, deberían ser **configuración de grupo** (dato en `branding` o en una tabla con `tenant_id`) siguen siendo **código** — mapas estáticos por tenant en el repo, no dato:

- **Órgano de gobierno de la IA** — `src/lib/aims/governing-body.ts` (`AI_GOVERNANCE_BODY_BY_TENANT`). Falla cerrado (un tenant ausente del mapa no tiene panel de IA, no hereda el de otro). Los valores concretos por grupo son MOI-150 (Moisés elige qué se declara para Grupo Nuevo).
- **Instructor y órganos del canal interno (SII)** — `src/lib/sii/roles-por-tenant.ts` (`siiRolesPara`). Devuelve el estado "Pendiente de designación" para cualquier tenant sin caso propio codificado; ARGA tiene su caso hardcodeado con datos reales de `persons`. Decisión de si esto pasa a dato es MOI-151 (Moisés decide).

Esta es exactamente la deuda que MOI-54 pide declarar en este documento sin resolverla: **el patrón de fallo (cerrado, con "Pendiente de designación" o panel ausente, nunca heredando el valor de otro tenant) ya es correcto y consistente con §4**; lo que falta es mover el contenido de "código que un desarrollador edita" a "dato que un grupo declara", que es justamente lo que MOI-150/MOI-151 tienen que decidir antes de construirse.

## 9. Integraciones candidatas — reutilizar antes que construir

Por si una futura designación operativa (§8) o un futuro concepto de configuración necesitase almacenamiento o flujo nuevo, el criterio de "reutilizar antes que construir" (Aceptación del issue) aplica así, con lo que ya existe en este repo:

| Necesidad candidata | Capacidad ya existente que la cubre | Beneficio de reutilizar |
|---|---|---|
| Persistir una designación de rol por tenant (instructor, responsable de canal) | `condiciones_persona` (rol de persona en sociedad/órgano) + `authority_evidence` (vigencia de un cargo) — modelo canónico ya usado para PRESIDENTE/SECRETARIO | Mismo RLS, mismo patrón de vigencia (`estado='VIGENTE'`), sin tabla nueva |
| Declarar un órgano de gobierno de la IA por tenant como dato en vez de mapa en código | `governing_bodies` (ya tiene `tenant_id` y slug) + una columna o convención de `body_type`/tag que lo marque como "órgano de IA" | Reutiliza `useBodyBySlug`, que ya resuelve por slug y tenant; cero tabla nueva |
| Versionar/auditar cambios de `branding` | `audit_log` (WORM, ya usado por todo el dominio) | Mismo patrón de traza que actas/certificaciones; sin mecanismo de versionado ad-hoc |

No se propone construir ninguna de estas ahora: quedan registradas como candidatas para cuando MOI-150/151/193 (o quien las suceda) necesite decidir "dónde vive" el valor concreto.

## 10. Lo que este documento NO decide

- Los valores concretos del órgano de IA de Grupo Nuevo (MOI-150), de los roles del canal interno (MOI-151) o de los ámbitos reales de Garrigues (MOI-193).
- Si se declara la marca de ARGA en Cloud (§5): sigue pendiente de autorización escrita de Moisés.
- Cualquier criterio jurídico (mayorías, plazos, calificación de riesgo): no hay ninguno en juego aquí, la configuración de grupo de este documento es identidad visual, activación funcional y designación operativa, no norma sustantiva.
