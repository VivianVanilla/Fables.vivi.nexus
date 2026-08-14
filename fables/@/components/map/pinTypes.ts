// ════════════════════════════════════════════════════════════════════════════
// pinTypes.ts — the icon/label for each map pin style, shared by the
// creation prompt (MapOverlay) and the edit picker (MapPinViewer) so the two
// pickers can't drift out of sync with each other or with the marker render.
// ════════════════════════════════════════════════════════════════════════════

import { MapPin as MapPinIcon, Skull, Cross, Archive, type LucideIcon } from "lucide-react"
import type { PinType } from "./useMapBoard"

export const PIN_TYPES: { value: PinType; label: string; Icon: LucideIcon }[] = [
  { value: "city", label: "City", Icon: MapPinIcon },
  { value: "boss", label: "Boss", Icon: Skull },
  { value: "grave", label: "Grave", Icon: Cross },
  { value: "chest", label: "Chest", Icon: Archive },
]

export function pinTypeIcon(type: PinType): LucideIcon {
  return PIN_TYPES.find(t => t.value === type)?.Icon ?? MapPinIcon
}
