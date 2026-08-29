# Task 2 — La estructura del art. 7 como módulo puro, con la regresión del acta dentro

Los pasos, el código del módulo, el código del test y el SQL de la migración están en
`docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`, sección "## Task 2".
Léela entera antes de escribir nada.

## Contexto que no está en el plan

La decisión legal que sostiene esta tarea ya está registrada y **confirmada por el usuario**:
`docs/legal/2026-08-29-base-computo-junta-socios-garrigues.md`. Léelo: trae la aritmética
completa, las dos bases candidatas, y por qué la estructura de clases NO es el problema.
**No re-litigues la decisión.** Tu trabajo es implementarla de forma que la desviación quede
escrita, no escondida.

Lo autorizado por el orquestador para el `ALTER TABLE share_classes`, con cuatro condiciones:
columnas **NULLABLE**, forward-only con espejo en `supabase/migrations/`, versión registrada a
mano (lo hace el controller), y **probe declarado antes de escribir en Cloud** (lo hace el
controller). Head remoto ahora: `20260829120000`.

## Lo que un revisor adversarial va a intentar romper

1. **Que el test de la regresión pueda pasar sin asertar.** Es el corazón de la tarea. Si el
   bloque "REGRESIÓN OBLIGATORIA" se puede satisfacer con el módulo devolviendo basura, no
   sirve. El test es puro: no hay red, no hay skip posible, no hay `|| ""`.
2. **Que hayas escondido la desviación.** El test DEBE asertar explícitamente que sobre la base
   íntegra de 16.908 sale 0,8872 %, y que la diferencia entre las dos bases son 8 votos. Si eso
   no está, has escondido el problema en vez de documentarlo.
3. **Que hayas afirmado que la clase B no vota.** El art. 7 le da 1 voto por participación.
   `votosTotales()` cuenta 17.358, incluidos esos 8. La base de 16.900 es un **criterio de
   cómputo declarado**, no una afirmación sobre el régimen de voto.
4. **Que hayas inventado números de participación por socio.** No los hay: el Anexo 2 del acta
   no está transcrito. Lo FIRME es la estructura. La asignación socio↔clase va etiquetada
   `INFERIDO` en todas las filas y el test lo asierta.
5. **Que la elección de los 8 titulares de clase B no sea determinista.** Dos ejecuciones del
   seed deben producir el mismo reparto, o el expediente cambia solo.
6. **Que ARGA pueda recibir valores en las columnas nuevas.** La migración lo asierta con
   `RAISE EXCEPTION`.
7. **Que `TITULOS_POR_SOCIO_CUOTA` o `SOCIOS_CUOTA` estén escritos a mano** en vez de derivados.
   `SOCIOS_CUOTA` sale de `(694 − 18) / 2`; si alguien cambia la autocartera, debe recalcularse.

## Comprobación previa obligatoria

Antes de escribir el test, **verifica que `scripts/garrigues/censo/socios-acta-2026-05-06.json`
tiene 3 presenciales y 343 representados**, y mira la forma exacta de esas entradas (¿strings
sueltos u objetos?). El plan asume strings. Si no lo son, adapta `repartirCenso` y dilo.

## Límites

- **NO ejecutas NADA contra Cloud.** Ni `supabase db query`, ni `db push`, ni seeds con `--commit`.
  El test de esta tarea es puro y no necesita red. El controller aplica la migración.
- **NO toques `scripts/seed-garrigues-capital.ts`** — es la Task 3.
- **NO hagas commit.** El controller revisa el diff.
- `git add` nunca con `-A`. Ignora `?? "version garrigues"`: es un symlink deliberado.
- Trabajas en `/private/tmp/c1-secretaria`, rama `feature/c1-secretaria-caso-canonico`.
