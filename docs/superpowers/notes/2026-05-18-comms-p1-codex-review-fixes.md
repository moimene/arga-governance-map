---
title: P1 Comms — Fixes para Codex Adversarial Review (5 P0/P1 + 1 hardening)
date: 2026-05-18
status: All findings addressed
audience: Engineering / Security review
---

# Fixes aplicados sobre los 6 hallazgos de Codex

## P0 #1 — Dispatcher abierto a anon

**Hallazgo:** `comms-dispatcher` deployado con `--no-verify-jwt` + invocado desde el browser con anon key. Cualquiera con la URL podía disparar envíos reales via service_role.

**Fix:**
- `supabase/functions/comms-dispatcher/index.ts`: nueva función `authorizeCaller()`. Acepta:
  - `Bearer <SERVICE_ROLE_KEY>` (pg_cron tick): allow.
  - `Bearer <user_jwt>` con rol `SECRETARIO` o `ADMIN_TENANT`: allow.
  - Cualquier otra cosa (anon, otro rol): 401/403.
- `src/hooks/useCommunicationActions.ts`: `triggerDispatcher` ahora pasa `session.access_token` (no anon key). Si no hay sesión, no llama y deja al pg_cron.
- Deploy commands actualizados en checklist: **deploy WITHOUT `--no-verify-jwt`**.
- Lockdown RPCs (`fn_claim_recipients_for_dispatch`, `fn_recipient_mark_sent`, `fn_recipient_handle_error`): REVOKE de authenticated. Solo service_role.

## P0 #2 — Webhook verification incorrecta

**Hallazgo:** webhook-resend aceptaba todo cuando secret vacío + usaba header no estándar (`resend-signature`) en vez de Svix. webhook-ead-trust era equality check, no signed payload.

**Fix:**
- `supabase/functions/webhook-resend/index.ts`: implementación Svix completa:
  - Headers requeridos: `svix-id`, `svix-timestamp`, `svix-signature`.
  - Replay protection: timestamp dentro de ±5 min.
  - HMAC SHA-256 de `${id}.${timestamp}.${body}` con secret base64-decoded de `whsec_xxx`.
  - Soporte para múltiples versiones de signature (rotación: `v1,sig1 v1,sig2`).
  - timingSafeEqual para comparar.
  - **Refuse if `RESEND_WEBHOOK_SECRET` not set** (no permissive dev mode en producción).
- `supabase/functions/webhook-ead-trust/index.ts`: HMAC SHA-256 base64 de `${timestamp}.${body}` con secret en header `x-eadtrust-signature` + `x-eadtrust-timestamp`. Replay protection idéntica. Refuse if secret not set.

## P0/P1 #3 — Plazo validation no funciona (pg_net es async)

**Hallazgo:** trigger `tg_communications_validate_plazo` usaba `pg_net.http_post` + polling de `_http_response`. Supabase pg_net es asíncrono y dispara post-commit → trigger no puede bloquear el INSERT que lo originó.

**Fix:**
- Migración `20260518082819_comms_plazo_engine_plpgsql.sql`:
  - Nueva función `fn_calcular_plazo_comunicacion(...)` en **PL/pgSQL puro** que mirror la lógica TS (LSC 176 SA → 30d, art. 173 SL → 15d, CdA → ESTATUTOS source, COMISION → REGLAMENTO, fallback a `comunicacion_config`).
  - Trigger reescrito: invoca la función PL/pgSQL **síncronamente** → puede `RAISE EXCEPTION` y bloquear el INSERT real.
  - Smoke test verificado: JG SA cotizada con meeting 2026-07-01 → `min_envio_date=2026-06-01`, plazo 30d, ref Art. 176.1 LSC, warning cotizada.
- Edge Function `validate-comm-plazo` queda como redundante (la lógica DB es ahora autoritativa). Se mantiene por si se quiere preview client-side sin trigger.

## P1 #4 — Dispatcher sends mail before DB ack

**Hallazgo:** `comms-dispatcher` ignoraba errores de `fn_recipient_mark_sent` y aún incrementaba `processed`. Email/ERDS podía enviarse mientras recipient quedaba en `ENVIANDO` sin evento WORM.

**Fix en `comms-dispatcher/index.ts`:**
- `fn_recipient_mark_sent` ahora **chequea error**.
- Si la RPC falla post-send:
  - `processed` NO se incrementa.
  - Best-effort: INSERT `delivery_events` con `evento='ERROR', proveedor='INTERNAL', payload={orphan_after_send: true, proveedor_real, db_error, proveedor_evento_id}` para auditoría.
  - INSERT en `notifications` table con `type='error'` para alertar al secretario.
- Respuesta del dispatcher ahora incluye `{processed, claimed, orphaned, orphaned_recipients}`.
- Operator puede reconciliar manualmente: recipient ENVIANDO + delivery_events.SENT vía Resend/EAD logs.

## P1 #5 — PasoEnvioMiembros bugs

