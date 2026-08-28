import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { X, SplitSquareHorizontal, SplitSquareVertical } from "lucide-react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import type { SidebarObject } from "@/components/shell/sidebar-utils";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { UpdateDetailsButton } from "@/components/shell/UpdateDetailsButton";
import { PaneLayoutView } from "@/components/workspace/PaneLayoutView";
import { ObjectContent } from "@/components/workspace/ObjectContent";
import { findLeaf } from "@/components/workspace/paneTree";
import { useWorkspace } from "@/components/workspace/useWorkspace";
import { CampaignRosterSidebar } from "@/components/campaign/CampaignView";
import { useUserContext } from "./contexts/UserContext";
import "./index.css";

const ROSTER_SIDEBAR_KEY = "fables-roster-sidebar-campaign-id";

export default function Dashboard() {
  const { user, loading, objects } = useUserContext();
  const liveObjects = objects as SidebarObject[];
  const { tree, focusedPaneId, setFocusedPaneId, openObject, activateTab, closeObjectTab, split, splitAtEdge, dropTab, resize } = useWorkspace(liveObjects);
  const isMobile = useIsMobile();
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

  // The split-pane tiling chrome (per-pane tab strip, split buttons, resize
  // handles, the rounded/padded pane container) only earns its keep once
  // there's actually more than one pane on screen — which is the rare case,
  // not the default. Whenever the tree is just a single unsplit pane (true
  // for everyone until they deliberately split, and always true on mobile,
  // which never offers splitting at all) we skip PaneLayoutView entirely and
  // render the focused pane's active tab full-bleed, with its tab strip
  // folded into the header row instead (next to the sidebar trigger) — so
  // desktop and mobile share the same lean look in the common case, and the
  // moment someone actually splits, the full tiling UI reappears for real
  // multi-pane work exactly as before. On mobile the split buttons are
  // hidden (there's no room for a second pane on a phone) but the tree
  // itself is untouched, so a split made on desktop is still there, just not
  // shown, when opened later on a phone.
  const useCompactView = isMobile || tree.type === "leaf";
  const focusedLeaf = findLeaf(tree, focusedPaneId);
  const focusedTabObjects = (focusedLeaf?.tabs ?? [])
    .map(id => liveObjects.find(o => o.id === id))
    .filter((o): o is SidebarObject => !!o);
  const focusedActive = focusedLeaf?.activeId
    ? liveObjects.find(o => o.id === focusedLeaf.activeId) ?? null
    : null;

  return (
    <SidebarProvider className="h-svh max-h-svh overflow-hidden">
      <AppSidebar
        onSelectObject={obj => obj && openObject(obj.id)}
        onShowRosterSidebar={obj => setRosterSidebarCampaignId(prev => prev === obj.id ? null : obj.id)}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-2 sm:px-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          {useCompactView && user && focusedLeaf ? (
            <>
              <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
                {focusedTabObjects.length === 0 ? (
                  <span className="text-xs text-muted-foreground/40 px-1 select-none">No tabs open</span>
                ) : focusedTabObjects.map(obj => {
                  const isActive = obj.id === focusedLeaf.activeId;
                  return (
                    <button key={obj.id} type="button"
                      onClick={() => activateTab(focusedLeaf.id, obj.id)}
                      className={`group flex items-center gap-1 shrink-0 pl-3 pr-1.5 py-1.5 rounded-full text-xs transition-colors ${
                        isActive ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      }`}>
                      <span className="truncate max-w-24">{obj.name || "Untitled"}</span>
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); closeObjectTab(focusedLeaf.id, obj.id) }}
                        className="shrink-0 rounded-full p-0.5 opacity-60 hover:opacity-100 hover:bg-foreground/15"
                      >
                        <X className="size-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Splitting only makes sense with room for a second pane —
                  offered here (not just inside PaneView) since the compact
                  view has no per-pane strip of its own to put them in. The
                  instant a split happens the tree stops being a single leaf
                  and the full tiling view takes over, buttons and all. */}
              {!isMobile && focusedTabObjects.length > 0 && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => split(focusedLeaf.id, "row")} title="Split right"
                    className="size-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors">
                    <SplitSquareHorizontal className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => split(focusedLeaf.id, "column")} title="Split down"
                    className="size-7 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors">
                    <SplitSquareVertical className="size-3.5" />
                  </button>
                </div>
              )}
              <UpdateDetailsButton />
            </>
          ) : (
            <UpdateDetailsButton />
          )}
        </header>
        <div className="flex flex-1 flex-col overflow-hidden min-h-0 bg-background">
          {loading ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none">
              Loading…
            </div>
          ) : user ? (
            <div className={`flex-1 min-h-0 flex ${rosterCampaign && !isMobile ? "gap-2" : ""}`}>
              {useCompactView ? (
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                  {focusedActive ? (
                    <ObjectContent object={focusedActive} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground/40 select-none px-4 text-center">
                      {focusedTabObjects.length > 0 ? "Empty pane — pick a tab above" : "Click a sidebar item to open it"}
                    </div>
                  )}
                </div>
              ) : (
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
              )}
              {rosterCampaign && !isMobile && (
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
