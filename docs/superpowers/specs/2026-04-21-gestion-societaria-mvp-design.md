# Gestión Societaria MVP — diseño

**Estado:** draft cerrado
**Fecha:** 2026-04-21
**Scope:** Núcleo + Órganos + Reglas + Integración Secretaría + Autoridad/Certificación (D+A)
**Absorbe:** `2026-04-21-certificacion-autoridad-design.md` (se reescribe aquí sobre nombres Cloud reales)

---

## 1. Propósito

Resolver el hueco estructural del módulo societario: hoy la UI solo lista entidades y órganos en read-only; no permite crear/editar sociedades, personas, socios ni administradores. El modelo canónico Phase 0+1 existe en BD con backfill pero cero hooks/pantallas lo consumen. Sin este módulo, ningún proceso de Secretaría (convocatoria, quórum, mayoría, certificación) puede operar sobre datos reales — opera sobre seeds hardcodeadas.

El MVP convierte el modelo canónico en la fuente de verdad operativa, migra los consumidores legacy, y cierra el circuito con Secretaría y el motor LSC.

---

## 2. Alcance (scope D + A)

### Dentro

1. **Ficha de sociedad** — CRUD de entidad con tipo social (SA/SL/SLU/SAU), capital, domicilio, datos registrales, parent/childs.
2. **Libro de personas** — CRUD de `persons` físicas (PF) y jurídicas (PJ); representante obligatorio para PJ con voto o cargo.
3. **Libro de socios** — CRUD de `capital_holdings` con `share_class_id`, porcentajes, autocartera, detección automática de socio único.
4. **Libro de administradores** — CRUD de `condiciones_persona` para cargos (CONSEJERO, ADMIN_UNICO, ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO, SECRETARIO, VICESECRETARIO, PRESIDENTE, VICEPRESIDENTE, COMISIONADO).
5. **Órganos operativos** — CRUD de `governing_bodies` + composición (reemplaza el botón huérfano "Añadir miembro" de `/organos/:id`).
6. **Capital y clases** — CRUD de `entity_capital_profile` y `share_classes` con historial.
7. **Representaciones** — CRUD de `representaciones` (PJ_PERMANENTE, JUNTA_PROXY, CONSEJO_DELEGACION).
8. **Reglas aplicables** — tab en ficha de sociedad que muestra, por materia, la regla efectiva resuelta por el motor LSC (LEY→ESTATUTOS→PACTO→REGLAMENTO).
9. **Integración Secretaría** — convocatorias, reuniones, quórum, mayorías, firmantes y certificación leen el modelo canónico; `mandates` pasa a VIEW derivada.
10. **Autoridad y certificación** — `capability_matrix` (3 acciones), `authority_evidence` (proyección de `condiciones_persona` con flags RRM), extensiones a `minutes` y `certifications`, 4 RPCs con hash chain WORM, pipeline QTSP (EAD Trust) integrado.

### Fuera

- Constitución notarial completa (el "crear sociedad" es una ficha + seed de órganos, no un flujo de escritura).
- Disolución/liquidación.
- Operaciones estructurales (fusiones, escisiones, cesión global).
- Clases con derechos económicos heterogéneos (dividendos preferentes, rescatables).
- Accionariado anotado en IBERCLEAR.
- Migración full a multi-jurisdicción (el MVP se queda en ES con rule packs LSC; BR/MX/PT son Sprint F posterior).

---

## 3. Principios de diseño

