import { supabase } from '../supabase'
import type { Spell } from './types'

let cache: Spell[] | null = null
let pending: Promise<Spell[]> | null = null

export async function getSpells(): Promise<Spell[]> {
  if (cache) return cache
  if (pending) return pending

  pending = supabase
    .from('spells')
    .select('spell_data')
    .then(({ data, error }) => {
      if (error) console.error('spellCache: failed to load spells', error)
      cache = (data ?? []).map((row: any) => row.spell_data as Spell)
      pending = null
      return cache
    })

  return pending
}

export function getCachedSpells(): Spell[] {
  return cache ?? []
}
