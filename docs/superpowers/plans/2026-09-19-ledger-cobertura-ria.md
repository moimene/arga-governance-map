# Ledger — programa de cobertura RIA de AIMS 360 (Garrigues y ARGA, demostrador interno)

- **Encargo del usuario (19-09-2026):** cubrir todos los gaps del análisis de la visión del experto
  RIA (`docs/superpowers/reviews/2026-09-19-vision-ria-experto-vs-aims.md`); sistemas internos de
  Garrigues y ARGA en modo demostrador; integrar sistemas y módulos todo lo posible; **el experto
  manda en criterios**; **Harvey valida** los criterios del demostrador (consulta por consola
  autorizada por el usuario).
- **Especificación:** `docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md`
  (v2 + 14 enmiendas vinculantes del §14). 140 gaps canónicos (GC-01…GC-140), 130 tareas en
  12 fases (F0-F11), matriz de trazabilidad completa.
- **Rama:** `aims/cobertura-ria-2026-09-19`, en el worktree `/private/tmp/aims-cobertura`
  (el árbol compartido queda en `main`: otra sesión trabaja en `docs/context/`).
- **Línea base del worktree (b1721a5):** typecheck limpio · `bun test` **4 547 pass / 156 skip /
  3 todo / 0 fail**.

## Trazabilidad del inventario

- 314 entradas en bruto del análisis (`gaps.json`) → 137 canónicos (consolidador + comprobación
  mecánica: 0 sin asignar) → 140 tras medir Cloud en la v2 (GC-138…GC-140).
- Comprobación mecánica en cada versión: todo GC con al menos una tarea que declara «Cierra».

## Decisiones del usuario (F0.T1)

Estado: **PROPUESTA** = valor propuesto por el controlador a partir del dato, adoptado como
«Simulado — pendiente de confirmar» mientras el usuario no lo corrija. **PENDIENTE** = no se
ejecuta lo que depende de ella («falla cerrado»).

| # | Decisión | Propuesta | Estado |
|---|---|---|---|
| D-U1 | Proveedora de AIS-ARGA-001/002/003 («ARGA Analytics» no existe) | ARGA Digital, S.L. desarrolla por encargo; proveedoras las sociedades que ponen en servicio con su nombre: ARGA Seguros (triaje auto, suscripción empresas), ARGA Salud (fraude reembolsos salud), ARGA Vida (ARGA Score). Acumulan proveedor + responsable del despliegue (Harvey C8, C11) | PROPUESTA |
| D-U2 | Órgano de IA de ARGA y decisor del residual | Órgano de IA: Comité Asesor de Tecnología e Innovación (CATIT), dueño también de la PR-024. Residual: Comité de Riesgos; escalado a la Comisión de Riesgos Regulada en alto riesgo | PROPUESTA |
| D-U3 | Proveedora de GA_IA | Garrigues (matriz), SLP: lo pone en servicio con su marca; NewLaw, desarrolladora por encargo; g-digital no puede (división) (Harvey C11) | PROPUESTA |
| D-U4 | Fundaciones, institutos e integraciones como sujeto | Fundación Garrigues sí (persona jurídica). Centro de Estudios y BSVV no, hasta acreditar personalidad | PROPUESTA |
| D-U5 | Segunda cuenta ARGA con rol COMPLIANCE (cuatro ojos) | La crea el usuario en Supabase Auth (el controlador no da de alta cuentas). Después, migración de perfil y persona con el patrón de `20260914121000` (enmienda E-06) | PENDIENTE (acción del usuario) |
| D-U6 | Especialidad → órgano en ARGA | Jurídico → Comité de Cumplimiento · Técnico y Ciberseguridad → CATIT · Riesgos → Comité de Riesgos · Datos → Comisión de Auditoría y Cumplimiento Normativo | PROPUESTA |
| D-U7 | Reabrir la escritura de las 8 tablas muertas (EIDF, modelos, componentes, datasets, vigilancia poscomercialización, relojes, informes de incidente, remisiones EIDF-EIPD), derogando en ese punto DA-9 y la frontera D-1 del 08-09 | Sí, con RESTRICT en las FK, el dato de ARGA (`aims_post_market_plans`, 1 fila) solo de lectura, y la corrección previa de cada tabla del §2.2 | PENDIENTE (revierte una decisión expresa del usuario) |
| D-U8 | Excepción de redacción RGPD sobre el diario de solo anexión `aims_ria_records` | Sí, gobernada: capacidad AIMS_GOBIERNO, motivo, fuera de legal hold, y anotación nueva que referencia el registro redactado (enmienda E-12) | PENDIENTE (excepción a un invariante WORM) |

