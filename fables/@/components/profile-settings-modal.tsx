"use client"

import * as React from "react"
import { TrashIcon, UploadIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { supabase } from "../../src/supabase"

const BUCKET = "fableimages"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
}

interface StorageImage {
  name: string
  publicUrl: string
}

export function ProfileSettingsModal({ open, onOpenChange, user }: Props) {
  const [images, setImages] = React.useState<StorageImage[]>([])
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const userId = user?.id

  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "User"

  const avatarUrl = user?.user_metadata?.avatar_url

  async function loadImages() {
    if (!userId) return
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(`${userId}`, { limit: 100 })
    if (error || !data) return
    const loaded = data
      .filter((f) => f.name !== ".emptyFolderPlaceholder")
      .map((f) => ({
        name: f.name,
        publicUrl: supabase.storage
          .from(BUCKET)
          .getPublicUrl(`${userId}/${f.name}`).data.publicUrl,
      }))
    setImages(loaded)
  }

  React.useEffect(() => {
    if (open) loadImages()
  }, [open, userId])

async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file || !userId) return

  setUploading(true)

  try {
    const ext = file.name.split('.').pop() || 'bin'
    const filename = `${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(`${userId}/${filename}`, file, {
        upsert: true,
        contentType: file.type,
      })

    if (error) {
      console.error(error)
      return
    }

    await loadImages()
  } finally {
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }
}

  async function handleDelete(name: string) {
    if (!userId) return
    await supabase.storage
      .from(BUCKET)
      .remove([`${userId}/${name}`])
    setImages((prev) => prev.filter((img) => img.name !== name))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
        </DialogHeader>

        {/* User info */}
        <div className="flex items-center gap-3 py-2">
          <div className="size-12 rounded-xl overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={fullName} className="size-12 object-cover" />
            ) : (
              <div className="size-12 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-lg font-bold">
                {fullName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate">{fullName}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Background images */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Background Images</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <UploadIcon className="size-3.5" />
              {uploading ? "Uploading…" : "Upload"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>

          {images.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No images uploaded yet. Upload some to use as backgrounds on your items.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div key={img.name} className="group relative aspect-video rounded-md overflow-hidden bg-muted">
                  <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDelete(img.name)}
                    className="absolute top-1 right-1 size-6 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border" />

        {/* Fun section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Based button</span>
            <iframe
              width="110"
              height="200"
              src="https://www.myinstants.com/instant/pikmin-69773/embed/"
              title="Pikmin"
            />
          </div>

          <a
            href="https://account.venmo.com/u/vivianvanilladeluxe"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-4 py-2 bg-[#008CFF] hover:bg-[#0070CC] text-white text-sm font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
              <path d="M19.2 2c.5 1 .8 2.1.8 3.4 0 4.2-3.6 9.7-6.6 13.5H6.8L4 2.9l5.7-.5 1.5 11.5c1.4-2.3 3.1-6 3.1-8.5 0-1.4-.2-2.3-.6-3.4H19.2z" />
            </svg>
            @vivianvanilladeluxe
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
