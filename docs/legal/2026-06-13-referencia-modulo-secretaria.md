# Módulo de Secretaría Societaria — Documento de Referencia para el Equipo Legal

**Plataforma TGMS · Módulos Garrigues · Cliente demostrador: Grupo ARGA Seguros**

---

| | |
|---|---|
| **Versión del documento** | 1.1 |
| **Fecha** | 13 de junio de 2026 (rev. 1.1) |
| **Ámbito** | Módulo de Secretaría Societaria (`/secretaria/*`) de la plataforma TGMS |
| **Destinatario** | Equipo legal (despacho) — referencia funcional y jurídica del módulo + plan de evolutivo correctivo |
| **Fuente de verdad** | Código fuente del repositorio `arga-governance-map` + base de datos en producción Supabase `governance_OS` (`hzqwefkwsxopwrmtksbg`, eu-central-1), consultada en vivo mediante `SELECT` el 2026-06-13. **No** se ha tomado el backlog ni documentación previa como fuente: todas las cifras y comportamientos están verificados contra código y/o Cloud. |
| **Confidencialidad** | Uso interno. Contiene datos demo de un cliente asegurador objetivo bajo pseudónimo. |
| **Cambios v1.0 → v1.1** | Se añaden, tras la referencia funcional original (**Parte I**): **Parte II** — hallazgos de la primera pasada de test sobre generación documental, con causa raíz verificada en código y plan de saneamiento; **Parte III** — validación contra código/Cloud de los dos informes de evolutivo correctivo (qué es realmente pendiente vs. ya resuelto vs. mal descrito); **Parte IV** — plan de evolutivo correctivo consolidado y priorizado. La Parte I no cambia en el fondo. |

> **Aviso de pseudónimo y datos demo.** "Grupo ARGA Seguros" es un **nombre ficticio** del grupo asegurador empleado en el prototipo. Toda persona, órgano, entidad, cifra de capital y retribución de este documento es **dato de demostración** coherente con la estructura corporativa ARGA, no información real de cliente. El prototipo es un **prototipo operativo avanzado demo-ready**, no un sistema en producción jurídica.

---

## ⚠️ Advertencia probatoria fundamental (leer antes que nada)

> **Ninguna firma, sello ni paquete de evidencia generado por el prototipo constituye, a día de hoy, evidencia electrónica cualificada productiva con plenos efectos jurídicos.**
>
> - La firma cualificada (QES), el sello de persona jurídica (QSeal), el sello de tiempo cualificado (TSQ) y la notificación certificada (ERDS) del QTSP **EAD Trust** se invocan en la demo mediante *stubs* deterministas o en modo *sandbox*. El flujo real `client_credentials` de EAD Trust **debe ejecutarse en servidor a través de un proxy QTSP** (regla *fail-closed*: en producción un fallo de proxy lanza error, **nunca** convierte un fallo en una "firma exitosa").
> - El sistema **distingue explícitamente** la evidencia *sandbox* de la evidencia sellada productiva mediante el gate `evidence-sandbox-gate.ts` (`isFinalSealedEvidence` solo reconoce los estados `SEALED`/`VERIFIED`; un *bundle* sandbox se degrada a `OPEN` y nunca se presenta como evidencia final).
> - El *backbone* de evidencia permanece en estado `pending`: la migración `000049_grc_evidence_legal_hold` está en **HOLD** y no debe promoverse como evidencia final productiva.
>
> **En una demostración a cliente, la cadena criptográfica (censo WORM → `gate_hash` → QES/TSQ → archivado SHA-512 → *evidence bundle*) debe presentarse como arquitectura probatoria y prueba de concepto, no como evidencia cualificada ya emitida.** La cadena de auditoría WORM (SHA-512) y la inmutabilidad del censo sí son operativas y verificables en vivo.

---

## Cómo leer este documento

El documento describe el módulo en seis bloques, ordenados de lo que se administra a cómo se trabaja, y cierra con tres anexos transversales:

1. **Modelo de entidades administradas, libros sociales y funciones de grupo** — qué gobierna el módulo: el modelo canónico de identidad (8 tablas), los libros y registros sociales, la estructura societaria ARGA real y las funciones de grupo y multi-jurisdicción.
2. **Procesos societarios soportados** — qué se puede hacer: el catálogo exhaustivo de procesos (convocatoria, reunión, acta, certificación, tramitación registral, acuerdos sin sesión, decisiones unipersonales, generación documental, board pack, gestión societaria).
3. **Materias societarias inventariadas y motor de reglas LSC** — el conocimiento jurídico: el inventario completo de materias y el motor determinista de validez societaria.
4. **Sistema de gestión documental y plantillas** — cómo se producen los documentos: plantillas en tres capas, consola de administración, Gate PRE y ciclo de vida.
5. **Firma cualificada (QTSP), evidencia forense y auditoría WORM** — el valor probatorio: cadena de evidencia extremo a extremo y auditoría inmutable.
6. **Superficies de trabajo y control de acceso (RBAC)** — dónde y quién: las pantallas, el menú de navegación y el modelo de roles, capacidades y segregación de funciones.

**Anexo A** — Tabla maestra de procedimientos almacenados (RPC). **Anexo B** — Máquinas de estado por dominio con volúmenes reales. **Anexo C** — Advertencias de alcance, limitaciones y deuda conocida.

Los seis bloques y los tres anexos forman la **Parte I — Referencia funcional del módulo**. A continuación de ella, esta revisión 1.1 añade tres partes de planificación: **Parte II** (incidencias de la primera pasada de test sobre generación documental y su saneamiento), **Parte III** (validación de los dos informes de evolutivo correctivo contra el código y Cloud reales) y **Parte IV** (plan de evolutivo correctivo consolidado y priorizado). Quien solo quiera el estado de corrección puede ir directamente a la Parte II; quien quiera la hoja de ruta, a la Parte IV.

---

## Resumen ejecutivo

El módulo de **Secretaría Societaria** es un prototipo operativo avanzado que cubre el ciclo de vida completo de los actos societarios formales de un grupo asegurador multinacional: desde la **convocatoria** del órgano, pasando por la **celebración** de la sesión (constitución, quórum, votación), el **levantamiento del acta**, la **certificación** del acuerdo y su **elevación a público e inscripción registral**, hasta la **generación documental** con firma cualificada y archivo probatorio. Soporta también las formas de adopción sin reunión (acuerdos por escrito, co-aprobación de administradores mancomunados, administrador solidario) y las decisiones de socio único y administrador único.

Su rasgo diferencial es que **el conocimiento jurídico no está en el código sino externalizado en datos versionables**: un catálogo de **56 materias societarias** (57 *rule packs*) con su clase, quórum, mayoría, inscribibilidad e instrumento público por tipo social, evaluado por un **motor de reglas LSC determinista** (funciones puras, con árbol de explicación trazable nodo a nodo) que resuelve la jerarquía normativa LEY → ESTATUTOS → PACTO PARASOCIAL → REGLAMENTO, distingue el incumplimiento contractual (pacto) de la invalidez societaria, y trata las sociedades cotizadas evaluando y advirtiendo (LMV) sin bloquear.

Toda la producción documental se construye a partir de **plantillas protegidas en tres capas** (cuerpo jurídico inmutable / variables resueltas automáticamente desde la base de datos / campos editables), sujetas a un control de calidad pre-activación (**Gate PRE**) y a un ciclo de vida auditado. Cada acto certificado encadena una **cadena de evidencia criptográfica** (censo inmutable WORM → `gate_hash` → firma QES con sello de tiempo de EAD Trust → archivado SHA-512 → *evidence bundle*), respaldada por una **auditoría WORM** verificable. El acceso está gobernado por **RBAC** (5 roles), una **matriz de capacidades societarias** (quién puede congelar censo, votar y certificar, con razón jurídica anotada) y **segregación de funciones**.

La identidad societaria descansa en un **modelo canónico de 8 tablas** (entidades, capital, clases de títulos, condiciones de persona, libro de socios, representaciones, partes votantes y censo inmutable), sobre el que opera la estructura demo del Grupo ARGA Seguros (sociedad dominante cotizada con Consejo de 15 miembros, comisiones y comités, cadena de control Fundación → holding → dominante) y las funciones de grupo (campañas multi-sociedad y matriz de formalización multi-jurisdicción ES/PT/BR/MX).

---

## Cifras clave verificadas en Cloud (`governance_OS`, 2026-06-13)

| Magnitud | Valor verificado | Nota |
|---|---|---|
| **Materias societarias (motor)** | **57 *rule packs* / 56 materias distintas** | Tras retirar el duplicado `MOD_ESTATUTOS` (W5, 2026-06-13). Único duplicado restante: `AUTORIZACION_GARANTIA` (un pack por órgano: Junta + Consejo) |
| Plantillas `MODELO_ACUERDO` | **70 totales / 58 ACTIVA** (54 materias) | Catálogo distinto de los *rule packs* (`plantillas_protegidas` para documentos vs `rule_packs` para reglas) |
| Plantillas protegidas (todas) | **110 totales / 75 ACTIVA / 35 ARCHIVADA** | 100 % jurisdicción `ES`; `tipo_social` NULL en todas |
| Órganos de gobierno de ARGA Seguros, S.A. | **12** | 1 Junta + 1 CdA + 5 Comisiones + 5 Comités |
| Composición del Consejo de Administración | **17 condiciones vigentes** | 1 Presidente + 1 Secretario (no consejero) + 15 Consejeros (uno PJ) |
| Capital social de ARGA Seguros, S.A. | **307.955.327,30 €** | 3.079.553.273 títulos × 0,10 € nominal |
| Cap table de control | **Cartera ARGA S.L.U. 69,69 % + free float 30,31 % = 100 %** | Clase única ORD |
| Acuerdos (`agreements`) | **145 totales** | DRAFT 101 · PROPOSED 4 · ADOPTED 25 · CERTIFIED 12 · FILED 1 · REGISTERED 2 (golden path W2) |
| Acuerdos por modo de adopción | MEETING 113 · UNIPERSONAL_SOCIO 20 · NO_SESSION 7 · UNIVERSAL 4 · UNIPERSONAL_ADMIN 1 | suma = 145 (control de integridad) |
| Reuniones (`meetings`) | CONVOCADA 8 · CELEBRADA 16 | |
| Acuerdos sin sesión | APROBADO 4 · RECHAZADO 6 | |
| Decisiones unipersonales | BORRADOR 11 · FIRMADA 5 | |
| Certificaciones | **7 firmadas** (`signature_status = SIGNED`) | |
| Expedientes registrales (`registry_filings`) | **6** (PREPARADA 2 · INSCRITA 2 · DENEGADA 1 · ELEVADA 1) | Golden path sembrado (W2, 2026-06-13): 2 INSCRITA (directa + subsanación resuelta, con inscripción + BORME) + 1 DENEGADA con defecto calificado |
| Libros y registros (`mandatory_books`) | **552 filas / 252 legalizables / 2 legalizadas** | Legalización prospectiva en la demo |
| Pactos parasociales | **3 cláusulas VIGENTES** | VETO + MAYORIA_REFORZADA_PACTADA + CONSENTIMIENTO_INVERSOR |
| RBAC | **5 roles · matriz de capacidades 35 filas (5×7) · 4 pares tóxicos SoD** | |

---

## Glosario de abreviaturas y siglas

**Normativa y reguladores**
- **LSC** — Ley de Sociedades de Capital (RD Legislativo 1/2010).
- **RRM** — Reglamento del Registro Mercantil (RD 1784/1996).
- **CCom** — Código de Comercio.
- **LMV / LMVSI** — Ley de los Mercados de Valores y de los Servicios de Inversión (Ley 6/2023). Sustituye al TRLMV; la categoría histórica "hecho relevante" quedó derogada (hoy: "otra información relevante" + "información privilegiada").
- **MAR** — Reglamento (UE) 596/2014 sobre Abuso de Mercado (información privilegiada, art. 17).
- **eIDAS / eIDAS 2** — Reglamento (UE) 910/2014 de identificación electrónica y servicios de confianza, y su revisión.
- **CNMV** — Comisión Nacional del Mercado de Valores. **DGSFP** — Dirección General de Seguros y Fondos de Pensiones. **BdP** — Banco de Portugal. **SUSEP** (Brasil) y **CNSF** (México) — supervisores de seguros.
- **Solvencia II / LOSSEAR** — Régimen prudencial de aseguradoras (Ley 20/2015; Reglamento Delegado UE 2015/35; RD 1060/2015).
- **IAGC** — Informe Anual de Gobierno Corporativo (art. 540 LSC).

**Servicios de confianza (QTSP)**
- **QTSP** — Prestador Cualificado de Servicios de Confianza. En este ecosistema, **EAD Trust** (empresa tecnológica de Garrigues, g-digital), proveedor único.
- **QES** — Firma Electrónica Cualificada (persona física). **QSeal** — Sello Electrónico Cualificado (persona jurídica). **TSQ** — Sello de Tiempo Cualificado. **ERDS** — Servicio Cualificado de Entrega Electrónica Certificada (notificación fehaciente).

**Técnicas y de control**
- **WORM** — *Write-Once-Read-Many* (registro inmutable, *append-only*). **SoD** — *Segregation of Duties* (segregación de funciones). **RBAC** — *Role-Based Access Control*. **SSOT** — *Single Source of Truth*. **RLS** — *Row-Level Security*.
- **SHA-256 / SHA-512** — funciones hash criptográficas usadas en la cadena de evidencia y auditoría.

**Órganos y figuras societarias**
- **CdA** — Consejo de Administración. **JGA / JGE** — Junta General de Accionistas / Junta General Extraordinaria.
- **PF / PJ** — Persona Física / Persona Jurídica (en el modelo, `person_type ∈ {PF, PJ}`).
- **SA / SAU / SL / SLU** — Sociedad Anónima / Anónima Unipersonal / Limitada / Limitada Unipersonal.

**Registros mercantiles por jurisdicción**
- **BORME** — Boletín Oficial del Registro Mercantil (España). **Iberclear** — depositario central de valores (anotaciones en cuenta, cotizadas).
- **SIGER / PSM / RPC** — sistemas y Registro Público de Comercio (México). **JUCESP / JUCERJA / Junta Comercial** — Juntas Comerciales (Brasil). **Conservatória / IRN** — registro y autoridad registral (Portugal).

**Decisiones y retribución (catálogo interno)**
- **DL-1…DL-6** — Decisiones Legales del motor LSC (catálogo resuelto el 2026-04-19; ver §3 del bloque 3).
- **RF / RVA / ILP** — Retribución Fija / Retribución Variable Anual / Incentivo a Largo Plazo. **TSR** — *Total Shareholder Return*. **ROE** — rentabilidad sobre fondos propios. **CSM** — *Contractual Service Margin* (IFRS 17). **RCGNV / BN** — métricas de retribución demo (ver DL-6).

---

---

# 1. Libros y registros sociales, modelo de entidades administradas y funciones de grupo

## 1. Libros y registros sociales

### 1.1 Arquitectura del portfolio de libros

El módulo de Libros no es un mero listado de filas almacenadas: es un **portfolio derivado** que combina (i) libros realmente persistidos en la tabla Cloud `mandatory_books` con (ii) **libros virtuales** sintetizados en tiempo de cliente a partir de la naturaleza societaria de cada entidad y de sus órganos vigentes. Toda la lógica de derivación vive en `src/lib/secretaria/libros-societarios.ts` (función `buildSocietaryBookPortfolio`), se consume desde el hook `src/hooks/useLibros.ts` (`useLibrosList`) y se presenta en `src/pages/secretaria/LibrosObligatorios.tsx`.

Las consecuencias jurídico-operativas de este diseño son tres:

1. **El catálogo de libros exigibles se calcula, no se asume.** La función `expectedBookCodesForEntity()` lee `tipo_social`/`legal_form`, `es_cotizada` y `regulated_sector` de la sociedad y genera el conjunto de libros que la ley le impone. Una SL/SLU genera Libro registro de socios (art. 104 LSC); una SA/SAU genera Libro registro de acciones nominativas (art. 116 LSC); toda sociedad unipersonal (SLU/SAU) genera además el Libro registro de contratos del socio único (art. 16 LSC); y todas obtienen los libros contables (Diario; Inventarios y Cuentas Anuales) más los registros auxiliares base.
2. **Las secciones de actas se seccionan por órgano vivo.** En lugar de un único "Libro de actas" monolítico, `actaBookKindForBody()` clasifica cada `governing_body` (Junta, CdA, Comisión de Auditoría, Nombramientos/Retribuciones, Riesgos, Ejecutiva, comisión delegada) y le asigna su subtipo de libro de actas con su propia base legal. Un libro persistido genérico `LIBRO_ACTAS` actúa como contenedor *legacy* que se secciona automáticamente cuando la sociedad tiene órganos.
3. **El estado de legalización y sus alertas se computan por plazo.** `classifyBookDeadline()` clasifica cada libro en `legalized` / `overdue` / `due_soon` (≤ 30 días) / `in_time` / `unknown`, sobre el campo `legalization_deadline` y `legalization_status`, y la UI pinta el semáforo (rojo vencido, ámbar < 30 días).

### 1.2 Estructura real de la tabla `mandatory_books` (Cloud, schema `public`)

La tabla persistida en `governance_OS` tiene columnas alineadas con las dimensiones jurídicas del libro (verificado por introspección de `information_schema.columns`):

| Columna | Tipo | Función jurídica |
|---|---|---|
| `entity_id`, `body_id` | uuid | sociedad y, en su caso, órgano al que se imputa el libro |
| `book_kind` | text | tipo de libro (clave canónica) |
| `book_group` | text | `LIBRO_MERCANTIL` (libro legal) vs `REGISTRO_AUXILIAR` |
| `volume_number`, `period` | integer | volumen y ejercicio del libro |
| `status` | text | estado del libro (`OPEN`, etc.) |
| `opened_at`, `closed_at` | date | apertura y cierre del volumen |
| `legalization_deadline` | date | plazo de legalización telemática |
| `legalization_status` | text | `PENDIENTE` / `PRESENTADO` / `LEGALIZADO` / `RECHAZADO` |
| `legalization_requirement` | text | `OBLIGATORIA` / `RECOMENDADA` / `NO_APLICA` |
| `requires_legalization` | boolean | gate booleano de exigibilidad |
| `legalization_mode` | text | modo (telemática anual ante RM, etc.) |
| `legalization_evidence_url` | text | evidencia de legalización |
| `legal_basis` | text | base normativa |
| `custodian_role` | text | custodio (secretario, órgano de administración, dir. financiera) |
| `maintenance_model` | text | modelo de alimentación de asientos |
| `content_route` | text | ruta al registro natural del contenido |
| `supervision_tags` | text[] | etiquetas supervisoras (LSC, RRM, CNMV, DGSFP, Solvencia II, CCom) |
| `is_auxiliary` | boolean | marca de registro auxiliar |
| `entries_count`, `last_entry_at` | integer / timestamptz | métricas de actividad |

### 1.3 Régimen por tipo de libro

El catálogo canónico (`BOOK_DEFINITIONS` en `libros-societarios.ts`) distingue dos grandes grupos: **libros mercantiles** (legalizables ante el Registro Mercantil) y **registros auxiliares** (no legalizables, soporte de gobierno corporativo y trazabilidad supervisora). El régimen completo:

#### Libros mercantiles (grupo `LIBRO_MERCANTIL`)

| Libro | Base legal | Custodio | Legalización | Modelo de mantenimiento |
|---|---|---|---|---|
| Libro de actas (contenedor) | arts. 202 y 250 LSC; arts. 97-107 y 109 RRM | Secretario societario | Obligatoria, telemática ante RM | Se secciona por órgano desde `meetings`/`minutes` |
| Libro de actas de la Junta General | arts. 202-203 LSC; arts. 97-107 RRM | Secretario del CdA | Obligatoria, anual | Asientos de actas de órganos tipo Junta |
| Libro de actas del Consejo de Administración | art. 250 LSC; art. 109 RRM | Secretario del CdA | Obligatoria, anual | Asientos de actas generadas en `ReunionStepper` |
| Libro de actas Comisión de Auditoría | art. 529 *quaterdecies* LSC; Ley 22/2015 | Secretario de la comisión | Recomendada (libro separado o sección del CdA según criterio del RM) | Asientos separados y elevación al Consejo |
| Libro de actas Nombramientos y Retribuciones | art. 529 *quindecies* LSC | Secretario de la comisión | Recomendada | Propuestas, informes y supervisiones |
| Libro de actas Comité de Riesgos | arts. 65-66 Ley 20/2015; arts. 44-46 RD 1060/2015; reglamento del Consejo | Secretario del comité | Recomendada (libro separado por trazabilidad supervisora) | Composición, mayoría independiente, presidente no ejecutivo |
| Libro de actas Comisión Ejecutiva | art. 249 y 249 bis LSC | Secretario de la comisión | Recomendada | Facultades delegadas, límites e indelegables |
| Libro de actas comisión delegada | art. 250 LSC por analogía; reglamento del Consejo | Secretario de la comisión | Recomendada (confirmar criterio del RM competente) | Comisiones sin subtipo específico |
| **Libro registro de socios** | **art. 104 LSC** | Órgano de administración | Obligatoria, anual | Asientos **WORM append-only** desde `capital_movements` y `capital_holdings` vigentes |
| **Libro registro de acciones nominativas** | **art. 116 LSC**; normativa de anotaciones en cuenta para cotizadas | Órgano de administración | Obligatoria, anual; **conciliación con Iberclear en cotizadas** | Asientos desde `capital_movements` y cap table vigente |
| **Libro registro de contratos del socio único** | **art. 16 LSC** | Órgano de administración | Obligatoria, anual | Asientos desde decisiones unipersonales y contratos socio único |
| Libro Diario | arts. 25 y ss. CCom | Dirección financiera | Obligatoria, anual | Registro contable fuera del flujo societario, visible para gobierno documental |
| Libro de Inventarios y Cuentas Anuales | arts. 25 y ss. CCom; arts. 253 y 279 LSC | Dirección financiera | Obligatoria, anual | Coordinado con formulación, aprobación por Junta y depósito |

#### Registros auxiliares (grupo `REGISTRO_AUXILIAR`, legalización `NO_APLICA`)

| Registro | Base legal | Función |
|---|---|---|
| Registro de personas y cargos | arts. 109 y 124 RRM; arts. 214 y 529 *sexies* LSC | SSOT de `condiciones_persona`, autoridad certificante e inscripción RM |
| Registro de conflictos y operaciones vinculadas | arts. 228-230 y 529 *ter* LSC | Snapshot de conflictos por punto y abstenciones verificables |
| Registro de delegaciones de facultades | arts. 249 y 249 bis LSC | Alcance, límites, escritura e inscripción de delegaciones |
| Registro de poderes y representaciones | arts. 184 y 212 bis LSC; práctica registral | Poderes generales/especiales, pleitos, representantes permanentes |
| Registro de pactos parasociales | práctica de buen gobierno; arts. 530-535 LSC para cotizadas | Vetos, compromisos de voto y alertas no invalidantes |
| Registro de comunicaciones regulatorias | LOSSEAR, Solvencia II, LMV, RD 1060/2015 | Comunicaciones DGSFP/CNMV y estado de respuesta |

**Registros auxiliares adicionales solo para asegurador cotizado** (activados por `isInsuranceListedEntity()` cuando `es_cotizada = true` y `regulated_sector` contiene "SEGURO"):

| Registro | Base legal |
|---|---|
| Registro de idoneidad *fit & proper* | art. 38 Ley 20/2015; RD 1060/2015 |
| Registro de supervisión Solvencia II | Ley 20/2015; Reglamento Delegado UE 2015/35 (SFCR, RSR, evidencias de Pilar 3) |

### 1.4 Trazabilidad real en Cloud (tenant demo)

El inventario real de libros sembrado en `governance_OS` confirma la operatividad del modelo. **Cifra de control verificada en Cloud:** `mandatory_books` tiene **552 filas** en total para el tenant, de las cuales **252 son legalizables** (`requires_legalization = true`; el resto son registros auxiliares no legalizables) y solo **2 figuran como LEGALIZADO**. Es decir, **la legalización es prospectiva en la demo**: el modelo está poblado y operativo, pero la legalización telemática ante el Registro Mercantil está casi toda en estado `PENDIENTE`. Conviene además recordar (ver §1.1) que **los libros mostrados en pantalla no equivalen 1:1 a filas legalizadas**: muchos son *libros virtuales* sintetizados en cliente por `buildSocietaryBookPortfolio` a partir de la naturaleza societaria y los órganos vigentes, no filas persistidas.

Recuento por `book_kind` (agregado de todo el tenant):

| `book_kind` | Filas | Legalizados | Pendientes | Próximo plazo |
|---|---|---|---|---|
| LIBRO_ACTAS_CONSEJO_ADMINISTRACION | 28 | 0 | 28 | 2027-04-30 |
| LIBRO_ACTAS_JUNTA_GENERAL | 15 | 0 | 15 | 2027-04-30 |
| LIBRO_ACTAS (contenedor legacy) | 50 | 0 | 50 | 2027-04-30 |
| LIBRO_ACCIONES_NOMINATIVAS | 38 | 1 | 37 | 2027-04-30 |
| LIBRO_REGISTRO_SOCIOS | 9 | 0 | 9 | 2027-04-30 |
| LIBRO_CONTRATOS_SOCIO_UNICO | 3 | 0 | 3 | 2027-04-30 |
| LIBRO_DIARIO | 50 | 0 | 50 | 2027-04-30 |
| LIBRO_INVENTARIOS_CUENTAS_ANUALES | 50 | 0 | 50 | 2027-04-30 |
| ACTAS_CDA / ACTAS_COMISION / SOCIOS (claves legacy) | 1+1+1 | 0/0/1 | 1/1/0 | 2026-04-30 |
| Registros auxiliares (CONFLICTOS, DELEGACIONES, PODERES, PACTOS, PERSONAS_CARGOS, COMUNICACIONES) | 50 c/u | — | — | sin plazo (no legalizable) |

Las claves *legacy* (`ACTAS`, `SOCIOS`, `ACCIONES`, `SOCIO_UNICO`, `ACTAS_CDA`, `ACTAS_COMISION`) se normalizan en cliente vía `LEGACY_KIND_ALIAS` y `normalizeMandatoryBookKind()`, de modo que conviven con las claves canónicas sin duplicar la vista.

### 1.5 Libro de socios — cap table vivo y registro WORM

`src/pages/secretaria/LibroSocios.tsx` materializa dos vistas complementarias:

- **Cap table actual** (`useCapitalHoldings`): titularidades vigentes (`capital_holdings` sin `effective_to`), ordenadas por porcentaje de capital, con NIF/CIF, clase de acción, número de títulos, % capital, indicador de voto y autocartera, y fecha de alta.
- **Movimientos de capital** (`useCapitalMovements`): log **WORM append-only** e inmutable, con tipos EMISIÓN, AMORTIZACIÓN, TRANSMISIÓN, PIGNORACIÓN, LIBERACIÓN_PRENDA, SPLIT y CONTRASPLIT, vinculados al acuerdo (`agreements`) que los origina. Estos movimientos alimentan tanto el Libro registro de socios (SL) como el de acciones nominativas (SA).

---

## 2. Modelo canónico de identidad — las 8 tablas

El núcleo de identidad societaria descansa en ocho tablas Cloud (schema `public`), cuya estructura real ha sido verificada por introspección. Sustituyen progresivamente al modelo *legacy* `mandates` y constituyen la fuente de verdad de socios, órganos, cargos, representaciones y derechos de voto.

| Tabla | Responsabilidad | Columnas clave (Cloud real) | Reglas de integridad |
|---|---|---|---|
| **`entities`** | Sociedad/persona jurídica administrada | `person_id` (FK obligatoria a `persons`, **NOT NULL**), `tipo_organo_admin`, `tipo_social`, `legal_form`, `es_cotizada`, `regulated_sector`, `forma_administracion`, `es_unipersonal`, `parent_entity_id`, `ownership_percentage`, `group_role`, datos registrales (RM volumen/folio/hoja/inscripción), `lei_code`, `legal_hold`, `retention_policy_id` | Cada entidad apunta a su PJ vía `person_id`; campos registrales para inscripción RM |
| **`entity_capital_profile`** | Capital social con historial | `capital_escriturado`, `capital_desembolsado`, `numero_titulos`, `valor_nominal`, `currency`, `estado` (`VIGENTE`/`HISTORICO`), `effective_from`/`effective_to` | **Máximo una fila VIGENTE por entidad** (UNIQUE parcial). Las versiones anteriores quedan en `HISTORICO` |
| **`share_classes`** | Clases de acciones/participaciones | `class_code`, `name`, `votes_per_title`, `economic_rights_coeff`, `voting_rights`, `veto_rights`, `restrictions` (jsonb) | Separa derecho económico (`economic_rights_coeff`) de derecho político (`votes_per_title`), habilita clases sin voto y con veto |
| **`condiciones_persona`** | Rol de una persona en sociedad/órgano (SSOT de cargos) | `tipo_condicion` (SOCIO, CONSEJERO, PRESIDENTE, SECRETARIO, ADMIN_*, etc.), `estado` (`VIGENTE`/…), `body_id`, `fecha_inicio`/`fecha_fin`, `representative_person_id`, `fuente_designacion`, `inscripcion_rm_referencia`, `inscripcion_rm_fecha`, `metadata` (jsonb: `categoria`, etc.) | Unicidad de condición vigente vía índice `ux_condicion_vigente` que usa `COALESCE(body_id, sentinel)`; no índices parciales separados |
| **`capital_holdings`** | Libro de socios (titularidades) | `holder_person_id`, `share_class_id`, `numero_titulos`, `porcentaje_capital`, `voting_rights`, `is_treasury`, `effective_from`/`effective_to`, `metadata` | `is_treasury = true` ⇒ autocartera sin voto. Vigencia por `effective_to IS NULL` |
| **`representaciones`** | Representación voluntaria/orgánica | `represented_person_id`, `representative_person_id`, `scope` (PJ_PERMANENTE, JUNTA_PROXY, CONSEJO_DELEGACION), `meeting_id`, `porcentaje_delegado`, `effective_from`/`effective_to`, `evidence` (jsonb) | Soporta representante permanente de PJ, *proxy* de junta y delegación en consejo |
| **`parte_votante_current`** | Proyección regenerable de partes votantes | `source_type`/`source_id`, `voting_rights`, `voting_weight`, `denominator_weight`, `exclusion_policy`, `exclusion_reason`, `generated_at` | **Separa `voting_weight` de `denominator_weight`** (peso de voto vs peso en denominador de cómputo). Proyección reconstruible, no fuente primaria |
| **`censo_snapshot`** | Censo inmutable WORM por sesión | `meeting_id`, `session_kind`, `body_id`, `snapshot_type` (ECONOMICO/POLITICO/UNIVERSAL), `payload` (jsonb), `capital_total_base`, `total_partes`, `audit_worm_id` | **Inmutable**: triggers BEFORE UPDATE/DELETE lo bloquean; `audit_worm_id` se autocompleta en INSERT |

### 2.1 Reglas de oro verificadas en Cloud

Estas garantías de integridad han sido confirmadas directamente contra `governance_OS`:

1. **Inmutabilidad del censo (WORM).** Existen tres triggers sobre `censo_snapshot`:
   - `trg_block_censo_snapshot_update` — `BEFORE UPDATE … EXECUTE FUNCTION trg_block_censo_snapshot_ud()` (bloquea modificación)
   - `trg_block_censo_snapshot_delete` — `BEFORE DELETE … EXECUTE FUNCTION trg_block_censo_snapshot_ud()` (bloquea borrado)
   - `trg_censo_snapshot_worm` — `BEFORE INSERT … EXECUTE FUNCTION trg_censo_snapshot_worm()` (autocompleta `audit_worm_id`)

   El censo de una sesión, una vez creado, no puede alterarse ni borrarse: cualquier UPDATE/DELETE lanza excepción. Es la garantía probatoria de que el cómputo de quórum y mayorías de una reunión se hizo sobre un censo congelado e íntegro.

2. **`persons.person_type` restringido a PF/PJ.** Constraint `persons_person_type_check`: `CHECK ((person_type = ANY (ARRAY['PF'::text, 'PJ'::text])))`. El dominio "persona jurídica" se mapea a `'PJ'`, nunca a `'JURIDICA'`. Las PJ titulares (Cartera ARGA, Fundación, free float) figuran como `person_type = 'PJ'`.

3. **Autocartera con peso nulo.** En la proyección de partes votantes y en `capital_holdings`, `is_treasury = true` fuerza `voting_weight = 0` y `denominator_weight = 0`.

4. **Una sola fila de capital VIGENTE por entidad.** Verificado en ARGA Seguros: existe una fila `VIGENTE` (`effective_from 2025-01-01`) y una `HISTORICO` (`capital_escriturado = 0`, `effective_from 2026-04-21`).

### 2.2 Constantes canónicas (`src/test/helpers/supabase-test-client.ts`)

| Constante | Valor |
|---|---|
| `DEMO_TENANT` | `00000000-0000-0000-0000-000000000001` |
| `DEMO_ENTITY_ARGA` (ARGA Seguros, S.A.) | `6d7ed736-f263-4531-a59d-c6ca0cd41602` |
| `DEMO_ENTITY_CARTERA` (Cartera ARGA S.L.U.) | `00000000-0000-0000-0000-000000000020` |
| `DEMO_PJ_FUNDACION_TAX_ID` | `G-99999901` |
| `DEMO_PJ_CARTERA_TAX_ID` | `B-99999902` |
| `DEMO_PJ_ARGA_SEGUROS_TAX_ID` | `A-99999903` |
| `DEMO_PJ_MERCADO_LIBRE_TAX_ID` | `X-99999904` |

