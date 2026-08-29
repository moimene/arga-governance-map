# Carril C1 — Junta General de Socios de Garrigues (06/05/2026): expediente vivo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que el tenant Garrigues (`…0002`) deje de tener 0 reuniones y 0 acuerdos: la Junta General de Socios real del 6 de mayo de 2026 queda materializada y recorrible de punta a punta en la consola — convocatoria → censo y quórum → orden del día → acuerdos → acta → certificación → inscripción — con las reglas del motor SLP de G3 disparando sobre dato real, no sobre fixtures.

**Architecture:** el dato de gobierno (33 entidades, 22 órganos, 346 socios, 10 rule packs, 6 plantillas) ya existe desde G0–G3; lo que falta es el expediente. Se construye en dos mitades: (a) un pase de capital que sustituye la distribución `INFERIDO` por la estructura FIRME del art. 7 de los Estatutos, porque el motor calcula quórum y mayorías sobre `parte_votante_current` y hoy calcularía sobre pesos simulados; y (b) el expediente propiamente dicho, escrito por las RPC autoritativas existentes (`fn_crear_censo_snapshot`, `fn_generar_acta`, `fn_generar_certificacion`) y no por INSERT directos, para que la cadena WORM y los gates sean los reales. La aritmética de clases vive en un módulo TS puro y testeado, única fuente de verdad, que consumen el seed y las sondas.

**Tech Stack:** TypeScript + bun (seeds y sondas), SQL forward-only en `supabase/migrations/`, canal Cloud `supabase db query -f <fichero> --linked`, `@supabase/supabase-js` v2 con service-role para seeds y con login real para sondas.

**Spec:** `docs/superpowers/specs/2026-08-02-garrigues-tenant-gobernanza-design.md` §3.3, §3.5 y §3.6
**Dictamen legal:** `docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`
**Decisiones del usuario:** `docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-ead.md`
**Estatus y reglas de carril:** `docs/superpowers/reviews/2026-08-29-estatus-programa-garrigues-y-relevo.md` §5–§7

---

## GOAL medible

Comprobable por comando y en pantalla. Ninguna de estas líneas se declara sin haberla ejecutado:

| # | Hecho | Cómo se comprueba |
|---|---|---|
| G-1 | `meetings` del tenant `…0002` pasa de **0 → 1**; `agreements` de **0 → 10**; `convocatorias` de **0 → 1**; `minutes` **0 → 1**; `certifications` **0 → 1**; `censo_snapshot` **0 → 1** | `supabase db query -f` con el `COUNT(*)` por tabla y `tenant_id` |
| G-2 | La matriz tiene **2 clases** de participaciones (A: 694 títulos, 25 votos; B: 8 títulos, 1 voto), **347 holdings** (338×2A + 8×1B + 1 autocartera de 18A con `is_treasury`), y `metadata.confianza = 'FIRME'` con `fuente = 'art. 7 de los Estatutos Sociales'` | query sobre `share_classes` + `capital_holdings` |
| G-3 | **Regresión del acta:** los 3 presenciales (Vives, Zarza, Delgado) suman **0,8875 %** de los derechos de voto sobre la base declarada (votos de clase A no autocartera = 16.900), y la autocartera **2,59 %** sobre el total de votos (17.358) | test unitario `capital-art7.test.ts` (verde en árbol limpio) + sonda Cloud |
| G-4 | El gate `INFORME_PRECEPTIVO_ORGANO` **dispara** en los 4 acuerdos de materia configurada (admisión, exclusión, continuidad, nombramiento de administrador único) y **no dispara** en los otros 6 | query sobre los requisitos generados + captura de `/secretaria/acuerdos/:id` |
| G-5 | La mayoría del acuerdo de **admisión** se muestra como **80 % de los votos** (art. 30.3.b Estatutos) y la de **exclusión** como **doble mayoría** (arts. 30.2.g Estatutos + 15 Ley 2/2007), ambas **procedentes del rule pack por materia**, no del pack de órgano | captura del panel de reglas + `agreements.rule_pack_id` de cada fila |
| G-6 | `/secretaria/reuniones/:id` con login **Garrigues** se recorre completo y muestra el censo de **346** socios, **3 presenciales + 343 representados** por Roberto Delgado, y la autocartera excluida | verificación viva con capturas |
| G-7 | El acta la genera **`fn_generar_acta`** (no un INSERT) y la certificación **`fn_generar_certificacion`** con **administrador único sin VºBº** | `minutes.gate_hash` no nulo + captura de la ficha de certificación |
| G-8 | **ARGA intacta:** 27 meetings, 46 agreements, 59 convocatorias, 12 minutes, 9 certifications, 59 rule packs y 72 plantillas antes y después | query de control ejecutada en las dos puntas |
| G-9 | Gates **sin regresión** sobre la línea base medida por el orquestador el 2026-08-29: `bun test` ≥ **3461 pass / 152 skip / 0 fail**, `lint` 0, `typecheck` 0, `build` OK | ejecutados en **worktree limpio** (`git worktree add` desde la rama), no en el árbol compartido |

**No cuenta como cumplido:** un rótulo en pantalla. Precedente de esta casa: leer "Propietario: Comité X" no probaba que la FK se leyera, porque el seed escribía FK y texto con el mismo valor. Cada arista se prueba con el enlace navegado o con un test que se rompería si dejara de leerse.

---

## Global Constraints

Copiadas literalmente de las fuentes; aplican a **todas** las tareas.

- **Tenant Garrigues** `00000000-0000-0000-0000-000000000002`. **Matriz** `00000000-0000-0000-0002-000000000001` (J&A Garrigues, S.L.P., `tipo_social='SLP'`). **ARGA** `…0001` no se toca jamás.
- **Cloud:** `bun run db:check-target` antes de cualquier operación. Canal: `supabase db query -f <fichero> --linked`. **NUNCA** `supabase db query "$(cat …)"` — bash expandiría `$assert$`. Cada versión aplicada se registra a mano en `supabase_migrations.schema_migrations`. Head remoto al abrir el carril: `20260820130000`.
- **Los subagentes no escriben en Cloud.** Preparan el `.sql` o el script; el controller lo aplica y pega el resultado en el ledger.
- **Escrituras autoritativas** (`condiciones_persona`, `censo_snapshot`) solo por RPC. Escribir directo lanza `AUTHORITATIVE_WRITE_RPC_REQUIRED` incluso con service_role — **no** `42501`.
- **Nunca se muta una versión de rule pack ya aplicada.** INSERT de la versión nueva + `UPDATE … is_active=false, status='DEPRECATED'` de la anterior. Patrón exacto: `supabase/migrations/20260805100000_g3_junta_socios_pack_v110.sql`.
- **`git add` solo con rutas específicas. NUNCA `-A`.** El árbol tiene 74 entradas sucias ajenas que son exclusiones deliberadas: `.agents/**`, `docs/context/**`, `pkcs11.txt`, `DOC GRC/`, `Gobernanza ia/`, `version garrigues/`.
- **Congelado sin autorización nominal del orquestador:** `obligations`, `controls`, `policies`, `grc_modules`, `CLAUDE.md` fuera del bullet de C1, `src/components/shell/**`, `src/components/garrigues-shell/**`.
- **UX Garrigues:** cero hexadecimales, cero clases Tailwind de color nativas. Solo `var(--g-*)` y `var(--status-*)`. `--g-brand-3308`, nunca `--g-brand`. `--status-*` sin prefijo `--g-`.
- **TS relajado:** `noImplicitAny:false`, `strictNullChecks:false`. No añadir anotaciones donde no las había.
- **Etiqueta de alcance:** todo artefacto generado es **reconstrucción demo sin efecto jurídico**. El expediente real ya existe en el Registro Mercantil; la plataforma lo reproduce, no lo sustituye. Ninguna superficie afirma firma, QES, ERDS, envío ni entrega reales.
- **Dato no público:** el emparejamiento socio↔participación numerada **no es público** (el Anexo 2 del acta no está transcrito). Lo FIRME es la **estructura**. Qué socio concreto tiene qué participación, y cuáles son los 8 titulares de clase B, sigue etiquetado `INFERIDO`. **No inventar números de participación por socio.**
- **Sondas con más de un cliente Supabase** necesitan `{ auth: { persistSession: false } }`: el preload de `bun test` monta JSDOM con `localStorage` y todos los clientes comparten `storageKey`. Sin eso el último login pisa a los anteriores, y **solo se reproduce bajo el runner real**.
- **Ninguna sonda con `|| ""` en la anon key.** Un fallback vacío deja la sonda en graceful-skip permanente: gate verde sin asertar nada.
- **`describe.skip` SÍ ejecuta su callback.** Un guard de fichero fuera no protege llamadas escritas en el cuerpo del `describe`. Los gates se miden en **worktree limpio**.

### Dos decisiones del usuario que este plan ejecuta (no se re-litigan)

1. **Antelación del CdA de EAD Trust = 5 días, CONFIRMADOS** como práctica de la entidad por su propio consejero. Se retira el marco de "valor no verificado". `fuente` sigue siendo `ESTATUTOS` y la referencia sigue diciendo que el art. 246 LSC no fija plazo mínimo. **El 5 no se convierte en cita legal de plazo.** Sube versión del pack.
2. **Capital de la matriz → FIRME** por el art. 7: clase **A** 694 participaciones de 16.000 € con 25 votos; clase **B** 8 participaciones de 1 € con 1 voto; Socio de Cuota = 2A; autocartera 18A con `is_treasury`.

### Decisión del usuario tomada dentro de este carril (2026-08-29)

3. **Alcance del caso canónico = cobertura acreditada, 10 acuerdos.** Se materializan los 10 puntos del orden del día que tienen materia con clasificación acreditada. Los 3 que no la tienen (toma de participación en el Centro de Estudios, estado de información sobre sostenibilidad, informe de gestión) **figuran en el orden del día literal** de la convocatoria y del acta pero **no se materializan como acuerdo**: crear su materia exigiría una clasificación legal nueva, que es dictamen del Comité Legal y no seed.
4. **Base de cómputo del voto en la Junta = votos de clase A no autocartera (16.900).** Es la única lectura que reproduce las dos cifras del acta al decimal (0,8875 % de los presenciales y su complemento 99,1125 %). Se documenta como **criterio de cómputo declarado**, y **no** se afirma que la clase B carezca de voto: el art. 7 le da 1 voto por participación. El residuo son exactamente esos 8 votos = 0,047 % de la base. Ver Task 2, paso 1.

---

