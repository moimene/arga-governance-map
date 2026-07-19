# Plan de cierre de la versión española — 2026-07-19

> Origen: análisis multiagente (90 agentes, verificación adversarial de cada brecha:
> 44 confirmadas, 34 reclasificadas, 1 ya resuelta) sobre el informe del equipo legal
> `Análisis_del_Estado_del_Proyecto_Legal.docx` contrastado contra código y Cloud.
>
> Regla de lectura: el informe legal se escribió sobre documentos de mayo. La sección 1
> lista lo que ya no es cierto. **No trabajar el informe sin leer antes esa sección.**

# PLAN DE CIERRE — VERSIÓN ESPAÑOLA

Raíz del repo: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`. Todas las rutas siguientes son relativas a ella.

---

## 1. QUÉ DICE EL INFORME QUE YA NO ES CIERTO

Nueve afirmaciones han quedado desfasadas. Son las que conviene devolver primero al equipo legal, porque el informe se escribió sobre documentos de mayo y el módulo se movió mucho en junio y julio.

**1. "Las tres plantillas de riesgo alto/medio son deficientes."** Las tres se reescribieron después de mayo y están ACTIVA v1.0.1. NOMBRAMIENTO_AUDITOR recoge el rango 3–9 años del art. 264.1 LSC con reducción automática al máximo legal. DISTRIBUCION_CARGOS tiene rama `{{else}}` para no cotizadas y la ratificación del Secretario no Consejero ya es condicional. MODIFICACION_ESTATUTOS recoge el art. 287 con doble rama (texto íntegro e informe justificativo) y el art. 290 con elevación a público, inscripción y BORME. **El reproche de contenido no aplica; lo que persiste es que la app no hace cumplir lo que el texto ya dice.**

**2. "El ciclo registral no llega a INSCRITA."** Falso. Hay dos expedientes INSCRITA con número de inscripción (15 y 16) y referencia BORME, uno de ellos por la vía "calificación negativa → subsanada → inscrita". Lo cierto es otra cosa, y más grave: ningún estado terminal es alcanzable **operando la aplicación**; lo que hay en Cloud es fotografía SQL.

**3. "0 DENEGADA porque el modelo no lo contempla."** El modelo sí lo contempla y la fila existió: la creó la migración `20260613224000` y la revirtió `20260706194045` con el comentario literal *"DENEGADA no aparece en ninguna de las 4 vistas de la lista"*. Ese comentario además es erróneo: la vista "Todas" no filtra y existía desde siete semanas antes.

**4. "El QTSP opera con stubs y solo faltan credenciales."** Las credenciales `EAD_SUITE_*` ya están provisionadas y autentican contra la EAD Enterprise Suite; el proxy v2 está desplegado y la firma real está viva desde el 07/07. El riesgo cambió de naturaleza: ya no es "un stub se confunde con real", es **"una firma real todavía no producida se puede sellar como evidencia final"**.

**5. "No hay cierre transaccional de vigencia por cese."** Existe: RPC `fn_cesar_cargo` con advisory lock, validación de autoridad, nunca borra; modal "Cesar cargo" e histórico en `PersonaDetalle`; índice único que impide solapes (verificado: cero duplicados). El hueco real es distinto — un cargo con `fecha_fin` vencida sigue VIGENTE y computa (hoy, un consejero del CdA lleva siete semanas caducado y suma al quórum).

**6. "El dossier tiene 14 preguntas jurídicas pendientes y bloquea el panel."** Las P1–P14 se respondieron el 18/05, se aplicaron al contrato y el panel se conectó el 18/07 como fase 1 informativa, con contrato pinado por test. Lo genuinamente abierto se reduce a disolución/liquidación, validación de contenido de packs y tres materias diferidas a v0.2.0.

**7. "Hay rule packs duplicados sin resolver."** Cero contextos duplicados hoy: la consulta `GROUP BY materia, organo_tipo HAVING count(*)>1` sobre versiones activas devuelve vacío, y las supervivientes coinciden con el criterio de mayo.

**8. "Faltan materias en la versión española."** El inventario es amplio: 57 rule packs, 72 plantillas ACTIVA, 45 materias de catálogo. El problema no es volumen, es que tres catálogos (`materia_catalog`, `AGENDA_MATERIAS` y los ids sembrados en `rule_packs`) nunca se reconciliaron.

**9. "Cuando no hay pack, el sistema falla en silencio."** No. Devuelve BLOCKING, lo pinta en rojo, lo persiste como incidencia `RULE_PACK_NOT_PRODUCTION_READY` y, desde el 19/07, avisa nominalmente del desajuste de órgano. Emite igualmente porque el módulo es no bloqueante por diseño, pero nunca sin marca.

---

## 2. LA BRECHA REAL DE GOBERNANZA: LA FIRMA DE LAS PLANTILLAS

La verificación que propone el informe —comprobar que ninguna plantilla vigente carece de firma de aprobación— **devuelve cero incidencias, y es un falso negativo**.

Devuelve cero porque las 72 plantillas ACTIVA tienen el campo `aprobada_por` relleno. Lo que contiene ese campo es esto: 39 dicen `"Comité Legal ARGA — Secretaría Societaria (demo-operativo)"`, 18 la misma etiqueta sin tildes, y 15 `"Garrigues / Comité Legal"`. **Ninguna de las 72 identifica a una persona. 57 de 72 (79%) llevan literalmente escrito que son un marcador de demo.**

Toda la validación de forma que existe cabe en una línea (`src/lib/secretaria/template-admin/gate-pre.ts:102`): rechaza el campo vacío y el que empiece por "falta" o "pendiente". Es una lista negra de dos palabras que **bloquea al honesto que escribe "pendiente de firma" y deja pasar "(demo-operativo)"**. La RPC de servidor es aún más permisiva: solo comprueba que el campo no esté en blanco.

Y hay un segundo tramo peor: `src/lib/secretaria/legal-template-review.ts:186-198` calcula si una plantilla puede reclamar aprobación legal **sin mirar el contenido del campo**. Resultado verificado: esas 57 plantillas salen en pantalla con badge verde *"Aprobada legalmente"* y el texto *"Plantilla vigente con aprobación legal formal y sin incidencias de revisión detectadas"*. El sistema afirma como aprobación legal formal algo cuya propia firma dice que es demo.

**Qué significa de verdad.** El módulo es notablemente riguroso en lo mecánico —advisory lock, CAS, doble WORM, índice único de una sola ACTIVA por identidad, RBAC no automutable— y en el centro de ese blindaje hay un `text` sin validar que dice quién asume la responsabilidad jurídica. La integridad *del proceso* está garantizada; la autenticidad *del acto de aprobación* no se verifica en absoluto. Añádase que 35 de 72 ACTIVA no tienen sello de contenido y que, de las 37 que lo tienen, 32 ya no corresponden a su texto actual: la aprobación tampoco está atada a lo que se aprobó.

**Qué control técnico lo evita.** Tres piezas, ninguna de las cuales anticipa criterio jurídico:

- **Naturaleza de aprobación tipada.** Columna con dominio cerrado (`NOMINATIVA` / `COLECTIVA` / `MARCADOR_DEMO`) más `aprobada_por_persona_id` con FK a `persons`. Hoy la distinción existe en el texto y ningún código la lee; que el sistema sepa lo que ya está escrito.
- **Sello de contenido obligatorio y automantenido.** Trigger que recalcule `content_hash_sha256` al cambiar `capa1_inmutable`, y RPC que lo exija al activar e invalide la aprobación si cambia. Es el control de mayor valor inmediato: hoy el hash es metadato muerto que nadie lee.
- **Verificador que mire contenido, no presencia.** Que `legal-template-review` y el Gate PRE dejen de conceder aprobación legal a una firma con marcador de entorno, y que el guard viva **también en servidor** (hoy tres migraciones reescribieron texto de plantillas ACTIVA sin pasar por el gate, sin bump de versión y sin resellar: el hueco ya se materializó).

---

## 3. PLAN PRIORIZADO

### CARRIL INGENIERÍA — se puede hacer ya

**Fase A — Integridad probatoria. Release-crítica: cerrar ANTES de cualquier demo que ejercite firma real.**

*A1. Dejar de sellar lo que no está firmado.* El proxy termina en `activate` y devuelve `srStatus:"ACTIVE"` (firmantes notificados, documento sin firmar), pero `useQTSPSign` reporta "completada", fabrica `signed_at: new Date()` y devuelve `sandbox:false`; el gate solo degrada si `sandbox===true`, así que los cuatro call sites de GRC/AIMS graban WORM `SEALED`. Ficheros: `src/hooks/useQTSPSign.ts:118-129,143-153`, `src/lib/secretaria/evidence-sandbox-gate.ts:52-68`, `src/pages/grc/IncidenteDetalle.tsx:211`, `src/pages/grc/PenalAnticorrupcion.tsx:304`, `src/pages/grc/TPRM.tsx:167`, `src/pages/ai-governance/SistemaDetalle.tsx:183`. Corregir de paso el `documentUrl` a un bucket `evidence` que **no existe** (solo hay `matter-documents`). Verificación: `SELECT status,count(*) FROM evidence_bundles` sigue en 43 OPEN / 0 SEALED tras ejercitar el flujo, más test que asierte que sin firma completada no se persiste SEALED. Hoy la ventana sigue abierta; el riesgo se consuma la primera vez que alguien firme en real.

*A2. Cerrar el ciclo de firma.* Persistir `caseFileId` (hoy `src/lib/qtsp/qtsp-proxy-client.ts:50-62` lo descarta, lo que deja inutilizable la acción `status` del proxy, ya implementada en `supabase/functions/qtsp-proxy/index.ts:308-328`), cablear polling o webhook propio de finalización, recuperar el documento firmado y el certificado, y re-archivar. Corregir `signed_by:"EAD Trust"` en `src/pages/secretaria/GenerarDocumentoStepper.tsx:668`, que hoy etiqueta como firmado un binario sin firmar.

*A3. Firma de certificaciones.* Es un stub fabricado en el cliente: `btoa("qtsp:demo:"+id)` en `src/components/secretaria/EmitirCertificacionButton.tsx:231-232` y `EmitirCertificacionAcuerdoButton.tsx:53-54`; la RPC acepta `p_qtsp_token` y lo **descarta**. En Cloud, 7 de 7 certificaciones están SIGNED con token ASCII `tsq:demo:`. Cablear el proxy, persistir el token y la procedencia, y quitar el chip verde "Firma: Firmada" de `src/pages/secretaria/ActaDetalle.tsx:921-930`.

*A4. Copy.* Retirar la afirmación "certificado cualificado (QES)" allí donde el código emite `INTERPOSITION`: `GenerarDocumentoStepper.tsx:1486,1492,1503`, `ExpedienteAcuerdo.tsx:1690,1861`, y sobre todo `supabase/functions/qtsp-proxy/index.ts:199,214`, donde la etiqueta "Firma QES" viaja al expediente que custodia el propio QTSP. Sustituir por término neutro y verdadero hasta que el Comité decida.

**Fase B — Gobernanza de plantillas (la brecha de la sección 2).**

B1: que `legal-template-review.ts:186-198` deje de conceder "Aprobada legalmente" con marcador demo. B2: trigger de recálculo de `content_hash_sha256` + exigencia en `fn_secretaria_transition_template_state` (hoy la línea 683 solo lo anula al degradar) + backfill de las 32 divergentes y 35 nulas. B3: columna de naturaleza de aprobación con FK a `persons`, exigida en gate **y** en RPC. Verificación: consulta que compare `content_hash_sha256` con `encode(digest(capa1_inmutable,'sha256'),'hex')` → 100% coincidente en ACTIVA; y cero ACTIVA con marcador demo etiquetada como aprobada legalmente.

**Fase C — Cerrar el ciclo registral (es el golden path español).**

C1 (minutos): pestañas "Denegadas" y "Elevadas" en `src/pages/secretaria/TramitadorLista.tsx:13-26` — nótese que ELEVADA es el único estado que la app escribe de verdad y hoy no tiene vista propia. C2 (días): formulario de captura de calificación en el paso 5 del `TramitadorStepper` que escriba `status` ∈ {INSCRITA, SUBSANACION, DENEGADA} más `inscription_number`, `borme_ref` y `defect_details`; las columnas ya existen y la RLS ya lo permite. C3: renderizar `defect_details`, hoy dato muerto (solo declarado en `src/hooks/useTramitador.ts:26`). C4: propagación filing→agreement para INSTRUMENTED/FILED/REGISTERED. C5: CHECK sobre `registry_filings.status` con el vocabulario ya canónico de ITEM-102 (el valor `EN_TRAMITE` presente en Cloud ya está fuera de él) y trigger de auditoría WORM, del que esta tabla carece por completo. C6: sanear la fila `ad6718b1`, hoy en SUBSANACION con `calificacion:'negativa'` y `subsanable:false`.

**Fase D — Auditoría.**

D1: `minutes` está fuera de la cadena WORM y admite DELETE sin traza — `CREATE TRIGGER trg_audit_worm_minutes` calcado del patrón de `20260419173059` más policy que deniegue DELETE. Horas, y es el instrumento probatorio central. D2: `actor_id` es NULL en el 100% de las 3402 entradas de `audit_log`; escribir `(claims->>'sub')::uuid` en `fn_audit_worm` e incluir el actor en la receta del hash (precedente de re-anclaje: ITEM-045). D3: guard que impida gate de certificación degenerado sobre `NO_SNAPSHOT_HASH` (5 de 7 certificaciones lo tienen).

**Fase E — Captura tipada de Capa 3 (riesgo de veracidad jurídica).**

Hoy 42 campos booleanos y 48 numéricos de plantillas ACTIVA se capturan como textarea libre, y en Handlebars `"No"` es verdadero: 19 campos booleanos gobiernan un `{{#if}}` directo en 13 plantillas con ramas de cita legal divergente (régimen de cotizada vs art. 217 LSC, etc.). Widget tri-estado y numérico con min/max en `src/components/secretaria/Capa3Form.tsx:248-265` y coerción real en `src/lib/secretaria/capa3-fields.ts:341-360` (ojo también a la línea 109, que convierte `false` nativo en la cadena `"false"`). Añadir el rango 3–9 del auditor como `min`/`max` en el contrato de campo de la plantilla, no como quinto literal en código. Derivar `es_cotizada` de `entities` reutilizando `convocatoria-capa3-resolver.ts:207-213`, poblando antes `regulated_sector` (NULL en 30 de 31 entidades). Y corregir el fallo simétrico: el resolver siembra `"Sí"` y las plantillas comparan contra `"SÍ"`, de modo que la cláusula de cotizada nunca se imprime.

**Fase F — Reconciliación de catálogos (alto retorno, bajo coste).**

F1: `src/hooks/useModelosAcuerdo.ts:55` matchea por igualdad literal e ignora `materia_template_binding`, así que un expediente de FUSION o ESCISION **no ve** la plantilla ACTIVA `FUSION_ESCISION`. Horas. F2: `src/hooks/useAgreementCompliance.ts:411-413` usa `.find()` ciego al órgano y puede aplicar en silencio el pack de Consejo a un acuerdo de Junta — este es el camino peligroso. F3: alimentar el desplegable de materia del orden del día desde `materia_catalog` para las ~11 materias ORDINARIA/ESTATUTARIA/ESTRUCTURAL alcanzables (las 6 de clase ESPECIAL están bloqueadas por CHECK de BD). F4: pinar en test el alias `CAMBIO_DOMICILIO_SOCIAL` y su comportamiento por órgano.

**Fase G — Higiene de vigencias y datos.**

`src/pages/secretaria/Calendario.tsx:137` expulsa el mandato el día que caduca mientras el KPI sí lo cuenta: quitar la cota inferior. Guarda de `fecha_fin` en `useFirmantesVigentes`/`usePresidenteVigente`. Deep-link desde el expediente de cese adoptado al modal de cese, más columna de trazabilidad `agreement_id` en `condiciones_persona`. Captura tipada de la prueba de publicación de convocatoria (art. 173.1 LSC): `publication_evidence_url` existe y no tiene ningún escritor. Exigir evidencia al legalizar libro. Corregir `body_id` NULL en 311 de 355 libros, que hace que la misma acta se cuente en varios. Backfill de `payload_hash` en los 15 rule packs activos sin sello, más trigger que lo calcule. Corregir `CLAUDE.md:67`, que pide provisionar `EAD_TRUST_*` (ignoradas desde el proxy v2) y presenta la firma real como pendiente cuando está activa.

### CARRIL COMITÉ LEGAL — bloqueado

**L1 — Naturaleza de la aprobación de plantillas.** *"¿Qué acredita que una plantilla está vigente: basta el acuerdo de un órgano colegiado, o hace falta persona física identificada? ¿Se exige colegiación? ¿Debe llevar firma electrónica cualificada del aprobador? Y las 72 plantillas ACTIVA actuales —57 con marcador demo-operativo y 35 sin ningún metadato estructurado de aprobación—: ¿se re-aprueban, se archivan y reemiten, o quedan con vigencia condicionada?"* Bloquea el cierre de la Fase B y el saneamiento del inventario.

**L2 — Contenido cambiado tras la aprobación.** *"32 plantillas ACTIVA tienen hoy un texto distinto del que se selló al aprobarlas (p. ej. CESE_CONSEJERO v1.1.1, aprobada el 10/05, con contenido posterior y misma versión). ¿Se re-sella el hash —lo que equivale a declarar que el texto actual es el aprobado—, se re-aprueba, o se archiva? ¿Toda modificación de `capa1_inmutable` obliga a bump de versión?"* Bloquea B2 en su tramo de saneamiento; el trigger y la exigencia hacia delante se pueden hacer ya.

**L3 — Taxonomía de subtipo por materia.** *"¿Cuáles son los subtipos de cese por Consejo (renuncia / cese automático / propuesta a la Junta), de disolución (voluntaria art. 368 / causa legal art. 363.1.e / pérdidas art. 363.1.f) y de modificación estructural, quién los declara y en qué punto del expediente?"* Es la pregunta de mayor apalancamiento del carril: desbloquea el gate estructural de alcance, permite sacar del cuerpo del acuerdo las notas entre corchetes que hoy se imprimen (son la única barrera existente), y hace que el panel de perfil deje de emitir incidencias irresolubles.

**L4 — Comisión delegada.** *"¿Qué materias son delegables conforme al art. 249 bis LSC, y de dónde derivan quórum y mayoría de una comisión delegada —estatutos, reglamento del Consejo? ¿La discrepancia de órgano debe bloquear la elevación a escritura o basta advertir?"* Hoy hay 11 órganos reales, 16-20 materias ofrecidas, dos plantillas propias y cero packs.

**L5 — Cinco materias de Consejo sin pack.** *"FINANCIACION, CONTRATACION_RELEVANTE, COMITES_INTERNOS, POLITICAS_CORPORATIVAS y SEGUROS_RESPONSABILIDAD: ¿procede pack propio o basta el régimen general de los arts. 247.2/248 LSC? Si procede, ¿quórum, mayoría, delegabilidad y antelación?"*

**L6 — Ratificación de las correcciones de junio a los rule packs.** *"Las correcciones de quórum SL, mayoría reforzada SA (art. 201.2), mayoría de Consejo (arts. 248.1/249.3) y mayoría SL (art. 198) se aplicaron como corrección factual contra el BOE, sin firma del Comité. ¿Se ratifican? ¿Y cómo se resuelve el borde de concurrencia exactamente del 50% en el art. 201.2?"*

**L7 — Disolución y liquidación.** *"¿Dos materias con perfil propio, o liquidación como workflow post-acuerdo? ¿Quórum y mayoría diferenciados por causa? ¿Y cómo se resuelve la contradicción entre el catálogo, que exige unanimidad para LIQUIDACION (art. 374 LSC), y su rule pack activo, que aplica el art. 199.a?"*

**L8 — Calificación registral.** *"¿Taxonomía de la calificación: denegación total frente a suspensión por defectos subsanables? ¿Qué familia de códigos de defecto es la correcta —los actuales, RRM-58 y RM-201, los inventó una migración? ¿La inscripción debe cascadear el acuerdo a REGISTERED, y qué se está afirmando con ello frente a terceros?"* Sin esto no se puede resembrar la fila DENEGADA ni fijar el elenco definitivo de estados.

**L9 — Interposición frente a QES.** *"El proxy emite `signatureType: INTERPOSITION` (certificado del prestador) mientras la interfaz dice QES (certificado del firmante). ¿Es oponible ante el Registro Mercantil una firma por interposición para actas y certificaciones? ¿Qué denominación debe mostrarse al usuario y constar en el expediente?"*

**L10 — Evidencia final productiva.** *"¿Qué artefacto concreto de EAD Trust —certificado de finalización, sello, sello de tiempo cualificado, LTV— basta para declarar la evidencia como SEALED y retirar el disclaimer de entorno de validación?"* Requiere antes confirmación contractual con EAD Trust sobre la aptitud de la cuenta actual, que no es verificable desde el código.

**L11 — Vigencia del cargo caducado.** *"¿El vencimiento de `fecha_fin` extingue el cargo por sí solo? El art. 222 LSC en relación con el art. 145 RRM apunta a que el mandato caducado subsiste hasta la siguiente Junta, lo que sugiere un tercer estado distinto de VIGENTE y de CESADO. ¿Existe ese estado? ¿El caducado computa en el quórum?"* Mientras no se responda, **no debe introducirse cierre automático alguno**.

**L12 — Legalización de libros.** *"¿Qué acredita la legalización: número de entrada o asiento del Registro, fecha, CSV del sello, diligencia? ¿Y qué constituye asiento en cada tipo de libro; el libro de actas exige numeración propia?"*

---

## 4. LO QUE NO HAY QUE HACER AHORA

**Multi-jurisdicción.** Aplazada expresamente. Nada de BR/MX/PT, SIGER/PSM/JUCERJA/Conservatória, ni traslado de domicilio fuera del territorio nacional. Todo el plan anterior es núcleo ES, y ninguna de sus piezas depende de ese carril.

**No promover el panel de perfil de ejecución a fase 2.** Los gates bloqueantes están deliberadamente desconectados, hay contract test que lo pina y la autorización expresa solo cubre la fase informativa. Convertirlos en checkpoint sin decisión del Comité es exactamente la regresión que ese test intenta impedir.

**No crear trigger ni cron que ponga CESADO por `fecha_fin`.** Convertiría un dato sucio visible en un cargo extinguido por decisión de una máquina, y probablemente contra el art. 222 LSC. Señalizar sí; cerrar no.

**No re-sellar los 32 hashes divergentes "para que cuadren".** Sería normalizar en silencio cambios de contenido que nadie revisó. El trigger hacia delante sí; el saneamiento hacia atrás espera a L2.

**No resembrar la fila DENEGADA con el código RRM-58** antes de que Legal valide la taxonomía, y no resembrarla nunca sin haber añadido antes la pestaña: se reproduciría exactamente la situación que llevó a degradarla el 06/07.

**No convertir el depósito de cuentas en materia propia del catálogo.** El Comité ya decidió lo contrario el 12/06 (modelado como obligación post-acuerdo en el pack de APROBACION_CUENTAS); abrirlo exigiría revocar una decisión existente, no rellenar un hueco.

**No sembrar rule packs nuevos antes de reconciliar los catálogos.** El mapa de alias es el parche acumulado de esa divergencia; añadir packs encima multiplica el problema.

**No ampliar la superficie ERDS ni provisionar más entornos QTSP antes de cerrar la Fase A.**

**No abrir el rediseño de Procesos societarios ni la segregación de módulos a repos.** Fuera de la ruta de cierre ES.

---

## 5. DEFINICIÓN DE HECHO

La versión española está cerrada cuando **todo** lo siguiente es verificable, no opinable:

**Integridad probatoria.** Ningún `evidence_bundle` en estado SEALED sin artefacto de firma completada recuperado del QTSP. Cero `signed_at` generados en cliente. El documento archivado es el firmado, o está etiquetado `ORIGINAL_DOCX` con `signed_by` coherente. Ninguna cadena de interfaz afirma "certificado cualificado QES" donde el código emite INTERPOSITION. Cero certificaciones con token `qtsp:demo:` o `tsq:demo:`.

**Gobernanza de plantillas.** Consulta que compare `content_hash_sha256` con `sha256(capa1_inmutable)` → 100% coincidente en ACTIVA, cero nulos. La RPC rechaza activar sin sello. Cero plantillas con marcador de entorno presentadas como "Aprobada legalmente". El Gate PRE detecta colisión de clave entre Capa 2 y Capa 3 y notas editoriales en el cuerpo. Existe guard equivalente en servidor, de modo que una migración no pueda reescribir texto de una ACTIVA sin resellar.

**Ciclo registral.** Se puede recorrer íntegramente en la aplicación ELEVADA → PRESENTADA → (INSCRITA | SUBSANACION | DENEGADA) con captura de número de inscripción, BORME y defectos. Existe al menos una fila de cada estado **producida operando el producto**, identificable por `updated_at` posterior a la última migración de seed. `agreements.REGISTERED` se escribe por propagación, no por UPDATE de migración. `registry_filings` tiene CHECK de estado y trigger de auditoría.

**Auditoría.** `audit_log` contiene entradas de `minutes` y de `registry_filings`. Toda entrada nueva lleva actor identificado. `fn_verify_audit_chain` devuelve `chain_valid=true`. Ningún gate de certificación se calcula sobre constantes centinela.

**Capa 3 y motor.** Cero campos declarados `boolean` o `number` renderizados como textarea. Cero `{{#if}}` sobre cadena libre en plantillas ACTIVA. El rango 3–9 del auditor se aplica en el camino vivo. Cero materias de agenda con plantilla activa y sin pack alcanzable, salvo decisión legal registrada de que no procede. `useModelosAcuerdo` resuelve por binding. Ningún pack sombreado por alias sin test que lo fije.

**Vigencias.** Cero condiciones VIGENTE con `fecha_fin` vencida sin señalizar en pantalla. KPI y calendario coinciden.

**Gates técnicos.** `bun run db:check-target` contra `governance_OS`; `bun test`, `bun run typecheck`, `bun run lint`, `bun run build` verdes; e2e de Secretaría en lotes; toda migración aplicada en Cloud con espejo en `supabase/migrations/` y verificada.

**Cierre legal.** Acta del Comité Legal con respuesta expresa a L1–L12, y las 72 plantillas ACTIVA re-aprobadas, archivadas o marcadas con vigencia condicionada conforme a esa respuesta.

Mientras las tres últimas líneas no existan, la versión española puede estar técnicamente completa pero **no puede presentarse como cerrada**: el sistema seguiría afirmando aprobaciones que su propia base de datos califica de demo.