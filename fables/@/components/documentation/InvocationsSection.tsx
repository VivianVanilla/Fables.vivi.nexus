// ════════════════════════════════════════════════════════════════════════════
// InvocationsSection.tsx — Eldritch Invocations, embedded as a titled section on
// the Feats documentation page. Deliberately independent of DocEntryForm/DocBrowser's
// generic feat CRUD — invocations have their own shape (Name / Prerequisite /
// Description only, no ASI/benefits list) and their own add flow, and feed a
// separate "invocation" suggestion source for autofill on the character sheet's
// Invocations tab (see FeatureEntry.tsx's getSuggestions()).
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react"
import { supabase } from "../../../src/supabase"
import { Pencil, Loader2, Sparkles } from "lucide-react"
import { MarkdownTextarea } from "../ui/MarkdownTextarea"
import { Markdown } from "../ui/Markdown"
import { invalidateSuggestionCache } from "../character/entries/FeatureEntry"

const INVOCATION_TYPE = "invocation"

interface InvocationEntry {
  id: string
  name: string
  is_homebrew: boolean
  owner_id: string | null
  data: { prerequisite?: string; description?: string }
}

// ── Card ──────────────────────────────────────────────────────────────────────

function InvocationCard({ name, prerequisite, canEdit, onClick, onEdit }: {
  name: string
  prerequisite?: string
  canEdit?: boolean
  onClick: () => void
  onEdit?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-violet-900/40 bg-violet-950/20 p-3 hover:border-violet-700/60 hover:bg-violet-950/40 transition-all min-h-[80px] text-center w-full"
    >
      {canEdit && onEdit && (
        <span
          role="button"
          onClick={e => { e.stopPropagation(); onEdit() }}
          className="absolute top-2 right-2 size-6 flex items-center justify-center rounded hover:bg-violet-500/20 text-slate-700 hover:text-violet-300 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Pencil className="size-3" />
        </span>
      )}
      <p className="text-sm font-semibold text-slate-200 leading-tight px-5">{name}</p>
      {prerequisite && <p className="text-[10px] text-slate-600 leading-tight">{prerequisite}</p>}
    </button>
  )
}

// ── Independent create/edit form ─────────────────────────────────────────────

function InvocationForm({ initial, isHomebrew, userId, onSave, onCancel, onDelete }: {
  initial?: InvocationEntry
  isHomebrew: boolean
  userId: string | null
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name,   setName]   = useState(initial?.name ?? "")
  const [prereq, setPrereq] = useState(initial?.data?.prerequisite ?? "")
  const [desc,   setDesc]   = useState(initial?.data?.description ?? "")
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function save() {
    if (!name.trim()) { setError("Name is required."); return }
    setSaving(true)
    setError("")
    const payload = {
      name: name.trim(),
      type: INVOCATION_TYPE,
      description: "",
      is_homebrew: isHomebrew,
      owner_id: isHomebrew ? userId : null,
      source: isHomebrew ? "homebrew" : "2014",
      data: { prerequisite: prereq.trim(), description: desc },
    }
    const q = initial?.id
      ? supabase.from("documentation").update(payload).eq("id", initial.id)
      : supabase.from("documentation").insert(payload)
    const { error: err } = await q
    setSaving(false)
    if (err) { setError(err.message); return }
    invalidateSuggestionCache()
    onSave()
  }

  async function handleDelete() {
    if (!initial?.id) return
    setSaving(true)
    await supabase.from("documentation").delete().eq("id", initial.id)
    setSaving(false)
    onDelete?.()
  }

  return (
    <div className="max-w-xl rounded-xl border border-violet-900/40 bg-violet-950/10 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-violet-400" />
        <h3 className="text-sm font-bold text-slate-100">
          {initial ? "Edit" : "New"} Eldritch Invocation{isHomebrew ? "" : " (Core)"}
        </h3>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-400">Name</span>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Agonizing Blast"
          className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-700" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-400">Prerequisite</span>
        <input value={prereq} onChange={e => setPrereq(e.target.value)} placeholder="5th level, eldritch blast cantrip"
          className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-700" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-slate-400">Description</span>
        <MarkdownTextarea
          value={desc} onChange={setDesc} rows={6}
          placeholder="What the invocation does…"
          className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 outline-none focus:border-violet-700 resize-none leading-relaxed"
        />
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        {onDelete ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Delete this invocation?</span>
              <button onClick={handleDelete} disabled={saving} className="text-xs px-2 py-1 rounded bg-red-600/80 hover:bg-red-600 text-white">Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded border border-slate-700 text-slate-400">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400/70 hover:text-red-400">Delete</button>
          )
        ) : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded border border-slate-700 text-slate-400 hover:text-slate-200">Cancel</button>
          <button onClick={save} disabled={saving}
            className="text-xs px-3 py-1.5 rounded bg-violet-600/80 hover:bg-violet-600 text-white font-semibold disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface Props {
  userId: string | null
  isAdminMode: boolean
  refreshKey?: number  // bump to force a reload — used when a homebrew invocation
                         // is created elsewhere (the Feats homebrew form's toggle)
}

