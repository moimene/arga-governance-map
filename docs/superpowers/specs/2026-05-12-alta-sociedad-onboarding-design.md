# Alta de sociedad — Onboarding societario D6 (design)

**Fecha:** 2026-05-12
**Módulo:** Secretaría Societaria
**Branch:** `claude/strange-albattani-3df05c`
**Spec previo de referencia:** `docs/superpowers/plans/2026-05-12-construccion-alta-sociedad-onboarding.md`
**Carril paralelo dependiente:** `feature/personas-cargos-refactor` (en D5–D6)
**Demo objetivo:** Garrigues 19–23 mayo 2026

---

## 1. Objetivo

Refactorizar `SociedadNuevaStepper` (hoy 4 pasos → identidad, admin, capital, confirm) a un **onboarding societario completo de 11 pasos** que entrega una sociedad realmente operativa: con identidad legal, domicilio, CNAE, datos registrales, capital, clases/series, cap table inicial, órganos sociales, cargos iniciales, reglas societarias y documentos soporte (vía metadata en sprint actual).

Una sociedad creada por este flujo debe poder, sin trabajo adicional:
- iniciar convocatorias,
- celebrar reuniones y calcular quórum,
- emitir certificaciones (si tiene cargos certificantes vigentes),
- aparecer como censo válido para Junta y Consejo,
- pasar la matriz de validaciones del motor LSC.

---

## 2. Decisiones arquitectónicas tomadas

### 2.1 Alcance del sprint — (D) "todo hasta integración con Personas/Cargos"

Cubrimos Fases B → F del plan original:
- **B** Migración campos legales de `entities`
- **C** Dominio puro (types, defaults, validators, builders + tests)
- **D** UI stepper 11 pasos
- **E** Persistencia legal+capital (TX1, vía RPC transaccional)
- **F** Persistencia personas+cargos (TX2, vía adaptador a hooks actuales)

### 2.2 Coordinación con carril Personas/Cargos — opción (D1)

Adaptador real consumiendo hooks **actuales en `main`** (`usePersonasCanonical`, `useCargos`, `useRepresentacionesCanonical`), encapsulado en `src/lib/secretaria/sociedad-onboarding/adapters.ts` como **único punto de cambio**. Como esos hooks hoy solo exponen lectura, los inserts a `condiciones_persona`, `representaciones` y la búsqueda/creación de `persons` por NIF se hacen vía `supabase.from(...).insert(...)` dentro del adaptador.

**Cuando `feature/personas-cargos-refactor` mergee a `main` (D7 cerrado)**, hacemos `git merge main` en nuestra rama y sustituimos las llamadas directas a Supabase del adaptador por los hooks de mutación del otro carril:
- `useCondicionesPersonaMutations` para `condiciones_persona`
- `useUpsertRepresentanteAdminPJ` para `representaciones`
- (lookup persona por NIF y creación con respeto a `UNIQUE(tenant_id, tax_id)` ya garantizado por migración `000063` del otro carril)

Esto es un commit aislado, ~1–2h de trabajo. La frontera está sellada porque toda la integración con personas/cargos vive en `adapters.ts`.

### 2.3 Persistencia multi-tabla — opción (D6) híbrido

**Pasos 1–10 del stepper son draft puramente local.** No tocan Supabase. Implementación con `useReducer<Draft, DraftAction>`. El usuario puede navegar adelante/atrás libremente y abandonar sin generar estado en BD.

**Paso 11 "Revisión y creación" ejecuta dos transacciones secuenciales:**

#### TX1 — RPC `fn_crear_sociedad_legal_y_capital` (atómica server-side)

Una sola RPC PL/pgSQL que envuelve en `BEGIN … COMMIT` las inserciones a las 9 tablas no-personales:

1. `persons` (PJ de la sociedad)
2. `entities` (con todos los campos legales: domicilio, CNAE, RM desglosado, LEI, fechas, propósito) — el `onboarding_status` se inserta como **estado pesimista** (`'INCOMPLETA_CARGOS'`); solo TX2 confirmado puede promoverlo a `'OPERATIVA'`.
3. `entity_capital_profile` (estado `VIGENTE`)
4. `share_classes` (1..N clases/series)
5. `persons` (socios PF/PJ — **lookup-first dentro de la RPC**: `SELECT id FROM persons WHERE tenant_id = p_tenant AND tax_id = v_tax LIMIT 1`; si NULL → `INSERT … RETURNING id`. `ON CONFLICT DO NOTHING RETURNING id` NO se usa porque no devuelve row en colisión, y además requiere UNIQUE constraint que en `main` actual no existe — la `UNIQUE(tenant_id, tax_id)` se añade por migración `000063` del carril Personas/Cargos, aún no en `main`. El lookup-first es independiente de esa migración y robusto en ambos estados.)
6. `capital_holdings` (cap table inicial, soporta `is_treasury=true`)
7. `governing_bodies` (Junta + órgano admin + Consejo + comisiones si aplica)
8. `entity_settings` (solo claves catalogadas en `entity_settings_catalog`)
9. `rule_param_overrides` (solo si el draft incluye estatutos/reglas)

Si **cualquier** paso falla, `ROLLBACK` atómico — no queda basura en BD.

La RPC **no escribe** `condiciones_persona`, `representaciones` ni `authority_evidence`. Esos pertenecen al carril Personas/Cargos y se hacen en TX2.

#### TX2 — Adaptador `adapters.ts` (client-side, post-COMMIT de TX1)

