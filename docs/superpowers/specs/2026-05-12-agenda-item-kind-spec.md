# Spec técnica — `agenda_item.kind` v1.3

**Fecha:** 2026-05-12
**Estado:** Diseño cerrado — listo para implementación
**Reemplaza:** PRD `docs/superpowers/plans/2026-05-11-acuerdo360-agenda-item-kind-prd.md` (commit `dd4c4c7`)
**Origen:** 4 rondas adversariales (B1-B3 bloqueantes, D1-D3 defectos triggers/diseño, G-I1 a G-I3 gaps implementación, O1-O4 menores) + 4 matices aceptados (P1, P2, P5, P7). Total 17 hallazgos resueltos.

---

## 0. TL;DR

Añadir `agenda_items.kind ∈ {INFORMATIVO, DELIBERATIVO, DECISORIO}` con default conservador `DELIBERATIVO`, `decision_subtype` opcional para subtipos de decisorio, extensión de `meeting_resolutions.kind_resolution`, audit log WORM, y **6 triggers** de validación cruzada (5 técnicos + 1 modal `adoption_mode`). Solo aplica a `meetings.adoption_mode = 'MEETING'`. Backfill relacional explícito basado en `agreement_id` + `meeting_resolutions.status IN ('ADOPTED','REJECTED')`. RBAC implementado en hook (no RLS). El acta preserva orden secuencial del orden del día con renderizado condicional inline por `kind` — NO reagrupa.

---

## 1. Contexto y motivación

### 1.1 Problema validado

La plantilla ACTA_SESION vigente trata **todos** los puntos del orden del día como decisorios:

```handlebars
{{#each meetings.junta.puntos}}
Punto {{numero}} — {{titulo}}
Texto del acuerdo: "{{texto_acuerdo}}"
Resultado: a favor {{votos_favor}}, en contra {{votos_contra}}...
Trazabilidad: agreements.id = {{agreement_id}}.
{{/each}}
```

Esta asunción es incorrecta para puntos informativos (informe del Presidente sin votación) y deliberativos (debate de seguimiento de riesgos sin decisión formal). El sistema actual fuerza la materialización de `agreement` para cualquier punto, generando acuerdos huérfanos o presionando al secretario a votar puntos no decisorios.

### 1.2 Decisión arquitectónica

**Acuerdo360 es el elemento canónico de gestión societaria.** La reunión es un contenedor procedimental. El acta documenta lo ocurrido. Las plantillas ayudan a formular y documentar, pero no sustituyen al acuerdo. Solo los puntos `DECISORIO` pueden materializar `agreement`.

### 1.3 Alcance v1

- Nueva columna `agenda_items.kind` con tres valores
- Triggers de inmutabilidad progresiva + cross-validation cross-tabla
- Audit log WORM
- Hooks + UI con feature flag
- Plantillas legacy compatibles via degradación graceful

**Fuera de alcance v1**: bump de plantilla ACTA_SESION canónica a v1.3.0 con bloques condicionales `{{#if (eq kind ...)}}` — depende del Comité Legal (Track 1 cierre Garrigues). Sin firma, las plantillas legacy degradan gracefully (campos decisorios vacíos para puntos INFO/DELIB).

---

## 2. Cambio fundacional: clasificación explícita por kind

```
Reunión (contenedor procedimental)
  ├─ Punto INFORMATIVO
  │    ├─ aparece en convocatoria, acta
  │    └─ NO genera resolution decisoria ni Acuerdo360
  │
  ├─ Punto DELIBERATIVO
  │    ├─ aparece en convocatoria, acta
  │    ├─ recoge debate/conclusiones
  │    └─ NO genera Acuerdo360 (salvo reclasificación a DECISORIO)
  │
  └─ Punto DECISORIO (con decision_subtype opcional)
       ├─ propuesta/modelo de acuerdo
       ├─ votación
       ├─ meeting_resolution con kind_resolution=DECISION
       └─ si ADOPTED + válido + proclamable → Acuerdo360
```

**Subtipos de DECISORIO** (cuando aplica):
- `CONSTITUTIVE` — acuerdo nuevo (default si no se especifica)
- `RATIFICATORY` — ratifica acto previo del órgano
- `ELEVATION` — eleva a público algo ya proclamado
- `ACKNOWLEDGEMENT` — toma de razón art. 248 LSC con votación formal

---

## 3. Modelo de datos consolidado

### 3.1 Nuevas columnas

