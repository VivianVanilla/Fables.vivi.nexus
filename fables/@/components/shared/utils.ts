// Small helper functions used throughout the character sheet

import type { CharacterData, Feature, SpellItem, CharacterConditional, CharacterForm, FormStatOverrides, FavoriteRef } from "./types"

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
  const equippedArmor = [
    ...(data.items ?? []).filter(i => i.equipped),
    // An armour infusion (Armour of Magical Strength, a homebrew armour
    // infusion) counts toward AC while it's active AND equipped — same as any
    // other piece of armour.
    ...(data.infusions ?? []).filter(f => infusionIsActive(f) && (f.equipped ?? true)),
  ].filter(i => (i.equipKind ?? "armor") === "armor")

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

/**
 * Folds a reordered filtered subset (e.g. drag-reordering just the
 * "Equipped" items) back into its full source array without disturbing the
 * position of items that don't match `predicate`. `newOrder` must be a
 * permutation of exactly the items `full` that satisfy `predicate` — true by
 * construction when it comes from reordering that same filtered view.
 */
export function reorderSubset<T>(full: T[], predicate: (item: T) => boolean, newOrder: T[]): T[] {
  let i = 0
  return full.map(item => predicate(item) ? newOrder[i++] : item)
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
/**
 * Grants a form's resistances/vulnerabilities on top of the given arrays —
 * granting one cancels the opposite on the same type first, same 5e rule the
 * ⚖ Resistances panel's click-to-cycle already follows.
 */
export function grantFormResistances(resistances: string[], vulnerabilities: string[], form: CharacterForm | null) {
  let res = resistances, vul = vulnerabilities
  for (const type of form?.grantedResistances ?? []) {
    vul = vul.filter(t => t !== type)
    if (!res.includes(type)) res = [...res, type]
  }
  for (const type of form?.grantedVulnerabilities ?? []) {
    res = res.filter(t => t !== type)
    if (!vul.includes(type)) vul = [...vul, type]
  }
  return { resistances: res, vulnerabilities: vul }
}

/**
 * Un-grants whatever revertingForms granted — unless a form in
 * remainingForms (still active, multi-form mode) grants that same type, in
 * which case it stays. There's no per-instance provenance to check (unlike
 * ActiveCondition.source): a damage type can only appear once in either
 * array, so comparing against the forms' own static granted lists is exact.
 */
export function revokeFormResistances(
  resistances: string[], vulnerabilities: string[], revertingForms: CharacterForm[], remainingForms: CharacterForm[],
) {
  const revertingRes = new Set(revertingForms.flatMap(f => f.grantedResistances ?? []))
  const revertingVul = new Set(revertingForms.flatMap(f => f.grantedVulnerabilities ?? []))
  const stillRes = new Set(remainingForms.flatMap(f => f.grantedResistances ?? []))
  const stillVul = new Set(remainingForms.flatMap(f => f.grantedVulnerabilities ?? []))
  return {
    resistances: resistances.filter(t => !(revertingRes.has(t) && !stillRes.has(t))),
    vulnerabilities: vulnerabilities.filter(t => !(revertingVul.has(t) && !stillVul.has(t))),
  }
}

/**
 * Adds/removes a Favorites entry for a form's favoriteFamiliarId AND/OR
 * favoriteFeatureId, if either the form(s) losing activation or the one
 * gaining it name one — shared by every activate/revert path
 * (formActivationPatch, toggleFormPatch below, and CharacterSheet.tsx's
 * 0-HP auto-revert) so "auto-favorite on activate" behaves identically no
 * matter how a form starts or ends, and for either kind of target. A form
 * can name both at once (e.g. auto-favorite a familiar AND a weapon).
 *
 * `remainingForms` — forms staying active through this transition
 * (multi-form mode only; omit/[] in single-form mode where nothing ever
 * "remains") — guards against unfavoriting something a still-active form
 * also names, just because a *different* form naming the same id happens
 * to be the one leaving.
 *
 * Returns undefined (touch nothing) when nothing named on either side
 * actually changes, so callers can spread the result into their patch only
 * when it's actually needed.
 */
export function favoriteFormSwap(
  data: CharacterData, leaving: CharacterForm | CharacterForm[] | null, entering: CharacterForm | null,
  remainingForms: CharacterForm[] = [],
): FavoriteRef[] | undefined {
  const leavingForms = Array.isArray(leaving) ? leaving : leaving ? [leaving] : []
  const stillWanted = new Set(
    remainingForms.flatMap(f => [f.favoriteFamiliarId, f.favoriteFeatureId]).filter((id): id is string => !!id)
  )
  const leavingIds = leavingForms
    .flatMap(f => [f.favoriteFamiliarId, f.favoriteFeatureId])
    .filter((id): id is string => !!id && !stillWanted.has(id))
  const enteringFamiliarId = entering?.favoriteFamiliarId
  const enteringFeatureId  = entering?.favoriteFeatureId
  if (leavingIds.length === 0 && !enteringFamiliarId && !enteringFeatureId) return undefined
  let favorites = data.favorites ?? []
  if (leavingIds.length) favorites = favorites.filter(f => !leavingIds.includes(f.refId))
  if (enteringFamiliarId && !favorites.some(f => f.refId === enteringFamiliarId)) {
    const fam = (data.familiars ?? []).find(f => f.id === enteringFamiliarId)
    if (fam) favorites = [...favorites, { refId: fam.id, refType: "familiar", label: fam.nickname || "Familiar" }]
  }
  if (enteringFeatureId && !favorites.some(f => f.refId === enteringFeatureId)) {
    // Same six lists CharacterSheet.tsx concatenates into its own
    // allFeatures — plain data, no migration/dedup step, so re-deriving it
    // here needs no extra plumbing through every activate/revert call site.
    const allFeatures: Feature[] = [
      ...(data.racialTraits ?? []), ...(data.feats ?? []), ...(data.classFeatures ?? []),
      ...(data.items ?? []), ...(data.invocations ?? []), ...(data.infusions ?? []),
    ]
    const feat = allFeatures.find(f => f.id === enteringFeatureId)
    if (feat) favorites = [...favorites, { refId: feat.id, refType: "feature", label: feat.name }]
  }
  return favorites
}

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
  const revoked = revokeFormResistances(data.resistances ?? [], data.vulnerabilities ?? [], activeForm ? [activeForm] : [], next ? [next] : [])
  const granted = grantFormResistances(revoked.resistances, revoked.vulnerabilities, next)
  const patch: Partial<CharacterData> = {
    activeFormId: id, conditions: nextConditions,
    resistances: granted.resistances, vulnerabilities: granted.vulnerabilities,
  }
  // Activating a form with its own HP pool starts it fresh at full — the
  // character's own hp/maxHp are left completely untouched underneath.
  if (next?.formMaxHp != null) patch.formHp = next.formMaxHp
  // The form being left behind can opt to strip current temp HP outright
  // (removeTempHpOnRevert) — the incoming form's own grant, if any, still
  // applies on top of that clean slate rather than being skipped.
  if (activeForm?.removeTempHpOnRevert) {
    patch.tempHp = next?.tempHp ? Math.max(0, next.tempHp) : 0
  } else if (next?.tempHp) {
    // Same "take the higher, not additive" semantics as CharacterConditional's tempHp.
    patch.tempHp = Math.max(data.tempHp ?? 0, next.tempHp)
  }
  const swappedFavorites = favoriteFormSwap(data, activeForm, next)
  if (swappedFavorites) patch.favorites = swappedFavorites
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
  let acBonusSum = 0, maxHpBonusSum = 0, carryCapacityBonusSum = 0, speedBonusSum = 0
  let weaponToHitSum = 0, weaponDamageSum = 0
  const skillBonusSums: Record<string, number> = {}
  const visionMax: Record<string, number> = {}
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
    carryCapacityBonusSum += ov.carryCapacityBonus ?? 0
    speedBonusSum += ov.speedBonus ?? 0
    weaponToHitSum += ov.weaponToHitBonus ?? 0
    weaponDamageSum += ov.weaponDamageBonus ?? 0
    for (const [skill, amount] of Object.entries(ov.skillBonuses ?? {})) {
      skillBonusSums[skill] = (skillBonusSums[skill] ?? 0) + amount
    }
    // Take the higher range per type across every active form (not summed —
    // see FormStatOverrides.grantedVision's own comment).
    for (const [type, range] of Object.entries(ov.grantedVision ?? {})) {
      visionMax[type] = Math.max(visionMax[type] ?? 0, range)
    }
  }
  if (acBonusSum) merged.acBonus = acBonusSum
  if (maxHpBonusSum) merged.maxHpBonus = maxHpBonusSum
  if (carryCapacityBonusSum) merged.carryCapacityBonus = carryCapacityBonusSum
  if (speedBonusSum) merged.speedBonus = speedBonusSum
  if (weaponToHitSum) merged.weaponToHitBonus = weaponToHitSum
  if (weaponDamageSum) merged.weaponDamageBonus = weaponDamageSum
  if (Object.keys(skillBonusSums).length > 0) merged.skillBonuses = skillBonusSums
  if (Object.keys(visionMax).length > 0) merged.grantedVision = visionMax
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
    const remainingIds = activeIds.filter(id => id !== formId)
    const remainingForms = remainingIds.map(fid => forms.find(f => f.id === fid)).filter((f): f is CharacterForm => !!f)
    const revoked = revokeFormResistances(data.resistances ?? [], data.vulnerabilities ?? [], [form], remainingForms)
    const patch: Partial<CharacterData> = {
      activeFormIds: remainingIds,
      conditions: conditions.filter(c => c.source !== `form:${formId}`),
      resistances: revoked.resistances, vulnerabilities: revoked.vulnerabilities,
    }
    if (form.removeTempHpOnRevert) patch.tempHp = 0
    const swappedFavorites = favoriteFormSwap(data, form, null, remainingForms)
    if (swappedFavorites) patch.favorites = swappedFavorites
    return patch
  }

  let nextConditions = conditions
  for (const name of form.grantedConditions ?? []) {
    if (!nextConditions.some(c => c.name === name)) {
      nextConditions = [...nextConditions, { id: nanoid(), name, source: `form:${form.id}` }]
    }
  }
  const granted = grantFormResistances(data.resistances ?? [], data.vulnerabilities ?? [], form)
  const patch: Partial<CharacterData> = {
    activeFormIds: [...activeIds, formId], conditions: nextConditions,
    resistances: granted.resistances, vulnerabilities: granted.vulnerabilities,
  }
  if (form.formMaxHp != null) patch.formHp = form.formMaxHp
  if (form.tempHp) patch.tempHp = Math.max(data.tempHp ?? 0, form.tempHp)
  const swappedFavorites = favoriteFormSwap(data, null, form)
  if (swappedFavorites) patch.favorites = swappedFavorites
  return patch
}

