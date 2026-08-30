# Prompts para generación de datos sintéticos — tenant Garrigues

- **Fecha:** 2026-08-29
- **Destino:** un modelo *researcher* que produzca los datos; el resultado se siembra en el
  tenant Garrigues `00000000-0000-0000-0000-000000000002`.
- **Fuentes reales leídas para anclar estos prompts** (no se commitean, viven fuera del repo):
  `Inventario de Sistemas y Gestión CISO - Plan Garrigues.pdf` (13 pp.),
  `Plantilla evaluación de riesgos_G-Digital.xlsx`, `COR Departamento G-Digital.docx`,
  `Guía de delitos de persona jurídica_4 y 6 marzo 2025.docx`.

---

## Bloque 0 — Contexto común. Va ÍNTEGRO al principio de cada uno de los cinco prompts.

```
Eres un generador de DATOS SINTÉTICOS para un prototipo de gobernanza corporativa. El
destino es el tenant demo de Garrigues, un despacho de abogados español real.

## La regla que gobierna todo lo demás

Estos datos son SINTÉTICOS y se pide expresamente que los inventes. Eso NO relaja la
disciplina, la cambia de sitio:

1. Todo registro que generes lleva `firmeza: "SINTETICO"` y una `procedencia` que diga de
   qué ancla real se derivó. Nada entra sin etiqueta.
2. Los ANCLAS REALES que te doy abajo son literales de documentos del despacho. Puedes
   apoyarte en ellos, no puedes contradecirlos ni ampliarlos. Si inventas un sistema, un
   órgano o una norma que no está en las anclas, márcalo `ancla: "NINGUNA"` y explica por
   qué lo añades.
3. **Prohibido inventar hechos jurídicos.** No atribuyas certificaciones, obligaciones
   legales, resoluciones ni capacidades regulatorias que no consten en las anclas. Un
   incidente simulado es dato sintético; decir que una norma obliga a algo es una
   afirmación jurídica y necesita fuente.
4. Nombres de personas: usa nombres de ficción. NO uses nombres reales de profesionales
   del despacho salvo los que aparezcan literalmente en las anclas como titulares de un
   cargo público (p. ej. el administrador único, que consta en el Registro Mercantil).
5. Escribe en castellano de España, registro jurídico-corporativo, sin anglicismos
   innecesarios. Nada de "compliance-speak" de relleno.
6. Devuelve JSON válido conforme al esquema que se te pide, sin texto alrededor.

## Anclas reales — Plan de Sistemas 2025-2027 (Año 2: 2026) de J&A Garrigues

Emisor: Oficina del CISO | Dirección de Tecnología e Innovación.

**Modelo de clasificación de activos.** Criterios de criticidad (CIA):
- Confidencialidad Extrema: custodia del secreto profesional, secreto de sumario y
  operaciones corporativas sensibles (M&A, Due Diligence).
- Integridad No Repudiable: trazabilidad probatoria en evidencias, firmas electrónicas,
  votaciones de socios y expedientes judiciales.
- Disponibilidad Continua: resiliencia en portales transaccionales y plataformas de
  facturación global multioficina.

**Taxonomía de exposición L1-L4** (esta es la dimensión que más usa el CISO):
- L1 Back-office interno: sistemas aislados para uso exclusivo de abogados y soporte.
- L2 Colaboración regulada: extranets seguras con contrapartes y notarías.
- L3 Entregables supervisados: aplicaciones cliente con revisión preceptiva del abogado.
- L4 Autoservicio / Directo: sistemas expuestos a clientes con know-how legal embebido
  (máximo riesgo CISO).

**Sistemas de práctica y negocio** (nombre | tipo | datos tratados | foco CISO):
- Garrigues GA_IA (3 & Local) | IA Generativa / RAG (Corpus) | secretos de cliente,
  doctrina, DNI, notas simples | aislamiento on-premise, guardrails anti-jailbreak,
  auditoría externa (25 k€).
- iManage DMS & Teams VDR | gestión documental y salas | expedientes, contratos, litigios,
  actas | cifrado en reposo/tránsito, migración de Collaborate a Teams seguro y DLP.
- Portal Litigar & DD Portal | gestión de procedimientos y M&A | demandas, escrituras,
  análisis de riesgos | certificación ISO 27001, cifrado SSL, control estricto de roles
  externos.
- Generador Laboral (Carrefour) | motor documental (Bryter) | bajas, suspensiones, datos de
  empleados | flujo determinista supervisado y aislamiento de datos de terceros.
- g-digital / EAD Trust | confianza y firma digital | certificados (280+), firmas,
  eArchiving | custodia de claves privadas, firma avanzada y sellado de tiempo cualificado.

**Sistemas de operaciones y gobierno:** SAP S/4HANA (RISE) — ERP, OTC, MM, PTP,
consolidación, sobre Cloud S/4HANA + Datasphere, con segregación de funciones (SoD);
Workday HCM — on-boarding, selección, compensación, SaaS con SAML SSO; Salesforce (KYC/AML)
— prevención de blanqueo, cumplimiento SEPBLAC/UTTAI; Frontify DAM & BDM — activos digitales
y marketing; Portal Proveedores & Fichaje — homologación ESG y registro horario, híbrido con
conectores SAP.

**Seguridad y detección:** SOC corporativo con monitorización continua; inteligencia CSIRT
de Unit 42 (Palo Alto); auditorías de hacking ético (Red Team) en Torres Colón;
microsegmentación de red.

**Seguridad en IA:** GA_IA Local sin salida a Internet para asuntos ultraconfidenciales;
RAG masivo escalable de 100k a 10M páginas con control de fuga de datos; guardrails
anti-jailbreak en la capa de orquestación para neutralizar inyecciones de prompt, evitar
alucinaciones jurídicas y verificar la integridad de las fuentes; partida específica de
25.000 € para auditoría externa de cumplimiento normativo (AI Act), seguridad técnica y
análisis de sesgo algorítmico.

**Consolidación Microsoft E5 (100 k€ de ahorro anual recurrente):** migración de Check Point
Harmony a Microsoft Defender for Mobile; sustitución de Tenable.AD por Microsoft Defender
for Identity; reducción de solapamientos y simplificación de telemetría en el SOC.

**Proyectos de ciberseguridad 2026** (proyecto | planificación | presupuesto | objetivo):
- Microsegmentación de Red | Q1-Q2 2026 | 100.000 € | aislamiento de zonas críticas y
  contención de movimientos laterales.
- Sustitución SOC/SIEM (PoC XSIAM) | Q2-Q3 2026 | 57.234 € | correlación de eventos y
  respuesta rápida.
- Proofpoint AEDLP & Email Fraud | Q1 2026 | 48.000 € | prevención de fraude por email (BEC)
  y fuga de datos (DLP).
- WAF Azure & FW Fortinet | Q1-Q4 2026 | 77.300 € | blindaje de capa 7 para portales web
  externos y renovación perimetral.
- Sustitución PKI/CA & PoC Purview | Q1-Q4 2026 | 40.000 € | cifrado corporativo, custodia
  de certificados y gobierno del dato.

**Presupuesto 2026:** 22,94 MM€, un 5,85 % sobre una facturación de 454 MM€. Licencias SaaS
y software 41 % (9,40 MM€); servicios y consultoría IT 31 % (7,11 MM€); comunicaciones y
conectividad 11 % (2,52 MM€); dispositivos y puesto de trabajo 8 % (1,83 MM€);
ciberseguridad directa 5 % (1,15 MM€), complementada con controles nativos embebidos en
Microsoft E5 y SAP Cloud.

**Roadmap 2025-2027:** 2025 «Ordenar y Proteger» (Defender E5, KYC/AML en Salesforce, inicio
de migración S/4HANA, auditoría en Torres Colón) → Q1-Q2 2026 «Blindar y Aislar»
(microsegmentación, WAF Azure, GA_IA Local sin internet, PoC SIEM/XSIAM) → Q3-Q4 2026
«Gobernar y Migrar» (Proofpoint AEDLP, renovación de PKI, migración del 40 % de servidores a
Windows Server 2022) → 2027 «Consolidar y Certificar» (Go-Live definitivo de SAP S/4HANA
RISE, datalake integrado, renovación del Plan Director de Ciberseguridad).

Postura declarada: Zero Trust, aunando innovación en IA generativa con máxima protección del
secreto profesional.

## Anclas reales — metodología de evaluación de riesgos penales del PPD

Extraída de la plantilla oficial del despacho. **Es la escala real y tiene nombres.**

Factores de probabilidad:
- **P1 Frecuencia de exposición:** Trabajo habitual = 5 · Trabajo ocasional = 2,5 · Trabajo
  remoto = 1 · Trabajo fuera de alcance = sin valor.
- **P2 Sujetos activos:** Solo Socio / Counsel / Director = 1 · Asoc. Principal / Gerente y
  superior = 1,25 · Asoc. Senior / Mando intermedio y superior = 1,5 · Staff y superior = 2.
- **P3:** en colaboración con el cliente (Sí / No).
- **P4 Entorno de control:** valoración Insuficiente / Aceptable. Medidas preventivas: sin
  medidas · solo medidas generales · hay una medida específica · hay varias medidas
  específicas (0 / 0,15 / 0,25 / 0,35). Incidencias en medidas: sin incidencias en los 2
  últimos años = 0 · con incidencias leves = 0,25 · con incidencias graves = 0,5.

Valor máximo de probabilidad bruta en el algoritmo = **10** (P1 × P2). Normalizada a 0-1,
la **probabilidad relativa** se clasifica: Muy alta ≥ 0,8 · Alta ≥ 0,6 · Media ≥ 0,4 ·
Baja ≥ 0,2 · Muy baja ≥ 0.

La **matriz de riesgo/prioridad** cruza probabilidad relativa (filas) con impacto (columnas:
Despreciable, Bajo, Medio, Alto, Muy alto) y devuelve el nivel con este código de color,
que es el mismo del mapa de riesgos penales evaluado 2025:
- **Muy bajo → verde intenso #00B050** · **Bajo → verde claro #92D050** ·
  **Medio → amarillo #FFFF00** · **Alto → naranja #FFC000** · **Muy alto → rojo #FF0000**.
- Gris #D9D9D9 = sin valor / no evaluado. «No detectado» → Despreciable.

Existe además el concepto de **medidas derivadas del artículo 129 CP (consecuencias
accesorias)**.

## Anclas reales — catálogo de situaciones de riesgo penal por departamento (COR)

Estructura del documento: introducción + «Catálogo de situaciones susceptibles de generar
riesgos penales», organizado **por delito con su artículo del CP**, y bajo cada uno una
lista de situaciones concretas redactadas en infinitivo.

Ejemplos literales del COR del departamento G-Digital, para que copies el registro y el
nivel de concreción (NO los reutilices tal cual, genera equivalentes):
- Descubrimiento y revelación de secretos (197, 197 bis y 197 ter CP): «Utilizar, proponer o
  colaborar en la obtención de medios de prueba que pudieran implicar la vulneración de la
  intimidad de un tercero, con conocimiento de su origen ilícito, para hacer valer las
  pretensiones del cliente en un procedimiento judicial o en una negociación».
- Propiedad intelectual (270 y ss. CP): «Realizar cualquier tipo de publicación […]
  utilizando alguna imagen o reproducción total o parcial de obras de terceros, para lo que
  pudiera no contarse con la debida cesión de los derechos de autor».
- Secretos de empresa (278 a 280 CP): «Hackear o solicitar el hackeo de sistemas de terceros
  para obtener información, o realizar conductas equivalentes de ingeniería social».
- Acoso sexual (184 CP): «Llevar a cabo la conducta intimidatoria anterior aprovechando una
  categoría profesional superior».

Marco normativo que el propio catálogo cita como medida: Código Ético; Estatutos sociales de
J&A Garrigues, S.L.P.; Código deontológico de la abogacía española; Estatuto General de la
Abogacía; formaciones PPD.

## Estado actual del tenant (lo que YA existe y con lo que hay que ser coherente)

- 33 entidades del grupo con su cadena de control; matriz **J&A Garrigues, S.L.P.**
  (B81709081, hoja M-190538), administrador único, 346 socios, 19 estructuras consultivas
  más la Junta de Socios y el CdA de EAD Trust.
- 39 documentos normativos internos (32 políticas PI-xx, Código Ético, Código de Conducta
  del Socio, PPD ×3, Manual PBC/FT, protocolo LGTBI).
- 28 obligaciones y 34 controles (PBC/FT, PPD y ciberseguridad).
- 82 riesgos penales, uno por delito del catálogo, evaluados por color sobre 18 columnas
  (9 áreas de negocio + 9 departamentos internos).
- **0 reuniones y 0 acuerdos** en Secretaría: es el hueco que hay que llenar.
- Comités reales ya modelados y utilizables como responsables: Comité de Seguridad y
  Privacidad (propietario del SGSI), Oficina Técnica de Seguridad, Oficina DPO, Comité de
  Análisis y Control Interno (CACI), Comité de Prevención de Delitos, Comité de Práctica
  Profesional, Comité de Gobernanza de la Inteligencia Artificial, Consejo de Socios.
```

