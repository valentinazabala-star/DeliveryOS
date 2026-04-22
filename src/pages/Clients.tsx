import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ── Column config ─────────────────────────────────────────────────────────────
const DEFAULT_WIDTHS = [280, 120, 220, 90, 90, 120, 180, 180];
const COL_LABELS = ["Account UUID", "Company ID", "Account Name", "Activo", "Brief", "Frecuencia", "Creado", "Brief completado"];
const MIN_WIDTH = 80;
const PAGE_SIZE = 20;

// ── Resizable header ──────────────────────────────────────────────────────────
function ResizableHeader({ label, width, isLast, onResize }: {
  label: string; width: number; isLast: boolean;
  onResize: (delta: number) => void;
}) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      onResize(ev.clientX - startX.current);
      startX.current = ev.clientX;
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onResize]);

  return (
    <th style={{ width, minWidth: MIN_WIDTH }} className="relative text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3 py-2.5 bg-muted/40 border-b border-border select-none whitespace-nowrap font-mono">
      <span className="truncate block pr-3">{label}</span>
      {!isLast && (
        <div onMouseDown={onMouseDown} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-[#60259F]/30 transition-colors" />
      )}
    </th>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function Clients() {
  const [search, setSearch]           = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [briefFilter, setBriefFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [freqFilter, setFreqFilter]   = useState("all");
  const [page, setPage]               = useState(1);
  const [colWidths, setColWidths]     = useState<number[]>(DEFAULT_WIDTHS);
  const [forceRefresh, setForceRefresh] = useState(false);

  const queryParams = { page, limit: PAGE_SIZE, search, active: activeFilter, brief: briefFilter, freq: freqFilter, forceRefresh };

  const { data: result, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["accounts-real", queryParams],
    queryFn: () => api.accountsReal.list(queryParams),
    staleTime: Infinity,
    refetchInterval: (query) => query.state.data?.loading ? 5000 : false,
  });

  const rows       = result?.data  ?? [];
  const total      = result?.total ?? 0;
  const pages      = result?.pages ?? 1;
  const serverLoading = result?.loading ?? false;

  const handleRefresh = () => {
    setForceRefresh(true);
    setTimeout(() => { refetch().then(() => setForceRefresh(false)); }, 0);
  };

  // Apply search only on Enter or after 400ms debounce
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  };

  const handleFilter = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  const handleResize = useCallback((i: number, delta: number) => {
    setColWidths(prev => {
      const next = [...prev];
      next[i] = Math.max(MIN_WIDTH, next[i] + delta);
      return next;
    });
  }, []);

  const selectClass = "h-8 rounded-full border border-border bg-white px-3 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#60259F]/30 cursor-pointer";

  return (
    <div className="p-8 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#60259F] mb-1">Gestión de cuentas</p>
          <h2 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif", letterSpacing: "-0.03em" }}>Clients</h2>
          <p className="text-muted-foreground text-sm mt-1.5">Account registry and subscription overview.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isFetching}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white hover:border-[#60259F]/30 text-xs text-muted-foreground hover:text-[#60259F] transition-all disabled:opacity-40"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar..."
            className="h-8 pl-8 pr-3 rounded-full border border-border bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#60259F]/30 w-48"
          />
        </div>
        <select value={activeFilter} onChange={handleFilter(setActiveFilter)} className={selectClass}>
          <option value="all">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
        <select value={briefFilter} onChange={handleFilter(setBriefFilter)} className={selectClass}>
          <option value="all">Brief: todos</option>
          <option value="true">Brief completado</option>
          <option value="false">Sin brief</option>
        </select>
        <select value={freqFilter} onChange={handleFilter(setFreqFilter)} className={selectClass}>
          <option value="all">Frecuencia: todas</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground font-mono">
          {isLoading ? "Cargando..." : `${total} clientes`}
        </span>
      </div>

      {/* Loading / Error states */}
      {(isLoading || serverLoading) && (
        <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-[#60259F]/30 border-t-[#60259F] rounded-full animate-spin" />
          {serverLoading ? "Preparando datos del servidor... (~30s la primera vez)" : "Cargando cuentas..."}
        </div>
      )}
      {isError && (
        <div className="text-center py-20 text-red-500 text-sm">Error al cargar cuentas. Verifica que el servidor esté corriendo.</div>
      )}

      {/* Table */}
      {!isLoading && !isError && !serverLoading && (
        <>
          <div className="rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}>
                <thead>
                  <tr>
                    {COL_LABELS.map((label, i) => (
                      <ResizableHeader
                        key={label}
                        label={label}
                        width={colWidths[i]}
                        isLast={i === COL_LABELS.length - 1}
                        onResize={delta => handleResize(i, delta)}
                      />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm bg-white">No hay clientes que coincidan.</td></tr>
                  ) : rows.map((row: any, idx: number) => (
                    <tr key={row.account_uuid} className={cn("border-b border-border hover:bg-muted/30 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-muted/10")}>
                      <td style={{ width: colWidths[0] }} className="px-3 py-2 overflow-hidden">
                        <Link to={`/clients/${row.account_uuid}`} className="font-mono text-[10px] text-[#60259F] hover:underline truncate block">
                          {row.account_uuid}
                        </Link>
                      </td>
                      <td style={{ width: colWidths[1] }} className="px-3 py-2 overflow-hidden">
                        {row.company_id
                          ? <a href={`https://app-eu1.hubspot.com/contacts/25808060/record/0-2/${row.company_id}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-[#60259F] hover:underline truncate block">{row.company_id}</a>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td style={{ width: colWidths[2] }} className="px-3 py-2 overflow-hidden">
                        <span className="text-xs font-medium text-foreground truncate block">{row.account_name || "—"}</span>
                      </td>
                      <td style={{ width: colWidths[3] }} className="px-3 py-2 overflow-hidden">
                        <span className={cn("inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                          row.active ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {row.active ? "activo" : "inactivo"}
                        </span>
                      </td>
                      <td style={{ width: colWidths[4] }} className="px-3 py-2 overflow-hidden">
                        <span className={cn("inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                          row.brief_completed ? "bg-[#60259F]/10 text-[#60259F] border-[#60259F]/20" : "bg-muted text-muted-foreground border-border"
                        )}>
                          {row.brief_completed ? "✓ completo" : "pendiente"}
                        </span>
                      </td>
                      <td style={{ width: colWidths[5] }} className="px-3 py-2 overflow-hidden">
                        <span className="text-xs text-muted-foreground capitalize truncate block">{row.preferred_frequency || "—"}</span>
                      </td>
                      <td style={{ width: colWidths[6] }} className="px-3 py-2 overflow-hidden">
                        <span className="text-xs text-muted-foreground font-mono truncate block">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </span>
                      </td>
                      <td style={{ width: colWidths[7] }} className="px-3 py-2 overflow-hidden">
                        {row.brief_started_at
                          ? <span className="text-xs text-muted-foreground font-mono truncate block">
                              {new Date(row.brief_started_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                          : <span className="text-xs text-muted-foreground">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground font-mono">
                Página {page} de {pages} · {total} resultados
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-white hover:border-[#60259F]/30 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 2)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…"
                      ? <span key={`ellipsis-${i}`} className="w-7 text-center text-xs text-muted-foreground">…</span>
                      : <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          disabled={isFetching}
                          className={cn(
                            "w-7 h-7 rounded-lg border text-xs font-mono transition-colors",
                            page === p
                              ? "bg-[#60259F] text-white border-[#60259F]"
                              : "bg-white border-border hover:border-[#60259F]/30 text-muted-foreground"
                          )}
                        >
                          {p}
                        </button>
                  )
                }
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages || isFetching}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-border bg-white hover:border-[#60259F]/30 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
