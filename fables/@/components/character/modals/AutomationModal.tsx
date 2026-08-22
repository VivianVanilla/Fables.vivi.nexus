// ════════════════════════════════════════════════════════════════════════════
// AutomationModal.tsx — Automation hub, four tabs:
//   Forms        — reusable presets (Wild Shape, Haste, Rage) that override
//                  stats/AC/speed/HP and show a notification pill near Lv.
//   Conditionals — lightweight one-shot effects (temp HP, healing, a
//                  condition) for things that don't need a whole Form.
//   Cast         — enable/configure a Cast action per spell, and a "Cast a
//                  Spell" picker to run it. Deliberately not a button on the
//                  spell row itself — cramped and not mobile-friendly with
//                  everything else already on that row.
//   Features     — link a trackable feature's use (Rage, Second Wind, a
//                  limited-use item) to a Form/Conditional. Same "keep it out
//                  of the row itself" reasoning as Cast — lives here, not on
//                  the feature's own card in InfoTab/ItemsTab.
// See CharacterForm/CharacterConditional in shared/types.ts and
// formActivationPatch/castSpellPatch/conditionalTriggerPatch/featureUsePatch
// in shared/utils.ts.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Modal } from "@/components/shared/ui/Modal"
import { PortraitModal } from "@/components/shared/PortraitModal"
import { PopTransition } from "@/components/shared/ui/PopTransition"
import type { CharacterData, CharacterForm, CharacterConditional, FormStatOverrides, SpellItem, SpellSlot, Feature } from "@/components/shared/types"
import { ALL_CONDITIONS } from "@/components/shared/constants"
import { DAMAGE_TYPES } from "@/components/shared/damageTypes"
import { usePopoverPosition, useClickOutside } from "@/components/shared/usePortalMenu"
import { nanoid, castSpellPatch, conditionalTriggerPatch } from "@/components/shared/utils"
import { loadUserImages, uploadUserImage } from "@/components/shared/imageGallery"

interface Props {
  data: CharacterData
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  userId: string | null
  allFeatures: Feature[]                                      // every trackable-eligible feature (Racial Traits/Feats/Class Features/Items/Invocations/Infusions), for the Features tab
  onChangeFeature: (id: string, patch: Partial<Feature>) => void
  multiFormEnabled?: boolean // see CharacterSheet.tsx — passed through to castSpellPatch/conditionalTriggerPatch
                              // so a Cast/Trigger from in here activates a form the same way it would from the sheet
}

const HELP_TEXT: Record<Tab, string> = {
  forms: "Forms are reusable presets: Wild Shape, Haste, Rage, that temporarily override stats, AC, speed, and HP, and show a notification pill near your level. Swap manually from the button next to your level, or link one to a spell in the Cast tab.",
  conditionals: "Conditionals are quick one-shot effects temp HP, healing, a condition — for things that don't need a whole Form. Tap Apply to run one immediately, or link it to a spell in the Cast tab.",
  cast: "Enable Cast on a spell here, configure what it does (expend a slot, activate a Form or Conditional, grant conditions), then flip on \"Show Cast button\" to get a Cast button next to Cantrips on the character sheet.",
  features: "Link a trackable feature (Rage, Second Wind, a limited-use item — turn on \"Track uses\" on it first) to a Form or Conditional. Spending a use of that feature activates it automatically, same as Cast does for a spell.",
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

function ConditionChips({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (name: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(name => {
        const on = selected.includes(name)
        return (
          <button key={name} type="button" onClick={() => onToggle(name)}
            className={`text-[10px] px-2 py-1 rounded-full transition-colors ${on ? "bg-purple-500/30 text-purple-200" : "bg-white/10 text-white/40 hover:text-white/70"}`}>
            {name}
          </button>
        )
      })}
    </div>
  )
}

function DeleteFooter({ onCancel, onSave, onDelete, saveDisabled, confirmName }: {
  onCancel: () => void; onSave: () => void; onDelete?: () => void; saveDisabled?: boolean; confirmName: string
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (confirmDelete) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
        <span className="text-xs text-red-300">Delete "{confirmName}"?</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setConfirmDelete(false)}
            className="text-xs px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 transition-colors">Cancel</button>
          <button type="button" onClick={onDelete}
            className="text-xs px-2.5 py-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white font-semibold transition-colors">Delete</button>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
      {onDelete ? (
        <button type="button" onClick={() => setConfirmDelete(true)}
          className="text-xs text-red-400/70 hover:text-red-400 transition-colors">Delete</button>
      ) : <span />}
      <div className="flex items-center gap-2 ml-auto">
        <button type="button" onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-full text-white/50 hover:text-white transition-colors">Cancel</button>
        <button type="button" onClick={onSave} disabled={saveDisabled}
          className="text-xs px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors disabled:opacity-40">
          Save
        </button>
      </div>
    </div>
  )
}

