# Seed societario demo ARGA — Secretaría Societaria

Fecha: 2026-05-05
Entorno: Cloud Supabase `governance_OS` (`hzqwefkwsxopwrmtksbg`)
Tenant demo: `00000000-0000-0000-0000-000000000001`

## Resultado

Se implementó y ejecutó `scripts/secretaria-seed-societario-demo.ts` como seed idempotente para nutrir el módulo de Secretaría Societaria con datos coherentes por sociedad, órganos, socios/accionistas, capital, libros, reuniones, acuerdos, certificaciones, evidencias y preparación registral demo.

Verificación del seed:

```json
{
  "templatesActive": 37,
  "societiesFound": 6,
  "agreementsFound": 13,
  "booksFound": 6,
  "missingSnapshots": 0
}
```

El seed respeta la frontera demo: `PROMOTED`/preparación registral significa preparado para Registro, no presentado ni enviado al Registro Mercantil. Las evidencias son de apoyo demo/operativo y no evidencia final productiva. El único QTSP referenciado es EAD Trust.

## Sociedades Cubiertas

- ARGA Seguros S.A.: SA cotizada, JGA ordinaria, Consejo, operación vinculada, delegación de facultades y golden path de Consejo.
- Cartera ARGA S.L.U.: decisión de socio único y aumento de capital.
- Fundación ARGA: persona jurídica de control y fuente de pactos/warnings.
- ARGA Servicios Corporativos S.L.: acuerdo sin sesión, co-aprobación y administrador solidario.
- ARGA Tecnología Jurídica S.L.: transmisión de participaciones, libro registro y junta posterior.
- ARGA Reaseguros S.A.: JGA, nombramiento de auditor y reducción de capital.

## Contratos Reales Observados

- `mandates` es vista legacy derivada de `condiciones_persona`; el seed escribe en `condiciones_persona`, no en `mandates`.
- `meetings` no tiene `entity_id`; la sociedad se resuelve por `body_id -> governing_bodies.entity_id`.
- `governing_bodies.body_type` usa valores DB como `CDA`, `JUNTA`, `COMITE`, `COMISION`; el órgano funcional normalizado queda en `config.organo_tipo`.
- `agreements.adoption_mode` no acepta todavía `CO_APROBACION` ni `SOLIDARIO` como valor de columna. Para esos casos el seed persiste `NO_SESSION` y conserva el modo real en `execution_mode.tipo`.
- `evidence_bundles`, `capital_movements`, notificaciones y respuestas WORM se tratan como insert-only idempotente.
- `capital_movements.movement_type` usa el catálogo `EMISION`, `AMORTIZACION`, `TRANSMISION`, `PIGNORACION`, `LIBERACION_PRENDA`, `SPLIT`, `CONTRASPLIT`.

## Comandos

```bash
bun run db:check-target
bun scripts/secretaria-seed-societario-demo.ts --dry-run
bun scripts/secretaria-seed-societario-demo.ts --apply
bun scripts/secretaria-seed-societario-demo.ts --verify
```

El script carga credenciales desde variables de entorno o desde `docs/superpowers/plans/.env` sin imprimir secretos. Rechaza proyectos distintos de `hzqwefkwsxopwrmtksbg` salvo override explícito.

## Verificación Ejecutada

- `bun run db:check-target`: OK.
- `bun scripts/secretaria-seed-societario-demo.ts --verify`: OK.
- `bunx tsc --noEmit --pretty false`: OK.
- `bun run lint`: OK.
- `bun run build`: OK, con warning preexistente de chunk size/Browserslist.
- `bun run test -- --reporter=dot`: 845 passed, 59 skipped.
- `bun scripts/secretaria-p0-cloud-smoke.ts --readonly-only`: OK.
- Playwright Secretaría:
  - `e2e/18-secretaria-golden-path.spec.ts`: OK.
  - `e2e/25-secretaria-epic-journeys.spec.ts`: OK.
  - `e2e/21-secretaria-responsive.spec.ts`: OK.
  - `e2e/30-secretaria-functional-watchdog.spec.ts`: OK.

## Cambios De Producto Asociados

- `ActaDetalle` muestra de forma visible e incondicional el disclaimer de evidencia demo/operativa no final productiva.
- El seed incorpora una convocatoria de Consejo de ARGA Seguros para mantener navegable el golden path `Convocatoria -> Reunion -> Votacion -> Acta -> Certificacion -> Tramitador -> Documento`.

## Riesgos Residuales

- La columna `agreements.adoption_mode` sigue necesitando una decisión técnica futura si se quiere persistir `CO_APROBACION` y `SOLIDARIO` como valores de primera clase, no sólo en `execution_mode`.
- Los E2E destructivos reales (`e2e/32-secretaria-arga-real-destructive.spec.ts`) no se ejecutaron en esta pasada.
- Las tablas de estatutos/reglamentos versionados siguen fuera del corte actual; los overrides se modelan por perfil normativo/snapshot.
