import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        {/* pt-14 on mobile for the fixed header bar, lg:pt-0 + lg:ml-[260px] for desktop sidebar */}
        <main className="pt-14 lg:pt-0 lg:ml-[260px] transition-all duration-300">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
