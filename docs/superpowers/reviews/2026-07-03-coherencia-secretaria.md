# Coherencia interna del módulo Secretaría — diagnóstico y fix (2026-07-03)

**Origen:** quejas del usuario probando el módulo. **Rama:** `feature/coherencia-secretaria` (sobre `feature/ux-refactor-secretaria-overnight`, PR #37 aún OPEN).

## Diagnóstico (verificado contra código y Cloud)

| Queja | Veredicto | Evidencia |
|---|---|---|
| 1. El stepper de convocatoria no filtra materias por órgano | Parcial: la lógica filtraba (`MATERIA_ORGANOS` completo, 37/37 mapeadas), pero al editar borradores se anteponía la materia incompatible y la lista no comunicaba el filtro | `ConvocatoriasStepper` (pre-fix), `materiaOptions` |
| 2. Sin opción de asuntos libres | Existía pero enterrada: `OTROS_LIBRE` al final de una lista plana de ~20 opciones + puntos no decisorios (kind v3.1) con título libre | catálogo pre-fix |
| 3. Materias sin estructurar por órgano / transversales | **Cierto**: `<select>` plano sin agrupación | render pre-fix |
| 4. Plantillas de calidad mínima | **Cierto**: 15 de 58 `MODELO_ACUERDO` ACTIVA con capa1 < 850 caracteres (media 1.9k); 3 ACTIVA sin `materia_acuerdo` | query Cloud 2026-07-03 |

## Arreglado (commit `b90539e`)

- **Catálogo canónico** `src/lib/secretaria/agenda-materias.ts`: `AGENDA_MATERIAS` + `MATERIA_ORGANOS` + helpers extraídos verbatim del stepper (verificación determinista 37/37/9) + `agendaMateriaGroups(organoTipo)`.
- **Select estructurado por `<optgroup>`**: "Propias de la Junta General" / "Propias del órgano de administración" / "Del ámbito del consejo (delegables a la comisión)" · "Transversales (cualquier órgano)" · "Punto libre". La materia incompatible de un borrador se conserva en su propio grupo sin ofrecer el resto del catálogo incompatible.
- **9 tests** (`agenda-materias.test.ts`): partición exhaustiva y disjunta, mapeo completo, estructurales solo Junta, punto libre en todos los órganos, fallback conservador legacy.
- Gates: `tsc`=0 · `bun test` 2266/0 · lint=baseline. Revisor 2º: Codex timeout (7m, archivo 4.5k líneas) → sustituido por verificación determinista de extracción verbatim (script vs `HEAD~1`).

## Pendiente (fase 2 — contenido de plantillas)

Enriquecer los 15 `MODELO_ACUERDO` ACTIVA más pobres (capa1 < 850 chars, inventario por `capa1_len` ASC: PODER_REPRESENTACION 604, CONTRATOS_SOCIO_UNICO_SOCIEDAD 628, PRESTACIONES_ACCESORIAS 635, APROBACION_REGLAMENTO_CONSEJO 667, EXCLUSION_SOCIO 700, ACUERDO_CONVOCATORIA_JUNTA 748, CUENTAS_CONSOLIDADAS 754, SEPARACION_SOCIO 755, TRASLADO_DOMICILIO_NACIONAL 787, TRANSMISION_PARTICIPACIONES 796, EJECUCION_AUMENTO_DELEGADO 800, SUPRESION_PREFERENTE 811, + 3 sin materia v1.1.0). Método: redacción LSC estándar por materia (precedente H1c), SQL UPDATE + espejo en `supabase/migrations/`, `db:check-target` antes, y paso por revisión legal (workflow del gestor) antes de presentarlas como definitivas. Resolver también las 3 ACTIVA sin binding de materia.
