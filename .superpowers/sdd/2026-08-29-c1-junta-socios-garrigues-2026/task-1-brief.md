# Task 1 — `GARR_CONSEJO_EAD` sube a v1.1.0

Ver `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`, sección "Task 1", para los pasos completos, el JSON exacto de `antelacionConsejo` y el código de los dos tests.

## Contexto que no está en el plan

El usuario es consejero de EAD Trust y ha **confirmado los 5 días de antelación como práctica real de la entidad** (registro: `docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-ead.md`, Decisión A). Lo que se retira es el **marco** de "valor de referencia sin verificar", no el valor ni la cita.

## Lo que un revisor adversarial va a intentar romper

1. Que hayas tocado `convocatoria.antelacionDias.SA/.SL`. **No se tocan.** `valor:5`, `fuente:"ESTATUTOS"`, `referencia:"art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"` quedan byte a byte iguales. Convertir el 5 en cita de plazo es exactamente lo prohibido.
2. Que hayas reescrito el payload a mano en vez de copiarlo. **Cópialo** desde `supabase/migrations/20260804070000_g3_garrigues_rule_packs.sql` línea 101 y añádele SOLO la clave nueva. Cualquier diferencia accidental es un cambio de regla no autorizado.
3. Que hayas mutado la fila v1.0.0. Solo se le cambian `is_active` y `status`; su `payload` no se toca.
4. Que el test pase por **skip**. Un skip aquí es fallo: significaría que la sonda no autentica.

## Límites

- **NO ejecutas nada contra Cloud.** Ni `supabase db query`, ni `db push`, ni seeds con `--commit`. El controller aplica.
- `git add` solo con las tres rutas del plan. Nunca `-A`.
- Trabajas en `/private/tmp/c1-secretaria` (worktree aislado, rama `feature/c1-secretaria-caso-canonico`).