Después de que TX1 retorna `entity_id`, ejecuta secuencialmente:
1. Lookup/creación de `persons` para cada cargo (PF + PJ admin con representante PF).
2. `condiciones_persona` para cada cargo del draft con `tipo_condicion`, `fecha_inicio`, `fuente_designacion ∈ {ACTA_NOMBRAMIENTO, ESCRITURA, DECISION_UNIPERSONAL, BOOTSTRAP}` (CHECK del schema canónico, migración `000024`), `representative_person_id` solo cuando `tipo_condicion='ADMIN_PJ'`. El CHECK `chk_condicion_body_coherente` exige `body_id IS NULL` para `SOCIO/ADMIN_*` y `body_id IS NOT NULL` para `CONSEJERO/PRESIDENTE/SECRETARIO/VICEPRESIDENTE/CONSEJERO_COORDINADOR`.
3. `representaciones` con `scope='ADMIN_PJ_REPRESENTANTE'` (único scope persistente del CHECK `chk_representacion_scope_enum`; los otros — `JUNTA_PROXY` y `CONSEJO_DELEGACION` — son operacionales y requieren `meeting_id`, no aplican al alta). Para PJ accionista con representante de junta, **no se persiste en alta**: el `JUNTA_PROXY` se crea por junta concreta en otro flujo. La tabla `representaciones` NO tiene columna `estado` — la vigencia se modela vía `effective_from` (DATE NOT NULL) y `effective_to`.
4. `authority_evidence` queda **autopoblado** por el trigger `fn_sync_authority_evidence` (aplicado por carril Personas/Cargos en migración `000064`); NO escribimos manualmente.

Si TX2 falla parcial:
- La sociedad creada por TX1 **se mantiene** en BD (es válida estructuralmente).
- `entities.onboarding_status` queda en `INCOMPLETA_CARGOS`.
- UX muestra banner: "Sociedad creada. Faltan N cargos por designar. Completar en Designar admin / Asignar cargo." con enlace directo.
- No rollback de TX1 — el usuario no pierde el trabajo legal/capital ya tecleado.

### 2.4 Sub-decisiones (a/b/c) confirmadas

| ID | Decisión | Valor |
|---|---|---|
| (a) | Migración nueva `000067_fn_crear_sociedad_legal_y_capital.sql` | **SÍ** autorizada |
| (b) | Modo borrador a medias (tabla `sociedad_onboarding_drafts`) | **NO** en este sprint |
| (c) | Adaptador apunta a hooks NUEVOS vs actuales | **Actuales** (forzado por realidad del worktree) |

### 2.5 Open questions del plan original — resoluciones

| Q | Tema | Resolución |
|---|---|---|
| Q1 | Modo borrador en BD vs local | Local (`useReducer`). Sin tabla `sociedad_onboarding_drafts`. |
| Q2 | Documentos soporte | `entities.support_docs_metadata jsonb` solo referencias (URI/SHA-512/nombre). Sin adjuntos pesados. Storage real cuando cierre contrato evidence. |
| Q3 | RPC transaccional vs rollback cliente | RPC transaccional (`fn_crear_sociedad_legal_y_capital`). Ver §2.3. |
| Q4 | Claves `entity_settings_catalog` | Solo las que ya existen en catálogo. Si una clave del draft no está catalogada, no insertar. Inventario verificado en fase B antes de implementar. |
| Q5 | Refresh `parte_votante_current` | **Lazy**: el motor LSC ya consume `parte_votante_current` regenerándola cuando hace falta. No hacemos refresh eager en alta. |
| Q6 | Autocartera | `capital_holdings.is_treasury = true` con `holder_person_id = entity.person_id` (la PJ propia de la sociedad). El schema canónico (migración `000019`) declara `holder_person_id UUID NOT NULL REFERENCES persons(id)` — no permite null, por lo que modelizar la autocartera como "sociedad poseedora de sí misma" es la opción coherente. El `voting_rights=false` en la fila marca que esos títulos no computan en denominador de voto. |
| Q7 | Cotizada nueva fuera de ARGA | **Permitida** con warning DL-2 del motor LSC. Misma política que ARGA Seguros. |

---

## 3. Estado actual y diagnóstico

`src/pages/secretaria/SociedadNuevaStepper.tsx` tiene **4 pasos**: Identidad, Administración, Capital, Confirmar.

Persistencia actual (5 inserts cliente con rollback compensatorio):
1. `persons` PJ.
2. `entities` con FK `person_id`.
3. `entity_capital_profile` VIGENTE.
4. `share_classes` clase "ORD" ficticia con voting_rights=true.
5. `governing_bodies` Junta + órgano admin.

**Deuda crítica:**
- No recoge domicilio, CNAE, RM desglosado, LEI, fechas, propósito, web, cierre fiscal.
- Mezcla tipo social + unipersonalidad + cotizada + órgano admin en un único paso visual.
- Inventa clase "ORD" como default obligatorio aunque el draft no la confirme.
- No crea cap table real → cualquier reunión calcula quórum con denominador = 0 o cae al fallback "todos los presentes pesan 1".
- No crea socios → libro de socios vacío.
- No crea cargos iniciales → sin presidente/secretario/admin, no hay autoridad certificante, no hay certificaciones.
- No valida socio único en SAU/SLU.
- No soporta PJ accionista con representante.
- Sociedad creada por este flujo no es operativa más allá de aparecer en `SociedadesList`.

---

## 4. Stepper objetivo — 11 pasos

