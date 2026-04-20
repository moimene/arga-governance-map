import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShellLayout } from "@/components/shell/ShellLayout";
import { TourProvider } from "@/context/TourContext";
import { ScopeProvider } from "@/context/ScopeContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedShell } from "@/components/RequireAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/NotFound";
import Dashboard from "@/pages/Dashboard";
import GovernanceMap from "@/pages/GovernanceMap";
import EntidadesList from "@/pages/EntidadesList";
import EntidadDetalle from "@/pages/EntidadDetalle";
import OrganosList from "@/pages/OrganosList";
import OrganoDetalle from "@/pages/OrganoDetalle";
import ReunionDetalle from "@/pages/ReunionDetalle";
import PoliticasList from "@/pages/PoliticasList";
import PoliticaDetalle from "@/pages/PoliticaDetalle";
import ObligacionesList from "@/pages/ObligacionesList";
import ObligacionDetalle from "@/pages/ObligacionDetalle";
import DelegacionesList from "@/pages/DelegacionesList";
import DelegacionDetalle from "@/pages/DelegacionDetalle";
import HallazgosList from "@/pages/HallazgosList";
import HallazgoDetalle from "@/pages/HallazgoDetalle";
import ControlDetalle from "@/pages/ControlDetalle";
import Conflictos from "@/pages/Conflictos";
import SiiDashboard from "@/pages/sii/SiiDashboard";
import SiiCaseDetalle from "@/pages/sii/SiiCaseDetalle";
import { SiiLayout } from "@/pages/sii/SiiLayout";
import Login from "@/pages/Login";
import Documentacion from "@/pages/Documentacion";
import Notificaciones from "@/pages/Notificaciones";
import GrcDashboard from "@/pages/modules/GrcDashboard";
import AimsDashboard from "@/pages/modules/AimsDashboard";
import { RequireAuth } from "@/components/RequireAuth";

// ── Módulo Garrigues: Secretaría (lazy) ─────────────────────────────────────
const SecretariaLayout = lazy(() =>
  import("@/pages/secretaria/SecretariaLayout").then((m) => ({ default: m.SecretariaLayout }))
);
const SecretariaDashboard = lazy(() => import("@/pages/secretaria/Dashboard"));
const ConvocatoriasList = lazy(() => import("@/pages/secretaria/ConvocatoriasList"));
const ConvocatoriaDetalle = lazy(() => import("@/pages/secretaria/ConvocatoriaDetalle"));
const ConvocatoriasStepper = lazy(() => import("@/pages/secretaria/ConvocatoriasStepper"));
const ReunionesLista = lazy(() => import("@/pages/secretaria/ReunionesLista"));
const ReunionStepper = lazy(() => import("@/pages/secretaria/ReunionStepper"));
const ActasLista = lazy(() => import("@/pages/secretaria/ActasLista"));
const ActaDetalle = lazy(() => import("@/pages/secretaria/ActaDetalle"));
const TramitadorLista = lazy(() => import("@/pages/secretaria/TramitadorLista"));
const TramitadorStepper = lazy(() => import("@/pages/secretaria/TramitadorStepper"));
const AcuerdosSinSesion = lazy(() => import("@/pages/secretaria/AcuerdosSinSesion"));
const AcuerdoSinSesionStepper = lazy(() => import("@/pages/secretaria/AcuerdoSinSesionStepper"));
const ExpedienteSinSesionStepper = lazy(() => import("@/pages/secretaria/ExpedienteSinSesionStepper"));
const AcuerdoSinSesionDetalle = lazy(() => import("@/pages/secretaria/AcuerdoSinSesionDetalle"));
const DecisionesUnipersonales = lazy(() => import("@/pages/secretaria/DecisionesUnipersonales"));
const DecisionDetalle = lazy(() => import("@/pages/secretaria/DecisionDetalle"));
const LibrosObligatorios = lazy(() => import("@/pages/secretaria/LibrosObligatorios"));
const Plantillas = lazy(() => import("@/pages/secretaria/Plantillas"));
const PlantillasTracker = lazy(() => import("@/pages/secretaria/PlantillasTracker"));
const GestorPlantillas = lazy(() => import("@/pages/secretaria/GestorPlantillas"));
const Calendario = lazy(() => import("@/pages/secretaria/Calendario"));
const ExpedienteAcuerdo = lazy(() => import("@/pages/secretaria/ExpedienteAcuerdo"));
const GenerarDocumentoStepper = lazy(() => import("@/pages/secretaria/GenerarDocumentoStepper"));
const BoardPackPreview = lazy(() => import("@/pages/secretaria/BoardPackPreview"));
const BoardPack = lazy(() => import("@/pages/secretaria/BoardPack"));

