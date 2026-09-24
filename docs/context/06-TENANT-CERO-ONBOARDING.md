# 06 — Tenant cero: tercera instancia para arrancar un grupo desde cero

> **Propósito.** Memoria de continuidad de la línea de trabajo «tercer tenant / onboarding real». Permite retomar el asunto en una conversación nueva sin releer el historial. Se sitúa en la suite `docs/context/` (→ `00`) y no sustituye a `CLAUDE.md`.
>
> **Fecha de creación:** 2026-09-19. **Última actualización:** 2026-09-25 (cierre de la tarea MOI-131: identidad «Grupo Nuevo» confirmada formalmente, Opción A). **Estado:** tenant «Grupo Nuevo» **PROVISIONADO en Cloud** con identidad confirmada; gates de aislamiento tri-tenant y bilateral verdes (88/88, logins reales); gates estáticos y build verificados limpios; trabajo empaquetado en rama `grupo-nuevo/tenant-cero-2026-09-19`. **Mantener vivo:** actualizar estado y fecha al cerrar cada conversación sobre este asunto.

---

## 0. Dónde está esto hoy (leer primero)

**En Cloud (`governance_OS`), desde el 2026-09-19, con autorización expresa del usuario:**

- Tenant **«Grupo Nuevo»**, `00000000-0000-0000-0000-000000000003`, con marca propia y `fixtures: "none"`.
- Usuarios `demo@grupo-nuevo-demo.dev` (SECRETARIO) y `admin@grupo-nuevo-demo.dev` (ADMIN_TENANT). Contraseña: variable `DEMO_PASSWORD_NUEVO` del `.env` local del repo (generada al azar, nunca mostrada ni registrada; `.env` está ignorado por git).
- Suelo: 58 rule packs `GN_*` con materia canónica y versión `ACTIVE`, 5 rule sets de España, 72 plantillas `ACTIVA`, 6 módulos GRC con propietario «Pendiente de designación».
- **Ni una sociedad, persona, órgano o acuerdo.** Eso se hace por pantalla.
- ARGA y Garrigues: recuento idéntico antes y después en las seis tablas tocadas, medido por el propio script en cada ejecución.

**En el repo, empaquetado en rama `grupo-nuevo/tenant-cero-2026-09-19`:**

- Spec `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md`, plan `docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md` (Tareas 1–7 hechas) y guion `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`.
- `scripts/tenant-bootstrap.ts` (fases `fundacion` y `pack-base`, dry-run por defecto, idempotente) + lógica pura en `scripts/tenants/`. El catálogo declara `cloud: "PROVISIONADO"`.
- **Pack base LSC congelado** en `scripts/tenants/pack-base-lsc/` con manifiesto de hashes. Lo regenera `scripts/export-pack-base-lsc.ts`, que solo lee de Cloud.
- Aplicación: tercer entorno de login **visible solo por `/login?tenant=nuevo`**; `branding.fixtures = "none"` apaga los fixtures de ARGA (ESG, Notificaciones, dos tarjetas del Dashboard) para ese tenant y para nadie más.
- Gate `src/test/schema/tenant-cero-isolation.test.ts`: 25/25 con tres logins reales.
- Nombre «Grupo Nuevo» confirmado formalmente como identidad definitiva de la plantilla de onboarding (Opción A, resuelto en MOI-131). Coincide plenamente con la fila de Cloud (`governance_OS`), los identificadores de reglas `GN_*` y las cuentas Auth.

**Verificado el 2026-09-24 (sesión MOI-126):** typecheck 0 errores, eslint limpio, `bun run build` limpio (7.62s), 88 tests de aislamiento tri-tenant y bilateral verdes (`tenant-isolation` + `tenant-cero-isolation`), suite `src/test/garrigues/` (98 pass) y `src/test/tenants/` (44 pass) verdes, 4.890 tests en bloque (0 fail, 151 skip, 3 todo), dry-run posterior = 0 por crear, 0 filas `PROBE-%` residuales en Cloud. **No verificado aún en navegador:** la pantalla de login y el Dashboard con el tenant nuevo; requiere arranque en local (`bun run dev` → `/login?tenant=nuevo`) o despliegue tras incorporación en MOI-136.

**Rectificación de esta línea de trabajo.** La recomendación inicial («clonar el pack base desde `seed-rule-packs.ts`, no desde Cloud») era **incorrecta**: ese seed quedó atrás respecto a las correcciones del Comité Legal aplicadas por migración (13 de los 58 packs tienen hoy versión activa posterior a la 1.0.0). El origen correcto es el estado vivo de Cloud, congelado en el repo como snapshot. §4 está corregido.