| # | Nombre del paso | Captura | Validación bloqueante |
|---|---|---|---|
| 1 | **Identificación legal** | Denominación legal, nombre común, NIF/CIF, tipo social (SA/SL/SAU/SLU), jurisdicción, fecha constitución, fecha registro | S-001 a S-004 |
| 2 | **Domicilio, CNAE y datos registrales** | Calle, número, piso, CP, ciudad, provincia, país. CNAE principal + secundarios. RM (localidad, tomo, folio, hoja, inscripción). LEI. Propósito social. Duración. Cierre fiscal. Web, email corporativo. | S-005, S-006 |
| 3 | **Perfil societario y grupo** | Forma admin (Único/Solidarios/Mancomunados/Consejo) coherente con tipo social. Cotizada. Sector regulado. Rol en grupo. Matriz si filial. % ownership si matriz declarada. Unipersonalidad **derivada del tipo social** (SAU/SLU lock a `true`, SA/SL editable). El warning CT-005 "SA/SL con socio único no marcado" se emite en **paso 6** al validar cap table, no aquí. | — |
| 4 | **Capital social** | Moneda. Capital escriturado. Capital desembolsado (≤ escriturado). Número total de títulos. Valor nominal (auto-calculado, editable). Tipo de título (acción/participación). | C-001 a C-004 |
| 5 | **Clases / series** | Lista de clases con: código, nombre, votos/título, coeficiente económico, derecho voto, derecho veto, restricciones (metadata). Mínimo 1. Sin "ORD" forzada. Suma de títulos por clase = número total de títulos del paso 4. | CL-001 |
| 6 | **Cap table inicial** | Lista de socios (PF/PJ) con: persona (lookup por NIF o nueva), clase/serie, número títulos, % capital (auto-derivado). Soporta autocartera con `is_treasury=true` y `holder_person_id = entity.person_id` (la PJ propia de la sociedad; el schema no permite null). PJ accionista con representante de junta NO se persiste en alta — el proxy de junta se crea por junta concreta. | CT-001 a CT-005 |
| 7 | **Órganos sociales** | Junta General / Socio Único (auto según unipersonalidad). Órgano admin según forma elegida. Si Consejo: nombre, número mínimo/máximo consejeros. Comisiones opcionales (Auditoría, Nombramientos, Retribuciones, Riesgos). | O-001, O-002 |
| 8 | **Cargos iniciales** | Si Consejo: presidente, secretario, vicepresidente, vicesecretario (opc — solo si migración `000065` del carril Personas/Cargos está en `main`), coordinador independiente (opc), N consejeros. Si Admin Único: 1 administrador (PF o PJ con representante). Si Solidarios/Mancomunados: N administradores. Cargo aporta `person_id`, `body_id`, `tipo_condicion`, `fecha_inicio`, `fuente_designacion ∈ {ACTA_NOMBRAMIENTO, ESCRITURA, DECISION_UNIPERSONAL, BOOTSTRAP}` (CHECK del schema canónico, migración `000024`). | CA-001, CA-002, AU-001, PJ-001 |
| 9 | **Reglas y configuración** | Quórum estatutario (override). Mayorías reforzadas (override). Reglas convocatoria (plazo, medio, primera vs segunda). Voto de calidad (presidente CdA/comité). Restricciones de transmisión. Cierre ejercicio (DD-MM). | Coherencia mayoría reforzada ≥ simple |
| 10 | **Documentos soporte** | Referencias URI/SHA-512/nombre para: escritura constitución, estatutos, certificación NIF, certificación RM, soportes cargo/capital. Guardado en `entities.support_docs_metadata jsonb`. No bloquea operatividad en sprint actual; se promoverán a `evidence_bundles` cuando cierre contrato evidence. | — |
| 11 | **Revisión y creación** | Re-evalúa todas las validaciones. Muestra estado proyectado: `OPERATIVA` / `INCOMPLETA_CARGOS` / `INCOMPLETA_DATOS`. Botón "Crear sociedad" lanza TX1 + TX2. | Cualquier bloqueante de pasos 1–9 |

---

## 5. Persistencia híbrida — detalle (D6)

### 5.1 Migración `20260514_000067_fn_crear_sociedad_legal_y_capital.sql`

