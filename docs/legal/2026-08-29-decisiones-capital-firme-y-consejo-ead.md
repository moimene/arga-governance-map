# Decisiones del usuario — capital de la matriz a FIRME y antelación del CdA de EAD Trust

**Fecha:** 2026-08-29 · **Decisor:** el usuario (OF COUNSEL de Garrigues, consejero de EAD Trust) · **Consume:** carril C1 (Secretaría).
Cierra las dos decisiones que quedaban abiertas al final de G3 (ver `docs/superpowers/reviews/2026-08-29-estatus-programa-garrigues-y-relevo.md` §7).

---

## Decisión A — Antelación de convocatoria del Consejo de Administración de EAD Trust

**Resuelta: 5 días.** El valor que el pack `GARR_CONSEJO_EAD` llevaba como *placeholder no verificado* queda **confirmado como práctica real** por el propio consejero de la entidad.

Consecuencias para el dato:

- `convocatoria.antelacionDias` de `GARR_CONSEJO_EAD` mantiene `valor: 5`, pero **deja de estar etiquetado como placeholder**: se retiran las notas de "no verificado" en el payload (migración y seed espejo).
- `fuente` permanece `"ESTATUTOS"` y la referencia sigue siendo `"art. 246 LSC — sin plazo legal mínimo; convocatoria por el presidente"`: la LSC no fija plazo para el Consejo, de modo que el 5 es práctica societaria de la entidad, no suelo legal. **No convertir esto en una cita legal de plazo.**
- La versión del pack sube (`1.1.0`) por cambio de contenido; **nunca se muta una versión ya aplicada** — INSERT de la nueva + desactivación de la anterior, patrón de G3 Task 5.

---

## Decisión B — Capital de la matriz: de INFERIDO a FIRME (art. 7 de los Estatutos)

**Autorizada.** El art. 7 de los Estatutos vigentes da la estructura exacta, y con ella el capital deja de necesitar simulación.

### Estructura estatutaria

| Clase | Participaciones | Nominal | Votos/participación |
|---|---|---|---|
| **A** | 694 | 16.000 € | 25 |
| **B** | 8 | 1 € | 1 |

Un **Socio de Cuota** ostenta **2 participaciones de clase A**.

### Comprobación aritmética (cuatro fuentes independientes cuadran)

```
capital       = 694 × 16.000 + 8 × 1 = 11.104.008 €   ← idéntico al capital registral (BORME 24/04/2026)
votos totales = 694 × 25     + 8 × 1 = 17.358
autocartera   = 18 A = 450 votos = 450/17.358 = 2,5925 %  ← el 2,59 % que declara el acta
socios cuota  = (694 − 18) / 2 = 338
socios clase B= 8
TOTAL socios  = 338 + 8 = 346                          ← el censo exacto del acta 06/05/2026
```

Que el capital registral, el porcentaje de autocartera del acta y el censo de 346 socios se deriven **los tres** de la misma estructura del art. 7 es la validación cruzada que faltaba. **La distribución deja de ser `INFERIDO`.**

### Instrucciones para la implementación (C1)

1. **`share_classes`:** dos clases reales de la matriz — A (nominal 16.000 €, 25 votos) y B (nominal 1 €, 1 voto). Hoy hay una sola clase A genérica.
2. **`capital_holdings`:** 338 titularidades de 2×A + 8 de 1×B + la fila de autocartera con 18 A e `is_treasury = true` (regla canónica: `voting_weight` y `denominator_weight` a 0). Suma de participaciones = 694 A + 8 B; suma de porcentaje = 100 %.
3. **Procedencia:** `metadata.confianza` pasa de `INFERIDO` a **`FIRME`**, con `fuente: "art. 7 de los Estatutos Sociales"`. Retirar de la UI cualquier etiqueta de peso simulado para la matriz.
4. **Reparto nominativo:** la asignación de *qué* socio concreto tiene qué participación **sigue sin ser pública** (el Anexo 2 del acta no está transcrito). Lo FIRME es **la estructura**: clases, nominales, votos, número de titularidades por clase y autocartera. El emparejamiento socio↔participación numerada continúa etiquetado como no acreditado. **No inventar números de participación por socio.**
5. **`parte_votante`:** refrescar por la RPC canónica tras el cambio y verificar que el denominador de votos pasa a 17.358 y que la autocartera queda excluida del cómputo (2,59 %).
6. **Regresión obligatoria:** los 3 socios presenciales de la Junta suman 0,8875 % de los derechos de voto según el acta. Con la estructura nueva debe seguir cuadrando; si no cuadra, **parar y reportar** — sería señal de que el reparto por clases no es el supuesto.

### Efecto sobre el caso canónico

Con el capital FIRME, el quórum y las mayorías de la Junta de 2026 dejan de calcularse sobre pesos simulados: la doble mayoría del art. 15 Ley 2/2007 (capital + socios profesionales) y el 80 % del art. 30.3.b pasan a computarse sobre derechos de voto reales. Es lo que hace defendible el caso canónico ante un mercantilista.
