export interface SpellClass { name: string }
export interface SpellSchool { name: string }

export interface Spell {
  index: string
  name: string
  level: number
  school: SpellSchool
  classes: SpellClass[]
  casting_time: string
  range: string
  duration: string
  components: string[]
  materialComponents: boolean
  materials: string
  damageType: string
  ctag: string
  ritual: boolean
  desc: string | string[]
  // Combat fields (enriched from description)
  damage?: string      // primary damage dice, e.g. "8d6"
  saveAttr?: string    // save attribute abbreviation, e.g. "CON", "DEX"
  attackRoll?: boolean // true if the spell requires a spell attack roll
}

export interface SpellFilters {
  school: string
  casting_time: string
  damageType: string
  ritual: string
  concentration: string
  campaignTag: string
}

export const DEFAULT_FILTERS: SpellFilters = {
  school: "All",
  casting_time: "All",
  damageType: "All",
  ritual: "All",
  concentration: "All",
  campaignTag: "All",
}