---

## 3. Estructura societaria ARGA real (extraída de Cloud)

### 3.1 Cadena de control y cap table de la dominante

La entidad canónica **ARGA Seguros, S.A.** (`6d7ed736-…-c6ca0cd41602`, jurisdicción ES, `tipo_social = SA`, `es_cotizada = true`, `tipo_organo_admin = CDA`) tiene un capital social escriturado y desembolsado de **307.955.327,30 €** (3.079.553.273 títulos de 0,10 € nominal, moneda EUR, perfil `VIGENTE` desde 2025-01-01).

El cap table vigente (`capital_holdings` con `effective_to IS NULL`) confirma la estructura demo:

| Titular | NIF/CIF | Tipo | Clase | Títulos | % capital | Voto |
|---|---|---|---|---|---|---|
| **Cartera ARGA S.L.U.** | B-99999902 | PJ | ORD | 2.145.754.856 | **69,69 %** | Sí |
| **Mercado libre (free float agregado)** | FREE-FLOAT-ARGA | PJ | ORD | 933.798.417 | **30,31 %** | Sí |
| (varios holders QA de prueba) | QA-* | PF | ORD | 25 c/u | ~0,00 % | Sí |

Suma de los dos bloques de control: **100,00 %** (las filas QA son ruido de testing de transmisiones, con porcentaje despreciable). Existe una única clase de acción: **ORD — "Acciones ordinarias de la misma clase"**.

La cadena de control completa (estructura demo coherente con el modelo de grupo):

```
Fundación ARGA (Fundación, ES)
   └─100%→ Cartera ARGA S.L.U. (B-99999902, SLU, ADMIN_UNICO)
              ├─69,69%→ ARGA Seguros, S.A. (A-99999903, SA cotizada)
              └─30,31% restante: Mercado libre (free float agregado)
```

> Nota de trazabilidad: en `entities` coexisten variantes *legacy* del holding (`Cartera ARGA, S.A.` con UUID `517522ab-…`) frente a la canónica `Cartera ARGA S.L.U.` (`00000000-…-020`). La fuente de verdad para la cadena de control es la SLU, que es la titular del 69,69 % en el cap table.

### 3.2 Órganos de gobierno de ARGA Seguros, S.A.

`governing_bodies` para la dominante (`entity_id = 6d7ed736-…`) registra el siguiente entramado de gobierno corporativo de asegurador cotizado:

| Órgano | `slug` | `body_type` |
|---|---|---|
| Junta General de Accionistas | `junta-general-arga-seguros` | JUNTA |
| Consejo de Administración | `consejo-administracion` | CDA |
| Comité Ejecutivo | `comite-ejecutivo` | COMITE |
| Comisión de Auditoría y Cumplimiento Normativo | `comision-auditoria` | COMISION |
| Comisión de Nombramientos | `comision-nombramientos` | COMISION |
| Comisión de Retribuciones | `comision-retribuciones` | COMISION |
| Comisión de Riesgos Regulada | `comision-riesgos` | COMISION |
| Comisión de Sostenibilidad | `comision-sostenibilidad` | COMISION |
| Comité de Riesgos | `comite-riesgos` | COMITE |
| Comité de Cumplimiento | `comite-cumplimiento` | COMITE |
| Comité de Dirección | `comite-direccion` | COMITE |
| Comité Asesor de Tecnología e Innovación (CATIT) | `comite-tecnologia` | COMITE |

### 3.3 Composición real del Consejo de Administración

La composición vigente (`condiciones_persona`, `body_id = fe05ddd9-…`, `estado = VIGENTE`) da **17 condiciones**: **1 Presidente + 1 Secretario + 15 Consejeros**, coherente con la estructura demo de 15 miembros del CdA más el Secretario no consejero:

| Cargo (`tipo_condicion`) | Persona | Tipo | Categoría (`metadata`) |
|---|---|---|---|
| PRESIDENTE | D. Antonio Ríos Valverde | PF | EJECUTIVO |
| SECRETARIO | Dña. Lucía Paredes Vega | PF | (Secretario no consejero) |
| CONSEJERO | ARGA Capital Inversiones SL | **PJ** | DOMINICAL |
| CONSEJERO | D. Álvaro Mendoza Torres | PF | — |
| CONSEJERO | D. André Barbosa Lima | PF | — |
| CONSEJERO | D. Fernando López Aguirre | PF | — |
| CONSEJERO | D. Javier Ruiz Montero | PF | — |
| CONSEJERO | D. Miguel Ortega Sánchez | PF | — |
| CONSEJERO | D. Pablo Navarro Iglesias | PF | — |
| CONSEJERO | D. Ricardo Vega Sanz | PF | — |
| CONSEJERO | D. Roberto García Prieto | PF | — |
| CONSEJERO | Dña. Carmen Delgado Ortiz | PF | — |
| CONSEJERO | Dña. Isabel Moreno Castro | PF | — |
| CONSEJERO | Dña. Lucía Martín | PF | — |
| CONSEJERO | Dña. María Santos Gil | PF | — |
| CONSEJERO | Dña. Sofía Herrera Ramos | PF | — |
| CONSEJERO | Dña. Valentina Guzmán Reyes | PF | — |

Hechos jurídicamente relevantes: hay un **consejero persona jurídica** (ARGA Capital Inversiones SL, categoría DOMINICAL) — caso que exige representante persona física permanente vía `representaciones` (scope `PJ_PERMANENTE`); el Presidente está marcado como EJECUTIVO; el resto de categorías (independiente/ejecutivo) están parcialmente vacías en `metadata`, deuda de seed conocida.

### 3.4 Perímetro de grupo en Cloud

El tenant contiene un grupo multinacional amplio: filiales aseguradoras en ES (ARGA España, ARGA Vida, ARGA Salud, ARGA RE, ARGA Asistencia), LATAM (Argentina, Brasil, Chile, Colombia, México, Perú), Europa (Alemania AG, Italia S.p.A., Portugal S.A., Malta Ltd., Luxemburgo RE, Turquía A.Ş.), Asia (Filipinas Inc., Indonesia PT) y EE. UU. (Corporation); más vehículos instrumentales españoles (ARGA Inversiones SICAV, ARGA LATAM Holdings S.L., ARGA Digital, ARGA Servicios Corporativos S.L. con administradores mancomunados/solidarios, ARGA Tecnología Jurídica S.L. con administradores mancomunados). La diversidad de `tipo_organo_admin` (CDA, ADMIN_UNICO, ADMIN_SOLIDARIOS, ADMIN_MANCOMUNADOS) es precisamente la palanca que el motor de grupo usa para enrutar la forma de adopción de cada acuerdo.

> Las entidades `PHASE-B…` y `PHASE-B6…`, `Arga test A`, `PRUEBA`, `SEGUROS TEST` son artefactos de pruebas E2E, no estructura societaria real.

---

## 4. Funciones de grupo y multi-jurisdicción

### 4.1 Scope switcher: doble modo Grupo / Sociedad

Toda la Secretaría opera bajo un **conmutador de ámbito** (`src/components/secretaria/shell/ScopeSwitcher.tsx` + `useSecretariaScope.ts`) con dos modos: **Grupo** (icono *Network*) y **Sociedad** (icono *Building2*). El ámbito por defecto es `grupo`; al seleccionar una sociedad concreta se conmuta a `sociedad` con el `entityId` correspondiente. El ámbito se persiste y se propaga vía query param `?scope=` y `createScopedTo()`, de modo que páginas como Libros, Libro de socios o Procesos respetan automáticamente el perímetro:

- En **modo sociedad**, `LibrosObligatorios.tsx` filtra el portfolio por `selectedEntity.id` y muestra solo los libros y registros de esa sociedad, con KPIs de libros legales, registros auxiliares y pendientes de legalización.
- En **modo grupo**, las mismas vistas muestran el agregado multi-entidad.

### 4.2 War Room de campañas de grupo (`ProcesosGrupo.tsx`)

`src/pages/secretaria/ProcesosGrupo.tsx` (ruta `/secretaria/procesos-grupo`) implementa el **motor de campañas de grupo**: una instrucción única que se descompone automáticamente en expedientes diferenciados por sociedad. La página exige modo Grupo (si no, ofrece conmutar). El flujo:

1. **Configuración de la campaña** (`group-campaign-engine.ts`): tipo de campaña (plantillas `GROUP_CAMPAIGN_TEMPLATES`), ejercicio, fechas de cierre/lanzamiento, inclusión o no de la dominante cotizada, preferencia por acuerdos sin sesión, y selección de jurisdicciones.
2. **Descomposición automática** (`buildGroupCampaignExpedientes`): para cada sociedad del alcance, el motor lee **forma social, forma de administración y unipersonalidad** y asigna la **forma de adopción** (`MEETING`, `NO_SESSION`, `CO_APROBACION`, `SOLIDARIO`, `POST_TASK`) y el **rule pack legal aplicable**. Una misma campaña genera flujos distintos: consejo, administrador único, mancomunados, solidarios, socio único.
3. **Cadena de acuerdos** con dependencias temporales y plazos por hito.
4. **War Room** (`useGroupCampaigns`): seguimiento real de campañas persistidas, con expedientes por sociedad, fases/tareas, *live records* vinculados (a `agreements`, `convocatorias`, `no_session_expedientes`, `unipersonal_decisions`, `group_campaign_post_tasks`) y enlaces operativos directos. Conserva tareas POST (firma, inscripción, depósito, evidencias).

### 4.3 Matriz jurisdiccional ES/PT/BR/MX (`MatrizJurisdiccional.tsx`)

`src/pages/secretaria/MatrizJurisdiccional.tsx` (ruta `/secretaria/multi-jurisdiccion`) parte de una tesis jurídica explícita y deliberada: **la gobernanza real ocurre en ARGA Seguros, S.A. (España); las filiales BR/MX/PT son vehículos 100 % dependientes que únicamente *formalizan localmente* la decisión del grupo.** Quórum, mayorías y convocatoria son por tanto irrelevantes en la mayoría de materias de filial (socio/accionista único). La pantalla ofrece dos vistas:

**Vista por filial** — para cada jurisdicción, el régimen de formalización local:

| | ES | PT | BR | MX |
|---|---|---|---|---|
| Ley marco | LSC (RD Leg. 1/2010) | CSC (DL 262/86) | Lei 6.404/76 + CC (Ltda) | LGSM (DOF 1934, ref. 2016) |
| Forma típica filial | SLU/SAU | Sociedade Unipessoal por Quotas | Sociedade Limitada Unipessoal | S.A. de C.V. |
| Forma de acuerdo local | Decisión socio único (art. 15 LSC) | Decisão sócio único (art. 270-G CSC) | Decisão sócio único (CC art. 1.072 §1) | Asamblea universal accionista único (art. 189 LGSM) |
| Escritura notarial | No (salvo estructurales) | No (salvo estructurales) | No | **Sí — siempre obligatoria para inscribir en RPC** |
| Registro local | Registro Mercantil | Conservatória / IRN | Junta Comercial (JUCESP/JUCERJA) | Registro Público de Comercio (vía notario) |
| Plazo inscripción | 30 días | 60 días | 30 días | 15 días |
| Traducción jurada de la decisión española | No | **Sí** | **Sí** | No |

El módulo combina estos datos normativos estáticos con **datos en vivo de Cloud**: `useFilialEntitiesByJurisdiction` (filiales reales por jurisdicción), `useFilialAgreementCounts` (acuerdos pendientes) y `useEntityRules`/`useJurisdiccionRules` (reglas jurisdiccionales activas en TGMS: preaviso, quórum, junta universal, plazo de inscripción, *statutory_override*).

**Vista por materia** — tabla cross-jurisdicción para las cinco materias de grupo (nombramiento/cese de administrador; modificación de estatutos; distribución de dividendos/reservas; operación estructural fusión/escisión/liquidación; préstamo/garantía intragrupo). Para cada materia indica quién decide (siempre el órgano español competente: CdA, JGA con mayoría reforzada 2/3 en estructurales, o Comité Ejecutivo según cuantía) y qué formalización local exige cada filial, **marcando en rojo los bloqueos regulatorios sectoriales**: SUSEP (Brasil — autorización previa para fusiones, cambio de director, cambio de objeto), CNSF (México — autorización previa para cambio de objeto o de control, dictamen actuarial), BdP (Portugal — autorización para operaciones estructurales de aseguradoras), más retenciones fiscales en remesas (IRRF/IOF en BR, ISR en MX, IRNR en ES).

El propio módulo delimita su **alcance MVP**: implementa seguimiento de formalizaciones pendientes, alertas de plazo de inscripción, generación de instrucción multilingüe a filial y control de traducción jurada (PT/BR); **no** implementa validación de quórum/mayorías en filiales (irrelevante por socio único), motor de reglas locales BR/MX/PT completo, integración directa con JUCESP/IRN/RPC, ni gestión de autorizaciones SUSEP/CNSF/BdP (estas las gestiona el departamento legal, no el motor).

---

### Trazabilidad de fuentes (rutas absolutas)

