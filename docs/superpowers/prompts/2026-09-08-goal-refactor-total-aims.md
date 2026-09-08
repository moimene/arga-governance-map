# GOAL — Refactor total del módulo AIMS (AI Governance)

Modo: **goal**. Tú eres el hilo principal: orquestas, juzgas, integras y cierras. Puedes abrir carriles paralelos, pero el juicio, los gates, los merges a `main` y el cierre son tuyos. No termines hasta cumplir los criterios de salida **verificados**. Si un bloqueo real lo impide (autorización del usuario para escribir en Cloud, decisión del Comité de IA, dato que no existe), para, deja el estado escrito y di exactamente qué falta y por qué.

Esto **no** es otra ronda de correcciones. El 2026-09-07 se hizo una corrección a fondo puntual sobre lo que el primer alta real destapó. Lo que queda es lo que ninguna corrección puntual arregla: **el módulo tiene dos modelos de datos, tres fachadas sin camino de escritura, tres pantallas de más de mil líneas y un catálogo de posturas mantenido a mano que es una segunda fuente de verdad.**

---

## 0. Lee antes de actuar, en este orden

1. `CLAUDE.md` completo, en especial la sección «Módulo AIMS — corrección a fondo tras el primer alta real (2026-09-07)». No negociables: ARGA es pseudónimo (jamás el nombre real del cliente); EAD Trust solo interposición, mensajería básica y custodia (ningún claim de QES, firma, ERDS, envío, entrega o sello); `bun run db:check-target` antes de tocar Supabase; migraciones forward-only con espejo en `supabase/migrations/`; nunca `db push` ni `repair`; `git add` solo por rutas explícitas; nunca commitear `version garrigues/`; no escribir en `governance_module_events` / `governance_module_links`.
2. `docs/superpowers/reviews/2026-09-07-cierre-aims-piloto-harvey.md`: qué se cerró, qué acredita cada huella y qué quedó fuera de alcance a propósito.
3. La memoria del proyecto, en especial `project_aims_correccion_a_fondo_2026_09_07`, `feedback_postgrest_no_filtra_la_mutacion_por_el_join`, `feedback_grant_aditivo_truncate_sin_rls`, `feedback_retirada_a_medias`, `feedback_gate_que_fija_la_mentira`, `feedback_guard_de_texto_se_derrota`, `feedback_gates_vacuos_y_arnes_mutacion`, `feedback_verify_empirically_release_critical`, `project_c2_ai_governance_auditoria` (**ojo: su afirmación de «10 tablas inexistentes» es FALSA hoy — ver §1**).
4. `docs/superpowers/reviews/2026-09-02-revision-profunda-carriles-garrigues.md`, hallazgos de AIMS, y el ledger `2026-09-06-ledger-cierre-gaps-verificacion.md`.

## 1. Estado de partida MEDIDO (2026-09-08, contra Cloud y contra el árbol)

No lo des por bueno: vuelve a medirlo antes de tocar nada. Se deja aquí para que sepas qué esperar y qué contradice a los informes viejos.

| Superficie | Medida |
|---|---|
| `main` | `083b757`. Árbol con material ajeno que **no se toca**: `Gobernanza ia/`, `docs/architecture*`, `DOC GRC/para tirar*`, `pkcs11.txt`, `scripts/*platform-architecture*`, hunks Archify en `.gitignore` / `README.md` / `package.json` |
| Páginas | 10 ficheros, **7 660 líneas**. `SistemaDetalle` 1 398, `EvaluacionNueva` 1 360, `Dashboard` 1 028, `EvaluacionDetalle` 806, `IncidenteDetalle` 759 |
| `src/lib/aims/` | 10 módulos, 3 149 líneas. `readiness.ts` **892**, de las que ~220 son un catálogo de posturas de pantalla y handoffs escrito a mano (`aimsScreenPostures`, `aimsReadOnlyHandoffs`) |
| Hooks | 7 ficheros, 1 364 líneas: `useAiSystems`, `useAiAssessments`, `useAiIncidents`, `useAimsEvidence`, `useAimsFria`, `useAimsMultiregime`, `useAimsTechnicalFile` |
| Tests | 15 en `src/lib/aims/__tests__/`, 2 en `src/test/aims/`, 2 sondas en `src/test/schema/` |
| Tablas en Cloud | **25** `aims_*` (CLAUDE.md dice 28: corregir el dato) + 4 `ai_*` |
| Dato ARGA (`…0001`) | 8 sistemas, 7 evaluaciones, 49 checks, 1 incidente; y unas pocas filas `aims_*`: 4 `requirement_catalog`, 2 `control_catalog`, 3 `system_versions`, 5 `technical_file_sections`, 1 `monitoring_indicators`, 1 `post_market_plans` |
| Dato Garrigues (`…0002`) | **1 sistema (Harvey), 1 evaluación, 12 checks, 0 incidentes, y CERO filas en las 25 `aims_*`** |

