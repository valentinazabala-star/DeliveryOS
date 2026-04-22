/**
 * Onboarding — guided tour for new production users.
 * Auto-shows on first login (keyed per userId in localStorage).
 * Also re-openable via the help button in MyAssignments.
 *
 * 8 steps covering: welcome, tasks, status buttons, feedback,
 * real-time sync, daily schedule, chat assistant, and ready-to-go.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, ListChecks, RefreshCw, Zap, CloudUpload,
  Clock, MessageCircle, Rocket, ChevronLeft, ChevronRight,
  X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Step definitions ───────────────────────────────────────────────────────────
interface Step {
  id:          string;
  icon:        React.ElementType;
  iconBg:      string;
  iconColor:   string;
  accentColor: string;
  title:       (name: string) => string;
  subtitle:    string;
  description: string;
  points:      string[];
  demo?:       React.ReactNode;
}

const statusDemo = (
  <div className="flex items-center gap-2 mt-4 p-3 bg-white rounded-xl border border-border">
    <div className="flex items-center gap-2 flex-1">
      <DemoStatusCycle />
      <div>
        <p className="text-xs font-medium text-foreground">SEO - Estrategia de SEO</p>
        <p className="text-[10px] text-muted-foreground">Haz clic en el círculo →</p>
      </div>
    </div>
  </div>
);

const scheduleDemo = (
  <div className="mt-4 space-y-1.5">
    {[
      { time: "7:30 AM",  label: "Inicio de jornada",  dot: "bg-[#BEFF50]", icon: "☀️" },
      { time: "12:30 PM", label: "Almuerzo (1 hora)",   dot: "bg-amber-400", icon: "🍽️" },
      { time: "3:30 PM",  label: "Pausa activa (15 min)", dot: "bg-blue-400", icon: "🧘" },
      { time: "5:30 PM",  label: "Fin de jornada",     dot: "bg-rose-400", icon: "🌅" },
    ].map(row => (
      <div key={row.time} className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl border border-border">
        <span className="text-sm">{row.icon}</span>
        <div className={cn("w-2 h-2 rounded-full shrink-0", row.dot)} />
        <span className="text-xs font-mono font-semibold text-foreground w-16 shrink-0">{row.time}</span>
        <span className="text-xs text-muted-foreground">{row.label}</span>
      </div>
    ))}
  </div>
);

const feedbackDemo = (
  <div className="flex items-center gap-2 mt-4 p-3 bg-white rounded-xl border border-border">
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold tracking-wide uppercase">
      <Zap className="w-2.5 h-2.5" /> Feedback
    </span>
    <p className="text-xs text-muted-foreground">Corrección pendiente del cliente → alta prioridad</p>
  </div>
);

function DemoStatusCycle() {
  const [status, setStatus] = useState<0 | 1 | 2>(0);
  const icons = [
    { icon: "○", cls: "text-muted-foreground border-border", label: "Pendiente" },
    { icon: "◐", cls: "text-amber-500 border-amber-300 bg-amber-50", label: "En progreso" },
    { icon: "●", cls: "text-green-600 border-green-300 bg-green-50", label: "Completada" },
  ];
  const cur = icons[status];
  return (
    <button
      onClick={() => setStatus(s => ((s + 1) % 3) as 0 | 1 | 2)}
      className={cn(
        "w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all",
        cur.cls
      )}
      title={cur.label}
    >
      {cur.icon}
    </button>
  );
}

const STEPS: Step[] = [
  {
    id: "welcome",
    icon: Sparkles,
    iconBg: "bg-[#BEFF50]/20",
    iconColor: "text-lime-600",
    accentColor: "#BEFF50",
    title: (name) => `¡Hola, ${name.split(" ")[0]}! 👋`,
    subtitle: "Bienvenido a DeliveryOS",
    description: "Tu plataforma de trabajo diario para gestionar las tareas de clientes de Orqestra.",
    points: [
      "Ves las tareas que el equipo de gestión te asignó",
      "Actualizas el estado mientras trabajas",
      "El PM ve tu progreso en tiempo real",
    ],
  },
  {
    id: "tasks",
    icon: ListChecks,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    accentColor: "#3b82f6",
    title: () => "Tus tareas del día",
    subtitle: "Organizadas por cliente",
    description: "Cada cliente aparece como una sección con todas sus tareas agrupadas y organizadas por fecha de entrega.",
    points: [
      "Haz clic en el nombre del cliente para expandir sus tareas",
      "Cada tarea muestra el producto: RRSS, SEO, WEB o GMB",
      "El ícono de enlace externo abre la ficha del cliente en Orbidi",
    ],
  },
  {
    id: "status",
    icon: RefreshCw,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    accentColor: "#22c55e",
    title: () => "Cambia el estado",
    subtitle: "Tu control principal",
    description: "El ícono circular a la izquierda de cada tarea es tu control de progreso. Haz clic para avanzar al siguiente estado.",
    points: [
      "⚪ Pendiente — aún no empezada",
      "🟡 En progreso — estás trabajando",
      "✅ Completada — tarea terminada",
    ],
    demo: statusDemo,
  },
  {
    id: "feedback",
    icon: Zap,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
    accentColor: "#f97316",
    title: () => "Tareas de Feedback",
    subtitle: "Correcciones del cliente",
    description: "Las tareas marcadas con FEEDBACK son correcciones solicitadas por el cliente sobre entregas anteriores.",
    points: [
      "Son prioritarias — atiéndelas antes que las demás",
      "El sistema te puede asignar la misma tarea más de una vez si el cliente pide más cambios",
      "Priorizan continuidad: si la trabajaste antes, el sistema te la asigna a ti de nuevo",
    ],
    demo: feedbackDemo,
  },
  {
    id: "sync",
    icon: CloudUpload,
    iconBg: "bg-purple-100",
    iconColor: "text-[#60259F]",
    accentColor: "#60259F",
    title: () => "Todo se guarda solo",
    subtitle: "Sincronización automática",
    description: "Cada cambio de estado se guarda y sincroniza al instante. No necesitas hacer nada extra.",
    points: [
      "El PM ve tu progreso en tiempo real",
      "Si cierras el navegador, tu progreso queda guardado",
      "Actualiza el estado mientras trabajas, no solo al final del día",
    ],
  },
  {
    id: "schedule",
    icon: Clock,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    accentColor: "#f59e0b",
    title: () => "Recordatorios del día",
    subtitle: "Notificaciones en momentos clave",
    description: "Recibirás alertas automáticas en los momentos importantes de la jornada laboral.",
    points: [
      "☀️ 7:30 AM — inicio de jornada con resumen de tareas",
      "🍽️ 12:30 PM / 1:30 PM — inicio y fin del almuerzo",
      "🧘 3:30 PM / 3:45 PM — pausa activa de 15 minutos",
      "🌅 5:30 PM — recordatorio de cierre del día",
    ],
    demo: scheduleDemo,
  },
  {
    id: "chat",
    icon: MessageCircle,
    iconBg: "bg-[#60259F]/10",
    iconColor: "text-[#60259F]",
    accentColor: "#60259F",
    title: () => "¿Tienes dudas?",
    subtitle: "Asistente de ayuda disponible",
    description: "En la esquina inferior derecha encontrarás el botón de chat. El asistente responde preguntas sobre el sistema en cualquier momento.",
    points: [
      "Preguntas sobre estados, feedback, horarios y más",
      "Respuestas instantáneas sin esperar a nadie",
      "Siempre disponible mientras estés en la plataforma",
    ],
  },
  {
    id: "ready",
    icon: Rocket,
    iconBg: "bg-[#BEFF50]/20",
    iconColor: "text-lime-600",
    accentColor: "#BEFF50",
    title: () => "¡Ya estás listo!",
    subtitle: "Todo configurado",
    description: "Tienes todo lo que necesitas para empezar a trabajar. Recuerda actualizar el estado de tus tareas durante el día.",
    points: [
      "Actualiza el estado mientras trabajas, no solo al terminar",
      "Las tareas de Feedback son prioritarias",
      "Si tienes dudas, el chat está en la esquina inferior derecha",
    ],
  },
];

// ── Storage key ────────────────────────────────────────────────────────────────
const storageKey = (userId: string) => `opsos_onboarding_done_${userId}`;

// ── Main modal ─────────────────────────────────────────────────────────────────
interface OnboardingProps {
  userId:   string;
  userName: string;
  open:     boolean;
  onClose:  () => void;
}

export function Onboarding({ userId, userName, open, onClose }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [dir,  setDir]  = useState(1);   // 1 = forward, -1 = back
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const handleClose = useCallback(() => {
    localStorage.setItem(storageKey(userId), "true");
    onClose();
  }, [userId, onClose]);

  const goNext = useCallback(() => {
    if (isLast) { handleClose(); return; }
    setDir(1);
    setStep(s => s + 1);
  }, [isLast, handleClose]);

  const goPrev = useCallback(() => {
    if (step === 0) return;
    setDir(-1);
    setStep(s => s - 1);
  }, [step]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight" || e.key === "Enter") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goNext, goPrev, handleClose]);

  const Icon = current.icon;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Card */}
          <motion.div
            key="card"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[9991] flex items-center justify-center pointer-events-none p-4"
          >
            <div
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Progress bar */}
              <div className="h-1 bg-border">
                <motion.div
                  className="h-full bg-foreground"
                  animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>

              {/* Step counter + close */}
              <div className="flex items-center justify-between px-6 pt-5 pb-0">
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 rounded-full transition-all duration-300",
                        i === step ? "w-5 bg-foreground" : i < step ? "w-2 bg-muted-foreground/40" : "w-2 bg-border"
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Content area — fixed height to prevent layout jump */}
              <div className="px-6 pb-4 pt-5 min-h-[360px] flex flex-col">
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div
                    key={step}
                    custom={dir}
                    initial={{ x: dir * 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: dir * -40, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col"
                  >
                    {/* Icon */}
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", current.iconBg)}>
                      <Icon className={cn("w-5.5 h-5.5", current.iconColor)} />
                    </div>

                    {/* Text */}
                    <div className="mb-1">
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">
                        {current.subtitle}
                      </p>
                      <h2 className="text-xl font-black text-foreground leading-tight" style={{ fontFamily: "'Cal Sans', sans-serif" }}>
                        {current.title(userName)}
                      </h2>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {current.description}
                    </p>

                    {/* Points */}
                    <ul className="space-y-1.5">
                      {current.points.map((pt, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <div className={cn(
                            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                            "bg-muted"
                          )}>
                            <Check className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          {pt}
                        </li>
                      ))}
                    </ul>

                    {/* Demo */}
                    {current.demo}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-6 pb-6">
                <button
                  onClick={goPrev}
                  disabled={step === 0}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Atrás
                </button>

                <button
                  onClick={goNext}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-xl bg-foreground text-white text-xs font-semibold hover:bg-foreground/90 transition-colors"
                >
                  {isLast ? (
                    <>
                      <Rocket className="w-3.5 h-3.5" />
                      ¡Empezar a trabajar!
                    </>
                  ) : (
                    <>
                      Siguiente
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useOnboarding(userId: string | undefined) {
  const [open, setOpen] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    if (!userId || checked.current) return;
    checked.current = true;
    const done = localStorage.getItem(storageKey(userId));
    if (!done) {
      // Small delay so the page renders first
      const t = setTimeout(() => setOpen(true), 1200);
      return () => clearTimeout(t);
    }
  }, [userId]);

  return {
    open,
    openOnboarding:  () => setOpen(true),
    closeOnboarding: () => setOpen(false),
  };
}