1. **Fuente de verdad única: el modelo canónico.** `mandates` queda como VIEW derivada read-only en F6. No hay dual-write aplicativo.
2. **Ubicación: `/secretaria/sociedades/*` y `/secretaria/personas/*`.** Sub-módulos dentro de Secretaría con tokens `--g-*`. `/entidades` y `/organos` del shell rojo se mantienen como vista-mapa agregada read-only.
3. **Separación de acciones (SoA), no de roles.** Un consejero puede ser secretario, un secretario puede firmar y votar en juntas distintas. Lo que se controla es qué acción hace un rol sobre qué acto — vía `capability_matrix`, no vía SoD role-pair.
4. **Inmutabilidad WORM.** `censo_snapshot` ya es inmutable (trigger existente). La certificación produce hash chain `gate_hash = SHA-256(snapshot_hash ‖ resultado_hash)` y `hash_certificacion = SHA-256(gate_hash ‖ contenido ‖ tsq_token)`.
5. **UX Garrigues estricta.** Cero Tailwind color classes. Cero hex en className. Tokens `--g-*` y `--status-*` siempre. Skill de referencia: `/Users/moisesmenendez/Dropbox/Codigo/agent/skills/desarrollar-ux-garrigues/SKILL.md`.
6. **YAGNI.** Clases de acciones: ordinarias + sin voto + privilegiadas nominadas. Otros tipos se añaden cuando haya caso de uso real.
7. **Frequent commits.** Una task = un commit; fase = rama de trabajo; merge a main al cerrar cada fase.

---

## 4. Modelo de datos

### 4.1 Tablas existentes que usamos tal cual

- `entities` (con columnas ya añadidas en Phase 0+1: `person_id`, `tipo_organo_admin`, `legal_form`).
- `persons` (con `person_type CHECK IN ('PF','PJ')` y `representative_person_id`).
- `governing_bodies` (sin cambios de schema).
- `entity_capital_profile`, `share_classes`, `condiciones_persona`, `capital_holdings`, `representaciones`, `parte_votante_current`, `censo_snapshot`.
- `evidence_bundles`, `qtsp_signature_requests`, `audit_log`, `secretaria_audit_log`.
- `minutes`, `certifications`, `meetings`, `agreements`.

### 4.2 Tablas nuevas (F1)

#### `capability_matrix`

```sql
CREATE TABLE capability_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,                  -- SECRETARIO, CONSEJERO, ADMIN_TENANT, COMPLIANCE, AUDITOR
  action text NOT NULL CHECK (action IN (
    'SNAPSHOT_CREATION','VOTE_EMISSION','CERTIFICATION'
  )),
  enabled boolean NOT NULL DEFAULT true,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (role, action)
);

-- Seed:
INSERT INTO capability_matrix (role, action, enabled, reason) VALUES
  ('SECRETARIO',   'SNAPSHOT_CREATION', true,  'Titular de la ordenación de la sesión (art. 106 RRM).'),
  ('ADMIN_TENANT', 'SNAPSHOT_CREATION', true,  'Rol administrativo del tenant.'),
  ('CONSEJERO',    'SNAPSHOT_CREATION', false, 'El consejero no congela el censo; lo hace el Secretario.'),
  ('CONSEJERO',    'VOTE_EMISSION',     true,  'Facultad natural del consejero.'),
  ('SECRETARIO',   'VOTE_EMISSION',     true,  'Secretario consejero vota si tiene condición CONSEJERO vigente.'),
  ('ADMIN_TENANT', 'VOTE_EMISSION',     true,  'Para operativa excepcional.'),
  ('SECRETARIO',   'CERTIFICATION',     true,  'Facultad certificante (art. 109 RRM).'),
  ('ADMIN_TENANT', 'CERTIFICATION',     true,  'Rol administrativo excepcional.'),
  ('CONSEJERO',    'CERTIFICATION',     false, 'No certifica salvo que ostente cargo de Secretario.'),
  ('COMPLIANCE',   'SNAPSHOT_CREATION', false, NULL),
  ('COMPLIANCE',   'VOTE_EMISSION',     false, NULL),
  ('COMPLIANCE',   'CERTIFICATION',     false, NULL),
  ('AUDITOR',      'SNAPSHOT_CREATION', false, NULL),
  ('AUDITOR',      'VOTE_EMISSION',     false, NULL),
  ('AUDITOR',      'CERTIFICATION',     false, NULL);
```

#### `authority_evidence`

Proyección computable de `condiciones_persona` filtrada a cargos con facultad certificante + flags de inscripción RM.

