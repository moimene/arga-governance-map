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
import { SecretariaLayout } from "@/pages/secretaria/SecretariaLayout";
import SecretariaDashboard from "@/pages/secretaria/Dashboard";
import ConvocatoriasList from "@/pages/secretaria/ConvocatoriasList";
import ConvocatoriaDetalle from "@/pages/secretaria/ConvocatoriaDetalle";
import ConvocatoriasStepper from "@/pages/secretaria/ConvocatoriasStepper";
import ReunionesLista from "@/pages/secretaria/ReunionesLista";
import ReunionStepper from "@/pages/secretaria/ReunionStepper";
import ActasLista from "@/pages/secretaria/ActasLista";
import ActaDetalle from "@/pages/secretaria/ActaDetalle";
import TramitadorLista from "@/pages/secretaria/TramitadorLista";
import TramitadorStepper from "@/pages/secretaria/TramitadorStepper";
import AcuerdosSinSesion from "@/pages/secretaria/AcuerdosSinSesion";
import AcuerdoSinSesionStepper from "@/pages/secretaria/AcuerdoSinSesionStepper";
import AcuerdoSinSesionDetalle from "@/pages/secretaria/AcuerdoSinSesionDetalle";
import DecisionesUnipersonales from "@/pages/secretaria/DecisionesUnipersonales";
import DecisionDetalle from "@/pages/secretaria/DecisionDetalle";
import LibrosObligatorios from "@/pages/secretaria/LibrosObligatorios";
import Plantillas from "@/pages/secretaria/Plantillas";
import ExpedienteAcuerdo from "@/pages/secretaria/ExpedienteAcuerdo";
import { RequireAuth } from "@/components/RequireAuth";

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
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<ProtectedShell />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/grc" element={<GrcDashboard />} />
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
                      <SecretariaLayout />
                    </RequireAuth>
                  }
                >
                  <Route path="/secretaria" element={<SecretariaDashboard />} />
                  <Route path="/secretaria/convocatorias" element={<ConvocatoriasList />} />
                  <Route path="/secretaria/convocatorias/nueva" element={<ConvocatoriasStepper />} />
                  <Route path="/secretaria/convocatorias/:id" element={<ConvocatoriaDetalle />} />
                  <Route path="/secretaria/reuniones" element={<ReunionesLista />} />
                  <Route path="/secretaria/reuniones/:id" element={<ReunionStepper />} />
                  <Route path="/secretaria/actas" element={<ActasLista />} />
                  <Route path="/secretaria/actas/:id" element={<ActaDetalle />} />
                  <Route path="/secretaria/tramitador" element={<TramitadorLista />} />
                  <Route path="/secretaria/tramitador/nuevo" element={<TramitadorStepper />} />
                  <Route path="/secretaria/tramitador/:id" element={<TramitadorStepper />} />
                  <Route path="/secretaria/acuerdos-sin-sesion" element={<AcuerdosSinSesion />} />
                  <Route path="/secretaria/acuerdos-sin-sesion/nuevo" element={<AcuerdoSinSesionStepper />} />
                  <Route path="/secretaria/acuerdos-sin-sesion/:id" element={<AcuerdoSinSesionDetalle />} />
                  <Route path="/secretaria/decisiones-unipersonales" element={<DecisionesUnipersonales />} />
                  <Route path="/secretaria/decisiones-unipersonales/:id" element={<DecisionDetalle />} />
                  <Route path="/secretaria/libros" element={<LibrosObligatorios />} />
                  <Route path="/secretaria/plantillas" element={<Plantillas />} />
                  <Route path="/secretaria/acuerdos/:id" element={<ExpedienteAcuerdo />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </TourProvider>
          </ScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
