// Shared types and constants for the documentation system

export type DocType = "classes" | "feats" | "items" | "races"
export type DocSingular = "class" | "feat" | "item" | "race"

export const SINGULAR: Record<DocType, DocSingular> = {
  classes: "class", feats: "feat", items: "item", races: "race",
}

export const TYPE_LABEL: Record<DocType, string> = {
  classes: "Class", feats: "Feat", items: "Item", races: "Race",
}

export const ADMIN_EMAILS = [
  "liamlillico06@gmail.com",
  "spaghettiloverjake@gmail.com",
  "vivian.bonilla@outlook.com",
  "loganadsit@gmail.com",
]

export interface DocEntry {
  id: string
  type: DocSingular
  name: string
  description: string
  source: string
  is_homebrew: boolean
  owner_id: string | null
  data: Record<string, any>
  created_at?: string
}
