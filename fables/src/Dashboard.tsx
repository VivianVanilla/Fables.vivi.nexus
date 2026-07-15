import { useEffect } from "react";
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
import { useUserContext } from "./contexts/UserContext";
import "./index.css";

export default function Dashboard() {
  const { user, loading, objects } = useUserContext();
  const liveObjects = objects as SidebarObject[];
  const { tree, focusedPaneId, setFocusedPaneId, openObject, activateTab, closeObjectTab, split, dropTab, resize } = useWorkspace(liveObjects);
  const [searchParams, setSearchParams] = useSearchParams();

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
    <SidebarProvider>
      <AppSidebar onSelectObject={obj => obj && openObject(obj.id)} />
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
            <div className="flex-1 min-h-0 rounded-xl bg-muted/50 overflow-hidden p-1">
              <PaneLayoutView
                node={tree}
                objects={liveObjects}
                focusedPaneId={focusedPaneId}
                onFocus={setFocusedPaneId}
                onActivateTab={activateTab}
                onCloseTab={closeObjectTab}
                onSplit={split}
                onDropTab={dropTab}
                onResize={resize}
              />
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