```sql
CREATE TABLE authority_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id),
  body_id uuid REFERENCES governing_bodies(id),   -- NULL si admin único
  person_id uuid NOT NULL REFERENCES persons(id),
  role text NOT NULL CHECK (role IN (
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
    'CONSEJERO','CONSEJERO_DELEGADO','COMISIONADO'
  )),
  valido_desde date NOT NULL,
  valido_hasta date,                               -- NULL = vigente
  inscripcion_rm_referencia text,                  -- "Tomo X, Folio Y, Hoja Z"
  inscripcion_rm_fecha date,
  fuente text NOT NULL CHECK (fuente IN (
    'JGA','CDA','NOTARIAL','INSCRIPCION_RM','OTRO'
  )),
  documento_ref text,                              -- URI del documento origen
  condicion_persona_id uuid REFERENCES condiciones_persona(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ux_authority_evidence_vigente
  ON authority_evidence (entity_id, COALESCE(body_id,'00000000-0000-0000-0000-000000000000'::uuid), person_id, role)
  WHERE valido_hasta IS NULL;

CREATE INDEX ix_authority_evidence_person ON authority_evidence(person_id) WHERE valido_hasta IS NULL;
CREATE INDEX ix_authority_evidence_entity ON authority_evidence(entity_id) WHERE valido_hasta IS NULL;
```

Helper SQL:

```sql
CREATE OR REPLACE FUNCTION fn_cargo_vigente(
  p_person_id uuid,
  p_entity_id uuid,
  p_body_id uuid,
  p_role text,
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM authority_evidence
    WHERE person_id = p_person_id
      AND entity_id = p_entity_id
      AND COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(p_body_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND role = p_role
      AND valido_desde <= p_fecha
      AND (valido_hasta IS NULL OR valido_hasta >= p_fecha)
  );
$$;
```

Trigger de sincronización desde `condiciones_persona`:

```sql
CREATE OR REPLACE FUNCTION fn_sync_authority_evidence()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_authority_roles text[] := ARRAY[
    'ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO',
    'PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO',
    'CONSEJERO','CONSEJERO_DELEGADO','COMISIONADO'
  ];
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.role = ANY(v_authority_roles) THEN
    INSERT INTO authority_evidence (
      tenant_id, entity_id, body_id, person_id, role,
      valido_desde, valido_hasta, fuente, condicion_persona_id
    )
    VALUES (
      NEW.tenant_id, NEW.entity_id, NEW.body_id, NEW.person_id, NEW.role,
      NEW.valido_desde, NEW.valido_hasta,
      COALESCE(NEW.fuente_designacion, 'OTRO'),
      NEW.id
    )
    ON CONFLICT (condicion_persona_id) DO UPDATE SET
      valido_desde = EXCLUDED.valido_desde,
      valido_hasta = EXCLUDED.valido_hasta,
      updated_at = now();
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM authority_evidence WHERE condicion_persona_id = OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
```

### 4.3 Extensiones a tablas existentes (F1)

#### `minutes`

```sql
ALTER TABLE minutes
  ADD COLUMN snapshot_id uuid REFERENCES censo_snapshot(id),
  ADD COLUMN content_hash text,                          -- SHA-256 del content
  ADD COLUMN rules_applied jsonb,                        -- snapshot del motor LSC al aprobar
  ADD COLUMN body_id uuid REFERENCES governing_bodies(id),
  ADD COLUMN entity_id uuid REFERENCES entities(id);
```

#### `certifications`

```sql
ALTER TABLE certifications
  ADD COLUMN tipo_certificacion text CHECK (tipo_certificacion IN (
    'ACUERDOS','NOMBRAMIENTO','CESE','APODERAMIENTO','OTROS'
  )),
  ADD COLUMN certificante_role text,                     -- SECRETARIO, ADMIN_UNICO, etc.
  ADD COLUMN visto_bueno_persona_id uuid REFERENCES persons(id),
  ADD COLUMN visto_bueno_fecha timestamptz,
  ADD COLUMN tsq_token text,                             -- timestamp cualificado QTSP
  ADD COLUMN gate_hash text,                             -- SHA-256(snapshot_hash || resultado_hash)
  ADD COLUMN hash_certificacion text,                    -- SHA-256(gate_hash || content || tsq_token)
  ADD COLUMN authority_evidence_id uuid REFERENCES authority_evidence(id);
```