| Tabla | Columna | Tipo | NOT NULL | Default | Constraint |
|---|---|---|---|---|---|
| `agenda_items` | `kind` | text | ✅ | `'DELIBERATIVO'` | CHECK ∈ {INFORMATIVO, DELIBERATIVO, DECISORIO} |
| `agenda_items` | `decision_subtype` | text | ❌ | NULL | CHECK ∈ {CONSTITUTIVE, RATIFICATORY, ELEVATION, ACKNOWLEDGEMENT} OR NULL |
| `meeting_resolutions` | `kind_resolution` | text | ✅ | `'DECISION'` | CHECK ∈ {DECISION, DELIBERATION_OUTCOME, INFORMATION_NOTED} |

### 3.2 Constraints cross-column

- `agenda_items`: `CHECK (kind = 'DECISORIO' OR decision_subtype IS NULL)` — G2 fix
- Coherencia bidireccional `agenda.kind ↔ resolution.kind_resolution` via trigger T4

### 3.3 Audit log table

```
agenda_item_kind_changelog (
  id, tenant_id, agenda_item_id, meeting_id, meeting_status_at_change,
  from_kind, to_kind, motivo (CHECK length>=3), autor, created_at
)
```

WORM via `worm_guard()` existente. Solo INSERT permitido. Tenant-scoped.

### 3.4 Triggers — 6 totales

| # | Trigger | Tabla | Cuándo | Bloquea / Acción |
|---|---|---|---|---|
| T1 | `tr_agenda_kind_immutable_after_voted` | `agenda_items` | BEFORE UPDATE | Cambio de `kind` si EXISTS resolution apuntando al punto (CUALQUIER `kind_resolution`) |
| T2 | `tr_agenda_kind_immutable_after_closed` | `agenda_items` | BEFORE UPDATE | Cambio de `kind` si `meetings.status = 'CLOSED'` |
| T3 | `tr_agenda_kind_audit_after_convoked` | `agenda_items` | AFTER UPDATE | INSERT en audit log si `meetings.status ∈ ('CONVOKED','OPEN')` |
| T4 | `tr_resolution_kind_matches_agenda` | `meeting_resolutions` | BEFORE INSERT/UPDATE | **Bidireccional D1**: DECISION↔DECISORIO, DELIBERATION_OUTCOME↔DELIBERATIVO, INFORMATION_NOTED↔INFORMATIVO |
| T5 | `tr_agreement_requires_decisorio` | `agreements` | BEFORE INSERT/UPDATE | Rechaza materialización si `parent_meeting_id` apunta a `agenda_item.kind != 'DECISORIO'`. Maneja `execution_mode IS NULL` (D2 fix) |
| T6 | `tr_agenda_kind_only_for_meeting_mode` | `agenda_items` | BEFORE INSERT/UPDATE | Para `meetings.adoption_mode != 'MEETING'`, fuerza `kind = 'DECISORIO'` (G-I3 fix). Modos no-MEETING son inherentemente decisorios |

---

## 4. DDL completo — Migración SQL

Archivo: `supabase/migrations/20260512_000059_agenda_item_kind.sql`