- Libros: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/pages/secretaria/LibrosObligatorios.tsx`, `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/pages/secretaria/LibroSocios.tsx`, `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/hooks/useLibros.ts`, `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/lib/secretaria/libros-societarios.ts`
- Modelo canónico (constantes): `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/test/helpers/supabase-test-client.ts`
- Funciones de grupo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/pages/secretaria/ProcesosGrupo.tsx`, `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/pages/secretaria/MatrizJurisdiccional.tsx`, `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/lib/secretaria/group-campaign-engine.ts`
- Scope switcher: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/components/secretaria/shell/ScopeSwitcher.tsx`, `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map/src/components/secretaria/shell/useSecretariaScope.ts`
- Cloud (`governance_OS`, `hzqwefkwsxopwrmtksbg`): tablas `mandatory_books`, `entities`, `governing_bodies`, `entity_capital_profile`, `share_classes`, `condiciones_persona`, `capital_holdings`, `representaciones`, `parte_votante_current`, `censo_snapshot`; triggers `trg_block_censo_snapshot_update/_delete`, `trg_censo_snapshot_worm`; constraint `persons_person_type_check`.

---

# 2. Procesos societarios soportados

Esta sección cataloga, de forma exhaustiva, los procesos operativos del módulo de Secretaría Societaria de la plataforma TGMS, tal y como están implementados en el código y respaldados por el esquema de la base de datos en producción (proyecto Supabase `governance_OS`). Todas las rutas penden del prefijo `/secretaria/*` (declaradas en `src/App.tsx`, líneas 211-271, bajo el `SecretariaLayout`). El motor de reglas societarias invocado por los procesos vive en `src/lib/rules-engine/` (LSC español más matrices de normalización para PT/BR/MX). Para la calificación de cada proceso se emplean cuatro categorías de comportamiento:

- **owner-write** — flujo operativo de alta/edición que persiste estado en tablas propias de Secretaría.
- **read-only** — vista de consulta de un expediente existente, sin mutación.
- **intake** — pantalla de captación previa que origina un expediente formal desde el órgano competente.
- **handoff** — punto de entrada/salida cross-módulo (navegación de solo lectura, sin escritura cruzada).

Nomenclatura de estados: las etiquetas en español proceden del mapa central `src/lib/secretaria/status-labels.ts` (función `statusLabel()`); cuando un componente define su propio mapa local se indica expresamente.

---

## 1. Convocatoria de reunión de órgano (junta general / consejo / comisión)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Convocatoria formal de junta general (arts. 166-176 LSC), de consejo de administración (art. 246 LSC) o de comisión delegada; soporta convocatoria ordinaria, extraordinaria y constitución de junta/consejo universal. |
| **Rutas** | `/secretaria/convocatorias` (listado), `/secretaria/convocatorias/nueva` (stepper de alta), `/secretaria/convocatorias/:id` (detalle read-only) |
| **Tipo** | owner-write (alta) + read-only (detalle) |
| **Componente** | `src/pages/secretaria/ConvocatoriasStepper.tsx` |
| **Hook** | `src/hooks/useConvocatorias.ts` (`useCreateConvocatoria`, `useUploadConvocatoriaAttachment`, `useConvocatoriaById`) |
| **Tabla** | `convocatorias` (campos `fecha_1`, `fecha_2` segunda convocatoria, `publication_channels`, `agenda_items`, `reminders_trace`, `tipo_convocatoria`, `modalidad`) |

**Propósito societario.** Generar y emitir la convocatoria de una reunión del órgano elegido, calculando la antelación legal según jurisdicción y forma social, clasificando el orden del día por clase de materia y produciendo el borrador del documento de convocatoria con resolución de variables.

**Pasos del stepper (8 pasos, definidos en `STEPS`, líneas 60-69):**

1. **Sociedad y órgano** — selección de sociedad, órgano convocante (junta general / consejo / comisión delegada) y tipo de convocatoria (`ORDINARIA` / `EXTRAORDINARIA` / `UNIVERSAL`).
2. **Fecha y plazo legal** — fecha, hora, lugar y formato (`PRESENCIAL` / `TELEMATICA` / `MIXTA`). Calcula la antelación requerida mediante doble evaluación (motor V1 `checkNoticePeriodByType` + motor V2 `evaluarConvocatoria`, reconciliados en `buildConvocatoriaNoticeDoubleEvaluation`). Habilita la **segunda convocatoria** solo para junta de SA/SAU (art. 177.1 LSC) con control del gap mínimo de 24 horas (art. 177.2 LSC).
3. **Orden del día** — alta dinámica de puntos clasificados por clase de materia (`ORDINARIA` mayoría simple / `ESTATUTARIA` mayoría reforzada arts. 199/201 LSC / `ESTRUCTURAL` inscribible) y por naturaleza del punto (`kind` v3.1: `DECISORIO` "Acuerdo", `INFORMATIVO`, `TOMA_DE_RAZON`, `DELIBERATIVO`, `ACEPTACION_INFORME`, `RUEGOS_PREGUNTAS`). Solo los puntos `DECISORIO` activan el motor de reglas LSC y materializan acuerdo registrable. Para SA cotizada, las materias marcadas `lmvCotizada` (operación vinculada, programa de recompra, remuneración de consejeros, emisión de obligaciones, fusión/escisión, etc.) emiten advertencias LMV/CNMV específicas (`LMV_COTIZADA_ADVERTENCIAS`).
4. **Destinatarios** — miembros del órgano con derecho a recibir la convocatoria. En junta general se computan los titulares de capital con derecho de voto (excluyendo autocartera vía `is_treasury` / `voting_rights=false`); en consejo/comisión se toman los mandatos vigentes ordenados por prioridad de cargo (presidente, secretario, vicepresidente, coordinador, consejero).
5. **Canales de publicación** — filtrados por jurisdicción y tipo de órgano. Junta → publicidad oficial (BORME / web corporativa art. 173 LSC / DOF / Diário da República, etc.); consejo/comisión → notificación directa (email, correo certificado, **ERDS de EAD Trust**, burofax).
6. **Adjuntos** — documentos de referencia y propuestas que se anexan (subida vía `useUploadConvocatoriaAttachment`).
7. **Borrador documento** — selección de plantilla, captura de la capa 3 editable (`Capa3CaptureDialog`) y composición del texto final con resolución de variables (matriz de proceso de plantillas).
8. **Revisión y emisión** — verificación de compliance del motor V2 y emisión definitiva. Tras emitir, se ofrece el paso opcional **envío de la comunicación** a los miembros (`PasoEnvioMiembros`), que crea la fila en `communications` vía la RPC `fn_create_communication_atomic`.

**Motor de reglas.** `evaluarConvocatoria` (de `src/lib/rules-engine/convocatoria-engine.ts`), resolución de rule packs por materia (`useRuleResolutions`), reglas jurisdiccionales (`useEntityRules` / `checkNoticePeriodByType`).

**Artefactos.** Fila en `convocatorias`; borrador documental (capa 1 inmutable + capa 2 variables + capa 3 editable); opcionalmente comunicación certificada en `communications` (ERDS).

---

## 2. Reunión del órgano (sesión conectada) y junta/consejo universal

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Celebración de la sesión del órgano: constitución, verificación de quórum (arts. 193-194 LSC junta; art. 247 LSC consejo), debate, votación de acuerdos y levantamiento de acta (art. 202 LSC). Incluye la modalidad de junta/consejo **universal** (art. 178 LSC). |
| **Rutas** | `/secretaria/reuniones` (listado), `/secretaria/reuniones/:id` (stepper operativo de sesión conectada), `/secretaria/reuniones/nueva` (intake read-only / receptor de handoffs) |
| **Tipo** | owner-write (sesión `:id`) + intake/handoff (`/nueva`) |
| **Componente** | `src/pages/secretaria/ReunionStepper.tsx` |
| **Hook** | `src/hooks/useReunionSecretaria.ts` (`useOpenMeeting`, `useReplaceAttendees`, `useUpdateQuorumData`, `useBodyMembers`, `useSaveMeetingResolutions`, `useGenerarActa`, `useCreateUniversalMeeting`) |
| **Tablas** | `meetings` (`status`, `quorum_data` JSONB, `president_id`, `secretary_id`), `meeting_attendees` (`attendance_type`, `represented_by_id`, `capital_representado`), `meeting_resolutions` (`status`, `agreement_id`, `kind_resolution`), `minutes` |

**Propósito societario.** Conducir la sesión real del órgano paso a paso, dejando constancia formal de constitución, asistentes, quórum, deliberación, resultado de votaciones y generación del acta en borrador, materializando un acuerdo (`agreements`) por cada punto decisorio aprobado.

**Pasos del stepper (6 pasos, `buildSteps`, líneas 4173-4220):**

1. **Constitución** (`ConstitutionStep`) — verificación del contexto de constitución y **declaración de apertura** de la sesión (`useOpenMeeting` → `meetings.status` a `OPEN`). Gate de avance: no se progresa sin abrir la sesión.
2. **Asistentes** (`AsistentesStep`) — registro de presentes / representados / ausentes; cálculo de capital representado. Persiste con `useReplaceAttendees` (delete-all + insert sobre `meeting_attendees`, columna canónica `attendance_type`).
3. **Quórum** (`QuorumStep`) — evaluación automática del quórum de constitución contra la regla jurisdiccional aplicable (motor `evaluarMayoria` / constitución); persiste en `meetings.quorum_data.quorum`.
4. **Agenda y debate** (`DebatesStep`) — agenda formal, propuestas preparadas y puntos nacidos en sesión; mantiene `source_links` hacia los `agenda_items` de la convocatoria de origen.
5. **Votaciones** (`VotacionesStep`) — resultado por punto con mayoría, conflictos de interés, vetos, pactos parasociales y snapshot legal; registra `meeting_resolutions` reales (estado `ADOPTED` si favor > contra) y crea los `agreements` asociados.
6. **Cierre** (`CierreStep`) — revisión de acuerdos adoptados y **generación del acta en borrador** mediante la RPC `fn_generar_acta(p_meeting_id, p_content, p_snapshot_id)` (`useGenerarActa`), con navegación a `/secretaria/actas/:minuteId`.

La reanudación de una sesión deriva el paso inicial del estado real (`deriveReunionInitialStep`): sesión abierta con resultados reabre en Cierre; con quórum, en Agenda; con asistentes, en Quórum; etc.

**Junta/consejo universal.** La ruta `/nueva` incluye `UniversalMeetingIntake` (`useCreateUniversalMeeting`), que constituye la sesión universal sin convocatoria previa (art. 178 LSC) con confirmación expresa de aceptación de los presentes.

**Estados Cloud reales de `meetings`** (etiquetas de `status-labels.ts`): `PROGRAMADA` "Programada", `CONVOCADA` "Convocada", `EN_CURSO` "En curso", `CELEBRADA` "Celebrada", `CANCELADA` "Cancelada". En producción se observan `CONVOCADA` (8) y `CELEBRADA` (16).

**Motor de reglas.** Constitución/quórum y mayorías (`constitucion-engine.ts`, `majority-evaluator.ts`, `votacion-engine.ts`), con pre-evaluación de pactos parasociales (`pactos-engine.ts`) que inyecta `vetoActivo`.

**Artefactos.** Filas en `meetings`, `meeting_attendees`, `meeting_resolutions`; acuerdos en `agreements`; acta en `minutes` (con `content_hash`, `snapshot_id`, `rules_applied`).

---

## 3. Recepción de propuestas cross-módulo (intake de reunión)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Captación read-only de una propuesta originada en otro módulo (GRC Compass / AIMS 360) para su elevación a la agenda del órgano competente. La decisión de convocar/celebrar la conserva Secretaría. |
| **Ruta** | `/secretaria/reuniones/nueva?source=&event=&source_id=` |
| **Tipo** | handoff (entrada) + intake |
| **Contrato** | `src/lib/secretaria/cross-module-handoff.ts` (`MEETING_INTAKE_PATH`, `readMeetingHandoff`) |

**Comportamiento.** El contrato centraliza las claves de query (`source`, `event` con alias `handoff`, `source_id` con alias `ai_incident`) para evitar drift entre emisores y receptor. Es **navegación de solo lectura**: no escribe en `governance_module_events` ni `governance_module_links` (guardrail CLAUDE.md). El receptor es `ReunionStepper.tsx` (intake), que lee el handoff con `readMeetingHandoff` y marca `isCrossModule` cuando `source` es `grc` o `aims`.

**Handoffs de entrada implementados:**

| Origen | Ruta emisora | Evento |
|---|---|---|
| GRC — escalado genérico de incidente | `/secretaria/reuniones/nueva?source=grc` (`src/pages/grc/Dashboard.tsx:368`) | escalado a agenda del órgano |
| GRC — hallazgo de auditoría | `/secretaria/reuniones/nueva?source=grc&source_table=findings&source_id=…&event=GRC_FINDING_BOARD_ESCALATION` (`src/pages/grc/modules/audit/Findings.tsx:104`) | `GRC_FINDING_BOARD_ESCALATION` |
| AIMS — incidente material de IA | `/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL&ai_incident=…` (`src/pages/ai-governance/Incidentes.tsx`) | `AIMS_INCIDENT_MATERIAL` |

**Handoffs de salida desde Secretaría / hacia GRC:** la documentación de ownership contempla además que las certificaciones/acuerdos de Secretaría referencien evidencia AIMS/GRC solo si la postura probatoria está etiquetada, y los escalados inversos hacia GRC Risk-360 (`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP`) y `/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL`. Todos son read-only.

---

## 4. Actas

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Acta de la sesión del órgano (art. 202 LSC; arts. 97-112 RRM), libro de actas del órgano correspondiente. |
| **Rutas** | `/secretaria/actas` (listado), `/secretaria/actas/:id` (detalle) |
| **Tipo** | owner-write derivada (se genera desde el Cierre de reunión) + read-only (detalle) |
| **Componentes** | `src/pages/secretaria/ActasLista.tsx`, `src/pages/secretaria/ActaDetalle.tsx` |
| **Hook** | `src/hooks/useActas.ts` (`useAgreementIdsForMinute`, tipo `ActaRow` con `body_id`/`entity_id`) |
| **Tabla** | `minutes` (`content`, `content_hash`, `canonical_minutes_hash`, `snapshot_id`, `rules_applied`, `signed_by_secretary_id`, `signed_by_president_id`, `signed_at`, `registered_at`, `is_locked`, `legal_structure_validation`) |

**Propósito y artefactos.** El acta no se redacta como proceso independiente: se genera en el paso de Cierre de la reunión mediante `fn_generar_acta`, que calcula `content_hash` y vincula `snapshot_id` (censo WORM). `ActaDetalle.tsx` muestra el acta y monta el botón **Emitir certificación** cuando existen `id` y `entity_id`. Existe además la RPC `fn_aprobar_acta` para el ciclo de aprobación del acta. La generación de actas de órgano de administración admite el tipo `ACTA_ORGANO_ADMIN`; `fn_acta_book_kind_for_body` resuelve el libro de actas aplicable según el tipo de órgano.

---

## 5. Certificación de acuerdos (pipeline QTSP)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Certificación de acuerdos sociales (art. 109 RRM): expedición por el secretario con el visto bueno del presidente, con vistas a su elevación a público. |
| **Punto de invocación** | Botón en `ActaDetalle.tsx` y `AcuerdoSinSesionDetalle.tsx` |
| **Tipo** | owner-write (gateado por capacidad RBAC) |
| **Componente** | `src/components/secretaria/EmitirCertificacionButton.tsx` |
| **Hooks** | `useHasCapability` (capability `CERTIFICATION`), `usePresidenteVigente` |
| **Tabla** | `certifications` (`tipo_certificacion`, `certificante_role`, `visto_bueno_persona_id`, `agreements_certified[]`, `signature_status`, `hash_certificacion`, `gate_hash`, `tsq_token` bytea, `authority_evidence_id`) |

**Propósito societario.** Emitir la certificación del acuerdo precargando el visto bueno con el presidente vigente (`usePresidenteVigente`), bajo control de la matriz de capacidades (el botón se oculta si el usuario no tiene la capacidad `CERTIFICATION`).

**Pipeline de 3 RPCs encadenadas** (documentado en la cabecera del componente, líneas 6-10):

1. `fn_generar_certificacion(p_minute_id, p_tipo, p_agreements_certified[], p_certificante_role, p_visto_bueno_persona_id)` — crea la certificación con `gate_hash` (SHA-256 de `snapshot_hash ‖ resultado_hash`).
2. `fn_firmar_certificacion(p_certification_id, p_qtsp_token, p_tsq_token)` — firma QES (stub QTSP determinista, token TSQ en base64). `signature_status` → `SIGNED`.
3. `fn_emitir_certificacion(p_certification_id)` — devuelve la URI del bundle operativo demo de evidencia.

**Estados Cloud reales.** `tipo_certificacion = ACUERDO`; `signature_status = SIGNED`. En producción existen 7 certificaciones firmadas.

**Artefactos.** Fila en `certifications`; sello/firma QES (EAD Trust); bundle de evidencia documental (no productivo: evidence backbone en `pending`). Existe también `fn_generar_certificacion_acuerdo_sin_sesion` para certificar acuerdos adoptados sin sesión.

---

## 6. Tramitador registral (elevación a público e inscripción)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Elevación a instrumento público (escritura notarial) e inscripción del acuerdo en el Registro Mercantil (o equivalente extranjero: SIGER/PSM México, Conservatória/JUCERJA Brasil, Diário Oficial Portugal). |
| **Rutas** | `/secretaria/tramitador` (listado), `/secretaria/tramitador/nuevo` (stepper de alta), `/secretaria/tramitador/:id` (detalle read-only) |
| **Tipo** | owner-write (alta `/nuevo`) + read-only (detalle `:id`) |
| **Componente** | `src/pages/secretaria/TramitadorStepper.tsx` |
| **Hook** | `src/hooks/useTramitador.ts` (`useCertificationRegistryIntake`, `useTramitacionById`, `useAgreementHasCertification`) |
| **Tabla** | `registry_filings` (`filing_via`, `filing_number`, `presentation_date`, `inscription_number`, `borme_ref`, `psm_ref`, `siger_ref`, `conservatoria_ref`, `jucerja_ref`, `diario_oficial_ref`, `defect_details`, `deed_reference`, `notary_name`, `protocol_number`, `elevated_at`) |

**Propósito societario.** Tomar un acuerdo certificado y conducir su elevación a público e inscripción registral, con seguimiento del estado del expediente y gestión de subsanaciones.

**Pasos del stepper (5 pasos, `STEPS`, líneas 25-49):**

1. **Seleccionar acuerdo** — selección del acuerdo inscribible; verifica que cuente con certificación (`useAgreementHasCertification`); permite override de certificación de escritura.
2. **Vía de presentación** — elección del canal registral (`filing_via`).
3. **Datos del instrumento** — notario, fecha de escritura (`deedDate`), número de protocolo (`protocolNumber`).
4. **Presentación** — registro de la presentación en el registro competente.
5. **Seguimiento** — control del estado del expediente y subsanaciones.

**Máquina de estados (vocabulario español canónico, ITEM-102).** Etiquetas de `status-labels.ts`: `PREPARADA` "Preparada", `PRESENTADA` "Presentada", `EN_TRAMITE` "En trámite", `SUBSANACION` "Subsanación", `INSCRITA` "Inscrita", `ELEVADA` "Elevada a público", `DENEGADA` "Denegada". Subsisten alias ingleses legacy de solo lectura: `SUBMITTED`/`INSCRIBED`/`ELEVATED` (etiquetados como "(legacy)"). Cuando el estado es `SUBSANACION` con `agreement_id`, el detalle ofrece la afordancia de reanudar la subsanación.

**Estados Cloud reales de `registry_filings`:** `PREPARADA` (2), `PRESENTADA` (1), `EN_TRAMITE` (1), `SUBSANACION` (1), `ELEVADA` (1). Vías observadas: `NOTARIAL`, `ELECTRONICA`, `SIGER`, `DEMO_PREPARACION_REGISTRAL`.

**Vista read-only `:id`.** Muestra estado, vía, notario, fecha de escritura y estado de la deed; advierte expresamente que las altas, subsanaciones y documentos se gestionan desde el alta operativa.

**Artefactos.** Fila en `registry_filings`; asiento/presentación registral; referencia de instrumento público.

---

## 7. Acuerdos sin sesión (votación por escrito)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Adopción de acuerdos sin sesión por votación por escrito y sin reunión (art. 100 RRM / arts. 248.2 LSC para consejo), con cómputo de mayoría o unanimidad. |
| **Rutas** | `/secretaria/acuerdos-sin-sesion` (listado), `/secretaria/acuerdos-sin-sesion/nuevo` (stepper), `/secretaria/acuerdos-sin-sesion/:id` (detalle) |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/AcuerdoSinSesionStepper.tsx` |
| **Hook** | `src/hooks/useAcuerdosSinSesion.ts` (`useCloseExpiredVotaciones`) |
| **Tabla** | `no_session_resolutions` (`status`, `voting_deadline`, `votes_for`, `votes_against`, `abstentions`, `requires_unanimity`, `total_members`, `selected_template_id`, `matter_class`, `agreement_kind`) |

**Propósito societario.** Recoger los votos por escrito de los miembros del órgano dentro de un plazo y, si se alcanza la mayoría/unanimidad requerida, materializar el acuerdo en estado `ADOPTED`.

**Pasos del stepper (5 pasos, `STEPS`, líneas 30-35):**

1. **Tipo y órgano** — sociedad, órgano, tipo de acuerdo (clase `ORDINARIA` / `ESTATUTARIA` / `ESTRUCTURAL`) y `agreement_kind`.
2. **Propuesta** — texto del acuerdo y fundamento jurídico.
3. **Participantes** — miembros con derecho a voto (deduplicados por persona) y plazo de respuesta; flag de **requiere unanimidad**.
4. **Votación** — recogida de votos por escrito por miembro mediante la RPC `fn_no_session_cast_response`.
5. **Cierre y acuerdo** — resultado final; si se aprueba, materializa el acuerdo `ADOPTED` mediante `fn_no_session_close_and_materialize_agreement`, dejándolo disponible para el Tramitador.

**Estados.** `BORRADOR` "Borrador", `VOTING_OPEN` "Votación abierta", `APROBADO` "Aprobado", `RECHAZADO` "Rechazado". En Cloud: `APROBADO` (4), `RECHAZADO` (6). Las votaciones vencidas se auto-cierran al montar el listado vía `fn_cerrar_votaciones_vencidas(p_tenant_id)` (`useCloseExpiredVotaciones`).

**Motor de reglas.** `no-session-engine.ts` (pipeline de 5 gates) + `votacion-engine.ts`.

**Artefactos.** Fila en `no_session_resolutions`; acuerdo `ADOPTED` en `agreements` (`adoption_mode = NO_SESSION`); certificación opcional vía `fn_generar_certificacion_acuerdo_sin_sesion`.

---

## 8. Acuerdo de administradores por co-aprobación (k de n)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Adopción de acuerdo por el órgano de administración plural mediante co-aprobación de un número mínimo *k* de los *n* administradores (modo `CO_APROBACION`). |
| **Ruta** | `/secretaria/acuerdos-sin-sesion/co-aprobacion` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/CoAprobacionStepper.tsx` |
| **Motor** | `evaluarCoAprobacion` (`src/lib/rules-engine/votacion-engine.ts`) |

**Pasos del stepper (5 pasos, `STEPS`, líneas 27-32):**

1. **Tipo de acuerdo** — materia, clase y texto de la propuesta.
2. **Configuración k de n** — número mínimo de administradores y ventana temporal.
3. **Firmas** — registro de firmas de los administradores que aprueban.
4. **Evaluación motor** — verificación de validez por el motor LSC (`evaluarCoAprobacion`).
5. **Registrar** — creación del acuerdo (`adoption_mode = CO_APROBACION`, `execution_mode` JSONB) y emisión de certificación.

**Artefactos.** Acuerdo en `agreements` con `execution_mode` `CO_APROBACION`; certificación de tipo `CO_APROBACION`.

---

## 9. Acuerdo de administrador solidario

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Adopción de acuerdo por un administrador solidario actuante (modo `SOLIDARIO`), forma de administración solidaria del art. 210 LSC. |
| **Ruta** | `/secretaria/acuerdos-sin-sesion/solidario` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/SolidarioStepper.tsx` |
| **Motor** | `evaluarSolidario` (`src/lib/rules-engine/votacion-engine.ts`) |

**Pasos del stepper (4 pasos, `STEPS`, líneas 26-30):**

1. **Tipo de acuerdo** — materia, clase y texto de la propuesta.
2. **Administrador actuante** — identificación del administrador solidario que adopta el acuerdo (resuelto con `useAdministradores`: cargos `ADMIN_UNICO`/`SOLIDARIO`/`MANCOMUNADO`/PJ con `body_id` NULL).
3. **Evaluación motor** — verificación de validez por el motor LSC (`evaluarSolidario`).
4. **Registrar** — creación del acuerdo de administrador solidario (`adoption_mode = SOLIDARIO`).

**Artefactos.** Acuerdo en `agreements` con `execution_mode` `SOLIDARIO`.

---

## 10. Decisiones de socio único y de administrador único

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Decisión del socio único (art. 15 LSC, sociedad unipersonal — `UNIPERSONAL_SOCIO`) o del administrador único (art. 210 LSC — `UNIPERSONAL_ADMIN`), con consignación en el libro-registro de decisiones del socio único. |
| **Rutas** | `/secretaria/decisiones-unipersonales` (listado), `/secretaria/decisiones-unipersonales/nueva` (stepper), `/secretaria/decisiones-unipersonales/:id` (detalle) |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/DecisionUnipersonalStepper.tsx` |
| **Hook** | `src/hooks/useDecisionesUnipers.ts` |
| **Tabla** | `unipersonal_decisions` (`decision_type`, `title`, `content`, `decided_by_id`, `status`, `requires_registry`) |

**Propósito societario.** Documentar la decisión unipersonal del decisor real (socio único al 100% o administrador único), con clasificación de materia y determinación de si requiere acceso al Registro.

**Pasos del stepper (3 pasos, `buildSteps`):**

1. **Tipo y materia** — selección de tipo (socio único / administrador único) con cita expresa del fundamento ("socio único — art. 15 LSC" / "administrador único — art. 210 LSC") y materia del acuerdo.
2. **Texto del acuerdo** — redacción del contenido de la decisión.
3. **Registro y documento** — determinación de `requires_registry` (derivada de `requires_registry` de la materia o de su carácter inscribible) y generación del documento.

**Estados.** `BORRADOR` "Borrador" → `FIRMADA` "Firmada". En Cloud: `BORRADOR` (11), `FIRMADA` (5). Tipos en Cloud: `SOCIO_UNICO`, `ADMINISTRADOR_UNICO` (más materias específicas como `APROBACION_CUENTAS`, `AUMENTO_CAPITAL`).

**Artefactos.** Fila en `unipersonal_decisions`; documento de la decisión; cuando es inscribible, deriva al Tramitador. Acuerdo en `agreements` con `adoption_mode` `UNIPERSONAL_SOCIO` / `UNIPERSONAL_ADMIN` (en Cloud: 20 + 1 respectivamente).

---

## 11. Generación documental con firma cualificada y archivado (pipeline QTSP)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Generación del documento del acuerdo (DOCX) con firma electrónica cualificada (QES) por el QTSP EAD Trust y archivado probatorio con sello de integridad. |
| **Ruta** | `/secretaria/acuerdos/:id/generar` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/GenerarDocumentoStepper.tsx` |
| **Hooks/libs** | `useQTSPSign` (firma QES), `src/lib/doc-gen/storage-archiver.ts` (`archiveDocxToStorage`, SHA-512), `variable-resolver.ts`, `docx-generator.ts` |

**Propósito societario.** Producir el documento formal del acuerdo a partir de la plantilla aprobada, resolviendo variables y capa editable, firmarlo con QES y archivarlo con hash SHA-512, vinculando la URI resultante al expediente (`agreements.document_url`).

**Pasos del stepper (5 pasos, `STEPS`, líneas 79-85):**

1. **Plantilla** — selección de la plantilla activa aplicable.
2. **Variables** — resolución automática de variables (capa 2).
3. **Editables** — captura de la capa 3 editable.
4. **Borrador** — previsualización del documento compuesto.
5. **Generar** — generación del DOCX; firma con QES vía `useQTSPSign` (EAD Trust); archivado en Supabase Storage con SHA-512 vía `archiveDocxToStorage`; escritura de `agreements.document_url`.

**Salvaguarda de evidencia (trust boundary).** El tipo de documento se etiqueta `QTSP_SIGNED_DOCX` solo si el QTSP entrega un artefacto firmado real (`!qesResult.sandbox`); en sandbox queda `ORIGINAL_DOCX` con `evidence_status = DEMO_OPERATIVA`, sin etiquetarse como firmado por EAD Trust (gate `evidence-sandbox-gate.ts`).

**Artefactos.** DOCX; firma QES (EAD Trust); bundle de evidencia con hash SHA-512; `document_url` enlazado al expediente.

Existe además `/secretaria/documentos/pendientes-revision` (`DocumentosPendientesRevision.tsx`) como cola de documentos pendientes de revisión, y `/secretaria/acuerdos/:id/generar` se complementa con el flujo de aprobación multi-step (`approval_workflow` JSONB en `agreements`, gestionado por `ApprovalWorkflowCard` en el expediente).

---

## 12. Expediente de acuerdo (agregado raíz y timeline de ciclo de vida)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Expediente unificado del acuerdo social como agregado raíz, que traza su recorrido desde la propuesta hasta la publicación registral. |
| **Ruta** | `/secretaria/acuerdos/:id` |
| **Tipo** | read-only (vista de expediente) con afordancias de acción (generar documento, workflow de aprobación) |
| **Componente** | `src/pages/secretaria/ExpedienteAcuerdo.tsx` |
| **Hook** | `src/hooks/useAgreementCompliance.ts` (motor de validez V2 + `compliance_snapshot`) |
| **Tabla** | `agreements` (agregado raíz; columnas `status`, `compliance_snapshot`, `compliance_explain`, `approval_workflow`, `document_url`, `gate_hash`, `adoption_mode`, `matter_class`, `inscribable`) |

**Propósito societario.** Centralizar el estado, la trazabilidad de cumplimiento (`compliance_snapshot` congelado al pasar a `ADOPTED`) y el documento del acuerdo, y mostrar su posición en la máquina de estados.

**Máquina de estados (timeline de 8 etapas + rama de rechazo, `TIMELINE`/`TIMELINE_LABEL`, líneas 95-117):**

| Orden | Estado | Etiqueta |
|---|---|---|
| 1 | `DRAFT` | Borrador |
| 2 | `PROPOSED` | Propuesto |
| 3 | `ADOPTED` | Adoptado |
| 4 | `CERTIFIED` | Certificado |
| 5 | `INSTRUMENTED` | Instrumentado |
| 6 | `FILED` | Preparado para registro |
| 7 | `REGISTERED` | Inscrito |
| 8 | `PUBLISHED` | Publicado |
| (rama terminal) | `REJECTED_REGISTRY` | Rechazado por el Registro Mercantil |

`REJECTED_REGISTRY` no es etapa lineal: es la rama terminal de rechazo desde `FILED`/`REGISTERED`. El componente calcula el índice de avance con `TIMELINE.indexOf(a.status)`.

**Estados Cloud reales de `agreements`:** `DRAFT` (101), `PROPOSED` (4), `ADOPTED` (25), `CERTIFIED` (13), `INSTRUMENTED` (1), `FILED` (1). Distribución por `adoption_mode`: `MEETING` (113), `UNIPERSONAL_SOCIO` (20), `NO_SESSION` (7), `UNIVERSAL` (4), `UNIPERSONAL_ADMIN` (1).

**Motor de reglas.** `useAgreementCompliance` retorna `ComplianceResult` con `convocation_compliant`, `quorum_compliant`, `conflict_handled`, `majority_compliant`, `instrument_required` (`ESCRITURA`/`INSTANCIA`/`NINGUNO`), `registry_required` y `blocking_issues`.

---

## 13. Board Pack ejecutivo

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Dossier ejecutivo para la sesión del consejo (board pack), con la documentación de soporte y las advertencias regulatorias aplicables. |
| **Rutas** | `/secretaria/board-pack`, `/secretaria/board-pack/:id`, `/secretaria/reuniones/:id/board-pack` (preview) |
| **Tipo** | read-only (con exportación PDF) |
| **Componentes** | `src/pages/secretaria/BoardPack.tsx`, `BoardPackPreview.tsx` |
| **Hook** | `src/hooks/useBoardPackData.ts` (9 queries en paralelo + lógica DL-2 cotizada) |

**Propósito y contenido.** Compone el dossier ejecutivo del consejo (9 secciones) con badges de estado de acuerdos (Borrador/Propuesto/Adoptado/Certificado/Instrumentado/Preparado para registro/Publicado) y de severidad de riesgos (Crítico/Alto/Medio/Bajo). Incluye expresamente las **advertencias LMV para entidad cotizada** (DL-2: ARGA Seguros S.A. cotizada — el motor evalúa y advierte, no bloquea) y la información de **voto de calidad** (DL-5). Soporta exportación a PDF (Sprint E-D6).

---

## 14. Calendario de vencimientos y procesos societarios

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Agenda de vencimientos societarios: legalización de libros (art. 18 Código de Comercio / Ley 14/2013), próximas convocatorias y reuniones, plazos de votación de acuerdos sin sesión y renovación de mandatos. |
| **Ruta** | `/secretaria/calendario` (en el sidebar figura como item "Procesos", selector estable `[data-sidebar-item="Procesos"]`) |
| **Tipo** | read-only |
| **Componente** | `src/pages/secretaria/Calendario.tsx` |

**Fuentes consolidadas (Promise.all sobre 5 orígenes):** `convocatorias` (`fecha_1`), `libros` (`legalization_deadline`, ventana de 90 días, tipo `LEGALIZACION_LIBRO`), `no_session_resolutions` (`voting_deadline`), `condiciones_persona` (vencimiento de mandato, `fecha_fin`) y `registry_filings`. Cada vencimiento ofrece navegación directa al expediente correspondiente (`nav_to`).

**Nota de marca.** El item de sidebar "Procesos" mantiene una incongruencia intencional documentada (label "Procesos" / icono `Calendar` / página `Calendario.tsx`), pendiente de reconciliación en el rework de procesos societarios.

---

## 15. Campañas de grupo (war room multi-sociedad)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Coordinación de procesos societarios homogéneos sobre un perímetro multi-sociedad del grupo (p.ej. aprobación de cuentas o cambios estatutarios en cascada), con dependencias entre hitos. |
| **Ruta** | `/secretaria/procesos-grupo?scope=grupo` |
| **Tipo** | owner-write (lanzamiento de campaña) — requiere modo "Grupo" |
| **Componente** | `src/pages/secretaria/ProcesosGrupo.tsx` |
| **Hook** | `src/hooks/useSociedades.ts` |

**Propósito.** "War room" de grupo que selecciona el perímetro de sociedades (filtrable por jurisdicción y por inclusión de cotizadas), construye los expedientes de campaña con sus dependencias (`buildGroupCampaignExpedientes`) y lanza la campaña coordinada (`buildGroupCampaignLaunchInput` → `launchMutation`). Cada expediente refleja su dependencia ("Depende de …" o "Primer hito de campaña"). Solo operativo en `scope.mode === "grupo"`.

---

## Procesos de gestión societaria (sociedades y personas)

Estos procesos pueblan el modelo canónico de identidad (`entities`, `condiciones_persona`, `capital_holdings`, `representaciones`, `persons`) que alimenta al resto del módulo.

### 16. Alta de sociedad (onboarding societario completo)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Constitución/alta en sistema de una sociedad con su capital social, clases de participaciones/acciones, cap table, órganos, cargos y marco normativo aplicable. |
| **Rutas** | `/secretaria/sociedades` (listado), `/secretaria/sociedades/nueva` (stepper), `/secretaria/sociedades/:id` (detalle) |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/SociedadNuevaStepper.tsx` |
| **Hook** | `src/hooks/useSociedades.ts` |

**Pasos del stepper (11 pasos, `STEPS`, líneas 34-46):** 1. Identificación · 2. Domicilio · 3. Perfil · 4. Capital · 5. Clases (de acciones/participaciones) · 6. Cap table · 7. Órganos · 8. Cargos · 9. Reglas (marco normativo) · 10. Soporte · 11. Revisión. La persistencia se ejecuta en transacciones (`Tx1Result` crea entidad + órganos), poblando `entity_capital_profile`, `share_classes`, `capital_holdings`, `governing_bodies` y `condiciones_persona`.

**Procesos vinculados a la sociedad:**
- `/secretaria/sociedades/:id/marco-normativo/activar` (`ActivarMarcoNormativo.tsx`) — activación del marco normativo de la sociedad.
- `/secretaria/sociedades/:id/reglas` — redirige al catálogo de materias (`ReglasAplicables` superseded).

### 17. Alta de socio / accionista

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Incorporación de un socio/accionista al libro-registro de socios (SL) o de acciones (SA), con su participación en el capital. |
| **Ruta** | `/secretaria/sociedades/:id/socio/nuevo` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/AnadirSocioStepper.tsx` |

**Pasos (3, `STEPS` línea 28):** 1. Persona · 2. Participación · 3. Confirmar. Persiste en `capital_holdings` (vinculado a `share_class_id`).

### 18. Transmisión de participaciones / acciones

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Transmisión de participaciones sociales (arts. 106-112 LSC) o de acciones, con su soporte documental, y actualización del libro-registro. |
| **Ruta** | `/secretaria/sociedades/:id/transmision` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/TransmisionStepper.tsx` |

**Pasos (4, `STEPS` línea 23):** 1. Origen (transmitente) · 2. Destino (adquirente) · 3. Soporte (documento de transmisión) · 4. Confirmar. Actualiza `capital_holdings`.

### 19. Designación de administrador / cargo

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Nombramiento de administrador (único, solidario, mancomunado, consejero) o cargo del órgano (art. 214 LSC), con su designación y vigencia. |
| **Rutas** | `/secretaria/sociedades/:id/admin/nuevo`, `/secretaria/cargos/nuevo` (alta de cargo cross-contexto) |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/DesignarAdminStepper.tsx` |
| **Hook** | `useAsignarCargo` |

**Pasos dinámicos (`STEPS`, líneas 124-126):** con sociedad ya fijada por URL → 1. Persona · 2. Cargo · 3. Designación · 4. Confirmar (4 pasos); sin sociedad (entrada por `/cargos/nuevo`) se inserta el paso "Sociedad" → 1. Persona · 2. Sociedad · 3. Cargo · 4. Designación · 5. Confirmar (5 pasos). Persiste en `condiciones_persona`.

### 20. Alta de persona (física o jurídica)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Alta de persona física (PF) o jurídica (PJ) en el registro de identidades, con datos de identidad, contacto, registro y rol de gobierno. |
| **Rutas** | `/secretaria/personas` (listado), `/secretaria/personas/nueva` (stepper), `/secretaria/personas/:id` (detalle) |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/PersonaNuevaStepper.tsx` |
| **Hooks** | `src/hooks/usePersonasCanonical.ts`, `usePersonasExtended.ts` |

**Pasos (6, `STEPS` línea 107):** 1. Tipo (PF/PJ) · 2. Identidad · 3. Contacto · 4. Registro · 5. Gobierno · 6. Confirmar. Persiste en `persons` (CHECK `person_type ∈ {PF, PJ}`).

### 21. Importación masiva de personas

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Carga masiva de personas desde fichero (CSV) con clave de fila para idempotencia. |
| **Ruta** | `/secretaria/personas/importar` |
| **Tipo** | owner-write (batch) |
| **Componente** | `src/pages/secretaria/PersonasImportStepper.tsx` |

Procesa filas con `row_key` (`fileName:rowNumber`) y reporta métricas de importación.

### 22. Designación de representante de administrador persona jurídica

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Designación del representante persona física del administrador persona jurídica (art. 212 bis LSC), con referencia al Registro Mercantil. |
| **Ruta** | `/secretaria/personas/:id/representante/nuevo` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/RepresentanteAdminPJStepper.tsx` |

**Pasos (3, `STEPS` línea 52):** 1. Sociedad · 2. Representante PF · 3. Referencia RM. Persiste en `representaciones` (tipo `PJ_PERMANENTE`).

### 23. Representación puntual (delegación de voto)

| Atributo | Valor |
|---|---|
| **Naturaleza jurídica** | Delegación puntual de voto: representación de socio en junta (art. 184 LSC, `JUNTA_PROXY`) o delegación entre miembros vigentes del consejo (art. 248 LSC, `CONSEJO_DELEGACION`). |
| **Ruta** | `/secretaria/representaciones/nueva` |
| **Tipo** | owner-write |
| **Componente** | `src/pages/secretaria/RepresentacionPuntualStepper.tsx` |

Dos alcances (`SCOPES`, líneas 17-30): "Delegación de voto en Junta" (`JUNTA_PROXY`, representación puntual de socio para una reunión concreta) y "Delegación en Consejo" (`CONSEJO_DELEGACION`, delegación puntual entre miembros vigentes). Persiste en `representaciones`.

---

## Procesos auxiliares de configuración y consulta

Aunque no son "procesos societarios" en sentido estricto, sostienen la operativa anterior y conviene listarlos por completitud:

| Proceso | Ruta(s) | Tipo | Función |
|---|---|---|---|
| Libros y registros sociales obligatorios | `/secretaria/libros`, `/secretaria/libro-socios` | read-only / gestión | Control de libros y alertas de legalización; RPC `fn_upsert_mandatory_book_v2` (con `REVOKE EXECUTE` a `authenticated`) |
| Catálogo de uso de plantillas | `/secretaria/plantillas` | read-only (SECRETARIO) | Catálogo público de plantillas `ACTIVA` con CTA "Usar esta plantilla" |
| Consola unificada de plantillas | `/secretaria/gestor-plantillas?tab=…` | read-only / owner-write por RBAC | Tabs dashboard/catálogo/cobertura/importar/métricas/auditoría/validación (Gate PRE) |
| Comunicaciones | `/secretaria/comunicaciones`, `/secretaria/comunicaciones/:id` | read-only | Seguimiento de comunicaciones (ERDS), estados `ENVIANDO`/`ENTREGADA_*`/`RESPONDIDA_*`/`EXPIRADA` |
| Matriz jurisdiccional | `/secretaria/multi-jurisdiccion` | read-only | Normalización jurisdiccional ES/PT/BR/MX (paso previo a multi-jurisdicción) |
| Catálogo de materias / de órganos | `/secretaria/catalogo-materias`, `/secretaria/catalogo-organos` | read-only | Catálogo normativo de materias societarias y tipologías de órgano |

---

### Notas de trazabilidad y alcance

- **Fuente de verdad.** Estados y volúmenes citados proceden de consultas SELECT en vivo sobre `governance_OS` (tenant demo `00000000-0000-0000-0000-000000000001`); los pasos de stepper, de la lectura directa de los componentes `*Stepper.tsx`.
- **RPCs del pipeline societario confirmadas en Cloud:** `fn_generar_acta`, `fn_aprobar_acta`, `fn_acta_book_kind_for_body`, `fn_generar_certificacion`, `fn_firmar_certificacion`, `fn_emitir_certificacion`, `fn_generar_certificacion_acuerdo_sin_sesion`, `fn_no_session_cast_response`, `fn_no_session_close_and_materialize_agreement`, `fn_cerrar_votaciones_vencidas`, `fn_save_meeting_resolutions`, `fn_create_communication_atomic`.
- **Limitaciones probatorias.** La firma QES y los bundles de evidencia operan en modo demo/sandbox (evidence backbone en estado `pending`, migración `000049` en HOLD); el código distingue explícitamente evidencia sandbox de evidencia sellada productiva (`evidence-sandbox-gate.ts`). No deben presentarse como evidencia final productiva.
- **Tratamiento de cotizada (DL-2).** La estructura demo ARGA Seguros S.A. es cotizada: el motor LSC **evalúa y advierte** (LMV/CNMV), no bloquea, en convocatoria, votación y board pack.

---

# 3. Materias societarias inventariadas y motor de reglas LSC

## 1. Arquitectura de datos del catálogo de materias

El conocimiento jurídico del módulo de Secretaría Societaria se externaliza en una estructura de tres tablas en el proyecto Cloud `governance_OS` (`hzqwefkwsxopwrmtksbg`), de modo que el equipo legal pueda versionar la regla sin tocar el código de la aplicación:

| Tabla | Rol jurídico | Columnas relevantes |
|---|---|---|
| `rule_packs` | Catálogo de materias (una fila por materia societaria) | `id`, `materia`, `organo_tipo`, `descripcion`, `tenant_id` |
| `rule_pack_versions` | Versiones versionadas e inmutables de cada materia, con la regla material completa en `payload` (JSONB) | `pack_id`, `version`, `payload`, `is_active`, `status`, `effective_from`/`effective_to`, `approved_at`/`approved_by`, `payload_hash`, `supersedes_version_id` |
| `rule_param_overrides` | Personalizaciones (estatutarias, pactadas, jurisdiccionales) que elevan —nunca rebajan— el suelo legal | `materia`, `clave`, `valor`, `fuente`, `referencia` |

A fecha de revisión el catálogo contiene **57 *rule packs*** que cubren **56 materias jurídicas distintas** (tras retirar el duplicado legacy `MOD_ESTATUTOS` en W5; verificado en Cloud el 2026-06-13: `count(*) = 57`, `count(DISTINCT materia) = 56`), todos del tenant demo. La única materia con doble pack es `AUTORIZACION_GARANTIA`, que tiene **un pack por órgano** (Junta General y Consejo de Administración). El número "57" se refiere a *packs de regla*, no a materias; no debe confundirse con las 58 plantillas `MODELO_ACUERDO` en estado ACTIVA (de un total de 70) que reporta la sección de gestión documental — son dos catálogos distintos (`rule_packs` para reglas, `plantillas_protegidas` para documentos). La regla material de cada materia (clase, quórum, mayoría, canales de convocatoria, documentación obligatoria, instrumento público, plazos de inscripción) no vive en columnas planas sino en el `payload` JSONB de la versión activa, estructurado **por tipo social** (`SA`, `SL`, `CONSEJO`) con su cita de artículo LSC/RRM. Por ejemplo, para `MODIFICACION_ESTATUTOS` el payload distingue `votacion.mayoria.SA` = "reforzada art. 201.2 LSC", `votacion.mayoria.SL` = "favor > 1/2 capital total con voto (art. 199.a LSC)", `constitucion.quorum.SA_1a` = 0,50 (art. 194.1 LSC) y `constitucion.quorum.SA_2a` = 0,25, con `postAcuerdo.inscribible = true`, `instrumentoRequerido = ESCRITURA` y `plazoInscripcion = 60 días (art. 19 RRM)`.

Esto significa que para una misma materia el motor emite quórum y mayoría distintos según la entidad sea SA o SL, y según se convoque en primera o segunda convocatoria; las columnas "Quórum SA 1ª/2ª" y "Mayoría" de las tablas siguientes resumen esos valores ya resueltos desde el payload activo.

Trazabilidad de cada materia: tabla `rule_packs` (id/descripción/órgano) + `rule_pack_versions.payload` (regla material por tipo social) + `rule_param_overrides` (capa de personalización). Cada versión lleva `payload_hash` y `supersedes_version_id`, de modo que el motor puede certificar contra qué redacción exacta de la regla se evaluó un acuerdo.

---

## 2. Inventario completo de materias (57 packs · 56 materias distintas)

### 2.1 Junta General — Materias ESTRUCTURALES

Modificaciones del contrato social que afectan a la estructura o existencia de la sociedad; todas inscribibles y, salvo excepción, requieren escritura pública.

| Código (materia) | Descripción | Quórum SA 1ª / 2ª | Mayoría SA | Mayoría SL | Inscribible | Instrumento |
|---|---|---|---|---|---|---|
| `FUSION` | Fusión de sociedades | 0,50 / 0,25 | art. 201.2 LSC (reforzada) | art. 199.a LSC | Sí | Escritura |
| `ESCISION` | Escisión de sociedad | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `TRANSFORMACION` | Transformación del tipo social | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `DISOLUCION` | Disolución de la sociedad | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `LIQUIDACION` | Liquidación (arts. 360–400 LSC) | 0,50 / 0,25 | art. 201.2 LSC (req. mod. estatutaria, art. 368) | art. 199.a LSC | Sí | Escritura |
| `CESION_GLOBAL_ACTIVO` | Cesión global de activo y pasivo | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `SUPRESION_PREFERENTE` | Supresión del derecho de suscripción preferente | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `VENTA_ACTIVOS_ESENCIALES` | Venta de activos esenciales (art. 160.f LSC) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | **No** | Ninguno |

### 2.2 Junta General — Materias ESTATUTARIAS

Modificaciones de estatutos en sentido estricto; quórum reforzado SA (50%/25%), mayoría reforzada art. 201.2 LSC (SA) / art. 199.a LSC (SL), inscribibles con escritura.

| Código (materia) | Descripción | Quórum SA 1ª / 2ª | Mayoría SA | Mayoría SL | Inscribible | Instrumento |
|---|---|---|---|---|---|---|
| `MODIFICACION_ESTATUTOS` | Modificación de estatutos (materia canónica) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `MOD_ESTATUTOS` | Modificación de estatutos (grafía legacy → alias) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `AUMENTO_CAPITAL` | Aumento de capital social | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `AMPLIACION_CAPITAL` | Ampliación de capital (grafía → alias de AUMENTO_CAPITAL) | 0,50 / 0,25 | art. 201.2 LSC (arts. 295–316) | art. 199.a LSC | Sí | Escritura |
| `AUMENTO_CAPITAL_NO_DINERARIO` | Aumento con aportaciones no dinerarias | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `REDUCCION_CAPITAL` | Reducción de capital social | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `DELEGACION_CAPITAL` | Delegación en el órgano de admin. para aumentar capital (art. 297 LSC) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `EMISION_OBLIGACIONES` | Emisión de obligaciones | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `EMISION_DEUDA_CONVERTIBLE` | Emisión de deuda convertible (arts. 401–418) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE` | Exclusión del derecho de suscripción preferente (art. 308; → alias SUPRESION_PREFERENTE) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `CAMBIO_DENOMINACION_SOCIAL` | Cambio de denominación social (art. 285) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `CAMBIO_DOMICILIO_SOCIAL` | Cambio de domicilio social (art. 285.2; → alias TRASLADO_DOMICILIO_NACIONAL) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `AMPLIACION_OBJETO_SOCIAL` | Ampliación del objeto social (art. 285; separación art. 346.1.a si sustitución) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `PRORROGA_SOCIEDAD` | Prórroga de la sociedad (art. 285) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |
| `PRESTACIONES_ACCESORIAS` | Prestaciones accesorias (SL) | 0,50 / 0,25 | art. 201.2 LSC | art. 199.a LSC | Sí | Escritura |

### 2.3 Junta General — Materias ESPECIALES

Materias con régimen de mayoría/quórum específico (transmisión de participaciones, exclusión de socio, pacto parasocial).

| Código (materia) | Descripción | Quórum SA 1ª / 2ª | Mayoría SA | Mayoría SL | Inscribible | Instrumento |
|---|---|---|---|---|---|---|
| `TRANSMISION_PARTICIPACIONES` | Autorización de transmisión de participaciones | 0,25 / 0 | art. 201.1 LSC | art. 107.2 LSC (mayoría ordinaria 198) | Sí | Escritura |
| `EXCLUSION_SOCIO` | Exclusión de socio | 0,50 / 0,25 | art. 201.2 LSC | art. 199.b LSC | Sí | Escritura |
| `PACTO_PARASOCIAL` | Pacto parasocial (art. 29 LSC) | 0,25 / 0 | art. 29 LSC (vincula contractualmente; ratificación societaria por mayoría ordinaria) | art. 198 LSC | **No** | Ninguno |

### 2.4 Junta General — Materias ORDINARIAS

Acuerdos de gestión ordinaria; quórum SA 25%/0 y mayoría ordinaria (art. 201.1 LSC / art. 198 LSC).

| Código (materia) | Descripción | Quórum SA 1ª / 2ª | Mayoría SA | Mayoría SL | Inscribible | Instrumento |
|---|---|---|---|---|---|---|
| `APROBACION_CUENTAS` | Aprobación de cuentas anuales | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | No (depósito art. 279) | Ninguno |
| `APLICACION_RESULTADO` | Aplicación del resultado del ejercicio | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | No | Ninguno |
| `DISTRIBUCION_DIVIDENDOS` | Distribución de dividendos | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | No | Ninguno |
| `NOMBRAMIENTO_CONSEJERO` | Nombramiento de consejero | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | Sí | Escritura |
| `CESE_CONSEJERO` | Cese de consejero | 0,25 / 0 | art. 223.1 LSC (libre separación) | art. 198 LSC | Sí | Certificación |
| `NOMBRAMIENTO_CESE` | Nombramiento/cese (agregado retirado → resolver siempre a NOMBRAMIENTO_CONSEJERO o CESE_CONSEJERO) | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | Sí | Ninguno |
| `NOMBRAMIENTO_AUDITOR` | Nombramiento de auditor de cuentas | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | Sí | Ninguno |
| `RETRIBUCION_ADMIN` | Retribución de administradores | 0,25 / 0 | — | art. 198 LSC (mayoría de votos emitidos, suelo 1/3 capital) | Sí | Instancia |
| `REMUNERACION_CONSEJEROS` | Remuneración de consejeros (→ alias RETRIBUCION_ADMIN) | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | No | Ninguno |
| `ADQUISICION_PROPIA` | Adquisición de acciones/participaciones propias | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | No | Ninguno |
| `AUTORIZACION_GARANTIA` | Autorización de garantía significativa | 0,25 / 0 | art. 201.1 LSC | art. 198 LSC | No | Ninguno |

### 2.5 Consejo de Administración

Acuerdos de competencia del órgano de administración. La mayoría se mide sobre consejeros (art. 247.1/248.1 LSC; la delegación permanente exige 2/3 ex art. 249.3); las columnas de quórum SA no aplican.

| Código (materia) | Descripción | Clase | Mayoría Consejo | Inscribible | Instrumento |
|---|---|---|---|---|---|
| `APROBACION_REGLAMENTO_CONSEJO` | Aprobación/modificación del Reglamento del Consejo | ESPECIAL | art. 247.2 LSC | Sí | Escritura |
| `EJECUCION_AUMENTO_DELEGADO` | Ejecución de aumento de capital delegado | ESTRUCTURAL | art. 247.2 LSC | Sí | Escritura |
| `DELEGACION_FACULTADES` | Delegación de facultades / consejero delegado | ORDINARIA | art. 249.3 LSC (2/3 de los componentes) | Sí | Escritura |
| `DISTRIBUCION_CARGOS` | Distribución de cargos del Consejo | ORDINARIA | art. 247.2 LSC | Sí | Escritura |
| `NOMBRAMIENTO_CONSEJERO_COOPTACION_CONSEJO` | Nombramiento de consejero por cooptación | ORDINARIA | arts. 244 y 248.1 LSC | Sí | Escritura |
| `COOPTACION` | Cooptación de consejeros (SA art. 244 LSC) | ORDINARIA | art. 247.2 LSC | No | Ninguno |
| `PODER_REPRESENTACION` | Otorgamiento de poderes de representación | ORDINARIA | art. 247.2 LSC | Sí | Escritura |
| `TRASLADO_DOMICILIO_NACIONAL` | Traslado de domicilio social (España) | ORDINARIA | art. 247.2 LSC | Sí | Escritura |
| `FORMULACION_CUENTAS` | Formulación de cuentas anuales | ORDINARIA | art. 248.1 LSC (mayoría absoluta concurrentes) | No | Ninguno |
| `CUENTAS_CONSOLIDADAS` | Formulación de cuentas consolidadas | ORDINARIA | art. 247.2 LSC | No | Ninguno |
| `INFORME_GESTION` | Formulación del informe de gestión | ORDINARIA | — | No | Ninguno |
| `ACUERDO_CONVOCATORIA_JUNTA` | Acuerdo del Consejo de convocar Junta | ORDINARIA | art. 247.2 LSC | No | Ninguno |
| `APROBACION_PLAN_NEGOCIO` | Aprobación del plan de negocio | ORDINARIA | art. 247.1 LSC | No | Ninguno |
| `APROBACION_PRESUPUESTO` | Aprobación del presupuesto anual | ORDINARIA | — | No | Ninguno |
| `DIVIDENDO_A_CUENTA` | Dividendo a cuenta (art. 277 LSC) | ORDINARIA | art. 247.2 LSC | No | Ninguno |
| `OPERACION_VINCULADA` | Operación con parte vinculada (art. 228.e LSC) | ORDINARIA | art. 228.e LSC | No | Ninguno |
| `AUTORIZACION_GARANTIA_CONSEJO` | Autorización de garantía no esencial por Consejo | ORDINARIA | — | No | Ninguno |
| `RATIFICACION_ACTOS` | Ratificación de actos y contratos | ORDINARIA | — | No | Ninguno |

### 2.6 Socio único y soporte interno

| Código (materia) | Órgano | Descripción | Clase | Inscribible | Instrumento |
|---|---|---|---|---|---|
| `SOCIEDAD_UNIPERSONAL` | Socio único | Decisiones de sociedad unipersonal | ORDINARIA | Sí | Ninguno |
| `CONTRATOS_SOCIO_UNICO_SOCIEDAD` | Socio único | Contratos entre socio único y sociedad (art. 15 LSC) | ESPECIAL | No | Ninguno |
| `SEPARACION_SOCIO` | Soporte interno | Toma de razón del ejercicio del derecho de separación (art. 346 LSC) | ESPECIAL | Sí | Escritura |

### 2.7 Notas de inventario relevantes para el equipo legal

- **Doble grafía deliberada.** Varias materias coexisten con dos códigos (p.ej. `MODIFICACION_ESTATUTOS`/`MOD_ESTATUTOS`, `AUMENTO_CAPITAL`/`AMPLIACION_CAPITAL`, `RETRIBUCION_ADMIN`/`REMUNERACION_CONSEJEROS`) por motivos de compatibilidad con catálogos de agenda y datos legacy; el motor las reconcilia con una tabla de alias (sección 4). La materia canónica vigente para modificación de estatutos es **`MODIFICACION_ESTATUTOS`** (decisión 2026-06-13). Verificado en Cloud: `MOD_ESTATUTOS` y `MODIFICACION_ESTATUTOS` **existen como dos packs separados** (no son el duplicado por órgano —ése es `AUTORIZACION_GARANTIA`—); el alias garantiza que toda resolución apunte a la canónica, y la **retirada física del pack legacy `MOD_ESTATUTOS` queda pendiente** (bloqueada por el guardrail de operaciones destructivas en BD compartida), **sin impacto funcional** porque el alias ya redirige el cómputo.
- **`NOMBRAMIENTO_CESE` es un agregado retirado**: su propia descripción en BD instruye resolver siempre a `NOMBRAMIENTO_CONSEJERO` o `CESE_CONSEJERO` antes de construir el perfil.
- **Versionado.** Las materias más operadas tienen historial de versiones: `APROBACION_CUENTAS`, `AUMENTO_CAPITAL`, `AUTORIZACION_GARANTIA`, `NOMBRAMIENTO_AUDITOR` y `REDUCCION_CAPITAL` tienen 3 versiones cada una; en todos los casos hay **exactamente una versión `is_active`**. El motor selecciona la versión activa más reciente por semver y vigencia temporal (`effective_from`/`effective_to`).
- **Overrides sembrados.** Hay 6 registros en `rule_param_overrides`, todos con `fuente = LEY`, sobre `APROBACION_CUENTAS`, `MOD_ESTATUTOS` y `NOMBRAMIENTO_CESE_ADMIN` (capa de demostración del mecanismo de personalización).

---

## 3. El motor de reglas LSC

El motor vive en `src/lib/rules-engine/` (más de 30 archivos; el núcleo lo forman `types.ts`, `jerarquia-normativa.ts`, `convocatoria-engine.ts`, `constitucion-engine.ts`, `majority-evaluator.ts`, `votacion-engine.ts`, `no-session-engine.ts`, `documentacion-engine.ts`, `bordes-no-computables.ts`, `pactos-engine.ts`, `rule-resolution.ts` y `orquestador.ts`). Son **funciones puras** (sin acceso a BD ni React); reciben el rule pack y el censo, y devuelven un resultado con `explain` (árbol de nodos trazables), `blocking_issues` y `warnings`.

### 3.1 Jerarquía normativa y resolución de overrides

`jerarquia-normativa.ts` resuelve qué redacción de la regla prevalece cuando concurren varias capas. El orden de prelación (constante `FUENTE_PRIORITY`) es:

| Capa | Prioridad | Plano |
|---|---|---|
| `LEY` | 100 | SOCIETARIO |
| `ESTATUTOS` | 80 | SOCIETARIO |
| `PACTO_PARASOCIAL` | 60 | CONTRACTUAL |
| `REGLAMENTO` | 40 | SOCIETARIO |
| `OVERRIDE_INTERNO` | 20 | OPERATIVO |
| `SISTEMA` | 0 | SISTEMA |

Reglas de resolución (función `resolverReglaEfectiva` / `resolverReglaEfectivaConTrazabilidad`):

1. **Un override puede ELEVAR el listón, nunca rebajarlo por debajo del mínimo legal.** En modo numérico (`mayor`, p.ej. quórum/mayoría), un valor inferior al suelo `LEY` se rechaza con `blocking_issue` (`override_below_legal_minimum`). En modo `override` (booleanos como "inscribible"/"requiere informe"), degradar `true→false` sobre un mínimo legal también bloquea.
2. **Para listas de documentos (modo `union`)**: los requisitos se acumulan (unión deduplicada); una capa superior nunca elimina documentos exigidos por una inferior.
3. **Tratamiento diferenciado del pacto parasocial (clave jurídica).** Un override con `fuente = PACTO_PARASOCIAL` se informa como **capa contractual** y **no altera la validez societaria** del acuerdo (eficacia inter partes, art. 29 LSC), salvo que se pida explícitamente `allowContractualAsEffective`. Se surfacea como `WARNING`, no como regla efectiva.
4. Cada resolución produce `source_layers` (qué capas se consideraron y cuál se aplicó, con su `referencia` legal) y `explain_nodes` con resultado `OK`/`WARNING`/`BLOCKING` y mensaje en castellano, de modo que la trazabilidad jurídica es auditable nodo a nodo.

### 3.2 Pipelines de evaluación

**Convocatoria** (`convocatoria-engine.ts`, `evaluarConvocatoria`). Verifica antelación, contenido mínimo y canales:
- Modos `UNIPERSONAL` y `UNIVERSAL` (art. 178 LSC) cortocircuitan: no exigen convocatoria formal.
- Para juntas: antelación ex art. 176 LSC (un mes SA / 15 días SL, con cómputo "de fecha a fecha", art. 5.1 CC), y canales públicos (BORME + web inscrita en SA; comunicación individual escrita en SL, art. 173/173.2 LSC). Para Consejo y comisiones el plazo proviene del reglamento del órgano (art. 246.2 LSC) u override del rule pack. Distingue 1ª y 2ª convocatoria.

**Constitución / quórum** (`constitucion-engine.ts`). Comprueba el quórum de constitución según tipo social y convocatoria (SA: 50%/25% en materias reforzadas, 25%/0 en ordinarias, arts. 193–194 LSC; SL sin quórum de constitución, art. 198) y calcula el **denominador ajustado** excluyendo los mandatos en conflicto de interés (art. 190.2 LSC) mediante `calcularDenominadorAjustado`.

**Votación — pipeline de 6 gates** (`votacion-engine.ts`, `evaluarVotacion`):

| Gate | Comprobación | Efecto |
|---|---|---|
| **0** | Enrutado por modo de adopción | UNIPERSONAL_SOCIO/ADMIN → válido si la decisión está firmada (art. 15/210 LSC); NO_SESSION → delega en motor sin sesión; CO_APROBACION/SOLIDARIO → evaluadores propios; MEETING/UNIVERSAL → continúa a gates 1-6 |
| **1** | Elegibilidad / conflictos de interés (art. 190.2 LSC) | Recalcula el capital votante ajustado, excluyendo mandatos en conflicto |
| **2** | Quórum (referencia) | Verificado ya en fase de constitución |
| **3** | Mayoría | Selecciona la `MajoritySpec` por órgano (CONSEJO) o tipo social (SA/SAU vs SL/SLU) y delega en `evaluarMayoria`. Aplica overrides estatutarios de mayoría: un override que exija **unanimidad se rechaza como inadmisible (art. 200.1 LSC)** con WARNING; un override con fórmula válida sustituye la del pack con nodo OK |
| **4** | Unanimidad (si la materia la exige) | Verifica que todos consientan según ámbito (TODOS / PRESENTES / CLASE); BLOCKING si no se alcanza |
| **5** | Vetos | Veto estatutario → BLOCKING; **veto de pacto parasocial → solo WARNING** (no afecta validez societaria) e inhabilita el voto de calidad |
| **6** | Voto de calidad del presidente | Dirime empates **solo** en mayorías simple/absoluta; **nunca** satisface una mayoría reforzada (2/3, 3/4…) ni sustituye la unanimidad; bloqueado si hay veto o unanimidad. Es *fail-closed*: solo dirime si consta voto del presidente a FAVOR |

`evaluarMayoria` (`majority-evaluator.ts`) interpreta fórmulas declarativas del payload ("favor > contra", "favor ≥ 2/3 capital presente", "favor > 1/2 capital total con voto", "mayoria_consejeros", etc.) y aplica el tratamiento de abstenciones declarado en el pack (`no_cuentan` / `cuentan_como_contra` / `cuentan_como_voto`).

**Sin sesión — pipeline de 5 gates** (`no-session-engine.ts`, `evaluarProcesoSinSesion`):

| Gate | Comprobación |
|---|---|
| **0** | Habilitación: estatutos o reglamento permiten adopción sin sesión formal |
| **1** | Materia admitida para modo sin sesión (el pack debe incluir `NO_SESSION` en `modosAdopcionPermitidos`) |
| **2** | Notificación fehaciente: todas las notificaciones en estado ENTREGADA |
| **3** | Ventana de consentimiento abierta (no cerrada ni cerrada anticipadamente) |
| **4** | Condición de adopción según modo (unanimidad escrita SL / circulación en consejo / socio único) |

Cualquier gate fallido devuelve estado `CERRADO_FAIL` y corta el pipeline.

**Co-aprobación (administración mancomunada)** (`evaluarCoAprobacion`). Modelo *k de n*: exige habilitación estatutaria, **k ≥ 2** (actuación mancomunada de "al menos dos", art. 233.2.c LSC), límite de **n ≤ 2 administradores conjuntos en SA** (más de dos exige consejo, art. 210.2 LSC), coherencia k ≤ n, y suficiencia de firmas válidas de administradores vigentes (con detección de firmas duplicadas y validación del censo real, no solo del `n` declarado).

**Solidario** (`evaluarSolidario`). Actuación unilateral de un administrador solidario, contrastada contra el censo de administradores vigentes y la materia concreta.

### 3.3 Orquestador transversal

`orquestador.ts` (`evaluarAcuerdoCompleto`) compone el flujo extremo a extremo. Primero `determinarAdoptionMode` decide el modo (UNIPERSONAL_SOCIO si junta unipersonal; UNIPERSONAL_ADMIN si administrador único en consejo; o el modo solicitado si está permitido; default MEETING) y `componerPerfilSesion` agrega el perfil **más exigente** cuando hay varias materias en una misma sesión (máxima antelación, máximo quórum, unión de documentos). A continuación encadena las etapas (saltando convocatoria/constitución en los modos que no las requieren):

1. **Convocatoria** → `evaluarConvocatoria`
2. **Constitución / quórum** → `evaluarConstitucion`
3. **Votación** → `evaluarVotacion` (que internamente puede delegar en sin sesión, co-aprobación o solidario)
4. **Documentación** → `evaluarDocumentacion` (acta, certificaciones, documentos pre-sesión)
5. **Bordes no computables** → `evaluarBordesNoComputables`
6. **Pactos parasociales (post-votación)** → `evaluarPactosParasociales`

Decisión jurídica clave del orquestador (ITEM-151, Comité Legal + Garrigues): el incumplimiento de un pacto parasocial es **contractual, no invalidez societaria**. Por eso los `blocking_issues` de pacto van en un **canal separado y etiquetado** (`pacto_blocking_issues`), nunca mezclados con los blocking societarios (LSC/RRM); el encabezado se reporta como WARNING. El usuario ve "incumplimiento de pacto", no "acuerdo societariamente inválido".

### 3.4 Bordes no computables

`bordes-no-computables.ts` evalúa 7 "bordes" que el motor determinístico no puede resolver sin verificación externa:

1. **Sociedad cotizada (DL-2)** → genera advertencias **WARNING** (no bloquea): otra información relevante (Ley 6/2023, LMVSI) e información privilegiada (art. 17 MAR) —la categoría histórica "hecho relevante" del TRLMV fue derogada—, operaciones vinculadas (art. 231 LSC, si la materia lo implica) e Informe Anual de Gobierno Corporativo (art. 540 LSC). **No hay early return**: el motor sigue evaluando los bordes 2-7. ARGA Seguros S.A. es SA cotizada, por lo que estos WARNING son operativos en la demo.
2. **Consentimiento de clase** (arts. 293 LSC) → BLOCKING si el perímetro de clases no está definido o el consentimiento no está resuelto.
3. **Suficiencia de liquidez** para reparto de dividendos (art. 273 LSC) → BLOCKING si no verificada.
4. **Indelegabilidad fina** → WARNING si materia indelegable no verificada.
5. **Junta telemática** (art. 182 LSC) → BLOCKING si falta checklist (previsión estatutaria, medios técnicos, acceso).
6. **Evidencia de publicación SA** en BORME (art. 173 LSC) → WARNING si sin evidencia.
7. **Evidencia de notificación SL** individual (art. 173.2 LSC) → WARNING si sin prueba de entrega.

Además, dentro del pipeline de votación, los **bordes "de representación y voto de calidad"** se materializan: el conflicto de interés ajusta el denominador (Gate 1, art. 190.2 LSC), y el **voto de calidad del presidente (DL-5)** se configura por órgano vía el flag `voto_calidad_presidente` en `governing_bodies` — habilitado en CdA y Comité Ejecutivo, deshabilitado en las comisiones delegadas (Auditoría, Riesgos, Nombramientos, Retribuciones).

### 3.5 Motor de pactos parasociales

`pactos-engine.ts` (`evaluarPactosParasociales`) emite un **veredicto paralelo e independiente del resultado societario**: un acuerdo puede ser proclamable y a la vez incumplir un pacto, o viceversa. Soporta tres tipos MVP (más placeholders de TAG_ALONG, DRAG_ALONG, LOCK_UP, SINDICACION_VOTO):

| Tipo de cláusula | Lógica | Severidad si se incumple |
|---|---|---|
| **VETO** (`evaluarVeto`) | Si la materia coincide con el ámbito del veto y el titular no ha renunciado expresamente → incumplimiento | **BLOCKING** (en el canal contractual separado) |
| **MAYORIA_REFORZADA_PACTADA** (`evaluarMayoriaReforzada`) | Comprueba que el % de votos a favor alcanza el umbral pactado, superior al legal | **BLOCKING** si no se alcanza el umbral |
| **CONSENTIMIENTO_INVERSOR** (`evaluarConsentimientoInversor`) | Requiere consentimiento previo escrito del titular antes del acuerdo | **WARNING** (el acuerdo es válido societariamente; el defecto es contractual) |

El emparejamiento de materias usa una tabla de normalización canónica (`materia-pacto-mapping.ts`, `materiasPactoCoincidentes`) que reconcilia vocabularios divergentes (`AUMENTO_CAPITAL`↔`AMPLIACION_CAPITAL`, `DISOLUCION`↔`LIQUIDACION`, y un paraguas `OPERACION_ESTRUCTURAL`→{FUSION, ESCISION…}); sin esta normalización los pactos no disparaban porque sus listas de materias eran disjuntas de las del catálogo.

**Pacto demo Fundación ARGA (DL-3).** En Cloud (`pactos_parasociales`, tenant demo) hay **tres cláusulas VIGENTES** que ejemplifican los tres tipos:

| Título | Tipo | Titular | Umbral / Capital | Materias aplicables | Condición |
|---|---|---|---|---|---|
| Pacto parasocial Fundación ARGA — Derecho de veto | VETO | Fundación ARGA | — | FUSION, ESCISION, DISOLUCION, VENTA_ACTIVOS_SUSTANCIALES, TRANSFORMACION | Veto cuando la operación afecte a >15% del patrimonio neto; requiere consentimiento escrito previo |
| Pacto parasocial — Mayoría reforzada operaciones vinculadas | MAYORIA_REFORZADA_PACTADA | — | umbral 0,75 (75%) | OPERACION_VINCULADA | Mayoría del 75% del capital presente; se excluyen del voto los vinculados (art. 231 LSC) |
| Pacto parasocial — Consentimiento inversor dilución | CONSENTIMIENTO_INVERSOR | Fundación ARGA | capital mínimo 50% | AMPLIACION_CAPITAL, EMISION_CONVERTIBLES, EXCLUSION_PREFERENTE | Consentimiento por escrito ≥ 15 días antes de la convocatoria |

---

## 4. Decisiones legales DL-1…DL-6 y alias de materia

### 4.1 Decisiones legales del motor (6/6 resueltas, 2026-04-19)

Documento canónico: `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`.

| # | Decisión | Resolución | Implementación |
|---|---|---|---|
| **DL-1** | Alcance jurisdiccional de los rule packs | **ES completa para demo + PT como preview.** BR (Lei 6.404/76) y MX (LGSM) post-GA vía matriz de normalización jurisdiccional. La infraestructura ya existe en `rule_param_overrides` | Datos (overrides PT). Sin cambio de código |
| **DL-2** | Entidades cotizadas | **Evaluar + advertir, NO bloquear.** El motor aplica la LSC normalmente y añade advertencias LMV como WARNING (CNMV, MAR art. 17, operaciones vinculadas, IAGC) | `bordes-no-computables.ts`: eliminado el early return; 4 WARNING/INFO de cotizada |
| **DL-3** | Pactos parasociales | **Un pacto demo Fundación ARGA** con derecho de veto en operaciones estructurales (>15% PN); evaluación activa (no solo badge) | Seed `pactos_parasociales` + `pactos-engine.ts` |
| **DL-4** | Plantilla de convocatoria | **Selección automática por tipo social en Gate PRE.** SA → plantilla BORME+web (art. 197 LSC); SL → notificación individual certificada (art. 173.2 LSC). Override manual permitido pero audit-logged | `plantillas-engine.ts` |
| **DL-5** | Voto de calidad del presidente | **Configuración por órgano.** Habilitado en CdA y Comité Ejecutivo; deshabilitado en comisiones delegadas (Auditoría, Riesgos, Nombramientos, Retribuciones) | Flag `voto_calidad_presidente` en `governing_bodies`; gate ya implementado en `votacion-engine.ts` |
| **DL-6** | Retribución de consejeros | **Valores demo derivados del IAR 2025.** No ejecutivos: VP/Coord. Indep. 220K€, Vocal 115K€ + complementos por comisión. Ejecutivos RF: Presidente 1.091K€, VP/CDG 535K€, DGA 456K€. RVA 100% BN + ROE ±5% (70% inmediato / 30% diferido 3 años) | Seed retribución + overrides PT |

Prioridad de implementación fijada: DL-2 → DL-4 → DL-5 → DL-6 → DL-3 → DL-1.

### 4.2 Alias de materia

`rule-resolution.ts` define `MATERIA_PACK_ALIASES`: un mapa que normaliza grafías divergentes de la **misma materia jurídica** a su código canónico, de modo que un id de catálogo de agenda que no exista literalmente en `rule_packs` resuelva igualmente contra el pack correcto (la función `normalizeMateriaForRulePack` aplica el alias antes del match). Esto evita el fallo silencioso —históricamente roto en OPERACION_VINCULADA— en que la convocatoria se emitía sin quórum/mayoría/antelación por no encontrar pack.

| Grafía de entrada | Materia canónica |
|---|---|
| `MOD_ESTATUTOS` | `MODIFICACION_ESTATUTOS` (canónica desde 2026-06-13; ambas grafías coexisten como packs separados en Cloud y el alias las unifica en *runtime*; retirada física del pack legacy pendiente y sin efecto funcional) |
| `APROBACION_PRESUPUESTOS` | `APROBACION_PRESUPUESTO` |
| `CESION_GLOBAL` | `CESION_GLOBAL_ACTIVO` |
| `REMUNERACION_CONSEJEROS` | `RETRIBUCION_ADMIN` |
| `CAMBIO_DOMICILIO_SOCIAL` | `TRASLADO_DOMICILIO_NACIONAL` |
| `MODIFICACION_REGLAMENTO` | `APROBACION_REGLAMENTO_CONSEJO` |
| `AMPLIACION_CAPITAL` | `AUMENTO_CAPITAL` |
| `EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE` | `SUPRESION_PREFERENTE` |

Garantía jurídica de diseño: **solo se alían grafías de la misma materia jurídica**. Materias distintas no se confunden — por ejemplo, `DISTRIBUCION_RESERVAS` **no** se alía a `DIVIDENDO_A_CUENTA` (arts. 273 vs 277 LSC, operaciones diferentes): permanece como materia sin pack hasta que el Comité Legal apruebe uno propio.

### 4.3 Consumo desde la aplicación

- **`useRulePackForMateria`** (`src/hooks/useRulePackForMateria.ts`): normaliza la materia con `normalizeMateriaForRulePack`, trae todas las versiones activas (`rule_pack_versions.is_active = true`) de esa materia con orden determinista y resuelve la ambigüedad Junta vs Consejo por familia de órgano (función `organoFamily`), evitando que materias compartidas como `AUTORIZACION_GARANTIA` (que tiene un pack por órgano) devuelvan un pack arbitrario.
- **`useModelosAcuerdo`** (`src/hooks/useModelosAcuerdo.ts`): recupera las plantillas `MODELO_ACUERDO` por materia (filtrando `materia_acuerdo` **o** `materia`, ya que ambas columnas se usan en la práctica — ITEM-079), con su jurisdicción, las tres capas de contenido (inmutable / variables / editables), referencia legal, estado del workflow y modo de adopción.

Trazabilidad de esta sección: tablas `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `pactos_parasociales` (Cloud `governance_OS`); `src/lib/rules-engine/{jerarquia-normativa,convocatoria-engine,constitucion-engine,majority-evaluator,votacion-engine,no-session-engine,documentacion-engine,bordes-no-computables,pactos-engine,materia-pacto-mapping,rule-resolution,orquestador}.ts`; `src/hooks/{useRulePackForMateria,useModelosAcuerdo}.ts`; `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`.

---

# 4. Sistema de gestión documental y plantillas societarias

El módulo de Secretaría Societaria de TGMS no genera documentos como texto libre. Toda la producción documental (actas, certificaciones, convocatorias, acuerdos, informes preceptivos) se construye a partir de **plantillas protegidas** versionadas, sujetas a un ciclo de vida con control de estados, validadas antes de su activación por un motor de reglas (el **Gate PRE**) y rellenadas en tiempo de ejecución mediante un resolver de variables que extrae los datos reales de la base de datos. La fuente de verdad es la tabla `plantillas_protegidas` en el proyecto Supabase `governance_OS`, sobre la que opera una consola unificada de administración (`/secretaria/gestor-plantillas`) y un catálogo de uso para el operador (`/secretaria/plantillas`).

Esta arquitectura persigue tres garantías relevantes para un despacho: (i) que el cuerpo jurídico literal de cada documento (cláusulas, fórmulas legales, referencias normativas) sea **inmutable** y no editable por el usuario operativo; (ii) que ningún documento se genere a partir de una plantilla que no haya superado un control de calidad estructural y semántico; y (iii) que cada transición de estado de una plantilla quede **auditada** en un changelog con motivo, autor y resumen del cambio.

## 1. Arquitectura de plantilla en tres capas

Cada plantilla almacena su contenido en tres columnas que segregan responsabilidades jurídicas y operativas. La separación es la pieza central del modelo: determina qué puede tocar el equipo legal, qué resuelve la máquina automáticamente y qué rellena el secretario al instanciar el documento.

| Capa | Columna | Naturaleza | Quién la controla | Contenido |
|---|---|---|---|---|
| **Capa 1 — Inmutable** | `capa1_inmutable` | Texto literal protegido (plantilla Handlebars) | Comité Legal (solo en BORRADOR) | Cuerpo jurídico canónico: cláusulas, fórmulas, referencias legales, con marcadores `{{variable}}` y bloques condicionales `{{#if}}`/`{{#each}}`. Mínimo 100 caracteres (regla `CAPA1_LENGTH`). |
| **Capa 2 — Variables automáticas** | `capa2_variables` (JSONB) | Catálogo de variables a resolver | Sistema (resolver) | Lista de `{variable, fuente, condicion}`. Cada entrada declara de qué origen de datos se extrae el valor en tiempo de generación. |
| **Capa 3 — Campos editables** | `capa3_editables` (JSONB) | Formulario de captura | Secretario (al instanciar) | Lista de `{campo, obligatoriedad, descripcion, tipo, ...}`. Datos que no están en BD y que el operador introduce manualmente. |

La renderización es de **Handlebars**, con una instancia aislada por render (`Handlebars.create()`) y un conjunto cerrado de *helpers* personalizados orientados al castellano jurídico, en `src/lib/doc-gen/template-renderer.ts`:

- `{{fechaES date}}` → "19 de abril de 2026" (meses en castellano).
- `{{uppercase}}` / `{{lowercase}}`, `{{ordinalES n}}` → "Primero", "Segundo"…
- `{{eq a b}}`, `{{or}}`, `{{and}}`, `{{gt}}`, `{{gte}}` para condicionales.
- `{{porcentaje num decimals}}` → "45,67%" (coma decimal española).

El renderizador compila con `noEscape: true` (texto plano, no HTML) y `strict: false` (las variables sin valor se renderizan como cadena vacía, no lanzan error), y rastrea las variables referenciadas que quedaron sin resolver para devolverlas como `unresolvedVariables` y permitir feedback al usuario. El pre-procesador acepta además la forma legacy `{{#if x == 'valor'}}` y la normaliza a `{{#if (eq x "valor")}}`.

### 1.1 El contrato de variables (49 variables, 4 fuentes funcionales)

El catálogo lógico de variables vive en `docs/contratos/variables-plantillas-v1.1.yaml`, versión canónica **`variables-plantillas-v1.1`**. Define **49 variables** agrupadas por su **fuente funcional**, que se mapea a los namespaces que usa el resolver de runtime:

| Fuente lógica (contrato) | Namespace resolver | Origen de datos |
|---|---|---|
| `sistema_bbdd` | `ENTIDAD` / `ORGANO` / `REUNION` / `EXPEDIENTE` | `entities.*`, `governing_bodies.*` + `condiciones_persona`, `meetings.*` + agenda, `agreements.*` |
| `sistema_motor` | `MOTOR` | Resultado del motor de reglas LSC (compliance snapshot) |
| `secretario_manual` | `USUARIO` | Campos de capa 3 (editables del expediente) |
| `qtsp` | `QTSP` / `SISTEMA` | Sellos EAD Trust, timestamps cualificados, firma QES |

Conviene que el equipo legal conozca una limitación documentada (ITEM-134, 2026-06-13): de las 49 variables del contrato, **solo 6 están vivas** (referenciadas por alguna plantilla ACTIVA: `organo_nombre`, `hora_inicio`, `hora_fin`, `votos_favor`, `votos_contra` y una más); las otras 43 son cobertura **prospectiva** (especificada pero aún no usada). El YAML separa explícitamente `variables_en_uso` (6) de `variables_planificadas` (43). El contrato es **documentación de cobertura**; la fuente de verdad operativa es el resolver. Persisten en Cloud cuatro etiquetas de versión de contrato (`variables-plantillas-v1.1` canónica, más `1.0.0`, `1.1.0` deprecadas y registros sin etiqueta), deuda de migración conocida.

### 1.2 El resolver de variables (`normalizeFuente`)

El resolver (`src/lib/doc-gen/variable-resolver.ts`) recibe el catálogo de capa 2 y un contexto con los identificadores del expediente (`agreementId`, `entityId`, `bodyId`, `meetingId`, `tenantId`, opcionalmente el compliance snapshot del motor). Carga **en paralelo** los siete orígenes posibles —entidad, órgano, reunión, expediente, cap table, motor, sistema— y resuelve cada variable contra su fuente declarada.

El punto crítico para la trazabilidad es la función `normalizeFuente`. La base de datos almacena las fuentes de capa 2 como *dotted paths* heterogéneos (`entities.name`, `governing_bodies.presidente`, `agreement.adoption_mode`, `persons.nif`…) o como etiquetas legacy en mayúsculas (`ENTIDAD`, `ORGANO`). `normalizeFuente` colapsa todas esas formas al namespace canónico correspondiente: cualquier `entities.*`/`entity.*` → `ENTIDAD`; `governing_bodies.*`, `mandate.*`, `persons.*` → `ORGANO`; `meetings.*`, `convocatoria.*` → `REUNION`; `agreements.*`, `registry_filings.*`, `tramitador.*` → `EXPEDIENTE`; `capital_holdings.*`, `parte_votante.*` → `CAP_TABLE`; `rule_pack.*`, `evaluar*`, `calcular*` → `MOTOR`; `qtsp.*`, `firma_qes*` → `SISTEMA`. Esto permite que plantillas escritas con convenciones distintas (legacy plana y nueva *dotted*) resuelvan contra el mismo origen sin romper compatibilidad.

El resolver expone además cada origen completo bajo su clave de namespace en mayúsculas (`{{ENTIDAD.es_cotizada}}`, `{{ORGANO.presidente}}`), maneja precedencia de tres niveles para los datos de entidad (catalog defaults < columna real de `entities` < overrides explícitos de `entity_settings`) y normaliza booleanos jurídicos sensibles (`es_cotizada`, `es_unipersonal`) a la representación canónica "SÍ"/"NO" más un alias booleano (`is_cotizada`) para condicionales Handlebars. Las variables no resueltas se registran con `console.warn` para observabilidad pero **no abortan** la generación: el render produce cadena vacía, lo que habilita la migración progresiva (una capa 1 puede referenciar claves antes de que la entidad las tenga pobladas).

## 2. Consola unificada de administración (`/secretaria/gestor-plantillas`)

La consola es un *shell* delgado (`src/pages/secretaria/GestorPlantillas.tsx`, ≤130 líneas) que organiza toda la administración en **pestañas mediante query param** `?tab=`, con control de acceso por rol (RBAC) por pestaña. Si el usuario solicita por URL una pestaña a la que no tiene acceso, el shell **redirige a Dashboard** con un *toast* de aviso (`Sin permisos para "X"; redirigido a Dashboard`), y las pestañas no accesibles **no se muestran** en el nav (filtradas en `visibleTabs`). Los componentes de cada pestaña viven en `src/components/secretaria/gestor/*Tab.tsx`.

La matriz RBAC se define en `src/components/secretaria/gestor/tab-guards.ts`. Hay dos perfiles de acceso: **lectura** (roles `SECRETARIO`, `COMPLIANCE`, `ADMIN_TENANT`) y **escritura/proceso sensible** (solo `ADMIN_TENANT`).

> Nota de implementación: el encargo identificaba siete pestañas; el código actual incluye una **octava pestaña, "Configuración"** (`ConfiguracionSociedadTab`), de escritura y reservada a `ADMIN_TENANT`. Se documenta a continuación el inventario real de ocho pestañas.

| Pestaña | Ruta | RBAC | Función |
|---|---|---|---|
| **Dashboard** | `?tab=dashboard` | Lectura (SECRETARIO / COMPLIANCE / ADMIN_TENANT) | KPIs principales del parque de plantillas. Pestaña por defecto. |
| **Catálogo** | `?tab=catalogo` | Lectura | Listado de plantillas (consumo del catálogo). |
| **Cobertura legal** | `?tab=cobertura` | Lectura | Matriz de cobertura materia × jurisdicción. |
| **Importar** | `?tab=importar` | **Escritura (ADMIN_TENANT)** | Asistente (*wizard*) de importación de plantillas por JSON. |
| **Métricas** | `?tab=metricas` | Lectura | Métricas del parque. **Absorbe la antigua `PlantillasTracker.tsx`.** |
| **Auditoría** | `?tab=auditoria` | Lectura | Trazabilidad y mantenimiento. **Absorbe la antigua `/admin/PlantillasMantenimiento`.** |
| **Validación** | `?tab=validacion` | **Escritura (ADMIN_TENANT)** | Ejecución del Gate PRE *headless* sobre plantillas. |
| **Configuración** | `?tab=configuracion` | **Escritura (ADMIN_TENANT)** | Configuración de sociedad (ConfiguracionSociedadTab). |

**Realidad RBAC en demo:** el usuario demo (`demo@arga-seguros.com`) tiene rol `SECRETARIO`, por lo que las pestañas Importar, Validación y Configuración quedan ocultas del nav y son inaccesibles por URL directa (redirección con *toast*), salvo que se siembre un usuario con rol `ADMIN_TENANT` en `rbac_user_roles`.

**Consolidación de consolas y redirección 301:** esta consola unificó tres vistas históricas dispersas. Se conserva una redirección permanente registrada en `src/App.tsx`: `/secretaria/plantillas-tracker` → `/secretaria/gestor-plantillas?tab=metricas` (vía `<Navigate replace>`). La antigua ruta `/admin/PlantillasMantenimiento` fue **eliminada por completo**; su contenido vive ahora en la pestaña Auditoría.

## 3. Catálogo de uso (`/secretaria/plantillas`)

Mientras la consola gestor es la herramienta de *administración*, la página `Plantillas.tsx` es el **catálogo de uso** orientado al secretario. Presenta las plantillas en dos pestañas internas —"Plantillas de proceso" y "Modelos de acuerdo" (filtrables por materia, agrupadas por grupos funcionales de materia)— en una vista maestro-detalle que muestra las tres capas (capa 1 literal completa, variables de capa 2 con su fuente, campos editables de capa 3), la referencia legal, la configuración del motor (binding materia × órgano × tipo social × forma de adopción, si exige snapshot de rule pack, versión del contrato de variables) y el historial de estados.

La acción central es el CTA **"Usar esta plantilla"** (etiqueta dinámica vía `getTemplateUsageTarget`), que solo aparece cuando la plantilla está en estado **ACTIVA** y navega al carril operativo correspondiente (p. ej. `/secretaria/tramitador/nuevo?materia=…&plantilla=…` para un MODELO_ACUERDO). En modo sociedad se añade "Vincular como plantilla activa", que crea el *binding* de la regla efectiva (materia/órgano/tipo social/jurisdicción/forma de adopción).

Un control de gobernanza relevante (ITEM-084): la **gestión del ciclo de vida** desde este catálogo de uso (revisar/aprobar/activar/archivar) solo se ofrece a `ADMIN_TENANT` (`canManageLifecycle = primaryRole === "ADMIN_TENANT"`). Sin este *guard*, un `SECRETARIO` podría archivar una plantilla ACTIVA de producción con un clic, porque la RLS solo aísla por *tenant*, no por rol. Toda transición exige confirmación explícita (`window.confirm`) y queda registrada en auditoría; si el Gate PRE bloquea la activación, se muestra un panel accionable con las incidencias, y si hay *warnings* no bloqueantes, un diálogo exige un motivo de ≥20 caracteres que se persiste en el changelog como evidencia.

## 4. La librería canónica `src/lib/secretaria/template-admin/`

Toda la lógica de administración de plantillas (sin acoplarse a la UI) se concentra en esta librería *headless* y testeada. Es la **ubicación canónica** para futuras reglas: cualquier validación nueva debe añadirse aquí con su test, sin duplicar lógica en componentes UI.

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Tipos base, enum de estados, `GatePreIssue`/`GatePreResult`, `PlantillaCandidate`, `FunctionalKey`. |
| `functional-key.ts` | Clave funcional + lista canónica de 14 combinaciones core v1.0 + detección de duplicados. |
| `gate-pre.ts` | Gate PRE estructural (validación pre-activación, función pura). |
| `gate-pre-semantic.ts` | Reglas semánticas P0 (FUSION_ESCISION, RATIFICACION_ACTOS, campos obligatorios de ACTIVA, namespaces huérfanos). |
| `template-admin-service.ts` | State machine + Gate PRE + changelog (punto único de transiciones). |
| `template-importer.ts` | Parse / conversión Cloud↔payload / construcción de fila BORRADOR. |
| `template-import-schema.ts` | Schema Zod estricto `secretaria.template_import.v1`. |
| `organo-canonico.ts` | Enum canónico de `organo_tipo` + normalización de alias. |
| `changelog.ts` | Changelog con idempotencia (ventana 5s, hash FNV-1a). |
| `known-p0.ts` | Lista de plantillas P0 toleradas (actualmente vacía). |

### 4.1 La clave funcional (functional key)

La identidad de una plantilla a efectos de detección de duplicados se compone de: **tenant + tipo + jurisdicción + materia + órgano + forma de adopción + tipo social** (`buildFunctionalKey`, `serializeFunctionalKey` en `functional-key.ts`). La regla de negocio: **no puede haber dos plantillas ACTIVA con la misma clave funcional** (regla bloqueante `DUP_ACTIVE_FUNCTIONAL_KEY` del Gate PRE; para activar una nueva, hay que archivar antes la que ya cubre esa clave).

> Matiz técnico: `buildFunctionalKey` fija hoy `tipoSocial: null` (la dimensión existe en el modelo pero no se discrimina por ella en la clave). Esto es coherente con el inventario real (ver §6: las 110 plantillas tienen `tipo_social` NULL).

El módulo declara además la lista canónica de **14 combinaciones materia × órgano core v1.0** que la consola garantiza cubrir (`CORE_V1_MATERIAS`): siete de Junta General (aprobación de cuentas, distribución de dividendos, nombramiento y cese de consejero, modificación de estatutos, aumento de capital, nombramiento de auditor), cinco de Consejo de Administración (distribución de cargos, delegación de facultades, comités internos, políticas corporativas, nombramiento/cese de consejero) y una de Órgano de Administración (formulación de cuentas).

### 4.2 El Gate PRE (validación pre-activación)

El Gate PRE (`validateTemplateForActivation`) es una función **pura y reutilizable** (la consumen el importador, la pestaña Validación y el servicio de transiciones). Devuelve un `GatePreResult` con `ok`, lista de `issues` y un resumen por severidad (`blocking`/`warning`/`info`). Una plantilla **no puede activarse** si tiene una sola incidencia BLOCKING; las WARNING requieren reconocimiento explícito con motivo.

**Validaciones estructurales** (`gate-pre.ts`):

| Código | Severidad | Comprueba |
|---|---|---|
| `META_ORGANO_NULL` | BLOCKING | `organo_tipo` poblado y canónico (sugiere normalización si es alias). |
| `META_VERSION_SEMVER` | BLOCKING | `version` cumple semver (p. ej. `1.0.0`). |
| `META_REF_LEGAL_FORMAT` | BLOCKING | `referencia_legal` menciona fuente legal reconocible (LSC/RRM/RDL/LMV/CCom/RDLey/LOSSEAR/CC/CNMV). Se exime a `SOPORTE_INTERNO`. |
| `META_APROBADA_POR` | BLOCKING | `aprobada_por` y `fecha_aprobacion` requeridos para APROBADA/ACTIVA. |
| `CAPA1_LENGTH` | BLOCKING | `capa1_inmutable` ≥ 100 caracteres. |
| `CAPA2_HELPER_PROHIBIDO` | BLOCKING | Solo helpers de bloque del *allowlist* (`if`/`else`/`each`/`unless`/`with`). |
| `CAPA2_VAR_NO_CATALOGADA` | BLOCKING | Toda variable *dotted* usada en capa 1 está declarada en capa 2 (salvo prefijos de framework). |
| `ENTITY_REF_FORBIDDEN` | BLOCKING | Prohíbe referenciar `entity_id`/`entity_name` directamente (debe ir vía `entities.*`/`entity_settings`). |
| `CAPA3_PREFIJO_PROTEGIDO` | BLOCKING | Los campos de capa 3 no usan prefijos reservados de capa 2 (`ENTIDAD.`, `ORGANO.`, …). |
| `DUP_ACTIVE_FUNCTIONAL_KEY` | BLOCKING | No hay otra ACTIVA con la misma clave funcional. |
| `GEN_IF_COUNT` | WARNING | Más de 3 ramas `{{#if}}` en capa 1 (candidata a desdoblarse). |
| `LEGACY_FUENTE_ENTIDAD` | WARNING | Variable con fuente legacy `ENTIDAD` (preferir `entities.name`). |
| `CAPA2_UNUSED_VARIABLE` | INFO | Variable declarada en capa 2 pero no usada en capa 1. |
| `META_APROBADA_POR_PENDING` | INFO | Datos de aprobación pendientes (requeridos al promover). |

**Validaciones semánticas P0** (`gate-pre-semantic.ts`) — codifican criterios jurídicos concretos, trasladando la fuente de verdad de los documentos al motor:

- `SEM_FUSION_EXPERTO_CONDICIONAL` (BLOCKING): una plantilla de materia `FUSION_ESCISION` debe incluir el condicional `{{#if requiere_experto}}` (art. 53 RDL 5/2023, fusiones simplificadas).
- `SEM_RATIFICACION_IDENTIFICACION` (BLOCKING): `RATIFICACION_ACTOS` exige un campo de capa 3 OBLIGATORIO de identificación de actos (`enumeracion_actos`, `lista_actos_ratificados`, etc.).
- `SEM_ACTIVA_CAMPOS_REQUERIDOS` (BLOCKING): una plantilla ACTIVA de tipo `MODELO_ACUERDO`/`ACTA`/`DECISION` debe tener `organo_tipo`, `adoption_mode` y `referencia_legal` poblados.
- `SEM_NAMESPACE_SIN_PROVEEDOR` (WARNING): detecta namespaces usados en capa 1 que ningún resolver construye y que por tanto renderizarían en blanco. Los namespaces soportados hoy son exactamente: `ENTIDAD`, `ORGANO`, `REUNION`, `EXPEDIENTE`, `CAP_TABLE`, `MOTOR`, `SISTEMA`, `USUARIO`, `QTSP`.

### 4.3 Ciclo de vida (state machine) y changelog

Los estados posibles de una plantilla (`EstadoPlantilla`) son seis: `BORRADOR`, `REVISADA`, `APROBADA`, `ACTIVA`, `ARCHIVADA`, `DEPRECADA`. Las transiciones permitidas están codificadas en `TRANSITION_MATRIX` (`template-admin-service.ts`):

| Estado origen | Transiciones permitidas |
|---|---|
| `BORRADOR` | → `REVISADA`, `ARCHIVADA` |
| `REVISADA` | → `APROBADA`, `BORRADOR`, `ARCHIVADA` |
| `APROBADA` | → `ACTIVA`, `BORRADOR`, `ARCHIVADA` |
| `ACTIVA` | → `ARCHIVADA` |
| `ARCHIVADA` | (terminal — sin salidas) |
| `DEPRECADA` | → `ARCHIVADA` |

El flujo nominal de aprobación legal es por tanto **BORRADOR → REVISADA → APROBADA → ACTIVA → ARCHIVADA**. La función `transitionTemplateState` orquesta cada transición con varias salvaguardas: (i) verifica que la transición esté permitida (`INVALID_TRANSITION` si no); (ii) exige datos de aprobación para llegar a APROBADA (`MISSING_APPROVAL_DATA`); (iii) **solo cuando el destino es ACTIVA** ejecuta el Gate PRE completo, bloqueando si hay incidencias BLOCKING (`GATE_PRE_BLOCKING`) o exigiendo *ack* de los *warnings* (`WARNINGS_NEED_ACK`); (iv) registra la transición en el changelog con **rollback compensatorio** —si el registro de auditoría falla, revierte el cambio de estado para no dejar una plantilla avanzada sin traza—. El resultado es una *discriminated union* que comunica al llamante exactamente qué se rechazó, sin excepciones en flujos normales.

El changelog (`changelog.ts`, tabla `plantilla_changelog`) registra cada evento con `bump_type` (PATCH/MINOR/MAJOR), motivo, resumen del diff serializado, versión origen/destino y autor. Implementa **idempotencia** mediante una clave hash (FNV-1a) que agrupa intentos dentro de una ventana de 5 segundos, de modo que dobles *submits* del UI no generan entradas duplicadas, conciliando esto con la restricción `UNIQUE(plantilla_id, to_version)` de Cloud (la versión lógica se conserva dentro de `diff_summary` y la `to_version` persistida lleva sufijado el token idempotente).

### 4.4 El importador JSON (wizard)

La pestaña Importar (ADMIN_TENANT) permite dar de alta plantillas desde un paquete JSON validado contra el schema Zod estricto **`secretaria.template_import.v1`** (`template-import-schema.ts`). El asistente es de tres pasos (upload → validar → confirmar). El schema:

- Usa `.strict()` en la raíz y en el bloque `template`, rechazando cualquier metadato de fila Cloud filtrado por accidente (`entity_id`, `tenant_id`, `estado`, etc.).
- Valida `tipo` (enum de 14 tipos documentales), `materia` (enum cerrado de ~75 materias soportadas v1), `jurisdiccion` (`ES`/`BR`/`MX`/`PT`/`UK`/`FR`/`DE`), `organo_tipo` (enum canónico), `adoption_mode` (7 formas de adopción, *nullable* para tipos no-acuerdo como certificaciones/informes), `version` (semver) y `referencia_legal` (patrón estructurado de cita legal).
- Valida las variables de capa 2 (patrón de 1–5 segmentos punteados con *wildcard* `.*` opcional; fuente contra glosario conocido o patrón `tabla.columna`) y los campos de capa 3 (`campo` snake_case, `obligatoriedad` ∈ OBLIGATORIO/RECOMENDADO/OPCIONAL/OBLIGATORIO_SI_TELEMATICA).

`parseImport` **normaliza alias** de `organo_tipo` (p. ej. `CONSEJO_ADMINISTRACION` → `CONSEJO_ADMIN`) antes de validar, vía `normalizeOrganoTipo` (`organo-canonico.ts`), que mapea los alias legacy a los 11 valores canónicos. Tras validar, `buildDraftRow` construye la fila para insertar siempre en estado **BORRADOR** (con `aprobada_por`/`fecha_aprobacion` a `null`, que rellenará el Comité Legal al promover a ACTIVA). Existe además un modo `FIRMA_LEGAL_BATCH` (schema `TemplateBatchImportSchema`, lotes de 1–50 plantillas con metadatos de aprobación), ejecutable como script con rol de servicio.

### 4.5 Lista P0 (actualmente vacía)

`known-p0.ts` mantiene `KNOWN_P0_TEMPLATES` como **lista cerrada a cero** desde 2026-05-14. Históricamente toleraba con *warning* dos plantillas con P0 semántico conocido —`FUSION_ESCISION` y `RATIFICACION_ACTOS`—; ambas fueron corregidas (saneamiento de RATIFICACION_ACTOS y adición del condicional `requiere_experto` en FUSION_ESCISION), por lo que **no hay actualmente ninguna plantilla P0 tolerada**.

## 5. Pipeline completo de generación documental

Resumido, la cadena desde plantilla hasta documento firmado es: la plantilla ACTIVA aporta la **capa 1** (cuerpo Handlebars); el **resolver** rellena la **capa 2** desde la BD (entidad, órgano, reunión, expediente, cap table, motor, QTSP); el secretario aporta la **capa 3** vía formulario; `renderTemplate` produce el texto; `docx-generator.ts` lo convierte a DOCX; y `storage-archiver.ts` calcula el SHA-512, lo archiva en Supabase Storage y crea el *evidence bundle*. El binding del motor (si la plantilla exige snapshot de rule pack) ata el documento a una fotografía inmutable del estado normativo en el momento de la generación.

## 6. Inventario real de plantillas en Cloud y cobertura

Lo siguiente es el estado verificado de `plantillas_protegidas` para el *tenant* demo (`00000000-0000-0000-0000-000000000001`) en `governance_OS`, no el del backlog. **Existen 110 plantillas, 13 tipos distintos, 75 ACTIVA y 35 ARCHIVADA.**

**Por tipo documental:**

| Tipo | Total | Notas |
|---|---|---|
| `MODELO_ACUERDO` | 70 | Modelos de acuerdo por materia (58 ACTIVA). |
| `ACTA_SESION` | 7 | Actas de sesión formal. |
| `ACTA_CONSIGNACION` | 6 | Actas de consignación de acuerdos. |
| `CONVOCATORIA` | 6 | Convocatorias. |
| `ACTA_ACUERDO_ESCRITO` | 3 | Acuerdos sin sesión. |
| `CERTIFICACION` | 3 | Certificaciones de acuerdos. |
| `CONVOCATORIA_SL_NOTIFICACION` | 3 | Notificación de convocatoria SL. |
| `INFORME_DOCUMENTAL_PRE` | 3 | Informes documentales previos. |
| `INFORME_PRECEPTIVO` | 3 | Informes preceptivos. |
| `ACTA_DECISION_CONJUNTA` | 2 | Co-aprobación. |
| `ACTA_ORGANO_ADMIN` | 2 | Acta de órgano de administración. |
| `COMISION_DELEGADA` | 1 | Comisión delegada. |
| `INFORME_GESTION` | 1 | Informe de gestión. |

**Por estado:** ACTIVA 75 · ARCHIVADA 35 (no hay plantillas vivas en BORRADOR/REVISADA/APROBADA/DEPRECADA).

**Por jurisdicción:** la cobertura es **íntegramente española (`ES`)** — 75 ACTIVA y 35 ARCHIVADA, todas ES. No hay todavía plantillas BR/MX/PT/UK/FR/DE en Cloud (la multi-jurisdicción está soportada por el schema pero pendiente de poblado — Sprint F).

**Por tipo social:** las 110 plantillas tienen **`tipo_social` NULL** (sin discriminar por forma societaria), coherente con que la clave funcional fija hoy `tipoSocial: null`. La diferenciación SA/SL se aplica por motor de reglas en el momento de uso, no por plantilla distinta.

**Por órgano** (total / ACTIVA):

| `organo_tipo` | Total | ACTIVA | Observación |
|---|---|---|---|
| `JUNTA_GENERAL` | 42 | 35 | |
| `CONSEJO_ADMIN` | 28 | 25 | |
| (NULL) | 9 | 0 | Filas sin órgano — todas archivadas/no activas. |
| `ORGANO_ADMIN` | 5 | 2 | |
| `SOPORTE_INTERNO` | 5 | 3 | Exento de cita legal en Gate PRE. |
| `COMISION_DELEGADA` | 4 | 3 | |
| `SOCIO_UNICO` | 3 | 2 | |
| `ADMIN_CONJUNTA_O_COAPROBADORES` | 2 | 1 | |
| `ADMIN_SOLIDARIOS` | 2 | 1 | |
| `ADMIN_UNICO` | 2 | 1 | |
| `DERIVADO_DEL_ACTO` | 2 | 1 | |
| `JUNTA_GENERAL_O_CONSEJO` | 2 | 1 | Valor deprecado (compatibilidad temporal). |
| `CONSEJO_ADMINISTRACION` | 3 | 0 | **Alias no canónico** — solo en filas archivadas. |
| `CONSEJO` | 1 | 0 | **Alias no canónico** — solo en filas archivadas. |

Conviene señalar al equipo legal que los valores `CONSEJO_ADMINISTRACION` (3) y `CONSEJO` (1) son alias no canónicos; ninguno está en estado ACTIVA (el Gate PRE bloquearía su activación con `META_ORGANO_NULL` exigiendo normalizar a `CONSEJO_ADMIN`), por lo que no afectan a la producción documental viva.

**Cobertura de modelos de acuerdo (matriz materia × jurisdicción × órgano):** de los 70 `MODELO_ACUERDO`, **58 están ACTIVA**, cubriendo **54 materias jurídicas distintas**, todas en jurisdicción **ES** y con `tipo_social` NULL. El reparto por órgano de los modelos activos: **Junta General 32, Consejo de Administración 23, Socio Único 1, Órgano de Administración 1, Soporte Interno 1.** Las materias cubiertas con modelo ACTIVA abarcan el espectro societario nuclear, entre otras: aprobación de cuentas, aplicación del resultado, distribución de dividendos y dividendo a cuenta, nombramiento y cese de consejero, nombramiento de auditor, modificación de estatutos, aumento y reducción de capital, ejecución de aumento delegado, delegación de capital, supresión del derecho de suscripción preferente, adquisición de acciones propias, emisión de obligaciones y de deuda convertible, fusión, escisión y fusión/escisión, transformación, disolución y liquidación, traslado de domicilio nacional, cambio de denominación y de domicilio social, ampliación del objeto social, prórroga de la sociedad, exclusión y separación de socio, transmisión de participaciones, prestaciones accesorias, contratos socio único–sociedad, operación vinculada, autorización de garantías, pacto parasocial, política de remuneración, distribución de cargos, delegación de facultades, comités internos, aprobación del reglamento del consejo, poder de representación, ratificación de actos, contratación relevante, financiación, aprobación de plan de negocio/presupuesto, cuentas consolidadas, activos esenciales y acción social de responsabilidad.

Como dato de configuración del motor: **74 de las 75 plantillas ACTIVA exigen snapshot de rule pack** (`snapshot_rule_pack_required = true`), es decir, su generación queda atada a una fotografía inmutable del marco normativo aplicable.

---

**Rutas de archivo de referencia (trazabilidad):**
- Consola y pestañas: `src/pages/secretaria/GestorPlantillas.tsx`, `src/components/secretaria/gestor/{tab-guards.ts, DashboardTab, CatalogoTab, CoberturaLegalTab, ImportarTab, MetricasTab, AuditoriaTab, ValidacionTab, ConfiguracionSociedadTab, TemplateImportWizard}.tsx`
- Catálogo de uso: `src/pages/secretaria/Plantillas.tsx`; redirect 301 en `src/App.tsx` (líneas ~236–239)
- Librería canónica: `src/lib/secretaria/template-admin/{types, functional-key, gate-pre, gate-pre-semantic, template-admin-service, template-importer, template-import-schema, organo-canonico, changelog, known-p0}.ts`
- Motor documental (3 capas): `src/lib/doc-gen/{template-renderer, variable-resolver, docx-generator, storage-archiver}.ts`
- Contrato de variables: `docs/contratos/variables-plantillas-v1.1.yaml`
- Tabla Cloud: `plantillas_protegidas` (+ `plantilla_changelog`) en proyecto `hzqwefkwsxopwrmtksbg` (governance_OS)

---

# 5. Firma electrónica cualificada (QTSP EAD Trust), evidencia forense y auditoría WORM

## 1. Marco y proveedor de confianza único: EAD Trust

Todo el ciclo de confianza electrónica del módulo de Secretaría Societaria descansa en un **único Prestador Cualificado de Servicios de Confianza (QTSP)**: **EAD Trust**, la empresa tecnológica del grupo Garrigues (línea g-digital). No existe integración con ningún otro proveedor de firma; el cliente de integración (`src/lib/qtsp/ead-trust-client.ts`) expone exclusivamente los endpoints de EAD Trust (Evidence Manager y Signature Manager), autenticados contra su Identity Provider (Okta) mediante el flujo OAuth `client_credentials`.

La plataforma consume cuatro servicios de confianza cualificados de EAD Trust, todos con valor probatorio reforzado bajo el Reglamento (UE) 910/2014 (eIDAS) y su revisión eIDAS 2:

| Servicio | Naturaleza eIDAS | Función en Secretaría | Punto de código |
|---|---|---|---|
| **QES** (firma electrónica cualificada) | Firma cualificada de persona física | Firma de actas, certificaciones y documentos societarios por el firmante autorizado (Secretario, Presidente, etc.) | `executeQESSignFlow()` en `ead-trust-client.ts`; hook `useQTSPSign` |
| **QSeal** (sello electrónico cualificado) | Sello de persona jurídica | Sellado del bundle de evidencia / manifest a nombre de la entidad emisora | Columna `evidence_bundles.qseal_token` (Cloud); artefacto tipado `QSEAL` en verificación |
| **Timestamp cualificado** (TSQ) | Sello de tiempo cualificado | Fecha cierta del momento de firma/certificación, anclada en TSP de EAD Trust | `certifications.tsq_token` (`bytea`); `testimony.TSP.providers=['EADTrust']` en `createEvidence` |
| **ERDS** (notificación certificada / entrega electrónica certificada) | Servicio cualificado de entrega electrónica | Notificación fehaciente de convocatorias y acuerdos (p. ej. acuerdos sin sesión, convocatoria SL) con generación de evidencia de entrega | Hook `useERDSNotification`; `generateEvidence()` con `custodyType:'EXTERNAL'` |

El **Trust Center / verificación de integridad** (`useQTSPVerification`, hook T22) cierra el círculo permitiendo reverificar a posteriori, sobre los artefactos persistidos, que los sellos y hashes mantienen su integridad.

### 1.1 Arquitectura de invocación y frontera servidor/cliente

El cliente está diseñado *fail-closed* respecto a las credenciales cualificadas. La función `getOktaToken()` exige `tokenUrl`, `clientId` y `clientSecret`; el secreto **nunca se embebe en el navegador** (`clientSecret: ''` en `EAD_CONFIG`). Si no hay proxy servidor configurado, `assertServerSideQTSPProxyConfigured()` lanza el error tipado `QTSP_SERVER_PROXY_REQUIRED`, con el mensaje explícito de que el flujo `client_credentials` de EAD Trust **debe ejecutarse en servidor a través de un proxy QTSP**. Esto materializa la regla jurídico-técnica de que las credenciales del QTSP no pueden residir en el cliente: en producción real, la firma cualificada se delega a un proxy de confianza del lado servidor.

El flujo QES completo orquestado (`executeQESSignFlow`) sigue la secuencia operativa del Signature Manager de EAD Trust:

1. Crear *Signature Request* (estado DRAFT).
2. Calcular **SHA-256** del documento (Web Crypto API, `globalThis.crypto.subtle`).
3. Registrar el documento (`signatureType: 'INTERPOSITION'`, `provider: 'EADTRUST'`) y subir los bytes a la URL S3 prefirmada, con checksum `x-amz-checksum-sha256`.
4. Esperar estado `READY_TO_SIGN` (polling).
5. Añadir los firmantes en secuencia.
6. Activar la *Signature Request* (DRAFT → ACTIVE), que dispara las notificaciones cualificadas a los firmantes.

Para la evidencia ERDS, `generateEvidence()` ejecuta crear → subir a S3 → *poll* hasta `COMPLETED`/`ERROR`, registrando en el Evidence Manager con testimonio TSP cualificado.

## 2. La cadena de evidencia probatoria extremo a extremo

El valor jurídico del sistema no reside en una firma aislada, sino en una **cadena de eslabones criptográficos encadenados** que ata la legitimación del firmante, el estado societario congelado, el resultado del acuerdo y el documento físico. Cada eslabón hashea al anterior, de modo que cualquier alteración intermedia rompe la verificación.

| Eslabón | Qué congela | Algoritmo | Dónde |
|---|---|---|---|
| 1. **Censo WORM** | Composición del censo (socios, capital, derechos de voto) en el instante del acto | SHA-512 (vía `audit_log` encadenado) | `censo_snapshot` + `audit_log.hash_sha512` |
| 2. **`snapshot_hash`** | El hash del censo resuelto para esa acta | Heredado del eslabón WORM | `fn_generar_certificacion` lo resuelve por `minutes.snapshot_id → censo_snapshot.audit_worm_id → audit_log.hash_sha512` |
| 3. **`gate_hash`** | Vínculo indisoluble censo ↔ contenido del acta ↔ acuerdos certificados | SHA-256 | `certifications.gate_hash` |
| 4. **QES + TSQ** | Voluntad del firmante y fecha cierta | Firma cualificada EAD Trust + sello de tiempo | `certifications.tsq_token` (`bytea`) + `hash_certificacion` |
| 5. **Archivado SHA-512** | Integridad del documento DOCX físico | SHA-512 (Web Crypto) | `evidence_bundles.hash_sha512` |
| 6. **Evidence bundle** | Manifiesto canónico de todos los artefactos | SHA-256 sobre JSON canónico | `evidence_bundles.manifest_hash` |

### 2.1 Gate de censo WORM → `snapshot_hash`

Antes de poder certificar, el acta (`minutes`) debe estar vinculada a un `censo_snapshot` inmutable. El RPC `fn_generar_certificacion` resuelve el hash del censo navegando `minutes → censo_snapshot → audit_log`, tomando `audit_log.hash_sha512` como `snapshot_hash` autoritativo. Si el acta carece de snapshot (actas legacy), usa el sentinel `'NO_SNAPSHOT_HASH'` — preservando deliberadamente la ausencia de WORM retroactivo en lugar de fabricar un hash falso.

El RPC además incorpora **controles de legitimación registral** que dan al documento su valor formal frente al Registro Mercantil:

- **RRM art. 109.4**: solo se certifican acuerdos de actas **aprobadas y firmadas** (`minutes.signed_at` no nulo); de lo contrario lanza excepción.
- **RRM art. 109.1.a**: cuando certifica el Secretario/Vicesecretario de un órgano colegiado, exige **siempre** el Vº Bº del Presidente/Vicepresidente (con independencia del tipo social), verificando que esa persona ostente cargo `PRESIDENTE`/`VICEPRESIDENTE` con `estado='VIGENTE'` en `authority_evidence`, con preferencia por el `body_id` del acta.
- La autoridad del propio certificante se resuelve también contra `authority_evidence` vigente para el cargo y órgano.

### 2.2 Cálculo del `gate_hash`

El `gate_hash` es el eslabón que hace inseparables el estado societario, el texto del acta y los acuerdos. Verificado en Cloud, `fn_generar_certificacion` lo computa así:

- `resultado_hash = SHA-256( agreements_certified unidos por "|" )`
- `gate_hash = SHA-256( snapshot_hash ‖ canonical_minutes_hash ‖ resultado_hash )`

(donde `canonical_minutes_hash` aporta la integridad del propio cuerpo del acta; sentinel `'NO_CANONICAL_MINUTES_HASH'` si falta). La certificación nace con `signature_status = 'PENDING'` y `requires_qualified_signature = true`.

### 2.3 Firma QES y sello de tiempo

`fn_firmar_certificacion(p_certification_id, p_qtsp_token, p_tsq_token)` exige que el `gate_hash` exista y que el TSQ no sea nulo, y calcula el **hash de certificación** que ancla la firma al gate:

- `hash_certificacion = SHA-256( gate_hash ‖ content ‖ tsq_token )`
- persiste `tsq_token = decode(p_tsq_token,'base64')::bytea` y fija `signature_status = 'SIGNED'`.

### 2.4 Emisión y enlace al bundle

`fn_emitir_certificacion` rechaza emitir si la certificación no está `SIGNED`, sintetiza el URI del bundle (`evidence_bundle:<id>@<manifest_hash>`), promueve los acuerdos certificados de `ADOPTED` a `CERTIFIED` (solo refs UUID válidas) e inscribe el evento `CERT_EMITIDA` en `audit_log` con el `hash_certificacion`, URI y timestamp.

### 2.5 Componente de orquestación: `EmitirCertificacionButton`

`src/components/secretaria/EmitirCertificacionButton.tsx` ejecuta los tres RPC en cadena (generar → firmar → emitir). Características probatoriamente relevantes:

- **Guard de capability**: el botón solo se renderiza si `useHasCapability(userRole, "CERTIFICATION")` es verdadero (matriz `capability_matrix`).
- **Vº Bº precargado** con el Presidente vigente (`usePresidenteVigente`), con orden de preferencia PRESIDENTE > VICEPRESIDENTE y SECRETARIO > VICESECRETARIO.
- **Doble verificación registral (D5.5, L23 + RRM art. 109)**: bloquea la emisión si falta `inscripcion_rm_referencia` en el cargo certificante o en el del Vº Bº, con `alert` accesible que identifica cuál falla.
- En el demo, los pasos 2 y 3 usan tokens stub deterministas base64; el comentario de código deja constancia de que **el pipeline productivo sustituye ese bloque por la llamada real al QTSP EAD Trust**. El toast de éxito advierte que es "referencia operativa demo… no constituye evidencia final productiva".

### 2.6 Archivado SHA-512 y manifiesto del bundle

`archiveDocxToStorage()` (`src/lib/doc-gen/storage-archiver.ts`) es el archivero forense del documento:

- Calcula **SHA-512** del DOCX con `globalThis.crypto.subtle.digest("SHA-512", buffer)` (no `crypto` de Node, por requisito del entorno).
- **Idempotencia por contenido**: el path en Storage incluye 8 caracteres del SHA-512 (`<tenant_id>/<agreement_id>/<filename>__<hash8>.docx`), de modo que contenidos distintos no colisionan y un re-upload solo sobrescribe bytes idénticos.
- Construye un `manifest` versionado (`docgen-process-v2`) con el array de `artifacts` (tipo `DOCX`, `hash_sha512`, `timestamp_iso`, mime), enriquecido con metadatos QTSP (`qesSrId`, `qesDocumentId`, `qesDocumentHash`, `qesSignatoryIds`, `qesSignedAt`, `archivedBufferKind`) y el snapshot normativo aplicado.
- Calcula `manifest_hash = SHA-256( JSON canónico del manifest )` — con serialización canónica (claves ordenadas) que garantiza un hash estable e independiente del orden de inserción.
- Inserta en `evidence_bundles` con provenance obligatoria (`source_module='secretaria'`, `source_object_type='AGREEMENT'`, `source_object_id=agreementId`), imprescindible para recuperar el documento desde el expediente. El bucket es **privado**: el acceso pasa por la Edge Function `sign-evidence-url`, y `document_url` se puebla con un sentinel `evidence-bundle://<path>` no navegable.

`GenerarDocumentoStepper.tsx` integra ambos: invoca `signMutation` de `useQTSPSign`, sustituye el buffer por `signedDocumentData` si la firma fue real, y archiva el buffer firmado (`QTSP_SIGNED_DOCX`) o el original (`ORIGINAL_DOCX`) marcando `signedBy: "EAD Trust"` solo cuando no es sandbox.

## 3. Frontera de confianza (trust boundary): sandbox vs. producción

Un riesgo probatorio central es que una firma **simulada** de demo termine persistida como **evidencia cualificada definitiva**. El sistema lo impide por diseño, fruto de revisión adversarial (Codex review #2).

**Origen del sandbox**: cuando EAD Trust no está accesible desde el navegador (error `QTSP_SERVER_PROXY_REQUIRED` o `client_credentials`), `useQTSPSign` cae a un adaptador sandbox que calcula el hash localmente pero **no produce una transacción QES/ERDS real**. Ese fallback es *fail-closed en producción*: solo se activa con `import.meta.env.DEV` o `VITE_QTSP_ALLOW_SANDBOX === 'true'`; en producción un fallo de proxy lanza error, **nunca convierte un fallo en una firma "exitosa"**. Los resultados sandbox se marcan `sandbox: true`.

**Gate de persistencia** (`src/lib/secretaria/evidence-sandbox-gate.ts`, módulo puro y testeable):

- `resolveSandboxSafeEvidencePersistence()`: si `sandbox === true`, **degrada el status a `OPEN`** (no-final, sin `signature_date`) y anota en el manifest `sandbox: true` + `sandbox_reason`. Sin sandbox, respeta el status solicitado (`SEALED` por defecto).
- `isFinalSealedEvidence(status)`: predicado que solo considera evidencia definitiva los status `SEALED` o `VERIFIED`. La UI gatea por él los badges SEALED/QSeal, contadores y toasts, de modo que un bundle sandbox nunca se presenta como evidencia final.

Esta separación está respaldada en la base de datos: la columna `evidence_bundles.status` está acotada por el CHECK `evidence_bundles_status_check` a `('OPEN','SEALED','VERIFIED')` (verificado en Cloud), y `fn_create_governance_evidence_bundle` lanza excepción para cualquier otro valor y solo fija `signature_date` cuando el status es `SEALED`/`VERIFIED`. El resultado jurídico: la cadena de custodia **deja constancia explícita** de qué evidencia es cualificada y cuál es operativa de demo, sin ambigüedad.

## 4. Auditoría WORM (Write-Once-Read-Many) y verificación de integridad

### 4.1 Cadena de hash SHA-512 en `audit_log`

El registro de auditoría es una **cadena de bloques encadenada por hash** (blockchain-like, append-only). El trigger `fn_audit_worm` (SECURITY DEFINER, verificado en Cloud) se dispara en INSERT/UPDATE/DELETE de las tablas auditadas y, por cada operación:

1. Recupera el hash de la **última entrada** del mismo tenant (filas con `hash_sha512` no nulo, orden `created_at DESC, id DESC` — desempate determinista).
2. Calcula el hash del bloque actual:
   `hash_sha512 = SHA-512( prev_hash_o_'GENESIS' ‖ acción ‖ tabla ‖ record_id ‖ payload_jsonb )`
3. Inserta la entrada en `audit_log` con `actor_email` extraído del JWT (`request.jwt.claims`), `delta` (old/new), y el nuevo hash.

El primer bloque de cada tenant ancla en el literal **`'GENESIS'`**. Como cada bloque incorpora el hash del anterior, **modificar o borrar cualquier entrada intermedia invalida toda la cadena descendente** — propiedad WORM efectiva sin necesidad de almacenamiento immutable subyacente.

Estructura real de `audit_log` en Cloud: `id`, `tenant_id`, `object_type`, `object_id`, `previous_hash`, `current_hash`, `delta` (jsonb), `hash_sha512`, `created_at` (más `table_name`, `record_id`, `action`, `actor_email`).

### 4.2 Verificación de integridad: `fn_verify_audit_chain`

`fn_verify_audit_chain(p_tenant_id) → TABLE(total_entries, chain_valid, first_entry_at, last_entry_at)` recorre la cadena en orden ascendente (`created_at ASC, id ASC`), **recalcula** cada hash con la misma receta del trigger y compara con el `hash_sha512` almacenado. A la primera divergencia (`v_computed IS DISTINCT FROM v_row.hash_sha512`) marca `chain_valid = false` y aborta. Devuelve además el total de entradas y el rango temporal.

El hook `useVerifyAuditChain` lo expone; `EvidenceForenseSection.tsx` (botón "Verificar cadena") presenta el resultado: si `chain_valid`, "Cadena íntegra — N entradas verificadas"; si no, "¡Cadena comprometida! Se ha detectado manipulación.". Junto a ello lista los `evidence_bundles` con su SHA-512 (truncado), firmante, fecha y badge `LEGAL HOLD`. Es la pieza de cara al perito/auditor: permite demostrar en vivo que el registro no ha sido alterado.

### 4.3 Inmutabilidad de `censo_snapshot`

El censo congelado es el fundamento del cómputo de quórum y mayorías, por lo que es estrictamente append-only. Triggers verificados en Cloud sobre `censo_snapshot`:

| Trigger | Evento | Efecto |
|---|---|---|
| `trg_censo_snapshot_worm` | BEFORE INSERT | Rellena `audit_worm_id` (ancla el snapshot a la cadena WORM) |
| `trg_block_censo_snapshot_update` | BEFORE UPDATE | Bloquea con excepción ("inmutable") |
| `trg_block_censo_snapshot_delete` | BEFORE DELETE | Bloquea con excepción ("inmutable") |

Así, el `snapshot_hash` que alimenta el `gate_hash` (§2.2) procede de un objeto que el propio motor no puede reescribir ni borrar — garantía de que el estado societario certificado es exactamente el vigente en el momento del acto.

### 4.4 Hardening de aislamiento multi-tenant del bundle

`fn_create_governance_evidence_bundle` es SECURITY DEFINER, lo que exigía blindar la suplantación de tenant. La migración `harden_create_governance_evidence_bundle_tenant_assert` (aplicada en Cloud, head `20260606165443`) implementa una aserción *fail-closed con lógica de tres valores*:

- Si el llamante **no** es `service_role` (`fn_secretaria_is_service_role() IS NOT TRUE`, cubriendo `authenticated`/`anon`/sin rol), se exige que `fn_assert_current_tenant_id() = p_tenant_id`; en caso contrario lanza excepción con `ERRCODE = '42501'` ("evidence bundle tenant mismatch"), cerrando la forja de evidencia cross-tenant.
- Solo `service_role` (TRUE explícito) puede pasar un `p_tenant_id` arbitrario (orquestación server-side).
- Refuerza además la integridad de provenance: `p_tenant_id` y `p_source_object_id` son obligatorios.

El manifest del bundle se construye servidor-side con `manifest_hash = SHA-256(manifest)`, `hash_sha512 = SHA-512(manifest)`, y un `chain_of_custody` inicial con el evento `GOVERNANCE_EVIDENCE_BUNDLE_CREATED` (timestamp, actor, hash del manifest). El bloque `qtsp.provider = 'EAD Trust'` queda inscrito en el propio manifest.

## 5. Verificación posterior (Trust Center) y valor probatorio agregado

`useQTSPVerification(agreementId)` carga los `evidence_bundles` y `rule_evaluation_results` del acuerdo y ejecuta `verificarIntegridad()` sobre los artefactos. Notas con relevancia probatoria:

- Los artefactos se extraen de `manifest.artifacts` (columna real `manifest` jsonb); los DOCX archivados se mapean a tipo `HASH` por su `hash_sha512`, y si el manifest trae sellos QTSP tipados (`QES`/`QSEAL`/`TSQ`/`NOTIFICATION`) se respetan.
- **No se sintetizan hashes**: si una evaluación con `signature_ref` carece de `signature_hash`, el artefacto se incluye con hash vacío para que la verificación lo marque como **FALLIDO (fail-closed)** en lugar de fabricar confianza inexistente — corrección expresa de la revisión ITEM-107.

En conjunto, el sistema produce, para cada acto societario certificado, un expediente probatorio reconstruible y reverificable: el censo congelado (WORM), su hash, el `gate_hash` que lo une al contenido y los acuerdos, la firma QES con sello de tiempo cualificado de EAD Trust, el documento físico con su SHA-512, y el manifiesto del bundle con su propio hash — todo ello respaldado por una cadena de auditoría SHA-512 cuya integridad puede demostrarse en cualquier momento mediante `fn_verify_audit_chain`, y con una frontera de confianza que distingue inequívocamente la evidencia cualificada definitiva de la operativa de demostración.

---

**Trazabilidad de fuentes (rutas y objetos verificados):**
- Hooks QTSP: `src/hooks/useQTSPSign.ts`, `src/hooks/useQTSPVerification.ts`, `src/hooks/useERDSNotification.ts`, `src/hooks/useEvidenceBundles.ts`
- Cliente QTSP: `src/lib/qtsp/ead-trust-client.ts`
- Archivado/gate: `src/lib/doc-gen/storage-archiver.ts`, `src/lib/secretaria/evidence-sandbox-gate.ts`
- UI: `src/components/EvidenceForenseSection.tsx`, `src/components/secretaria/EmitirCertificacionButton.tsx`, `src/pages/secretaria/GenerarDocumentoStepper.tsx`
- RPCs Cloud (proyecto `governance_OS`): `fn_generar_acta`, `fn_generar_certificacion`, `fn_firmar_certificacion`, `fn_emitir_certificacion`, `fn_audit_worm`, `fn_verify_audit_chain`, `fn_create_governance_evidence_bundle`, `fn_current_tenant_id`/`fn_assert_current_tenant_id`/`fn_secretaria_is_service_role`
- Tablas/constraints Cloud: `evidence_bundles` (CHECK status `OPEN|SEALED|VERIFIED`, columnas `qseal_token`, `tsq_token`, `manifest_hash`, `hash_sha512`), `certifications` (`gate_hash`, `tsq_token bytea`, `hash_certificacion`, `authority_evidence_id`), `audit_log` (`hash_sha512`, `previous_hash`/`current_hash`, `delta`), `censo_snapshot` (triggers `trg_censo_snapshot_worm`, `trg_block_censo_snapshot_update`, `trg_block_censo_snapshot_delete`)
- Migración de hardening: `harden_create_governance_evidence_bundle_tenant_assert` (head Cloud `20260606165443`)

---

# 6. Superficies de trabajo del usuario y control de acceso (RBAC)

Esta sección describe las superficies de trabajo (pantallas y menú de navegación) que el módulo de Secretaría Societaria expone al usuario, y el modelo de control de acceso basado en roles (RBAC), capacidades societarias y segregación de funciones que gobierna qué puede ver y hacer cada perfil. La descripción se ha contrastado contra el código fuente y contra la base de datos en producción (proyecto Supabase `governance_OS`, `hzqwefkwsxopwrmtksbg`, tenant demo `00000000-0000-0000-0000-000000000001`, entidad canónica ARGA Seguros S.A. `6d7ed736-f263-4531-a59d-c6ca0cd41602`).

## 1. Modelos de navegación: modo Sociedad frente a modo Grupo

El menú lateral de Secretaría opera en dos modos excluyentes, seleccionables desde el conmutador de ámbito del shell (`ScopeSwitcher.tsx`, `setMode`):

- **Modo Grupo** (`Grupo ARGA Seguros`): visión multi-sociedad. El usuario opera transversalmente sobre todas las sociedades del grupo; todos los flujos están disponibles sin filtrar por la forma de administración de una entidad concreta. La cabecera lo etiqueta como "Modo Grupo · visión multi-sociedad" (`SecretariaHeader.tsx`).
- **Modo Sociedad**: vista enfocada en una entidad concreta seleccionada (p. ej. ARGA Seguros S.A.). La cabecera muestra la denominación, forma jurídica y jurisdicción de la sociedad activa. En este modo cada elemento del menú lleva **reglas de visibilidad declarativas** que el sidebar evalúa contra el contexto de la entidad (forma social, régimen de administración, tipos de órgano vigentes, modos de adopción disponibles, capacidades societarias, *readiness* del expediente demo, roles y permisos RBAC).

La definición de los dos árboles de navegación está en `src/components/secretaria/shell/navigation.ts` (`GRUPO_NAV_GROUPS` y `SOCIEDAD_NAV_GROUPS`). El motor de visibilidad y poda de secciones está en `src/lib/secretaria/sidebar-visibility.ts` (`isItemVisible`, `getVisibleSidebarSections`): un grupo entero desaparece del menú cuando ninguno de sus elementos resulta visible.

La taxonomía vigente de secciones (idéntica en ambos modos en cuanto a rótulos de sección) es: **Inicio / Adopción / Documentación / Registro público / Libros y registros sociales / Sociedades y personas / Configuración y reglas.**

### Diferencias funcionales clave entre modos

| Dimensión | Modo Grupo | Modo Sociedad |
|---|---|---|
| Filtro de visibilidad por entidad | No se aplica (`requiresEntity` inerte) | Sí: la mayoría de elementos requieren entidad seleccionada (`requiresEntity: true`) |
| "Campañas de grupo" (`/secretaria/procesos-grupo`) | Visible en sección Inicio | No aparece (es un flujo multi-sociedad) |
| Adopción según régimen de administración | Todos los modos de adopción disponibles | Filtrados: Convocatorias/Reuniones solo en órgano colegiado; Decisiones unipersonales solo en administrador único; Acuerdos sin sesión solo si hay modo `NO_SESSION`/`CO_APROBACION`/`SOLIDARIO` |
| Board Pack | Solo capacidad `canCertify` | Capacidad `canCertify` + órgano colegiado + entidad no "reference_only" |
| Documentación (Actas) | Listado completo | Actas requiere órgano colegiado; "Actas pendientes" y "Certificaciones vinculadas" requieren solo entidad |

El filtro de **órgano colegiado** (`entityHasCollegiateBody`) es el discriminador societario más relevante: distingue sociedades con Consejo de Administración o Junta General (que necesitan flujos colegiados de convocatoria, reunión y acta) de sociedades unipersonales o con administración no colegiada (único, solidario, mancomunado), donde se ofrecen decisiones unipersonales o acuerdos sin sesión en su lugar. El motor tolera grafías canónicas y *legacy* del régimen (`ADMIN_UNICO`/`ADMINISTRADOR_UNICO`, `ADMIN_SOLIDARIOS`/`ADMIN_SOLIDARIO`, `ADMIN_MANCOMUNADOS`/`ADMIN_MANCOMUNADO`/`CONSEJO_MANCOMUNADO`, etc.) y aplica un *veto unipersonal*: si la sociedad es realmente de socio único, la "junta" se trata como decisión unilateral y no como flujo colegiado.

## 2. Mapa de secciones del menú lateral (modo Sociedad)

La tabla siguiente recoge cada sección, sus elementos, la ruta de destino y la condición de visibilidad efectiva, según `SOCIEDAD_NAV_GROUPS` en `navigation.ts`.

| Sección | Elemento | Ruta | Condición de visibilidad (modo Sociedad) |
|---|---|---|---|
| **Inicio** | Dashboard | `/secretaria` | Siempre (coincidencia exacta de ruta) |
| | Board Pack | `/secretaria/board-pack` | Entidad + órgano colegiado + capacidad `canCertify` + no "reference_only" |
| **Adopción** | Convocatorias | `/secretaria/convocatorias` | Entidad + órgano colegiado + no "reference_only" |
| | Reuniones | `/secretaria/reuniones` | Entidad + órgano colegiado + no "reference_only" |
| | Decisiones unipersonales | `/secretaria/decisiones-unipersonales` | Entidad + administrador único (`requiresUnipersonalAdmin`) |
| | Acuerdos sin sesión | `/secretaria/acuerdos-sin-sesion` | Entidad + modo de adopción `NO_SESSION`/`CO_APROBACION`/`SOLIDARIO` + no "reference_only" |
| **Documentación** | Actas | `/secretaria/actas` | Entidad + órgano colegiado |
| | Actas pendientes | `/secretaria/actas?vista=pendientes` | Entidad |
| | Certificaciones vinculadas | `/secretaria/actas?vista=certificaciones` | Entidad |
| | Comunicaciones | `/secretaria/comunicaciones` | Entidad |
| | Documentos en revisión | `/secretaria/documentos/pendientes-revision` | Sin condición |
| **Registro público** | Tramitador registral | `/secretaria/tramitador` | Entidad |
| | Subsanaciones | `/secretaria/tramitador?estado=SUBSANACION` | Entidad |
| | Presentaciones | `/secretaria/tramitador?estado=PRESENTADA` | Entidad |
| **Libros y registros sociales** | Libro de socios | `/secretaria/libro-socios` | Entidad |
| | Libros obligatorios | `/secretaria/libros` | Entidad |
| | **Procesos** | `/secretaria/calendario` | Entidad |
| | Multi-jurisdicción | `/secretaria/multi-jurisdiccion` | Sin condición |
| **Sociedades y personas** | Sociedades | `/secretaria/sociedades` | Sin condición (ruta de entidad seleccionada) |
| | Personas y cargos | `/secretaria/personas` | Sin condición |
| **Configuración y reglas** | Materias y reglas | `/secretaria/catalogo-materias` | Sin condición |
| | Catálogo de órganos | `/secretaria/catalogo-organos` | Sin condición |
| | Plantillas | `/secretaria/plantillas` | Sin condición |
| | Gestor plantillas | `/secretaria/gestor-plantillas` | Sin condición (control RBAC interno por pestaña, ver §5) |

**Nota sobre el elemento "Procesos":** rotula como "Procesos" pero su ruta es `/secretaria/calendario` y su icono es `Calendar` (página `Calendario.tsx`, calendario de vencimientos). Es deuda de diseño intencional conocida (tres señales contradictorias: rótulo / icono / página). Para automatización y pruebas E2E debe usarse el selector estable `[data-sidebar-item="Procesos"]` en lugar del texto, ya que el rótulo es objeto de reconciliación pendiente. Recordatorio de marca: el rótulo "Registro público" sustituye a la denominación interna previa "REGISTRO" para evitar colisión semántica con el Registro Mercantil; la función registral propiamente dicha vive en el "Tramitador registral".

**Diferencias del menú en modo Grupo** (`GRUPO_NAV_GROUPS`): la sección Inicio añade "Campañas de grupo" (`/secretaria/procesos-grupo`); la sección Documentación incluye "Comunicaciones" y "Documentos en revisión" sin filtro de entidad; y la sección Libros y registros sociales contiene los mismos elementos (Libro de socios, Libros obligatorios, "Procesos" → `/secretaria/calendario`, Multi-jurisdicción) pero sin restricción de entidad. Board Pack en modo Grupo solo exige la capacidad `canCertify`.

## 3. Catálogo de superficies (pantallas) y su propósito

Las pantallas viven en `src/pages/secretaria/*.tsx`. El siguiente catálogo agrupa cada superficie por su naturaleza (panel, lista, detalle de solo lectura, asistente de alta, consola) y describe su propósito jurídico-operativo para el usuario.

### 3.1 Panel e inicio

| Superficie | Archivo | Propósito |
|---|---|---|
| Dashboard de Secretaría | `Dashboard.tsx` | Panel de KPIs: próximas reuniones, acuerdos pendientes, alertas de libros y vencimientos; acciones rápidas (nueva convocatoria/reunión/acuerdo, generar documento). |
| Board Pack ejecutivo | `BoardPack.tsx`, `BoardPackPreview.tsx` | Dossier ejecutivo del órgano (9 secciones), con advertencias específicas de sociedad cotizada (LMV) y de voto de calidad. Gated por capacidad de certificación. |

### 3.2 Adopción de acuerdos

| Superficie | Archivo | Naturaleza | Propósito |
|---|---|---|---|
| Convocatorias (lista) | `ConvocatoriasList.tsx` | Lista | Listado de convocatorias de órganos colegiados. |
| Convocatoria (detalle) | `ConvocatoriaDetalle.tsx` | Detalle | Ficha de convocatoria con cómputo de plazos y validación de forma. |
| Asistente de convocatoria | `ConvocatoriasStepper.tsx` | Stepper (alta) | Flujo de 8 pasos para convocar; borrador de documento y emisión con motor de reglas. |
| Reuniones (lista) | `ReunionesLista.tsx` | Lista | Listado de reuniones del órgano. |
| Reunión (stepper/detalle) | `ReunionStepper.tsx` | Stepper conectado | Operativa de reunión: constitución, asistentes, quórum (motor de mayorías), debates, votaciones, cierre con generación de acta. `/nueva` es intake de solo lectura para handoffs. |
| Acuerdos sin sesión (lista) | `AcuerdosSinSesion.tsx` | Lista + CTAs | Punto de entrada a los modos NO_SESSION, CO_APROBACION (mancomunado) y SOLIDARIO; los CTA visibles dependen del régimen de administración. |
| Acuerdo sin sesión (alta/detalle) | `AcuerdoSinSesionStepper.tsx`, `AcuerdoSinSesionDetalle.tsx` | Stepper / Detalle | Tracker de unanimidad y proceso de votación sin reunión. |
| Co-aprobación | `CoAprobacionStepper.tsx` | Stepper (5 pasos) | Adopción k-de-n para administradores mancomunados. |
| Solidario | `SolidarioStepper.tsx` | Stepper (4 pasos) | Adopción por administrador solidario. |
| Decisiones unipersonales | `DecisionesUnipersonales.tsx`, `DecisionUnipersonalStepper.tsx`, `DecisionDetalle.tsx` | Lista / Stepper / Detalle | Decisiones de socio único o administrador único. |

### 3.3 Documentación

| Superficie | Archivo | Naturaleza | Propósito |
|---|---|---|---|
| Actas (lista) | `ActasLista.tsx` | Lista | Catálogo de actas; vistas filtradas `?vista=pendientes` y `?vista=certificaciones`. |
| Acta (detalle) | `ActaDetalle.tsx` | Detalle | Ficha de acta con acuerdos vinculados y botón de emisión de certificación (gated por capacidad y autoridad). |
| Comunicaciones | `Comunicaciones.tsx`, `ComunicacionDetalle.tsx` | Lista / Detalle | Comunicaciones y notificaciones certificadas (ERDS). |
| Documentos en revisión | `DocumentosPendientesRevision.tsx` | Lista | Cola de documentos pendientes de revisión legal. |
| Generar documento | `GenerarDocumentoStepper.tsx` | Stepper (5 pasos) | Generación DOCX a partir de plantilla, firma cualificada (QES) y archivo en almacenamiento con SHA-512 y *evidence bundle*. |
| Expediente de acuerdo | `ExpedienteAcuerdo.tsx` | Detalle/timeline | Línea temporal de los 8 estados del acuerdo + *snapshot* de cumplimiento y workflow de aprobación. |

### 3.4 Registro público (tramitación registral)

| Superficie | Archivo | Naturaleza | Propósito |
|---|---|---|---|
| Tramitador (lista) | `TramitadorLista.tsx` | Lista | Expedientes registrales; vistas `?estado=SUBSANACION` y `?estado=PRESENTADA`. |
| Tramitador (alta/detalle) | `TramitadorStepper.tsx` | Stepper / Detalle r/o | `/nuevo` es el alta operativa (5 pasos con motor de reglas); `:id` es detalle de solo lectura de expediente existente. |

### 3.5 Libros y registros sociales

| Superficie | Archivo | Naturaleza | Propósito |
|---|---|---|---|
| Libro de socios | `LibroSocios.tsx` | Registro | Libro registro de socios/accionistas con clases de títulos. |
| Libros obligatorios | `LibrosObligatorios.tsx` | Lista | Libros societarios y alertas de legalización; cada libro enlaza a su registro natural. |
| Calendario ("Procesos") | `Calendario.tsx` | Calendario | Vencimientos consolidados (convocatorias, libros, acuerdos sin sesión, renovación de mandatos), filtrado por rol de usuario. |
| Multi-jurisdicción | `MatrizJurisdiccional.tsx` | Matriz | Matriz de formalización para filiales BR/MX/PT controladas al 100%: ejecución de la decisión del grupo + inscripción local. |

### 3.6 Sociedades y personas (datos maestros)

| Superficie | Archivo | Naturaleza | Propósito |
|---|---|---|---|
| Sociedades (lista/detalle) | `SociedadesList.tsx`, `SociedadDetalle.tsx` | Lista / Ficha | Catálogo de sociedades y ficha societaria. |
| Alta de sociedad | `SociedadNuevaStepper.tsx` | Stepper | Constitución/alta de sociedad con régimen de administración. |
| Altas societarias | `AnadirSocioStepper.tsx`, `TransmisionStepper.tsx`, `DesignarAdminStepper.tsx` | Steppers | Alta de socio, transmisión de participaciones, designación de administrador/cargo. |
| Marco normativo | `ActivarMarcoNormativo.tsx` | Configuración | Activación del marco normativo y reglas efectivas por sociedad (ruta `/secretaria/sociedades/:id/marco-normativo/activar`). **Nota:** la ruta `/secretaria/sociedades/:id/reglas` **redirige** al catálogo de materias (`ReglasToCatalogoMateriasRedirect`, App.tsx:262); el componente `ReglasAplicables.tsx` quedó superseded y no está cableado a ninguna ruta viva. |
| Personas (lista/detalle/alta/import) | `PersonasList.tsx`, `PersonaDetalle.tsx`, `PersonaNuevaStepper.tsx`, `PersonasImportStepper.tsx` | Lista / Ficha / Steppers | Maestro de personas físicas y jurídicas, cargos y consolidación. |
| Representación | `RepresentanteAdminPJStepper.tsx`, `RepresentacionPuntualStepper.tsx` | Steppers | Representante de persona jurídica (PJ→PF) y representación puntual (proxy de junta). |

### 3.7 Configuración y reglas

| Superficie | Archivo | Naturaleza | Propósito |
|---|---|---|---|
| Materias y reglas | `CatalogoMaterias.tsx`, `RuleManagerPage.tsx` | Catálogo | Catálogo de materias societarias y gestor de reglas LSC. |
| Catálogo de órganos | `CatalogoOrganos.tsx` | Catálogo | Tipología de órganos de gobierno. |
| Plantillas (catálogo de uso) | `Plantillas.tsx` | Catálogo público | Listado de plantillas ACTIVA con CTA "Usar esta plantilla". Vista de uso para SECRETARIO. |
| Gestor de plantillas | `GestorPlantillas.tsx` | Consola por pestañas | Consola unificada de administración de plantillas con RBAC por pestaña (ver §5). |

## 4. Modelo RBAC: roles, permisos y capacidades societarias

El control de acceso de Secretaría combina **tres capas independientes** que actúan de forma complementaria:

1. **Roles y permisos RBAC** (qué recursos de datos puede leer/escribir el usuario), resueltos por el hook `useUserRole` (`src/hooks/useUserRole.ts`) contra `rbac_user_roles` ⋈ `rbac_roles`.
2. **Matriz de capacidades societarias** (`capability_matrix`), que decide quién puede ejecutar actos jurídicamente reservados: congelar el censo (SNAPSHOT), emitir voto (VOTE) y certificar (CERTIFICATION), entre otros, con razón jurídica anotada.
3. **Evidencia de autoridad** (`authority_evidence`), que acredita el cargo concreto (Presidente, Secretario) vigente para que la certificación lleve el Vº Bº y la firma de quien tiene la facultad estatutaria/registral.

A ello se suma la **segregación de funciones (SoD)** como capa de prevención de pares de roles incompatibles.

### 4.1 Los cinco roles RBAC y sus permisos

Verificado contra la tabla `rbac_roles` en producción. Los permisos siguen el patrón `recurso:acción`, con comodines `recurso:*` y el comodín total `*`. La resolución de comodines está implementada tanto en `useUserRole.hasPermission` como en `sidebar-visibility.hasPermission`.

| Rol (`role_code`) | Denominación | Naturaleza del permiso | Alcance |
|---|---|---|---|
| **ADMIN_TENANT** | Administrador del Tenant | `["*"]` (comodín total) | Acceso completo a todos los recursos y acciones del tenant. Rol administrativo/soporte. |
| **SECRETARIO** | Secretario del Consejo | Escritura amplia (`agreements:*`, `meetings:*`, `minutes:*`, `certifications:*`, `convocatorias:*`, `registry_filings:*`, `plantillas:*`, `representaciones:*`, `condiciones_persona:*`, capital y clases de títulos `:*`, `censo_snapshot:create/read`) + lecturas (entidades, órganos, personas) | Titular operativo del módulo: gestiona todo el ciclo societario y documental. |
| **COMPLIANCE** | Oficial de Cumplimiento | Escritura sobre dominio de control (`controls:*`, `incidents:*`, `findings:*`, `obligations:*`, `policies:*`, `evidences:*`, `risks:*`) + lecturas societarias (entidades, órganos, censo, capital, representaciones, auditoría) | Supervisión de cumplimiento; solo lectura del dominio societario. |
| **CONSEJERO** | Consejero / Miembro del Órgano | `agreement:vote` + lecturas (acuerdos, certificaciones, convocatorias, reuniones, actas, censo, capital, personas, órganos) | Miembro del órgano: vota, pero no administra el expediente. |
| **AUDITOR** | Auditor | Solo lecturas (`*:read` sobre todo el dominio: agreements, audit, capital, censo, certificaciones, condiciones, controles, convocatorias, entidades, evidencias, findings, órganos, reuniones, actas, obligaciones, personas, políticas, riesgos, etc.) | Acceso de auditoría estrictamente de solo lectura. |

### 4.2 Matriz de capacidades societarias (`capability_matrix`)

Tabla `capability_matrix` (columnas reales: `role`, `action`, `enabled`, `reason`). Contiene 35 filas: 5 roles × 7 acciones. Las acciones cubren no solo las tres acciones nucleares del pipeline (congelar censo, votar, certificar) sino también gestión de cargos, personas y representaciones. El hook `usePresidenteVigente`/`useAuthorityEvidence` y los CTA del sidebar (`requiresCapability: canSnapshot | canVote | canCertify`) consumen esta matriz. Estado verificado en producción:

| Acción | ADMIN_TENANT | SECRETARIO | CONSEJERO | COMPLIANCE | AUDITOR |
|---|:---:|:---:|:---:|:---:|:---:|
| **SNAPSHOT_CREATION** (congelar censo WORM) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **VOTE_EMISSION** (emitir voto) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **CERTIFICATION** (certificar acuerdos) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CARGO_MANAGEMENT** (alta/cese de cargos) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **PERSON_WRITE** (mantenimiento de personas) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **PERSON_CONSOLIDATE** (consolidar duplicados) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **REPRESENTATION_MANAGEMENT** (representaciones) | ✅ | ✅ | ❌ | ❌ | ❌ |

Razones jurídicas anotadas en `capability_matrix.reason` para las tres acciones nucleares:

| Rol × Acción | Estado | Razón jurídica anotada |
|---|---|---|
| SECRETARIO × SNAPSHOT_CREATION | Habilitado | "Titular de la ordenación de la sesión (art. 106 RRM)." |
| SECRETARIO × CERTIFICATION | Habilitado | "Facultad certificante (art. 109 RRM)." |
| SECRETARIO × VOTE_EMISSION | Habilitado | "Secretario consejero vota si tiene condición CONSEJERO vigente." |
| CONSEJERO × VOTE_EMISSION | Habilitado | "Facultad natural del consejero." |
| CONSEJERO × SNAPSHOT_CREATION | Deshabilitado | "El consejero no congela el censo; lo hace el Secretario." |
| CONSEJERO × CERTIFICATION | Deshabilitado | "No certifica salvo que ostente cargo de Secretario." |
| ADMIN_TENANT × CERTIFICATION | Habilitado | "Rol administrativo excepcional." |
| ADMIN_TENANT × SNAPSHOT_CREATION | Habilitado | "Rol administrativo del tenant." |
| ADMIN_TENANT × VOTE_EMISSION | Habilitado | "Para operativa excepcional." |
| COMPLIANCE × (todas) | Deshabilitado | "Compliance supervisa; no modifica..." |
| AUDITOR × (todas) | Deshabilitado | "Auditor audita; no modifica..." (varias con `reason` nula en las nucleares) |

Lectura jurídica: la facultad de **certificar** y de **congelar el censo** queda reservada a Secretario y Administrador del tenant; el **voto** lo emiten Secretario (si tiene condición de consejero vigente), Consejero y Administrador del tenant; Compliance y Auditor quedan estrictamente excluidos de toda acción de escritura societaria, coherente con sus funciones de supervisión y auditoría.

### 4.3 Evidencia de autoridad (`authority_evidence`) — Vº Bº y certificación

`authority_evidence` acredita el **cargo concreto vigente** de una persona en un órgano, dato necesario para emitir una certificación con la firma del facultado y el Vº Bº del Presidente (en SA). El hook `useAuthorityEvidence`/`usePresidenteVigente` (`src/hooks/useAuthorityEvidence.ts`) consulta filas con `estado = 'VIGENTE'`. Cargos certificantes admitidos: ADMIN_UNICO, ADMIN_SOLIDARIO, ADMIN_MANCOMUNADO, PRESIDENTE, VICEPRESIDENTE, SECRETARIO, VICESECRETARIO.

Nota jurídica embebida en el código (decisión legal L15-L16): el cargo `CONSEJERO_COORDINADOR` fue eliminado como certificante (2026-05-12) porque el art. 109 RRM reserva la facultad certificante al Secretario con Vº Bº del Presidente; el trigger `fn_sync_authority_evidence` ya no genera evidencia de autoridad para ese cargo.

Estado verificado en producción para ARGA Seguros S.A. (`6d7ed736-...`), evidencia VIGENTE por órgano:

- **Secretario único transversal:** Dña. Lucía Paredes Vega figura como SECRETARIO VIGENTE en los **12 órganos de gobierno** de la sociedad (verificado contra `governing_bodies`: Consejo de Administración, Junta General de Accionistas, Comité Ejecutivo, Comité de Riesgos, Comité de Cumplimiento, Comité de Dirección, CATIT, Comisión de Auditoría y Cumplimiento Normativo, Comisión de Nombramientos, Comisión de Retribuciones, Comisión de Sostenibilidad, Comisión de Riesgos Regulada). Es la firmante certificante.
- **Presidente del Consejo y de la Junta:** D. Antonio Ríos Valverde como PRESIDENTE VIGENTE del Consejo de Administración (CDA) y de la Junta General de Accionistas — aporta el Vº Bº de la certificación.
- **Presidentes de comisiones/comités:** cada comisión y comité tiene su propio PRESIDENTE VIGENTE (p. ej. Dña. Carmen Delgado Ortiz en el Comité Ejecutivo, D. Ricardo Vega Sanz en Nombramientos, Dña. Isabel Moreno Castro en Retribuciones, Dña. María Santos Gil en Riesgos Regulada, D. Pablo Navarro Iglesias en el Comité de Riesgos, etc.).
- **Trazabilidad registral:** la evidencia del CDA referencia la inscripción `RM-DEMO-ARGA-CDA-2026`; el resto de órganos `RM-DEMO-ARGA-GOLDEN-2026`. Fuente de designación `BOOTSTRAP` (seed demo).

Con índice único parcial por órgano hay un único PRESIDENTE VIGENTE por *body*, lo que garantiza que `usePresidenteVigente` resuelva el Vº Bº sin ambigüedad. La consulta de lookup (`useAuthorityEvidenceFor`) valida que el firmante propuesto tenga evidencia de autoridad vigente del cargo certificante antes de emitir.

### 4.4 Segregación de funciones (SoD — `sod_toxic_pairs`)

La segregación de funciones se evalúa con el componente `src/components/SodGuard.tsx`, que invoca la RPC `fn_check_sod_violations(p_tenant_id, p_user_id, p_proposed_role)` antes de asignar un rol a un usuario, y renderiza el resultado con dos severidades: **BLOCK** (bloqueo, rojo) y **WARN** (advertencia). Pares incompatibles verificados en `sod_toxic_pairs`:

| Rol A | Rol B | Severidad | Razón jurídica |
|---|---|---|---|
| ADMIN_TENANT | AUDITOR | **BLOCK** | "El administrador no puede auditar la configuración que él mismo gestiona" |
| SECRETARIO | AUDITOR | **BLOCK** | "El secretario no puede auditar sus propios actos societarios" |
| SECRETARIO | COMPLIANCE | WARN | "El secretario y compliance deben ser personas distintas para garantizar independencia del control" |
| CONSEJERO | COMPLIANCE | WARN | "Un consejero no debe ser oficial de cumplimiento — conflicto de supervisión" |

Los pares marcados **BLOCK** impiden la asignación; los marcados **WARN** la permiten pero la señalan como deuda de control. La lógica de fondo refuerza el principio de independencia entre quien ejecuta los actos societarios (Secretario), quien los supervisa (Compliance) y quien los audita (Auditor).

## 5. RBAC granular de la consola "Gestor de plantillas"

La consola unificada de plantillas (`GestorPlantillas.tsx`, ruta `/secretaria/gestor-plantillas`) implementa un control de acceso **por pestaña** mediante `useTabAccess` (`src/components/secretaria/gestor/tab-guards.ts`), independiente del RBAC general del sidebar. Las pestañas se seleccionan por *query param* `?tab=`.

| Pestaña (`TabId`) | Etiqueta | Naturaleza | Roles con acceso |
|---|---|---|---|
| `dashboard` | Dashboard | Lectura | SECRETARIO / COMPLIANCE / ADMIN_TENANT |
| `catalogo` | Catálogo | Lectura | SECRETARIO / COMPLIANCE / ADMIN_TENANT |
| `cobertura` | Cobertura legal | Lectura (matriz materia × jurisdicción) | SECRETARIO / COMPLIANCE / ADMIN_TENANT |
| `metricas` | Métricas | Lectura | SECRETARIO / COMPLIANCE / ADMIN_TENANT |
| `auditoria` | Auditoría | Lectura | SECRETARIO / COMPLIANCE / ADMIN_TENANT |
| `importar` | Importar | **Escritura** (wizard JSON de alta de plantillas) | **ADMIN_TENANT** |
| `validacion` | Validación | **Escritura** (Gate PRE estructural/semántico) | **ADMIN_TENANT** |
| `configuracion` | Configuración | **Escritura** | **ADMIN_TENANT** |

Lógica de `tab-guards.ts`: `READ_ROLES = [SECRETARIO, COMPLIANCE, ADMIN_TENANT]`, `WRITE_ROLES = [ADMIN_TENANT]`. `visibleTabs` calcula las pestañas accesibles para el rol actual y solo esas se pintan en la barra de navegación. Si un usuario sin permiso solicita una pestaña por URL directa, `GestorPlantillas.tsx` lo **redirige a `dashboard`** (con `replace`) y muestra un **toast de advertencia**: «Sin permisos para "{etiqueta}"; redirigido a Dashboard».

## 6. Realidad de la demo

El usuario demo (`demo@arga-seguros.com`, `user_id 85e24c66-...`) tiene asignado el rol **SECRETARIO** (verificado en `rbac_user_roles`). Consecuencias prácticas:

- Las pestañas **Importar**, **Validación** y **Configuración** del Gestor de plantillas quedan **ocultas del menú** (filtradas en `visibleTabs`), porque exigen ADMIN_TENANT. El acceso por URL directa redirige a Dashboard con toast.
- El usuario demo **sí puede** congelar el censo (SNAPSHOT), votar (si tiene condición de consejero vigente), certificar acuerdos y gestionar cargos/personas/representaciones, conforme a la `capability_matrix` para SECRETARIO.
- La certificación se firma con la evidencia de autoridad del Secretario vigente (Dña. Lucía Paredes Vega) y el Vº Bº del Presidente (D. Antonio Ríos Valverde) en el órgano correspondiente.

Para escenarios que requieran probar las superficies de escritura administrativa del Gestor de plantillas se debe usar un usuario con rol ADMIN_TENANT (en producción existen `00000000-...-099` y `juana.maria.pardo@garrigues.com`). El tenant demo dispone además de usuarios sembrados con roles COMPLIANCE (`...-109`) y CONSEJERO (`...-104`) para validar las restricciones de lectura/voto descritas.

Trazabilidad de fuentes: `src/components/secretaria/shell/navigation.ts`, `src/lib/secretaria/sidebar-visibility.ts`, `src/components/secretaria/shell/ScopeSwitcher.tsx`, `src/hooks/useUserRole.ts`, `src/hooks/useAuthorityEvidence.ts`, `src/components/SodGuard.tsx`, `src/components/secretaria/gestor/tab-guards.ts`, `src/pages/secretaria/GestorPlantillas.tsx`; tablas Cloud `rbac_roles`, `rbac_user_roles`, `capability_matrix`, `sod_toxic_pairs`, `authority_evidence`; RPC `fn_check_sod_violations`.

---

# Anexo A — Tabla maestra de procedimientos almacenados (RPC)

Consolidación única de los procedimientos almacenados (funciones PL/pgSQL) y disparadores (*triggers*) que sostienen el pipeline societario, con su firma, semántica de seguridad y control jurídico que implementan. Todos verificados en `governance_OS`. *Definer* indica `SECURITY DEFINER` (se ejecuta con privilegios del propietario); `REVOKE EXECUTE` indica que se ha retirado el permiso de ejecución al rol `authenticated`.

## A.1 Pipeline de actas y certificaciones

| RPC | Firma (resumen) | Seguridad | Control jurídico implementado |
|---|---|---|---|
| `fn_generar_acta` | `(p_meeting_id, p_content, p_snapshot_id) → uuid` | — | Genera el acta, calcula `content_hash` y vincula el `snapshot_id` (censo WORM). Base del libro de actas (art. 202 LSC). |
| `fn_aprobar_acta` | `(p_minute_id, …)` | — | Ciclo de aprobación del acta (estado → aprobada/firmada). |
| `fn_acta_book_kind_for_body` | `(p_body_id) → text` | — | Resuelve el subtipo de libro de actas según el tipo de órgano (Junta / CdA / comisión). |
| `fn_generar_certificacion` | `(p_minute_id, p_tipo, p_agreements_certified[], p_certificante_role, p_visto_bueno_persona_id) → uuid` | — | Crea la certificación con `gate_hash = SHA-256(snapshot_hash ‖ canonical_minutes_hash ‖ resultado_hash)`. **Exige acta firmada (RRM 109.4) y Vº Bº del Presidente vigente (RRM 109.1.a)**; valida la autoridad del certificante contra `authority_evidence` VIGENTE. |
| `fn_firmar_certificacion` | `(p_certification_id, p_qtsp_token, p_tsq_token)` | — | Firma QES + sello de tiempo; calcula `hash_certificacion = SHA-256(gate_hash ‖ content ‖ tsq_token)`; exige TSQ no nulo; `signature_status → SIGNED`. |
| `fn_emitir_certificacion` | `(p_certification_id) → text` | — | Rechaza si no está `SIGNED`; sintetiza URI del *bundle*; **promueve los acuerdos certificados de `ADOPTED` a `CERTIFIED`**; inscribe evento `CERT_EMITIDA` en `audit_log`. |
| `fn_generar_certificacion_acuerdo_sin_sesion` | `(…)` | — | Certifica acuerdos adoptados sin sesión. |

## A.2 Reuniones y acuerdos sin sesión

| RPC | Firma (resumen) | Seguridad | Control jurídico implementado |
|---|---|---|---|
| `fn_save_meeting_resolutions` | `(p_meeting_id, …)` | **Valida pertenencia a la reunión** | Persiste las resoluciones de la sesión solo si pertenecen a la reunión indicada (cierra escritura cruzada). |
| `fn_no_session_cast_response` | `(p_resolution_id, p_member, p_vote, …)` | — | Registra el voto por escrito de un miembro en un acuerdo sin sesión. |
| `fn_no_session_close_and_materialize_agreement` | `(p_resolution_id) → uuid` | — | Cierra la votación por escrito y materializa el acuerdo `ADOPTED` (art. 100 RRM / 248.2 LSC). |
| `fn_cerrar_votaciones_vencidas` | `(p_tenant_id) → int` | **Definer** | Auto-cierre de las votaciones `VOTING_OPEN` vencidas; devuelve el número de cierres. |
| `fn_create_communication_atomic` | `(…)` | — | Crea de forma atómica la comunicación (canal ERDS) asociada a una convocatoria/acuerdo. |

## A.3 Libros, RBAC, autoridad y segregación

| RPC | Firma (resumen) | Seguridad | Control jurídico implementado |
|---|---|---|---|
| `fn_upsert_mandatory_book_v2` | `(…)` | **`REVOKE EXECUTE` a `authenticated`** | *Upsert* de libros obligatorios reservado a orquestación de confianza (no ejecutable por el usuario autenticado). |
| `fn_check_sod_violations` | `(p_tenant_id, p_user_id, p_proposed_role) → set` | — | Evalúa los pares tóxicos de segregación de funciones antes de asignar un rol (devuelve BLOCK/WARN). |
| `fn_sync_authority_evidence` | `trigger` | — | Sincroniza la evidencia de autoridad (cargos certificantes); **ya no genera evidencia para `CONSEJERO_COORDINADOR`** (decisión L15-L16, art. 109 RRM). |

## A.4 Evidencia, auditoría WORM e inmutabilidad del censo

| Objeto | Tipo | Seguridad | Función |
|---|---|---|---|
| `fn_audit_worm` | *trigger* INSERT/UPDATE/DELETE | **Definer** | Cadena de hash `hash_sha512 = SHA-512(prev_hash|'GENESIS' ‖ acción ‖ tabla ‖ record_id ‖ payload)`; *append-only* tipo cadena de bloques. |
| `fn_verify_audit_chain` | `(p_tenant_id) → TABLE(total_entries, chain_valid, first_entry_at, last_entry_at)` | — | Recalcula la cadena y detecta cualquier manipulación (devuelve `chain_valid = false` a la primera divergencia). |
| `fn_create_governance_evidence_bundle` | `(p_tenant_id, p_source_object_id, …)` | **Definer · tenant-assert** | Crea el *evidence bundle* con `manifest_hash`/`hash_sha512` y cadena de custodia. **Hardening** `harden_create_governance_evidence_bundle_tenant_assert` (head Cloud `20260606165443`): si el llamante no es `service_role`, exige `tenant` del *caller* = `p_tenant_id` o lanza `42501` (cierra forja cross-tenant). |
| `fn_current_tenant_id` / `fn_assert_current_tenant_id` / `fn_secretaria_is_service_role` | helpers | — | Resolución y aserción del tenant del *caller* y del rol de servicio (lógica de tres valores *fail-closed*). |
| `trg_censo_snapshot_worm` | *trigger* BEFORE INSERT | — | Rellena `audit_worm_id` (ancla el snapshot a la cadena WORM). |
| `trg_block_censo_snapshot_update` / `trg_block_censo_snapshot_delete` | *triggers* BEFORE UPDATE/DELETE | — | Bloquean con excepción cualquier modificación o borrado del censo (inmutabilidad). |

---

# Anexo B — Máquinas de estado por dominio (con volúmenes reales)

Estados de cada entidad del módulo, con su etiqueta en castellano (`status-labels.ts` cuando aplica) y el volumen real en `governance_OS` (tenant demo) a 13-06-2026. Es la referencia única para reconciliar nomenclatura de estados.

| Dominio (tabla) | Máquina de estados | Volúmenes Cloud |
|---|---|---|
| **Acuerdo** (`agreements`) | `DRAFT` Borrador → `PROPOSED` Propuesto → `ADOPTED` Adoptado → `CERTIFIED` Certificado → `INSTRUMENTED` Instrumentado → `FILED` Preparado para registro → `REGISTERED` Inscrito → `PUBLISHED` Publicado · (rama terminal) `REJECTED_REGISTRY` Rechazado por el RM | 145 total: DRAFT 101 · PROPOSED 4 · ADOPTED 25 · CERTIFIED 13 · INSTRUMENTED 1 · FILED 1 |
| **Reunión** (`meetings`) | `PROGRAMADA` → `CONVOCADA` → `EN_CURSO` → `CELEBRADA` · `CANCELADA` | CONVOCADA 8 · CELEBRADA 16 |
| **Expediente registral** (`registry_filings`) | `PREPARADA` → `PRESENTADA` → `EN_TRAMITE` → `SUBSANACION` → `INSCRITA` · `ELEVADA` (a público) · `DENEGADA`. Alias legacy r/o: `SUBMITTED`/`INSCRIBED`/`ELEVATED` | PREPARADA 2 · INSCRITA 2 · DENEGADA 1 · ELEVADA 1 (golden path sembrado W2, 2026-06-13) |
| **Acuerdo sin sesión** (`no_session_resolutions`) | `BORRADOR` → `VOTING_OPEN` Votación abierta → `APROBADO` · `RECHAZADO` | APROBADO 4 · RECHAZADO 6 |
| **Decisión unipersonal** (`unipersonal_decisions`) | `BORRADOR` → `FIRMADA` | BORRADOR 11 · FIRMADA 5 |
| **Certificación** (`certifications`) | `signature_status`: `PENDING` → `SIGNED` | SIGNED 7 |
| **Acta** (`minutes`) | Borrador → aprobada (`signed_at`) → firmada/bloqueada (`is_locked`) → registrada (`registered_at`) | (derivado de banderas) |
| **Plantilla** (`plantillas_protegidas`) | `BORRADOR` → `REVISADA` → `APROBADA` → `ACTIVA` → `ARCHIVADA` (terminal) · `DEPRECADA` → `ARCHIVADA` | ACTIVA 75 · ARCHIVADA 35 |
| **Comunicación** (`communications`) | `ENVIANDO` → `ENTREGADA_*` → `RESPONDIDA_*` · `EXPIRADA` | (operativa ERDS) |
| **Libro/registro** (`mandatory_books`) | `legalization_status`: `PENDIENTE` → `PRESENTADO` → `LEGALIZADO` · `RECHAZADO` | 552 filas · 252 legalizables · 250 PENDIENTE · 2 LEGALIZADO |
| **Evidence bundle** (`evidence_bundles`) | `status` (CHECK): `OPEN` → `SEALED` → `VERIFIED` | (gate sandbox degrada a `OPEN`) |

---

# Anexo C — Advertencias de alcance, limitaciones y deuda conocida

Para una lectura jurídica honesta del prototipo, el equipo legal debe conocer las siguientes limitaciones y decisiones de alcance. Ninguna es un defecto silencioso: todas son deuda intencional documentada o frontera explícita del prototipo.

1. **Evidencia probatoria no productiva.** Ver el recuadro de la portada. La firma QES/QSeal/TSQ/ERDS opera en *stub*/sandbox; el QTSP real EAD Trust requiere proxy servidor; el *backbone* de evidencia está `pending` y la migración `000049` en HOLD. No presentar ningún artefacto como evidencia cualificada emitida.

