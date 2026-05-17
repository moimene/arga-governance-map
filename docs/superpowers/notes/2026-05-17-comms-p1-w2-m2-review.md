---
title: P1 Week 2 — M2 Adversarial Review
date: 2026-05-17
phase: comms-p1-w2
status: PASS
---

# M2 Adversarial Review — Library `src/lib/comms/` + `comms-plazo-engine`

## Tests + verificación

- **`bun test src/lib/comms/ src/lib/rules-engine/__tests__/comms-plazo-engine.test.ts`**:
  - 32 tests, 0 fails, 60 expect() calls, 562 ms, 10 files.
- **`bun run typecheck`**: PASS (no errors).
- **Lint**: pendiente verificar con full `bun run lint` después del commit.

## Cobertura por archivo

| Archivo | Tests | Cobertura |
|---|---|---|
| `types.ts` | 3 | enums (16+6+4+3 valores) |
| `adapters/MailAdapter.ts` | 1 | error class shape (retriable + canal + cause) |
| `adapters/QTSPTimestampService.ts` | 3 | success + 5xx retriable + 4xx non-retriable |
| `adapters/ResendAdapter.ts` | 3 | success + 4xx + 5xx + headers Idempotency-Key |
| `adapters/ResendCertifiedAdapter.ts` | 2 | seals before send + fails fast on QTSP error |
| `adapters/EADTrustERDSAdapter.ts` | 3 | success + 4xx + 5xx |
| `adapters/adapter-registry.ts` | 2 | correct adapter per canal + PORTAL_PUSH throws |
| `retry-policy.ts` | 5 | 5 ramas de RetryAction |
| `dispatcher.ts` | 3 | success + skip PORTAL_PUSH + promote fallback on non-retriable |
| `comms-plazo-engine.ts` | 7 | JG SA / JG SL / cotizada warning / CdA estatutos / fallback null / fallback con config / non-ES |

## Hallazgos adversariales aplicados durante implementación

### 1. `ArrayBuffer | SharedArrayBuffer` en EADTrustERDSAdapter
`TextEncoder.encode().buffer` retorna `ArrayBufferLike`. El cast `as ArrayBuffer` es seguro porque
`TextEncoder` siempre devuelve `ArrayBuffer`, pero TypeScript strict lo marca. Aplicado cast explícito.

### 2. `MailAdapterError.cause` typed as `unknown`
Plan tenía `cause?: unknown`. Mantenido para evitar acoplamiento. Test confirma propagación correcta.

### 3. `getAdapter` exhaustive switch
Añadido `default: const _exhaustive: never = canal` para que TypeScript falle si se añade
un canal nuevo sin actualizar el registry. Defense-in-depth ante futuros cambios al enum `Canal`.

### 4. Promise concurrency en `processRecipientBatch`
Implementado con `chunk()` helper para limitar a 5 concurrentes y respetar rate limits de Resend.
Test indirecto valida que `tx` se llama una vez por recipient sin race.

## Veredicto M2

**PASS.** Library `src/lib/comms/` y `comms-plazo-engine.ts` listos para integración con
Edge Functions (W3) y UI (W4-W5). 32 tests pasan en 562 ms. Typecheck limpio.
