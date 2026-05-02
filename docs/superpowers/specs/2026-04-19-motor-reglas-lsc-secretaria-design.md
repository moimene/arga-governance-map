# Motor de Reglas LSC para Secretaria Societaria

**Fecha:** 2026-04-19
**Alcance:** Espana (LSC) — SA y SL
**Estado:** Draft
**Proyecto:** arga-governance-map / Modulo Secretaria (`/secretaria/*`)

---

## 1. Contexto y objetivo

El modulo de Secretaria Societaria (Fase 2, commit `9e6b7e5`) ya implementa convocatorias, reuniones, actas, tramitador, acuerdos sin sesion, decisiones unipersonales y un motor de compliance basico (`useAgreementCompliance`, `useJurisdiccionRules`). Sin embargo, la logica normativa esta parcialmente hardcodeada y dispersa entre hooks, con gaps criticos:

- `checkNoticePeriodByType` usa dias fijos (ES: 15/5) sin distinguir SA vs SL (la LSC exige 30 dias para SA, 15 para SL).
- `computeQuorumStatus` opera con porcentajes planos en `rule_config` JSONB, sin modelar la doble condicional de la LSC (primera/segunda convocatoria con umbrales distintos segun materia).
- Las mayorias no distinguen el universo de computo (votos emitidos vs capital presente vs consejeros presentes).
- No hay soporte para vetos estatutarios, unanimidades por clase, voto de calidad, ni conflictos de interes con exclusion de voto.
- La documentacion obligatoria por materia no se verifica.
- No hay trazabilidad de la regla aplicada ni explain auditable.

**Objetivo:** reemplazar estas heuristicas por un Motor de Reglas LSC basado en la arquitectura hibrida de nucleo transversal + "Rule Packs" por materia, derivada de los documentos de referencia (LSC Rule Pack y GAS v3.0).

---

## 2. Arquitectura: nucleo transversal + rule packs

### 2.1 Principios de diseno

1. **Motor transversal unico y testeable**: los motores de convocatoria, constitucion, votacion y documentacion son funciones puras que consumen parametros — no contienen `if` por materia.
2. **Rule Packs declarativos y versionados**: cada tipologia de acuerdo (formulacion de cuentas, modificacion de estatutos, etc.) se define como un objeto JSON/TS inmutable con las reglas especificas.
3. **Jerarquia normativa 3 niveles**: LEY > ESTATUTOS > PACTOS/REGLAMENTO. El motor aplica siempre la regla mas estricta sin rebajar minimos legales.
4. **Explicabilidad**: cada evaluacion produce un `explain` con la cadena regla-fuente-umbral-valor-resultado.
5. **Compatibilidad hacia atras**: las interfaces `ComplianceResult`, `QuorumStatusResult` y `NoticePeriodResult` se mantienen como fachada.

### 2.2 Diagrama de componentes

```
                    ┌─────────────────────────────────────┐
                    │        Orquestador Transversal       │
                    │  componerPerfilSesion() / evaluar()  │
                    └──────────┬──────────────────┬───────┘
                               │                  │
              ┌────────────────▼──┐          ┌────▼──────────────┐
              │  Motor Convocatoria│          │  Motor Votacion   │
              │  calcularPlazo()  │          │  evaluarMayoria() │
              │  validarCanales() │          │  evaluarVetos()   │
              │  checklistDocs()  │          │  evaluarUnanim()  │
              └───────────────────┘          │  votoCalidad()    │
              ┌───────────────────┐          └──────────────────┘
              │ Motor Constitucion│          ┌──────────────────┐
              │ evaluarQuorum()   │          │Motor Documentacion│
              │ validarAsistencia │          │ checklistMateria()│
              └───────────────────┘          │ ventanaDisponib() │
                                             └──────────────────┘
                    ┌─────────────────────────────────────┐
                    │       Repositorio de Rule Packs      │
                    │  Supabase: rule_packs + versions     │
                    │  + overrides por entidad/estatutos   │
                    └─────────────────────────────────────┘
```

### 2.3 Tipologias de organo social y modos de adopcion

La LSC contempla distintas formas de administracion (art. 210) que determinan radicalmente como opera el motor de reglas. El sistema distingue **5 tipologias de organo** y **5 modos de adopcion**:

**Organos colegiados (deliberativos — convocatoria + quorum + votacion):**

| Organo | Convocatoria | Quorum | Votacion | Documentacion |
|---|---|---|---|---|
| **Junta General** (SA/SL) | Plazos SA 30d / SL 15d, canales, contenido minimo | Art. 193-194 (SA), sin quorum legal (SL) | Mayorias arts. 198-201, conflictos art. 190 | Acta de la junta |
| **Consejo de Administracion** | Plazo estatutario/reglamentario (tipico 3-5 dias), comunicacion individual | Mayoria de miembros (art. 247 LSC) | Mayoria de presentes, voto calidad del presidente | Acta del consejo |
| **Comision Delegada** | Plazo segun reglamento del consejo, comunicacion individual | Mayoria de miembros de la comision | Segun delegacion (no puede exceder facultades del consejo) | Acta de la comision |

**Organos unipersonales (sin deliberacion — decision directa + consignacion):**

| Organo | Convocatoria | Quorum | Votacion | Documentacion |
|---|---|---|---|---|
| **Administrador Unico** | No requiere | No aplica | No aplica — decision unilateral | **Acta de consignacion** de la decision (no "acta de sesion") |
| **Socio Unico** | No requiere (art. 15 LSC) | No aplica | No aplica — decision del socio unico sustituye a la Junta | **Acta de consignacion** de la decision del socio unico |

**Administradores solidarios y mancomunados:** en el caso de administradores solidarios, cada uno actua individualmente (como administrador unico para su ambito). En el caso de mancomunados, actuan conjuntamente (normalmente 2) — la decision requiere conformidad de todos, documentada como acta de decision conjunta. Ambos se modelan como variantes del modo `UNIPERSONAL_ADMIN` con un campo `requiere_conformidad_conjunta`.

**Implicaciones para el motor de reglas:**

- Los Rule Packs de materias que se adoptan en **Junta General** (APROBACION_CUENTAS, MOD_ESTATUTOS, etc.) incluyen secciones completas de convocatoria + constitucion + votacion.
- Los Rule Packs de materias del **Consejo** (FORMULACION_CUENTAS, nombramientos por delegacion) tienen convocatoria simplificada (sin BORME, sin plazos legales salvo estatutarios) y quorum/mayoria de consejeros (no de capital).
- Los Rule Packs con `adoption_mode = UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN` **saltan completamente** las secciones de convocatoria, constitucion y votacion. Solo evaluan documentacion (acta de consignacion), plazos materiales y post-acuerdo (inscripcion).
- El `adoption_mode` se determina por la combinacion de organo social + forma de administracion de la entidad, no por la materia.

### 2.4 Flujo E2E por modo de adopcion

**Flujo A — Organo colegiado (MEETING / UNIVERSAL):**
1. **Convocatoria**: el stepper carga los Rule Packs de las materias del orden del dia → el orquestador compone el perfil combinado (max antelacion, union de docs, quorum mas exigente) → valida fecha, canales, contenido minimo y documentacion.
2. **Constitucion**: al abrir la sesion, el motor verifica quorum con los parametros del perfil combinado, distinguiendo primera/segunda convocatoria y tipo social.
3. **Votacion por punto**: para cada acuerdo, el motor filtra el censo (exclusion por conflicto de interes), aplica la regla de mayoria del Rule Pack, evalua unanimidades/vetos, y si hay empate, comprueba voto de calidad.
4. **Post-acuerdo**: el motor determina inscribibilidad, instrumento requerido, publicacion y plazos materiales.
5. **Sellado**: se persiste el `explain` completo + hash del ruleset efectivo.

**Flujo B — Decision unipersonal (UNIPERSONAL_SOCIO / UNIPERSONAL_ADMIN):**
1. **Skip convocatoria**: no hay convocatoria ni plazo. El motor marca `convocation_compliant = true` automaticamente.
2. **Skip constitucion/quorum**: no aplica. El motor marca `quorum_compliant = true`.
3. **Skip votacion**: la decision es del socio/administrador unico — no hay mayoria. El motor marca `majority_compliant = true` si la decision esta firmada (`status = FIRMADA`).
4. **Documentacion**: el motor verifica que existe el **acta de consignacion** de la decision (no acta de sesion). El acta debe contener: identidad del decisor, texto de la decision, fecha, y firma. En sociedad unipersonal, el acta se transcribe al libro de actas (art. 15.2 LSC).
5. **Post-acuerdo**: inscripcion, instrumento y publicacion se evaluan igual que en organos colegiados.
6. **Sellado**: explain refleja el path unipersonal con referencia a art. 15 LSC (socio unico) o art. 210 (administrador unico).

**Flujo C — Acuerdo sin sesion (NO_SESSION):**

El proceso sin sesion es el flujo dominante en la operativa real: el 60-80% de los acuerdos de consejo y un volumen creciente de acuerdos de junta de SL se adoptan por escrito sin sesion presencial ni telematica.

1. **Habilitacion**: el motor verifica que la entidad tiene habilitado el procedimiento sin sesion (estatutos para junta SL art. 159.2, reglamento del consejo para circulacion escrita art. 248). Si no esta habilitado → BLOCKING.
2. **Materia admitida**: verificar que `modosAdopcionPermitidos` del Rule Pack incluye `NO_SESSION`. Materias reforzadas (MOD_ESTATUTOS, operaciones estructurales) pueden excluirlo.
3. **Propuesta y notificacion**: la propuesta se remite a todos los destinatarios (socios con capital / consejeros) por medio fehaciente. Como QTSP, se usa notificacion certificada eIDAS. El motor verifica que todas las notificaciones estan entregadas.
4. **Ventana de consentimiento**: periodo durante el cual los destinatarios pueden consentir, objetar o guardar silencio. La ventana se calcula segun rule pack y overrides (minimo legal o estatutario/reglamentario).
5. **Evaluacion diferenciada por organo:**
   - *Junta SL (art. 159.2)*: unanimidad del 100% del capital social con derecho de voto. Cualquier objecion o silencio bloquea. Cada consentimiento requiere firma QES.
   - *Consejo (art. 248)*: dos niveles — (a) ningún consejero se opone al procedimiento escrito, (b) mayoria ordinaria sobre consejeros que participan. Oposicion al procedimiento → debe convocarse sesion.
   - *Socio unico SLU/SAU*: decision directa, sin ventana.
6. **Acta**: acta de acuerdo escrito con estructura propia (propuesta notificada, relacion de respuestas con firma QES, resultado proclamado, snapshot).
7. **Post-acuerdo**: inscribibilidad, instrumento y publicacion como flujo A.
8. **Sellado**: explain refleja el path completo con referencia a arts. 159.2 / 248 LSC segun organo. Evidence bundle incluye propuesta, notificaciones, consentimientos con firma QES.

---

## 3. Modelo de datos

### 3.1 Nuevas tablas

```sql
-- Catalogo de rule packs
CREATE TABLE rule_packs (
  id TEXT PRIMARY KEY,                    -- e.g. 'FORMULACION_CUENTAS'
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  descripcion TEXT NOT NULL,
  materia TEXT NOT NULL,                  -- clave canonica
  organo_tipo TEXT NOT NULL,              -- 'JUNTA_GENERAL' | 'CONSEJO' | 'COMISION'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Versiones inmutables del rule pack
CREATE TABLE rule_pack_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id TEXT NOT NULL REFERENCES rule_packs(id),
  version TEXT NOT NULL,                  -- semver: '1.0.0'
  payload JSONB NOT NULL,                 -- RulePack serializado completo
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pack_id, version)
);

-- Overrides por entidad (estatutos/pactos de cada sociedad)
CREATE TABLE rule_param_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  entity_id UUID NOT NULL REFERENCES entities(id),
  materia TEXT NOT NULL,                  -- materia del rule pack
  clave TEXT NOT NULL,                    -- path: 'votacion.definicionMayoria'
  valor JSONB NOT NULL,                   -- valor override
  fuente TEXT NOT NULL CHECK (fuente IN ('ESTATUTOS','PACTO','REGLAMENTO')),
  referencia TEXT,                        -- 'art. 15 estatutos'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, materia, clave)
);

-- Resultado de evaluacion por acuerdo (auditable, WORM)
CREATE TABLE rule_evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  etapa TEXT NOT NULL,                    -- 'CONVOCATORIA' | 'CONSTITUCION' | 'VOTACION' | 'DOCUMENTACION' | 'PLAZO_MATERIAL'
  ok BOOLEAN NOT NULL,
  explain JSONB NOT NULL,                 -- arbol de decision completo
  rule_pack_id TEXT,
  rule_pack_version TEXT,
  tsq_token TEXT,                         -- Token de sello cualificado de tiempo (QTSP)
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agreement_id, etapa)
);

-- Trigger WORM: inmutabilidad real (defensa en profundidad, no solo RLS)
CREATE OR REPLACE FUNCTION worm_guard() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'WORM table: UPDATE and DELETE are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER worm_rule_evaluation_results
  BEFORE UPDATE OR DELETE ON rule_evaluation_results
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

-- Conflictos de interes formalizados (art. 190 LSC)
CREATE TABLE conflicto_interes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  mandate_id UUID NOT NULL REFERENCES mandates(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('EXCLUIR_QUORUM', 'EXCLUIR_VOTO', 'EXCLUIR_AMBOS')),
  motivo TEXT NOT NULL,                   -- 'art. 190.1.a LSC — socio administrador'
  capital_afectado NUMERIC,               -- Capital del mandato excluido
  resuelto_por UUID,                      -- persona que declaro el conflicto
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.2 Modificaciones a tablas existentes

```sql
-- Vincular agreements a su rule pack evaluado
ALTER TABLE agreements ADD COLUMN rule_pack_id TEXT;
ALTER TABLE agreements ADD COLUMN rule_pack_version TEXT;
ALTER TABLE agreements ADD COLUMN compliance_explain JSONB;
ALTER TABLE agreements ADD COLUMN gate_hash TEXT;              -- SHA-256 del resultado consolidado de evaluacion, sellado con QSeal

-- Vincular jurisdiction_rule_sets al catalogo (opcional, para coexistencia)
ALTER TABLE jurisdiction_rule_sets ADD COLUMN rule_pack_id TEXT;
```

### 3.3 Tablas del expediente sin sesion

```sql
-- Expediente de acuerdo sin sesion
CREATE TABLE no_session_expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  entity_id UUID NOT NULL REFERENCES entities(id),
  body_id UUID NOT NULL REFERENCES governing_bodies(id),
  tipo_proceso TEXT NOT NULL CHECK (tipo_proceso IN (
    'UNANIMIDAD_ESCRITA_SL',      -- art. 159.2 LSC: junta SL, 100% capital
    'CIRCULACION_CONSEJO',         -- art. 248 LSC + reglamento: consejo
    'DECISION_SOCIO_UNICO_SL',     -- art. 15 LSC: SLU
    'DECISION_SOCIO_UNICO_SA'      -- art. 15 LSC: SAU
  )),
  propuesta_texto TEXT NOT NULL,
  propuesta_documentos JSONB DEFAULT '[]',
  propuesta_fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  propuesta_firmada_por UUID REFERENCES persons(id),
  ventana_inicio TIMESTAMPTZ NOT NULL,
  ventana_fin TIMESTAMPTZ NOT NULL,
  ventana_dias_habiles INTEGER,
  ventana_fuente TEXT CHECK (ventana_fuente IN ('LEY', 'ESTATUTOS', 'REGLAMENTO', 'PROPONENTE')),
  estado TEXT NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN (
    'BORRADOR', 'NOTIFICADO', 'ABIERTO', 'CERRADO_OK', 'CERRADO_FAIL', 'PROCLAMADO'
  )),
  condicion_adopcion TEXT NOT NULL CHECK (condicion_adopcion IN (
    'UNANIMIDAD_CAPITAL', 'UNANIMIDAD_CONSEJEROS', 'MAYORIA_CONSEJEROS_ESCRITA', 'DECISION_UNICA'
  )),
  fecha_cierre TIMESTAMPTZ,
  motivo_cierre TEXT,
  rule_pack_id TEXT,
  rule_pack_version TEXT,
  snapshot_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Respuestas individuales (WORM: solo INSERT)
