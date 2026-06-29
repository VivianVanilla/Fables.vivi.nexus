import type { Spell, SpellFilters } from './types'

export function filterSpells(
  spells: Spell[],
  filters: SpellFilters,
  selectedClasses: string[],
  search: string,
  selectedLevels: number[],
): Spell[] {
  let list = [...spells]

  if (search.trim()) {
    const q = search.toLowerCase()
    list = list.filter((s) => s.name.toLowerCase().includes(q))
  }

  if (selectedLevels.length > 0) {
    list = list.filter((s) => selectedLevels.includes(s.level))
  }

  if (filters.school !== "All") {
    list = list.filter((s) => s.school?.name === filters.school)
  }

  if (filters.ritual === "true") {
    list = list.filter((s) => s.ritual === true)
  } else if (filters.ritual === "false") {
    list = list.filter((s) => s.ritual === false)
  }

  if (filters.casting_time !== "All") {
    list = list.filter((s) => s.casting_time === filters.casting_time)
  }

  if (filters.damageType !== "All") {
    list = list.filter((s) => s.damageType === filters.damageType)
  }

  if (selectedClasses.length > 0) {
    list = list.filter((s) =>
      s.classes?.some((c) => selectedClasses.includes(c.name))
    )
  }

  if (filters.concentration === "Concentration") {
    list = list.filter((s) => s.duration?.toLowerCase().includes("con"))
  } else if (filters.concentration === "No Concentration") {
    list = list.filter((s) => !s.duration?.toLowerCase().includes("con"))
  }

  if (filters.campaignTag !== "All") {
    list = list.filter((s) => s.ctag === filters.campaignTag)
  }

  return list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}
