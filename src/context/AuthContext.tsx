import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import type { AuthUser } from "@/types";

export type { AuthUser };

// ── Context ───────────────────────────────────────────────────────────────────
interface AuthContextType {
  user: AuthUser | null;
  /** True until the first `/api/auth/me` check finishes */
  authHydrating: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authHydrating, setAuthHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && body.user) {
          setUser(body.user);
          localStorage.setItem("deliveryos_user", JSON.stringify(body.user));
        } else {
          setUser(null);
          localStorage.removeItem("deliveryos_user");
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          localStorage.removeItem("deliveryos_user");
        }
      } finally {
        if (!cancelled) setAuthHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!email.trim()) return { success: false, error: "Ingresa tu correo electrónico" };
    if (!password) return { success: false, error: "Ingresa tu contraseña" };
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const raw = await res.text();
      let body: { error?: string; user?: AuthUser } = {};
      if (raw) {
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          /* HTML u texto de error del proxy */
        }
      }
      if (!res.ok) {
        if (res.status === 404) {
          return {
            success: false,
            error:
              "No se encontró la API de login. Arranca el proyecto con `npm run dev` en la carpeta DeliveryOS (puerto 3000), no solo Vite.",
          };
        }
        return {
          success: false,
          error:
            body.error ||
            (raw.startsWith("<")
              ? "El servidor devolvió HTML en lugar de JSON. ¿Estás en http://localhost:3000 con `npm run dev`?"
              : raw.slice(0, 200) || `Error del servidor (${res.status})`),
        };
      }
      if (!body.user) return { success: false, error: "Respuesta inválida del servidor" };
      setUser(body.user);
      localStorage.setItem("deliveryos_user", JSON.stringify(body.user));
      return { success: true };
    } catch {
      return { success: false, error: "Error de red. ¿El servidor está en marcha en el puerto 3000?" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* still clear local session */
    }
    setUser(null);
    localStorage.removeItem("deliveryos_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, authHydrating, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