/**
 * Activates a form as a side effect of something else — casting a spell,
 * spending a feature's use, triggering a conditional — always "make sure
 * this form is active," never a toggle (repeating the trigger shouldn't
 * turn it back off, unlike FormSwitcher's multi-form checklist). In
 * ordinary single-form mode this is exactly formActivationPatch's exclusive
 * swap; in multi-form mode (see CharacterData.activeFormIds — currently
 * gated to one specific character, see CharacterSheet.tsx's
 * multiFormEnabled) it adds the form to the active set instead, alongside
 * whatever's already running, since stacking is multi-form's whole point.
 * Every trigger path (castSpellPatch/featureUsePatch/conditionalTriggerPatch)
 * needs to know which mode it's in, since they can't tell on their own —
 * that's plain CharacterData, not something derivable from `data` alone.
 */
export function activateFormPatch(data: CharacterData, formId: string, multiForm?: boolean): Partial<CharacterData> {
  if (!multiForm) return formActivationPatch(data, formId)
  if ((data.activeFormIds ?? []).includes(formId)) return {} // already active — a no-op, not a toggle-off
  return toggleFormPatch(data, formId)
}

/**
 * A spell's Cast configuration (castSlotId/castSlotMode/castFormId/
 * castConditionalId/castGrantConditions) — all independent, all composed
 * into one patch here so a single Cast click applies them together
 * atomically.
 */