```sql
BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.1 — agenda_items: kind + decision_subtype + cross-column CHECK
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE agenda_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'DELIBERATIVO'
    CHECK (kind IN ('INFORMATIVO', 'DELIBERATIVO', 'DECISORIO')),
  ADD COLUMN IF NOT EXISTS decision_subtype text
    CHECK (decision_subtype IN ('CONSTITUTIVE', 'RATIFICATORY', 'ELEVATION', 'ACKNOWLEDGEMENT')),
  ADD CONSTRAINT agenda_items_decision_subtype_only_for_decisorio
    CHECK (kind = 'DECISORIO' OR decision_subtype IS NULL);

COMMENT ON COLUMN agenda_items.kind IS
  'Naturaleza del punto: INFORMATIVO (sin decisión), DELIBERATIVO (debate sin decisión formal), DECISORIO (sometible a votación). Solo DECISORIO puede materializar agreement. Default conservador DELIBERATIVO.';

COMMENT ON COLUMN agenda_items.decision_subtype IS
  'Subtipo opcional de DECISORIO: CONSTITUTIVE (acuerdo nuevo), RATIFICATORY (ratifica acto previo), ELEVATION (eleva a público), ACKNOWLEDGEMENT (toma de razón art. 248 LSC con votación). NULL para INFO/DELIB.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.2 — meeting_resolutions: kind_resolution
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE meeting_resolutions
  ADD COLUMN IF NOT EXISTS kind_resolution text NOT NULL DEFAULT 'DECISION'
    CHECK (kind_resolution IN ('DECISION', 'DELIBERATION_OUTCOME', 'INFORMATION_NOTED'));

COMMENT ON COLUMN meeting_resolutions.kind_resolution IS
  'Tipo de outcome: DECISION (votación adoptada/rechazada), DELIBERATION_OUTCOME (conclusión de debate sin votación), INFORMATION_NOTED (informe oído). Cross-validated bidireccional contra agenda_items.kind via trigger T4.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.3 — agenda_item_kind_changelog (audit log WORM)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda_item_kind_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agenda_item_id uuid NOT NULL REFERENCES agenda_items(id) ON DELETE RESTRICT,
  meeting_id uuid NOT NULL,
  meeting_status_at_change text NOT NULL,
  from_kind text NOT NULL,
  to_kind text NOT NULL,
  motivo text NOT NULL CHECK (length(motivo) >= 3),
  autor uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT changelog_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE agenda_item_kind_changelog IS
  'Audit log WORM de cambios de kind. INSERT only via trigger T3. Sin set_config motivo, queda "sin_motivo_proporcionado" + autor NULL (operación bypass-hook detectable en dashboard).';

DROP TRIGGER IF EXISTS tr_worm_agenda_kind_changelog_update ON agenda_item_kind_changelog;
CREATE TRIGGER tr_worm_agenda_kind_changelog_update
  BEFORE UPDATE ON agenda_item_kind_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS tr_worm_agenda_kind_changelog_delete ON agenda_item_kind_changelog;
CREATE TRIGGER tr_worm_agenda_kind_changelog_delete
  BEFORE DELETE ON agenda_item_kind_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

CREATE INDEX IF NOT EXISTS idx_agenda_kind_changelog_item
  ON agenda_item_kind_changelog(agenda_item_id, created_at DESC);

ALTER TABLE agenda_item_kind_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agenda_kind_changelog_tenant_read ON agenda_item_kind_changelog;
CREATE POLICY agenda_kind_changelog_tenant_read ON agenda_item_kind_changelog FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS agenda_kind_changelog_tenant_insert ON agenda_item_kind_changelog;
CREATE POLICY agenda_kind_changelog_tenant_insert ON agenda_item_kind_changelog FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.4 — RPC helper: set_kind_change_context (G-I1 RBAC support)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_kind_change_context(
  p_motivo text,
  p_user_id uuid
) RETURNS void AS $$
BEGIN
  PERFORM set_config('app.kind_change_motivo', p_motivo, true);
  PERFORM set_config('app.user_id', p_user_id::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_kind_change_context IS
  'Setea session vars consumidas por trigger T3 audit log. Llamar inmediatamente antes de UPDATE agenda_items.kind. Si no se llama, audit log captura "sin_motivo_proporcionado" + autor NULL (detectable en dashboard).';

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.5 — Trigger T1: kind inmutable post-voted (cualquier kind_resolution)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_voted()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    IF EXISTS (
      SELECT 1 FROM meeting_resolutions r
      WHERE r.meeting_id = NEW.meeting_id
        AND r.agenda_item_index = NEW.index
    ) THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: existe meeting_resolution apuntando al punto. Cambia primero la resolution.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_immutable_after_voted ON agenda_items;
CREATE TRIGGER tr_agenda_kind_immutable_after_voted
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_immutable_after_voted();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.6 — Trigger T2: kind inmutable post-CLOSED
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_immutable_after_closed()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF v_meeting_status = 'CLOSED' THEN
      RAISE EXCEPTION 'agenda_items.kind inmutable: la reunión está CLOSED. Reabre la reunión via flujo formal antes de reclasificar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_immutable_after_closed ON agenda_items;
CREATE TRIGGER tr_agenda_kind_immutable_after_closed
  BEFORE UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_immutable_after_closed();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.7 — Trigger T3: audit log post-CONVOKED
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_audit_after_convoked()
RETURNS TRIGGER AS $$
DECLARE
  v_meeting_status text;
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind THEN
    SELECT status INTO v_meeting_status FROM meetings WHERE id = NEW.meeting_id;
    IF v_meeting_status IN ('CONVOKED', 'OPEN') THEN
      INSERT INTO agenda_item_kind_changelog (
        tenant_id, agenda_item_id, meeting_id, meeting_status_at_change,
        from_kind, to_kind, motivo, autor
      ) VALUES (
        NEW.tenant_id, NEW.id, NEW.meeting_id, v_meeting_status,
        OLD.kind, NEW.kind,
        COALESCE(current_setting('app.kind_change_motivo', true),
                 'sin_motivo_proporcionado'),
        NULLIF(current_setting('app.user_id', true), '')::uuid
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_audit_after_convoked ON agenda_items;
CREATE TRIGGER tr_agenda_kind_audit_after_convoked
  AFTER UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_audit_after_convoked();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.8 — Trigger T4: cross-validation BIDIRECCIONAL resolution↔agenda (D1)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolution_kind_matches_agenda()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
BEGIN
  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.meeting_id
    AND index = NEW.agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'meeting_resolutions.agenda_item_index=% no corresponde a ningún agenda_item de la reunión %', NEW.agenda_item_index, NEW.meeting_id;
  END IF;

  -- Bidireccional D1: cada kind_resolution requiere su agenda kind
  IF NEW.kind_resolution = 'DECISION' AND v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'kind_resolution=DECISION requiere agenda_items.kind=DECISORIO (actual: %). Reclasifica el punto antes de votar.', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'DELIBERATION_OUTCOME' AND v_agenda_kind != 'DELIBERATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=DELIBERATION_OUTCOME requiere agenda_items.kind=DELIBERATIVO (actual: %). El outcome de deliberación pertenece a un punto deliberativo.', v_agenda_kind;
  END IF;
  IF NEW.kind_resolution = 'INFORMATION_NOTED' AND v_agenda_kind != 'INFORMATIVO' THEN
    RAISE EXCEPTION 'kind_resolution=INFORMATION_NOTED requiere agenda_items.kind=INFORMATIVO (actual: %). Informe oído pertenece a un punto informativo.', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_resolution_kind_matches_agenda ON meeting_resolutions;
CREATE TRIGGER tr_resolution_kind_matches_agenda
  BEFORE INSERT OR UPDATE ON meeting_resolutions
  FOR EACH ROW EXECUTE FUNCTION resolution_kind_matches_agenda();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.9 — Trigger T5: agreement requiere DECISORIO si parent_meeting_id (D2 NULL guard)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agreement_requires_decisorio()
RETURNS TRIGGER AS $$
DECLARE
  v_agenda_kind text;
  v_agenda_item_index int;
BEGIN
  IF NEW.parent_meeting_id IS NULL THEN
    RETURN NEW; -- No-MEETING agreement (NO_SESSION, UNIPERSONAL_*, etc.)
  END IF;

  -- D2 fix: NULL guard explícito en lugar de implícito
  IF NEW.execution_mode IS NULL THEN
    RETURN NEW; -- Legacy agreement sin execution_mode populated
  END IF;

  v_agenda_item_index := (NEW.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int;
  IF v_agenda_item_index IS NULL THEN
    RETURN NEW; -- Sin trazabilidad de punto explícita (compatibilidad legacy)
  END IF;

  SELECT kind INTO v_agenda_kind
  FROM agenda_items
  WHERE meeting_id = NEW.parent_meeting_id
    AND index = v_agenda_item_index;

  IF v_agenda_kind IS NULL THEN
    RAISE EXCEPTION 'agreement.parent_meeting_id no tiene agenda_item con index=%', v_agenda_item_index;
  END IF;

  IF v_agenda_kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'agreement requiere agenda_item.kind=DECISORIO (actual: %). Punto informativo/deliberativo no puede materializar Acuerdo360.', v_agenda_kind;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agreement_requires_decisorio ON agreements;
CREATE TRIGGER tr_agreement_requires_decisorio
  BEFORE INSERT OR UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION agreement_requires_decisorio();

-- ──────────────────────────────────────────────────────────────────────────────
-- 4.10 — Trigger T6: kind solo para adoption_mode=MEETING (G-I3 fix)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION agenda_kind_only_for_meeting_mode()
RETURNS TRIGGER AS $$
DECLARE
  v_adoption_mode text;
BEGIN
  SELECT adoption_mode INTO v_adoption_mode FROM meetings WHERE id = NEW.meeting_id;
  IF v_adoption_mode IS NULL THEN
    RAISE EXCEPTION 'agenda_items.meeting_id no apunta a una meeting válida (id=%)', NEW.meeting_id;
  END IF;
  -- Para no-MEETING (NO_SESSION, UNIPERSONAL_*, CO_APROBACION, SOLIDARIO),
  -- forzar DECISORIO. Estos modos son inherentemente decisorios — no admiten
  -- orden del día deliberativo o informativo.
  IF v_adoption_mode != 'MEETING' AND NEW.kind != 'DECISORIO' THEN
    RAISE EXCEPTION 'agenda_items asociados a meetings.adoption_mode=% deben tener kind=DECISORIO (modo inherentemente decisorio). Recibido: %', v_adoption_mode, NEW.kind;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_agenda_kind_only_for_meeting_mode ON agenda_items;
CREATE TRIGGER tr_agenda_kind_only_for_meeting_mode
  BEFORE INSERT OR UPDATE ON agenda_items
  FOR EACH ROW EXECUTE FUNCTION agenda_kind_only_for_meeting_mode();

COMMIT;
```