## Los 12 puntos reales del orden del día y su tratamiento

Fuente: certificado del acta de la Junta de Socios de 06/05/2026 (depósito de cuentas 2025, RM de Madrid) vía spec §3.6 y corrección 2 del estatus §3. **No son los de una Junta ordinaria genérica de SA.**

| Punto | Contenido real | Materia | Pack | Gate preceptivo | ¿Acuerdo? |
|---|---|---|---|---|---|
| 1.1 | Modificación del art. 36 y disposición transitoria de conversión a Consejo | `MODIFICACION_ESTATUTOS` | genérico | — | **Sí** |
| 1.2 | Cese y reelección de Fernando Vives como administrador único hasta 30/06/2032 | `NOMBRAMIENTO_ADMINISTRADOR_UNICO` | SLP | **Sí** | **Sí** |
| 2 | Exclusión estatutaria de socios (retiro a los 60, art. 21.1.e) | `EXCLUSION_SOCIO_ESTATUTARIA` | SLP | **Sí** | **Sí** |
| 3 | Continuidad de socios tras los 60 | `CONTINUIDAD_SOCIO_POST_60` | SLP | **Sí** | **Sí** |
| 4 | Admisión de socios de cuota | `ADMISION_SOCIO_CUOTA` | SLP | **Sí** | **Sí** |
| 5 | Centro de Estudios — operación de toma de participación | *(sin materia acreditada)* | — | — | **No** (queda en el orden del día) |
| 6 | Integración de BSVV con aumento de capital sin derecho de preferencia | `INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA` | SLP | — | **Sí** |
| 7 | Cuentas anuales 2025 (individuales y consolidadas) | `APROBACION_CUENTAS` | genérico | — | **Sí** |
| 8 | Estado de información sobre sostenibilidad | *(sin materia acreditada)* | — | — | **No** (queda en el orden del día) |
| 9 | Informe de gestión | *(sin materia acreditada)* | — | — | **No** (queda en el orden del día) |
| 10 | Reelección del auditor (Lillo Auditores Asociados SL) | `NOMBRAMIENTO_AUDITOR` | genérico | — | **Sí** |
| 11 | Retribución de prestaciones accesorias | `RETRIBUCION_PRESTACIONES_ACCESORIAS` | SLP | — | **Sí** |
| 12 | Delegación de facultades para elevar a público | `DELEGACION_FACULTADES` | genérico | — | **Sí** |
| — | Aprobación del acta en la propia sesión (art. 97 RRM) | — | — | — | No es acuerdo: es el cierre |

**10 acuerdos. Las 6 materias SLP de G3 quedan ejercitadas. El gate preceptivo dispara en 4.**

Los 3 puntos sin materia se pintan en el orden del día con la nota visible **"punto del orden del día sin acuerdo materializado — clasificación de materia no acreditada"**. No se les inventa clase, mayoría ni cita legal.

---

## File Structure

**Nuevos**

| Fichero | Responsabilidad |
|---|---|
| `scripts/garrigues/capital/estructura-art7.ts` | **Única fuente de verdad** de la estructura del art. 7: clases, nominales, votos, reparto por socio, autocartera y toda la aritmética de porcentajes. Puro, sin red. Lo consumen el seed, las sondas y el test. |
| `src/test/schema/capital-art7.test.ts` | Test unitario de la aritmética: las 4 comprobaciones cruzadas + la regresión del 0,8875 %. Puro, corre en cualquier entorno limpio. |
| `scripts/garrigues/junta-2026/orden-del-dia.ts` | Los 12 puntos literales + el mapa punto→materia + qué punto materializa acuerdo. Fuente de verdad del expediente. |
| `scripts/seed-garrigues-junta-2026.ts` | Seed idempotente del expediente: convocatoria, reunión, asistentes, acuerdos, resoluciones. Dry-run por defecto, `--commit` para escribir. |
| `src/test/schema/garrigues-junta-2026-seed.test.ts` | Sonda autenticada contra Cloud: cuenta filas, comprueba materias, mayorías desde pack, gate preceptivo y aislamiento con ARGA. |
| `supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql` | `GARR_CONSEJO_EAD` 1.0.0 → 1.1.0. |
| `supabase/migrations/20260829130000_c1_share_class_nominal.sql` | Añade a `share_classes` lo que el art. 7 necesita y hoy no cabe (ver Task 2, paso 2). |
| `.superpowers/sdd/2026-08-29-c1-junta-socios-garrigues-2026/progress.md` | Ledger SDD del carril. |

**Modificados**

| Fichero | Cambio |
|---|---|
| `scripts/seed-garrigues-rule-packs.ts` | Espejo del payload v1.1.0 de `GARR_CONSEJO_EAD` + retirada del marco "valor de referencia no verificado" en los comentarios. |
| `src/test/schema/garrigues-rule-packs-seed.test.ts` | Aserción de que la versión activa de `GARR_CONSEJO_EAD` es `1.1.0` y de que la referencia sigue **sin** convertir el 5 en plazo legal. |
| `scripts/seed-garrigues-capital.ts` | Reescrito para consumir `estructura-art7.ts`. Sustituye el reparto uniforme `INFERIDO` por la estructura FIRME. |
| `src/pages/secretaria/**`, `src/lib/secretaria/**` | Solo si la verificación viva encuentra una superficie que afirme algo falso sobre el expediente Garrigues. **No se toca por adelantado.** |

---

## Task 1 — `GARR_CONSEJO_EAD` sube a v1.1.0 (encargo A del usuario)

**Files:**
- Create: `supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql`
- Modify: `scripts/seed-garrigues-rule-packs.ts:401-478` (constante `CONSEJO_EAD_PAYLOAD`)
- Test: `src/test/schema/garrigues-rule-packs-seed.test.ts`

**Interfaces:**
- Consumes: nada de tareas previas.
- Produces: `GARR_CONSEJO_EAD` con versión activa `1.1.0` y `payload.reglaEspecifica.antelacionConsejo` presente. Ninguna tarea posterior depende de esto — es un encargo independiente que se cierra primero por ser el más barato.

**Qué cambia y qué NO cambia en el payload.** Es el punto en el que un revisor va a buscar el error:

- `convocatoria.antelacionDias.SA` y `.SL` conservan **byte a byte** `valor: 5`, `fuente: "ESTATUTOS"` y `referencia: "art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"`. **No se toca la referencia**: convertir el 5 en cita de plazo es exactamente lo que el usuario prohibió.
- Se **añade** `reglaEspecifica.antelacionConsejo`, clave nueva y puramente documental (`reglaEspecifica` es `Record<string, unknown>` en `src/lib/rules-engine/types.ts`, sin consumidor en ningún engine — mismo hueco que usó G3 Task 5 para `antelacionAmpliada`). Contenido exacto:

```json
"antelacionConsejo": {
  "valorDias": 5,
  "naturaleza": "PRACTICA_SOCIETARIA_CONFIRMADA",
  "confirmadoPor": "Consejero de la entidad, 2026-08-29",
  "registro": "docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-ead.md",
  "nota": "El art. 246 LSC no fija plazo mínimo de convocatoria del Consejo. Los 5 días son práctica acreditada de EAD Trust, no suelo legal."
}
```

- El resto del payload —mayoría art. 247.1, quórum, `votoCalidadPermitido:false`, `reglaEspecifica.canalAcuseConsejo` con la cautela EAD de la política 2026-07-21— se conserva **idéntico**.

- [ ] **Step 1: Escribir el test que falla**

En `src/test/schema/garrigues-rule-packs-seed.test.ts`, dentro del `describe` existente que ya consulta `rule_pack_versions` con login real:

```ts
it("GARR_CONSEJO_EAD tiene v1.1.0 activa con la práctica de 5 días confirmada y sin cita legal de plazo", async () => {
  const { data, error } = await client
    .from("rule_pack_versions")
    .select("version, payload, is_active, status")
    .eq("pack_id", "GARR_CONSEJO_EAD")
    .eq("is_active", true);
  expect(error).toBeNull();
  expect(data).toHaveLength(1);
  const row = data[0];
  expect(row.version).toBe("1.1.0");

  const antelacion = row.payload?.reglaEspecifica?.antelacionConsejo;
  expect(antelacion).toBeDefined();
  expect(antelacion.valorDias).toBe(5);
  expect(antelacion.naturaleza).toBe("PRACTICA_SOCIETARIA_CONFIRMADA");
  expect(antelacion.nota).toContain("no fija plazo mínimo");

  // El 5 NO se convierte en cita legal de plazo: la referencia sigue negando el mínimo.
  for (const forma of ["SA", "SL"]) {
    const dias = row.payload.convocatoria.antelacionDias[forma];
    expect(dias.valor).toBe(5);
    expect(dias.fuente).toBe("ESTATUTOS");
    expect(dias.referencia).toBe("art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente");
  }
});

it("la v1.0.0 de GARR_CONSEJO_EAD queda archivada, no mutada", async () => {
  const { data } = await client
    .from("rule_pack_versions")
    .select("version, is_active, status, payload")
    .eq("pack_id", "GARR_CONSEJO_EAD")
    .eq("version", "1.0.0")
    .maybeSingle();
  expect(data).not.toBeNull();
  expect(data.is_active).toBe(false);
  expect(data.status).toBe("DEPRECATED");
  // El payload viejo NO gana la clave nueva.
  expect(data.payload?.reglaEspecifica?.antelacionConsejo).toBeUndefined();
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

```bash
bun test src/test/schema/garrigues-rule-packs-seed.test.ts
```

Esperado: FAIL — `expect(row.version).toBe("1.1.0")` recibe `"1.0.0"`.

Si en lugar de FAIL sale **skip**, la sonda no está autenticando: revisar que la anon key no lleve `|| ""` y que el cliente use `{ auth: { persistSession: false } }`. Un skip aquí es un gate verde que no asierta nada.

- [ ] **Step 3: Escribir la migración**

`supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql`, calcado del patrón de `20260805100000_g3_junta_socios_pack_v110.sql`:

1. Cabecera de comentario que explique: qué cambia (solo `reglaEspecifica.antelacionConsejo`), qué NO cambia (la referencia del art. 246), quién lo decidió y dónde está el registro.
2. `INSERT INTO public.rule_pack_versions (pack_id, version, payload, is_active, status, effective_from)` con el payload completo v1.1.0, `'1.1.0'`, `true`, `'ACTIVE'`, `CURRENT_DATE`, guardado con `WHERE NOT EXISTS (… version='1.1.0')` para que sea idempotente.
3. `UPDATE public.rule_pack_versions SET is_active=false, status='DEPRECATED' WHERE pack_id='GARR_CONSEJO_EAD' AND version='1.0.0' AND is_active=true;`
4. Bloque `DO $$ … $$` de verificación que lance `RAISE EXCEPTION` si no hay exactamente una versión activa y no es la 1.1.0.

**El payload se construye copiando el de v1.0.0 desde la migración `20260804070000` línea 101 y añadiéndole solo la clave nueva.** No se reescribe a mano: cualquier diferencia accidental es un cambio de regla no autorizado.

- [ ] **Step 4: Espejar el payload en el seed y retirar el marco de "no verificado"**

En `scripts/seed-garrigues-rule-packs.ts`, dentro de `CONSEJO_EAD_PAYLOAD`:

- Añadir `antelacionConsejo` a `reglaEspecifica` con el mismo contenido que la migración.
- Reescribir el comentario de `antelacionDias` (hoy dice *"valor práctico de referencia, no una cita de mínimo legal"* y explica por qué `fuente` no es `PRACTICA_SOCIETARIA`). El comentario nuevo mantiene la explicación del tipo cerrado `Fuente` y **cambia el marco**: los 5 días dejan de ser un valor de referencia sin verificar y pasan a ser práctica de la entidad confirmada el 2026-08-29 por su consejero, con el registro citado. Sigue diciendo que el art. 246 LSC no fija mínimo.
- Bump del número de versión que el seed escribe para este pack: `1.0.0` → `1.1.0`.

- [ ] **Step 5: El controller aplica en Cloud**

*Los subagentes no ejecutan este paso.* El controller:

```bash
bun run db:check-target
supabase db query -f supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql --linked
```

y registra la versión a mano:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260829120000', 'g3_consejo_ead_pack_v110')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 6: Correr el test y verificar que pasa**

```bash
bun test src/test/schema/garrigues-rule-packs-seed.test.ts
```

Esperado: PASS, sin skips en los dos casos nuevos.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260829120000_g3_consejo_ead_pack_v110.sql \
        scripts/seed-garrigues-rule-packs.ts \
        src/test/schema/garrigues-rule-packs-seed.test.ts
git commit -m "feat(c1): GARR_CONSEJO_EAD v1.1.0 — los 5 días del CdA de EAD son práctica confirmada, no placeholder"
```