## Validación con Harvey

| Lote | Tema | Estado | Resultado |
|---|---|---|---|
| H-01 | 17 criterios de aplicabilidad, correcciones a la matriz, calendario del Ómnibus | RESPONDIDO 19-09 | 16 correctos + C2 con matiz útil. El matiz de Harvey en C15 (art. 73.4) **no está en el texto consolidado**: C15 queda correcto. 8 consideraciones → requisitos RH-1…RH-8. Archivo: `docs/legal/harvey/2026-09-19-H-01-*` |

Regla: la respuesta de Harvey es dato; toda afirmación suya que cambie un criterio se contrasta
con el literal (EUR-Lex consolidado 27-07-2026) antes de usarla.

### Cambios provisionales a la espera de H-02A (F1.T10 y F1.T11)

Rotulados «Provisional, pendiente de validación» (`ROTULO_PROVISIONAL`,
`src/lib/aims/cuestionario-calificacion.ts`). Los tests leen el estado del lote en
`docs/legal/harvey/registro.json`: mientras H-02A no esté RESPONDIDA, el rótulo es
obligatorio. Con CORRECTO, F1.T15 retira el rótulo; con INCORRECTO, se revierte a lo
que dice la columna «Antes» y se anota aquí.

| Tarea | Qué | Antes | Ahora (provisional) |
|---|---|---|---|
| F1.T10 | Ayuda de Q2_1 (art. 5) | «Marque Sí SOLO si…» con cuatro prácticas; «si tiene dudas, la respuesta casi seguro es No» | Diez letras enumeradas (a-h, b bis, b ter; b bis y b ter cotejadas, ver abajo) y el 5.1 bis; c) sin intención; ejemplo de que la d) no alcanza a la puntuación de siniestros por indicios objetivos de fraude; f) a cualquier empleador; h) solo con fines de garantía del cumplimiento del Derecho y la biometría con otros fines al anexo III 1 a) |
| F1.T11 | MD_TRA_01 (catálogo del desplegador) | `OBLIGACION`, norma «Art. 50.1» | `MARCO_OPERATIVO`, «Art. 50.1 (obliga al proveedor)» |
| F1.T11 | MD_CS_01 | `OBLIGACION`, «Cap. V» | `MARCO_OPERATIVO`, «Cap. V (obliga al proveedor del modelo)» |
| F1.T11 | MD_CS_02 | `OBLIGACION`, «Cap. V y anexo XII» | `MARCO_OPERATIVO`, «Cap. V y anexo XII (obligan al proveedor del modelo)» |
| F1.T11 | MD_CS_05 | `OBLIGACION`, «Art. 25.1» | `MARCO_OPERATIVO`, «Art. 25.1 (califica al sujeto)» |

No provisionales, por estar ya validados: la retirada del ejemplo del scoring y el aviso de
perfilado de Q2_3 (C10 y último párrafo del 6.3 cotejado; el resto de Q2_3 vuelve al texto de la
spec del equipo legal: quién documenta la excepción —art. 6.4—, el desarrollo de las letras a) a d)
del 6.3 y el ejemplo de la tarea procedimental se retiraron hasta que H-02 los valide), el rótulo «Art. 6.2 y anexo III» de Q2_2 (F1.T9) y la redacción
del art. 4 (C14) con MD_ALF_05 como marco operativo (ya lo era). Tampoco la cautela del
cap. V en la rama del proveedor, ni «divulgar» en MD_TRA_02 (literal del 50.4).

