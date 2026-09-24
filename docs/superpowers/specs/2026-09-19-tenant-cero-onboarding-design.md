# Tenant cero — tercera instancia en blanco para cablear un grupo por pantalla

**Fecha:** 2026-09-19 · **Estado:** tenant **PROVISIONADO en Cloud** el 2026-09-19 con autorización expresa del usuario (fundación + pack base); gate de aislamiento a tres tenants verde con logins reales (25/25). Código y snapshot en el árbol, **sin commit**. Ninguna pantalla vista todavía en navegador con el tenant nuevo.
**Memoria de continuidad:** `docs/context/06-TENANT-CERO-ONBOARDING.md`. **Plan:** `docs/superpowers/plans/2026-09-19-tenant-cero-bootstrap.md`. **Guion:** `docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md`.

---

## 1. Propósito

El sistema sirve hoy a dos contextos: ARGA Seguros (`…0001`, grupo asegurador ficticio) y Garrigues (`…0002`). Los dos nacieron sembrados por script. Este trabajo añade una **tercera instancia que nace en blanco** —ni una sociedad, ni una persona, ni un órgano— para cablear un grupo entero por pantalla y, con ello, **probar toda la capacidad del sistema** tal como la recorrería un cliente el primer día.

Dos productos salen de aquí: el tenant de prueba y, sobre todo, el **procedimiento reutilizable** para dar de alta el siguiente.

## 2. Decisiones cerradas

| # | Decisión | Elección |
|---|---|---|
| T1 | Propósito | Tenant cero / plantilla dentro de `governance_OS`. Grupo ficticio, sin dato real. Se mantiene D2 del spec de Garrigues: mismo Supabase, mismo repo, aislamiento por RLS, sin fork |
| T2 | Suelo jurídico | SA y SL comunes. Sin cotizada, sector regulado ni formas especiales |
| T3 | Alcance | Instancia básica, **todos los módulos abiertos**: no se declara lista blanca `branding.modules` |
| T4 | Origen del pack base | **El estado vivo de Cloud, no `scripts/seed-rule-packs.ts`** (ver §5.1). Rectifica la recomendación inicial de clonar desde el seed |
| T5 | Identidad | «Grupo Nuevo», clave `nuevo`, tenant `00000000-0000-0000-0000-000000000003`, prefijo de packs `GN`. Marca descriptiva y sin narrativa (confirmado formalmente como definitivo en MOI-131, Opción A) |
| T6 | Visibilidad en login | El entorno nuevo **solo aparece llegando por `/login?tenant=nuevo`**. El selector que ven las demos de ARGA y Garrigues no cambia |
| T7 | Fixtures de demo | El tenant declara `branding.fixtures = "none"`. ARGA (branding NULL) y Garrigues (sin la clave) siguen viendo lo mismo que hoy |

Si el propósito pasara a ser un piloto con dato real de un tercero, T1 deja de valer: proyecto Supabase separado y el endurecimiento F0 de la spec de producción antes de cargar nada.

## 3. Diagnóstico que sostiene el diseño

Verificado contra el repo (`main` en `b1721a5`) y contra Cloud en solo lectura el 2026-09-19.

- **Multi-tenant de origen.** 175 de las 192 tablas de `public` llevan `tenant_id`. Tenant de sesión desde `user_profiles.tenant_id`; marca desde `tenants.branding`.
- **El alta desde cero existe.** `/secretaria/sociedades/nueva` (11 pasos) sobre `fn_crear_sociedad_legal_y_capital` (TX1) más cargos y representaciones (TX2), con estados `INCOMPLETA_DATOS → INCOMPLETA_CARGOS → OPERATIVA`. El paso «Perfil» (rol en grupo, matriz, % de participación) es el cableado del grupo. Alrededor: alta e importación de personas, añadir socio, designar administrador, representante de administrador PJ, transmisiones y «Activar marco normativo».
- **Lo que un tenant vacío no tiene** es su suelo: `rule_packs`, `plantillas_protegidas` y `jurisdiction_rule_sets` son por tenant, todos los hooks filtran por `tenant_id` y la resolución de reglas es por materia y sin fallback. Sin suelo se dan de alta sociedades, pero no se convoca ni se adopta un acuerdo.
- **branding NULL = ARGA.** `tenant-brand-labels.ts` y `tenant-scopes.ts` devuelven los rótulos de ARGA verbatim cuando no hay branding. Es el contrato cero-cambio de ARGA; para un tenant nuevo significa que la marca es obligatoria.
- **`rule_packs.id` es TEXT PRIMARY KEY GLOBAL.** Sin prefijo por tenant, clonar colisiona con los ids de ARGA. Garrigues ya sentó el precedente (`GARR_APROBACION_CUENTAS` con materia `APROBACION_CUENTAS`).
- **Columnas con `DEFAULT '…0001'`** (p. ej. `jurisdiction_rule_sets.tenant_id`): un INSERT que omita el tenant aterriza en ARGA sin error.