**Abierto para el Comité Legal:** la plantilla `ACTA_COMISION_DELEGADA v1.0.1` entró en el pack base, pero sus notas atribuyen la ausencia de voto de calidad en comisiones delegadas al Reglamento del Consejo de ARGA. Puede ser una regla de ese grupo y no derecho común.

**Dato a tener presente:** `tenants` es de lectura pública por diseño (excepción documentada en el gate G0): las sesiones de ARGA y Garrigues pueden leer que existe un tenant «Grupo Nuevo» y su marca. No ven ninguna de sus filas de dominio.

**Residuo en el repo:** carpeta `_to_delete/` en la raíz (un `index.lock` vacío y un `tsconfig` temporal de verificación). Se puede borrar sin más; la sesión no tenía permiso de borrado.

---

## 1. La pregunta de origen

El sistema está adaptado a dos contextos (ARGA Seguros, grupo asegurador ficticio, y Garrigues). ¿Cómo se levanta una tercera instancia para empezar un grupo desde cero y cablear sociedades, órganos, personas y reglas?

## 2. Decisiones tomadas por el usuario (2026-09-19)

| # | Decisión | Elección |
|---|---|---|
| T1 | Propósito | **Tenant cero / plantilla**: grupo ficticio en blanco dentro de `governance_OS`, para ejercitar y demostrar el onboarding real por pantalla; queda como plantilla reutilizable. No es piloto con dato real. |
| T2 | Suelo jurídico | **SA y SL comunes**: basta un pack base LSC extraído de los rule packs actuales más las plantillas núcleo. Sin cotizada, sector regulado ni formas especiales en esta fase. |
| T3 | Alcance | **Instancia básica para probar toda la capacidad** (precisión del usuario, literal: «es mucho más básica, queremos probar toda la capacidad»). Grupo sencillo, sin narrativa elaborada ni dato sembrado; todos los módulos abiertos; el objetivo es recorrer el sistema entero partiendo de cero. |
| T4 | Origen del pack base | **Estado vivo de Cloud, congelado en el repo como snapshot**; no `seed-rule-packs.ts` (decisión técnica de la sesión de implementación; rectifica la recomendación inicial). |
| T5 | Identidad | «Grupo Nuevo» / `nuevo` / `…0003` / prefijo `GN` — **confirmado formalmente como nombre definitivo de la plantilla de onboarding (Opción A, resuelto en MOI-131)**. |
| T6 | Login | El entorno nuevo solo aparece llegando por `/login?tenant=nuevo`; el selector de las demos de ARGA y Garrigues no cambia. |
| T7 | Fixtures | `branding.fixtures = "none"` por declaración expresa; ARGA y Garrigues ven lo mismo que antes. |

Consecuencia de T1: se mantiene la decisión D2 del spec de Garrigues (tenant nuevo en el mismo Supabase, mismo repo, aislado por RLS; sin fork). Si algún día el propósito pasara a piloto con dato real de un tercero, la respuesta cambia: proyecto Supabase separado y endurecimiento F0 de la spec de producción antes de cargar nada.

## 3. Diagnóstico verificado contra el repo (2026-09-19, `main` en `b1721a5`)

### 3.1 La arquitectura ya es multi-tenant

- Un único Supabase (`governance_OS`). ARGA = `00000000-0000-0000-0000-000000000001`, Garrigues = `…0002`. El tercero sería `…0003`.
- 175 de las 192 tablas de `public` llevan `tenant_id` (medido sobre `src/integrations/supabase/types.ts`). Sin `tenant_id`: catálogos globales (`materia_catalog`, `entity_settings_catalog`, `bloques_sectoriales`, `rbac_roles`, `capability_matrix`, `sod_toxic_pairs`, `pack_rules`, `rule_pack_versions`, `pacto_clausulas`, `tenants`, `profiles`) y tablas hijas aisladas por join (`ai_compliance_checks`, `ai_risk_assessments`, `communication_*`, `evidence_bundle_artifacts`).
- Tenant de sesión: `TenantContext` lo lee de `user_profiles.tenant_id`; en servidor, `fn_current_tenant_id()`. Marca: `tenants.branding jsonb` aplicada por `TenantBrandProvider`.
- Fundación de Garrigues (G0): `scripts/seed-garrigues-tenant.ts` (fila `tenants` + branding + usuarios Auth + `user_profiles` + `rbac_user_roles`), idempotente, dry-run por defecto, con guard de target.

### 3.2 El alta desde cero ya existe en producto