---

## 5. Backfill SQL con probe de verificación

Archivo: `supabase/migrations/20260512_000060_agenda_item_kind_backfill.sql`

```sql
BEGIN;

-- Paso 1: marcar como DECISORIO los puntos con señal relacional (P1 + matiz REJECTED)
UPDATE agenda_items ai
SET kind = 'DECISORIO'
WHERE EXISTS (
  SELECT 1 FROM meeting_resolutions r
  WHERE r.meeting_id = ai.meeting_id
    AND r.agenda_item_index = ai.index
    AND r.status IN ('ADOPTED', 'REJECTED')
)
OR EXISTS (
  SELECT 1 FROM agreements a
  WHERE a.parent_meeting_id = ai.meeting_id
    AND (a.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int = ai.index
);

-- Paso 2: migrar resolutions con status finales (no PENDING/DRAFT) a DELIBERATION_OUTCOME (O3 fix)
UPDATE meeting_resolutions
SET kind_resolution = 'DELIBERATION_OUTCOME'
WHERE status NOT IN ('ADOPTED', 'REJECTED', 'PENDING', 'DRAFT')
  AND kind_resolution = 'DECISION';

-- Paso 3: probe de verificación
DO $$
DECLARE
  v_total int; v_decis int; v_delib int; v_info int;
  v_orphan_resolutions int; v_orphan_agreements int;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE kind = 'DECISORIO'),
         COUNT(*) FILTER (WHERE kind = 'DELIBERATIVO'),
         COUNT(*) FILTER (WHERE kind = 'INFORMATIVO')
  INTO v_total, v_decis, v_delib, v_info FROM agenda_items;

  SELECT COUNT(*) INTO v_orphan_resolutions
  FROM meeting_resolutions r
  JOIN agenda_items ai ON ai.meeting_id = r.meeting_id AND ai.index = r.agenda_item_index
  WHERE r.kind_resolution = 'DECISION' AND ai.kind != 'DECISORIO';

  SELECT COUNT(*) INTO v_orphan_agreements
  FROM agreements a
  JOIN agenda_items ai ON ai.meeting_id = a.parent_meeting_id
                       AND ai.index = (a.execution_mode -> 'agreement_360' ->> 'agenda_item_index')::int
  WHERE ai.kind != 'DECISORIO';

  RAISE NOTICE 'BACKFILL VERIFICATION:';
  RAISE NOTICE '  Total: %, DECIS: %, DELIB: %, INFO: %', v_total, v_decis, v_delib, v_info;
  RAISE NOTICE '  Orphan DECISION resolutions: % (esperado: 0)', v_orphan_resolutions;
  RAISE NOTICE '  Orphan agreements: % (esperado: 0)', v_orphan_agreements;

  IF v_orphan_resolutions > 0 THEN
    RAISE EXCEPTION 'BLOCKER: orphan DECISION resolutions detected after backfill';
  END IF;
  IF v_orphan_agreements > 0 THEN
    RAISE EXCEPTION 'BLOCKER: orphan agreements detected after backfill';
  END IF;
END $$;

COMMIT;
```

