// ════════════════════════════════════════════════════════════════════════════
// MapPinViewer.tsx — full-screen viewer for a single map pin ("ping"), opened
// by clicking a pin on MapOverlay. Shows the pin's city name plus a corkboard
// of sticky notes (see MapNotesPanel) — it's a shared party map, so renaming,
// recoloring, deleting, and annotating are all open to the whole party, not
// just whoever placed the pin.
// ════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react"
import { Pencil, Trash2, Check, X, Palette, ExternalLink } from "lucide-react"
import { PIN_COLORS, type MapPin, type MapPinNote, type PinType } from "./useMapBoard"
import { PIN_TYPES } from "./pinTypes"
import { MapNotesPanel } from "./MapNotesPanel"
import type { NpcTracker } from "../npcTracker/useNpcTrackers"

export function MapPinViewer({
  pin, notes, npcsHere, currentUserId, onClose, onRename, onChangeColor, onChangeType, onDeletePin, onOpenNpc, onAddNote, onEditNote, onDeleteNote,
}: {
  pin: MapPin
  notes: MapPinNote[]
  // NPC Tracker entries whose "last seen at" points at this pin — see
  // useNpcTrackers's location_pin_id.
  npcsHere: NpcTracker[]
  currentUserId: string
  onClose: () => void
  onRename: (name: string) => void
  onChangeColor: (color: string) => void
  onChangeType: (type: PinType) => void
  onDeletePin: () => void
  onOpenNpc: (npcId: string) => void
  onAddNote: (content: string) => void
  onEditNote: (id: string, content: string) => void
  onDeleteNote: (id: string) => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(pin.name)
  const [pickingColor, setPickingColor] = useState(false)
  const [pickingType, setPickingType] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  // A member expression (`typeEntry.Icon`) in JSX tag position, not a bare
  // capitalized variable — the latter trips react-hooks/static-components
  // ("component created during render") even though the underlying icon
  // reference is always one of the same few stable, module-level imports.
  const typeEntry = useMemo(() => PIN_TYPES.find(t => t.value === pin.pin_type) ?? PIN_TYPES[0], [pin.pin_type])

  function saveName() {
    const next = nameDraft.trim()
    if (next && next !== pin.name) onRename(next)
    setEditingName(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-5 py-3 shrink-0" onClick={e => e.stopPropagation()}>
        {editingName ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameDraft(pin.name); setEditingName(false) } }}
              className="text-sm font-semibold bg-white/10 text-white rounded-lg px-2.5 py-1.5 outline-none"
            />
            <button type="button" onClick={saveName} className="size-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><Check className="size-4" /></button>
            <button type="button" onClick={() => { setNameDraft(pin.name); setEditingName(false) }} className="size-7 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"><X className="size-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{pin.name}</span>
            <button type="button" onClick={() => setEditingName(true)} title="Rename"
              className="text-white/50 hover:text-white transition-colors">
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-1.5 relative">
          <button type="button" onClick={() => { setPickingType(v => !v); setPickingColor(false) }} title="Pin style"
            className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            <typeEntry.Icon className="size-4" style={{ color: pin.color }} />
          </button>
          {pickingType && (
            <div className="absolute top-full right-0 mt-1.5 flex items-center gap-1.5 p-2 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-10">
              {PIN_TYPES.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => { onChangeType(value); setPickingType(false) }} title={label}
                  className={`size-8 flex items-center justify-center rounded-lg transition-colors ${pin.pin_type === value ? "bg-violet-500/25 text-violet-200" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={() => { setPickingColor(v => !v); setPickingType(false) }} title="Pin color"
            className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
            <Palette className="size-4" style={{ color: pin.color }} />
          </button>
          {pickingColor && (
            <div className="absolute top-full right-0 mt-1.5 flex items-center gap-1.5 p-2 rounded-xl bg-zinc-900 border border-white/10 shadow-xl z-10">
              {PIN_COLORS.map(color => (
                <button key={color} type="button" onClick={() => { onChangeColor(color); setPickingColor(false) }} title={color}
                  style={{ backgroundColor: color }}
                  className={`size-5 rounded-full transition-transform ${pin.color === color ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110" : "hover:scale-110"}`} />
              ))}
              <input type="color" value={pin.color} title="Custom color"
                onChange={e => onChangeColor(e.target.value)}
                className="size-6 rounded-md border border-white/10 bg-transparent cursor-pointer p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none" />
            </div>
          )}
          {confirmingDelete ? (
            <div className="flex items-center gap-1 text-xs">
              <span className="text-white/70 mr-0.5">Delete pin?</span>
              <button type="button" onClick={onDeletePin}
                className="px-2 py-1 rounded-lg bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
              <button type="button" onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} title="Remove pin"
              className="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-500/30 text-white/70 hover:text-red-200 transition-colors">
              <Trash2 className="size-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-1 text-white/60 hover:text-white text-lg leading-none px-1">✕</button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5" onClick={e => e.stopPropagation()}>
        {npcsHere.length > 0 && (
          <div className="max-w-xl mx-auto mt-2 mb-5 rounded-xl bg-white/5 border border-white/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-2">NPCs last seen here</p>
            <div className="flex flex-col gap-1.5">
              {npcsHere.map(npc => (
                <button key={npc.id} type="button" onClick={() => onOpenNpc(npc.id)} title="Open their tracker"
                  className="flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                  {npc.image_url ? (
                    <img src={npc.image_url} alt="" className="size-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="size-8 rounded-full bg-white/10 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{npc.name}</p>
                    {npc.subtitle && <p className="text-xs text-white/50 truncate">{npc.subtitle}</p>}
                  </div>
                  <ExternalLink className="size-3.5 text-white/30 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
        <MapNotesPanel
          notes={notes}
          currentUserId={currentUserId}
          placeholder={`Leave a note at ${pin.name}…`}
          onAddNote={onAddNote}
          onEditNote={onEditNote}
          onDeleteNote={onDeleteNote}
        />
      </div>
    </div>
  )
}