**Hallazgos:**
1. Attachment INSERT no chequeaba error → comm podía promover a PROGRAMADA sin documento.
2. `documentHash` se almacenaba como `cuerpo_hash_sha512` → confusión semántica peligrosa (Resend/QTSP sellaba documento pero columna decía body).

**Fix:**
- Migración `20260518083234_comms_fn_create_communication_atomic.sql`: nueva RPC `fn_create_communication_atomic(p_comm, p_attachments, p_recipients)` que hace los 3 INSERTs en **una sola transacción**. Si cualquiera falla (incluyendo trigger de plazo), rollback completo.
- Auth interna: la RPC valida que `auth.uid()` tenga rol SECRETARIO o ADMIN_TENANT.
- `src/components/secretaria/comunicaciones/PasoEnvioMiembros.tsx`:
  - `cuerpoHash = sha512(cuerpoHtml)` (siempre computado del body).
  - `docHash = props.documentHash ?? sha512(documentUri)` (separado).
  - `cuerpo_hash_sha512` = `cuerpoHash` (body, no doc).
  - `attachment.hash_sha512` = `docHash` (doc, no body).
  - Llamada a `supabase.rpc('fn_create_communication_atomic', ...)` reemplaza los 3 INSERTs sueltos.
  - Si la RPC retorna error → setError + no promote.

## P1 #6 — DistribuirPackButton no wired

**Hallazgo:** `DistribuirPackButton.tsx` existía pero no se importaba en ningún sitio. Smoke path documentado era imposible.

**Fix en `src/pages/secretaria/BoardPack.tsx`:**
- `import { DistribuirPackButton } from "@/components/secretaria/comunicaciones/DistribuirPackButton"`.
- Renderizado en el header junto al botón "Imprimir / PDF":
  ```tsx
  {boardPackData.meeting?.body?.id && boardPackData.meeting?.body?.entity_id && (
    <div className="print:hidden">
      <DistribuirPackButton
        bodyId={boardPackData.meeting.body.id}
        entityId={boardPackData.meeting.body.entity_id}
        meetingId={boardPackData.meeting.id}
        meetingDate={...}
        packStorageUri={`evidence_bundle:board-pack:${meetingId}@${generatedAt}`}
      />
    </div>
  )}
  ```

## Verificación

| Check | Resultado |
|---|---|
| `bun run typecheck` | PASS |
| `bun test src/lib/comms/ + plazo + hook` | 35 pass, 0 fail, 65 expect(), 578 ms |
| `bun run lint` (scoped a comms module) | clean |
| RPC grants verificados via `pg_proc + role_routine_grants` | `fn_claim_recipients_for_dispatch`/`mark_sent`/`handle_error` → solo `service_role`; `fn_calcular_plazo_comunicacion`/`fn_create_communication_atomic` → `authenticated` + `service_role` |
| Smoke `fn_calcular_plazo_comunicacion('CONVOCATORIA','JUNTA_GENERAL', ARGA_SA, 2026-07-01)` | `min_envio_date=2026-06-01`, plazo 30d, ref Art. 176.1 LSC, warning cotizada ✓ |

## Migraciones aplicadas hoy (Cloud `governance_OS`)

- `20260518082819_comms_plazo_engine_plpgsql.sql`
- `20260518083234_comms_fn_create_communication_atomic.sql`
- `20260518083619_comms_dispatcher_rpcs_lockdown.sql`

## Deploy command actualizado

```bash
# IMPORTANT: deploy WITHOUT --no-verify-jwt for dispatcher and webhooks
# Supabase gateway will reject calls without valid JWT; the dispatcher internally
# re-validates that the caller is service_role OR a user with SECRETARIO/ADMIN_TENANT role.
bunx supabase functions deploy comms-dispatcher
bunx supabase functions deploy webhook-resend --no-verify-jwt  # public webhook, verifies Svix internally
bunx supabase functions deploy webhook-ead-trust --no-verify-jwt  # public webhook, verifies HMAC+timestamp internally
bunx supabase functions deploy validate-comm-plazo  # may be deprecated; PL/pgSQL is authoritative
bunx supabase functions deploy invite-portal-member  # stub P1
```

Webhooks SÍ usan `--no-verify-jwt` porque los webhooks vienen de Resend/EAD Trust con sus propios secrets, no son JWT. La verificación se hace dentro de la función con Svix / HMAC.

Dispatcher NO usa `--no-verify-jwt` porque debe rechazar callers sin JWT a nivel gateway antes de procesar.

## Lo que falta (deuda hacia producción)

- **D1** Webhooks: registrar URLs en Resend dashboard + en EAD Trust contract (OQ4, OQ5)
- **D2** Test que demuestre que pg_cron tick funciona post-deploy (smoke E2E)
- **D3** Test de paridad CI entre `comms-plazo-engine.ts` (TS client) y `fn_calcular_plazo_comunicacion` (PL/pgSQL server)
- **D4** RPC test suite: invocar `fn_create_communication_atomic` desde test con/sin SECRETARIO role
- **D5** El RPC `fn_create_communication_atomic` no llama a `triggerDispatcher` aún — el cliente lo hace separadamente. P2 puede consolidar
