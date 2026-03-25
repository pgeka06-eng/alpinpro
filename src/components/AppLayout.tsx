import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <main className="ml-[260px] transition-all duration-300">
          <div className="p-6 lg:p-8 max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
