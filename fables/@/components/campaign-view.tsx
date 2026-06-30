import { useState, useEffect } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { safeParseJson } from "./character-utils"
import { CharacterSheet } from "./character"
import { PartyChat } from "./PartyChat"
import { useUserContext } from "../../src/contexts/UserContext"
import { supabase } from "../../src/supabase"

interface CampaignData {
  partyCode?: string
  description?: string
}

interface CharData {
  race?: string
  class?: string
  level?: number
  hp?: number
  maxHp?: number
  portrait?: string
  ac?: number
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
}

interface Props {
  campaign: SidebarObject
  onClose: () => void
}

function profBonus(level: number) {
  return Math.ceil(level / 4) + 1
}

function abilityMod(score: number) {
  return Math.floor((score - 10) / 2)
}

function passiveStat(baseScore: number, skillName: string, level: number, skillProfs?: Record<string, "half" | "prof" | "exp">, skillBonuses?: Record<string, number>) {
  const base = abilityMod(baseScore)
  const pb   = profBonus(level)
  const prof = skillProfs?.[skillName]
  const profMod = prof === "exp" ? pb * 2 : prof === "prof" ? pb : prof === "half" ? Math.floor(pb / 2) : 0
  const bonus = skillBonuses?.[skillName] ?? 0
  return 10 + base + profMod + bonus
}

type CampaignTab = "overview" | "chat"

