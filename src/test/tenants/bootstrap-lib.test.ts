// src/test/tenants/bootstrap-lib.test.ts
//
// Lógica pura del pack base: QUÉ entra, QUÉ se transforma y CÓMO se clona.
// Es la parte que decide lo que el bootstrap escribe con service-role, así que
// se prueba sin Cloud y con entradas hostiles.
import { describe, expect, it } from "vitest";
import {
  aprobadaPorClon,
  canonicalJson,
  clonarCertificationKind,
  clonarPlantilla,
  clonarRulePack,
  clonarRuleSet,
  idPlantillaClonada,
  mencionaArga,
  neutralizarAvisoPrototipo,
  packIdPara,
  resolverEntorno,
  seleccionarCertificationKinds,
  seleccionarPlantillas,
  seleccionarRulePacks,
  seleccionarRuleSets,
  sha256Hex,
  targetEsGovernanceOs,
  uuidV5,
  type PlantillaOrigen,
  type RulePackOrigen,
  type RuleSetOrigen,
  type StandaloneCertificationKindOrigen,
} from "../../../scripts/tenants/bootstrap-lib";
import { TENANT_SPECS } from "../../../scripts/tenants/tenant-spec";

const spec = TENANT_SPECS.nuevo;

describe("utilidades", () => {
  it("uuidV5 coincide con el vector de referencia de la RFC 4122", () => {
    const NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    expect(uuidV5("python.org", NAMESPACE_DNS)).toBe("886313e1-3b8a-5372-9b90-0c9aee199e5d");
  });

  it("uuidV5 es determinista y distingue tenants", () => {
    expect(idPlantillaClonada(spec, "abc")).toBe(idPlantillaClonada(spec, "abc"));
    expect(idPlantillaClonada(spec, "abc")).not.toBe(idPlantillaClonada({ tenantId: "00000000-0000-0000-0000-000000000004" }, "abc"));
  });

  it("canonicalJson no depende del orden de las claves", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: [2, { y: 2, z: 1 }] }, b: 1 }));
  });

  it("mencionaArga no confunde castellano con un cliente", () => {
    expect(mencionaArga("encargando a la Secretaría la propuesta")).toBe(false);
    expect(mencionaArga("cargará con los gastos")).toBe(false);
    expect(mencionaArga("Reglamento del Consejo de ARGA")).toBe(true);
    expect(mencionaArga({ a: [{ b: "Grupo ARGA Seguros" }] })).toBe(true);
    expect(mencionaArga(null)).toBe(false);
  });

  it("el guard de target solo acepta governance_OS", () => {
    expect(targetEsGovernanceOs("https://hzqwefkwsxopwrmtksbg.supabase.co")).toBe(true);
    expect(targetEsGovernanceOs("https://hzqwefkwsxopwrmtksbg.supabase.co.evil.dev")).toBe(false);
    expect(targetEsGovernanceOs("https://otro.supabase.co/?x=hzqwefkwsxopwrmtksbg")).toBe(false);
    expect(targetEsGovernanceOs("no-es-url")).toBe(false);
  });

  it("resolverEntorno entiende los nombres de variable de este repo", () => {
    const e = resolverEntorno({ PROJECT_URL: "https://hzqwefkwsxopwrmtksbg.supabase.co/", SERVICE_ROLE_SECRET: "k" });
    expect(e.url).toBe("https://hzqwefkwsxopwrmtksbg.supabase.co");
    expect(e.serviceKey).toBe("k");
    expect(resolverEntorno({}).serviceKey).toBe("");
  });
});

describe("neutralizarAvisoPrototipo", () => {
  it("sustituye SOLO el nombre del repositorio en el aviso de prototipo", () => {
    const r = neutralizarAvisoPrototipo("Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map. No constituye evidencia final productiva.");
    expect(r.cambiado).toBe(true);
    expect(r.texto).toBe("Esta acta se genera como evidencia demo/operativa del prototipo TGMS. No constituye evidencia final productiva.");
  });

  it("no toca ninguna otra mención", () => {
    const original = "Conforme al Reglamento del Consejo de ARGA, no hay voto de calidad.";
    expect(neutralizarAvisoPrototipo(original)).toEqual({ texto: original, cambiado: false });
  });
});

