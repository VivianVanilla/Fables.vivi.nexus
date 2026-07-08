// ════════════════════════════════════════════════════════════════════════════
// character.tsx — CharacterSheet root component
// ════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect } from "react"
import { Shield } from "lucide-react"

import type { SidebarObject } from "@/components/sidebar-utils"
import { useUserContext } from "../../src/contexts/UserContext"
import { supabase } from "../../src/supabase"

import type {
  CharacterData, HitDicePool, SpellItem, EquipmentItem,
  SpellSlot, FavoriteRef, Feature, FamiliarRef,
} from "./character-types"
import { SAVE_KEYS, SAVE_TO_ABILITY, SUPABASE_BUCKET, CONDITION_EFFECTS, SPEED_ZERO_CONDITIONS } from "./character-constants"
import { profBonus, nanoid, safeParseJson } from "./character-utils"
import { THEMES, DEFAULT_THEME, SLOT_THEMES, DEFAULT_SLOT_THEME, BG_OPTIONS } from "./character-themes"

// UI primitives
import { NumInput }              from "./character/ui/NumInput"

// Panels
import { DiceRoller }            from "./character/panels/DiceRoller"
import { CurrencyTracker }       from "./character/panels/CurrencyTracker"
import { HitDice }               from "./character/panels/HitDice"
import { DeathSavingThrows }     from "./character/panels/DeathSavingThrows"
import { ConditionsCard }        from "./character/panels/ConditionsCard"
import { AbilitiesCard }         from "./character/panels/AbilitiesCard"
import { SavesCard }             from "./character/panels/SavesCard"
import { SkillsCard }            from "./character/panels/SkillsCard"
import { SpellsEquipPanel }      from "./character/panels/SpellsEquipPanel"
import { FavoritesPanel }        from "./character/panels/FavoritesPanel"
import { FloatingPanel }         from "./character/ui/FloatingPanel"
import { FavoriteStar }          from "./character/ui/FavoriteStar"

// Modals
import { MaxStatsModal }         from "./character/modals/MaxStatsModal"
import { SavesModal }            from "./character/modals/SavesModal"
import { AbilityModal }          from "./character/modals/AbilityModal"
import { SpellcastingModal }     from "./character/modals/SpellcastingModal"
import { SkillModal }            from "./character/modals/SkillModal"
import { InitiativeModal }       from "./character/modals/InitiativeModal"
import { SpeedModal }            from "./character/modals/SpeedModal"
import { ConditionPickerModal }  from "./character/modals/ConditionPickerModal"
import { ThemeModal }            from "./character/modals/ThemeModal"
import { PortraitModal }         from "./character/modals/PortraitModal"

// Tabs / other
import { InfoTab, type InfoSubTab } from "./character/tabs/InfoTab"
import { FamiliarsTab }          from "./character/tabs/FamiliarsTab"
import { FamiliarMonsterView }   from "./monster"
import { PartyChat }             from "./PartyChat"
import { ClassPickerModal }      from "./character/modals/ClassPickerModal"
import { RacePickerModal }       from "./character/modals/RacePickerModal"
import { Modal }                 from "./character/ui/Modal"

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface Props {
  character: SidebarObject
  onClose: () => void
  readOnly?: boolean
}

type Tab = "main" | "details" | "familiars" | "chat"

// ════════════════════════════════════════════════════════════════════════════
// CharacterSheet
// ════════════════════════════════════════════════════════════════════════════

