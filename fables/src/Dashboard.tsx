import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarObject } from "@/components/sidebar-utils";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CharacterSheet } from "@/components/character";
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
        
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-slate-950">
        

          {user ? (
            <>
              <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min overflow-auto">
                {selectedObject?.type === "character" ? (
                  <CharacterSheet
                    key={selectedObject.id}
                    character={selectedObject}
                    onClose={() => setSelectedObject(null)}
                  />
                ) : selectedObject ? (
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