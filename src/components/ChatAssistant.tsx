/**
 * ChatAssistant — floating AI-powered help chat for production users.
 * Answers questions about DeliveryOS using a curated knowledge base.
 * Floats at bottom-right; opens as a slide-up panel.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, ChevronDown, Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Knowledge base ────────────────────────────────────────────────────────────
interface KBEntry {
  keywords: string[];
  answer:   string;
}

const KB: KBEntry[] = [
  // Estados de tareas
  {
    keywords: ["marcar", "completar", "completada", "done", "terminar", "finalizar", "acabar"],
    answer: "Para marcar una tarea como completada, haz clic en el **ícono circular** al inicio de la fila de la tarea. El ciclo es: ⚪ Pendiente → 🟡 En progreso → ✅ Completada. Cada clic avanza al siguiente estado y se guarda automáticamente.",
  },
  {
    keywords: ["estado", "círculo", "icono", "ícono", "botón", "estados", "status"],
    answer: "Cada tarea tiene un ícono circular a la izquierda que controla su estado:\n\n⚪ **Pendiente** — aún sin empezar\n🟡 **En progreso** — estás trabajando en ella\n✅ **Completada** — tarea terminada\n\nHaz clic para avanzar. El progreso se sincroniza con el PM en tiempo real.",
  },
  {
    keywords: ["volver", "deshacer", "atrás", "revertir", "cambiar estado atrás"],
    answer: "Los estados avanzan en una sola dirección: Pendiente → En progreso → Completada → Pendiente nuevamente. Si cometiste un error, puedes seguir haciendo clic para volver a Pendiente y reiniciar el ciclo.",
  },
  // Feedback
  {
    keywords: ["feedback", "corrección", "correcciones", "cambios", "cliente pide", "revisar"],
    answer: "Las tareas de **Feedback** son correcciones solicitadas por el cliente sobre una entrega anterior. Tienen alta prioridad — atiéndelas antes que las demás. Se identifican con la etiqueta naranja **FEEDBACK** en la tabla de tareas.",
  },
  {
    keywords: ["prioridad", "primero", "urgente", "urgencia", "cuál primero"],
    answer: "El orden de prioridad recomendado es:\n1. 🔴 Tareas de **Feedback** (correcciones del cliente)\n2. 🟡 Tareas **En progreso** que ya empezaste\n3. ⚪ Tareas **Pendientes** por fecha de entrega",
  },
  // Asignación
  {
    keywords: ["asignación", "asignar", "quién asigna", "cómo me asignan", "nuevas tareas"],
    answer: "Las tareas son asignadas cada mañana por el equipo de gestión (PM) a través del motor de asignación de DeliveryOS. El sistema considera tu rol, capacidad diaria y área de trabajo. Si no ves tareas, contacta a tu PM.",
  },
  {
    keywords: ["cuándo", "cuántas tareas", "recibo", "nuevas", "mañana"],
    answer: "Normalmente recibes nuevas tareas cada mañana antes de las 8:00 AM. Si a las 8:30 AM no ves asignación, escribe a tu PM. Las asignaciones cubren una semana de trabajo (5 días hábiles).",
  },
  {
    keywords: ["pm", "gestor", "management", "quién", "supervisor", "jefe"],
    answer: "Tu PM (Project Manager) es quien gestiona la asignación de tareas, revisa tu progreso y coordina con los clientes. Puedes contactarle directamente si tienes dudas sobre tus tareas o carga de trabajo.",
  },
  // Horarios y pausas
  {
    keywords: ["horario", "jornada", "hora", "inicio", "salida", "cuándo empieza", "turno"],
    answer: "La jornada laboral en Orqestra es:\n⏰ **7:30 AM** — Inicio de jornada\n🍽️ **12:30 – 1:30 PM** — Almuerzo\n🧘 **3:30 – 3:45 PM** — Pausa activa\n🌅 **5:30 PM** — Fin de jornada\n\nRecibirás recordatorios en cada uno de estos momentos.",
  },
  {
    keywords: ["almuerzo", "descanso", "pausa", "break", "descansar", "pausa activa"],
    answer: "Tienes dos pausas programadas:\n\n🍽️ **Almuerzo**: 12:30 PM – 1:30 PM (1 hora)\n🧘 **Pausa activa**: 3:30 PM – 3:45 PM (15 minutos de movimiento y descanso)\n\nRecibirás notificaciones al inicio y fin de cada pausa.",
  },
  {
    keywords: ["notificación", "notificaciones", "recordatorio", "alerta", "aviso"],
    answer: "DeliveryOS te envía notificaciones automáticas en los momentos clave del día (inicio, almuerzo, pausa activa y fin de jornada). Aparecen como banners en la parte superior de la pantalla. Activa las notificaciones del navegador para recibirlas aunque la pestaña esté en segundo plano.",
  },
  // Sincronización y guardado
  {
    keywords: ["guardar", "guarda", "automático", "automáticamente", "sincroniza", "perder"],
    answer: "✅ Todo se guarda **automáticamente**. Cada vez que cambias el estado de una tarea, se sincroniza al instante con el servidor. Si cierras el navegador y vuelves a abrir, tu progreso estará exactamente igual.",
  },
  {
    keywords: ["pm ve", "visible", "ver mi progreso", "sabe", "equipo ve"],
    answer: "Sí, el PM puede ver tu progreso en **tiempo real**. Cuando marcas una tarea como 'en progreso' o 'completada', aparece actualizado en su panel inmediatamente. Por eso es importante actualizar el estado mientras trabajas, no solo al final del día.",
  },
  // Roles y productos
  {
    keywords: ["rrss", "redes sociales", "post", "instagram", "facebook", "social media"],
    answer: "Las tareas **RRSS** (Redes Sociales) involucran creación de contenido para plataformas como Instagram, Facebook, LinkedIn, TikTok, etc. Incluyen textos, copies, calendarios editoriales y gestión de comunidad.",
  },
  {
    keywords: ["seo", "posicionamiento", "google", "búsqueda", "palabras clave", "keywords"],
    answer: "Las tareas **SEO** son de optimización para motores de búsqueda: análisis de palabras clave, auditorías de sitio web, estrategias de contenido orgánico y reportes de posicionamiento.",
  },
  {
    keywords: ["web", "website", "sitio", "página", "landing", "implementar"],
    answer: "Las tareas **WEB** involucran cambios o implementaciones en sitios web: actualizaciones de contenido, nuevas secciones, optimizaciones de velocidad y correcciones técnicas.",
  },
  {
    keywords: ["gmb", "google my business", "ficha", "reseñas", "local"],
    answer: "Las tareas **GMB** (Google My Business) son sobre la gestión de la ficha de Google de los clientes: publicaciones, respuesta a reseñas, actualizaciones de horario y fotos.",
  },
  // Content Specialist, Copy, etc.
  {
    keywords: ["content specialist", "contenido", "creador", "content"],
    answer: "El rol **Content Specialist** crea contenido escrito y audiovisual: posts de redes sociales, captions, guiones para reels, artículos de blog y estrategias de contenido.",
  },
  {
    keywords: ["copy", "copywriter", "redacción", "texto"],
    answer: "El rol **Copy** se encarga de redacción persuasiva y creativa: textos publicitarios, email marketing, landing pages, slogans y cualquier contenido orientado a conversión.",
  },
  {
    keywords: ["diseñador", "diseño", "designer", "gráfico", "visual"],
    answer: "El rol **Designer** crea piezas visuales: diseños para redes sociales, banners, presentaciones, branding y cualquier elemento gráfico para los clientes.",
  },
  {
    keywords: ["analista", "analyst", "analista seo"],
    answer: "El rol **Analyst SEO** realiza análisis de posicionamiento, auditorías técnicas, informes de rendimiento y define estrategias para mejorar la visibilidad orgánica de los clientes.",
  },
  {
    keywords: ["implementador", "implementación", "técnico"],
    answer: "El rol **Implementador** ejecuta cambios técnicos en sitios web: implementa diseños, configura herramientas, sube contenido al CMS y realiza ajustes técnicos aprobados.",
  },
  // Clientes
  {
    keywords: ["cliente", "clientes", "cuenta", "cuentas", "brief"],
    answer: "Cada cliente aparece como una sección expandible en tu lista de tareas. Puedes hacer clic en el nombre del cliente para ver todas sus tareas y acceder a su ficha de brief en Orbidi desde el ícono de enlace externo.",
  },
  {
    keywords: ["brief", "briefing", "información cliente", "ficha"],
    answer: "El **brief** es el documento con toda la información del cliente: objetivos, estilo de comunicación, productos y preferencias. Puedes acceder al brief de cada cliente haciendo clic en el ícono de enlace externo junto al nombre del cliente.",
  },
  // Problemas técnicos
  {
    keywords: ["error", "problema", "falla", "no carga", "no funciona", "bug"],
    answer: "Si tienes un problema técnico, prueba primero estas soluciones:\n1. Refresca la página (Ctrl+R o Cmd+R)\n2. Haz clic en el botón 'Actualizar' en la esquina superior derecha\n3. Cierra sesión y vuelve a entrar\n\nSi el problema persiste, contacta a tu PM directamente.",
  },
  {
    keywords: ["contraseña", "password", "acceso", "login", "entrar", "sesión"],
    answer: "Si tienes problemas para entrar al sistema, contacta a tu PM para que te proporcionen las credenciales correctas. La contraseña del sistema es compartida por el equipo.",
  },
  // General
  {
    keywords: ["qué es", "para qué sirve", "deliveryos", "sistema", "app", "plataforma"],
    answer: "**DeliveryOS** es la plataforma operativa de Orqestra para gestionar la producción de contenido y servicios de marketing digital. Permite al equipo ver sus tareas asignadas, actualizar el progreso y al PM hacer seguimiento del trabajo en tiempo real.",
  },
  {
    keywords: ["orqestra", "plinng", "empresa", "compañía"],
    answer: "Orqestra (anteriormente Plinng) es la empresa de marketing digital donde trabajas. DeliveryOS es su plataforma interna de gestión operativa para coordinar la producción de servicios para los clientes.",
  },
];

// ── Suggested questions ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "¿Cómo marco una tarea como completada?",
  "¿Qué son las tareas de Feedback?",
  "¿Cuáles son los horarios de la jornada?",
  "¿Quién ve mi progreso?",
  "¿Cuándo recibiré nuevas tareas?",
];

// ── Answer matching ────────────────────────────────────────────────────────────
function findAnswer(question: string): string {
  const q = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let best: { score: number; answer: string } = { score: 0, answer: "" };

  for (const entry of KB) {
    const score = entry.keywords.filter(kw => q.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).length;
    if (score > best.score) best = { score, answer: entry.answer };
  }

  if (best.score === 0) {
    return "No encontré información específica sobre eso en mis conocimientos del sistema. Te recomiendo **contactar a tu PM** directamente — puede darte la respuesta exacta que necesitas. 😊";
  }
  return best.answer;
}

// ── Markdown-light renderer ────────────────────────────────────────────────────
function renderAnswer(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
    return <span key={i}>{parts}{i < text.split("\n").length - 1 && <br />}</span>;
  });
}

// ── Message types ──────────────────────────────────────────────────────────────
interface Message {
  id:      string;
  role:    "user" | "bot";
  text:    string;
  ts:      Date;
}

function msgId() { return Math.random().toString(36).slice(2); }

// ── Chat panel ─────────────────────────────────────────────────────────────────
interface ChatPanelProps {
  userName: string;
  onClose:  () => void;
}

function ChatPanel({ userName, onClose }: ChatPanelProps) {
  const firstName = userName.split(" ")[0];
  const [messages, setMessages] = useState<Message[]>([
    {
      id:   msgId(),
      role: "bot",
      text: `¡Hola ${firstName}! 👋 Soy el asistente de DeliveryOS. Estoy aquí para ayudarte con cualquier duda sobre el sistema.\n\n¿Qué necesitas saber?`,
      ts:   new Date(),
    },
  ]);
  const [input,   setInput]   = useState("");
  const [typing,  setTyping]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: msgId(), role: "user", text: text.trim(), ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // Simulate thinking delay for naturalness
    const delay = 400 + Math.random() * 600;
    setTimeout(() => {
      const answer = findAnswer(text);
      const botMsg: Message = { id: msgId(), role: "bot", text: answer, ts: new Date() };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
    }, delay);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="fixed bottom-24 right-6 z-[9998] w-[360px] max-w-[calc(100vw-3rem)] flex flex-col bg-white rounded-2xl border border-border shadow-2xl overflow-hidden"
      style={{ height: 520, maxHeight: "calc(100vh - 8rem)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-foreground shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#BEFF50] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Asistente DeliveryOS</p>
          <p className="text-[10px] text-white/50">Responde preguntas sobre el sistema</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            {/* Avatar */}
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
              msg.role === "bot" ? "bg-foreground" : "bg-[#60259F]"
            )}>
              {msg.role === "bot"
                ? <Bot className="w-3.5 h-3.5 text-[#BEFF50]" />
                : <User className="w-3.5 h-3.5 text-white" />
              }
            </div>
            {/* Bubble */}
            <div className={cn(
              "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
              msg.role === "bot"
                ? "bg-muted/60 text-foreground rounded-tl-sm"
                : "bg-[#60259F] text-white rounded-tr-sm"
            )}>
              {renderAnswer(msg.text)}
              <p className={cn(
                "text-[9px] mt-1 font-mono",
                msg.role === "bot" ? "text-muted-foreground/60" : "text-white/40"
              )}>
                {msg.ts.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-[#BEFF50]" />
            </div>
            <div className="bg-muted/60 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Suggested questions */}
        {showSuggestions && !typing && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold px-0.5">
              Preguntas frecuentes
            </p>
            {SUGGESTIONS.map(q => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border bg-white hover:bg-muted/40 hover:border-[#60259F]/30 text-muted-foreground hover:text-foreground transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-3 pb-3 pt-2 border-t border-border shrink-0">
        <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 focus-within:bg-muted/70 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe tu pregunta…"
            disabled={typing}
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#60259F] text-white disabled:opacity-30 hover:bg-[#7a30c0] transition-colors disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
interface ChatAssistantProps {
  userName: string;
}

export function ChatAssistant({ userName }: ChatAssistantProps) {
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);

  // Stop pulsing after first open
  const handleOpen = () => {
    setOpen(true);
    setPulse(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && <ChatPanel userName={userName} onClose={() => setOpen(false)} />}
      </AnimatePresence>

      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-[9997]">
        {/* Pulse ring */}
        {pulse && !open && (
          <motion.div
            className="absolute inset-0 rounded-full bg-[#60259F]/30"
            animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        )}

        <motion.button
          onClick={open ? () => setOpen(false) : handleOpen}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-colors",
            open
              ? "bg-muted border border-border text-foreground"
              : "bg-[#60259F] text-white hover:bg-[#7a30c0]"
          )}
          aria-label="Abrir asistente de ayuda"
        >
          <AnimatePresence mode="wait">
            {open ? (
              <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <X className="w-5 h-5" />
              </motion.div>
            ) : (
              <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                <MessageCircle className="w-5 h-5" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        {/* Tooltip */}
        {!open && pulse && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-foreground text-white text-[10px] font-medium px-2.5 py-1.5 rounded-lg pointer-events-none"
          >
            ¿Tienes dudas?
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 w-2 h-2 bg-foreground rotate-45" />
          </motion.div>
        )}
      </div>
    </>
  );
}
