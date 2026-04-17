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
  { route: "/organos", title: "Órganos y Reuniones", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
  { route: "/politicas", title: "Políticas y Normativa", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
  { route: "/obligaciones", title: "Obligaciones y Controles", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
  { route: "/delegaciones", title: "Delegaciones y Poderes", description: "Próximamente — se habilita en la siguiente iteración del sistema.", bullets: [], available: false },
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