- `/secretaria/sociedades/nueva` → `SociedadNuevaStepper` (11 pasos: identificación, domicilio, perfil de grupo, capital, clases, cap table, órganos, cargos, reglas, soporte, revisión).
- TX1 = RPC `fn_crear_sociedad_legal_y_capital(p_tenant_id, p_payload)` (SECURITY DEFINER; asierta acceso al tenant y rol SECRETARIO/ADMIN_TENANT; crea persona PJ, `entities`, `entity_capital_profile`, `share_classes`, socios, `capital_holdings`, `governing_bodies`, `entity_settings`, `rule_param_overrides`). TX2 = cargos y representaciones iniciales. Estados: `INCOMPLETA_DATOS → INCOMPLETA_CARGOS → OPERATIVA`.
- El paso «Perfil» (rol en grupo MATRIZ/FILIAL/PARTICIPADA/INDEPENDIENTE, matriz, % de participación) es el cableado del grupo.
- Alrededor: `PersonaNuevaStepper`, `PersonasImportStepper` (alta masiva de personas), `AnadirSocioStepper`, `DesignarAdminStepper`, `RepresentanteAdminPJStepper`, `TransmisionStepper` y el asistente `ActivarMarcoNormativo` por sociedad (diagnóstico, regla base, estatutos, mapeo de cláusulas, plantillas, publicación).
- Garrigues apenas ejercitó este camino: su perímetro se sembró por script desde `scripts/garrigues/entities-catalog.ts`.

### 3.3 Lo que un tenant en blanco no tiene

**Capa A — Fundación (trabajo pequeño, es G0 parametrizado).**
- `tenants.branding` es obligatorio en la práctica: con branding NULL la aplicación aplica los defaults de ARGA verbatim (`src/lib/tenant-brand-labels.ts`, `tenant-scopes.ts`: «Grupo ARGA», «Buen día, Lucía», ámbitos de ARGA). Es el contrato cero-cambio de ARGA, no un defecto, pero obliga a declarar marca en todo tenant nuevo.
- `LOGIN_BRANDS` (`src/lib/login-brands.ts`) es un mapa estático pre-login con dos claves y tipo `LoginBrandKey = "arga" | "garrigues"`. Hay que añadir la tercera (consumidores: `Login.tsx` y dos tests).
- `branding.modules` es una lista blanca opcional. Por T3 **no se declara**: sin lista (o con lista vacía) `isModuleEnabled` falla abierto y el tenant ve todos los módulos, incluidos DORA, packs de país y Board Pack.
- Filas de `grc_modules` del tenant si se van a registrar obligaciones: `tg_sync_obligation_to_backbone` FKea contra `grc_modules(tenant_id,id)` y su fallback no comprueba existencia.
- Atención a las columnas con `DEFAULT '…0001'` que sobreviven (p. ej. `jurisdiction_rule_sets.tenant_id`): toda escritura del tenant nuevo debe nombrar `tenant_id`.

**Capa B — Suelo jurídico (el hallazgo principal).**
- `rule_packs`, `plantillas_protegidas` y `jurisdiction_rule_sets` son por tenant, y todos los hooks filtran por `tenant_id` (`useRuleResolution`, `useReglasAplicables`, `useRulePackForMateria`, `usePlantillasProtegidas`, `useJurisdiccionRules`…).
- El derecho común de la LSC vive dentro del tenant ARGA: `scripts/seed-rule-packs.ts` (35 materias, cero menciones a ARGA en el contenido) e `import-templates-batch.ts` están cableados a `…0001`; la migración `20260424175656` siembra `jurisdiction_rule_sets` solo para ARGA. En Cloud, a fecha de G3: 59 packs y 73 plantillas en ARGA, 10 packs y 6 plantillas en Garrigues (estos, estatutarios SLP).
- La resolución de reglas es por materia y sin fallback a órgano. Un tenant vacío puede dar de alta sociedades pero no convocar ni adoptar acuerdos.
- Falta, por tanto, un **pack base LSC** clonable a cualquier tenant: rule packs SA/SL/Consejo + `jurisdiction_rule_sets` ES + plantillas núcleo (convocatoria, acta, certificación como mínimo para la prueba de humo). Las plantillas entran en BORRADOR y se promueven con `fn_secretaria_transition_template_state`.

