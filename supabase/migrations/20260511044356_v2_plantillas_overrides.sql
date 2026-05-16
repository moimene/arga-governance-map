-- T1 entity_settings_catalog
CREATE TABLE IF NOT EXISTS entity_settings_catalog (
  key text PRIMARY KEY,
  value_type text NOT NULL CHECK (value_type IN ('boolean', 'text', 'enum', 'number')),
  allowed_values jsonb,
  default_value jsonb,
  descripcion text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('CARGO', 'CONFIG_CONDICIONAL', 'PERFIL_SOCIETARIO', 'PERFIL_SECTORIAL')),
  usado_por_plantillas text[],
  estado_catalog text NOT NULL DEFAULT 'ACTIVA' CHECK (estado_catalog IN ('ACTIVA', 'ARCHIVADA')),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE entity_settings_catalog IS 'Vocabulario semantico cerrado de claves disponibles para entity_settings. Global (sin tenant_id). Cambios via migracion o pagina admin (rol ADMIN_TENANT).';
COMMENT ON COLUMN entity_settings_catalog.value_type IS 'Tipo del valor: boolean | text | enum | number';
COMMENT ON COLUMN entity_settings_catalog.allowed_values IS 'Array JSONB de valores permitidos cuando value_type=enum';
COMMENT ON COLUMN entity_settings_catalog.default_value IS 'Valor canonico cuando la sociedad no tiene override';
COMMENT ON COLUMN entity_settings_catalog.estado_catalog IS 'Lifecycle ACTIVA | ARCHIVADA. Las ARCHIVADA siguen leyendose pero no se sugieren en admin.';

CREATE OR REPLACE FUNCTION validate_catalog_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value_type = 'enum' THEN
    IF NEW.allowed_values IS NULL OR jsonb_typeof(NEW.allowed_values) <> 'array' THEN
      RAISE EXCEPTION 'enum value_type requires allowed_values as JSON array (key=%)', NEW.key;
    END IF;
    IF NEW.default_value IS NOT NULL AND NOT (NEW.allowed_values @> jsonb_build_array(NEW.default_value)) THEN
      RAISE EXCEPTION 'default_value % not in allowed_values for enum key=%', NEW.default_value, NEW.key;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_catalog_consistency ON entity_settings_catalog;
CREATE TRIGGER tr_validate_catalog_consistency
  BEFORE INSERT OR UPDATE ON entity_settings_catalog
  FOR EACH ROW EXECUTE FUNCTION validate_catalog_consistency();

ALTER TABLE entity_settings_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_public_read ON entity_settings_catalog;
CREATE POLICY catalog_public_read ON entity_settings_catalog FOR SELECT USING (true);

DROP POLICY IF EXISTS catalog_admin_write ON entity_settings_catalog;
CREATE POLICY catalog_admin_write ON entity_settings_catalog FOR ALL
  USING (fn_secretaria_is_service_role())
  WITH CHECK (fn_secretaria_is_service_role());

-- T2 entity_settings
CREATE TABLE IF NOT EXISTS entity_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key text NOT NULL REFERENCES entity_settings_catalog(key) ON DELETE RESTRICT,
  value jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz,
  updated_by uuid,
  CONSTRAINT entity_settings_unique_per_entity UNIQUE (entity_id, key),
  CONSTRAINT entity_settings_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE entity_settings IS 'Valores por sociedad de las claves del catalogo. Una fila = un setting de una entidad.';

CREATE OR REPLACE FUNCTION validate_entity_setting_value()
RETURNS TRIGGER AS $$
DECLARE
  v_catalog entity_settings_catalog%ROWTYPE;