---

## Task 2 — La estructura del art. 7 como módulo puro, con la regresión del acta dentro

**Files:**
- Create: `scripts/garrigues/capital/estructura-art7.ts`
- Create: `src/test/schema/capital-art7.test.ts`
- Create: `supabase/migrations/20260829130000_c1_share_class_nominal.sql`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `ART7_CLASES: { code: "A"|"B"; nominalEur: number; votosPorTitulo: number; totalTitulos: number }[]`
  - `CAPITAL_ESCRITURADO_EUR: number` (11_104_008)
  - `AUTOCARTERA_TITULOS_A: number` (18)
  - `SOCIOS_CUOTA: number` (338), `SOCIOS_CLASE_B: number` (8)
  - `votosTotales(): number`, `votosAutocartera(): number`, `baseComputoJunta(): number`
  - `pctSobreBaseJunta(votos: number): number`, `pctAutocarteraSobreTotal(): number`
  - `pctCapital(clase: "A"|"B", titulos: number): number`
  - `repartirCenso(presenciales: string[], representados: string[]): Holding[]` donde `Holding = { nombre: string; clase: "A"|"B"; titulos: number; pctCapital: number; votos: number; asignacionClase: "INFERIDO" }`

**Por qué existe este módulo.** Hoy `scripts/seed-garrigues-capital.ts` calcula los porcentajes a mano, dentro del script que además habla con Cloud, con constantes que se contradicen (`TOTAL_TITULOS = 695` derivado de una regla de tres sobre el 2,59 %, mientras cada socio recibe `numero_titulos: 2` sin relación con su porcentaje). Esa aritmética no se puede testear sin red y por eso nadie la testeó. El módulo la saca fuera, la hace pura y la somete al test del paso 3.

- [ ] **Step 1: Escribir el módulo con el criterio de cómputo declarado**

`scripts/garrigues/capital/estructura-art7.ts`:

```ts
/**
 * Estructura de capital de J&A Garrigues, S.L.P. — art. 7 de los Estatutos.
 * ÚNICA fuente de verdad de clases, nominales, votos y reparto. Puro, sin red.
 *
 * FIRME (art. 7): las clases, sus nominales, sus votos por participación, el
 * número de participaciones de cada clase y la autocartera.
 * INFERIDO y etiquetado: QUÉ socio concreto tiene qué participación y cuáles
 * son los 8 titulares de clase B. El Anexo 2 del acta no está transcrito y ese
 * emparejamiento no es público. No se inventan números de participación.
 *
 * BASE DE CÓMPUTO DE LA JUNTA — criterio declarado, decisión del usuario
 * 2026-08-29: los porcentajes de asistencia del acta se computan sobre los
 * VOTOS DE CLASE A NO AUTOCARTERA (16.900). Es la única lectura que reproduce
 * las dos cifras del acta al decimal: 150/16.900 = 0,887574 % (el 0,8875 % de
 * los presenciales) y su complemento 99,1124 % (el 99,1125 % de los
 * representados). Sobre la base completa de 16.908 votos saldría 0,887154 %
 * → 0,8872 %, que no es lo que dice el acta.
 * NO se afirma que la clase B carezca de voto: el art. 7 le da 1 voto por
 * participación y `votosTotales()` los cuenta. El residuo son esos 8 votos,
 * el 0,047 % de la base.
 */

export const CAPITAL_ESCRITURADO_EUR = 11_104_008;

export const ART7_CLASES = [
  { code: "A" as const, nombre: "Participaciones Clase A", nominalEur: 16_000, votosPorTitulo: 25, totalTitulos: 694 },
  { code: "B" as const, nombre: "Participaciones Clase B", nominalEur: 1, votosPorTitulo: 1, totalTitulos: 8 },
];

export const AUTOCARTERA_TITULOS_A = 18;
export const TITULOS_POR_SOCIO_CUOTA = 2;
export const SOCIOS_CUOTA = (694 - AUTOCARTERA_TITULOS_A) / TITULOS_POR_SOCIO_CUOTA; // 338
export const SOCIOS_CLASE_B = 8;
export const CENSO_TOTAL = SOCIOS_CUOTA + SOCIOS_CLASE_B; // 346

const clase = (c) => ART7_CLASES.find((x) => x.code === c);

export function votosTotales() {
  return ART7_CLASES.reduce((acc, c) => acc + c.totalTitulos * c.votosPorTitulo, 0); // 17.358
}
export function votosAutocartera() {
  return AUTOCARTERA_TITULOS_A * clase("A").votosPorTitulo; // 450
}
/** Base declarada de cómputo de la Junta: votos de clase A no autocartera. */
export function baseComputoJunta() {
  return (clase("A").totalTitulos - AUTOCARTERA_TITULOS_A) * clase("A").votosPorTitulo; // 16.900
}
/** Base alternativa, solo para la nota de conciliación: todos los votos computables. */
export function baseComputoTodasLasClases() {
  return votosTotales() - votosAutocartera(); // 16.908
}
export function pctSobreBaseJunta(votos) {
  return (votos / baseComputoJunta()) * 100;
}
export function pctAutocarteraSobreTotal() {
  return (votosAutocartera() / votosTotales()) * 100; // 2,5925 %
}
export function pctCapital(code, titulos) {
  return ((titulos * clase(code).nominalEur) / CAPITAL_ESCRITURADO_EUR) * 100;
}

/**
 * Reparte el censo real del acta sobre la estructura del art. 7.
 * Los 3 presenciales son socios de cuota (2A) — lo exige la regresión del acta.
 * Los 8 titulares de clase B se toman de la COLA del listado de representados
 * ordenado alfabéticamente: elección determinista y arbitraria, etiquetada
 * `asignacionClase: "INFERIDO"` porque el dato no es público.
 */
export function repartirCenso(presenciales, representados) {
  if (presenciales.length !== 3) throw new Error(`art7: se esperaban 3 presenciales, llegaron ${presenciales.length}`);
  if (presenciales.length + representados.length !== CENSO_TOTAL) {
    throw new Error(`art7: censo ${presenciales.length + representados.length} ≠ ${CENSO_TOTAL}`);
  }
  const ordenados = [...representados].sort((a, b) => a.localeCompare(b, "es"));
  const claseB = new Set(ordenados.slice(-SOCIOS_CLASE_B));

  const holding = (nombre, code, titulos) => ({
    nombre, clase: code, titulos,
    pctCapital: pctCapital(code, titulos),
    votos: titulos * clase(code).votosPorTitulo,
    asignacionClase: "INFERIDO",
  });

  return [
    ...presenciales.map((n) => holding(n, "A", TITULOS_POR_SOCIO_CUOTA)),
    ...ordenados.map((n) => (claseB.has(n) ? holding(n, "B", 1) : holding(n, "A", TITULOS_POR_SOCIO_CUOTA))),
  ];
}
```

- [ ] **Step 2: Migración de `share_classes` — el nominal por clase no cabe hoy**

`share_classes` tiene `class_code, name, votes_per_title, economic_rights_coeff, voting_rights, veto_rights, restrictions`. **No tiene nominal**, y `entity_capital_profile` solo admite **un** `valor_nominal` por entidad — imposible con dos clases de 16.000 € y 1 €. Sin esto, el art. 7 no se puede representar y el dato queda a medias.

Crear `supabase/migrations/20260829130000_c1_share_class_nominal.sql`:

```sql
-- C1 — el art. 7 de los Estatutos de J&A Garrigues, S.L.P. define DOS clases con
-- nominales distintos (A: 16.000 €, B: 1 €). `share_classes` no tenía dónde
-- guardarlo y `entity_capital_profile.valor_nominal` es único por entidad.
-- Columnas NULLABLE y sin default: ARGA queda con NULL = cero cambio de
-- comportamiento (su clase única sigue leyendo el nominal del perfil).
ALTER TABLE public.share_classes
  ADD COLUMN IF NOT EXISTS nominal_value numeric,
  ADD COLUMN IF NOT EXISTS total_titulos integer;

COMMENT ON COLUMN public.share_classes.nominal_value IS
  'Valor nominal por participación de la clase. NULL = usar entity_capital_profile.valor_nominal (caso de entidad con clase única).';
COMMENT ON COLUMN public.share_classes.total_titulos IS
  'Participaciones emitidas de la clase según Estatutos. NULL = no acreditado.';

DO $assert$
DECLARE v_arga integer;
BEGIN
  SELECT count(*) INTO v_arga
  FROM public.share_classes
  WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    AND (nominal_value IS NOT NULL OR total_titulos IS NOT NULL);
  IF v_arga <> 0 THEN
    RAISE EXCEPTION 'c1 share_class_nominal: ARGA no debe recibir valores (filas=%)', v_arga;
  END IF;
END $assert$;
```