---

## Prompt 1 — AIMS (gobernanza de IA)

```
[PEGAR AQUÍ EL BLOQUE 0 ÍNTEGRO]

## ⚠️ Antes de empezar: NO estás partiendo de cero

El carril C2 del programa **ya tiene catalogados 6 sistemas** en
`scripts/garrigues/ia/catalogo-ia.ts`, mergeado en `main` (`1cce83f`), con su seed
`scripts/seed-garrigues-ia.ts` en dry-run a la espera de autorización nominal para escribir
en Cloud. Los 6 son: **Copilot**, **Harvey**, **Garrigues GA_IA**, **Acuerdo enterprise
OpenAI**, **Acuerdo enterprise Anthropic** y **Soluciones agénticas de proceso**.

**Tu encargo NO es rehacer ese catálogo, es ampliarlo.** Concretamente:
- **Lee primero el catálogo existente** y respeta sus identificadores, nombres y campos. Si
  discrepas de algo, dilo en `dudas`; no lo sobrescribas.
- **Añade la capa que le falta**: los chatbots construidos sobre **Gemini** dentro de GA_IA y
  los cuatro **workflows sobre modelos open source tipo Llama** (traducción jurídica,
  conversión de PDF, cálculo de plazos y fechas procesales, preparación de modelos y
  escritos). Esa capa no está catalogada.
- **Añade la profundidad de gobernanza** que el catálogo no cubre: clasificación L1-L4,
  evaluaciones, incidentes y controles.
- Dos gotchas ya medidos en Cloud por C2, que debes respetar: **`aims_reference_code` no es
  único** (re-ejecutar un seed duplicaría en silencio, igual que `policies.policy_code` en
  G4) y **`status` no tiene CHECK**, así que el dominio lo tienes que sostener tú.

## Tu encargo

Completa el inventario de SISTEMAS DE IA del despacho y su documentación de gobernanza,
sobre la base ya existente.

### Los sistemas que hay que cubrir

Cuatro familias. Las dos primeras están ancladas en el Plan de Sistemas; las dos últimas te
las doy como hecho de contexto y debes tratarlas igual de en serio.

1. **Harvey** — plataforma comercial de IA legal generativa, SaaS de tercero.
2. **Microsoft Copilot** — asistente integrado en el puesto de trabajo (M365 E5), transversal
   a toda la plantilla.
3. **GA_IA / GAIA** — infraestructura propia del despacho, en dos despliegues:
   (a) GA_IA (3) con RAG sobre corpus documental, y (b) **GA_IA Local**, aislada y sin salida
   a Internet, para asuntos ultraconfidenciales. Sobre esa infraestructura el despacho ha
   habilitado **chatbots construidos sobre Gemini**.
4. **Workflows específicos**, que corren sobre modelos open source tipo **Llama**:
   traducción jurídica, conversión de PDF, cálculo de plazos y fechas procesales, y
   preparación de modelos/escritos.

### Qué generar por cada sistema

Un registro con, como mínimo: nombre; propósito declarado en una frase; familia
(COMERCIAL_SAAS / PUESTO_TRABAJO / INFRAESTRUCTURA_PROPIA / WORKFLOW); modelo o proveedor
subyacente; despliegue (SaaS / on-premise aislado / híbrido); **nivel de exposición L1-L4 de
la taxonomía del CISO, con la justificación de por qué ese nivel y no el contiguo**;
criticidad CIA; categorías de datos tratados; departamentos usuarios; órgano responsable
(elige entre los comités reales listados arriba y justifica la elección); estado del ciclo
de vida; y volumetría de uso plausible.

### Lo específicamente difícil, y donde quiero que pienses en vez de rellenar

- **La clasificación de riesgo del AI Act no es uniforme dentro de un mismo sistema.** Un
  workflow de traducción y uno de cálculo de plazos procesales no son la misma cosa: el
  segundo produce un resultado del que depende un vencimiento. Clasifica por CASO DE USO,
  no por producto, y donde dudes entre dos categorías dilo explícitamente en vez de elegir
  la cómoda. Recuerda que el despacho es **usuario/responsable del despliegue** de sistemas
  de terceros y **proveedor** de los que construye él: son roles distintos con obligaciones
  distintas y no se pueden mezclar.
- **El uso de modelos open source cambia quién responde de qué.** Un workflow sobre Llama
  desplegado por el despacho no tiene detrás a un proveedor que asuma la documentación
  técnica: la asume el despacho.
- **La política interna aplicable ya existe y es tajante.** PI-30 prohíbe terminantemente
  introducir información confidencial o datos personales en herramientas de IA generativa de
  terceros. Todo sistema de la familia COMERCIAL_SAAS o PUESTO_TRABAJO debe llevar un campo
  que diga cómo se concilia su uso con esa prohibición: contrato con garantías, tenant
  aislado, filtro previo, o **conflicto no resuelto** si es lo que toca. Un «conflicto no
  resuelto» honesto vale más que una justificación inventada.
- **Los guardrails son del Plan, no tuyos.** El Plan describe control en tiempo real en la
  capa de orquestación para neutralizar inyecciones de prompt, evitar alucinaciones
  jurídicas y verificar la integridad de las fuentes. Modela esos tres como controles
  distintos, porque fallan de forma distinta.

### Además

- **8-12 evaluaciones** (una por sistema o caso de uso relevante) con la metodología del
  despacho: describe amenazas, medidas y residuo. Al menos una debe concluir que hace falta
  una evaluación de impacto reforzada, y al menos una debe quedar **en curso, sin
  conclusión**, porque un inventario en el que todo está evaluado y conforme no se lo cree
  nadie.
- **4-6 incidentes de IA** verosímiles en un despacho: una alucinación jurídica detectada en
  revisión antes de salir al cliente, un intento de inyección de prompt, una fuga de contexto
  entre asuntos en el RAG, una traducción con error material en una cláusula, un uso de
  Copilot sobre documentación de un asunto con muralla china. Cada uno con detección,
  contención, causa raíz y lección. **Todos resueltos o en seguimiento**, ninguno abierto sin
  gestionar.
- La partida de **25.000 € de auditoría externa de cumplimiento AI Act, seguridad técnica y
  análisis de sesgo** existe en el Plan: modélala como compromiso con fecha, no como hecho
  consumado.

### Formato

JSON con las claves `sistemas`, `evaluaciones`, `incidentes`, `controles_ia`. Cada elemento
con `firmeza`, `ancla` y `procedencia`. Al final, un array `dudas` con lo que no has podido
resolver sin preguntar al despacho.
```

