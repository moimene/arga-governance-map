# Contrato de la conexión persistente AIMS → Secretaría (MOI-56)

Decisión D-18 (por delegación de Moisés, orquestador 2026-09-27): **opción a)
estructura propia**. Prohibido escribir en `governance_module_events` y
`governance_module_links` (protocolo, regla 10; CLAUDE.md «No hacer»).

## Por qué no la opción b (reutilizar `governance_module_*`)

Medido en Cloud el 2026-09-27 (SELECT de solo lectura sobre
`information_schema.columns`, proyecto `hzqwefkwsxopwrmtksbg`):

| Campo del contrato | `governance_module_events` | `governance_module_links` |
|---|---|---|
| Propietario | — (no hay columna de "quién es dueño del registro") | — (`relation_type` no es propietario) |
| Entidad (tenant) | `tenant_id uuid not null` | `tenant_id uuid not null` |
| Expediente origen | `source_object_type text`, `source_object_id **text**` | `source_object_type text not null`, `source_object_id **text** not null` |
| Expediente destino | `target_object_type text`, `target_object_id **text**` (ambos NULLABLE) | `target_object_type text`, `target_object_id **text**` (ambos NULLABLE) |
| Actor | — (ninguna columna; solo cabría dentro de `payload jsonb`) | — (ninguna columna; solo cabría dentro de `payload jsonb`) |
| Evento | `event_type text not null`, `event_status text not null` | — (no hay evento, solo `relation_type`) |
| Estado | `event_status text not null` | `status text not null` |
| Justificante | `evidence_bundle_id uuid` (referencia a `evidence_bundles`, no un texto libre) | `evidence_bundle_id uuid` |

Dos motivos de fondo, no solo de columnas, por los que ninguna cubre el
contrato sin degradarlo:

1. **Tipado de la relación.** `source_object_id`/`target_object_id` son
   `text`, no `uuid` con FK real a `ai_incidents`/`meetings`/`agreements`. Una
   fila con un id que dejó de existir no lo dice ninguna restricción de la
   base — solo lo dice el nombre de la columna que la interpreta. El criterio
   de hecho de este issue («una prueba automática falla si la relación se
   pierde») exige que la BASE, no solo el código cliente, sepa que
   `target_object_id` apunta a una reunión o un acuerdo real de este tenant.
2. **La regla 10 no es solo "no escribir hoy".** Es una veda declarada sobre
   estas dos tablas exactamente porque son la columna vertebral de integración
   entre TODOS los módulos del ERP (`docs/superpowers/plans/2026-04-27-arga-console-erp-shell-architecture.md:132-133`).
   Escribir aquí, aunque las columnas alcanzaran, reabriría esa veda para el
   primer caso concreto que aparezca — y el propio issue ya avisa: "la
   reutilización no puede escribir en ellas sin una decisión expresa de
   Moisés". Esa decisión expresa no se ha dado (0 comentarios en el issue a
   2026-09-27); por delegación rige el criterio por defecto: opción a).

## Los siete campos del contrato

