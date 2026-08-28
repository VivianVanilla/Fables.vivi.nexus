// ════════════════════════════════════════════════════════════════════════════
// character.tsx — CharacterSheet root component
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useLayoutEffect } from "react"
import { Shield } from "lucide-react"

import type { SidebarObject } from "@/components/shell/sidebar-utils"
import { useUserContext } from "../../../src/contexts/UserContext"

import type {
  CharacterData, HitDicePool, SpellItem, EquipmentItem,
  SpellSlot, FavoriteRef, Feature, FamiliarRef, ActiveCondition, CharacterForm,
} from "@/components/shared/types"
import { SAVE_KEYS, SAVE_TO_ABILITY, CONDITION_EFFECTS, EXHAUSTION_EFFECTS, SPEED_ZERO_CONDITIONS, DEFAULT_ACCENT_COLOR } from "@/components/shared/constants"
import type { FavoriteCategory } from "@/components/shared/constants"
import { profBonus, nanoid, safeParseJson, computeAc, weightExemptItemIds, formActivationPatch, castSpellPatch, mergeFormOverrides, toggleFormPatch, featureUsePatch, revokeFormResistances } from "@/components/shared/utils"
import { THEMES, DEFAULT_THEME, CUSTOM_THEME_KEY, SLOT_THEMES, DEFAULT_SLOT_THEME, CUSTOM_SLOT_THEME_KEY, BG_OPTIONS, DEFAULT_BG_THEME, darkenHex } from "@/components/shared/themes"
import type { SlotTheme } from "@/components/shared/themes"
import { loadUserImages, uploadUserImage } from "@/components/shared/imageGallery"

// UI primitives
import { NumInput }              from "@/components/shared/ui/NumInput"

// Panels
import { DiceRoller }            from "./panels/DiceRoller"
import { ResistanceTracker }     from "./panels/ResistanceTracker"
import { CurrencyTracker }       from "./panels/CurrencyTracker"
import { HitDice }               from "./panels/HitDice"
import { DeathSavingThrows }     from "./panels/DeathSavingThrows"
import { ConditionsCard }        from "./panels/ConditionsCard"
import { AbilitiesCard }         from "./panels/AbilitiesCard"
import { SavesCard }             from "./panels/SavesCard"
import { SkillsCard }            from "./panels/SkillsCard"
import { SpellsEquipPanel }      from "./panels/SpellsEquipPanel"
import { FavoritesPanel }        from "./panels/FavoritesPanel"
import { FloatingPanel, DEFAULT_WIDTH as POPOUT_W, DEFAULT_HEIGHT as POPOUT_H } from "@/components/shared/ui/FloatingPanel"
import { FavoriteStar }          from "./ui/FavoriteStar"

// Modals
import { MaxStatsModal }         from "./modals/stats/MaxStatsModal"
import { SavesModal }            from "./modals/stats/SavesModal"
import { AbilityModal }          from "./modals/stats/AbilityModal"
import { SpellcastingModal }     from "./modals/SpellcastingModal"
import { SkillModal }            from "./modals/stats/SkillModal"
import { InitiativeModal }       from "./modals/stats/InitiativeModal"
import { ArmorClassModal }       from "./modals/stats/ArmorClassModal"
import { SpeedModal }            from "./modals/stats/SpeedModal"
import { CarryCapacityModal }    from "./modals/stats/CarryCapacityModal"
import { ConditionPickerModal }  from "./modals/pickers/ConditionPickerModal"
import { SettingsModal }         from "./modals/SettingsModal"
import { AutomationModal}        from "./modals/AutomationModal"
import { PortraitModal }         from "@/components/shared/PortraitModal"
import { SpeedDisplay }          from "@/components/shared/ui/SpeedDisplay"

// Tabs / other
import { InfoTab, type InfoSubTab } from "./tabs/InfoTab"
import { ItemsTab }              from "./tabs/ItemsTab"
import { FamiliarMonsterView }   from "@/components/shared/monster/monster"
import { FormSwitcher }          from "./FormSwitcher"
import { PartyServer }           from "@/components/party/PartyServer"
import { usePartyLatestMessageAt, isPartyUnread } from "@/components/party/unread"
import { ClassPickerModal }      from "./modals/pickers/ClassPickerModal"
import { RacePickerModal }       from "./modals/pickers/RacePickerModal"
import { Modal }                 from "@/components/shared/ui/Modal"

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface Props {
  character: SidebarObject
  readOnly?: boolean
}

type Tab = "main" | "details" | "items" | "chat"

// Exhaustion's effect depends on its level, so it's looked up in
// EXHAUSTION_EFFECTS instead of the flat CONDITION_EFFECTS map every other
// condition uses.
function conditionEffectText(c: ActiveCondition): string | undefined {
  return c.name === "Exhaustion" ? EXHAUSTION_EFFECTS[c.level ?? 1] : CONDITION_EFFECTS[c.name]
}

// ════════════════════════════════════════════════════════════════════════════
// CharacterSheet
// ════════════════════════════════════════════════════════════════════════════