---

## Prompt 2 — GRC (riesgo penal + ciberseguridad)

```
[PEGAR AQUÍ EL BLOQUE 0 ÍNTEGRO]

## Tu encargo

Generar el cuerpo GRC del tenant a partir de DOS anclas reales que ya tienes arriba: el Plan
de Sistemas 2025-2027 y la metodología de evaluación de riesgos penales del PPD.

### 1. Riesgos tecnológicos derivados del Plan de Sistemas — 15-20 registros

Uno por cada punto donde el propio Plan admite una brecha o una transición. El Plan es tu
guion: donde dice «migración», «sustitución», «PoC» o «renovación», hay riesgo de
transición; donde dice «aislamiento» o «blindaje», hay riesgo que se está mitigando.

Ejemplos del tipo de riesgo que espero (desarróllalos, no los copies):
- Convivencia de SAP ECC y S/4HANA durante la migración, con la segregación de funciones
  (SoD) partida entre dos sistemas.
- Superficie de los portales L4 expuestos a cliente mientras el WAF Azure está en despliegue
  Q1-Q4.
- Ventana entre la retirada de Tenable.AD y el régimen pleno de Defender for Identity.
- Movimiento lateral en zonas aún no microsegmentadas durante Q1-Q2.
- Custodia de claves durante la sustitución de PKI/CA.
- Fuga de contexto en el RAG de GA_IA al escalar de 100k a 10M páginas.
- Dependencia de un único QTSP del grupo para la firma y el eArchiving.

Cada riesgo con: probabilidad e impacto **evaluados con la metodología real del despacho**
(P1 × P2 normalizado, matriz contra impacto, nivel con su color), sistema afectado, nivel
L1-L4, controles existentes del Plan, controles previstos con su proyecto y trimestre, y
riesgo residual. **Usa los presupuestos y trimestres reales de los proyectos** cuando el
control previsto sea uno de ellos.

### 2. Catálogo de situaciones de riesgo penal por departamento — 4 departamentos

Replica la estructura del COR real: por delito, con su artículo del CP, y bajo cada uno
entre 3 y 6 situaciones concretas redactadas en infinitivo, del nivel de concreción de los
ejemplos que te he dado en las anclas.

Genera el catálogo para: **G-Digital / Tecnología**, **Fiscal**, **Laboral** y
**Litigación y Arbitraje**. Cada departamento tiene su propio perfil de exposición: no
repitas los mismos delitos en los cuatro. Ancla la selección de delitos en lo que ese
departamento hace de verdad.

**AVISO SOBRE LA FUENTE, y es importante:** el COR real de G-Digital que se ha usado como
modelo tiene un defecto de copia — su introducción dice que las situaciones fueron
identificadas por «los responsables del PPD del Departamento de Litigación y Arbitraje»,
aunque el documento es de G-Digital. **No reproduzcas ese error.** Cada catálogo que generes
debe nombrar en su introducción a su propio departamento. Si lo mencionas en algún sitio,
que sea como incidencia detectada en la fuente, no como texto heredado.

### 3. Incidentes de ciberseguridad y compliance RESUELTOS — 8-10

El usuario pide expresamente que estén resueltos. Que se note el cierre: cada uno con
cronología, detección, contención, erradicación, recuperación, causa raíz y lección
aprendida, y con el control que se reforzó después.

Ánclalos en la infraestructura real: el SOC corporativo y la inteligencia de Unit 42 son
quien detecta; el Red Team de Torres Colón es quien encuentra lo que se encuentra en
auditoría; Proofpoint es quien para el fraude por email.

Tipos que tienen sentido en un despacho: intento de BEC suplantando a un socio en una
instrucción de pago de un cierre de M&A; phishing dirigido a la práctica fiscal en campaña
de renta; exfiltración intentada por un saliente en su preaviso; ransomware contenido en una
oficina internacional; vulnerabilidad crítica en el WAF de un portal L4; acceso indebido a
un asunto con muralla china; pérdida de un dispositivo con borrado remoto por MDM; hallazgo
del Red Team en Torres Colón.

**Al menos dos deben tener consecuencia societaria o de gobierno**, no solo técnica: elevados
a un comité, con acuerdo o decisión documentada. Eso es lo que enlaza este módulo con
Secretaría.

### 4. Hallazgos de auditoría y planes de acción — 6-8 hallazgos

Con severidad, origen (auditoría interna, Red Team, experto externo PBC/FT, revisión del
PPD), órgano al que se reportan, y su plan de acción con responsable, hitos y estado. Mezcla
cerrados con en curso.

### Formato

JSON con `riesgos_tecnologicos`, `catalogos_penales_departamento`, `incidentes`,
`hallazgos`, `planes_accion`. Cada elemento con `firmeza`, `ancla`, `procedencia`. Para los
riesgos evaluados, incluye el desglose del cálculo (P1, P2, bruto, normalizado, banda) para
que sea auditable. Cierra con `dudas`.
```

