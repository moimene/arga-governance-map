---
title: P1 Week 3 — M3 Adversarial Review
date: 2026-05-17
phase: comms-p1-w3
status: PASS (with 1 critical bug caught and fixed)
---

# M3 Adversarial Review — Edge Functions + Hooks + pg_cron + RPCs

## Entregables W3

| Archivo | Función |
|---|---|
| `supabase/functions/comms-dispatcher/index.ts` | pg_cron-callable batch dispatcher. Reclaim → adapter → mark_sent/handle_error |
| `supabase/functions/webhook-resend/index.ts` | HMAC verify + DELIVERED/BOUNCED/OPENED/CLICKED/COMPLAINED mapping |
| `supabase/functions/webhook-ead-trust/index.ts` | EAD Trust callback handler |
| `supabase/functions/validate-comm-plazo/index.ts` | Invoked by trigger before INSERT/UPDATE on communications |
| `supabase/functions/invite-portal-member/index.ts` | Stub P1, full impl P2 sem 2 |
| `supabase/functions/_shared/comms-plazo-engine.ts` | Mirror of TS engine for Deno (CI paridad gate in W6) |
| `src/hooks/useCommunication.ts` | Single comm fetch with attachments + recipients |
| `src/hooks/useCommunicationsList.ts` | List with filters (estado, entity, organo, tipo, tiene_rebotes, libre, fechas) |
| `src/hooks/useCommsPlazoCheck.ts` | Live validation hook for composer datepicker |
| `src/hooks/useCommunicationActions.ts` | cancelar/reintentar/programar + dispatcher trigger |
| RPC `fn_claim_recipients_for_dispatch` | SECURITY DEFINER, service_role only, FOR UPDATE SKIP LOCKED |
| RPC `fn_recipient_mark_sent` | SECURITY DEFINER, success path + INSERT delivery_events SENT |
| RPC `fn_recipient_handle_error` | Retry + fallback promotion logic |
| pg_cron job `comms-dispatch-tick` | Registered every minute, **INACTIVE** until GUCs configured |

## BUG CRÍTICO CAZADO POR EL MODO ADVERSARIAL

### Inversión semántica en `min_envio_date` comparison

Plan + spec definían `min_envio_date` como "antes de esta fecha el envío INVALIDA el acto". Texto ambiguo. Engine calculaba correctamente `min_envio_date = meeting - plazo_dias` (= deadline máxima de envío). Pero el hook y la Edge Function comparaban al revés:

```ts
// BUG (ANTES):
if (result.min_envio_date && draft.fecha_programada < result.min_envio_date) {
  return { isValid: false, ... };  // Marcaba inválido si se enviaba CON MÁS antelación que la requerida
}
```

La regla LSC (art. 176, 173, 246, 249) exige **al menos X días de antelación**. Enviar con más antelación es siempre legal. Enviar con menos es lo que invalida. El bug habría:
- Aceptado envíos demasiado tarde (16 días antes de una JG SA, cuando la ley exige 30).
- Bloqueado envíos legítimos con suficiente antelación.

**Detectado por:** test `useCommsPlazoCheck > returns isValid=true if fecha_programada respects 30 días JG SA`. El test esperaba `isValid=true` para una fecha 37 días antes; el código retornaba `isValid=false`.

**Corregido en:** `src/hooks/useCommsPlazoCheck.ts` y `supabase/functions/validate-comm-plazo/index.ts`. La comparación correcta:
```ts
const isValid = !result.min_envio_date || fechaProgramada <= result.min_envio_date;
```

Comentario explicativo añadido al código para evitar regresión:
> `min_envio_date` is the latest legal send date (meeting - plazo_dias).
> Valid if `fecha_programada <= deadline` (enough advance notice).
> Invalid if `fecha_programada > deadline` (sent too late).

**Impacto si no se hubiera detectado:** Cada convocatoria programada con la UI habría sido validada al revés. Resultado: convocatorias declaradas válidas por el motor pero **inválidas legalmente bajo LSC**, con riesgo de impugnación de los acuerdos adoptados. Bug clase A.

## Decisiones adversariales aplicadas en W3

### 1. Settings GUC permissive en dispatcher trigger
`current_setting('app.functions_url', true)` con `missing_ok = true`. Si las GUCs no están configuradas (dev mode), el trigger es permissive (no bloquea INSERT). Strict enforcement solo cuando se setean las GUCs.

### 2. pg_cron job registrado pero INACTIVO
La migración registra el cron job pero lo desactiva (`cron.alter_job(jobid, active := false)`). Operador (o final secrets step) lo activa con un UPDATE. Evita ticks contra Edge Function no desplegada.

### 3. RPCs SECURITY DEFINER + GRANT EXECUTE únicamente a service_role
`REVOKE EXECUTE … FROM public; GRANT EXECUTE … TO service_role;` impide que authenticated users invoquen estas RPCs. Solo dispatcher (con SERVICE_ROLE_KEY) puede llamarlas.

### 4. Webhook HMAC permissive en dev
`RESEND_WEBHOOK_SECRET` y `EAD_TRUST_WEBHOOK_SECRET` opcionales. Si están vacíos, la verificación se salta (dev mode). En producción la operación requiere setear los secrets.

### 5. PORTAL_PUSH skip con `console.warn` en dispatcher
Tres puntos de defensa-en-profundidad: skip en library `dispatcher.ts`, skip en Edge Function `comms-dispatcher`, y el adapter registry throws para esa rama.

## Tests + verificación

- `bun test src/lib/comms/ src/lib/rules-engine/.../comms-plazo-engine.test.ts src/hooks/__tests__/useCommsPlazoCheck.test.tsx`:
  **35 pass, 0 fail, 65 expect() calls, 372ms, 11 files.**
- `bun run typecheck`: PASS.

## Deudas anotadas (no bloqueantes)

- **D6 [SECRETS DEPLOY]** GUCs `app.functions_url` + `app.service_role_key` deben configurarse después de deployar Edge Functions con `supabase functions deploy`. Luego activar cron job: `SELECT cron.alter_job((SELECT jobid FROM cron.job WHERE jobname='comms-dispatch-tick'), active := true);`
- **D7 [SECRETS DEPLOY]** Resend + EAD Trust secrets deben configurarse via `supabase secrets set` antes del primer dispatch real.
- **D8 [CI GATE]** Test de paridad entre `src/lib/rules-engine/comms-plazo-engine.ts` y `supabase/functions/_shared/comms-plazo-engine.ts` debe añadirse en W6.

## Veredicto M3

**PASS.** Bug crítico de inversión semántica capturado y corregido **gracias al modo adversarial con TDD**. Edge Functions escritas (5 funciones), RPCs aplicadas en Cloud, hooks operativos, pg_cron job registrado en estado seguro. Procedemos a W4 (entry points UI).