// ── Módulo Garrigues: GRC Compass (lazy) ────────────────────────────────────
const GrcLayout = lazy(() =>
  import("@/pages/grc/GrcLayout").then((m) => ({ default: m.GrcLayout }))
);
const ModuleShell = lazy(() =>
  import("@/components/grc/ModuleShell").then((m) => ({ default: m.ModuleShell }))
);
const SectionRouter = lazy(() =>
  import("@/components/grc/SectionRouter").then((m) => ({ default: m.SectionRouter }))
);
const GrcDashboardPage = lazy(() => import("@/pages/grc/Dashboard"));
const Risk360 = lazy(() => import("@/pages/grc/Risk360"));
const PacksPage = lazy(() => import("@/pages/grc/PacksPage"));
const PackDetalle = lazy(() => import("@/pages/grc/PackDetalle"));
const IncidentesList = lazy(() => import("@/pages/grc/IncidentesList"));
const IncidenteStepper = lazy(() => import("@/pages/grc/IncidenteStepper"));
const IncidenteDetalle = lazy(() => import("@/pages/grc/IncidenteDetalle"));
const MyWork = lazy(() => import("@/pages/grc/MyWork"));
const Alertas = lazy(() => import("@/pages/grc/Alertas"));
const Excepciones = lazy(() => import("@/pages/grc/Excepciones"));
const ModuleDashboard = lazy(() => import("@/pages/grc/ModuleDashboard"));

// ── Módulo Garrigues: AI Governance (lazy) ──────────────────────────────────
const AiLayout = lazy(() =>
  import("@/pages/ai-governance/AiLayout").then((m) => ({ default: m.AiLayout }))
);
const AiDashboard = lazy(() => import("@/pages/ai-governance/Dashboard"));
const Sistemas = lazy(() => import("@/pages/ai-governance/Sistemas"));
const SistemaDetalle = lazy(() => import("@/pages/ai-governance/SistemaDetalle"));
const Evaluaciones = lazy(() => import("@/pages/ai-governance/Evaluaciones"));
const AiIncidentes = lazy(() => import("@/pages/ai-governance/Incidentes"));