No creamos `certificacion_firmas`: reutilizamos `qtsp_signature_requests` (ya vinculada con `evidence_id` en certifications).
No creamos `worm_ledger` nueva: los hash chains encajan en `evidence_bundles` (SHA-512 existente) + `audit_log` + trigger append-only de `censo_snapshot`.

### 4.4 Extensión a `condiciones_persona`

```sql
ALTER TABLE condiciones_persona
  ADD COLUMN IF NOT EXISTS fuente_designacion text
    CHECK (fuente_designacion IN ('JGA','CDA','NOTARIAL','INSCRIPCION_RM','OTRO')),
  ADD COLUMN IF NOT EXISTS inscripcion_rm_referencia text,
  ADD COLUMN IF NOT EXISTS inscripcion_rm_fecha date;
```

### 4.5 Vista legacy

```sql
-- F6: cuando los consumidores legacy estén migrados, mandates pasa a VIEW derivada.
-- Mientras tanto, mandates se mantiene intacto; el backfill Phase 0+1 ya lo mantiene sincronizado con condiciones_persona (copia al insertar).
-- En F6 se convertirá en VIEW con columnas calculadas desde condiciones_persona + capital_holdings.
```

### 4.6 RLS

Todas las tablas nuevas reciben el patrón estándar del proyecto:

```sql
ALTER TABLE capability_matrix ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_roles" ON capability_matrix FOR SELECT USING (true);  -- global

ALTER TABLE authority_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read"  ON authority_evidence FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY "tenant_write" ON authority_evidence FOR ALL    USING (tenant_id = current_tenant_id());
```

---

## 5. Rutas y pantallas

Todas bajo `/secretaria/*`, layout Garrigues existente.

```
/secretaria/sociedades                             SociedadesList
/secretaria/sociedades/nueva                       SociedadNuevaStepper       (4 pasos)
/secretaria/sociedades/:id                         SociedadDetalle            (8 tabs)
/secretaria/sociedades/:id/editar                  SociedadEditModal
/secretaria/sociedades/:id/socios                  LibroSocios
/secretaria/sociedades/:id/socios/añadir          AñadirSocioStepper         (3 pasos)
/secretaria/sociedades/:id/socios/:holdingId       HoldingDetalle
/secretaria/sociedades/:id/socios/transmitir       TransmisionStepper         (4 pasos)
/secretaria/sociedades/:id/administradores         LibroAdministradores
/secretaria/sociedades/:id/administradores/designar DesignarAdminStepper      (3 pasos)
/secretaria/sociedades/:id/administradores/:cpId   AdminDetalle
/secretaria/sociedades/:id/organos                 OrganosSociedad            (composición + CRUD miembros)
/secretaria/sociedades/:id/capital                 CapitalHistorial
/secretaria/sociedades/:id/reglas                  ReglasAplicables
/secretaria/sociedades/:id/pactos                  PactosSociedad

/secretaria/personas                               PersonasList
/secretaria/personas/nueva                         PersonaNuevaModal
/secretaria/personas/:id                           PersonaDetalle             (4 tabs)
/secretaria/personas/:id/editar                    PersonaEditModal
```

Tabs de `SociedadDetalle`:

1. **Resumen** — tipo social, capital vigente, domicilio, inscripción RM, contadores (socios, administradores, órganos).
2. **Socios** — libro con % capital, % votos, clase, vigencia; acción "Añadir" y "Transmitir".
3. **Administradores** — libro con cargo, vigencia, inscripción RM; acción "Designar" y "Cesar".
4. **Órganos** — CdA, Comisión Ejecutiva, Comisiones Delegadas, JGA; composición por órgano.
5. **Capital** — `entity_capital_profile` vigente + historial; clases de acciones; aumentos/reducciones.
6. **Reglas aplicables** — motor LSC resuelto por materia (tabla).
7. **Pactos** — `pactos_parasociales` vigentes y su efecto en reglas.
8. **Autoridad** — `authority_evidence` vigente (quién puede certificar qué).

