# Validación con Harvey — veredictos contrastados y traslado a las tareas (2026-10-04)

Alcance: MOI-169 (herramienta + H-02, H-09, H-14, H-17), MOI-165 (H-02A) y MOI-181 (H-11, deuda 7).
Marco: Moisés autorizó el 03-10-2026 que Harvey actúe como experto sintético con criterio, usado en su consola, y que cada matiz se contraste con el literal consolidado (DS-17). Texto cotejado: CELEX 02024R1689-20260727 en español (EUR-Lex), leído el 04-10-2026.

**Este documento es la tabla «Validación con Harvey» para volcar en el ledger del programa** (`2026-09-19-ledger-cobertura-ria.md`), que vive en la rama `aims/cobertura-ria-2026-09-19` y no está en `main`. Al incorporarse esa rama, esta tabla se copia al ledger.

## 1. Tabla de veredictos

Leyenda: **S** = el matiz o el veredicto se sostiene en el literal; **NS** = no se sostiene, no se aplica; **SC** = sin cotejar (fuente que no se ha podido leer); **AVE** = `A_VALIDAR_EXPERTO`; **CL** = `COMITE_LEGAL`.

| Lote | Punto | Veredicto de Harvey | Contraste | Estado del criterio |
|---|---|---|---|---|
| H-02 | P1 cribado 3.1 | CON MATIZ | S (3.1, cdo. 12); Directrices SC | GBM reentrenado = IA: validado. GLM/logit de coeficientes fijos fuera de 3.1: AVE; el cribado falla abierto |
| H-02 | P2 tarificación vida/salud | CORRECTO | S (anexo III 5 c, 6.3 último párrafo) | Validado. «Perfilado del art. 4.4 RGPD» es de Harvey, no del RIA |
| H-02 | P3 25.1 a) con pacto | CON MATIZ | S: el 25.1 a) dice «sin perjuicio de los acuerdos contractuales» | **No** se afirma que el pacto sea inoponible a la autoridad: CL |
| H-02 | P4 25.1 c) en uso general | CON MATIZ | S (25.1 c, anexo III 4 b) | Validado; socios sin relación laboral: AVE |
| H-02 | P5 ajuste fino | CON MATIZ | S (3.23, 25.1 b, 43.4, cdo. 128) | Umbral de un tercio solo indicativo; no se codifica «solo si» |
| H-02 | P6 6.3/6.4 del desplegador | CON MATIZ | **NS**: el 6.4 obliga al proveedor; no da derecho al desplegador | Retirada la parte «puede apoyarse (6.4)»: AVE. Registro 49.2 por el proveedor y límite del perfilado: validados |
| H-02 | P7 salvaguardias 5.1 bis a) | CON MATIZ | S (5.1 b bis/b ter son material íntimo/sexual y CSAM; 5.1 bis a) ii) exige también corregir el uso indebido) | Salvaguardias acotadas a ese material, con controles propios |
| H-02 | P8 53.1 b) | CON MATIZ | S (53.1 b, 89.2); 91 SC | Validado |
| H-02 | P9 111.2 | CRITERIOS | S: el 111.2 no define; cdo. 177 «equivalente en sustancia» a la modificación sustancial | Apoyo para CP-2: partir del cdo. 177, 3.23, 43.4 y cdo. 128. Esta vez Harvey no los trata como distintos |
| H-02 | P10 2.13 | CON MATIZ | S: «podrá limitarse», no excluye del ámbito | Corregir el texto del criterio |
| H-09 | P1 umbrales de modelo | CON MATIZ | Directrices SC (cifras fuera del RIA) | AVE antes de F10.T1 |
| H-09 | P2 26.8 | CON MATIZ | S (26.8, 49.3) | Validado: no obliga a una aseguradora privada |
| H-09 | P3 5.2-5.4 | INCORRECTO | S en la formulación (5.2/5.3/5.4 dirigen deberes a Estados y autoridades); conclusión sin cambio | Ninguna condición de 5.2-5.4 aplica a privados |
| H-09 | P4 formas societarias | CON MATIZ | S la fórmula funcional (3.3, 3.4, 2.1); Derecho de cada país SC | Elegibilidad de las formas dudosas: AVE |
| H-14 | 4, 5, 50.1/50.2, 6.4/49.2 | CON MATIZ / CORRECTO | S (111.4, 5.1 bis, 6.4, 49.2); numeración de Harvey del art. 5 errónea | Añadir 111.4; reformular «usos posibles» |
| H-14 | 25.2 | INCORRECTO | **NS**: el 25.1 c) cubre el sistema que «no haya sido considerado de alto riesgo» | Se mantiene el 25.2, acotado, y salvo advertencia del proveedor inicial |
| H-14 | Faltan 2.12, 25.4, 53-55, 95 | — | S (2.12, 25.4, 95); 54-55 SC | 2.12, 25.4 y 53-55 como condicionales; 95 como encaje del marco voluntario |
| H-14 | 17 medidas de marco operativo | CORRECTO / CON MATIZ | Cláusulas ISO SC | Todas `MARCO_OPERATIVO`; citas ISO rotuladas sin cotejar |
| H-17 | 18, 19, 26.6 no aplican | INCORRECTO (a aplicarlos) | S | Validado: sin plazo propio en el RIA |
| H-17 | 60.5 retirada del consentimiento | CON MATIZ | S: «supresión inmediata y permanente», no afecta a lo completado | Validado; **no hay plazo de quince días** |
| H-17 | Tres fases, bloqueo, art. 30 Ley 40/2015, constancia del consentimiento | CORRECTO / CON MATIZ | SC (no es del RIA) | AVE (DPO) |
| H-11 | MG_INCI_02 (73.6) | INCORRECTO | S: la salvedad es del párrafo **segundo** | **Aplicado en código** |
| H-11 | MG_INCI_01 (73.1-73.5) | CON MATIZ | S plazos 73.2-73.5; **NS** la «excepción de la Oficina de IA» | Texto sin cambio; excepción anotada para CL |
| H-11 | MG_DATA_09, MG_DATA_08, MG_RISK_08, MG_RISK_09, MG_TRANS_02/05/08, MG_ACCU_02, MG_LOGG_02 | CON MATIZ / INCORRECTO | S en todos | **Aplicado en código** |
| H-11 | MG_POST_04, MG_POST_05, MG_LOGG_06 | CON MATIZ | S (no literales) | Sin cambio: guía práctica, decide el Comité de IA |
| H-11 | MG_ISO_IMP_02 (A.5.3) | CON MATIZ | SC (norma de pago) | AVE |
| H-11 | Clasificación SENTIDO/ALCANCE | «no en bloque» | Harvey no vio el texto anterior | AVE; TERMINOLOGÍA confirmada |
| H-02A | P1, P2, P5 | CORRECTO / CON MATIZ | S (5.1 c, 5.1 d, 25.1, 53.1 b) | Sin cambio. Rótulo provisional se mantiene |
| H-02A | P3, P4 | CORRECTO / CON MATIZ | 5.1 f) y h) sin releer; cita «art. 29» → es el 26.10 | Pendiente de releer; rótulo provisional se mantiene |

