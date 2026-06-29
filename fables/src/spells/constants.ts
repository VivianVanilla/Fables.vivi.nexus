export const CLASS_OPTIONS = [
  "Artificer", "Bard", "Cleric", "Druid", "Paladin",
  "Ranger", "Sorcerer", "Warlock", "Wizard", "Witch",
] as const

export const CLASS_COLORS: Record<string, string> = {
  Wizard: "#1F32DE",
  Warlock: "#411182",
  Sorcerer: "#A10A14",
  Druid: "#70ff7A",
  Cleric: "#FFFFFF",
  Bard: "#E88ED6",
  Ranger: "#11520E",
  Artificer: "#AD9366",
  Paladin: "#F7D80F",
  Witch: "#17e6df",
}

export const DAMAGE_TYPES = [
  "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning",
  "Necrotic", "Piercing", "Poison", "Psychic", "Radiant",
  "Slashing", "Thunder", "Sickness", "None", "Multiple",
]

export const SCHOOLS = [
  "Abjuration", "Chronomancy", "Conjuration", "Divination",
  "Enchantment", "Evocation", "Illusion", "Necromancy",
  "Transmutation", "Graviturgy", "Sickness", "Other",
]

export const CASTING = [
  "None", "1 Action", "Bonus Action", "Reaction",
  "1 Minute", "10 Minutes", "1 Hour", "8 Hours",
  "24 Hours", "12 Hours", "2 Rounds",
]

export const HOMEBREW_TAGS = ["Squain", "Twilight"]

export const LEVEL_COLORS: Record<number, string> = {
  0: "#6b7280",
  1: "#22c55e",
  2: "#3b82f6",
  3: "#a855f7",
  4: "#ec4899",
  5: "#ef4444",
  6: "#f97316",
  7: "#eab308",
  8: "#14b8a6",
  9: "#ffffff",
}