CREATE TABLE no_session_respuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  expediente_id UUID NOT NULL REFERENCES no_session_expedientes(id),
  person_id UUID NOT NULL REFERENCES persons(id),
  capital_participacion NUMERIC,
  porcentaje_capital NUMERIC,
  es_consejero BOOLEAN DEFAULT false,
  sentido TEXT NOT NULL CHECK (sentido IN (
    'CONSENTIMIENTO', 'OBJECION', 'OBJECION_PROCEDIMIENTO', 'SILENCIO'
  )),
  texto_respuesta TEXT,
  fecha_respuesta TIMESTAMPTZ NOT NULL DEFAULT now(),
  firma_qes_ref TEXT,
  firma_qes_timestamp TIMESTAMPTZ,
  ocsp_status TEXT,
  notificacion_certificada_ref TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(expediente_id, person_id)
);

-- Notificaciones de la propuesta (WORM)
CREATE TABLE no_session_notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  expediente_id UUID NOT NULL REFERENCES no_session_expedientes(id),
  person_id UUID NOT NULL REFERENCES persons(id),
  canal TEXT NOT NULL CHECK (canal IN (
    'NOTIFICACION_CERTIFICADA', 'EMAIL_SIMPLE', 'BUROFAX', 'ENTREGA_PERSONAL'
  )),
  enviada_at TIMESTAMPTZ,
  entregada_at TIMESTAMPTZ,
  evidencia_ref TEXT,
  evidencia_hash TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN (
    'PENDIENTE', 'ENVIADA', 'ENTREGADA', 'FALLIDA', 'RECHAZADA'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS + WORM triggers
ALTER TABLE no_session_expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_session_respuestas ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_session_notificaciones ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER worm_guard_respuestas
  BEFORE UPDATE OR DELETE ON no_session_respuestas
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

CREATE TRIGGER worm_guard_notificaciones
  BEFORE UPDATE OR DELETE ON no_session_notificaciones
  FOR EACH ROW EXECUTE FUNCTION worm_guard();
```

### 3.4 RLS

Todas las tablas nuevas con `tenant_id` y RLS habilitado. `rule_packs` y `rule_pack_versions` son read-only para usuarios normales; solo admin puede activar/desactivar versiones. `rule_param_overrides` es editable por secretaria corporativa. `rule_evaluation_results` y `rule_change_audit` son WORM reales: append-only via RLS (sin politicas UPDATE/DELETE) **mas** trigger `worm_guard()` que lanza excepcion ante cualquier intento de UPDATE o DELETE, incluso desde service_role o funciones SECURITY DEFINER. Doble capa de proteccion (politica + trigger) por recomendacion del equipo legal.

---

## 4. Interfaces TypeScript

### 4.1 Tipos base

```typescript
export type Fuente = "LEY" | "ESTATUTOS" | "PACTO" | "REGLAMENTO";
export type TipoSocial = "SA" | "SL";
export type TipoOrgano = "JUNTA_GENERAL" | "CONSEJO" | "COMISION";

/** Forma de administracion de la entidad (LSC art. 210).
 *  Determina si el organo es colegiado o unipersonal. */
export type FormaAdministracion =
  | "ADMINISTRADOR_UNICO"       // Decision unilateral, acta de consignacion
  | "ADMINISTRADORES_SOLIDARIOS" // Cada uno actua individualmente
  | "ADMINISTRADORES_MANCOMUNADOS" // Actuan conjuntamente (tipico 2)
  | "CONSEJO";                  // Organo colegiado deliberativo

/** Modo de adopcion del acuerdo — determina que secciones del Rule Pack se evaluan. */
export type AdoptionMode =
  | "MEETING"            // Organo colegiado: convocatoria + quorum + votacion
  | "UNIVERSAL"          // Junta universal: skip convocatoria, quorum + votacion
  | "NO_SESSION"         // Acuerdo sin sesion: votacion escrita, requiere unanimidad (SL)
  | "UNIPERSONAL_SOCIO"  // Socio unico: skip convocatoria/quorum/votacion, acta consignacion
  | "UNIPERSONAL_ADMIN"; // Admin unico/solidario: skip convocatoria/quorum/votacion, acta consignacion

/** Tipo de documentacion que genera el acuerdo segun el modo de adopcion */
export type TipoActa =
  | "ACTA_JUNTA"         // Acta de sesion de Junta General
  | "ACTA_CONSEJO"       // Acta de sesion de Consejo/Comision
  | "ACTA_CONSIGNACION_SOCIO"  // Consignacion de decision del socio unico (art. 15 LSC)
  | "ACTA_CONSIGNACION_ADMIN"  // Consignacion de decision de administrador unico
  | "ACTA_DECISION_CONJUNTA"   // Decision de administradores mancomunados
  | "ACTA_ACUERDO_ESCRITO";    // Acuerdo sin sesion (respuestas escritas)

export interface ReglaParametro<T> {
  valor: T;
  fuente: Fuente;
  referencia: string;   // 'LSC art. 193.1' | 'art. 12 estatutos'
}
```

### 4.2 Secciones del Rule Pack

```typescript
export interface ReglaConvocatoria {
  antelacionDias: {
    SA?: ReglaParametro<number>;     // 30 dias (LSC 176)
    SL?: ReglaParametro<number>;     // 15 dias (LSC 176)
    CONSEJO?: ReglaParametro<number>;// 3 dias (uso)
  };
  canalesMinimos: ReglaParametro<Array<"web" | "BORME" | "diario" | "comunicacion_individual">>;
  contenidoMinimo: string[];         // ids de campos obligatorios del anuncio
  segundaConvocatoria?: {
    habilitada: boolean;
    intervaloMinHoras?: number;       // 24h minimo
    plazoReconvocatoria?: number;     // 15 dias si no prevista
  };
}

export interface ReglaConstitucion {
  quorum: {
    SA?: {
      primera: ReglaParametro<number>;   // % capital con derecho de voto
      segunda?: ReglaParametro<number>;  // puede ser 0 (sin minimo en 2a)
    };
    SL?: ReglaParametro<number>;         // no hay quorum legal en SL (salvo estatutos)
    CONSEJO?: ReglaParametro<number>;    // mayoria de miembros
  };
  asistenciaDistanciaCuentaComoPresente: boolean;
}

export interface ReglaVotacion {
  definicionMayoria: {
    SA?: {
      ordinaria: ReglaParametro<MajoritySpec>;
      reforzada?: ReglaParametro<MajoritySpec>;
    };
    SL?: {
      ordinaria: ReglaParametro<MajoritySpec>;
      reforzada?: ReglaParametro<MajoritySpec>;
      superReforzada?: ReglaParametro<MajoritySpec>;
    };
  };
  unanimidades?: Array<{
    ambito: "todos" | "presentes" | "clase";
    claseId?: string;
    fuente: Fuente;
    referencia: string;
  }>;
  vetos?: Array<{
    titularId?: string;
    claseId?: string;
    ambito: string;
    fuente: Fuente;
    oponible: boolean;   // true = bloquea proclamacion; false = solo reporte
  }>;
  votoCalidad?: {
    aplica: boolean;
    excluyeMaterias?: string[];
    fuente: Fuente;
  };
  conflictoInteres?: {
    exclusionVoto: boolean;         // LSC 190: excluir voto del socio conflictuado
    reglasDistintasSASL: boolean;   // SA: solo lista cerrada; SL: mas amplio
    politicaExclusion: Record<string, "EXCLUIR_QUORUM" | "EXCLUIR_VOTO" | "EXCLUIR_AMBOS">;
    // Mapa materia → tipo de exclusion. Ej: { "APROBACION_CUENTAS": "EXCLUIR_VOTO", "MOD_ESTATUTOS": "EXCLUIR_AMBOS" }
    // EXCLUIR_QUORUM: sale del denominador de constitucion pero vota
    // EXCLUIR_VOTO: computa para quorum pero no vota
    // EXCLUIR_AMBOS: sale de ambos denominadores
  };
}

export interface MajoritySpec {
  formula: string;              // 'favor > contra' | 'favor >= 2/3_emitidos' | 'favor > 1/2_capital_presente'
  universoComputo: "votos_emitidos" | "capital_presente" | "consejeros_presentes" | "capital_total";
  tratamientoAbstenciones: "no_cuentan" | "cuentan_como_contra" | "cuentan_como_voto";
  dobleCondicional?: {          // SA 2a conv art.201.2: si capital < 50% -> 2/3
    umbralCapital: number;      // 0.50
    mayoriaAlternativa: string; // 'favor >= 2/3_emitidos'
  };
}

export interface ReglaDocumentacion {
  obligatoria: Array<{
    id: string;                   // 'cuentas_anuales' | 'informe_auditor' | ...
    nombre: string;
    condicion?: string;           // 'si_auditada' | 'si_no_dinerario' | null
  }>;
  disponibilidad: {
    desde: "convocatoria" | "fecha_fija";
    diasMinimos?: number;         // 30 para operaciones estructurales
  };
}

export interface ReglaPlazosMateriales {
  pares: Array<{
    id: string;
    descripcion: string;
    expr: string;                 // 'fecha_formulacion - fecha_cierre <= 3M'
    referencia: string;           // 'LSC 253'
  }>;
}

export interface ReglaPostAcuerdo {
  inscribible: boolean;
  instrumentoRequerido: "ESCRITURA" | "INSTANCIA" | "NINGUNO";
  publicacionRequerida: boolean;
  canalPublicacion?: string;      // 'BORME' | null
  plazoInscripcion?: string;      // '30D' | '2M'
}

/** Reglas de documentacion del acta/consignacion segun el modo de adopcion.
 *  Un organo unipersonal no produce "acta de sesion" sino "acta de consignacion". */
export interface ReglaActa {
  tipoActaPorModo: Record<AdoptionMode, TipoActa>;
  contenidoMinimo: {
    /** Campos obligatorios en el acta de sesion (organo colegiado) */
    sesion?: string[];           // ['asistentes', 'orden_dia', 'deliberaciones', 'votaciones', 'resultado']
    /** Campos obligatorios en el acta de consignacion (organo unipersonal) */
    consignacion?: string[];     // ['identidad_decisor', 'texto_decision', 'fecha', 'firma']
    /** Campos obligatorios en acuerdo sin sesion — contenido probatorio completo */
    acuerdoEscrito?: string[];   // ['denominacion_sociedad', 'organo', 'tipo_proceso', 'materia',
                                  //  'texto_propuesta', 'documentacion_adjunta', 'proponente', 'fecha_propuesta',
                                  //  'relacion_destinatarios', 'canal_notificacion', 'evidencia_notificacion',
                                  //  'ventana_inicio', 'ventana_fin', 'ventana_fuente',
                                  //  'relacion_respuestas', 'consentimientos_recibidos', 'objeciones_recibidas', 'silencios',
                                  //  'condicion_adopcion', 'resultado_evaluacion', 'snapshot_ruleset', 'fecha_cierre',
                                  //  'firma_secretario', 'visto_bueno_presidente']
  };
  /** Para socio unico: transcripcion obligatoria al libro de actas (art. 15.2 LSC) */
  requiereTranscripcionLibroActas: boolean;
  /** Para administradores mancomunados: requiere firma conjunta */
  requiereConformidadConjunta: boolean;
}

/** Reglas especificas para el proceso sin sesion.
 *  Varia sustancialmente entre junta SL y consejo. */
export interface ReglaNoSession {
  habilitado_por_estatutos: ReglaParametro<boolean>;
  habilitado_por_reglamento: ReglaParametro<boolean>;
  condicion_junta_sl: 'UNANIMIDAD_CAPITAL';
  condicion_consejo: 'MAYORIA_SIN_OPOSICION';
  ventana_minima_dias: ReglaParametro<number>;
  ventana_fuente: Fuente;
  canal_requerido_junta_sl: ReglaParametro<Array<'NOTIFICACION_CERTIFICADA' | 'BUROFAX' | 'EMAIL_CON_ACUSE'>>;
  canal_requerido_consejo: ReglaParametro<Array<'NOTIFICACION_CERTIFICADA' | 'EMAIL_CON_ACUSE'>>;
  silencio_equivale_a: 'NADA' | 'OBJECION';
  cierre_anticipado: boolean;
  contenido_minimo_propuesta: string[];
}

export type TipoProceso = 
  | 'UNANIMIDAD_ESCRITA_SL'
  | 'CIRCULACION_CONSEJO'
  | 'DECISION_SOCIO_UNICO_SL'
  | 'DECISION_SOCIO_UNICO_SA';

export type CondicionAdopcion =
  | 'UNANIMIDAD_CAPITAL'
  | 'UNANIMIDAD_CONSEJEROS'
  | 'MAYORIA_CONSEJEROS_ESCRITA'
  | 'DECISION_UNICA';

export type SentidoRespuesta =
  | 'CONSENTIMIENTO'
  | 'OBJECION'
  | 'OBJECION_PROCEDIMIENTO'
  | 'SILENCIO';
```

### 4.3 Rule Pack completo

```typescript
export interface RulePack {
  id: string;
  version: string;
  materia: string;
  organoTipo: TipoOrgano;
  /** Modos de adopcion compatibles con esta materia.
   *  Ej: APROBACION_CUENTAS admite MEETING + UNIVERSAL + UNIPERSONAL_SOCIO.
   *  FORMULACION_CUENTAS solo admite MEETING (consejo) + UNIPERSONAL_ADMIN. */
  modosAdopcionPermitidos: AdoptionMode[];
  convocatoria?: ReglaConvocatoria;
  constitucion?: ReglaConstitucion;
  votacion?: ReglaVotacion;
  documentacion?: ReglaDocumentacion;
  acta?: ReglaActa;
  plazosMateriales?: ReglaPlazosMateriales;
  postAcuerdo?: ReglaPostAcuerdo;
  noSession?: ReglaNoSession;
}
```

### 4.4 Resultado de evaluacion

```typescript
export interface EvaluacionResult {
  etapa: "CONVOCATORIA" | "CONSTITUCION" | "VOTACION" | "DOCUMENTACION" | "PLAZO_MATERIAL";
  ok: boolean;
  explain: ExplainNode[];
  blocking_issues: string[];
}

export interface ExplainNode {
  regla: string;                // 'quorum_primera_SA'
  fuente: Fuente;
  referencia: string;           // 'LSC art. 193.1'
  umbral: number | string;      // 0.25
  valorActual: number | string; // 0.31
  resultado: "OK" | "ERROR" | "WARNING";
  mensaje: string;              // 'Quorum cubierto (31% >= 25%)'
}
```

---

## 5. Catalogo de materias LSC (SA y SL)

Cada materia tiene su Rule Pack con parametros especificos. Primera iteracion: 16 materias.

| # | Materia (agreement_kind) | Organo | Clase | Quorum SA 1a/2a | Mayoria SA | Quorum SL | Mayoria SL | Documentos | Inscribible | Ref. LSC |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `FORMULACION_CUENTAS` | CONSEJO | ORDINARIA | — (consejo) | mayoria consejeros | — | — | borrador_cuentas | No | 253 |
| 2 | `APROBACION_CUENTAS` | JUNTA | ORDINARIA | 25%/sin min | favor > contra | sin quorum legal | >1/2 capital presente | cuentas, informe_gestion, informe_auditor?, propuesta_resultado | No | 272-273 |
| 3 | `APLICACION_RESULTADO` | JUNTA | ORDINARIA | 25%/sin min | favor > contra | sin quorum legal | >1/2 capital presente | propuesta_aplicacion | No | 273 |
| 4 | `NOMBRAMIENTO_CESE` | JUNTA | ORDINARIA | 25%/sin min | favor > contra | sin quorum legal | >1/2 capital presente | informe_comision_nombramientos? | Si | 214-215 |
| 5 | `MOD_ESTATUTOS` | JUNTA | ESTATUTARIA | 50%/25% | >1/2 presente (1a), >=2/3 si <50% (2a) | sin quorum legal | >1/2 capital | texto_integro, informe_admin? | Si | 285-290 |
| 6 | `AUMENTO_CAPITAL` | JUNTA | ESTATUTARIA | 50%/25% | >1/2 presente (1a), >=2/3 si <50% (2a) | sin quorum legal | >1/2 capital | texto_propuesta, informe_admin? | Si | 295-304 |
| 7 | `AUMENTO_CAPITAL_NO_DINERARIO` | JUNTA | ESTATUTARIA | 50%/25% | >1/2 presente (1a), >=2/3 si <50% (2a) | sin quorum legal | >1/2 capital | texto_propuesta, informe_experto | Si | 300, 67-73 |
| 8 | `REDUCCION_CAPITAL` | JUNTA | ESTATUTARIA | 50%/25% | >1/2 presente (1a), >=2/3 si <50% (2a) | sin quorum legal | >1/2 capital | texto_propuesta, informe_admin | Si | 317-327 |
| 9 | `SUPRESION_PREFERENTE` | JUNTA | ESTRUCTURAL | 50%/25% | >=2/3 emitidos (siempre) | sin quorum legal | >=2/3 capital | informe_admin_reforzado, informe_experto? | Si | 308 |
| 10 | `FUSION` | JUNTA | ESTRUCTURAL | 50%/25% | >=2/3 emitidos (siempre) | sin quorum legal | >=2/3 capital | proyecto_comun, informe_admin, informe_experto?, cuentas_base | Si | LME 39-52 |
| 11 | `ESCISION` | JUNTA | ESTRUCTURAL | 50%/25% | >=2/3 emitidos (siempre) | sin quorum legal | >=2/3 capital | proyecto, informes, cuentas_base | Si | LME 68-80 |
| 12 | `TRANSFORMACION` | JUNTA | ESTRUCTURAL | 50%/25% | >=2/3 emitidos (siempre) | sin quorum legal | >=2/3 capital | proyecto, balance | Si | LME 3-21 |
| 13 | `DISOLUCION` | JUNTA | ESTRUCTURAL | 50%/25% | >=2/3 emitidos (siempre) | sin quorum legal | >=2/3 capital | — | Si | 361-370 |
| 14 | `EMISION_OBLIGACIONES` | JUNTA | ESTATUTARIA | 50%/25% | >1/2 presente (1a), >=2/3 si <50% (2a) | sin quorum legal | >1/2 capital | condiciones_emision | Si | 401-433 |
| 15 | `RETRIBUCION_ADMIN` | JUNTA | ORDINARIA | 25%/sin min | favor > contra | sin quorum legal | >1/2 capital presente | politica_retributiva | Si (cotizada) | 217-219 |
| 16 | `CESION_GLOBAL_ACTIVO` | JUNTA | ESTRUCTURAL | 50%/25% | >=2/3 emitidos (siempre) | sin quorum legal | >=2/3 capital | proyecto, informes | Si | LME 81-91 |

**Notas:**
- SA 1a convocatoria ordinaria: quorum 25% capital con derecho de voto (art. 193.1). SA 2a convocatoria ordinaria: sin minimo (art. 193.1 in fine).
- SA 1a convocatoria especial (art. 194): quorum 50% (art. 194.1). SA 2a especial: 25% (art. 194.2).
- SL: no existe quorum de constitucion legal, pero los estatutos pueden establecerlo.
- Mayorias SA ordinarias: favor > contra sobre votos emitidos (art. 201.1). Reforzadas (art. 194): mayoria absoluta en 1a conv; 2/3 emitidos si capital presente < 50% en 2a conv (art. 201.2).
- Mayorias SL ordinarias: >1/2 del capital presente (art. 198). Reforzadas: >=2/3 capital (art. 199). Super-reforzadas (art. 200): ciertos acuerdos necesitan mayoria especifica.

---

## 6. Motores transversales (funciones puras)

### 6.1 Motor de Convocatoria

```typescript
// src/lib/rules-engine/convocatoria-engine.ts

export interface ConvocatoriaInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  fechaJunta: string;           // ISO date
  esCotizada: boolean;
  webInscrita: boolean;
  primeraConvocatoria: boolean;
  esJuntaUniversal: boolean;
  materias: string[];           // agreement_kinds del orden del dia
}

