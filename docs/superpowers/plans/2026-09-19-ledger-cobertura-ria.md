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
| F1.T10 | Ayuda de Q2_1 (art. 5) | «Marque Sí SOLO si…» con cuatro prácticas; «si tiene dudas, la respuesta casi seguro es No» | Diez letras enumeradas (a-h, b bis, b ter) y el 5.1 bis; c) sin intención; ejemplo de que la d) no alcanza a la puntuación de siniestros por indicios objetivos de fraude; f) a cualquier empleador; h) solo con fines de garantía del cumplimiento del Derecho y la biometría con otros fines al anexo III 1 a) |
| F1.T11 | MD_TRA_01 (catálogo del desplegador) | `OBLIGACION`, norma «Art. 50.1» | `MARCO_OPERATIVO`, «Art. 50.1 (obliga al proveedor)» |
| F1.T11 | MD_CS_01 | `OBLIGACION`, «Cap. V» | `MARCO_OPERATIVO`, «Cap. V (obliga al proveedor del modelo)» |
| F1.T11 | MD_CS_02 | `OBLIGACION`, «Cap. V y anexo XII» | `MARCO_OPERATIVO`, «Cap. V y anexo XII (obligan al proveedor del modelo)» |
| F1.T11 | MD_CS_05 | `OBLIGACION`, «Art. 25.1» | `MARCO_OPERATIVO`, «Art. 25.1 (califica al sujeto)» |

No provisionales, por estar ya validados: la retirada del ejemplo del scoring y el aviso de
perfilado de Q2_3 (C10), el rótulo «Art. 6.2 y anexo III» de Q2_2 (F1.T9) y la redacción
del art. 4 (C14) con MD_ALF_05 como marco operativo (ya lo era). Tampoco la cautela del
cap. V en la rama del proveedor, ni «divulgar» en MD_TRA_02 (literal del 50.4).

**Desviación declarada (F1.T11):** la tarea dice «el art. 4 solo se asigna a PROVEEDOR y
RESPONSABLE_DESPLIEGUE». `derivarMarcos` lo asigna también a `PROVEEDOR_POSTERIOR`, porque el
art. 3.68 lo define como proveedor de un **sistema** de IA y el art. 4 vincula a los proveedores
de sistemas; quitárselo escondería una obligación (el módulo falla abierto). Quedan fuera
`PROVEEDOR_GPAI` (proveedor de un modelo, no de un sistema), `IMPORTADOR` y `DISTRIBUIDOR`. A
confirmar por Legal; revertir es quitar un elemento de `ROLES_ART_4`. **Texto de las ayudas pendiente de revisión por Legal** (F1.T10 lo exige y
no lo puede cerrar un implementador).

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

- **Defecto vivo detectado en el diseño:** `fn_sync_obligation_to_backbone` manda al `ELSE 'risk'`
  24 obligaciones: las 21 de PBC/FT de Garrigues (el patrón espera `OBL-GARR-PBC-%` y están
  sembradas como `OBL-PBC-%`), que hoy se sincronizan al módulo de riesgos penales en vez de al de
  PBC/FT, y 3 de ARGA. Tarea en F5 (sin convertir el ELSE en RAISE).