---

## Prompt 3 — Secretaría societaria (filiales)

```
[PEGAR AQUÍ EL BLOQUE 0 ÍNTEGRO]

## Tu encargo

El histórico de acuerdos de la matriz **J&A Garrigues, S.L.P.** ya está cargado y actúa como
cabecera del grupo. Falta el cuerpo: los acuerdos de las FILIALES, que deben leerse como
consecuencia coherente de lo que decidió la matriz.

### Las tres familias de acuerdos

Para cada filial relevante del grupo (tienes 33 entidades; céntrate en las que son sociedad
con órgano propio, no en divisiones ni oficinas de representación):

1. **Formulación de cuentas anuales** por el órgano de administración, con su fecha, el
   ejercicio, la firma de los administradores y la mención de si hay o no informe de
   auditoría.
2. **Aprobación de cuentas y aplicación del resultado** por la junta general, posterior en
   el tiempo a la formulación y respetando los plazos legales de la LSC, con su depósito
   registral.
3. **Nombramiento y revocación de apoderados**, que es donde está lo interesante.

### La coherencia que quiero que construyas, que es el verdadero encargo

Los apoderamientos de las filiales tienen que **alinearse con los nombramientos centrales**.
Es decir: cuando la matriz designa a alguien para una función de grupo, eso se refleja hacia
abajo en las filiales donde esa función opera. Y cuando alguien cesa arriba, sus poderes
abajo se revocan, y la revocación tiene fecha posterior al cese, no anterior.

Construye por tanto:
- Una **cascada temporal verificable**: para al menos tres personas, la secuencia completa
  nombramiento central → apoderamientos en N filiales → (para una de ellas) cese central →
  revocaciones. Las fechas tienen que ordenarse solas.
- **Facultades diferenciadas por tipo de filial**: no tiene los mismos poderes un apoderado
  de la sociedad de servicios que uno de la sociedad tecnológica o de la SLP profesional.
- **Límites cuantitativos** en las facultades (importe máximo, mancomunado a partir de X),
  que es lo que hace creíble un poder.

### Restricciones jurídicas que NO puedes saltarte

- La matriz es una **SLP (Sociedad Limitada Profesional)** con **administrador único** y
  junta de socios de 346 socios. Sus acuerdos siguen ese régimen, no el de un consejo.
- Las filiales SLP se rigen por la Ley 2/2007 y por los estatutos, con mayorías reforzadas
  en las materias que la afectan.
- El plazo entre formulación y aprobación de cuentas tiene topes legales. Respétalos.
- Un apoderado no es un administrador. No mezcles el régimen de unos y otros.
- **Si no sabes si una materia exige mayoría reforzada, dilo en `dudas` en vez de decidirlo.**

### Volumen

Entre 40 y 60 acuerdos en total, repartidos por ejercicios 2024, 2025 y 2026, de forma que
el calendario societario se vea poblado y no todo caiga en el mismo mes.

### Formato

JSON con `acuerdos`, y por cada uno: entidad, órgano que adopta, tipo de acuerdo, materia,
fecha, quórum y mayoría alcanzados, texto del acuerdo en registro jurídico real, inscribible
sí/no, instrumento (escritura / instancia / ninguno), y estado registral. Añade
`cascadas_apoderamiento` explicando cada secuencia para que sea comprobable. Cierra con
`dudas`.
```