Contenido:
1. **Extensión `entities`** con columnas legales faltantes:
   - `constitution_date date`
   - `registration_date date`
   - `registry_location text`
   - `registry_volume text`
   - `registry_folio text`
   - `registry_sheet text`
   - `registry_inscription text`
   - `lei_code text`
   - `cnae_primary text`
   - `cnae_secondary text[]`
   - `corporate_purpose text`
   - `duration text` (`'INDEFINIDA'` o años)
   - `fiscal_year_close text` (formato `'DD-MM'`)
   - `address text` (denormalizado para `variable-resolver`)
   - `address_street text`
   - `address_number text`
   - `address_floor text`
   - `postal_code text`
   - `city text`
   - `province text`
   - `country text`
   - `website text`
   - `corporate_email text`
   - `regulated_sector text` (`'BANCA' | 'SEGUROS' | 'ENERGIA' | 'TELECOM' | 'OTRO' | null`)
   - `group_role text` (`'INDEPENDIENTE' | 'MATRIZ' | 'FILIAL' | 'PARTICIPADA'`)
   - `onboarding_status text` (`'OPERATIVA' | 'INCOMPLETA_CARGOS' | 'INCOMPLETA_DATOS' | 'BORRADOR'`) **default `'INCOMPLETA_CARGOS'`** (estado pesimista: la sociedad nace incompleta y solo se promueve a `'OPERATIVA'` cuando TX2 confirma éxito).
   - `support_docs_metadata jsonb` (default `'{}'::jsonb`)

   **Justificación del default pesimista (post review Codex):** si fuera `'OPERATIVA'`, cualquier escenario donde TX1 commitea pero TX2 no se ejecuta — navegador cerrado, adapter throw entre RPC y UPDATE, red caída antes del UPDATE final — dejaría una sociedad marcada operativa sin cargos/representantes/authority_evidence. Con default pesimista, el peor caso de TX2 no completado deja la sociedad correctamente marcada `INCOMPLETA_CARGOS`, visible al usuario para que complete los cargos desde Designar admin / Asignar cargo.

   Backfill: las filas legacy (sociedades creadas antes de esta migración) reciben `onboarding_status = 'OPERATIVA'` en una sentencia `UPDATE entities SET onboarding_status = 'OPERATIVA' WHERE onboarding_status IS NULL` dentro de la propia migración `000067`. Las nuevas filas nacen con default pesimista.

   Todas las columnas son `NULL`-able para no romper filas legacy. La validación de operatividad es responsabilidad del cliente (validators puros) y del CHECK `onboarding_status` (futuro).

2. **Función `fn_crear_sociedad_legal_y_capital`** (SECURITY DEFINER, lenguaje plpgsql):
   - Firma: `(p_tenant_id uuid, p_payload jsonb) RETURNS jsonb`
   - El `p_payload` contiene 9 sub-objetos: `sociedad_pj`, `entity`, `capital_profile`, `share_classes` (array), `socios` (array), `capital_holdings` (array), `governing_bodies` (array), `entity_settings` (array de pares clave/valor), `rule_param_overrides` (array)
   - Returns `jsonb` con `{ entity_id, person_id, body_ids: {...}, share_class_ids: {...}, holding_ids: [...], settings_skipped: [...] }`
   - Errores se propagan vía `RAISE EXCEPTION` con `ERRCODE` específico para que el cliente sepa qué falló (`'P0001'` con `MESSAGE` informativo)
   - Internamente: BEGIN → 9 inserts secuenciales → COMMIT (transacción implícita de la función)

3. **RLS:** la función es SECURITY DEFINER pero **valida `p_tenant_id` contra el tenant del caller autenticado**. La implementación concreta del mapeo `auth.uid() → tenant_id` se resuelve **durante fase B** revisando cómo lo hacen las RPCs existentes (`fn_generar_acta`, `fn_firmar_certificacion`, `fn_cerrar_votaciones_vencidas`) — todas usan el mismo patrón. Si el patrón existente es `current_setting('request.jwt.claims', true)::jsonb->>'tenant_id'`, se reutiliza tal cual. Si no coincide con `p_tenant_id`, `RAISE EXCEPTION 'tenant_mismatch' USING ERRCODE = 'P0001'`.

4. **GRANT:** `EXECUTE ON FUNCTION fn_crear_sociedad_legal_y_capital TO authenticated`.

5. **Test de schema:** `src/test/schema/fn-crear-sociedad-legal-y-capital.test.ts` verifica:
   - La función existe (`pg_proc` probe).
   - Insert válido vuelve `entity_id` no nulo.
   - Insert con `tenant_id` distinto al del usuario → error `tenant_mismatch`.
   - Insert con NIF duplicado dentro del payload → error con mensaje informativo.
   - Insert con capital_desembolsado > escriturado → error.

### 5.2 Adaptador `adapters.ts` (TX2)

Funciones exportadas:

```typescript
interface AdapterContext {
  tenantId: string;
  entityId: string;
  bodyJuntaId: string;
  bodyAdminId: string;
  // bodyConsejoId puede coincidir con bodyAdminId si tipo_organo_admin = CDA,
  // o ser null si la forma de administración no es Consejo.
  bodyConsejoId: string | null;
  // mapa code → id de comisiones creadas (puede estar vacío).
  bodyComisiones: Record<string, string>;
}

interface CargoInputDraft {
  // del draft local — nombres alineados con schema canónico (migración 000019/000024)
  tipo_condicion: TipoCondicion;       // PRESIDENTE | SECRETARIO | CONSEJERO | ADMIN_UNICO | ADMIN_PJ | ...
  bodyKey: 'CDA' | 'JUNTA' | 'COMISION_AUDITORIA' | 'COMISION_NOMBRAMIENTOS' | 'COMISION_RETRIBUCIONES' | 'COMISION_RIESGOS' | null;
  persona: {
    tax_id: string;
    full_name: string;
    person_type: 'PF' | 'PJ';
    // si tipo_condicion='ADMIN_PJ', representante PF obligatorio:
    representante?: {
      tax_id: string;
      full_name: string;
    };
  };
  fecha_inicio: string;                // ISO date (DATE NOT NULL en schema)
  // CHECK válido del schema canónico (000024 line ~fuente_designacion):
  fuente_designacion: 'ACTA_NOMBRAMIENTO' | 'ESCRITURA' | 'DECISION_UNIPERSONAL' | 'BOOTSTRAP';
  // Mapeo semántico desde el wizard:
  //   constitución / escritura fundacional → 'ESCRITURA'
  //   acuerdo posterior de Junta o CdA → 'ACTA_NOMBRAMIENTO'
  //   decisión socio único → 'DECISION_UNIPERSONAL'
  //   setup demo seed → 'BOOTSTRAP'
  metadata?: Record<string, unknown>;
}

export async function persistInitialCargos(
  ctx: AdapterContext,
  cargos: CargoInputDraft[]
): Promise<{
  okCount: number;
  failedCargos: Array<{ cargo: CargoInputDraft; error: string }>;
}>;

interface RepresentacionAdminPJInput {
  // representado = la PJ administradora ya creada o reutilizada
  represented: { tax_id: string; full_name: string; person_type: 'PJ' };
  // representante PF permanente
  representante: { tax_id: string; full_name: string };
  effective_from: string;                 // ISO date — DATE NOT NULL en schema
  fuente: 'ACTA_NOMBRAMIENTO' | 'ESCRITURA' | 'DECISION_UNIPERSONAL' | 'BOOTSTRAP';
}

// Solo se invoca para cargos con tipo_condicion='ADMIN_PJ'. Otros scopes de
// representaciones (JUNTA_PROXY, CONSEJO_DELEGACION) requieren meeting_id y no
// aplican al alta de sociedad.
export async function persistInitialRepresentaciones(
  ctx: AdapterContext,
  reps: RepresentacionAdminPJInput[]
): Promise<{ okCount: number; failedReps: Array<{ rep: RepresentacionAdminPJInput; error: string }> }>;
```

