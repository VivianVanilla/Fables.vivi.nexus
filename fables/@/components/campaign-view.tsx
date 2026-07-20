import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import type { SidebarObject } from "@/components/sidebar-utils"
import { safeParseJson, computeAc, nanoid } from "./character-utils"
import type { Feature } from "./character-types"
import { SAVE_TO_ABILITY, ALL_CONDITIONS } from "./character-constants"
import { CharacterSheet } from "./character"
import { PartyServer } from "./party/PartyServer"
import { usePartyLatestMessageAt, isPartyUnread } from "./party/unread"
import { InitiativeTracker } from "./campaign/InitiativeTracker"
import { useUserContext } from "../../src/contexts/UserContext"
import { usePopoverPosition, useClickOutside } from "./collab/usePortalMenu"
import { useChannelSuffix } from "./party/partyTypes"
import { supabase } from "../../src/supabase"

interface DmDeathSaves {
  successes: number
  failures: number
}

interface CampaignData {
  partyCode?: string
  description?: string
  rosterFields?: Partial<Record<RosterFieldKey, boolean>>  // DM's per-campaign choice of what shows on each party member's preview card
  // The DM's own death save tally per character, kept on the campaign object
  // (not the character's own data) so it's genuinely independent of — and
  // invisible to — whatever the player is tracking on their own sheet.
  dmDeathSaves?: Record<string, DmDeathSaves>
}

interface CharData {
  race?: string
  class?: string
  level?: number
  hp?: number
  maxHp?: number
  portrait?: string
  ac?: number
  acAbility?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  acAbility2?: "str" | "dex" | "con" | "int" | "wis" | "cha"
  acMiscBonus?: number
  items?: Feature[]
  speed?: number
  wisdom?: number
  intelligence?: number
  dexterity?: number
  strength?: number
  charisma?: number
  constitution?: number
  skillProfs?: Record<string, "half" | "prof" | "exp">
  skillBonuses?: Record<string, number>
  conditions?: Array<{ id: string; name: string }>
  partyCode?: string
  spellcastingAbility?: string
  spellSaveDCBonus?: number
  initiativeStat?: string
  initiativeBonus?: number
  hitDicePools?: Array<{ id: string; dieType: string; total: number; used: number }>
}

interface Props {
  campaign: SidebarObject
}

function profBonus(level: number) {
  return Math.ceil(level / 4) + 1
}

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2)
}

function signed(n: number) {
  return n >= 0 ? `+${n}` : `${n}`
}

function passiveStat(baseScore: number, skillName: string, level: number, skillProfs?: Record<string, "half" | "prof" | "exp">, skillBonuses?: Record<string, number>) {
  const base = abilityMod(baseScore)
  const pb   = profBonus(level)
  const prof = skillProfs?.[skillName]
  const profMod = prof === "exp" ? pb * 2 : prof === "prof" ? pb : prof === "half" ? Math.floor(pb / 2) : 0
  const bonus = skillBonuses?.[skillName] ?? 0
  return 10 + base + profMod + bonus
}

// Mirrors SpellcastingModal.tsx's own formula exactly (8 + PB + ability mod +
// spellSaveDCBonus) so the roster preview never disagrees with the real sheet.
function spellSaveDC(charData: CharData, level: number): number | null {
  if (!charData.spellcastingAbility) return null
  const abilityKey = SAVE_TO_ABILITY[charData.spellcastingAbility.toLowerCase()]
  const score = abilityKey ? (charData[abilityKey as keyof CharData] as number | undefined) ?? 10 : 10
  return 8 + profBonus(level) + abilityMod(score) + (charData.spellSaveDCBonus ?? 0)
}

function initiativeMod(charData: CharData): number {
  const key = charData.initiativeStat ?? "dex"
  const abilityKey = SAVE_TO_ABILITY[key] ?? "dexterity"
  const score = (charData[abilityKey as keyof CharData] as number | undefined) ?? 10
  return abilityMod(score) + (charData.initiativeBonus ?? 0)
}

