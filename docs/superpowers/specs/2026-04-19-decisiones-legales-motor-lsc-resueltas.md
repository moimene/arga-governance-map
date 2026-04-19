# Decisiones Legales del Motor de Reglas LSC — Resueltas

**Fecha:** 2026-04-19
**Estado:** Todas resueltas (6/6)
**Origen:** `docs/legal-team/gap-analysis-motor-reglas-lsc.md` (sección 2.5)
**Contexto:** ARGA Seguros = SA cotizada (equivalente IBEX 35). Estructura: Fundación ARGA → Cartera ARGA (100%) → 69.69% ARGA Seguros S.A. Free float 30.31%.
**Fuente datos retribución:** Informe Anual de Remuneraciones (IAR) 2025 de la entidad de referencia.

---

## DL-1. Alcance jurisdiccional de los Rule Packs

### Resolución
**ES para demo + PT como preview jurisdiccional.**

### Detalle
- Los 16 Rule Packs actuales cubren exclusivamente derecho español (LSC) y son correctos para la demo ARGA.
- Portugal (CSC — Código das Sociedades Comerciais) se incluye como primera extensión jurisdiccional, usando la tabla `rule_param_overrides` ya existente.
- Brasil (LSAB — Lei 6.404/76) y México (LGSM) se abordan post-GA mediante la Matriz de Normalización Jurisdiccional (tabla `jurisdiction_concept_map` diseñada en Sprint E).
- Se documenta como limitación explícita en la demo: "Motor LSC v1.0 — cobertura ES completa, PT preview".

### Cambios requeridos
- **Código:** Ninguno. La infraestructura de overrides ya existe.
- **Datos:** Crear overrides PT para las materias más comunes (APROBACION_CUENTAS, NOMBRAMIENTO_CESE, MOD_ESTATUTOS) con plazos y quórums del CSC portugués.
- **Urgencia:** Baja — no bloquea la demo.

---

## DL-2. Entidades cotizadas — evaluar + advertir (NO bloquear)

### Resolución
**El motor DEBE evaluar entidades cotizadas.** Aplica la LSC normalmente y añade una capa de advertencias LMV (Ley del Mercado de Valores) como WARNING, no como BLOCKING.

### Rationale
ARGA Seguros S.A. es una SA cotizada (equivalente IBEX 35). El BLOQUEO actual (`BORDE_COTIZADA → FUERA_DE_ALCANCE` con early return) impide usar el motor en la entidad principal de la demo. El motor debe evaluar todo lo que cubre la LSC (quórums, mayorías, convocatoria, documentación) y ADEMÁS advertir sobre requisitos adicionales de la LMV que el secretario debe verificar manualmente.

### Advertencias LMV a añadir (severity: WARNING)
1. **CNMV — hecho relevante:** Ciertos acuerdos del CdA (operaciones significativas, cambios de control, ampliaciones de capital) pueden requerir comunicación como hecho relevante a la CNMV.
2. **MAR art. 17 — información privilegiada:** Si el acuerdo constituye información privilegiada (IPDD), debe publicarse antes de que el mercado abra o inmediatamente.
3. **Operaciones vinculadas art. 231 LSC:** Transacciones entre la sociedad cotizada y partes vinculadas (consejeros, accionistas significativos) requieren informe favorable del Comité de Auditoría y posible autorización de la JGA.
4. **Informe anual de gobierno corporativo:** Determinados acuerdos deben reflejarse en el IAGC (art. 540 LSC para cotizadas).

### Cambios requeridos en `bordes-no-computables.ts`

