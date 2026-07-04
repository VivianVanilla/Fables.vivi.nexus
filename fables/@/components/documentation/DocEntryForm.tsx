// ════════════════════════════════════════════════════════════════════════════
// DocEntryForm.tsx — Create / edit form for any documentation entry type
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react"
import { supabase } from "../../../src/supabase"
import { ArrowLeft, Save, Plus, Trash2, GripVertical, AlertTriangle } from "lucide-react"
import type { DocType, DocEntry } from "./doc-types"
import { SINGULAR, TYPE_LABEL } from "./doc-types"
import { MarkdownTextarea } from "../ui/MarkdownTextarea"
import { invalidateSuggestionCache } from "../character/entries/FeatureEntry"

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">{label}</span>
        {hint && <span className="text-[10px] text-slate-700">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{title}</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>
      {children}
    </div>
  )
}

const inp = "bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600 placeholder:text-slate-700 w-full"
const sel = `${inp} cursor-pointer`

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? "bg-purple-600 text-white" : "bg-slate-800 text-slate-500 border border-slate-700 hover:border-slate-600 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  )
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function defaultData(type: DocType): Record<string, any> {
  switch (type) {
    case "classes": return {
      is_subclass: false, parent_class_id: "",
      hit_die: "d8", saving_throws: [],
      armor_proficiencies: [], weapon_proficiencies: [],
      tools: "", skills: "",
      spellcasting_ability: "", spellcasting_type: "", spellcasting_description: "",
      subclass_feature_name: "", subclass_level: 3,
      equipment: [],
      features: [], domain_spells: [],
    }
    case "races": return { traits: [] }
    case "feats": return { prerequisite: "", description: "" }
    case "items": return { rarity: "common", item_type: "wondrous", requires_attunement: false, description: "", damage: "", damage_type: "", properties: "" }
  }
}

// ── ClassFields ────────────────────────────────────────────────────────────────

interface ClassFeature {
  id: string
  level: number
  name: string
  description: string
}

interface DomainSpellRow {
  level: number
  spells: string[]
}