// ── Roster preview field customization ───────────────────────────────────────

// "conditions" isn't a StatCell — it renders as its own pill row (and is
// where the DM's add/remove condition control lives) — but it still goes
// through the same on/off settings menu as everything else here.
type RosterFieldKey = "ac" | "speed" | "passivePerception" | "saveDC" | "initiative" | "hitDice" | "conditions"

const ROSTER_FIELDS: { key: RosterFieldKey; label: string; shortLabel: string; default: boolean }[] = [
  { key: "ac",                label: "Armor Class",       shortLabel: "AC",    default: true },
  { key: "speed",              label: "Speed",              shortLabel: "Speed", default: true },
  { key: "passivePerception",  label: "Passive Perception", shortLabel: "Perception",  default: true },
  { key: "saveDC",             label: "Spell Save DC",      shortLabel: "DC",    default: true },
  { key: "hitDice",            label: "Hit Dice",           shortLabel: "HD",    default: true },
  { key: "initiative",         label: "Initiative",         shortLabel: "Init",  default: false },
  { key: "conditions",         label: "Current Conditions", shortLabel: "",      default: true },
]

// The subset of ROSTER_FIELDS that render as a StatCell in the stat row —
// "conditions" has its own row further down instead.
const STAT_CELL_FIELDS = ROSTER_FIELDS.filter(
  (f): f is typeof ROSTER_FIELDS[number] & { key: Exclude<RosterFieldKey, "conditions"> } => f.key !== "conditions"
)

function isRosterFieldOn(rosterFields: CampaignData["rosterFields"], key: RosterFieldKey): boolean {
  return rosterFields?.[key] ?? ROSTER_FIELDS.find(f => f.key === key)!.default
}

function hitDiceValue(charData: CharData): string {
  const pools = charData.hitDicePools ?? []
  if (pools.length === 0) return "—"
  return pools.map(p => `${Math.max(0, p.total - p.used)}/${p.total}${p.dieType}`).join(", ")
}

function rosterFieldValue(key: Exclude<RosterFieldKey, "conditions">, charData: CharData, level: number): string {
  switch (key) {
    case "ac": return String(computeAc(charData).total)
    case "speed": return charData.speed != null ? `${charData.speed}ft` : "—"
    case "passivePerception": return String(passiveStat(charData.wisdom ?? 10, "Perception", level, charData.skillProfs, charData.skillBonuses))
    case "saveDC": { const dc = spellSaveDC(charData, level); return dc != null ? String(dc) : "—" }
    case "initiative": return signed(initiativeMod(charData))
    case "hitDice": return hitDiceValue(charData)
  }
}

