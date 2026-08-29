# EAD Trust en la Trusted List española — servicios cualificados acreditados

- **Fecha de la verificación:** 2026-08-29
- **Carril:** C3 (GRC/ESG/SII) del programa del tenant Garrigues
- **Motivo:** `scripts/garrigues/normativo/obligaciones-ciber.ts` afirmaba que EAD Trust es
  «QTSP cualificado (entidad esencial con independencia de tamaño)». La afirmación decide el
  régimen NIS2 entero y **no constaba verificada en ninguna parte del repositorio**.
- **Verificación independiente:** el hallazgo se midió dos veces, por dos agentes distintos, sobre
  descargas separadas del mismo XML. Las divergencias se recogen en §6.

---

## 1. Veredicto

**EAD Trust European Agency of Digital Trust, S.L. (NIF B85626240) ES prestador cualificado de
servicios electrónicos de confianza**, inscrito en la Trusted List española.

La afirmación del producto era **correcta**. Lo que le faltaba era la fuente, y este documento la
aporta.

---

## 2. Cadena de custodia

No se consultó la web comercial del prestador: un prestador puede autoproclamarse cualificado y eso
no prueba nada. La cadena parte de la Comisión Europea:

| Paso | Fuente | Datos de la lista |
|---|---|---|
| 1 | **LOTL de la Comisión** — `https://ec.europa.eu/tools/lotl/eu-lotl.xml` | `TSLSequenceNumber` **392** · `ListIssueDateTime` **2026-08-25T14:30:58Z** |
| 2 | El `OtherTSLPointer` con `SchemeTerritory=ES` apunta a → | `https://tsl.digital.gob.es/TSL.xml` |
| 3 | **Trusted List española** | `TSLSequenceNumber` **188** · `ListIssueDateTime` **2026-08-06T04:00:00Z** · `NextUpdate` 2027-02-02T05:00:00Z · `TSLType` EUgeneric |

> **Aviso operativo:** la URL histórica `https://sede.serviciosmin.gob.es/Prestadores/TSL/TSL.xml`
> devuelve **404** — el dominio del antiguo MINETAD ya no sirve la lista. La URL vigente **no se
> adivinó**: se obtuvo navegando la LOTL. Cualquier reverificación futura debe repetir ese camino en
> lugar de fiarse de la URL de este documento, que también puede caducar.

---

## 3. Identidad: coincide

- **`TSPName` literal en la lista:** `EAD TRUST European Agency of Digital Trust, S.L.`
- **`TSPTradeName`** incluye: `EADTrust`, `VATES-B85626240`, `European Agency of Digital Trust, S.L.`,
  `EAD TRUST EUROPEAN AGENCY OF DIGITAL TRUST SL`, `EAD Trust`.
- El NIF **B85626240** aparece además en el `OID.2.5.4.97` de todos los `X509SubjectName` de sus CA.
- Domicilio en lista: Méntrida 6 - local, 28043 Madrid, ES. Web declarada: `https://eadtrust.eu`.

**No hay ninguna otra entidad en la lista española con ese NIF ni con nombre parecido:** todas las
apariciones de `85626240` caen dentro de un **único** bloque `TrustServiceProvider`.

Única discrepancia con `scripts/garrigues/entities-catalog.ts`: mayúsculas («EAD TRUST» en la lista,
«EAD Trust» en el catálogo). Irrelevante.

---

## 4. Servicios cualificados: qué SÍ está inscrito

La cualificación en eIDAS es **por servicio, no por entidad**. Lo inscrito es esto y solo esto:

### 4.1 `Svctype/CA/QC` — emisión de certificados cualificados

| Extensión `AdditionalServiceInformation` | En llano | Estado | `StatusStartingTime` |
|---|---|---|---|
| `ForeSignatures` | Certificados cualificados de **firma** (persona física) | `granted` | 2020-10-05 |
| `ForeSeals` | Certificados cualificados de **sello** (persona jurídica) | `granted` | 2020-10-05 |
| `ForWebSiteAuthentication` | Certificados cualificados **web (QWAC)**, DV/OV y EV/PSD2 | `granted` | 2020-10-05 |
| `ForWebSiteAuthentication` | Ídem, SubCA de 2024 | `granted` | 2026-02-26 |

### 4.2 `Svctype/TSA/QTST` — sellos de tiempo cualificados

| Servicio | Estado | Desde |
|---|---|---|
| `EADT QTSU 2023 RSA 2048` | `granted` | 2023-02-15 |
| `EADT QTSU 2023 RSA 3072 ENS alto` | `granted` | 2023-02-15 |
| `EADT QTSU 2023 RSA 4096 QSCD ENS alto` | `granted` | 2023-02-15 |
| `EADT QTSU 2023 ECC 256 ENS alto` | `granted` | 2023-02-15 |
| `EADT QTSU 2023 ECC 384 QSCD ENS alto` | `granted` | 2023-02-15 |
| `QTSU ALPHA EADTrust` | **`withdrawn`** | 2024-01-24 (fue `granted` desde 2020-10-05) |
| `QTSU DELTA EADTrust` | **`withdrawn`** | 2024-01-24 (ídem) |
| `QTSU EPSILON EADTrust` | **`withdrawn`** | 2024-01-24 (ídem) |

