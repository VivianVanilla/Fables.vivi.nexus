import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabase";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarObject } from "@/components/sidebar-utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { SpellBrowser } from "./spells/SpellBrowser";
import { BookOpen, Sparkles } from "lucide-react";
import "./index.css";

type Section = "welcome" | "spells";

const NAV_ITEMS = [
  {
    id: "welcome" as Section,
    label: "Welcome",
    icon: <BookOpen className="size-4" />,
    description: "Overview & getting started",
  },
  {
    id: "spells" as Section,
    label: "Spells",
    icon: <Sparkles className="size-4" />,
    description: "Browse & manage spells",
  },
];

export default function Documentation() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [section, setSection] = useState<Section>("welcome");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "there";

  const currentNav = NAV_ITEMS.find((n) => n.id === section)!;

  function handleSelectObject(obj: SidebarObject | null) {
    if (!obj || obj.type === "folder") return;
    navigate(`/dashboard?open=${encodeURIComponent(obj.id)}`);
  }

  return (
    <SidebarProvider>
      <AppSidebar onSelectObject={handleSelectObject} />
      <SidebarInset className="overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-800 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/documentation">Documentation</BreadcrumbLink>
              </BreadcrumbItem>
              {section !== "welcome" && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentNav.label}</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 min-h-0 bg-slate-950">
          {/* Sidebar nav */}
          <nav className="hidden md:flex flex-col w-48 shrink-0 border-r border-slate-800 p-2 gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-start gap-2.5 w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                  section === item.id
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${section === item.id ? "text-purple-400" : "text-slate-600"}`}>
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-[10px] text-slate-600 leading-tight mt-0.5 truncate">{item.description}</div>
                </div>
              </button>
            ))}
          </nav>

          {/* Mobile tab bar */}
          <div className="md:hidden absolute top-16 left-0 right-0 z-10 flex gap-1 px-3 py-2 border-b border-slate-800 bg-slate-950">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2 flex-1 justify-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  section === item.id
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-500 hover:bg-slate-900"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Content area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6 mt-12 md:mt-0">
            {section === "welcome" ? (
              <div className="max-w-2xl space-y-5">
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-5">
                  <div className="flex items-center gap-4">
                    {user?.user_metadata?.avatar_url && (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt="Profile"
                        className="size-14 rounded-full"
                      />
                    )}
                    <div>
                      <h1 className="text-xl font-bold">Hi {fullName}!</h1>
                      <p className="text-sm text-muted-foreground">Welcome to fables.vivi.nexus</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {NAV_ITEMS.filter((n) => n.id !== "welcome").map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSection(item.id)}
                      className="flex items-start gap-3 text-left rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-600 p-4 transition-all hover:bg-slate-900"
                    >
                      <span className="text-purple-400 mt-0.5 shrink-0">{item.icon}</span>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">{item.label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <SpellBrowser />
            )}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