2. **El modelo canónico es ya la fuente operativa; `mandates` solo sobrevive como vista de compatibilidad.** *(Corregido en rev. 1.1 — ver Parte III.3.)* Verificado en Cloud el 2026-06-13: `mandates` es una **VIEW** de solo lectura (`relkind = 'v'`), no una tabla; ningún código de producción la consulta (solo un test) y el censo se construye desde el modelo canónico (`condiciones_persona` + `fn_crear_censo_snapshot`) alimentando al motor puro. La afirmación previa de esta guía y de CLAUDE.md de que `mandates` «sigue siendo tabla (Fase 0+1)» y de que el motor «aún no lee exclusivamente de `censo_snapshot`» **está desfasada**: la retirada de `mandates` (la "Fase 5" del plan canónico) está efectivamente alcanzada. Subsiste como deuda **de calidad de datos** (no de arquitectura) la limpieza de variantes legacy y artefactos de test y la segregación `data_class` (ver Parte III, G3d).

3. **El "camino feliz" registral no llega a inscripción real en la demo.** `registry_filings` no tiene ningún expediente en estado terminal `INSCRITA` ni `DENEGADA`; el golden path demostrativo se detiene antes de la inscripción registral efectiva. Es una limitación de datos demo, relevante antes de enseñar el cierre del ciclo a un cliente.

