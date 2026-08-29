# Task 6 — Los acuerdos de la Junta, con su regla

Pasos y aserciones: sección `## Task 6` del plan. **Léela, pero el contexto de abajo la corrige en
varios puntos.**

## Lo que ha cambiado desde que se escribió el plan

1. **NO hay rule packs genéricos.** `rule_packs` es tenant-scoped y `MODIFICACION_ESTATUTOS`,
   `APROBACION_CUENTAS`, `NOMBRAMIENTO_AUDITOR` y `DELEGACION_FACULTADES` **solo existen en ARGA**, que
   el RLS aísla. Verificado con login real. El plan las llamaba «genéricas» y eso es falso.
2. **Los Estatutos SÍ regulan esas materias**, por la cláusula general del **art. 30.1**, cuyo literal
   entregó el usuario:

   > «Para que los acuerdos sean aprobados por la Junta de Socios será necesario, sin perjuicio de las
   > mayorías que la Ley de Sociedades Profesionales o la Ley de Sociedades de Capital establecen como
   > inmodificables y las mayorías que se establecen en los apartados siguientes, **el voto favorable de
   > la mayoría de los votos correspondientes en cada caso a las participaciones sociales en las que se
   > divide el capital social**.»

   **Ojo a la base:** es mayoría de los votos **del capital**, no de los votos emitidos. No es el art.
   198 LSC. **Citar la supletoria de la LSC sería atribuir a la ley lo que dicen los Estatutos**, y con
   otra base de cómputo.
3. **`MODIFICACION_ESTATUTOS` está BLOQUEADA.** El art. 30.2(f) exige 2/3 solo para la modificación de
   **quince artículos enumerados** (1, 2, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 26, 42 y 47) — no hay
   categoría abstracta de «artículos nucleares». Y **el art. 36 no existe en el documento entregado**:
   la secuencia salta de 35 a 37. El punto 1.1 del orden del día queda **fuera** de esta tarea hasta que
   el usuario lo resuelva. **El caso queda en 9 acuerdos, no 10.**
4. **`NOMBRAMIENTO_ADMINISTRADOR_UNICO` ya no necesita inferencia:** art. 30.2(a), **2/3**, acreditado.
5. **El punto 12 es acuerdo de cobertura.** Art. 31.3 literal: la elevación a instrumento público
   «corresponde a las personas que tienen facultad para certificarlos. **También podrá realizarse por
   cualquiera de los administradores sin necesidad de delegación expresa**». Con administrador único que
   además certifica, **la delegación no es necesaria**. El acuerdo existió —está en el certificado— pero
   se modela **diciendo eso**, no dándole un contenido que no tiene.
6. **El voto va por el camino de CLIENTE** (decisión del usuario). Task 7. Aquí no evalúas votaciones.

## Timestamp asignado

**`20260829170000`** para la migración de los 3 packs. Head actual: `20260829160000`. **Regístrala y
verifícala leyendo la fila por su `name`, nunca con `max(version)`.**

## Estado de Cloud, medido

- `agreements` del tenant Garrigues: **0**. `meetings`: **1** (`e0beed92-…`, DRAFT).
  `censo_snapshot`: 1 (ECONOMICO, 347 partes). `convocatorias`: 1, con 14 entradas de orden del día.
- El orden del día vive en `scripts/garrigues/junta-2026/orden-del-dia.ts`, con `numero` por punto.
- Los 6 packs por materia SLP ya existen y resuelven **por materia**, sin fallback a órgano.

## Lo que un revisor adversarial va a intentar romper

1. **Que inventes una mayoría.** Todo lo que se cite tiene que estar en el literal del art. 30.1, 30.2 o
   30.3 que trae este brief. Si algo no está, **no se cita: se dice que no consta**.
2. **Que `matter_class` o `inscribable` se escriban a mano** en vez de leerse de `materia_catalog`.
3. **Que el enlace punto↔acuerdo sea coincidencia de texto.** Comprueba la columna real
   (`agreements.agenda_item_id` es `uuid`; el puente de la convocatoria es
   `source_convocatoria_item_index`, entero). **Averigua cuál es la arista real antes de escribir.**
4. **Que el gate `INFORME_PRECEPTIVO_ORGANO` no dispare, o dispare de más.** Debe salir en las 4
   materias configuradas (admisión, exclusión, continuidad, nombramiento de administrador único) y **no**
   en las otras. Control discriminante obligatorio: sin él, «el gate funciona» solo significa «el panel
   se pinta siempre».
5. **Que el pack resuelto no sea el de materia.** Las 6 SLP deben resolver a su pack por materia, no a
   `GARR_JUNTA_SOCIOS`.
6. **Que la sonda pase en vacío.** Anon key `VITE_SUPABASE_ANON_KEY || ANON_PUBLIC || <literal>`,
   `{ auth: { persistSession: false } }`, **prohibido** `if (!cliente) return;` dentro de un `it`.
7. **Que el texto de un acuerdo afirme más de lo que el certificado dice.** Los acuerdos no transcritos
   se modelan **sin identificar personas** y marcados `INFERIDO` en `compliance_explain`.

## Límites

- **NO escribes en Cloud.** Dry-run y `bun test` sí. El controller aplica.
- **NO toques** `scripts/garrigues/capital/**`, `seed-garrigues-capital.ts`, ni nada de ARGA.
- **NO siembres `MODIFICACION_ESTATUTOS`** ni su acuerdo.
- **NO crees `meeting_resolutions` ni `meeting_votes`** — Task 7.
- **NO hagas commit** ni `git add`.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`.
