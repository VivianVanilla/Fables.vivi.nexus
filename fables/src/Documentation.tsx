import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarObject } from "@/components/sidebar-utils";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SpellBrowser } from "./spells/SpellBrowser";
import { DocBrowser } from "@/components/documentation/DocBrowser";
import type { DocType } from "@/components/documentation/doc-types";
import { ADMIN_EMAILS } from "@/components/documentation/doc-types";
import { EquippedTagBadge } from "@/components/gambling/EquippedTagBadge";
import { BookOpen, Sparkles, LayoutGrid, Swords, Gem, Users, Eye, ShieldCheck } from "lucide-react";
import "./index.css";

type Section = "welcome" | "spells" | "classes" | "feats" | "items" | "races";

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "welcome",  label: "Welcome",  icon: <BookOpen    className="size-4" /> },
  { id: "spells",   label: "Spells",   icon: <Sparkles   className="size-4" /> },
  { id: "classes",  label: "Classes",  icon: <LayoutGrid className="size-4" /> },
  { id: "feats",    label: "Feats",    icon: <Swords     className="size-4" /> },
  { id: "items",    label: "Items",    icon: <Gem        className="size-4" /> },
  { id: "races",    label: "Races",    icon: <Users      className="size-4" /> },
];

const DOC_SECTIONS = new Set<Section>(["classes", "feats", "items", "races"]);

export default function Documentation() {
  const navigate   = useNavigate();
  const [user,      setUser]      = useState<any>(null);
  const [section,   setSection]   = useState<Section>("welcome");
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUser(data.user)); }, []);

  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "there";
  const isAdmin  = !!user?.email && ADMIN_EMAILS.includes(user.email);
  const [spellClassFilter, setSpellClassFilter] = useState<string[]>([]);

  function handleGoToSpells(className: string) {
    setSpellClassFilter([className]);
    setSection("spells");
  }

  function handleSelectObject(obj: SidebarObject | null) {
    if (!obj || obj.type === "folder") return;
    navigate(`/dashboard?open=${encodeURIComponent(obj.id)}`);
  }

  return (
    <SidebarProvider>
      <AppSidebar onSelectObject={handleSelectObject} />
      <SidebarInset className="overflow-hidden flex flex-col h-screen">

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 bg-background">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <EquippedTagBadge />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:block">
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/documentation">Docs</BreadcrumbLink>
              </BreadcrumbItem>
              {section !== "welcome" && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="capitalize">{section}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>

          {isAdmin && (
            <button
              onClick={() => setAdminMode(m => !m)}
              className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                adminMode
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                  : "bg-muted border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {adminMode ? <ShieldCheck className="size-3.5" /> : <Eye className="size-3.5" />}
              <span className="hidden sm:inline">{adminMode ? "Admin Mode" : "Viewer"}</span>
            </button>
          )}
        </header>

        {/* ── Full-width horizontal tab bar ───────────────────────────── */}
        <nav className="flex shrink-0 border-b border-border bg-background overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium shrink-0 border-b-2 transition-colors whitespace-nowrap ${
                section === item.id
                  ? "border-purple-500 text-foreground bg-card/40"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/20"
              }`}
            >
              <span className={section === item.id ? "text-purple-400" : "text-muted-foreground"}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* ── Content ─────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-8">

            {/* Welcome */}
            {section === "welcome" && (
              <div className="space-y-6">
                <div className="rounded-xl bg-card border border-border p-5">
                  <div className="flex items-center gap-4">
                    {user?.user_metadata?.avatar_url && (
                      <img src={user.user_metadata.avatar_url} alt="" className="size-12 rounded-full ring-2 ring-border" />
                    )}
                    <div>
                      <h1 className="text-xl font-bold text-foreground">Hi {fullName}!</h1>
                      <p className="text-sm text-muted-foreground mt-0.5">Browse rules, classes, spells, items, and more.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {NAV_ITEMS.filter(n => n.id !== "welcome").map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSection(item.id)}
                      className="group flex flex-col items-start gap-3 p-5 rounded-xl bg-card border border-border hover:border-border hover:bg-muted/80 transition-all text-left"
                    >
                      <span className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                        {item.id === "spells"  && <Sparkles   className="size-6" />}
                        {item.id === "classes" && <LayoutGrid className="size-6" />}
                        {item.id === "feats"   && <Swords     className="size-6" />}
                        {item.id === "items"   && <Gem        className="size-6" />}
                        {item.id === "races"   && <Users      className="size-6" />}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                          {item.id === "spells"  && "Browse & manage spells"}
                          {item.id === "classes" && "Core & homebrew classes"}
                          {item.id === "feats"   && "Core & homebrew feats"}
                          {item.id === "items"   && "Core & homebrew items"}
                          {item.id === "races"   && "Core & homebrew races"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Spells */}
            {section === "spells" && (
              <SpellBrowser isAdmin={isAdmin} adminEnabled={adminMode} initialClasses={spellClassFilter} />
            )}

            {/* Classes / Feats / Items / Races */}
            {DOC_SECTIONS.has(section) && (
              <DocBrowser
                type={section as DocType}
                isAdminMode={adminMode}
                userId={user?.id ?? null}
                userEmail={user?.email ?? null}
                onGoToSpells={handleGoToSpells}
              />
            )}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