**Nota G-I2**: el backfill no clasifica ningún punto como `INFORMATIVO` (sin señal relacional inferible). El tipo INFORMATIVO solo existirá en puntos creados post-migración + en seeds demo ARGA Fase 5.

---

## 6. Tipos TS + normalizadores

Archivo: `src/lib/secretaria/agenda-kind.ts`

```typescript
export type AgendaItemKind = "INFORMATIVO" | "DELIBERATIVO" | "DECISORIO";
export type AgendaDecisionSubtype = "CONSTITUTIVE" | "RATIFICATORY" | "ELEVATION" | "ACKNOWLEDGEMENT";
export type ResolutionKind = "DECISION" | "DELIBERATION_OUTCOME" | "INFORMATION_NOTED";

const VALID_KINDS = new Set<AgendaItemKind>(["INFORMATIVO", "DELIBERATIVO", "DECISORIO"]);

export function normalizeAgendaItemKind(value: unknown): AgendaItemKind {
  if (typeof value !== "string") return "DELIBERATIVO";
  const upper = value.toUpperCase().trim();
  return VALID_KINDS.has(upper as AgendaItemKind) ? (upper as AgendaItemKind) : "DELIBERATIVO";
}

export function isDecisionAgendaItem(kind: AgendaItemKind): boolean {
  return kind === "DECISORIO";
}

export interface AgendaKindMerged {
  effective: AgendaItemKind;       // valor actual autoritative (P4 SSOT)
  snapshot: AgendaItemKind | null; // valor en snapshot de convocatoria (warning si drift)
  drift: boolean;
}

export function mergeAgendaKindSources(params: {
  fromTable: AgendaItemKind | null | undefined;
  fromConvocatoriaSnapshot: unknown;
}): AgendaKindMerged {
  const effective = normalizeAgendaItemKind(params.fromTable ?? "DELIBERATIVO");
  const snapshot = params.fromConvocatoriaSnapshot != null
    ? normalizeAgendaItemKind(params.fromConvocatoriaSnapshot)
    : null;
  return { effective, snapshot, drift: snapshot !== null && snapshot !== effective };
}
```