export function CampaignView({ campaign, onClose }: Props) {
  const { user } = useUserContext()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [partyMembers, setPartyMembers] = useState<SidebarObject[]>([])
  const [activeTab, setActiveTab] = useState<CampaignTab>("overview")

  const campaignData = safeParseJson(campaign.data) as CampaignData
  const partyCode = campaignData.partyCode ?? ""

  useEffect(() => {
    if (!partyCode) return
    supabase
      .from("objects")
      .select("*")
      .eq("type", "character")
      .filter("data->>partyCode", "eq", partyCode)
      .then(({ data, error }) => {
        if (error) { console.error("party fetch error:", error); return }
        setPartyMembers((data ?? []) as SidebarObject[])
      })
  }, [partyCode])

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
            className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 shrink-0 bg-slate-900 transition-colors text-left w-full"
          >
            <span className="text-base leading-none">←</span>
            <span>{campaign.name}</span>
          </button>
          <div className="flex-1 min-h-0">
            <CharacterSheet character={char} onClose={() => setExpandedId(null)} readOnly={true} />
          </div>
        </div>
      )
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-white bg-slate-900 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-900 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold tracking-wide truncate">{campaign.name}</p>
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Campaign · DM</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white shrink-0 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/10 bg-slate-900 shrink-0">
        {(["overview", "chat"] as CampaignTab[]).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs uppercase tracking-widest rounded-full font-semibold transition-colors ${activeTab === tab ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70 hover:bg-white/5"}`}>
            {tab === "overview" ? "Overview" : "Party Chat"}
          </button>
        ))}
      </div>

      {/* Chat panel */}
      {activeTab === "chat" && partyCode && (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <PartyChat
            partyCode={partyCode}
            currentUserId={user?.id ?? ""}
            currentUserName="DM"
            isDM={true}
            partyMembers={partyMembers.map(c => ({ userId: c.owner_id, name: c.name }))}
          />
        </div>
      )}
      {activeTab === "chat" && !partyCode && (
        <div className="flex-1 flex items-center justify-center text-sm text-white/30 italic">
          No party code — re-create this campaign to enable chat.
        </div>
      )}

      {/* Overview body */}
      {activeTab === "overview" && <div className="flex flex-col gap-4 p-4 overflow-auto flex-1">

        {/* Party Code card */}
        <div className="rounded-xl bg-slate-800 ring-1 ring-slate-700 p-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">Party Code</span>
          {partyCode ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold font-mono tracking-[0.3em] text-white select-all">{partyCode}</span>
              <button
                type="button"
                onClick={copyCode}
                className="text-[10px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
                title="Copy to clipboard"
              >
                Copy
              </button>
            </div>
          ) : (
            <p className="text-xs text-white/30 italic">No party code — re-create this campaign to generate one.</p>
          )}
          <p className="text-[10px] text-white/40">Share this code with your players. They enter it in the <span className="text-white/60">Info</span> tab of their character sheet to link to this campaign.</p>
        </div>

        {/* Party members */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">
              Party Members
            </span>
            <span className="text-[10px] text-white/30">{partyMembers.length} character{partyMembers.length !== 1 ? "s" : ""}</span>
          </div>

          {partyCode === "" && (
            <p className="text-xs text-white/30 italic text-center py-6">This campaign has no party code.</p>
          )}

          {partyCode !== "" && partyMembers.length === 0 && (
            <div className="rounded-xl bg-slate-800 ring-1 ring-slate-700 p-4 text-center">
              <p className="text-xs text-white/40 italic">No characters have joined yet.</p>
              <p className="text-[10px] text-white/30 mt-1">Share the party code above with your players.</p>
            </div>
          )}

          {partyMembers.map(char => {
            const charData = safeParseJson(char.data) as CharData
            const level       = charData.level ?? 1
            const hpPercent   = charData.maxHp ? Math.round((charData.hp ?? 0) / charData.maxHp * 100) : 0
            const hpColor     = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"

            const wis = charData.wisdom       ?? 10
            const int = charData.intelligence ?? 10
            const pPassPerc = passiveStat(wis, "Perception",    level, charData.skillProfs, charData.skillBonuses)
            const pPassIns  = passiveStat(wis, "Insight",       level, charData.skillProfs, charData.skillBonuses)
            const pPassInv  = passiveStat(int, "Investigation", level, charData.skillProfs, charData.skillBonuses)

            const conditions = charData.conditions ?? []

            return (
              <div
                key={char.id}
                className="rounded-xl bg-slate-800 ring-1 ring-slate-700 hover:ring-slate-500 transition-all cursor-pointer overflow-hidden"
                onClick={() => setExpandedId(char.id)}
              >
                {/* Top row — portrait + name + arrow */}
                <div className="p-3 flex items-center gap-3">
                  <div className="size-10 rounded-full overflow-hidden bg-slate-700 shrink-0 flex items-center justify-center">
                    {charData.portrait ? (
                      <img src={charData.portrait} alt={char.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg leading-none select-none">🧙</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{char.name}</p>
                    <p className="text-[10px] text-white/50 uppercase tracking-wider truncate">
                      {charData.race && `${charData.race} · `}{charData.class && charData.class}{charData.level && ` Lv ${charData.level}`}
                    </p>
                    {charData.maxHp ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPercent}%` }} />
                        </div>
                        <span className="text-[9px] text-white/40 shrink-0">{charData.hp ?? 0}/{charData.maxHp} HP</span>
                      </div>
                    ) : null}
                  </div>

                  <span className="text-white/30 text-xs shrink-0">→</span>
                </div>

                {/* Stat row */}
                <div className="grid grid-cols-5 border-t border-white/5 divide-x divide-white/5">
                  <StatCell label="AC"      value={charData.ac   != null ? String(charData.ac)   : "—"} />
                  <StatCell label="Speed"   value={charData.speed != null ? `${charData.speed}ft` : "—"} />
                  <StatCell label="Perc"    value={String(pPassPerc)} />
                  <StatCell label="Insight" value={String(pPassIns)} />
                  <StatCell label="Invest"  value={String(pPassInv)} />
                </div>

                {/* Conditions row (only if any) */}
                {conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-3 py-2 border-t border-white/5">
                    {conditions.map(c => (
                      <span key={c.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-300/80 font-medium">{c.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center py-2 gap-0.5">
      <span className="text-[9px] text-white/30 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-semibold text-white tabular-nums">{value}</span>
    </div>
  )
}
