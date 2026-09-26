import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// MOI-142: permitir emitir la convocatoria de una Junta, no solo la de un
// Consejo. Se añade una RPC HERMANA (fn_emit_convocatoria_junta) en una
// migración nueva, sin tocar fn_emit_convocatoria. Este test lee esa
// migración nueva (contrato de la RPC de Junta) y, por separado, relee la
// migración original de julio para confirmar que la ruta de Consejo sigue
// intacta — el mismo "GOTCHA de verificación" que señala el issue MOI-142
// (un test que solo mira un fichero fijo seguiría verde aunque OTRA
// migración cambiase el comportamiento), cubierto aquí releyendo ambos
// ficheros: el de julio para el contrato de Consejo y el de esta migración
// para el contrato de Junta.
//
// AVISO (revisión, P1): este fichero hace SOLO comprobaciones de texto
// (toContain contra el propio .sql). No ejecuta ni una línea de SQL, así que
// "pasa" aunque el CASE/ELSIF no compile, aunque una columna referenciada no
// exista o aunque una CHECK constraint no pueda instalarse — no lo detecta.
// Su valor es otro: cazar que alguien borre o parafrasee un literal exacto
// que el contrato exige (un código de error, una cláusula de la CHECK), y
// que el reemplazo del trigger compartido no pierda la rama de Consejo.
// La validación EJECUTABLE real (aplicar la migración contra el esquema real
// de un Postgres desechable y comprobar que compila e instala sin error)
// vive aparte, en
// supabase/migrations/proposed/20260926114200_secretaria_convocation_junta_emit_rpc.verify-live.sh
// — no en bun test, porque necesita Docker y una lectura de esquema (sin
// datos, sin escritura) contra governance_OS vía el pooler, algo que este
// runner no hace. Ejecutado a mano en esta revisión: aplica limpio contra el
// esquema real (BEGIN…COMMIT sin error, DO $verify$ de la propia migración
// pasa) y el control positivo posterior confirma fn_emit_convocatoria_junta
// instalada y el CHECK con la ruta de Junta.

const juntaMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260926114200_secretaria_convocation_junta_emit_rpc.sql",
  ),
  "utf8",
);
const juntaExecutableSql = juntaMigration.replace(/^\s*--.*$/gm, "");
const emitJuntaRpc =
  juntaExecutableSql.match(
    /CREATE OR REPLACE FUNCTION public\.fn_emit_convocatoria_junta\([\s\S]*?\n\$function\$;/i,
  )?.[0] ?? "";
const authorityTrigger =
  juntaExecutableSql.match(
    /CREATE OR REPLACE FUNCTION secretaria_private\.fn_convocatoria_authority_representation_guard\(\)[\s\S]*?\n\$function\$;/i,
  )?.[0] ?? "";

const cdaMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720138000_secretaria_convocation_manifest_and_emit_rpc.sql",
  ),
  "utf8",
);
const cdaExecutableSql = cdaMigration.replace(/^\s*--.*$/gm, "");
const emitCdaRpc =
  cdaExecutableSql.match(
    /CREATE OR REPLACE FUNCTION public\.fn_emit_convocatoria\([\s\S]*?\n\$function\$;/i,
  )?.[0] ?? "";

describe("convocatoria de Junta — RPC hermana gobernada (MOI-142)", () => {
  it("no toca fn_emit_convocatoria: el Consejo sigue restringido a CDA activo/ES/DEMO", () => {
    // Regresión explícita: esta migración es aditiva. Si algún día alguien
    // reescribe fn_emit_convocatoria en vez de mantener la RPC hermana, este
    // test debe fallar en vez de quedarse verde por casualidad.
    expect(emitCdaRpc).toContain("CONVOCATION_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_CDA");
    expect(emitCdaRpc).toContain("v_body.body_type <> 'CDA'");
  });

  it("define fn_emit_convocatoria_junta restringida a JUNTA activa/ES/DEMO", () => {
    expect(juntaExecutableSql).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_emit_convocatoria_junta",
    );
    expect(emitJuntaRpc).toContain("v_body.body_type <> 'JUNTA'");
    expect(emitJuntaRpc).toContain("CONVOCATION_JUNTA_RPC_SUPPORTS_ONLY_ACTIVE_ES_DEMO_JUNTA");
    expect(emitJuntaRpc).toContain("AUTHENTICATED_USER_REQUIRED_TO_RECORD_DEMO_CONVOCATION_ACT");
    expect(emitJuntaRpc).toContain("CONVOCATION_SERVER_FIELDS_ARE_NOT_CLIENT_CLAIMS");
    expect(emitJuntaRpc).toContain("ACTIVE_CONVOCATION_ISSUE_CAPABILITY_REQUIRED");
  });

  it("deriva el convocante del órgano de administración de la entidad, no solo del Presidente", () => {
    expect(authorityTrigger).toContain("v_body.body_type = 'JUNTA'");
    expect(authorityTrigger).toContain("admin_body.body_type = 'CDA'");
    expect(authorityTrigger).toContain("evidence.cargo IN ('PRESIDENTE', 'ADMIN_UNICO')");
    expect(authorityTrigger).toContain("CONVOCATION_JUNTA_ADMINISTRATIVE_BODY_NOT_EXACT");
    expect(authorityTrigger).toContain("CONVOCATION_JUNTA_ADMINISTRATOR_AUTHORITY_NOT_EXACT_OR_NOT_YET_SUPPORTED");
    expect(authorityTrigger).toContain("PRESIDENTE_ART_166_JUNTA");
    expect(authorityTrigger).toContain("ADMIN_UNICO_ART_166_JUNTA");
    // La rama CDA original sigue intacta en la MISMA función reemplazada.
    expect(authorityTrigger).toContain("CONVOCATION_PRESIDENT_AUTHORITY_NOT_EXACT");
    expect(authorityTrigger).toContain("PRESIDENTE_ART_246_1");
  });

  it("exige plantilla CONVOCATORIA/JUNTA_GENERAL activa con hash íntegro", () => {
    expect(emitJuntaRpc).toContain("template.organo_tipo = 'JUNTA_GENERAL'");
    expect(emitJuntaRpc).toContain("template.estado = 'ACTIVA'");
    expect(emitJuntaRpc).toContain("ACTIVE_APPROVED_CONVOCATION_TEMPLATE_JUNTA_REQUIRED");
  });

  it("liga el texto revisado a la entidad, la fecha, el lugar y cada punto del orden del día", () => {
    expect(emitJuntaRpc).toContain("CONVOCATION_TEXT_UNRESOLVED_TEMPLATE_VARIABLES");
    expect(emitJuntaRpc).toContain("CONVOCATION_TEXT_ENTITY_NAME_MISMATCH");
    expect(emitJuntaRpc).toContain("CONVOCATION_TEXT_MEETING_DATE_MISMATCH");
    expect(emitJuntaRpc).toContain("CONVOCATION_TEXT_PLACE_MISMATCH");
    expect(emitJuntaRpc).toContain("CONVOCATION_TEXT_AGENDA_TITLE_MISMATCH");
    expect(emitJuntaRpc).toContain(
      "Documento demo/operativo. No constituye evidencia final productiva.",
    );
  });

  it("rechaza la materia de representación de socio único (exclusiva del Consejo)", () => {
    expect(emitJuntaRpc).toContain("REPRESENTATION_LEGACY_MATTER_FORBIDDEN");
  });

  it("revalida la autoridad justo antes de congelar el manifiesto, igual que el Consejo", () => {
    expect(emitJuntaRpc).toContain("CONVOCATION_JUNTA_AUTHORITY_REVALIDATION_FAILED");
    expect(emitJuntaRpc).toContain("CONVOCATION_JUNTA_OFFICE_EVIDENCE_DRIFT");
    expect(emitJuntaRpc).toContain("CONVOCATION_JUNTA_AUTHORITY_ROUTE_DRIFT");
    expect(emitJuntaRpc).toContain("FOR SHARE");
  });

  it("congela un manifiesto v2 compatible con el guard WORM compartido", () => {
    expect(emitJuntaRpc).toContain("secretaria.convocation-manifest.v2");
    expect(emitJuntaRpc).toContain("DEMO_OPERATIONAL_DRAFT_RECORDED");
    expect(emitJuntaRpc).toContain("not_a_legal_convocation");
    expect(emitJuntaRpc).toContain("reviewed_demo_draft_text_hash_sha256");
    // El guard fn_convocation_manifest_worm_guard exige literalmente esta
    // clave en {authority,president_action_not_asserted}; aplica también
    // cuando el convocante es Administrador Único.
    expect(emitJuntaRpc).toContain("'president_action_not_asserted', true");
    expect(emitJuntaRpc).toContain("'act_id', v_act_row.id");
    expect(emitJuntaRpc).toContain("'act_hash_sha512', v_act_row.act_hash_sha512");
  });

  it("no afirma firma, envío ni entrega real", () => {
    expect(emitJuntaRpc).toContain("'ead_signature_service_required', false");
    expect(emitJuntaRpc).toContain("'legal_signature_status', 'NOT_ASSERTED'");
    expect(emitJuntaRpc).toContain(
      "'external_signature_requirements', 'OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT'",
    );
    expect(emitJuntaRpc).toContain("'real_delivery_allowed', false");
  });

  it("revoca DML directo: solo authenticated puede ejecutar la RPC hermana", () => {
    expect(juntaExecutableSql).toContain(
      "REVOKE ALL ON FUNCTION public.fn_emit_convocatoria_junta(jsonb)\n  FROM PUBLIC, anon, authenticated, service_role;",
    );
    expect(juntaExecutableSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.fn_emit_convocatoria_junta(jsonb)\n  TO authenticated;",
    );
    expect(juntaExecutableSql).toContain(
      "has_function_privilege('anon', 'public.fn_emit_convocatoria_junta(jsonb)', 'EXECUTE')",
    );
  });

  it("amplía (sin recortar) las rutas de autoridad permitidas en convocatorias y convocation_acts", () => {
    expect(juntaExecutableSql).toContain("convocatorias_authority_route_check");
    expect(juntaExecutableSql).toContain("convocation_acts_authority_route_check");
    expect(juntaExecutableSql).toContain("'PRESIDENTE_ART_246_1'");
    expect(juntaExecutableSql).toContain("'PRESIDENTE_ART_166_JUNTA'");
    expect(juntaExecutableSql).toContain("'ADMIN_UNICO_ART_166_JUNTA'");
  });

  it("verifica al final de la transacción que la rama CDA no se ha perdido al reemplazar el trigger", () => {
    expect(juntaExecutableSql).toContain("CONVOCATION_CDA_RPC_MUST_REMAIN_UNCHANGED");
    expect(juntaExecutableSql).toContain("CONVOCATION_CDA_AUTHORITY_BRANCH_LOST_ON_REPLACE");
    expect(juntaExecutableSql).toContain("CONVOCATION_JUNTA_AUTHORITY_TRIGGER_INSTALL_FAILED");
  });
});
