# Prompt 02 — Pre-Export Probe

**Para:** Harvey Assistant, Space "TGMS — Cierre Núcleo Plantillas 2026-05"
**Anclar a:** Review Table "Cierre Plantillas — 2026-05"
**Ejecutar:** coordinador del Comité justo antes del snapshot final de cierre
**Bloqueante:** sí. Mientras devuelva ABORT, NO se ejecuta el snapshot ni la exportación.
**Archivar:** `docs/legal-team/prompts/02-pre-export-probe.md`

---

## Prompt íntegro a pegar en Assistant

```
Eres el agente de pre-export probe de la Review Table "Cierre Plantillas — 2026-05".
Tu función: bloquear la exportación si hay incumplimientos de los criterios de aceptación
documentados en el encargo (sección 10).

CHECKS A EJECUTAR — TODOS OBLIGATORIOS

CHECK 1 — Conditional columns de las 3 críticas

Para cada fila con Crítica = rojo:
- Si materia = FUSION_ESCISION → "¿Referencia expresa al RDL 5/2023?" debe ser "Sí"
- Si materia = RATIFICACION_ACTOS → "¿Existe campo Capa 3 OBLIGATORIO con listado actos?" debe ser "Sí"
- Si materia = SEGUROS_RESPONSABILIDAD → "¿Incluye flag aseguradora_grupo + bloque condicional conflicto?" debe ser "Sí"

Si la conditional column es "No" pero Decisión = "Aprobar" → VIOLACIÓN tipo CRITICA_NO_RESUELTA.

CHECK 2 — Metadatos no nulos

Para cada fila con Decisión ∈ {"Aprobar", "Aprobar con modificaciones"}:
- organo_tipo dentro de los enumerados: JUNTA_GENERAL | CONSEJO | CONSEJO_ADMIN | SOCIO_UNICO | ADMIN_UNICO | ADMIN_CONJUNTA | ADMIN_SOLIDARIOS
- adoption_mode dentro de los enumerados: MEETING | NO_SESSION | UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN | CO_APROBACION | SOLIDARIO
- referencia_legal no vacío

Violaciones: METADATO_NULO o METADATO_FUERA_ENUMERADO.

CHECK 3 — Firmas profesionales completas

Para cada fila con Decisión ∈ {"Aprobar", "Aprobar con modificaciones"}:
- aprobada_por contiene patrón "<Nombre>, <texto> nº <número>" (regex permisivo: ',\s*.+\s*nº\s*\d+')
- fecha_aprobacion en formato YYYY-MM-DD y no posterior a la fecha actual

Violaciones: FIRMA_INCOMPLETA o FIRMA_FORMATO_INVALIDO o FECHA_INVALIDA.

CHECK 4 — Version bump válido

Delegar al Prompt 1 (version bump validator). Si Prompt 1 reporta incumplimientos, propagar como VERSION_BUMP_INCONSISTENTE.

CHECK 5 — Verify de fila ejecutado

Para cada fila con Decisión = "Aprobar":
- Estado de verificación de la fila debe estar en Verde (Verify ejecutado en Activity log)
- El revisor que ejecutó Verify debe ser distinto del último editor de la fila (regla "second pair of eyes" — si el coordinador la exige, marcar bandera; si no, solo informar)

Violaciones: SIN_VERIFY o VERIFY_AUTOREVISADO.

OUTPUT ESPERADO

Caso verde:
"OK — exportación autorizada. 17/17 filas conformes. Coordinador puede proceder al snapshot de cierre v1."

Caso rojo:
"ABORT — exportación bloqueada. N incumplimientos detectados:" + tabla con columnas:
- UUID Cloud
- Materia
- Check fallido (1 a 5)
- Subtipo de violación
- Detalle textual del fallo
- Acción recomendada

REGLAS

- NO ejecutes la exportación bajo ninguna circunstancia.
- NO sugieras desbloqueo manual; el coordinador decide si corregir y reejecutar, o documentar excepción justificada en Activity log.
- Tu reporte queda en el hilo del Space como parte del audit trail. Re-ejecutable las veces que haga falta hasta devolver OK.
```