export interface ConvocatoriaOutput {
  fechaLimitePublicacion: string;
  antelacionDiasRequerida: number;
  canalesExigidos: string[];
  contenidoMinimo: string[];
  documentosObligatorios: Array<{ id: string; nombre: string; condicion?: string }>;
  ventanaDisponibilidad: { desde: string; hasta: string };
  ok: boolean;
  explain: ExplainNode[];
  blocking_issues: string[];
}

export function evaluarConvocatoria(
  input: ConvocatoriaInput,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): ConvocatoriaOutput { /* ... */ }
```

**Logica clave:**
- `antelacionDiasRequerida = max(pack.convocatoria.antelacionDias[tipoSocial].valor for pack in packs)`
- Junta universal: skip completo de plazos/canales.
- Canales: si SA y no `webInscrita` -> BORME + diario. Si SL -> comunicacion_individual salvo estatutos.
- Documentos: union de todos los `documentacion.obligatoria` de los packs de las materias.
- Override por entidad: si estatutos elevan plazo, aplicar el mayor.

### 6.2 Motor de Constitucion

```typescript
// src/lib/rules-engine/constitucion-engine.ts

export interface ConstitucionInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  primeraConvocatoria: boolean;
  materiaClase: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  capitalConDerechoVoto: number;
  capitalPresenteRepresentado: number;
  asistentesPresentes?: number;    // para consejo
  totalMiembros?: number;          // para consejo
}

export interface ConstitucionOutput {
  quorumRequerido: number;        // absoluto o porcentaje segun contexto
  quorumPresente: number;
  quorumCubierto: boolean;
  ok: boolean;
  explain: ExplainNode[];
}

export function evaluarConstitucion(
  input: ConstitucionInput,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): ConstitucionOutput { /* ... */ }
```

**Logica clave (SA, LSC arts. 193-194):**
- Ordinaria 1a: 25% capital con derecho de voto.
- Ordinaria 2a: sin minimo (quorum = 0).
- Especial (art. 194) 1a: 50%.
- Especial 2a: 25%.
- El motor selecciona el quorum mas exigente entre ley y estatutos.
- SL: sin quorum legal (0), salvo override estatutario.
- Consejo: mayoria de miembros presentes.

### 6.3 Motor de Votacion

```typescript
// src/lib/rules-engine/votacion-engine.ts

export interface VotacionInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  materiaClase: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  primeraConvocatoria: boolean;
  capitalPresenteRepresentado: number;
  capitalConDerechoVoto: number;
  votosFavor: number;
  votosContra: number;
  abstenciones: number;
  votosBlanco: number;
  conflictosInteres: Array<{
    participanteId: string;
    capitalExcluido: number;
    tipoExclusion: "EXCLUIR_QUORUM" | "EXCLUIR_VOTO" | "EXCLUIR_AMBOS";
  }>;
  esConsejo?: boolean;
  consejerosFavor?: number;
  consejerosContra?: number;
  consejerosPresentes?: number;
}

export interface VotacionOutput {
  acuerdoProclamable: boolean;
  mayoriaRequerida: string;          // descripcion
  mayoriaAlcanzada: boolean;
  unanimidadRequerida: boolean;
  unanimidadAlcanzada: boolean;
  vetoEjercido: boolean;
  votoCalidadUsado: boolean;
  pactosCumplidos: boolean | null;   // null si no hay pactos
  ok: boolean;
  explain: ExplainNode[];
  blocking_issues: string[];
}

export function evaluarVotacion(
  input: VotacionInput,
  pack: RulePack,
  overrides: RuleParamOverride[]
): VotacionOutput { /* ... */ }
```

**Logica clave — Gate Engine de 6 pasos:**

1. **Elegibilidad**: excluir segun politica de conflicto de interes (art. 190). `EXCLUIR_VOTO`: sale del denominador de mayoria pero computa para quorum. `EXCLUIR_QUORUM`: sale del denominador de constitucion pero puede votar. `EXCLUIR_AMBOS`: sale de ambos denominadores. El `capital_convocable` (denominador de quorum) se calcula como `capital_con_derecho_voto - SUM(capital_excluido WHERE tipo IN ('EXCLUIR_QUORUM','EXCLUIR_AMBOS'))`. Si `capital_convocable = 0` → BLOCKING automatico.
2. **Quorum**: ya validado en constitucion — se referencia.
3. **Mayoria**: evaluar segun `definicionMayoria` del pack.
   - SA ordinaria: `favor > contra` sobre votos emitidos.
   - SA reforzada 1a conv: mayoria absoluta del capital presente.
   - SA reforzada 2a conv: si capital presente >= 50% -> mayoria absoluta; si < 50% -> 2/3 emitidos (art. 201.2 doble condicional).
   - SL ordinaria: `favor > 1/2 capital presente`.
   - SL reforzada: `favor >= 2/3 capital`.
4. **Unanimidad**: si el pack o override la exige, verificar por ambito (todos / presentes / clase).
5. **Vetos**: evaluar vetos estatutarios (bloquean proclamacion) y pactados (solo reportan).
6. **Voto de calidad**: solo si empate, solo si habilitado por fuente y no excluido para la materia.

### 6.4 Motor de Documentacion

```typescript
export function evaluarDocumentacion(
  materias: string[],
  packs: RulePack[],
  documentosDisponibles: Array<{ id: string; fechaDisponible: string }>,
  fechaConvocatoria: string
): { ok: boolean; faltantes: string[]; explain: ExplainNode[] }
```

### 6.5 Orquestador

El orquestador selecciona el camino de evaluacion segun el `adoption_mode` del acuerdo:

  - **Flujo A** (MEETING / UNIVERSAL): convocatoria → constitucion → votacion → documentacion → plazos materiales → postAcuerdo. Delega secuencialmente a todos los motores.
  - **Flujo B** (UNIPERSONAL_SOCIO / UNIPERSONAL_ADMIN): skip convocatoria/constitucion/votacion → documentacion (acta consignacion) → plazos materiales → postAcuerdo.
  - **Flujo C** (NO_SESSION): habilitacion → notificacion fehaciente → ventana de consentimiento → evaluacion diferenciada (unanimidad SL / circulacion consejo / decision unica) → acta (acuerdo escrito) → plazos materiales → postAcuerdo. Delega a `evaluarProcesoSinSesion()` (§6.6).

```typescript
// src/lib/rules-engine/orquestador.ts

export interface PerfilSesion {
  antelacionMaxima: number;
  quorumMasExigente: number;
  documentosUnion: Array<{ id: string; nombre: string }>;
  ventanaDisponibilidadMaxima: number;
}

export function componerPerfilSesion(
  input: ConvocatoriaInput,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): PerfilSesion { /* ... */ }

export function evaluarAcuerdoCompleto(
  agreement: AgreementFull,
  entityRules: { tipoSocial: TipoSocial; esCotizada: boolean },
  packs: RulePack[],
  overrides: RuleParamOverride[],
  contextoSesion: {
    primeraConvocatoria: boolean;
    esJuntaUniversal: boolean;
    asistencia: ConstitucionInput;
    votacion: VotacionInput;
    documentos: Array<{ id: string; fechaDisponible: string }>;
  }
): ComplianceResult & { explain: ExplainNode[] } { /* ... */ }
```

### 6.6 Motor de proceso sin sesion

```typescript
// src/lib/rules-engine/no-session-engine.ts

export interface NoSessionInput {
  tipoSocial: TipoSocial;
  organoTipo: TipoOrgano;
  tipoProceso: TipoProceso;
  expediente: {
    propuesta_texto: string;
    ventana_inicio: string;
    ventana_fin: string;
    ventana_fuente: Fuente;
    condicion_adopcion: CondicionAdopcion;
  };
  destinatarios: Array<{
    person_id: string;
    capital_participacion: number;
    porcentaje_capital: number;
    es_consejero: boolean;
    tiene_derecho_voto: boolean;
  }>;
  respuestas: Array<{
    person_id: string;
    sentido: SentidoRespuesta;
    capital_participacion: number;
    firma_qes_ref?: string;
    fecha_respuesta: string;
  }>;
  notificaciones: Array<{
    person_id: string;
    canal: string;
    estado: string;
    entregada_at?: string;
  }>;
}

export interface NoSessionOutput {
  habilitacionOk: boolean;
  materiaAdmitida: boolean;
  notificacionCompleta: boolean;
  ventanaCerrada: boolean;
  condicionCumplida: boolean;
  acuerdoProclamable: boolean;
  ok: boolean;
  explain: ExplainNode[];
  blocking_issues: string[];
}

export function evaluarProcesoSinSesion(
  input: NoSessionInput,
  pack: RulePack,
  overrides: RuleParamOverride[]
): NoSessionOutput { /* ... */ }
```

**Logica: 5 gates secuenciales**

1. **Gate 0 — Habilitacion**: verificar `noSession.habilitado_por_estatutos` (junta SL) o `noSession.habilitado_por_reglamento` (consejo). Si no habilitado → BLOCKING con explain referenciando art. 159.2 o 248 LSC.
2. **Gate 1 — Materia**: verificar `pack.modosAdopcionPermitidos.includes('NO_SESSION')`. Materias reforzadas → BLOCKING con sugerencia de convocar sesion.
3. **Gate 2 — Notificacion fehaciente**: verificar que todos los destinatarios tienen notificacion en estado `ENTREGADA`. Si falta alguno → BLOCKING.
4. **Gate 3 — Ventana**: verificar si la ventana ha cerrado o si cabe cierre anticipado (unanimidad ya alcanzada / objecion recibida).
5. **Gate 4 — Condicion de adopcion** (diferenciada):
   - *UNANIMIDAD_ESCRITA_SL*: 100% capital consentido, 0 objeciones, 0 silencios. Cada consentimiento con firma QES.
   - *CIRCULACION_CONSEJO*: (a) 0 `OBJECION_PROCEDIMIENTO`, (b) mayoria ordinaria sobre consejeros que responden con CONSENTIMIENTO/OBJECION, (c) quorum de participacion (mayoria de miembros).
   - *DECISION_UNICA*: socio/admin unico ha consignado → ok.

**Motor de ventana de consentimiento:**

```typescript
export function evaluarVentana(
  expediente: { ventana_inicio: string; ventana_fin: string; cierre_anticipado: boolean },
  respuestas: Array<{ sentido: SentidoRespuesta }>,
  condicion: CondicionAdopcion,
  totalDestinatarios: number
): { cerrada: boolean; cierreAnticipado: boolean; motivo: string } { /* ... */ }
```

---

## 7. Jerarquia normativa: resolucion de regla efectiva

El motor resuelve la regla efectiva para cada parametro siguiendo esta cadena:

```
1. LEY (LSC / LME)           → minimo inderogable
2. ESTATUTOS de la entidad    → puede elevar, nunca rebajar
3. PACTO / REGLAMENTO        → reporta pero no bloquea (salvo estatutarizado)
```

```typescript
export function resolverReglaEfectiva<T>(
  ley: ReglaParametro<T>,
  override?: ReglaParametro<T>,
  comparador?: (a: T, b: T) => "mas_estricto" | "menos_estricto" | "igual"
): ReglaParametro<T> & { resuelta: boolean; explain: string } {
  if (!override) return { ...ley, resuelta: true, explain: "Aplica ley (sin override)" };
  
  if (override.fuente === "ESTATUTOS" || override.fuente === "REGLAMENTO") {
    const cmp = comparador?.(ley.valor, override.valor);
    if (cmp === "menos_estricto") {
      // Override intenta rebajar minimo legal → BLOQUEO
      return { ...ley, resuelta: false, explain: `Override ${override.fuente} rebaja minimo legal — aplicando LEY` };
    }
    return { ...override, resuelta: true, explain: `Aplica ${override.fuente} (mas estricto que LEY)` };
  }
  
  if (override.fuente === "PACTO") {
    // Pactos no afectan proclamacion societaria, solo se reportan
    return { ...ley, resuelta: true, explain: "Aplica LEY (pacto solo reporta incumplimiento)" };
  }
  
  return { ...ley, resuelta: true, explain: "Aplica ley" };
}
```

---

## 8. Integracion con codigo existente

### 8.1 Hook `useJurisdiccionRules` — adaptacion

El hook actual retorna `JurisdictionRuleSet[]` con `rule_config` JSONB. El nuevo motor NO reemplaza esta tabla inmediatamente: durante la coexistencia, los Rule Packs se consultan en paralelo y el motor emite el resultado V2 junto al V1.

Nueva funcion exportada:

```typescript
// src/hooks/useRulePacks.ts

