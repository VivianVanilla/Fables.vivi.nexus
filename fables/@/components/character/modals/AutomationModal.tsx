// ════════════════════════════════════════════════════════════════════════════
// AutomationModal.tsx — Forms manager. A Form (Wild Shape, Haste, Rage, …) is
// a reusable preset that temporarily overrides stats/AC/speed/HP, shows a
// notification pill near the character's level, and can auto-grant/revoke
// conditions — see CharacterForm in shared/types.ts and CharacterSheet.tsx's
// formActivationPatch/activateForm/castSpell for how it's applied.
// ════════════════════════════════════════════════════════════════════════════

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Modal } from "@/components/shared/ui/Modal"
import type { CharacterData, CharacterForm, FormStatOverrides } from "@/components/shared/types"
import { ALL_CONDITIONS } from "@/components/shared/constants"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"
import { nanoid } from "@/components/shared/utils"

interface Props {
  data: CharacterData
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
}

// Small "what is this?" popover, portaled to <body> so it isn't clipped by
// the modal's own overflow — same trigger/position/click-outside pattern as
// every other small menu in the app (see e.g. InfoTab.tsx's LinkMenu).
function HelpButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef, contentRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} title="What is this?"
        className="size-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white text-[10px] font-bold transition-colors">
        ?
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 w-64 bg-zinc-900 border border-white/15 rounded-lg shadow-xl p-3 text-xs text-white/70 leading-relaxed animate-in fade-in zoom-in-95 duration-150">
          {text}
        </div>,
        document.body
      )}
    </div>
  )
}

