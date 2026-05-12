import { isUnipersonalTipo, TIPO_SOCIAL_VALUES } from "./defaults";
import type {
  CapTableEntryDraft,
  CargoInputDraft,
  SociedadOnboardingDraft,
  TipoCondicionOnboarding,
  ValidationIssue,
  ValidationResult,
  ValidationSeverity,
} from "./types";

function issue(
  code: string,
  field: string,
  message: string,
  severity: ValidationSeverity = "BLOCK",
): ValidationIssue {
  return { code, field, message, severity };
}

function isBlank(value: unknown) {
  return String(value ?? "").trim().length === 0;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nonTreasury(entries: CapTableEntryDraft[]) {
  return entries.filter((entry) => !entry.is_treasury);
}

function hasCargo(cargos: CargoInputDraft[], tipo: TipoCondicionOnboarding) {
  return cargos.some((cargo) => cargo.tipo_condicion === tipo && cargo.persona);
}

function adminCargoTiposForForma(draft: SociedadOnboardingDraft): TipoCondicionOnboarding[] {
  if (draft.profile.tipo_organo_admin === "ADMIN_UNICO") return ["ADMIN_UNICO", "ADMIN_PJ"];
  if (draft.profile.tipo_organo_admin === "ADMIN_SOLIDARIOS") return ["ADMIN_SOLIDARIO", "ADMIN_PJ"];
  if (draft.profile.tipo_organo_admin === "ADMIN_MANCOMUNADOS") return ["ADMIN_MANCOMUNADO", "ADMIN_PJ"];
  return [];
}

export function validateSociedadOperability(draft: SociedadOnboardingDraft): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (isBlank(draft.identification.legal_name)) {
    issues.push(issue("S-001", "identification.legal_name", "La denominacion social es obligatoria."));
  }
  if (isBlank(draft.identification.tax_id)) {
    issues.push(issue("S-002", "identification.tax_id", "El NIF/CIF es obligatorio."));
  }
  if (!TIPO_SOCIAL_VALUES.includes(draft.identification.tipo_social)) {
    issues.push(issue("S-003", "identification.tipo_social", "El tipo social debe ser SA, SL, SAU o SLU."));
  }
  if (isBlank(draft.identification.jurisdiction)) {
    issues.push(issue("S-004", "identification.jurisdiction", "La jurisdiccion es obligatoria."));
  }

  const addressMissing = [
    draft.registry.address_street,
    draft.registry.address_number,
    draft.registry.postal_code,
    draft.registry.city,
    draft.registry.country,
  ].some(isBlank);
  if (addressMissing) {
    issues.push(issue("S-005", "registry.address", "Domicilio incompleto.", "BLOCK_OPERATIONAL"));
  }
  if (isBlank(draft.registry.cnae_primary)) {
    issues.push(issue("S-006", "registry.cnae_primary", "El CNAE principal es obligatorio.", "BLOCK_OPERATIONAL"));
  }

  const capital = num(draft.capital.capital_escriturado);
  const paid = num(draft.capital.capital_desembolsado || draft.capital.capital_escriturado);
  const totalTitles = num(draft.capital.numero_titulos);
  const nominal = num(draft.capital.valor_nominal);

  if (capital <= 0) issues.push(issue("C-001", "capital.capital_escriturado", "El capital escriturado debe ser mayor que cero."));
  if (paid > capital) issues.push(issue("C-002", "capital.capital_desembolsado", "El capital desembolsado no puede exceder el escriturado."));
  if (totalTitles <= 0) issues.push(issue("C-003", "capital.numero_titulos", "El numero total de titulos debe ser mayor que cero."));
  if (nominal <= 0) issues.push(issue("C-004", "capital.valor_nominal", "El valor nominal debe ser mayor que cero."));

  if (draft.shareClasses.length === 0) {
    issues.push(issue("CL-001", "shareClasses", "Debe existir al menos una clase o serie."));
  }
  const classTitles = draft.shareClasses.reduce((sum, item) => sum + num(item.numero_titulos), 0);
  if (draft.shareClasses.length > 0 && totalTitles > 0 && classTitles !== totalTitles) {
    issues.push(issue("CL-002", "shareClasses.numero_titulos", "La suma de titulos por clase debe coincidir con el total."));
  }
  // CL-003: el class_code no puede ser blank/vacio. Sin este check, si el
  // usuario borra un codigo, el dropdown de cap-table puede cargar codes
  // vacios y la RPC luego falla con "share class class_code is required"
  // -> server rollback en lugar de error inline (review Codex P2).
  for (const sc of draft.shareClasses) {
    if (!sc.class_code || sc.class_code.trim() === "") {
      issues.push(issue("CL-003", "shareClasses.class_code", "El codigo de cada clase/serie es obligatorio."));
      break;
    }
  }
  // CL-004: codigos duplicados rompen UNIQUE (entity_id, class_code) en server
  // (schema canonico 000019). Sin este check, dos clases con mismo code pasan
  // validacion pero la RPC falla con duplicate key constraint -> server rollback
  // (review Codex P2).
  const seenClassCodes = new Set<string>();
  for (const sc of draft.shareClasses) {
    const code = sc.class_code?.trim();
    if (!code) continue;
    if (seenClassCodes.has(code)) {
      issues.push(issue(
        "CL-004",
        "shareClasses.class_code",
        `El codigo "${code}" esta duplicado. Cada clase/serie debe tener un codigo unico.`
      ));
      break;
    }
    seenClassCodes.add(code);
  }

  if (draft.capTable.length === 0) {
    issues.push(issue("CT-001", "capTable", "El cap table inicial esta vacio.", "BLOCK_OPERATIONAL"));
  }
  const holdingTitles = draft.capTable.reduce((sum, item) => sum + num(item.numero_titulos), 0);
  if (draft.capTable.length > 0 && totalTitles > 0 && holdingTitles !== totalTitles) {
    issues.push(issue("CT-002", "capTable.numero_titulos", "El cap table debe sumar el 100% de los titulos.", "BLOCK_OPERATIONAL"));
  }

  // CT-006: codigos referenciados en cap-table deben estar declarados en el paso 5.
  // Sin este check, el validador pasaba si los titulos totales cuadraban aunque algun
  // holding apuntara a una clase no declarada. La RPC TX1 ya rechaza ese payload con
  // RAISE EXCEPTION en fn_crear_sociedad_legal_y_capital, por lo que el usuario
  // llegaba al submit, recibia un rollback y perdia trabajo. Detectarlo inline aqui
  // evita el round-trip al servidor (review Codex P2).
  const declaredClassCodes = new Set(draft.shareClasses.map((c) => c.class_code).filter(Boolean));
  for (const entry of draft.capTable) {
    const code = entry.share_class_code?.trim();
    // CT-009: blank class_code en holding cuando hay clases declaradas. Caso real:
    // holding agregado antes de declarar clases, luego clase agregada pero el
    // holding queda sin code. Mi guard previo `if (code && ...)` saltaba este
    // caso; RPC luego falla con "capital_holding refers to undeclared
    // share_class_code" -> rollback (review Codex P2).
    if (!code && draft.shareClasses.length > 0) {
      issues.push(issue(
        "CT-009",
        `capTable.${entry.key}.share_class_code`,
        "Asigna una clase/serie declarada en el paso 5 a este holding."
      ));
      continue;
    }
    if (code && !declaredClassCodes.has(code)) {
      issues.push(issue(
        "CT-006",
        `capTable.${entry.key}.share_class_code`,
        `La clase/serie "${code}" no esta declarada en el paso 5; declarala antes de asignar titulos.`
      ));
    }
  }

  const titlesByClass = draft.capTable.reduce<Record<string, number>>((acc, item) => {
    const code = item.share_class_code;
    acc[code] = (acc[code] ?? 0) + num(item.numero_titulos);
    return acc;
  }, {});
  for (const shareClass of draft.shareClasses) {
    if ((titlesByClass[shareClass.class_code] ?? 0) > num(shareClass.numero_titulos)) {
      issues.push(issue("CT-003", `capTable.${shareClass.class_code}`, "Hay mas titulos asignados que emitidos para una clase."));
    }
  }

  // CT-010: holdings duplicados (mismo holder, misma clase). El UNIQUE
  // ux_capital_holdings_vigente (entity_id, holder_person_id, share_class_id)
  // del schema canonico rechaza la 2a row -> rollback. Las filas se identifican
  // por holder.tax_id (o holder.key si tax_id falta) + share_class_code (review
  // Codex P2).
  const seenHoldings = new Set<string>();
  for (const entry of draft.capTable) {
    if (entry.is_treasury) continue;
    const holderKey = entry.holder?.tax_id?.trim() || entry.holder?.key || "";
    const classKey = entry.share_class_code?.trim() || "";
    if (!holderKey || !classKey) continue;
    const composite = `${holderKey}::${classKey}`;
    if (seenHoldings.has(composite)) {
      issues.push(issue(
        "CT-010",
        `capTable.${entry.key}`,
        `Hay dos filas para el mismo socio y la misma clase/serie "${classKey}". Combina los titulos en una sola fila.`
      ));
    }
    seenHoldings.add(composite);
  }

  // CT-007: holding no-treasury sin holder seleccionado bloquea. Sin este
  // check, los holdings sin socio "se descartaban silenciosamente" del
  // calculo CT-004/CT-005 y la RPC luego fallaba con "holder not resolved"
  // -> server rollback (review Codex P2).
  for (const entry of draft.capTable) {
    if (!entry.is_treasury && !entry.holder) {
      issues.push(issue(
        "CT-007",
        `capTable.${entry.key}.holder`,
        "Cada socio debe estar identificado (NIF/CIF o nueva persona). Marca la fila como autocartera si no aplica."
      ));
    }
  }

  // CT-008: holder no-treasury con tax_id blank bloquea. PersonaPicker puede
  // crear nuevo socio sin NIF/CIF; entry.holder queda truthy pero tax_id vacio
  // y la RPC falla con "socio tax_id is required" -> server rollback (review
  // Codex P2).
  for (const entry of draft.capTable) {
    if (!entry.is_treasury && entry.holder && (!entry.holder.tax_id || entry.holder.tax_id.trim() === "")) {
      issues.push(issue(
        "CT-008",
        `capTable.${entry.key}.holder.tax_id`,
        "El NIF/CIF del socio es obligatorio. Identificalo antes de seguir."
      ));
    }
  }

  const sociosNoTreasury = nonTreasury(draft.capTable).filter((entry) => entry.holder);
  const uniqueHolderKeys = new Set(sociosNoTreasury.map((entry) => entry.holder?.tax_id || entry.holder?.key));
  if (isUnipersonalTipo(draft.identification.tipo_social) && uniqueHolderKeys.size > 1) {
    issues.push(issue("CT-004", "capTable", "Una SAU/SLU no puede tener mas de un socio no autocartera."));
  }
  if (!isUnipersonalTipo(draft.identification.tipo_social) && !draft.profile.es_unipersonal && uniqueHolderKeys.size === 1) {
    issues.push(issue("CT-005", "capTable", "La cap table parece de socio unico; revisa si debe ser SAU/SLU.", "WARN"));
  }
  for (const entry of draft.capTable) {
    if (!entry.is_treasury && entry.voting_rights && entry.holder?.person_type === "PJ" && !entry.representante_junta) {
      issues.push(issue("P-001", `capTable.${entry.key}.representante_junta`, "PJ accionista con voto sin representante declarado.", "WARN"));
    }
  }

  if (!draft.organos.junta_enabled) {
    issues.push(issue("O-001", "organos.junta_enabled", "Debe existir Junta General o Socio Unico."));
  }
  if (isBlank(draft.profile.tipo_organo_admin)) {
    issues.push(issue("O-002", "profile.tipo_organo_admin", "Debe existir organo de administracion."));
  }

  if (draft.profile.tipo_organo_admin === "CDA") {
    const consejeros = draft.cargos.filter((cargo) =>
      ["CONSEJERO", "PRESIDENTE", "VICEPRESIDENTE", "CONSEJERO_COORDINADOR"].includes(cargo.tipo_condicion) && cargo.persona
    );
    if (consejeros.length === 0) {
      issues.push(issue("CA-001", "cargos", "El Consejo debe tener al menos un consejero."));
    }
    if (!hasCargo(draft.cargos, "PRESIDENTE") || !hasCargo(draft.cargos, "SECRETARIO")) {
      issues.push(issue("CA-002", "cargos", "El Consejo necesita presidente y secretario para certificaciones.", "BLOCK_OPERATIONAL"));
    }
  } else {
    const expected = adminCargoTiposForForma(draft);
    const matching = draft.cargos.filter((cargo) => expected.includes(cargo.tipo_condicion) && cargo.persona);
    if (matching.length === 0) {
      issues.push(issue("AU-001", "cargos", "La forma de administracion elegida requiere administrador inicial."));
    }
    // AU-002: las formas plurales (ADMIN_SOLIDARIOS, ADMIN_MANCOMUNADOS)
    // requieren minimo 2 administradores. Caso especialmente critico en
    // mancomunados porque el builder configura firmas_requeridas: 2 -> con
    // 1 solo admin la sociedad seria imposible de operar tras TX2 (review
    // Codex P2).
    const forma = draft.profile.forma_administracion;
    if ((forma === "ADMINISTRADORES_SOLIDARIOS" || forma === "ADMINISTRADORES_MANCOMUNADOS") && matching.length < 2) {
      issues.push(issue(
        "AU-002",
        "cargos",
        `La administracion ${forma === "ADMINISTRADORES_SOLIDARIOS" ? "solidaria" : "mancomunada"} requiere al menos 2 administradores.`
      ));
    }
  }

  for (const cargo of draft.cargos) {
    if (cargo.tipo_condicion === "ADMIN_PJ" && !cargo.persona?.representante) {
      issues.push(issue("PJ-001", `cargos.${cargo.key}.persona.representante`, "Administrador PJ requiere representante permanente PF."));
    }
  }

  const simple = num(draft.rules.mayoria_simple_pct);
  const reinforced = num(draft.rules.mayoria_reforzada_pct);
  if (draft.rules.mayoria_reforzada_pct && reinforced < simple) {
    issues.push(issue("R-001", "rules.mayoria_reforzada_pct", "La mayoria reforzada no puede ser inferior a la simple."));
  }
  if (!/^\d{2}-\d{2}$/.test(draft.registry.fiscal_year_close)) {
    issues.push(issue("R-002", "registry.fiscal_year_close", "El cierre fiscal debe tener formato DD-MM."));
  } else {
    const [day, month] = draft.registry.fiscal_year_close.split("-").map(Number);
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      issues.push(issue("R-002", "registry.fiscal_year_close", "El cierre fiscal debe ser una fecha DD-MM valida."));
    }
  }

  const blocking = issues.filter((item) => item.severity === "BLOCK");
  const blockingOperational = issues.filter((item) => item.severity === "BLOCK_OPERATIONAL");
  const warnings = issues.filter((item) => item.severity === "WARN");

  return {
    ok: blocking.length === 0,
    blocking,
    blockingOperational,
    warnings,
    derived: {
      totalTitles,
      holdingTitles,
      classTitles,
      sociosNoTreasury: uniqueHolderKeys.size,
    },
  };
}

