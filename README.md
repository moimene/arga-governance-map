# TGMS Platform — ARGA Governance Map

Prototipo operativo avanzado de gobernanza corporativa para Grupo ARGA Seguros.

## Estado operativo de Secretaría

La captura canónica del ciclo completo de convocatoria, verificada el 21 de julio de 2026, está documentada en el [cierre UAT de la convocatoria integral](docs/superpowers/reviews/2026-07-21-cierre-uat-convocatoria-arga.md).

En el alcance vigente, EAD Trust se limita a interposición, mensajería básica y custodia/e-archiving. Las nuevas capturas no pueden afirmar firma, QES, ERDS, envío, entrega ni interacción real con el proveedor sin evidencia contractual y técnica separada.

## Requisito fundamental Supabase

Durante la fase actual de desarrollo-test-demo, `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1) es el entorno activo y fuente de verdad para desarrollo, demo y validación funcional.

Staging está preparado como capacidad futura/pre-release para E2E destructivos y aislamiento, pero no bloquea la evolución actual del prototipo. Antes de tocar Supabase hay que ejecutar `bun run db:check-target` y confirmar que el target es `governance_OS`.

Detalle: `docs/superpowers/specs/2026-05-17-governance-os-active-dev-environment-policy.md`.
