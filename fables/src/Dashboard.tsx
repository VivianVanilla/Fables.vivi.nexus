import { useEffect, useState } from "react";
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
import "./index.css";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [selectedObject, setSelectedObject] = useState<SidebarObject | null>(null);

  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    }

    loadUser();
  }, []);

  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "there";

  return (
    <SidebarProvider >
      <AppSidebar onSelectObject={setSelectedObject} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block flex justif" />
              <BreadcrumbItem>
                <BreadcrumbPage>Welcome</BreadcrumbPage>
              </BreadcrumbItem>
        
            </BreadcrumbList>
            
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-slate-950">
          <div className="rounded-xl bg-muted/50 p-6">
            <div className="flex items-center gap-4">
              {user?.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">Hi {fullName}!</h1>
                <p className="text-sm text-muted-foreground">
                  Welcome to your dashboard
                </p>
              </div>
            </div>
          </div>

          {user ? (
            <>
              <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min overflow-auto">
                {selectedObject ? (
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Raw JSON — {selectedObject.name}
                      </span>
                      <button
                        onClick={() => setSelectedObject(null)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        ✕ clear
                      </button>
                    </div>
                    <pre className="rounded-lg bg-slate-900 p-4 text-xs text-green-400 overflow-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedObject, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none">
                    Click a sidebar item to inspect its JSON
                  </div>
                )}
              </div>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}