---

## 6. Hooks y mutaciones

Crear en `src/hooks/`:

- `useSociedades` — list + detail + create + update + delete
- `usePersonas` — list + detail + create + update + delete (PF y PJ con representante)
- `useSocios(entityId)` — libro de `capital_holdings` + mutations
- `useAdministradores(entityId)` — libro de `condiciones_persona` rol=administrador + mutations
- `useOrganos(entityId)` — `governing_bodies` + mutations
- `useComposicionOrgano(bodyId)` — miembros vigentes + mutations
- `useEntityCapitalProfile(entityId)` — capital vigente + historial + mutations
- `useShareClasses(entityId)` — clases + mutations
- `useRepresentaciones(entityId)` — representaciones + mutations
- `useReglasAplicables(entityId)` — resuelve jerarquía LSC por materia
- `useAuthorityEvidence(entityId)` — cargos vigentes con facultad certificante
- `useCapabilityMatrix()` — matriz global (cached)
- `useCensoSnapshot(bodyId)` — último snapshot + helper `crearSnapshot`
- `useTransmision()` — aplica transmisión (delta holdings atómicamente)
- `useDesignarAdmin()` — aplica designación atómica (condiciones_persona + trigger authority_evidence)

Todas siguen el patrón `DEMO_TENANT` de CLAUDE.md, con PostgREST + joins client-side (sin `execute_sql` RPC).

---

## 7. Flujos de usuario (MVP)

### 7.1 Crear sociedad nueva

Stepper de 4 pasos:
1. Datos generales: denominación, tipo social, domicilio, CIF/NIF, fecha constitución.
2. Capital: capital social, nominal, clases de acciones (wizard de 1+ clases).
3. Órganos iniciales: estructura administrativa (ADMIN_UNICO | ADMINS_SOLIDARIOS | ADMINS_MANCOMUNADOS | CDA). Si CDA, nº consejeros mínimo/máximo estatutarios.
4. Confirmación: muestra resumen + crea la entity + seed de `governing_bodies` iniciales.

Inserta en `entities` + `persons` (PJ de la propia sociedad, con `entities.person_id`) + `entity_capital_profile` + `share_classes` + `governing_bodies` de seed.

### 7.2 Añadir socio

Stepper de 3 pasos:
1. Persona: seleccionar existente o crear nueva (PF/PJ con representante).
2. Participación: clase, nº títulos, nominal, % derivado.
3. Fuente: documento origen (escritura constitutiva, transmisión, ampliación…).

Inserta `capital_holdings` + recalcula `parte_votante_current` (RPC `fn_refresh`).

### 7.3 Transmitir

Stepper de 4 pasos:
1. Origen: socio y clase/cantidad a transmitir.
2. Destino: persona (existente o nueva), misma clase.
3. Documento: escritura, privado, sucesión, sentencia…
4. Confirmación: aplica delta atómico (close holding origen, open holding destino) + `parte_votante_current` refresh.

### 7.4 Designar administrador

Stepper de 3 pasos:
1. Persona: PF o PJ (si PJ, representante persona física obligatorio).
2. Cargo: rol + órgano (si aplica) + fecha inicio + vigencia (indefinida / fecha fin).
3. Origen: fuente (JGA / CDA / NOTARIAL) + referencia registral si ya inscrita.

Inserta `condiciones_persona` → trigger `fn_sync_authority_evidence` → crea `authority_evidence`.

### 7.5 Cesar administrador

Modal simple: seleccionar cargo vigente, fecha cese, motivo, documento.
Update `condiciones_persona.valido_hasta` → trigger sincroniza `authority_evidence.valido_hasta`.

### 7.6 Vista reglas aplicables

Read-only. Lee motor LSC vía `useReglasAplicables(entityId)`. Para cada materia (APROBACION_CUENTAS, MOD_ESTATUTOS, NOMBRAMIENTO, CESE, DISOLUCION, AUMENTO_CAPITAL, REDUCCION_CAPITAL, RETRIBUCION, DIVIDENDOS):