BEGIN
  SELECT * INTO v_catalog FROM entity_settings_catalog WHERE key = NEW.key;
  IF v_catalog.key IS NULL THEN
    RAISE EXCEPTION 'unknown catalog key=%', NEW.key;
  END IF;
  IF v_catalog.value_type = 'boolean' AND jsonb_typeof(NEW.value) <> 'boolean' THEN
    RAISE EXCEPTION 'value for key=% must be boolean, got %', NEW.key, jsonb_typeof(NEW.value);
  END IF;
  IF v_catalog.value_type = 'text' AND jsonb_typeof(NEW.value) <> 'string' THEN
    RAISE EXCEPTION 'value for key=% must be text (string in JSONB), got %', NEW.key, jsonb_typeof(NEW.value);
  END IF;
  IF v_catalog.value_type = 'number' AND jsonb_typeof(NEW.value) <> 'number' THEN
    RAISE EXCEPTION 'value for key=% must be number, got %', NEW.key, jsonb_typeof(NEW.value);
  END IF;
  IF v_catalog.value_type = 'enum' THEN
    IF NOT (v_catalog.allowed_values @> jsonb_build_array(NEW.value)) THEN
      RAISE EXCEPTION 'value % for enum key=% not in allowed_values %', NEW.value, NEW.key, v_catalog.allowed_values;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_entity_setting_value ON entity_settings;
CREATE TRIGGER tr_validate_entity_setting_value
  BEFORE INSERT OR UPDATE ON entity_settings
  FOR EACH ROW EXECUTE FUNCTION validate_entity_setting_value();