const packOrigen = (over: Partial<RulePackOrigen> = {}, vover: Partial<RulePackOrigen["rule_pack_versions"][number]> = {}): RulePackOrigen => ({
  id: "APROBACION_CUENTAS",
  materia: "APROBACION_CUENTAS",
  organo_tipo: "JUNTA_GENERAL",
  descripcion: "Aprobación de cuentas",
  rule_pack_versions: [{ version: "1.0.1", status: "ACTIVE", is_active: true, effective_from: "2026-01-01", payload_hash: null, payload: { id: "APROBACION_CUENTAS", materia: "APROBACION_CUENTAS", votacion: {} }, ...vover }],
  ...over,
});

describe("seleccionarRulePacks", () => {
  it("incluye un pack ACTIVE con una sola versión activa", () => {
    const r = seleccionarRulePacks([packOrigen()]);
    expect(r.excluidos).toEqual([]);
    expect(r.incluidos).toHaveLength(1);
    expect(r.incluidos[0].payload_sha256).toBe(sha256Hex(canonicalJson(packOrigen().rule_pack_versions[0].payload)));
  });

  it("excluye status NULL, demo_scope, mención a ARGA y versiones activas ≠ 1", () => {
    const r = seleccionarRulePacks([
      packOrigen({ id: "A" }, { status: null }),
      packOrigen({ id: "B" }, { payload: { reglaEspecifica: { demo_scope: "x" } } }),
      packOrigen({ id: "C" }, { payload: { nota: "Estatutos de ARGA" } }),
      packOrigen({ id: "D", rule_pack_versions: [] }),
      { ...packOrigen({ id: "E" }), rule_pack_versions: [packOrigen().rule_pack_versions[0], packOrigen().rule_pack_versions[0]] },
    ]);
    expect(r.incluidos).toEqual([]);
    expect(r.excluidos.map((e) => e.source_id)).toEqual(["A", "B", "C", "D", "E"]);
    expect(r.excluidos[0].motivo).toMatch(/status=NULL/);
    expect(r.excluidos[1].motivo).toMatch(/demo_scope/);
  });
});

const setOrigen = (over: Partial<RuleSetOrigen> = {}): RuleSetOrigen => ({
  id: "11111111-1111-4111-8111-111111111111", jurisdiction: "ES", company_form: "SA", typology_code: "JUNTA_GENERAL",
  rule_set_version: "1.0", legal_reference: "LSC", name: "Junta SA", statutory_override: false, is_active: true, pack_id: null, rule_config: {}, ...over,
});

describe("seleccionarRuleSets", () => {
  it("solo ES, activo y sin pack_id del origen", () => {
    const r = seleccionarRuleSets([setOrigen(), setOrigen({ id: "2", jurisdiction: "PT" }), setOrigen({ id: "3", is_active: false }), setOrigen({ id: "4", pack_id: "22222222-2222-4222-8222-222222222222" })]);
    expect(r.incluidos.map((s) => s.source_id)).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(r.excluidos).toHaveLength(3);
  });
});

const plantillaOrigen = (over: Partial<PlantillaOrigen> = {}): PlantillaOrigen => ({
  id: "33333333-3333-4333-8333-333333333333", tipo: "ACTA_SESION", materia: "JUNTA_GENERAL", materia_acuerdo: null, jurisdiccion: "ES",
  version: "1.3.0", estado: "ACTIVA", organo_tipo: "JUNTA_GENERAL", adoption_mode: "MEETING", tipo_social: null, referencia_legal: "Art. 202 LSC",
  capa1_inmutable: "Acta. Esta acta se genera como evidencia demo/operativa del prototipo ARGA Governance Map.", capa2_variables: [], capa3_editables: [],
  contenido_template: null, variables: null, protecciones: null, snapshot_rule_pack_required: true, contrato_variables_version: "1.1.0",
  requiere_comunicacion: false, comunicacion_config: null, notas_legal: null, aprobada_por: "Comité Legal ARGA", fecha_aprobacion: "2026-05-05", content_hash_sha256: "x", ...over,
});