**Antigüedad de la cualificación:** al menos desde **2020-10-05**, el `StatusStartingTime` más
antiguo del bloque. La lista no conserva historial anterior para este prestador.

---

## 5. Qué NO está inscrito — y por qué la ausencia es dato, no laguna

Los `ServiceTypeIdentifier` del bloque de EAD Trust son **exclusivamente** `CA/QC` y `TSA/QTST`.
**No aparece ninguno** de los siguientes.

La ausencia se validó con **control discriminante**: los mismos tipos sí existen, y en cantidad, en
otros prestadores de la misma lista. Es decir, la lista sabe expresarlos y no los expresa aquí.

| Tipo ausente en EAD Trust | Qué es | Ocurrencias en el resto de la TSL española |
|---|---|---|
| **`Svctype/EDS/Q`** | **Entrega electrónica certificada cualificada (QERDS)** | **71** |
| `Svctype/PSES/Q` | Preservación / archivo cualificado de firmas | 22 |
| `Svctype/QESValidation/Q` | Validación cualificada de firmas | 19 |
| `Svctype/EDS/REM/Q` | Correo electrónico certificado cualificado (QREM) | 2 |

Histograma completo de la lista española, como contexto: 545 `CA/QC` · 172 `TSA/QTST` · 71 `EDS/Q` ·
22 `PSES/Q` · 19 `QESValidation/Q` · 2 `EDS/REM/Q` · 2 `OCSP/QC`.

**Además: el bloque no tiene ninguna extensión `Qualifications` (0 qualifiers).** En particular no
declara `QCQSCDManagedOnBehalf`, que es el marcador de gestión remota del dispositivo cualificado de
creación de firma por cuenta del firmante. Las apariciones de «QSCD» en el bloque están en los
*Common Name* de certificados de sellado de tiempo, no en qualifiers.

### 5.0 Cómo se cita esta ausencia sin afirmar de más

La TSL lista servicios **cualificados**. Por tanto sostiene una negativa **acotada**, y solo esa:

| Formulación que aguanta | Formulación que NO se sostiene |
|---|---|
| «No consta como prestador **cualificado** de entrega electrónica certificada en la Trusted List española, secuencia 188 de 06/08/2026» | ~~«EAD Trust no realiza entrega electrónica certificada»~~ |
| «No consta preservación **cualificada** (`PSES/Q`)» | ~~«EAD Trust no custodia»~~ |

Un servicio **no cualificado** puede existir comercialmente sin figurar en la lista. Para la política
del proyecto es indiferente —va exactamente de no atribuir *lo cualificado*— pero quien reescriba el
copy como «el proveedor no realiza entrega» estaría afirmando más de lo que esta fuente dice.

**Y la simétrica, que es la más fácil de cometer:** los 26 servicios `CA/QC` **no son permiso para
reclamar QES**. Acreditan emisión de **certificados cualificados a suscriptores**, que es cosa
distinta de que la plataforma **produzca una firma cualificada**. La integración real de julio
(commit `4827d8f`) midió que el API topa en **ADVANCED**. El riesgo concreto: alguien lee `CA/QC` en
esta ficha, concluye «entonces sí podemos decir QES» e **incumple la política vigente por el camino
de una fuente que parece darle la razón**.

> **Criterio: esta lista es excelente para NEGAR lo cualificado con fuente externa, y no basta por sí
> sola para AFIRMAR una capacidad concreta del producto.** Cada dirección necesita evidencia
> distinta: la negativa se prueba con la lista; la afirmación, con la integración.

### 5.1 Consecuencias para la política vigente del proyecto

1. **ERDS.** La política de 2026-07-21 prohíbe afirmar ERDS de EAD Trust. Esa prohibición se
   sostenía hasta hoy en una decisión interna de producto. **Ahora se sostiene además en fuente
   pública, externa y verificable:** EAD Trust **no consta como prestador cualificado de entrega
   electrónica certificada** (§5.0: la negativa es acotada a lo cualificado). Un abogado que pregunte
   en demo por qué no se usa entrega certificada del propio QTSP del grupo recibe un hecho
   registral, no una cautela de producto.
2. **Custodia / e-archiving.** `CLAUDE.md` admite «custodia/e-archiving» en el alcance vigente. Este
   documento no lo contradice, pero lo acota: **no consta preservación cualificada**
   (`PSES/Q` ausente). No puede presentarse como «oficial», «cualificada» ni con distintivo de
   conformidad — lo que no equivale a decir que no custodie (§5.0).