export function CharacterSheet({ character, readOnly = false }: Props) {
  const { user, updateObject, createObject, objects } = useUserContext()

  // ── STATE ─────────────────────────────────────────────────────────────────

  const [saving,               setSaving]               = useState(false)
  const [uploading,            setUploading]             = useState(false)
  const [activeTab,            setActiveTab]             = useState<Tab>("main")

  // Modal visibility
  const [showMaxMenu,           setShowMaxMenu]           = useState(false)
  const [showThemePicker,       setShowThemePicker]       = useState(false)
  const [showRestModal,         setShowRestModal]          = useState(false)
  const [showConditionPicker,   setShowConditionPicker]   = useState(false)
  const [showPortraitPicker,    setShowPortraitPicker]    = useState(false)
  const [showSavesModal,        setShowSavesModal]        = useState(false)
  const [showAbilityModal,      setShowAbilityModal]      = useState(false)
  const [showSpellcastingModal, setShowSpellcastingModal] = useState(false)
  const [showSkillModal,        setShowSkillModal]        = useState<string | null>(null)
  const [showInitiativeModal,   setShowInitiativeModal]   = useState(false)
  const [showSpeedModal,        setShowSpeedModal]        = useState(false)
  const [showClassPicker,       setShowClassPicker]       = useState(false)
  const [showRacePicker,        setShowRacePicker]        = useState(false)

  // Concentration check prompts (dismissible) — triggered by HP loss while "Concentrating" is active
  const [concentrationPrompts, setConcentrationPrompts] = useState<{ id: string; damage: number; dc: number }[]>([])
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
  const [openPopouts, setOpenPopouts] = useState<Record<string, { x: number; y: number }>>({})

  // Quick search
  const [quickSearch, setQuickSearch] = useState("")

  // Sub-tab state lifted out of child panels so quick-search "navigate to" can drive them
  const [spellsSubTab, setSpellsSubTab] = useState<"spells" | "martial">("spells")
  const [infoSubTab,   setInfoSubTab]   = useState<InfoSubTab>("overview")

  // Newly-added spell — opens its edit modal automatically, once
  const [pendingSpellId, setPendingSpellId] = useState<string | null>(null)

  const [dmUserId, setDmUserId] = useState<string | null>(null)

  const portraitRef = useRef<HTMLInputElement>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [data, setData] = useState<CharacterData>(() => safeParseJson(character.data) as CharacterData)

  // Fetch the DM's userId so players can initiate DMs
  useEffect(() => {
    if (!data.partyCode) return
    supabase
      .from("objects")
      .select("owner_id")
      .eq("type", "campaign")
      .filter("data->>partyCode", "eq", data.partyCode)
      .maybeSingle()
      .then(({ data: row }) => { if (row?.owner_id) setDmUserId(row.owner_id) })
  }, [data.partyCode])

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
    const { data: files } = await supabase.storage.from(SUPABASE_BUCKET).list(`${user.id}`, { limit: 100 })
    if (files) {
      setGalleryImages(
        files
          .filter(f => f.name !== ".emptyFolderPlaceholder")
          .map(f => ({
            name: f.name,
            publicUrl: supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(`${user.id}/${f.name}`).data.publicUrl,
          }))
      )
    }
    setGalleryLoading(false)
  }

  async function uploadPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return
    setUploading(true)
    const ext  = file.name.split(".").pop() ?? "png"
    const path = `${user.id}/portrait_${character.id}.${ext}`
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
      update({ portrait: urlData.publicUrl })
    }
    setUploading(false)
    setShowPortraitPicker(false)
    e.target.value = ""
  }

  // ── HP COMPUTED ───────────────────────────────────────────────────────────

  const hp           = data.hp       ?? 0
  const maxHp        = data.maxHp    ?? 0
  const maxHpMod     = data.maxHpMod ?? 0
  const effectiveMax = Math.max(0, maxHp + maxHpMod)
  const tempHp       = data.tempHp   ?? 0
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
  const effectiveSpeed       = speedOverrideReason ? 0 : (data.speed ?? 0)

  // Concentration check: any HP loss while "Concentrating" is active prompts a save
  useEffect(() => {
    const prevHp = prevHpRef.current
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
  ]

  // Equipped armor/shields contribute their AC bonus to the displayed AC total
  const equippedAcBonus = (data.items ?? [])
    .filter(i => i.equipped && i.itemMeta?.acBonus)
    .reduce((sum, i) => sum + (i.itemMeta!.acBonus ?? 0), 0)

  // Items sent over to the Martial list keep a `sourceFeatureId` link — used both to render
  // "+ Equipment" as a toggle (on/off, not a repeatable spawn) and to avoid double-counting
  // their weight below (it's already counted via the source Feature in data.items).
  const equipmentLinkedIds = new Set(
    (data.equipmentItems ?? []).map(i => i.sourceFeatureId).filter((id): id is string => !!id)
  )

  // Total carried weight — items (× amount for stacked generics) + equipment (weapons/armor/gear)
  const totalWeight =
    (data.items ?? []).reduce((sum, i) => sum + (i.weight ?? 0) * (i.amount ?? 1), 0) +
    (data.equipmentItems ?? []).reduce((sum, i) => sum + (i.sourceFeatureId ? 0 : (i.weight ?? 0)), 0)

  // Total carried value (gp) — Items tab entries only, × amount for stacked generics
  const totalValue = (data.items ?? []).reduce((sum, i) => sum + (i.value ?? 0) * (i.amount ?? 1), 0)

  function addSpell() {
    const id = nanoid()
    update({ spellItems: [...spellItems, { id, name: "", level: 0 }] })
    setPendingSpellId(id)
  }
  function changeSpell(id: string, p: Partial<SpellItem>)     { update({ spellItems: spellItems.map(s => s.id === id ? { ...s, ...p } : s) }) }
  function removeSpell(id: string)                            { update({ spellItems: spellItems.filter(s => s.id !== id) }) }

  function addEquip()                                          { update({ equipmentItems: [...equipItems, { id: nanoid(), name: "", type: "melee" }] }) }
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
      properties: meta?.properties,
      meleeRange: meta?.meleeRange,
      throwRange: meta?.throwRange,
      range: meta?.range,
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
      itemMeta: {
        ...existingFeature.itemMeta,
        damage: equip.damage,
        damageType: equip.damageType,
        properties: equip.properties,
        meleeRange: equip.meleeRange,
        throwRange: equip.throwRange,
        range: equip.range,
        weaponKind: kind === "weapon" ? (equip.type as "melee" | "ranged") : existingFeature.itemMeta?.weaponKind,
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
      return { ...prev, [id]: { x: 96 + count * 28, y: 96 + count * 28 } }
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
    setOpenPopouts(prev => prev[id] ? { ...prev, [id]: { x, y } } : prev)
  }

  function toggleFeatureLink(featureId: string, otherId: string) {
    const KEYS = ["racialTraits", "feats", "classFeatures", "items"] as const
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
    const KEYS = ["racialTraits", "feats", "classFeatures", "items"] as const
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
    const KEYS = ["racialTraits", "feats", "classFeatures", "items"] as const
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
    const KEYS = ["racialTraits", "feats", "classFeatures", "items"] as const
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
    ...familiars
      .map(f => ({ id: f.id, label: f.nickname || monsters.find(m => m.id === f.monsterId)?.name || "Familiar", category: "Familiar", refType: "familiar" as const }))
      .filter(f => f.label.toLowerCase().includes(q)),
  ] : []

  // ── COMPUTED THEME / CARD ─────────────────────────────────────────────────

  const theme      = THEMES[data.theme ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const isLight    = data.themeMode === "light"
  const effectiveBox  = isLight ? theme.lightBox  : theme.box
  const effectiveBody = (() => {
    const bgKey = data.themeBg ?? "default"
    const bgOverride = bgKey !== "default" ? (BG_OPTIONS[bgKey]?.body ?? "") : ""
    if (bgOverride) return bgOverride
    return isLight ? theme.lightBody : theme.body
  })()
  const card       = `rounded-xl ${effectiveBox} ring-1 ${theme.ring}`
  const slotAccent = (SLOT_THEMES[data.slotTheme ?? DEFAULT_SLOT_THEME] ?? SLOT_THEMES[DEFAULT_SLOT_THEME]).accent

  // ── PROFICIENCY BONUS ─────────────────────────────────────────────────────

  const pb = profBonus(data.level ?? 1)

  // ── SAVING THROW MODIFIER ─────────────────────────────────────────────────

  function getSaveMod(save: typeof SAVE_KEYS[number]): number {
    const score      = (data[SAVE_TO_ABILITY[save] as keyof CharacterData] as number | undefined) ?? 10
    const base       = Math.floor((score - 10) / 2)
    const proficient = data.savingThrowProfs?.[save] ?? false
    const bonus      = data.saveBonuses?.[save] ?? 0
    return base + (proficient ? pb : 0) + bonus
  }

  function getSkillMod(skillName: string, abilityKey: string): number {
    const score = (data[SAVE_TO_ABILITY[abilityKey] as keyof CharacterData] as number | undefined) ?? 10
    const base  = Math.floor((score - 10) / 2)
    const prof  = data.skillProfs?.[skillName]
    const bonus = data.skillBonuses?.[skillName] ?? 0
    const profMod = prof === "exp" ? pb * 2 : prof === "prof" ? pb : prof === "half" ? Math.floor(pb / 2) : 0
    return base + profMod + bonus
  }

  // ── FAVORITES PROPS ───────────────────────────────────────────────────────

  const statMods = {
    str: Math.floor(((data.strength     ?? 10) - 10) / 2),
    dex: Math.floor(((data.dexterity    ?? 10) - 10) / 2),
    con: Math.floor(((data.constitution ?? 10) - 10) / 2),
    int: Math.floor(((data.intelligence ?? 10) - 10) / 2),
    wis: Math.floor(((data.wisdom       ?? 10) - 10) / 2),
    cha: Math.floor(((data.charisma     ?? 10) - 10) / 2),
  }

  const availableClasses = data.multiclass && data.classes?.length
    ? data.classes.map(c => c.cls).filter(Boolean)
    : (data.class ? [data.class] : [])

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
    theme: { ...theme, box: effectiveBox }, card, readOnly,
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
            <div className="absolute inset-0 flex items-center justify-center">
              <Shield className="size-11 text-white/60" />
              <span className="absolute text-base font-bold text-white leading-none">{(data.ac ?? 0) + equippedAcBonus}</span>
            </div>
            {equippedAcBonus > 0 && !data.hideEquipAcBadge && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold shrink-0 whitespace-nowrap"
                title="AC bonus from equipped armor/shield">
                +{equippedAcBonus} equip
              </span>
            )}
          </div>

          {/* HP value */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-white leading-none">{hp}</span>
            {tempHp > 0 && <span className="text-base font-bold text-blue-400 leading-none">+{tempHp}</span>}
            <span className="text-sm text-white/40">/ {effectiveMax}{maxHpMod !== 0 && <span className={`ml-1 text-xs ${maxHpMod > 0 ? "text-emerald-400" : "text-red-400"}`}>({maxHpMod > 0 ? "+" : ""}{maxHpMod})</span>}</span>
          </div>

          {/* Normal HP controls — only when hp > 0 */}
          {!isAtZero && !readOnly && (
            <div className="flex flex-col items-center gap-2 w-full">
              <div className={`flex rounded-full text-xs font-semibold uppercase tracking-wide overflow-hidden ring-1 ${theme.ring}`}>
                <button type="button" onClick={() => setHpTarget("hp")}
                  className={`px-3 py-1.5 transition-colors ${hpTarget === "hp" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"}`}>HP</button>
                <button type="button" onClick={() => setHpTarget("temp")}
                  className={`px-3 py-1.5 transition-colors ${hpTarget === "temp" ? "bg-blue-500/40 text-blue-200" : "text-white/40 hover:text-white/70"}`}>Temp</button>
              </div>
              <div className="flex items-center gap-2">
                {/* Minus: damage always drains temp first when in HP mode */}
                <button type="button"
                  onClick={() => {
                    if (hpTarget === "hp") {
                      const tempDrained = Math.min(tempHp, hpStep)
                      const remainder   = hpStep - tempDrained
                      update({ tempHp: tempHp - tempDrained, hp: Math.max(0, hp - remainder) })
                    } else {
                      update({ tempHp: Math.max(0, tempHp - hpStep) })
                    }
                  }}
                  className="size-9 rounded-full bg-white/10 hover:bg-red-900 text-white hover:text-red-200 flex items-center justify-center text-xl font-bold transition-colors">−</button>
                <NumInput value={hpStep}
                  onFocus={e => e.target.select()}
                  onChange={e => setHpStep(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                  className={`w-12 text-center text-sm font-bold ${theme.box} border border-white/15 rounded-lg py-1.5 text-white outline-none`} />
                <button type="button"
                  onClick={() => hpTarget === "hp"
                    ? update({ hp: effectiveMax > 0 ? Math.min(effectiveMax, hp + hpStep) : hp + hpStep })
                    : update({ tempHp: tempHp + hpStep })}
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
            <span className={`text-xl font-bold ${speedOverrideReason ? "text-red-400" : "text-white"}`}>{effectiveSpeed}</span>
            <span className="text-xs uppercase tracking-widest text-white/50">Speed{speedOverrideReason ? ` (${speedOverrideReason})` : ""}</span>
          </button>
          <button type="button" onClick={() => setShowInitiativeModal(true)}
            className={`${card} p-3 flex flex-col items-center gap-0.5 hover:brightness-110 transition-all`}
            style={{ boxShadow: `0 0 0 1px ${theme.accent}40` }}>
            <span className="text-xl font-bold text-white">{initStr}</span>
            <span className="text-xs uppercase tracking-widest" style={{ color: theme.accent + "cc" }}>Initiative</span>
            <span className="text-[9px] uppercase tracking-wider" style={{ color: theme.accent + "77" }}>
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
    Trait: "raceFeats", Feat: "raceFeats", Feature: "features", Gear: "items",
  }

  function navigateToResult(r: (typeof searchResults)[number]) {
    if (r.refType === "spell") {
      setSpellsSubTab("spells"); setActiveTab("main")
    } else if (r.refType === "equipment") {
      setSpellsSubTab("martial"); setActiveTab("main")
    } else if (r.refType === "familiar") {
      setActiveTab("familiars")
      if (!openPopouts[r.id]) togglePopout(r.id)
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
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

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
            <DiceRoller card={card} />
            <CurrencyTracker card={card} data={data} readOnly={readOnly} update={update} />
          </div>

          {/* Col 2: Abilities → Saves → Skills */}
          <div className="lg:w-56 shrink-0 flex flex-col gap-3 overflow-y-auto">
            <AbilitiesCard card={card} data={data} readOnly={readOnly} onShowModal={() => setShowAbilityModal(true)} />
            <SavesCard card={card} data={data} readOnly={readOnly} getSaveMod={getSaveMod} onShowModal={() => setShowSavesModal(true)} />
            <SkillsCard card={card} data={data} characterId={character.id} readOnly={readOnly} getSkillMod={getSkillMod} onShowSkillModal={setShowSkillModal} />
          </div>

          {/* Col 3: Favorites */}
          <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">
            <FavoritesPanel {...favPanelProps} />
          </div>
        </div>

        {/* Full-width spells / martial panel */}
        <SpellsEquipPanel
          card={card} theme={theme} data={data} readOnly={readOnly} userId={user?.id ?? null}
          spellItems={spellItems} equipItems={equipItems} spellSlots={spellSlots}
          slotAccent={slotAccent} characterId={character.id}
          activeSubTab={spellsSubTab} onChangeSubTab={setSpellsSubTab}
          onShowSpellcastingModal={() => setShowSpellcastingModal(true)}
          onChangeSlot={changeSlot}
          onAddSpell={addSpell} onChangeSpell={changeSpell} onRemoveSpell={removeSpell}
          pendingSpellId={pendingSpellId} onAutoEditConsumed={() => setPendingSpellId(null)}
          onAddEquip={addEquip} onChangeEquip={changeEquip} onRemoveEquip={removeEquip}
        />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className={`flex flex-col h-full min-h-0 text-white rounded-xl overflow-hidden ${effectiveBody}`}>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showMaxMenu && (
        <MaxStatsModal
          data={data} effectiveMax={effectiveMax}
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
          data={data} spellSlots={spellSlots} readOnly={readOnly} slotAccent={slotAccent}
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
      {showSpeedModal && (
        <SpeedModal
          data={data} readOnly={readOnly} overrideReason={speedOverrideReason}
          onUpdate={update} onClose={() => setShowSpeedModal(false)}
        />
      )}
      {showConditionPicker && (
        <ConditionPickerModal
          conditions={conditions} onAdd={addCondition} onClose={() => setShowConditionPicker(false)}
        />
      )}
      {showThemePicker && (
        <ThemeModal data={data} onUpdate={update} onClose={() => setShowThemePicker(false)} />
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0 ${effectiveBody}`}>

        <button type="button"
          onClick={readOnly ? undefined : openPortraitPicker}
          className={`relative size-11 rounded-full overflow-hidden ring-2 ${theme.ring} ${readOnly ? "" : "hover:ring-primary cursor-pointer"} shrink-0 ${theme.box} flex items-center justify-center transition-all`}>
          {uploading ? <span className="text-xs text-white/70">…</span>
            : data.portrait ? <img src={data.portrait} alt="portrait" className="w-full h-full object-cover" />
            : <span className="text-2xl leading-none select-none">IMAGE</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold tracking-wide truncate">{character.name}</p>
            {totalWeight > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/40 shrink-0" title="Total carried weight (items + equipment)">
                ⚖ {totalWeight % 1 === 0 ? totalWeight : totalWeight.toFixed(1)} lb
              </span>
            )}
            {totalValue > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 shrink-0" title="Total value of carried items">
                {totalValue % 1 === 0 ? totalValue : totalValue.toFixed(2)} gp
              </span>
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
              className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors truncate max-w-[140px] ${
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
          
          </div>

          {(concentrationPrompts.length > 0 || conditions.some(c => CONDITION_EFFECTS[c.name])) && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {concentrationPrompts.map(p => (
                <span key={p.id}
                  className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-200">
                  You took {p.damage} damage roll {p.dc}+ to concentrate.
                  <button type="button"
                    onClick={() => setConcentrationPrompts(prev => prev.filter(x => x.id !== p.id))}
                    className="opacity-60 hover:opacity-100 shrink-0">✕</button>
                </span>
              ))}
              {conditions.map(c => CONDITION_EFFECTS[c.name] && (
                <span key={c.id} title={CONDITION_EFFECTS[c.name]}
                  className="text-xs px-2 py-1 rounded-full bg-red-500/15 border border-red-400/30 text-red-200">
                  {c.name}: {CONDITION_EFFECTS[c.name]}
                </span>
              ))}
            </div>
          )}
        </div>

        {saving && <span className="text-xs text-white/40 shrink-0">saving…</span>}

        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setShowRestModal(true)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
              Rest
            </button>
            <button type="button"
              onClick={() => setShowThemePicker(true)}
              className="text-xs px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-colors">
              Theme
            </button>
          </div>
        )}
      </div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 flex-wrap px-4 py-2 border-b border-white/10 shrink-0 ${effectiveBody}`}>
        {(["main", "details", "familiars", ...(data.partyCode ? ["chat"] : [])] as Tab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
            {tab === "main" ? "Main" : tab === "details" ? "Details" : tab === "familiars" ? "Familiars" : "Chat"}
          </button>
        ))}
        <div className="w-full sm:w-auto sm:ml-auto">{activeTab !== "chat" && renderQuickSearch()}</div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-h-0 ${activeTab === "chat" ? "overflow-hidden" : "overflow-auto p-4"} ${effectiveBody}`}>
        {activeTab === "main"    && renderCombatTab()}
        {activeTab === "details" && (
          <InfoTab data={data} update={update} theme={theme} card={card} readOnly={readOnly}
            userId={user?.id ?? null} objects={objects} createObject={createObject} updateObject={updateObject}
            subTab={infoSubTab} onSubTabChange={setInfoSubTab}
            onChangeFeature={patchFeature} onRemoveFeature={removeFeatureGlobal} onLinkToggle={toggleFeatureLink}
            favorites={favorites} onToggleFavorite={toggleFeatureFavorite} onAddItemToEquipment={addItemToEquipment}
            equipmentLinkedIds={equipmentLinkedIds} />
        )}
        {activeTab === "familiars" && (
          <FamiliarsTab
            familiars={familiars}
            monsters={monsters}
            favorites={favorites}
            card={card}
            readOnly={readOnly}
            poppedOutIds={new Set(Object.keys(openPopouts))}
            onAdd={addFamiliar}
            onUpdate={updateFamiliar}
            onRemove={removeFamiliar}
            onToggleFavorite={toggleFamiliarFavorite}
            onPopOut={togglePopout}
          />
        )}
        {activeTab === "chat" && data.partyCode && (
          <PartyChat
            partyCode={data.partyCode}
            currentUserId={user?.id ?? ""}
            currentUserName={character.name || "Adventurer"}
            dmUserId={dmUserId ?? undefined}
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
            x={pos.x} y={pos.y}
            onMove={(x, y) => movePopout(id, x, y)}
            onClose={() => closePopout(id)}>
            <FamiliarMonsterView monster={monster} readOnly={readOnly} />
          </FloatingPanel>
        )
      })}

    </div>
  )
}
