export type Materiality = "Crítica" | "Alta" | "Media" | "Baja";
export type EntityStatus = "Activa" | "Inactiva";

export interface Entity {
  id: string;
  legalName: string;
  commonName: string;
  jurisdiction: string;
  legalForm: string;
  registrationNumber: string;
  parentEntityId: string | null;
  ownershipPercentage: number | null;
  status: EntityStatus;
  materiality: Materiality;
  secretary: string;
}

export const entities: Entity[] = [
  { id: "arga-seguros", legalName: "ARGA Seguros, S.A.", commonName: "ARGA Seguros", jurisdiction: "España", legalForm: "S.A.", registrationNumber: "A-28000001", parentEntityId: null, ownershipPercentage: null, status: "Activa", materiality: "Crítica", secretary: "Dña. Lucía Paredes Vega" },
  { id: "arga-espana", legalName: "ARGA España Seguros y Reaseguros, S.A.", commonName: "ARGA España", jurisdiction: "España", legalForm: "S.A.", registrationNumber: "A-28000002", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Crítica", secretary: "Dña. Lucía Paredes Vega" },
  { id: "arga-vida", legalName: "ARGA Vida y Pensiones, S.A.", commonName: "ARGA Vida", jurisdiction: "España", legalForm: "S.A.", registrationNumber: "A-28000003", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Alta", secretary: "D. Javier Ruiz Montero" },
  { id: "arga-salud", legalName: "ARGA Salud, S.A.", commonName: "ARGA Salud", jurisdiction: "España", legalForm: "S.A.", registrationNumber: "A-28000004", parentEntityId: "arga-espana", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Javier Ruiz Montero" },
  { id: "arga-reaseguros", legalName: "ARGA Reaseguros, S.A.", commonName: "ARGA RE", jurisdiction: "España", legalForm: "S.A.", registrationNumber: "A-28000005", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Alta", secretary: "Dña. Lucía Paredes Vega" },
  { id: "arga-latam", legalName: "ARGA LATAM Holdings, S.L.", commonName: "ARGA LATAM", jurisdiction: "España", legalForm: "S.L.", registrationNumber: "B-28000006", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Carlos Eduardo Vaz" },
  { id: "arga-asistencia", legalName: "ARGA Asistencia, S.A.", commonName: "ARGA Asistencia", jurisdiction: "España", legalForm: "S.A.", registrationNumber: "A-28000007", parentEntityId: "arga-espana", ownershipPercentage: 100, status: "Activa", materiality: "Baja", secretary: "D. Javier Ruiz Montero" },
  { id: "arga-digital", legalName: "ARGA Digital Services, S.L.", commonName: "ARGA Digital", jurisdiction: "España", legalForm: "S.L.", registrationNumber: "B-28000008", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Baja", secretary: "D. Javier Ruiz Montero" },
  { id: "arga-inversiones", legalName: "ARGA Inversiones, SICAV", commonName: "ARGA Inversiones", jurisdiction: "España", legalForm: "SICAV", registrationNumber: "A-28000009", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Javier Ruiz Montero" },
  { id: "arga-fundacion", legalName: "Fundación ARGA", commonName: "Fundación ARGA", jurisdiction: "España", legalForm: "Fundación", registrationNumber: "G-28000010", parentEntityId: "arga-seguros", ownershipPercentage: null, status: "Activa", materiality: "Baja", secretary: "Dña. Lucía Paredes Vega" },
  { id: "arga-brasil", legalName: "ARGA Brasil Seguros S.A.", commonName: "ARGA Brasil", jurisdiction: "Brasil", legalForm: "S.A.", registrationNumber: "BR-33000001", parentEntityId: "arga-latam", ownershipPercentage: 100, status: "Activa", materiality: "Crítica", secretary: "D. André Barbosa Lima" },
  { id: "arga-mexico", legalName: "ARGA México Seguros, S.A. de C.V.", commonName: "ARGA México", jurisdiction: "México", legalForm: "S.A. de C.V.", registrationNumber: "MX-09000001", parentEntityId: "arga-latam", ownershipPercentage: 100, status: "Activa", materiality: "Alta", secretary: "Dña. Valentina Guzmán" },
  { id: "arga-colombia", legalName: "ARGA Colombia Seguros, S.A.", commonName: "ARGA Colombia", jurisdiction: "Colombia", legalForm: "S.A.", registrationNumber: "CO-11000001", parentEntityId: "arga-latam", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Santiago Herrera" },
  { id: "arga-peru", legalName: "ARGA Perú Compañía de Seguros, S.A.", commonName: "ARGA Perú", jurisdiction: "Perú", legalForm: "S.A.", registrationNumber: "PE-15000001", parentEntityId: "arga-latam", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Santiago Herrera" },
  { id: "arga-argentina", legalName: "ARGA Argentina Seguros, S.A.", commonName: "ARGA Argentina", jurisdiction: "Argentina", legalForm: "S.A.", registrationNumber: "AR-BA000001", parentEntityId: "arga-latam", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Carlos Eduardo Vaz" },
  { id: "arga-chile", legalName: "ARGA Chile Seguros Generales, S.A.", commonName: "ARGA Chile", jurisdiction: "Chile", legalForm: "S.A.", registrationNumber: "CL-RM000001", parentEntityId: "arga-latam", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Santiago Herrera" },
  { id: "arga-usa", legalName: "ARGA USA Insurance Company", commonName: "ARGA USA", jurisdiction: "EE.UU.", legalForm: "Corporation", registrationNumber: "US-DE000001", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Alta", secretary: "D. Thomas Carter" },
  { id: "arga-turquia", legalName: "ARGA Turquía Sigorta A.Ş.", commonName: "ARGA Turquía", jurisdiction: "Turquía", legalForm: "A.Ş.", registrationNumber: "TR-34000001", parentEntityId: "arga-seguros", ownershipPercentage: 80, status: "Activa", materiality: "Alta", secretary: "Dña. Elif Yılmaz" },
  { id: "arga-italia", legalName: "ARGA Italia Assicurazioni S.p.A.", commonName: "ARGA Italia", jurisdiction: "Italia", legalForm: "S.p.A.", registrationNumber: "IT-MI000001", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Marco Bianchi" },
  { id: "arga-portugal", legalName: "ARGA Portugal Seguros, S.A.", commonName: "ARGA Portugal", jurisdiction: "Portugal", legalForm: "S.A.", registrationNumber: "PT-LX000001", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Marco Bianchi" },
  { id: "arga-alemania", legalName: "ARGA Alemania Versicherung AG", commonName: "ARGA Alemania", jurisdiction: "Alemania", legalForm: "AG", registrationNumber: "DE-HRB00001", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Hans Müller" },
  { id: "arga-global-re", legalName: "ARGA Global RE S.A.", commonName: "ARGA Global RE", jurisdiction: "Luxemburgo", legalForm: "S.A.", registrationNumber: "LU-B000001", parentEntityId: "arga-reaseguros", ownershipPercentage: 100, status: "Activa", materiality: "Media", secretary: "D. Hans Müller" },
  { id: "arga-malta", legalName: "ARGA Malta Insurance Ltd.", commonName: "ARGA Malta", jurisdiction: "Malta", legalForm: "Ltd.", registrationNumber: "MT-C00001", parentEntityId: "arga-seguros", ownershipPercentage: 100, status: "Activa", materiality: "Baja", secretary: "D. Marco Bianchi" },
  { id: "arga-indonesia", legalName: "ARGA Indonesia Asuransi PT", commonName: "ARGA Indonesia", jurisdiction: "Indonesia", legalForm: "PT", registrationNumber: "ID-JK000001", parentEntityId: "arga-seguros", ownershipPercentage: 80, status: "Activa", materiality: "Baja", secretary: "Dña. Elif Yılmaz" },
  { id: "arga-filipinas", legalName: "ARGA Filipinas Insurance Inc.", commonName: "ARGA Filipinas", jurisdiction: "Filipinas", legalForm: "Inc.", registrationNumber: "PH-MN000001", parentEntityId: "arga-seguros", ownershipPercentage: 80, status: "Activa", materiality: "Baja", secretary: "Dña. Elif Yılmaz" },
];

export const getEntityById = (id: string) => entities.find((e) => e.id === id);
export const getChildren = (parentId: string) => entities.filter((e) => e.parentEntityId === parentId);
