import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { TourPanel } from "@/components/tour/TourPanel";

export function AppLayout() {
  const { pathname } = useLocation();
  const showFooter = !pathname.startsWith("/sii");

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
        {showFooter && <Footer />}
      </div>
      <TourPanel />
    </div>
  );
}
