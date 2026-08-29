# SDD ledger — plan: docs/superpowers/plans/2026-08-29-c3-grc-esg-sii-garrigues.md

BASE inicial: 1888aa0 (worktree /private/tmp/c3-grc, rama feature/c3-grc-esg-sii).
Carril C3 (GRC/ESG/SII). Worktree autorizado por el usuario vía orquestación tras detectar
que los tres carriles compartían un único árbol de trabajo y que `git checkout -b` habría
movido el HEAD de C1 y C2 a la vez. Enlaces simbólicos a "version garrigues"/"DOC GRC"/
node_modules + .env copiado, para poder medir en los DOS modos (con y sin carpetas fuente).

LÍNEA BASE medida por la orquestación en el árbol del usuario: 3461 pass / 152 skip / 0 fail.
Medida por C3 en árbol limpio (git archive HEAD): 3457 / 157 / 0. Ambas correctas: la
diferencia la produce g5-mapa-penal.test.ts:12 (describe.skip se cuenta A SÍ MISMO como una
entrada más: 4 `it` -> 5 skips, total +1). Mecanismo cerrado y fijado en el tablero.

HIGIENE: `git add` solo con rutas. El árbol compartido se devolvió a HEAD tras trasladar
los ficheros al worktree (0 entradas sucias en la superficie de C3, sigue en main).
db:check-target: pass (governance_OS).

## Tarea 0 — auditoría de lo heredado (G5, G6, SII) + verificación TSL

Tres auditorías adversariales en paralelo, con instrucción de no aceptar "todo bien" sin
evidencia fichero:linea y de marcar CONFIRMADO vs PLAUSIBLE. Resultado: G5 con 3 P0, G6 con
4 P0, SII con 6 P0. Ninguna de las dos fases había pasado ledger ni review adversarial.

VERIFICACIÓN TSL (autorizada sin condiciones por la orquestación): EAD Trust European Agency
of Digital Trust, S.L. (B85626240) ES prestador CUALIFICADO. Cadena LOTL UE (seq 392) ->
TSL ES (tsl.digital.gob.es, seq 188 de 2026-08-06). Servicios: CA/QC + TSA/QTST, granted
desde 2020-10-05. SIN EDS/Q (QERDS) ni PSES/Q, con discriminante: 71 y 22 servicios de esos
tipos en otros prestadores de la misma lista. Luego el regimen que afirmaba G6 (entidad
esencial, art. 3.1.b) era CORRECTO; solo le faltaba la fuente. Verificado de forma
independiente por la orquestación sobre su propia descarga: los 7 hechos coinciden.
Registro canónico: docs/legal/2026-08-29-tsl-ead-trust-servicios-cualificados.md

CORRECCIÓN A UN AUDITOR PROPIO: el auditor del SII denunció DOS citas erróneas de la Ley
2/2023. Cotejado el consolidado del BOE (BOE-A-2023-4513) por el controller:
  - "Libro-Registro (Art. 34)" -> MAL. Es el art. 26 ("Registro de informaciones"); el
    art. 34 es "Delegado de protección de datos". El auditor acertó.
  - "(Art. 36)" para prohibición de represalias -> BIEN. El art. 36 ES "Prohibición de
    represalias"; el art. 35 es "Condiciones de protección". EL AUDITOR SE EQUIVOCÓ y su
    corrección habría METIDO un error en una ficha que se enseña a abogados.
  Regla adoptada por el tablero: toda corrección de cita legal propuesta por un agente se
  coteja contra el consolidado antes de aplicarse, aunque el agente ya haya acertado antes.
  De propina: art. 25 = "Información sobre los canales interno y externo de información",
  que es la cita correcta para la ausencia de canal externo (nadie la tenía).

