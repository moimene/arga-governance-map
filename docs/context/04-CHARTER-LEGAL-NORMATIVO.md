# 04 · Charter legal y registro normativo

> **Cabecera viva.** Última revisión: 2026-06-13.
> **Naturaleza de este documento:** es un **mapa de orientación de producto**, no asesoramiento jurídico. El criterio jurídico autoritativo lo fija **Garrigues**; la herramienta **asiste y traza**, no sustituye al letrado. Toda referencia normativa con fecha o estado **debe verificarse antes de usarse** en un contexto real; los ítems volátiles van marcados como `⚠ VERIFICAR`.
> Relacionados: `→ 01` north star, `→ 02` instrucciones, `→ 03` módulos.

---

## Por qué un charter legal

Es una herramienta de **procesos corporativos críticos y, sobre todo, legales**: convocar y constituir órganos, adoptar y certificar acuerdos, inscribir y publicar, sellar evidencia con valor jurídico. Un error aquí no es un bug de UX: puede viciar la validez de un acto societario o la fuerza probatoria de una evidencia. De ahí el **máximo rigor legal y normativo** como primer principio del proyecto (`→ 02`).

---

## Principios no negociables de rigor legal

1. **No inventar derecho.** Plazos, quórums, mayorías, materias inscribibles, instrumentos y efectos se basan en norma citable o en criterio del despacho. Si no hay base, se dice «no determinado» y se escala; no se improvisa.
2. **Jerarquía normativa explícita.** El motor resuelve LEY → ESTATUTOS → PACTO PARASOCIAL → REGLAMENTO, en ese orden, y lo **explica** (cada resultado trae su `ExplainNode`/base estatutaria). Nada de cajas negras.
3. **Trazabilidad probatoria.** Toda adopción relevante genera hilo de evidencia: snapshot de censo WORM, hash encadenado de auditoría, firma cualificada (QES), sellado de tiempo y, donde aplica, notificación certificada (ERDS). La evidencia es propiedad del sistema, no un parche.
4. **Honestidad de finalidad probatoria.** No se declara una evidencia como «final/sellada» si está en sandbox o HOLD. Los gates de promoción son explícitos. (Migración de evidence/legal hold en HOLD: no promover.)
5. **Separación de funciones (SoD) y capacidad.** RBAC con pares tóxicos y capability matrix: quién puede hacer snapshot, votar o certificar está reglado, no es libre.
6. **Inmutabilidad donde la ley lo pide.** `censo_snapshot` y la cadena de auditoría son append-only/WORM; los intentos de mutación se rechazan por trigger.
7. **Multi-jurisdicción con normalización previa.** Antes de extender a otra jurisdicción (PT/BR/MX) se pasa por una **matriz de normalización jurisdiccional**; no se asume que la regla española aplica fuera.
8. **Vigencia verificada.** Lo volátil (AI Act/omnibus, NIS2, revisión de Solvencia II, CSRD) se marca y se verifica antes de afirmarlo. Mejor «verificar vigencia» que una cita caduca.
9. **Cotizadas: evaluar y advertir, no bloquear.** El motor no bloquea sociedades cotizadas; evalúa LSC y emite advertencias LMV/buen gobierno (decisión DL-2).
10. **Privacidad y minimización.** Datos personales de consejeros/socios tratados con base jurídica, minimización y retención reglada (RGPD/LOPDGDD).

---

## Registro normativo (norma → módulo → obligación → evidencia)

> Mapa orientativo para el producto. **No es asesoramiento.** Verificar vigencia de cada entrada antes de uso real. Marcas: `✓ estable` (norma consolidada), `⚠ VERIFICAR` (estado/calendario en evolución).

### Derecho societario y mercantil (núcleo Secretaría)

| Norma | Referencia | Estado | Módulo | Obligación / función que soporta | Evidencia / artefacto |
|---|---|---|---|---|---|
| Ley de Sociedades de Capital (LSC) | RDL 1/2010 | ✓ estable | Secretaría | Convocatoria, constitución/quórum, mayorías (ordinaria/reforzada/unanimidad), materias estatutarias y estructurales, inscribibilidad, decisiones de socio único, acuerdos sin sesión | Motor LSC + `ExplainNode`; acta; certificación; compliance snapshot |
| Ley de los Mercados de Valores y de los Servicios de Inversión | Ley 6/2023 (sustituye RDL 4/2015) | ✓ estable | Secretaría (cotizadas) | Especialidades de sociedades cotizadas; advertencias, no bloqueo (DL-2) | Advertencias LMV en el flujo; board pack |
| Código de Buen Gobierno de las sociedades cotizadas (CNMV) | versión CNMV vigente | ⚠ VERIFICAR versión | Secretaría / Console | Recomendaciones de buen gobierno (composición, comisiones, voto de calidad, independientes) | Board pack; advertencias de gobierno |
| Reglamento del Registro Mercantil (inscripción) | RRM y normativa registral | ✓ estable | Tramitador registral | Instrumentación (escritura/instancia), inscripción, calificación, subsanación | Expediente registral; estados FILED/REGISTERED/PUBLISHED |
| Pactos parasociales | doctrina + estatutos | ✓ estable | Secretaría | Vetos, consentimientos, mayorías reforzadas pactadas (p. ej. pacto Fundación ARGA) | Motor de pactos; resultados WORM |

### Sector asegurador (contexto del cliente demo)