- [ ] **Step 3: Escribir el test de la aritmética — aquí vive la regresión del acta**

`src/test/schema/capital-art7.test.ts`. Sin red: corre en cualquier entorno limpio.

```ts
import { describe, it, expect } from "bun:test";
import {
  CAPITAL_ESCRITURADO_EUR, ART7_CLASES, AUTOCARTERA_TITULOS_A,
  SOCIOS_CUOTA, SOCIOS_CLASE_B, CENSO_TOTAL,
  votosTotales, votosAutocartera, baseComputoJunta, baseComputoTodasLasClases,
  pctSobreBaseJunta, pctAutocarteraSobreTotal, pctCapital, repartirCenso,
} from "../../../scripts/garrigues/capital/estructura-art7";
import censo from "../../../scripts/garrigues/censo/socios-acta-2026-05-06.json";

describe("art. 7 de los Estatutos — las cuatro comprobaciones cruzadas", () => {
  it("el capital derivado de las clases es el capital registral", () => {
    const derivado = ART7_CLASES.reduce((a, c) => a + c.totalTitulos * c.nominalEur, 0);
    expect(derivado).toBe(11_104_008);
    expect(derivado).toBe(CAPITAL_ESCRITURADO_EUR);
  });

  it("los votos totales son 17.358", () => {
    expect(votosTotales()).toBe(17_358);
  });

  it("la autocartera es el 2,59 % del acta", () => {
    expect(votosAutocartera()).toBe(450);
    expect(pctAutocarteraSobreTotal()).toBeCloseTo(2.5925, 4);
    expect(Number(pctAutocarteraSobreTotal().toFixed(2))).toBe(2.59);
  });

  it("el censo derivado es el censo exacto del acta: 338 + 8 = 346", () => {
    expect(SOCIOS_CUOTA).toBe(338);
    expect(SOCIOS_CLASE_B).toBe(8);
    expect(CENSO_TOTAL).toBe(346);
  });
});

describe("REGRESIÓN OBLIGATORIA — los 3 presenciales del acta suman 0,8875 %", () => {
  it("sobre la base declarada (votos de clase A no autocartera)", () => {
    expect(baseComputoJunta()).toBe(16_900);
    const votosPresenciales = 3 * 2 * 25; // 3 socios de cuota × 2 A × 25 votos
    expect(votosPresenciales).toBe(150);
    expect(Number(pctSobreBaseJunta(votosPresenciales).toFixed(4))).toBe(0.8876);
    // El acta escribe 0,8875 % (truncamiento a 4 decimales de 0,887574 %).
    expect(pctSobreBaseJunta(votosPresenciales)).toBeGreaterThan(0.8875);
    expect(pctSobreBaseJunta(votosPresenciales)).toBeLessThan(0.8876);
  });

  it("los representados son el complemento 99,1125 % del acta", () => {
    const resto = baseComputoJunta() - 150;
    expect(Number(((resto / baseComputoJunta()) * 100).toFixed(2))).toBe(99.11);
    expect(100 - pctSobreBaseJunta(150)).toBeCloseTo(99.1124, 4);
  });

  it("deja constancia de por qué la base no incluye los 8 votos de clase B", () => {
    // Documenta la desviación en vez de esconderla: sobre la base completa
    // saldría 0,8872 %, que NO es la cifra del acta.
    expect(baseComputoTodasLasClases()).toBe(16_908);
    const sobreTodas = (150 / baseComputoTodasLasClases()) * 100;
    expect(Number(sobreTodas.toFixed(4))).toBe(0.8872);
    expect(baseComputoTodasLasClases() - baseComputoJunta()).toBe(8);
  });
});

describe("reparto del censo real del acta sobre la estructura", () => {
  const holdings = repartirCenso(censo.presenciales, censo.representados);

  it("produce 346 titularidades: 338 de clase A y 8 de clase B", () => {
    expect(holdings).toHaveLength(346);
    expect(holdings.filter((h) => h.clase === "A")).toHaveLength(338);
    expect(holdings.filter((h) => h.clase === "B")).toHaveLength(8);
  });

  it("los títulos cuadran con el art. 7 una vez sumada la autocartera", () => {
    const a = holdings.filter((h) => h.clase === "A").reduce((s, h) => s + h.titulos, 0);
    const b = holdings.filter((h) => h.clase === "B").reduce((s, h) => s + h.titulos, 0);
    expect(a + AUTOCARTERA_TITULOS_A).toBe(694);
    expect(b).toBe(8);
  });

  it("el capital reparto + autocartera suma el 100 %", () => {
    const pct = holdings.reduce((s, h) => s + h.pctCapital, 0) + pctCapital("A", AUTOCARTERA_TITULOS_A);
    expect(pct).toBeCloseTo(100, 6);
  });

  it("los 3 presenciales son socios de cuota y suman los 150 votos del acta", () => {
    const pres = holdings.filter((h) => censo.presenciales.includes(h.nombre));
    expect(pres).toHaveLength(3);
    expect(pres.every((h) => h.clase === "A" && h.titulos === 2)).toBe(true);
    expect(pres.reduce((s, h) => s + h.votos, 0)).toBe(150);
  });

  it("la asignación de clase queda etiquetada INFERIDO en todas las filas", () => {
    expect(holdings.every((h) => h.asignacionClase === "INFERIDO")).toBe(true);
  });
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

```bash
bun test src/test/schema/capital-art7.test.ts
```

Esperado: FAIL — el módulo no existe todavía si se escribió el test antes; si ya se escribió el módulo en el paso 1, correr aquí sirve de verificación del paso 1 y **cualquier fallo del bloque de REGRESIÓN OBLIGATORIA se escala al orquestador antes de seguir**, no se ajusta el test para que pase.

- [ ] **Step 5: El controller aplica la migración de `share_classes` en Cloud**

```bash
bun run db:check-target
supabase db query -f supabase/migrations/20260829130000_c1_share_class_nominal.sql --linked
```

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20260829130000', 'c1_share_class_nominal')
ON CONFLICT (version) DO NOTHING;
```

- [ ] **Step 6: Correr el test completo y verificar que pasa**

```bash
bun test src/test/schema/capital-art7.test.ts
```

Esperado: PASS, 15 casos, 0 skip.

- [ ] **Step 7: Commit**

```bash
git add scripts/garrigues/capital/estructura-art7.ts \
        src/test/schema/capital-art7.test.ts \
        supabase/migrations/20260829130000_c1_share_class_nominal.sql
git commit -m "feat(c1): estructura del art. 7 como módulo puro con la regresión del 0,8875% dentro"
```

---

## Task 3 — El capital de la matriz pasa de INFERIDO a FIRME en Cloud

**Files:**
- Modify: `scripts/seed-garrigues-capital.ts` (completo)
- Create: `src/test/schema/garrigues-capital-firme.test.ts`

**Interfaces:**
- Consumes: todo el API de `estructura-art7.ts` (Task 2).
- Produces: en Cloud, `share_classes` con 2 filas de la matriz y `capital_holdings` con 347 filas cuya `metadata.confianza='FIRME'`. Task 5 lee `parte_votante_current` refrescado por este seed.

- [ ] **Step 1: Escribir la sonda que falla**

`src/test/schema/garrigues-capital-firme.test.ts`, con login real Garrigues (`demo@garrigues-demo.dev`), cliente con `{ auth: { persistSession: false } }` y **sin** `|| ""` en la anon key:

```ts
const MATRIZ = "00000000-0000-0000-0002-000000000001";

it("la matriz tiene las dos clases del art. 7", async () => {
  const { data } = await client.from("share_classes")
    .select("class_code, votes_per_title, nominal_value, total_titulos")
    .eq("entity_id", MATRIZ).order("class_code");
  expect(data).toHaveLength(2);
  expect(data[0]).toMatchObject({ class_code: "A", votes_per_title: 25, nominal_value: 16000, total_titulos: 694 });
  expect(data[1]).toMatchObject({ class_code: "B", votes_per_title: 1, nominal_value: 1, total_titulos: 8 });
});

it("los holdings reproducen la estructura y la procedencia es FIRME", async () => {
  const { data } = await client.from("capital_holdings")
    .select("numero_titulos, is_treasury, metadata, share_class_id, porcentaje_capital")
    .eq("entity_id", MATRIZ);
  expect(data).toHaveLength(347);                                   // 338 + 8 + autocartera
  expect(data.filter((h) => h.is_treasury)).toHaveLength(1);
  expect(data.find((h) => h.is_treasury).numero_titulos).toBe(18);
  expect(data.every((h) => h.metadata?.confianza === "FIRME")).toBe(true);
  expect(data.every((h) => h.metadata?.fuente === "art. 7 de los Estatutos Sociales")).toBe(true);
  // La estructura es FIRME; el emparejamiento socio↔clase sigue etiquetado.
  expect(data.filter((h) => !h.is_treasury).every((h) => h.metadata?.asignacion_clase === "INFERIDO")).toBe(true);
  const suma = data.reduce((s, h) => s + Number(h.porcentaje_capital), 0);
  expect(suma).toBeCloseTo(100, 4);
});

it("la autocartera queda fuera del cómputo de voto", async () => {
  const { data } = await client.from("capital_holdings")
    .select("voting_rights").eq("entity_id", MATRIZ).eq("is_treasury", true).single();
  expect(data.voting_rights).toBe(false);
  const { data: pv } = await client.from("parte_votante_current")
    .select("voting_weight, denominator_weight, exclusion_policy")
    .eq("entity_id", MATRIZ).eq("exclusion_policy", "AUTOCARTERA");
  for (const row of pv ?? []) {
    expect(Number(row.voting_weight)).toBe(0);
    expect(Number(row.denominator_weight)).toBe(0);
  }
});

it("ARGA no cambia: sigue con una sola clase y sin nominal por clase", async () => {
  const { data } = await argaClient.from("share_classes")
    .select("class_code, nominal_value, total_titulos")
    .eq("entity_id", "6d7ed736-f263-4531-a59d-c6ca0cd41602");
  expect(data.every((c) => c.nominal_value === null && c.total_titulos === null)).toBe(true);
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
bun test src/test/schema/garrigues-capital-firme.test.ts
```

