export interface Person {
  id: string;
  name: string;
  role: string;
  entity: string;
  department: string;
}

export const people: Person[] = [
  { id: "lucia-paredes", name: "Dña. Lucía Paredes Vega", role: "Secretaria General del Grupo", entity: "ARGA Seguros, S.A.", department: "Secretaría General" },
  { id: "antonio-rios", name: "D. Antonio Ríos Valverde", role: "Presidente del Consejo", entity: "ARGA Seguros, S.A.", department: "Consejo" },
  { id: "carmen-delgado", name: "Dña. Carmen Delgado Ortiz", role: "Consejera Delegada (CEO)", entity: "ARGA Seguros, S.A.", department: "Dirección General" },
  { id: "pablo-navarro", name: "D. Pablo Navarro Iglesias", role: "Director Financiero (CFO)", entity: "ARGA Seguros, S.A.", department: "Finanzas" },
  { id: "elena-navarro", name: "Dña. Elena Navarro Pons", role: "Directora de Cumplimiento / Investigadora SII", entity: "ARGA Seguros, S.A.", department: "Cumplimiento" },
  { id: "alvaro-mendoza", name: "D. Álvaro Mendoza Torres", role: "Director de Auditoría Interna", entity: "ARGA Seguros, S.A.", department: "Auditoría Interna" },
  { id: "sofia-herrera", name: "Dña. Sofía Herrera Ramos", role: "Directora de Riesgos (CRO)", entity: "ARGA Seguros, S.A.", department: "Riesgos" },
  { id: "javier-ruiz", name: "D. Javier Ruiz Montero", role: "Secretario Adjunto / Secretario local España", entity: "ARGA España", department: "Secretaría" },
  { id: "maria-santos", name: "Dña. María Santos Gil", role: "Consejera Independiente", entity: "ARGA Seguros, S.A.", department: "Consejo" },
  { id: "fernando-lopez", name: "D. Fernando López Aguirre", role: "Consejero Independiente / Pte. Comisión Auditoría", entity: "ARGA Seguros, S.A.", department: "Consejo" },
  { id: "isabel-moreno", name: "Dña. Isabel Moreno Castro", role: "Consejera Dominical", entity: "ARGA Seguros, S.A.", department: "Consejo" },
  { id: "ricardo-vega", name: "D. Ricardo Vega Sanz", role: "Consejero Ejecutivo / Director Inversiones", entity: "ARGA Seguros, S.A.", department: "Inversiones" },
  { id: "carlos-vaz", name: "D. Carlos Eduardo Vaz", role: "Director Regional LATAM / Apoderado", entity: "ARGA LATAM Holdings", department: "Regional LATAM" },
  { id: "andre-barbosa", name: "D. André Barbosa Lima", role: "CEO ARGA Brasil / Presidente Conselho", entity: "ARGA Brasil Seguros S.A.", department: "Dirección Brasil" },
  { id: "valentina-guzman", name: "Dña. Valentina Guzmán Reyes", role: "CEO ARGA México", entity: "ARGA México Seguros", department: "Dirección México" },
  { id: "santiago-herrera", name: "D. Santiago Herrera Muñoz", role: "Director Regional Andina", entity: "ARGA Colombia Seguros", department: "Regional Andina" },
  { id: "thomas-carter", name: "D. Thomas Carter", role: "CEO ARGA USA", entity: "ARGA USA Insurance Company", department: "Dirección USA" },
  { id: "elif-yilmaz", name: "Dña. Elif Yılmaz", role: "CEO ARGA Turquía", entity: "ARGA Turquía Sigorta", department: "Dirección Turquía" },
  { id: "marco-bianchi", name: "D. Marco Bianchi", role: "Director Regional Europa", entity: "ARGA Italia", department: "Regional Europa" },
  { id: "hans-muller", name: "D. Hans Müller", role: "Director ARGA Alemania", entity: "ARGA Alemania Versicherung", department: "Dirección Alemania" },
  { id: "pilar-castro", name: "Dña. Pilar Castro Romero", role: "Directora de Sostenibilidad (ESG)", entity: "ARGA Seguros, S.A.", department: "Sostenibilidad" },
  { id: "miguel-ortega", name: "D. Miguel Ortega Sánchez", role: "Director Jurídico", entity: "ARGA Seguros, S.A.", department: "Legal" },
  { id: "laura-fernandez", name: "Dña. Laura Fernández Díaz", role: "Actuaria Jefe", entity: "ARGA Seguros, S.A.", department: "Actuarial" },
  { id: "roberto-garcia", name: "D. Roberto García Prieto", role: "CIO / Director Tecnología", entity: "ARGA Digital Services", department: "Tecnología" },
  { id: "rodrigo-almeida", name: "D. Rodrigo Almeida Ferreira", role: "Director Financiero LATAM / Apoderado", entity: "ARGA LATAM Holdings", department: "Finanzas LATAM" },
];
