import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScopeProvider } from "@/context/ScopeContext";
import { TourProvider } from "@/context/TourContext";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { AppLayout } from "@/components/shell/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GovernanceMap from "./pages/GovernanceMap";
import EntidadesList from "./pages/EntidadesList";
import EntidadDetalle from "./pages/EntidadDetalle";
import Documentacion from "./pages/Documentacion";
import OrganosList from "./pages/OrganosList";
import OrganoDetalle from "./pages/OrganoDetalle";
import ReunionDetalle from "./pages/ReunionDetalle";
import PoliticasList from "./pages/PoliticasList";
import PoliticaDetalle from "./pages/PoliticaDetalle";
import ObligacionesList from "./pages/ObligacionesList";
import ObligacionDetalle from "./pages/ObligacionDetalle";
import ControlDetalle from "./pages/ControlDetalle";
import DelegacionesList from "./pages/DelegacionesList";
import DelegacionDetalle from "./pages/DelegacionDetalle";
import HallazgosList from "./pages/HallazgosList";
import HallazgoDetalle from "./pages/HallazgoDetalle";
import Conflictos from "./pages/Conflictos";
import { SiiLayout } from "./pages/sii/SiiLayout";
import SiiDashboard from "./pages/sii/SiiDashboard";
import SiiCaseDetalle from "./pages/sii/SiiCaseDetalle";
import { Admin, Dashboards } from "./pages/Placeholders";
import Esg from "./pages/Esg";
import NotFound from "./pages/NotFound.tsx";

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
                <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/governance-map" element={<GovernanceMap />} />
                  <Route path="/entidades" element={<EntidadesList />} />
                  <Route path="/entidades/:id" element={<EntidadDetalle />} />
                  <Route path="/organos" element={<OrganosList />} />
                  <Route path="/organos/:id" element={<OrganoDetalle />} />
                  <Route path="/organos/:id/reuniones/:meetingId" element={<ReunionDetalle />} />
                  <Route path="/politicas" element={<PoliticasList />} />
                  <Route path="/politicas/:code" element={<PoliticaDetalle />} />
                  <Route path="/obligaciones" element={<ObligacionesList />} />
                  <Route path="/obligaciones/controles/:id" element={<ControlDetalle />} />
                  <Route path="/obligaciones/:id" element={<ObligacionDetalle />} />
                  <Route path="/delegaciones" element={<DelegacionesList />} />
                  <Route path="/delegaciones/:id" element={<DelegacionDetalle />} />
                  <Route path="/hallazgos" element={<HallazgosList />} />
                  <Route path="/hallazgos/:id" element={<HallazgoDetalle />} />
                  <Route path="/conflictos" element={<Conflictos />} />
                  <Route path="/esg" element={<Esg />} />
                  <Route path="/dashboards" element={<Dashboards />} />
                  <Route path="/sii" element={<SiiLayout />}>
                    <Route index element={<SiiDashboard />} />
                    <Route path=":id" element={<SiiCaseDetalle />} />
                  </Route>
                  <Route path="/documentacion" element={<Documentacion />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </TourProvider>
          </ScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