Internamente cada función:
1. Para cada cargo/representación, hace lookup de `persons` por `(tenant_id, tax_id)`. Si existe → reutiliza id. Si no → `INSERT INTO persons` y captura el id.
2. (Solo cargos) `INSERT INTO condiciones_persona` con `tipo_condicion`, `person_id`, `body_id` (`NULL` para `SOCIO/ADMIN_*`; `NOT NULL` para `CONSEJERO/PRESIDENTE/SECRETARIO/VICEPRESIDENTE/CONSEJERO_COORDINADOR`; el CHECK `chk_condicion_body_coherente` lo enforza), `entity_id`, `fecha_inicio` (DATE), `fuente_designacion` (∈ {ACTA_NOMBRAMIENTO, ESCRITURA, DECISION_UNIPERSONAL, BOOTSTRAP}), `representative_person_id` solo si `tipo_condicion='ADMIN_PJ'`. El campo `estado` queda en su DEFAULT 'VIGENTE' del schema (no se setea explícito). El trigger `fn_sync_authority_evidence` (del otro carril) propaga a `authority_evidence` si el cargo es certificante.
3. (Solo representaciones ADMIN_PJ — el único caso aplicable al alta) `INSERT INTO representaciones` con `represented_person_id` (PJ administrador), `representative_person_id` (PF), `scope='ADMIN_PJ_REPRESENTANTE'`, `entity_id`, `effective_from` (DATE NOT NULL — la tabla no tiene columna `estado`; la vigencia se modela con `effective_from`/`effective_to`), `evidence` (JSONB con `{ fuente: 'ESCRITURA' | 'ACTA_NOMBRAMIENTO', referencia: string }`). Los scopes `JUNTA_PROXY` y `CONSEJO_DELEGACION` requieren `meeting_id` por el CHECK `chk_representacion_scope_meeting` y no aplican al alta.

Errores parciales no abortan: se acumulan en `failedCargos`/`failedReps` y se devuelven al caller para UX.

**Punto de cambio futuro:** cuando `feature/personas-cargos-refactor` mergee, el cuerpo de `persistInitialCargos` cambia de `supabase.from('condiciones_persona').insert(...)` a `useCondicionesPersonaMutations().asignarCargo.mutateAsync(...)`. La firma pública NO cambia. Esto es el commit aislado de ~1–2h.

### 5.3 Orquestación `paso 11 → guardar()`