export function useRulePacksForEntity(entityId?: string) {
  // Carga: entity → jurisdiction + legal_form → rule_packs + overrides
  return useQuery({
    queryKey: ["rule_packs", "entity", entityId],
    enabled: !!entityId,
    queryFn: async () => {
      // 1. Obtener entidad (jurisdiction, legal_form)
      // 2. Cargar rule_pack_versions activos
      // 3. Cargar rule_param_overrides para esta entidad
      // 4. Retornar { packs: RulePack[], overrides: RuleParamOverride[] }
    }
  });
}
```

### 8.2 Hook `useAgreementCompliance` — fachada

El hook existente se mantiene como fachada. Internamente, delega al nuevo motor cuando el feature flag `ENGINE_V2` esta activo:

```typescript
export function useAgreementCompliance(agreementId?: string) {
  return useQuery({
    // ... misma queryKey y enabled
    queryFn: async (): Promise<ComplianceResult | null> => {
      // ... cargar agreement, entity, etc (igual que ahora)
      
      if (FEATURE_FLAGS.ENGINE_V2) {
        // Nuevo path: cargar rule packs + overrides + evaluar
        const { packs, overrides } = await loadRulePacksForEntity(entityId);
        const result = evaluarAcuerdoCompleto(agreement, entityRules, packs, overrides, contexto);
        // Mapear a ComplianceResult (misma interfaz de salida)
        return mapToComplianceResult(result);
      }
      
      // Legacy path: logica actual inline (sin cambios)
      // ...
    }
  });
}
```

### 8.3 `checkNoticePeriodByType` — correccion inmediata

La funcion actual tiene un bug: usa 15 dias para SA (deberia ser 30). El nuevo motor lo corrige via Rule Pack, pero como fix inmediato:

```typescript
const minDays: Record<string, Record<string, number>> = {
  ES: { ORDINARIA: 30, EXTRAORDINARIA: 30 },  // SA: 30 dias (art. 176 LSC)
  // NOTA: SL son 15 dias, pero esta funcion no distingue SA/SL
  // → deprecar en favor del motor V2 que si distingue
};
```

### 8.4 Componentes frontend

| Componente existente | Cambio |
|---|---|
| `ConvocatoriasStepper` | Step 2 (plazo): consumir `evaluarConvocatoria()` en vez de `checkNoticePeriodByType()`. Mostrar explain con fuente y referencia legal. |
| `ReunionStepper` | Step 3 (quorum): consumir `evaluarConstitucion()` en vez de `computeQuorumStatus()`. Badge con fuente. |
| `ReunionStepper` | Step 4 (votacion): consumir `evaluarVotacion()` con gate engine completo. |
| `ExpedienteAcuerdo` | Timeline: mostrar `rule_evaluation_results` con explain expandible. |
| `SecretariaDashboard` | KPIs: usar motor V2 para compliance flags. |
| `TramitadorStepper` | Steps 2-3: inscribibilidad y instrumento del Rule Pack `postAcuerdo`. |

---

## 9. Seed de Rule Packs (datos iniciales)

### 9.1 Ejemplo: APROBACION_CUENTAS

```json
{
  "id": "APROBACION_CUENTAS",
  "version": "1.0.0",
  "materia": "APROBACION_CUENTAS",
  "organoTipo": "JUNTA_GENERAL",
  "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL", "UNIPERSONAL_SOCIO"],
  "acta": {
    "tipoActaPorModo": {
      "MEETING": "ACTA_JUNTA",
      "UNIVERSAL": "ACTA_JUNTA",
      "UNIPERSONAL_SOCIO": "ACTA_CONSIGNACION_SOCIO",
      "UNIPERSONAL_ADMIN": "ACTA_CONSIGNACION_ADMIN",
      "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
    },
    "contenidoMinimo": {
      "sesion": ["asistentes", "orden_dia", "deliberaciones", "votaciones", "resultado"],
      "consignacion": ["identidad_decisor", "texto_decision", "fecha", "firma"]
    },
    "requiereTranscripcionLibroActas": true,
    "requiereConformidadConjunta": false
  },
  "convocatoria": {
    "antelacionDias": {
      "SA": { "valor": 30, "fuente": "LEY", "referencia": "LSC art. 176.1" },
      "SL": { "valor": 15, "fuente": "LEY", "referencia": "LSC art. 176.1" }
    },
    "canalesMinimos": {
      "valor": ["web"],
      "fuente": "LEY",
      "referencia": "LSC art. 173"
    },
    "contenidoMinimo": ["denominacion", "fecha", "hora", "lugar", "orden_dia", "derecho_informacion"],
    "segundaConvocatoria": { "habilitada": true, "intervaloMinHoras": 24 }
  },
  "constitucion": {
    "quorum": {
      "SA": {
        "primera": { "valor": 0.25, "fuente": "LEY", "referencia": "LSC art. 193.1" },
        "segunda": { "valor": 0, "fuente": "LEY", "referencia": "LSC art. 193.1 in fine" }
      },
      "SL": { "valor": 0, "fuente": "LEY", "referencia": "Sin quorum legal para SL" }
    },
    "asistenciaDistanciaCuentaComoPresente": true
  },
  "votacion": {
    "definicionMayoria": {
      "SA": {
        "ordinaria": {
          "valor": {
            "formula": "favor > contra",
            "universoComputo": "votos_emitidos",
            "tratamientoAbstenciones": "no_cuentan"
          },
          "fuente": "LEY",
          "referencia": "LSC art. 201.1"
        }
      },
      "SL": {
        "ordinaria": {
          "valor": {
            "formula": "favor > 1/2_capital_presente",
            "universoComputo": "capital_presente",
            "tratamientoAbstenciones": "no_cuentan"
          },
          "fuente": "LEY",
          "referencia": "LSC art. 198"
        }
      }
    },
    "conflictoInteres": { "exclusionVoto": true, "reglasDistintasSASL": true }
  },
  "documentacion": {
    "obligatoria": [
      { "id": "cuentas_anuales", "nombre": "Cuentas anuales" },
      { "id": "informe_gestion", "nombre": "Informe de gestion", "condicion": "si_aplica" },
      { "id": "informe_auditor", "nombre": "Informe del auditor", "condicion": "si_auditada" },
      { "id": "propuesta_resultado", "nombre": "Propuesta de aplicacion del resultado" }
    ],
    "disponibilidad": { "desde": "convocatoria" }
  },
  "plazosMateriales": {
    "pares": [
      {
        "id": "aprobacion_en_6_meses",
        "descripcion": "Aprobar cuentas dentro de los 6 primeros meses del ejercicio",
        "expr": "fecha_junta - fecha_cierre_ejercicio <= 6M",
        "referencia": "LSC art. 164.1"
      }
    ]
  },
  "postAcuerdo": {
    "inscribible": false,
    "instrumentoRequerido": "NINGUNO",
    "publicacionRequerida": false
  }
}
```

### 9.2 Ejemplo: MOD_ESTATUTOS (materia reforzada)

```json
{
  "id": "MOD_ESTATUTOS",
  "version": "1.0.0",
  "materia": "MOD_ESTATUTOS",
  "organoTipo": "JUNTA_GENERAL",
  "modosAdopcionPermitidos": ["MEETING", "UNIVERSAL", "UNIPERSONAL_SOCIO"],
  "acta": {
    "tipoActaPorModo": {
      "MEETING": "ACTA_JUNTA",
      "UNIVERSAL": "ACTA_JUNTA",
      "UNIPERSONAL_SOCIO": "ACTA_CONSIGNACION_SOCIO",
      "UNIPERSONAL_ADMIN": "ACTA_CONSIGNACION_ADMIN",
      "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
    },
    "contenidoMinimo": {
      "sesion": ["asistentes", "orden_dia", "deliberaciones", "votaciones", "resultado"],
      "consignacion": ["identidad_decisor", "texto_decision", "fecha", "firma"]
    },
    "requiereTranscripcionLibroActas": true,
    "requiereConformidadConjunta": false
  },
  "convocatoria": {
    "antelacionDias": {
      "SA": { "valor": 30, "fuente": "LEY", "referencia": "LSC art. 176.1" },
      "SL": { "valor": 15, "fuente": "LEY", "referencia": "LSC art. 176.1" }
    },
    "canalesMinimos": { "valor": ["web"], "fuente": "LEY", "referencia": "LSC art. 173" },
    "contenidoMinimo": ["denominacion", "fecha", "hora", "lugar", "orden_dia", "texto_integro_modificacion"],
    "segundaConvocatoria": { "habilitada": true, "intervaloMinHoras": 24 }
  },
  "constitucion": {
    "quorum": {
      "SA": {
        "primera": { "valor": 0.50, "fuente": "LEY", "referencia": "LSC art. 194.1" },
        "segunda": { "valor": 0.25, "fuente": "LEY", "referencia": "LSC art. 194.2" }
      },
      "SL": { "valor": 0, "fuente": "LEY", "referencia": "Sin quorum legal para SL" }
    },
    "asistenciaDistanciaCuentaComoPresente": true
  },
  "votacion": {
    "definicionMayoria": {
      "SA": {
        "reforzada": {
          "valor": {
            "formula": "favor > 1/2_capital_presente",
            "universoComputo": "capital_presente",
            "tratamientoAbstenciones": "cuentan_como_voto",
            "dobleCondicional": {
              "umbralCapital": 0.50,
              "mayoriaAlternativa": "favor >= 2/3_emitidos"
            }
          },
          "fuente": "LEY",
          "referencia": "LSC art. 201.2"
        }
      },
      "SL": {
        "reforzada": {
          "valor": {
            "formula": "favor > 1/2_capital",
            "universoComputo": "capital_presente",
            "tratamientoAbstenciones": "no_cuentan"
          },
          "fuente": "LEY",
          "referencia": "LSC art. 199.a"
        }
      }
    },
    "conflictoInteres": { "exclusionVoto": true, "reglasDistintasSASL": true }
  },
  "documentacion": {
    "obligatoria": [
      { "id": "texto_integro_modificacion", "nombre": "Texto integro de la modificacion propuesta" },
      { "id": "informe_administradores", "nombre": "Informe de los administradores", "condicion": "si_aplica" }
    ],
    "disponibilidad": { "desde": "convocatoria" }
  },
  "postAcuerdo": {
    "inscribible": true,
    "instrumentoRequerido": "ESCRITURA",
    "publicacionRequerida": false,
    "plazoInscripcion": "30D"
  }
}
```

### 9.3 Ejemplo: FORMULACION_CUENTAS (materia de consejo, admite admin unico)

```json
{
  "id": "FORMULACION_CUENTAS",
  "version": "1.0.0",
  "materia": "FORMULACION_CUENTAS",
  "organoTipo": "CONSEJO",
  "modosAdopcionPermitidos": ["MEETING", "UNIPERSONAL_ADMIN"],
  "acta": {
    "tipoActaPorModo": {
      "MEETING": "ACTA_CONSEJO",
      "UNIVERSAL": "ACTA_CONSEJO",
      "UNIPERSONAL_SOCIO": "ACTA_CONSIGNACION_SOCIO",
      "UNIPERSONAL_ADMIN": "ACTA_CONSIGNACION_ADMIN",
      "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
    },
    "contenidoMinimo": {
      "sesion": ["asistentes", "orden_dia", "deliberaciones", "votaciones", "resultado"],
      "consignacion": ["identidad_decisor", "texto_decision", "fecha", "firma"]
    },
    "requiereTranscripcionLibroActas": false,
    "requiereConformidadConjunta": false
  },
  "convocatoria": {
    "antelacionDias": {
      "CONSEJO": { "valor": 3, "fuente": "REGLAMENTO", "referencia": "Reglamento CdA art. 5" }
    },
    "canalesMinimos": {
      "valor": ["comunicacion_individual"],
      "fuente": "REGLAMENTO",
      "referencia": "Reglamento CdA"
    },
    "contenidoMinimo": ["fecha", "hora", "lugar", "orden_dia"],
    "segundaConvocatoria": { "habilitada": false }
  },
  "constitucion": {
    "quorum": {
      "CONSEJO": { "valor": 0.5, "fuente": "LEY", "referencia": "LSC art. 247 — mayoria de miembros" }
    },
    "asistenciaDistanciaCuentaComoPresente": true
  },
  "votacion": {
    "definicionMayoria": {
      "SA": {
        "ordinaria": {
          "valor": {
            "formula": "favor > contra",
            "universoComputo": "consejeros_presentes",
            "tratamientoAbstenciones": "no_cuentan"
          },
          "fuente": "LEY",
          "referencia": "LSC art. 248"
        }
      }
    },
    "votoCalidad": { "aplica": true, "fuente": "ESTATUTOS" },
    "conflictoInteres": { "exclusionVoto": true, "reglasDistintasSASL": false }
  },
  "documentacion": {
    "obligatoria": [
      { "id": "borrador_cuentas", "nombre": "Borrador de cuentas anuales" }
    ],
    "disponibilidad": { "desde": "convocatoria" }
  },
  "plazosMateriales": {
    "pares": [
      {
        "id": "formulacion_en_3_meses",
        "descripcion": "Formular cuentas dentro de los 3 meses siguientes al cierre",
        "expr": "fecha_formulacion - fecha_cierre_ejercicio <= 3M",
        "referencia": "LSC art. 253"
      }
    ]
  },
  "postAcuerdo": {
    "inscribible": false,
    "instrumentoRequerido": "NINGUNO",
    "publicacionRequerida": false
  }
}
```

**Nota sobre `FORMULACION_CUENTAS` con admin unico:** cuando la entidad tiene forma de administracion `ADMINISTRADOR_UNICO`, el modo cambia a `UNIPERSONAL_ADMIN` — se saltan convocatoria, constitucion y votacion. El motor solo evalua que exista el acta de consignacion (identidad del administrador, texto de la decision de formular, fecha, firma) y los plazos materiales (3 meses desde cierre).

---

## 10. Modelo de personas: fisica/juridica, representacion y capital

### 10.1 Gap actual

La tabla `persons` almacena `full_name` y `email` sin distinguir naturaleza juridica. La tabla `mandates` vincula persona → organo con `role`, `start_date`, `end_date`, `status`, pero no registra capital asociado ni tipo de persona. `meeting_attendees` tiene `represented_by_id` (representacion en sesion), lo cual cubre parcialmente el art. 184 LSC pero sin validacion de elegibilidad del representante.

El motor de reglas necesita tres datos que hoy no existen:
1. **Naturaleza de la persona**: fisica vs juridica (para aplicar art. 212 bis — consejero persona juridica con representante permanente).
2. **Capital o acciones por mandate**: para computar quorum (% capital presente) y mayorias (votos ponderados por capital).
3. **Representante persona fisica designado**: cuando un consejero o socio es persona juridica, quien ejerce efectivamente el cargo.

### 10.2 Extension del esquema

```sql
-- Columnas nuevas en persons
ALTER TABLE persons ADD COLUMN person_type TEXT NOT NULL DEFAULT 'NATURAL'
  CHECK (person_type IN ('NATURAL', 'JURIDICA'));
ALTER TABLE persons ADD COLUMN tax_id TEXT;                    -- NIF/CIF
ALTER TABLE persons ADD COLUMN representative_person_id UUID REFERENCES persons(id);
  -- Solo si person_type = 'JURIDICA': persona fisica que actua en nombre de la juridica
ALTER TABLE persons ADD COLUMN denomination TEXT;              -- Razon social (solo JURIDICA)

-- Columnas nuevas en mandates
ALTER TABLE mandates ADD COLUMN capital_participacion NUMERIC;  -- Num acciones o participaciones
ALTER TABLE mandates ADD COLUMN porcentaje_capital NUMERIC;     -- % sobre capital social (calculado o fijo)
ALTER TABLE mandates ADD COLUMN tiene_derecho_voto BOOLEAN DEFAULT true;
ALTER TABLE mandates ADD COLUMN clase_accion TEXT;              -- Para unanimidades/vetos de clase
ALTER TABLE mandates ADD COLUMN representative_person_id UUID REFERENCES persons(id);
  -- Representante permanente del consejero persona juridica (art. 212 bis)
  -- Distinto de meeting_attendees.represented_by_id que es representacion en sesion puntual

-- Columnas nuevas en meeting_attendees
ALTER TABLE meeting_attendees ADD COLUMN capital_representado NUMERIC;
  -- Capital que aporta al quorum (propio + delegaciones recibidas)
ALTER TABLE meeting_attendees ADD COLUMN via_representante BOOLEAN DEFAULT false;
  -- True si asiste via represented_by_id
```

### 10.3 Tipos TypeScript

```typescript
export type PersonType = "NATURAL" | "JURIDICA";

