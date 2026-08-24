// Shared types and constants for the documentation system

export type DocType = "classes" | "feats" | "items" | "races" | "backgrounds"
export type DocSingular = "class" | "feat" | "item" | "race" | "background"

export const SINGULAR: Record<DocType, DocSingular> = {
  classes: "class", feats: "feat", items: "item", races: "race", backgrounds: "background",
}

export const TYPE_LABEL: Record<DocType, string> = {
  classes: "Class", feats: "Feat", items: "Item", races: "Race", backgrounds: "Background",
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

// An "item" documentation entry with data.item_type === "pack" (e.g.
// "Explorer's Pack") carries this instead of weapon/armor stats — see
// DocEntryForm.tsx's ItemFields and FeatureEntry.tsx's getSuggestions.
// Each entry becomes its own singular-named Feature when the pack is picked
// from the item-suggestion dropdown ("Torch" x10, not one "10 Torches" row).
export interface PackItem {
  name: string
  amount: number
  weight?: number   // lb, per unit
  value?: number     // gp, per unit
}