MEDICIÓN DE ARGA (la orquestación pidió expresamente no presumir): la migración de G6
20260820130000 reescribe una función compartida y enruta OBL-LEY2-% de 'ethics' a 'aml'
pese a declarar "Cero cambio para ARGA".
  - Primer dato, ENGAÑOSO: 0 filas OBL-LEY2-%/OBL-NIS2-% en `obligations`, en ningún tenant.
    Con eso solo se habría concluido "rama muerta, cero impacto". Habría sido un error.
  - ARGA SÍ las tiene, pero en el BACKBONE: grc_obligations OBL-LEY2-009 (ethics) y
    OBL-NIS2-021 (cyber), sembradas por grc_core_seed.sql sin pasar por el trigger.
  - VEREDICTO: ARGA **no cambió**. updated_at = 2026-04-26, cuatro meses ANTES de la
    migración, y el trigger es AFTER INSERT OR UPDATE ON obligations (verificado con
    pg_get_triggerdef): cambiar la función no reescribe filas existentes.
  - PERO la cabecera es falsa igual y el riesgo es latente y SILENCIOSO: ARGA tiene el
    módulo 'aml' (13 módulos), así que un futuro INSERT/UPDATE de una obligación
    OBL-LEY2-% de ARGA archivaría su canal interno bajo PBC/FT sin error ni log.
  - Hallazgo lateral útil: ARGA YA tiene módulo 'esg' en grc_modules, así que la fila
    autorizada para Garrigues no inventa taxonomía nueva.
  Corrección de la función compartida: RETENIDA por la orquestación (superficie congelada).

## Tarea 1 — saldar los tres P0 heredados de G5/G6

BASE 1888aa0. Ejecutada por el controller (cambio quirúrgico de ~20 líneas en 4 ficheros);
review adversarial independiente despachada aparte.

CAUSA RAÍZ, afinada por la orquestación y más incómoda que la hipótesis inicial:
`VITE_SUPABASE_ANON_KEY` **no ha existido nunca** en este repo — el .env nombra ANON_PUBLIC/
PUBLISHABLE_KEY. 19 sondas la leen; 17 tienen literal de reserva y viven de él. G5 y G6
copiaron la línea SIN el `||`. Luego los 594 expects medidos NO son "lo que se pierde en
worktree limpio": son lo que se perdía SIEMPRE, en todos los entornos, desde que G5 existe.
El bloque Cloud de G5 no había corrido nunca.

Cambios:
  1. Fallback de 3 ramas (VITE_ || ANON_PUBLIC || literal) en g5-mapa-penal y
     g6-ciberseguridad, CON comentario explicando por qué — G4 ya lo había parcheado y sin
     el comentario la tercera vez estaba garantizada.
  2. Aserción de no-vacuidad en ambos beforeAll: sin sesión, el gate FALLA en vez de pasar
     mudo. Los `if (!garr) return;` de cada `it` convertían la ausencia en verde.
  3. Risk360: eliminada la rama que mapeaba assessed_band a criticos/altos/medios/bajos
     (D-2 violado) y que contaba los 11 NO_EVALUADA como "bajos" — la 4ª afirmación falsa
     del §4 resucitada en pantalla justo donde el trigger dejó de decirla.
  4. KPI criticalCount/highCount vuelven a calcularse SOLO sobre score, como promete §10.
  5. Test nuevo que vigila LA SUPERFICIE que comete el defecto, no la constante de al lado:
     assessed-band.test.ts miraba ETIQUETA_BANDA (que estaba bien) y daba verde mientras
     Risk360.tsx hacía el mapeo prohibido.

MEDICIÓN (worktree, ambos modos):
  Aserciones de los 3 ficheros tocados: 663 -> **1944** (+1281), 0 fail.
  Modo A (con carpetas fuente): **3463 pass / 152 skip / 0 fail**, 17363 expects, 3615 tests.
  Modo B (sin carpetas fuente): **3459 pass / 157 skip / 0 fail**, 16944 expects, 3616 tests.
  Base: 3461/152 y 3457/157. Delta +2 pass en ambos = los dos tests nuevos. Sin regresión.
  typecheck exit 0 · lint exit 0 · build exit 0.
  Nota: en modo B los expects suben de 15661 a 16944, o sea el bloque Cloud ya corre TAMBIÉN
  sin los PDF fuente — que era justo el punto: sólo le faltaba la credencial.
  ARGA no atraviesa código nuevo: sus 167 riesgos tienen score, la rama assessed_band no se
  evalúa para ellos y los KPI dan lo mismo que antes.