**Capa C — Residuos y huecos de UI.**
- UUID de tenant cableado en 7 ficheros de `src` fuera de tests: `ErpConsolePanel.tsx`, `useWhistleblowing.ts`, `lib/sii/roles-por-tenant.ts`, `lib/aims/governing-body.ts`, `login-brands.ts`, `lib/demo-operable/runner.ts`, `pages/Dashboard.tsx`. Casi todos fallan cerrado de forma correcta para un tenant desconocido (SII: «Pendiente de designación»; AIMS: sin órgano de IA, el panel no se pinta; panel demo-operable solo ARGA).
- Fixtures estáticos de `src/data/*` consumidos por `Dashboard.tsx` (actividad reciente, ESG), `Esg.tsx`, `Notificaciones.tsx`, `Conflictos.tsx` y `OrganoDetalle.tsx`: pintarían dato de ARGA en el tenant nuevo. Hay que gatear por tenant o mostrar estado vacío honesto.
- Huecos funcionales que un grupo desde cero destapará: (1) no hay UI para crear un órgano después del alta de la sociedad; (2) no hay UI para modificar la estructura de grupo a posteriori (matriz y % solo se fijan en el alta); (3) no hay alta masiva de sociedades, solo de personas.

### 3.4 Mapa de capacidad desde cero: qué se puede poblar por pantalla y qué no

Medido sobre las escrituras reales de `src` (INSERT/UPSERT directos y RPC invocadas, sin tests). Es el dato que condiciona T3: «probar toda la capacidad» solo es posible donde existe un camino de alta.

| Módulo | ¿Se puebla desde cero por pantalla? | Base |
|---|---|---|
| **Secretaría** | **Sí, ciclo completo.** Sociedad, personas (unitaria y masiva), socios, cargos y ceses, representaciones, transmisiones, marco normativo y estatutos, reglas de órgano, convocatoria → reunión → acuerdos → acta → certificación, acuerdos sin sesión, decisiones unipersonales, comunicaciones, libros de actas, cuentas anuales, gestor de plantillas (ADMIN_TENANT). | Más de 50 RPC `fn_*` + inserts de `agreements`, `meeting_attendees`, `plantillas_protegidas`… Requiere la Capa B. Frontera conocida: la certificación queda bloqueada en custodia EAD por diseño (`EADInterpositionControl` sin renderer autoritativo). |
| **AIMS 360** | **Sí.** Alta de sistema por cuestionario (`fn_aims_registrar_sistema`), evaluaciones con congelación y revisión a cuatro ojos, incidentes, versiones, expediente técnico, indicadores. | El órgano de gobierno de la IA se resuelve por mapa estático por tenant (`lib/aims/governing-body.ts`): un tenant nuevo no lo tendrá hasta añadirlo. |
| **GRC Compass** | **Parcial.** Riesgos (`/grc/risk-360/nuevo`), incidentes, excepciones y terceros (TPRM) tienen alta. | Obligaciones, controles y módulos GRC se leen de dato sembrado. |
| **SII** | **Sí.** Alta de comunicaciones por el portal; persistencia en `sii.reports` por tenant. | Roles del canal: «Pendiente de designación» hasta declararlos en `lib/sii/roles-por-tenant.ts`. El catálogo inicial de un tenant desconocido es vacío (no hereda los casos de ARGA). |
| **Consola TGMS: políticas, obligaciones, controles, hallazgos, planes de acción, delegaciones, conflictos, notificaciones regulatorias** | **No.** Cero inserts desde la UI: son superficies de solo lectura sobre dato sembrado por script. | En un tenant en blanco quedarán vacías y sin forma de poblarlas por pantalla. |
| **Órganos (post-alta) y estructura de grupo** | **No.** Los órganos solo nacen dentro del alta de sociedad; matriz y % solo se fijan ahí. | Huecos (1) y (2) de la Capa C. |
| **ESG, notificaciones, actividad reciente** | **No aplica.** Son fixtures estáticos de ARGA en `src/data/*`. | Hay que gatearlos o vaciarlos para el tenant nuevo. |
| **Board Pack, Governance Map, Dashboard** | **Derivados.** Se componen de lo anterior: serán tan ricos como el dato que exista. | — |

Lectura: el sistema es operable desde cero en Secretaría, AIMS, SII y la mitad transaccional de GRC. La mitad «registro» de la consola (normativa interna, obligaciones, controles, hallazgos, delegaciones, conflictos) depende hoy de siembra. Para probar toda la capacidad hay dos salidas por módulo: construir el alta por pantalla o dotar al `tenant-bootstrap` de un kit de arranque mínimo y genérico. La primera pasada honesta es sin kit, para levantar el inventario exacto de lo que un cliente no podría hacer el día uno.

## 4. Camino recomendado

