import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, CheckSquare, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const location = useLocation();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: CheckSquare, label: "Tasks", path: "/tasks" },
    { icon: Users, label: "Clients", path: "/clients" },
    { icon: Activity, label: "Performance", path: "/performance" },
  ];

  return (
    <nav className="w-64 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-black tracking-tighter text-foreground flex items-center gap-1">
          opsos<span className="text-[#BEFF50]">.</span>
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-mono">Operational OS v1.0</p>
      </div>

      <div className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200",
              location.pathname === item.path
                ? "bg-[#BEFF50] text-black font-bold shadow-[0_0_20px_rgba(190,255,80,0.2)]"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <item.icon className={cn("w-4 h-4", location.pathname === item.path ? "text-black" : "text-muted-foreground")} />
            {item.label}
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-mono text-muted-foreground">
            VZ
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Valentina Zabala</p>
            <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">Principal PM</p>
          </div>
          <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
        </div>
      </div>
    </nav>
  );
}