---

## Prompt 4 — Consola de gobernanza

```
[PEGAR AQUÍ EL BLOQUE 0 ÍNTEGRO]

## Tu encargo

Este prompt se ejecuta **el último**. No genera dato nuevo de dominio: genera la capa que
hace que todo lo anterior se lea como un sistema y no como cuatro silos.

Se te entregarán los resultados de los otros cuatro prompts (IA, GRC, Secretaría, canal de
denuncias). Tu trabajo es tejerlos.

### Lo que debes producir

1. **El grafo del grupo.** Nodos: entidades, órganos, personas con cargo, políticas,
   sistemas, riesgos, controles, acuerdos. Aristas tipadas y **cada una con la evidencia que
   la sostiene**: qué documento, acuerdo o registro acredita esa relación. Una arista sin
   evidencia es una arista que no debe existir.

2. **La vista completa de políticas.** Las 39 normas internas con: órgano propietario, ámbito
   de aplicación, qué obligaciones desarrolla, qué controles la implementan, qué riesgos
   mitiga y qué sistemas quedan bajo su alcance. **Regla dura: el ownership solo se atribuye
   donde la fuente lo dice.** Hoy solo 3 de las 39 tienen órgano acreditado; si tu tejido
   sugiere más, propónlos en un array aparte `ownership_propuesto` con su justificación, y
   **no los des por buenos**.

3. **Los indicadores de coherencia.** Esto es lo más valioso que puedes aportar, porque es lo
   que delata un dato sintético mal cosido. Calcula y reporta:
   - Riesgos sin control asociado, y controles que no mitigan ningún riesgo.
   - Políticas sin obligación derivada, y obligaciones sin política que las ampare.
   - Sistemas de IA sin evaluación, y evaluaciones que apuntan a sistemas inexistentes.
   - Incidentes cuya consecuencia societaria no tiene acuerdo correlativo en Secretaría.
   - Apoderamientos vivos de personas cuyo cargo central ya cesó.
   - Entidades sin órgano de administración, y órganos sin miembros vigentes.
   - Acuerdos cuya fecha es anterior a la constitución de la entidad que los adopta.

4. **El cuadro de mando.** Entre 8 y 12 indicadores con su valor derivado del dato real
   generado, no inventado. Cada uno con su fórmula explícita para que se pueda recalcular.

### La regla que gobierna este prompt

**No arregles las incoherencias que encuentres: repórtalas.** Si el módulo de GRC dice que un
incidente se elevó a un comité y en Secretaría no hay acuerdo de ese comité en esa fecha, eso
es un hallazgo, no un error a tapar. La consola vale precisamente por lo que detecta.

### Formato

JSON con `grafo` (`nodos`, `aristas`), `vista_politicas`, `ownership_propuesto`,
`incoherencias`, `indicadores`. Cierra con `dudas`.
```