// ── Forms tab ─────────────────────────────────────────────────────────────

const ABILITY_FIELDS: { key: keyof FormStatOverrides; label: string }[] = [
  { key: "strength", label: "STR" }, { key: "dexterity", label: "DEX" }, { key: "constitution", label: "CON" },
  { key: "intelligence", label: "INT" }, { key: "wisdom", label: "WIS" }, { key: "charisma", label: "CHA" },
]

function FormEditor({ form, userId, onSave, onCancel, onDelete }: {
  form: CharacterForm; userId: string | null; onSave: (f: CharacterForm) => void; onCancel: () => void; onDelete?: () => void
}) {
  const [draft, setDraft] = useState<CharacterForm>(form)
  const [showPortraitPicker, setShowPortraitPicker] = useState(false)
  const [galleryImages, setGalleryImages] = useState<{ name: string; publicUrl: string }[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)
  const [uploadingPortrait, setUploadingPortrait] = useState(false)
  const portraitInputRef = useRef<HTMLInputElement>(null)
  const ov = draft.overrides ?? {}
  function setOv(patch: Partial<FormStatOverrides>) { setDraft(d => ({ ...d, overrides: { ...d.overrides, ...patch } })) }
  function toggleCondition(name: string) {
    const current = draft.grantedConditions ?? []
    setDraft(d => ({ ...d, grantedConditions: current.includes(name) ? current.filter(n => n !== name) : [...current, name] }))
  }
  function toggleGrantedResistance(type: string) {
    const current = draft.grantedResistances ?? []
    setDraft(d => ({ ...d, grantedResistances: current.includes(type) ? current.filter(t => t !== type) : [...current, type] }))
  }
  function toggleGrantedVulnerability(type: string) {
    const current = draft.grantedVulnerabilities ?? []
    setDraft(d => ({ ...d, grantedVulnerabilities: current.includes(type) ? current.filter(t => t !== type) : [...current, type] }))
  }

  async function openPortraitPicker() {
    setShowPortraitPicker(true)
    if (!userId) return
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(userId))
    setGalleryLoading(false)
  }
  async function uploadPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingPortrait(true)
    const url = await uploadUserImage(userId, file)
    setUploadingPortrait(false)
    e.target.value = ""
    if (url) setDraft(d => ({ ...d, portraitUrl: url }))
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Name</span>
        <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          placeholder="Wild Shape: Brown Bear"
          className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
      </label>

      <div className="flex items-center gap-3">
        <button type="button" onClick={openPortraitPicker}
          className="relative size-14 rounded-lg overflow-hidden ring-2 ring-white/15 hover:ring-purple-400/60 shrink-0 bg-white/10 flex items-center justify-center transition-all">
          {uploadingPortrait ? <span className="text-[10px] text-white/70">…</span>
            : draft.portraitUrl ? <img src={draft.portraitUrl} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] text-white/30">None</span>}
        </button>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Portrait</span>
          <p className="text-[10px] text-white/30 max-w-40">Replaces the header portrait while this form is active. Blank = keep the character's own.</p>
          {draft.portraitUrl && (
            <button type="button" onClick={() => setDraft(d => ({ ...d, portraitUrl: undefined }))}
              className="text-[10px] text-red-400/70 hover:text-red-400 transition-colors self-start">Remove</button>
          )}
        </div>
      </div>
      {showPortraitPicker && (
        <PortraitModal
          title="Choose Form Portrait"
          currentPortrait={draft.portraitUrl}
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={url => { setDraft(d => ({ ...d, portraitUrl: url })); setShowPortraitPicker(false) }}
          onUploadClick={() => portraitInputRef.current?.click()}
          onClose={() => setShowPortraitPicker(false)}
        />
      )}
      <input ref={portraitInputRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Notes</span>
        <textarea value={draft.notes ?? ""} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
          placeholder="Freeform description…" rows={2}
          className="bg-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20 resize-none" />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Ability Score Overrides</span>
        <p className="text-[10px] text-white/30 -mt-1">Blank = keep the character's own score. Shows blue on the sheet while active.</p>
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
          <NumField label="Carry Capacity Bonus (lb)" value={ov.carryCapacityBonus} onChange={v => setOv({ carryCapacityBonus: v })} placeholder="+0" />
        </div>
        <p className="text-[10px] text-white/30 -mt-0.5">
          A Strength override above already scales carry capacity (15 lb per point) — this is an
          additional flat bonus on top, for forms that grant extra carrying capacity without a Strength change.
        </p>
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

      <div className="flex flex-col gap-1.5">
        <NumField label="Form's Own HP Pool" value={draft.formMaxHp} onChange={v => setDraft(d => ({ ...d, formMaxHp: v }))} placeholder="shares character HP" />
        <p className="text-[10px] text-white/30">
          Wild Shape-style: this form gets its own separate HP bar (starting full each time it activates)
          instead of using the character's own HP. Combined with "Revert to Base Form" above, dropping this
          pool to 0 reverts you and leaves your original form at 1 HP. Blank = share the character's own HP as normal.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <NumField label="Grants Temp HP" value={draft.tempHp} onChange={v => setDraft(d => ({ ...d, tempHp: v }))} placeholder="none" />
        <p className="text-[10px] text-white/30">
          Same as a Conditional's temp HP — activating this form sets your temp HP to this amount if it's
          higher than what you already have (not additive). Blank = grants none.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Granted Conditions</span>
        <p className="text-[10px] text-white/30 -mt-0.5">Applied when this form activates, removed when it reverts.</p>
        <ConditionChips options={ALL_CONDITIONS} selected={draft.grantedConditions ?? []} onToggle={toggleCondition} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Granted Resistances</span>
        <p className="text-[10px] text-white/30 -mt-0.5">Applied when this form activates, removed when it reverts (mirrors the ⚖ Resistances panel).</p>
        <ConditionChips options={DAMAGE_TYPES} selected={draft.grantedResistances ?? []} onToggle={toggleGrantedResistance} />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Granted Vulnerabilities</span>
        <p className="text-[10px] text-white/30 -mt-0.5">Applied when this form activates, removed when it reverts.</p>
        <ConditionChips options={DAMAGE_TYPES} selected={draft.grantedVulnerabilities ?? []} onToggle={toggleGrantedVulnerability} />
      </div>

      <DeleteFooter confirmName={form.name} onCancel={onCancel} onDelete={onDelete}
        saveDisabled={!draft.name.trim()} onSave={() => onSave(draft)} />
    </div>
  )
}