| Materia | Órgano competente | Quórum 1ª | Quórum 2ª | Mayoría | Adopción | Inscribible | Instrumento |

Resolución jerárquica LEY → ESTATUTOS → PACTO → REGLAMENTO según `jerarquia-normativa.ts`.

---

## 8. Integración con el motor LSC

Sin cambios al motor. Los hooks nuevos leen `rule_packs`/`rule_pack_versions`/`rule_param_overrides` vía `useRulePackForMateria` existente. La novedad es que ahora la **ficha de sociedad** expone la resolución jerárquica materia por materia (tab "Reglas aplicables"), y los flujos de Secretaría leen **datos reales** en vez de seeds:

- `useConvocatorias` — `convocados` del body = `condiciones_persona` vigentes del body (rol ≠ socio).
- `useReunionSecretaria` — quórum/mayoría leen `censo_snapshot` cuando existe, o `parte_votante_current` si la sesión aún está abierta.
- `useBoardPackData` — miembros del CdA + comisiones = `condiciones_persona` vigentes.
- `useAgreementCompliance` — firmantes = `authority_evidence` vigente.

---

## 9. Autoridad y certificación (RPCs + hash chain)

### 9.1 RPC `fn_generar_acta`

```sql
fn_generar_acta(
  p_meeting_id uuid,
  p_content text,
  p_snapshot_id uuid
) RETURNS uuid  -- minute_id
```

Gate PRE: verifica que `p_snapshot_id` corresponde a `p_meeting_id` y que el caller tiene rol con `capability_matrix(role, 'SNAPSHOT_CREATION') = true`.
Inserta en `minutes` con `content_hash = SHA-256(content)`, `rules_applied = JSONB del motor en ese momento`, `snapshot_id = p_snapshot_id`.

### 9.2 RPC `fn_generar_certificacion`

```sql
fn_generar_certificacion(
  p_minute_id uuid,
  p_tipo text,
  p_agreements_certified text[],
  p_certificante_role text,
  p_visto_bueno_persona_id uuid
) RETURNS uuid  -- certification_id
```

Gate PRE: `capability_matrix(caller_role, 'CERTIFICATION') = true`; `authority_evidence` vigente del certificante con ese role; si la sociedad es SA o la materia requiere Vº Bº PRESIDENTE, `visto_bueno_persona_id` debe ser PRESIDENTE vigente (salvo ADMIN_UNICO, que certifica sin Vº Bº).

Calcula `gate_hash = SHA-256(snapshot_hash ‖ resultado_hash)`. Inserta certification con `gate_hash`, `certificante_role`, `visto_bueno_persona_id`, `authority_evidence_id`.

### 9.3 RPC `fn_firmar_certificacion`

```sql
fn_firmar_certificacion(
  p_certification_id uuid,
  p_qtsp_token text,        -- respuesta de EAD Trust QES
  p_tsq_token text          -- timestamp cualificado
) RETURNS void
```

Gate POST: `signature_status` → `SIGNED`; actualiza `hash_certificacion = SHA-256(gate_hash ‖ content ‖ tsq_token)`; crea `evidence_bundle` SHA-512 del ASiC-E; enlaza `certifications.evidence_id`.

### 9.4 RPC `fn_emitir_certificacion`

```sql
fn_emitir_certificacion(
  p_certification_id uuid
) RETURNS text  -- URI de descarga
```

Verifica signature_status = 'SIGNED' y devuelve URI del evidence_bundle. Registra evento en `audit_log`.

### 9.5 Pipeline completo en UI

1. Usuario cierra reunión → botón "Congelar censo" → `fn_crear_censo_snapshot` (existente) → devuelve `snapshot_id`.
2. Usuario genera acta → `fn_generar_acta(meeting_id, content, snapshot_id)` → minute_id.
3. Usuario solicita certificación → `fn_generar_certificacion(minute_id, tipo, agreements[], certificante_role, vb_persona_id)` → certification_id.
4. Pipeline QTSP existente (`useQTSPSign`) firma el certification content → `fn_firmar_certificacion(cert_id, qtsp_token, tsq_token)`.
5. Usuario descarga → `fn_emitir_certificacion(cert_id)` → URI.