| Norma | Referencia | Estado | Módulo | Obligación / función | Evidencia |
|---|---|---|---|---|---|
| Solvencia II — sistema de gobierno | Directiva 2009/138/CE y su revisión | ⚠ VERIFICAR revisión | Console / GRC | Sistema de gobierno, fit & proper, funciones clave, gestión de riesgos | Readiness de gobierno; trazas GRC |
| Ordenación, supervisión y solvencia de aseguradoras (ES) | normativa española de transposición | ⚠ VERIFICAR | Console / GRC | Encaje del gobierno del grupo asegurador | Documentación de gobierno |

### Riesgo, cumplimiento, ciber y resiliencia (GRC Compass — prototipo)

| Norma | Referencia | Estado | Módulo | Obligación / función | Evidencia |
|---|---|---|---|---|---|
| DORA — resiliencia operativa digital | Reg. (UE) 2022/2554 (aplica desde 17-ene-2025) | ✓ estable | GRC (DORA) | Gestión de riesgo TIC, incidentes, RTO/RPO, BCM, riesgo de terceros TIC | Incidentes; planes; registros |
| NIS2 — ciberseguridad | Dir. (UE) 2022/2555; transposición ES | ⚠ VERIFICAR transposición | GRC (Ciber) | Medidas de ciberseguridad, notificación de incidentes | Incidentes; vulnerabilidades |
| Responsabilidad penal de la persona jurídica | art. 31 bis Código Penal; UNE 19601 (compliance penal) | ✓ estable | GRC (Penal/Anticorrupción) | Modelo de prevención de delitos, controles anticorrupción | Riesgos/controles/obligaciones (vista conectada) |
| Prevención de blanqueo (PBC/FT) | Ley 10/2010 | ⚠ VERIFICAR aplicabilidad | GRC | Diligencia debida, según alcance del grupo | Controles; obligaciones |
| Seguridad de la información | ISO/IEC 27001 | ✓ estable | GRC / plataforma | SGSI, controles de seguridad | Controles; evidencias |

### Gobernanza de la IA (AI Governance / AIMS 360 — prototipo)

| Norma | Referencia | Estado | Módulo | Obligación / función | Evidencia |
|---|---|---|---|---|---|
| Reglamento de IA (AI Act) | Reg. (UE) 2024/1689 (en vigor 1-ago-2024; aplicación escalonada) | ⚠ VERIFICAR calendario | AIMS | Clasificación por riesgo, technical file, obligaciones de sistemas de alto riesgo, incidentes IA | Posture de technical file; incidentes IA |
| «Digital Omnibus» sobre IA | acuerdo político provisional 7-may-2026 | ⚠ VERIFICAR (provisional) | AIMS | Posible aplazamiento de obligaciones de alto riesgo (Anexo III → 2-dic-2027; Anexo I → 2-ago-2028, según texto provisional) | Nota de seguimiento regulatorio |
| Sistema de gestión de IA | ISO/IEC 42001:2023 | ✓ estable | AIMS | SGIA, evaluaciones, ciclo de vida del modelo | Evaluaciones (alta aún limitada por RLS) |

### Confianza digital, firma y evidencia (backbone transversal)

| Norma | Referencia | Estado | Módulo | Obligación / función | Evidencia |
|---|---|---|---|---|---|
| eIDAS2 — identidad y servicios de confianza | Reg. (UE) 2024/1183 (modifica Reg. 910/2014) | ⚠ VERIFICAR hitos 2026 | Evidence backbone / QTSP | Firma cualificada (QES), sello (QSeal), sellado de tiempo, notificación certificada (ERDS), wallet | Pipeline QTSP (EAD Trust); bundles sellados |
| Alineamiento QTSP a eIDAS2 | calendario eIDAS2 (hito sept-2026 para TSP; EUDI wallets dic-2026) | ⚠ VERIFICAR | Evidence backbone | Cumplimiento del proveedor de confianza | Verificación de Trust Center |

### Datos personales y sostenibilidad (transversal / futuro)

| Norma | Referencia | Estado | Módulo | Obligación / función | Evidencia |
|---|---|---|---|---|---|
| RGPD | Reg. (UE) 2016/679 | ✓ estable | Transversal | Base jurídica, minimización, retención, derechos | Políticas de retención; legal hold |
| LOPDGDD (ES) | LO 3/2018 | ✓ estable | Transversal | Especialidades españolas de protección de datos | Idem |
| CSRD — información de sostenibilidad | Dir. (UE) 2022/2464; paquete Omnibus de simplificación | ⚠ VERIFICAR (calendario alterado) | Futuro (ESG) | Reporte de sostenibilidad, gobernanza ESG | Pendiente (dominio futuro) |

---

## Decisiones legales del motor ya resueltas (ancladas)

Seis decisiones legales del motor LSC están resueltas (2026-04-19; detalle en `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`). Las dos de mayor impacto:

- **DL-2 — Cotizadas:** el motor **no bloquea** sociedades cotizadas; **evalúa LSC y advierte** sobre LMV/buen gobierno.
- **DL-4 — Plantilla SA/SL:** selección automática de plantilla según tipo social.

El resto (incl. DL-6, retribución de consejeros demo) están en el mismo spec. No reabrir sin motivo.

---

## Cómo se aplica este charter en el trabajo

- **Antes de afirmar una norma con fecha/estado:** comprobar la marca del registro. Si es `⚠ VERIFICAR`, verificar (búsqueda web actual) o decir explícitamente que requiere verificación.
- **Si una tarea toca validez o evidencia:** ir despacio, citar fuente, no declarar finalidad probatoria sin gate.
- **Si surge una cuestión jurídica nueva no resuelta:** redactar la consulta y **escalar a criterio del despacho** (Garrigues) en lugar de codificar derecho de memoria.
- **Mantener este registro:** cuando una norma cambie de estado (p. ej. se publique la transposición de NIS2 o se cierre el Digital Omnibus), actualizar la fila y su marca.