Task 1: REVIEW ADVERSARIAL — 1 P1 + 4 P2 contra mi propio trabajo. Veredicto del revisor:
  "hace lo que dice en dos de tres; el test nuevo NO protege lo que el commit acaba de arreglar".
  Prueba de mutación del revisor: 8 mutantes semánticamente idénticos al defecto, **6 ESCAPAN**.
  El principal, M6 = revertir SOLO el KPI, que es la mitad del arreglo prometido: las líneas del
  KPI no contienen "criticos" ni "Crítico" (criticalCount no casa: la regex lleva tilde), así que
  el guard por regex no las mira. Es el mismo patrón del fallo histórico del `?? 3` -> ternario,
  cometido por quien lo estaba citando.
  P2 adicionales, los tres CONFIRMADOS y los tres míos:
    - `return filter === FILTER_ALL` era CONSTANTE-FALSO (la línea 78 ya había returneado en esa
      condición): un `return false` disfrazado de algo que deja pasar.
    - El comentario que escribí era FALSO: decía "se filtran por su propia tira de bandas" y NO
      EXISTE ningún filtro por banda en la app; la tira se deriva de `risks`, ya filtrada.
    - Medido contra Cloud: con mi cambio, Garrigues pasaba a "0 de 82 riesgos visibles" en las 4
      opciones no-Todos, con mapa vacío y sin tira. Cuatro opciones muertas y sin explicación.
    - KPI 0/0 mudo sobre 82 riesgos con 1 ROJO y 7 NARANJA, bajo el helper "Exposición alta que
      requiere decisión": se lee como "no hay exposición alta".
  Confirmado por el revisor: fallback de credencial idéntico al resto del repo; el fallo ruidoso
  FUNCIONA (credencial inválida -> 1 fail, exit 1, los `it` Cloud no llegan a ejecutarse);
  ARGA intacta MEDIDA contra Cloud (criticalCount 1->1, highCount 15->15, filtro Críticos 1->1).

Task 1: fix round 1/1. El arreglo NO es endurecer el regex —es una carrera armamentística que se
  pierde— sino mover la decisión a función pura y probar COMPORTAMIENTO:
    1. `matchesScoreFilter`, `riskScore` y `countSeverity` extraídas a src/lib/grc/assessed-band.ts
       (módulo hoja, sin ciclos). Risk360 las importa; se borran las copias locales.
    2. Test de comportamiento: ninguna banda satisface ningún filtro; NO_EVALUADA no es "bajos";
       countSeverity no suma bandas pero sí suma ejes (camino de ARGA); y la celda (sin ejes, sin
       banda) —hoy despoblada pero ALCANZABLE por la CHECK— tampoco cae en "bajos".
    3. Test de ARISTA, que es lo que faltaba: el test de comportamiento protege la función, no que
       la pantalla la use. Se asierta que Risk360 llama a countSeverity/matchesScoreFilter y que no
       define copia propia. Sin esto, M6 seguiría escapando.
    4. UX: si el perímetro no tiene NINGÚN riesgo con ejes, el selector de Prioridad se retira y se
       explica, en vez de dejar 4 opciones que solo producen listas vacías.
    5. El helper del KPI dice cuántos riesgos quedan FUERA del recuento y por qué.
  PRUEBA DE MUTACIÓN EJECUTADA POR MÍ sobre copias en /tmp (el worktree no se toca):
    M6 (revert del KPI en la función)  -> 2 fail  CAZADO
    M6b (revert del KPI en la pantalla)-> 1 fail  CAZADO
    M3 (constante intermedia BANDA_CRITICA) -> 1 fail  CAZADO
    Base restaurada -> 19 pass / 0 fail.
  GATES: modo A **3469 pass / 152 skip / 0 fail** (17395 expects) · modo B **3465 / 157 / 0**
  (16976 expects) · typecheck 0 · lint 0 · build 0. Base 3461/3457: +8 y +8 = los 8 tests nuevos.

MERGE nº2 del programa: C3 entró en main tras C2. `main` 27d1479 == origin/main. Medición del
  orquestador en el árbol COMPARTIDO: 3476 / 152 / 0, 17453 expects, 3628 tests — clava la del
  worktree hasta el número de expects. Delta +8 sobre la referencia post-C2 (3468): los 8 tests.
  El gotcha que frenó a C2 (copia untracked del plan en el compartido bloqueando el merge) no me
  afectó: al montar el worktree devolví el compartido a HEAD con `git restore` + `rm` en vez de
  dejar copias.

