import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import { Dashboard } from "@/pages/Dashboard";
import { Tasks } from "@/pages/Tasks";
import { Clients } from "@/pages/Clients";
import { ClientDetail } from "@/pages/ClientDetail";
import { Team } from "@/pages/Team";
import { TeamMemberDetail } from "@/pages/TeamMemberDetail";
import { Workload } from "@/pages/Workload";
import { Assignment } from "@/pages/Assignment";
import { MyAssignments } from "@/pages/MyAssignments";
import { Performance } from "@/pages/Performance";
import { TeamPerformance } from "@/pages/TeamPerformance";
import { Login } from "@/pages/Login";
import { AuthProvider, useAuth } from "@/context/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry 4xx errors — only network/5xx failures
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

// ── Logout page ───────────────────────────────────────────────────────────────
function LogoutPage() {
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("deliveryos_user");
      window.location.replace("/login");
    });
  }, []);
  return null;
}

// ── Route guard ───────────────────────────────────────────────────────────────
function AppRoutes() {
  const { user, authHydrating } = useAuth();

  if (authHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <div className="w-8 h-8 border-2 border-[#BEFF50]/30 border-t-[#BEFF50] rounded-full animate-spin" />
      </div>
    );
  }

  // Not logged in → show login
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Production worker → can only see their assignments
  if (user.role === "production") {
    return (
      <div className="flex bg-background min-h-screen">
        <Navbar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/my-assignments"  element={<MyAssignments />} />
            <Route path="/performance"     element={<Performance />} />
            <Route path="/clients/:id"     element={<ClientDetail />} />
            <Route path="/logout"          element={<LogoutPage />} />
            <Route path="*"                element={<Navigate to="/my-assignments" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  // Management → full access
  return (
    <div className="flex bg-background min-h-screen">
      <Navbar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/"               element={<Dashboard />} />
          <Route path="/tasks"          element={<Tasks />} />
          <Route path="/clients"        element={<Clients />} />
          <Route path="/clients/:id"    element={<ClientDetail />} />
          <Route path="/performance"      element={<Performance />} />
          <Route path="/performance/team" element={<TeamPerformance />} />
          <Route path="/team"           element={<Team />} />
          <Route path="/team/:id"       element={<TeamMemberDetail />} />
          <Route path="/workload"       element={<Workload />} />
          <Route path="/assignment"     element={<Assignment />} />
          <Route path="/my-assignments" element={<Navigate to="/" replace />} />
          <Route path="/login"          element={<Navigate to="/" replace />} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
