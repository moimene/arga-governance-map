import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ShellLayout } from "@/components/shell/ShellLayout";
import {
  Dashboard,
  GovernanceMap,
  EntidadesList,
  EntityDetail,
  OrganosList,
  OrganoDetail,
  MeetingDetail,
  PoliticasList,
  PoliticaDetail,
  ObligacionesList,
  ObligacionDetail,
  DelegacionesList,
  DelegacionDetail,
  HallazgosList,
  HallazgoDetail,
  Conflictos,
  SII,
  Documentacion,
} from "@/pages/tgms/Placeholders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<ShellLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/governance-map" element={<GovernanceMap />} />
            <Route path="/entidades" element={<EntidadesList />} />
            <Route path="/entidades/:id" element={<EntityDetail />} />
            <Route path="/organos" element={<OrganosList />} />
            <Route path="/organos/:id" element={<OrganoDetail />} />
            <Route path="/organos/:id/:meetingId" element={<MeetingDetail />} />
            <Route path="/politicas" element={<PoliticasList />} />
            <Route path="/politicas/:id" element={<PoliticaDetail />} />
            <Route path="/obligaciones" element={<ObligacionesList />} />
            <Route path="/obligaciones/:id" element={<ObligacionDetail />} />
            <Route path="/delegaciones" element={<DelegacionesList />} />
            <Route path="/delegaciones/:id" element={<DelegacionDetail />} />
            <Route path="/hallazgos" element={<HallazgosList />} />
            <Route path="/hallazgos/:id" element={<HallazgoDetail />} />
            <Route path="/conflictos" element={<Conflictos />} />
            <Route path="/sii" element={<SII />} />
            <Route path="/documentacion" element={<Documentacion />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
