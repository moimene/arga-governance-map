# Modelos oficiales de instancias del Registro Mercantil — matriz XFA verificada

**Fecha de extracción:** 2026-07-19  
**Fuente:** [Índice oficial de Registradores de España](https://www.registradores.org/documentacion-y-descargas/instancias-de-presentacion)  
**Alcance:** verificación documental parcial; no sustituye validación jurídica del Comité Legal

## Resultado de la extracción

- El índice oficial publicado contiene 39 PDFs descargables: modelos 01–04, 06–33 y 35–41. No se publican modelos 05 ni 34 en el índice auditado.
- `pdftotext` no recupera el formulario y devuelve la pantalla de espera de Adobe Reader.
- Los 39 PDFs sí contienen paquetes XFA legibles. `pypdf 6.7.0` recuperó `template` y `datasets` en 39/39.
- La matriz siguiente solo incluye diez formularios cuyos literales XFA se inspeccionaron de forma dirigida: 15–23 y 33.
- “Firma” significa únicamente que el XFA contiene campos de firma y permite identificar la persona/rol al que se refiere el formulario. El tipo jurídico concreto de firma, legitimación o cualificación no se deduce del campo XFA y queda pendiente de validación legal.

## Matriz parcial verificada

| Acto literal del formulario | Modelo oficial | Documento de base que muestra el XFA | Firma identificable en el formulario | Estado de verificación |
|---|---|---|---|---|
| Proyecto de fusión por absorción | Mod. 15 | `INSTANCIA` que solicita el depósito del proyecto común y relaciona documentos adjuntos | Campos `Firma 1`–`Firma 9`; el formulario identifica certificantes y la legitimación de la representación del solicitante. Modalidad jurídica pendiente | XFA verificado |
| Cese y nombramiento de sociedades anónimas y limitadas | Mod. 16 | `INSTANCIA` que incorpora `CERTIFICACIÓN` de lo que resulta del libro de actas | Campos `Firma 1`–`Firma 9` asociados a certificantes; cargos certificantes enumerados. Modalidad jurídica pendiente | XFA verificado |
| Aceptación de nombramiento de sociedades anónimas y limitadas | Mod. 17 | `INSTANCIA` con declaración de aceptación del cargo y manifestación de no incompatibilidad | Campos `Firma 1`–`Firma 9`; el formulario identifica al interesado y el nombramiento. Modalidad jurídica pendiente | XFA verificado |
| Cese y nombramiento de sociedades anónimas | Mod. 18 | `INSTANCIA` que incorpora `CERTIFICACIÓN` de lo que resulta del libro de actas | Campos `Firma 1`–`Firma 9` asociados a certificantes. Modalidad jurídica pendiente | XFA verificado |
| Cese y nombramiento de sociedades limitadas | Mod. 19 | `INSTANCIA` que incorpora `CERTIFICACIÓN` de lo que resulta del libro de actas | Campos `Firma 1`–`Firma 9` asociados a certificantes. Modalidad jurídica pendiente | XFA verificado |
| Cese, nombramiento y delegación de facultades de sociedades anónimas y limitadas | Mod. 20 | `INSTANCIA` que incorpora `CERTIFICACIÓN`, nombramientos, ceses y facultades delegadas | Campos `Firma 1`–`Firma 9` asociados a certificantes. Modalidad jurídica pendiente | XFA verificado |
| Alta de poderes | Mod. 21 | `INSTANCIA` que solicita la inscripción de los poderes indicados | Campos `Firma 1`–`Firma 9`; identifica interesado-poderdante y su representación. Modalidad jurídica pendiente | XFA verificado |
| Revocación de poderes | Mod. 22 | `INSTANCIA` que solicita la revocación total o parcial de los poderes indicados | Campos `Firma 1`–`Firma 9`; identifica interesado-poderdante y su representación. Modalidad jurídica pendiente | XFA verificado |
| Cese y nombramiento con certificación según modelo del despacho | Mod. 23 | `INSTANCIA` con contenido literal de `CERTIFICACIÓN` de la junta | Campos `Firma 1`–`Firma 9` asociados a certificantes. Modalidad jurídica pendiente | XFA verificado |
| Certificación de no aprobación de cuentas | Mod. 33 | `INSTANCIA` con `CERTIFICACIÓN` de no aprobación y solicitud de reapertura de hoja registral | Campos `Firma 1`–`Firma 9`; enumera cargos certificantes. Modalidad jurídica pendiente | XFA verificado |

## Evidencia literal mínima por modelo

| Modelo | Literales XFA determinantes |
|---|---|
| 15 | “PROYECTOS DE FUSIÓN POR ABSORCIÓN”; “se tenga por presentado este escrito y por efectuado el depósito del Proyecto común de fusión” |
| 16 | “CESE Y NOMBRAMIENTO SOCIEDADES ANÓNIMAS Y LIMITADAS”; “CERTIFICACIÓN”; “del Libro de Actas de la Sociedad” |
| 17 | “ACEPTACIÓN DE NOMBRAMIENTO”; “Acepta el cargo y manifiesta no hallarse incurso…” |
| 18 | “CESE Y NOMBRAMIENTO SOCIEDADES ANÓNIMAS”; “CERTIFICACIÓN” |
| 19 | “CESE Y NOMBRAMIENTO SOCIEDADES LIMITADAS”; “CERTIFICACIÓN” |
| 20 | “CESE Y NOMBRAMIENTO Y DELEGACIÓN DE FACULTADES”; “CERTIFICACIÓN”; “Facultades Delegadas” |
| 21 | “ALTA DE PODERES”; “Se proceda a la inscripción de los poderes indicados” |
| 22 | “REVOCACIÓN DE PODERES”; “Se proceda a la revocación de los poderes indicados” |
| 23 | “CESE Y NOMBRAMIENTO. CERTIFICACIÓN SEGÚN MODELO DEL DESPACHO” |
| 33 | “CERTIFICACIÓN DE NO APROBACIÓN DE CUENTAS. ARTÍCULO 378.5 RRM”; “reapertura de la hoja registral” |

Los extractos anteriores se limitan a frases cortas necesarias para acreditar la clasificación. No se reproduce el formulario completo.

## Uso permitido en TGMS

1. Estos diez modelos pueden mostrarse como ayuda documental verificada por XFA.
2. El Tramitador debe conservar `INSTANCIA` como agregado de presentación, aunque la instancia incorpore una certificación.
3. `CERTIFICACION` puede ser el documento societario aportado o anexado, pero no debe confundirse con el formulario/instancia de presentación.
4. La UI no debe prometer firma legitimada, firma cualificada ni otra modalidad concreta hasta que exista un perfil aprobado por Legal.
5. Los otros 29 modelos quedan como “XFA extraído, correspondencia funcional pendiente de revisión dirigida”; no deben poblar una matriz acto-modelo por inferencia del nombre de fichero.

## Fuera de alcance o no verificado

- correspondencia exhaustiva de los 39 modelos;
- vigencia jurídica material de cada precepto citado por el propio formulario;
- modalidad de firma o legitimación exigible en cada canal;
- uso automático de un modelo según materia, órgano o tipo social;
- equivalencia entre el formulario oficial y una plantilla TGMS concreta.