---

## 10. Migración de consumidores legacy (F6)

Hooks a migrar:

- `src/hooks/useBodies.ts::useBodyMandates` → lee `condiciones_persona` en vez de `mandates`.
- `src/hooks/usePersonasExtended.ts` → `usePersonaDetallada` que une `persons` + `representaciones` + `condiciones_persona` + `capital_holdings`.
- `src/hooks/useBoardPackData.ts` → queries a `condiciones_persona` con filtros vigencia.
- `src/hooks/useReunionSecretaria.ts` → si hay snapshot, leer de `censo_snapshot`; si no, `parte_votante_current`.
- `src/hooks/useAgreementCompliance.ts` → firmantes de `authority_evidence`.

Componentes de UI que cambian:

- `src/pages/OrganoDetalle.tsx` tab "Composición" → lee `condiciones_persona`; botón "Añadir miembro" abre `DesignarAdminStepper`.
- `src/pages/EntidadDetalle.tsx` → sin cambios de datos; añadir un CTA "Abrir en Secretaría" que navega a `/secretaria/sociedades/:id`.

Al cerrar F6, `mandates` pasa a VIEW:

```sql
CREATE OR REPLACE VIEW mandates AS
SELECT
  cp.id,
  cp.tenant_id,
  cp.entity_id,
  cp.body_id,
  cp.person_id,
  cp.role,
  cp.valido_desde  AS start_date,
  cp.valido_hasta  AS end_date,
  CASE WHEN cp.valido_hasta IS NULL THEN 'Activo' ELSE 'Cesado' END AS status,
  cp.created_at
FROM condiciones_persona cp;
```

---

## 11. Seguridad y RBAC

- Patrón existente `DEMO_TENANT` + RLS tenant scoping.
- Los hooks nuevos no bypass-ean RLS.
- El frontend respeta `capability_matrix` antes de ofrecer botones: si `CERTIFICATION` no habilitada para el rol del user, el botón "Emitir certificación" no se renderiza.
- El backend (RPCs) valida idéntico en gate PRE.
- Auditoría: cada mutación relevante graba en `secretaria_audit_log` con `before/after/actor/timestamp`.

---

## 12. Testing

### 12.1 Unit tests (Vitest)

Cada hook nuevo: 2-4 tests (happy path + edge cases). Target: +50 tests.

### 12.2 Schema tests (PostgREST)

- `authority_evidence` sync con `condiciones_persona` (insert/update/delete propagan).
- `capability_matrix` seed correcta (15 filas).
- Extensiones a `minutes` y `certifications` funcionan (insert/select).
- `fn_cargo_vigente` devuelve true/false correcto.

### 12.3 Integración Secretaría

- Convocatoria a CdA usa convocados reales.
- Board Pack lee `condiciones_persona` vigentes.
- Certificación rechaza si `authority_evidence` no existe para el role del certificante.
- Vº Bº PRESIDENTE obligatorio para certificación de SA.
- ADMIN_UNICO certifica sin Vº Bº.

### 12.4 E2E smoke

- Crear sociedad → añadir socio → designar consejero → convocar reunión → celebrar → generar acta → certificar → firmar QES → emitir.

### 12.5 Targets de salud

- `npx vitest run` — todos los tests verdes
- `npx tsc --noEmit` — 0 errores
- `npx vite build --outDir /tmp/tgms-dist` — build limpio
- `npx playwright test` — smokes verdes (si aplica)

---

## 13. Rollout por fases

**F1 — Modelo de datos** (1 migración, ~1 día)
- Crea `capability_matrix` + seed.
- Crea `authority_evidence` + índices + trigger sync.
- Extiende `condiciones_persona`, `minutes`, `certifications`.
- RLS en nuevas tablas.
- Schema tests.

**F2 — Hooks canónicos base** (~1 día)
- `useSociedades`, `usePersonas`, `useEntityCapitalProfile`, `useShareClasses`.
- Unit tests por hook.

