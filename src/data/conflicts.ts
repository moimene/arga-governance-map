export interface Conflict {
  id: string;
  type: "PERMANENTE" | "SITUACIONAL";
  person: string;
  role: string;
  description: string;
  declaredDate: string | null;
  managedBy: string;
  status: string;
  abstentionRequired: boolean;
  notes: string;
  findingId?: string;
}

export const conflicts: Conflict[] = [
  { id: "CON-PER-001", type: "PERMANENTE", person: "D. Ricardo Vega Sanz", role: "Consejero Ejecutivo / Director Inversiones", description: "Accionista significativo de empresa inmobiliaria que cotiza en mercados donde ARGA Inversiones opera", declaredDate: "01/01/2025", managedBy: "Dña. Lucía Paredes Vega", status: "DECLARADO Y GESTIONADO", abstentionRequired: true, notes: "Abstención sistemática en decisiones de inversión inmobiliaria. Documentado en 4 actas." },
  { id: "CON-PER-002", type: "PERMANENTE", person: "Dña. Isabel Moreno Castro", role: "Consejera Dominical", description: "Miembro del consejo de administración de entidad bancaria que presta servicios a ARGA Seguros", declaredDate: "01/03/2024", managedBy: "Dña. Lucía Paredes Vega", status: "DECLARADO Y GESTIONADO", abstentionRequired: true, notes: "Abstención en decisiones de selección de entidades bancarias." },
  { id: "CON-PER-003", type: "PERMANENTE", person: "D. Fernando López Aguirre", role: "Presidente Comisión Auditoría", description: "Socio emérito de firma de consultoría que ha prestado servicios a ARGA en ejercicios anteriores (hasta 2022)", declaredDate: "01/01/2023", managedBy: "Dña. Lucía Paredes Vega", status: "DECLARADO Y GESTIONADO", abstentionRequired: false, notes: "Período de enfriamiento de 3 años aplicado. Sin abstención requerida desde 2025." },
  { id: "CON-PER-004", type: "PERMANENTE", person: "D. Pablo Navarro Iglesias", role: "Director Financiero (CFO)", description: "Cónyuge ejerce como directora financiera en empresa proveedora de soluciones actuariales", declaredDate: "01/09/2024", managedBy: "Dña. Lucía Paredes Vega", status: "DECLARADO Y GESTIONADO", abstentionRequired: true, notes: "Abstención en procesos de selección o renovación del proveedor." },
  { id: "CON-SIT-001", type: "SITUACIONAL", person: "D. Fernando López Aguirre", role: "Presidente Comisión Auditoría", description: "Interés personal indirecto en operación de arrendamiento de inmueble — familiar directo es propietario", declaredDate: "15/02/2026", managedBy: "Dña. Elena Navarro Pons", status: "DECLARADO — ABSTENCIÓN REGISTRADA", abstentionRequired: true, notes: "Abstención registrada en sesión Comisión Auditoría 20/02/2026. Acta certificada." },
  { id: "CON-SIT-002", type: "SITUACIONAL", person: "D. André Barbosa Lima", role: "CEO ARGA Brasil / Presidente Conselho", description: "Posible interés personal en operación de adquisición de inmueble comercial por ARGA Brasil — participación societaria directa en la entidad vendedora", declaredDate: null, managedBy: "D. Álvaro Mendoza Torres", status: "NO DECLARADO — EN INVESTIGACIÓN", abstentionRequired: true, notes: "Detectado por Auditoría Interna en revisión operación Q1 2026. Ver HALL-008.", findingId: "HALL-008" },
];

export interface RelatedPartyTransaction {
  id: string;
  title: string;
  type: string;
  amount: string;
  parties: string[];
  relatedPerson?: string;
  approvedBy: string;
  approvalDate: string | null;
  status: string;
  armLength: string;
  notes: string;
  findingId?: string;
}