4. **Cobertura jurídica íntegramente española.** Los 57 *rule packs* y las 110 plantillas son **100 % `ES`**. Portugal es *preview* de *overrides*; Brasil y México son post-GA. La pantalla de multi-jurisdicción es una herramienta de **formalización local** (ejecución de la decisión del grupo español + inscripción en la filial), **no** un motor de reglas extranjero: no valida quórum/mayorías de filial (irrelevante por socio/accionista único), no integra con JUCESP/IRN/RPC, ni gestiona autorizaciones SUSEP/CNSF/BdP (las gestiona el departamento legal).

5. **Comisión de Riesgos Regulada ≠ Comité de Riesgos.** ARGA tiene ambos órganos, que son figuras distintas: la **Comisión de Riesgos Regulada** es órgano societario-estatutario (art. 529 *quindecies* LSC para cotizadas, reforzado por la Ley 20/2015 para aseguradoras), mientras que el **Comité de Riesgos** es un comité interno de gestión. Tienen base legal y valor jurídico diferentes aunque el módulo los gestione en paralelo.

6. **Rol RBAC ≠ cargo societario.** Los cinco roles RBAC (`ADMIN_TENANT`, `SECRETARIO`, `CONSEJERO`, `COMPLIANCE`, `AUDITOR`) **no incluyen** "Presidente" ni "Consejero Coordinador" como roles de permisos: el cargo societario se modela en `condiciones_persona` / `authority_evidence`, no en RBAC. El cargo `CONSEJERO_COORDINADOR` fue **eliminado como certificante** (art. 109 RRM reserva la facultad al Secretario con Vº Bº del Presidente).

