# F5.G7 — `evidence_bundle_review_events` Decisión Legal

**Fecha:** 2026-05-16
**Plan:** docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §7
**Estado:** PENDIENTE Comité Legal

> El audit 2026-05-16 §1 identificó la propuesta de tabla
> `evidence_bundle_review_events` como pendiente de decisión legal. Este
> documento consolida la propuesta, el riesgo de no decidir, y el plan de
> cierre condicional.

## §1 Propuesta

Crear tabla append-only `evidence_bundle_review_events` que registre cada
revisión/comentario/aprobación sobre un `evidence_bundle`:

```sql
CREATE TABLE evidence_bundle_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  evidence_bundle_id uuid NOT NULL REFERENCES evidence_bundles(id),
  event_kind text NOT NULL CHECK (event_kind IN (
    'REVIEW_REQUESTED',
    'REVIEW_APPROVED',
    'REVIEW_REJECTED',
    'COMMENT_ADDED',
    'LEGAL_HOLD_APPLIED',
    'LEGAL_HOLD_RELEASED',
    'SUPERSEDED',
    'ARCHIVED'
  )),
  reviewer_person_id uuid REFERENCES persons(id),
  comment text,
  signed_by text,
  signature_date timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE evidence_bundle_review_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ebre_tenant_isolation ON evidence_bundle_review_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.fn_current_tenant_id());
CREATE POLICY ebre_append_only ON evidence_bundle_review_events
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.fn_current_tenant_id());
-- No UPDATE/DELETE: append-only por defecto.
```

## §2 Workflow propuesto

`GestorPlantillas` y `ExpedienteAcuerdo` integran un panel "Revisiones legales":
- Botones "Solicitar revisión" / "Aprobar" / "Rechazar" → INSERT row.
- Vista de timeline ordenada por created_at.
- Filtros por reviewer / event_kind / fecha.
- Cuando `event_kind = 'LEGAL_HOLD_APPLIED'` se sincroniza con
  `evidence_bundles.legal_hold = true`.

## §3 Riesgo si NO se aprueba

- **No P0**. La auditoría seguirá funcionando vía `audit_log` (WORM
  hash-chain ya operativo desde 20260419173059_b3_audit_worm_triggers).
- **Pérdida funcional**: workflow de revisión legal se mantiene en
  comentarios manuales o tooling externo (no trazabilidad).
- **Compliance ISO 27001 control A.18 (legal)**: solo si auditor externo
  exige timeline review estructurado.

## §4 Riesgo si se aprueba (efectos secundarios)

- Duplicación parcial con `audit_log`. Necesita política clara sobre qué
  va en cada tabla (review_events = decisiones humanas; audit_log = DML
  hash-chained).
- Crece linealmente con revisiones → considerar particionado por fecha.

## §5 Plan de cierre condicional

| Decisión | Acción | Plazo |
|---|---|---|
| APROBADO sin cambios | Aplicar migración `20260520_g7_evidence_review_events.sql` (a redactar) + integrar UI en GestorPlantillas + ExpedienteAcuerdo. | Sprint inmediato post-decisión. |
| APROBADO con cambios | Iterar sobre el schema propuesto en §1 hasta acuerdo + aplicar. | Variable. |
| RECHAZADO | Archivar este documento a `docs/superpowers/specs/rejected/` con nota motivación. | Inmediato. |
| Sin respuesta en 30 días | Owner operativo escala. Si en 60 días sin respuesta → marca como RECHAZADO por silencio. | 60 días → 2026-07-15. |

## §6 Pendiente — handoff Comité Legal

- **Solicitar review formal**: enviar este documento + el schema §1 a
  `legal@garrigues.example` (o canal interno equivalente del cliente).
- **Anotar fecha de envío** aquí cuando se envíe.
- **Anotar fecha de respuesta** cuando se reciba.

Owner operativo responsable: SECRETARIO / COMPLIANCE del tenant productivo.

---

*v1 — 2026-05-16. Plan de cierre condicional. Pendiente decisión Comité Legal.*