## 2. Traslado a las tareas que usan cada veredicto

| Tarea / issue | Qué recibe |
|---|---|
| F4.T1 / F4.T7 (MOI-173) | H-02 P1-P8 y P10 como reglas de derivación, con las tres salvedades: pacto 25.1 a) en CL; 6.4 del desplegador en AVE; cribado de modelos fijos en AVE (falla abierto). Usar «limitación» y no «exclusión» para el 2.13 |
| CP-2 (MOI-182) | H-02 P9: partir del considerando 177 (equivalencia en sustancia), con 3.23, 43.4 y considerando 128 |
| F6.T3 (MOI-176) | H-14 completo (obligaciones, condicionales y 17 medidas de marco operativo; 25.2 se mantiene acotado) |
| F2 (MOI-170) | H-09 P4 (fórmula funcional literal; formas dudosas AVE) |
| F10.T1 y F8.T12 (MOI-180) | H-09 P1-P3 (P1 AVE); H-17: sin plazo propio en el RIA, 60.5 «inmediata y permanente» a petición |
| F4.T6 (MOI-173) | H-17: `retention_until` por tipo de registro lo fija el DPO desde el RGPD, no hay cifra del RIA |
| Deuda 7 (MOI-181) | H-11: correcciones aplicadas en `catalog-aesia.ts`; pendientes de Comité listados abajo |
| MOI-165 / MOI-166 | H-02A archivado; rótulo provisional intacto |