**Corrección a un informe anterior, medida:** las 7 tablas `aims_fria_*`, `aims_incident_regimes` y las 5 del expediente técnico **SÍ EXISTEN**. El defecto no es «fachada contra tablas inexistentes» — es **fachada de lectura sobre tablas vacías sin ningún camino de escritura en el producto**. Es un defecto distinto y se arregla distinto.

## 2. Qué significa «refactorizado del todo»

Seis invariantes. Cada una tiene que quedar probada, no declarada.

1. **Una frontera legacy/backbone decidida objeto por objeto, y ejecutada.** Hoy `ai_systems` es el inventario y 25 tablas `aims_*` están detrás de tres hooks que leen y nunca escriben. Para cada una de esas tablas, exactamente uno de dos destinos: **(a)** camino de escritura real desde una pantalla, con RLS probada en las dos direcciones; o **(b)** el hook y su superficie **se retiran** (ruta, sidebar, y los tests que solo los mantenían vivos). No hay tercera opción: dejar la fachada es lo que produjo el módulo actual.
2. **Un criterio, un módulo hoja, todos los consumidores.** Conformidad, check vigente, rol regulatorio, perfil de aplicabilidad, plan de adaptación y relojes ya viven en `src/lib/aims/*.ts`. Ninguna pantalla puede reimplementar ni «ajustar» uno. Módulos **hoja** sin imports cruzados: el ciclo TDZ ya tumbó `/secretaria` una vez. El gate vigila la **arista** (que los tres consumidores importen y llamen), no el rótulo.
3. **Ninguna pantalla por encima de ~400 líneas.** El wizard, la ficha del sistema y el dashboard se descomponen por paso y por bloque. El criterio se queda en `lib/`, la pantalla solo pinta. Es la condición para que una corrección llegue a las tres pantallas hermanas y no a una.
4. **El catálogo de posturas deja de estar escrito a mano.** `aimsScreenPostures` es una descripción en prosa de lo que hacen las pantallas, mantenida aparte de las pantallas: deriva en cuanto alguien toca una. O se **deriva** del código con un gate que cae cuando divergen, o se **borra**.
5. **Aislamiento probado en el camino, no en la consulta.** `ai_risk_assessments` y `ai_compliance_checks` no tienen `tenant_id`. PostgREST **no aplica a la mutación** el filtro sobre el recurso incrustado. Toda escritura nueva: probar pertenencia contra `ai_systems`, acotar la escritura al sistema comprobado con el `.eq` **pegado al `.update(`**, y `if (!data) throw` — la RLS filtra a cero **sin error**. Storage: el aislamiento va en la RUTA (primer segmento = tenant).
6. **Vocabulario único.** Un estado, una severidad, un nivel de riesgo, una postura probatoria: un solo conjunto de valores y una sola función que los traduce, compartida por lectura y escritura. Las cuatro listas de opciones sueltas en `Evaluaciones.tsx`, `Incidentes.tsx` y `Sistemas.tsx` son el síntoma.

## 3. Criterios de salida (verificables, no declarables)

1. **Tabla final de superficies**: cada pantalla, panel, KPI, badge y texto legal del módulo → **REAL** (lee/escribe tabla o RPC autoritativa, tenant-scoped, con `tenantId` en la queryKey y `enabled: !!tenantId`) / **HONESTO** (lo dice con la postura correcta) / **RETIRADO**. Ninguna fila «no verificada». Evidencia `archivo:línea` o resultado SQL en cada una.
2. **Tabla final de las 25 `aims_*`**: cada una con destino (a) o (b) del §2.1, ejecutado y probado. Ninguna queda «pendiente».
3. **Gates en `main`**: `typecheck`, `lint`, `build` limpios; `bun test` **sin bajar de 4 320 pass y sin skips nuevos** (línea base 2026-09-07). El gate es `bun test`, nunca vitest con service_role: eso muta dato real.
4. **Aislamiento cross-tenant con logins reales** en cada tabla nueva o tocada, en las dos direcciones, comprobando antes que ambos tenants tienen filas para que la aserción no pase de forma vacua. Toda migración que cree tabla lleva su `revoke delete, truncate, references, trigger … from authenticated` y verificación que **aborta**: un `grant` es aditivo y **TRUNCATE no pasa por RLS**.
5. **Arnés de mutación** en cada corrección release-crítica y en cada gate nuevo: commitear, mutar, comprobar que el test **cae en la aserción exacta**, restaurar solo el fichero mutado, comprobar que queda idéntico. Un gate que no se ha visto caer no está probado.
6. **Review adversarial de rama** (≥3 lentes, modelo medio o superior; nunca haiku) con 0 P0 abiertos antes de mergear.
7. **Verificación viva en producción** tras el push final, con los dos logins: ARGA sin cambio (control discriminante: misma medición antes y después) y Garrigues sobre Harvey.
8. **El 49 % se vuelve a medir y se explica.** Tras el refactor, el informe de Harvey dirá un número distinto: hay que decir cuál, contra qué catálogo, y por qué el anterior medía obligaciones que no le vinculan.
9. `CLAUDE.md` corregido (empezando por «28 tablas» → 25) y ledger en `docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md` con cada decisión, cada refutación y cada deuda con dueño.