describe("seleccionarPlantillas", () => {
  it("neutraliza el aviso y recalcula el hash con la fórmula del servidor", () => {
    const r = seleccionarPlantillas([plantillaOrigen()]);
    expect(r.excluidas).toEqual([]);
    const p = r.incluidas[0];
    expect(p.capa1_neutralizada).toBe(true);
    expect(mencionaArga(p.capa1_inmutable)).toBe(false);
    expect(p.content_hash_sha256).toBe(sha256Hex(p.capa1_inmutable));
  });

  it("falla CERRADO: una mención a ARGA que sobrevive excluye la plantilla, no se arregla", () => {
    const r = seleccionarPlantillas([
      plantillaOrigen({ id: "a", capa1_inmutable: "Conforme al Reglamento del Consejo de ARGA." }),
      plantillaOrigen({ id: "b", capa3_editables: [{ label: "Sociedad del Grupo ARGA" }] }),
      plantillaOrigen({ id: "c", estado: "ARCHIVADA" }),
      plantillaOrigen({ id: "d", capa1_inmutable: "  " }),
    ]);
    expect(r.incluidas).toEqual([]);
    expect(r.excluidas.map((e) => e.source_id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("avisa, sin excluir, cuando las notas citan normativa interna de ARGA", () => {
    const r = seleccionarPlantillas([plantillaOrigen({ notas_legal: "No voto de calidad (Reglamento Consejo ARGA deshabilita en comisiones)." })]);
    expect(r.incluidas).toHaveLength(1);
    expect(r.avisos).toHaveLength(1);
  });

  it("no avisa por la mera normalización del firmante", () => {
    const r = seleccionarPlantillas([plantillaOrigen({ notas_legal: "Firmante normalizado a forma canónica ARGA (procedimiento_plantillas_v1)." })]);
    expect(r.avisos).toEqual([]);
  });
});

describe("clonado a un tenant", () => {
  it("rule pack: id con prefijo, MATERIA canónica, payload verbatim, tenant explícito", () => {
    const [p] = seleccionarRulePacks([packOrigen()]).incluidos;
    const c = clonarRulePack(spec, p, "2026-09-19");
    expect(c.pack.id).toBe("GN_APROBACION_CUENTAS");
    expect(c.pack.id).toBe(packIdPara(spec, "APROBACION_CUENTAS"));
    // La resolución del motor es por (tenant_id, materia): una materia con
    // prefijo dejaría el tenant sin reglas aunque las filas existan.
    expect(c.pack.materia).toBe("APROBACION_CUENTAS");
    expect(c.pack.tenant_id).toBe(spec.tenantId);
    expect(c.version.payload).toBe(p.payload);
    expect(c.version).toMatchObject({ pack_id: c.pack.id, version: "1.0.1", is_active: true, status: "ACTIVE" });
    expect(c.pack.descripcion).toMatch(/Pack base LSC \(origen APROBACION_CUENTAS@1\.0\.1\)/);
  });

  it("rule set: tenant explícito (la columna tiene DEFAULT de ARGA) e id determinista", () => {
    const [r] = seleccionarRuleSets([setOrigen()]).incluidos;
    const c = clonarRuleSet(spec, r);
    expect(c.tenant_id).toBe(spec.tenantId);
    expect(c.pack_id).toBeNull();
    expect(c.id).toBe(clonarRuleSet(spec, r).id);
    expect(c.id).not.toBe(r.source_id);
  });

  it("plantilla: entra en BORRADOR, conserva versión y lleva procedencia", () => {
    const [p] = seleccionarPlantillas([plantillaOrigen()]).incluidas;
    const c = clonarPlantilla(spec, p, "2026-09-19");
    expect(c.estado).toBe("BORRADOR");
    expect(c.tenant_id).toBe(spec.tenantId);
    expect(c.version).toBe("1.3.0");
    expect(c.aprobada_por).toBeNull();
    expect(c.content_hash_sha256).toBe(sha256Hex(c.capa1_inmutable));
    expect(c.notas_legal).toMatch(/Clon de la plantilla 33333333/);
    expect(aprobadaPorClon(p)).toMatch(/aprobada en origen por «Comité Legal ARGA»/);
  });

  it("seleccionarCertificationKinds: excluye tipos inactivos, con requires_qes o que afirman envío/entrega", () => {
    const tiposPrueba: StandaloneCertificationKindOrigen[] = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        kind_code: "CERT_ACUERDO_360",
        label: "Certificación de acuerdo 360",
        source_domain: "agreements",
        legal_effect: "REGISTRAL",
        requires_visto_bueno: true,
        requires_rm_reference: true,
        requires_qes: false,
        template_binding_key: "CERTIFICACION_AUTONOMA:ACUERDO_360",
        authority_policy: null,
        disclaimer_policy: null,
        is_active: true,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        kind_code: "CERT_ENVIO_CONVOCATORIA",
        label: "Certificado de emisión y envío de convocatoria",
        source_domain: "convocatorias",
        legal_effect: "INTERNO",
        requires_visto_bueno: false,
        requires_rm_reference: false,
        requires_qes: false,
        template_binding_key: null,
        authority_policy: null,
        disclaimer_policy: null,
        is_active: false,
      },
      {
        id: "33333333-3333-3333-3333-333333333333",
        kind_code: "CERT_ERDS_ENTREGA",
        label: "Certificado de entrega electrónica certificada ERDS",
        source_domain: "erds",
        legal_effect: "TERCERO",
        requires_visto_bueno: false,
        requires_rm_reference: false,
        requires_qes: true,
        template_binding_key: null,
        authority_policy: null,
        disclaimer_policy: null,
        is_active: true,
      },
    ];

    const { incluidos, excluidos } = seleccionarCertificationKinds(tiposPrueba);
    expect(incluidos).toHaveLength(1);
    expect(incluidos[0].kind_code).toBe("CERT_ACUERDO_360");
    expect(excluidos).toHaveLength(2);
    expect(excluidos.map((e) => e.etiqueta)).toEqual(
      expect.arrayContaining(["CERT_ENVIO_CONVOCATORIA", "CERT_ERDS_ENTREGA"]),
    );
  });

  it("clonarCertificationKind: id determinista, tenantId explícito y requires_qes siempre false", () => {
    const origen: StandaloneCertificationKindOrigen = {
      id: "11111111-1111-1111-1111-111111111111",
      kind_code: "CERT_VIGENCIA_CARGO",
      label: "Certificado de vigencia de cargo",
      source_domain: "condiciones_persona",
      legal_effect: "TERCERO",
      requires_visto_bueno: true,
      requires_rm_reference: true,
      requires_qes: false,
      template_binding_key: "CERTIFICACION_AUTONOMA:VIGENCIA_CARGO",
      authority_policy: { test: true },
      disclaimer_policy: { demo: true },
      is_active: true,
    };

    const c = clonarCertificationKind(spec, origen);
    expect(c.tenant_id).toBe(spec.tenantId);
    expect(c.kind_code).toBe("CERT_VIGENCIA_CARGO");
    expect(c.requires_qes).toBe(false);
    expect(c.is_active).toBe(true);
    expect(c.id).toBe(clonarCertificationKind(spec, origen).id);
    expect(c.id).not.toBe(origen.id);
  });
});
