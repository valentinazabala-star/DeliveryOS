import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, LogIn } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TEAM_DATA, roleConfig } from "@/data/teamData";

export function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // slight delay for UX
    await new Promise(r => setTimeout(r, 300));
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      const saved = localStorage.getItem("deliveryos_user");
      const u = saved ? JSON.parse(saved) : null;
      navigate(u?.role === "production" ? "/my-assignments" : "/", { replace: true });
    } else {
      setError(result.error ?? "Error al iniciar sesión");
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0d0d0d]">
      {/* Left panel – branding */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 bg-[#0d0d0d]">
        <img src="/DeliveryOS-01.png" alt="DeliveryOS" className="w-48" />
        <div>
          <h1 className="text-4xl font-black text-white leading-tight mb-4"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Operational OS<br />
            <span className="text-[#BEFF50]">para Orqestra.</span>
          </h1>
          <p className="text-white/40 text-sm max-w-xs">
            Gestión de capacidad, asignación de tareas y seguimiento de producción en un solo lugar.
          </p>
        </div>
        {/* Team preview */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Equipo activo</p>
          <div className="flex flex-wrap gap-2">
            {TEAM_DATA.slice(0, 8).map((m, i) => {
              const rc = roleConfig[m.role];
              return (
                <div key={m.id} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-[8px] font-black bg-[#60259F]`}>
                    {m.person_name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase()}
                  </div>
                  <span className={`text-[9px] font-semibold ${rc.color.replace("text-","text-").replace("-700","") }`}
                        style={{ color: "rgba(255,255,255,0.5)" }}>
                    {m.person_name.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <img src="/DeliveryOS-01.png" alt="DeliveryOS" className="w-40 mb-8 lg:hidden mx-auto" />

          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                Bienvenido
              </h2>
              <p className="text-muted-foreground text-sm mt-1">Inicia sesión para continuar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder="tu.nombre@plinng.com"
                  className="w-full h-10 rounded-xl border border-border bg-background px-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#60259F]/30 focus:border-[#60259F]/50 transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold block mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••••"
                    className="w-full h-10 rounded-xl border border-border bg-background px-3.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#60259F]/30 focus:border-[#60259F]/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-xl bg-[#60259F] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#4a1a7a] disabled:opacity-60 transition-colors mt-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Iniciando...</>
                  : <><LogIn className="w-4 h-4" /> Iniciar sesión</>
                }
              </button>
            </form>

            {/* Hint */}
            <p className="text-[10px] text-muted-foreground/50 text-center mt-6">
              Usa tu correo corporativo · contacta a tu PM si olvidaste tu contraseña
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
