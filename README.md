# TGMS Platform — ARGA Governance Map

Prototipo operativo avanzado de gobernanza corporativa para Grupo ARGA Seguros.

## Requisito fundamental Supabase

Durante la fase actual de desarrollo-test-demo, `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1) es el entorno activo y fuente de verdad para desarrollo, demo y validación funcional.

Staging está preparado como capacidad futura/pre-release para E2E destructivos y aislamiento, pero no bloquea la evolución actual del prototipo. Antes de tocar Supabase hay que ejecutar `bun run db:check-target` y confirmar que el target es `governance_OS`.

Detalle: `docs/superpowers/specs/2026-05-17-governance-os-active-dev-environment-policy.md`.
