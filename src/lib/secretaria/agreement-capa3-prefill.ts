export interface PowerCapa3Prefill {
  apoderado_nombre?: string;
  facultades_poder?: string;
  limitaciones_poder?: string;
}

function cleanClause(value?: string | null) {
  return value?.trim().replace(/[.;,]+$/, "").trim() || undefined;
}

/**
 * Recupera campos estructurados de una decisión de apoderamiento ya adoptada.
 * Solo completa coincidencias explícitas; si el texto no contiene una cláusula
 * reconocible, el campo queda vacío para revisión humana.
 */
export function derivePowerCapa3Prefill(decisionText?: string | null): PowerCapa3Prefill {
  const text = decisionText?.trim() ?? "";
  if (!text) return {};

  const recipient = /\b(?:otorgar|conferir)\s+(?:poder(?:es)?\s+)?(?:a favor de|a)\s+([^,;\n]+)/i.exec(text)?.[1];
  const faculties = /\bpoderes?\s+(?:generales?\s+)?para\s+(.+?)(?=,\s+con\s+(?:los\s+)?l[ií]mites|,\s+sujet[oa]s?\b|;|\.\s*$)/i.exec(text)?.[1];
  const limitations = /\b(con\s+(?:los\s+)?l[ií]mites.+?)(?:\.\s*$|$)/i.exec(text)?.[1];

  return {
    apoderado_nombre: cleanClause(recipient),
    facultades_poder: cleanClause(faculties),
    limitaciones_poder: cleanClause(limitations),
  };
}