7. **Conflictos de interés: no son expediente propio de Secretaría.** El conflicto de interés (arts. 190.2 / 228-230 LSC) se computa **dentro del flujo de votación** (Gate 1, ajuste del denominador), no como expediente independiente del módulo. La gestión de riesgos de conflicto es *ownership* del módulo GRC; Secretaría solo aplica el ajuste de cómputo.

8. **Incongruencia intencional "Procesos" / Calendario.** El elemento de menú rotulado "Procesos" navega a `/secretaria/calendario` con icono `Calendar` (página `Calendario.tsx`). Es deuda de diseño conocida, pendiente de reconciliación; para automatización usar el selector estable `[data-sidebar-item="Procesos"]`. Asimismo, el rótulo de sección "Registro público" sustituye a la denominación interna previa "REGISTRO" para evitar colisión semántica con el Registro Mercantil (cuya función vive en el "Tramitador registral").

9. **`capability_matrix`: anotación jurídica parcial.** La razón jurídica está anotada de forma completa solo en las tres acciones del pipeline certificante (`SNAPSHOT_CREATION`, `VOTE_EMISSION`, `CERTIFICATION`); las cuatro acciones de gestión de datos maestros (`CARGO_MANAGEMENT`, `PERSON_WRITE`, `PERSON_CONSOLIDATE`, `REPRESENTATION_MANAGEMENT`) tienen anotación parcial.

