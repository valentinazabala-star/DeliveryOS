import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Folder, Activity, ShieldCheck, FileText, CheckCircle, XCircle,
  Clock, ExternalLink, Building2, Globe, MapPin, Phone, Mail, Tag, Store,
  Instagram, Facebook, Users, AlignLeft, Sparkles, Palette, MessageSquare,
  Star, Zap, BarChart2, CalendarDays, RefreshCw, Timer, Package2, Layers,
  Ban, Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  orbidiAccountAdminChangeUrl,
  orbidiAccountBriefUrl,
  orbidiAccountGalleryUrl,
} from "@/lib/orbidiConsoleUrls";

// ── Frequency badge ────────────────────────────────────────────────────────────
const freqConfig: Record<string, { label: string; color: string }> = {
  monthly:   { label: "Mensual",    color: "bg-violet-50 text-violet-700 border-violet-200" },
  quarterly: { label: "Trimestral", color: "bg-teal-50 text-teal-700 border-teal-200" },
  annual:    { label: "Anual",      color: "bg-amber-50 text-amber-700 border-amber-200" },
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function ProfileRow({ icon: Icon, label, value, href }: {
  icon: any; label: string; value: React.ReactNode; href?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-0.5">{label}</p>
        {href
          ? <a href={href} target="_blank" rel="noreferrer" className="text-xs font-medium text-[#60259F] hover:underline break-all">{value}</a>
          : <p className="text-xs font-medium text-foreground break-words">{value}</p>
        }
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, href, color }: {
  icon: any; label: string; href?: string; color?: string;
}) {
  const Tag = href && href.startsWith("http") ? "a" : href ? Link as any : "button";
  const extraProps = href?.startsWith("http") ? { href, target: "_blank", rel: "noreferrer" } : href ? { to: href } : {};
  return (
    <Tag
      {...extraProps}
      className="flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border border-border bg-white hover:shadow-sm hover:border-[#60259F]/30 transition-all group"
    >
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center",
        color ?? "bg-muted group-hover:bg-[#60259F]/10"
      )}>
        <Icon className={cn("w-3.5 h-3.5", color ? "text-white" : "text-muted-foreground group-hover:text-[#60259F]")} />
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-[#60259F]">{label}</span>
    </Tag>
  );
}

function InsightRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
      <Icon className="w-3.5 h-3.5 text-[#60259F]/50 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xs font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold px-5 py-2 bg-muted/30 border-b border-border">
        {title}
      </p>
      <div className="px-5">{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ClientDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["account-profile", id],
    queryFn: () => api.accountProfile.get(id!),
    enabled: !!id,
  });

  const accountData = profile?.data;
  const briefData   = accountData?.brief;
  const profileData = accountData?.profile;
  const formValues  = briefData?.form_values ?? {};
  const hasBrief    = briefData?.is_completed === true;

  const businessName: string = profileData?.business_name || id || "";
  const initials = businessName.split(" ").slice(0, 2).map((w: string) => w[0] ?? "").join("").toUpperCase() || "??";

  const freq = accountData?.preferred_frequency ? freqConfig[accountData.preferred_frequency] : null;
  const isActive: boolean = accountData?.active ?? false;
  const createdAt = accountData?.created_at
    ? new Date(accountData.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    : null;

  if (!isLoading && !accountData) {
    return (
      <div className="p-8">
        <Link to="/clients" className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Volver a Clients
        </Link>
        <p className="text-muted-foreground">Cliente no encontrado.</p>
      </div>
    );
  }

  return (
    <div className="p-8 min-h-screen bg-background">

      {/* Back nav */}
      <Link to="/clients" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-xs transition-colors mb-6 group">
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        Volver a Clients
      </Link>

      <div className="flex gap-6 items-start">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* Hero card */}
          <div className="rounded-2xl border border-border shadow-sm overflow-hidden">

            {/* Gradient banner */}
            <div className="h-14 bg-gradient-to-r from-[#60259F] via-[#8B3DC8] to-[#4a1a7a] relative">
              {!isLoading && accountData && (
                <div className={cn(
                  "absolute top-3 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold",
                  isActive
                    ? "bg-green-500/20 text-green-200 border-green-400/30"
                    : "bg-slate-500/20 text-slate-300 border-slate-400/30"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", isActive ? "bg-green-400" : "bg-slate-400")} />
                  {isActive ? "Activo" : "Inactivo"}
                </div>
              )}
            </div>

            {/* White content — avatar pulls up with negative margin */}
            <div className="bg-white px-6 pb-5 pt-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#60259F] flex items-center justify-center text-white text-lg font-black shadow-lg ring-4 ring-white shrink-0 -mt-1">
                  {initials}
                </div>
                <div className="pt-1 min-w-0">
                  {isLoading
                    ? <div className="h-5 w-40 bg-muted rounded animate-pulse mb-1.5" />
                    : <h1 className="text-xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Cal Sans', sans-serif" }}>{businessName}</h1>
                  }
                </div>
              </div>

              {/* Stat pills */}
              {!isLoading && accountData && (
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  {freq && (
                    <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border", freq.color)}>
                      <RefreshCw className="w-3 h-3" />
                      {freq.label}
                    </span>
                  )}
                  {accountData.preferred_currency && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200">
                      <Zap className="w-3 h-3" />
                      {accountData.preferred_currency}
                    </span>
                  )}
                  {createdAt && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground px-2.5 py-1 rounded-full border border-border bg-muted/30">
                      <CalendarDays className="w-3 h-3" />
                      Desde {createdAt}
                    </span>
                  )}
                  {profileData?.category && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                      <Tag className="w-3 h-3" />
                      {profileData.category}
                    </span>
                  )}
                  {(accountData.subscription_name || accountData.plan_name) && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                      <Layers className="w-3 h-3" />
                      {accountData.subscription_name || accountData.plan_name}
                    </span>
                  )}
                </div>
              )}

              {/* Brief status bar */}
              <div className={cn(
                "mt-4 flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm",
                isLoading ? "bg-muted border-border text-muted-foreground"
                : hasBrief ? "bg-[#60259F]/5 border-[#60259F]/20 text-[#60259F]"
                : "bg-red-50 border-red-200 text-red-600"
              )}>
                {isLoading
                  ? <Clock className="w-4 h-4 shrink-0 animate-pulse" />
                  : hasBrief
                    ? <CheckCircle className="w-4 h-4 shrink-0" />
                    : <XCircle className="w-4 h-4 shrink-0" />
                }
                <span className="font-semibold text-sm">
                  {isLoading ? "Cargando..." : hasBrief ? "Brief diligenciado" : "Brief sin diligenciar"}
                </span>
                {hasBrief && briefData?.brief_started_at && (
                  <span className="ml-auto text-[10px] font-mono opacity-60">
                    {new Date(briefData.brief_started_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Profile info card */}
          {(isLoading || profileData) && (
            <div className="rounded-2xl border border-border bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 bg-muted/30">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Perfil del negocio</h2>
              </div>
              <div className="px-5">
                {isLoading ? (
                  <div className="py-6 space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${70 - i * 10}%` }} />
                    ))}
                  </div>
                ) : profileData ? (
                  <>
                    {profileData.business_sector && <ProfileRow icon={BarChart2} label="Sector"     value={profileData.business_sector} />}
                    {profileData.sector_industry && !profileData.business_sector && <ProfileRow icon={BarChart2} label="Sector"     value={profileData.sector_industry} />}
                    {profileData.website_url     && <ProfileRow icon={Globe}     label="Web"        value={profileData.website_url}    href={profileData.website_url} />}
                    {profileData.email           && <ProfileRow icon={Mail}      label="Email"      value={profileData.email} />}
                    {profileData.address         && <ProfileRow icon={MapPin}    label="Dirección"  value={profileData.address} />}
                    {profileData.working_hours   && <ProfileRow icon={Clock}     label="Horario"    value={profileData.working_hours} />}
                    {profileData.instagram       && <ProfileRow icon={Instagram} label="Instagram"  value={profileData.instagram}      href={profileData.instagram} />}
                    {profileData.facebook        && <ProfileRow icon={Facebook}  label="Facebook"   value={profileData.facebook}       href={profileData.facebook} />}
                    {profileData.products_or_services && (
                      <div className="py-3 border-b border-border last:border-0">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Store className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-medium mb-1">Productos / Servicios</p>
                            <p className="text-xs text-foreground whitespace-pre-line">{profileData.products_or_services}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Account-level metadata */}
                    {(accountData?.subscription_name || accountData?.plan_name) && (
                      <ProfileRow icon={Layers} label="Plan" value={accountData.subscription_name || accountData.plan_name} />
                    )}
                    {accountData?.source           && <ProfileRow icon={Layers}   label="Fuente"        value={accountData.source} />}
                    {accountData?.has_kd_product != null && (
                      <ProfileRow icon={Package2} label="Producto KD" value={accountData.has_kd_product ? "Sí" : "No"} />
                    )}
                    {accountData?.updated_at && (
                      <ProfileRow icon={RefreshCw} label="Actualizado" value={new Date(accountData.updated_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })} />
                    )}
                    {accountData?.deactivated_at && (
                      <ProfileRow icon={Ban} label="Desactivado" value={new Date(accountData.deactivated_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })} />
                    )}
                    {id && <ProfileRow icon={Hash} label="UUID" value={id} />}
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="rounded-2xl border border-border bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 bg-muted/30">
              <Zap className="w-3.5 h-3.5 text-muted-foreground" />
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Accesos rápidos</h2>
            </div>
            <div className="p-4 grid grid-cols-4 gap-2.5">
              <ActionBtn icon={Folder}      label="Drive" />
              <ActionBtn icon={Activity}    label="HubSpot" href={accountData?.hubspot_client_id ? `https://app-eu1.hubspot.com/contacts/25808060/record/0-2/${accountData.hubspot_client_id}` : undefined} />
              <ActionBtn icon={ShieldCheck} label="Access" />
              <ActionBtn icon={FileText}    label="Gallery"   href={id ? orbidiAccountGalleryUrl(id) : undefined} />
              <ActionBtn icon={Globe}       label="Brief"  href={id ? orbidiAccountBriefUrl(id) : undefined} />
              <ActionBtn icon={Building2}   label="Admin"  href={id ? orbidiAccountAdminChangeUrl(id) : undefined} />
              <ActionBtn icon={Timer}       label="Tasks"  href={`/tasks?uuid=${id}`} />
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Brief insights ──────────────────────────────── */}
        <div className="w-80 shrink-0">
          <div className="rounded-2xl border border-border bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-[#60259F]/8 to-transparent flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#60259F]" />
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#60259F]">Insights del Brief</h2>
              </div>
              {hasBrief && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#60259F]/10 text-[#60259F] border border-[#60259F]/20">
                  Completo
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="py-10 text-center">
                <div className="w-5 h-5 border-2 border-[#60259F]/30 border-t-[#60259F] rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Cargando...</p>
              </div>
            ) : !hasBrief ? (
              <div className="py-8 text-center px-5">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2.5">
                  <FileText className="w-4 h-4 text-muted-foreground/40" />
                </div>
                <p className="text-xs font-semibold text-foreground mb-1">Brief pendiente</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">El cliente aún no ha completado su brief.</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[calc(100vh-180px)] overflow-y-auto">

                {/* Empresa */}
                {(formValues.FIELD_COMPANY_NAME || formValues.FIELD_COMPANY_CATEGORY) && (
                  <BriefSection title="Empresa">
                    {formValues.FIELD_COMPANY_NAME        && <InsightRow icon={Building2}   label="Nombre"       value={formValues.FIELD_COMPANY_NAME} />}
                    {formValues.FIELD_COMPANY_CATEGORY    && <InsightRow icon={Tag}          label="Categoría"    value={formValues.FIELD_COMPANY_CATEGORY} />}
                    {formValues.FIELD_COMPANY_SUBCATEGORY && <InsightRow icon={Tag}          label="Subcategoría" value={formValues.FIELD_COMPANY_SUBCATEGORY} />}
                  </BriefSection>
                )}

                {/* Contacto */}
                {(formValues.FIELD_COUNTRY || formValues.FIELD_BILLING_ADDRESS || formValues.FIELD_BUSINESS_PHONE || formValues.FIELD_BUSINESS_EMAIL) && (
                  <BriefSection title="Contacto">
                    {formValues.FIELD_COUNTRY         && <InsightRow icon={MapPin}  label="País"      value={formValues.FIELD_COUNTRY} />}
                    {formValues.FIELD_BILLING_ADDRESS && <InsightRow icon={MapPin}  label="Dirección" value={formValues.FIELD_BILLING_ADDRESS} />}
                    {formValues.FIELD_BUSINESS_PHONE  && <InsightRow icon={Phone}   label="Teléfono"  value={formValues.FIELD_BUSINESS_PHONE} />}
                    {formValues.FIELD_BUSINESS_EMAIL  && <InsightRow icon={Mail}    label="Email"     value={formValues.FIELD_BUSINESS_EMAIL} />}
                  </BriefSection>
                )}

                {/* Presencia digital */}
                {(formValues.FIELD_WEBSITE_URL || formValues.FIELD_INSTAGRAM_URL || formValues.FIELD_FACEBOOK_URL || formValues.FIELD_TIKTOK_URL) && (
                  <BriefSection title="Presencia digital">
                    {formValues.FIELD_WEBSITE_URL   && <InsightRow icon={Globe}        label="Web"       value={formValues.FIELD_WEBSITE_URL} />}
                    {formValues.FIELD_INSTAGRAM_URL && <InsightRow icon={Instagram}    label="Instagram" value={formValues.FIELD_INSTAGRAM_URL} />}
                    {formValues.FIELD_FACEBOOK_URL  && <InsightRow icon={Facebook}     label="Facebook"  value={formValues.FIELD_FACEBOOK_URL} />}
                    {formValues.FIELD_TIKTOK_URL && formValues.FIELD_TIKTOK_URL !== "TikTok" && (
                      <InsightRow icon={ExternalLink} label="TikTok" value={formValues.FIELD_TIKTOK_URL} />
                    )}
                  </BriefSection>
                )}

                {/* Negocio */}
                {(formValues.FIELD_TARGET_CUSTOMER_ANSWER || formValues.FIELD_LARGE_ANSWER || formValues.FIELD_RELEVANT_DATES_ANSWER) && (
                  <BriefSection title="Negocio">
                    {formValues.FIELD_TARGET_CUSTOMER_ANSWER && <InsightRow icon={Users}     label="Público objetivo" value={formValues.FIELD_TARGET_CUSTOMER_ANSWER} />}
                    {formValues.FIELD_RELEVANT_DATES_ANSWER  && <InsightRow icon={CalendarDays} label="Fechas clave" value={formValues.FIELD_RELEVANT_DATES_ANSWER} />}
                    {formValues.FIELD_LARGE_ANSWER && (
                      <InsightRow icon={AlignLeft} label="Descripción" value={formValues.FIELD_LARGE_ANSWER.slice(0, 200) + (formValues.FIELD_LARGE_ANSWER.length > 200 ? "…" : "")} />
                    )}
                  </BriefSection>
                )}

                {/* Comunicación */}
                {(formValues.FIELD_COMMUNICATION_LANGUAGE || formValues.FIELD_COMMUNICATION_STYLE || formValues.FIELD_DESIGN_STYLE) && (
                  <BriefSection title="Comunicación">
                    {formValues.FIELD_COMMUNICATION_LANGUAGE && <InsightRow icon={MessageSquare} label="Idioma"  value={formValues.FIELD_COMMUNICATION_LANGUAGE} />}
                    {formValues.FIELD_COMMUNICATION_STYLE && Array.isArray(formValues.FIELD_COMMUNICATION_STYLE) && (
                      <InsightRow icon={Star}    label="Estilo"  value={formValues.FIELD_COMMUNICATION_STYLE.join(", ")} />
                    )}
                    {formValues.FIELD_DESIGN_STYLE && <InsightRow icon={Palette} label="Diseño"  value={formValues.FIELD_DESIGN_STYLE} />}
                  </BriefSection>
                )}

                {/* Tags / badges */}
                {(formValues.FIELD_IS_PHYSICAL_STORE || formValues.FIELD_HAS_WEBSITE || formValues.FIELD_HAS_SOCIAL_NETWORKS || formValues.FIELD_HAS_BRAND_MATERIAL ||
                  (Array.isArray(formValues.FIELD_KEYWORDS_TAGS_INPUT) && formValues.FIELD_KEYWORDS_TAGS_INPUT.length > 0)) && (
                  <div className="px-5 py-3.5 flex flex-wrap gap-1.5">
                    {formValues.FIELD_IS_PHYSICAL_STORE && (
                      <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">Local físico</span>
                    )}
                    {formValues.FIELD_HAS_WEBSITE && (
                      <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 uppercase tracking-wide">Tiene web</span>
                    )}
                    {formValues.FIELD_HAS_SOCIAL_NETWORKS && (
                      <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200 uppercase tracking-wide">Redes sociales</span>
                    )}
                    {formValues.FIELD_HAS_BRAND_MATERIAL && (
                      <span className="text-[9px] font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">Material de marca</span>
                    )}
                    {Array.isArray(formValues.FIELD_KEYWORDS_TAGS_INPUT) && formValues.FIELD_KEYWORDS_TAGS_INPUT.slice(0, 5).map((kw: string) => (
                      <span key={kw} className="text-[9px] font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">#{kw}</span>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
