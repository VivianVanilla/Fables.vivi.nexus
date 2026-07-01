import { Plus } from 'lucide-react'
import { CLASS_OPTIONS, CLASS_COLORS, DAMAGE_TYPES, SCHOOLS, CASTING } from './constants'
import type { Spell } from './types'
import { MarkdownTextarea } from '@/components/ui/MarkdownTextarea'

export interface SpellDraft {
  name: string
  level: number
  school: string
  classes: string[]
  damageType: string
  components: string[]
  range: string
  duration: string
  desc: string
  casting_time: string
  ctag: string
  materialComponents: boolean
  materials: string
  ritual: boolean
}

export const DEFAULT_DRAFT: SpellDraft = {
  name: '',
  level: 0,
  school: 'Evocation',
  classes: [],
  damageType: 'Fire',
  components: ['V'],
  range: '',
  duration: '',
  desc: '',
  casting_time: '1 Action',
  ctag: '',
  materialComponents: false,
  materials: '',
  ritual: false,
}

interface Props {
  draft: SpellDraft
  setDraft: React.Dispatch<React.SetStateAction<SpellDraft>>
  onSave: () => void
  editingIndex: string | null
}

const inputCls = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-slate-500 transition-colors'
const selectCls = `${inputCls} cursor-pointer`

export function AddSpellForm({ draft, setDraft, onSave, editingIndex }: Props) {
  const set = <K extends keyof SpellDraft>(key: K, val: SpellDraft[K]) =>
    setDraft((p) => ({ ...p, [key]: val }))

  const toggleClass = (cls: string) =>
    setDraft((p) => ({
      ...p,
      classes: p.classes.includes(cls)
        ? p.classes.filter((c) => c !== cls)
        : [...p.classes, cls],
    }))

  return (
    <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl mb-6">
      <h2 className="flex items-center gap-2 text-base font-semibold mb-4 text-slate-200">
        <Plus className="size-4" />
        {editingIndex ? 'Edit Spell' : 'Add Spell'}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          placeholder="Spell Name"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          className={inputCls}
        />

        <input
          type="number"
          placeholder="Level (0–9)"
          min={0} max={9}
          value={draft.level}
          onChange={(e) => set('level', Number(e.target.value))}
          className={inputCls}
        />

        <select value={draft.school} onChange={(e) => set('school', e.target.value)} className={selectCls}>
          {SCHOOLS.map((s) => <option key={s}>{s}</option>)}
        </select>

        <select value={draft.casting_time} onChange={(e) => set('casting_time', e.target.value)} className={selectCls}>
          {CASTING.map((t) => <option key={t}>{t}</option>)}
        </select>

        <select value={draft.damageType} onChange={(e) => set('damageType', e.target.value)} className={selectCls}>
          {DAMAGE_TYPES.map((d) => <option key={d}>{d}</option>)}
        </select>

        <select
          value={draft.ctag}
          onChange={(e) => set('ctag', e.target.value)}
          className={selectCls}
        >
          <option value="">Campaign Tag (none)</option>
          <option value="Twilight">Twilight</option>
          <option value="Special-Banned">Special/Banned</option>
          <option value="Squain">Squain</option>
        </select>

        <input
          placeholder="Range"
          value={draft.range}
          onChange={(e) => set('range', e.target.value)}
          className={inputCls}
        />

        <input
          placeholder="Duration"
          value={draft.duration}
          onChange={(e) => set('duration', e.target.value)}
          className={inputCls}
        />

        <input
          placeholder="Components (e.g. V, S, M)"
          value={draft.components.join(', ')}
          onChange={(e) =>
            set('components', e.target.value.split(',').map((c) => c.trim()))
          }
          className={`${inputCls} sm:col-span-2`}
        />

        <label className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.materialComponents}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                materialComponents: e.target.checked,
                materials: e.target.checked ? p.materials : '',
              }))
            }
            className="accent-purple-500"
          />
          <span className="text-sm text-slate-300">Material Components</span>
        </label>

        <label className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.ritual}
            onChange={(e) => set('ritual', e.target.checked)}
            className="accent-purple-500"
          />
          <span className="text-sm text-slate-300">Ritual</span>
        </label>

        {draft.materialComponents && (
          <input
            placeholder="Material components description"
            value={draft.materials}
            onChange={(e) => set('materials', e.target.value)}
            className={`${inputCls} sm:col-span-2`}
          />
        )}

        <MarkdownTextarea
          placeholder="Description (supports Markdown)"
          value={Array.isArray(draft.desc) ? (draft.desc as string[]).join('\n') : draft.desc}
          onChange={(v) => set('desc', v)}
          rows={6}
          className={`${inputCls} resize-y`}
          wrapperClassName="flex flex-col gap-1.5 sm:col-span-2"
        />

        <div className="sm:col-span-2">
          <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Classes</p>
          <div className="flex flex-wrap gap-1.5">
            {CLASS_OPTIONS.map((cls) => {
              const active = draft.classes.includes(cls)
              const color = CLASS_COLORS[cls]
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleClass(cls)}
                  className="px-2.5 py-1 rounded-lg text-xs transition-all"
                  style={{
                    backgroundColor: active ? `${color}40` : 'transparent',
                    border: `1px solid ${active ? color : `${color}50`}`,
                    color: 'white',
                  }}
                >
                  {cls}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <button
        onClick={onSave}
        className="mt-4 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
      >
        {editingIndex ? 'Save Changes' : 'Create Spell'}
      </button>
    </div>
  )
}

export function spellDraftToPayload(draft: SpellDraft): Spell {
  return {
    index: draft.name.toLowerCase().replaceAll(' ', '-'),
    name: draft.name,
    level: Number(draft.level),
    school: { name: draft.school },
    classes: draft.classes.map((c) => ({ name: c })),
    casting_time: draft.casting_time,
    range: draft.range,
    duration: draft.duration,
    components: draft.components,
    materialComponents: draft.materialComponents,
    materials: draft.materials,
    damageType: draft.damageType,
    ctag: draft.ctag,
    ritual: draft.ritual,
    desc: draft.desc
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  }
}
