# Contrato de frontera AIMS ↔ GRC Compass ↔ Secretaría Societaria (RIA)

F5.T2 del programa RIA (MOI-175, carril D1). Fija por escrito, y con un gate
ejecutable, algo que hasta hoy solo vivía en la cabeza de quien escribía cada
migración: qué módulo es dueño de qué tabla, y cómo puede otro módulo
provocar una escritura en ella sin volverse su dueño.

Gate: `src/test/aims/frontera-modulos.test.ts`. Criterio (sin React ni
`node:fs`, para que la pantalla también pueda importarlo): `src/lib/aims/frontera-modulos.ts`.

## C-01 — Cada tabla de dominio tiene un módulo dueño

- **AIMS** es dueño de `ai_systems`, `ai_risk_assessments`, `ai_compliance_checks`,
  `ai_incidents` y de toda tabla `aims_*`.
- **GRC Compass** es dueño de `obligations`, `controls`, `risks`, `findings`,
  `action_plans`, `incidents`, `exceptions`, `capability_matrix` y de toda
  tabla `grc_*` (incluida `grc_training_records`, F5.T6).
- **Secretaría Societaria** es dueña de `agreements`, `meetings`, `minutes`,
  `certifications`, `meeting_resolutions`, `meeting_attendees`,
  `registry_filings`, `no_session_resolutions`, `unipersonal_decisions` y de
  toda tabla `secretaria_*`.
- Una tabla que no aparece en ninguna lista (`tenants`, `persons`, `entities`,
  `governing_bodies`, `policies`, `condiciones_persona`, `capital_holdings`,
  `audit_log`, …) es **núcleo compartido**: cualquier módulo puede escribir en
  ella con su propio criterio de aislamiento por tenant. El contrato no la
  vigila.

## C-02 — Una función es del módulo de su prefijo

`fn_aims_*` es de AIMS, `fn_grc_*` es de GRC, `fn_secretaria_*` es de
Secretaría. Una función sin ese prefijo (`fn_current_tenant_id`,
`fn_audit_worm`, un guardia de tenant genérico como
`fn_risks_ai_system_tenant_guard`) queda **fuera** del contrato: no se le
exige declarar nada, porque no se sabe de qué módulo es. Esto es deliberado:
extender el contrato a esas funciones exigiría nombrarlas todas a mano, y el
punto de este gate es no depender de una lista mantenida por una persona.

## C-03 — Regla de frontera

Una función del módulo A que hace `INSERT`/`UPDATE ... SET`/`DELETE FROM`
sobre una tabla del módulo B (A ≠ B, los dos con dueño reconocido por C-01)
**viola la frontera**, salvo que su nombre conste en `HANDOFFS_DECLARADOS`
(C-04) autorizado precisamente para escribir en B.

## C-04 — Handoffs declarados

La única forma legítima de que una escritura cruzada pase el gate es añadir
el nombre de la función a `HANDOFFS_DECLARADOS` en
`src/lib/aims/frontera-modulos.ts`, con el módulo destino explícito. Hoy:

| Función | Módulo de origen | Escribe en | Tarea |
|---|---|---|---|
| `fn_grc_registrar_hallazgo_ia` | GRC (nombre) | `findings`/`action_plans` (GRC) — se declara igual porque el criterio es por nombre de función, no de tabla, y el par (función, módulo) debe existir aunque hoy la función todavía no exista en ninguna migración | F5.T8 |
| `fn_grc_vincular_ia` | GRC | `grc_ai_links` (GRC) | F5.T10 |
| `fn_secretaria_registrar_dictamen_ia` | Secretaría | `secretaria_document_artifacts` (Secretaría) | F5.T13 |

Ninguna de las tres existe todavía en `supabase/migrations/`: se declaran por
adelantado para que, cuando F5.T8/T10/T13 las creen, el gate ya sepa que son
handoffs legítimos y no señuelos. **Renombrar la tabla o la función para
esquivar el gate no es una forma válida de pasar el contrato** — el gate lo
detecta igual porque compara por nombre real, no por intención declarada en
un comentario.

## C-05 — Regla de detección (E-10)

El escáner no lee una lista de migraciones elegida a mano: recorre **todas**
las de `supabase/migrations/*.sql`, extrae cada bloque
`create [or replace] function public.fn_*` y busca dentro de su cuerpo
`insert into`, `update ... set` y `delete from`. Esto significa que una
migración nueva que añada una función infractora la coge sin que nadie tenga
que acordarse de listarla.

## C-06 — Lecturas cruzadas siempre permitidas

El contrato solo mira escrituras. Un `SELECT`, una vista, o un `JOIN` de
lectura entre tablas de distinto módulo (el patrón ya extendido en este
programa: AIMS lee `governing_bodies`, GRC lee `ai_systems.id` por FK
nullable, Secretaría lee `agreements`) no entra en el gate.

## C-07 — Dos señuelos, no solo el recuento en cero

El test no se conforma con "0 violaciones en el repo real": construye dos
funciones señuelo en memoria (una `fn_grc_*` que escribe en `ai_systems`, una
`fn_aims_*` que escribe en `obligations`) y exige que el MISMO extractor las
marque. Si alguien afloja la regex del extractor para que el repo real
pase, los señuelos dejan de caer y el test lo dice — el recuento en cero deja
de ser la única señal de que el gate funciona.

## C-08 — Qué NO decide este contrato

- No decide el **contenido** de ningún handoff (qué campos lleva un hallazgo
  del art. 5, qué asunto registra un dictamen): eso es de F5.T8/T10/T13.
- No sustituye el aislamiento por tenant (`tenant_id = fn_current_tenant_id()`
  en RLS): la frontera de módulo y la frontera de tenant son dos ejes
  distintos y este contrato solo vigila el primero.
- No prohíbe que una tabla núcleo (C-01, sin dueño) reciba escrituras desde
  cualquier módulo: eso es esperado y no es una violación de frontera.

## Redirección de superficie: `/grc/m/ai`

F5.T4, en el mismo carril, cierra la única superficie de UI que hoy sugiere
que el módulo de IA vive DENTRO de GRC Compass: la ruta genérica
`/grc/m/:moduleId` acepta cualquier `moduleId`, incluido `ai` (el rama que
crea `grc_modules.ai`, migración `20260920130000`). Como la gobernanza real
de IA vive en `/ai-governance/*` y no en el `ModuleShell` de GRC,
`/grc/m/ai` redirige a `/ai-governance/programa` en los dos tenants, sin
cambiar el branding (misma shell post-auth, sin capa `ModuleShell` de por
medio). Gate: `src/test/grc/rutas-grc.test.ts`.
