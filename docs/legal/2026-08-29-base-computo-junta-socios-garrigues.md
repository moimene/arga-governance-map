# Criterio de cómputo de la base de voto de la Junta de Socios de J&A Garrigues, S.L.P.

**Fecha:** 2026-08-29 · **Decisor:** el usuario (OF COUNSEL de Garrigues) · **Ejecuta:** carril C1 (Secretaría).
**Origen:** parada obligatoria del carril C1 al ejecutar la Decisión B de `docs/legal/2026-08-29-decisiones-capital-firme-y-consejo-ead.md` (capital de la matriz a FIRME por el art. 7 de los Estatutos).
**Fuente del dato de contraste:** certificado del acta de la Junta de Socios de 06/05/2026 (depósito de cuentas anuales consolidadas 2025, Registro Mercantil de Madrid; documento público).

---

## 1. Por qué existe este registro

La Decisión B fijó una regresión obligatoria: *"los 3 socios presenciales de la Junta suman 0,8875 % de los derechos de voto según el acta. Con la estructura nueva debe seguir cuadrando; si no cuadra, **parar y reportar** — sería señal de que el reparto por clases no es el supuesto."*

Al aplicar la estructura del art. 7, **no cuadra sobre la base íntegra de votos**. Se paró, se aisló el residuo al decimal y se elevó. Este documento deja escrita la aritmética completa, no solo la conclusión: quien lo lea dentro de seis meses debe poder rehacer el razonamiento sin volver a descubrirlo.

## 2. La aritmética completa

Estructura del art. 7 de los Estatutos:

| Clase | Participaciones | Nominal | Votos por participación | Votos de la clase |
|---|---|---|---|---|
| **A** | 694 | 16.000 € | 25 | 17.350 |
| **B** | 8 | 1 € | 1 | 8 |
| | | | **Total** | **17.358** |

```
capital           = 694 × 16.000 + 8 × 1                  = 11.104.008 €
votos totales     = 694 × 25     + 8 × 1                  =     17.358
autocartera       = 18 participaciones A × 25 votos       =        450
base ÍNTEGRA      = 17.358 − 450                          =     16.908
base SOLO CLASE A = (694 − 18) × 25                       =     16.900
3 presenciales    = 3 socios × 2 participaciones A × 25   =        150
```

Contraste con las dos cifras que el acta declara:

| Magnitud del acta | Sobre base **íntegra** (16.908) | Sobre base **solo clase A** (16.900) | Acta |
|---|---|---|---|
| Presenciales | `150 / 16.908` = **0,887154 %** → 0,8872 % ✗ | `150 / 16.900` = **0,887574 %** → **0,8875 %** por truncamiento ✓ | **0,8875 %** |
| Representados | 99,112846 % | 99,112426 %, y `100 − 0,8875` = **99,1125 %** ✓ | **99,1125 %** |
| Autocartera | `450 / 17.358` = 2,5925 % → 2,59 % ✓ | `450 / 17.350` = 2,5937 % → 2,59 % ✓ | **2,59 %** |

**El 2,59 % de autocartera no discrimina entre las dos bases: redondea a 2,59 % con cualquiera de ellas.** La única magnitud que separa las dos lecturas es el 0,8875 % de los presenciales, y separa a favor de la base de clase A.

## 3. Qué NO es el problema

La estructura de clases queda confirmada por otras tres comprobaciones que cuadran **exactas** e independientes entre sí:

1. **Capital.** 694 × 16.000 + 8 × 1 = **11.104.008 €**, idéntico al capital registral inscrito el 24/04/2026 (BORME 212100, I/A 952).
2. **Censo.** Socios de cuota = (694 − 18) / 2 = **338**; socios de clase B = **8**; total = **346**, el censo exacto que declara el acta.
3. **Autocartera.** 18 participaciones = 2,59 % de los derechos de voto, el porcentaje literal del acta.

Que tres fuentes independientes se deriven de la misma estructura del art. 7 es lo que descarta que el reparto por clases sea el supuesto equivocado. **El residuo son exactamente los 8 votos de clase B: el 0,047 % de la base.**

## 4. Decisión

**La base de cómputo de la Junta es la de los votos de clase A no autocartera: 16.900.**

Confirmada por el usuario el 2026-08-29 («OK PARA C1 16900 votos»). Alcance y límites:

- Es un **criterio de cómputo declarado**, no una afirmación sobre el régimen de voto de la clase B. **El art. 7 da 1 voto por participación de clase B** y el modelo los cuenta: `votosTotales()` devuelve 17.358.
- La desviación **se escribe, no se esconde.** El módulo `scripts/garrigues/capital/estructura-art7.ts` expone también `baseComputoTodasLasClases()` = 16.908, y el test `src/test/schema/capital-art7.test.ts` asierta explícitamente que sobre esa base saldría 0,8872 % y que la diferencia entre ambas bases es de 8 votos.
- El criterio queda persistido en el expediente: `meetings.quorum_data.base_computo = "VOTOS_CLASE_A_NO_AUTOCARTERA"` con `base_votos = 16900`.
- **No se extiende a otros órganos ni a otras juntas.** Rige el cómputo de asistencia y mayorías de la Junta de Socios de la matriz reproducida en el caso canónico.

## 5. Lo que sigue sin ser público

El emparejamiento **socio ↔ participación numerada** no consta: el Anexo 2 del acta no está transcrito. Lo FIRME es la **estructura** — clases, nominales, votos, número de titularidades por clase y autocartera. Qué socio concreto tiene qué participación, y cuáles son los 8 titulares de clase B, se etiqueta `INFERIDO` en cada fila (`capital_holdings.metadata.asignacion_clase`). **No se inventan números de participación por socio.**

## 6. Alcance del artefacto

Reconstrucción demo sin efecto jurídico. El expediente real de la Junta de 06/05/2026 existe en el Registro Mercantil; la plataforma lo reproduce, no lo sustituye.
