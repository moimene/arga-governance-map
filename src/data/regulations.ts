export interface RegulationSection {
  title: string;
  body: string;
}

export interface Regulation {
  id: string;
  title: string;
  bodyId: string;
  approvedBy: string;
  approvalDate: string;
  version: string;
  status: "VIGENTE" | "EN REVISIÓN" | "ARCHIVADO";
  sections: RegulationSection[];
}

export const regulations: Regulation[] = [
  {
    id: "REG-001",
    title: "Reglamento del Consejo de Administración",
    bodyId: "consejo-administracion",
    approvedBy: "Junta General de Accionistas",
    approvalDate: "15/01/2024",
    version: "3.2",
    status: "VIGENTE",
    sections: [
      { title: "Composición y nombramiento", body: "El Consejo estará integrado por un mínimo de 5 y un máximo de 15 consejeros, designados por la Junta General de Accionistas a propuesta de la Comisión de Nombramientos y Retribuciones, atendiendo a criterios de diversidad, idoneidad técnica y experiencia sectorial." },
      { title: "Funciones y competencias", body: "Corresponde al Consejo la supervisión y control de la gestión del Grupo, la aprobación del plan estratégico, los presupuestos anuales, la política de riesgos, las operaciones de inversión significativas y cualquier acuerdo cuya competencia no haya sido expresamente delegada." },
      { title: "Convocatoria y celebración de sesiones", body: "El Consejo se reunirá con la frecuencia que requieran los negocios sociales y, como mínimo, una vez al mes. La convocatoria se realizará con antelación mínima de cinco días naturales, salvo casos de urgencia debidamente justificados por el Presidente." },
      { title: "Adopción de acuerdos y votaciones", body: "Los acuerdos del Consejo se adoptarán por mayoría absoluta de los consejeros concurrentes, salvo en aquellas materias para las que la ley o estos Estatutos exijan mayoría reforzada. El voto del Presidente dirimirá los empates." },
      { title: "Delegación de funciones", body: "El Consejo podrá delegar sus facultades en la Comisión Ejecutiva, en uno o varios consejeros delegados o en comisiones específicas, salvo aquellas materias indelegables conforme a la legislación vigente." },
      { title: "Conflictos de interés", body: "Los consejeros deberán abstenerse de participar en la deliberación y votación de acuerdos en los que tengan un conflicto de interés directo o indirecto, debiendo comunicarlo de forma inmediata al Presidente y al Secretario." },
      { title: "Información y transparencia", body: "Los consejeros tienen derecho a obtener la información necesaria para el adecuado ejercicio de sus funciones. La Secretaría del Consejo garantizará la disponibilidad de materiales con antelación suficiente a cada sesión." },
      { title: "Comisiones delegadas", body: "El Consejo constituirá una Comisión de Auditoría y Cumplimiento, una Comisión de Nombramientos y Retribuciones y una Comisión de Riesgos, integradas mayoritariamente por consejeros independientes y con funciones específicas reguladas en sus respectivos reglamentos." },
    ],
  },
  { id: "REG-002", title: "Reglamento de la Comisión de Auditoría", bodyId: "comision-auditoria", approvedBy: "Consejo de Administración", approvalDate: "20/01/2024", version: "2.1", status: "VIGENTE", sections: [] },
  { id: "REG-003", title: "Reglamento de la Comisión de Nombramientos y Retribuciones", bodyId: "comision-nombramientos", approvedBy: "Consejo de Administración", approvalDate: "20/01/2024", version: "2.0", status: "VIGENTE", sections: [] },
  { id: "REG-004", title: "Reglamento de la Comisión de Riesgos", bodyId: "comision-riesgos", approvedBy: "Consejo de Administración", approvalDate: "22/01/2024", version: "1.4", status: "VIGENTE", sections: [] },
  { id: "REG-005", title: "Reglamento del Comité de Inversiones", bodyId: "comite-inversiones", approvedBy: "Consejo de Administración", approvalDate: "01/03/2024", version: "2.3", status: "VIGENTE", sections: [] },
  { id: "REG-006", title: "Reglamento de la Junta General de Accionistas", bodyId: "jga", approvedBy: "Junta General de Accionistas", approvalDate: "15/06/2023", version: "4.0", status: "VIGENTE", sections: [] },
  { id: "REG-007", title: "Reglamento del Consejo de Administración ARGA España", bodyId: "cda-espana", approvedBy: "Consejo ARGA España", approvalDate: "10/02/2024", version: "1.5", status: "VIGENTE", sections: [] },
  { id: "REG-008", title: "Regulamento do Conselho de Administração ARGA Brasil", bodyId: "conselho-brasil", approvedBy: "Assembleia Geral", approvalDate: "15/03/2024", version: "1.2", status: "VIGENTE", sections: [] },
  { id: "REG-009", title: "Reglamento del Comité de Dirección del Grupo", bodyId: "comite-direccion", approvedBy: "Consejo de Administración", approvalDate: "01/06/2024", version: "1.0", status: "VIGENTE", sections: [] },
  { id: "REG-010", title: "Reglamento del Comité Regional LATAM", bodyId: "comite-latam", approvedBy: "Consejo de Administración", approvalDate: "01/09/2024", version: "1.1", status: "VIGENTE", sections: [] },
];

export function getRegulationById(id: string): Regulation | undefined {
  return regulations.find((r) => r.id === id);
}