Esperado: FAIL — hoy hay 1 clase, 347 holdings con `metadata.peso='INFERIDO'` y 710 títulos.

- [ ] **Step 3: Reescribir el seed**

`scripts/seed-garrigues-capital.ts` conserva su esqueleto (resolución de service-role por varios nombres, guard de target, dry-run por defecto, `--commit`) y cambia el cuerpo:

1. Importar todo de `./garrigues/capital/estructura-art7`.
2. Borrar las constantes locales `AUTOCARTERA_PCT`, `PRESENCIALES_PCT_TOTAL` y `TOTAL_TITULOS`: la aritmética ya no vive aquí.
3. Upsert de las **dos** `share_classes` de la matriz por `(tenant_id, entity_id, class_code)`, con `votes_per_title`, `nominal_value` y `total_titulos` de `ART7_CLASES`.
4. `repartirCenso(cat.censo.presenciales, cat.censo.representados)` → upsert de una fila de `capital_holdings` por socio con `share_class_id` de su clase, `numero_titulos`, `porcentaje_capital = h.pctCapital`, `voting_rights: true`, `is_treasury: false`, `effective_from: "2026-05-06"` y

```ts
metadata: {
  confianza: "FIRME",
  fuente: "art. 7 de los Estatutos Sociales",
  asignacion_clase: "INFERIDO",
  nota: "Estructura FIRME (clases, nominales, votos, títulos por clase y autocartera). El emparejamiento socio↔participación numerada no es público: el Anexo 2 del acta 06/05/2026 no está transcrito.",
}
```

5. Autocartera: 18 títulos de clase A, `is_treasury: true`, `voting_rights: false`, `porcentaje_capital = pctCapital("A", 18)`, mismo bloque `metadata` con `confianza: "FIRME"` y sin `asignacion_clase` (la autocartera sí es dato del acta).
6. **Preflight de suma antes de escribir:** si `Σ porcentaje_capital ≠ 100 ± 1e-6`, abortar con `fail(...)`. Un seed que deja el cap table descuadrado es peor que un seed que no corre.
7. Al terminar, `admin.rpc("fn_refresh_parte_votante_entity", { p_entity_id: GARRIGUES_MATRIZ_UUID })`. **El aviso actual es un `console.warn`: convertirlo en `fail(...)`.** Si el refresco no corre, `parte_votante_current` queda con los pesos viejos y el motor calcularía la Junta sobre el reparto anterior — exactamente el fallo que esta tarea existe para evitar.
8. Los holdings de filiales (bloque final del script) **no cambian**.

- [ ] **Step 4: Dry-run, revisión de la tabla y aplicación**

*El controller ejecuta; los subagentes solo preparan.*

```bash
bun run db:check-target
bun run scripts/seed-garrigues-capital.ts
```

Revisar la tabla impresa: 694 A + 8 B, 347 holdings, suma 100 %. Solo entonces:

```bash
bun run scripts/seed-garrigues-capital.ts --commit
```

- [ ] **Step 5: Correr la sonda y verificar que pasa**

```bash
bun test src/test/schema/garrigues-capital-firme.test.ts
```

Esperado: PASS, 0 skip.

- [ ] **Step 6: Verificar la regresión también contra Cloud, no solo en el módulo**

Query del controller, pegada al ledger:

```sql
SELECT sum(ch.numero_titulos * sc.votes_per_title) AS votos_presenciales
FROM capital_holdings ch
JOIN share_classes sc ON sc.id = ch.share_class_id
JOIN persons p ON p.id = ch.holder_person_id
WHERE ch.entity_id = '00000000-0000-0000-0002-000000000001'
  AND p.full_name IN ('Fernando Vives Ruiz', 'Rosa Zarza Jimeno', 'Roberto Delgado Gil');
```

Esperado: **150**. Sobre la base declarada de 16.900 → 0,887574 % → el 0,8875 % del acta.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-garrigues-capital.ts src/test/schema/garrigues-capital-firme.test.ts
git commit -m "feat(c1): capital de la matriz a FIRME por el art. 7 — dos clases, 347 holdings, autocartera excluida"
```

---

## Task 4 — La convocatoria del 21/04/2026 con los 12 puntos reales

**Files:**
- Create: `scripts/garrigues/junta-2026/orden-del-dia.ts`
- Create: `scripts/seed-garrigues-junta-2026.ts` (primera mitad: solo convocatoria)
- Test: `src/test/schema/garrigues-junta-2026-seed.test.ts` (primer bloque)

**Interfaces:**
- Consumes: `estructura-art7.ts` no; sí `GARRIGUES_TENANT` y `GARRIGUES_MATRIZ_UUID` de `scripts/garrigues/entities-catalog`.
- Produces:
  - `ORDEN_DEL_DIA: PuntoOrdenDia[]` con `PuntoOrdenDia = { numero: string; titulo: string; materia: string | null; materializa: boolean; nota?: string }`
  - `CONVOCATORIA_SLUG = "garrigues-junta-socios-2026-05-06"`
  - En Cloud: 1 fila de `convocatorias` del tenant Garrigues.

- [ ] **Step 1: Escribir el orden del día**

`scripts/garrigues/junta-2026/orden-del-dia.ts` con las 13 entradas de la tabla de este plan (12 puntos + el punto de aprobación del acta), `materia` a `null` en los 3 sin clasificación acreditada y `nota` explícita en esos tres:

```ts
nota: "Punto del orden del día sin acuerdo materializado: la clasificación de materia no está acreditada y crearla exige dictamen del Comité Legal.",
```

El literal de cada `titulo` sale del certificado del acta vía spec §3.6. **Ningún título se parafrasea a una Junta ordinaria genérica de SA**: es el error que el informe independiente cometió y que este plan corrige.

- [ ] **Step 2: Escribir el test que falla**

```ts
it("la convocatoria existe con los 15 días estatutarios y el canal individual", async () => {
  const { data } = await client.from("convocatorias")
    .select("estado, fecha_emision, fecha_1, tipo_convocatoria, modalidad, agenda_items, lugar, statutory_basis")
    .eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
  expect(data).not.toBeNull();
  expect(data.fecha_emision).toBe("2026-04-21");
  expect(String(data.fecha_1).slice(0, 10)).toBe("2026-05-06");
  const dias = (new Date("2026-05-06") - new Date("2026-04-21")) / 86400000;
  expect(dias).toBe(15);
  expect(data.agenda_items).toHaveLength(13);
  expect(data.statutory_basis).toContain("27.3");
});

it("los 3 puntos sin materia acreditada están en el orden del día y NO materializan acuerdo", async () => {
  const { data } = await client.from("convocatorias")
    .select("agenda_items").eq("tenant_id", GARRIGUES_TENANT).single();
  const sinMateria = data.agenda_items.filter((i) => i.materia === null && i.numero !== "acta");
  expect(sinMateria).toHaveLength(3);
  expect(sinMateria.every((i) => String(i.nota).includes("no está acreditada"))).toBe(true);
});
```

- [ ] **Step 3: Correr y verificar que falla**

```bash
bun test src/test/schema/garrigues-junta-2026-seed.test.ts
```

Esperado: FAIL — `convocatorias` del tenant Garrigues está a 0.

- [ ] **Step 4: Escribir la primera mitad del seed**

`scripts/seed-garrigues-junta-2026.ts`, mismo esqueleto de seed idempotente que los demás (`--commit`, guard de target, service-role por varios nombres). Inserta una fila en `convocatorias`:

| Columna | Valor | Fuente |
|---|---|---|
| `body_id` | el de `garrigues-junta-socios` (resolver por slug, **no** hardcodear UUID) | G2 |
| `estado` | `EMITIDA` | — |
| `fecha_emision` | `2026-04-21` | acta: carta enviada ese día |
| `fecha_1` | `2026-05-06` | acta |
| `is_second_call` | `false` | — |
| `modalidad` | `PRESENCIAL` | acta |
| `junta_universal` | `false` | hubo convocatoria formal |
| `tipo_convocatoria` | `ORDINARIA` | — |
| `publication_channels` | `["COMUNICACION_INDIVIDUAL_CON_ACUSE"]` | art. 27.3 Estatutos |
| `agenda_items` | `ORDEN_DEL_DIA` serializado | spec §3.6 |
| `statutory_basis` | `"arts. 27.3 y 27.4 de los Estatutos; art. 176 LSC (supletoria)"` | dictamen 2026-08-04 |
| `convocatoria_text` | capa 1 literal de la carta ("Querido socio: …") | spec §3.6 |

**Cautela obligatoria:** `publication_channels` describe el canal **estatutario del acto real**. No se afirma envío, entrega, acuse ni interacción con EAD Trust. Si el seed escribe cualquier campo de evidencia de envío, se retira.

- [ ] **Step 5: Aplicar y verificar que el test pasa**

```bash
bun run scripts/seed-garrigues-junta-2026.ts            # dry-run
bun run scripts/seed-garrigues-junta-2026.ts --commit
bun test src/test/schema/garrigues-junta-2026-seed.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add scripts/garrigues/junta-2026/orden-del-dia.ts \
        scripts/seed-garrigues-junta-2026.ts \
        src/test/schema/garrigues-junta-2026-seed.test.ts
git commit -m "feat(c1): convocatoria de la Junta de Socios 2026 con los 12 puntos reales y 15 días estatutarios"
```

---

## Task 5 — Reunión, asistencia real y censo WORM

**Files:**
- Modify: `scripts/seed-garrigues-junta-2026.ts` (segunda mitad)
- Test: `src/test/schema/garrigues-junta-2026-seed.test.ts` (segundo bloque)

**Interfaces:**
- Consumes: `CONVOCATORIA_SLUG` (Task 4), `parte_votante_current` refrescado (Task 3).
- Produces: `MEETING_SLUG = "garrigues-junta-socios-06-05-2026"` y su `meeting_id`; 346 filas de `meeting_attendees`; 1 fila de `censo_snapshot` tipo `UNIVERSAL` creada por RPC. Tasks 6–8 cuelgan de ese `meeting_id`.

- [ ] **Step 1: Escribir el test que falla**

```ts
it("la reunión existe con la mesa real del acta", async () => {
  const { data } = await client.from("meetings")
    .select("slug, meeting_type, scheduled_start, status, president_id, secretary_id, quorum_data, location")
    .eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
  expect(data.slug).toBe("garrigues-junta-socios-06-05-2026");
  expect(String(data.scheduled_start).slice(0, 10)).toBe("2026-05-06");
  // Rosa Zarza preside como socia y senior partner (art. 29 Estatutos);
  // Roberto Delgado, Secretario elegido por unanimidad de los asistentes.
  const { data: pres } = await client.from("persons").select("full_name").eq("id", data.president_id).single();
  const { data: sec } = await client.from("persons").select("full_name").eq("id", data.secretary_id).single();
  expect(pres.full_name).toContain("Zarza");
  expect(sec.full_name).toContain("Delgado");
});

