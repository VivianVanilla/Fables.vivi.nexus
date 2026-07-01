import { Modal } from "../ui/Modal"
import type { ActiveCondition } from "../../character-types"

const ALL_CONDITIONS = [
  "Blinded", "Charmed", "Concentrating", "Deafened", "Exhaustion",
  "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed",
  "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
]

interface Props {
  conditions: ActiveCondition[]
  onAdd: (name: string) => void
  onClose: () => void
}

export function ConditionPickerModal({ conditions, onAdd, onClose }: Props) {
  return (
    <Modal onClose={onClose}>
      <div className="bg-zinc-900 border border-white/20 rounded-2xl shadow-2xl w-64 flex flex-col overflow-hidden">
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
