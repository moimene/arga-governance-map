import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScopeProvider } from "@/context/ScopeContext";
import { TourProvider } from "@/context/TourContext";
import { AppLayout } from "@/components/shell/AppLayout";
import Dashboard from "./pages/Dashboard";
import GovernanceMap from "./pages/GovernanceMap";
import EntidadesList from "./pages/EntidadesList";
import EntidadDetalle from "./pages/EntidadDetalle";
import Documentacion from "./pages/Documentacion";
import { Admin, Dashboards, Esg, PlaceholderRoute, Sii } from "./pages/Placeholders";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScopeProvider>
          <TourProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/governance-map" element={<GovernanceMap />} />
                <Route path="/entidades" element={<EntidadesList />} />
                <Route path="/entidades/:id" element={<EntidadDetalle />} />
                <Route path="/organos" element={<PlaceholderRoute name="Órganos y Reuniones" />} />
                <Route path="/politicas" element={<PlaceholderRoute name="Políticas y Normativa" />} />
                <Route path="/obligaciones" element={<PlaceholderRoute name="Obligaciones y Controles" />} />
                <Route path="/delegaciones" element={<PlaceholderRoute name="Delegaciones y Poderes" />} />
                <Route path="/hallazgos" element={<PlaceholderRoute name="Hallazgos y Acciones" />} />
                <Route path="/hallazgos/:id" element={<PlaceholderRoute name="Detalle de Hallazgo" />} />
                <Route path="/conflictos" element={<PlaceholderRoute name="Conflictos / Attestations" />} />
                <Route path="/esg" element={<Esg />} />
                <Route path="/dashboards" element={<Dashboards />} />
                <Route path="/sii" element={<Sii />} />
                <Route path="/documentacion" element={<Documentacion />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </TourProvider>
        </ScopeProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