export interface PersonaExtended {
  id: string;
  full_name: string;
  person_type: PersonType;
  tax_id?: string;
  denomination?: string;                // Razon social si JURIDICA
  representative_person_id?: string;     // Representante permanente (art. 212 bis)
}

export interface MandateExtended {
  id: string;
  person_id: string;
  body_id: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  capital_participacion?: number;
  porcentaje_capital?: number;
  tiene_derecho_voto: boolean;
  clase_accion?: string;
  representative_person_id?: string;     // Representante del consejero persona juridica
}

export interface AsistenteConCapital {
  mandate_id: string;
  person_id: string;
  person_type: PersonType;
  capital_representado: number;          // Capital propio + delegaciones
  tiene_derecho_voto: boolean;
  clase_accion?: string;
  via_representante: boolean;
  representante_id?: string;             // Quien asiste fisicamente
  excluido_conflicto: boolean;           // Exclusion por art. 190
}
```

### 10.4 Impacto en los motores

**Motor de constitucion:**
- `capitalPresenteRepresentado` se calcula como `SUM(capital_representado)` de asistentes con `presente = true AND tiene_derecho_voto = true`.
- `capitalConDerechoVoto` se calcula como `SUM(capital_participacion)` de todos los mandatos activos con `tiene_derecho_voto = true`.
- Asistencia a distancia (`attendance_mode = 'DISTANCIA'`) cuenta como presente si `asistenciaDistanciaCuentaComoPresente = true` en el Rule Pack.

**Motor de votacion:**
- Gate 1 (Elegibilidad): excluye mandatos con conflicto de interes (art. 190). El capital excluido se resta del universo de computo.
- Gate 3 (Mayoria): cuando `universoComputo = 'capital_presente'`, usa la suma de `capital_representado` de los asistentes habilitados. Cuando `universoComputo = 'votos_emitidos'`, cada mandate emite tantos votos como `capital_participacion` (acciones = votos en SA, salvo acciones sin voto).
- Gate 4 (Unanimidad por clase): filtra mandatos por `clase_accion` y verifica unanimidad dentro de la clase.

**Representacion en sesion (arts. 184-186 LSC):**
- SA: representacion libre (cualquier persona puede representar a un socio).
- SL: representante debe ser otro socio, conyuge, ascendiente o descendiente, salvo disposicion estatutaria mas amplia (art. 183 LSC).
- El motor NO valida la elegibilidad del representante en esta iteracion (complejidad alta, bajo riesgo en demo). Se registra como WARNING en el explain.

**Persona juridica como miembro (art. 212 bis LSC):**
- Si `person_type = 'JURIDICA'` en un mandate activo, el motor verifica que `representative_person_id` esta designado.
- Si no hay representante designado, emite BLOCKING con explain: "Consejero persona juridica sin representante designado (art. 212 bis LSC)".
- El representante persona fisica ejerce las funciones del cargo con responsabilidad solidaria.

### 10.5 Fuera de alcance (personas)

- Registro Mercantil de representantes (inscripcion/cambio)
- Acciones sin voto y participaciones privilegiadas (computo diferenciado)
- Sindicatos de voto (agrupacion pactada — pista pactos parasociales)
- Custodia de identidad (KYC, PEP screening)

---

## 11. Plantillas protegidas: acta y certificacion como contenedores normativos

### 11.1 Fundamento

El acta y la certificacion son contenedores normativos versionados que deben portar el identificador del snapshot de reglas aplicadas. Su proteccion textual y la incrustacion de metadatos juridicos son determinantes para la fuerza probatoria y la reproducibilidad ex post. La valoracion del equipo legal concluye que desplegar plantillas protegidas en el go-live es imprescindible, no diferible.

A nivel estrategico, el ciclo de plantillas se organiza en **tres oleadas**: (1) esqueletos tecnicos sin contenido juridico en Fase 0, (2) contenido juridico real durante Fase 1-2 en paralelo con estabilizacion de tipos, (3) aprobacion formal y activacion antes del switch ENGINE_V2. Este modelo permite que el equipo legal inicie trabajo sin bloqueos y que los esqueletos tecnicos sirvan de base para dev/testing desde dia 1.

### 11.2 Modelo de plantilla protegida

```typescript
export interface PlantillaProtegida {
  id: string;
  tipo: "ACTA_SESION" | "ACTA_CONSIGNACION" | "CERTIFICACION" | "CONVOCATORIA";
  materia?: string;                     // null = generica
  jurisdiccion: string;                 // 'ES'
  version: string;                      // semver
  estado: "BORRADOR" | "REVISADA" | "APROBADA" | "ACTIVA" | "DEPRECADA";
  aprobada_por?: string;                // 'comite_legal'
  fecha_aprobacion?: string;
  contenido_template: string;           // Con variables {{...}}
  variables: PlantillaVariable[];
  protecciones: PlantillaProteccion[];
  snapshot_rule_pack_required: boolean; // True = la plantilla debe embeber ruleset_snapshot_id
}

export interface PlantillaVariable {
  clave: string;                        // 'fecha_sesion', 'quorum_porcentaje', etc.
  tipo: "TEXT" | "DATE" | "NUMBER" | "ENUM" | "COMPUTED";
  obligatoria: boolean;
  fuente?: "MOTOR_REGLAS" | "USUARIO" | "SISTEMA" | "QTSP";
  descripcion: string;
}

export interface PlantillaProteccion {
  tipo: "CLAUSULA_INMUTABLE" | "CAMPO_OBLIGATORIO" | "FORMATO_FIJO" | "BLOQUEO_EDICION";
  selector: string;                     // Selector de la seccion protegida
  mensaje_error: string;
}
```

### 11.3 Tres oleadas de integracion

**Oleada 0 — Plantillas esqueleto (seed tecnico): Fase 0, T3d**

Fase 0 genera 3 plantillas genericas en estado BORRADOR como artefactos tecnicos puros:
- ACTA_SESION (generico, sin materia)
- ACTA_CONSIGNACION (generico)
- CERTIFICACION (generico)

Contenido: HTML/Markdown con placeholders (`{{snapshot_hash}}`, `{{resultado_gate}}`, `{{firmante_secretario}}`). Sin participacion de comite legal. Objetivo: permitir que dev valide Gate PRE, renderizado, firma QES y evidence bundles desde T2 en adelante.

**Oleada 1 — Plantillas con contenido juridico: entre Fase 1 y Fase 2**

Cuando el contrato de variables es estable (post T4+T11+T13c), el Comite Legal redacta plantillas definitivas con contenido legal:
- Clausulas de proclamacion normativas
- Advertencias de derechos y obligaciones
- Formulas de captura de consentimientos
- Indicadores de exclusion por conflicto
- Huellas de snapshot y verificacion offline

Trabajo comienza en paralelo con Fase 1 tan pronto como T4 congela tipos. Entrega esperada: S3 + S4.

**Oleada 2 — Aprobacion formal y activacion: antes del switch (Fase 3, T20)**

Las plantillas de Oleada 1 pasan revision del Comite Legal, pasan UAT (Gate PRE acepta, firma QES funciona), transicionan a APROBADA → ACTIVA. Solo plantillas ACTIVAS se usan en produccion. Switch ENGINE_V2 ocurre con todas las plantillas go-live en ACTIVA.

Ciclo de vida: `BORRADOR → REVISADA → APROBADA → ACTIVA`. Cada transicion se registra en `rule_change_audit` WORM (tabla append-only que registra quién, cuándo, qué cambió).

### 11.4 Contrato de variables

El contrato de variables es un artefacto techno-juridico versionado en YAML que documenta, para cada plantilla, **qué variables inyecta el motor, cuales completa el usuario, y cuales proceden de QTSP**. Es la fuente de verdad del ciclo de vida de datos en cada documento.

Estructura (3 bloques):

**Bloque 1 — Variables MOTOR_REGLAS** (auto-inyectadas por el motor)

Cada variable documenta:
- Nombre canonico (ej: `snapshot_hash`, `resultado_gate`, `quorum_porcentaje_requerido`)
- Tipo TypeScript (ej: `string`, `boolean`, `number`)
- Formato de renderizado (ej: "SHA-256 hex", "true/false", "0.XX")
- Condicion de presencia (ej: "siempre", "si adoption_mode = MEETING", "si materia = MOD_ESTATUTOS")
- Fuente de datos (ej: "hash(rule_pack + overrides)", "gate resultado ADOPTED", "regla LSC")

Ejemplo ACTA_SESION:
```yaml
MOTOR_REGLAS:
  snapshot_hash:
    tipo: "string"
    formato: "SHA-256 hex lowercase"
    presencia: "siempre"
    fuente: "SHA-256(rule_pack payload + overrides)"
  
  resultado_gate:
    tipo: "string enum"
    formato: "GATE_BLOQUEADO | GATE_ADVERTENCIA | GATE_OK"
    presencia: "siempre"
    fuente: "rule_evaluation_results.result_status"
  
  quorum_porcentaje_requerido:
    tipo: "number"
    formato: "0.XX (p.e., 0.50 = 50%)"
    presencia: "si adoption_mode = MEETING"
    fuente: "regla LSC / override estatutario"
```

**Bloque 2 — Variables USUARIO** (completadas por secretario)

Cada variable documenta:
- Nombre canonico (ej: `deliberaciones_consejero_A`, `reserva_voto_consejero_B`)
- Tipo (TEXT, DATE, ENUM)
- Obligatoriedad (BLOCKING si falta bloquea acta; WARNING si falta emite alerta)
- Contexto/instrucciones

Ejemplo ACTA_SESION:
```yaml
USUARIO:
  deliberaciones:
    tipo: "TEXT"
    obligatoriedad: "WARNING"
    descripcion: "Resumen de deliberaciones por cada punto de orden del dia"
  
  observaciones_presidente:
    tipo: "TEXT"
    obligatoriedad: "BLOCKING"
    descripcion: "Observaciones y consideraciones finales del presidente"
  
  reserva_voto:
    tipo: "ENUM (SI|NO)"
    obligatoriedad: "BLOCKING"
    descripcion: "Cada consejero declara si se reserva del acuerdo"
```

**Bloque 3 — Variables QTSP** (inyectadas por servicios eIDAS)

Cada variable documenta:
- Nombre canonico (ej: `tsq_token`, `firma_qes`, `timestamp_notificacion`)
- Servicio QTSP (ej: "TSQ via EAD Trust", "QES via EAD Trust", "Notificacion certificada EAD Trust")
- Momento de inyeccion (ej: "fase Gate PRE", "fase firma", "post ADOPTED")
- Formato de persistencia (ej: "JWT", "base64 PKCS#7", "reference URI")

Ejemplo:
```yaml
QTSP:
  tsq_token:
    tipo: "JWT"
    servicio: "TSQ via EAD Trust"
    momento_inyeccion: "inmediatamente despues evaluacion, antes renderizado"
    persistencia: "rule_evaluation_results.tsq_token TEXT"
  
  firma_qes:
    tipo: "base64 PKCS#7"
    servicio: "QES via EAD Trust"
    momento_inyeccion: "post renderizado, pre entrega a contrapartida"
    persistencia: "agreement_signatures.signature_bytes BYTEA + timestamp TIMESTAMPTZ"
  
  timestamp_notificacion:
    tipo: "ISO 8601"
    servicio: "Notificacion certificada QTSP"
    momento_inyeccion: "cuando acuerdo transiciona a PUBLISHED"
    persistencia: "evidence_snapshots.notification_timestamp TIMESTAMPTZ"
```

**Protocolo de congelacion:**

1. **Paso 1**: Tras estabilizar tipos en T4, auto-generar borrador del contrato YAML via script `generate-variable-contract.ts` que exporta tipos TypeScript reales.

2. **Paso 2**: Cross-review (Dev revisa variables QTSP contra QTSP integration spec; Comite Legal revisa variables USUARIO contra matriz de obligaciones legales).

3. **Paso 3**: Firmar y versionear contrato como `1.0.0`, almacenar en `docs/contratos/variables-plantillas-v1.0.0.yaml` bajo control Git. Crear tag Git `contract-v1.0.0`.

**Test de congelacion:**

Test CI que compara tipos exportados desde `src/lib/rules-engine/types.ts` contra variables documentadas en YAML. Si divergen (p.e., T11 anade variable nueva, contrato no se actualiza): test FALLA, merge bloqueado. Previene drift silencioso.

### 11.5 Plantillas minimas para go-live (7 plantillas)

Criterios de seleccion: (i) cobertura de modos (MEETING, UNIVERSAL, UNIPERSONAL_SOCIO, UNIPERSONAL_ADMIN, NO_SESSION), (ii) cobertura de documentos (actas de sesion, actas de consignacion, certificaciones, convocatorias), (iii) frecuencia y riesgo de materia en casos reales.

7 plantillas go-live (Oleada 1 + 2):

| # | Plantilla | Modos cubiertos | Justificacion |
|---|---|---|---|
| 1 | Acta de sesion — Junta General | MEETING, UNIVERSAL | Contenedor mas frecuente; cuerpo del grupo |
| 2 | Acta de sesion — Consejo Administracion | MEETING | Formulacion cuentas obligacion anual; nucleo governance |
| 3 | Acta consignacion — Socio/Admin unico | UNIPERSONAL_SOCIO, UNIPERSONAL_ADMIN | Una plantilla con condicional segun persona_type; cobertura de modos sin sesion |
| 4 | Acta de acuerdo escrito — Sin sesion | NO_SESSION | Flujo dominante (60-80% operativa); estructura propia |
| 5 | Certificacion de acuerdos | Todos (transversal) | Requiere todas para tramitacion registral; impacto alto en reproducibilidad |
| 6 | Convocatoria — SA | MEETING | Publicacion web/BORME; adecuacion antelacion + documentos |
| 7 | Convocatoria — SL | MEETING | Notificacion individual certificada; regimen diferenciado art. 204 LSC |

Post go-live: acta decision conjunta, plantillas especializadas por materia (p.e., RETRIBUCION_ADMIN, MOD_ESTATUTOS).

### 11.6 Estructura interna de cada plantilla (3 capas)

**Capa 1: Inmutable** (protegida por hash)

- Encabezamiento legal: ley aplicable, referencias, advertencias de derechos
- Formulas de proclamacion normativas: "ACUERDO ADOPTADO POR...", "CONSTANCIA DE QUORUM", "CONSTANCIA DE MAYORIA"
- Advertencias de efectos juridicos: "Este acta tiene fuerza probatoria plena", "Puede ser recurrida ante..."
- Referencia snapshot: "Evaluado bajo rule_pack_id=XXX version=1.0, snapshot_hash=YYY"

Ejemplo en acta:
```
La presente Acta de Sesion ha sido evaluada conforme a los criterios 
de Quorum, Mayoria y Completitud definidos en la regla identificada 
por hash snapshot_hash bajo el Rule Pack XXX v1.0. 
La evaluacion se registra en rule_evaluation_results.
Puede ser verificada offline mediante el bundle de evidencias 
adjunto en formato ASiC-E.
```

Gate PRE verifica integridad de esta capa via hash de contenido.

**Capa 2: Parametrizada** (variables motor)

- Datos sociedad: razon social, NIF, domicilio
- Datos organo: tipo (JGE, CdA, Comision), convocatoria referencia
- Resultado Gate: "GATE_OK", "GATE_ADVERTENCIA", "GATE_BLOQUEADO"
- Explain resumido: sintesis de evaluaciones OK/ERROR por etapa
- Hash snapshot: incrustado en encabezamiento
- Sello QES y TSQ: referencias a certificados QTSP

**Capa 3: Editable** (variables usuario)

- Deliberaciones detalladas: voto de cada consejero, fundamentos
- Observaciones presidente: apreciaciones, reservas
- Ruegos y preguntas: intervenciones no formales
- Declaracion de conflictos: consejeros excluidos, motivos

Gate PRE verifica completitud de variables BLOCKING (detiene si faltan), emite WARNING si faltan variables WARNING.

### 11.7 Gate PRE con fallback (STRICT/FALLBACK/DISABLED)

El Gate PRE soporta 3 niveles de exigencia por tipo de plantilla y adoption_mode. Configuracion:

```typescript
export type PlantillaExigencia = 'STRICT' | 'FALLBACK' | 'DISABLED';

