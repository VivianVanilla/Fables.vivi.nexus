// ════════════════════════════════════════════════════════════════════════════
// imageGallery.ts — shared helpers for "pick from your uploaded pictures"
// pickers (character/monster portraits, note images). Everyone's images live
// in one bucket under a per-user folder, so uploading anywhere makes that
// image available to pick from everywhere else too.
// ════════════════════════════════════════════════════════════════════════════

import { supabase } from "../../src/supabase"
import { SUPABASE_BUCKET } from "./character-constants"

export interface GalleryImage {
  name: string
  publicUrl: string
}

export async function loadUserImages(userId: string): Promise<GalleryImage[]> {
  const { data: files } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .list(userId, { limit: 200, sortBy: { column: "created_at", order: "desc" } })

  if (!files) return []
  return files
    .filter(f => f.name !== ".emptyFolderPlaceholder")
    .map(f => ({
      name: f.name,
      publicUrl: supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(`${userId}/${f.name}`).data.publicUrl,
    }))
}

// `slot`, when given, always uploads to the same filename (upsert) — used for
// "this character/monster's portrait" where there's one dedicated picture.
// Omit it (e.g. for note images) to get a unique filename instead, since a
// note can hold many images over time.
export async function uploadUserImage(userId: string, file: File, slot?: string): Promise<string | null> {
  const ext = file.name.split(".").pop() || "png"
  const filename = slot ? `${slot}.${ext}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${userId}/${filename}`
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
  if (error) { console.error("image upload failed", error); return null }
  return supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path).data.publicUrl
}