export const relatedPartyTransactions: RelatedPartyTransaction[] = [
  { id: "OPV-001", title: "Préstamo intercompany ARGA Seguros → ARGA Brasil", type: "Financiación intergrupo", amount: "€45.000.000", parties: ["arga-seguros", "arga-brasil"], approvedBy: "Comité de Inversiones", approvalDate: "15/02/2026", status: "APROBADA", armLength: "Sí — tipo BCE + 0,75%", notes: "Financiación ordinaria. Condiciones de mercado verificadas por actuaría." },
  { id: "OPV-002", title: "Contrato de servicios TIC ARGA Digital → ARGA España", type: "Prestación de servicios intragrupo", amount: "€3.200.000/año", parties: ["arga-digital", "arga-espana"], approvedBy: "Consejo de Administración ARGA España", approvalDate: "01/01/2026", status: "APROBADA", armLength: "Sí — precio benchmarked con comparables externos", notes: "Contrato plurianual 2026-2028. Servicio de infraestructura cloud y soporte." },
  { id: "OPV-003", title: "Adquisición inmueble — Madrid (Salamanca)", type: "Adquisición activo", amount: "€12.500.000", parties: ["arga-inversiones"], relatedPerson: "D. Ricardo Vega Sanz (vendedor indirecto — sociedad participada)", approvedBy: "Pendiente — Comité de Inversiones", approvalDate: null, status: "EN REVISIÓN PRECIO", armLength: "En verificación — precio cuestionado por Auditoría Interna", notes: "Duda razonable sobre precio de mercado. D. Ricardo Vega se ha abstenido. Revisión por tasador independiente en curso.", findingId: "HALL-002" },
];

export interface Attestation {
  personId: string;
  status: "COMPLETADA" | "PENDIENTE";
  completedDate: string | null;
  conflicts: string | null;
  note?: string;
}

export const attestations2026: Attestation[] = [
  { personId: "lucia-paredes", status: "COMPLETADA", completedDate: "10/04/2026", conflicts: "Ninguno" },
  { personId: "antonio-rios", status: "COMPLETADA", completedDate: "08/04/2026", conflicts: "Ninguno" },
  { personId: "carmen-delgado", status: "COMPLETADA", completedDate: "09/04/2026", conflicts: "Ninguno" },
  { personId: "pablo-navarro", status: "COMPLETADA", completedDate: "11/04/2026", conflicts: "CON-PER-004 declarado" },
  { personId: "elena-navarro", status: "COMPLETADA", completedDate: "07/04/2026", conflicts: "Ninguno" },
  { personId: "alvaro-mendoza", status: "COMPLETADA", completedDate: "07/04/2026", conflicts: "Ninguno" },
  { personId: "sofia-herrera", status: "COMPLETADA", completedDate: "12/04/2026", conflicts: "Ninguno" },
  { personId: "javier-ruiz", status: "COMPLETADA", completedDate: "10/04/2026", conflicts: "Ninguno" },
  { personId: "maria-santos", status: "COMPLETADA", completedDate: "08/04/2026", conflicts: "Ninguno" },
  { personId: "fernando-lopez", status: "COMPLETADA", completedDate: "09/04/2026", conflicts: "CON-PER-003 / CON-SIT-001 declarados" },
  { personId: "isabel-moreno", status: "COMPLETADA", completedDate: "11/04/2026", conflicts: "CON-PER-002 declarado" },
  { personId: "ricardo-vega", status: "COMPLETADA", completedDate: "10/04/2026", conflicts: "CON-PER-001 declarado" },
  { personId: "pilar-castro", status: "COMPLETADA", completedDate: "12/04/2026", conflicts: "Ninguno" },
  { personId: "carlos-vaz", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "andre-barbosa", status: "PENDIENTE", completedDate: null, conflicts: null, note: "Pendiente — ver HALL-008" },
  { personId: "valentina-guzman", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "santiago-herrera", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "thomas-carter", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "elif-yilmaz", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "marco-bianchi", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "hans-muller", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "miguel-ortega", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "laura-fernandez", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "roberto-garcia", status: "PENDIENTE", completedDate: null, conflicts: null },
  { personId: "rodrigo-almeida", status: "PENDIENTE", completedDate: null, conflicts: null },
];