10. **Datos demo incompletos en categorías de consejero.** Algunas categorías de consejero (independiente/ejecutivo/dominical) están parcialmente vacías en `condiciones_persona.metadata`. Las entidades `PHASE-B*`, `Arga test A`, `PRUEBA`, `SEGUROS TEST` son artefactos de pruebas E2E, no estructura societaria real.

11. **Origen del pacto parasocial demo.** Las tres cláusulas VIGENTES proceden del *seed* `PACTO_FUNDACION_ARGA_2024` (migración `000018`): VETO en operaciones estructurales (>15 % patrimonio neto), MAYORIA_REFORZADA_PACTADA (75 %) en operaciones vinculadas, y CONSENTIMIENTO_INVERSOR (capital mínimo 50 %) en dilución.

12. **`tipo_social` en plantillas: presente pero no discriminado.** La columna `tipo_social` existe en `plantillas_protegidas` pero está NULL en las 110 plantillas; la clave funcional fija hoy `tipoSocial: null`. La diferenciación SA/SL **se aplica en el motor de reglas en el momento de uso**, no mediante plantillas distintas por forma social.

13. **Doble grafía y alias de materia.** Varias materias coexisten con dos códigos (p. ej. `MOD_ESTATUTOS` ↔ `MODIFICACION_ESTATUTOS`), reconciliados por `MATERIA_PACK_ALIASES` en *runtime*. La retirada física del pack legacy `MOD_ESTATUTOS` está pendiente (bloqueada por el guardrail de operaciones destructivas), sin impacto funcional. Solo se alían grafías de la **misma** materia jurídica; materias distintas nunca se confunden.

---

*Documento generado a partir de extracción verificada de código fuente y de la base de datos `governance_OS` el 13 de junio de 2026. Las cifras reflejan el estado del tenant demo en esa fecha y pueden evolucionar con el prototipo.*


---

# Parte II — Primera pasada de test: incidencias de generación documental y plan de saneamiento

La primera pasada de test sobre el prototipo detectó incidencias en la **generación de documentos** que ningún informe de evolutivo recogía y que tienen prioridad operativa, porque afectan a lo que se demuestra del ciclo societario. Las dos reportadas expresamente fueron: **(a) no se guardan las ediciones de actas como borrador ni como definitivas**, y **(b) no se genera el texto final de las convocatorias**. Esta parte documenta la causa raíz —verificada en código y contra Cloud el 2026-06-13—, extiende el diagnóstico a **todos** los flujos de generación documental, y propone el plan de saneamiento (frente **W0** de la Parte IV).

## II.1. Diagnóstico raíz: dos rutas de generación con persistencia divergente

El módulo tiene **dos rutas de producción documental que conviven y no comparten persistencia**:

- **Ruta A — texto canónico embebido.** El cuerpo del documento se construye en el propio flujo (stepper o RPC) y se persiste en una columna de texto de la tabla de dominio: `convocatorias.convocatoria_text`, `minutes.content`, `unipersonal_decisions.content`, `no_session_resolutions.proposal_text`. Se escribe **una sola vez, en el momento de creación, y queda congelado**.
- **Ruta B — DOCX + evidencia.** `ProcessDocxButton` y `GenerarDocumentoStepper` componen un DOCX con el pipeline `motor-plantillas` → `doc-gen` (render Handlebars + resolver de variables + generador DOCX + archivador SHA-512), lo descargan y lo archivan como `evidence_bundles`. Pero la función de persistencia `persistProcessArchiveLink` (`src/lib/doc-gen/process-documents.ts:787-815`) **solo escribe `agreements.document_url` / `certifications.evidence_id`**; **nunca reescribe la columna de texto de dominio**. El texto editado en el modal de la Ruta B sobrevive únicamente en la tabla paralela `secretaria_document_drafts`, que **la mayoría de páginas de detalle no leen**.

**Consecuencia:** existe una **divergencia silenciosa** entre lo que muestra la página de detalle (columna de dominio, Ruta A) y lo que se archiva como DOCX/evidencia (Ruta B). Cuando el usuario edita el cuerpo de un documento desde el modal y "guarda", el cambio va a `secretaria_document_drafts` y **no vuelve** al dominio; la página de detalle sigue mostrando el texto original, por lo que **percibe que "no se ha guardado"**.

**Evidencia cuantitativa (Cloud, tenant demo):** de **145 `agreements` solo 5** tienen `document_url`; existen **7 `evidence_bundles`** de Secretaría (6 de `GenerarDocumentoStepper`, 1 de `ProcessDocxButton`) y **7 filas** en `secretaria_document_drafts`. Es decir, la Ruta B *end-to-end* se ejerce muy poco; el texto operativo real vive en las columnas de dominio que la Ruta B no actualiza.

## II.2. Incidencia 1 — Actas: no se guardan ediciones en borrador ni el paso a definitiva

**Severidad: Alta** (bloquea la expectativa "editar y guardar el acta").

**Causa raíz.** El síntoma es correcto pero su causa es más profunda de lo que parece: **no existe ningún editor del contenido del acta en la interfaz**. `ActaDetalle.tsx` renderiza el "Contenido del acta" en un `<pre>` **de solo lectura** (`ActaDetalle.tsx:557-600`); no hay `<textarea>`, ni estado de edición, ni botón "Guardar borrador". Búsqueda exhaustiva confirmada: **no hay ninguna mutación `.update()`/`.insert()` sobre `minutes` en todo el producto** — todas las referencias son `.select()`; no existe un hook `useUpdateActa`. El único alta de acta es vía la RPC `fn_generar_acta` (INSERT, sin UPSERT).

- El acta **nace con el contenido congelado por el motor** (`buildActaContent` en el Cierre de la reunión) y solo puede **firmarse**: `AprobarActaButton` → `useAprobarActa` → RPC `fn_aprobar_acta`, que fija `signed_at` + `is_locked = true`. **Esto sí persiste** (verificado en Cloud: actas firmadas hoy con `signed_at` e `is_locked=true`). Lo que el tester llama "definitiva" es este paso a **firmada/cerrada**, y funciona.
- Tras la firma, el trigger `trg_minutes_lock_guard` hace el acta **inmutable** (correcto, art. 202 LSC / RRM 108-109). Pero **tampoco hay edición en la fase previa de borrador** (`is_locked=false`), porque el escritor de `minutes.content` nunca se implementó.
- La tabla `minutes` **no tiene columna `status`**: el estado es implícito (`signed_at` NULL → "Borrador"; con `signed_at` → "Firmada"). **No existe un estado intermedio "definitiva/aprobada" editable** como el que el tester esperaba.
- El único punto donde el usuario puede editar el cuerpo es el modal de la Ruta B (`ProcessDocxButton` kind ACTA), pero ese cambio va a `secretaria_document_drafts` y **no regraba `minutes.content`** — de ahí la sensación de "no se guarda".

**Dirección de fix (W0).** (1) Añadir en `ActaDetalle` un editor del contenido **solo cuando `is_locked=false`** con botón "Guardar borrador", respaldado por una RPC nueva `fn_actualizar_borrador_acta` (SECURITY DEFINER, con *assert* de tenant, recomputación de `content_hash`, y rechazo si `is_locked`/`signed_at`); el `trg_minutes_lock_guard` ya protege el caso firmado. (2) Reconciliar la divergencia draft ↔ `minutes.content` (decidir fuente de verdad única). (3) Alinear el vocabulario UI: "definitiva" = firmada/cerrada; si se quiere un estado "definitiva no firmada", requiere columna `status` (mayor alcance).

## II.3. Incidencia 2 — Convocatorias: el texto final no aparece

**Severidad: Media** (el *golden path* funciona; el fallo está en caminos-borde, datos legacy y expectativa de UX).

**Causa raíz.** Contra lo reportado, el pipeline **sí renderiza y persiste** el texto final de la convocatoria: el Paso 7 auto-selecciona la plantilla ACTIVA por régimen (DL-4), la renderiza con Handlebars (`ConvocatoriasStepper.tsx:1711-1729`), la muestra en un textarea editable (`:3938`) y al emitir la persiste en `convocatorias.convocatoria_text` (`:2182` → `useConvocatorias.ts:258`); `ConvocatoriaDetalle` la usa como cuerpo del DOCX. **Verificado en Cloud:** convocatorias emitidas tras el *rework* tienen texto (2.230 / 1.446 / 229 caracteres). **No es un fallo del motor documental.**

El reporte de QA es atribuible a **tres caminos legítimos a "texto vacío"**, todos de diseño/datos, no de motor:
1. **Avanzar el Paso 7 antes de que termine el render asíncrono** (o no entrar en el Paso 7): `borradorTexto` queda vacío y el Paso 8 muestra "No hay texto de convocatoria preparado en el Paso 7".
2. **Órgano/jurisdicción sin plantilla candidata** (p. ej. filial PT/MX/BR u `organo_tipo` no soportado): no hay plantilla y el usuario debe escribir el texto a mano. Para la SA demo (ARGA, ES, CdA/Junta) sí hay plantilla.
3. **Confundir "texto final" con un DOCX descargable**: el Paso 8 emite **texto** (lo persiste); el **DOCX se genera on-demand desde el detalle** (`ProcessDocxButton`), no al emitir. Si QA esperaba un archivo al emitir, percibiría "no se genera el documento".

Además, **la mayoría de convocatorias *seed* (anteriores al *rework*) tienen `convocatoria_text` NULL** (solo ~6 de las existentes tienen texto): si QA abrió una convocatoria legacy, vería el *fallback* mínimo o vacío.

**Dirección de fix (W0).** (1) Disparar `regenerateBorrador()` también **al entrar al Paso 8** si el texto está vacío y hay plantilla efectiva (cubre el salto rápido 6→7→8). (2) Añadir un botón "Generar ahora" en el aviso de texto ausente. (3) *Backfill* o marcado explícito de las convocatorias legacy con `convocatoria_text` NULL. (4) Clarificar en UX que emitir produce texto y el DOCX se descarga desde el detalle. (5) **Para la próxima pasada de QA:** registrar la sociedad/órgano exactos, si se entró al Paso 7 y se esperó al render, y si lo esperado era texto en pantalla o un DOCX descargable.

## II.4. Mapa de estado de todos los flujos de generación documental

| # | Flujo | ¿Genera texto? | ¿Persiste dónde? | Estado | Nota |
|---|---|---|---|---|---|
| 1 | **Convocatoria** (`ConvocatoriasStepper`) | Sí (render Handlebars) | `convocatorias.convocatoria_text` | **COMPLETO** | Sano; pero pocas filas tienen texto (seeds legacy sin pasar por el stepper) |
| 2 | **Reunión → Acta** (`ReunionStepper` Cierre) | Sí (`buildActaContent` + `fn_generar_acta`) | `minutes.content` (WORM + snapshot) | **COMPLETO** (generación) / **ROTO** (edición posterior) | Sin editor in-page; ver II.2 |
| 2b | **Acta DOCX** (`ProcessDocxButton` ACTA) | Sí (recompone, modal editable) | `secretaria_document_drafts` + `evidence_bundles` | **PARCIAL** | El draft/DOCX **no** reescribe `minutes.content` → divergencia |
| 3 | **Certificación** (`EmitirCertificacionButton`) | **No** (RPC inserta `content = NULL`) | `certifications` (metadatos + firma) | **PARCIAL** | `fn_generar_certificacion` no compone texto; solo **2/7** con `content`; el cuerpo solo existe como DOCX efímero |
| 4 | **Acuerdo sin sesión** | Propuesta sí; documento por Ruta B | `no_session_resolutions.proposal_text` + (DOCX→`document_url`) | **PARCIAL** | El DOCX final no regraba `proposal_text` |
| 5a | **Co-aprobación** (`CoAprobacionStepper`) | Solo `proposal_text` | `no_session_resolutions.proposal_text` | **PARCIAL** (delega) | "Generar documento →" navega a `GenerarDocumentoStepper` |
| 5b | **Solidario** (`SolidarioStepper`) | Solo `proposal_text` | `no_session_resolutions.proposal_text` | **PARCIAL** (delega) | Igual que co-aprobación |
| 6 | **Decisión unipersonal** (paso "Registro y documento") | Texto sí; **el paso no genera DOCX** | `unipersonal_decisions.content` | **PARCIAL** | El paso promete más de lo que hace; DOCX se genera luego en el detalle |
| 7 | **Generación documental general** (`GenerarDocumentoStepper`) | Sí (pipeline completo + QES) | `agreements.document_url` + `evidence_bundles` (SHA-512) + draft | **COMPLETO** | Único flujo *end-to-end*; origen de 6 de los 7 bundles |
| 8 | **Board Pack** (`BoardPack`) | Render HTML en pantalla; **no genera PDF real** | Nada (URI sintética sin bytes) | **STUB** | "Exportar" = `window.print()` |
| 9 | **Comunicaciones / ERDS** | Subject+body en runtime; cuerpo no persistido | `communications` (solo `asunto`+`estado`) | **PARCIAL** | Sin columna de cuerpo; *writeback* ERDS `@deprecated` sin *callers* |

