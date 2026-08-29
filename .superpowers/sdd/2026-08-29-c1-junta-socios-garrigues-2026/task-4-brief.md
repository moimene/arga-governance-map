# Task 4 — La convocatoria del 21/04/2026 con los 12 puntos reales

Pasos y aserciones en `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`,
sección `## Task 4`. La tabla de los 12 puntos y su tratamiento está en la sección
"## Los 12 puntos reales del orden del día y su tratamiento" del mismo plan — **es vinculante**.

## Lo que NO puedes hacer y por qué

**Los 12 puntos son los REALES de la Junta de Socios de Garrigues del 06/05/2026.** No son los de
una Junta ordinaria genérica de SA. Un informe previo los describió como «aprobación de cuentas,
informe de gestión, reelección de consejeros» y esa descripción es **falsa**: con esos puntos el caso
canónico no ejercitaría ninguna de las 6 materias SLP que G3 construyó ni dispararía el gate del
informe preceptivo del Consejo de Socios. Copia los títulos de la tabla del plan, que salen del
certificado del acta vía spec §3.6.

**Alcance decidido por el usuario (2026-08-29): cobertura acreditada, 10 acuerdos.** Los 3 puntos sin
materia acreditada —toma de participación en el Centro de Estudios, estado de información sobre
sostenibilidad, informe de gestión— **figuran en el orden del día** con su nota visible y **no se
materializan como acuerdo**. Crear su materia exigiría clasificación legal nueva, que es dictamen del
Comité Legal y no seed. Esta tarea solo escribe la convocatoria; los acuerdos son la Task 6.

## Estado de Cloud, medido

- `convocatorias` del tenant Garrigues: **0 filas**. ARGA tiene 59 — mira una suya para copiar la
  **forma** de `agenda_items` y de `rule_trace`, no el contenido.
- El órgano es `garrigues-junta-socios`. **Resuélvelo por slug, nunca hardcodees el UUID.**
- El pack aplicable es `GARR_JUNTA_SOCIOS` v1.1.0, con `antelacionDias.SLP = 15` y canal
  `COMUNICACION_INDIVIDUAL_CON_ACUSE`, citando `arts. 27.4 Estatutos y 176 LSC (supletoria)`.

## Lo que un revisor adversarial va a intentar romper

1. **Que afirmes envío, entrega, acuse o interacción con EAD Trust.** `publication_channels` describe
   el **canal estatutario del acto real**, nada más. Si el seed escribe cualquier campo de evidencia
   de envío, se retira. Política vigente 2026-07-21.
2. **Que los 15 días sean un literal en vez de derivarse.** 21/04 → 06/05 son 15 días. El test debe
   calcularlo de las dos fechas, no escribir `15`.
3. **Que los 3 puntos sin materia se cuelen como acuerdos** o pierdan su nota. El test los cuenta y
   comprueba el texto de la nota.
4. **Que el test pase en vacío.** Nada de `if (!cliente) return;` dentro de un `it`: vitest ejecuta
   el cuerpo, no encuentra aserciones y reporta PASS. Anon key con la cadena
   `VITE_SUPABASE_ANON_KEY || ANON_PUBLIC || <literal real, cópialo de otra sonda>`, cliente con
   `{ auth: { persistSession: false } }`, y si no hay sesión que **reviente**.
5. **Que el seed no sea idempotente.** Dos ejecuciones = 1 convocatoria, no 2.
6. **Que el orden del día sea una lista de strings.** Tiene que ser estructura: número, título,
   materia (o `null`), si materializa acuerdo, y la nota cuando proceda — para que la Task 6 pueda
   enlazar cada acuerdo con su punto por una arista real y no por coincidencia de texto.
7. **Que `statutory_basis` o el canal citen la Ley 2/2007 para el plazo.** No lo regula. La cita es
   `arts. 27.3 y 27.4 de los Estatutos; art. 176 LSC (supletoria)`.

## Límites

- **NO ejecutas NADA que escriba en Cloud.** Dry-run del seed sí; `bun test` sí (lee). El pase lo hace
  el controller tras revisar el dry-run.
- **NO toques** `scripts/garrigues/capital/**`, `scripts/seed-garrigues-capital.ts` ni nada de ARGA.
- **NO crees `censo_snapshot` ni `meetings`.** Son Task 5 y **Task 5 está BLOQUEADA** por una decisión
  legal pendiente. Esta tarea termina en la convocatoria.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`.
