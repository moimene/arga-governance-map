const make = (name: string) => () => (
  <div>
    <h1 className="text-2xl font-bold">{name}</h1>
  </div>
);

export const Dashboard = make("Dashboard");
export const GovernanceMap = make("Governance Map");
export const EntidadesList = make("Entidades");
export const EntityDetail = make("Entity Detail");
export const OrganosList = make("Órganos");
export const OrganoDetail = make("Órgano Detail");
export const MeetingDetail = make("Meeting Detail");
export const PoliticasList = make("Políticas");
export const PoliticaDetail = make("Política Detail");
export const ObligacionesList = make("Obligaciones");
export const ObligacionDetail = make("Obligación Detail");
export const DelegacionesList = make("Delegaciones");
export const DelegacionDetail = make("Delegación Detail");
export const HallazgosList = make("Hallazgos");
export const HallazgoDetail = make("Hallazgo Detail");
export const Conflictos = make("Conflictos");
export const SII = make("SII");
export const Documentacion = make("Documentación");
