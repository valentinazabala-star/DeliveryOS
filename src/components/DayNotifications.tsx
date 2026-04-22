/**
 * DayNotifications — time-based in-app banners for production users.
 * Schedules notifications at key moments of the Colombia workday:
 *   07:30  Start of day
 *   12:30  Lunch break starts
 *   13:30  Back from lunch
 *   15:30  Pausa activa (15 min break)
 *   15:45  Back from pause
 *   17:30  End of day
 *
 * Uses setTimeout calculated from America/Bogota local time.
 * Also requests Web Notification permission for background alerts.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sun, Coffee, Flame, Wind, Zap, Sunset } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
type NotifType = "morning" | "lunch_start" | "lunch_end" | "pause_start" | "pause_end" | "end_day";

interface NotifConfig {
  id:        NotifType;
  h:         number;
  m:         number;
  icon:      React.ElementType;
  iconBg:    string;
  iconColor: string;
  barColor:  string;
  title:     string;
  getMessage: (taskCount: number, pendingCount: number) => string;
}

const NOTIF_CONFIGS: NotifConfig[] = [
  {
    id: "morning",
    h: 7, m: 30,
    icon: Sun,
    iconBg: "bg-[#BEFF50]/20",
    iconColor: "text-lime-600",
    barColor: "bg-[#BEFF50]",
    title: "¡Buenos días! ☀️",
    getMessage: (tasks) =>
      tasks > 0
        ? `Tienes ${tasks} tarea${tasks !== 1 ? "s" : ""} asignada${tasks !== 1 ? "s" : ""} para hoy. ¡A darle!`
        : "El equipo aún no ha generado la asignación de hoy. Estará lista pronto.",
  },
  {
    id: "lunch_start",
    h: 12, m: 30,
    icon: Coffee,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    barColor: "bg-amber-400",
    title: "🍽️ Hora del almuerzo",
    getMessage: () =>
      "Antes de salir, actualiza el estado de tus tareas activas. ¡Buen provecho!",
  },
  {
    id: "lunch_end",
    h: 13, m: 30,
    icon: Flame,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
    barColor: "bg-orange-400",
    title: "☀️ ¡De vuelta!",
    getMessage: (_, pending) =>
      pending > 0
        ? `Continúa donde lo dejaste. Tienes ${pending} tarea${pending !== 1 ? "s" : ""} pendiente${pending !== 1 ? "s" : ""} para hoy.`
        : "¡Bien hecho! Ya tienes todo al día. Sigue así el resto de la tarde.",
  },
  {
    id: "pause_start",
    h: 15, m: 30,
    icon: Wind,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-500",
    barColor: "bg-blue-400",
    title: "🧘 Pausa activa — 15 min",
    getMessage: () =>
      "Estira, respira profundo y descansa la vista. ¡Vuelves más productivo!",
  },
  {
    id: "pause_end",
    h: 15, m: 45,
    icon: Zap,
    iconBg: "bg-purple-100",
    iconColor: "text-[#60259F]",
    barColor: "bg-[#60259F]",
    title: "💪 ¡Pausa terminada!",
    getMessage: () =>
      "¡A terminar el día con todo! Solo faltan 2 horas de jornada.",
  },
  {
    id: "end_day",
    h: 17, m: 30,
    icon: Sunset,
    iconBg: "bg-rose-100",
    iconColor: "text-rose-500",
    barColor: "bg-rose-400",
    title: "🌅 Fin de jornada",
    getMessage: (_, pending) =>
      pending > 0
        ? `Antes de cerrar, marca las tareas que terminaste. Aún tienes ${pending} pendiente${pending !== 1 ? "s" : ""}.`
        : "¡Día completado! Recuerda marcar lo que terminaste. ¡Hasta mañana! 👋",
  },
];

// ── Timezone helpers ───────────────────────────────────────────────────────────
const TZ = "America/Bogota";

function getBogotaTime(): { h: number; m: number; s: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  return { h: get("hour"), m: get("minute"), s: get("second") };
}

function msUntilBogotaHM(h: number, m: number): number {
  const { h: ch, m: cm, s: cs } = getBogotaTime();
  const currentMin = ch * 60 + cm;
  const targetMin  = h * 60 + m;
  let diffMin = targetMin - currentMin;
  if (diffMin < 0) diffMin += 24 * 60;          // already passed today → tomorrow
  if (diffMin === 0 && cs > 30) diffMin += 24 * 60; // within this minute but past 30s → tomorrow
  return diffMin * 60 * 1000 - cs * 1000;
}

// ── Web Notifications API ─────────────────────────────────────────────────────
function sendWebNotification(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}

// ── Banner component ───────────────────────────────────────────────────────────
const AUTO_DISMISS_MS = 9_000;

interface BannerProps {
  config:      NotifConfig;
  taskCount:   number;
  pendingCount: number;
  onClose:     () => void;
}

function NotifBanner({ config, taskCount, pendingCount, onClose }: BannerProps) {
  const Icon    = config.icon;
  const message = config.getMessage(taskCount, pendingCount);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start  = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (pct > 0) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    const timer = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [onClose]);

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md pointer-events-auto"
    >
      <div className="bg-white rounded-2xl border border-border shadow-xl overflow-hidden mx-4">
        {/* Progress bar */}
        <div className="h-0.5 bg-border">
          <div
            className={cn("h-full transition-none", config.barColor)}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-start gap-3 px-4 py-3.5">
          {/* Icon */}
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", config.iconBg)}>
            <Icon className={cn("w-4.5 h-4.5", config.iconColor)} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">{config.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{message}</p>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface DayNotificationsProps {
  /** Total tasks assigned to user today */
  taskCount:   number;
  /** Tasks not yet marked done */
  pendingCount: number;
}