function FormsTab({ data, onUpdate, userId }: { data: CharacterData; onUpdate: (patch: Partial<CharacterData>) => void; userId: string | null }) {
  const forms = data.forms ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newDraft, setNewDraft] = useState<CharacterForm | null>(null)
  const editing = editingId ? forms.find(f => f.id === editingId) ?? null : null

  function save(f: CharacterForm) {
    if (newDraft) { onUpdate({ forms: [...forms, f] }); setNewDraft(null) }
    else { onUpdate({ forms: forms.map(x => x.id === f.id ? f : x) }); setEditingId(null) }
  }
  function del(id: string) {
    onUpdate({
      forms: forms.filter(f => f.id !== id),
      activeFormId: data.activeFormId === id ? null : data.activeFormId,
      activeFormIds: (data.activeFormIds ?? []).filter(fid => fid !== id),
    })
    setEditingId(null)
  }
  function move(id: string, dir: -1 | 1) {
    const i = forms.findIndex(f => f.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= forms.length) return
    const next = [...forms]
    ;[next[i], next[j]] = [next[j], next[i]]
    onUpdate({ forms: next })
  }

  if (newDraft || editing) {
    return (
      <FormEditor form={newDraft ?? editing!} userId={userId} onSave={save}
        onCancel={() => { setNewDraft(null); setEditingId(null) }}
        onDelete={newDraft ? undefined : () => del(editing!.id)} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
     
      <button type="button" onClick={() => setNewDraft({ id: nanoid(), name: "New Form" })}
        className="text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors self-start">
        + New Form
      </button>
      <div className="flex flex-col gap-1.5">
        {forms.length === 0 && (
          <p className="text-sm text-white/30 italic text-center py-8">No forms yet — create one to get started.</p>
        )}
        {forms.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <div className="flex flex-col shrink-0">
              <button type="button" onClick={() => move(f.id, -1)} disabled={i === 0} title="Move up"
                className="size-4 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 transition-colors leading-none text-[10px]">▲</button>
              <button type="button" onClick={() => move(f.id, 1)} disabled={i === forms.length - 1} title="Move down"
                className="size-4 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 transition-colors leading-none text-[10px]">▼</button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 truncate">{f.name}</p>
              {f.notes && <p className="text-[10px] text-white/30 truncate">{f.notes}</p>}
            </div>
            <button type="button" onClick={() => setEditingId(f.id)} title="Edit"
              className="text-white/30 hover:text-white text-xs shrink-0 transition-colors">✎</button>
          </div>

          
        ))}

         <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none px-1">
        <input type="checkbox" checked={data.multiFormMode ?? false}
          onChange={e => onUpdate({ multiFormMode: e.target.checked })}
          className="accent-purple-500 size-3.5 rounded" />
        Allow multiple Forms active at once
      </label>
      <p className="text-[10px] text-white/30 -mt-2 px-1">
       The header switcher becomes a checklist any number of Forms can be stacked simultaneously
       , and their overrides/conditions/notifications all combine. (Only Check this if you you know what you're doing)
      </p>
      </div>
    </div>
  )
}