export function InvocationsSection({ userId, isAdminMode, refreshKey }: Props) {
  const [core,    setCore]    = useState<InvocationEntry[]>([])
  const [mine,    setMine]    = useState<InvocationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mode,    setMode]    = useState<"list" | "create" | "edit" | "view">("list")
  const [active,  setActive]  = useState<InvocationEntry | null>(null)
  const [createHomebrew, setCreateHomebrew] = useState(false)

  const mounted = useRef(false)
  useEffect(() => {
    load(mounted.current)
    mounted.current = true
  }, [userId, refreshKey])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    const [coreRes, mineRes] = await Promise.all([
      supabase.from("documentation").select("*").eq("type", INVOCATION_TYPE).eq("is_homebrew", false).order("name"),
      userId
        ? supabase.from("documentation").select("*").eq("type", INVOCATION_TYPE).eq("is_homebrew", true).eq("owner_id", userId).order("name")
        : Promise.resolve({ data: [] as InvocationEntry[] }),
    ])
    setCore((coreRes.data ?? []) as InvocationEntry[])
    setMine((mineRes.data ?? []) as InvocationEntry[])
    setLoading(false)
  }

  function openCreate(asHomebrew: boolean) { setCreateHomebrew(asHomebrew); setActive(null); setMode("create") }
  function openEdit(entry: InvocationEntry)  { setActive(entry); setMode("edit") }
  function handleSaved() { load(true); setMode("list"); setActive(null) }

  if (mode === "create" || mode === "edit") {
    const isHomebrew = mode === "create" ? createHomebrew : !!active?.is_homebrew
    const canDelete  = !!active?.id && (isAdminMode || (isHomebrew && !!userId && active?.owner_id === userId))
    return (
      <section className="mt-10">
        <InvocationForm
          initial={active ?? undefined}
          isHomebrew={isHomebrew}
          userId={userId}
          onSave={handleSaved}
          onCancel={() => setMode(active ? "view" : "list")}
          onDelete={canDelete ? handleSaved : undefined}
        />
      </section>
    )
  }

  if (mode === "view" && active) {
    const canEdit = isAdminMode || (!!userId && active.owner_id === userId)
    return (
      <section className="mt-10 max-w-xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => { setMode("list"); setActive(null) }} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            ← Back
          </button>
          {canEdit && (
            <button onClick={() => openEdit(active)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-violet-900/50 text-violet-400 hover:border-violet-700 transition-colors">
              <Pencil className="size-3" /> Edit
            </button>
          )}
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-1">{active.name}</h2>
        {active.data?.prerequisite && <p className="text-sm text-slate-500 italic mb-4">Prerequisite: {active.data.prerequisite}</p>}
        {active.data?.description && <Markdown text={active.data.description} tone="slate" />}
      </section>
    )
  }

  const entries = [...core, ...mine]

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-base font-bold text-violet-400 flex items-center gap-1.5">
          <Sparkles className="size-4" /> Eldritch Invocations{!loading && entries.length > 0 ? ` (${entries.length})` : ""}
        </h2>
        {isAdminMode && (
          <button onClick={() => openCreate(false)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-violet-900/50 text-violet-400 hover:border-violet-700 transition-colors">
            <Pencil className="size-3" /> Add Invocation
          </button>
        )}
      </div>
      <div className="border-t border-violet-900/30 mb-4" />

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-slate-600">
          <Loader2 className="size-4 animate-spin" /><span className="text-sm">Loading…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-slate-800 rounded-lg">
          <p className="text-sm text-slate-600">No invocations yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {entries.map(entry => (
            <InvocationCard key={entry.id} name={entry.name} prerequisite={entry.data?.prerequisite}
              canEdit={isAdminMode || (!!userId && entry.owner_id === userId)}
              onClick={() => { setActive(entry); setMode("view") }}
              onEdit={() => openEdit(entry)} />
          ))}
        </div>
      )}
    </section>
  )
}