## 4. Arquitectura

```
scripts/tenants/tenant-spec.ts          catálogo de tenants en blanco + validador (puro)
scripts/tenants/bootstrap-lib.ts        selección, saneado, clonado, integridad, entorno (puro)
scripts/tenants/pack-base-lsc/          snapshot congelado: 3 JSON + MANIFEST con sha256
scripts/export-pack-base-lsc.ts         Cloud → snapshot. SOLO LEE de Cloud
scripts/tenant-bootstrap.ts             snapshot → tenant. Dry-run por defecto; --commit escribe
src/lib/login-brands.ts                 tercer entorno + entornosVisibles()
src/lib/tenant-fixtures.ts              usaFixturesDemo(branding)
src/components/fixtures-guard.tsx       guard de las páginas que son fixture entero
```

Todo lo que decide **qué** se escribe es código puro y testeado sin red. Los dos scripts con E/S son finos, idempotentes, aditivos (nunca `DELETE`, nunca mutar una versión ya escrita), con guard de target a `governance_OS` y la service-role key solo por entorno.

### 4.1 Fase `fundacion`

Fila `tenants` (con `tenant_type` copiado de ARGA: el schema manda) y branding completo; usuarios Auth con la contraseña de `DEMO_PASSWORD_NUEVO`; `user_profiles`; `rbac_user_roles`; seis filas `grc_modules` genéricas con propietario «Pendiente de designación». `risk` es obligatoria: `tg_sync_obligation_to_backbone` cae a ella sin comprobar que exista.

Dos salvaguardas que el seed de Garrigues no tenía: un UUID de tenant ocupado por otro nombre no se pisa, y un usuario con perfil en otro tenant **no se traslada** (`fn_current_tenant_id()` deriva el tenant de esa columna).

### 4.2 Fase `pack-base`

Carga el snapshot verificando sus hashes, pasa el **Gate PRE local** (`validateTemplateForActivation`) a las 72 plantillas también en dry-run, y escribe:

- `rule_packs` con id `GN_<origen>`, **materia canónica sin prefijo** (el motor resuelve por `(tenant_id, materia)`), payload verbatim y procedencia en `descripcion`; una versión `ACTIVE` por pack.
- `jurisdiction_rule_sets` de España, con `tenant_id` explícito e id determinista.
- `plantillas_protegidas` en `BORRADOR` y promoción `REVISADA → APROBADA → ACTIVA` por `fn_secretaria_transition_template_state`, que es el único camino que admite el trigger de estado. Id determinista (UUID v5 de tenant + plantilla de origen): re-ejecutar reanuda, no duplica.

Un pack ya sembrado cuya versión activa no es la del snapshot **no se toca**: subir de versión una regla es una decisión jurídica, no un efecto de re-ejecutar un script.

### 4.3 Vigilancia de contaminación

El script fotografía el recuento de filas de ARGA y de Garrigues en las seis tablas que toca, antes y después. Si algo se mueve, termina en rojo diciendo qué tabla. No es una promesa: es una medición en cada ejecución.

## 5. El pack base LSC

### 5.1 Por qué sale de Cloud y no del seed

`scripts/seed-rule-packs.ts` describe 35 materias en su versión original. En Cloud, los 59 packs de ARGA han pasado por las correcciones del Comité Legal aplicadas por migración —mayorías reforzadas del art. 201.2 LSC, quórum inventado de SL, lotes 1 y 2 de saneado— y 13 de los 58 que entran en el pack tienen hoy una versión activa posterior a la 1.0.0 (1.0.1, 1.1.0 o 1.1.1), con sus predecesoras `RETIRED`. **Clonar el seed resucitaría reglas ya corregidas.** El origen correcto es lo que hoy está `ACTIVE` y revisado.