**Desviación declarada (F1.T11):** la tarea dice «el art. 4 solo se asigna a PROVEEDOR y
RESPONSABLE_DESPLIEGUE». `derivarMarcos` lo asigna también a `PROVEEDOR_POSTERIOR`, porque el
art. 3.68 lo define como proveedor de un **sistema** de IA y el art. 4 vincula a los proveedores
de sistemas; quitárselo escondería una obligación (el módulo falla abierto). Quedan fuera
`PROVEEDOR_GPAI` (proveedor de un modelo, no de un sistema), `IMPORTADOR` y `DISTRIBUIDOR`. A
confirmar por Legal; revertir es quitar un elemento de `ROLES_ART_4`. **Texto de las ayudas pendiente de revisión por Legal** (F1.T10 lo exige y
no lo puede cerrar un implementador).

**Coherencia del art. 4 entre marcos y catálogo (corrección de la revisión):** `perfilAplicable`
servía el catálogo del desplegador (MD_ALF_01 a 04, OBLIGACION «Art. 4») a IMPORTADOR y
DISTRIBUIDOR de riesgo limitado o mínimo, a los que `derivarMarcos` ya no asigna el art. 4. Ahora
caen al catálogo completo con el motivo dicho (falla abierto, como en alto riesgo). Gate:
`perfil-aplicabilidad.test.ts` recorre roles × niveles y cae si el catálogo mide el art. 4 como
obligación de un rol sin ese marco. Medido: 0 sistemas con `regulatory_role` en los dos tenants,
sin cambio visible.

**Estado de las tareas de esta cadena:**

| Tarea | Estado | Pendiente |
|---|---|---|
| F1.T9 | HECHA | — |
| F1.T10 | HECHA, **no cerrada** | Revisión del texto de las ayudas por Legal (criterio de aceptación) y veredicto de H-02A (F1.T15) |
| F1.T11 | HECHA, **no cerrada** | Veredicto de H-02A (F1.T15) y confirmación por Legal de la desviación de `ROLES_ART_4` |

**Cotejo literal (19-09-2026, navegador, consolidado CELEX 02024R1689-20260727; ▼M1 = Reglamento
(UE) 2026/1744).** Para llevar a la tabla de F0.T2 al integrar:

| Punto | Texto oficial (extracto literal) | Uso en el producto |
|---|---|---|
| Art. 4.1 (▼M1) | «Los proveedores y responsables del despliegue de sistemas de IA adoptarán medidas para apoyar la promoción de la alfabetización en materia de IA de su personal y demás personas que se encarguen en su nombre del funcionamiento y la utilización de sistemas de IA […]. Esta obligación no exige que los proveedores o los responsables del despliegue garanticen un nivel específico de alfabetización en materia de IA de ninguna persona en particular.» | Nota de RIA_ART_4 y descripción de ALFABETIZACION. Destinatarios «de sistemas de IA»: apoya dejar fuera al proveedor de un modelo |
| Art. 5.1 b bis) (▼M1) | «[…] un sistema de IA que genere o manipule imágenes, vídeos o audios realistas o material similar de las partes íntimas de una persona física identificable, o de una persona física identificable que participe en actividades sexualmente explícitas, sin el consentimiento libre, específico, informado e inequívoco y explícito de dicha persona […]» | Ayuda de Q2_1 (reescrita: decía «imágenes íntimas… sin su consentimiento») |
| Art. 5.1 b ter) (▼M1) | «[…] un sistema de IA que genere o manipule material o espectáculos en el sentido del artículo 2, letras c) y e), de la Directiva 2011/93/UE, excepto cuando se aplique una defensa de «forma ilícita» en virtud del Derecho nacional» | Ayuda de Q2_1 (añade la Directiva) |
| Art. 5.1 bis a) y b) (▼M1) | a) al mercado o en servicio «solo estará prohibida cuando: i) dicha generación o manipulación sea la finalidad prevista […], o ii) […] un resultado razonablemente previsible y reproducible […] y el sistema no disponga de medidas técnicas de seguridad razonables […]»; b) la utilización «solo está prohibida cuando el responsable del despliegue utilice el sistema con el fin de generar o manipular dicho material» | Ayuda de Q2_1, sin cambio |
| Art. 113, párr. 3, a) (▼M1) | «[…] a excepción del artículo 5, apartado 1, párrafo primero, letras b bis) y b ter), y el artículo 5, apartado 1 bis, y apartado 1 ter, que serán aplicables a partir del 2 de diciembre de 2026» | Fecha de Q2_1, sin cambio |
| Art. 6.3, último párrafo (▼B) | «[…] los sistemas de IA a que se refiere el anexo III siempre se considerarán de alto riesgo cuando el sistema de IA efectúe la elaboración de perfiles de personas físicas.» | Aviso de perfilado de Q2_3 (C10) |
| Art. 3.52 (▼B) | «“elaboración de perfiles”: la elaboración de perfiles tal como se define en el artículo 4, punto 4, del Reglamento (UE) 2016/679» | Ejemplo de Q2_3 |

