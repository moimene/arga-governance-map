# Certificación Societaria + Autoridad Computable — Diseño

**Fecha:** 2026-04-21
**Autor:** Moisés Menéndez (validación jurídica) + Claude
**Estado:** [ABSORBIDO] — reescrito dentro de `2026-04-21-gestion-societaria-mvp-design.md` sobre nombres de tabla reales del Cloud (`minutes`, `certifications`) y sin `certificacion_firmas`/`worm_ledger` ficticias. Se mantiene como referencia histórica del razonamiento jurídico SoA y el diseño inicial.
**Contexto previo:** `2026-04-21-modelo-canonico-fase-0-1-plan.md` (tag `canonical-model-phase-0-1`)

---

## 1. Propósito

Cerrar el ciclo **evaluación del motor LSC → acta → certificación → presentación registral** con:
- Separación correcta de acciones (no de roles) — corrige el error conceptual de SoD introducido y revertido en T19.5/T19.5.1
- Libro computable de cargos vigentes (`authority_evidence`) que habilita la certificación con fe pública
- Cadena de hashes que hace la certificación verificable offline y auto-invalidable si se altera el snapshot
- Integración con plantillas protegidas, motor de reglas, QTSP y Tramitador Registral

El sistema pasa de **gestionar acuerdos** a **certificar acuerdos con fuerza probatoria y capacidad registral**.

---

## 2. Principio corregido: SoA (Separation of Actions), no SoD por roles

### Error previo

T19.5 introdujo un par tóxico `sod_toxic_pairs (SECRETARIO, CONSEJERO) WARN`. En derecho societario español **es jurídicamente incorrecto**: el Secretario Consejero votante es la figura habitual en Sociedades Limitadas (y frecuente en SA). La LSC + RRM no prohíben la concentración de roles en una misma persona; lo que exigen es:

1. **Integridad del acto** (el contenido es el que fue)
2. **Capacidad certificante vigente** (cargo inscrito)
3. **Determinismo del resultado** (el resultado no depende de quién lo calculó)

Nada de esto requiere separar personas.

### Modelo corregido

La separación es de **acciones sobre el mismo acto**:

| Acción | Controles |
|---|---|
| `SNAPSHOT_CREATION` | capability_matrix permite + estado BORRADOR |
| `VOTE_EMISSION` | está en censo_snapshot + tiene derecho de voto |
| `CERTIFICATION` | authority_evidence vigente + rol certificante + scope body_id |

La misma persona puede ejecutar las tres. **Lo que no puede** es alterar lo ya hecho — **eso lo garantiza el WORM**, no una exclusión de roles.

---

## 3. Alcance — 5 fases

| Fase | Qué entrega |
|---|---|
| **F1** | `capability_matrix` (3 acciones) + `authority_evidence` (libro de cargos vigentes) + backfill desde mandates/condiciones_persona |
| **F2** | Extensión schema: `actas` (+ adoption_mode, tipo_acta, agreement_ids, hashes, estado); `certificaciones` (+ agreement_id, tipo, visto_bueno, hash_certificacion, tsq_token, estado); `certificacion_firmas` (+ ocsp_response, orden) |
| **F3** | RPCs `fn_generar_acta` + `fn_generar_certificacion` con Gate PRE plantillas protegidas e integración motor T10 |
| **F4** | RPCs `fn_firmar_certificacion` (QTSP + OCSP) + `fn_emitir_certificacion` (Vº Bº + WORM seal) |
| **F5** | Integración Tramitador Registral: certificación EMITIDA → input de elevación pública / presentación RM |

---

## 4. Modelo de datos

### 4.1 `capability_matrix` (nueva)

```sql
capability_matrix (
  role         text NOT NULL,
  action       text NOT NULL CHECK (action IN ('SNAPSHOT_CREATION','VOTE_EMISSION','CERTIFICATION')),
  enabled      boolean NOT NULL DEFAULT true,
  rationale    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, action)
)
```

**Seed inicial (3 acciones × 5 roles):**

| role | SNAPSHOT_CREATION | VOTE_EMISSION | CERTIFICATION |
|---|---|---|---|
| ADMIN_TENANT | ✓ | ✓ | ✓ |
| SECRETARIO | ✓ | ✗ | ✓ |
| CONSEJERO | ✗ | ✓ | ✗ |
| COMPLIANCE | ✗ | ✗ | ✗ |
| AUDITOR | ✗ | ✗ | ✗ |