Task 2: BASE 27d1479 (main con C2 integrado). Aislamiento por tenant del canal interno.
  DEFECTO: `SII_STORAGE_KEY = "arga_sii_whistleblowing_cases_v1"` — bucket ÚNICO para todos los
  tenants, 4 queryKeys literales sin tenant, 0 usos de useTenantContext, y las 5 rutas /sii/* sin
  RequireModule pese a que `branding.modules` de Garrigues sí incluye "sii". Un usuario de
  Garrigues veía las tres denuncias de ARGA bajo la cabecera "SII · Garrigues". La fuga es por
  navegador (localStorage), no de servidor: grave para la demo y para la coherencia del producto,
  no un incidente con terceros afectados.
  LAS TRES PUERTAS (la 3ª la levantó el orquestador, yo solo había visto dos): getStoredReports
  devolvía INITIAL_SII_REPORTS por (1) guard de SSR, (2) bucket vacío -> siembra y devuelve, y
  (3) `catch` de JSON corrupto -> devuelve SIN sembrar, y por eso no deja rastro en localStorage y
  es la más difícil de reproducir. Cambiar solo la clave habría DUPLICADO la fuga en vez de
  cerrarla: con bucket propio, Garrigues habría estrenado uno vacío y el código le habría copiado
  dentro los casos de ARGA.
  HECHO: src/lib/sii/tenant-scope.ts (módulo hoja; siiStorageKey LANZA sin tenant, para que no
  exista firma que reintroduzca el bucket compartido); initialReportsFor(tenantId) como ÚNICO
  sitio donde se elige la siembra, por el que pasan las tres puertas; 11 lecturas y 7 escrituras
  con tenant explícito; 4 queryKeys por siiQueryKey() con el tenant en 2ª posición y
  `enabled: !!tenantId` en las 4; 7 invalidaciones scoped; las 5 rutas envueltas en RequireModule.
  El patrón NO es nuevo: SociedadNuevaStepper.tsx:120 ya construía `${PREFIJO}:${tenantId}`.
  Se aplica al SII lo que Secretaría ya hacía bien, sin introducir un segundo sabor.

Task 2: FRAGILIDAD INTRODUCIDA POR MÍ Y CORREGIDA. El fallo ruidoso de la Task 1 puso la suite
  completa a depender del login vivo: modo B dio 2 fail y luego modo A dio 1 fail, de forma NO
  determinista, mientras los ficheros aislados pasaban siempre. En vez de añadir reintentos a
  ciegas se midió la causa: sonda de 8 logins concurrentes -> **6 responden HTTP 429 "Request
  rate limit reached"** y 2 pasan. Es estrangulamiento de Supabase Auth por IP, no un fallo del
  gate. ARREGLO: reintento con espera creciente (800/2000/4500 ms) SOLO ante 429; cualquier otro
  error (clave rotada, credencial mala, Cloud caído) no se reintenta, se propaga y el beforeAll
  falla ruidoso con el status y el mensaje en la aserción. Más una aserción DETERMINISTA de que
  la credencial está configurada, que es la que caza el defecto original (la variable no existía).
  Deuda de fondo, ya catalogada y no de esta tarea: 19 sondas resuelven credenciales por su
  cuenta y abren ~38 logins, mientras existe src/test/helpers/supabase-test-client.ts que ya usan
  27 ficheros. Unificarlas es el arreglo real del 429.
  GATES: modo A **3485 / 152 / 0** en DOS corridas seguidas (17469 y 17189 expects) · modo B
  **3481 / 157 / 0** (16770) · typecheck 0 · lint 0 · build 0.
  NOTA sobre la varianza de expects entre corridas: no es ruido inocuo. Son los ficheros de la
  era G4 que graceful-skipean bajo 429 y por tanto asertan menos sin ponerse rojos — el mismo
  defecto que el orquestador catalogó en 4 ficheros y que queda en cola detrás de esta tarea.
