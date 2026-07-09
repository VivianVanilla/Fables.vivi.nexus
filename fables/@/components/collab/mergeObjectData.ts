// ════════════════════════════════════════════════════════════════════════════
// mergeObjectData.ts — atomic partial-update of an `objects` row's `data`
// jsonb column via the `merge_object_data` Postgres RPC (`data = data ||
// patch` as one statement). See useCollaborativeNote.ts for why a client-side
// read-then-write can't guarantee this against concurrent writes the way a
// single atomic SQL statement can.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../../../src/supabase"
import type { userInfo } from "@/types/userInfo"

export async function mergeObjectData(id: string, patch: Record<string, unknown>): Promise<userInfo.Objects> {
  const { data, error } = await supabase.rpc("merge_object_data", { p_id: id, p_patch: patch })
  if (error) throw error
  if (!data) throw new Error("No matching object found for update (missing RLS permission?)")
  return data as userInfo.Objects
}