Para no depender de otro tenant en tiempo de ejecución ni perder reproducibilidad, ese estado se **congela en el repo**: `export-pack-base-lsc.ts` lee de Cloud y escribe un snapshot con manifiesto de hashes. El repo pasa a ser la fuente de verdad del pack base, revisable por diff y testeable sin red. `cargarPackBase` se niega a cargar un fichero editado a mano.

### 5.2 Contenido del snapshot de 2026-09-19

| Tabla | En origen | Incluidas | Excluidas |
|---|---|---|---|
| `rule_packs` | 59 | **58** | 1 |
| `jurisdiction_rule_sets` | 16 | **5** (ES) | 11 (PT, BR, MX: fuera de T2) |
| `plantillas_protegidas` ACTIVA | 72 | **72** | 0 |

Excluido: `NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO`, cuya versión activa tiene `status` NULL y lleva `demo_scope: "ARGA Secretaria Societaria"`. La cooptación sigue cubierta por el pack `COOPTACION`.

### 5.3 Reglas de selección (fallan cerrado)

Un rule pack entra si tiene exactamente una versión activa, con `status = 'ACTIVE'` expreso, sin clave `demo_scope` y sin mención a ARGA. Una plantilla entra si está `ACTIVA`, es de España, tiene capa inmutable y **ningún campo que llegue a un documento** menciona ARGA.

### 5.4 La única transformación admitida

28 plantillas llevan en su capa inmutable el aviso «…evidencia demo/operativa del **prototipo ARGA Governance Map**». Es un descargo del producto que nombra el repositorio de origen, no contenido jurídico. Se sustituye por «prototipo TGMS» —la misma fórmula que ya usan las plantillas de Garrigues— por **cadena exacta**, y se recalcula `content_hash_sha256 = sha256(capa1)`, que es la fórmula que el servidor vuelve a calcular al emitir una convocatoria. Cualquier otra mención a ARGA que sobreviva **excluye** la plantilla; no se «arregla».

La detección es por palabra completa y sensible a mayúsculas: una búsqueda insensible casaba «enc**arga**ndo».

### 5.5 Aviso de revisión legal abierto

`ACTA_SESION / ACTA_COMISION_DELEGADA v1.0.1`: sus notas legales dicen que el voto de calidad queda deshabilitado en comisiones delegadas por el **Reglamento del Consejo de ARGA**. La plantilla entra en el pack —no menciona ARGA en ningún campo renderizable— pero puede encarnar una regla propia de ese grupo y no derecho común. Queda anotado en el manifiesto y el bootstrap lo imprime en cada ejecución. **Pendiente de criterio del Comité Legal.**

### 5.6 Dependencia de servidor descubierta

La RPC de emisión de convocatoria busca, dentro del tenant, la plantilla `CONVOCATORIA / CONVOCATORIA_CDA` en **versión 1.1.0**, `ACTIVA` y con hash íntegro. Por eso las plantillas se clonan conservando la versión de origen, y un test del snapshot exige que esa exista.

## 6. Cambios en la aplicación

- **Login.** Tercer entorno en `LOGIN_BRANDS`; `entornosVisibles()` lo muestra solo cuando se llega por su enlace. Un test vigila que su `tenantId` no diverja del catálogo de scripts.
- **Fixtures.** ESG, Notificaciones y dos tarjetas del Dashboard («Actividad reciente» y el resumen ESG) pintan ficheros estáticos de ARGA. Con `fixtures: "none"` el tenant ve un vacío honesto. Mientras el perfil o el branding están en vuelo no se pinta ni el fixture ni el vacío: en ese frame `branding` vale null igual que para ARGA.
- **Sin cambios, a propósito:** SII («Pendiente de designación»), AIMS (sin órgano de IA, el panel no se pinta) y el panel demo-operable (solo ARGA) ya fallan cerrado para un tenant desconocido. `Conflictos` ya ocultaba sus operaciones vinculadas de ejemplo a todo tenant con marca. `/grc/m/:moduleId` lee `grc_module_nav` por tenant: nace vacío.

## 7. Gate de salida

`src/test/schema/tenant-cero-isolation.test.ts`. El estado del tenant en Cloud es **dato declarado** en el catálogo (`cloud: "PENDIENTE" | "PROVISIONADO"`), no una sonda:

- `PENDIENTE` → el gate aparece como `todo` en la corrida, con la orden que lo desbloquea. Ni verde mudo ni rojo en una suite compartida por algo que nadie ha ejecutado.
- `PROVISIONADO` → corre con tres logins reales y **lanza** si no puede autenticar: el tenant nuevo no ve filas ajenas en 15 tablas; ARGA y Garrigues no ven las suyas en las 4 tablas donde el bootstrap deja dato, con control positivo para que la aserción no sea vacua; el pack base está completo y con materias canónicas; una escritura cruzada no muta nada (se intenta con el mismo valor, para que un fallo de aislamiento se detecte sin dañar a ARGA).

## 8. Mapa de capacidad desde cero

Medido sobre las escrituras reales de `src`. Es lo que «probar toda la capacidad» puede significar hoy.

| Módulo | ¿Se puebla por pantalla? |
|---|---|
| Secretaría | **Sí, ciclo completo.** Frontera conocida: la certificación queda bloqueada en custodia EAD por diseño |
| AIMS 360 | **Sí.** Sistema por cuestionario, evaluación, congelación, revisión a cuatro ojos, incidentes |
| SII | **Sí.** El catálogo de un tenant desconocido nace vacío |
| GRC Compass | **Parcial.** Riesgos, incidentes, excepciones y terceros |
| Políticas, obligaciones, controles, hallazgos, planes de acción, delegaciones, conflictos | **No.** Cero escrituras desde la UI: viven de dato sembrado |
| Órganos tras el alta y estructura de grupo | **No.** Solo nacen o se fijan dentro del alta de sociedad |

La primera pasada se hace **sin kit de arranque**, para inventariar lo que un cliente no podría hacer el día uno. Después, módulo a módulo: alta por pantalla o kit genérico en el bootstrap.

## 9. Riesgos y salvaguardas

| Riesgo | Salvaguarda |
|---|---|
| INSERT sin tenant cae en ARGA por el `DEFAULT` | Todo INSERT nombra `tenant_id`; recuento de ARGA y Garrigues antes y después en cada ejecución |
| Colisión de `rule_packs.id` global | Prefijo por tenant validado; comprobación en Cloud de que el id no es de otro tenant; test de no colisión |
| Resucitar reglas ya corregidas | Origen = Cloud vivo, no el seed (§5.1) |
| Snapshot retocado a mano | Hashes en el manifiesto; `cargarPackBase` no carga si no casan; test con control positivo |
| Dato de otro grupo presentado como propio | Exclusión fail-closed por mención a ARGA; `fixtures: "none"`; marca obligatoria |
| Cambiar lo que ven ARGA o Garrigues | Login por enlace; fixtures por declaración expresa; tests que fijan los dos casos |
| Gate verde sin asertar | Estado declarado + `todo` visible; con `PROVISIONADO`, no poder mirar es un rojo |
| Subir de versión una regla por re-ejecutar | Los packs divergentes no se tocan: se listan |

## 10. Fuera de alcance

Herencia de reglas desde un tenant «sistema» (cambio de modelo); jurisdicciones PT/BR/MX; cotizada y sector regulado; alta por pantalla de políticas, obligaciones, controles, hallazgos, delegaciones y conflictos; UI para crear órganos tras el alta o editar la estructura de grupo; alta masiva de sociedades; piloto con dato real.

## 11. Pendiente

1. ~~Autorización para escribir en Cloud y contraseña~~ — hecho el 2026-09-19. `DEMO_PASSWORD_NUEVO` generada al azar y añadida al `.env` local (ignorado por git).
2. ~~Bootstrap con `--commit`, `cloud: "PROVISIONADO"` y gate a tres tenants~~ — hecho: 58 rule packs, 5 rule sets, 72 plantillas `ACTIVA`, 6 módulos GRC, 2 usuarios; re-ejecución en dry-run = 0 por crear; gate 25/25.
3. Criterio del Comité Legal sobre §5.5.
4. **Ver el tenant en un navegador.** Producción sirve `main`, que no conoce el tercer entorno: hace falta arrancar la aplicación en local (`bun run dev` → `/login?tenant=nuevo`) o desplegar estos cambios.
5. Recorrido por pantalla con el guion y registro de hallazgos.
6. Commit por rutas específicas (el árbol es compartido) y nota en `CLAUDE.md` cuando el dueño del repo lo decida.
7. El gate bilateral `tenant-isolation.test.ts` y el resto de sondas de `src/test/schema/` no se han corrido tras añadir el tercer tenant.