---

## 7. Hooks afectados

| Hook | Cambio | v1 |
|---|---|---|
| `useReunionSecretaria` | Carga `kind` desde tabla + snapshot. Expone `mergeAgendaKindSources` para drift warning | ✅ |
| `useSaveMeetingResolutions` | Valida pre-INSERT que `kind_resolution` coincide con `agenda.kind` (T4 lo enforces, hook valida primero para mejor UX) | ✅ |
| `useActas` | **§5 corrección D3**: mantiene array `meetings.junta.puntos` en ORDEN SECUENCIAL. Cada punto lleva `kind` + `kind_resolution` como metadatos. NO reagrupa | ✅ |
| `useReclassifyAgendaItemKind` (nuevo) | Mutation con `motivo` obligatorio. Llama RPC `set_kind_change_context` antes del UPDATE para que T3 capture autor + motivo. **Aplica matriz P7 + RBAC SECRETARIO de la reunión** | ✅ |
| `useAgendaKindChangelog` (nuevo) | Query del audit log para vista admin/expediente | ✅ basic, dashboard v2 |
| `useAgendaItemRealtimeSubscription` (nuevo) | Realtime subscription a `agenda_items` filtrada por `meeting_id` activo (G4) | ✅ |

### 7.1 RBAC en `useReclassifyAgendaItemKind` (G-I1)

```typescript
export function useReclassifyAgendaItemKind() {
  const { user } = useCurrentUser();
  const { roles } = useUserRole(user?.id);

  return useMutation({
    mutationFn: async (params: {
      agendaItemId: string;
      meetingId: string;
      newKind: AgendaItemKind;
      motivo: string; // mínimo 3 chars (CHECK BD)
    }) => {
      // RBAC: solo SECRETARIO del órgano de la reunión
      const isSecretario = await assertUserIsSecretarioOfMeeting(user!.id, params.meetingId);
      if (!isSecretario) {
        throw new Error("403: solo el SECRETARIO del órgano de esta reunión puede reclasificar puntos");
      }

      // Matriz P7: validar reclasificación según tipo reunión
      // - JUNTA convocada formal → no admisible (vicio procedimiento)
      // - JUNTA universal → unanimidad de presentes
      // - CONSEJO → quórum unánime + constancia
      await assertReclassificationAllowedByMatrix(params.meetingId, params.newKind);

      // Setear session vars para T3 audit
      await supabase.rpc("set_kind_change_context", {
        p_motivo: params.motivo,
        p_user_id: user!.id,
      });

      const { error } = await supabase
        .from("agenda_items")
        .update({ kind: params.newKind })
        .eq("id", params.agendaItemId);
      if (error) throw error;
    },
  });
}
```

---

## 8. Componentes UI afectados

| Componente | Cambio |
|---|---|
| `ConvocatoriaStepper` paso "Orden del día" | Selector `kind` por punto. Si DECIS, mostrar `decision_subtype` opcional. Esconder mayoría/modelo si INFO |
| `ReunionStepper` chips | Badge visual `[INFO]`/`[DELIB]`/`[DECIS]` por punto |
| `ReunionStepper.VotacionesStep` | Carril votación filtra solo DECIS. Modal "Reclasificar a DECISORIO" con motivo obligatorio + matriz P7 enforcement |
| `ActaGenerator` | **D3 corrección**: loop secuencial con renderizado condicional inline por `kind`. Degradación graceful para plantillas legacy v1.2.0 (campos decisorios vacíos para no-DECIS) |
| `CertificacionStepper` | Solo lista `agreement_id` materializados. Excluye INFO/DELIB con mensaje "Punto X excluido por ser informativo/deliberativo" |
| `BusquedaGlobal` | Resultados con badge `kind`. Navegación: INFO/DELIB → `/secretaria/reuniones/:id#punto-X`; DECIS materializado → `/secretaria/acuerdos/:id`; DECIS no materializado → `/secretaria/reuniones/:id#punto-X` con badge "pendiente materialización" (G1) |
| `ExpedienteAcuerdo` | Sin cambios — sigue siendo expediente exclusivo de DECIS materializados |

---