it("la asistencia es la del acta: 3 presenciales + 343 representados por Delgado", async () => {
  const { data: m } = await client.from("meetings").select("id").eq("tenant_id", GARRIGUES_TENANT).single();
  const { data } = await client.from("meeting_attendees")
    .select("attendance_type, represented_by_id, person_id").eq("meeting_id", m.id);
  expect(data).toHaveLength(346);
  expect(data.filter((a) => a.attendance_type === "PRESENCIAL")).toHaveLength(3);
  const repr = data.filter((a) => a.attendance_type === "REPRESENTADO");
  expect(repr).toHaveLength(343);
  // Todos representados por la MISMA persona: Roberto Delgado exhibió las
  // cartas de delegación a la Presidenta.
  expect(new Set(repr.map((a) => a.represented_by_id)).size).toBe(1);
});

it("el censo WORM lo crea la RPC y refleja los 346 socios", async () => {
  const { data: m } = await client.from("meetings").select("id").eq("tenant_id", GARRIGUES_TENANT).single();
  const { data } = await client.from("censo_snapshot")
    .select("snapshot_type, total_partes, audit_worm_id, capital_total_base").eq("meeting_id", m.id).single();
  expect(data.snapshot_type).toBe("UNIVERSAL");
  expect(data.audit_worm_id).not.toBeNull();   // lo rellena el trigger: prueba que pasó por la RPC
  expect(Number(data.total_partes)).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Correr y verificar que falla**

```bash
bun test src/test/schema/garrigues-junta-2026-seed.test.ts
```

Esperado: FAIL en los tres casos nuevos.

- [ ] **Step 3: Ampliar el seed**

1. `meetings`: `slug`, `body_id` de `garrigues-junta-socios`, `meeting_type='JUNTA'`, `scheduled_start='2026-05-06T00:00:00Z'` (la hora no consta en el certificado — no se inventa: se documenta en `quorum_data.notas`), `status='CLOSED'`, `president_id` = Rosa Zarza, `secretary_id` = Roberto Delgado, `location` de los Estatutos.
2. `meeting_attendees`: patrón delete-all + insert (el mismo de `useReplaceAttendees`). 3 filas `PRESENCIAL`; 343 filas `REPRESENTADO` con `represented_by_id` = persona de Roberto Delgado y `via_representante: true`. `shares_represented` y `capital_representado` salen de `capital_holdings`, no se recalculan aquí.
3. `censo_snapshot`: **por RPC**, jamás por INSERT.

```ts
const { data, error } = await admin.rpc("fn_crear_censo_snapshot", {
  p_meeting_id: meetingId,
  p_session_kind: "JUNTA",
  p_entity_id: GARRIGUES_MATRIZ_UUID,
  p_body_id: null,          // null → refresca parte_votante por ENTIDAD, que es lo que
  p_snapshot_type: "UNIVERSAL",
});
if (error) fail(`fn_crear_censo_snapshot: ${error.message}`);
```

Un INSERT directo devolvería `AUTHORITATIVE_WRITE_RPC_REQUIRED` incluso con service_role, y `censo_snapshot` es **inmutable**: un error aquí no se puede borrar, se queda para siempre. Verificar el dry-run antes de `--commit`.

4. `quorum_data`: `{ base_computo: "VOTOS_CLASE_A_NO_AUTOCARTERA", base_votos: 16900, presenciales_votos: 150, presenciales_pct: 0.8875, representados_pct: 99.1125, autocartera_pct_sobre_total: 2.59, notas: [...] }`, con los valores tomados de `estructura-art7.ts`, **no** escritos a mano.

- [ ] **Step 4: Dry-run, aplicación y verificación**

```bash
bun run scripts/seed-garrigues-junta-2026.ts
bun run scripts/seed-garrigues-junta-2026.ts --commit
bun test src/test/schema/garrigues-junta-2026-seed.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-garrigues-junta-2026.ts src/test/schema/garrigues-junta-2026-seed.test.ts
git commit -m "feat(c1): reunión, asistencia real del acta y censo WORM de la Junta de Socios 2026"
```

---

## Task 6 — Los 10 acuerdos, con el motor SLP resolviendo por materia

**Files:**
- Modify: `scripts/seed-garrigues-junta-2026.ts` (tercera mitad)
- Test: `src/test/schema/garrigues-junta-2026-seed.test.ts` (tercer bloque)

**Interfaces:**
- Consumes: `meeting_id` (Task 5), `ORDEN_DEL_DIA` (Task 4).
- Produces: 10 filas de `agreements` con `parent_meeting_id` = el `meeting_id`, cada una con su `agreement_kind`, `rule_pack_id` y `rule_pack_version`. Tasks 7–9 cuelgan de estos `agreement_id`.

**Antes de escribir nada, resolver dos ambigüedades por query, no por conjetura:**

1. `materia_catalog` tiene **`MODIFICACION_ESTATUTOS`** y **`MOD_ESTATUTOS`**, las dos `ESTATUTARIA` e inscribibles. Consultar cuál usan las 6 plantillas ACTIVA de Garrigues y los rule packs del tenant, y usar esa. Si ninguna la usa, usar la que use la mayoría del catálogo de ARGA y **anotarlo en el ledger**.
2. El camino de resolución del stepper para las materias SLP es **POR MATERIA** (`src/lib/secretaria/rule-resolution.ts`), sin fallback a órgano. Comprobar que las 4 materias genéricas (`MODIFICACION_ESTATUTOS`, `APROBACION_CUENTAS`, `NOMBRAMIENTO_AUDITOR`, `DELEGACION_FACULTADES`) tienen pack alcanzable para un tenant SLP; si alguna cae en el fallback de órgano, **el aviso de procedencia de `RegistryRuleProvenanceNotice` debe verse en pantalla** y se anota como hallazgo, no se silencia.

- [ ] **Step 1: Escribir el test que falla**

```ts
const MATERIAS_ESPERADAS = [
  "MODIFICACION_ESTATUTOS", "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
  "EXCLUSION_SOCIO_ESTATUTARIA", "CONTINUIDAD_SOCIO_POST_60", "ADMISION_SOCIO_CUOTA",
  "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA", "APROBACION_CUENTAS",
  "NOMBRAMIENTO_AUDITOR", "RETRIBUCION_PRESTACIONES_ACCESORIAS", "DELEGACION_FACULTADES",
];
const CON_GATE = new Set([
  "ADMISION_SOCIO_CUOTA", "EXCLUSION_SOCIO_ESTATUTARIA",
  "CONTINUIDAD_SOCIO_POST_60", "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
]);

it("hay 10 acuerdos y son exactamente los 10 puntos con materia acreditada", async () => {
  const { data } = await client.from("agreements")
    .select("agreement_kind, matter_class, inscribable, adoption_mode, parent_meeting_id, rule_pack_id")
    .eq("tenant_id", GARRIGUES_TENANT);
  expect(data).toHaveLength(10);
  expect(data.map((a) => a.agreement_kind).sort()).toEqual([...MATERIAS_ESPERADAS].sort());
  expect(data.every((a) => a.adoption_mode === "MEETING")).toBe(true);
  expect(data.every((a) => a.parent_meeting_id !== null)).toBe(true);
  expect(data.every((a) => a.rule_pack_id !== null)).toBe(true);
});

it("las 6 materias SLP resuelven a su pack POR MATERIA, no al pack de órgano", async () => {
  const SLP = ["ADMISION_SOCIO_CUOTA", "EXCLUSION_SOCIO_ESTATUTARIA", "CONTINUIDAD_SOCIO_POST_60",
               "RETRIBUCION_PRESTACIONES_ACCESORIAS", "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA",
               "NOMBRAMIENTO_ADMINISTRADOR_UNICO"];
  const { data } = await client.from("agreements")
    .select("agreement_kind, rule_pack_id").eq("tenant_id", GARRIGUES_TENANT).in("agreement_kind", SLP);
  expect(data).toHaveLength(6);
  for (const a of data) {
    expect(a.rule_pack_id).toBe(a.agreement_kind);   // el pack por materia se llama como la materia
    expect(a.rule_pack_id).not.toBe("GARR_JUNTA_SOCIOS");
  }
});

it("el gate del informe preceptivo dispara en 4 acuerdos y solo en esos 4", async () => {
  const { data: ags } = await client.from("agreements")
    .select("id, agreement_kind").eq("tenant_id", GARRIGUES_TENANT);
  const { data: reqs } = await client.from("agreement_document_requirements")
    .select("agreement_id, requirement_code, blocking, phase")
    .in("agreement_id", ags.map((a) => a.id))
    .eq("requirement_code", "INFORME_PRECEPTIVO_ORGANO");
  const conGate = new Set(reqs.map((r) => ags.find((a) => a.id === r.agreement_id).agreement_kind));
  expect(conGate).toEqual(CON_GATE);
  expect(reqs.every((r) => r.blocking === true && r.phase === "PRE_CONVOCATORIA")).toBe(true);
});

it("la mayoría de admisión es el 80 % estatutario y la de exclusión la doble mayoría", async () => {
  const { data } = await client.from("rule_pack_versions")
    .select("pack_id, payload").in("pack_id", ["ADMISION_SOCIO_CUOTA", "EXCLUSION_SOCIO_ESTATUTARIA"])
    .eq("is_active", true);
  const adm = data.find((r) => r.pack_id === "ADMISION_SOCIO_CUOTA").payload.votacion.mayoria.SL;
  expect(adm.formula).toBe("favor >= 4/5_votos_totales");
  expect(adm.referencia).toContain("30.3.b");
  const exc = data.find((r) => r.pack_id === "EXCLUSION_SOCIO_ESTATUTARIA").payload.votacion.mayoria.SL;
  expect(exc.formula).toContain("mayoria_socios_profesionales");
  expect(exc.referencia).toContain("15 Ley 2/2007");
});
```

**Nota para el implementador:** el nombre real de la tabla de requisitos lo genera `fn_refresh_agreement_document_requirements`. Localizarlo en `supabase/migrations/20260805110000_g3_informe_preceptivo_gate.sql` y usar el nombre real; si difiere de `agreement_document_requirements`, corregir el test — **no** dar el gate por bueno sin consultarlo.

- [ ] **Step 2: Correr y verificar que falla**

```bash
bun test src/test/schema/garrigues-junta-2026-seed.test.ts
```

- [ ] **Step 3: Ampliar el seed con los 10 acuerdos**

Por cada punto de `ORDEN_DEL_DIA` con `materializa: true`, una fila de `agreements`:

- `entity_id` = matriz, `body_id` = junta de socios, `parent_meeting_id` = el `meeting_id`.
- `agreement_kind` = la materia, `adoption_mode='MEETING'`.
- `matter_class` e `inscribable` **leídos de `materia_catalog`**, nunca escritos a mano: si el seed los duplica, el día que el catálogo cambie el expediente mentirá.
- `rule_pack_id` / `rule_pack_version` resueltos consultando `rule_pack_versions` activa por `pack_id = materia`; si no existe pack por materia, caer al de órgano **y registrar la procedencia** en `compliance_explain` para que el aviso salga en pantalla.
- `proposal_text` y `decision_text`: literal del certificado donde lo hay (puntos 1.2, 5, 6, 10 tienen contenido registral confirmado por BORME). Donde el certificado no transcribe el acuerdo (p. ej. las exclusiones de socios concretos), texto **sin identificar personas** y marcado `INFERIDO` en `compliance_explain`, tal como manda la spec §3.6.
- `decision_date = '2026-05-06'`, `status = 'ADOPTED'`.
- `agenda_item_id` = el número del punto, para que la trazabilidad orden del día ↔ acuerdo sea una arista real y no una coincidencia de texto.

- [ ] **Step 4: Aplicar y verificar**

```bash
bun run scripts/seed-garrigues-junta-2026.ts
bun run scripts/seed-garrigues-junta-2026.ts --commit
bun test src/test/schema/garrigues-junta-2026-seed.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-garrigues-junta-2026.ts src/test/schema/garrigues-junta-2026-seed.test.ts
git commit -m "feat(c1): los 10 acuerdos de la Junta 2026 con resolución por materia y gate preceptivo en 4"
```

---

## Task 7 — Votaciones y resoluciones coherentes con el censo

**Files:**
- Modify: `scripts/seed-garrigues-junta-2026.ts`
- Test: `src/test/schema/garrigues-junta-2026-seed.test.ts` (cuarto bloque)

**Interfaces:**
- Consumes: los 10 `agreement_id` (Task 6), `baseComputoJunta()` (Task 2).
- Produces: 10 filas de `meeting_resolutions` con `agreement_id` y `agenda_item_index`; `meeting_votes` con el reparto de votos por acuerdo.

- [ ] **Step 1: Escribir el test que falla**

```ts
it("cada acuerdo tiene su resolución enlazada por agreement_id, no por texto", async () => {
  const { data: m } = await client.from("meetings").select("id").eq("tenant_id", GARRIGUES_TENANT).single();
  const { data } = await client.from("meeting_resolutions")
    .select("agreement_id, agenda_item_index, status, required_majority_code").eq("meeting_id", m.id);
  expect(data).toHaveLength(10);
  expect(data.every((r) => r.agreement_id !== null)).toBe(true);
  expect(new Set(data.map((r) => r.agreement_id)).size).toBe(10);
  expect(data.every((r) => r.status === "ADOPTED")).toBe(true);
});

it("los votos de cada acuerdo caben en la base de cómputo declarada", async () => {
  const { data: m } = await client.from("meetings").select("id").eq("tenant_id", GARRIGUES_TENANT).single();
  const { data } = await client.from("meeting_votes").select("*").eq("meeting_id", m.id);
  const porAcuerdo = new Map();
  for (const v of data) porAcuerdo.set(v.agreement_id, (porAcuerdo.get(v.agreement_id) ?? 0) + Number(v.votes ?? 0));
  for (const [, total] of porAcuerdo) expect(total).toBeLessThanOrEqual(16_900);
});

it("la admisión alcanza el 80 % de los votos que exige el art. 30.3.b", async () => {
  const { data: ag } = await client.from("agreements").select("id")
    .eq("tenant_id", GARRIGUES_TENANT).eq("agreement_kind", "ADMISION_SOCIO_CUOTA").single();
  const { data } = await client.from("meeting_votes").select("direction, votes").eq("agreement_id", ag.id);
  const favor = data.filter((v) => v.direction === "FAVOR").reduce((s, v) => s + Number(v.votes), 0);
  expect(favor / 16_900).toBeGreaterThanOrEqual(0.8);
});
```

**Nota:** las columnas reales de `meeting_votes` no están fijadas en este plan. Consultarlas antes de escribir el test y ajustar los nombres; si la tabla no modela votos ponderados, registrar el hallazgo en el ledger y usar el modelo que ya use la Junta canónica de ARGA (`meeting_id` `c3305c16-…`) como referencia — **no** inventar un modelo nuevo.

- [ ] **Step 2: Correr y verificar que falla**
- [ ] **Step 3: Ampliar el seed.** El acta certifica que los acuerdos se adoptaron; el desglose nominal de votos **no** está transcrito. Se modela el resultado agregado (unanimidad de los asistentes donde el certificado lo dice; mayoría cualificada alcanzada donde no lo detalla) con `compliance_explain` marcando `INFERIDO` el desglose. **No se atribuye un voto concreto a un socio concreto.**
- [ ] **Step 4: Aplicar y verificar que pasa**
- [ ] **Step 5: Commit**

```bash
git add scripts/seed-garrigues-junta-2026.ts src/test/schema/garrigues-junta-2026-seed.test.ts
git commit -m "feat(c1): resoluciones y votaciones agregadas de la Junta 2026 sobre la base de cómputo declarada"
```

---

## Task 8 — Acta por RPC y certificación del administrador único sin VºBº

**Files:**
- Modify: `scripts/seed-garrigues-junta-2026.ts`
- Test: `src/test/schema/garrigues-junta-2026-seed.test.ts` (quinto bloque)

**Interfaces:**
- Consumes: `meeting_id`, `censo_snapshot.id` (Task 5), los 10 `agreement_id` (Task 6).
- Produces: 1 fila de `minutes` con `gate_hash`; 1 fila de `certifications` enlazada al acta.

**Lo que hace esta tarea única:** el acta y la certificación **no se insertan**. Las genera la cadena de RPC existente, que es la que calcula el `gate_hash = SHA-256(snapshot_hash ‖ resultado_hash)`. Un INSERT directo produciría una fila con el aspecto correcto y sin cadena WORM — el fallo que la review adversarial de G4 cazó dos veces.

- [ ] **Step 1: Escribir el test que falla**

```ts
it("el acta la genera fn_generar_acta: tiene gate_hash y snapshot", async () => {
  const { data } = await client.from("minutes")
    .select("id, body_id, entity_id, snapshot_id, snapshot_hash, gate_hash, status")
    .eq("tenant_id", GARRIGUES_TENANT).single();
  expect(data.gate_hash).not.toBeNull();
  expect(data.snapshot_id).not.toBeNull();     // prueba que pasó por la RPC con el censo WORM
  expect(data.body_id).not.toBeNull();
  expect(data.entity_id).not.toBeNull();       // sin esto el botón de certificar no renderiza
});

it("la certificación la expide el administrador único SIN VºBº (patrón art. 109 RRM)", async () => {
  const { data } = await client.from("certifications")
    .select("certificante_role, visto_bueno_persona_id, agreements_certified, authority_evidence_id")
    .eq("tenant_id", GARRIGUES_TENANT).single();
  expect(data.certificante_role).toContain("ADMIN");
  expect(data.visto_bueno_persona_id).toBeNull();   // administrador único: no hay VºBº
  expect(data.authority_evidence_id).not.toBeNull();
  expect(data.agreements_certified.length).toBeGreaterThan(0);
});
```

**Nota:** los nombres exactos de columna de `certifications` se consultan antes de escribir el test (`information_schema.columns`). El comportamiento de "administrador único sin VºBº" ya está implementado (`isAdminUnicoCertificante`, G3): esta tarea lo **ejercita**, no lo reimplementa.

- [ ] **Step 2: Correr y verificar que falla**

- [ ] **Step 3: Ampliar el seed con las dos llamadas RPC**

```ts
const { data: minuteId, error: eActa } = await admin.rpc("fn_generar_acta", {
  p_meeting_id: meetingId,
  p_content: buildActaContent(),     // literal del acta reconstruido desde ORDEN_DEL_DIA + resoluciones
  p_snapshot_id: censoSnapshotId,
});
if (eActa) fail(`fn_generar_acta: ${eActa.message}`);

const { data: certId, error: eCert } = await admin.rpc("fn_generar_certificacion", {
  p_minute_id: minuteId,
  p_tipo: "CERTIFICACION_ACUERDOS",
  p_agreements_certified: agreementIds,
  p_certificante_role: "ADMINISTRADOR_UNICO",
  p_visto_bueno_persona_id: null,     // art. 109 RRM: el administrador único certifica sin VºBº
});
if (eCert) fail(`fn_generar_certificacion: ${eCert.message}`);
```

`buildActaContent()` incluye la cabecera del art. 97 RRM, la mesa (Zarza presidenta, Delgado secretario elegido por unanimidad), el censo, los 13 puntos del orden del día —**incluidos los 3 sin acuerdo materializado, con su nota**— y el pie de que el acta se aprobó al final de la reunión y la firmó el Secretario con el VºBº de la Presidenta.

**Precondición que hay que comprobar antes:** `fn_generar_certificacion` exige `authority_evidence` VIGENTE del certificante. Verificar que Fernando Vives tiene su fila de `Adm. Único` (sembrada en G2 por `fn_designar_cargo`); si no, **parar y reportar**: no se crea a mano una evidencia de autoridad.

- [ ] **Step 4: Aplicar y verificar que pasa**
- [ ] **Step 5: Commit**

```bash
git add scripts/seed-garrigues-junta-2026.ts src/test/schema/garrigues-junta-2026-seed.test.ts
git commit -m "feat(c1): acta por fn_generar_acta y certificación del administrador único sin VºBº"
```

---

## Task 9 — Ciclo registral: elevación, inscripción del 13/07/2026 y BORME

**Files:**
- Modify: `scripts/seed-garrigues-junta-2026.ts`
- Test: `src/test/schema/garrigues-junta-2026-seed.test.ts` (sexto bloque)

**Interfaces:**
- Consumes: los `agreement_id` inscribibles (Task 6), `certifications.id` (Task 8).
- Produces: filas de `registry_filings` con las fechas reales del BORME.

**Dato real confirmado (spec §3.6, Carril B 2026-08-03):** los acuerdos de la Junta del 6-may quedaron inscritos el **13/07/2026** — anuncio **338618, I/A 960** (cese + nombramiento de Vives como Adm. Único y modificación del art. 36) y anuncio **338619, I/A 961** (alta del socio Silva Castañón). Solo esos dos anuncios están confirmados: los demás acuerdos inscribibles quedan en el estado que corresponda **sin inventarles anuncio ni fecha**.

- [ ] **Step 1: Escribir el test que falla**

```ts
it("los dos acuerdos con inscripción confirmada por BORME llegan a REGISTERED con su anuncio", async () => {
  const { data } = await client.from("registry_filings")
    .select("agreement_id, status, registration_date, borme_announcement, inscription_number")
    .eq("tenant_id", GARRIGUES_TENANT);
  const inscritos = data.filter((f) => f.status === "REGISTERED");
  expect(inscritos).toHaveLength(2);
  expect(inscritos.every((f) => f.registration_date === "2026-07-13")).toBe(true);
  expect(inscritos.map((f) => f.inscription_number).sort()).toEqual(["960", "961"]);
});

it("ningún expediente registral se inventa fecha de inscripción", async () => {
  const { data } = await client.from("registry_filings")
    .select("status, registration_date").eq("tenant_id", GARRIGUES_TENANT);
  for (const f of data) {
    if (f.status !== "REGISTERED") expect(f.registration_date).toBeNull();
  }
});
```

**Nota:** los nombres de columna de `registry_filings` se consultan antes de escribir el test. Si no existe columna para el número de anuncio BORME, guardarlo en el campo de metadatos que ya use ARGA y ajustar el test — no crear columna nueva sin autorización del orquestador.

- [ ] **Step 2: Correr y verificar que falla**
- [ ] **Step 3: Ampliar el seed**
- [ ] **Step 4: Aplicar y verificar que pasa**
- [ ] **Step 5: Commit**

```bash
git add scripts/seed-garrigues-junta-2026.ts src/test/schema/garrigues-junta-2026-seed.test.ts
git commit -m "feat(c1): ciclo registral de la Junta 2026 con la inscripción real del 13/07/2026"
```

---

## Task 10 — Verificación viva, control de ARGA y cierre

**Files:**
- Create/Modify: `.superpowers/sdd/2026-08-29-c1-junta-socios-garrigues-2026/progress.md`
- Modify: `CLAUDE.md` (solo el bullet de C1, **reconstruido desde HEAD**)
- Modify: `src/pages/secretaria/**` o `src/lib/secretaria/**` **solo si** la verificación encuentra una superficie que afirme algo falso

- [ ] **Step 1: Gates en worktree limpio**

**No** en el árbol compartido, que tiene 74 entradas sucias:

```bash
git worktree add /private/tmp/c1-gates feature/c1-junta-garrigues-2026
cd /private/tmp/c1-gates && bun install
bun run lint && bun run typecheck && bun test && bun run build
```

Esperado, sin regresión sobre la línea base del orquestador: `bun test` ≥ **3461 pass / 152 skip / 0 fail**; lint 0; typecheck 0; build OK. **Anotar en el ledger dónde se corrieron.**

- [ ] **Step 2: Control de ARGA en las dos puntas**

```sql
SELECT 'meetings' t, count(*) FROM meetings WHERE tenant_id='00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'agreements', count(*) FROM agreements WHERE tenant_id='00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'convocatorias', count(*) FROM convocatorias WHERE tenant_id='00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'minutes', count(*) FROM minutes WHERE tenant_id='00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'certifications', count(*) FROM certifications WHERE tenant_id='00000000-0000-0000-0000-000000000001'
UNION ALL SELECT 'rule_packs', count(*) FROM rule_packs WHERE tenant_id='00000000-0000-0000-0000-000000000001';
```

Esperado, idéntico antes y después: 27 · 46 · 59 · 12 · 9 · 59.

- [ ] **Step 3: Verificación viva con login Garrigues**

`/login?tenant=garrigues` → `demo@garrigues-demo.dev`. **Comprobar en el token qué sesión está activa en cada medición**: dos pestañas comparten `localStorage` y la `storageKey` de Supabase, y entrar como un tenant sobrescribe la sesión del otro.

Recorrido con captura en cada punto:

1. `/secretaria` — el dashboard deja de estar a cero.
2. `/secretaria/convocatorias/:id` — 15 días, canal individual, los 13 puntos del orden del día con la nota visible en los 3 sin acuerdo.
3. `/secretaria/reuniones/:id` — censo 346, 3 presenciales + 343 representados por Delgado, autocartera excluida, mesa Zarza/Delgado.
4. `/secretaria/acuerdos/:id` del acuerdo de **admisión** — mayoría **80 %** con cita del art. 30.3.b, y el panel del **informe preceptivo del Consejo de Socios** exigiéndolo.
5. `/secretaria/acuerdos/:id` del acuerdo de **exclusión** — **doble mayoría** con cita de los arts. 30.2.g Estatutos y 15 Ley 2/2007.
6. Un acuerdo **sin** gate (p. ej. `APROBACION_CUENTAS`) — el panel del informe preceptivo **no** aparece. Control discriminante: sin él, "el gate funciona" solo significa "el panel se pinta siempre".
7. `/secretaria/actas/:id` y la ficha de certificación — administrador único, **sin VºBº**.
8. `/secretaria/tramitador/:id` — inscripción 13/07/2026, anuncios 960 y 961.
9. **Control ARGA en la misma pantalla:** entrar con `demo@arga-seguros.com` y comprobar que su Junta y sus acuerdos siguen intactos y que ninguna materia SLP se le oferta.

- [ ] **Step 4: Probar las ARISTAS, no los rótulos**

Por cada relación que la demo afirma, o se navega el enlace o hay un test que se rompería si dejara de leerse:

- orden del día → acuerdo: navegar desde el punto del orden del día al expediente. Si no hay enlace, es un hallazgo.
- acuerdo → rule pack: comprobar que la mayoría mostrada cambia al consultar `rule_pack_versions`, no que coincida con un texto sembrado.
- acuerdo → informe preceptivo: comprobar que el órgano informante que se pinta es el que sale de `config.informe_preceptivo_de`, resolviendo por **slug** (`/organos/:id` resuelve por slug, no por UUID).
- acta → censo: `minutes.snapshot_id` apunta al `censo_snapshot` de esta reunión.

- [ ] **Step 5: Review adversarial de rama**

Diff completo `1888aa0..HEAD` a un revisor con instrucción de **refutar**, no de confirmar. Mínimo tres lentes: (a) el dato dice lo que la pantalla afirma; (b) las citas legales están cotejadas contra texto vigente; (c) el aislamiento con ARGA. Precedente: en G3 esta capa cazó dos defectos que ninguna otra vio; en G4, dos P0 que habían sobrevivido a la fase entera.

- [ ] **Step 6: Cerrar el ledger**

`.superpowers/sdd/2026-08-29-c1-junta-socios-garrigues-2026/progress.md` con una entrada por tarea: brief, diff revisado, hallazgos del revisor, fixes, y **dónde se corrieron los gates**.

- [ ] **Step 7: Actualizar el bullet de C1 en `CLAUDE.md`**

Reconstruyendo desde HEAD con `git hash-object` + `update-index`, **nunca** sobre el árbol sucio: dos incidentes de arrastre de prosa WIP se evitaron así en G0/G1.

- [ ] **Step 8: Commit y reportar al orquestador**

```bash
git add .superpowers/sdd/2026-08-29-c1-junta-socios-garrigues-2026/progress.md CLAUDE.md
git commit -m "docs(c1): ledger del carril y estado del caso canónico de la Junta de Socios 2026"
```

**El merge lo ordena el orquestador. C1 no mergea por su cuenta.**

---

## Riesgos conocidos y cómo se manejan

| Riesgo | Manejo |
|---|---|
| La base de cómputo de la Junta (16.900) no es la que un mercantilista esperaría (16.908) | Decisión expresa del usuario del 2026-08-29, documentada en el módulo, en el test y en `quorum_data.base_computo`. La desviación de 8 votos se enseña, no se esconde. |
| `entity_capital_profile` no admite dos nominales | Resuelto en Task 2 con columnas nullable en `share_classes`. ARGA queda con NULL = cero cambio, aserido en la propia migración. |
| Qué 8 socios tienen clase B no es público | Elección determinista y arbitraria, etiquetada `asignacion_clase: "INFERIDO"` en cada fila y aserida en el test. |
| `MODIFICACION_ESTATUTOS` vs `MOD_ESTATUTOS` | Se resuelve por query en Task 6 antes de escribir, y se anota en el ledger. |
| Alguna de las 4 materias genéricas cae en el fallback de pack por órgano | El aviso de procedencia ya existe (`RegistryRuleProvenanceNotice`). Se comprueba en pantalla y se registra como hallazgo. La opción C (fail-closed) sigue fuera de alcance: es post-demo y del Comité Legal. |
| `censo_snapshot` es inmutable: un snapshot mal creado no se borra | Dry-run obligatorio antes de `--commit` en Task 5, y la llamada es por RPC. |
| Un gate verde que en realidad no asierta nada | Prohibido `|| ""` en la anon key; los tests nuevos comprueban `toHaveLength` y no solo ausencia de error; gates medidos en worktree limpio. |
| 3 puntos del orden del día sin acuerdo pueden leerse como demo incompleta | Llevan nota visible en la convocatoria y en el acta. Es honestidad de dato, no una laguna: crear su materia es dictamen del Comité Legal. |

## Fuera de alcance de este carril

- Crear materias nuevas en `materia_catalog` (Centro de Estudios, sostenibilidad, informe de gestión).
- Tocar `obligations`, `controls`, `policies`, `grc_modules` — superficie compartida congelada.
- Unificar los 5 normalizadores de tipo social (deuda catalogada, tocaría la semántica SAU/SLU de ARGA).
- Corregir `extractMajorityFromRulePackParams`, que solo lee claves de primer nivel mientras los packs anidan la mayoría bajo `votacion.mayoria` — arreglarlo cambiaría mayorías mostradas en ARGA y exige Comité Legal.
- Afirmar firma, QES, ERDS, envío o entrega reales sobre cualquier artefacto de este expediente.