1. **`tenant-bootstrap` genérico.** Generalizar `seed-garrigues-tenant.ts` en un script parametrizado (slug, nombre, marca, usuarios) que cree la Capa A. Mismo patrón: service-role, dry-run por defecto, idempotente, guard de target.
2. **Pack base LSC congelado en el repo, con origen en Cloud.** `export-pack-base-lsc.ts` lee lo que hoy está `ACTIVE`/`ACTIVA` en el tenant de origen, aplica reglas de selección que fallan cerrado (sin `demo_scope`, sin mención a ARGA en nada que llegue a un documento) y escribe un snapshot con manifiesto de hashes. ~~Parametrizar `seed-rule-packs.ts`~~: descartado, ese seed resucitaría reglas ya corregidas por el Comité Legal.
3. **Ni una sociedad sembrada.** El tenant nace vacío de dato societario.
4. **Cableado por pantalla**, en este orden: personas (importación) → matriz → filiales con matriz declarada → socios y cap table → cargos → marco normativo por sociedad → primera convocatoria como prueba de humo de extremo a extremo. Grupo mínimo suficiente para tocar todas las ramas del motor: una SA matriz con Consejo y comisiones, una SL filial con administrador único (unipersonal), una SL con administradores solidarios o mancomunados y un socio externo.
5. **Recorrido de capacidad completo (T3).** Tras Secretaría, recorrer por pantalla AIMS (alta de sistema por cuestionario, evaluación, congelación, revisión, incidente), GRC (riesgo, incidente, excepción, tercero), SII (comunicación, acuse, cierre) y comprobar qué componen Dashboard, Governance Map y Board Pack con dato nacido en el tenant. Registrar como hallazgo cada superficie que quede vacía sin camino de alta (§3.4).
6. **Gates.** El gate de aislamiento (`src/test/schema/tenant-isolation.test.ts` y el de 16 tablas) pasa de bilateral a tres tenants. Se mantienen los contratos vigentes: cero-cambio ARGA y persistencia del dato de Garrigues.
7. **Backlog que saldrá del ejercicio:** los tres huecos de la Capa C, el gateo de fixtures y, por cada módulo de solo lectura de §3.4, la decisión entre alta por pantalla o kit de arranque genérico en el `tenant-bootstrap`. Priorizar según lo que bloquee el recorrido.

Valor del ejercicio: es la primera vez que el producto se recorre como lo haría un cliente, sin scripts de siembra. El tenant resultante queda como plantilla de onboarding y como demo del «día uno».

## 5. Pendiente de decidir

- ~~Confirmar o cambiar el nombre «Grupo Nuevo»~~: Resuelto en MOI-131 por la opción A (confirmado «Grupo Nuevo» como identidad definitiva de la plantilla de onboarding, en total coherencia con Cloud y `GN_*`).
- Criterio del Comité Legal sobre la plantilla `ACTA_COMISION_DELEGADA` (§0).
- Para los módulos de solo lectura (§3.4): alta por pantalla o kit de arranque genérico. Decidir después de la primera pasada sin kit.
- Si el pack base LSC sigue siendo copia por tenant (modelo actual) o se introduce herencia de un tenant «sistema» (cambio de modelo: fuera de alcance salvo decisión expresa).
- Cuándo y cómo se hace el commit (árbol compartido: por rutas específicas), si se despliega, y si se añade la sección correspondiente a `CLAUDE.md`.

## 6. Próximo paso natural

1. Arrancar la aplicación en local o desplegar, y entrar por `/login?tenant=nuevo`.
2. Recorrido por pantalla con el guion (bloques 0 a 8) y registro de hallazgos en su tabla.
3. Correr el gate bilateral `src/test/schema/tenant-isolation.test.ts` y el resto de sondas de `schema/` con el tercer tenant ya presente.
4. Con los hallazgos, decidir por módulo: alta por pantalla o kit de arranque; y traer el resultado a este documento.

## 7. Referencias

- Spec Garrigues: `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` (D2 aislamiento; §7 deja «white-label para un tercer cliente» como YAGNI hasta que exista: ya existe).
- Plan G0: `docs/superpowers/plans/2026-08-02-g0-tenant-garrigues-fundacion.md`.
- `CLAUDE.md` §«Tenant Garrigues — G0 fundación + G1 espejo societario» (gotchas de RLS, defaults de tenant, canal Cloud).
- Alta de sociedad: `supabase/migrations/20260515183150_secretaria_d6_crear_sociedad_legal_y_capital.sql`, `src/lib/secretaria/sociedad-onboarding/`.
- Tenant cero: spec `docs/superpowers/specs/2026-09-19-tenant-cero-onboarding-design.md`, plan `docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md`, guion `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`, código en `scripts/tenant-bootstrap.ts`, `scripts/export-pack-base-lsc.ts` y `scripts/tenants/`.