export interface PlantillaGateRule {
  tipo: TipoPlantilla;                    // ACTA_SESION, CERTIFICACION, etc.
  adoption_mode: AdoptionMode;            // MEETING, UNIVERSAL, UNIPERSONAL_*, NO_SESSION
  exigencia: PlantillaExigencia;
  fallback_tipo?: TipoPlantilla;          // Tipo alternativo si fallback
  fallback_modo?: AdoptionMode;           // Modo alternativo si fallback
}

export interface PlantillaGateConfig {
  rules: PlantillaGateRule[];
}
```

**Comportamiento:**

- **STRICT**: plantilla requerida. Si no existe ACTIVA → Gate PRE emite BLOCKING. Flujo detiene, sin alternativa.
- **FALLBACK**: plantilla preferida pero no requerida. Si no existe ACTIVA, intenta fallback_tipo+fallback_modo. Si fallback existe ACTIVA, renderiza con WARNING. Si tampoco fallback → BLOCKING.
- **DISABLED**: plantilla opcional. Si no existe → renderiza sin plantilla (inline template via JS), sin bloqueo ni advertencia.

**Configuracion go-live:**

```yaml
plantilla_gate_config:
  - tipo: ACTA_SESION
    adoption_mode: MEETING
    exigencia: STRICT
  
  - tipo: ACTA_SESION
    adoption_mode: UNIPERSONAL_SOCIO
    exigencia: FALLBACK
    fallback_tipo: ACTA_CONSIGNACION
    fallback_modo: UNIPERSONAL_SOCIO
  
  - tipo: CERTIFICACION
    adoption_mode: '*'  # todos los modos
    exigencia: STRICT
  
  - tipo: CONVOCATORIA
    adoption_mode: MEETING
    exigencia: STRICT
```

**Comportamiento WARNING:**

Cuando se renderiza en FALLBACK (porque preferida no existe pero fallback si), acta recibe marca visible: banner amarillo "ACTA GENERADA CON PLANTILLA ALTERNATIVA". El campo `rule_evaluation_results.result_status` registra WARNING. El `explain` anota qué plantilla se solicito y cuál se uso. El `evidence_bundle` marca el documento con atributo `warn_alternative_template = true`.

**Transicion FALLBACK → STRICT:**

Cuando Oleada 2 activa plantilla preferida (STRICT), próximas evaluaciones usan plantilla estricta directamente. Documentos previos en FALLBACK permanecen versionados con marca. Retroactividad: no se re-renderiza historico.

### 11.8 Regla de estabilidad post-Gate 2

Post Gate 2 (contrato de variables congelado en v1.0.0), cambios a tipos de entrada, salidas de motor, estructura explain o rule packs impactan a plantillas. Protocolo:

1. **Paso 1**: Dev propone cambio (ej: T11 anade variable `resultado_gate_explicado: string`).
2. **Paso 2**: Cambio se revisa y llega a Gate 2. Script auto-compara tipos actuales vs contrato YAML congelado. Si diverge:
   - Calcula `impacto_contrato_variables`: NINGUNO / COMPATIBLE / ROMPE_CONTRATO
   - Si COMPATIBLE: permite merge con notificacion a Comite Legal
   - Si ROMPE_CONTRATO: bloquea merge, plantillas afectadas revierten a BORRADOR
3. **Paso 3**: Si reversion necesaria, Comite Legal revisa plantillas, reescribe segun nuevo contrato, re-versionea. Transicion: APROBADA → BORRADOR → REVISADA → APROBADA.
4. **CI enforcement**: Cada merge a main ejecuta test que exporta tipos vs YAML. Divergencia = merge bloqueado sin aprobacion explicita de Comite Legal.
5. **Daily standup**: During weeks 4-6 (Oleada 1 redaccion), Dev + Legal revisan status de plantillas diarias, priorizan variables bloqueantes, resuelven conflicts.

### 11.9 Metricas de cuello de botella

**Leading indicators** (predictivas de riesgo):

| Metrica | Formula | Umbral alerta (S4) | Umbral critico (S5) |
|---|---|---|---|
| Velocidad redaccion | (REVISADA - BORRADOR) / semana | < 2 plantillas/sem | < 1 plantilla/sem |
| Ratio retroceso | REVISADA → BORRADOR / total evaluado | > 20%/sem | > 40%/sem |
| Brecha temporal | Fecha go-live (T20) - Fecha ultima ACTIVA | < 1 semana margen | negativa (ya paso) |
| Tiempo en estado | Dias sin cambio status | > 5 dias BORRADOR | > 3 dias REVISADA |
| Cobertura modos | Modos con >= REVISADA / Total 5 modos | < 80% (alerta S4) | < 60% (critica S5) |

**Lagging indicators** (retrospectivas de impacto):

| Evento | Significado |
|---|---|
| Tests E2E bloqueados | Gate PRE rechaza acuerdo por falta plantilla ACTIVA → desarrollo parado |
| Acuerdos demo no completables | Status ADOPTED pero no genera acta → defecto critico |
| Sesiones Comite Legal canceladas | Cada cancelacion = +1 semana delay redaccion |

Dashboard: tabla viva en Notion con update diario, alertas si alguna metrica cruza umbral.

### 11.10 Cronograma integrado (6 semanas)

| Semana | Motor de Reglas | Plantillas |
|---|---|---|
| **S1** (T1, T3d) | Fundacion motor | Oleada 0: 3 esqueletos BORRADOR (ACTA_SESION, ACTA_CONSIGNACION, CERTIFICACION) |
| **S1-S2** (T4, T2) | Tipos estables; contrato draft | Legal recibe contrato variables borrador |
| **S2-S3** (T5-T9) | Motor constitucion/votacion | Oleada 1 redaccion: Legal escribe clausulas + deliberaciones + formulas |
| **S3-S4** (T11, T13c) | Contrato congelado v1.0.0 | Oleada 1: Legal termina redaccion; integran QES/TSQ injection points; pasan a REVISADA |
| **S4-S5** (T14-T19) | Explain + Gate PRE | Oleada 2: Comite Legal revisa REVISADA; valida contra matrix obligaciones; aprueban → APROBADA |
| **S5-S6** (UAT, T20) | Switch ENGINE_V2 | Oleada 2: plantillas APROBADA pasan UAT Gate PRE, transicionan ACTIVA; plantillas activas en produccion |
| **S6+** (produccion) | Monitoreo | Post go-live: tracking metricas, ajustes menores con feature flag |

### 11.11 Snapshot de reglas en el documento

Cada acta o certificacion renderizada debe contener en su metadata:
- `ruleset_snapshot_id`: hash SHA-256 del payload JSONB del Rule Pack + overrides aplicados
- `rule_pack_id` + `rule_pack_version`: referencia al pack evaluado
- `evaluation_timestamp`: momento de la evaluacion
- `explain_summary`: resumen de las etapas OK/ERROR

El calculo del hash debe ser sincrono e inmediato al momento de la evaluacion (no diferido), para evitar el riesgo de asincronia identificado por el equipo legal.

---

## 12. Role book: roles, permisos y RLS endurecido

### 12.1 Fundamento (feedback equipo legal)

Un role book debil abre vectores de riesgo por alteracion de parametros, lectura indebida de ledger o configuracion de packs sin aprobacion colegiada. El equipo legal concluye que es imprescindible en el go-live un role book efectivo con verificacion por sociedad/organo y claims de rol, acompanado de auditoria de "quien cambio que".

### 12.2 Enum de roles del dominio

```typescript
export type SecretariaRole =
  | "SECRETARIA_CORPORATIVA"   // Gestiona todos los organos del grupo
  | "SECRETARIO"               // Secretario de un organo concreto
  | "PRESIDENTE"               // Presidente del organo
  | "MIEMBRO"                  // Consejero o miembro de comision
  | "COMITE_LEGAL"             // Aprueba rule packs y plantillas
  | "ADMIN_SISTEMA";           // Administracion tecnica

export interface RolePermission {
  role: SecretariaRole;
  resource: string;             // 'rule_packs' | 'rule_param_overrides' | 'plantillas' | etc.
  actions: Array<"read" | "create" | "update" | "activate" | "deprecate" | "approve">;
  scope: "GLOBAL" | "POR_ORGANO" | "POR_ENTIDAD";
}
```

### 12.3 Matriz de permisos minima (go-live)

| Recurso | SECRETARIA_CORP | SECRETARIO | PRESIDENTE | MIEMBRO | COMITE_LEGAL | ADMIN |
|---|---|---|---|---|---|---|
| `rule_packs` (leer) | Si | Si | Si | No | Si | Si |
| `rule_packs` (activar/deprecar) | No | No | No | No | Si | No |
| `rule_pack_versions` (crear borrador) | Si | No | No | No | Si | No |
| `rule_param_overrides` (crear/editar) | Si | Si* | No | No | No | No |
| `rule_evaluation_results` (leer) | Si | Si | Si | Si** | Si | Si |
| `rule_evaluation_results` (insertar) | Sistema | Sistema | No | No | No | No |
| `plantillas` (crear/editar) | Si | Si | No | No | No | No |
| `plantillas` (aprobar) | No | No | No | No | Si | No |
| `agreements` (crear) | Si | Si | Si | No | No | No |
| `agreements` (proclamar) | No | Si | Si | No | No | No |

\* Solo para organos donde es secretario.
\** Solo para organos donde es miembro.

### 12.4 RLS endurecido

```sql
-- rule_packs: lectura por rol autorizado
CREATE POLICY "rule_packs_select" ON rule_packs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM secretaria_role_assignments ra
    WHERE ra.person_id = auth.uid()
    AND ra.tenant_id = rule_packs.tenant_id
    AND ra.role IN ('SECRETARIA_CORPORATIVA','SECRETARIO','PRESIDENTE','COMITE_LEGAL','ADMIN_SISTEMA')
  )
);

-- rule_param_overrides: escritura solo SECRETARIA_CORPORATIVA y SECRETARIO del organo
CREATE POLICY "overrides_insert" ON rule_param_overrides FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM secretaria_role_assignments ra
    WHERE ra.person_id = auth.uid()
    AND ra.tenant_id = rule_param_overrides.tenant_id
    AND ra.role IN ('SECRETARIA_CORPORATIVA','SECRETARIO')
  )
);

-- rule_evaluation_results: APPEND-ONLY (INSERT, no UPDATE/DELETE)
CREATE POLICY "eval_results_insert" ON rule_evaluation_results FOR INSERT WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM secretaria_role_assignments WHERE person_id = auth.uid())
);
-- NO CREATE POLICY para UPDATE o DELETE → denegado por default

-- Prohibir service_role en cliente
-- NOTA: verificar en deploy que el frontend NUNCA use la service_role key
```

### 12.5 Auditoria de cambios normativos

Tabla `rule_change_audit` para registrar toda modificacion a packs, overrides y plantillas:

```sql
CREATE TABLE rule_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,           -- quien hizo el cambio
  actor_role TEXT NOT NULL,         -- rol al momento del cambio
  resource_type TEXT NOT NULL,      -- 'RULE_PACK' | 'OVERRIDE' | 'PLANTILLA'
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,             -- 'CREATE' | 'ACTIVATE' | 'DEPRECATE' | 'APPROVE' | 'UPDATE'
  payload_before JSONB,
  payload_after JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE rule_change_audit ENABLE ROW LEVEL SECURITY;
-- Solo INSERT (WORM), lectura por SECRETARIA_CORPORATIVA y COMITE_LEGAL

-- Trigger WORM: inmutabilidad real (misma funcion worm_guard() de rule_evaluation_results)
CREATE TRIGGER worm_rule_change_audit
  BEFORE UPDATE OR DELETE ON rule_change_audit
  FOR EACH ROW EXECUTE FUNCTION worm_guard();
```

---

## 13. Pactos parasociales: pista paralela

### 13.1 Principio (confirmado por equipo legal)

Los pactos parasociales (pactos de socios, shareholders agreements) **no bloquean la proclamacion societaria** salvo que esten estatutarizados (incorporados a estatutos y por tanto oponibles erga omnes). Un voto que incumple un pacto de sindicacion es valido societariamente pero genera responsabilidad contractual inter partes.

### 13.2 Tratamiento en el motor

```typescript
export interface PactosEvaluation {
  pacto_ok: boolean;              // true si no hay incumplimiento de pacto
  pactos_incumplidos: Array<{
    pacto_id: string;
    clausula: string;
    descripcion: string;
    gravedad: "INFO" | "WARNING";  // Nunca ERROR/BLOCKING en el proclamo
  }>;
}
```

El orquestador evalua pactos **despues** de la proclamacion societaria y produce un resultado separado. El explain del veredicto societario **no menciona** pactos. El resultado de pactos se muestra en un panel aparte en la UI ("Cumplimiento de pactos parasociales").

### 13.3 Fuera del go-live

- Modelo de datos de pactos (clausulas, partes vinculadas, plazos)
- Evaluacion automatica de pactos contra votos emitidos
- Alertas proactivas de incumplimiento
- Evidencias de cumplimiento por clausula

En el go-live solo se implementa la **estructura** (`PactosEvaluation` como tipo + campo en el resultado del orquestador). La logica real queda para Fase 2.

---

## 14. Bordes no computables y bloqueo con revision humana

### 14.1 Principio (feedback equipo legal)

Existen ambitos intrinsecamente no decidibles o solo parcialmente computables que exigen juicio juridico o prueba de hechos. El motor debe generar alertas y bloqueo hasta revision humana documentada, quedando fuera del automatismo de proclamacion.

### 14.2 Catalogo de bordes no computables (go-live)

| Borde | Descripcion | Tratamiento |
|---|---|---|
| **Consentimientos de clase** | Modificacion estatutaria que afecta derechos individuales o de clase sin perimetro de afectados declarado | BLOQUEO: status "PARCIAL" hasta declarar perimetro + evidenciar consentimiento |
| **Suficiencia de liquidez** | Dividendos a cuenta — determinar si hay liquidez suficiente | BLOQUEO: requiere certificacion contable manual |
| **Indelegabilidad fina** | Determinacion de que facultades son indelegables en consejo | WARNING: alertar si materia podria ser indelegable |
| **Junta exclusivamente telematica** | Requiere checklist tecnico-juridico (conectividad, identificacion, registro) | BLOQUEO: hasta completar checklist habilitante |
| **Evidencia de publicacion SA** | Verificar publicacion efectiva en BORME/diario/web | WARNING: hasta que se adjunte evidencia |
| **Evidencia de notificacion SL** | Verificar recepcion de comunicacion individual | WARNING: hasta que se adjunte acuse de recibo |
| **Cotizadas — especialidades CNMV** | Plazos, canales, quorum, voto electronico | FUERA_DE_ALCANCE: el motor rechaza entidades cotizadas en V1 |

### 14.3 Implementacion: `ReglaNoComputable`

```typescript
export interface ReglaNoComputable {
  id: string;
  descripcion: string;
  tipo: "BLOQUEO" | "WARNING" | "FUERA_DE_ALCANCE";
  condicion: string;               // expresion evaluable: 'materia_afecta_clase AND !perimetro_declarado'
  referencia: string;              // 'LSC art. 293' | 'Criterio equipo legal'
  accion_requerida: string;        // 'Declarar perimetro de afectados y adjuntar consentimientos'
  resolucion_humana: boolean;      // true → requiere firma del secretario o comite legal
}
```

El orquestador evalua los bordes no computables **antes** de emitir el veredicto final. Si hay algun BLOQUEO sin resolucion humana documentada, el resultado es `ok: false` con explain que referencia el borde especifico.

---

## 15. Perimetro explicito del go-live

### 15.1 Dentro del go-live (V1)

| Pilar | Alcance |
|---|---|
| **Motor de reglas** | 16 materias LSC, SA y SL, 3 flujos (colegiado, unipersonal, sin sesion) |
| **Personas** | Persona fisica/juridica, representante permanente (art. 212 bis), capital por mandate |
| **Plantillas protegidas** | 7 plantillas minimas (3 oleadas), contrato de variables congelado, Gate PRE con fallback STRICT/FALLBACK/DISABLED |
| **Role book** | 6 roles, RLS endurecido, auditoria de cambios normativos |
| **Bordes no computables** | Bloqueo con revision humana para consentimientos de clase, telematica, evidencias |
| **Pactos parasociales** | Estructura (`PactosEvaluation`), sin logica real |
| **Conflicto de interes** | Modelo formalizado (art. 190 LSC): 3 tipos exclusion (EXCLUIR_QUORUM, EXCLUIR_VOTO, EXCLUIR_AMBOS), denominador ajustado, politica tipificada por materia |
| **WORM real** | Triggers `worm_guard()` en tablas criticas, append-only con RLS, inmutabilidad de snapshots y hashes |
| **Capa QTSP** | TSQ en snapshots, firma QES en actas, notificacion certificada post-acuerdo, evidence bundles ASiC-E con verificacion offline |
| **Explain** | Auditable con fuente, referencia, umbral, valor, resultado por etapa + snapshot hash sincrono |

### 15.2 Fuera del go-live (diferido)

| Pilar | Razon |
|---|---|
| Cotizadas (CNMV, DA decima) | Complejidad regulatoria que requiere parametrizaciones condicionales, no simples overrides |
| Pactos parasociales (logica) | Requiere modelo de datos propio de clausulas, partes vinculadas, evaluacion |
| Consola avanzada de plantillas | Diffs, simuladores, pipelines de importacion |
| Paneles de auditoria avanzados | Metricas de uso por materia y rol |
| Acciones sin voto / privilegiadas | Computo diferenciado de censo politico vs economico |
| Sindicatos de voto | Agrupacion pactada — pista pactos parasociales |
| Motor de calendario civil | Festivos, dias habiles |
| Jurisdicciones no-ES | BR, MX, PT — futura extension |
| Operaciones estructurales transfronterizas | LME cross-border |

---

## 16. Conflicto de interes formalizado (art. 190 LSC)

### 16.1 Fundamento (feedback equipo legal)

La distincion tripartita `EXCLUIR_QUORUM / EXCLUIR_VOTO / EXCLUIR_AMBOS` y su efecto diferenciado en denominadores de quorum y de mayoria es juridicamente necesaria para dar cumplimiento al art. 190 LSC. Sin ella, los denominadores pueden ser incorrectos en supuestos reales donde un consejero conflictuado deba excluirse solo del voto pero seguir computando para quorum, o viceversa, produciendo proclamaciones potencialmente nulas.

### 16.2 Modelo de datos

La tabla `conflicto_interes` (definida en §3.1) persiste cada conflicto declarado con su tipo, motivo y capital afectado. La politica de exclusion se parametriza en el Rule Pack por materia (§4.2).

### 16.3 Impacto en denominadores

```typescript
export interface DenominadorAjustado {
  capital_total: number;              // Capital social total
  capital_con_derecho_voto: number;   // Capital total - acciones sin voto
  capital_convocable: number;         // capital_con_derecho_voto - excluidos_quorum
  capital_presente_votante: number;   // Presentes - excluidos_voto
}

