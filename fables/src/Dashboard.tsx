import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import type { SidebarObject } from "@/components/sidebar-utils";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CharacterSheet } from "@/components/character";
import { CampaignView } from "@/components/campaign-view";
import { NoteView } from "@/components/NoteView";
import { useUserContext } from "./contexts/UserContext";
import "./index.css";

export default function Dashboard() {
  const { user, loading, objects } = useUserContext();
  const [selectedObject, setSelectedObject] = useState<SidebarObject | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-open object specified via ?open=<id> (e.g. navigated from Documentation)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || objects.length === 0) return;
    const target = objects.find(o => o.id === openId) as SidebarObject | undefined;
    if (target) {
      setSelectedObject(target);
      setSearchParams({}, { replace: true });
    }
  }, [objects, searchParams]);

  // Always use the live version from UserContext so stale snapshots don't stick
  const liveSelected = selectedObject
    ? ((objects.find(o => o.id === selectedObject.id) as SidebarObject | undefined) ?? selectedObject)
    : null;

  return (
    <SidebarProvider>
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
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none">
              Loading…
            </div>
          ) : user ? (
            <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min overflow-auto">
              {liveSelected?.type === "character" ? (
                <CharacterSheet
                  key={liveSelected.id}
                  character={liveSelected}
                  onClose={() => setSelectedObject(null)}
                />
              ) : liveSelected?.type === "campaign" ? (
                <CampaignView
                  key={liveSelected.id}
                  campaign={liveSelected}
                  onClose={() => setSelectedObject(null)}
                />
              ) : liveSelected?.type === "note" ? (
                <NoteView
                  key={liveSelected.id}
                  note={liveSelected}
                  onClose={() => setSelectedObject(null)}
                />
              ) : liveSelected ? (
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Raw JSON — {liveSelected.name}
                    </span>
                    <button
                      onClick={() => setSelectedObject(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      ✕ clear
                    </button>
                  </div>
                  <pre className="rounded-lg bg-slate-900 p-4 text-xs text-green-400 overflow-auto whitespace-pre-wrap wrap-break-word">
                    {JSON.stringify(liveSelected, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none">
                  Click a sidebar item to open it
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none">
              Not signed in
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