## 4. Orden de ataque

1. **Medir antes de decidir.** Re-mide §1 entero contra Cloud y contra el árbol. Todo informe anterior sobre AIMS ha resultado tener al menos un dato caducado; el tuyo también lo tendrá si no lo mides.
2. **La frontera (§2.1).** Es la decisión que gobierna todo lo demás y la que más código retira. Para cada tabla `aims_*`: ¿quién escribiría en ella, desde qué pantalla, en qué flujo real? Si no hay respuesta, destino (b). Las 6 tablas con filas de ARGA se tratan con el mismo criterio, pero **cero cambio ARGA**: retirar una superficie que ARGA usa exige medir antes que no la usa.
3. **Los criterios y el vocabulario (§2.2, §2.6).** Con la frontera decidida, unificar. Cada criterio unificado trae su gate de arista.
4. **La descomposición de pantallas (§2.3).** Solo después: descomponer antes de unificar el criterio reparte el mismo defecto en más ficheros.
5. **El catálogo de posturas (§2.4)** y la tabla final de superficies, que es el mismo trabajo hecho una vez.
6. **Lo que quedó abierto del cierre anterior**: reevaluar duplicaba `ai_compliance_checks` (ARGA tiene 49 filas para 8 sistemas — comprobar si el histórico sigue creciendo); `aims_evidence_items` fuera del gate de 25 tablas por estar vacía (si el refactor la llena, entra); y el 403 silencioso en la carga del shell, ajeno a AIMS pero sin dueño.

## 5. Lo que NO decides tú — para y pregunta

- **La composición del catálogo del desplegador (43 medidas).** Es del **Comité de IA**. Está cargado y marcado «cobertura provisional». Validarlo no es tarea de producto; cambiar su composición por criterio propio, tampoco.
- **Si Harvey necesita EIPD del art. 35 RGPD.** Es del responsable de cumplimiento. El módulo lo pregunta (`MD_PD_02`) y registra la respuesta.
- **El rol regulatorio de Harvey.** Hasta que se declare desde su ficha, el autodiagnóstico se mide contra las 84 medidas del proveedor y la pantalla lo dice. **El perfil falla ABIERTO a propósito**: sin rol, catálogo completo. Medir de más y decirlo es conservador; medir de menos por un dato que falta esconde obligaciones. No lo cambies.
- **Ampliar `evidentiary_posture`** más allá de `REFERENCE`: exige un artefacto que no existe. La fricción de la migración es deliberada.
- **Cualquier escritura en `governance_OS`**: lectura libre; **toda escritura exige autorización expresa del usuario, cambio a cambio**. Sondas que no deban persistir, en `BEGIN … ROLLBACK`.
- **Borrar, pisar o duplicar dato de Garrigues.** Harvey y su evaluación son el único dato real del piloto: cualquier camino que los toque es un defecto, no una limpieza.

## 6. Trampas conocidas de este módulo

- **Retirada a medias**: se corrige el render y la ESCRITURA sigue; el toast y el rótulo persistente no; la pantalla y su hermana no; la marca no llega por CACHÉ. Diez casos en dos días. Al retirar una afirmación, buscar activamente por qué otro camino sobrevive.
- **Un gate puede fijar la mentira**: cinco gates exigían las frases que el producto no sostiene, así que retirarlas los ponía en rojo. Al escribir un guard, comprobar de qué lado está. Y el comentario que EXPLICA una retirada dispara su propio guard: `src/test/helpers/sin-comentarios.ts`.
- **Un guard de texto se derrota** con una llamada de señuelo. Vigilar comportamiento, y decir qué capa es débil.
- **Verificar un RÓTULO no prueba la ARISTA**: leer «Propietario: X» no demuestra que la FK se use.
- `mock.module` de bun es **global al proceso**. Toda sonda con más de un cliente Supabase necesita `{ auth: { persistSession: false } }`. Un `Blob` como cuerpo de subida llega vacío bajo el runner; un `Uint8Array` viaja.
- **«No medido» ≠ «cero»**: un error se propaga como `null`, nunca como 0.

## 7. Cómo reportas

En cada hito: qué se cerró con su evidencia, qué se refutó con su motivo, qué queda y por qué. Números en tabla. Nunca «hecho» sin el gate que lo prueba. Lo que no pudo verificarse va **primero** en el mensaje. El informe es parte del entregable: cotejar `git status` contra el perímetro asignado antes de commitear, porque un carril que arregla de más y lo calla es indistinguible de un carril que rompe.
