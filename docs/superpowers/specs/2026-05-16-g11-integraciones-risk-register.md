# F5.G11 — Risk Register de Integraciones Externas

**Fecha:** 2026-05-16
**Plan:** docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §7
**Concilio K11:** "risk register no prueba nada productivo" → este documento se
acompaña de **contract tests** (`src/test/contracts/*.test.ts`) que validan
el shape del wire protocol antes de tener contrato productivo.

> Este documento es **risk register**, no plan operativo. Para cada integración
> registra: capability productiva esperada, estado actual (stub), riesgo si NO
> se contrata, owner, ETA estimado, y referencia al contract test que valida
> el wire protocol contra un Zod schema.

---

## §1 EAD Trust QTSP (firma QES + sello QSeal + timestamp)

| Campo | Valor |
|---|---|
| **Estado actual** | Stub local con respuestas sintéticas (`src/lib/qtsp/ead-trust-client.ts`). |
| **Capability productiva** | Firma electrónica cualificada (QES) de certificaciones + sello cualificado (QSeal) de evidence_bundles + timestamping cualificado (TSA). |
| **Riesgo si NO se contrata** | Certificaciones generadas no tienen validez probatoria ante Registro Mercantil. Bloquea pase a producción. |
| **Owner** | Garrigues (relación QTSP). |
| **ETA estimado** | Sprint productiva — desconocido sin acuerdo Garrigues/EAD Trust. |
| **Contract test** | `src/test/contracts/ead-trust-qes.test.ts` — Zod schema valida shape `QESResponse` (signature_request_id, status, signed_document_url, timestamp_iso, signatory_ids). |
| **Coste estimado** | Variable por número de firmas/sellos/mes. Modelo bulk fee + per-document. |

**Decisión owner pendiente:** ¿Esperamos a que Garrigues confirme acceso al sandbox EAD Trust para validar el contract test contra endpoint real, o avanzamos solo con el stub hasta producción?

---

## §2 Registro Mercantil (presentación telemática)

| Campo | Valor |
|---|---|
| **Estado actual** | Mock UI en `/secretaria/tramitador/*`. No hay integración con SIGER/PSM ni API real. |
| **Capability productiva** | Presentación de actas, certificaciones, escrituras vía interfaces telemáticas oficiales (España: SIGER 2.0 + PSM; Portugal: portal SIBS; México: SIGER MX). |
| **Riesgo si NO se contrata** | Tramitaciones manuales por gestor humano. Aumenta tiempo + coste operativo pero NO bloquea funcionalidad demo. Para escala productiva, sí bloquea. |
| **Owner** | Procurador / gestor administrativo del cliente. |
| **ETA estimado** | Fase escala productiva — fuera de roadmap actual demo. |
| **Contract test** | `src/test/contracts/registro-mercantil.test.ts` — Zod schema valida shape `RMFilingResponse` (filing_id, status, deeds_required, deficiencies). |
| **Coste estimado** | Tarifa RM por presentación (~50–200€) + posible licencia software interface. |

**Decisión owner pendiente:** ¿Tramitamos en demo manualmente (offline) durante 2026 y dejamos integración real para 2027, o se acelera por interés comercial?

---

## §3 CNMV / IBEX (feed regulatorio cotizadas)

| Campo | Valor |
|---|---|
| **Estado actual** | Sin integración. ARGA Seguros S.A. modelada como cotizada (DL-2 resuelta) pero sin feed CNMV. |
| **Capability productiva** | Recibir alertas de CNMV/SIBE para cotizadas tenant: hechos relevantes, comunicaciones técnicas, calendario JGA obligatorio. |
| **Riesgo si NO se contrata** | El módulo LSC para cotizadas tiene info estática. Cliente debe actualizar manualmente eventos regulatorios. |
| **Owner** | Compliance / Garrigues. |
| **ETA estimado** | Sprint cotizadas (post-demo). |
| **Contract test** | `src/test/contracts/cnmv-feed.test.ts` — Zod schema valida shape `CNMVHechoRelevante` (event_id, isin, event_type, published_at, content_url). |
| **Coste estimado** | Feed CNMV es público (RSS/XML); coste cero salvo desarrollo del consumer. |