**Importante:** que SECRETARIO no tenga `VOTE_EMISSION` por defecto **no** impide a un Secretario Consejero votar — votará desde su rol CONSEJERO. La matriz es por `(role, action)`, y un usuario con dos roles compone la unión.

**Nota sobre por qué 3 acciones y no 5:** `RESULT_EVALUATION` y `WORM_SEAL` son ejecutadas por el sistema (motor + trigger), no por humanos. No tiene sentido meterlas en capability_matrix hasta que el motor las invoque como operaciones distintas auditables.

### 4.2 `authority_evidence` (nueva — pieza clave)

```sql
authority_evidence (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL,
  persona_id         uuid NOT NULL REFERENCES persons,
  sociedad_id        uuid NOT NULL REFERENCES entities,
  body_id            uuid REFERENCES governing_bodies,  -- null si cargo transversal (p.ej. ADMIN_UNICO)
  role               text NOT NULL CHECK (role IN ('PRESIDENTE','VICEPRESIDENTE','SECRETARIO','VICESECRETARIO','CONSEJERO','ADMIN_UNICO','ADMIN_SOLIDARIO','ADMIN_MANCOMUNADO','SECRETARIO_JUDICIAL')),
  valido_desde       date NOT NULL,
  valido_hasta       date,  -- null = vigente
  fuente             text NOT NULL CHECK (fuente IN ('ESTATUTOS','NOMBRAMIENTO_ACUERDO','ESCRITURA','NOMBRAMIENTO_JUDICIAL')),
  documento_ref      text,  -- Storage path o URL al documento probatorio
  inscripcion_rm     text,  -- referencia de inscripción en Registro Mercantil (null si no inscrito)
  mandate_id         uuid REFERENCES mandates,  -- link opcional a mandates (compatibilidad con modelo actual)
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ae_interval_ok CHECK (valido_hasta IS NULL OR valido_hasta >= valido_desde)
)

-- Índice único parcial: un solo cargo vigente por (persona, sociedad, body, role)
CREATE UNIQUE INDEX ux_authority_evidence_vigente ON authority_evidence (
  persona_id, sociedad_id, COALESCE(body_id, '00000000-0000-0000-0000-000000000000'::uuid), role
) WHERE valido_hasta IS NULL;

-- Índice de consulta por vigencia en fecha
CREATE INDEX idx_authority_evidence_sociedad_fecha ON authority_evidence (sociedad_id, valido_desde, valido_hasta);
```

**Backfill desde modelo canónico Phase 0+1:**
- Fuente 1: `condiciones_persona` (cargos ya consolidados por T15) → authority_evidence con `role` mapeado, `valido_desde = fecha_inicio`, `valido_hasta = fecha_fin`
- Fuente 2: `mandates` con `registration_filing` activo → heredar `inscripcion_rm`

**Helper function:**
```sql
CREATE FUNCTION fn_cargo_vigente(
  p_persona_id uuid,
  p_sociedad_id uuid,
  p_body_id uuid,
  p_role text,
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM authority_evidence
    WHERE persona_id = p_persona_id
      AND sociedad_id = p_sociedad_id
      AND (body_id = p_body_id OR (body_id IS NULL AND p_body_id IS NULL))
      AND role = p_role
      AND valido_desde <= p_fecha
      AND (valido_hasta IS NULL OR valido_hasta >= p_fecha)
  );
$$ LANGUAGE sql STABLE;
```

### 4.3 Extensión `actas`

Añadir:

```sql
ALTER TABLE actas ADD COLUMN adoption_mode text CHECK (adoption_mode IN (
  'MEETING','UNIVERSAL','NO_SESSION','UNIPERSONAL_SOCIO','UNIPERSONAL_ADMIN','CO_APROBACION','SOLIDARIO'
));

ALTER TABLE actas ADD COLUMN tipo_acta text CHECK (tipo_acta IN (
  'ACTA_JUNTA','ACTA_CONSEJO','ACTA_CONSIGNACION_SOCIO','ACTA_CONSIGNACION_ADMIN',
  'ACTA_DECISION_CONJUNTA','ACTA_ACUERDO_ESCRITO','ACTA_ORGANO_ADMIN'
));

ALTER TABLE actas ADD COLUMN agreement_ids uuid[];  -- 1:N acuerdos incluidos
ALTER TABLE actas ADD COLUMN plantilla_protegida_id uuid REFERENCES plantillas_protegidas;
ALTER TABLE actas ADD COLUMN snapshot_hash text;    -- SHA-256 del ruleset + censo (T13c)
ALTER TABLE actas ADD COLUMN resultado_hash text;   -- SHA-256 de rule_evaluation_results
ALTER TABLE actas ADD COLUMN gate_hash text;        -- SHA-256(snapshot_hash || resultado_hash)

-- Estado ya existe pero ampliar CHECK
ALTER TABLE actas DROP CONSTRAINT IF EXISTS actas_estado_check;
ALTER TABLE actas ADD CONSTRAINT actas_estado_check
  CHECK (estado IN ('BORRADOR','FINAL','FIRMADA','INSCRITA'));
```

