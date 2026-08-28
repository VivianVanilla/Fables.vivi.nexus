import { Modal } from "@/components/shared/ui/Modal"
import { NumInput } from "@/components/shared/ui/NumInput"
import type { CharacterData } from "@/components/shared/types"

interface Props {
  data: Pick<CharacterData, "martialSaveDC">
  readOnly?: boolean
  onUpdate: (patch: Partial<CharacterData>) => void
  onClose: () => void
  accentColor: string
}

// Martial's counterpart to InitiativeModal/ArmorClassModal — a small, single-
// purpose stat modal opened from the ⚙ next to "Martial" in SpellsEquipPanel.
// Just the DC for now (most martial abilities don't call for one, unlike
// spellcasting), but its own modal — not a popover tucked behind the gear
// button — leaves room to grow the same way Spellcasting's did.
export function MartialModal({ data, readOnly, onUpdate, onClose, accentColor }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-72 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <p className="text-base font-bold text-white">Martial</p>
          {!!data.martialSaveDC && (
            <span className="text-xl font-mono font-bold" style={{ color: accentColor }}>{data.martialSaveDC}</span>
          )}
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-widest text-white/40 font-semibold">Martial DC</p>
            <p className="text-[10px] text-white/30 -mt-1">
              For maneuvers or abilities that call for a save DC outside spellcasting (e.g. a Battle Master's).
              Leave blank to keep it off the Martial panel entirely.
            </p>
            <NumInput value={data.martialSaveDC ?? ""} placeholder="—" disabled={readOnly}
              onFocus={e => e.target.select()}
              onChange={e => onUpdate({ martialSaveDC: e.target.value ? parseInt(e.target.value) || 0 : undefined })}
              className="w-full text-center bg-white/10 rounded-xl px-3 py-3 text-xl font-bold text-white outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60"
            />
          </div>
        </div>
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm text-white font-semibold transition-colors"
            style={{ backgroundColor: accentColor + "30" }}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  )
}