// ── Fallback compartido para Suspense ────────────────────────────────────────
function ModuleFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--g-text-secondary)]">
      Cargando...
    </div>
  );
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScopeProvider>
            <TourProvider>
              <ErrorBoundary>
                <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/grc-old" element={<GrcDashboard />} />
                  <Route path="/aims" element={<AimsDashboard />} />
                  <Route path="/governance-map" element={<GovernanceMap />} />
                  <Route path="/entidades" element={<EntidadesList />} />
                  <Route path="/entidades/:id" element={<EntidadDetalle />} />
                  <Route path="/organos" element={<OrganosList />} />
                  <Route path="/organos/:id" element={<OrganoDetalle />} />
                  <Route path="/organos/:id/reuniones/:meetingId" element={<ReunionDetalle />} />
                  <Route path="/politicas" element={<PoliticasList />} />
                  <Route path="/politicas/:id" element={<PoliticaDetalle />} />
                  <Route path="/obligaciones" element={<ObligacionesList />} />
                  <Route path="/obligaciones/controles/:code" element={<ControlDetalle />} />
                  <Route path="/obligaciones/:id" element={<ObligacionDetalle />} />
                  <Route path="/delegaciones" element={<DelegacionesList />} />
                  <Route path="/delegaciones/:slug" element={<DelegacionDetalle />} />
                  <Route path="/hallazgos" element={<HallazgosList />} />
                  <Route path="/hallazgos/:id" element={<HallazgoDetalle />} />
                  <Route path="/conflictos" element={<Conflictos />} />
                  <Route element={<SiiLayout />}>
                    <Route path="/sii" element={<SiiDashboard />} />
                    <Route path="/sii/:id" element={<SiiCaseDetalle />} />
                  </Route>
                  <Route path="/documentacion" element={<Documentacion />} />
                  <Route path="/notificaciones" element={<Notificaciones />} />
                </Route>
                {/* Módulo Garrigues Secretaría — layout propio (sidebar verde) */}
                <Route
                  element={
                    <RequireAuth>
                      <Suspense fallback={<ModuleFallback />}>
                        <SecretariaLayout />
                      </Suspense>
                    </RequireAuth>
                  }
                >
                  <Route path="/secretaria" element={<Suspense fallback={<ModuleFallback />}><SecretariaDashboard /></Suspense>} />
                  <Route path="/secretaria/convocatorias" element={<Suspense fallback={<ModuleFallback />}><ConvocatoriasList /></Suspense>} />
                  <Route path="/secretaria/convocatorias/nueva" element={<Suspense fallback={<ModuleFallback />}><ConvocatoriasStepper /></Suspense>} />
                  <Route path="/secretaria/convocatorias/:id" element={<Suspense fallback={<ModuleFallback />}><ConvocatoriaDetalle /></Suspense>} />
                  <Route path="/secretaria/reuniones" element={<Suspense fallback={<ModuleFallback />}><ReunionesLista /></Suspense>} />
                  <Route path="/secretaria/reuniones/nueva" element={<Suspense fallback={<ModuleFallback />}><ReunionStepper /></Suspense>} />
                  <Route path="/secretaria/reuniones/:id" element={<Suspense fallback={<ModuleFallback />}><ReunionStepper /></Suspense>} />
                  <Route path="/secretaria/actas" element={<Suspense fallback={<ModuleFallback />}><ActasLista /></Suspense>} />
                  <Route path="/secretaria/actas/:id" element={<Suspense fallback={<ModuleFallback />}><ActaDetalle /></Suspense>} />
                  <Route path="/secretaria/tramitador" element={<Suspense fallback={<ModuleFallback />}><TramitadorLista /></Suspense>} />
                  <Route path="/secretaria/tramitador/nuevo" element={<Suspense fallback={<ModuleFallback />}><TramitadorStepper /></Suspense>} />
                  <Route path="/secretaria/tramitador/:id" element={<Suspense fallback={<ModuleFallback />}><TramitadorStepper /></Suspense>} />
                  <Route path="/secretaria/acuerdos-sin-sesion" element={<Suspense fallback={<ModuleFallback />}><AcuerdosSinSesion /></Suspense>} />
                  <Route path="/secretaria/acuerdos-sin-sesion/nuevo" element={<Suspense fallback={<ModuleFallback />}><AcuerdoSinSesionStepper /></Suspense>} />
                  <Route path="/secretaria/acuerdos-sin-sesion/expediente" element={<Suspense fallback={<ModuleFallback />}><ExpedienteSinSesionStepper /></Suspense>} />
                  <Route path="/secretaria/acuerdos-sin-sesion/:id" element={<Suspense fallback={<ModuleFallback />}><AcuerdoSinSesionDetalle /></Suspense>} />
                  <Route path="/secretaria/decisiones-unipersonales" element={<Suspense fallback={<ModuleFallback />}><DecisionesUnipersonales /></Suspense>} />
                  <Route path="/secretaria/decisiones-unipersonales/:id" element={<Suspense fallback={<ModuleFallback />}><DecisionDetalle /></Suspense>} />
                  <Route path="/secretaria/libros" element={<Suspense fallback={<ModuleFallback />}><LibrosObligatorios /></Suspense>} />
                  <Route path="/secretaria/plantillas" element={<Suspense fallback={<ModuleFallback />}><Plantillas /></Suspense>} />
                  <Route path="/secretaria/plantillas-tracker" element={<Suspense fallback={<ModuleFallback />}><PlantillasTracker /></Suspense>} />
                  <Route path="/secretaria/gestor-plantillas" element={<Suspense fallback={<ModuleFallback />}><GestorPlantillas /></Suspense>} />
                  <Route path="/secretaria/calendario" element={<Suspense fallback={<ModuleFallback />}><Calendario /></Suspense>} />
                  <Route path="/secretaria/acuerdos/:id" element={<Suspense fallback={<ModuleFallback />}><ExpedienteAcuerdo /></Suspense>} />
                  <Route path="/secretaria/acuerdos/:id/generar" element={<Suspense fallback={<ModuleFallback />}><GenerarDocumentoStepper /></Suspense>} />
                  <Route path="/secretaria/reuniones/:id/board-pack" element={<Suspense fallback={<ModuleFallback />}><BoardPackPreview /></Suspense>} />
                  <Route path="/secretaria/board-pack/:id" element={<Suspense fallback={<ModuleFallback />}><BoardPack /></Suspense>} />
                </Route>
                {/* Módulo Garrigues GRC Compass — layout propio (sidebar verde) */}
                <Route
                  element={
                    <RequireAuth>
                      <Suspense fallback={<ModuleFallback />}>
                        <GrcLayout />
                      </Suspense>
                    </RequireAuth>
                  }
                >
                  <Route path="/grc"                      element={<Suspense fallback={<ModuleFallback />}><GrcDashboardPage /></Suspense>} />
                  <Route path="/grc/risk-360"             element={<Suspense fallback={<ModuleFallback />}><Risk360 /></Suspense>} />
                  <Route path="/grc/packs"                element={<Suspense fallback={<ModuleFallback />}><PacksPage /></Suspense>} />
                  <Route path="/grc/packs/:countryCode"   element={<Suspense fallback={<ModuleFallback />}><PackDetalle /></Suspense>} />
                  <Route path="/grc/incidentes"           element={<Suspense fallback={<ModuleFallback />}><IncidentesList /></Suspense>} />
                  <Route path="/grc/incidentes/nuevo"     element={<Suspense fallback={<ModuleFallback />}><IncidenteStepper /></Suspense>} />
                  <Route path="/grc/incidentes/:id"       element={<Suspense fallback={<ModuleFallback />}><IncidenteDetalle /></Suspense>} />
                  <Route path="/grc/mywork"               element={<Suspense fallback={<ModuleFallback />}><MyWork /></Suspense>} />
                  <Route path="/grc/alertas"              element={<Suspense fallback={<ModuleFallback />}><Alertas /></Suspense>} />
                  <Route path="/grc/excepciones"          element={<Suspense fallback={<ModuleFallback />}><Excepciones /></Suspense>} />
                  <Route path="/grc/m/:moduleId" element={<Suspense fallback={<ModuleFallback />}><ModuleShell /></Suspense>}>
                    <Route index element={<Suspense fallback={<ModuleFallback />}><ModuleDashboard /></Suspense>} />
                    <Route path="dashboard" element={<Suspense fallback={<ModuleFallback />}><ModuleDashboard /></Suspense>} />
                    <Route path=":section/:viewKey" element={<Suspense fallback={<ModuleFallback />}><SectionRouter /></Suspense>} />
                  </Route>
                </Route>
                {/* Módulo Garrigues AI Governance — layout propio (sidebar verde) */}
                <Route
                  element={
                    <RequireAuth>
                      <Suspense fallback={<ModuleFallback />}>
                        <AiLayout />
                      </Suspense>
                    </RequireAuth>
                  }
                >
                  <Route path="/ai-governance"              element={<Suspense fallback={<ModuleFallback />}><AiDashboard /></Suspense>} />
                  <Route path="/ai-governance/sistemas"     element={<Suspense fallback={<ModuleFallback />}><Sistemas /></Suspense>} />
                  <Route path="/ai-governance/sistemas/:id" element={<Suspense fallback={<ModuleFallback />}><SistemaDetalle /></Suspense>} />
                  <Route path="/ai-governance/evaluaciones" element={<Suspense fallback={<ModuleFallback />}><Evaluaciones /></Suspense>} />
                  <Route path="/ai-governance/incidentes"   element={<Suspense fallback={<ModuleFallback />}><AiIncidentes /></Suspense>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </ErrorBoundary>
            </TourProvider>
          </ScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