### 4.4 Extensión `certificaciones`

```sql
ALTER TABLE certificaciones ADD COLUMN agreement_id uuid REFERENCES agreements;  -- null si certifica acta completa
ALTER TABLE certificaciones ADD COLUMN tipo_certificacion text NOT NULL DEFAULT 'ACUERDO'
  CHECK (tipo_certificacion IN ('ACUERDO','ACTA_COMPLETA','VIGENCIA_CARGO'));

-- certificante_role ampliado
ALTER TABLE certificaciones DROP CONSTRAINT IF EXISTS certificaciones_certificante_role_check;
ALTER TABLE certificaciones ADD CONSTRAINT certificaciones_certificante_role_check
  CHECK (certificante_role IN ('SECRETARIO','VICESECRETARIO','ADMIN_UNICO','SECRETARIO_JUDICIAL'));

ALTER TABLE certificaciones ADD COLUMN visto_bueno_persona_id uuid REFERENCES persons;
ALTER TABLE certificaciones ADD COLUMN visto_bueno_required boolean NOT NULL DEFAULT false;
ALTER TABLE certificaciones ADD COLUMN hash_certificacion text;  -- SHA-256(gate_hash || contenido || tsq_token)
ALTER TABLE certificaciones ADD COLUMN tsq_token text;  -- sello cualificado QTSP

-- Estado ampliado
ALTER TABLE certificaciones DROP CONSTRAINT IF EXISTS certificaciones_estado_check;
ALTER TABLE certificaciones ADD CONSTRAINT certificaciones_estado_check
  CHECK (estado IN ('BORRADOR','FIRMADA','EMITIDA','INSCRITA'));

-- Regla derivada: Vº Bº obligatorio si inscribible
-- Se enforza en fn_emitir_certificacion, no como CHECK (requiere join con agreements)
```

### 4.5 Extensión `certificacion_firmas`

```sql
ALTER TABLE certificacion_firmas ADD COLUMN ocsp_response jsonb;  -- validación certificado en firma
ALTER TABLE certificacion_firmas ADD COLUMN orden int NOT NULL DEFAULT 1;  -- 1=certificante, 2=Vº Bº Presidente

-- Índice para firma secuencial
CREATE INDEX idx_certificacion_firmas_orden ON certificacion_firmas (certificacion_id, orden);
```

---

## 5. RPCs

### 5.1 `fn_generar_acta(sesion_id, adoption_mode) RETURNS uuid`

```
1. Determinar tipo_acta desde rule_pack.acta.tipoActaPorModo[adoption_mode]
2. Cargar plantilla_protegida WHERE tipo = tipo_acta AND estado = 'ACTIVA'
   ELSE RAISE 'Plantilla no aprobada o inexistente'
3. Gate PRE plantilla: verificar aprobación, variables declaradas, protecciones (T13c)
4. Inyectar variables: motor (snapshot, explain, votos) + usuario (fecha, lugar, asistentes)
5. Verificar contenido mínimo según rule_pack.acta.contenidoMinimo[adoption_mode]
   ELSE RAISE 'Contenido mínimo incompleto: ...'
6. Calcular snapshot_hash = SHA-256(censo_snapshot.contenido || ruleset_version)
7. Calcular resultado_hash = SHA-256(rule_evaluation_results.payload)
8. Calcular gate_hash = SHA-256(snapshot_hash || resultado_hash)
9. INSERT acta (estado='BORRADOR', ...)
10. RETURN acta_id
```

### 5.2 `fn_generar_certificacion(acta_id, agreement_id, certificante_persona_id, tipo_certificacion) RETURNS uuid`

