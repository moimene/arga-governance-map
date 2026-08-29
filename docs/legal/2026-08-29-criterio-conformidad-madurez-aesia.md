# Criterio de conformidad sobre la escala de madurez de la Guía 16 de AESIA

**Fecha:** 2026-08-29 · **Carril:** C2 · AI Governance (G7/AIMS) · **Tarea:** A2
**Decisión tomada, no consultada.** Elevada al usuario por la orquestación con su coste de reversión.
**Coste de revertir: un `Set`** — `NIVELES_CONFORMES` en `src/lib/aims/evaluacion-payload.ts`.

---

## 1. El hecho

El autodiagnóstico AESIA valora cada una de las 84 Medidas Guía en una escala de ocho niveles.
Al persistir el resultado, el código clasificaba cada requisito como `CONFORME` o `NO_CONFORME`
tratando como brecha **únicamente** los niveles `L1`, `L2` y `L6`.

Consecuencia directa: **un requisito contestado íntegramente con `L3` se persistía como `CONFORME`.**

## 2. Los ocho niveles, con su título literal

Transcritos de `src/lib/aims/catalog-aesia.ts` (`MATURITY_LEVELS`), que es la fuente que usa el
producto:

| Nivel | Título literal | Plan asociado | ¿Documentada? | ¿Implementada? |
|---|---|---|---|---|
| `L1` | No documentada ni implementada | Documentar e Implementar | No | No |
| `L2` | Documentación en curso, no implementada | Documentar e Implementar | En curso | **No** |
| `L3` | **Documentada, no implementada** | Implementar | Sí | **No** |
| `L4` | Documentada, implementación en curso | Implementar | Sí | **En curso** |
| `L5` | **Documentada e implementada** | Adaptación Completa | Sí | Sí |
| `L6` | No documentada e implementada | Documentar | **No** | Sí |
| `L7` | Documentación en curso e implementada | Documentar | **En curso** | Sí |
| `L8` | **Medida no necesaria para el sistema** | Ninguna acción | n/a | n/a |

## 3. El criterio adoptado

> **Sólo `L5` y `L8` acreditan conformidad. Cualquier otro nivel es brecha.**

- **`L5`** es el único nivel en que la medida está a la vez documentada e implementada.
- **`L8`** no es conformidad por cumplimiento sino por **no aplicabilidad**: la medida no es
  necesaria para ese sistema, de modo que no hay nada que acreditar. Se cuenta como no-brecha, no
  como cumplimiento positivo.
- `L3`, `L4` y `L7` **no** acreditaban brecha en el código anterior y ahora sí. Los tres tienen algo
  sin terminar según su propio título: `L3` y `L4` no están implementadas o lo están a medias;
  `L7` está implementada pero sin documentar del todo, y el art. 11 y el anexo IV del Reglamento
  (UE) 2024/1689 hacen de la documentación técnica un requisito autónomo, no un accesorio.

## 4. Por qué se enumera lo que acredita y no lo que falla

El código anterior tenía una **lista de exclusiones** (`L1`, `L2`, `L6` fallan; el resto pasa). Una
lista así envejece hacia el falso verde: si mañana la Guía añade un nivel, entra como conforme sin
que nadie lo decida.

La lista de inclusiones (`L5`, `L8` acreditan; el resto no) envejece en la dirección contraria: un
nivel nuevo será **brecha por defecto** hasta que alguien lo estudie. Es el mismo patrón
*fail-closed* que las materias SLP del tenant Garrigues.

## 5. Alcance y límites

- Es un criterio **de producto sobre cómo se persiste** el resultado de un autodiagnóstico interno.
  **No es un dictamen sobre el Reglamento** ni sobre la Guía 16, y no afirma nada frente a AESIA.
- No cambia la escala, ni los planes de adaptación, ni el cálculo de la puntuación de madurez.
  Cambia **una sola cosa**: qué niveles permiten escribir `CONFORME` en un requisito.
- Es la dirección **conservadora**: nunca sobre-afirma conformidad. Puede marcar como brecha algo
  que un criterio más laxo daría por bueno; el error, si lo hay, cae del lado de exigir de más.

## 6. Cómo revertirlo

`src/lib/aims/evaluacion-payload.ts`:

```ts
const NIVELES_CONFORMES = new Set(["L5", "L8"]);
```

Añadir o quitar niveles de ese `Set` es todo el cambio. Los tests
`src/lib/aims/__tests__/evaluacion-payload.test.ts` enumeran nivel a nivel el resultado esperado,
de modo que cualquier cambio del criterio falla en un test que dice exactamente qué nivel cambió.

## 7. Referencias

- `src/lib/aims/catalog-aesia.ts` — `MATURITY_LEVELS`, fuente de los títulos transcritos en §2.
- `src/lib/aims/evaluacion-payload.ts` — implementación del criterio.
- `.superpowers/sdd/2026-08-29-c2-ai-governance-garrigues/progress.md` — traza de la tarea A2.
