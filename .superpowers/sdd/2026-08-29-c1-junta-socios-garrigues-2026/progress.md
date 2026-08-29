# Ledger SDD — C1 · Junta General de Socios de Garrigues (06/05/2026)

**Plan:** `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`
**Rama:** `feature/c1-secretaria-caso-canonico` desde `1888aa0`
**Worktree aislado:** `/private/tmp/c1-secretaria` (autorizado por el usuario 2026-08-29 vía orquestador)

## Entorno de medición

`node_modules`, `version garrigues` y `supabase/.temp` **enlazados** desde el árbol compartido; `.env` **copiado**.
Consecuencia: el gate `g5-mapa-penal` SÍ corre aquí (encuentra los PDF) y `VITE_SUPABASE_ANON_KEY` está presente.
**Listón aplicable a este worktree: 0 fail, ≥ 3461 pass / 152 skip** (el lado "con carpetas fuente").

## Incidentes de proceso

| Fecha | Incidente | Resolución |
|---|---|---|
| 2026-08-29 | Creé `feature/c1-junta-garrigues-2026` con `checkout -b` **en el directorio compartido**, moviendo el HEAD de los tres carriles durante ~15 min. Lo cazó C3/GRC. | Revertido antes de cualquier commit (`checkout main` + `branch -D`). Cero commits, cero Cloud. Trabajo trasladado a este worktree aislado. |

## Decisiones del usuario consumidas por este carril

1. **Antelación del CdA de EAD Trust = 5 días, confirmados** como práctica de la entidad. No se convierte en cita legal de plazo. Sube versión de pack. (`docs/legal/2026-08-29-…`)
2. **Capital de la matriz → FIRME** por el art. 7 de los Estatutos. (ídem)
3. **Alcance del caso canónico = cobertura acreditada, 10 acuerdos** (2026-08-29, en esta sesión, con coste medido de las 4 opciones).
4. **Base de cómputo del voto en la Junta = votos de clase A no autocartera (16.900)** (2026-08-29). Ver "Parada" abajo.

## Parada reportada — la regresión del 0,8875 % no cuadra sobre la base completa

Verificado antes de escribir una línea de seed:

```
votos totales      = 694×25 + 8×1        = 17.358
autocartera        = 18×25               =    450   → 450/17.358 = 2,5925 %  ✓ (acta: 2,59 %)
base completa      = 17.358 − 450        = 16.908
base solo clase A  = (694−18)×25         = 16.900
3 presenciales     = 3 × 2A × 25         =    150
  150 / 16.908 = 0,887154 %  → 0,8872 %   ✗  (acta: 0,8875 %)
  150 / 16.900 = 0,887574 %  → 0,8875 %   ✓  (y complemento 99,1124 % ≈ 99,1125 % del acta)
```

La estructura de clases **no** es el problema: capital 11.104.008 € = registral, 338+8 = 346 = censo del acta, y autocartera 2,59 %. El residuo son exactamente los 8 votos de clase B (0,047 % de la base). El 2,59 % **no discrimina** entre las dos bases.

Reportado al orquestador y elevado al usuario, que decidió la base de clase A **documentada**, sin afirmar que la clase B carezca de voto.

## Tareas

| # | Tarea | Estado | Review adversarial | Gates |
|---|---|---|---|---|
| 1 | `GARR_CONSEJO_EAD` → v1.1.0 | **COMPLETA** ([informe](task-1-report.md)) | 4 P1 + 9 P2; los 4 P1 corregidos | 3468/152/0 · lint 0 · tsc 0 · build OK, en `/private/tmp/c1-secretaria` con carpetas fuente |
| 2 | Estructura art. 7 como módulo puro + regresión | **COMPLETA** ([informe](task-2-report.md)) | 12 mutantes, 2 escapaban (ambos cerrados) + 1 P1 + 5 P2 | 20 pass / 0 fail en el fichero; suite completa en el reporte de merge |
| 3 | Capital de la matriz a FIRME en Cloud | **COMPLETA** ([informe](task-3-report.md)) | 2 P1 + 9 P2; 4 mutantes escapaban, los 4 cerrados | 46 pass / 0 fail en los 4 ficheros de capital; suite completa en el reporte de merge |
| 4 | Convocatoria 21/04 → 06/05 con los 12 puntos reales | pendiente | — | — |
| 5 | Reunión, asistencia y censo WORM | **BLOQUEADA** — no se crea `censo_snapshot` hasta resolver la magnitud de `parte_votante_current` (ver `docs/legal/…-base-computo…` §7) | — | — |
| 6 | Los 10 acuerdos con resolución por materia | pendiente | — | — |
| 7 | Resoluciones y votaciones | pendiente | — | — |
| 8 | Acta por RPC + certificación sin VºBº | pendiente | — | — |
| 9 | Ciclo registral (13/07/2026, anuncios 960 y 961) | pendiente | — | — |
| 10 | Verificación viva, control ARGA y cierre | pendiente | — | — |
