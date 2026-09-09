import { Modal } from "@/components/shared/ui/Modal"
import type { ActiveCondition } from "@/components/shared/types"
import { ALL_CONDITIONS } from "@/components/shared/constants"

interface Props {
  conditions: ActiveCondition[]
  onAdd: (name: string) => void
  onClose: () => void
  card: string   // this character's own card styling — this modal's shell inherits it instead of a fixed generic look
}

export function ConditionPickerModal({ conditions, onAdd, onClose, card }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className={`${card} shadow-2xl w-64 flex flex-col overflow-hidden`}>
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-base font-bold text-white">Add Condition</p>
        </div>
        <div className="p-3 grid grid-cols-2 gap-1">
          {ALL_CONDITIONS.map(name => (
            <button key={name} type="button" onClick={() => onAdd(name)}
              className={`text-sm px-3 py-2.5 rounded-xl text-left font-medium transition-colors ${conditions.find(c => c.name === name) ? "text-white/25 cursor-default" : "text-white/80 hover:bg-white/10 hover:text-white"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