```
1. Cargar acta (con gate_hash) y agreement
2. Validar authority_evidence:
   fn_cargo_vigente(certificante_persona_id, acta.sociedad_id, acta.body_id,
                    role IN ('SECRETARIO','VICESECRETARIO','ADMIN_UNICO','SECRETARIO_JUDICIAL'),
                    acta.fecha)
   ELSE RAISE 'Certificante sin autoridad vigente'
3. Determinar visto_bueno_required = agreement.postAcuerdo.inscribible
4. Si ADMIN_UNICO: visto_bueno_required = false (certifica sin Vº Bº)
5. Cargar plantilla protegida CERTIFICACION, Gate PRE
6. Inyectar datos: acuerdo (texto, materia, fecha), resultado (explain del motor),
                   snapshot (composición, quórum), certificante (nombre, cargo)
7. Calcular hash_certificacion = SHA-256(gate_hash || contenido_plantilla_rellena)
   (tsq_token se añadirá en fn_firmar_certificacion)
8. INSERT certificacion (estado='BORRADOR', visto_bueno_required, hash_certificacion, ...)
9. RETURN certificacion_id
```

### 5.3 `fn_firmar_certificacion(certificacion_id, firmante_persona_id, orden, firma_payload, ocsp_response) RETURNS uuid`

```
1. Validar orden:
   - Si orden=1: firmante debe ser certificante_persona_id
   - Si orden=2: firmante debe tener authority_evidence role='PRESIDENTE' vigente
2. Validar OCSP: response.status = 'good' AND response.producedAt <= now()
   ELSE RAISE 'Certificado firmante no válido según OCSP'
3. INSERT certificacion_firmas (certificacion_id, persona_id, orden, payload, ocsp_response, tsq_token_individual)
4. Si todas las firmas requeridas presentes (orden 1 + orden 2 si visto_bueno_required):
   - Calcular tsq_token global = QTSP.timestamp(hash_certificacion)
   - UPDATE certificacion SET tsq_token = ..., estado = 'FIRMADA',
     hash_certificacion = SHA-256(gate_hash || contenido || tsq_token)  -- hash final
5. RETURN firma_id
```

### 5.4 `fn_emitir_certificacion(certificacion_id) RETURNS jsonb`

```
1. Verificar estado = 'FIRMADA'
   ELSE RAISE 'No firmada'
2. Si visto_bueno_required: verificar que existe firma con orden=2
   ELSE RAISE 'Falta Vº Bº del Presidente para acuerdo inscribible'
3. INSERT worm_ledger (
     evento='CERTIFICACION_EMITIDA',
     payload=jsonb(certificacion_id, hash_certificacion, tsq_token, gate_hash),
     hash_prev=(SELECT hash FROM worm_ledger ORDER BY id DESC LIMIT 1),
     hash=SHA-256(hash_prev || payload || now())
   )
4. UPDATE certificacion SET estado = 'EMITIDA', emitida_at = now()
5. RETURN {certificacion_id, hash, tsq_token, worm_ledger_id}
```

---

## 6. Integración

### 6.1 Motor LSC (T10/T11/T13c)

Flujo actualizado del orquestador:

```
convocatoria → constitución → votación → documentación (evaluarActa)
  → [NUEVO] certificación (evaluarCertificacion)
  → plazos materiales → postAcuerdo → WORM
```

Nueva función motor: `evaluarCertificacion(certificacion_id)` que valida:
- Certificante con authority_evidence vigente
- Vº Bº presente si inscribible
- Hash consolidado cuadra
- Contenido mínimo por tipo_certificacion

### 6.2 Plantillas protegidas (T3d/T13c)

`fn_generar_acta` y `fn_generar_certificacion` invocan Gate PRE:
- Plantilla existe
- Estado = 'ACTIVA'
- `aprobada_at IS NOT NULL`
- Variables declaradas cubren las requeridas por rule pack
- Protecciones de contenido (zonas fijas) intactas

### 6.3 Tramitador Registral (T18 / F5)

```
certificacion.estado = 'EMITIDA' AND agreement.inscribible = true
  → TramitadorStepper.puede_iniciar = true
  → IF instrumentoRequerido = 'ESCRITURA':
       escritura_publica.adjuntos.certificacion = certificacion
       escritura_publica.firma_otorgante = certificante + Vº Bº
    ELSE (instrumentoRequerido = 'INSTANCIA'):
       instancia_rm.documento_habilitante = certificacion
  → registry_filing.presentacion_rm
  → [cuando RM responde] UPDATE certificacion SET estado='INSCRITA'
```

### 6.4 QTSP (D2/D3)

- `fn_firmar_certificacion` llama al adapter QTSP (ya existe en D2) para firma QES
- `tsq_token` del TSQ adjunto (timestamp cualificado)
- `ocsp_response` validada y guardada para defensa registral futura
- Bundle ASiC-E: certificación firmada + acta + snapshot + explain + OCSP → expediente probatorio completo

---

## 7. Reglas jurídicas clave