## 3. Pendiente de revisión humana (no se aplica nada de esto)

1. **H-02 P6**: el desplegador no puede apoyarse en el 6.4. El criterio como estaba redactado queda en AVE.
2. **H-02 P3**: efecto frente a la autoridad del pacto del 25.1 a): CL.
3. **H-02 P1**: GLM y regresión logística de coeficientes fijos; hay que leer las Directrices C(2025) 924.
4. **H-09 P1 y P4**: umbrales de las Directrices y elegibilidad de las formas societarias de seis países.
5. **H-14 25.2**: el INCORRECTO de Harvey no se aplica; si el experto lee otra cosa, se reabre.
6. **H-11**: «excepción de la Oficina de IA» en el art. 73 (Harvey la atribuye al Ómnibus; no está en el art. 73 consolidado); clasificación SENTIDO/ALCANCE; MG_POST_04/05 y MG_LOGG_06 (guía práctica); cláusulas ISO.
7. **H-17**: tres fases y bloqueo por prescripción, art. 30 Ley 40/2015, conservación de la constancia del consentimiento frente a «supresión inmediata y permanente» (DPO).
8. **H-02A**: releer 5.1 f) y h).
9. Todos los veredictos son de un asistente de IA; el cotejo es de TGMS con Harvey como segunda lectura y no equivale a un tercero experto independiente (lo dice el propio Harvey en H-11).
10. En los cinco lotes Harvey declaró que no pudo leer artículos que citó; los literales los leyó este contraste.

## 4. Quién envía cada lote (tabla de MOI-169) y disparador de H-13

| Lote | Envía | Estado |
|---|---|---|
| H-01 | — | Respondido el 19-09 |
| H-02A | — | Respondido el 19-09, archivado el 04-10 |
| H-02, H-09, H-14, H-17 | MOI-169 | Respondidos el 04-10 |
| H-11 | MOI-181 (lo envió MOI-169 por orden de Moisés) | Respondido el 04-10 |
| H-03 | MOI-171 | Pendiente |
| H-04 | MOI-177 (F11.T1) y MOI-217 (F11.T3), cada uno para sus sistemas | Pendiente |
| H-05 | — | Cerrado por H-01 |
| H-06 | MOI-213 | Pendiente |
| H-07 | MOI-180 | Pendiente |
| H-08 | MOI-179 | Pendiente |
| H-10 | MOI-176 y MOI-180, cada uno para sus plantillas | Pendiente |
| H-12 | La tarea que cierra cada fase (MOI-171, 173, 212, 213, 180) | Pendiente |
| H-13 | Sin tarea fija | **Disparador**: cambia el texto consolidado de CELEX 02024R1689 o las Directrices de la Comisión; se reenvían las filas afectadas con su criterio vigente y sube `catalog_version`. Hoy no se envía |
| H-15 | MOI-180 | Pendiente |
| H-16 | MOI-178 | Pendiente |

## 5. Hecho técnico: cómo se enviaron

`scripts/aims/harvey/enviar-lote.ts <H-nn>` genera el prompt desde la especificación §9 (el catálogo TS del programa no está en esta rama), calcula el SHA-256 y escribe el fichero que se pega. En la consola se seleccionó la fuente «Unión Europea», se pegó el texto con un evento de pegado (no tecleado) y la propia página comprobó el SHA-256 antes de enviar. Si el SHA no coincidía, no se enviaba.
