// Small helper functions used throughout the character sheet

import type { CharacterData, Feature, SpellItem, CharacterConditional, CharacterForm, FormStatOverrides } from "./types"

/** Returns the ability modifier as a signed string, e.g. "+2" or "-1" */
export function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2)
  return mod >= 0 ? `+${mod}` : `${mod}`
}

const AC_ABILITY_TO_FULL: Record<string, "strength" | "dexterity" | "constitution" | "intelligence" | "wisdom" | "charisma"> = {
  str: "strength", dex: "dexterity", con: "constitution",
  int: "intelligence", wis: "wisdom", cha: "charisma",
}

/** Returns the flat ability modifier (number) for a short key ("str", "dex", ...), default score 10 if unset */
export function abilityScoreMod(data: CharacterData, key?: string): number {
  const full = key ? AC_ABILITY_TO_FULL[key] : undefined
  const score = (full ? data[full] : undefined) ?? 10
  return Math.floor((score - 10) / 2)
}

export interface AcResult {
  total: number
  base: number
  equipBonus: number      // stacked flat bonuses from equipped shields/rings/etc.
  armorName?: string      // name of the equipped "base armor" piece driving `base`, if set
}

/**
 * Computes a character's AC: 10 + the chosen ability modifier(s) (dual-stat aware),
 * overridden by any equipped "base armor" piece's own base-AC + Dex formula, plus
 * flat bonuses from equipped shields/rings/etc. Legacy characters that never opened
 * the AC picker (no acAbility set) keep their old manually-typed `ac` value as-is.
 */
export function computeAc(data: CharacterData): AcResult {
  const equippedArmor = (data.items ?? []).filter(i => i.equipped && (i.equipKind ?? "armor") === "armor")

  const baseArmor = equippedArmor
    .filter(i => i.itemMeta?.armorMode === "base" && i.itemMeta?.armorBaseAc != null)
    .map(i => {
      const dexMode = i.itemMeta?.armorDexMode ?? "full"
      const dexMod  = abilityScoreMod(data, "dex")
      const applied = dexMode === "none" ? 0 : dexMode === "half" ? Math.min(dexMod, 2) : dexMod
      return { name: i.name, value: (i.itemMeta!.armorBaseAc ?? 0) + applied }
    })
    .sort((a, b) => b.value - a.value)[0]

  const equipBonus = equippedArmor
    .filter(i => i.itemMeta?.armorMode !== "base")
    .reduce((sum, i) => sum + (i.itemMeta?.acBonus ?? 0), 0)

  let base: number
  let armorName: string | undefined
  if (baseArmor) {
    base = baseArmor.value
    armorName = baseArmor.name
  } else if (data.acAbility == null && data.acAbility2 == null && data.acBase == null && data.ac != null) {
    base = data.ac
  } else {
    base = (data.acBase ?? 10) + abilityScoreMod(data, data.acAbility ?? "dex") + (data.acAbility2 ? abilityScoreMod(data, data.acAbility2) : 0)
  }

  return { total: base + equipBonus + (data.acMiscBonus ?? 0), base, equipBonus, armorName }
}

/** Returns the proficiency bonus for a given character level */
export function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1
}

