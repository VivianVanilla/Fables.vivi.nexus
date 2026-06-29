import { useState } from "react"
import type { SidebarObject } from "@/components/sidebar-utils"
import { useUserContext } from "../../src/contexts/UserContext"
import { safeParseJson } from "./character-utils"
import { CharacterSheet } from "./character"

interface CampaignData {
  partyCode?: string
  description?: string
}

interface Props {
  campaign: SidebarObject
  onClose: () => void
}

export function CampaignView({ campaign, onClose }: Props) {
  const { objects } = useUserContext()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const campaignData = safeParseJson(campaign.data) as CampaignData
  const partyCode = campaignData.partyCode ?? ""

  // Find all characters that have a matching party code
  const partyMembers = objects.filter(obj => {
    if (obj.type !== "character") return false
    const charData = safeParseJson(obj.data) as { partyCode?: string }
    return charData.partyCode && charData.partyCode === partyCode
  }) as SidebarObject[]

  function copyCode() {
    if (partyCode) navigator.clipboard.writeText(partyCode).catch(() => {})
  }

  if (expandedId) {
    const char = partyMembers.find(c => c.id === expandedId)
    if (char) {
      return (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 text-xs text-white/50 shrink-0 bg-slate-900">
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              ← Back to {campaign.name}
            </button>
          </div>
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
          <p className="text-[10px] text-white/40 uppercase tracking-widest">Campaign</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 flex items-center justify-center rounded-md hover:bg-white/10 text-white/50 hover:text-white shrink-0 transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-4 p-4 overflow-auto flex-1">

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
            const charData = safeParseJson(char.data) as {
              race?: string
              class?: string
              level?: number
              hp?: number
              maxHp?: number
              portrait?: string
            }
            const hpPercent = charData.maxHp ? Math.round((charData.hp ?? 0) / charData.maxHp * 100) : 0
            const hpColor = hpPercent > 50 ? "bg-green-500" : hpPercent > 25 ? "bg-yellow-500" : "bg-red-500"

            return (
              <div
                key={char.id}
                className="rounded-xl bg-slate-800 ring-1 ring-slate-700 p-3 flex items-center gap-3 hover:ring-slate-500 transition-all cursor-pointer"
                onClick={() => setExpandedId(char.id)}
              >
                {/* Portrait */}
                <div className="size-10 rounded-full overflow-hidden bg-slate-700 shrink-0 flex items-center justify-center">
                  {charData.portrait ? (
                    <img src={charData.portrait} alt={char.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg leading-none select-none">🧙</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{char.name}</p>
                  <p className="text-[10px] text-white uppercase tracking-wider truncate">
                    {charData.race && `${charData.race} · `}{charData.class && charData.class}{charData.level && ` Lv ${charData.level}`}
                  </p>
                  {/* HP bar */}
                  {charData.maxHp ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full ${hpColor} transition-all`} style={{ width: `${hpPercent}%` }} />
                      </div>
                      <span className="text-[9px] text-white/40 shrink-0">{charData.hp ?? 0}/{charData.maxHp}</span>
                    </div>
                  ) : null}
                </div>

                {/* Arrow */}
                <span className="text-white/30 text-xs shrink-0">→</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