// Settings popover — same portaled-dropdown pattern used elsewhere (LinkMenu
// in InfoTab.tsx, MarkdownExportMenu in monster.tsx) so it isn't clipped by
// this panel's own scroll container.
function RosterFieldsMenu({ rosterFields, onChange }: { rosterFields: CampaignData["rosterFields"]; onChange: (next: CampaignData["rosterFields"]) => void }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(open, triggerRef)
  useClickOutside(open, () => setOpen(false), triggerRef, contentRef)

  function toggle(key: RosterFieldKey) {
    onChange({ ...rosterFields, [key]: !isRosterFieldOn(rosterFields, key) })
  }

  return (
    <div className="relative shrink-0">
      <button type="button" ref={triggerRef} onClick={() => setOpen(v => !v)} title="Choose what shows on each party member's card"
        className="text-foreground/40 hover:text-foreground text-xs size-6 flex items-center justify-center rounded-md hover:bg-foreground/10 transition-colors">
        ⚙
      </button>
      {open && pos && createPortal(
        <div ref={contentRef} style={{ position: "fixed", top: pos.top, right: pos.right }}
          className="z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl overflow-hidden w-56 p-2 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40 font-semibold px-2 pt-1 pb-1.5">Show on party cards</p>
          {ROSTER_FIELDS.map(f => (
            <label key={f.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/5 text-xs text-foreground/70 cursor-pointer select-none">
              <input type="checkbox" checked={isRosterFieldOn(rosterFields, f.key)} onChange={() => toggle(f.key)} />
              {f.label}
            </label>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

type CampaignTab = "overview" | "initiative" | "chat"

// Everything about a campaign's live roster — fetching, realtime sync, and
// the DM write-through actions (HP, conditions, kick) — factored out so both
// the full CampaignView (Overview tab) and CampaignRosterSidebar (the compact
// "characters only" dock, see below) can share one subscription instead of
// each opening their own when both happen to be open for the same campaign.
// useChannelSuffix keeps their realtime channel topics from colliding if
// that does happen (same pattern as usePartyLatestMessageAt).
function useCampaignRoster(campaign: SidebarObject) {
  const { updateSharedObject, updateObject } = useUserContext()
  const [partyMembers, setPartyMembers] = useState<SidebarObject[]>([])
  const [kickConfirmId, setKickConfirmId] = useState<string | null>(null)
  const [kicking, setKicking] = useState(false)
  const channelSuffix = useChannelSuffix()

  const campaignData = safeParseJson(campaign.data) as CampaignData
  const partyCode = campaignData.partyCode ?? ""

  // The DM owns their own campaign object, so a plain updateObject() write is
  // enough here — same reasoning as InitiativeTracker.tsx's encounter storage
  // on this same object (no cross-user RLS write-through needed, unlike the
  // party-member HP/kick writes below which touch someone else's character).
  function updateRosterFields(next: CampaignData["rosterFields"]) {
    updateObject(campaign.id, { data: { ...campaignData, rosterFields: next } as unknown as JSON }).catch(e => console.error(e))
  }

  // The DM's own death save tally, stored on the campaign object (see
  // CampaignData.dmDeathSaves) rather than the character — a deliberately
  // separate, DM-only count that never touches (or is visible from) what
  // the player rolls and tracks on their own sheet.
  function updateDmDeathSaves(characterId: string, next: DmDeathSaves) {
    const current = campaignData.dmDeathSaves ?? {}
    updateObject(campaign.id, { data: { ...campaignData, dmDeathSaves: { ...current, [characterId]: next } } as unknown as JSON }).catch(e => console.error(e))
  }

  // Polls every 20s as a safety net on top of the realtime subscription below —
  // if postgres_changes ever misses an event (dropped connection, a realtime
  // config gap on the `objects` table, etc.) the roster still catches up on
  // its own within a few seconds instead of staying stale until someone
  // happens to reload the whole page.
  useEffect(() => {
    if (!partyCode) return
    let cancelled = false
    function fetchRoster() {
      supabase
        .from("objects")
        .select("*")
        .eq("type", "character")
        .filter("data->>partyCode", "eq", partyCode)
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) { console.error("party fetch error:", error); return }
          setPartyMembers((data ?? []) as SidebarObject[])
        })
    }
    fetchRoster()
    const interval = setInterval(fetchRoster, 20000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [partyCode])

  // Keeps the roster live without a page refresh: a player's own edits (HP,
  // AC, conditions, leaving the party — anything on their character sheet)
  // land here the moment they save, instead of only after the DM re-opens
  // the campaign. `objects` has no partyCode column to filter on server-side
  // (it's nested in `data`), so this subscribes broadly to character-row
  // changes and checks data.partyCode client-side once the payload arrives —
  // same trade-off usePartyLatestMessageAt makes for messages.
  useEffect(() => {
    if (!partyCode) return
    const ch = supabase
      .channel(`campaign-roster:${partyCode}:${channelSuffix}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "objects", filter: "type=eq.character",
      }, payload => {
        const row = payload.new as SidebarObject
        const rowData = safeParseJson(row.data) as CharData
        setPartyMembers(prev => {
          const wasMember = prev.some(c => c.id === row.id)
          if (rowData.partyCode !== partyCode) return wasMember ? prev.filter(c => c.id !== row.id) : prev
          return wasMember ? prev.map(c => c.id === row.id ? row : c) : [...prev, row]
        })
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "objects", filter: "type=eq.character",
      }, payload => {
        const row = payload.new as SidebarObject
        const rowData = safeParseJson(row.data) as CharData
        if (rowData.partyCode !== partyCode) return
        setPartyMembers(prev => prev.some(c => c.id === row.id) ? prev : [...prev, row])
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "objects", filter: "type=eq.character",
      }, payload => {
        const old = payload.old as Partial<SidebarObject>
        if (old?.id) setPartyMembers(prev => prev.filter(c => c.id !== old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [partyCode, channelSuffix])

  // DM editing a PC's HP straight from the Initiative tracker — writes through
  // to the player's real character sheet. Needs an RLS policy on `objects`
  // permitting a DM to UPDATE a party member's character row (same caveat as
  // note collaborators — see updateSharedObject's comment in UserContext.tsx).
  async function updatePartyMemberHp(characterId: string, hp: number) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, hp } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }

  // DM applying/clearing a condition on a player's character — same
  // write-through path as updatePartyMemberHp above.
  async function addConditionToMember(characterId: string, name: string) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    const conditions = charData.conditions ?? []
    if (conditions.some(c => c.name === name)) return
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, conditions: [...conditions, { id: nanoid(), name }] } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }
  async function removeConditionFromMember(characterId: string, conditionId: string) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    const conditions = (charData.conditions ?? []).filter(c => c.id !== conditionId)
    try {
      const updated = await updateSharedObject(characterId, { data: { ...charData, conditions } as unknown as JSON })
      setPartyMembers(prev => prev.map(c => c.id === characterId ? (updated as unknown as SidebarObject) : c))
    } catch (e) { console.error(e) }
  }

  // Kicking just clears the party code on the player's own character — same
  // as if they'd left voluntarily from their Info tab. Uses the same
  // DM-write-through path (and RLS policy) as updatePartyMemberHp above.
  async function kickMember(characterId: string) {
    const char = partyMembers.find(c => c.id === characterId)
    if (!char) return
    const charData = safeParseJson(char.data) as CharData
    setKicking(true)
    try {
      await updateSharedObject(characterId, { data: { ...charData, partyCode: "" } as unknown as JSON })
      setPartyMembers(prev => prev.filter(c => c.id !== characterId))
    } catch (e) {
      console.error("kick failed:", e)
    } finally {
      setKicking(false)
      setKickConfirmId(null)
    }
  }

  return {
    campaignData, partyCode, partyMembers, kickConfirmId, setKickConfirmId, kicking,
    updateRosterFields, updateDmDeathSaves, updatePartyMemberHp, addConditionToMember, removeConditionFromMember, kickMember,
  }
}

export function CampaignView({ campaign }: Props) {
  const { user } = useUserContext()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<CampaignTab>("overview")
  const {
    campaignData, partyCode, partyMembers, kickConfirmId, setKickConfirmId, kicking,
    updateRosterFields, updateDmDeathSaves, updatePartyMemberHp, addConditionToMember, removeConditionFromMember, kickMember,
  } = useCampaignRoster(campaign)

  const enabledStatCells = STAT_CELL_FIELDS.filter(f => isRosterFieldOn(campaignData.rosterFields, f.key))
  const showConditions = isRosterFieldOn(campaignData.rosterFields, "conditions")

  const chatLatestMessageAt = usePartyLatestMessageAt(partyCode, user?.id ?? "")
  // Never show the dot while the Chat tab is the one you're looking at — it's
  // definitionally seen. Without this, the dot could linger after opening
  // Chat until some unrelated re-render happened to re-read the "seen"
  // timestamp PartyServer had already written to localStorage.
  const chatUnread = !!partyCode && !!user?.id && activeTab !== "chat" && isPartyUnread(user.id, partyCode, chatLatestMessageAt)

  function copyCode() {
    if (partyCode) navigator.clipboard.writeText(partyCode).catch(() => {})
  }

  if (expandedId) {
    const char = partyMembers.find(c => c.id === expandedId)
    if (char) {
      return (
        <div className="flex flex-col h-full min-h-0">
          <button
            type="button"
            onClick={() => setExpandedId(null)}
            className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/10 text-sm font-semibold text-foreground/70 hover:text-foreground hover:bg-foreground/5 shrink-0 bg-card transition-colors text-left w-full"
          >
            <span className="text-base leading-none">←</span>
            <span>{campaign.name}</span>
          </button>
          <div className="flex-1 min-h-0">
            <CharacterSheet character={char} readOnly={true} />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-foreground bg-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10 bg-card shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-wide truncate">{campaign.name}</p>
          <p className="text-[10px] text-foreground/40 uppercase tracking-widest">Campaign · DM</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-foreground/10 bg-card shrink-0">
        {(["overview", "initiative", "chat"] as CampaignTab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`relative px-4 py-1.5 text-xs uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-foreground/20 text-foreground" : "text-foreground/40 hover:text-foreground/70 hover:bg-foreground/5"}`}>
            {tab === "overview" ? "Overview" : tab === "initiative" ? "Initiative" : "Party Chat"}
            {tab === "chat" && chatUnread && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-red-500" />
            )}
          </button>
        ))}
      </div>

      {/* Initiative tracker */}
      {activeTab === "initiative" && (
        <InitiativeTracker campaign={campaign} partyMembers={partyMembers} onUpdateCharacterHp={updatePartyMemberHp} />
      )}

      {/* Chat panel */}
      {activeTab === "chat" && partyCode && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <PartyServer
            partyCode={partyCode}
            currentUserId={user?.id ?? ""}
            currentUserName="Dungeon Master"
            isDM={true}
            campaign={campaign}
            partyMembers={partyMembers.map(c => ({ userId: c.owner_id, name: c.name, characterId: c.id }))}
          />
        </div>
      )}
      {activeTab === "chat" && !partyCode && (
        <div className="flex-1 flex items-center justify-center text-sm text-foreground/30 italic">
          No party code — re-create this campaign to enable chat.
        </div>
      )}

      {/* Overview body */}
      {activeTab === "overview" && <div className="flex flex-col gap-4 p-4 overflow-auto flex-1">

        {/* Party Code card */}
        <div className="rounded-xl bg-muted ring-1 ring-border p-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Party Code</span>
          {partyCode ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono tracking-[0.3em] text-foreground select-all">{partyCode}</span>
              <button
                type="button"
                onClick={copyCode}
                className="text-[10px] px-2.5 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/60 hover:text-foreground transition-colors"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-xs text-foreground/30 italic">No party code — re-create this campaign to generate one.</p>
          )}
          <p className="text-[10px] text-foreground/40">Share this code with your players. They enter it in the <span className="text-foreground/60">Info</span> tab of their character sheet to link to this campaign.</p>
        </div>

        {/* Party members */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">
              Party Members
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-foreground/30">{partyMembers.length} character{partyMembers.length !== 1 ? "s" : ""}</span>
              <RosterFieldsMenu rosterFields={campaignData.rosterFields} onChange={updateRosterFields} />
            </div>
          </div>

          {partyCode === "" && (
            <p className="text-xs text-foreground/30 italic text-center py-6">This campaign has no party code.</p>
          )}

          {partyCode !== "" && partyMembers.length === 0 && (
            <div className="rounded-xl bg-muted ring-1 ring-border p-4 text-center">
              <p className="text-xs text-foreground/40 italic">No characters have joined yet.</p>
              <p className="text-[10px] text-foreground/30 mt-1">Share the party code above with your players.</p>
            </div>
          )}

          {partyMembers.map(char => (
            <PartyMemberCard
              key={char.id}
              char={char}
              charData={safeParseJson(char.data) as CharData}
              enabledStatCells={enabledStatCells}
              showConditions={showConditions}
              kickConfirmId={kickConfirmId}
              kicking={kicking}
              dmDeathSaves={campaignData.dmDeathSaves?.[char.id] ?? { successes: 0, failures: 0 }}
              onChangeDmDeathSaves={next => updateDmDeathSaves(char.id, next)}
              onExpand={() => setExpandedId(char.id)}
              onKickConfirm={() => setKickConfirmId(char.id)}
              onKickCancel={() => setKickConfirmId(null)}
              onKick={() => kickMember(char.id)}
              onAddCondition={name => addConditionToMember(char.id, name)}
              onRemoveCondition={id => removeConditionFromMember(char.id, id)}
            />
          ))}
        </div>
      </div>}
    </div>
  )
}

// ── Roster sidebar ────────────────────────────────────────────────────────
// The compact "characters only" dock, opened from the ⓘ context menu on a
// campaign in the left sidebar (see app-sidebar.tsx) and rendered alongside
// the main pane workspace in Dashboard.tsx. Deliberately excludes the party
// code card and the Initiative/Chat tabs — just the roster, so it's small
// enough to keep visible while you work on something else.
export function CampaignRosterSidebar({ campaign, onClose, onOpenCharacter }: {
  campaign: SidebarObject
  onClose: () => void
  onOpenCharacter: (characterId: string) => void
}) {
  const {
    campaignData, partyCode, partyMembers,
    updateRosterFields, updateDmDeathSaves, addConditionToMember, removeConditionFromMember,
  } = useCampaignRoster(campaign)

  const enabledStatCells = STAT_CELL_FIELDS.filter(f => isRosterFieldOn(campaignData.rosterFields, f.key))
  const showConditions = isRosterFieldOn(campaignData.rosterFields, "conditions")

  return (
    <div className="w-48 shrink-0 h-full min-h-0 flex flex-col rounded-xl bg-card ring-1 ring-border overflow-hidden text-foreground">
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-foreground/10 shrink-0">
        <p className="flex-1 min-w-0 text-xs font-bold tracking-wide truncate">{campaign.name}</p>
        <RosterFieldsMenu rosterFields={campaignData.rosterFields} onChange={updateRosterFields} />
        <button type="button" onClick={onClose} title="Hide roster sidebar"
          className="size-5 flex items-center justify-center rounded-md hover:bg-foreground/10 text-foreground/50 hover:text-foreground shrink-0 transition-colors">
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-1.5 flex flex-col gap-1.5">
        {partyCode === "" && (
          <p className="text-[10px] text-foreground/30 italic text-center py-6">This campaign has no party code.</p>
        )}
        {partyCode !== "" && partyMembers.length === 0 && (
          <div className="rounded-xl bg-muted ring-1 ring-border p-3 text-center">
            <p className="text-[10px] text-foreground/40 italic">No characters have joined yet.</p>
          </div>
        )}
        {partyMembers.map(char => (
          <PartyMemberCard
            key={char.id}
            char={char}
            charData={safeParseJson(char.data) as CharData}
            enabledStatCells={enabledStatCells}
            showConditions={showConditions}
            compact
            dmDeathSaves={campaignData.dmDeathSaves?.[char.id] ?? { successes: 0, failures: 0 }}
            onChangeDmDeathSaves={next => updateDmDeathSaves(char.id, next)}
            onExpand={() => onOpenCharacter(char.id)}
            onAddCondition={name => addConditionToMember(char.id, name)}
            onRemoveCondition={id => removeConditionFromMember(char.id, id)}
          />
        ))}
      </div>
    </div>
  )
}

// A DM-only death save tally, independent of whatever the player rolls and
// tracks on their own sheet — see CampaignData.dmDeathSaves. Deliberately
// simple (no auto-stabilize/dead transitions like the player's own
// DeathSavingThrows panel) since this is just the DM's private bookkeeping,
// not a mechanic that should silently change the character's real state.
function DmDeathSaveTracker({ saves, onChange }: { saves: DmDeathSaves; onChange: (next: DmDeathSaves) => void }) {
  const { successes, failures } = saves
  function toggle(kind: "successes" | "failures", i: number) {
    const current = saves[kind]
    const filled = i < current
    const next = filled && i === current - 1 ? current - 1 : Math.min(3, current + 1)
    onChange({ ...saves, [kind]: next })
  }
  return (
    <div className="flex items-center gap-2 flex-wrap px-3 py-1.5 border-t border-foreground/5" onClick={e => e.stopPropagation()}>
      <span className="text-[8px] text-foreground/35 uppercase tracking-widest shrink-0">DM Death Saves</span>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <button key={i} type="button" onClick={() => toggle("successes", i)}
            className={`size-3.5 rounded-full border flex items-center justify-center text-[7px] leading-none transition-colors ${
              i < successes ? "bg-emerald-500/25 border-emerald-400 text-emerald-300" : "border-foreground/20 text-transparent hover:border-emerald-400/50"
            }`}>
            ♥
          </button>
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <button key={i} type="button" onClick={() => toggle("failures", i)}
            className={`size-3.5 rounded-full border flex items-center justify-center text-[7px] leading-none transition-colors ${
              i < failures ? "bg-red-500/25 border-red-400 text-red-300" : "border-foreground/20 text-transparent hover:border-red-400/50"
            }`}>
            ☠
          </button>
        ))}
      </div>
    </div>
  )
}

function PartyMemberCard({
  char, charData, enabledStatCells, showConditions,
  kickConfirmId, kicking,
  dmDeathSaves, onChangeDmDeathSaves,
  onExpand, onKickConfirm, onKickCancel, onKick,
  onAddCondition, onRemoveCondition,
  compact = false,
}: {
  char: SidebarObject
  charData: CharData
  enabledStatCells: typeof STAT_CELL_FIELDS
  showConditions: boolean
  kickConfirmId?: string | null
  kicking?: boolean
  dmDeathSaves: DmDeathSaves
  onChangeDmDeathSaves: (next: DmDeathSaves) => void
  onExpand: () => void
  onKickConfirm?: () => void
  onKickCancel?: () => void
  onKick?: () => void
  onAddCondition: (name: string) => void
  onRemoveCondition: (id: string) => void
  compact?: boolean
}) {
  const [showConditionMenu, setShowConditionMenu] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const pos = usePopoverPosition(showConditionMenu, triggerRef)
  useClickOutside(showConditionMenu, () => setShowConditionMenu(false), triggerRef, contentRef)

  const level     = charData.level ?? 1
  const hpPercent = charData.maxHp ? Math.round((charData.hp ?? 0) / charData.maxHp * 100) : 0
  const hpColor   = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"
  const conditions = charData.conditions ?? []

  return (
    <div className="rounded-xl bg-muted ring-1 ring-border hover:ring-border transition-all overflow-hidden">
      {/* Top row — name + arrow (portrait/kick only in the full, non-compact card) */}
      <div className={`${compact ? "p-2 gap-2" : "p-3 gap-3"} flex items-center cursor-pointer`} onClick={onExpand}>
        {!compact && (
          <div className="size-10 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
            {charData.portrait ? (
              <img src={charData.portrait} alt={char.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg leading-none select-none">🧙</span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-foreground truncate`}>{char.name}</p>
          {!compact && (
            <p className="text-[10px] text-foreground/50 uppercase tracking-wider truncate">
              {charData.race && `${charData.race} · `}{charData.class && charData.class}{charData.level && ` Lv ${charData.level}`}
            </p>
          )}
          {charData.maxHp ? (
            <div className={`${compact ? "mt-1" : "mt-1.5"} flex items-center gap-2`}>
              <div className="flex-1 h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPercent}%` }} />
              </div>
              <span className="text-[9px] text-foreground/40 shrink-0">{charData.hp ?? 0}/{charData.maxHp} HP</span>
            </div>
          ) : null}
        </div>

        {!compact && (
          kickConfirmId === char.id ? (
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                disabled={kicking}
                onClick={onKick}
                className="text-[10px] px-2 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-40"
              >
                {kicking ? "Kicking…" : "Confirm kick"}
              </button>
              <button
                type="button"
                disabled={kicking}
                onClick={onKickCancel}
                className="text-[10px] px-2 py-1 rounded-full bg-foreground/10 hover:bg-foreground/20 text-foreground/50 hover:text-foreground transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onKickConfirm?.() }}
              title="Remove from party"
              className="text-[10px] px-2 py-1 rounded-full bg-foreground/5 hover:bg-red-500/20 text-foreground/40 hover:text-red-300 transition-colors shrink-0"
            >
              Kick
            </button>
          )
        )}

        {!compact && <span className="text-foreground/30 text-xs shrink-0">→</span>}
      </div>

      {/* Stat row — only the fields turned on in the ⚙ menu above, in a
          flex row so it stays evenly spaced whether that's 1 field or 6. */}
      {enabledStatCells.length > 0 && (
        <div className="flex border-t border-foreground/5 divide-x divide-foreground/5">
          {enabledStatCells.map(f => (
            <StatCell key={f.key} label={f.shortLabel} value={rosterFieldValue(f.key, charData, level)} compact={compact} />
          ))}
        </div>
      )}

      {/* DM's own death save tally — only surfaces once the character is
          actually down, and never touches the player's own tracked saves. */}
      {charData.maxHp != null && (charData.hp ?? 0) <= 0 && (
        <DmDeathSaveTracker saves={dmDeathSaves} onChange={onChangeDmDeathSaves} />
      )}

      {/* Conditions row — DM can add/remove conditions right from the roster */}
      {showConditions && (
        <div className={`flex flex-wrap items-center gap-1 ${compact ? "px-2 py-1.5" : "px-3 py-2"} border-t border-foreground/5`} onClick={e => e.stopPropagation()}>
          {conditions.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onRemoveCondition(c.id)}
              title="Click to remove"
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300/80 font-medium hover:bg-red-500/30 transition-colors"
            >
              {c.name} ✕
            </button>
          ))}
          <button
            type="button"
            ref={triggerRef}
            onClick={() => setShowConditionMenu(v => !v)}
            className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/40 hover:text-foreground/70 transition-colors"
          >
            + Condition
          </button>
          {showConditionMenu && pos && createPortal(
            <div
              ref={contentRef}
              style={{ position: "fixed", top: pos.top, right: pos.right }}
              className="z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-xl overflow-hidden w-56 p-2 grid grid-cols-2 gap-1 animate-in fade-in zoom-in-95 duration-150"
            >
              {ALL_CONDITIONS.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => { onAddCondition(name); setShowConditionMenu(false) }}
                  disabled={conditions.some(c => c.name === name)}
                  className={`text-xs px-2 py-1.5 rounded-lg text-left transition-colors ${conditions.some(c => c.name === name) ? "text-foreground/25 cursor-default" : "text-foreground/80 hover:bg-foreground/10"}`}
                >
                  {name}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`flex-1 min-w-0 flex flex-col items-center ${compact ? "py-1" : "py-2"} gap-0.5`}>
      <span className="text-[9px] text-foreground/30 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  )
}