```typescript
// ANTES (bloqueo total):
if (input.esCotizada) {
  resultado.push({ id: 'BORDE_COTIZADA', severity: 'CRITICAL', status: 'FUERA_DE_ALCANCE' });
  return resultado; // ← early return impide toda evaluación
}

// DESPUÉS (evaluar + advertir):
if (input.esCotizada) {
  resultado.push({
    id: 'BORDE_COTIZADA_LMV_HECHO_RELEVANTE',
    nombre: 'Cotizada — Verificar hecho relevante CNMV',
    severity: 'WARNING',
    status: 'PENDIENTE',
    resolucion: 'Verificar si el acuerdo constituye hecho relevante (art. 228 LMV). Comunicar a CNMV si procede.',
  });
  resultado.push({
    id: 'BORDE_COTIZADA_LMV_IPDD',
    nombre: 'Cotizada — Información privilegiada (MAR art. 17)',
    severity: 'WARNING',
    status: 'PENDIENTE',
    resolucion: 'Evaluar si el acuerdo constituye IPDD. Publicar antes de apertura de mercado si aplica.',
  });
  // Condicional: solo si hay materias que impliquen operaciones vinculadas
  if (input.materias.some(m => ['AUTORIZACION_TRANSACCION', 'APROBACION_PRESUPUESTOS'].includes(m))) {
    resultado.push({
      id: 'BORDE_COTIZADA_OPERACIONES_VINCULADAS',
      nombre: 'Cotizada — Operaciones vinculadas (art. 231 LSC)',
      severity: 'WARNING',
      status: 'PENDIENTE',
      resolucion: 'Verificar si la transacción implica partes vinculadas. Requiere informe Comité Auditoría.',
    });
  }
  // NO return early — el motor continúa evaluando los 6 bordes restantes
}
```

### Urgencia
**ALTA** — Sin este cambio, la demo ARGA no puede funcionar porque la entidad principal es cotizada.

---

## DL-3. Pactos parasociales — un pacto demo

### Resolución
**Un pacto demo visible, lógica de evaluación post-GA.**

### Detalle
- Pacto: **Fundación ARGA** (69.69% de ARGA Seguros) tiene derecho de veto en operaciones estructurales (fusión, escisión, disolución, venta de activos significativos >15% del patrimonio neto).
- En la demo: el pacto aparece como dato asociado a la entidad, visible en el perfil de la persona jurídica. El motor NO lo evalúa automáticamente — solo muestra un badge "Pacto parasocial registrado" cuando las materias del acuerdo coinciden con el ámbito del pacto.
- Post-GA: activar `PactosEvaluation` en `types.ts` con lógica que cruce materias del acuerdo vs. cláusulas del pacto y genere WARNING/BLOCKING según corresponda.

### Cambios requeridos
- **Datos:** Seed de 1 registro en tabla `pactos_parasociales` (si existe) o campo JSONB en `entities`.
- **Código:** No para demo. Solo seed data.
- **Urgencia:** Media — enriquece pero no bloquea.

---

## DL-4. Plantilla Convocatoria — selección automática por tipo social

### Resolución
**Selección automática en Gate PRE.** SA → Plantilla 6 (convocatoria BORME + web). SL → Plantilla 9 (notificación individual certificada art. 173.2 LSC). Override manual permitido pero audit-logged.

### Detalle
- Gate PRE (`plantillas-engine.ts`) detecta `tipo_social` de la entidad al evaluar materia CONVOCATORIA_JUNTA.
- Si `tipo_social === 'SA'`: selecciona Plantilla 6 (publicación BORME + página web corporativa + derecho de información art. 197 LSC).
- Si `tipo_social === 'SL'`: selecciona Plantilla 9 (notificación individual certificada a cada socio, art. 173.2 LSC).
- El secretario puede overridear la selección automática, pero queda registrado en `rule_change_audit` con motivo obligatorio.

### Cambios requeridos en `plantillas-engine.ts`

```typescript
// En evaluarGatePRE(), antes de resolver plantilla:
if (materia === 'CONVOCATORIA_JUNTA' || materia === 'CONVOCATORIA_JUNTA_GOR') {
  const tipoSocial = input.entidad?.tipo_social;
  if (tipoSocial === 'SA') {
    plantillaId = PLANTILLA_CONVOCATORIA_SA; // Plantilla 6
  } else if (tipoSocial === 'SL') {
    plantillaId = PLANTILLA_CONVOCATORIA_SL; // Plantilla 9
  }
  // Si override manual, registrar en audit
}
```

### Urgencia
**ALTA** — Necesario para que el flujo de convocatoria funcione correctamente en la demo con ARGA Seguros (SA).

---

## DL-5. Voto de calidad del presidente — configuración por órgano

### Resolución

| Órgano | Voto de calidad | Rationale |
|---|---|---|
| **Consejo de Administración** | **Sí** | Estatutos de ARGA lo prevén. Presidente dirime empates |
| **Comité Ejecutivo** | **Sí** | Reglamento interno lo prevé |
| **Comisión de Auditoría** | **No** | Órgano de supervisión — no debe concentrar poder de decisión en el presidente |
| **Comisión de Riesgos** | **No** | Ídem Auditoría |
| **Comisión de Nombramientos** | **No** | Ídem |
| **Comisión de Retribuciones** | **No** | Ídem |

