import { useState, useMemo } from "react";
import { Clock, Users, Filter, X, ChevronUp, ChevronDown, Plus, Trash2, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STANDARDS, categoryColors, roleColors, ProductCategory, TaskStandard } from "@/data/taskStandards";

const ROLES: { key: keyof TaskStandard; label: string }[] = [
  { key: "content_specialist", label: "Content Specialist" },
  { key: "implementador",      label: "Implementador" },
  { key: "analyst_seo",        label: "Analyst SEO" },
];

const CATEGORIES: ProductCategory[] = ["SEO", "RRSS", "WEB", "GMB"];

function formatMin(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function newBlankTask(): TaskStandard {
  return {
    id: crypto.randomUUID(),
    product_category: "SEO",
    product_name: "",
    clickup_task_name: "",
    time_minutes: 15,
    content_specialist: false,
    implementador: false,
    analyst_seo: false,
  };
}

export function Workload() {
  const [tasks, setTasks] = useState<TaskStandard[]>(TASK_STANDARDS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskStandard | null>(null);
  const [filterCategory, setFilterCategory] = useState<ProductCategory | "">("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterText, setFilterText] = useState("");
  const [sortKey, setSortKey] = useState<"time_minutes" | "product_name" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: "time_minutes" | "product_name") => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const startEdit = (task: TaskStandard) => {
    setEditingId(task.id);
    setEditDraft({ ...task });
  };

  const saveEdit = () => {
    if (!editDraft) return;
    if (!editDraft.product_name.trim() || !editDraft.clickup_task_name.trim()) return;
    if (editDraft.time_minutes < 1) return;
    setTasks(prev => prev.map(t => t.id === editDraft.id ? editDraft : t));
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (editingId === id) cancelEdit();
  };

  const addTask = () => {
    const blank = newBlankTask();
    setTasks(prev => [...prev, blank]);
    startEdit(blank);
  };

  const filtered = useMemo(() => {
    let result = [...tasks];
    if (filterCategory) result = result.filter(t => t.product_category === filterCategory);
    if (filterRole) result = result.filter(t => (t as any)[filterRole] === true);
    if (filterText) {
      const q = filterText.toLowerCase();
      result = result.filter(t => t.clickup_task_name.toLowerCase().includes(q) || t.product_name.toLowerCase().includes(q));
    }
    if (sortKey) {
      result.sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        return sortDir === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
      });
    }
    return result;
  }, [tasks, filterCategory, filterRole, filterText, sortKey, sortDir]);

  const totalByCategory = useMemo(() =>
    CATEGORIES.map(cat => ({
      cat,
      count: tasks.filter(t => t.product_category === cat).length,
      minutes: tasks.filter(t => t.product_category === cat).reduce((s, t) => s + t.time_minutes, 0),
    })).filter(x => x.count > 0),
  [tasks]);

  const totalByRole = useMemo(() =>
    ROLES.map(r => ({
      ...r,
      count: tasks.filter(t => (t as any)[r.key] === true).length,
      minutes: tasks.filter(t => (t as any)[r.key] === true).reduce((s, t) => s + t.time_minutes, 0),
    })),
  [tasks]);

  const hasFilters = filterCategory || filterRole || filterText;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Team</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Tiempos de Asignación
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Estándares de tiempo por tarea y rol — base para planificación de carga de trabajo.</p>
        </div>
        <button
          onClick={addTask}
          className="flex items-center gap-2 px-4 py-2 bg-[#BEFF50] hover:bg-[#BEFF50]/90 text-black font-bold text-sm rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> Nueva tarea
        </button>
      </div>

      {/* Summary cards by category */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {totalByCategory.map(({ cat, count, minutes }) => {
          const c = categoryColors[cat];
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? "" : cat)}
              className={cn(
                "bg-white rounded-2xl border p-4 text-left transition-all hover:shadow-md",
                filterCategory === cat ? "border-[#60259F] shadow-md ring-1 ring-[#60259F]/20" : "border-border"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", c.bg, c.text, c.border)}>{cat}</span>
                <span className={cn("w-2 h-2 rounded-full", c.dot)} />
              </div>
              <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{formatMin(minutes)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{count} tareas · tiempo total</p>
            </button>
          );
        })}
      </div>

      {/* Role load strip */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-[#60259F]" />
          <p className="text-sm font-bold text-foreground">Carga por rol</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {totalByRole.map(({ key, label, count, minutes }) => (
            <button
              key={key as string}
              onClick={() => setFilterRole(filterRole === key ? "" : key as string)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all hover:shadow-sm",
                filterRole === key ? "border-[#60259F] bg-[#60259F]/5 ring-1 ring-[#60259F]/20" : "border-border hover:border-[#60259F]/30"
              )}
            >
              <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", roleColors[key as string])}>
                {label}
              </span>
              <p className="text-lg font-black text-foreground mt-2" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{formatMin(minutes)}</p>
              <p className="text-[10px] text-muted-foreground">{count} {count === 1 ? "tarea" : "tareas"}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Buscar tarea..."
            className="pl-8 pr-3 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#60259F]/40 w-48"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setFilterCategory(""); setFilterRole(""); setFilterText(""); }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto font-mono">
          {filtered.length} / {tasks.length} tareas
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-5 py-3 w-24">Producto</th>
              <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-4 py-3 w-40">
                <button onClick={() => handleSort("product_name")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  Categoría
                  {sortKey === "product_name" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                </button>
              </th>
              <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-4 py-3">Tarea</th>
              <th className="text-left text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-4 py-3 w-64">Roles</th>
              <th className="text-right text-[10px] uppercase tracking-widest text-muted-foreground font-mono px-4 py-3 w-24">
                <button onClick={() => handleSort("time_minutes")} className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors">
                  <Clock className="w-3 h-3" /> Tiempo
                  {sortKey === "time_minutes" ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
                </button>
              </th>
              <th className="w-20 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No hay tareas que coincidan.</td></tr>
            ) : filtered.map(task => {
              const isEditing = editingId === task.id;
              const draft = isEditing ? editDraft! : task;
              const c = categoryColors[draft.product_category];
              const activeRoles = ROLES.filter(r => (draft as any)[r.key] === true);

              return (
                <tr key={task.id} className={cn("transition-colors", isEditing ? "bg-[#60259F]/3 ring-1 ring-inset ring-[#60259F]/10" : "hover:bg-muted/20")}>
                  {/* Product category */}
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <select
                        value={draft.product_category}
                        onChange={e => setEditDraft(d => ({ ...d!, product_category: e.target.value as ProductCategory }))}
                        className="text-[10px] font-bold border border-[#60259F]/30 rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-[#60259F]/40"
                      >
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    ) : (
                      <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded border", c.bg, c.text, c.border)}>
                        {task.product_category}
                      </span>
                    )}
                  </td>

                  {/* Product name */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={draft.product_name}
                        onChange={e => setEditDraft(d => ({ ...d!, product_name: e.target.value }))}
                        placeholder="Ej: Reel de Instagram"
                        className="text-xs w-full border-b border-[#60259F]/40 bg-transparent focus:outline-none focus:border-[#60259F] py-0.5"
                      />
                    ) : (
                      <span className="text-xs font-medium text-foreground">{task.product_name}</span>
                    )}
                  </td>

                  {/* Task name */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <input
                        value={draft.clickup_task_name}
                        onChange={e => setEditDraft(d => ({ ...d!, clickup_task_name: e.target.value }))}
                        placeholder="Nombre de la tarea en ClickUp"
                        className="text-xs w-full border-b border-[#60259F]/40 bg-transparent focus:outline-none focus:border-[#60259F] py-0.5"
                      />
                    ) : (
                      <span className="text-xs text-foreground">{task.clickup_task_name}</span>
                    )}
                  </td>

                  {/* Roles */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ROLES.map(r => (
                          <button
                            key={r.key as string}
                            onClick={() => setEditDraft(d => ({ ...d!, [r.key]: !(d as any)[r.key] }))}
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all",
                              (draft as any)[r.key] ? roleColors[r.key as string] : "bg-muted text-muted-foreground border-border opacity-50"
                            )}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {activeRoles.map(r => (
                          <span key={r.key as string} className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded border", roleColors[r.key as string])}>
                            {r.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Time */}
                  <td className="px-4 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number"
                        min={1}
                        value={draft.time_minutes}
                        onChange={e => setEditDraft(d => ({ ...d!, time_minutes: Math.max(1, parseInt(e.target.value) || 1) }))}
                        className="text-xs font-mono w-16 text-right border-b border-[#60259F]/40 bg-transparent focus:outline-none focus:border-[#60259F] py-0.5"
                      />
                    ) : (
                      <span className="font-mono text-sm font-bold text-foreground">{formatMin(task.time_minutes)}</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#BEFF50] hover:bg-[#BEFF50]/80 transition-colors">
                            <Check className="w-3.5 h-3.5 text-black" />
                          </button>
                          <button onClick={cancelEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(task)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-[#60259F]">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteTask(task.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-muted/20 border-t border-border">
              <tr>
                <td colSpan={4} className="px-5 py-2.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Total</td>
                <td className="px-4 py-2.5 text-right font-mono text-sm font-black text-foreground">
                  {formatMin(filtered.reduce((s, t) => s + t.time_minutes, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