```typescript
async function guardarSociedad() {
  // 1. Validación local final
  const result = validateSociedadOperability(draft);
  if (result.blocking.length > 0) {
    showErrors(result.blocking);
    return;
  }

  // 2. TX1
  //
  // `buildRpcPayload` decide el `entity.onboarding_status` inicial:
  //  - 'INCOMPLETA_DATOS' si result.blockingOperational tiene CT-001/CT-002/S-005/S-006 etc.
  //  - 'INCOMPLETA_CARGOS' (el default del schema) en cualquier otro caso.
  // En NINGÚN caso TX1 envía 'OPERATIVA' — esa promoción es solo
  // post-TX2 confirmado.
  let entityId: string;
  try {
    const tx1 = await supabase.rpc('fn_crear_sociedad_legal_y_capital', {
      p_tenant_id: tenantId,
      p_payload: buildRpcPayload(draft),
    });
    if (tx1.error) throw tx1.error;
    entityId = tx1.data.entity_id;
    // los demás ids van en tx1.data: bodyJuntaId, bodyAdminId, etc.
  } catch (e) {
    toast.error('No se pudo crear la sociedad: ' + extractMessage(e));
    return;
  }

  // 3. TX2 — adaptador personas/cargos
  const ctx = buildAdapterContext(tx1.data);
  const cargosResult = await persistInitialCargos(ctx, draft.cargos);
  // Solo cargos con tipo_condicion='ADMIN_PJ' generan filas en `representaciones`
  // con scope='ADMIN_PJ_REPRESENTANTE'. PJ accionistas con representante de junta
  // se modelizan vía JUNTA_PROXY por junta concreta, no en alta.
  const repsInput = draft.cargos
    .filter(c => c.tipo_condicion === 'ADMIN_PJ' && c.persona.representante)
    .map(c => ({
      represented: c.persona,
      representante: c.persona.representante!,
      effective_from: c.fecha_inicio,
      fuente: c.fuente_designacion,
    }));
  const repsResult = await persistInitialRepresentaciones(ctx, repsInput);

  const totalFailed = cargosResult.failedCargos.length + repsResult.failedReps.length;

  // El default del schema es pesimista (INCOMPLETA_CARGOS). Solo PROMOVEMOS
  // a OPERATIVA cuando TX2 confirma éxito completo Y no había issues
  // blockingOperational en validación local (esos generan INCOMPLETA_DATOS
  // desde TX1 y no se promueven con cargos al día — la sociedad sigue
  // teniendo cap table < 100% o domicilio incompleto). Si TX2 falla parcial
  // o total (incluido throw del adapter o crash entre líneas), la sociedad
  // queda en su default INCOMPLETA_CARGOS o INCOMPLETA_DATOS según TX1 —
  // correcto sin necesidad de escribir nada adicional.
  const hasOperationalIssues = result.blockingOperational.length > 0;
  if (totalFailed === 0 && !hasOperationalIssues) {
    const { error: promoteErr } = await supabase
      .from('entities')
      .update({ onboarding_status: 'OPERATIVA' })
      .eq('id', entityId);
    if (promoteErr) {
      // El UPDATE falló pero TX2 sí persistió cargos. Sociedad queda en
      // INCOMPLETA_CARGOS (default); el usuario verá el banner aunque
      // tenga todos los cargos. Mejor que el opuesto: marcar OPERATIVA
      // sin tener cargos.
      console.error('[alta-sociedad] promoción a OPERATIVA falló:', promoteErr);
      toast.warning(
        'Sociedad creada con cargos. No se pudo marcar como operativa automáticamente. Verifica en el detalle.'
      );
    } else {
      toast.success('Sociedad creada y operativa');
    }
  } else {
    // No-op: la sociedad ya está en INCOMPLETA_CARGOS (default). Solo
    // mensaje al usuario.
    toast.warning(
      `Sociedad creada con ${totalFailed} cargos pendientes. Completar en Designar admin / Asignar cargo.`
    );
  }

  navigate(`/secretaria/sociedades/${entityId}`);
}
```

---

## 6. Modelo de datos — referencia

Sin cambios respecto al plan original §6. Resumen de tablas tocadas:

| Tabla | Quién escribe | Cuándo |
|---|---|---|
| `persons` (PJ sociedad) | RPC TX1 | Paso 11 |
| `entities` (con campos legales) | RPC TX1 | Paso 11 |
| `entity_capital_profile` | RPC TX1 | Paso 11 |
| `share_classes` | RPC TX1 | Paso 11 |
| `persons` (socios) | RPC TX1 | Paso 11 |
| `capital_holdings` | RPC TX1 | Paso 11 |
| `governing_bodies` | RPC TX1 | Paso 11 |
| `entity_settings` (filtrado por catálogo) | RPC TX1 | Paso 11 |
| `rule_param_overrides` | RPC TX1 | Paso 11 |
| `persons` (PF cargos + PF reps) | Adaptador TX2 | Paso 11 post-COMMIT |
| `condiciones_persona` | Adaptador TX2 | Paso 11 post-COMMIT |
| `representaciones` (scope `ADMIN_PJ_REPRESENTANTE` solamente) | Adaptador TX2 | Paso 11 post-COMMIT, solo si hay cargos `tipo_condicion='ADMIN_PJ'` |
| `authority_evidence` | Trigger (carril Personas/Cargos) | Auto-propagado |
| `entities.support_docs_metadata` | RPC TX1 | Paso 11 |
| `entities.onboarding_status` | Cliente | Post-TX2 |

---

## 7. Validaciones bloqueantes (recap §11 del plan original)

| Código | Regla | Resultado |
|---|---|---|
| S-001 | Denominación social vacía | Bloquea |
| S-002 | NIF/CIF vacío | Bloquea |
| S-003 | Tipo social no SA/SL/SAU/SLU | Bloquea |
| S-004 | Jurisdicción vacía | Bloquea |
| S-005 | Domicilio incompleto (street/number/CP/city/country) | Bloquea operativo |
| S-006 | CNAE principal vacío | Bloquea operativo |
| C-001 | Capital escriturado ≤ 0 | Bloquea |
| C-002 | Capital desembolsado > escriturado | Bloquea |
| C-003 | Número total de títulos ≤ 0 | Bloquea |
| C-004 | Valor nominal ≤ 0 | Bloquea |
| CL-001 | Sin clases/series | Bloquea |
| CL-002 | Suma títulos por clase ≠ número total títulos | Bloquea |
| CT-001 | Cap table vacío | Bloquea operativo |
| CT-002 | Cap table no suma 100% | Marca `INCOMPLETA_DATOS` o bloquea operativo |
| CT-003 | Títulos asignados por clase > títulos emitidos de esa clase | Bloquea |
| CT-004 | SAU/SLU con más de un socio (excl. autocartera) | Bloquea |
| CT-005 | SA/SL con socio único no marcado | Warning + sugerencia |
| P-001 | PJ **accionista** con voto sin representante declarado | Warning. El representante de junta se modela como `JUNTA_PROXY` por junta concreta (no en alta). En alta solo se registra el PJ socio en `capital_holdings`. |
| O-001 | Sin Junta General / Socio Único | Bloquea |
| O-002 | Sin órgano de administración | Bloquea |
| CA-001 | CDA sin consejeros | Bloquea |
| CA-002 | CDA sin presidente o secretario | Bloquea certificación |
| AU-001 | ADMIN_UNICO sin administrador | Bloquea |
| PJ-001 | Administrador PJ (`tipo_condicion='ADMIN_PJ'`) sin representante permanente PF declarado | Bloquea. Persiste como `condiciones_persona.representative_person_id` + `representaciones` con `scope='ADMIN_PJ_REPRESENTANTE'`. |
| R-001 | Mayoría reforzada < mayoría simple | Bloquea |
| R-002 | Cierre fiscal con formato distinto a `DD-MM` | Bloquea |

