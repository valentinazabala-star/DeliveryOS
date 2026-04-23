import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CheckSquare, Activity,
  UsersRound, Timer, CalendarClock, ListChecks, LogOut, TrendingUp, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { roleConfig } from "@/data/teamData";

interface NavbarProps {
  onOpenOnboarding?: () => void;
}

export function Navbar({ onOpenOnboarding }: NavbarProps = {}) {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  // Management gets full nav; production workers get just their assignments
  const navItems = user?.role === "production"
    ? [
        { icon: ListChecks,  label: "Mis Asignaciones", path: "/my-assignments" },
        { icon: TrendingUp,  label: "Performance",       path: "/performance"    },
      ]
    : [
        { icon: LayoutDashboard, label: "Dashboard",   path: "/" },
        { icon: CheckSquare,     label: "Tasks",        path: "/tasks" },
        { icon: Users,           label: "Clients",      path: "/clients" },
        { icon: Activity,        label: "Team Perf.",   path: "/performance/team" },
        { icon: UsersRound,      label: "Team",         path: "/team" },
        { icon: Timer,           label: "Workload",     path: "/workload" },
        { icon: CalendarClock,   label: "Assignment",   path: "/assignment" },
      ];

  // Display role label
  const roleLabel = (() => {
    if (!user) return "";
    if (user.role === "management") return user.title ?? "Management";
    if (user.teamMember) return roleConfig[user.teamMember.role]?.label ?? "Producción";
    return "Producción";
  })();

  // Avatar initials
  const initials = user
    ? user.name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "??";

  return (
    <nav className="w-60 flex flex-col h-screen sticky top-0" style={{ background: "#0d0d0d" }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/8 flex justify-center">
        <img src="/DeliveryOS-01.png" alt="DeliveryOS by Orqestra" className="w-full max-w-[192px] h-auto" />
      </div>

      {/* Nav items */}
      <div className="flex-1 py-5 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                active
                  ? "bg-[#BEFF50] text-[#0d0d0d] font-bold"
                  : "text-white/50 hover:text-white hover:bg-white/8"
              )}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-[#0d0d0d]" : "text-white/40")} />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* User footer */}
      <div className="p-4 border-t border-white/8">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-[#BEFF50] flex items-center justify-center text-[11px] font-black text-[#0d0d0d] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name ?? "—"}</p>
            <p className="text-[10px] text-white/40 truncate uppercase tracking-wider">{roleLabel}</p>
          </div>
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              title="Tour de la plataforma"
              className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-[#BEFF50] hover:bg-[#BEFF50]/10 transition-all shrink-0"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