| Campo | Dónde vive | Notas |
|---|---|---|
| **Propietario** | Implícito por quién escribe la fila: la escribe **Secretaría**, en el instante en que Secretaría crea la reunión o el acuerdo desde una derivación. AIMS nunca escribe en esta tabla — solo la lee (`useAimsSecretariaDerivationsForIncident`). | No es una columna: es una invariante de código (un solo punto de escritura por tipo de destino, ver §3). |
| **Entidad** | `tenant_id uuid not null` — explícito en cada INSERT, nunca `DEFAULT`. | Regla 5 del protocolo: varias tablas del repo tienen `DEFAULT '…0001'` y un INSERT sin tenant explícito contamina ARGA. Esta tabla NO lleva `DEFAULT` en `tenant_id`. |
| **Expediente origen** | `source_incident_id uuid not null references ai_incidents(id)` | FK real, no texto. Si el incidente no existe o es de otro tenant, el INSERT falla por RLS (`with check` valida `ai_incidents.tenant_id = fn_current_tenant_id()`), no queda una fila con un origen fantasma. |
| **Expediente destino** | `target_meeting_id uuid references meetings(id)` **o** `target_agreement_id uuid references agreements(id)` — exactamente uno de los dos (CHECK). | Cubre "reunión o acuerdo" (Aceptación del issue) sin una columna polimórfica `text` sin FK. |
| **Actor** | `created_by uuid default auth.uid()` | Mismo patrón que `aims_classification_questionnaires.created_by` (`20260908120000`): no hay FK a `persons` porque `auth.uid()` es un usuario de Auth, no una persona del censo — igual que ese caso, forzar esa FK habría roto todo INSERT que no resuelva persona. |
| **Evento** | `source_event text not null` | El `contractEvent` que ya declara `src/lib/aims/handoffs.ts` (`AIMS_INCIDENT_MATERIAL`), sin inventar un vocabulario nuevo. |
| **Estado** | `status text not null default 'LINKED' check (status in ('LINKED','SUPERSEDED'))` | `LINKED` es el único estado que el código produce hoy. `SUPERSEDED` queda reservado para cuando una rectificación (nueva reunión/acuerdo que sustituye al vinculado) necesite dejar la fila anterior sin proponerla como vigente — no se implementa aquí porque nada en el producto rectifica hoy una reunión/acuerdo materializado desde este camino; construirlo sin un caso real sería la tabla especulativa que el issue no pide. |
| **Justificante** | `evidence_ref text` (nullable) | Sin política de UPDATE en esta migración: nada in-app escribe este campo todavía. Backfillarlo con la referencia al acta/certificación es un paso posterior que depende de MOI-144 (custodia final de actas, ninguna acta tiene hoy `APPROVED_SIGNED`) — documentado como deuda, no fabricado aquí. |

## Qué NO hace esta conexión

- No copia ni modifica el acta, la reunión ni el acuerdo. `useAimsSecretariaDerivationsForIncident` es un `SELECT` con dos joins de solo lectura (`meetings(id,status,scheduled_start)`, `agreements(id,status,agreement_kind)`); ningún hook de este contrato llama `.update()` sobre esas tablas.
- No escribe en `governance_module_events` ni `governance_module_links` (verificado: 0 referencias nuevas de escritura en el diff de MOI-56).
- No decide GRC. GRC sigue recibiendo solo la referencia por MOI-158 (`ai_incident` en la query string, ya resuelto por `useAiIncidentHandoffReference`); este issue no toca esa vía.
- No acredita firma, envío, entrega ni interacción real con EAD Trust — el `evidence_ref` es un campo vacío en esta entrega, no una referencia a custodia cualificada.

## 1. Tabla

`aims_secretaria_derivations` (migración
`supabase/migrations/20260927105600_aims_secretaria_derivaciones.sql`):

```
id                   uuid PK default gen_random_uuid()
tenant_id            uuid NOT NULL                          -- sin DEFAULT
source_incident_id   uuid NOT NULL REFERENCES ai_incidents(id) ON DELETE RESTRICT
source_event         text NOT NULL
target_meeting_id    uuid REFERENCES meetings(id) ON DELETE RESTRICT
target_agreement_id  uuid REFERENCES agreements(id) ON DELETE RESTRICT
status               text NOT NULL DEFAULT 'LINKED' CHECK (status IN ('LINKED','SUPERSEDED'))
evidence_ref         text
created_by           uuid DEFAULT auth.uid()
created_at           timestamptz NOT NULL DEFAULT now()

CHECK: exactamente uno de (target_meeting_id, target_agreement_id) es NOT NULL
```

Índices únicos parciales `(source_incident_id, target_meeting_id)` y
`(source_incident_id, target_agreement_id)` — idempotencia a nivel de base:
reintentar la misma derivación no duplica fila (23505, tratado como éxito por
el hook cliente).

## 2. RLS y privilegios

- `SELECT`/`INSERT` a `authenticated`, acotados a `tenant_id = fn_current_tenant_id()`.
- El `INSERT` además exige (en el `WITH CHECK`) que `source_incident_id`
  pertenezca a un `ai_incidents` del mismo tenant, y que el destino elegido
  (`meetings`/`agreements`) también pertenezca al mismo tenant — el
  aislamiento va en el camino de escritura, no solo en la columna `tenant_id`
  de la propia fila (patrón ya usado en `aims_classification_questionnaires`).