// ── Conditionals tab ─────────────────────────────────────────────────────────

function ConditionalEditor({ conditional, forms, onSave, onCancel, onDelete }: {
  conditional: CharacterConditional; forms: CharacterForm[]; onSave: (c: CharacterConditional) => void; onCancel: () => void; onDelete?: () => void
}) {
  const [draft, setDraft] = useState<CharacterConditional>(conditional)
  function toggleCondition(name: string) {
    const current = draft.grantConditions ?? []
    setDraft(d => ({ ...d, grantConditions: current.includes(name) ? current.filter(n => n !== name) : [...current, name] }))
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Name</span>
        <input autoFocus value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          placeholder="Second Wind"
          className="bg-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-white/30 placeholder:text-white/20" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <NumField label="Grant Temp HP" value={draft.tempHp} onChange={v => setDraft(d => ({ ...d, tempHp: v }))} placeholder="+0" />
        <NumField label="Heal HP" value={draft.healHp} onChange={v => setDraft(d => ({ ...d, healHp: v }))} placeholder="+0" />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Activates Form</span>
        <select value={draft.triggerFormId ?? ""} onChange={e => setDraft(d => ({ ...d, triggerFormId: e.target.value || undefined }))}
          className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 w-48">
          <option value="" className="bg-zinc-800 text-white">— None —</option>
          {forms.map(f => <option key={f.id} value={f.id} className="bg-zinc-800 text-white">{f.name}</option>)}
        </select>
        <p className="text-[10px] text-white/30">Switches you into this Form (its overrides, granted conditions, HP pool, etc.) when this conditional is triggered.</p>
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Grant Conditions</span>
        <ConditionChips options={ALL_CONDITIONS} selected={draft.grantConditions ?? []} onToggle={toggleCondition} />
      </div>
      <DeleteFooter confirmName={conditional.name} onCancel={onCancel} onDelete={onDelete}
        saveDisabled={!draft.name.trim()} onSave={() => onSave(draft)} />
    </div>
  )
}