## 9. Jerarquía de precedencia (single source of truth)

| Prioridad | Origen | Naturaleza |
|---|---|---|
| 1 (autoritative) | `agenda_items.kind` | Estado actual del punto |
| 2 (snapshot inmutable) | `convocatorias.agenda_items[].kind` | Snapshot de lo publicado en convocatoria — usado para detectar drift y warning UI |
| 3 (default fallback) | `'DELIBERATIVO'` | Default conservador BD si nada está poblado |

Drift entre 1 y 2 → warning UI "punto reclasificado después de convocatoria" + ambos valores visibles en acta para transparencia procedimental.

---

## 10. Reglas operativas R1-R7

| Regla | Enforcement |
|---|---|
| **R1** Default conservador `DELIBERATIVO` | DDL `DEFAULT 'DELIBERATIVO'` |
| **R2** Backfill solo basado en señales relacionales | SQL backfill explícito sin inferencias por título |
| **R3** Inmutabilidad progresiva | Triggers T1, T2, T3 |
| **R4** Cross-validation bidireccional resolution↔agenda | Trigger T4 |
| **R5** Agreement requiere agenda DECISORIO | Trigger T5 |
| **R6** `kind` solo aplica a `adoption_mode='MEETING'` | Trigger T6 |
| **R7** RBAC: SECRETARIO + matriz P7 (Junta formal vs universal vs Consejo) | Hook `useReclassifyAgendaItemKind` |

---

## 11. Estrategia de migración por fases

### Fase 1 — Schema + backfill (1 sprint)
DDL + 6 triggers + audit log table + RPC helper + backfill con probe. Aplicado via MCP. Tests schema TDD.

**No depende de nada externo. Independiente del Track 1.**

### Fase 2 — Tipos TS + normalizadores + RBAC hook (1 sprint)
`agenda-kind.ts`, `useReclassifyAgendaItemKind` con RPC + RBAC + matriz P7, `useAgendaKindChangelog`.

**No depende de Fase 4 ni de plantilla v1.3.0.**

### Fase 3 — UX convocatoria + reunión (1-2 sprints)
Selectores, chips, carril votación filtrado, modal reclassification.

Feature flag `VITE_AGENDA_KIND_ENABLED` controla exposición.

### Fase 4 — Motor + acta + certificación (1 sprint)
Trigger T5 ya existe (Fase 1). Motor lee kind para guards UI. Certificación excluye no-DECIS.

**Dependencia bloqueante para acta diferenciada**: bump de plantilla ACTA_SESION v1.2.0 → v1.3.0 con bloques `{{#if (eq kind ...)}}` dentro del loop secuencial existente. **Requiere firma Comité Legal ARGA** (ciclo Harvey o equivalente).

**Sin firma**: ActaGenerator degrada gracefully. Puntos no-DECIS renderizan campos decisorios vacíos. Acta funcional pero sin secciones específicas para INFO/DELIB. Documentar en runbook.

### Fase 5 — Realtime + búsqueda + demo (1 sprint)
- Supabase Realtime subscription a `agenda_items`
- Búsqueda con badges
- **Seed ARGA mixto** (G-I2):
  - Reunión CdA demo: 3 INFO + 2 DELIB + 1 DECIS materializado
  - Reunión Junta demo: 1 INFO + 0 DELIB + 3 DECIS
  - Permite validar Fase 5 con datos reales de los 3 tipos

---

## 12. Out of scope

- **Reagrupación del acta por kind**: D3 explícitamente lo prohibe. El acta preserva orden secuencial.
- **Multi-jurisdicción**: el motor LSC actual evalúa LSC española; aplicación a BR/MX/PT queda fuera.
- **RLS dinámica con role-gate JWT-based**: deuda sistémica (igual que `plantillas_protegidas` y `rule_param_overrides`). Patrón actual `tenant_id = '...001'` sigue, role-gate en hook (no RLS).
- **Plantilla ACTA_SESION v1.3.0 con condicionales**: depende de Track 1 cierre Garrigues + firma Comité Legal. Sin firma, degradación graceful.
- **Audit trail de intentos bloqueados por triggers (O4)**: queda log a stderr/Sentry de errores Postgres. Tabla dedicada `agenda_kind_violation_log` queda v2.1.

---