3. **Firma y el techo ADVANCED.** En la integración real de julio (commit `4827d8f`) se verificó
   empíricamente que **EAD no emite QES: techo ADVANCED**. Ese hallazgo y este **no se contradicen,
   miden cosas distintas**, y conviene no confundirlos:
   - EAD Trust **sí** emite *certificados* cualificados de firma (`CA/QC` + `ForeSignatures`).
   - La TSL **no** declara un servicio de firma remota con QSCD gestionado por cuenta del firmante
     (0 qualifiers, sin `QCQSCDManagedOnBehalf`).
   - Una QES exige certificado cualificado **y** QSCD (art. 3.12 eIDAS). Emitir el certificado no
     equivale a ofrecer el servicio de firma cualificada.

   **Límite honesto de esta inferencia:** la ausencia del qualifier **no prueba** que una QES sea
   imposible con un certificado de EAD Trust — un firmante con su propio QSCD podría producirla. Lo
   que prueba es que EAD Trust **no declara en la lista un servicio cualificado de firma remota**, lo
   cual es coherente con el techo ADVANCED medido en la integración. No se afirma más que eso.

---

## 6. Divergencias entre las dos mediciones independientes

Se declaran en lugar de esconderse:

| Comprobación | Medición 1 | Medición 2 | Resolución |
|---|---|---|---|
| `TSLSequenceNumber` / fecha | 188 / 2026-08-06 | 188 / 2026-08-06T04:00:00Z | Coinciden |
| Bloques TSP con el NIF | 1 | 1 | Coinciden |
| Nombre literal | idéntico | idéntico | Coinciden |
| Tipos presentes | solo `CA/QC` y `TSA/QTST` | solo `CA/QC` y `TSA/QTST` | Coinciden |
| `EDS/Q` en EAD Trust | 0 | 0 | Coinciden |
| Discriminante `EDS/Q` en la lista | 71 | 71 | Coinciden |
| Extensiones `Qualifications` | 0 | 0 | Coinciden |
| **Recuento de servicios** | **34** (26 + 8) | **37** (26 + 11) | **DIVERGEN** |

La divergencia del recuento es **artefacto del método**: contar nodos `TSPService` frente a contar
ocurrencias de la cadena URI del identificador (los 3 servicios `withdrawn` conservan entradas de
historial que una cuenta de cadenas duplica).

**No afecta a ninguna conclusión.** El régimen NIS2 cuelga de **qué tipos** están cualificados, no de
cuántos servicios hay de cada tipo, y los tipos coinciden exactamente en ambas mediciones.

---

## 7. Consecuencia regulatoria (NIS2)

Con la cualificación acreditada:

- **Ámbito.** Todos los prestadores de servicios de confianza entran en el ámbito de la Directiva
  (UE) 2022/2555 por el **art. 2.2.a).ii)**, que dice «prestadores de servicios de confianza»
  **sin** el adjetivo «cualificados». La cualificación no determina la entrada.
- **Categoría.** El **art. 3.1.b)** eleva a **entidad esencial** a los prestadores **cualificados**,
  «independientemente de su tamaño». **Es aquí donde la cualificación decide**, y por eso había que
  verificarla: esencial ⇒ supervisión **ex ante** (art. 32) y multas de hasta **10 M€ o el 2 %**
  (art. 34.4); importante ⇒ supervisión ex post (art. 33) y 7 M€ o 1,4 % (art. 34.5).
- **Fundamento fáctico.** La condición de esencial deriva aquí de los servicios **`CA/QC` y
  `TSA/QTST`**, no de ninguna entrega electrónica certificada.

### 7.1 Lo que este documento NO acredita

- **No acredita exigibilidad hoy en España.** España **no ha transpuesto** NIS2; el marco vigente
  (RDL 12/2018 y RD 43/2021, que son NIS1) **excluye** a los prestadores de servicios de confianza
  salvo designación como operador crítico (art. 2.3.a RDL 12/2018). Las fichas del producto deben
  conservar íntegras sus tres cautelas: que NIS2 **no** es deber del despacho, `prospectiva: true`, y
  «Aplicabilidad sujeta a transposición en España».
- **No acredita el porcentaje de participación.** La TSL no dice nada de participaciones. El
  **51,001 %** de `entities-catalog.ts` sigue en `confianza: "A_CONFIRMAR"`, con su incidencia
  abierta (51,00 IDC vs 51,001 contrato). **Son dos afirmaciones distintas y solo se acredita una.**
- **No acredita nada sobre el despacho.** El sujeto de estas obligaciones es EAD Trust, no
  J&A Garrigues.

---

## 8. Reverificación

La lista caduca: `NextUpdate` **2027-02-02**. Para reverificar, repetir §2 desde la LOTL (la URL
nacional puede volver a cambiar) y comprobar que el bloque del NIF `B85626240` sigue conteniendo
`CA/QC` y `TSA/QTST` en estado `granted`, y que sigue sin contener `EDS/Q` ni `PSES/Q`.

Si algún día apareciera `EDS/Q` en `granted`, **la política de no afirmar ERDS deja de tener este
respaldo externo** y habría que revisarla expresamente en lugar de heredarla.