CREATE INDEX IF NOT EXISTS idx_entity_settings_entity ON entity_settings(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_settings_tenant ON entity_settings(tenant_id);

ALTER TABLE entity_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entity_settings_tenant_isolation ON entity_settings;
CREATE POLICY entity_settings_tenant_isolation ON entity_settings FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- T3 plantilla_capa3_overrides_por_entidad
CREATE TABLE IF NOT EXISTS plantilla_capa3_overrides_por_entidad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  entity_id uuid NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  plantilla_id uuid NOT NULL REFERENCES plantillas_protegidas(id) ON DELETE RESTRICT,
  campo text NOT NULL,
  default_value_override jsonb,
  opciones_override jsonb,
  obligatoriedad_override text CHECK (obligatoriedad_override IN ('OBLIGATORIO', 'RECOMENDADO', 'OPCIONAL')),
  compatible_with_canonical_version text NOT NULL,
  motivo text NOT NULL CHECK (length(motivo) >= 10),
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  CONSTRAINT capa3_unique_per_campo UNIQUE (entity_id, plantilla_id, campo),
  CONSTRAINT capa3_at_least_one_override CHECK (
    default_value_override IS NOT NULL
    OR opciones_override IS NOT NULL
    OR obligatoriedad_override IS NOT NULL
  ),
  CONSTRAINT capa3_overrides_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE plantilla_capa3_overrides_por_entidad IS 'Overrides granulares de defaults UI capa3 por sociedad. No toca capa1.';

CREATE OR REPLACE FUNCTION validate_capa3_override()
RETURNS TRIGGER AS $$
DECLARE
  v_plantilla plantillas_protegidas%ROWTYPE;
  v_campo_exists boolean;
BEGIN
  SELECT * INTO v_plantilla FROM plantillas_protegidas WHERE id = NEW.plantilla_id;
  IF v_plantilla.estado <> 'ACTIVA' THEN
    RAISE EXCEPTION 'No se permite override sobre plantilla con estado=% (debe ser ACTIVA)', v_plantilla.estado;
  END IF;
  IF v_plantilla.capa3_editables IS NOT NULL THEN
    SELECT jsonb_path_exists(
      v_plantilla.capa3_editables,
      '$[*] ? (@.campo == $c)'::jsonpath,
      jsonb_build_object('c', NEW.campo)
    ) INTO v_campo_exists;
    IF NOT v_campo_exists THEN
      RAISE EXCEPTION 'campo=% no existe en capa3_editables de plantilla_id=%', NEW.campo, NEW.plantilla_id;
    END IF;
  END IF;
  IF NEW.opciones_override IS NOT NULL THEN
    IF jsonb_typeof(NEW.opciones_override) <> 'array' THEN
      RAISE EXCEPTION 'opciones_override debe ser array JSON';
    END IF;
    IF jsonb_array_length(NEW.opciones_override) = 0 THEN
      RAISE EXCEPTION 'opciones_override no puede ser array vacio (rompe UI)';
    END IF;
  END IF;
  IF NEW.default_value_override IS NOT NULL AND NEW.opciones_override IS NOT NULL THEN
    IF NOT (NEW.opciones_override @> jsonb_build_array(NEW.default_value_override)) THEN
      RAISE EXCEPTION 'default_value_override % no esta en opciones_override %', NEW.default_value_override, NEW.opciones_override;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_validate_capa3_override ON plantilla_capa3_overrides_por_entidad;
CREATE TRIGGER tr_validate_capa3_override
  BEFORE INSERT OR UPDATE ON plantilla_capa3_overrides_por_entidad
  FOR EACH ROW EXECUTE FUNCTION validate_capa3_override();

CREATE INDEX IF NOT EXISTS idx_capa3_overrides_entity ON plantilla_capa3_overrides_por_entidad(entity_id);
CREATE INDEX IF NOT EXISTS idx_capa3_overrides_plantilla ON plantilla_capa3_overrides_por_entidad(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_capa3_overrides_tenant ON plantilla_capa3_overrides_por_entidad(tenant_id);

ALTER TABLE plantilla_capa3_overrides_por_entidad ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capa3_overrides_tenant_isolation ON plantilla_capa3_overrides_por_entidad;
CREATE POLICY capa3_overrides_tenant_isolation ON plantilla_capa3_overrides_por_entidad FOR ALL
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- T4 bloques_sectoriales
CREATE TABLE IF NOT EXISTS bloques_sectoriales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_bloque text NOT NULL,
  version text NOT NULL,
  sector text NOT NULL CHECK (sector IN (
    'BANCA', 'SEGUROS', 'ENERGIA', 'FARMA', 'COTIZADAS',
    'EIP', 'INMOBILIARIO', 'PUBLICO_PRIVADO', 'MERCADO_VALORES', 'GENERICO'
  )),
  materia_aplicable text[] NOT NULL,
  texto_aprobado text NOT NULL,
  referencia_legal text,
  descripcion text,
  aprobada_por text,
  estado text NOT NULL CHECK (estado IN ('ACTIVA', 'ARCHIVADA')),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bloques_unique_clave_version UNIQUE (clave_bloque, version)
);

COMMENT ON TABLE bloques_sectoriales IS 'Biblioteca global de bloques de texto pre-aprobados por sector regulatorio. Soft-delete only. texto_aprobado inmutable cuando estado=ACTIVA.';

CREATE OR REPLACE FUNCTION prevent_active_block_text_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado = 'ACTIVA' AND NEW.texto_aprobado IS DISTINCT FROM OLD.texto_aprobado THEN
    RAISE EXCEPTION 'No se permite modificar texto_aprobado de un bloque ACTIVA. Para corregir: ARCHIVAR + crear nueva version.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_bloques_immutable_when_active ON bloques_sectoriales;
CREATE TRIGGER tr_bloques_immutable_when_active
  BEFORE UPDATE ON bloques_sectoriales
  FOR EACH ROW EXECUTE FUNCTION prevent_active_block_text_modification();

CREATE OR REPLACE FUNCTION prevent_block_physical_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DELETE fisico de bloques_sectoriales prohibido. Usar UPDATE estado=ARCHIVADA en su lugar.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_bloques_no_delete ON bloques_sectoriales;
CREATE TRIGGER tr_bloques_no_delete
  BEFORE DELETE ON bloques_sectoriales
  FOR EACH ROW EXECUTE FUNCTION prevent_block_physical_delete();

CREATE INDEX IF NOT EXISTS idx_bloques_sector_estado ON bloques_sectoriales(sector, estado);

ALTER TABLE bloques_sectoriales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bloques_public_read ON bloques_sectoriales;
CREATE POLICY bloques_public_read ON bloques_sectoriales FOR SELECT USING (true);

DROP POLICY IF EXISTS bloques_admin_write ON bloques_sectoriales;
CREATE POLICY bloques_admin_write ON bloques_sectoriales FOR ALL
  USING (fn_secretaria_is_service_role())
  WITH CHECK (fn_secretaria_is_service_role());

-- T5 bloque_insertions
CREATE TABLE IF NOT EXISTS bloque_insertions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agreement_id uuid NOT NULL REFERENCES agreements(id) ON DELETE RESTRICT,
  bloque_id uuid NOT NULL REFERENCES bloques_sectoriales(id) ON DELETE RESTRICT,
  bloque_clave text NOT NULL,
  bloque_version text NOT NULL,
  texto_insertado text NOT NULL,
  inserted_at timestamptz DEFAULT now(),
  inserted_by uuid,
  CONSTRAINT bloque_insertions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE bloque_insertions IS 'Auditoria WORM de inserciones de bloques sectoriales en agreements. Append-only.';

DROP TRIGGER IF EXISTS tr_worm_bloque_insertions_update ON bloque_insertions;
CREATE TRIGGER tr_worm_bloque_insertions_update
  BEFORE UPDATE ON bloque_insertions
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS tr_worm_bloque_insertions_delete ON bloque_insertions;
CREATE TRIGGER tr_worm_bloque_insertions_delete
  BEFORE DELETE ON bloque_insertions
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

CREATE INDEX IF NOT EXISTS idx_bloque_insertions_agreement ON bloque_insertions(agreement_id);
CREATE INDEX IF NOT EXISTS idx_bloque_insertions_bloque ON bloque_insertions(bloque_id, bloque_version);

ALTER TABLE bloque_insertions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bloque_insertions_tenant_read ON bloque_insertions;
CREATE POLICY bloque_insertions_tenant_read ON bloque_insertions FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS bloque_insertions_tenant_insert ON bloque_insertions;
CREATE POLICY bloque_insertions_tenant_insert ON bloque_insertions FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

-- T6 plantilla_changelog
CREATE TABLE IF NOT EXISTS plantilla_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  plantilla_id uuid NOT NULL REFERENCES plantillas_protegidas(id) ON DELETE RESTRICT,
  from_version text,
  to_version text NOT NULL,
  bump_type text NOT NULL CHECK (bump_type IN ('PATCH', 'MINOR', 'MAJOR')),
  motivo text NOT NULL,
  autor text NOT NULL,
  diff_summary text,
  pr_url text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT changelog_unique_to_version UNIQUE (plantilla_id, to_version),
  CONSTRAINT plantilla_changelog_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

COMMENT ON TABLE plantilla_changelog IS 'Historial WORM de cambios a plantillas. Sustituye el ciclo de firma legal por trazabilidad tecnica.';

DROP TRIGGER IF EXISTS tr_worm_plantilla_changelog_update ON plantilla_changelog;
CREATE TRIGGER tr_worm_plantilla_changelog_update
  BEFORE UPDATE ON plantilla_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

DROP TRIGGER IF EXISTS tr_worm_plantilla_changelog_delete ON plantilla_changelog;
CREATE TRIGGER tr_worm_plantilla_changelog_delete
  BEFORE DELETE ON plantilla_changelog
  FOR EACH ROW EXECUTE FUNCTION worm_guard();

CREATE INDEX IF NOT EXISTS idx_changelog_plantilla ON plantilla_changelog(plantilla_id, created_at DESC);

ALTER TABLE plantilla_changelog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS changelog_tenant_read ON plantilla_changelog;
CREATE POLICY changelog_tenant_read ON plantilla_changelog FOR SELECT
  USING (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);

DROP POLICY IF EXISTS changelog_tenant_insert ON plantilla_changelog;
CREATE POLICY changelog_tenant_insert ON plantilla_changelog FOR INSERT
  WITH CHECK (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid);