export function DayNotifications({ taskCount, pendingCount }: DayNotificationsProps) {
  const [current, setCurrent] = useState<NotifConfig | null>(null);
  const queueRef = useRef<NotifConfig[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    setCurrent(next ?? null);
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
    // Small delay before showing next queued notification
    setTimeout(() => showNext(), 600);
  }, [showNext]);

  // Schedule all notifications for today
  useEffect(() => {
    // Request permission non-intrusively after a user gesture isn't possible here,
    // so we try on mount — if already granted it's instant; if denied it's silently skipped.
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const enqueue = (config: NotifConfig) => {
      queueRef.current.push(config);
      if (!current) showNext();
    };

    NOTIF_CONFIGS.forEach(cfg => {
      const ms = msUntilBogotaHM(cfg.h, cfg.m);
      const timer = setTimeout(() => {
        sendWebNotification(cfg.title, cfg.getMessage(taskCount, pendingCount));
        enqueue(cfg);
      }, ms);
      timersRef.current.push(timer);
    });

    return () => timersRef.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only schedule once on mount

  return (
    <AnimatePresence>
      {current && (
        <NotifBanner
          key={current.id}
          config={current}
          taskCount={taskCount}
          pendingCount={pendingCount}
          onClose={dismiss}
        />
      )}
    </AnimatePresence>
  );
}

/** Hook: manually trigger a notification banner (for testing / preview) */
export function useTestNotification() {
  const [override, setOverride] = useState<NotifConfig | null>(null);

  const trigger = useCallback((id: NotifType) => {
    const cfg = NOTIF_CONFIGS.find(c => c.id === id) ?? null;
    setOverride(cfg);
  }, []);

  const dismiss = useCallback(() => setOverride(null), []);

  const Banner = override ? (
    <AnimatePresence>
      <NotifBanner
        key={override.id}
        config={override}
        taskCount={5}
        pendingCount={3}
        onClose={dismiss}
      />
    </AnimatePresence>
  ) : null;

  return { trigger, Banner };
}
