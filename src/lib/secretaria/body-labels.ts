const BODY_TYPE_LABELS: Record<string, string> = {
  JUNTA: "Junta General",
  JUNTA_GENERAL: "Junta General",
  ASAMBLEA: "Junta General / Asamblea",
  CDA: "Consejo de Administración",
  CONSEJO: "Consejo de Administración",
  CONSEJO_ADMIN: "Consejo de Administración",
  CONSEJO_ADMINISTRACION: "Consejo de Administración",
  COMISION: "Comisión delegada",
  COMISION_DELEGADA: "Comisión delegada",
  COMITE: "Comité",
  ADMIN_UNICO: "Administrador único",
  ADMINISTRADOR_UNICO: "Administrador único",
  ADMIN_CONJUNTA: "Administradores mancomunados",
  ADMINISTRADORES_MANCOMUNADOS: "Administradores mancomunados",
  ADMIN_SOLIDARIOS: "Administradores solidarios",
  ADMINISTRADORES_SOLIDARIOS: "Administradores solidarios",
  SOCIO_UNICO: "Socio único",
};

export function normalizeBodyType(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? "";
}

export function bodyTypeLabel(value?: string | null) {
  const normalized = normalizeBodyType(value);
  if (!normalized) return "Órgano";
  return BODY_TYPE_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}

export function bodyOptionLabel(body: { name?: string | null; body_type?: string | null }) {
  const type = bodyTypeLabel(body.body_type);
  const name = body.name?.trim();
  if (!name || name.toLowerCase() === type.toLowerCase()) return type;
  return `${type} — ${name}`;
}
