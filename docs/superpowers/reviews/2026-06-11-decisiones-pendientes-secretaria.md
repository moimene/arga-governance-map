# Decisiones pendientes Secretaría (grupo NEEDS_HUMAN) — 2026-06-11

Ítems del backlog de estabilización que **no son auto-completables**: requieren una
decisión de producto/legal o un saneamiento de datos Cloud con criterio humano. Para
cada uno se da el defecto, la **decisión requerida** y la **recomendación**. Origen:
triaje paralelo verificado (workflow `wi9cty562`).

> Varios de estos son bugs de motor/migración **re-triables a corrección factual** (como
> ya hizo el loop con 9 BLOQUEADO-LEGAL): el bloqueo es la falta de validación legal del
> encuadre, no la imposibilidad técnica. Marcados con ⚖️ re-triable.

## P1 / alto riesgo

### ITEM-048 ⚖️ — Acuerdo sin sesión adopta con mayoría simple fija
- **Defecto:** `fn_no_session_close_and_materialize_agreement` (migración 20260514174503,
  ~líneas 244-245) resuelve `v_resultado = CASE WHEN votes_for > votes_against` —
  mayoría simple para TODA materia, ignorando `matter_class`/`tipoSocial`. Una
  modificación estatutaria por escrito se "aprobaría" sin la mayoría reforzada (arts.
  199/201 LSC).
- **Decisión:** ¿el cierre sin sesión debe replicar el motor V2 (arts. 198-201) o basta
  mayoría de administradores para acuerdos del consejo? **Recomendación:** evaluar la
  mayoría según `matter_class`+`tipoSocial` en la RPC (paridad con `evaluarVotacion`), o
  delegar el veredicto al snapshot del motor en vez de recalcular en SQL. Requiere
  migración Cloud + tests conductuales.

### ITEM-106 ⚖️ — Tramitador no verifica certificación previa (art. 107 RRM)
- **Defecto:** `TramitadorStepper` permite presentar a registro sin comprobar que el
  acuerdo tenga certificación firmada (`agreements_certified`), contra el art. 107 RRM
  (inscripción exige título: escritura/certificación).
- **Decisión:** ¿bloquear o solo advertir cuando falta certificación? **Recomendación:**
  WARNING accionable (coherente con la filosofía non-blocking del tramitador) + enlace a
  "Emitir certificación". Bloqueo duro solo si el Comité Legal lo exige.

### ITEM-027 — Payloads postAcuerdo de rule_packs con citas/plazos incorrectos
- **Defecto:** APROBACION_CUENTAS no modela depósito (arts. 279-280 LSC); AUMENTO_CAPITAL
  cita plazo "60 días" (art. 19.2 RRM = 1 mes); CESE_CONSEJERO exige ESCRITURA.
- **Decisión:** revisión legal de los payloads `postAcuerdo` por materia. **Recomendación:**
  corregir plazo a "1 mes" (fecha a fecha) y relajar CESE_CONSEJERO a certificación con
  firmas legitimadas; modelar depósito de cuentas. Requiere validación del Comité Legal +
  migración de rule_packs.

### ITEM-031 — Transmisión de participaciones SL sin gates (art. 106 LSC)
- **Defecto:** `TransmisionStepper` no exige, para SL/SLU, vínculo a acuerdo de junta /
  comunicación a administradores / documento público (art. 106 LSC).
- **Decisión:** ¿qué gates son obligatorios vs advertencias? **Recomendación:** WARNING con
  checklist (no bloquear el prototipo), documento público como recordatorio.

### ITEM-151 ⚖️ — Severidad de pactos parasociales mezclada con validez societaria
- **Defecto:** `pactos-engine.ts:436` marca `severity:'BLOCKING'` para incumplimiento de
  pacto; el orquestador mezcla esos blocking_issues con invalideces societarias. Un
  incumplimiento **contractual** (pacto parasocial, eficacia inter partes, art. 29 LSC) no
  invalida el acuerdo **societario**.
- **Decisión:** ¿el incumplimiento de pacto bloquea la proclamación societaria?
  **Recomendación (jurídicamente correcta):** NO — separar a un canal `pacto_blocking_issues`
  / severidad WARNING; el pacto se ejecuta inter partes, no anula el acuerdo. Confirmar con
  Comité Legal para el caso VETO de la Fundación (que sí puede tener eficacia reforzada por
  estatutos).

## P2 / medio

### ITEM-030 — Composición real del CdA ARGA no modelada
- Faltan: categoría (9 IND/5 EJE/1 DOM) en metadata, condición CONSEJERO paralela del
  presidente ejecutivo, VICEPRESIDENTE ×2 y CONSEJERO_COORDINADOR. **Decisión:** modelado
  del censo. **Recomendación:** seed que refleje CLAUDE.md (15+1) con `metadata.categoria`.

### ITEM-054 — Materias del UI sin rule_pack
- NOMBRAMIENTO_CESE, POLITICAS_CORPORATIVAS, REMUNERACION_CONSEJEROS sin pack. **Decisión:**
  ¿crear packs o mapear a OTROS_LIBRE? **Recomendación:** crear packs mínimos (mayoría
  ordinaria art. 198/201) para los inscribibles; marcar el resto "sin regla específica".

### ITEM-082 — 15 borradores de plantilla sin promover
- **Decisión:** Comité Legal de Plantillas: promover vs archivar; resolver solape
  FUSION/ESCISION vs FUSION_ESCISION. **Recomendación:** archivar los borradores no usados;
  FUSION_ESCISION como vía canónica.

### ITEM-095 — ERDS: copy promete notificación certificada no cableada
- **Decisión:** (a) cablear adaptador ERDS real con estados de entrega, o (b) corregir el
  copy y enlazar al módulo Comunicaciones. **Recomendación:** (b) para el prototipo —
  ajustar copy + actualizar CLAUDE.md; (a) cuando EAD Trust ERDS esté integrado.

### ITEM-091 — Polución de datos QA en Cloud
- 19 bodies QA + 1 JGA duplicada. **Decisión:** saneamiento. **Recomendación:** archivar/
  borrar con repunte de `meetings`, y añadir teardown a los specs destructivos. Requiere
  `db:check-target` + criterio sobre filas a preservar.