`Bloquea` = no permite avanzar al paso 11.
`Bloquea operativo` = permite crear sociedad pero `onboarding_status='INCOMPLETA_DATOS'`.
`Marca INCOMPLETA` = permite crear sociedad pero baja estado.
`Warning` = permite avanzar con aviso visible.

Salida común de cada validator:

```typescript
type ValidationIssue = {
  code: string;
  field: string;
  message: string;
  severity: 'BLOCK' | 'BLOCK_OPERATIONAL' | 'WARN';
};

type ValidationResult = {
  ok: boolean;                        // false si hay blocking
  blocking: ValidationIssue[];        // severity === 'BLOCK'
  blockingOperational: ValidationIssue[]; // severity === 'BLOCK_OPERATIONAL'
  warnings: ValidationIssue[];        // severity === 'WARN'
  derived: Record<string, unknown>;   // valores computados (ej. % cap table, denominador títulos)
};
```

---

## 8. Archivos a crear / modificar

### 8.1 Nuevos

```
supabase/migrations/
  20260514_000067_fn_crear_sociedad_legal_y_capital.sql

src/lib/secretaria/sociedad-onboarding/
  types.ts                # Draft, ValidationIssue, CargoInputDraft, etc.
  defaults.ts             # defaults por tipo social (SA, SL, SAU, SLU)
  validation.ts           # validators puros (S-*, C-*, CL-*, CT-*, P-*, O-*, CA-*, AU-*, PJ-*, R-*)
  builders.ts             # buildRpcPayload, buildInitialBodies, buildInitialCapitalStructure, buildInitialCapTable
  adapters.ts             # persistInitialCargos, persistInitialRepresentaciones
  catalog-loader.ts       # carga entity_settings_catalog para filtrar settings

src/lib/secretaria/sociedad-onboarding/__tests__/
  validation.test.ts
  builders.test.ts
  operability.test.ts
  adapters.test.ts        # mocked supabase, verifica firma y rollback

src/test/schema/
  fn-crear-sociedad-legal-y-capital.test.ts
  entities-legal-fields.test.ts   # columnas nuevas existen + nullable

src/pages/secretaria/sociedad-nueva/
  StepIdentificacionLegal.tsx
  StepDomicilioCnaeRegistro.tsx
  StepPerfilGrupo.tsx
  StepCapital.tsx
  StepClasesSeries.tsx
  StepCapTable.tsx
  StepOrganos.tsx
  StepCargos.tsx
  StepReglas.tsx
  StepDocumentosSoporte.tsx
  StepRevisionCreacion.tsx
  shared/                 # Input, Select, Checkbox, NumberInput, PersonaPicker
```

### 8.2 Modificados

```
src/pages/secretaria/SociedadNuevaStepper.tsx   # orquesta 11 sub-componentes, useReducer Draft
src/hooks/useSociedades.ts                       # SociedadRow extendida con campos legales
src/lib/doc-gen/variable-resolver.ts             # solo si nombres de columna divergen del contrato actual
src/pages/secretaria/SociedadDetalle.tsx         # mostrar campos nuevos en tab Perfil
src/App.tsx                                       # ninguna ruta nueva, mismo /secretaria/sociedades/nueva
```

### 8.3 Bloqueados (no tocar en este sprint)

```
src/hooks/usePersonasCanonical.ts          # zona Personas/Cargos
src/hooks/useCargos.ts                     # zona Personas/Cargos
src/hooks/useAuthorityEvidence.ts          # zona Personas/Cargos
src/hooks/useRepresentacionesCanonical.ts  # zona Personas/Cargos
src/pages/secretaria/PersonaNuevaStepper.tsx
src/pages/secretaria/DesignarAdminStepper.tsx
```

El adaptador `adapters.ts` **consume** estos hooks (lectura) y **escribe directo a Supabase** (writes equivalentes a lo que el otro carril publicará en D3).

---

## 9. UX Garrigues — recordatorio

Todos los componentes nuevos del stepper usan tokens `--g-*` y `--status-*` exclusivamente. **Prohibido**:
- hex inline (`#004438`, etc.)
- clases Tailwind nativas de color (`text-white`, `bg-amber-50`, `bg-green-100`, etc.)
- `var(--g-brand)` (usar `--g-brand-3308`)
- `var(--g-status-*)` (usar `--status-*` sin prefijo)
- `inline style` para propiedades con clase Tailwind equivalente

Patrón obligatorio: `forwardRef`, `aria-label` en iconos, `aria-invalid` + `aria-describedby` en errores, `aria-busy` en loading. Focus visible con double ring `--g-brand-3308`.

---

## 10. Criterios de aceptación