export function castSpellPatch(data: CharacterData, spell: SpellItem, multiForm?: boolean): Partial<CharacterData> {
  const spellSlots = data.spellSlots ?? []
  const conditions = data.conditions ?? []
  const patch: Partial<CharacterData> = spell.castFormId ? activateFormPatch(data, spell.castFormId, multiForm) : {}
  if (spell.castSlotMode === "atOrAbove" && spell.level != null) {
    // Lowest-level slot at or above the spell's own level that still has a
    // use free — a 4th-level spell spends a 4th if one's open, otherwise
    // auto-upcasts into the next level up with room. Pact slots are only
    // reached once every non-Pact candidate is exhausted, same
    // Warlock-safety reasoning as the specific-slot picker's own default
    // guess (SpellCastEditor) — this just extends it across levels instead
    // of stopping at an exact-level match.
    const candidates = spellSlots.filter(s => s.level >= spell.level! && s.used < s.total)
    const slot = candidates.filter(s => !s.pact).sort((a, b) => a.level - b.level)[0]
      ?? candidates.filter(s => s.pact).sort((a, b) => a.level - b.level)[0]
    if (slot) patch.spellSlots = spellSlots.map(s => s.id === slot.id ? { ...s, used: s.used + 1 } : s)
  } else if (spell.castSlotId) {
    const slot = spellSlots.find(s => s.id === spell.castSlotId && s.used < s.total)
    if (slot) patch.spellSlots = spellSlots.map(s => s.id === slot.id ? { ...s, used: s.used + 1 } : s)
  }
  if (spell.castConditionalId) {
    const conditional = (data.conditionals ?? []).find(c => c.id === spell.castConditionalId)
    if (conditional) Object.assign(patch, conditionalTriggerPatch({ ...data, ...patch }, conditional, multiForm))
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
export function conditionalTriggerPatch(data: CharacterData, c: CharacterConditional, multiForm?: boolean): Partial<CharacterData> {
  // Activates the linked Form (if any) first, same as castSpellPatch does
  // for a spell's castFormId — everything below then reads off `merged`
  // instead of `data` so a heal/temp HP/condition grant reflects the form
  // it just switched into (its own max HP bonus, granted conditions, etc.)
  // rather than the character's plain pre-activation state.
  const patch: Partial<CharacterData> = c.triggerFormId ? activateFormPatch(data, c.triggerFormId, multiForm) : {}
  const merged = { ...data, ...patch }
  if (c.tempHp) patch.tempHp = Math.max(merged.tempHp ?? 0, c.tempHp)
  if (c.healHp) {
    const maxHp = Math.max(0, (merged.maxHp ?? 0) + (merged.maxHpMod ?? 0))
    patch.hp = Math.min(maxHp, (merged.hp ?? 0) + c.healHp)
  }
  if (c.grantConditions?.length) {
    const conditions = patch.conditions ?? merged.conditions ?? []
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
export function featureUsePatch(data: CharacterData, feature: Feature, multiForm?: boolean): Partial<CharacterData> {
  const patch: Partial<CharacterData> = feature.triggerFormId ? activateFormPatch(data, feature.triggerFormId, multiForm) : {}
  if (feature.triggerConditionalId) {
    const conditional = (data.conditionals ?? []).find(c => c.id === feature.triggerConditionalId)
    if (conditional) Object.assign(patch, conditionalTriggerPatch({ ...data, ...patch }, conditional, multiForm))
  }
  return patch
}

/** Whether an infusion is currently doing anything for THIS character — it's
 *  infused, and (only if location tracking is turned on for it) the infused
 *  item is on this character rather than a party member. Drives its automation
 *  (triggerFormId/triggerConditionalId) and whether it counts as worn armour. */
export function infusionIsActive(infusion: Feature): boolean {
  if (!infusion.infused) return false
  if (!infusion.infusionTrackLocation) return true  // not tracking whereabouts = assume it's on you
  return infusion.infusionOnSelf ?? true
}

/**
 * An infusion's linked Form/Conditional (triggerFormId/triggerConditionalId),
 * fired when the infusion becomes active for this character (infused AND
 * infusionOnSelf) and — for the Form — reverted when it stops. Conditionals
 * are one-shot, so there's nothing to pull back there. Called from
 * CharacterSheet's patchFeature whenever an infusion's infused/onSelf flags
 * flip, mirroring how featureUsePatch fires on a use-spend.
 */
export function infusionAutoPatch(
  data: CharacterData, infusion: Feature, active: boolean, multiForm?: boolean,
): Partial<CharacterData> {
  if (active) {
    const patch: Partial<CharacterData> = infusion.triggerFormId
      ? activateFormPatch(data, infusion.triggerFormId, multiForm) : {}
    if (infusion.triggerConditionalId) {
      const c = (data.conditionals ?? []).find(x => x.id === infusion.triggerConditionalId)
      if (c) Object.assign(patch, conditionalTriggerPatch({ ...data, ...patch }, c, multiForm))
    }
    return patch
  }
  // Turning off — only pull down the Form this infusion put up, and only while
  // it's still the active one, so a Form the player switched into by hand is
  // never yanked out from under them.
  const fid = infusion.triggerFormId
  if (!fid) return {}
  if (multiForm) return (data.activeFormIds ?? []).includes(fid) ? toggleFormPatch(data, fid) : {}
  return data.activeFormId === fid ? formActivationPatch(data, null) : {}
}