## II.5. Plan de saneamiento documental (frente W0)

Acciones priorizadas; alimentan el frente **W0** de la Parte IV (horizonte inmediato):

1. **[P0] Unificar la fuente de verdad de texto por documento.** O bien (a) que `persistProcessArchiveLink` reescriba **además** la columna de texto de dominio correspondiente, o bien (b) que las páginas de detalle lean el último `secretaria_document_drafts` (`DRAFT_CONFIGURED`) como cuerpo vigente. Cierra la divergencia que origina "no se guarda".
2. **[P0] Acta editable en borrador + paso a definitiva** (II.2): editor en `ActaDetalle` con `is_locked=false`, RPC `fn_actualizar_borrador_acta`, reconciliación draft↔`minutes.content`, vocabulario borrador/definitiva.
3. **[P1] Convocatoria — endurecimiento** (II.3): regenerar al entrar al Paso 8, botón "Generar ahora", *backfill*/marcado de legacy, clarificación UX texto vs DOCX.
4. **[P1] Certificación con cuerpo redactado**: componer `content` en `fn_generar_certificacion` (o pre-render), para que la certificación tenga texto canónico y no solo metadatos + DOCX efímero.
5. **[P2] Decisión unipersonal**: que el paso "Registro y documento" **genere realmente** el documento, o renombrarlo para no prometer de más.
6. **[P2] Board Pack**: generación y archivado de **PDF real** (sustituir `window.print()` y la URI sintética).
7. **[P3] Comunicaciones**: decidir si el cuerpo debe persistirse como documento; reactivar o retirar el *writeback* ERDS `@deprecated`.
8. **[Transversal] Test de regresión anti-divergencia**: *contract test* que verifique que la página de detalle de cada dominio renderiza el **mismo** texto que se archiva como DOCX/evidencia.

### Estado de implementación W0 (2026-06-13, rama `fix/w0-doc-gen-saneamiento`)

| # | Acción | Estado | Entrega |
|---|---|---|---|
| 2 | Acta editable en borrador + paso a definitiva | ✅ **Hecho** | Guard puro `isActaBorradorEditable` (TDD), RPC `fn_actualizar_borrador_acta` (SECURITY DEFINER, recalcula `content_hash`, rechaza firmada/bloqueada, fail-closed tenant, REVOKE anon; migración aplicada+espejada), hook `useUpdateActaBorrador` + editor en `ActaDetalle` |
| 3 | Convocatoria — endurecimiento | ✅ **Hecho** | Auto-regeneración al entrar al Paso 8 (con guard anti-bucle) + botón "Generar ahora" + copy texto vs DOCX en `ConvocatoriasStepper`. (*Backfill* de convocatorias legacy con `convocatoria_text` NULL: pendiente como dato, no código.) |
| 4 | Certificación con cuerpo redactado | ✅ **Hecho** | Helper `buildCertificacionBody` (TDD, art. 109 RRM) persistido en `certifications.content` **antes de firmar** (entra en `hash_certificacion`) desde `EmitirCertificacionButton` |
| 1 | Unificar la fuente de verdad de texto | ✅ **Hecho (opción a, alcance seguro)** | `persistProcessArchiveLink` reescribe el cuerpo revisado a la columna de dominio para CONVOCATORIA y DECISION_UNIPERSONAL; política pura testeada `domainTextTargetForKind`. ACTA y CERTIFICACION quedan excluidos a propósito (los gobiernan su editor/lock-guard y el botón de certificación) |
| 8 | Test de regresión anti-divergencia | ✅ **Hecho** | `domainTextTargetForKind.test.ts` (guard de la política de sincronización por kind) + tests de `acta-edicion`, `certificacion-body` y probe de la RPC |
| 5 | Decisión unipersonal | ◑ **Parcial** | Paso renombrado "Registro y documento" → **"Firma y registro"** para no prometer generación (el documento se genera desde el detalle). Generación dentro del propio paso: no prioritaria |
| 7 | Comunicaciones | ✅ **Verificado (no era issue)** | El cuerpo SÍ se persiste en `communications.cuerpo_render` (+ `cuerpo_hash_sha512`) vía `fn_create_communication_atomic`; el barrido lo describía mal. Único residuo: `updateNotificationStatus` `@deprecated` sin *callers* (limpieza opcional) |
| 6 | Board Pack — PDF real | ⏳ **Diferido a W1** | El export por PDF de navegador (`window.print()`) es funcional; la generación/archivado de un PDF real respaldado por bytes solapa con la productivización del *evidence backbone* (W1) y se aborda allí, no con un sustituto apresurado |

Gates de la entrega: `typecheck` ✓ · `build` ✓ · `bun test` **1984 pass / 0 fail** (+15 tests TDD).

---

# Parte III — Validación de los informes de evolutivo correctivo

Esta parte contrasta, **contra el código y la base de datos reales** (`governance_OS`, consulta en vivo 2026-06-13), el catálogo de *gaps* y afirmaciones de los dos informes de evolutivo recibidos:

1. **«Especificación Funcional — Módulo Secretaría Societaria (TGMS) v1.1»** (estructurada en requisitos funcionales, criterios de aceptación, esquema/RPC/migraciones, gaps G1–G14 y hoja de ruta de 12 semanas + 18 meses).
2. **«Revisión y Mejora del Módulo de Gestión»** (revisión de consultoría que reconcilia los documentos de mayo con el corte de junio, con la lente de madurez V1 *Registro* / V2 *Acción* / V3 *Inteligencia* y una hoja de ruta por horizontes).

**Conclusión de la validación.** Ambos informes son estratégicamente sólidos y mutuamente consistentes; coinciden en el diagnóstico rector (núcleo legal maduro, eslabones probatorio y registral aún simulados) y en el orden de prioridades. El segundo informe reconoce expresamente que «el corte de junio prevalece». **Sin embargo, varios de los gaps que los informes dan por abiertos ya están resueltos en el código actual, y algunos describen mal el modelo de datos.** Esto es relevante para no sobredimensionar el plan: el esfuerzo pendiente es menor de lo que sugiere la lectura literal de los informes, y se concentra en la capa probatoria productiva, el cierre registral, los libros y la cobertura internacional.

## III.1. Estado real de los gaps (verificado)

| Gap (informes) | Lo que afirman | Realidad verificada | Clasificación |
|---|---|---|---|
| **G1** — Evidence backbone QTSP real | QES/QSeal/TSQ/ERDS en sandbox; `client_credentials` expuestos en cliente; `evidence-sandbox-gate.ts` no distingue evidencia real | El *fail-closed* (`assertServerSideQTSPProxyConfigured` → `QTSP_SERVER_PROXY_REQUIRED`) y el gate sandbox (`isFinalSealedEvidence`, `resolveSandboxSafeEvidencePersistence`) **ya existen**; `clientSecret` está fijado a `''` (no hay secreto real en el navegador, siempre cae a sandbox). Migración `000049` sigue en HOLD; tablas de *legal hold* no existen aún | **PARCIAL** — deuda de seguridad cerrada; **pendiente la integración productiva real** (proxy server-side + estados SEALED/VERIFIED ligados a artefactos EAD Trust reales) |
| **G2** — Canal registral RMC *end-to-end* | 0 INSCRITA/DENEGADA; falta Tomo/Folio/Hoja/Asiento/BORME | Confirmado: 6 expedientes, **0 INSCRITA / 0 DENEGADA**, `borme_ref` e `inscription_number` vacíos. **Corrección de modelo:** `registry_filings` **no** usa columnas Tomo/Folio/Hoja/Asiento; usa `inscription_number` + `borme_ref` (que existen pero están sin poblar) | **PENDIENTE** (el gap funcional es real; la nomenclatura del informe es incorrecta) |
| **G3a** — `mandates` *read-only* / motor desacoplado | «El motor LSC aún lee `mandates`» | **FALSO.** `mandates` es una **VIEW** en Cloud (`relkind = 'v'`), no una tabla; ningún código de producción la consulta (solo un test); el motor de reglas es de funciones puras y los *loaders* de sesión leen `condiciones_persona` + `fn_crear_censo_snapshot` | **YA HECHO** |
| **G3b** — *Hard block* certificante no inscrito RM (REQ-DAT-04) | Pendiente; emisión sin control de inscripción RM | **YA implementado.** `EmitirCertificacionButton` calcula `bloqueaRM` y aborta/deshabilita la emisión si el certificante o el Vº Bº carecen de `inscripcion_rm_referencia` (aviso art. 109 RRM). El RPC `fn_generar_certificacion` exige además autoridad VIGENTE + Vº Bº con cargo PRESIDENTE/VICEPRESIDENTE vigente + acta firmada (RRM 109.4) | **YA HECHO** (matiz: el *hard block* por inscripción RM vive en la capa UI; el RPC valida autoridad vigente pero no el campo `inscripcion_rm_referencia` — conviene replicar el bloqueo también en el RPC) |
| **G3c** — Unicidad NIF/CIF | «Sin unicidad NIF/CIF» | **FALSO.** Existe índice único `ux_persons_tax_id_real` sobre `(tenant_id, tax_id)` excluyendo *placeholders* (`PENDIENTE-%`, `E2E-%`, `FREE-FLOAT-%`, `ARCHIVED-%`) | **YA HECHO** |
| **G3d** — Deduplicación de variantes legacy + `data_class` | Duplicados (Cartera ARGA, PHASE-B*, Arga test A…); falta segregación demo/test/prod | La unicidad bloquea nuevos duplicados, pero **persisten** variantes legacy y artefactos E2E en el dataset; la segregación por `data_class` (DEMO/TEST/PRE/PROD) **no está implementada** | **PENDIENTE** (calidad de datos) |
| **G5a** — Especialización de plantillas por `tipo_social` | `tipo_social` NULL en todas | Confirmado: **110/110 plantillas con `tipo_social` NULL**; la diferenciación SA/SL la aplica el motor en *runtime*, no plantillas distintas | **PENDIENTE** |
| **G5b** — Saneamiento del alias legacy `MOD_ESTATUTOS` | Limpiar packs obsoletos | El alias `MATERIA_PACK_ALIASES['MOD_ESTATUTOS'] → 'MODIFICACION_ESTATUTOS'` **ya existe** (capa código resuelta); pero en Cloud **siguen coexistiendo ambos packs** — el borrado físico del duplicado no se ha aplicado (bloqueado por el guardrail de operaciones destructivas) | **PARCIAL** (sin impacto funcional; queda la limpieza física) |
| **G6** — Cierre de volumen + legalización telemática (Legalia) | Sin *workflow* de cierre/legalización | El **esquema sí existe** (`mandatory_books` con `legalization_status`, `legalization_deadline`, `closed_at`, `volume_number`, `legalization_mode`, `legalization_evidence_url`), pero **no hay RPC ni UI de cierre de volumen ni de registro de legalización** (solo lectura/visualización) | **PENDIENTE** |
| **G9** — `capability_matrix` razón jurídica completa | `base_legal` parcial | **Corrección de modelo:** la columna se llama **`reason`**, no `base_legal`. **29/35** filas pobladas; faltan **6** (las acciones no nucleares de datos maestros) | **PARCIAL** |
| **G11** — Pactos parasociales con *enforcement* | «Sin *enforcement* en motor» | **FALSO.** `pactos-engine.ts` evalúa VETO→BLOCKING, MAYORIA_REFORZADA_PACTADA→BLOCKING, CONSENTIMIENTO_INVERSOR→WARNING, integrado en el orquestador (pre-check de veto para el voto de calidad y evaluación completa post-votación), con UI (`PactosCompliancePanel`) y tests | **YA HECHO** |
| **G13** — Gates sectoriales (DGSFP/SUSEP/CNSF/BdP) como *hard block* | Hard block por autorización regulatoria | **No existe** tabla `autorizacion_regulatoria` ni gate de bloqueo. Existe `bloques_sectoriales` (cláusulas de **contenido** documental por sector: SEGUROS Solvencia II, BANCA, ENERGÍA…), capacidad adyacente pero **no** un gate de autorización con estado y bloqueo del acto | **PENDIENTE** |

## III.2. Afirmaciones de los informes que deben corregirse

Para evitar que el equipo legal planifique trabajo ya hecho, conviene fijar estas correcciones de hecho:

1. **«El motor LSC aún lee `mandates`»** — incorrecto. `mandates` es una **VIEW de compatibilidad** de solo lectura; el motor y los *loaders* operan sobre el modelo canónico (`condiciones_persona`, `censo_snapshot`). La fase de retirada de `mandates` (la "Fase 5" del plan canónico) está **alcanzada**.
2. **«Sin unicidad NIF/CIF»** — incorrecto. Índice único `ux_persons_tax_id_real` en vigor.
3. **«*Hard block* de certificante no inscrito en RM pendiente» (REQ-DAT-04)** — desfasado. Ya implementado en la UI de emisión de certificación.
4. **«Pactos parasociales sin *enforcement*»** — incorrecto. *Enforcement* implementado, cableado y testeado.
5. **Nomenclatura registral Tomo/Folio/Hoja/Asiento** — el modelo real usa `inscription_number` + `borme_ref` (+ refs de país: `psm_ref`, `siger_ref`, `conservatoria_ref`, `jucerja_ref`, `diario_oficial_ref`). El *gap* funcional (no hay inscripciones terminales) es real; el modelo de columnas no necesita los campos que propone el informe.
6. **Columna `capability_matrix.base_legal`** — la columna real es `reason` (29/35 pobladas).

## III.3. Corrección a la propia Parte I de este documento

La validación obliga a matizar dos afirmaciones de la Parte I (y del Anexo C), que reflejaban el estado documentado en CLAUDE.md pero que la consulta en vivo desmiente:

- La Parte I (§ modelo canónico) y el Anexo C indicaban que `mandates` **«sigue siendo tabla (Fase 0+1)»** y que el motor **«aún no lee exclusivamente de `censo_snapshot`»**. **Realidad verificada 2026-06-13:** `mandates` es una **VIEW**; el censo se construye desde el modelo canónico (`condiciones_persona` + `fn_crear_censo_snapshot`) y alimenta al motor puro. La convivencia con `mandates` como **tabla escribible** ya no existe; subsiste solo como vista de compatibilidad de lectura. El Anexo C de este documento queda corregido en ese punto (ver nota en el propio Anexo C).

## III.4. Lo genuinamente pendiente (depurado)

Tras descontar lo ya resuelto, el evolutivo correctivo se concentra en **siete frentes reales**:

- **G1** — integración QTSP productiva real (proxy server-side; SEALED/VERIFIED ligado a artefactos EAD Trust; aplicar `000049`; *legal hold* / retención productivos).
- **G2** — cerrar el ciclo registral hasta INSCRITA/DENEGADA con `inscription_number` + `borme_ref` reales y flujo de subsanación.
- **G3d** — calidad de datos: segregación `data_class` y limpieza de variantes legacy / artefactos E2E.
- **G5a / G5b** — poblar `tipo_social` en plantillas y retirar físicamente el pack duplicado `MOD_ESTATUTOS`.
- **G6** — RPC + UI de cierre de volumen y legalización Legalia (el esquema ya está).
- **G9** — completar las 6 filas de `capability_matrix.reason`.
- **G13** — gate sectorial de autorización regulatoria con bloqueo (hoy solo hay cláusulas de contenido).

A estos siete se suma, como **frente de máxima urgencia operativa**, el **saneamiento de la generación documental** detectado en la primera pasada de test (Parte II), que ningún informe recogía.

---

# Parte IV — Plan de evolutivo correctivo consolidado y priorizado

Este plan **reconcilia** las dos hojas de ruta recibidas (las Fases 1/2/3 + horizonte evolutivo de la v1.1, y los horizontes Inmediato/Corto/Medio/Evolutivo del segundo informe), las **reprioriza** a la luz de la validación de la Parte III (varios cimientos de la "Fase 1" ya están hechos) e **incorpora** el frente de saneamiento documental de la Parte II. Se ordena por la lente de madurez que ambos informes comparten: **V1 Sistema de Registro → V2 Sistema de Acción → V3 Sistema de Inteligencia**, con el principio rector «verdad jurídica computable, documento como manifestación, secretario como garante».

## IV.0. Reordenación respecto a los informes

Los informes situaban en la "Fase 1 — cimientos" cinco trabajos que **ya están cerrados**: desacople de `mandates` (VIEW), unicidad NIF/CIF, *hard block* de certificante no inscrito, *enforcement* de pactos y el *fail-closed* + gate sandbox del QTSP. **La Fase 1 real es por tanto más corta**, y la capacidad liberada debe redirigirse al frente que los informes no veían: **el saneamiento de la generación documental (W0)**, que es lo que hoy impide demostrar el ciclo operativo de extremo a extremo.

## IV.1. Frentes de trabajo (workstreams)

| ID | Frente | Gap(s) | Nivel | Prioridad | Estado de partida |
|---|---|---|---|---|---|
| **W0** | **Saneamiento de generación documental** (edición/persistencia de actas en borrador; endurecimiento del texto de convocatoria; uniformar el pipeline doc-gen — ver Parte II) | — (test) | V2 | **P0 (inmediata)** | Parcial/roto según flujo |
| **W1** | Capa probatoria productiva (proxy QTSP server-side, SEALED/VERIFIED real, `000049`, *legal hold*, retención, verificación LTV) | G1 | V1→V2 | P0 | Fail-closed y gate sandbox **hechos**; integración real pendiente |
| **W2** | Cierre registral *end-to-end* (estados INSCRITA/DENEGADA/SUBSANACIÓN con `inscription_number`+`borme_ref`; golden path piloto) | G2 | V1 | P0 | Modelo y estados existen; faltan datos terminales y flujo de defectos |
| **W3** | Calidad de datos maestros (`data_class`, limpieza de variantes legacy y artefactos E2E, representación PJ) | G3d, G8 | V1 | P1 | Unicidad NIF **hecha**; segregación y limpieza pendientes |
| **W4** | Libros: cierre de volumen + legalización telemática (Legalia, formato DGRN; máquina PENDIENTE→PRESENTADO→LEGALIZADO/RECHAZADO) | G6 | V2 | P1 | Esquema **hecho**; RPC+UI pendientes |
| **W5** | Plantillas: poblar `tipo_social`, retirar pack `MOD_ESTATUTOS`, especialización por contexto (cotizada/sector/órgano) | G5a, G5b | V2 | P2 | Alias **hecho**; datos y desdoble pendientes |
| **W6** | Gobernanza y auditoría: completar `capability_matrix.reason` (6/35), telemetría SIEM sobre WORM/RBAC | G9, G14 | V1 | P2 | 29/35 anotadas; SIEM pendiente |
| **W7** | Gates sectoriales (DGSFP/SUSEP/CNSF/BdP) como *hard block* de autorización | G13 | V2 | P2 | Solo cláusulas de contenido (`bloques_sectoriales`) |
| **W8** | Multi-jurisdicción: PT a GA condicionada (rule packs CSC), después BR/MX | G4 | V2→V3 | P3 | 100 % ES; PT preview |
| **W9** | Automatización cross-módulo: *event bus* + borradores de agenda accionables, recordatorios y escalados | G7, G11(UX) | V2 | P3 | Handoffs read-only existentes |
| **W10** | Inteligencia jurídica supervisada (redacción asistida de actas, extracción semántica de acuerdos, board pack automático) | — | V3 | Evolutivo | **Núcleo ya construido** (`motor-plantillas` + edge function `openai-capa3-document-copilot` desplegada + UI cableada); pendiente solo de provisión de key OpenAI (acción usuario). Board pack automático: pendiente |

## IV.2. Secuenciación por horizontes

**Horizonte Inmediato (pre-release controlado).**
- **W0** — saneamiento de la generación documental: implementar la edición/persistencia de actas en borrador y su paso a definitiva, y endurecer la obtención del texto final de convocatoria (ver el plan detallado en la Parte II). Es lo que desbloquea la demo del ciclo operativo.
- **W1** — proxy QTSP server-side real y cierre del *backbone* de evidencia (`000049`), manteniendo el *fail-closed* ya existente.
- **W6 (parcial)** — completar las 6 filas de `capability_matrix.reason` (auditoría defendible, esfuerzo bajo).
- Entorno: *staging* aislado con CI/CD no destructivo (prerequisito de pre-release que ambos informes piden).

**Horizonte Corto plazo (cierre operativo).**
- **W2** — sembrar y probar al menos un golden path con INSCRITA, uno con DENEGADA y uno con SUBSANACIÓN resuelta.
- **W3** — consolidar datos maestros (`data_class`, limpieza de duplicados legacy, representación PJ).
- **W4** — operativizar libros (cierre de volumen + legalización Legalia con KPIs y alertas de plazo).

**Horizonte Medio plazo (escalabilidad).**
- **W5** — especialización de plantillas y retirada del pack duplicado.
- **W7** — gates sectoriales con *hard block*.
- **W8** — PT a GA condicionada (rule packs CSC validados por *counsel* local).
- **W9** — automatización cross-módulo gobernada (borradores de agenda, recordatorios, escalados).
- **W6 (resto)** — telemetría SIEM sobre WORM/RBAC.

**Horizonte Evolutivo (8–18 meses).**
- **W8 (resto)** — BR (JUCESP/IRN) y MX (RPC/Notario/SE).
- **W10** — inteligencia jurídica supervisada.
- Integración notarial ANCERT, *e-discovery* con cadena de custodia exportable, *analytics* de gobierno corporativo, catálogo de plantillas multilingüe.

## IV.3. Decisiones abiertas pendientes de Comité Legal

Heredadas de los informes y vigentes tras la validación:

1. ~~**Retirada del pack `MOD_ESTATUTOS`** (G5b)~~ — ✅ **RESUELTO (W5, 2026-06-13):** pack retirado en Cloud y todo el runtime hecho alias-safe (ver IV.4).
2. **Hard block del RPC de certificación** (G3b): ¿replicar en `fn_generar_certificacion` la verificación de `inscripcion_rm_referencia` que hoy solo está en la UI, para defensa en profundidad?
3. **ANCERT vs PRESCAR/SIR** (G2): canal de presentación registral preferente en el cierre del ciclo.
4. **Retención por tipo documental** (G1/W1): ¿máximo legal (10 años fiscal) o mínimo (6 años CCom) por defecto?
5. **Umbral `MAYORIA_REFORZADA_PACTADA`** (G11): ¿75 % por defecto o siempre explícito en el pacto?
6. **PT a GA** (G4/W8): listado mínimo de rule packs CSC y *counsel* portugués responsable.
7. **Gates sectoriales** (G13/W7): catálogo definitivo de organismos y si entran en el horizonte medio o evolutivo.
8. **`data_class`** (G3d/W3): criterio de segregación demo/test/pre/prod y tratamiento de los artefactos E2E ya presentes en el tenant.


## IV.4. Estado de ejecución del evolutivo correctivo (run autónomo 2026-06-13)

Ejecución autónoma con revisión adversarial `/codex` por fase. Estado verificado de cada frente:

| Frente | Estado | Detalle |
|---|---|---|
| **W0** Saneamiento generación documental | ✅ **Hecho** | Editor de acta en borrador (`fn_actualizar_borrador_acta`), endurecimiento de convocatoria, cuerpo de certificación, unificación de fuente de texto, decisión unipersonal renombrada. Merged a `main`. |
| **W6** `capability_matrix.reason` 35/35 | ✅ **Hecho** | 6 razones jurídicas restantes anotadas + guard de regresión. |
| **W5** Retirar pack `MOD_ESTATUTOS` | ✅ **Hecho (adversarial)** | Pack retirado en Cloud. La revisión `/codex` (5 rondas) destapó que la grafía era *load-bearing* en ~7 sitios de match exacto sin alias; se hizo **alias-safe todo el runtime** (`rulePackMateriaMatches` en compliance, preview, useRulePacks, ReunionStepper, matter-registry, votacion-engine, prototype-fallback), lo que además **corrige un bug latente para TODAS las grafías aliased** (AMPLIACION_CAPITAL, etc.). Overrides huérfanos limpiados. |
| **W2** Golden path registral | ✅ **Hecho (demo)** | Sembrados 2 INSCRITA (directa + subsanación resuelta, con inscripción + BORME) + 1 DENEGADA con defecto; agreements coherentes a REGISTERED. El **canal registral real (PRESCAR/SIR/ANCERT) es externo y queda fuera de dev**. |
| **W3** Calidad de datos (`data_class`) | ✅ **Hecho (saneamiento BBDD completo, 2026-06-14)** | **Saneamiento forense F0-F5** de `governance_OS` para pruebas con humanos. **F1 cuarentena**: purga de 18 entities TEST + 53 persons TEST + cascada (8 agreements, 5 meetings, 33 capital_holdings incl. 29 E2E/QA en ARGA, 20 condiciones incl. 16 SOCIO TEST en ARGA, 207 mandatory_books, 13 censo WORM) — patrón sancionado `session_replication_role=replica` + orphan-scan genérico `pg_constraint` + self-verify golden path (cazó 7 huérfanos y forzó rollback, como diseñó `/codex`). **F2 saneamiento**: poda 91 acuerdos DRAFT sin padre (resuelve el síntoma 145→42), 5 `entity_capital_profile` VIGENTE creados, 24 tax_id `PENDIENTE-*` backfilled. **F3 coherencia**: acuerdos sin padre normalizados, be0d8a4a (unipersonal sobre cotizada) eliminado, censos generados → ARGA readiness 0/0. **F4 filtrado consistente**: `applyVisibleDataClass` (null-safe) en TODOS los read-paths de lista/scope (useSociedades, useEntitiesList, useFilialEntities, governance map/nodes, dashboard) + `isProductionPerson` data_class-aware; opt-in TEST **solo** build-time `VITE_E2E` (sin bypass localStorage/URL, cerrado por `/codex`); **tagging durable** vía trigger `fn_autotag_*_test_data_class` (etiqueta artefactos E2E en BD, no por builder). **Validador de completitud por flujo** `flow-completeness.ts` (TDD). **Resultado**: 6 paridades VERDE, ARGA 0/0 (Completa), readiness 0 blocking/0 warnings, Rota=0, **5 sociedades Completa** (SA cotizada, SA, SL solidarios, SL mancomunados, SLU unipersonal — cobertura de todos los tipos de flujo), entities 50→32 (0 TEST), persons 135→82 (0 TEST), agreements 145→42 coherentes. Backup `w3_backup_20260614` + runbook de rollback. `bun test` 2047 pass/0 fail. Revisión adversarial `/codex` aplicada (4 hallazgos remediados). Informe: `docs/superpowers/plans/2026-06-14-w3-saneamiento-bbdd-forense.md`. |
| **W4** Libros: cierre de volumen + legalización | ✅ **Hecho** | Máquina de estados pura `libro-legalizacion` (TDD): PENDIENTE→PRESENTADO→LEGALIZADO\|RECHAZADO (cierre de volumen previo). RPCs `fn_libro_cerrar_volumen` + `fn_libro_legalizacion_transicion` (SECURITY DEFINER, tenant-assert, REVOKE anon). Integridad blindada con trigger `trg_mandatory_books_lifecycle_guard` (el ciclo solo se muta vía RPC; UPDATE directo → 42501, verificado). Hooks + acciones en `LibrosObligatorios` (vista card, libros persistidos legalizables). El paquete técnico Legalia (ZIP+huella DGRN) y la presentación telemática real quedan como integración externa futura. |
| **W7** Gates sectoriales (DGSFP/SUSEP/CNSF/BdP) | ✅ **Hecho (surface)** | Tabla `autorizacion_regulatoria` (RLS) + seed DGSFP vigente ARGA; evaluador puro `evaluarAutorizacionesRegulatorias` (TDD, alias-aware, jurisdicción-aware, cubre grafías estructurales y cambio de objeto); card read-only en ExpedienteAcuerdo. ARGA enriquecida `regulated_sector='SEGUROS'`. El *enforcement* como hard-block en la transición del acuerdo queda como follow-up. |
| **W1** Capa probatoria QTSP productiva | ⛔ **Bloqueado (externo)** | Necesita credenciales/proxy real de EAD Trust en servidor; no implementable en dev sin infra QTSP. El *fail-closed* y el gate sandbox ya existen. |
| **W9** Cross-módulo: borradores de agenda | ✅ **Hecho (núcleo)** | Tabla `agenda_draft` (RLS) + máquina de estados pura (TDD) + trigger guard de estado (solo vía RPC; UPDATE directo→42501, verificado) + RPC `fn_agenda_draft_transicion` (CONVOCAR exige `convocatoria_id`) + bandeja `AgendaDraftInbox` en el Dashboard + seed (GRC/AIMS). El Secretario decide; nada se convoca sin aprobar. **Follow-up:** emisión automática desde GRC/AIMS (handoffs hoy read-only), materialización del intake (consumir `draft` → marcar CONVOCADO + enlazar), y cron de recordatorios/escalados. |
| **W8** Multi-jurisdicción (motores BR/MX/PT) | ⏳ **Horizonte (no dev-autónomo)** | Feature multi-semana: rule packs locales CSC/LGSM/Lei 6.404, plantillas locales, integraciones registrales por país. |
| **W10** Inteligencia jurídica supervisada (IA) | ✅ **Operativo con IA real (verificado en vivo)** | **Corrección de diagnóstico (2026-06-14):** el núcleo NO estaba por construir — ya existía `motor-plantillas@1.0.0-beta` (`src/lib/motor-plantillas/`), copiloto documental gobernado y testeado. `suggestActaDraftPolish()` asiste el **borrador editable** del acta proponiendo reemplazos localizados sobre fragmentos exactos (targets whitelisted: `narrativa.introduccion`, `narrativa.deliberaciones`, `narrativa.incidencias_no_criticas`), con **harness de protección de hechos jurídicos** (sociedad, órgano, asistentes, quórum, capital, votos, texto de acuerdos, pactos, conflictos, fechas, hashes, snapshots, orden del día) que solo aplica si conserva la estructura RRM y pasa `validateRenderedActaAgainstLegalStructure()`. Inferencia **server-side** en la edge function `openai-capa3-document-copilot` (ACTIVE, `verify_jwt:true`, OpenAI Responses API + Structured Outputs `strict`, modelo `gpt-5.5`); cableada en `ProcessDocxButton` (ActaDetalle/GenerarDocumentoStepper/ExpedienteAcuerdo). **Fail-closed:** sin `OPENAI_API_KEY[_2]` cae al fallback local determinista `capa3-local-demo-assistant`. **Key OpenAI provisionada** como secret de `governance_OS` por el usuario (autoriza el *data-egress* a OpenAI). **Bug latente corregido** (commit `e8452ff`): la función enviaba siempre `temperature`, que `gpt-5.5` (razonamiento) rechaza → 502 en toda llamada; ahora los parámetros se gatean por familia de modelo. **Prueba en vivo:** HTTP 200, `gpt-5.5`, propuesta de pulido sobre `narrativa.deliberaciones` con `requiresHumanReview:true`. **Revisión adversarial (5 agentes):** key nunca en navegador ✓, fail-closed ✓, harness de hechos jurídicos enforced ✓, humano-en-el-bucle ✓ (la IA aterriza en estado React, el Secretario revisa y guarda; nunca escribe directa en `minutes.content`); red-team **no halló** camino de auto-persistencia sin revisión. **Limitaciones conocidas (no bloqueantes):** la validación del harness es textual/estructural, no semántica (un pulido narrativo podría matizar el sentido) — mitigado por la **revisión humana obligatoria** de cada propuesta; *follow-up:* log de auditoría por-propuesta (quién aceptó/rechazó) y validación de recuentos en narrativa. |

**Gates del run:** `typecheck` ✓ · `build` ✓ · `bun test` 2020 pass / 0 fail (post-W9) · 11 migraciones Cloud aplicadas y espejadas · edge function `openai-capa3-document-copilot` redesplegada (fix `e8452ff`) · `main` consolidado y pusheado · producción Vercel READY (`7ee293a`). Cada fase pasó revisión adversarial (W5: `/codex` 5 rondas; W9: 2 rondas; **W10: workflow de 5 agentes** — 4 CONFIRMED + 1 PARTIAL, sin camino de auto-persistencia IA). **W10 fue una corrección de diagnóstico:** el núcleo IA (`motor-plantillas`) ya existía construido/testeado/desplegado/cableado; el único código añadido fue el gate de parámetros por familia de modelo en la edge function, tras destapar en vivo que el default `gpt-5.5` rechazaba `temperature`. La IA queda **operativa con modelo real**, verificada de extremo a extremo.