1. `SociedadNuevaStepper` tiene **11 pasos funcionales** navegables.
2. Pasos 1–10 NO escriben en Supabase.
3. Paso 11 ejecuta TX1 (RPC) y TX2 (adaptador) en secuencia.
4. Migración `000067` aplicada en Cloud (manualmente desde el plan, no por `db push`).
5. Sociedad creada con cap table al 100% + CdA con presidente+secretario+consejeros → `onboarding_status='OPERATIVA'`.
6. Sociedad creada sin cap table al 100% → `onboarding_status='INCOMPLETA_DATOS'`, banner UX.
7. Sociedad creada con TX1 ok pero TX2 fallando → `onboarding_status='INCOMPLETA_CARGOS'`, banner UX con CTA "Designar admin / Asignar cargo".
8. SAU/SLU con más de un socio → bloquea avance en paso 6 con mensaje claro.
9. PJ accionista con voto sin representante declarado → **warning visible** en paso 6 (no bloquea avance); P-001 baja a warning porque el `JUNTA_PROXY` se crea por junta concreta, no en alta. Coherente con §7 P-001.
10. Cap table > 100% por clase → bloquea avance en paso 6.
11. Mayoría reforzada < simple → bloquea avance en paso 9.
12. Sociedad creada aparece en `SociedadesList` y `SociedadDetalle` con todos los datos legales tecleados (denominación, NIF, tipo social, jurisdicción, RM, LEI, CNAE, domicilio, propósito, cierre fiscal, web, email corporativo).
13. Sociedad operativa puede iniciar `/secretaria/convocatorias/nueva` y aparecer en selector de entidad.
14. Sociedad operativa puede iniciar `/secretaria/reuniones/nueva` y calcular quórum con cap table real.
15. Sociedad operativa puede emitir certificación si tiene presidente+secretario en `authority_evidence`.
16. NO se duplica persona por NIF/CIF — TX1 usa **lookup-first** dentro de la RPC (`SELECT id FROM persons WHERE tenant_id = … AND tax_id = …`). Robusto en ausencia de `UNIQUE(tenant_id, tax_id)` (migración `000063` del otro carril aún no en `main`); cuando mergee, sigue siendo correcto.
17. NO se escribe en `mandates` (tabla legacy).
18. `bun run typecheck`, `bun run test`, `bun run lint`, `bun run build` pasan sin regresiones (baseline: 582 pass / 66 skipped, lint 23 warnings conocidos). Tests nuevos del sprint añaden cobertura; no se permiten nuevos errores ni warnings inéditos.
19. `bun run db:check-target` apunta al proyecto correcto antes de aplicar migración.

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Schema de `entities` choca con migración paralela del otro carril | Media | Alto | Coordinar nombres de columna con `variable-resolver.ts`; no renombrar existentes |
| RPC TX1 falla por payload mal formado | Media | Alto | Validators puros + tests en `validation.test.ts` antes de invocar RPC |
| Adaptador TX2 con NIFs duplicados rompe UNIQUE | Media | Medio | Lookup-then-create con `ON CONFLICT DO NOTHING`; tests `adapters.test.ts` |
| Refactor del adaptador cuando mergea Personas/Cargos rompe build | Baja | Medio | Adaptador encapsulado en una sola capa; commit aislado documentado |
| Cap table denominador incorrecto en quórum | Media | Alto | Tests de integración con `/secretaria/reuniones/:id` calculando quórum real |
| Estado `INCOMPLETA_CARGOS` confunde al usuario | Media | Bajo | Banner UX explícito con CTA directo a remediación |
| Migración `000067` colisiona con número del otro carril | Baja | Bajo | Verificar inventario migraciones antes de commit; renumerar a `000068` si necesario |
| `entity_settings_catalog` no tiene claves esperadas | Media | Bajo | `catalog-loader.ts` filtra; settings desconocidos van a `settings_skipped` en respuesta RPC |
| RLS bloquea RPC SECURITY DEFINER | Baja | Alto | Test de schema verifica `tenant_mismatch` con tenant ajeno |

---

## 12. Plan de ejecución (referencia, detalle en plan de implementación)

| Fase | Bloque | Duración estimada |
|---|---|---|
| B | Migración `000067` + tests schema | 0.5 día |
| C | Dominio puro (types, defaults, validators, builders + tests) | 1 día |
| D | UI 11 pasos (10 sub-componentes + stepper orquestador) | 1.5 días |
| E | RPC + TX1 integration en paso 11 | 0.5 día |
| F | Adaptador TX2 + onboarding_status derivado | 0.5 día |
| QA | typecheck + tests + e2e + manual con dev server | 0.5 día |
| **Total** | | **~4.5 días** |

---

## 13. Open questions remaining

Ninguna bloqueante. Todas las del plan original §15 resueltas en §2.5.

Pendientes de verificación operativa **durante implementación** (no bloquean diseño):
- Inventario exacto de `entity_settings_catalog` (fase B, primer paso).
- Existencia y comportamiento del trigger `fn_sync_authority_evidence` en Cloud para roles certificantes (verificar antes de fase F).
- Comportamiento de `parte_votante_current` como tabla materializada vs vista — confirmar que el alta no necesita REFRESH manual (fase F).

---

## 14. Ejecución

Branch: `claude/strange-albattani-3df05c`.
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/.claude/worktrees/strange-albattani-3df05c`.
PR target: `main`.
Modo: autónomo con ruflo orquestado, revisiones adversariales por fase (wave1 schema, wave2 dominio, wave3 UI, wave4 integration).