**No cotejado, y por eso retirado del producto:** el número del artículo del Reglamento
2026/1744 que modifica el art. 4 (la spec cita «art. 1.5»; Harvey citó «4.1 (mod.), cdo. 8»). La
nota dice ahora «Art. 4.1 en la redacción del Reglamento (UE) 2026/1744», que sí está cotejado.

## Reglas de ejecución

- Una fase por vez en la rama; dentro de la fase, cadenas de tareas sobre ficheros disjuntos en
  paralelo (worktree aislado por cadena), cada cadena con revisión adversarial.
- TDD; gates por tarea y gates completos (typecheck, `bun test`, lint, build) antes de cada merge.
- Mutación sobre cada gate nuevo, **después** de arreglar: commitear antes de mutar, restaurar solo
  el fichero mutado, comprobar que la mutación entró.
- Cloud: el controlador aplica las migraciones, con `db:check-target`, transacción con bloque de
  verificación que aborta y control positivo, registro en `schema_migrations`, verificación
  posterior independiente y sonda de comportamiento con fila sembrada y limpieza.
- Nada destructivo sobre dato sembrado; tenant_id explícito; ARGA solo aditivo y declarado (lista
  de filas de ARGA tocadas abajo).

## Filas de ARGA tocadas

(ninguna todavía)

## Estado por fase

| Fase | Estado | Notas |
|---|---|---|
| F0 | EN CURSO | T3 (H-01) hecha; T1 propuestas presentadas al usuario |
| F1 | PENDIENTE | Siguiente |
| F2-F11 | PENDIENTE | |

## Deudas y hallazgos durante la ejecución

- **`CUESTIONARIO_VERSION` sigue en «1.1»** aunque F1.T10 cambia la ayuda de Q2_1 (y con ella qué
  significa responder «No») y F1.T11 los `applicable_frameworks` que se sellan para unas mismas
  respuestas. Hoy no hay ambigüedad (0 filas en `aims_classification_questionnaires`, medido). La
  decisión es del controlador: subir a «1.1.1» (el servidor no valida el valor, solo lo sella y
  pone «1.1» por defecto en `fn_aims_registrar_sistema`) o declarar que la v1.1 abarca las dos
  ayudas con corte en el despliegue, comprobando antes que siguen sin existir cuestionarios.
- **`EntidadDetalle`, columna «Riesgo EU AI Act»** (preexistente, fuera de F1.T9): pinta
  `risk_level` en rojo o aviso sin mirar `tieneClasificacionGuiada`. ARGA: 8 sistemas, 6 «Alto», 0
  cuestionarios → 6 chips rojos que afirman una clasificación sin medir. Tarea pendiente: chip
  neutro «nivel declarado en ficha, sin cuestionario», como el resto del módulo, con gate de arista.
  Cambio visible en ARGA (declararlo).

- **Defecto vivo detectado en el diseño:** `fn_sync_obligation_to_backbone` manda al `ELSE 'risk'`
  24 obligaciones: las 21 de PBC/FT de Garrigues (el patrón espera `OBL-GARR-PBC-%` y están
  sembradas como `OBL-PBC-%`), que hoy se sincronizan al módulo de riesgos penales en vez de al de
  PBC/FT, y 3 de ARGA. Tarea en F5 (sin convertir el ELSE en RAISE).