**F3 — Hooks de libros** (~1 día)
- `useSocios`, `useAdministradores`, `useComposicionOrgano`, `useRepresentaciones`, `useAuthorityEvidence`.

**F4 — Páginas CRUD de sociedades + personas** (~2 días)
- `SociedadesList`, `SociedadDetalle` (tabs 1-5), `SociedadNuevaStepper`.
- `PersonasList`, `PersonaDetalle`, `PersonaNuevaModal`.

**F5 — Libros (socios + admin) + stepper** (~2 días)
- `LibroSocios` + `AñadirSocioStepper` + `TransmisionStepper`.
- `LibroAdministradores` + `DesignarAdminStepper`.

**F6 — Migración legacy** (~1 día)
- Migra `useBodies`, `usePersonasExtended`, `useBoardPackData`, `useReunionSecretaria`, `useAgreementCompliance`.
- `mandates` → VIEW.
- OrganoDetalle.tsx tab "Composición" edit inline.

**F7 — Reglas aplicables + tab "Reglas"** (~1 día)
- `useReglasAplicables`.
- `ReglasAplicables.tsx`.

**F8 — RPCs + hash chain** (~1 día)
- `fn_generar_acta`, `fn_generar_certificacion`, `fn_firmar_certificacion`, `fn_emitir_certificacion`.
- Tests de gates PRE/POST.

**F9 — UI certificación + integración QTSP** (~1 día)
- Botones en ficha de acta/certificación usando `capability_matrix`.
- Pipeline `useQTSPSign` → `fn_firmar_certificacion`.

**F10 — Integración Secretaría + seeds demo + pulido** (~1 día)
- Actualiza seeds demo ARGA para consistencia con el nuevo modelo.
- E2E smoke pasa.
- Commit + push.

Estimación total: ~12 días de trabajo humano. En automode con subagentes paralelos y bien especificados: cuestión de ejecución.

---

## 14. Decisiones cerradas

- **Persona jurídica socio/admin** → `persons.person_type='PJ'`. Representante PF obligatorio si es CONSEJERO o vota en JGA.
- **Clases de acciones MVP** → ordinarias, sin voto, privilegiadas nominadas (share_class.privilege_type).
- **Tipos sociales MVP** → SA, SL, SLU, SAU. Cooperativa fuera.
- **Órganos MVP** → CdA, JGA, Comisión Ejecutiva, 4 comisiones delegadas (Auditoría, Nombramientos, Retribuciones, Riesgos). Otros se añaden con seed.
- **`mandates`** → se mantiene hasta F6, ahí pasa a VIEW derivada.
- **SoD** → `sod_toxic_pairs` existente queda con los 4 pares legítimos (auditoría/supervisión). No se añaden pares por roles. La separación real es `capability_matrix`.
- **WORM** → reutilizamos `evidence_bundles` (SHA-512) y `audit_log` + triggers existentes. Sin tabla nueva.
- **QTSP** → EAD Trust Digital Trust API. Un proveedor, no se abstrae.
- **Storage del ASiC-E** → Supabase Storage (bucket `certifications`), URI referenciada en `evidence_bundles.storage_uri`.

---

## 15. Definition of Done

1. Migraciones aplicadas en Cloud vía MCP `apply_migration`.
2. `src/integrations/supabase/client.ts` regenerado con nuevos types.
3. Tests verdes: `vitest` + `tsc --noEmit` + `vite build`.
4. Consumidores legacy migrados; `mandates` es VIEW.
5. Seed demo ARGA actualizado y coherente; script `seed-demo-arga-canonico.ts` adaptado.
6. Flujo E2E: crear sociedad → añadir socio → designar consejero → convocar → celebrar → generar acta → certificar → firmar QES → descargar ASiC-E.
7. `CLAUDE.md` actualizado reflejando el estado F1-F10.
8. Commit final `feat(societario): MVP gestión societaria completo — sociedades, personas, libros, autoridad, certificación` + push.
9. Spec de certificación/autoridad del 2026-04-21 marcado como `[ABSORBIDO]` al inicio del archivo.
10. Sin violaciones de tokens Garrigues (skill UX enforcement).
