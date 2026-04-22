import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Palmtree, Pencil, X, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { TEAM_DATA, roleConfig, workConfig, type TeamRole, type WorkType } from "@/data/teamData";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const today = new Date();

function isOnVacation(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const s = new Date(start), e = new Date(end);
  return today >= s && today <= e;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-[#60259F]", "bg-teal-600", "bg-blue-600", "bg-pink-600",
  "bg-orange-500", "bg-violet-600", "bg-cyan-600", "bg-rose-600",
  "bg-indigo-600", "bg-emerald-600", "bg-amber-600", "bg-sky-600",
  "bg-fuchsia-600", "bg-lime-600",
];

const ALL_ROLES: { value: TeamRole; label: string }[] = [
  { value: "Copy",               label: "Copy" },
  { value: "Designer",           label: "Diseñador" },
  { value: "Content_Specialist", label: "Content Specialist" },
  { value: "Analyst_Seo",        label: "Analista SEO" },
  { value: "Implementador",      label: "Implementador" },
];

const ALL_AREAS: { value: WorkType; label: string }[] = [
  { value: "feedback",    label: "Feedback" },
  { value: "nuevos",      label: "Nuevos" },
  { value: "recurrentes", label: "Recurrentes" },
  { value: "tickets",     label: "Tickets" },
];

interface PersonOverride { roles: TeamRole[]; workAreas: WorkType[]; }
type Overrides = Record<string, PersonOverride>;

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditOverrideModal({
  memberId, memberName, override, onClose, onSave, saving,
}: {
  memberId: string;
  memberName: string;
  override: PersonOverride;
  onClose: () => void;
  onSave: (id: string, roles: TeamRole[], workAreas: WorkType[]) => void;
  saving: boolean;
}) {
  const [roles, setRoles]         = useState<TeamRole[]>(override.roles);
  const [workAreas, setWorkAreas] = useState<WorkType[]>(override.workAreas);

  function toggleRole(r: TeamRole) {
    setRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  }
  function toggleArea(a: WorkType) {
    setWorkAreas(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#60259F]">Editar configuración</p>
            <p className="text-sm font-black text-foreground mt-0.5">{memberName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* Roles */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Roles</p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map(r => {
                const rc = roleConfig[r.value];
                const selected = roles.includes(r.value);
                return (
                  <button
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1",
                      selected ? `${rc.bg} ${rc.color} ring-1 ring-current` : "bg-muted/30 text-muted-foreground border-border hover:border-current"
                    )}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    {r.label}
                  </button>
                );
              })}
            </div>
            {roles.length === 0 && (
              <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-2 py-1">
                Sin roles seleccionados — se usará el rol base del colaborador.
              </p>
            )}
          </div>

          {/* Work areas */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Áreas de trabajo</p>
            <div className="flex flex-wrap gap-2">
              {ALL_AREAS.map(a => {
                const wc = workConfig[a.value];
                const selected = workAreas.includes(a.value);
                return (
                  <button
                    key={a.value}
                    onClick={() => toggleArea(a.value)}
                    className={cn(
                      "text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5",
                      selected ? `${wc.color} ring-1 ring-current` : "bg-muted/30 text-muted-foreground border-border hover:border-current"
                    )}
                  >
                    {selected && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", wc.dot)} />}
                    {a.label}
                  </button>
                );
              })}
            </div>
            {workAreas.length === 0 && (
              <p className="text-[10px] text-muted-foreground/60 bg-muted/30 rounded-lg px-2 py-1">
                Sin áreas seleccionadas — se usará el área base del colaborador.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose}
            className="h-8 px-4 rounded-full border border-border text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onSave(memberId, roles, workAreas)}
            disabled={saving}
            className="h-8 px-4 rounded-full bg-[#60259F] text-white text-xs font-bold hover:bg-[#4a1a7a] disabled:opacity-60 transition-colors"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────
function MemberCard({
  member, i, prog, onVacation, override, canEdit, onEditClick,
}: {
  member: typeof TEAM_DATA[0];
  i: number;
  prog?: { total: number; done: number; inProgress: number };
  onVacation: boolean;
  override: PersonOverride;
  canEdit: boolean;
  onEditClick: (id: string) => void;
}) {
  const effectiveRoles = override.roles.length > 0 ? override.roles : [member.role];
  const effectiveAreas = override.workAreas.length > 0 ? override.workAreas : [member.trabajo_actual];
  const isEdited = override.roles.length > 0 || override.workAreas.length > 0;
  const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];

  return (
    <div className="relative group bg-white rounded-2xl border border-border hover:border-[#60259F]/30 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Edit button — PM only */}
      {canEdit && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onEditClick(member.id); }}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-lg bg-white border border-border text-muted-foreground hover:text-[#60259F] hover:border-[#60259F]/40 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
          title="Editar roles y áreas"
        >
          <Pencil className="w-3 h-3" />
        </button>
      )}

      {/* Progress / status bar */}
      {prog && prog.total > 0 ? (
        <div className="h-1 w-full bg-muted flex overflow-hidden">
          <div className="bg-green-400 transition-all" style={{ width: `${Math.round((prog.done / prog.total) * 100)}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${Math.round((prog.inProgress / prog.total) * 100)}%` }} />
        </div>
      ) : (
        <div className={cn("h-1 w-full", onVacation ? "bg-orange-400" : "bg-[#BEFF50]")} />
      )}

      <Link to={`/team/${member.id}`} className="block p-4 space-y-2.5">
        {/* Avatar + badges */}
        <div className="flex items-start justify-between">
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm", avatarColor)}>
            {getInitials(member.person_name)}
          </div>
          <div className="flex flex-col items-end gap-1">
            {onVacation && (
              <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 border border-orange-200">
                <Palmtree className="w-2.5 h-2.5" /> Vacaciones
              </span>
            )}
            {isEdited && (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[#60259F]/10 text-[#60259F] border border-[#60259F]/20">
                ✎ PM
              </span>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <p className="text-sm font-bold text-foreground leading-tight group-hover:text-[#60259F] transition-colors">
            {member.person_name}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{member.person_email}</p>
        </div>

        {/* Roles */}
        <div className="flex flex-wrap gap-1">
          {effectiveRoles.map(r => {
            const rc = roleConfig[r];
            return (
              <span key={r} className={cn("inline-flex items-center text-[9px] font-semibold px-1.5 py-0.5 rounded border", rc.bg, rc.color)}>
                {rc.label}
              </span>
            );
          })}
        </div>

        {/* Work areas */}
        <div className="flex flex-wrap gap-1">
          {effectiveAreas.map(a => {
            const wc = workConfig[a];
            return (
              <div key={a} className={cn("flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-lg border", wc.color)}>
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", wc.dot)} />
                {wc.label}
              </div>
            );
          })}
        </div>

        {/* Task progress */}
        {prog && prog.total > 0 && (
          <div className="text-[9px] font-mono text-muted-foreground flex items-center gap-2">
            <span>{prog.total} tareas</span>
            {prog.done > 0 && <span className="text-green-600 font-semibold">{prog.done} ✓</span>}
            {prog.inProgress > 0 && <span className="text-amber-500">{prog.inProgress} ↻</span>}
          </div>
        )}
      </Link>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Team() {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);

  const isPM = user?.role === "management";

  const { data: lastAssignment } = useQuery<any | null>({
    queryKey: ["assignment-last"],
    queryFn:  () => api.assignment.getLast(),
    retry: false,
    staleTime: 60_000,
  });

  const { data: serverStatuses = {} } = useQuery<Record<string, any>>({
    queryKey: ["task-statuses"],
    queryFn:  () => api.taskStatuses.getAll(),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const { data: overridesRaw = {} } = useQuery<Record<string, { roles: string[]; workAreas: string[] }>>({
    queryKey: ["team-overrides"],
    queryFn:  () => api.teamOverrides.getAll(),
    retry: false,
    staleTime: Infinity,
    enabled: isPM,
  });

  const overrides: Overrides = {};
  for (const m of TEAM_DATA) {
    const raw = overridesRaw[m.id];
    overrides[m.id] = {
      roles:     (raw?.roles     ?? []) as TeamRole[],
      workAreas: (raw?.workAreas ?? []) as WorkType[],
    };
  }

  const saveMutation = useMutation({
    mutationFn: ({ id, roles, workAreas }: { id: string; roles: TeamRole[]; workAreas: WorkType[] }) =>
      api.teamOverrides.set(id, roles, workAreas),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-overrides"] });
      setEditingId(null);
    },
  });

  const handleSave = useCallback((id: string, roles: TeamRole[], workAreas: WorkType[]) => {
    saveMutation.mutate({ id, roles, workAreas });
  }, [saveMutation]);

  const personProgress: Record<string, { total: number; done: number; inProgress: number }> = {};
  for (const s of lastAssignment?.schedules ?? []) {
    const taskIds: string[] = (s.days ?? []).flatMap((d: any) => d.tasks.map((t: any) => t.task_id));
    personProgress[s.person_id] = {
      total:      taskIds.length,
      done:       taskIds.filter(id => serverStatuses[id]?.status === "done").length,
      inProgress: taskIds.filter(id => serverStatuses[id]?.status === "in_progress").length,
    };
  }

  const byRole = TEAM_DATA.reduce((acc, m) => {
    if (!acc[m.role]) acc[m.role] = [];
    acc[m.role].push(m);
    return acc;
  }, {} as Record<string, typeof TEAM_DATA>);

  const editingMember = editingId ? TEAM_DATA.find(m => m.id === editingId) : null;

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Orqestra</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>
            Team
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {TEAM_DATA.length} colaboradores · {Object.keys(byRole).length} roles
          </p>
        </div>
        {isPM && (
          <p className="text-[10px] text-[#60259F] bg-[#60259F]/5 border border-[#60259F]/20 px-3 py-1.5 rounded-full">
            Pasa el cursor sobre una tarjeta → ✎ para editar roles y áreas
          </p>
        )}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {TEAM_DATA.map((member, i) => (
          <MemberCard
            key={member.id}
            member={member}
            i={i}
            prog={personProgress[member.id]}
            onVacation={isOnVacation(member.vacation_start, member.vacation_end)}
            override={overrides[member.id]}
            canEdit={isPM}
            onEditClick={setEditingId}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editingId && editingMember && (
        <EditOverrideModal
          memberId={editingId}
          memberName={editingMember.person_name}
          override={overrides[editingId]}
          onClose={() => setEditingId(null)}
          onSave={handleSave}
          saving={saveMutation.isPending}
        />
      )}
    </div>
  );
}
