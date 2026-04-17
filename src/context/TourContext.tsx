import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export interface TourStep {
  route: string;
  title: string;
  description: string;
  bullets: string[];
  available: boolean;
}

export const tourSteps: TourStep[] = [
  {
    route: "/",
    title: "Tu centro de control de gobernanza",
    description:
      "El Dashboard te da una visión operativa inmediata de todo lo que requiere tu atención. KPIs, alertas críticas, próximas reuniones y tareas personales — todo respetando tu ámbito de acceso.",
    bullets: [
      "5 KPIs con drill-down: cada número te lleva al detalle.",
      "Alertas críticas: el hallazgo HALL-008 requiere atención inmediata.",
      "Agenda: la reunión del CdA del 22/04 tiene 2 confirmaciones pendientes.",
    ],
    available: true,
  },
  {
    route: "/governance-map",
    title: "La red de relaciones de tu gobierno corporativo",
    description:
      "El Governance Map muestra cómo se conectan entidades, órganos, personas, normas y hallazgos. No es un organigrama: es un grafo de relaciones que permite navegar y descubrir dependencias.",
    bullets: [
      "El nodo rojo de HALL-008 conectado a ARGA Brasil y D. André Barbosa.",
      "La arista roja punteada: OBL-DORA-003 no tiene control asignado.",
      "Haz clic en cualquier nodo para ver su panel de detalle.",
    ],
    available: true,
  },
  {
    route: "/entidades/arga-seguros",
    title: "Cada entidad, una fuente única de verdad",
    description:
      "La ficha de entidad centraliza datos legales, relaciones societarias, normativa aplicable, delegaciones vigentes y hallazgos. Desde aquí puedes navegar a cualquier objeto relacionado.",
    bullets: [
      "Badges de materialidad y estado siempre visibles.",
      "Tab Relaciones: árbol societario con porcentajes de participación.",
      "Tab Normativa: las 25 políticas aplicables con sus estados.",
    ],
    available: true,
  },
  {
    route: "/organos/consejo-administracion",
    title: "El órgano de gobierno en tiempo real",
    description:
      "La ficha de órgano centraliza composición, mandatos, calendario y el reglamento de régimen interno. Cada reunión tiene su propio expediente con agenda, materiales, votaciones y acta inmutable.",
    bullets: [
      "Banner ámbar: 4 mandatos vencidos o próximos a vencer — acción preventiva necesaria.",
      "Reunión 22/04/2026: PR-008 (DORA) en el punto 3 de la agenda — pendiente de aprobación del Consejo.",
      "Tab Reglamento: REG-001 aprobado por la Junta General el 15/01/2024 — texto íntegro en acordeón.",
    ],
    available: true,
  },
  {
    route: "/organos/consejo-administracion/reuniones/cda-22-04-2026",
    title: "El expediente de reunión completo",
    description:
      "Cada reunión tiene su ciclo de vida: desde la convocatoria hasta el acta firmada e inmutable. El expediente incluye agenda, materiales, confirmaciones, votaciones y acuerdos.",
    bullets: [
      "Punto 3 de la agenda: PR-008 destaca en ámbar — es el punto crítico de esta sesión.",
      "Tab Participantes: 2 consejeros aún no han confirmado — quórum en riesgo si no confirman.",
      "Tabs Votaciones y Acuerdos vacías: se rellenan durante y tras la sesión.",
    ],
    available: true,
  },
  {
    route: "/politicas/PR-008",
    title: "La política como objeto vivo con ciclo de vida",
    description:
      "Una política en TGMS no es un PDF estático: tiene ciclo de vida completo con 7 estados, historial de versiones y trazabilidad directa a las obligaciones y controles que activa.",
    bullets: [
      "WorkflowStepper: PR-008 está en paso 5 de 7 — pendiente del CdA del 22/04/2026.",
      "Tab Aplicabilidad: 25 entidades del grupo con ARGA Turquía marcada con excepción vencida ⚠.",
      "Tab Obligaciones vinculadas: OBL-DORA-003 sin cobertura — el eslabón débil de la cadena.",
    ],
    available: true,
  },
  {
    route: "/obligaciones",
    title: "La cadena norma → obligación → control → evidencia",
    description:
      "TGMS no gestiona documentos, gestiona trazabilidad. Una política activa obligaciones, cada obligación tiene controles asignados, y cada control requiere evidencias validadas. Cuando un eslabón falta, el sistema lo detecta y genera un hallazgo.",
    bullets: [
      "Banner rojo: OBL-DORA-003 sin ningún control asignado — la cadena está rota.",
      "Agrupación por marco normativo: DORA vs Solvencia II visualmente diferenciados.",
      "OBL-SOL-004 en remediación: CTR-004 tiene evidencias rechazadas — vinculado a HALL-001.",
    ],
    available: true,
  },
  {
    route: "/delegaciones",
    title: "El poder de actuar: quién, cuánto y hasta cuándo",
    description:
      "Las delegaciones registran quién tiene poderes de representación, con qué límites y por cuánto tiempo. TGMS genera alertas automáticas T-90, T-60 y T-30 antes del vencimiento. Si no se actúa, el sistema registra la caducidad y crea un hallazgo.",
    bullets: [
      "Banner rojo: D. Carlos Vaz — delegación caducada sin revocación formal. Las 3 alertas previas fueron ignoradas.",
      "Columna de vencimiento: D. Rodrigo Almeida y D. Ignacio Fuentes vencen en <90 días — acción preventiva en curso.",
      "Las delegaciones revocadas se conservan con su historial completo para el registro inmutable.",
    ],
    available: true,
  },
  { route: "/hallazgos", title: "Hallazgos y Acciones", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
  { route: "/conflictos", title: "Conflictos e Integridad", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
  { route: "/sii", title: "SII — Canal Interno", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
];

interface TourContextValue {
  step: number; // 0 = inactive, 1..N = active step
  start: () => void;
  next: () => void;
  prev: () => void;
  close: () => void;
  total: number;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

const STORAGE_KEY = "tgms.tour.step";

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number>(() => {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    return v ? Number(v) : 0;
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(step));
  }, [step]);

  const goTo = (s: number) => {
    setStep(s);
    if (s > 0 && s <= tourSteps.length) {
      navigate(tourSteps[s - 1].route);
    }
  };

  return (
    <TourContext.Provider
      value={{
        step,
        total: tourSteps.length,
        start: () => goTo(1),
        next: () => goTo(Math.min(step + 1, tourSteps.length)),
        prev: () => goTo(Math.max(step - 1, 1)),
        close: () => setStep(0),
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
}
