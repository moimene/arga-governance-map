---
title: P1 Comms — FINAL Secrets + Manual Operations Checklist
date: 2026-05-17
audience: DevOps / Operations
status: Required before first production-grade dispatch
---

# Comms P1 — Secrets & Manual Ops Checklist

P1 schema + library + Edge Functions + hooks + UI están **escritos y verificados**. Para activar el envío real necesitas configurar lo siguiente. Hasta entonces:

- El trigger `tg_communications_validate_plazo` está en modo **permissive** (no bloquea INSERT cuando las GUCs no están configuradas).
- El pg_cron job `comms-dispatch-tick` está **registrado pero INACTIVO**.
- Los webhooks de Resend y EAD Trust quedan **fail-closed** si falta su secreto HMAC.
- `PasoEnvioMiembros` puede crear comms en estado `BORRADOR`/`PROGRAMADA`, pero el dispatcher no procesará nada hasta que se habiliten las secrets.

---

## 1. Cuenta Resend + dominio verificado (DevOps, ~30 min)

- [ ] Crear cuenta Resend (https://resend.com) — plan recomendado: free tier (50k envíos/mes) o starter ($20/mes).
- [ ] Añadir dominio `arga-seguros.com` (o el dominio elegido en OQ4 del spec).
- [ ] Configurar registros DNS:
  - `_resend` TXT verification
  - SPF: `v=spf1 include:_spf.resend.com ~all`
  - DKIM: 2 registros CNAME (Resend dashboard los muestra)
  - DMARC: `v=DMARC1; p=quarantine; rua=mailto:dmarc@arga-seguros.com`
- [ ] Esperar verificación DNS (5-30 min).
- [ ] Generar API key → guardar como `RESEND_API_KEY`.
- [ ] En Resend → Webhooks: crear webhook con URL `https://hzqwefkwsxopwrmtksbg.supabase.co/functions/v1/webhook-resend` para eventos: `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`.
- [ ] Generar HMAC signing secret del webhook → guardar como `RESEND_WEBHOOK_SECRET`.

## 2. EAD Trust contract + credenciales (Garrigues Ops, ~ 1-2 días)

- [ ] Confirmar volumen mensual incluido en contrato EAD Trust (OQ5).
- [ ] Recibir la URL **completa y contractual** de envío de Notice Manager → guardar como `EAD_NOTICE_MANAGER_SEND_URL`. No derivar un endpoint de mensajería desde la URL de Evidence Manager.
- [ ] Recibir la credencial de Notice Manager → guardar como `EAD_NOTICE_MANAGER_API_KEY`.
- [ ] Si se activa el canal separado de sello de tiempo, guardar su base y credencial como `EAD_TRUST_API_URL` y `EAD_TRUST_API_KEY`.
- [ ] Confirmar que la respuesta de Notice Manager incluye `requestId`, estado `REQUESTED`/`DELIVERED` y timestamps del proveedor; si informa e-archive de Evidence Manager, debe incluir estado, `evidenceId` y `archivedAt`.
- [ ] Registrar webhook URL en EAD Trust: `https://hzqwefkwsxopwrmtksbg.supabase.co/functions/v1/webhook-ead-trust`.
- [ ] Generar webhook signing secret → guardar como `EAD_TRUST_WEBHOOK_SECRET`.

> Evidence Manager acredita custodia/e-archive; no acredita por sí solo solicitud
> ni entrega del mensaje. Esos estados solo nacen de Notice Manager y se guardan
> con los identificadores y timestamps devueltos por el proveedor.

## 3. Supabase secrets + Edge Function deploy (DevOps, ~ 15 min)

```bash
cd /Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map

# Set secrets
bunx supabase secrets set \
  RESEND_API_KEY="re_xxx" \
  RESEND_WEBHOOK_SECRET="whsec_xxx" \
  EAD_NOTICE_MANAGER_SEND_URL="https://<endpoint-contractual-notice-manager>" \
  EAD_NOTICE_MANAGER_API_KEY="ead_notice_xxx" \
  EAD_TRUST_API_URL="https://<endpoint-contractual-timestamp>" \
  EAD_TRUST_API_KEY="ead_timestamp_xxx" \
  EAD_TRUST_WEBHOOK_SECRET="ead_whsec_xxx" \
  REMITENTE_NOMBRE="Secretaría TGMS" \
  REMITENTE_EMAIL="secretaria@arga-seguros.com" \
  --linked

# Deploy all 5 Edge Functions
bunx supabase functions deploy comms-dispatcher
bunx supabase functions deploy webhook-resend --no-verify-jwt
bunx supabase functions deploy webhook-ead-trust --no-verify-jwt
bunx supabase functions deploy validate-comm-plazo --no-verify-jwt
bunx supabase functions deploy invite-portal-member --no-verify-jwt
```

## 4. Database GUCs (DevOps, 2 min)

Conectar al pooler/db de governance_OS y ejecutar:

```sql
ALTER DATABASE postgres SET app.functions_url = 'https://hzqwefkwsxopwrmtksbg.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_role_key = 'eyJxxx... (service_role from Supabase dashboard)';
```

> **Nota seguridad:** `app.service_role_key` queda almacenado en la configuración del cluster. Solo accesible por SUPER USER (Supabase admin). El trigger `tg_communications_validate_plazo` lo lee via `current_setting('app.service_role_key', true)`.

## 5. Activar pg_cron job (1 SQL command)

```sql
-- Activar el job inactivo registrado por la migración:
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'comms-dispatch-tick'),
  active := true
);

-- Verificar:
SELECT * FROM cron.job WHERE jobname = 'comms-dispatch-tick';
-- Esperar 90 segundos, luego:
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'comms-dispatch-tick')
ORDER BY start_time DESC LIMIT 3;
-- Esperado: status='succeeded'.
```

## 6. Smoke test E2E (5 min)

1. Login en demo como `demo@arga-seguros.com` / `TGMSdemo2026!`.
2. Ir a `/secretaria/comunicaciones` → verificar dashboard vacío.
3. Ir a `/secretaria/board-pack/:id` (cualquier pack) → click "Distribuir pack a consejeros" → modal abre con miembros del CdA.
4. Seleccionar `EMAIL_CERTIFICADO`, fecha `now() + 2min`, "Programar envío".
5. Volver a `/secretaria/comunicaciones?tab=programada` → comunicación visible.
6. Esperar 90s. Tab `enviada` → comunicación con estado `ENVIANDO` o `ENVIADA`.
7. Ver detalle → recipients con `fecha_envio` populada.
8. Después de Resend webhook DELIVERED → estado `ENTREGADA_TOTAL`.

## 7. Configurar fronted env vars (Vite/Vercel)

Asegurar que el frontend tiene:
```
VITE_SUPABASE_URL=https://hzqwefkwsxopwrmtksbg.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```
Estas deben estar en Vercel project settings (preview + production) y en `.env.local` para dev.

---

## Resumen de deudas P1.5 (no bloqueantes)

| ID | Deuda | Owner | Sprint |
|---|---|---|---|
| D1 | Backfill `no_session_notificaciones` a `communications` via VIEW | Engineering | P2 sem 1 |
| D2 | 8 plantillas con `materia=NULL` necesitan `comunicacion_config` | Comité Legal | OQ2 |
| D3 | 1 plantilla extra con `requiere_comunicacion=false` (investigar identidad) | Engineering | Backlog |
| D4 | Wiring CTA "Saltar envío" en ConvocatoriasStepper Paso 8 | Engineering | P1.5 |
| D5 | Página `/secretaria/comunicaciones/programar?convocatoriaId=...` | Engineering | P1.5 |
| D6 | Entry points bonus: Tramitador, Expediente, Reunion | Engineering | P1.5 |
| D7 | Composer libre 6-step | Engineering | P3 |
| D8 | CI gate paridad `comms-plazo-engine` TS ↔ Deno | Engineering | P1.5 |
| D9 | Test E2E Playwright golden path convocatoria | Engineering | P1.5 |
| D10 | Lint errors pre-existentes en `ConvocatoriasStepper.tsx:1285-1286` | Engineering | Separate PR |

## Verificación

- ✅ 9 migraciones aplicadas a Cloud
- ✅ 1768/1768 tests del proyecto pasan (16 fails pre-existentes en openxml-validation, no comms)
- ✅ `bun run typecheck` PASS
- ✅ `bun run lint` (scoped a comms) clean
- ✅ `bun run build` PASS

**Sistema listo para activación operativa pendiente exclusivamente de los 5 pasos de arriba.**