### Cambios requeridos
- **Datos:** Actualizar campo `config` JSONB en `governing_bodies` para cada órgano:
  ```json
  // CdA y Comité Ejecutivo
  { "voto_calidad_presidente": true }
  // Comisiones delegadas
  { "voto_calidad_presidente": false }
  ```
- **Código:** El gate ya existe en `votacion-engine.ts` y lee `voto_calidad_presidente` del órgano. Solo falta el seed correcto.
- **Urgencia:** Media — el gate funciona, solo falta configurar los valores correctos.

---

## DL-6. Retribución de consejeros — valores ARGA derivados del IAR 2025

### Resolución
Valores demo derivados del Informe Anual de Remuneraciones (IAR) 2025 de la entidad de referencia, adaptados al contexto ARGA.

### Retribución fija — Consejeros no ejecutivos

| Concepto | Importe anual |
|---|---|
| Vicepresidente CdA | 220.000 € |
| Coordinador Independiente | 220.000 € |
| Vocal CdA | 115.000 € |
| Presidente Comisión Auditoría | +52.000 € |
| Vocal Comisión Auditoría | +36.000 € |
| Presidente Comisión Nombramientos | +45.000 € |
| Vocal Comisión Nombramientos | +32.000 € |
| Presidente Comisión Retribuciones | +45.000 € |
| Vocal Comisión Retribuciones | +32.000 € |
| Presidente Comisión Riesgos | +52.000 € |
| Vocal Comisión Riesgos | +36.000 € |

### Retribución fija — Consejeros ejecutivos (RF 2026)

| Cargo | RF anual |
|---|---|
| Presidente | 1.091.400 € |
| Vicepresidente (1er) | 534.529 € |
| Consejero Director General | 534.529 € |
| Director General Adjunto | 456.022 € |

### Retribución variable anual (RVA)

- **Métricas:** 100% Beneficio Neto consolidado + ROE (ajuste ±5%)
- **Devengo:** 70% inmediato, 30% diferido 3 años (sujeto a clawback y malus)
- **Techo individual:** la RVA no puede superar el RF del ejecutivo

### Incentivo a largo plazo (ILP) 2026-2028

- **Instrumento:** 50% efectivo + 50% acciones (equivalente shares para ARGA)
- **Métricas y pesos:**
  - TSR (Total Shareholder Return) vs. peer group: 30%
  - ROE: 25%
  - Ratio Combinado No Vida (RCGNV): 25%
  - CSM (Contractual Service Margin): 5%
  - ESG (score externo + interno): 15%
- **Periodo de devengo:** 3 años (2026-2028)
- **Liquidación:** 40% inmediato, 60% diferido 3 años adicionales

### Previsión social

- **Prima seguro de vida:** 20% de (RF + RVA) anual para cada ejecutivo
- **Presidente:** adicionalmente 35% del RF como contribución al plan de previsión

### Techo JGA

- **Remuneración máxima agregada** aprobada por la Junta General: **4.000.000 €/año** para todos los consejeros no ejecutivos.

### Cambios requeridos
- **Datos:** Actualizar Rule Pack RETRIBUCION_CONSEJEROS con los valores anteriores en `params` JSONB.
- **Seed:** Crear registros en tabla de retribuciones (si existe) o enriquecer `persons` con datos de retribución para los 15 miembros del CdA de ARGA.
- **Urgencia:** Media — los valores enriquecen la demo pero el flujo no depende de ellos para funcionar.

---

## Resumen de impacto en código

| Archivo | Cambio | DL |
|---|---|---|
| `src/lib/rules-engine/bordes-no-computables.ts` | Eliminar early return cotizadas, añadir 3 WARNING LMV | DL-2 |
| `src/lib/rules-engine/plantillas-engine.ts` | Selección automática SA/SL en Gate PRE | DL-4 |
| Seed `governing_bodies` | Config JSONB `voto_calidad_presidente` por órgano | DL-5 |
| Seed `rule_packs` / `rule_param_overrides` | Valores retribución + overrides PT | DL-1, DL-6 |
| Seed entidades | Pacto parasocial Fundación ARGA | DL-3 |

**Prioridad de implementación:** DL-2 → DL-4 → DL-5 → DL-6 → DL-3 → DL-1