---

## Prompt 5 — Canal de denuncias (Sistema Interno de Información)

```
[PEGAR AQUÍ EL BLOQUE 0 ÍNTEGRO]

## Tu encargo

Generar **3 expedientes** del canal interno de información, verosímiles en un despacho de
abogados grande. Tres, no más: en este módulo la calidad de cada expediente importa más que
el número.

### Marco real que ya existe en el tenant

El despacho tiene su Sistema Interno de Información regulado en la política **PI-31**, con
plazos procesales, libro-registro y supresión de datos a los tres meses, en línea con la
**Ley 2/2023**. El Canal Ético está modelado como control. Respeta ese marco: los plazos que
uses deben ser los de la ley y los estados del expediente deben encajar con un procedimiento
real de investigación interna.

### Los tres casos

Elige tres perfiles distintos entre sí en tipo, gravedad y desenlace. Al menos uno debe
**terminar sin acreditarse**, porque un canal en el que todo lo denunciado resulta cierto no
es creíble y además es injusto con el denunciado.

Perfiles que tienen sentido en un despacho de abogados:
- **Conflicto de interés no declarado**: un profesional que asesora a una parte teniendo
  vínculo con la contraparte, o que incumple una muralla china entre dos asuntos.
- **Uso indebido de información de cliente**: acceso a un expediente ajeno sin necesidad de
  conocer, o comentario de información sensible fuera de su ámbito.
- **Conducta en el entorno laboral**: acoso o trato degradante, que es materia de los
  artículos 184 y 173.1 CP que ya están en el mapa penal, con la sensibilidad que exige.
- **Facturación irregular**: horas imputadas a un asunto que no corresponden, que toca la
  política de honorarios PI-03.
- **Regalo o atención de un proveedor** por encima del umbral de la política, que toca PI-23
  sobre corrupción.

### Lo que hace bueno un expediente, y lo que quiero que cuides

- **Anonimato y confidencialidad tratados con rigor.** Distingue denuncia anónima de
  denuncia confidencial: no son lo mismo y tienen consecuencias distintas en la instrucción.
- **Trazabilidad temporal completa**: recepción, acuse en plazo, admisión o inadmisión
  motivada, instrucción, audiencia del afectado, conclusión y comunicación al denunciante.
  Con fechas que respeten los plazos legales.
- **Separación de funciones**: quien instruye no puede ser quien decide, y ninguno de los
  dos puede tener relación con los implicados. Hazlo explícito.
- **Protección frente a represalias**: al menos un expediente debe incluir el seguimiento
  posterior del denunciante.
- **Nada de nombres reales.** Personas de ficción, y en el expediente que trate materia
  sensible, redacción sobria y sin detalle morboso.
- **El desenlace tiene que ser proporcionado.** Si se acredita, la medida encaja con la
  gravedad; si no se acredita, se dice claramente y se cuida al denunciado.

### Enganche con el resto

Al menos uno de los tres debe **cruzarse con otro módulo**: que su conclusión motive el
refuerzo de un control del catálogo de GRC, o que se eleve a un comité y deje rastro en
Secretaría. Indica explícitamente ese cruce para que la consola pueda verificarlo.

### Formato

JSON con `expedientes`, cada uno con `id`, `canal_entrada`, `tipo`, `anonima`, `cronologia`
(array de hitos con fecha y actuación), `instructor`, `organo_decisor`,
`medidas_cautelares`, `conclusion`, `medidas_adoptadas`, `seguimiento_represalias`,
`cruce_modulos`. Cierra con `dudas`.
```

---

## Nota final para quien orqueste esto

**Orden de ejecución:** 1 (AIMS), 2 (GRC), 3 (Secretaría) y 5 (canal) pueden correr en
paralelo. **4 (consola) va el último y necesita la salida de los otros cuatro**, porque su
valor está en detectar lo que no cuadra entre ellos.

**Lo que hay que revisar a mano antes de sembrar nada**, porque es donde un modelo se
resbala: las fechas de las cascadas de apoderamiento, los plazos legales de cuentas y del
canal, y cualquier afirmación jurídica que se haya colado sin ancla. El resto puede pasar
con revisión ligera; esas tres cosas, no.