export function validateStep(draft: SociedadOnboardingDraft, step: number): ValidationResult {
  const all = validateSociedadOperability(draft);
  const prefixesByStep: Record<number, string[]> = {
    0: ["S-001", "S-002", "S-003", "S-004"],
    1: ["S-005", "S-006", "R-002"],
    2: ["O-002", "CT-005"],
    3: ["C-001", "C-002", "C-003", "C-004"],
    4: ["CL-001", "CL-002", "CL-003", "CL-004"],
    5: ["CT-001", "CT-002", "CT-003", "CT-004", "CT-005", "CT-006", "CT-007", "CT-008", "CT-009", "CT-010", "P-001"],
    6: ["O-001", "O-002"],
    7: ["CA-001", "CA-002", "AU-001", "AU-002", "PJ-001"],
    8: ["R-001", "R-002"],
    9: [],
    10: [],
  };
  const codes = prefixesByStep[step] ?? [];
  const filter = (item: ValidationIssue) => codes.includes(item.code);
  const issues = [
    ...all.blocking.filter(filter),
    ...all.blockingOperational.filter(filter),
    ...all.warnings.filter(filter),
  ];
  return {
    ok: issues.every((item) => item.severity !== "BLOCK"),
    blocking: issues.filter((item) => item.severity === "BLOCK"),
    blockingOperational: issues.filter((item) => item.severity === "BLOCK_OPERATIONAL"),
    warnings: issues.filter((item) => item.severity === "WARN"),
    derived: all.derived,
  };
}