function ConditionalsTab({ data, onUpdate, onTrigger, multiFormEnabled }: {
  data: CharacterData; onUpdate: (patch: Partial<CharacterData>) => void; onTrigger: (msg: string) => void; multiFormEnabled?: boolean
}) {
  const conditionals = data.conditionals ?? []
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newDraft, setNewDraft] = useState<CharacterConditional | null>(null)
  const editing = editingId ? conditionals.find(c => c.id === editingId) ?? null : null

  function save(c: CharacterConditional) {
    if (newDraft) { onUpdate({ conditionals: [...conditionals, c] }); setNewDraft(null) }
    else { onUpdate({ conditionals: conditionals.map(x => x.id === c.id ? c : x) }); setEditingId(null) }
  }
  function del(id: string) { onUpdate({ conditionals: conditionals.filter(c => c.id !== id) }); setEditingId(null) }
  function trigger(c: CharacterConditional) { onUpdate(conditionalTriggerPatch(data, c, multiFormEnabled)); onTrigger(`Applied: ${c.name}`) }

  if (newDraft || editing) {
    return (
      <ConditionalEditor conditional={newDraft ?? editing!} forms={data.forms ?? []} onSave={save}
        onCancel={() => { setNewDraft(null); setEditingId(null) }}
        onDelete={newDraft ? undefined : () => del(editing!.id)} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={() => setNewDraft({ id: nanoid(), name: "New Conditional" })}
        className="text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors self-start">
        + New Conditional
      </button>
      <div className="flex flex-col gap-1.5">
        {conditionals.length === 0 && (
          <p className="text-sm text-white/30 italic text-center py-8">No conditionals yet — quick effects like "+10 temp HP" without needing a whole Form.</p>
        )}
        {conditionals.map(c => {
          const summary = [
            c.tempHp ? `+${c.tempHp} temp HP` : null,
            c.healHp ? `heal ${c.healHp}` : null,
            c.grantConditions?.length ? `${c.grantConditions.length} condition${c.grantConditions.length > 1 ? "s" : ""}` : null,
          ].filter(Boolean).join(" · ")
          return (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/80 truncate">{c.name}</p>
                <p className="text-[10px] text-white/30 truncate">{summary || "No effects set"}</p>
              </div>
              <button type="button" onClick={() => trigger(c)} title="Apply now"
                className="text-[10px] px-2.5 py-1 rounded-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 shrink-0 transition-colors">
                Apply
              </button>
              <button type="button" onClick={() => setEditingId(c.id)} title="Edit"
                className="text-white/30 hover:text-white text-xs shrink-0 transition-colors">✎</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Cast tab ─────────────────────────────────────────────────────────────────

function SpellCastEditor({ spell, forms, conditionals, spellSlots, onSave, onCancel }: {
  spell: SpellItem; forms: CharacterForm[]; conditionals: CharacterConditional[]; spellSlots: SpellSlot[]
  onSave: (s: SpellItem) => void; onCancel: () => void
}) {
  const [draft, setDraft] = useState<SpellItem>(spell)
  function set(patch: Partial<SpellItem>) { setDraft(d => ({ ...d, ...patch })) }
  function toggleCondition(name: string) {
    const current = draft.castGrantConditions ?? []
    set({ castGrantConditions: current.includes(name) ? current.filter(n => n !== name) : [...current, name] })
  }

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onCancel} className="text-xs text-white/40 hover:text-white self-start transition-colors">← Back to Spells</button>
      <p className="text-sm font-bold text-white truncate">{spell.name || "Unnamed Spell"}</p>

      <label className="flex items-center gap-2 cursor-pointer text-white/60 text-sm">
        <input type="checkbox" checked={draft.castEnabled ?? false}
          onChange={e => set({ castEnabled: e.target.checked })}
          className="accent-purple-500" />
        Enabled for Cast
      </label>

      <PopTransition show={!!draft.castEnabled} className="flex flex-col gap-3 pl-2">
        {!!draft.level && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">Expend Slot</span>
            <select value={draft.castSlotId ?? ""} onChange={e => set({ castSlotId: e.target.value || undefined })}
              className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 w-48">
              <option value="" className="bg-zinc-800 text-white">— None —</option>
              {spellSlots.map(s => (
                <option key={s.id} value={s.id} className="bg-zinc-800 text-white">
                  {s.pact ? "Pact — " : ""}Level {s.level} ({Math.max(0, s.total - s.used)}/{s.total} left)
                </option>
              ))}
            </select>
            {/* Picking a specific slot row (not just "a level N slot") is what
                makes this Warlock-safe — Pact Magic is its own separate pool
                that needs to be the one that burns, not a same-level regular
                slot from a multiclass. */}
            <p className="text-[10px] text-white/30">Warlocks: pick your Pact slot here, not a same-level regular slot.</p>
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Activate Form</span>
          <select value={draft.castFormId ?? ""} onChange={e => set({ castFormId: e.target.value || undefined })}
            className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 w-48">
            <option value="" className="bg-zinc-800 text-white">— None —</option>
            {forms.map(f => <option key={f.id} value={f.id} className="bg-zinc-800 text-white">{f.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Trigger Conditional</span>
          <select value={draft.castConditionalId ?? ""} onChange={e => set({ castConditionalId: e.target.value || undefined })}
            className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 w-48">
            <option value="" className="bg-zinc-800 text-white">— None —</option>
            {conditionals.map(c => <option key={c.id} value={c.id} className="bg-zinc-800 text-white">{c.name}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Grant Conditions</span>
          <ConditionChips options={ALL_CONDITIONS} selected={draft.castGrantConditions ?? []} onToggle={toggleCondition} />
        </div>
      </PopTransition>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
        <button type="button" onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-full text-white/50 hover:text-white transition-colors">Cancel</button>
        <button type="button" onClick={() => onSave(draft)}
          className="text-xs px-4 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors">Save</button>
      </div>
    </div>
  )
}

function CastTab({ data, onUpdate, onCast, multiFormEnabled }: {
  data: CharacterData; onUpdate: (patch: Partial<CharacterData>) => void; onCast: (msg: string) => void; multiFormEnabled?: boolean
}) {
  const spells = data.spellItems ?? []
  const forms = data.forms ?? []
  const conditionals = data.conditionals ?? []
  const enabledSpells = spells.filter(s => s.castEnabled)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const editingSpell = editingId ? spells.find(s => s.id === editingId) ?? null : null

  function saveSpell(patch: SpellItem) {
    onUpdate({ spellItems: spells.map(s => s.id === patch.id ? patch : s) })
    setEditingId(null)
  }
  function cast(spell: SpellItem) {
    onUpdate(castSpellPatch(data, spell, multiFormEnabled))
    onCast(`Cast: ${spell.name || "spell"}`)
    setPicking(false)
  }
  // Reorders the underlying spellItems array itself (not just this list's
  // display) — so moving a spell up here also moves it earlier in the "Cast
  // a Spell" picker grid above, same list/same order, no separate field.
  function moveSpell(id: string, dir: -1 | 1) {
    const i = spells.findIndex(s => s.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= spells.length) return
    const next = [...spells]
    ;[next[i], next[j]] = [next[j], next[i]]
    onUpdate({ spellItems: next })
  }

  if (editingSpell) {
    return (
      <SpellCastEditor spell={editingSpell} forms={forms} conditionals={conditionals} spellSlots={data.spellSlots ?? []}
        onSave={saveSpell} onCancel={() => setEditingId(null)} />
    )
  }

  if (picking) {
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => setPicking(false)} className="text-xs text-white/40 hover:text-white self-start transition-colors">← Back</button>
        <p className="text-sm font-bold text-white">Cast which spell?</p>
        <div className="grid grid-cols-2 gap-2">
          {enabledSpells.map(s => (
            <button key={s.id} type="button" onClick={() => cast(s)}
              className="text-left text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-purple-500/20 text-white/80 hover:text-white border border-white/10 transition-colors truncate">
              {s.name || "Unnamed Spell"}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 cursor-pointer text-white/60 text-sm">
        <input type="checkbox" checked={data.castButtonEnabled ?? false}
          onChange={e => onUpdate({ castButtonEnabled: e.target.checked })}
          className="accent-purple-500" />
        Show Cast button on the character sheet (next to Cantrips)
      </label>

      <button type="button" onClick={() => setPicking(true)} disabled={enabledSpells.length === 0}
        className="text-sm px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-default text-white font-semibold transition-colors">
        Cast a Spell
      </button>
      {enabledSpells.length === 0 && spells.length > 0 && (
        <p className="text-[10px] text-white/30 italic -mt-2">Enable a spell below to cast it from here.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Spells</span>
        {spells.length === 0 && (
          <p className="text-sm text-white/30 italic text-center py-8">No spells yet — add some from the Main tab first.</p>
        )}
        {spells.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
            <div className="flex flex-col shrink-0">
              <button type="button" onClick={() => moveSpell(s.id, -1)} disabled={i === 0} title="Move up"
                className="size-4 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 transition-colors leading-none text-[10px]">▲</button>
              <button type="button" onClick={() => moveSpell(s.id, 1)} disabled={i === spells.length - 1} title="Move down"
                className="size-4 flex items-center justify-center text-white/30 hover:text-white disabled:opacity-20 disabled:hover:text-white/30 transition-colors leading-none text-[10px]">▼</button>
            </div>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${s.castEnabled ? "bg-purple-500/30 text-purple-200" : "bg-white/10 text-white/30"}`}>
              {s.castEnabled ? "ON" : "OFF"}
            </span>
            <p className="flex-1 min-w-0 text-sm text-white/80 truncate">{s.name || "Unnamed Spell"}</p>
            <button type="button" onClick={() => setEditingId(s.id)} title="Configure"
              className="text-white/30 hover:text-white text-xs shrink-0 transition-colors">✎</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Features tab ─────────────────────────────────────────────────────────────
// Trackable features (Race & Feats/Class Features/Items/Invocations/Infusions
// — anything with "Track uses" on) link to a Form/Conditional here, same
// "keep the row itself uncluttered" reasoning as the Cast tab.

function FeatureTriggerEditor({ feature, forms, conditionals, onChange, onBack }: {
  feature: Feature; forms: CharacterForm[]; conditionals: CharacterConditional[]
  onChange: (patch: Partial<Feature>) => void; onBack: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="text-xs text-white/40 hover:text-white self-start transition-colors">← Back to Features</button>
      <p className="text-sm font-bold text-white truncate">{feature.name || "Unnamed Feature"}</p>

      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Activate Form</span>
        <select value={feature.triggerFormId ?? ""} onChange={e => onChange({ triggerFormId: e.target.value || undefined })}
          className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 w-48">
          <option value="" className="bg-zinc-800 text-white">— None —</option>
          {forms.map(f => <option key={f.id} value={f.id} className="bg-zinc-800 text-white">{f.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wider">Trigger Conditional</span>
        <select value={feature.triggerConditionalId ?? ""} onChange={e => onChange({ triggerConditionalId: e.target.value || undefined })}
          className="bg-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-white/30 w-48">
          <option value="" className="bg-zinc-800 text-white">— None —</option>
          {conditionals.map(c => <option key={c.id} value={c.id} className="bg-zinc-800 text-white">{c.name}</option>)}
        </select>
      </label>
      <p className="text-[10px] text-white/30">Spending a use of this feature (the −/+ bar on its card) fires these automatically.</p>
    </div>
  )
}

function FeaturesTab({ data, allFeatures, onChangeFeature }: {
  data: CharacterData; allFeatures: Feature[]; onChangeFeature: (id: string, patch: Partial<Feature>) => void
}) {
  const forms = data.forms ?? []
  const conditionals = data.conditionals ?? []
  const trackable = allFeatures.filter(f => f.trackable)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editing = editingId ? trackable.find(f => f.id === editingId) ?? null : null

  if (editing) {
    return (
      <FeatureTriggerEditor feature={editing} forms={forms} conditionals={conditionals}
        onChange={patch => onChangeFeature(editing.id, patch)} onBack={() => setEditingId(null)} />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">Trackable Features</span>
        {trackable.length === 0 && (
          <p className="text-sm text-white/30 italic text-center py-8">No trackable features yet — turn on "Track uses" on a feature (Race & Feats, Class Features, Items, etc.) first.</p>
        )}
        {trackable.map(f => {
          const linked = !!(f.triggerFormId || f.triggerConditionalId)
          return (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${linked ? "bg-purple-500/30 text-purple-200" : "bg-white/10 text-white/30"}`}>
                {linked ? "ON" : "OFF"}
              </span>
              <p className="flex-1 min-w-0 text-sm text-white/80 truncate">{f.name || "Unnamed Feature"}</p>
              <button type="button" onClick={() => setEditingId(f.id)} title="Configure"
                className="text-white/30 hover:text-white text-xs shrink-0 transition-colors">✎</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────

type Tab = "forms" | "conditionals" | "cast" | "features"
const TABS: [Tab, string][] = [["forms", "Forms"], ["conditionals", "Conditionals"], ["cast", "Cast"], ["features", "Features"]]

export function AutomationModal({ data, onUpdate, onClose, userId, allFeatures, onChangeFeature, multiFormEnabled }: Props) {
  const [tab, setTab] = useState<Tab>("forms")
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(520px,92vw)] max-h-[88vh] flex flex-col overflow-hidden">

        <div className="px-5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-base font-bold text-white truncate">Automation</p>
            <HelpButton text={HELP_TEXT[tab]} />
          </div>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white shrink-0">✕</button>
        </div>

        <div className="px-5 pt-3 shrink-0 flex items-center gap-1 rounded-full">
          <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${tab === key ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {tab === "forms" && <FormsTab data={data} onUpdate={onUpdate} userId={userId} />}
          {tab === "conditionals" && <ConditionalsTab data={data} onUpdate={onUpdate} onTrigger={showToast} multiFormEnabled={multiFormEnabled} />}
          {tab === "cast" && <CastTab data={data} onUpdate={onUpdate} onCast={showToast} multiFormEnabled={multiFormEnabled} />}
          {tab === "features" && <FeaturesTab data={data} allFeatures={allFeatures} onChangeFeature={onChangeFeature} />}
        </div>

      </div>
      {toast && createPortal(
        <div className="fixed bottom-4 right-4 z-[60] px-3 py-2 rounded-lg bg-zinc-900 border border-purple-400/40 text-purple-200 text-xs shadow-xl">
          {toast}
        </div>,
        document.body
      )}
    </Modal>
  )
}