/** Generates a short random ID for list items */
export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Parses JSON safely, returns an empty object on failure */
export function safeParseJson(value: unknown): Record<string, unknown> {
  try {
    if (!value) return {}
    if (typeof value === "string") return JSON.parse(value)
    if (typeof value === "object") return value as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

// Avoids two notes sharing the exact same default name — appends " 2", " 3",
// etc. until the name is free, same pattern as "Untitled (2)" in most
// desktop file managers.
export function uniqueName(baseName: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map(n => n.trim().toLowerCase()))
  const base = baseName.trim()
  if (!taken.has(base.toLowerCase())) return base
  let i = 2
  while (taken.has(`${base} ${i}`.toLowerCase())) i++
  return `${base} ${i}`
}

// ── Prepared-caster max spell level, by character level in that class ─────────
// (standard 5e slot progression — full/half/pact casters only; other classes
// have no innate spell list to import from)
const FULL_CASTERS = new Set(["bard", "cleric", "druid", "sorcerer", "wizard"])
const HALF_CASTERS = new Set(["paladin", "ranger"])

/** Returns the highest spell level a class can prepare/know at a given character level (0 if it's not a spellcasting class). */
export function maxSpellLevelForClass(cls: string, level: number): number {
  const c = cls.toLowerCase()
  if (FULL_CASTERS.has(c)) return Math.min(9, Math.ceil(level / 2))
  if (HALF_CASTERS.has(c)) return level < 2 ? 0 : Math.min(5, Math.floor((level - 1) / 4) + 1)
  if (c === "warlock")     return Math.min(5, Math.ceil(level / 2))
  return 0
}

/**
 * IDs of items that shouldn't count toward the character's total carried
 * weight because they sit (at any depth) inside a container flagged
 * "Bag of Holding" (Feature.containerIgnoresWeight) — the container itself
 * still counts its own weight, and its own maxWeight capacity check still
 * uses each child's real weight; only the sheet-wide carry-weight total is
 * affected. See character.tsx's totalWeight and InfoTab.tsx's ContainerItemsList.
 */
export function weightExemptItemIds(items: Feature[]): Set<string> {
  const childrenOf = new Map<string, Feature[]>()
  items.forEach(i => {
    if (!i.parentId) return
    const list = childrenOf.get(i.parentId) ?? []
    list.push(i)
    childrenOf.set(i.parentId, list)
  })

  const exempt = new Set<string>()
  function markDescendants(id: string) {
    for (const child of childrenOf.get(id) ?? []) {
      if (exempt.has(child.id)) continue // guards against cyclic parentId data
      exempt.add(child.id)
      markDescendants(child.id)
    }
  }
  items.filter(i => i.containerIgnoresWeight).forEach(i => markDescendants(i.id))
  return exempt
}

// ── Automation — Forms / Conditionals / Cast ────────────────────────────────
// Pure functions (data in, patch out) shared by CharacterSheet.tsx (the
// header form-switcher, the 0-HP auto-revert effect) and AutomationModal.tsx
// (manual "Trigger"/"Cast" buttons) — both call the same logic against
// `onUpdate`/`update` rather than each keeping their own copy, so activating
// a Form or casting a spell behaves identically no matter where it's done from.

/**
 * Switches (or clears, id === null) the active Form, granting/revoking the
 * conditions each Form tags itself with (see ActiveCondition.source). Returns
 * a patch rather than applying it, so a caller that also needs to expend a
 * slot or add more conditions in the same click (see castSpellPatch below)
 * can merge everything into one update() instead of two racing writes off
 * the same stale `data`.
 */
export function formActivationPatch(data: CharacterData, id: string | null): Partial<CharacterData> {
  const forms = data.forms ?? []
  const conditions = data.conditions ?? []
  const activeForm = data.activeFormId ? forms.find(f => f.id === data.activeFormId) ?? null : null
  let nextConditions = conditions.filter(c => !(activeForm && c.source === `form:${activeForm.id}`))
  const next = id ? forms.find(f => f.id === id) ?? null : null
  for (const name of next?.grantedConditions ?? []) {
    if (!nextConditions.some(c => c.name === name)) {
      nextConditions = [...nextConditions, { id: nanoid(), name, source: `form:${next!.id}` }]
    }
  }
  const patch: Partial<CharacterData> = { activeFormId: id, conditions: nextConditions }
  // Activating a form with its own HP pool starts it fresh at full — the
  // character's own hp/maxHp are left completely untouched underneath.
  if (next?.formMaxHp != null) patch.formHp = next.formMaxHp
  // Same "take the higher, not additive" semantics as CharacterConditional's tempHp.
  if (next?.tempHp) patch.tempHp = Math.max(data.tempHp ?? 0, next.tempHp)
  return patch
}

/**
 * Combines every simultaneously-active form's overrides into one — used by
 * multi-form mode (see CharacterData.activeFormIds) where more than one form
 * can be active at once. Ability scores / AC override / speed override are
 * last-defined-wins (later forms in the list take priority, so a
 * later-activated form can knock out an earlier one's number); AC bonus and
 * Max HP bonus are additive, since those are the kind of thing that's meant
 * to stack (a Mutagen's +2 AC on top of a Wild Shape's, say). Also correct
 * for the ordinary single-form case: called with a 0-or-1-element array, it
 * degenerates to exactly today's `activeForm?.overrides` behavior.
 */
export function mergeFormOverrides(forms: CharacterForm[]): FormStatOverrides {
  const merged: FormStatOverrides = {}
  let acBonusSum = 0, maxHpBonusSum = 0
  for (const f of forms) {
    const ov = f.overrides
    if (!ov) continue
    if (ov.strength != null) merged.strength = ov.strength
    if (ov.dexterity != null) merged.dexterity = ov.dexterity
    if (ov.constitution != null) merged.constitution = ov.constitution
    if (ov.intelligence != null) merged.intelligence = ov.intelligence
    if (ov.wisdom != null) merged.wisdom = ov.wisdom
    if (ov.charisma != null) merged.charisma = ov.charisma
    if (ov.acOverride != null) merged.acOverride = ov.acOverride
    if (ov.speedOverride != null) merged.speedOverride = ov.speedOverride
    acBonusSum += ov.acBonus ?? 0
    maxHpBonusSum += ov.maxHpBonus ?? 0
  }
  if (acBonusSum) merged.acBonus = acBonusSum
  if (maxHpBonusSum) merged.maxHpBonus = maxHpBonusSum
  return merged
}

/**
 * Multi-form mode's equivalent of formActivationPatch — toggles one form's
 * membership in activeFormIds independently of whichever other forms are
 * already active, instead of formActivationPatch's exclusive single-slot
 * swap. Deactivating only strips that one form's granted conditions/HP pool
 * ownership; anything else stacked on top stays active.
 */
export function toggleFormPatch(data: CharacterData, formId: string): Partial<CharacterData> {
  const forms = data.forms ?? []
  const conditions = data.conditions ?? []
  const activeIds = data.activeFormIds ?? []
  const form = forms.find(f => f.id === formId)
  if (!form) return {}

  if (activeIds.includes(formId)) {
    return {
      activeFormIds: activeIds.filter(id => id !== formId),
      conditions: conditions.filter(c => c.source !== `form:${formId}`),
    }
  }

  let nextConditions = conditions
  for (const name of form.grantedConditions ?? []) {
    if (!nextConditions.some(c => c.name === name)) {
      nextConditions = [...nextConditions, { id: nanoid(), name, source: `form:${form.id}` }]
    }
  }
  const patch: Partial<CharacterData> = { activeFormIds: [...activeIds, formId], conditions: nextConditions }
  if (form.formMaxHp != null) patch.formHp = form.formMaxHp
  if (form.tempHp) patch.tempHp = Math.max(data.tempHp ?? 0, form.tempHp)
  return patch
}

/**
 * A spell's Cast configuration (castSlotId/castFormId/castConditionalId/
 * castGrantConditions) — all independent, all composed into one patch here
 * so a single Cast click applies them together atomically.
 */
export function castSpellPatch(data: CharacterData, spell: SpellItem): Partial<CharacterData> {
  const spellSlots = data.spellSlots ?? []
  const conditions = data.conditions ?? []
  const patch: Partial<CharacterData> = spell.castFormId ? formActivationPatch(data, spell.castFormId) : {}
  if (spell.castSlotId) {
    const slot = spellSlots.find(s => s.id === spell.castSlotId && s.used < s.total)
    if (slot) patch.spellSlots = spellSlots.map(s => s.id === slot.id ? { ...s, used: s.used + 1 } : s)
  }
  if (spell.castConditionalId) {
    const conditional = (data.conditionals ?? []).find(c => c.id === spell.castConditionalId)
    if (conditional) Object.assign(patch, conditionalTriggerPatch({ ...data, ...patch }, conditional))
  }
  if (spell.castGrantConditions?.length) {
    const base = patch.conditions ?? conditions
    const toAdd = spell.castGrantConditions.filter(n => !base.some(c => c.name === n))
    if (toAdd.length) patch.conditions = [...base, ...toAdd.map(name => ({ id: nanoid(), name }))]
  }
  return patch
}

/**
 * A Conditional is the lightweight sibling of a Form — a one-shot "apply
 * these effects now" (temp HP, healing, granted conditions) with no ongoing
 * active/revert state to track, for things that don't need a whole Form
 * (see CharacterConditional).
 */
export function conditionalTriggerPatch(data: CharacterData, c: CharacterConditional): Partial<CharacterData> {
  const patch: Partial<CharacterData> = {}
  if (c.tempHp) patch.tempHp = Math.max(data.tempHp ?? 0, c.tempHp)
  if (c.healHp) {
    const maxHp = Math.max(0, (data.maxHp ?? 0) + (data.maxHpMod ?? 0))
    patch.hp = Math.min(maxHp, (data.hp ?? 0) + c.healHp)
  }
  if (c.grantConditions?.length) {
    const conditions = data.conditions ?? []
    const toAdd = c.grantConditions.filter(n => !conditions.some(x => x.name === n))
    if (toAdd.length) patch.conditions = [...conditions, ...toAdd.map(name => ({ id: nanoid(), name }))]
  }
  return patch
}

/**
 * A Feature's use-tracking automation (triggerFormId/triggerConditionalId) —
 * fires whenever a use of that feature is spent (see CharacterSheet.tsx's
 * patchFeature, which calls this only when usesUsed just went up, never on
 * a rest-reset or a manual refund). Same independent-and-composable shape as
 * castSpellPatch, just with no spell slot to expend.
 */
export function featureUsePatch(data: CharacterData, feature: Feature): Partial<CharacterData> {
  const patch: Partial<CharacterData> = feature.triggerFormId ? formActivationPatch(data, feature.triggerFormId) : {}
  if (feature.triggerConditionalId) {
    const conditional = (data.conditionals ?? []).find(c => c.id === feature.triggerConditionalId)
    if (conditional) Object.assign(patch, conditionalTriggerPatch({ ...data, ...patch }, conditional))
  }
  return patch
}
