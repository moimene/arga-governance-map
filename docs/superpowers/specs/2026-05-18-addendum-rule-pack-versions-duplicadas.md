# Addendum - Versiones activas duplicadas en rule packs

Fecha: 2026-05-18
Origen del hallazgo: extraccion read-only documentada en `8fd94a6 docs(secretaria): add extracted rule packs legal review`
Target verificado: `governance_OS` (`hzqwefkwsxopwrmtksbg`)
Documento base: `docs/superpowers/specs/2026-05-17-rule-packs-review-prioritarios.md`

## 1. Resumen ejecutivo

La extraccion de rule packs prioritarios detecto `8` contextos `materia + organo_tipo` con mas de una `rule_pack_version` marcada como `is_active = true`.

Esto es un problema previo a la validacion funcional del `MatterExecutionProfile`: el perfil lee el `rulePackPayload` que le entregue el selector. Si hay dos versiones activas para la misma materia y organo, cualquier resolucion basada en `.limit(1)` o en orden implicito puede elegir una version no canonica.

No se ha modificado Cloud. El hallazgo solo procede de consultas `SELECT`.

## 2. Contextos afectados

| Materia | Organo | Versiones activas | Diferencia relevante observada | Decision requerida |
|---|---|---|---|---|
| `APROBACION_CUENTAS` | `JUNTA_GENERAL` | `v1.0.0`, `1.0.0` | Una version informa SA 30 dias; otra informa SA 15 dias | Fijar plazo canonico y version activa |
| `AUMENTO_CAPITAL` | `JUNTA_GENERAL` | `v1.0.0`, `1.0.0` | Una version no informa convocatoria; otra incluye convocatoria/documentacion ampliada | Fijar version canonica |
| `REDUCCION_CAPITAL` | `JUNTA_GENERAL` | `v1.0.0`, `1.0.0` | Una version no informa convocatoria; otra incluye convocatoria/documentacion ampliada | Fijar version canonica |
| `DELEGACION_FACULTADES` | `CONSEJO` | `1.1.0`, `1.0.0` | `1.1.0` incorpora verificacion art. 249 bis; la formula de mayoria difiere | Confirmar mayoria y documentacion canonica |
| `NOMBRAMIENTO_AUDITOR` | `JUNTA_GENERAL` | `1.1.0`, `1.0.0` | `1.1.0` anade declaracion de independencia y propuesta de Comision de Auditoria cuando procede | Confirmar documentacion canonica |
| `OPERACION_VINCULADA` | `CONSEJO` | `1.1.0`, `1.0.0` | La formula de mayoria y el computo de abstenciones difieren | Confirmar formula juridicamente correcta |
| `AUTORIZACION_GARANTIA` | `JUNTA_GENERAL` | `1.1.0`, `1.0.0` | Una version opera como Consejo/antelacion 0; otra como Junta/antelacion 15 | Confirmar competencia y escalado por art. 160.f LSC |
| `RATIFICACION_ACTOS` | `CONSEJO` | `1.1.0`, `1.0.0` | Duplicidad activa detectada; requiere comparativa antes de uso | Fijar version canonica |

## 3. Impacto tecnico

Mientras existan duplicidades activas:

- `MatterExecutionProfile` puede heredar un payload distinto para la misma materia;
- el `Matter Registry` no puede considerar determinista la traza completa `materia -> rule pack -> plantilla`;
- los tests legales pueden pasar contra una version y fallar contra otra;
- el panel informativo del `TramitadorStepper` podria mostrar convocatoria, mayoria o documentacion distinta segun la version seleccionada.

## 4. Decision solicitada a Legal

Para cada contexto duplicado, Legal debe indicar:

1. Version canonica.
2. Motivo juridico de la eleccion.
3. Si la version alternativa debe archivarse tecnicamente.
4. Si algun valor debe corregirse antes de archivar.

Formato recomendado:

| Materia | Version canonica | Version a desactivar | Motivo legal | Observaciones |
|---|---|---|---|---|
| `APROBACION_CUENTAS` | Pendiente | Pendiente | Pendiente | Resolver P1 sobre plazo SA |

## 5. Accion tecnica posterior

Una vez Legal confirme las versiones canonicas, Ingenieria debe preparar un SQL puntual, idempotente y revisado para desactivar las versiones no canonicas.

La operacion prevista no debe borrar historico. Debe limitarse a:

```sql
UPDATE rule_pack_versions
SET is_active = false
WHERE id IN (...)
  AND is_active = true;
```

Antes de ejecutar cualquier cambio Cloud:

1. `bun run db:check-target`;
2. confirmar `governance_OS` / `hzqwefkwsxopwrmtksbg`;
3. dry-run / `SELECT` de filas afectadas;
4. SQL puntual;
5. verificacion posterior de que queda una sola version activa por `materia + organo_tipo`;
6. migration/ledger repair solo si procede y queda local-only.

## 6. Relacion con fase 1

El paquete puede enviarse a Legal con este hallazgo. Para conectar el panel informativo no disruptivo al `TramitadorStepper`, la decision sobre duplicados debe resolverse al menos para las materias que vayan a mostrarse en el panel inicial.