function DomainSpellsField({ d, set }: { d: Record<string,any>; set: (k: string, v: any) => void }) {
  const rows: DomainSpellRow[] = d.domain_spells ?? []

  function addRow() {
    const existingLevels = new Set(rows.map(r => r.level))
    const next = [1,3,5,7,9,11,13,15,17,19].find(l => !existingLevels.has(l)) ?? rows.length + 1
    set("domain_spells", [...rows, { level: next, spells: [] }])
  }

  function updateRow(idx: number, patch: Partial<DomainSpellRow>) {
    set("domain_spells", rows.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function removeRow(idx: number) {
    set("domain_spells", rows.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && (
        <p className="text-xs text-slate-700 italic">No domain spells yet.</p>
      )}
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="flex flex-col gap-0.5 w-20 shrink-0">
            <span className="text-[9px] uppercase text-slate-600">Level</span>
            <select
              value={row.level}
              onChange={e => updateRow(i, { level: parseInt(e.target.value) })}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-600"
            >
              {[1,3,5,7,9,11,13,15,17,19].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <span className="text-[9px] uppercase text-slate-600">Spells (comma-separated)</span>
            <input
              value={(row.spells ?? []).join(", ")}
              onChange={e => updateRow(i, { spells: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              placeholder="Burning Hands, Command…"
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-600 placeholder:text-slate-700 w-full"
            />
          </div>
          <button onClick={() => removeRow(i)} className="size-7 flex items-center justify-center text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-lg shrink-0 mt-4">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      {rows.length < 5 && (
        <button type="button" onClick={addRow} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1">
          <Plus className="size-4" /> Add level
        </button>
      )}
    </div>
  )
}

// Minimal class record for the parent class dropdown
interface ClassOption { id: string; name: string }

function EquipmentField({ d, set }: { d: Record<string,any>; set: (k: string, v: any) => void }) {
  const lines: string[] = d.equipment ?? []
  return (
    <div className="flex flex-col gap-2">
      {lines.length === 0 && <p className="text-xs text-slate-700 italic">No equipment lines yet.</p>}
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2">
          <input
            value={line}
            onChange={e => { const a = [...lines]; a[i] = e.target.value; set("equipment", a) }}
            placeholder={`(a) a rapier, (b) a longsword, or (c) any simple weapon`}
            className={inp}
          />
          <button type="button" onClick={() => set("equipment", lines.filter((_,j) => j !== i))}
            className="size-9 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 shrink-0">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => set("equipment", [...lines, ""])}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1">
        <Plus className="size-4" /> Add line
      </button>
    </div>
  )
}

function ClassFields({
  d, set, isHomebrew, userId,
}: {
  d: Record<string,any>
  set: (k: string, v: any) => void
  isHomebrew: boolean
  userId: string | null
}) {
  const isSubclass = !!d.is_subclass
  const features: ClassFeature[] = d.features ?? []
  const [classOptions, setClassOptions] = useState<ClassOption[]>([])

  // Load parent class options whenever the user switches to Subclass mode.
  // Core subclasses can only be linked to official (non-homebrew) classes.
  // Homebrew subclasses can only be linked to the creator's own homebrew classes.
  useEffect(() => {
    if (!isSubclass) return
    let q = supabase.from("documentation").select("id, name, data").eq("type", "class").order("name")
    if (!isHomebrew) {
      q = q.eq("is_homebrew", false)
    } else if (userId) {
      q = q.eq("is_homebrew", true).eq("owner_id", userId)
    } else {
      setClassOptions([])
      return
    }
    q.then(({ data }) => {
      const full = (data ?? []).filter((e: any) => !e.data?.is_subclass)
      setClassOptions(full as ClassOption[])
    })
  }, [isSubclass, isHomebrew, userId])

  const toggleArr = (key: string, val: string) => {
    const arr: string[] = d[key] ?? []
    set(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function addFeature() {
    set("features", [...features, { id: uid(), level: 1, name: "", description: "" }])
  }

  function updateFeature(id: string, patch: Partial<ClassFeature>) {
    set("features", features.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function removeFeature(id: string) {
    set("features", features.filter(f => f.id !== id))
  }

  return (
    <>
      {/* Class vs Subclass toggle */}
      <Field label="Entry Type">
        <div className="flex gap-2">
          <ToggleChip label="Custom Class"    active={!isSubclass} onClick={() => set("is_subclass", false)} />
          <ToggleChip label="Custom Subclass" active={isSubclass}  onClick={() => set("is_subclass", true)} />
        </div>
      </Field>

      {isSubclass && (
        <Field label="Parent Class" hint="which class this subclass belongs to">
          <select
            value={d.parent_class_id ?? ""}
            onChange={e => set("parent_class_id", e.target.value)}
            className={sel}
          >
            <option value="">— Select a class —</option>
            {classOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {classOptions.length === 0 && isSubclass && (
            <p className="text-[10px] text-slate-600 italic mt-0.5">
              {isHomebrew
                ? "No homebrew classes found under your account — create a class first."
                : "No official classes found — add a core class first."}
            </p>
          )}
        </Field>
      )}

      <Section title={isSubclass ? "Subclass Stats" : "Class Stats"}>
        {!isSubclass && (
          <>
            <Field label="Hit Die">
              <select value={d.hit_die ?? "d8"} onChange={e => set("hit_die", e.target.value)} className={sel}>
                {["d6","d8","d10","d12"].map(v => <option key={v}>{v}</option>)}
              </select>
            </Field>

            <Field label="Saving Throws">
              <div className="flex flex-wrap gap-1.5">
                {["str","dex","con","int","wis","cha"].map(s => {
                  const on = (d.saving_throws ?? []).includes(s)
                  return (
                    <ToggleChip key={s} label={s.toUpperCase()} active={on}
                      onClick={() => toggleArr("saving_throws", s)} />
                  )
                })}
              </div>
            </Field>

            <Field label="Armor Proficiencies">
              <div className="flex flex-wrap gap-1.5">
                {["Light","Medium","Heavy","Shields"].map(a => (
                  <ToggleChip key={a} label={a} active={(d.armor_proficiencies ?? []).includes(a)}
                    onClick={() => toggleArr("armor_proficiencies", a)} />
                ))}
              </div>
            </Field>

            <Field label="Weapon Proficiencies" hint="comma-separated">
              <input
                value={(d.weapon_proficiencies ?? []).join(", ")}
                onChange={e => set("weapon_proficiencies", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))}
                placeholder="Simple weapons, hand crossbows, longswords…"
                className={inp}
              />
            </Field>

            <Field label="Tools" hint="e.g. Three musical instruments of your choice">
              <input value={d.tools ?? ""} onChange={e => set("tools", e.target.value)} placeholder="Three musical instruments of your choice…" className={inp} />
            </Field>

            <Field label="Skills" hint="e.g. Choose any three">
              <input value={d.skills ?? ""} onChange={e => set("skills", e.target.value)} placeholder="Choose any three…" className={inp} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Spellcasting Ability">
                <select value={d.spellcasting_ability ?? ""} onChange={e => set("spellcasting_ability", e.target.value)} className={sel}>
                  <option value="">None</option>
                  {["str","dex","con","int","wis","cha"].map(a => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                </select>
              </Field>
              <Field label="Casting Type">
                <select value={d.spellcasting_type ?? ""} onChange={e => set("spellcasting_type", e.target.value)} className={sel} disabled={!d.spellcasting_ability}>
                  <option value="">None</option>
                  <option value="full">Full Caster</option>
                  <option value="half">Half Caster</option>
                  <option value="third">Third Caster</option>
                  <option value="pact">Pact Magic</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Subclass Feature Name" hint='e.g. "Arcane Tradition"'>
                <input value={d.subclass_feature_name ?? ""} onChange={e => set("subclass_feature_name", e.target.value)} placeholder="Martial Archetype…" className={inp} />
              </Field>
              <Field label="Subclass Chosen at Level">
                <input type="number" value={d.subclass_level ?? 3} min={1} max={20} onChange={e => set("subclass_level", parseInt(e.target.value)||3)} className={inp} />
              </Field>
            </div>
          </>
        )}

        {d.spellcasting_ability && !isSubclass && (
          <Field label="Spellcasting Description" hint="flavour text shown before ability">
            <MarkdownTextarea
              value={d.spellcasting_description ?? ""}
              onChange={v => set("spellcasting_description", v)}
              placeholder="You have learned to untangle and reshape the fabric of reality…"
              rows={3}
              className={`${inp} resize-none`}
            />
          </Field>
        )}
      </Section>

      {!isSubclass && (
        <Section title="Starting Equipment">
          <p className="text-xs text-slate-600 -mt-1 mb-2">Each line becomes a bullet point. Use (a)/(b) notation for choices.</p>
          <EquipmentField d={d} set={set} />
        </Section>
      )}

      {/* Subclass Spells — spells known/granted by this subclass at certain levels */}
      {isSubclass && (
        <Section title="Subclass Spells">
          <p className="text-xs text-slate-600 -mt-1 mb-2">Optional. Spells this subclass grants or adds to the known list at certain levels.</p>
          <DomainSpellsField d={d} set={set} />
        </Section>
      )}

      {/* Features by level */}
      <Section title="Features">
        <div className="flex flex-col gap-2">
          {features.length === 0 && (
            <p className="text-xs text-slate-700 italic">No features yet. Add one below.</p>
          )}
          {features.map(f => (
            <div key={f.id} className="flex gap-2 items-start bg-slate-900 border border-slate-800 rounded-xl p-3">
              <GripVertical className="size-4 text-slate-700 mt-2 shrink-0" />
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 w-20 shrink-0">
                    <span className="text-[9px] uppercase text-slate-600">Level</span>
                    <input type="number" value={f.level} min={1} max={20}
                      onChange={e => updateFeature(f.id, { level: parseInt(e.target.value)||1 })}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-center text-slate-100 outline-none focus:border-slate-600" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[9px] uppercase text-slate-600">Feature Name</span>
                    <input value={f.name} onChange={e => updateFeature(f.id, { name: e.target.value })}
                      placeholder="Second Wind…"
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-600 placeholder:text-slate-700 w-full" />
                  </div>
                </div>
                <MarkdownTextarea
                  value={f.description}
                  onChange={v => updateFeature(f.id, { description: v })}
                  placeholder="Describe what this feature does…"
                  rows={2}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-slate-600 placeholder:text-slate-700 resize-none w-full"
                />
              </div>
              <button onClick={() => removeFeature(f.id)} className="size-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 mt-1">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addFeature}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1">
            <Plus className="size-4" /> Add Feature
          </button>
        </div>
      </Section>
    </>
  )
}

// ── RaceFields ─────────────────────────────────────────────────────────────────

type Trait    = { id: string; name: string; description: string }
type Subrace  = { id: string; name: string; traits: Trait[] }

function normTraits(raw: any[]): Trait[] {
  return raw.map((t: any) => typeof t === "string" ? { id: uid(), name: t, description: "" } : t)
}

function TraitList({ traits, onChange }: { traits: Trait[]; onChange: (next: Trait[]) => void }) {
  function add()                { onChange([...traits, { id: uid(), name: "", description: "" }]) }
  function remove(id: string)   { onChange(traits.filter(t => t.id !== id)) }
  function update(id: string, patch: Partial<Trait>) {
    onChange(traits.map(t => t.id === id ? { ...t, ...patch } : t))
  }
  return (
    <div className="flex flex-col gap-2">
      {traits.length === 0 && <p className="text-xs text-slate-700 italic">No traits yet.</p>}
      {traits.map(t => (
        <div key={t.id} className="flex gap-2 items-start bg-slate-900 border border-slate-800 rounded-xl p-3">
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <input
              value={t.name}
              onChange={e => update(t.id, { name: e.target.value })}
              placeholder="Trait name (e.g. Darkvision, Fey Ancestry…)"
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-600 placeholder:text-slate-700 w-full"
            />
            <MarkdownTextarea
              value={t.description}
              onChange={v => update(t.id, { description: v })}
              placeholder="Describe what this trait does…"
              rows={2}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-slate-600 placeholder:text-slate-700 resize-none w-full"
            />
          </div>
          <button onClick={() => remove(t.id)} className="size-7 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0 mt-1">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1">
        <Plus className="size-4" /> Add Trait
      </button>
    </div>
  )
}

function RaceFields({ d, set }: { d: Record<string,any>; set: (k: string, v: any) => void }) {
  const traits:   Trait[]   = normTraits(d.traits   ?? [])
  const subraces: Subrace[] = (d.subraces ?? []).map((s: any) => ({
    ...s, traits: normTraits(s.traits ?? [])
  }))
  const [openSubrace, setOpenSubrace] = useState<string | null>(null)

  function addSubrace() {
    const next: Subrace = { id: uid(), name: "", traits: [] }
    set("subraces", [...subraces, next])
    setOpenSubrace(next.id)
  }

  function updateSubrace(id: string, patch: Partial<Subrace>) {
    set("subraces", subraces.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function removeSubrace(id: string) {
    set("subraces", subraces.filter(s => s.id !== id))
    if (openSubrace === id) setOpenSubrace(null)
  }

  return (
    <>
      <Section title="Racial Traits">
        <p className="text-xs text-slate-600 -mt-2">Traits shared by all members of this race.</p>
        <TraitList traits={traits} onChange={next => set("traits", next)} />
      </Section>

      <Section title="Subraces">
        <p className="text-xs text-slate-600 -mt-2">Optional. Each subrace inherits the traits above and adds its own.</p>
        <div className="flex flex-col gap-2">
          {subraces.length === 0 && (
            <p className="text-xs text-slate-700 italic">No subraces yet.</p>
          )}
          {subraces.map(s => (
            <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {/* Subrace header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenSubrace(prev => prev === s.id ? null : s.id)}
                  className="flex-1 flex items-center gap-2 text-left"
                >
                  <span className="text-[10px] text-slate-500 select-none">{openSubrace === s.id ? "▼" : "▶"}</span>
                  <span className="text-sm text-slate-200 font-medium">{s.name || <span className="text-slate-600 italic">Unnamed subrace</span>}</span>
                  {s.traits.length > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500">{s.traits.length} trait{s.traits.length !== 1 ? "s" : ""}</span>
                  )}
                </button>
                <button onClick={() => removeSubrace(s.id)} className="size-6 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0">
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Expanded subrace editor */}
              {openSubrace === s.id && (
                <div className="border-t border-slate-800 px-3 pb-3 flex flex-col gap-3">
                  <div className="mt-2">
                    <span className="text-[9px] uppercase text-slate-600 font-semibold">Subrace Name</span>
                    <input
                      value={s.name}
                      onChange={e => updateSubrace(s.id, { name: e.target.value })}
                      placeholder="High Elf, Wood Elf, Dark Elf…"
                      className="mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-600 placeholder:text-slate-700 w-full"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-slate-600 font-semibold block mb-2">Subrace Traits</span>
                    <TraitList
                      traits={s.traits}
                      onChange={next => updateSubrace(s.id, { traits: next })}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          <button type="button" onClick={addSubrace}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-400 transition-colors py-1">
            <Plus className="size-4" /> Add Subrace
          </button>
        </div>
      </Section>
    </>
  )
}

// ── FeatFields ─────────────────────────────────────────────────────────────────

function FeatFields({ d, set }: { d: Record<string,any>; set: (k: string, v: any) => void }) {
  return (
    <>
      <Section title="Requirements (optional)">
        <Field label="Prerequisite" hint="leave blank if none">
          <input value={d.prerequisite ?? ""} onChange={e => set("prerequisite", e.target.value)} placeholder="Proficiency with a musical instrument, CHA 13+…" className={inp} />
        </Field>
      </Section>

      <Section title="Description">
        <MarkdownTextarea
          value={d.description ?? ""}
          onChange={v => set("description", v)}
          placeholder="You gain the ability to…&#10;&#10;**Bonus Action.** You can use a bonus action to…"
          rows={8}
          className={`${inp} resize-y`}
        />
      </Section>
    </>
  )
}

// ── ItemFields ─────────────────────────────────────────────────────────────────

function ItemFields({ d, set }: { d: Record<string,any>; set: (k: string, v: any) => void }) {
  return (
    <>
      <Section title="Properties">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Rarity">
            <select value={d.rarity ?? "common"} onChange={e => set("rarity", e.target.value)} className={sel}>
              {["common","uncommon","rare","very rare","legendary","artifact"].map(r => <option key={r} value={r}>{r.replace(/\b\w/g,(c:string)=>c.toUpperCase())}</option>)}
            </select>
          </Field>
          <Field label="Item Type">
            <select value={d.item_type ?? "wondrous"} onChange={e => set("item_type", e.target.value)} className={sel}>
              {["armor","potion","ring","rod","scroll","staff","wand","weapon","wondrous","other"].map(t => <option key={t} value={t}>{t.replace(/\b\w/g,(c:string)=>c.toUpperCase())}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Attunement">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={!!d.requires_attunement} onChange={e => set("requires_attunement", e.target.checked)} className="rounded accent-purple-500 size-4" />
            <span className="text-sm text-slate-300">Requires Attunement</span>
          </label>
        </Field>
      </Section>

      {d.item_type === "weapon" && (
        <Section title="Weapon Stats">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Damage" hint="e.g. 1d8">
              <input value={d.damage ?? ""} onChange={e => set("damage", e.target.value)} placeholder="1d8" className={inp} />
            </Field>
            <Field label="Damage Type" hint="e.g. Slashing">
              <input value={d.damage_type ?? ""} onChange={e => set("damage_type", e.target.value)} placeholder="Slashing" className={inp} />
            </Field>
          </div>
          <Field label="Properties" hint="comma-separated">
            <input value={d.properties ?? ""} onChange={e => set("properties", e.target.value)} placeholder="Versatile, Finesse…" className={inp} />
          </Field>
        </Section>
      )}

      <Section title="Description">
        <MarkdownTextarea
          value={d.description ?? ""}
          onChange={v => set("description", v)}
          placeholder="Describe the item's magical properties…"
          rows={5}
          className={`${inp} resize-none`}
        />
      </Section>
    </>
  )
}

// ── Main DocEntryForm ──────────────────────────────────────────────────────────

interface Props {
  type: DocType
  initial?: DocEntry
  isHomebrew: boolean
  userId: string | null
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void  // provided only when caller has permission to delete
}

export function DocEntryForm({ type, initial, isHomebrew, userId, onSave, onCancel, onDelete }: Props) {
  const [name,          setName]          = useState(initial?.name ?? "")
  const [desc,          setDesc]          = useState(initial?.description ?? "")
  const [data,          setData]          = useState<Record<string,any>>(initial?.data ?? defaultData(type))
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string|null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  function setField(k: string, v: any) {
    setData(prev => ({ ...prev, [k]: v }))
  }

  const isSubclass = type === "classes" && !!data.is_subclass
  const entryLabel = isSubclass ? "Subclass" : TYPE_LABEL[type]

  async function save() {
    if (!name.trim()) { setError("Name is required"); return }
    setSaving(true)
    setError(null)

    const payload = {
      name: name.trim(),
      type: SINGULAR[type],
      description: desc.trim(),
      is_homebrew: isHomebrew,
      owner_id: isHomebrew ? userId : null,
      source: isHomebrew ? "homebrew" : "2014",
      data,
    }

    const { error: err } = initial?.id
      ? await supabase.from("documentation").update(payload).eq("id", initial.id)
      : await supabase.from("documentation").insert(payload)

    setSaving(false)
    if (err) { setError(err.message); return }
    invalidateSuggestionCache()
    onSave()
  }

  async function handleDelete() {
    if (!initial?.id || !onDelete) return
    setDeleting(true)
    await supabase.from("documentation").delete().eq("id", initial.id)
    setDeleting(false)
    invalidateSuggestionCache()
    onDelete()
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl pb-8">

      {/* Back */}
      <button onClick={onCancel} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit -mb-2">
        <ArrowLeft className="size-4" /> Back
      </button>

      {/* Heading */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-slate-100">
          {initial ? "Edit" : "New"} {entryLabel}
        </h2>
        {isHomebrew ? (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-purple-600/15 border border-purple-600/30 text-purple-400">
            Homebrew
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
            Core Entry
          </span>
        )}
      </div>

      {/* Common fields */}
      <Section title="Identity">
        <Field label="Name *">
          <input value={name} onChange={e => setName(e.target.value)} placeholder={`${entryLabel} name…`} className={inp} />
        </Field>
        <Field label="Source" hint="shown on card — e.g. Player's Handbook p.51">
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Player's Handbook p.51, Xanathar's Guide…" className={inp} />
        </Field>
      </Section>

      {/* Type-specific fields */}
      {type === "classes" && <ClassFields d={data} set={setField} isHomebrew={isHomebrew} userId={userId} />}
      {type === "races"   && <RaceFields  d={data} set={setField} />}
      {type === "feats"   && <FeatFields  d={data} set={setField} />}
      {type === "items"   && <ItemFields  d={data} set={setField} />}

      {error && <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>}

      {/* Delete confirmation inline */}
      {confirmDelete && (
        <div className="flex flex-col gap-3 rounded-xl border border-red-800/40 bg-red-950/20 p-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="size-4" />
            <span className="text-sm font-semibold">Delete "{name || entryLabel}"?</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            This will permanently remove the entry. Library users who added it will lose it from their collections.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-lg text-sm text-slate-400 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-red-700 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, Delete"}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {onDelete && !confirmDelete && initial?.id && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm text-red-400 border border-red-800/40 hover:bg-red-400/10 transition-colors"
          >
            <Trash2 className="size-4" /> Delete
          </button>
        )}
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200 transition-colors">
          Cancel
        </button>
        <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          <Save className="size-4" />
          {saving ? "Saving…" : initial ? "Save Changes" : `Add ${entryLabel}`}
        </button>
      </div>
    </div>
  )
}