export function calcularDenominadorAjustado(
  mandatos: MandateExtended[],
  asistentes: AsistenteConCapital[],
  conflictos: Array<{ mandate_id: string; tipo: "EXCLUIR_QUORUM" | "EXCLUIR_VOTO" | "EXCLUIR_AMBOS" }>
): DenominadorAjustado {
  const capital_total = mandatos.reduce((s, m) => s + (m.capital_participacion ?? 0), 0);
  const capital_con_derecho_voto = mandatos
    .filter(m => m.tiene_derecho_voto)
    .reduce((s, m) => s + (m.capital_participacion ?? 0), 0);

  const excluidos_quorum = conflictos
    .filter(c => c.tipo === "EXCLUIR_QUORUM" || c.tipo === "EXCLUIR_AMBOS")
    .reduce((s, c) => {
      const m = mandatos.find(m => m.id === c.mandate_id);
      return s + (m?.capital_participacion ?? 0);
    }, 0);

  const capital_convocable = capital_con_derecho_voto - excluidos_quorum;

  const excluidos_voto_ids = new Set(
    conflictos
      .filter(c => c.tipo === "EXCLUIR_VOTO" || c.tipo === "EXCLUIR_AMBOS")
      .map(c => c.mandate_id)
  );

  const capital_presente_votante = asistentes
    .filter(a => a.tiene_derecho_voto && !a.excluido_conflicto && !excluidos_voto_ids.has(a.mandate_id))
    .reduce((s, a) => s + a.capital_representado, 0);

  return { capital_total, capital_con_derecho_voto, capital_convocable, capital_presente_votante };
}
```

### 16.4 Caso extremo: `capital_convocable = 0`

Si todos los socios con derecho de voto estan excluidos de quorum, el motor emite BLOCKING automatico: no es posible constituir la sesion. El explain debe referenciar los conflictos declarados y sugerir resolucion alternativa (e.g., solicitar autorizacion judicial).

### 16.5 Politica tipificada por materia y forma social

El Rule Pack define `politicaExclusion` como mapa materia → tipo de exclusion. Ejemplos:

| Materia | SA | SL | Referencia |
|---|---|---|---|
| APROBACION_CUENTAS (socio-admin) | EXCLUIR_VOTO | EXCLUIR_VOTO | art. 190.1.a |
| MOD_ESTATUTOS (afecta derechos socio) | EXCLUIR_AMBOS | EXCLUIR_AMBOS | art. 190.1.e |
| NOMBRAMIENTO_CESE (del propio socio) | EXCLUIR_VOTO | EXCLUIR_VOTO | art. 190.1.c |
| RETRIBUCION_ADMIN (del propio admin) | EXCLUIR_VOTO | EXCLUIR_VOTO | art. 190.1.b |

---

## 17. Capa de confianza QTSP: servicios eIDAS nativos

### 17.1 Premisa

El operador del sistema es un Prestador Cualificado de Servicios de Confianza (QTSP) bajo eIDAS. Esto elimina la dependencia de terceros para firma QES, sellos cualificados de tiempo (TSQ), sellos electronicos cualificados (QSeal), notificacion certificada y custodia cualificada. La integracion de estos servicios en el motor de reglas transforma el sistema de "legaltech funcional" a "plataforma de gobierno corporativo con garantia probatoria cualificada de extremo a extremo".

### 17.2 Servicios QTSP integrados en el motor

| Servicio QTSP | Punto de integracion | Efecto juridico-probatorio |
|---|---|---|
| **Sello cualificado de tiempo (TSQ)** | Snapshot de ruleset al pasar a ADOPTED, acta al firmar, asiento en WORM, evidence_bundle | Prueba de existencia y anterioridad (art. 41 eIDAS); ancla temporal no repudiable |
| **Sello electronico cualificado (QSeal)** | `gate_hash` en agreements, manifiestos de expediente, evaluaciones del motor | Integridad y origen de datos garantizados por el QTSP operador |
| **Firma QES con provision de certificados** | Acta, certificacion, oposiciones, acuerdos sin sesion | Equivalencia a firma manuscrita (art. 25.2 eIDAS); legitimacion verificable |
| **Validacion OCSP/CRL** | Verificacion de firmantes al firmar acta/certificacion | Prueba de vigencia del certificado en el momento de la firma |
| **Notificacion certificada (eDelivery)** | Convocatorias SL (art. 176 LSC), acuerdos sin sesion | Evidencia fehaciente de entrega con acuse, fecha y contenido |
| **Custodia cualificada** | Evidence_bundles, libros WORM, snapshots sellados | Conservacion con garantia de integridad a largo plazo (art. 34 eIDAS) |

### 17.3 Capa 1 — Sellado de confianza del motor (P0, go-live)

**TSQ en snapshot y evaluaciones:**
Al calcular el `ruleset_snapshot_id` (hash sincrono, §11.4), solicitar un sello cualificado de tiempo al servicio TSQ del QTSP y persistir el token (`tsq_token`) junto al hash en `rule_evaluation_results` y en `agreements.compliance_explain`. El hash pasa de prueba de integridad interna a prueba de existencia con fecha cierta oponible a terceros.

**QSeal en gate_result:**
El `gate_hash` persistido en `agreements` se sella con el sello electronico cualificado de organizacion, acreditando que fue el sistema —operado por un QTSP— quien emitio el veredicto. Fuerza probatoria elevada de "registro interno" a "documento electronico con garantia de origen e integridad cualificada".

**Trigger WORM + TSQ en tablas criticas:**
El trigger `worm_guard()` (§3.1) se complementa con un TSQ al insertar cada fila en `rule_evaluation_results` y `rule_change_audit`, creando una cadena temporal inmutable y verificable.

### 17.4 Capa 2 — Firma y notificacion cualificadas en el flujo societario (P0/P1, go-live)

**Firma QES de actas y certificaciones:**
Las plantillas protegidas (§11) preveen acta de sesion, acta de consignacion y certificacion como contenedores con snapshot embebido. La firma QES con provision de certificados permite que secretario y presidente firmen el acta directamente en la plataforma, con verificacion OCSP en el momento de la firma y cadena X.509 persistida. Se verifica vigencia del cargo como atributo antes de habilitar la firma.

**Notificacion certificada de convocatorias SL:**
El motor de convocatoria (§6.1) ya valida antelacion, canales y contenido minimo para SL con notificacion individual. La notificacion se cursa a traves del servicio de notificacion certificada del QTSP, generando evidencia de entrega con acuse, fecha, contenido y hash, persistida como evento WORM vinculado a la convocatoria. Cierra el gap de "evidencia de notificacion SL" de §14.

**Notificacion certificada de acuerdos sin sesion:**
Para el flujo C (NO_SESSION), la propuesta de consentimiento escrito por unanimidad se comunica y recoge via notificacion certificada + firma QES de cada respuesta, produciendo un expediente completo sin reunion fisica.

### 17.5 Capa 3 — Expediente probatorio (P1, go-live)

**Evidence_bundle como contenedor WORM:**

```sql
CREATE TABLE evidence_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  manifest JSONB NOT NULL,              -- Manifiesto canonico con hashes de todos los artefactos
  manifest_hash TEXT NOT NULL,          -- SHA-256 del manifiesto
  qseal_token TEXT,                     -- Sello electronico cualificado del manifiesto
  tsq_token TEXT,                       -- Sello de tiempo del manifiesto
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SEALED', 'VERIFIED')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER worm_evidence_bundles
  BEFORE UPDATE OR DELETE ON evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION worm_guard();
```

El bundle se puebla al cerrar un acuerdo (transicion a ADOPTED/CERTIFIED): recoge `ruleset_snapshot_id` (sellado TSQ), `gate_hash` (sellado QSeal), acta (firmada QES), certificacion (firmada QES), evidencias de notificacion (selladas TSQ) y asientos de libro WORM (con hash acumulado).

**Empaquetado ASiC-E:**
El bundle se empaqueta como contenedor ASiC-E (ZIP firmado con QSeal), descargable via API, e incluye opcionalmente un verificador offline HTML/JS que valida hashes, cadenas X.509 y tokens TSQ.

### 17.6 Endpoint de verificacion

```typescript
// POST /api/v1/trust/verify
export interface TrustVerificationRequest {
  agreement_id: string;
  artifact_type: "ACTA" | "CERTIFICACION" | "GATE_RESULT" | "SNAPSHOT" | "BUNDLE";
}

export interface TrustVerificationResponse {
  integrity_ok: boolean;        // Hash coincide
  signature_valid: boolean;     // Firma QES valida
  certificate_status: "GOOD" | "REVOKED" | "UNKNOWN";  // OCSP/CRL
  timestamp_valid: boolean;     // TSQ valida
  signer_identity: string;     // CN del certificado
  signer_role_valid: boolean;  // Cargo vigente al momento de firma
  explain: string[];
}
```

### 17.7 Interfaces TypeScript QTSP

```typescript
export interface QTSPSealRequest {
  data_hash: string;            // SHA-256 del dato a sellar
  seal_type: "TSQ" | "QSEAL";
}

export interface QTSPSealResponse {
  token: string;                // Token del sello
  timestamp: string;            // ISO 8601
  issuer: string;               // CN del QTSP
}

export interface QTSPSignRequest {
  document_hash: string;
  signer_id: string;
  document_type: "ACTA" | "CERTIFICACION" | "CONVOCATORIA";
}

export interface QTSPNotificationRequest {
  recipient_email: string;
  recipient_name: string;
  subject: string;
  content_hash: string;
  attachments?: Array<{ name: string; hash: string }>;
}

export interface QTSPNotificationEvidence {
  delivery_id: string;
  delivered_at: string;
  recipient_ack: boolean;
  content_hash: string;
  tsq_token: string;
}
```

---

## 18. Estrategia de migracion (actualizada post-feedback legal + QTSP)

### Fase 0: Schema + Seed + Personas + Role book (sin romper nada)
- Crear tablas `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `rule_evaluation_results`.
- Insertar seed: 16 Rule Packs con version 1.0.0.
- Extender `persons` (person_type, representative_person_id) y `mandates` (capital, clase, derecho_voto).
- Crear tabla `secretaria_role_assignments` + `rule_change_audit`.
- Seed: roles, asignaciones demo, personas juridicas demo con representantes.
- Feature flag `ENGINE_V2 = false`.
- Zero impacto en funcionalidad existente.

### Fase 1: Motor transversal read-only
- Implementar funciones puras en `src/lib/rules-engine/`.
- Nuevo hook `useRulePacks`.
- `useAgreementCompliance` ejecuta V2 en paralelo con V1, persiste `rule_evaluation_results` para comparacion, pero retorna resultado V1.
- UI: mostrar explain V2 como panel informativo en ExpedienteAcuerdo.

### Fase 2: Motor activo en UI + Plantillas protegidas
- ConvocatoriasStepper, ReunionStepper, TramitadorStepper consumen motores V2.
- `useAgreementCompliance` retorna resultado V2 si no hay divergencias con V1 en los ultimos 30 evaluaciones.
- Plantillas protegidas de acta y certificacion con snapshot embebido y Gate PRE documental.
- Bordes no computables con bloqueo y revision humana.
- Rule Packs editables en UI de admin (futuro).

### Fase 3: Deprecacion V1
- Eliminar logica hardcodeada de `useAgreementCompliance`.
- `checkNoticePeriodByType` y `computeQuorumStatus` se convierten en wrappers del motor V2.
- `jurisdiction_rule_sets` se marca como legacy.

---

## 19. Pruebas y validacion

### 19.1 Golden tests por materia (básico)

Cada Rule Pack tiene un set de fixtures con escenarios deterministas:

```typescript
// tests/rules-engine/aprobacion-cuentas.test.ts
describe("APROBACION_CUENTAS", () => {
  test("SA 1a conv, quorum 31% → OK, favor > contra → PROCLAMABLE", () => { /* ... */ });
  test("SA 1a conv, quorum 20% → quorum insuficiente", () => { /* ... */ });
  test("SA 2a conv, cualquier quorum → OK (sin minimo)", () => { /* ... */ });
  test("SL, favor 55% capital presente → PROCLAMABLE", () => { /* ... */ });
  test("SL, favor 40% capital presente → NO PROCLAMABLE", () => { /* ... */ });
});
```

### 19.2 Metamorphic tests

- Elevar quorum nunca convierte rechazo en aprobacion.
- Anadir documentos nunca invalida convocatoria valida.
- Anadir materia mas exigente nunca acerca fecha limite de publicacion.

### 19.3 Comparacion V1 vs V2

Durante Fase 1, cada evaluacion compara resultado V1 y V2 y persiste divergencias en una tabla auxiliar para analisis.

### 19.4 Golden tests: Conflicto de interes, WORM y QTSP

Nuevos test cases (Fase 2) que validan art. 190 LSC, WORM immutability y QTSP trust services:

