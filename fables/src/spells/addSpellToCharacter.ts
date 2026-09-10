// Adds a library Spell straight to a character's spellItems — the "+"
// button/right-click path on SpellCard (SpellBrowser.tsx), for picking a
// spell up from the standalone /documentation library without opening the
// character sheet at all. Mirrors monster.tsx's addSpellFromPicker, which
// does the same conversion for a character already open in its own editor.
import type { Spell } from "./types"
import type { CharacterData } from "@/components/shared/types"
import type { userInfo } from "@/types/userInfo"
import { nanoid, safeParseJson } from "@/components/shared/utils"
import { spellItemFieldsFromSpell } from "@/components/shared/spellUtils"

export async function addSpellToCharacter(
  character: userInfo.Objects,
  spell: Spell,
  updateObject: (id: string, updates: userInfo.ObjectsUpdate) => Promise<userInfo.Objects>,
) {
  const data = safeParseJson(character.data) as CharacterData
  const spellItems = [...(data.spellItems ?? []), { id: nanoid(), ...spellItemFieldsFromSpell(spell) }]
  await updateObject(character.id, { data: { ...data, spellItems } as unknown as JSON })
}
