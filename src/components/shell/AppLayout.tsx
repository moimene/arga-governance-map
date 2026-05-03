import { Outlet, useLocation } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { Footer } from "./Footer";
import { TourPanel } from "@/components/tour/TourPanel";
import { SidebarMobileProvider } from "./SidebarMobileContext";

export function AppLayout() {
  const { pathname } = useLocation();
  const isSii = pathname.startsWith("/sii");
  const isLogin = pathname === "/login";
  const showFooter = !isSii && !isLogin;

  return (
    <SidebarMobileProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <MobileSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          {!isSii && <Header />}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
          {showFooter && <Footer />}
        </div>
        <TourPanel />
      </div>
    </SidebarMobileProvider>
  );
}