export function CharacterSheet({ character, readOnly = false }: Props) {
  const { user, updateObject, objects } = useUserContext()

  // ── STATE ─────────────────────────────────────────────────────────────────

  const [saving,               setSaving]               = useState(false)
  const [uploading,            setUploading]             = useState(false)
  const [activeTab,            setActiveTab]             = useState<Tab>("main")

  // Modal visibility
  const [showMaxMenu,           setShowMaxMenu]           = useState(false)
  const [showSettingsModal,     setShowSettingsModal]     = useState(false)
  const [showRestModal,         setShowRestModal]          = useState(false)
  const [showConditionPicker,   setShowConditionPicker]   = useState(false)
  const [showPortraitPicker,    setShowPortraitPicker]    = useState(false)
  const [showSavesModal,        setShowSavesModal]        = useState(false)
  const [showAbilityModal,      setShowAbilityModal]      = useState(false)
  const [showSpellcastingModal, setShowSpellcastingModal] = useState(false)
  const [showSkillModal,        setShowSkillModal]        = useState<string | null>(null)
  const [showInitiativeModal,   setShowInitiativeModal]   = useState(false)
  const [showAcModal,           setShowAcModal]           = useState(false)
  const [showSpeedModal,        setShowSpeedModal]        = useState(false)
  const [showCarryModal,        setShowCarryModal]        = useState(false)
  const [showClassPicker,       setShowClassPicker]       = useState(false)
  const [showRacePicker,        setShowRacePicker]        = useState(false)
  const [showAutomationModal,     setShowAutomationModal] = useState(false)

  // Concentration check prompts (dismissible) — triggered by HP loss while "Concentrating" is active
  const [concentrationPrompts, setConcentrationPrompts] = useState<{ id: string; damage: number; dc: number }[]>([])
  // Deathward save notices (dismissible) — triggered when Deathward catches a drop to 0 HP
  const [deathwardTriggers, setDeathwardTriggers] = useState<{ id: string }[]>([])
  const prevHpRef = useRef<number | undefined>(undefined)

  // Portrait gallery
  const [galleryImages,  setGalleryImages]  = useState<{ name: string; publicUrl: string }[]>([])
  const [galleryLoading, setGalleryLoading] = useState(false)

  // HP controls
  const [hpStep,   setHpStep]   = useState(1)
  const [hpTarget, setHpTarget] = useState<"hp" | "temp">("hp")

  // Favorites
  const [favDragOver, setFavDragOver] = useState(false)

  // Familiar pop-out windows — ephemeral, resets on reload/reopen
  const [openPopouts, setOpenPopouts] = useState<Record<string, { x: number; y: number; w?: number; h?: number }>>({})

  // Quick search
  const [quickSearch, setQuickSearch] = useState("")

  // Sub-tab state lifted out of child panels so quick-search "navigate to" can drive them
  const [spellsSubTab, setSpellsSubTab] = useState<"spells" | "martial">("spells")
  const [infoSubTab,   setInfoSubTab]   = useState<InfoSubTab>("overview")

  // Newly-added spell — opens its edit modal automatically, once
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null)

  const portraitRef = useRef<HTMLInputElement>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [data, setData] = useState<CharacterData>(() => safeParseJson(character.data) as CharacterData)

  // No chat access at all in read-only mode (DM peeking at a party member's
  // sheet) — skip the subscription entirely rather than just hiding the badge.
  const partyLatestMessageAt = usePartyLatestMessageAt(readOnly ? "" : (data.partyCode ?? ""), user?.id ?? "")
  // Guarded on activeTab !== "chat" so the dot never lingers after you've
  // actually opened Chat — see the matching comment in campaign-view.tsx.
  const partyChatUnread = !readOnly && !!data.partyCode && !!user?.id && activeTab !== "chat" && isPartyUnread(user.id, data.partyCode, partyLatestMessageAt)

  // ── SAVE ──────────────────────────────────────────────────────────────────

  function scheduleSave(next: CharacterData) {
    if (readOnly) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try { await updateObject(character.id, { data: next as unknown as JSON }) }
      catch (e) { console.error(e) }
      setSaving(false)
    }, 700)
  }

  function update(patch: Partial<CharacterData>) {
    if (readOnly) return
    const next = { ...data, ...patch }
    setData(next)
    scheduleSave(next)
  }

  // ── PORTRAIT ──────────────────────────────────────────────────────────────

  async function openPortraitPicker() {
    setShowPortraitPicker(true)
    if (!user?.id) return
    setGalleryLoading(true)
    setGalleryImages(await loadUserImages(user.id))
    setGalleryLoading(false)
  }

  async function uploadPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    const url = await uploadUserImage(user.id, file, `portrait_${character.id}`)
    if (url) update({ portrait: url })
    setUploading(false)
    setShowPortraitPicker(false)
    e.target.value = ""
  }

  // ── FORMS (Automation) ────────────────────────────────────────────────────
  // Wild Shape / Haste / Rage-style presets — see CharacterForm. `ov` is the
  // merged stat overrides across every currently-active form (undefined when
  // on Base Form).

  // Multi-form (simultaneously-active forms, e.g. a shapeshifted form
  // stacked with a mutagen buff) is opt-in per character — see
  // data.multiFormMode's doc comment. Off by default, so everyone keeps the
  // exclusive single-active-form behavior unless they turn it on themselves.
  const multiFormEnabled = data.multiFormMode ?? false

  const forms = data.forms ?? []
  const activeForm = data.activeFormId ? forms.find(f => f.id === data.activeFormId) ?? null : null
  // activeForms is what everything below actually reads — for ordinary
  // characters it's just [activeForm] (or [] on Base Form), which makes
  // mergeFormOverrides et al. degenerate to exactly today's single-form math.
  const activeForms: CharacterForm[] = multiFormEnabled
    ? (data.activeFormIds ?? []).map(id => forms.find(f => f.id === id)).filter((f): f is CharacterForm => !!f)
    : (activeForm ? [activeForm] : [])
  const ov = activeForms.length > 0 ? mergeFormOverrides(activeForms) : undefined
  // Whichever active form has its own HP pool "owns" the one body/portrait —
  // you can't be in two bodies simultaneously even if several forms' other
  // effects (stat bonuses, conditions, notifications) are stacked at once.
  const poolForm = activeForms.find(f => f.formMaxHp != null) ?? null
  const portraitForm = activeForms.find(f => f.portraitUrl) ?? null

  // Which ability keys a Form is currently overriding — drives the blue
  // "this number is temporary" highlight in AbilitiesCard. AbilityModal (the
  // ✎ editor) still opens against raw `data`, never effectiveData below —
  // editing must always change the true base score, not the temporary one.
  const overriddenAbilityKeys = new Set(
    ov ? (["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"] as const)
      .filter(k => ov[k] != null) : []
  )

  // Surgical merged view for the specific read/calc sites below (AC ring,
  // save/skill mods, statMods, and AbilitiesCard's display) — never passed
  // to update()/scheduleSave, and never used as the value an edit form binds to.
  const effectiveData: CharacterData = ov ? {
    ...data,
    strength: ov.strength ?? data.strength, dexterity: ov.dexterity ?? data.dexterity,
    constitution: ov.constitution ?? data.constitution, intelligence: ov.intelligence ?? data.intelligence,
    wisdom: ov.wisdom ?? data.wisdom, charisma: ov.charisma ?? data.charisma,
    acMiscBonus: (data.acMiscBonus ?? 0) + (ov.acBonus ?? 0),
    ac: ov.acOverride ?? data.ac,
  } : data

  // ── HP COMPUTED ───────────────────────────────────────────────────────────
  // A form with its own formMaxHp (Wild Shape-style) tracks HP completely
  // separately from the character's own hp/maxHp — usingFormPool switches
  // every read/write below (ring, buttons, the 0-HP effect) onto that pool
  // instead, and back the instant the form isn't active anymore.

  const usingFormPool = poolForm != null
  const hp           = usingFormPool ? (data.formHp ?? poolForm!.formMaxHp!) : (data.hp ?? 0)
  const maxHp        = data.maxHp    ?? 0
  const maxHpMod     = data.maxHpMod ?? 0
  const effectiveMax = usingFormPool ? poolForm!.formMaxHp! : Math.max(0, maxHp + maxHpMod + (ov?.maxHpBonus ?? 0))
  const tempHp       = usingFormPool ? 0 : (data.tempHp ?? 0)
  const hpPercent    = effectiveMax > 0 ? Math.min(100, (hp / effectiveMax) * 100) : 0
  const tempHpPct    = effectiveMax > 0 ? Math.min(100, (tempHp / effectiveMax) * 100) : 0
  const hpColor      = hpPercent > 50 ? "#22c55e" : hpPercent > 25 ? "#eab308" : "#ef4444"
  const RING_R    = 32
  const TEMP_R    = 43
  const ringC     = 2 * Math.PI * RING_R
  const tempC     = 2 * Math.PI * TEMP_R

  // ── SPELL / EQUIPMENT HELPERS ─────────────────────────────────────────────

  const spellItems = data.spellItems     ?? []
  const equipItems = data.equipmentItems ?? []
  const spellSlots = (data.spellSlots ?? []).map((s, i) => s.id ? s : { ...s, id: `lv${s.level}-${i}` })
  const favorites  = data.favorites      ?? []
  const conditions = data.conditions     ?? []

  // ── CONDITION EFFECTS ─────────────────────────────────────────────────────

  const activeConditionNames = new Set(conditions.map(c => c.name))
  const speedOverrideReason  = SPEED_ZERO_CONDITIONS.find(name => activeConditionNames.has(name))
  const effectiveSpeed       = speedOverrideReason ? 0 : (ov?.speedOverride ?? data.speed ?? 0)

  // Derived from equipment rather than the manually-toggled `conditions` list,
  // so it can't drift out of sync with the armor that causes it — shown as a
  // badge next to the character's name in the header, not in ConditionsCard.
  const stealthDisadvantageArmor = (data.items ?? []).some(
    i => i.equipped && (i.equipKind ?? "armor") === "armor" && i.itemMeta?.stealthDisadvantage
  )

  // Concentration check: any HP loss while "Concentrating" is active prompts a save.
  // Deathward: catches the transition to 0 HP (or below) and corrects it back to 1,
  // burning the condition. Wild Shape-style forms (usingFormPool): the form's own
  // pool hitting 0 always reverts to Base Form and lands it at 1 HP, independent of
  // Deathward — two separate safety nets for two separate pools. Both run in a
  // useLayoutEffect (not useEffect) so the correction lands before the browser ever
  // paints the 0-HP frame (which would otherwise flash Death Saving Throws for one
  // frame before flipping back).
  useLayoutEffect(() => {
    const prevHp = prevHpRef.current
    if (prevHp !== undefined && hp <= 0 && prevHp > 0) {
      if (poolForm?.revertOnZeroHp) {
        // The pool-owning form (Wild Shape-style) hit 0 on its own separate
        // pool — reverts just that one form (any other stacked forms in
        // multi-form mode stay active) and lands the character's real hp at
        // 1, independent of Deathward below (a different safety net, for
        // the shared pool specifically).
        const baseConditions = conditions.filter(c => c.source !== `form:${poolForm.id}`)
        const remaining = multiFormEnabled ? activeForms.filter(f => f.id !== poolForm.id) : []
        const revoked = revokeFormResistances(data.resistances ?? [], data.vulnerabilities ?? [], [poolForm], remaining)
        update(multiFormEnabled
          ? { activeFormIds: (data.activeFormIds ?? []).filter(id => id !== poolForm.id), conditions: baseConditions, hp: 1, ...revoked }
          : { activeFormId: null, conditions: baseConditions, hp: 1, ...revoked })
      } else {
        const deathward = conditions.find(c => c.name === "Deathward")
        let patch: Partial<CharacterData> = {}
        if (deathward) {
          patch = { hp: 1, conditions: conditions.filter(c => c.id !== deathward.id) }
          setDeathwardTriggers(prev => [...prev, { id: nanoid() }])
        }
        // Auto-revert (opt-in per form) — merged into the same patch as
        // Deathward above rather than a second update() call, since update()
        // spreads off the current `data` closure and a second call in the
        // same tick would silently drop this one. Every currently-active
        // form that wants to auto-revert on 0 HP (and doesn't own its own
        // pool — handled above) reverts together.
        const revertForms = activeForms.filter(f => f.revertOnZeroHp)
        if (revertForms.length) {
          const revertIds = new Set(revertForms.map(f => f.id))
          const revertSources = new Set(revertForms.map(f => `form:${f.id}`))
          const baseConditions = (patch.conditions ?? conditions).filter(c => !c.source || !revertSources.has(c.source))
          const remaining = multiFormEnabled ? activeForms.filter(f => !revertIds.has(f.id)) : []
          const revoked = revokeFormResistances(data.resistances ?? [], data.vulnerabilities ?? [], revertForms, remaining)
          patch = multiFormEnabled
            ? { ...patch, activeFormIds: (data.activeFormIds ?? []).filter(id => !revertIds.has(id)), conditions: baseConditions, ...revoked }
            : { ...patch, activeFormId: null, conditions: baseConditions, ...revoked }
        }
        if (Object.keys(patch).length) update(patch)
      }
    }
    if (prevHp !== undefined && hp < prevHp && activeConditionNames.has("Concentrating")) {
      const damage = prevHp - hp
      const dc     = Math.max(10, Math.floor(damage / 2))
      setConcentrationPrompts(prev => [...prev, { id: nanoid(), damage, dc }])
    }
    prevHpRef.current = hp
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hp])

  const allFeatures: Feature[] = [
    ...(data.racialTraits  ?? []),
    ...(data.feats         ?? []),
    ...(data.classFeatures ?? []),
    ...(data.items         ?? []),
    ...(data.invocations   ?? []),
    ...(data.infusions     ?? []),
  ]

  // Which of the six Feature lists a given feature id came from — used only
  // to resolve its Favorites accent category (see FavoritesPanel.tsx); a
  // Feature itself carries no such tag since nothing else needs to tell these
  // lists apart once merged.
  const featureCategoryById: Record<string, FavoriteCategory> = {}
  ;(data.racialTraits  ?? []).forEach(f => { featureCategoryById[f.id] = "race" })
  ;(data.feats         ?? []).forEach(f => { featureCategoryById[f.id] = "feat" })
  ;(data.classFeatures ?? []).forEach(f => { featureCategoryById[f.id] = "class" })
  ;(data.items         ?? []).forEach(f => { featureCategoryById[f.id] = "item" })
  ;(data.invocations   ?? []).forEach(f => { featureCategoryById[f.id] = "invocation" })
  ;(data.infusions     ?? []).forEach(f => { featureCategoryById[f.id] = "infusion" })

  // AC = 10 + chosen ability mod(s) (dual-stat aware), overridden by an equipped "base
  // armor" piece's own base+Dex formula, plus flat bonuses from equipped shields/rings/etc.
  // Reads effectiveData so an active Form's Dex/AC overrides are reflected here too.
  const acResult = computeAc(effectiveData)

  // Items sent over to the Martial list keep a `sourceFeatureId` link — used both to render
  // "+ Martial Tab" as a toggle (on/off, not a repeatable spawn) and to avoid double-counting
  // their weight below (it's already counted via the source Feature in data.items).
  const equipmentLinkedIds = new Set(
    (data.equipmentItems ?? []).map(i => i.sourceFeatureId).filter((id): id is string => !!id)
  )

  // Total carried weight — items (× amount for stacked generics) + equipment (weapons/armor/gear),
  // excluding anything stashed inside a "Bag of Holding" container (Feature.containerIgnoresWeight)
  const weightExemptIds = weightExemptItemIds(data.items ?? [])
  const totalWeight =
    (data.items ?? []).reduce((sum, i) => sum + (weightExemptIds.has(i.id) ? 0 : (i.weight ?? 0) * (i.amount ?? 1)), 0) +
    (data.equipmentItems ?? []).reduce((sum, i) => sum + (i.sourceFeatureId ? 0 : (i.weight ?? 0)), 0)

  // Carrying capacity (PHB) — STR score × 15 lb, plus any flat bonus set via
  // the ⚖ badge (Bags of Holding, Belts of Giant Strength, feats, homebrew…)
  // and any active form's own carryCapacityBonus (the two stack). Reads
  // effectiveData.strength rather than the raw base score so a form that
  // boosts Strength (Bear/Bull forms, a strength mutagen, …) scales this
  // the same way it already scales AC/skills/saves, instead of silently
  // ignoring the override the way this used to.
  const carryCapacity = (effectiveData.strength ?? 10) * 15 + (data.carryCapacityBonus ?? 0) + (ov?.carryCapacityBonus ?? 0)
  const encumbered     = totalWeight > carryCapacity

  function addSpell() {
    const id = nanoid()
    update({ spellItems: [...spellItems, { id, name: "", level: 0 }] })
    setPendingSpellId(id)
  }
  function changeSpell(id: string, p: Partial<SpellItem>)     { update({ spellItems: spellItems.map(s => s.id === id ? { ...s, ...p } : s) }) }
  function removeSpell(id: string)                            { update({ spellItems: spellItems.filter(s => s.id !== id) }) }

  // A brand-new Martial entry is self-contained — no forced twin Items-tab
  // Feature. The sourceFeatureId link (see addItemToEquipment below) is only
  // for the reverse direction: an existing Gear item you deliberately send
  // over to Martial. Weight is still counted for a standalone entry — see
  // totalWeight above, which only skips equipment weight when sourceFeatureId
  // is set (already counted via that linked Feature instead).
  function addEquip() {
    update({ equipmentItems: [...equipItems, { id: nanoid(), name: "", type: "melee" }] })
  }
  function removeEquip(id: string)                            { update({ equipmentItems: equipItems.filter(i => i.id !== id) }) }

  // ── Armor & Equipment ↔ Martial backlink ─────────────────────────────────
  //
  // Once toggled on (via addItemToEquipment), a Martial entry keeps a
  // `sourceFeatureId` pointing back at its Items-tab Feature. These two helpers
  // convert between the two shapes' shared fields so edits made on either side
  // are mirrored onto the other — see changeEquip / patchFeature below, which
  // each perform one `update()` touching both slices, so there's no ping-pong.

  function equipmentFieldsFromFeature(feature: Feature): Partial<EquipmentItem> {
    const meta = feature.itemMeta
    const kind = feature.equipKind ?? (
      meta?.itemType?.toLowerCase().includes("weapon") ? "weapon" :
      meta?.itemType?.toLowerCase().includes("armor")  ? "armor"  : "misc"
    )
    return {
      name: feature.name,
      notes: feature.description ?? "",
      weight: feature.weight,
      type: kind === "weapon" ? (meta?.weaponKind ?? "melee") : kind,
      damage: meta?.damage,
      damageType: meta?.damageType,
      multiDamage: meta?.multiDamage,
      damages: meta?.damages,
      properties: meta?.properties,
      meleeRange: meta?.meleeRange,
      throwRange: meta?.throwRange,
      range: meta?.range,
      attackStat: meta?.attackStat,
      magicBonus: meta?.magicBonus,
      toHit: meta?.toHit,
      extraToHit: meta?.extraToHit,
      extraDamage: meta?.extraDamage,
      proficient: meta?.proficient,
      isMagicItem: feature.isMagicItem,
      trackable: feature.trackable,
      trackerLabel: feature.trackerLabel,
      maxUses: feature.maxUses,
      maxUsesFormula: feature.maxUsesFormula,
      usesUsed: feature.usesUsed,
      resetsOn: feature.resetsOn,
      multiTracking: feature.multiTracking,
      trackers: feature.trackers,
    }
  }

  function featureFieldsFromEquipment(equip: EquipmentItem, existingFeature: Feature): Partial<Feature> {
    const kind: NonNullable<Feature["equipKind"]> =
      equip.type === "melee" || equip.type === "ranged" ? "weapon" :
      equip.type === "armor" ? "armor" : "misc"
    return {
      name: equip.name,
      description: equip.notes ?? "",
      weight: equip.weight,
      equipKind: kind,
      isMagicItem: equip.isMagicItem,
      trackable: equip.trackable,
      trackerLabel: equip.trackerLabel,
      maxUses: equip.maxUses,
      maxUsesFormula: equip.maxUsesFormula,
      usesUsed: equip.usesUsed,
      resetsOn: equip.resetsOn,
      multiTracking: equip.multiTracking,
      trackers: equip.trackers,
      itemMeta: {
        ...existingFeature.itemMeta,
        damage: equip.damage,
        damageType: equip.damageType,
        multiDamage: equip.multiDamage,
        damages: equip.damages,
        properties: equip.properties,
        meleeRange: equip.meleeRange,
        throwRange: equip.throwRange,
        range: equip.range,
        weaponKind: kind === "weapon" ? (equip.type as "melee" | "ranged") : existingFeature.itemMeta?.weaponKind,
        attackStat: equip.attackStat,
        magicBonus: equip.magicBonus,
        toHit: equip.toHit,
        extraToHit: equip.extraToHit,
        extraDamage: equip.extraDamage,
        proficient: equip.proficient,
      },
    }
  }

  function changeEquip(id: string, p: Partial<EquipmentItem>) {
    const target = equipItems.find(i => i.id === id)
    const nextEquip = target ? { ...target, ...p } : undefined
    const patch: Partial<CharacterData> = {
      equipmentItems: equipItems.map(i => i.id === id ? { ...i, ...p } : i),
    }
    const sourceFeature = nextEquip?.sourceFeatureId ? (data.items ?? []).find(f => f.id === nextEquip.sourceFeatureId) : undefined
    if (nextEquip && sourceFeature) {
      patch.items = (data.items ?? []).map(f =>
        f.id === sourceFeature.id ? { ...f, ...featureFieldsFromEquipment(nextEquip, sourceFeature) } : f
      )
    }
    update(patch)
  }

  // Toggles an Items-tab entry into/out of the Equipment (martial) list — clicking
  // again removes the linked copy rather than spawning a duplicate.
  function addItemToEquipment(feature: Feature) {
    const existing = equipItems.find(i => i.sourceFeatureId === feature.id)
    if (existing) {
      update({ equipmentItems: equipItems.filter(i => i.id !== existing.id) })
      return
    }
    update({
      equipmentItems: [...equipItems, {
        id: nanoid(),
        sourceFeatureId: feature.id,
        ...equipmentFieldsFromFeature(feature),
        name: feature.name,
      }],
    })
  }

  // ── SPELL SLOT HELPERS ────────────────────────────────────────────────────

  function changeSlot(id: string, p: Partial<SpellSlot>) {
    update({ spellSlots: spellSlots.map(s => s.id === id ? { ...s, ...p } : s) })
  }
  function addSlot(level: number, total: number, resetsOn: "short" | "long") {
    const id   = `s${Date.now().toString(36)}`
    const next = [...spellSlots, { id, level, total, used: 0, resetsOn }]
                   .sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
    update({ spellSlots: next })
  }
  function removeSlot(id: string) { update({ spellSlots: spellSlots.filter(s => s.id !== id) }) }

  // ── FAVORITES HELPERS ─────────────────────────────────────────────────────

  function addFavorite(ref: FavoriteRef) {
    if (favorites.find(f => f.refId === ref.refId)) return
    update({ favorites: [...favorites, ref] })
  }
  function removeFavorite(refId: string) { update({ favorites: favorites.filter(f => f.refId !== refId) })
  }

  function toggleFeatureFavorite(id: string, label: string) {
    if (favorites.find(f => f.refId === id)) removeFavorite(id)
    else addFavorite({ refId: id, refType: "feature", label })
  }

  function toggleEquipmentFavorite(id: string, label: string) {
    if (favorites.find(f => f.refId === id)) removeFavorite(id)
    else addFavorite({ refId: id, refType: "equipment", label })
  }

  function reorderFavorites(fromIdx: number, toIdx: number) {
    const next = [...favorites]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    update({ favorites: next })
  }

  // ── FAMILIARS HELPERS ─────────────────────────────────────────────────────

  const familiars = data.familiars ?? []
  const monsters  = objects.filter(o => o.type === "monster")

  function addFamiliar(monsterId: string) {
    update({ familiars: [...familiars, { id: nanoid(), monsterId }] })
  }
  function updateFamiliar(id: string, patch: Partial<FamiliarRef>) {
    update({ familiars: familiars.map(f => f.id === id ? { ...f, ...patch } : f) })
  }
  function removeFamiliar(id: string) {
    update({
      familiars: familiars.filter(f => f.id !== id),
      favorites: favorites.filter(f => f.refId !== id),
    })
    closePopout(id)
  }
  function toggleFamiliarFavorite(id: string, label: string) {
    if (favorites.find(f => f.refId === id)) removeFavorite(id)
    else addFavorite({ refId: id, refType: "familiar", label })
  }

  // ── FAMILIAR POP-OUT HELPERS ──────────────────────────────────────────────

  function togglePopout(id: string) {
    setOpenPopouts(prev => {
      if (prev[id]) {
        const { [id]: _removed, ...rest } = prev
        return rest
      }
      const count = Object.keys(prev).length
      // Center on the actual viewport (using the same clamped size
      // FloatingPanel itself renders at) instead of a fixed x/y — a flat
      // 96px offset looked centered on desktop but pushed the panel mostly
      // off-screen on a narrow phone. Cascade additional popouts diagonally,
      // clamped so they never open past the visible edge.
      const w = Math.min(POPOUT_W, window.innerWidth - 16)
      const h = Math.min(POPOUT_H, window.innerHeight - 16)
      const baseX = Math.max(8, (window.innerWidth - w) / 2)
      const baseY = Math.max(8, (window.innerHeight - h) / 2)
      const x = Math.min(baseX + count * 28, Math.max(8, window.innerWidth - w - 8))
      const y = Math.min(baseY + count * 28, Math.max(8, window.innerHeight - h - 8))
      return { ...prev, [id]: { x, y } }
    })
  }
  function closePopout(id: string) {
    setOpenPopouts(prev => {
      if (!prev[id]) return prev
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }
  function movePopout(id: string, x: number, y: number) {
    setOpenPopouts(prev => prev[id] ? { ...prev, [id]: { ...prev[id], x, y } } : prev)
  }
  function resizePopout(id: string, w: number, h: number, x: number) {
    setOpenPopouts(prev => prev[id] ? { ...prev, [id]: { ...prev[id], w, h, x } } : prev)
  }

  function toggleFeatureLink(featureId: string, otherId: string) {
    const KEYS = ["racialTraits", "feats", "classFeatures", "items", "invocations", "infusions"] as const
    let featureKey: typeof KEYS[number] | null = null
    let otherKey:   typeof KEYS[number] | null = null
    for (const k of KEYS) {
      if (data[k]?.find(f => f.id === featureId)) featureKey = k
      if (data[k]?.find(f => f.id === otherId))   otherKey   = k
    }
    if (!featureKey || !otherKey) return
    const feature = data[featureKey]!.find(f => f.id === featureId)!
    const other   = data[otherKey]!.find(f => f.id === otherId)!
    const linked  = feature.linkedTo?.includes(otherId) ?? false
    const newFL = linked ? (feature.linkedTo ?? []).filter(id => id !== otherId) : [...(feature.linkedTo ?? []), otherId]
    const newOL = linked ? (other.linkedTo   ?? []).filter(id => id !== featureId) : [...(other.linkedTo ?? []), featureId]
    if (featureKey === otherKey) {
      update({ [featureKey]: data[featureKey]!.map(f => {
        if (f.id === featureId) return { ...f, linkedTo: newFL }
        if (f.id === otherId)   return { ...f, linkedTo: newOL }
        return f
      }) })
    } else {
      update({
        [featureKey]: data[featureKey]!.map(f => f.id === featureId ? { ...f, linkedTo: newFL } : f),
        [otherKey]:   data[otherKey]!.map(f => f.id === otherId     ? { ...f, linkedTo: newOL } : f),
      })
    }
  }

  function handleRest(type: "long" | "short" | "dawn") {
    const KEYS = ["racialTraits", "feats", "classFeatures", "items", "invocations", "infusions"] as const
    const patch: Partial<CharacterData> = {}
    for (const key of KEYS) {
      const features = data[key] ?? []
      const updated = features.map(f => {
        if (!f.trackable) return f
        const resets = f.resetsOn ?? "long"
        const should =
          type === "long"  ? resets === "long" || resets === "short" :
          type === "short" ? resets === "short" :
          resets === "dawn"
        return should ? { ...f, usesUsed: 0 } : f
      })
      if (updated.some((f, i) => f !== features[i])) patch[key] = updated
    }

    // Spell slots recover on the same short/long cadence as trackable features
    if (type === "long" || type === "short") {
      const updatedSlots = spellSlots.map(s => {
        const should = type === "long" ? true : s.resetsOn === "short"
        return should ? { ...s, used: 0 } : s
      })
      if (updatedSlots.some((s, i) => s !== spellSlots[i])) patch.spellSlots = updatedSlots
    }

    // Long rest restores HP to full
    if (type === "long") patch.hp = effectiveMax

    if (Object.keys(patch).length) update(patch)
  }

  function patchFeature(id: string, patch: Partial<Feature>) {
    const KEYS = ["racialTraits", "feats", "classFeatures", "items", "invocations", "infusions"] as const
    const combinedPatch: Partial<CharacterData> = {}
    let linkedIds: string[] = []
    let patchedFeature: Feature | undefined

    for (const key of KEYS) {
      const list = data[key]
      const target = list?.find(f => f.id === id)
      if (!target) continue
      patchedFeature = { ...target, ...patch }
      combinedPatch[key] = list!.map(f => f.id === id ? patchedFeature! : f)
      linkedIds = target.linkedTo ?? []

      // Spending a use (usesUsed going up, not a rest-reset or a manual
      // refund) fires this feature's linked Form/Conditional, if any.
      if (patch.usesUsed != null && patch.usesUsed > (target.usesUsed ?? 0)) {
        Object.assign(combinedPatch, featureUsePatch({ ...data, ...combinedPatch }, patchedFeature, multiFormEnabled))
      }
      break
    }

    // Propagate usesUsed changes to all linked features
    if ("usesUsed" in patch && linkedIds.length > 0) {
      for (const key of KEYS) {
        const list = (combinedPatch[key] as Feature[] | undefined) ?? data[key]
        if (!list?.some(f => linkedIds.includes(f.id))) continue
        combinedPatch[key] = list.map(f => linkedIds.includes(f.id) ? { ...f, usesUsed: patch.usesUsed } : f)
      }
    }

    // Backlink: mirror shared fields onto the linked Martial entry, if any
    if (patchedFeature) {
      const linkedEquip = equipItems.find(i => i.sourceFeatureId === id)
      if (linkedEquip) {
        combinedPatch.equipmentItems = equipItems.map(i =>
          i.id === linkedEquip.id ? { ...i, ...equipmentFieldsFromFeature(patchedFeature!) } : i
        )
      }
    }

    if (Object.keys(combinedPatch).length > 0) update(combinedPatch)
  }

  function removeFeatureGlobal(id: string) {
    const KEYS = ["racialTraits", "feats", "classFeatures", "items", "invocations", "infusions"] as const
    const patch: Partial<CharacterData> = {}

    // Cascade: removing a container also removes everything nested inside it (recursively)
    const idsToRemove = new Set<string>([id])
    let grew = true
    while (grew) {
      grew = false
      for (const key of KEYS) {
        for (const f of data[key] ?? []) {
          if (f.parentId && idsToRemove.has(f.parentId) && !idsToRemove.has(f.id)) {
            idsToRemove.add(f.id)
            grew = true
          }
        }
      }
    }

    for (const key of KEYS) {
      const list = data[key]
      if (list?.some(f => idsToRemove.has(f.id))) patch[key] = list.filter(f => !idsToRemove.has(f.id))
    }
    if (data.favorites?.some(f => idsToRemove.has(f.refId))) {
      patch.favorites = (data.favorites ?? []).filter(f => !idsToRemove.has(f.refId))
    }
    // Drop any Martial entry linked to a removed feature — otherwise it'd be
    // left pointing at a sourceFeatureId that no longer exists.
    if (equipItems.some(i => i.sourceFeatureId && idsToRemove.has(i.sourceFeatureId))) {
      patch.equipmentItems = equipItems.filter(i => !(i.sourceFeatureId && idsToRemove.has(i.sourceFeatureId)))
    }
    // Remove these ids from any other feature's linkedTo
    for (const key of KEYS) {
      const list = (patch[key] as Feature[] | undefined) ?? data[key]
      if (list?.some(f => f.linkedTo?.some(lid => idsToRemove.has(lid)))) {
        patch[key] = list.map(f => f.linkedTo?.some(lid => idsToRemove.has(lid)) ? { ...f, linkedTo: f.linkedTo.filter(lid => !idsToRemove.has(lid)) } : f)
      }
    }
    update(patch)
  }

  // ── CONDITION HELPERS ─────────────────────────────────────────────────────

  function addCondition(name: string) {
    if (conditions.find(c => c.name === name)) return
    update({ conditions: [...conditions, { id: nanoid(), name }] })
    setShowConditionPicker(false)
  }
  function removeCondition(id: string)        { update({ conditions: conditions.filter(c => c.id !== id) }) }
  function updateConditionLevel(id: string, level: number) {
    update({ conditions: conditions.map(c => c.id === id ? { ...c, level } : c) })
  }

  // ── FORMS HELPERS (Automation) ────────────────────────────────────────────
  // formActivationPatch itself lives in shared/utils.ts now — AutomationModal.tsx's
  // own "Trigger"/"Cast" buttons call it the same way, off the same `data`/`onUpdate`
  // shape, so a Form behaves identically whichever surface activates it.
  function activateForm(id: string | null) { update(formActivationPatch(data, id)) }
  // Multi-form mode only (see multiFormEnabled) — toggles one form on/off
  // independently of whatever else is currently stacked.
  function toggleForm(id: string) { update(toggleFormPatch(data, id)) }

  // ── HIT DICE HELPERS ──────────────────────────────────────────────────────

  const hitDicePools = data.hitDicePools ?? []

  function updatePool(id: string, patch: Partial<HitDicePool>) {
    update({ hitDicePools: hitDicePools.map(p => p.id === id ? { ...p, ...patch } : p) })
  }
  function removePool(id: string) { update({ hitDicePools: hitDicePools.filter(p => p.id !== id) }) }
  function addPool(pool: Omit<HitDicePool, "id">) {
    update({ hitDicePools: [...hitDicePools, { ...pool, id: nanoid() }] })
  }

  // ── QUICK SEARCH ──────────────────────────────────────────────────────────

  const q = quickSearch.toLowerCase().trim()
  const searchResults: { id: string; label: string; category: string; refType: FavoriteRef["refType"] }[] = q ? [
    ...spellItems.filter(s => s.name.toLowerCase().includes(q)).map(s => ({ id: s.id, label: s.name, category: "Spell",   refType: "spell"     as const })),
    ...equipItems.filter(i => i.name.toLowerCase().includes(q)).map(i => ({ id: i.id, label: i.name, category: "Item",    refType: "equipment" as const })),
    ...(data.racialTraits  ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Trait",   refType: "feature" as const })),
    ...(data.feats         ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Feat",    refType: "feature" as const })),
    ...(data.classFeatures ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Feature", refType: "feature" as const })),
    ...(data.items         ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Gear",    refType: "feature" as const })),
    ...(data.invocations   ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Invocation", refType: "feature" as const })),
    ...(data.infusions     ?? []).filter(f => f.name.toLowerCase().includes(q)).map(f => ({ id: f.id, label: f.name, category: "Infusion",   refType: "feature" as const })),
    ...familiars
      .map(f => ({ id: f.id, label: f.nickname || monsters.find(m => m.id === f.monsterId)?.name || "Familiar", category: "Familiar", refType: "familiar" as const }))
      .filter(f => f.label.toLowerCase().includes(q)),
  ] : []

  // ── COMPUTED THEME / CARD ─────────────────────────────────────────────────

  const baseTheme  = THEMES[data.theme ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const isCustomTheme = data.theme === CUSTOM_THEME_KEY
  const customBoxHex  = data.themeCustomColor ?? DEFAULT_ACCENT_COLOR
  // Custom overrides boxHex/accent with the real picked color (consumers like
  // FeatureEntry's nebula gradient parse this as a literal hex); box/body
  // stay the CSS-var-backed classes from THEMES, resolved via the root
  // element's inline style below.
  const theme      = isCustomTheme ? { ...baseTheme, boxHex: customBoxHex, accent: customBoxHex } : baseTheme
  const bgKey       = data.themeBg ?? DEFAULT_BG_THEME
  const isCustomBg  = bgKey === CUSTOM_THEME_KEY
  const effectiveBody = BG_OPTIONS[bgKey]?.body || theme.body
  const card       = `rounded-xl ${theme.box} ring-1 ${theme.ring}`
  const activeSlotKey = data.slotTheme ?? DEFAULT_SLOT_THEME
  const slotTheme: SlotTheme = activeSlotKey === CUSTOM_SLOT_THEME_KEY
    ? { label: "Custom", accent: data.slotCustomColor ?? DEFAULT_ACCENT_COLOR }
    : (SLOT_THEMES[activeSlotKey] ?? SLOT_THEMES[DEFAULT_SLOT_THEME])
  const slotAnimated = data.slotAnimated ?? false

  // ── PROFICIENCY BONUS ─────────────────────────────────────────────────────

  const pb = profBonus(data.level ?? 1)

  // ── SAVING THROW MODIFIER ─────────────────────────────────────────────────

  function getSaveMod(save: typeof SAVE_KEYS[number]): number {
    const score      = (effectiveData[SAVE_TO_ABILITY[save] as keyof CharacterData] as number | undefined) ?? 10
    const base       = Math.floor((score - 10) / 2)
    const proficient = data.savingThrowProfs?.[save] ?? false
    const bonus      = data.saveBonuses?.[save] ?? 0
    return base + (proficient ? pb : 0) + bonus
  }

  function getSkillMod(skillName: string, abilityKey: string): number {
    const score = (effectiveData[SAVE_TO_ABILITY[abilityKey] as keyof CharacterData] as number | undefined) ?? 10
    const base  = Math.floor((score - 10) / 2)
    const prof  = data.skillProfs?.[skillName]
    const bonus = data.skillBonuses?.[skillName] ?? 0
    const profMod = prof === "exp" ? pb * 2 : prof === "prof" ? pb : prof === "half" ? Math.floor(pb / 2) : 0
    return base + profMod + bonus
  }

  // ── FAVORITES PROPS ───────────────────────────────────────────────────────

  const statMods = {
    str: Math.floor(((effectiveData.strength     ?? 10) - 10) / 2),
    dex: Math.floor(((effectiveData.dexterity    ?? 10) - 10) / 2),
    con: Math.floor(((effectiveData.constitution ?? 10) - 10) / 2),
    int: Math.floor(((effectiveData.intelligence ?? 10) - 10) / 2),
    wis: Math.floor(((effectiveData.wisdom       ?? 10) - 10) / 2),
    cha: Math.floor(((effectiveData.charisma     ?? 10) - 10) / 2),
  }

  const availableClasses = data.multiclass && data.classes?.length
    ? data.classes.map(c => c.cls).filter(Boolean)
    : (data.class ? [data.class] : [])

  const isWarlock   = availableClasses.some(c => c.toLowerCase() === "warlock")
  const isArtificer = availableClasses.some(c => c.toLowerCase() === "artificer")

  const favPanelProps = {
    favorites, spellItems, equipItems, features: allFeatures, familiars, monsters,
    poppedOutIds: new Set(Object.keys(openPopouts)),
    pb, statMods, classes: availableClasses,
    onRemove: removeFavorite,
    onReorder: reorderFavorites,
    onChangeSpell: changeSpell,
    onRemoveSpell: removeSpell,
    onChangeEquip: changeEquip,
    onRemoveEquip: removeEquip,
    onUpdateFeature: patchFeature,
    onRemoveFeature: removeFeatureGlobal,
    onLinkToggle: toggleFeatureLink,
    onPopOutFamiliar: togglePopout,
    theme, card, readOnly,
    showMagicStar: data.showMagicItemStar, magicItemStyle: data.magicItemStyle, magicItemColor: data.magicItemColor,
    magicItemSliderStyle: data.magicItemSliderStyle,
    featureCategoryById,
    favoriteCategoryColors: data.favoriteCategoryColors,
    favoriteCategoryStyle: data.favoriteCategoryStyle,
    favoriteCategorySliderStyle: data.favoriteCategorySliderStyle,
    classFeatureColorsByClass: data.classFeatureColorsByClass,
    classFeatureColors: data.classFeatureColors,
    dragOver: favDragOver,
    onDragOver:  (e: React.DragEvent) => { e.preventDefault(); setFavDragOver(true) },
    onDragLeave: () => setFavDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); setFavDragOver(false)
      try { addFavorite(JSON.parse(e.dataTransfer.getData("x-fable-ref")) as FavoriteRef) } catch {}
    },
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: HP PANEL
  // ══════════════════════════════════════════════════════════════════════════

  function renderHpPanel() {
    const isAtZero   = hp <= 0
    const deathSaves = data.deathSaves ?? { successes: 0, failures: 0 }

    // Initiative derived values
    const initStat  = data.initiativeStat ?? "dex"
    const initKey   = SAVE_TO_ABILITY[initStat] ?? "dexterity"
    const initScore = (data[initKey as keyof CharacterData] as number | undefined) ?? 10
    const initMod   = Math.floor((initScore - 10) / 2) + (data.initiativeBonus ?? 0)
    const initStr   = initMod >= 0 ? `+${initMod}` : `${initMod}`

    return (
      <div className="flex flex-col gap-3">

        {/* HP + AC ring card */}
        <div className={`${card} p-4 flex flex-col items-center gap-3`}>

          {!readOnly && (
            <button type="button" onClick={() => setShowMaxMenu(true)}
              className="self-end size-7 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-xs text-white transition-colors -mb-2"
              title="Edit Max HP / AC / Temp HP">✎</button>
          )}

          {/* SVG ring */}
          <div className="relative size-32">
            <svg viewBox="0 0 96 96" className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="48" cy="48" r={TEMP_R} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth="4" />
              {tempHp > 0 && (
                <circle cx="48" cy="48" r={TEMP_R} fill="none" stroke="#60a5fa" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={tempC} strokeDashoffset={tempC * (1 - tempHpPct / 100)}
                  style={{ transition: "stroke-dashoffset 0.4s ease" }} />
              )}
              <circle cx="48" cy="48" r={RING_R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
              <circle cx="48" cy="48" r={RING_R} fill="none" stroke={hpColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={ringC} strokeDashoffset={ringC * (1 - hpPercent / 100)}
                style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }} />
            </svg>
            <button type="button" onClick={() => setShowAcModal(true)}
              className="absolute inset-0 flex items-center justify-center hover:brightness-125 transition-all"
              title="Edit Armor Class">
              <Shield className="size-11 text-white/60" />
              <span className={`absolute text-base font-bold leading-none ${(ov?.acBonus || ov?.acOverride != null) ? "text-blue-400" : "text-white"}`}>{acResult.total}</span>
            </button>
            {acResult.equipBonus > 0 && !data.hideEquipAcBadge && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold shrink-0 whitespace-nowrap"
                title="AC bonus from equipped armor/shield">
                +{acResult.equipBonus} equip
              </span>
            )}
          </div>

          {/* HP value */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-white leading-none">{hp}</span>
            {tempHp > 0 && <span className="text-base font-bold text-blue-400 leading-none">+{tempHp}</span>}
            <span className={`text-sm ${ov?.maxHpBonus ? "text-blue-400" : "text-white/40"}`}>/ {effectiveMax}{maxHpMod !== 0 && <span className={`ml-1 text-xs ${maxHpMod > 0 ? "text-emerald-400" : "text-red-400"}`}>({maxHpMod > 0 ? "+" : ""}{maxHpMod})</span>}</span>
          </div>

          {/* Normal HP controls — only when hp > 0 */}
          {!isAtZero && !readOnly && (
            <div className="flex flex-col items-center gap-2 w-full">
              {/* The form's own pool has no Temp HP tracking of its own — just a plain HP bar */}
              {!usingFormPool && (
                <div className={`flex rounded-full text-xs font-semibold uppercase tracking-wide overflow-hidden ring-1 ${theme.ring}`}>
                  <button type="button" onClick={() => setHpTarget("hp")}
                    className={`px-3 py-1.5 transition-colors ${hpTarget === "hp" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>HP</button>
                  <button type="button" onClick={() => setHpTarget("temp")}
                    className={`px-3 py-1.5 transition-colors ${hpTarget === "temp" ? "bg-blue-500/40 text-blue-200" : "text-white/40 hover:text-white/70"}`}>Temp</button>
                </div>
              )}
              <div className="flex items-center gap-2">
                {/* Minus: damage always drains temp first when in HP mode */}
                <button type="button"
                  onClick={() => {
                    if (usingFormPool) {
                      update({ formHp: Math.max(0, hp - hpStep) })
                    } else if (hpTarget === "hp") {
                      const tempDrained = Math.min(tempHp, hpStep)
                      const remainder   = hpStep - tempDrained
                      update({ tempHp: tempHp - tempDrained, hp: Math.max(0, hp - remainder) })
                    } else {
                      update({ tempHp: Math.max(0, tempHp - hpStep) })
                    }
                    setHpStep(1)
                  }}
                  className="size-9 rounded-full bg-white/10 hover:bg-red-900 text-white hover:text-red-200 flex items-center justify-center text-xl font-bold transition-colors">−</button>
                <NumInput value={hpStep}
                  onFocus={e => e.target.select()}
                  onChange={e => setHpStep(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                  className={`w-12 text-center text-sm font-bold ${theme.box} border border-white/15 rounded-lg py-1.5 text-white outline-none`} />
                <button type="button"
                  onClick={() => {
                    if (usingFormPool) {
                      update({ formHp: Math.min(effectiveMax, hp + hpStep) })
                    } else if (hpTarget === "hp") {
                      update({ hp: effectiveMax > 0 ? Math.min(effectiveMax, hp + hpStep) : hp + hpStep })
                    } else {
                      update({ tempHp: tempHp + hpStep })
                    }
                    setHpStep(1)
                  }}
                  className="size-9 rounded-full bg-white/10 hover:bg-green-900 text-white hover:text-green-200 flex items-center justify-center text-xl font-bold transition-colors">+</button>
              </div>
            </div>
          )}
        </div>

        {/* Death Saving Throws — shown when hp <= 0 */}
        {isAtZero && (
          <DeathSavingThrows
            characterName={character.name}
            saves={deathSaves}
            readOnly={readOnly}
            onUpdate={ds => update({ deathSaves: ds })}
            onStabilize={() => update({ hp: 1, deathSaves: undefined })}
            onHeal={amount => {
              const newHp = effectiveMax > 0 ? Math.min(effectiveMax, amount) : amount
              update({ hp: newHp, deathSaves: undefined })
            }}
            card={card}
          />
        )}

        {/* Speed / Initiative */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setShowSpeedModal(true)}
            className={`${card} p-3 flex flex-col items-center gap-1 hover:brightness-110 transition-all`}>
            <SpeedDisplay
              speeds={{ walk: effectiveSpeed, fly: data.speeds?.fly, swim: data.speeds?.swim, climb: data.speeds?.climb }}
              zeroed={!!speedOverrideReason}
              overridden={!speedOverrideReason && ov?.speedOverride != null}
            />
            <span className="text-xs uppercase tracking-widest text-white/50">Speed{speedOverrideReason ? ` (${speedOverrideReason})` : ""}</span>
          </button>
          <button type="button" onClick={() => setShowInitiativeModal(true)}
            className={`${card} p-3 flex flex-col items-center gap-0.5 border-2 hover:brightness-110 transition-all`}
            style={{ borderColor: theme.accent + "90" }}>
            <span className="text-xl font-bold text-white">{initStr}</span>
            <span className="text-xs uppercase tracking-widest text-white/60 font-semibold">Initiative</span>
            <span className="text-[9px] uppercase tracking-wider font-bold" style={{ color: theme.accent }}>
              {initStat.toUpperCase()}{data.initiativeBonus ? ` +${data.initiativeBonus}` : ""}
            </span>
          </button>
        </div>

        {/* Hit Dice */}
        <HitDice
          card={card}
          pools={hitDicePools}
          readOnly={readOnly}
          onUpdate={updatePool}
          onRemove={removePool}
          onAdd={addPool}
        />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: QUICK SEARCH (inline — tightly coupled to tab bar)
  // ══════════════════════════════════════════════════════════════════════════

  const INFO_SUBTAB_BY_CATEGORY: Record<string, InfoSubTab> = {
    Trait: "raceFeats", Feat: "raceFeats", Feature: "features",
  }

  function navigateToResult(r: (typeof searchResults)[number]) {
    if (r.refType === "spell") {
      setSpellsSubTab("spells"); setActiveTab("main")
    } else if (r.refType === "equipment") {
      setSpellsSubTab("martial"); setActiveTab("main")
    } else if (r.refType === "familiar") {
      setInfoSubTab("familiars"); setActiveTab("details")
      if (!openPopouts[r.id]) togglePopout(r.id)
    } else if (r.category === "Gear") {
      setActiveTab("items")
    } else {
      setInfoSubTab(INFO_SUBTAB_BY_CATEGORY[r.category] ?? "overview")
      setActiveTab("details")
    }
    setQuickSearch("")
  }

  function renderQuickSearch() {
    return (
      <div className="relative w-full sm:w-64">
        <div className={`${card} px-3 py-2 flex items-center gap-2`}>
          <span className="text-white/40 text-sm">⌕</span>
          <input
            value={quickSearch}
            onChange={e => setQuickSearch(e.target.value)}
            placeholder="Quick search (WIP)"
            className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/30"
          />
          {quickSearch && (
            <button type="button" onClick={() => setQuickSearch("")} className="absolute right-3 text-white/40 hover:text-white text-sm">✕</button>
          )}
        </div>
        {searchResults.length > 0 && (
          <div className={`absolute top-full left-0 right-0 z-40 mt-1 ${theme.box} border border-white/15 rounded-xl shadow-xl overflow-hidden max-h-[50vh] sm:max-h-56 overflow-y-auto`}>
            {searchResults.map(r => (
              <div key={r.id}
                onClick={() => navigateToResult(r)}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-black/30 border-b border-white/5 last:border-0 cursor-pointer">
                <span className="text-xs text-white/40 uppercase tracking-wider w-16 shrink-0 truncate">{r.category}</span>
                <span className="text-sm text-white flex-1 min-w-0 truncate">{r.label}</span>
                <FavoriteStar
                  isFavorite={favorites.some(f => f.refId === r.id)}
                  onToggle={() => favorites.some(f => f.refId === r.id) ? removeFavorite(r.id) : addFavorite({ refId: r.id, refType: r.refType, label: r.label })}
                  label="Favorite"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: COMBAT TAB
  // ══════════════════════════════════════════════════════════════════════════

  function renderCombatTab() {
    return (
      // No flex-1/min-h-0 here — this tab's own ancestor (the Body wrapper,
      // just below) is the actual scroll container (overflow-auto), so this
      // content should just render at its natural height and let that
      // ancestor scroll if it's tall. flex-1/min-h-0 on a row that has a
      // sibling (SpellsEquipPanel) NOT similarly shrinkable made flexbox's
      // shrink algorithm crush this row toward 0 height whenever the
      // sibling's natural content got tall (e.g. lots of cantrips) — its
      // own content (the AC ring, etc.) then visually spilled outside that
      // collapsed box instead of actually being missing.
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row gap-4">

          {/* Col 1: HP / speed / hit dice / conditions / dice */}
          <div className="lg:w-52 shrink-0 flex flex-col gap-3">
            {renderHpPanel()}
            <ConditionsCard
              card={card}
              conditions={conditions}
              readOnly={readOnly}
              onShowPicker={() => setShowConditionPicker(true)}
              onRemove={removeCondition}
              onUpdateLevel={updateConditionLevel}
            />
            {!data.hideDiceRoller && <DiceRoller card={card} />}
            {data.showResistanceTracker && (
              <ResistanceTracker card={card} readOnly={readOnly}
                resistances={data.resistances ?? []} vulnerabilities={data.vulnerabilities ?? []}
                onUpdate={update} />
            )}
            <CurrencyTracker card={card} data={data} readOnly={readOnly} update={update} />
          </div>

          {/* Col 2: Abilities → Saves → Skills */}
          <div className="lg:w-56 shrink-0 flex flex-col gap-3">
            <AbilitiesCard card={card} data={effectiveData} readOnly={readOnly} onShowModal={() => setShowAbilityModal(true)} overriddenKeys={overriddenAbilityKeys} />
            <SavesCard card={card} data={data} readOnly={readOnly} getSaveMod={getSaveMod} onShowModal={() => setShowSavesModal(true)} />
            <SkillsCard card={card} data={data} characterId={character.id} readOnly={readOnly} getSkillMod={getSkillMod} onShowSkillModal={setShowSkillModal} onUpdate={update} />
            {!data.hideJumpCalculator && (
              <div className={`${card} p-3 flex items-center justify-around gap-2`} title="Running jump distances — PHB: Long Jump = STR score (ft), High Jump = 3 + STR mod (ft)">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">High Jump</span>
                  <span className="text-lg font-mono font-semibold text-white">{Math.max(0, 3 + statMods.str)} ft</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Long Jump</span>
                  <span className="text-lg font-mono font-semibold text-white">{Math.max(0, data.strength ?? 10)} ft</span>
                </div>
              </div>
            )}
          </div>

          {/* Col 3: Favorites */}
          <div className="flex-1 flex flex-col gap-3">
            <FavoritesPanel {...favPanelProps} />
          </div>
        </div>

        {/* Full-width spells / martial panel */}
        <SpellsEquipPanel
          card={card} theme={theme} data={effectiveData} readOnly={readOnly} userId={user?.id ?? null}
          spellItems={spellItems} equipItems={equipItems} spellSlots={spellSlots}
          slotTheme={slotTheme} slotAnimated={slotAnimated} characterId={character.id}
          activeSubTab={spellsSubTab} onChangeSubTab={setSpellsSubTab}
          onShowSpellcastingModal={() => setShowSpellcastingModal(true)}
          onChangeSlot={changeSlot}
          onAddSpell={addSpell} onChangeSpell={changeSpell} onRemoveSpell={removeSpell}
          pendingSpellId={pendingSpellId} onAutoEditConsumed={() => setPendingSpellId(null)}
          onAddEquip={addEquip} onChangeEquip={changeEquip} onRemoveEquip={removeEquip}
          onCastSpell={spell => update(castSpellPatch(data, spell, multiFormEnabled))}
          favorites={favorites} onToggleEquipFavorite={toggleEquipmentFavorite}
          onUpdate={update}
        />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  // Settings' "Modules and Font Size" — CSS zoom (not transform: scale)
  // deliberately, since it shrinks fonts/padding/everything in lockstep like
  // browser zoom while leaving position:fixed modals sized to the real
  // viewport instead of the scaled container.
  const uiScale = data.uiScale ?? 100

  // Custom Card Style / Background colors are picked as plain hex, but `theme.box`
  // and BG_OPTIONS.custom.body reference these as CSS custom properties (Tailwind
  // arbitrary-value classes) so the single computed color can flow down to every
  // card/panel that shares the `card`/`effectiveBody` class strings without
  // threading an inline style through each one individually.
  const rootStyle: React.CSSProperties = {
    ...(uiScale !== 100 ? { zoom: uiScale / 100 } : {}),
    ...(isCustomTheme ? {
      "--theme-custom-box": customBoxHex,
      "--theme-custom-body": darkenHex(customBoxHex, 0.35),
    } as React.CSSProperties : {}),
    ...(isCustomBg ? {
      "--bg-custom-color": data.themeBgCustomColor ?? DEFAULT_ACCENT_COLOR,
    } as React.CSSProperties : {}),
  }

  return (
    <div className={`flex flex-col h-full min-h-0 text-white overflow-auto ${effectiveBody}`}
      style={rootStyle}>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showMaxMenu && (
        <MaxStatsModal
          data={data} effectiveMax={effectiveMax} extraMaxHpBonus={ov?.maxHpBonus ?? 0}
          onUpdate={update} onClose={() => setShowMaxMenu(false)}
        />
      )}
      {showSavesModal && (
        <SavesModal
          data={data} readOnly={readOnly}
          getSaveMod={getSaveMod} onUpdate={update} onClose={() => setShowSavesModal(false)}
        />
      )}
      {showAbilityModal && (
        <AbilityModal
          data={data} readOnly={readOnly}
          onUpdate={update} onClose={() => setShowAbilityModal(false)}
        />
      )}
      {showSpellcastingModal && (
        <SpellcastingModal
          data={data} spellSlots={spellSlots} readOnly={readOnly} slotTheme={slotTheme} slotAnimated={slotAnimated}
          onUpdate={update} onChangeSlot={changeSlot}
          onAddSlot={addSlot} onRemoveSlot={removeSlot}
          onClose={() => setShowSpellcastingModal(false)}
        />
      )}
      {showSkillModal && (
        <SkillModal
          skillName={showSkillModal} data={data} readOnly={readOnly}
          getSkillMod={getSkillMod} onUpdate={update} onClose={() => setShowSkillModal(null)}
        />
      )}
      {showInitiativeModal && (
        <InitiativeModal
          data={data} readOnly={readOnly}
          onUpdate={update} onClose={() => setShowInitiativeModal(false)}
          accentColor={theme.accent}
        />
      )}
      {showAcModal && (
        <ArmorClassModal
          data={data} readOnly={readOnly}
          onUpdate={update} onClose={() => setShowAcModal(false)}
          accentColor={theme.accent}
        />
      )}
      {showSpeedModal && (
        <SpeedModal
          data={data} readOnly={readOnly} overrideReason={speedOverrideReason}
          onUpdate={update} onClose={() => setShowSpeedModal(false)}
        />
      )}
      {showCarryModal && (
        <CarryCapacityModal
          data={data} readOnly={readOnly}
          onUpdate={update} onClose={() => setShowCarryModal(false)}
          accentColor={theme.accent}
        />
      )}
      {showConditionPicker && (
        <ConditionPickerModal
          conditions={conditions} onAdd={addCondition} onClose={() => setShowConditionPicker(false)}
        />
      )}
      {showSettingsModal && (
        <SettingsModal data={data} onUpdate={update} onClose={() => setShowSettingsModal(false)}
          isWarlock={isWarlock} isArtificer={isArtificer} characterId={character.id} />
      )} 


      {showAutomationModal && (
        <AutomationModal data={data} onUpdate={update} onClose={() => setShowAutomationModal(false)} userId={user?.id ?? null}
          allFeatures={allFeatures} onChangeFeature={patchFeature} multiFormEnabled={multiFormEnabled} />
      )}
      {showRestModal && (
        <Modal onClose={() => setShowRestModal(false)}>
          <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-[min(320px,calc(100vw-2rem))] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="text-sm font-bold text-white">Take a Rest</h3>
              <button onClick={() => setShowRestModal(false)}
                className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 hover:text-white">
                ✕
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {([
                { type: "short" as const, label: "Short Rest",  desc: "Restores features that refresh on a short rest.", color: "sky"    },
                { type: "long"  as const, label: "Long Rest",   desc: "Restores short- and long-rest features. Does not affect dawn features.", color: "indigo" },
                { type: "dawn"  as const, label: "Dawn",        desc: "Restores features that refresh at dawn only.", color: "amber"  },
              ]).map(({ type, label, desc, color }) => (
                <button key={type}
                  onClick={() => { handleRest(type); setShowRestModal(false) }}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors
                    ${color === "sky"    ? "bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20 text-sky-300"    : ""}
                    ${color === "indigo" ? "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300" : ""}
                    ${color === "amber"  ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20 text-amber-300"  : ""}
                  `}>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs opacity-60 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
      {showPortraitPicker && (
        <PortraitModal
          currentPortrait={data.portrait}
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          onChoose={url => { update({ portrait: url }); setShowPortraitPicker(false) }}
          onUploadClick={() => portraitRef.current?.click()}
          onClose={() => setShowPortraitPicker(false)}
        />
      )}

      <input ref={portraitRef} type="file" accept="image/*" className="hidden" onChange={uploadPortrait} />

      {showClassPicker && (
        <ClassPickerModal
          initial={data.classes ?? (data.class ? [{ cls: data.class, level: data.level ?? 1 }] : [])}
          userId={user?.id ?? null}
          existingFeatures={data.classFeatures ?? []}
          existingSpells={data.spellItems ?? []}
          onConfirm={classes => {
            const total = classes.reduce((s, c) => s + c.level, 0)
            update({
              classes,
              level: total,
              multiclass: classes.length > 1,
              class: classes.map(c => c.cls).join(" / "),
            })
          }}
          onImport={({ classFeatures: cf, spellItems: si }) => {
            if (cf?.length) update({ classFeatures: [...(data.classFeatures ?? []), ...cf] })
            if (si?.length) update({ spellItems: [...(data.spellItems ?? []), ...si] })
          }}
          onClose={() => setShowClassPicker(false)}
        />
      )}
      {showRacePicker && (
        <RacePickerModal
          current={data.race ?? ""}
          currentSubrace={data.subrace}
          userId={user?.id ?? null}
          existingFeatures={data.racialTraits ?? []}
          onConfirm={(race, subrace) => update({ race, subrace: subrace ?? undefined })}
          onImport={({ racialTraits: rt }) => {
            if (rt?.length) update({ racialTraits: [...(data.racialTraits ?? []), ...rt] })
          }}
          onClose={() => setShowRacePicker(false)}
        />
      )}

      <div className="shrink-0">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      {/* Two rows on narrow screens (portrait+info, then the Rest/Settings/
          Automation cluster below it) instead of cramming everything into
          one unbreakable row — collapses back to a single row at sm:. */}
      <div className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-3 py-2 border-b border-white/10 shrink-0 ${effectiveBody}`}>

        <div className="flex items-center gap-3 min-w-0">
        <button type="button"
          onClick={readOnly ? undefined : openPortraitPicker}
          title={portraitForm?.portraitUrl ? `${portraitForm.name} — click to change your base portrait (set from Automation)` : undefined}
          className={`relative size-11 rounded-xl overflow-hidden ring-2 ${theme.ring} ${readOnly ? "" : "hover:ring-primary cursor-pointer"} shrink-0 ${theme.box} flex items-center justify-center transition-all`}>
          {uploading ? <span className="text-xs text-white/70">…</span>
            : (portraitForm?.portraitUrl || data.portrait) ? <img src={portraitForm?.portraitUrl || data.portrait} alt="portrait" className="w-full h-full object-cover" />
            : <span className="text-2xl leading-none select-none">IMAGE</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold tracking-wide truncate">{character.name}</p>
            {stealthDisadvantageArmor && (
              <span className="text-xs px-2 py-0.5 rounded-full shrink-0 bg-amber-500/15 text-amber-200/90 border border-amber-500/30 border-dashed" title="Equipped armor imposes disadvantage on Stealth checks">
                Stealth Disadvantage
              </span>
            )}
            {totalWeight > 0 && (
              <button type="button" onClick={() => setShowCarryModal(true)}
                className={`text-xs px-2 py-0.5 rounded-full shrink-0 transition-colors ${encumbered ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70"}`}
                title="Carrying capacity: STR score × 15 lb, plus any flat bonus — click to set a bonus">
                ⚖ {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(1)} / {carryCapacity} lb
              </button>
            )}
           
            {readOnly && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 uppercase tracking-widest shrink-0">
                View Only
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <button
              type="button"
              onClick={() => { if (!readOnly) setShowRacePicker(true) }}
              className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                readOnly ? "cursor-default" : "cursor-pointer hover:border-white/20 hover:bg-white/15"
              } ${data.race
                ? "bg-white/10 border-white/10 text-white/70"
                : "bg-white/5 border-white/5 text-white/25"}`}
            >
              {data.subrace
                ? `${data.subrace}`
                : data.race || "Race"}
            </button>
            <button
              type="button"
              onClick={() => { if (!readOnly) setShowClassPicker(true) }}
              className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors truncate max-w-35 ${
                readOnly ? "cursor-default" : "cursor-pointer hover:border-white/20 hover:bg-white/15"
              } ${(data.classes && data.classes.length > 0) || data.class
                ? "bg-white/10 border-white/10 text-white/70"
                : "bg-white/5 border-white/5 text-white/25"}`}
            >
              {data.classes && data.classes.length > 0
                ? data.classes.map(c => c.cls).join(" / ")
                : data.class || "Class"}
            </button>
            <span className="text-white/25 text-xs">Lv</span>
            <span className="text-white/70 font-semibold text-xs">
              {data.classes && data.classes.length > 0
                ? data.classes.reduce((s, c) => s + c.level, 0)
                : (data.level ?? "—")}
            </span>
            <FormSwitcher forms={forms} activeFormId={data.activeFormId ?? null} onActivate={activateForm} readOnly={readOnly}
              multiForm={multiFormEnabled} activeFormIds={data.activeFormIds} onToggle={toggleForm} />
          </div>

          {(concentrationPrompts.length > 0 || deathwardTriggers.length > 0 || conditions.some(c => conditionEffectText(c)) || activeForms.some(f => f.notification)) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {activeForms.filter(f => f.notification).map(f => (
                <span key={f.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200">
                  {f.name}: {f.notification}
                </span>
              ))}
              {deathwardTriggers.map(t => (
                <span key={t.id}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200">
                  Deathward saved you — HP set to 1, condition spent.
                  <button type="button"
                    onClick={() => setDeathwardTriggers(prev => prev.filter(x => x.id !== t.id))}
                    className="opacity-60 hover:opacity-100 shrink-0">✕</button>
                </span>
              ))}
              {concentrationPrompts.map(p => (
                <span key={p.id}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200">
                  You took {p.damage} damage roll {p.dc}+ to concentrate.
                  <button type="button"
                    onClick={() => setConcentrationPrompts(prev => prev.filter(x => x.id !== p.id))}
                    className="opacity-60 hover:opacity-100 shrink-0">✕</button>
                </span>
              ))}
              {conditions.map(c => {
                const effect = conditionEffectText(c)
                if (!effect) return null
                const label = c.name === "Exhaustion" ? `Exhaustion ${c.level ?? 1}` : c.name
                return (
                  <span key={c.id} title={effect}
                    className="text-xs px-2 py-1 rounded-full bg-red-500/15 border border-red-400/30 text-red-200">
                    {label}: {effect}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end sm:ml-auto sm:justify-start">
          {saving && <span className="text-xs text-white/40 shrink-0">saving…</span>}

          {!readOnly && (
            <div className="flex items-center gap-1 flex-wrap shrink-0">
              <button onClick={() => setShowRestModal(true)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
                Rest
              </button>
              <button onClick={() => setShowAutomationModal(true)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
                Automation
              </button>
              <button type="button"
                onClick={() => setShowSettingsModal(true)}
                className="text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
                Settings
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 flex-wrap px-3 py-1.5 border-b border-white/10 shrink-0 ${effectiveBody}`}>
        {(["main", "details", "items", ...(data.partyCode && !readOnly ? ["chat"] : [])] as Tab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`relative px-3 py-1 text-xs uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
            {tab === "main" ? "Main" : tab === "details" ? "Details" : tab === "items" ? "Armor & Items" : "Chat"}
            {tab === "chat" && partyChatUnread && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
            )}
          </button>
        ))}
        <div className="w-full sm:w-auto sm:ml-auto">{activeTab !== "chat" && renderQuickSearch()}</div>
      </div>

      </div>{/* ── end sticky wrapper ── */}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col ${activeTab === "chat" ? "flex-1 min-h-0 overflow-hidden" : "shrink-0 p-3"} ${effectiveBody}`}>
        {activeTab === "main"    && renderCombatTab()}
        {activeTab === "details" && (
          <InfoTab data={data} update={update} theme={theme} card={card} readOnly={readOnly}
            userId={user?.id ?? null}
            subTab={infoSubTab} onSubTabChange={setInfoSubTab}
            onChangeFeature={patchFeature} onRemoveFeature={removeFeatureGlobal} onLinkToggle={toggleFeatureLink}
            favorites={favorites} onToggleFavorite={toggleFeatureFavorite}
            isWarlock={isWarlock} isArtificer={isArtificer}
            familiars={familiars} monsters={monsters} poppedOutIds={new Set(Object.keys(openPopouts))}
            onAddFamiliar={addFamiliar} onUpdateFamiliar={updateFamiliar} onRemoveFamiliar={removeFamiliar}
            onToggleFamiliarFavorite={toggleFamiliarFavorite} onPopOutFamiliar={togglePopout} />
        )}
        {activeTab === "items" && (
          <ItemsTab
            data={data} update={update} theme={theme} card={card} readOnly={readOnly} pb={profBonus(data.level ?? 1)}
            userId={user?.id ?? null}
            onChangeFeature={patchFeature} onRemoveFeature={removeFeatureGlobal} onLinkToggle={toggleFeatureLink}
            favorites={favorites} onToggleFavorite={toggleFeatureFavorite} onAddItemToEquipment={addItemToEquipment}
            equipmentLinkedIds={equipmentLinkedIds}
          />
        )}
        {activeTab === "chat" && data.partyCode && !readOnly && (
          <PartyServer
            partyCode={data.partyCode}
            currentUserId={user?.id ?? ""}
            currentUserName={character.name || "Adventurer"}
            isDM={false}
          />
        )}
      </div>

      {/* ── Popped-out familiars — float above everything, ephemeral ────────── */}
      {Object.entries(openPopouts).map(([id, pos]) => {
        const fam     = familiars.find(f => f.id === id)
        const monster = fam ? monsters.find(m => m.id === fam.monsterId) : undefined
        if (!fam || !monster) return null
        return (
          <FloatingPanel key={id} title={fam.nickname || monster.name}
            x={pos.x} y={pos.y} width={pos.w} height={pos.h}
            onMove={(x, y) => movePopout(id, x, y)}
            onResize={(w, h, x) => resizePopout(id, w, h, x)}
            onClose={() => closePopout(id)}>
            <FamiliarMonsterView monster={monster} readOnly={readOnly} />
          </FloatingPanel>
        )
      })}

    </div>
  )
}
