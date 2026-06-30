import React from "react"
import { Modal } from "../ui/Modal"

interface GalleryImage {
  name: string
  publicUrl: string
}

interface Props {
  currentPortrait?: string
  galleryImages: GalleryImage[]
  galleryLoading: boolean
  onChoose: (url: string) => void
  onUploadClick: () => void
  onClose: () => void
}

export function PortraitModal({ currentPortrait, galleryImages, galleryLoading, onChoose, onUploadClick, onClose }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <span className="text-base font-bold text-white">Choose Portrait</span>
          <button type="button" onClick={onClose}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white">✕</button>
        </div>
        <div className="p-4 flex flex-col gap-3 overflow-hidden flex-1 min-h-0">
          <button type="button" onClick={onUploadClick}
            className="text-sm border border-dashed border-white/20 hover:border-white/40 rounded-xl py-3 text-white/50 hover:text-white transition-colors shrink-0">
            + Upload new image
          </button>
          <div className="overflow-y-auto flex-1 min-h-0">
            {galleryLoading
              ? <p className="text-sm text-white/40 text-center py-6">Loading…</p>
              : galleryImages.length === 0
              ? <p className="text-sm text-white/40 italic text-center py-6">No images yet.</p>
              : (
                <div className="grid grid-cols-3 gap-2">
                  {galleryImages.map(img => (
                    <button key={img.name} type="button"
                      onClick={() => onChoose(img.publicUrl)}
                      className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${currentPortrait === img.publicUrl ? "border-primary" : "border-transparent hover:border-white/40"}`}>
                      <img src={img.publicUrl} alt={img.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