```typescript
// tests/rules-engine/conflicto-interes.test.ts
describe("Conflicto de interes (art. 190 LSC)", () => {
  test("EXCLUIR_QUORUM: socio conflictado sale de denominador constitucion pero vota", () => {
    const capital_total = 1000;
    const conflictados = 200;
    const resultado = calcularDenominadorAjustado(capital_total, conflictados, "EXCLUIR_QUORUM");
    expect(resultado.denominador_ajustado).toBe(800);
    expect(resultado.puede_votar).toBe(true);
  });
  
  test("EXCLUIR_VOTO: socio conflictado computa quorum pero NO vota", () => {
    const resultado = calcularDenominadorAjustado(1000, 200, "EXCLUIR_VOTO");
    expect(resultado.denominador_ajustado).toBe(1000);
    expect(resultado.puede_votar).toBe(false);
  });
  
  test("EXCLUIR_AMBOS: socio conflictado excluido de quorum y voto", () => {
    const resultado = calcularDenominadorAjustado(1000, 200, "EXCLUIR_AMBOS");
    expect(resultado.denominador_ajustado).toBe(800);
    expect(resultado.puede_votar).toBe(false);
  });
  
  test("Caso extremo: denominador_ajustado = 0 → BLOQUEO", () => {
    const resultado = calcularDenominadorAjustado(1000, 1000, "EXCLUIR_QUORUM");
    expect(resultado.denominador_ajustado).toBe(0);
    expect(resultado.bloqueado).toBe(true);
  });
});

// tests/rules-engine/worm-protection.test.ts
describe("WORM protection", () => {
  test("worm_guard() bloquea UPDATE en rule_evaluation_results", async () => {
    const evaluacion = await insertEvaluacion({ /* ... */ });
    const updateErr = await supabase
      .from("rule_evaluation_results")
      .update({ status: "MODIFIED" })
      .eq("id", evaluacion.id);
    expect(updateErr.error?.message).toContain("WORM protection violated");
  });
  
  test("worm_guard() bloquea DELETE en rule_change_audit", async () => {
    const audit = await insertChangeAudit({ /* ... */ });
    const delErr = await supabase
      .from("rule_change_audit")
      .delete()
      .eq("id", audit.id);
    expect(delErr.error?.message).toContain("WORM protection violated");
  });
  
  test("INSERT/SELECT permitidos en WORM tables", async () => {
    const eval1 = await insertEvaluacion({ /* ... */ });
    const eval2 = await insertEvaluacion({ /* ... */ });
    const list = await supabase.from("rule_evaluation_results").select("*");
    expect(list.data.length).toBe(2);
  });
});

// tests/rules-engine/qtsp-integration.test.ts
describe("QTSP integration (eIDAS)", () => {
  test("TSQ token sellado en snapshot", async () => {
    const snapshot = await evaluarVotacion({ /* ... */ });
    expect(snapshot.tsq_token).toBeTruthy();
    expect(snapshot.tsq_token.length).toBeGreaterThan(100); // X.509 token
  });
  
  test("gate_hash = SHA256(accion + denominadores + conflictos + regla)", () => {
    const gate_data = {
      accion: "APROBACION_CUENTAS",
      denominador: 1000,
      conflictos: [{ socio_id: "x", tipo: "EXCLUIR_VOTO" }],
      regla: "SA_NORMAL"
    };
    const hash = computeGateHash(gate_data);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });
  
  test("Firma QES persiste en agreement_signatures con gate_hash", async () => {
    const sig = await signWithQES({
      agreement_id: "ag123",
      gate_hash: "abc123...",
      signer: "secretario@arga.es"
    });
    expect(sig.qes_token).toBeTruthy();
    expect(sig.timestamp_tsq).toBeTruthy();
  });
  
  test("Notificacion certificada genera evidence_snapshot irrevocable", async () => {
    const notif = await sendQTSPNotification({
      agreement_id: "ag123",
      recipient: "counterparty@corp.es"
    });
    expect(notif.delivery_proof_id).toBeTruthy();
    // Verifica que evidence_snapshot.kind = "NOTIFICATION_DELIVERED"
    const proof = await supabase
      .from("evidence_snapshots")
      .select("*")
      .eq("id", notif.delivery_proof_id);
    expect(proof.data[0].kind).toBe("NOTIFICATION_DELIVERED");
  });
});

// tests/rules-engine/evidence-bundle-verification.test.ts
describe("Evidence bundle ASiC-E", () => {
  test("Export ZIP incluye contract_model.json + verification.json + manifest", async () => {
    const bundle = await exportEvidenceBundle("ag123");
    expect(bundle.files).toContain("contract_model.json");
    expect(bundle.files).toContain("verification.json");
    expect(bundle.files).toContain("manifest.xml");
  });
  
  test("Verificacion offline detecta tampering en gate_hash", async () => {
    const bundle = await exportEvidenceBundle("ag123");
    const verification = await verifyEvidenceBundle(bundle, {
      gate_hash_expected: "abc123..."
    });
    expect(verification.gate_hash_valid).toBe(true);
    
    // Simulamos tampering
    bundle.data.conflictos[0].capital_afectado = 999999;
    const verif_tampered = await verifyEvidenceBundle(bundle, {
      gate_hash_expected: "abc123..."
    });
    expect(verif_tampered.gate_hash_valid).toBe(false);
    expect(verif_tampered.tampering_detected).toBe(true);
  });
});
```

---

## 20. Invariantes del sistema

1. **No rebaja de ley**: ningun override estatutario puede producir un quorum/mayoria menor que el minimo legal.
2. **Regla mas estricta**: cuando coexisten multiples materias, rige la antelacion mayor, el quorum mayor, y la union de documentos.
3. **Explicabilidad total**: cada evaluacion produce un `explain` que enumera regla, fuente, referencia, umbral, valor actual y resultado.
4. **Inmutabilidad de evaluaciones**: `rule_evaluation_results` es append-only.
5. **Versionado de reglas**: cada evaluacion registra el `pack_id` y `version` usados, permitiendo reproducibilidad.
6. **Separacion societario/pactos**: los pactos parasociales no bloquean la proclamacion de acuerdos, solo generan reportes de incumplimiento.
7. **Persona juridica con representante**: todo mandate de persona juridica debe tener `representative_person_id` designado para poder votar o computar quorum.
8. **Snapshot sincrono**: el hash del ruleset se calcula de forma sincrona al momento de la evaluacion, nunca diferido.
9. **Bordes no computables**: toda materia con borde no computable no resuelto produce BLOQUEO hasta revision humana documentada.
10. **Plantillas con snapshot**: ninguna acta o certificacion se renderiza sin el `ruleset_snapshot_id` embebido.
11. **Auditoria de cambios**: toda modificacion a rule_packs, overrides o plantillas se registra en `rule_change_audit` (WORM).
12. **WORM real — no UPDATE/DELETE**: triggers `worm_guard()` en `rule_evaluation_results`, `rule_change_audit`, `conflicto_interes`, `evidence_snapshots` y tablas de auditoria previenen UPDATE/DELETE, permitiendo solo INSERT/SELECT. Falla con 'WORM protection violated'.
13. **Conflicto de interes formalizado**: Art. 190 LSC requiere exclusion explícita de censo. El motor calcula `denominador_ajustado` = capital_total - capital_conflictado segun tipo EXCLUIR_QUORUM/EXCLUIR_VOTO/EXCLUIR_AMBOS. Si denominador_ajustado = 0, el motivo de acuerdo queda BLOQUEADO.
14. **Gate hash**: cada `agreements` cumplo ADOPTED tiene `gate_hash = SHA256(accion + denominadores + conflictos + regla aplicada)` para verificacion offline.
15. **TSQ en snapshot**: toda snapshot de evaluacion incluye `tsq_token TEXT` autenticado por QTSP, sellando la evaluacion con timestamp oficial de tercero confiable.
16. **Firma QES post-acta**: actas y certificaciones requieren firma QES (cualificada eIDAS) del depositario/secretario. La firma se persiste en `agreement_signatures` vinculada a `gate_hash`.
17. **Notificacion certificada**: todo acuerdo ADOPTED se notifica a contraparte via QTSP_NOTIFICATION, generando evidencia de entrega irrevocable en `evidence_snapshots`.
18. **Contrato de variables congelado**: tras Gate 2, cualquier cambio en tipos o salidas del motor requiere incremento de version del contrato YAML y notificacion a Legal. Cambios ROMPE_CONTRATO revierten plantillas a BORRADOR.
19. **Gate PRE con fallback**: el Gate PRE soporta 3 modos (STRICT/FALLBACK/DISABLED). En go-live, las 6 plantillas minimas son STRICT; modos sin plantilla especifica usan FALLBACK con WARNING trazable en explain y evidence_bundle.
20. **Tres oleadas de plantillas**: Oleada 0 (esqueletos tecnicos, Fase 0), Oleada 1 (contenido juridico, Fase 1-2), Oleada 2 (aprobacion formal, pre-switch). Ninguna oleada puede saltarse.
21. **Flujo sin sesion (NO_SESSION) como primera clase**: El acuerdo sin sesion (Flujo C) no es un caso marginal sino un patron de adopcion dominante (60-80% en practica corporativa). El motor evalua Gate 0 (habilitacion) → Gate 1 (materia) → Gate 2 (notificacion fehaciente) → Gate 3 (ventana de consentimiento) → Gate 4 (condicion de adopcion), permitiendo resoluciones sin reunion fisica. TipoProceso diferencia UNANIMIDAD_ESCRITA_SL, CIRCULACION_CONSEJO, DECISION_SOCIO_UNICO_SL y DECISION_SOCIO_UNICO_SA. Cada no_session_response vinculada a agreement_id genera evidencia WORM con firma QES y TSQ obligatorios.
22. **WORM respuestas en acuerdos sin sesion**: Toda respuesta (`no_session_respuestas` tabla) a una propuesta de acuerdo sin sesion es Write-Once: trigger `worm_guard()` bloquea UPDATE/DELETE. El expediente NO_SESSION es inmutable desde el momento de la primera respuesta. Cambios subsecuentes (retraccion, enmiendalogica, suplantacion) son detectables via audit trail y bloqueados con BLOQUEO en Gate 4.
23. **Notificacion fehaciente obligatoria**: Todo acuerdo en flujo NO_SESSION requiere notificacion certificada (QTSP eDelivery) a cada socio con copia electronica de la propuesta. No hay excepcion: ni unanimidad tacita, ni consentimiento verbal, ni "se asume conocimiento". La entrega genera `evidence_snapshots.kind = 'NOTIFICATION_DELIVERED'` con `tsq_token` sellado por QTSP. Si socio rechaza o no responde pasado el plazo de ventana, el acuerdo no se adopta (Gate 4 falla).

---

## 21. Fuera de alcance (ver seccion 15.2 para detalle completo)

- Cotizadas (especialidades CNMV, DA decima, voto electronico reducido) — **explicitamente excluidas**: el motor rechaza entidades cotizadas en V1
- Jurisdicciones distintas de Espana (BR, MX, PT — futura extension)
- Pactos parasociales logica real (estructura preparada, logica Fase 2)
- Motor de calendario civil con festivos
- Operaciones estructurales transfronterizas
- Dividendos y reserva legal (calculo de distribuible — complejidad contable)
- Acciones sin voto y participaciones privilegiadas
- Consola avanzada de plantillas (diffs, simuladores)

---

## 22. Relacion con GAS v3.0

El sistema GAS v3.0 implementaba esta logica via funciones SQL (`fn_evaluar_votacion_acuerdo`, `fn_quorum_sesion_ok`, etc.) con tablas WORM y sellado QES. La presente spec traslada esa arquitectura al stack actual (React + TypeScript + Supabase) con estos cambios:

| GAS v3.0 | TGMS Secretaria |
|---|---|
| Logica en funciones SQL | Funciones puras en TypeScript (frontend) |
| `reglas_fuentes` tabla con cascade | `rule_packs` + `rule_param_overrides` |
| `fn_evaluar_votacion_acuerdo` (5 steps) | Gate Engine 6 steps en `evaluarVotacion()` |
| `ruleset_snapshot` + hash SHA-256 | `rule_evaluation_results` con explain JSON |
| `catalogo_materias` baseline | `rule_packs` por materia (declarativo) |
| WORM tables | Triggers `worm_guard()` en Fase 2 + RLS immutable (IMPLEMENTADO §16-17) |
| QES/TSQ | QTSP integration con eIDAS (IMPLEMENTADO §17) |

---

## 23. Archivos a crear/modificar

### Nuevos archivos

```
src/lib/rules-engine/
  types.ts                    -- Tipos base (Fuente, TipoSocial, RulePack, PersonType, etc.)
  convocatoria-engine.ts      -- Motor de convocatorias
  constitucion-engine.ts      -- Motor de constitucion/quorum
  votacion-engine.ts          -- Motor de votacion (gate engine 6 steps)
  documentacion-engine.ts     -- Motor de documentacion + actas
  orquestador.ts              -- Composicion de perfil + evaluacion completa
  jerarquia-normativa.ts      -- Resolucion de regla efectiva (LEY > ESTATUTOS > PACTO)
  majority-evaluator.ts       -- Parser y evaluador de MajoritySpec
  bordes-no-computables.ts    -- Evaluador de bordes con bloqueo humano
  plantillas-engine.ts        -- Gate PRE documental + snapshot
  conflicto-interes.ts        -- Calculo denominador ajustado, politica exclusion por materia
  qtsp-integration.ts         -- Integracion QTSP: TSQ, QES, notificacion certificada
  evidence-bundle.ts          -- Generador ASiC-E, verificacion offline, export ZIP
  no-session-engine.ts        -- Motor de acuerdos sin sesion: 5 gates + TipoProceso + respuestas WORM
  index.ts                    -- Re-exports

src/hooks/
  useRulePacks.ts             -- Carga rule packs + overrides por entidad
  usePersonasExtended.ts      -- Personas con tipo + representante + capital
  usePlantillasProtegidas.ts  -- Plantillas protegidas + validacion
  useConflictoInteres.ts      -- CRUD conflictos: create/update/list, calcula denominador_ajustado
  useEvidenceBundle.ts        -- Carga/export evidence bundles, verificacion offline
  useQTSPVerification.ts      -- Verifica gate_hash, TSQ, firma QES, notificacion certificada
  useNoSessionExpediente.ts   -- Carga acuerdos sin sesion: propuesta + respuestas + timeline + WORM protection

supabase/migrations/
  20260419_000001_rule_engine_tables.sql      -- rule_packs, versions, overrides, results
  20260419_000002_persons_extension.sql       -- person_type, representative, capital en mandates
  20260419_000003_role_book.sql               -- secretaria_role_assignments, rule_change_audit
  20260419_000004_plantillas_protegidas.sql   -- plantillas protegidas con protecciones
  20260419_000005_conflicto_interes.sql       -- conflicto_interes table, triggers WORM
  20260419_000006_qtsp_evidence.sql           -- agreement_signatures, evidence_snapshots, seal_records, TSQ/QES columns
  20260419_000007_worm_triggers.sql           -- worm_guard() trigger, WORM protection en tablas criticas
  20260419_000008_no_session_expediente.sql   -- no_session_expedientes, no_session_respuestas, no_session_notificaciones, WORM triggers

scripts/
  seed-rule-packs.ts          -- Inserta 16 rule packs v1.0.0
  seed-personas-demo.ts       -- Personas juridicas demo con representantes + capital
  seed-role-assignments.ts    -- Roles demo para ARGA Seguros
  seed-conflicto-interes-policies.ts  -- Carga politicas de exclusion por materia
  generate-variable-contract.ts  -- Genera borrador contrato de variables desde tipos T4
  seed-no-session-demo.ts     -- Crea acuerdos sin sesion demo: propuestas + respuestas en timeline 3-7 dias

docs/contratos/
  variables-plantillas-v1.0.0.yaml  -- Contrato de variables congelado (generado por script)

src/lib/rules-engine/
  plantillas-gate-config.ts   -- PlantillaGateConfig, PlantillaExigencia, config go-live
```

### Archivos a modificar

```
src/hooks/useAgreementCompliance.ts     -- Anadir path V2 con feature flag
src/hooks/useJurisdiccionRules.ts       -- Fix checkNoticePeriodByType (SA: 30 dias)
src/hooks/useBodies.ts                  -- Extender MandateRow con capital + person_type
src/pages/secretaria/ConvocatoriasStepper.tsx  -- Consumir motor convocatoria V2 + conflicto interes
src/pages/secretaria/ReunionStepper.tsx        -- Consumir motor constitucion + votacion V2 + asistentes con capital + conflicto interes
src/pages/secretaria/ExpedienteAcuerdo.tsx     -- Panel explain + snapshot + gate_hash + firma QES + notificacion certificada
src/pages/secretaria/TramitadorStepper.tsx     -- inscribibilidad de Rule Pack
src/pages/secretaria/ConflictoInteresPanel.tsx -- Nuevo: CRUD conflictos, visualiza denominador_ajustado, politica por materia
src/pages/secretaria/EvidenceBundlePanel.tsx   -- Nuevo: export ASiC-E, verificacion offline, QTSP badge
src/pages/secretaria/ExpedienteSinSesionStepper.tsx  -- Nuevo: crear propuesta sin sesion, recolectar respuestas + firmas, timeline + WORM protection
```
