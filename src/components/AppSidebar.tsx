import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calculator,
  ClipboardList,
  Wallet,
  FileText,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  HardHat,
  LogOut,
  Shield,
  Receipt,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Дашборд", roles: ["admin", "manager", "climber"] },
  { to: "/calculator", icon: Calculator, label: "Калькулятор", roles: ["admin", "manager", "climber"] },
  { to: "/orders", icon: ClipboardList, label: "Заказы", roles: ["admin", "manager", "climber"] },
  { to: "/accounting", icon: Wallet, label: "Бухгалтерия", roles: ["admin", "manager", "climber"] },
  { to: "/documents", icon: FileText, label: "Документы", roles: ["admin", "manager", "climber"] },
  { to: "/climbers", icon: Users, label: "Альпинисты", roles: ["admin", "manager"] },
  { to: "/settings", icon: Settings, label: "Настройки", roles: ["admin", "manager", "climber"] },
];

const roleLabels: Record<string, string> = {
  admin: "Администратор",
  manager: "Менеджер",
  climber: "Альпинист",
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  const filteredNav = navItems.filter((item) => !role || item.roles.includes(role));

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-all duration-300 ${
        collapsed ? "w-[72px]" : "w-[260px]"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
          <HardHat className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold text-sidebar-accent-foreground tracking-tight">
              AlpinPro
            </h1>
            <p className="text-[11px] text-sidebar-foreground/60 leading-none">
              Высотные работы
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-glow"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "" : "opacity-70 group-hover:opacity-100"}`} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && profile && (
          <div className="px-3 py-2">
            <p className="text-sm font-medium text-sidebar-accent-foreground truncate">
              {profile.full_name || "Пользователь"}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield className="w-3 h-3 text-sidebar-primary" />
              <span className="text-[11px] text-sidebar-foreground/70">
                {role ? roleLabels[role] : "—"}
              </span>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Выйти</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center px-2 py-2 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