**Decisión owner pendiente:** ¿Activamos consumer CNMV en demo para 1 ISIN sintético, o esperamos contrato cliente cotizado real?

---

## §4 Microsoft Sentinel SIEM (feed OTel via Edge Function)

| Campo | Valor |
|---|---|
| **Estado actual** | Eventos OTel-shaped emitidos en consola (`src/lib/telemetry/observability.ts` — F4.G20). Sin transporte a Sentinel. |
| **Capability productiva** | Forward de eventos rls.denied, signed_url.failure, audit_chain.drift, storage.403, service_role.usage al workspace Log Analytics del cliente. Reglas de alerta configurables. |
| **Riesgo si NO se contrata** | Sin observability productiva, las defensas RLS/DEFINER hardening (F1+F2) no son auditables. Compliance auditor → finding P0. |
| **Owner** | Plataforma del cliente (no Garrigues). |
| **ETA estimado** | Sprint plataforma productiva (post-validation F1+F2 estables en demo). |
| **Contract test** | `src/test/contracts/sentinel-log-ingestion.test.ts` — Zod schema valida shape `SentinelLogEntry` (TimeGenerated, OperationName, Severity, Properties). |
| **Coste estimado** | Log Analytics workspace (~$3/GB ingestion + retention). |

**Decisión owner pendiente:** ¿El workspace Sentinel está provisionado en Azure cliente, o lo proveemos nosotros?

---

## §5 Resumen ejecutivo (1 página)

| # | Integración | Riesgo si no se contrata | Bloquea producción | Contract test |
|---|---|---|---|---|
| 1 | EAD Trust QTSP | **Certificaciones no válidas ante RM** | **Sí** | `ead-trust-qes.test.ts` |
| 2 | Registro Mercantil | Tramitación manual ↑ coste | Solo en escala | `registro-mercantil.test.ts` |
| 3 | CNMV/IBEX | Info estática cotizadas | No (módulo bypass) | `cnmv-feed.test.ts` |
| 4 | Microsoft Sentinel | Observability inexistente | **Sí (compliance)** | `sentinel-log-ingestion.test.ts` |

**Bloqueantes producción**: EAD Trust QTSP + Microsoft Sentinel.

---

## §6 Forma de los contract tests

Cada contract test:

1. **Define un Zod schema** que describe la respuesta esperada del endpoint productivo.
2. **Importa el stub local** y valida que la respuesta del stub **pasa el schema**.
3. **Documenta el endpoint productivo** (URL pattern, auth, headers) en comentario.
4. **El día que se conecte el endpoint real**, solo cambia la URL + credenciales; el mismo schema valida que el productivo cumple el contract.

Estructura:

```typescript
// src/test/contracts/<integration>.test.ts
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { stubFunction } from "@/lib/<integration>/<stub>-client";

const ResponseSchema = z.object({ /* shape exacto */ });

describe("<Integration> contract", () => {
  it("stub response shape matches productive contract", async () => {
    const result = await stubFunction({ /* fixtures */ });
    expect(() => ResponseSchema.parse(result)).not.toThrow();
  });

  it("rejects malformed responses (negative test)", () => {
    const malformed = { /* missing required field */ };
    expect(() => ResponseSchema.parse(malformed)).toThrow();
  });
});
```

Los 4 contract tests sirven dos propósitos:
- **Pre-contrato**: garantizan que el stub respeta una especificación clara.
- **Post-contrato**: cuando se firma el contrato productivo, los mismos tests validan que el wire protocol del proveedor es el esperado. Si el proveedor entrega un shape distinto, los tests fallan y forzan negociación.

---

*v1 — 2026-05-16. Documento risk register + sub-deliverable contract tests.*