const ABILITY_FIELDS: { key: keyof FormStatOverrides; label: string }[] = [
  { key: "strength", label: "STR" }, { key: "dexterity", label: "DEX" }, { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" }, { key: "wisdom", label: "WIS" }, { key: "charisma", label: "CHA" },
]

function NumField({ label, value, onChange, placeholder }: {
  label: string; value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
      <input type="number" value={value ?? ""} placeholder={placeholder ?? "—"}
        onChange={e => onChange(e.target.value === "" ? undefined : parseInt(e.target.value) || 0)}
        className="bg-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 w-full" />
    </label>
  )
}

// Create/edit — one form, all its overrides. `onDelete` is omitted while
// creating (nothing to delete yet).
function FormEditor({ form, onSave, onCancel, onDelete }: {
  form: CharacterForm
  onSave: (f: CharacterForm) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [draft, setDraft] = useState<CharacterForm>(form)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const ov = draft.overrides ?? {}

  function setOv(patch: Partial<FormStatOverrides>) {
    setDraft(d => ({ ...d, overrides: { ...d.overrides, ...patch } }))
  }
  function toggleCondition(name: string) {
    const current = draft.grantedConditions ?? []
    setDraft(d => ({ ...d, grantedConditions: current.includes(name) ? current.filter(n => n !== name) : [...current, name] }))
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Name</span>
        <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          placeholder="Wild Shape: Brown Bear"
          className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Notes</span>
        <textarea value={draft.notes ?? ""} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
          placeholder="Freeform description…" rows={2}
          className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 resize-none" />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Ability Score Overrides</span>
        <p className="text-[10px] text-white/30 -mt-1">Blank = keep the character's own score.</p>
        <div className="grid grid-cols-3 gap-2">
          {ABILITY_FIELDS.map(f => (
            <NumField key={f.key} label={f.label} value={ov[f.key]} onChange={v => setOv({ [f.key]: v })} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">AC / Speed / HP</span>
        <div className="grid grid-cols-2 gap-2">
          <NumField label="AC Bonus" value={ov.acBonus} onChange={v => setOv({ acBonus: v })} placeholder="+0" />
          <NumField label="AC Override" value={ov.acOverride} onChange={v => setOv({ acOverride: v })} placeholder="computed" />
          <NumField label="Speed Override (ft)" value={ov.speedOverride} onChange={v => setOv({ speedOverride: v })} placeholder="base" />
          <NumField label="Max HP Bonus" value={ov.maxHpBonus} onChange={v => setOv({ maxHpBonus: v })} placeholder="+0" />
        </div>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Notification</span>
        <input value={draft.notification ?? ""} onChange={e => setDraft(d => ({ ...d, notification: e.target.value || undefined }))}
          placeholder="e.g. Extra Attack — you can attack twice with your action"
          className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
        <p className="text-[10px] text-white/30">Shown as a pill near the character's level while this form is active. Blank = no banner.</p>
      </label>

      <label className="flex items-center gap-2 cursor-pointer text-white/60 text-sm">
        <input type="checkbox" checked={draft.revertOnZeroHp ?? false}
          onChange={e => setDraft(d => ({ ...d, revertOnZeroHp: e.target.checked }))}
          className="accent-purple-500" />
        Revert to Base Form when HP reaches 0
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Granted Conditions</span>
        <p className="text-[10px] text-white/30 -mt-0.5">Applied when this form activates, removed when it reverts.</p>
        <div className="flex flex-wrap gap-1">
          {ALL_CONDITIONS.map(name => {
            const on = (draft.grantedConditions ?? []).includes(name)
            return (
              <button key={name} type="button" onClick={() => toggleCondition(name)}
                className={`text-[10px] px-2 py-1 rounded-full transition-colors ${on ? "bg-purple-500/30 text-purple-200" : "bg-white/10 text-white/40 hover:text-white/70"}`}>
                {name}
              </button>
            )
          })}
        </div>
      </div>

      {confirmDelete ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
          <span className="text-xs text-red-300">Delete "{form.name}"?</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition-colors">Cancel</button>
            <button type="button" onClick={onDelete}
              className="text-xs px-2.5 py-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
          {onDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-400/70 hover:text-red-400 transition-colors">Delete</button>
          ) : <span />}
          <div className="flex items-center gap-2 ml-auto">
            <button type="button" onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-full text-white/50 hover:text-white transition-colors">Cancel</button>
            <button type="button" onClick={() => onSave(draft)} disabled={!draft.name.trim()}
              className="text-xs px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors disabled:opacity-40">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AutomationModal({ data, onUpdate, onClose }: Props) {
  const forms = data.forms ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newFormDraft, setNewFormDraft] = useState<CharacterForm | null>(null)

  const editingForm = editingId ? forms.find(f => f.id === editingId) ?? null : null
  const showEditor  = !!newFormDraft || !!editingForm

  function saveForm(f: CharacterForm) {
    if (newFormDraft) {
      onUpdate({ forms: [...forms, f] })
      setNewFormDraft(null)
    } else {
      onUpdate({ forms: forms.map(x => x.id === f.id ? f : x) })
      setEditingId(null)
    }
  }
  function deleteForm(id: string) {
    onUpdate({ forms: forms.filter(f => f.id !== id), activeFormId: data.activeFormId === id ? null : data.activeFormId })
    setEditingId(null)
  }
  function closeEditor() { setNewFormDraft(null); setEditingId(null) }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(520px,92vw)] max-h-[88vh] flex flex-col overflow-hidden">

        <div className="px-5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-base font-bold text-white truncate">
              {showEditor ? (newFormDraft ? "New Form" : editingForm?.name || "Edit Form") : "Automation"}
            </p>
            {!showEditor && (
              <HelpButton text="Forms are reusable presets — Wild Shape, Haste, Rage — that temporarily override stats, AC, speed, and HP, and show a notification pill near your level. Swap manually from the button next to your level, or link one to a spell's Cast button so casting it activates the form automatically." />
            )}
          </div>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {showEditor ? (
            <FormEditor
              form={newFormDraft ?? editingForm!}
              onSave={saveForm}
              onCancel={closeEditor}
              onDelete={newFormDraft ? undefined : () => deleteForm(editingForm!.id)}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <button type="button" onClick={() => setNewFormDraft({ id: nanoid(), name: "New Form" })}
                className="text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors self-start">
                + New Form
              </button>
              <div className="flex flex-col gap-1.5">
                {forms.length === 0 && (
                  <p className="text-sm text-white/30 italic text-center py-8">No forms yet — create one to get started.</p>
                )}
                {forms.map(f => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/80 truncate">{f.name}</p>
                      {f.notes && <p className="text-[10px] text-white/30 truncate">{f.notes}</p>}
                    </div>
                    <button type="button" onClick={() => setEditingId(f.id)} title="Edit"
                      className="text-white/30 hover:text-white text-xs shrink-0 transition-colors">✏️</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </Modal>
  )
}
