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
import { EquippedTagBadge } from "@/components/gambling/EquippedTagBadge";
import { PaneLayoutView } from "@/components/workspace/PaneLayoutView";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { CampaignRosterSidebar } from "@/components/campaign-view";
import { useUserContext } from "./contexts/UserContext";
import "./index.css";

const ROSTER_SIDEBAR_KEY = "fables-roster-sidebar-campaign-id";

export default function Dashboard() {
  const { user, loading, objects } = useUserContext();
  const liveObjects = objects as SidebarObject[];
  const { tree, focusedPaneId, setFocusedPaneId, openObject, activateTab, closeObjectTab, split, splitAtEdge, dropTab, resize } = useWorkspace(liveObjects);
  const [searchParams, setSearchParams] = useSearchParams();
  const [rosterSidebarCampaignId, setRosterSidebarCampaignId] = useState<string | null>(
    () => { try { return localStorage.getItem(ROSTER_SIDEBAR_KEY) } catch { return null } }
  );

  useEffect(() => {
    try {
      if (rosterSidebarCampaignId) localStorage.setItem(ROSTER_SIDEBAR_KEY, rosterSidebarCampaignId)
      else localStorage.removeItem(ROSTER_SIDEBAR_KEY)
    } catch { /* ignore */ }
  }, [rosterSidebarCampaignId]);

  const rosterCampaign = rosterSidebarCampaignId
    ? liveObjects.find(o => o.id === rosterSidebarCampaignId && o.type === "campaign")
    : undefined;

  // Auto-open object specified via ?open=<id> (e.g. navigated from Documentation)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || objects.length === 0) return;
    const target = objects.find(o => o.id === openId);
    if (target) {
      openObject(target.id);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, searchParams]);

  return (
    <SidebarProvider className="h-svh max-h-svh overflow-hidden">
      <AppSidebar
        onSelectObject={obj => obj && openObject(obj.id)}
        onShowRosterSidebar={obj => setRosterSidebarCampaignId(prev => prev === obj.id ? null : obj.id)}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <EquippedTagBadge />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-background overflow-hidden min-h-0">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none">
              Loading…
            </div>
          ) : user ? (
            <div className="flex-1 min-h-0 flex gap-2">
              <div className="flex-1 min-h-0 min-w-0 rounded-xl bg-muted/50 overflow-hidden p-1">
                <PaneLayoutView
                  node={tree}
                  objects={liveObjects}
                  focusedPaneId={focusedPaneId}
                  onFocus={setFocusedPaneId}
                  onActivateTab={activateTab}
                  onCloseTab={closeObjectTab}
                  onSplit={split}
                  onSplitAtEdge={splitAtEdge}
                  onDropTab={dropTab}
                  onResize={resize}
                />
              </div>
              {rosterCampaign && (
                <CampaignRosterSidebar
                  campaign={rosterCampaign}
                  onClose={() => setRosterSidebarCampaignId(null)}
                  onOpenCharacter={openObject}
                />
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