| Regla | Enforcement |
|---|---|
| Certificante debe ser SECRETARIO/VICESECRETARIO/ADMIN_UNICO/SECRETARIO_JUDICIAL con cargo vigente | `fn_generar_certificacion` + `fn_cargo_vigente` |
| Para inscripción RM: Vº Bº del Presidente (arts. 109.3, 112 RRM) | `fn_emitir_certificacion` verificación |
| ADMIN_UNICO certifica sin Vº Bº | Regla en `fn_generar_certificacion` paso 4 |
| Hash consolidado `= SHA-256(gate_hash ‖ contenido ‖ tsq_token)` | Cálculo en `fn_generar_certificacion` + actualización final en `fn_firmar_certificacion` |
| Modificación post-EMITIDA prohibida | Trigger WORM sobre `certificaciones` (patrón `fn_audit_worm`) |
| Determinismo: resultado depende del snapshot, no del usuario | El motor ya lo garantiza; la certificación hereda via `gate_hash` |

---

## 8. Pruebas de aceptación — 12 casos

| # | Caso | Resultado esperado |
|---|---|---|
| 1 | Secretario vigente certifica acuerdo ordinario (no inscribible) | OK — sin Vº Bº |
| 2 | Secretario vigente certifica acuerdo inscribible con Vº Bº Presidente | OK — ambas firmas en ledger |
| 3 | Secretario vigente certifica acuerdo inscribible sin Vº Bº | BLOCK en `fn_emitir_certificacion` |
| 4 | Consejero no-secretario intenta certificar | BLOCK en `fn_generar_certificacion` (authority) |
| 5 | Admin único certifica decisión unipersonal | OK — sin Vº Bº |
| 6 | Certificación acuerdo NO_SESSION (acuerdo escrito) por secretario | OK — tipo_acta = ACTA_ACUERDO_ESCRITO |
| 7 | Certificación CO_APROBACION mancomunados | OK — secretario certifica co-firmas del acta |
| 8 | Hash certificación verificable offline (recalcular con inputs) | OK — hash coincide |
| 9 | Certificación con `pacto_ok = false` (incumplimiento parasocial) | OK — certificación societaria emite; el incumplimiento consta en explain |
| 10 | Evento WORM con hash_prev correcto | OK — cadena íntegra |
| 11 | Certificación con plantilla no aprobada | BLOCK — Gate PRE |
| 12 | Cargo de secretario expirado al momento de firma | BLOCK — OCSP + authority vigencia |

---

## 9. Desviaciones respecto al modelo original

| Plan / modelo antes | Ajuste |
|---|---|
| SoD por roles (`sod_toxic_pairs`) | **Revertido.** Sustituido por SoA (capability_matrix) + authority_evidence + WORM |
| `capability_matrix` con 5 acciones (SNAPSHOT, VOTE, RESULT, CERT, WORM_SEAL) | **3 acciones** (SNAPSHOT, VOTE, CERT). RESULT y WORM_SEAL son de sistema, no de humanos. Mover a matriz solo cuando el motor lo invoque como operación auditable |
| `authority_evidence` sin `body_id` | Añadido scope por órgano (un Secretario del Consejo no certifica JGA si hay otro designado) |
| `certificaciones` sin `agreement_id` | Añadido — lo habitual es certificar acuerdo individual, no acta completa |
| `hash_certificacion = SHA-256(snapshot_hash + resultado_hash + contenido)` | Consolidado en `gate_hash` (ya existe desde T13c) + `contenido` + `tsq_token` |

---

## 10. DoD

- [ ] `capability_matrix` creada + seed de 3 acciones × 5 roles
- [ ] `authority_evidence` creada + backfill desde condiciones_persona/mandates
- [ ] `fn_cargo_vigente` disponible y probada
- [ ] Extensión actas aplicada (adoption_mode, tipo_acta, agreement_ids, hashes, estado)
- [ ] Extensión certificaciones aplicada (agreement_id, tipo_certificacion, visto_bueno, hashes, tsq, estado)
- [ ] Extensión certificacion_firmas aplicada (ocsp_response, orden)
- [ ] 4 RPCs operativos: `fn_generar_acta`, `fn_generar_certificacion`, `fn_firmar_certificacion`, `fn_emitir_certificacion`
- [ ] Integración Gate PRE plantillas en generación
- [ ] Integración motor `evaluarCertificacion` en orquestador
- [ ] Integración Tramitador: certificación EMITIDA → input de elevación pública
- [ ] 12 tests de aceptación en verde
- [ ] WORM verificable end-to-end (certificación sellada, no modificable)