## 13. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Backfill clasifica mal puntos legacy | Media | Alto | Probe rechaza commit si orphans > 0 + revisión humana del output NOTICE |
| Trigger T3 no captura `app.user_id` (UPDATE bypass hook via SQL directo) | Media | Bajo | COALESCE silencioso → motivo='sin_motivo_proporcionado' + autor NULL. Dashboard mantenimiento detecta como anomalía en rojo |
| Realtime consume conexiones | Baja | Bajo | Subscription solo activa para `meeting_id` actual + cleanup useEffect return |
| Reclassification durante meeting OPEN sin matriz P7 enforcement | Media | Alto (vicio procedimiento) | UI modal con tipo órgano + universalidad detectada bloquea si no cumple matriz |
| `decision_subtype` infrautilizado | Alta | Bajo | Default NULL; opcional siempre; documentar casos en guía operativa |
| Conflicto con paquete v2 plantillas overrides en curso (PR #1) | Baja | Medio | Spec en branch separada. Coordinar merge order: v2 overrides primero (PR #1), agenda_item_kind después |
| **Plantilla ACTA_SESION v1.3.0 sin firma legal a tiempo** | **Media** | **Medio (acta funcional pero menos rica)** | **Degradación graceful en ActaGenerator: bloques INFO/DELIB renderizan narrativa simple. Documentar en runbook.** |
| **Reagrupación inadvertida en futuro refactor de useActas** | **Baja** | **Alto (vicio procedimiento RRM art. 99)** | **Test E2E orden secuencial obligatorio + comentario inline en useActas con cita RRM** |

---

## 14. Plan de tests

### 14.1 Schema tests (`src/test/schema/agenda-item-kind.test.ts`)

- Estructura columnas + CHECK constraints (≥3 rejection paths)
- T1 inmutabilidad post-resolution (cualquier `kind_resolution`)
- T2 inmutabilidad post-CLOSED
- T3 audit log inserta + WORM
- T4 cross-validation BIDIRECCIONAL (3 paths × 3 directions = 9 tests)
- T5 agreement requiere DECISORIO (3 paths: parent_meeting + INFO/DELIB rejected, DECIS happy)
- T6 modos no-MEETING fuerzan DECISORIO
- CHECK `decision_subtype` solo cuando DECISORIO
- O4: UPDATE bypass hook produce changelog con motivo='sin_motivo_proporcionado' (anomalía detectable)

### 14.2 Unit tests

- `normalizeAgendaItemKind`: input variations + default conservador
- `mergeAgendaKindSources`: drift detection + autoritative precedence
- `useReclassifyAgendaItemKind`: setea session vars antes de UPDATE + RBAC enforcement

### 14.3 E2E tests (`e2e/21-secretaria-agenda-kind.spec.ts`)

- Crear convocatoria con 3 puntos (INFO/DELIB/DECIS) + verificar selectores
- Stepper reunión separa carriles correctamente
- Intento materializar INFO bloqueado con mensaje
- Acta generada **preserva orden secuencial** (test crítico D3)
- Certificación lista solo DECIS materializados
- Realtime: cambio de kind durante meeting OPEN dispara toast en otro tab

---

## 15. Estado de aprobación

Este spec consolida 4 rondas adversariales:

| Ronda | Hallazgos | Estado |
|---|---|---|
| 1ª (3 BLOQUEANTES + 6 IMPORTANT + menores) | B1, B2, B3, I1, I2, I5, I6, M1-M6 | ✅ Resueltos en v1.1 |
| 2ª (validación + 4 gaps remanentes) | G1, G2, G3, G4 | ✅ Resueltos en v1.2 |
| 3ª (defectos triggers + gaps implementación + observaciones) | D1, D2, G-I1, G-I2, G-I3, O1-O4 | ✅ Resueltos en v1.2/v1.3 |
| 4ª (defecto autoinfligido en useActas) | D3 reagrupación → orden secuencial | ✅ Resuelto en v1.3 |
| Matices aceptados | P1, P2, P5, P7 | ✅ Integrados |

**17 hallazgos resueltos. Spec al 96%, lista para implementación.**

---

## 16. Referencias

- PRD original: `docs/superpowers/plans/2026-05-11-acuerdo360-agenda-item-kind-prd.md` (commit `dd4c4c7`)
- Plantilla ACTA_SESION vigente: `plantillas_protegidas` tipo='ACTA_SESION' organo_tipo='JUNTA_GENERAL' v1.2.0
- Sistema RBAC existente: `src/hooks/useUserRole.ts`, `src/hooks/useCurrentUser.ts`
- Patrón WORM: `worm_guard()` en `supabase/migrations/20260419_000001_rule_engine_tables.sql`
- Patrón inmutabilidad progresiva: `bloques_sectoriales` + `entity_settings_catalog` en PR #1 (v2 plantillas overrides)
- RRM arts. 97-109: relación cronológica del acta
- LSC art. 197 + 248: RBAC reclasificación + toma de razón

---

**FIN del spec v1.3 — diseño cerrado, pendiente review humano final + implementación.**