- **Sin política ni GRANT de `DELETE`.** No se borra una derivación desde la
  aplicación.
- `REVOKE TRUNCATE, REFERENCES, TRIGGER` explícito de `anon`/`authenticated`
  (defensivo: desde MOI-205 las tablas nuevas creadas por `postgres` ya nacen
  sin esos privilegios por `ALTER DEFAULT PRIVILEGES`, pero el instrumento se
  verifica igual, no se asume).
- Sin política de `UPDATE` en esta entrega (ver «Justificante» arriba).

## 3. Los dos puntos de escritura (únicos)

La relación se persiste **solo cuando el destino se crea de verdad**, nunca
en la sola navegación (`handoffs.ts` sigue siendo 100% read-only):

1. **Reunión** — `UniversalMeetingIntake` (`src/pages/secretaria/ReunionStepper.tsx`),
   tras `createUniversalMeeting.mutateAsync(...)` con éxito, si la intake
   llegó con `source=aims`. El contexto del handoff se propaga desde
   `ReunionIntake` hasta aquí con `appendHandoffParams` (nueva función en
   `cross-module-handoff.ts`, mismo contrato de claves que ya usa MOI-158 —
   antes de esta entrega, `ReunionIntake` mostraba la derivación pero el enlace
   "Reunión universal" la perdía).
2. **Acuerdo** — `AcuerdoSinSesionStepper` (`src/pages/secretaria/AcuerdoSinSesionStepper.tsx`),
   tras `adoptAgreement.mutateAsync(...)` con resultado `APROBADO`, si el
   stepper se abrió con `source=aims` (nuevo enlace "Derivar a acuerdo sin
   sesión" en `CabeceraIncidente.tsx`, mismo patrón que los dos enlaces ya
   existentes a GRC y a `/secretaria/reuniones/nueva`).

Ambos usan el mismo par de funciones (`buildDerivationInsert` en
`src/lib/aims/secretaria-derivation.ts` + `useCreateAimsSecretariaDerivation`
en `src/hooks/useAimsSecretariaDerivations.ts`) — un solo criterio para las
dos pantallas, no dos implementaciones que puedan divergir.

## 4. Consulta de retorno desde AIMS

`useAimsSecretariaDerivationsForIncident(incidentId)` — `SELECT` acotado al
tenant de la sesión, con los joins de solo lectura descritos arriba. Ninguna
pantalla de AIMS que la consuma escribe en `meetings`/`agreements`/`minutes`.

## 5. Prueba de arista

`src/test/aims/secretaria-derivation-arista.test.ts`:

- `buildDerivationInsert` lanza si falta tenant, origen, evento o destino
  (las cuatro combinaciones), y construye la fila correcta cuando todo está
  presente — para reunión y para acuerdo.
- Doble de PostgREST + `useCreateAimsSecretariaDerivation`: la fila se crea
  con el tenant de la sesión; reintentar el mismo par origen/destino no
  duplica (23505 tratado como éxito); un id de OTRO tenant no aparece en
  `useAimsSecretariaDerivationsForIncident` (control negativo entre grupos).
- Las pantallas no descartan el identificador: `UniversalMeetingIntake` y
  `AcuerdoSinSesionStepper` llaman a `useCreateAimsSecretariaDerivation` con
  el `sourceId` del handoff (no un literal, no `undefined` a propósito), y
  `ReunionIntake` propaga el handoff con `appendHandoffParams` en el enlace de
  reunión universal (assert de código fuente, mismo patrón que
  `handoff-reference.test.ts` de MOI-158).

## 6. Ensayo revertido (Cloud)

`supabase/migrations/proposed/20260927105600_aims_secretaria_derivaciones.probe.sql`
— `begin;` → aplica la migración → control positivo (INSERT con un
`ai_incidents`/`meetings` reales del tenant ARGA, `SELECT` que la lee de
vuelta) → control negativo (un segundo tenant, vía `set local role
authenticated` + `request.jwt.claims` de ese tenant, no ve la fila del
primero; y un intento de `INSERT` con un `source_incident_id` de OTRO tenant
es rechazado por RLS) → `rollback;`. No lo ejecuta este agente — lo ejecuta el
orquestador tras la aprobación de Moisés (puerta humana, paso 5 del issue).
