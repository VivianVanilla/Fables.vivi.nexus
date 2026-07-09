import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { BookOpenText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUserContext } from "../../src/contexts/UserContext"
import { uniqueName } from "./character-utils"
import { supabase } from "../../src/supabase"
import { Link } from "react-router-dom"



// ── Test Data ────────────────────────────────────────────────────────────
const RACES = [
  "Human", "Elf", "Dwarf", "Halfling", "Gnome", "Half-Elf",
  "Half-Orc", "Tiefling", "Dragonborn", "Aasimar", "Tabaxi", "Other",
]

const CLASSES = [
  "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk",
  "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard", "Artificer",
]

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function clampLevel(n: number) {
  return Math.min(20, Math.max(1, Math.floor(n) || 1))
}

function generatePartyCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

interface ClassEntry { cls: string; level: number }

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function FolderForm({ onCreated }: { onCreated: () => void }) {
  const { createObject } = useUserContext()
  const [name, setName] = useState("New Folder")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      await createObject({ name, type: "folder" })
      onCreated()
    } catch (e: any) {
      setError(e.message ?? "Failed to create folder")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Create a Folder</DialogTitle>
        <DialogDescription>Choose a name. You can change this later.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <Label htmlFor="folder-name">Name</Label>
          <Input id="folder-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function CharacterForm({ onCreated }: { onCreated: () => void }) {
  const { createObject } = useUserContext()
  const [name, setName] = useState("New Character")
  const [race, setRace] = useState(RACES[0])
  const [multiclass, setMulticlass] = useState(false)
  const [classes, setClasses] = useState<ClassEntry[]>([{ cls: CLASSES[0], level: 1 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalLevel = classes.reduce((sum, c) => sum + c.level, 0)

  function setClassEntry(index: number, field: keyof ClassEntry, value: string | number) {
    setClasses((prev) =>
      prev.map((entry, i) =>
        i === index ? { ...entry, [field]: field === "level" ? clampLevel(Number(value)) : value } : entry
      )
    )
  }

  function addClass() {
    if (totalLevel >= 20) return
    setClasses((prev) => [...prev, { cls: CLASSES[0], level: 1 }])
  }

  function removeClass(index: number) {
    setClasses((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      // Build a display string for class (e.g. "Fighter 3 / Rogue 2" or just "Fighter")
      const classDisplay = multiclass
        ? classes.map(c => `${c.cls} ${c.level}`).join(" / ")
        : classes[0]?.cls ?? ""

      await createObject({
        name,
        type: "character",
        data: {
          race,
          class: classDisplay,
          level: totalLevel,
          multiclass,
          classes,
        },
      })
      onCreated()
    } catch (e: any) {
      setError(e.message ?? "Failed to create character")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create a Character</DialogTitle>
        <DialogDescription>Fill in the basics. Everything can be edited later.</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        {/* Name */}
        <Field>
          <Label htmlFor="char-name">Name</Label>
          <Input id="char-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        {/* Race */}
        <Field>
          <Label htmlFor="char-race">Race</Label>
          <select
            id="char-race"
            value={race}
            onChange={(e) => setRace(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {RACES.map((r) => <option key={r} className="bg-zinc-800 text-white">{r}</option>)}
          </select>
        </Field>

        {/* Multiclass toggle */}
        <Field>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
            <input
              type="checkbox"
              checked={multiclass}
              onChange={(e) => {
                setMulticlass(e.target.checked)
                if (!e.target.checked) setClasses([classes[0]])
              }}
              className="rounded border-input"
            />
            Multiclass
          </label>
        </Field>

        {/* Class entries */}
        <div className="flex flex-col gap-2">
          {classes.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={entry.cls}
                onChange={(e) => setClassEntry(i, "cls", e.target.value)}
                className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CLASSES.map((c) => <option key={c} className="bg-zinc-800 text-white">{c}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" type="button"
                  onClick={() => setClassEntry(i, "level", entry.level - 1)}
                  disabled={entry.level <= 1}
                >−</Button>
                <Input
                  type="number" min={1} max={20}
                  value={entry.level}
                  onChange={(e) => setClassEntry(i, "level", e.target.value)}
                  className="w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Button
                  variant="outline" size="sm" type="button"
                  onClick={() => setClassEntry(i, "level", entry.level + 1)}
                  disabled={totalLevel >= 20}
                >+</Button>
              </div>
              {multiclass && classes.length > 1 && (
                <Button variant="ghost" size="sm" type="button" onClick={() => removeClass(i)}>✕</Button>
              )}
            </div>
          ))}

          {multiclass && totalLevel < 20 && (
            <Button variant="outline" size="sm" type="button" onClick={addClass}>
              + Add Class
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            Total level: <span className={totalLevel > 20 ? "text-destructive font-bold" : "font-medium"}>{totalLevel}</span>
            {totalLevel > 20 && " — exceeds level 20 cap"}
          </p>
        </div>
      </FieldGroup>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={handleCreate} disabled={saving || !name.trim() || totalLevel > 20}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

async function isPartyCodeTaken(code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("objects")
    .select("id")
    .filter("data->>partyCode", "eq", code)
    .limit(1)
  if (error) { console.error("party code check failed:", error); return false }
  return (data ?? []).length > 0
}

function CampaignForm({ onCreated }: { onCreated: () => void }) {
  const { createObject } = useUserContext()
  const [name, setName] = useState("New Campaign")
  const [partyCode, setPartyCode] = useState(() => generatePartyCode())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codeTaken, setCodeTaken] = useState(false)
  const [checkingCode, setCheckingCode] = useState(false)

  // Live-check as the user types/regenerates, plus a final check on submit —
  // codes are otherwise just random strings with no uniqueness guarantee.
  useEffect(() => {
    const code = partyCode.trim().toUpperCase()
    if (!code) { setCodeTaken(false); return }
    setCheckingCode(true)
    const t = setTimeout(() => {
      isPartyCodeTaken(code).then(taken => { setCodeTaken(taken); setCheckingCode(false) })
    }, 300)
    return () => clearTimeout(t)
  }, [partyCode])

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      const code = partyCode.trim().toUpperCase()
      if (await isPartyCodeTaken(code)) {
        setCodeTaken(true)
        setError("That code is already in use — try a different one.")
        return
      }
      await createObject({
        name,
        type: "campaign",
        data: { partyCode: code },
      })
      onCreated()
    } catch (e: any) {
      setError(e.message ?? "Failed to create campaign")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Create a Campaign</DialogTitle>
        <DialogDescription>Share the party code with your players so they can link their characters.</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <Label htmlFor="campaign-name">Campaign Name</Label>
          <Input id="campaign-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="party-code">Party Code</Label>
          <div className="flex gap-2">
            <Input
              id="party-code"
              value={partyCode}
              onChange={(e) => setPartyCode(e.target.value.toUpperCase().slice(0, 8))}
              className={`font-mono tracking-widest ${codeTaken ? "border-destructive" : ""}`}
              placeholder="ABC123"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setPartyCode(generatePartyCode())}
              title="Generate new code"
            >
              ↺
            </Button>
          </div>
          {checkingCode ? (
            <p className="text-xs text-muted-foreground mt-1">Checking availability…</p>
          ) : codeTaken ? (
            <p className="text-xs text-destructive mt-1">This code is already in use — try another or regenerate.</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Players enter this code in the Info tab of their character sheet.</p>
          )}
        </Field>
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={handleCreate} disabled={saving || checkingCode || codeTaken || !name.trim() || !partyCode.trim()}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function SimpleForm({
  title,
  description,
  type,
  defaultName,
  onCreated,
}: {
  title: string
  description: string
  type: string
  defaultName: string
  onCreated: () => void
}) {
  const { createObject, objects } = useUserContext()
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      // Notes are looked up by name for [[wikilinks]] — keep them unique so
      // a link never resolves ambiguously.
      const finalName = type === "note"
        ? uniqueName(name, objects.filter(o => o.type === "note").map(o => o.name))
        : name
      await createObject({ name: finalName, type, data: {} })
      onCreated()
    } catch (e: any) {
      setError(e.message ?? "Failed to create")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <Label htmlFor={`${type}-name`}>Name</Label>
          <Input
            id={`${type}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
      </FieldGroup>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button onClick={handleCreate} disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function SearchForm({ ...props }: React.ComponentProps<"div">) {
  const [menuOpen, setMenuOpen] = useState(false)


  function closeAll() {
    setMenuOpen(false)
  }

  return (
    <div {...props} className="relative">
      <div className="flex items-center gap-2">
        <SidebarGroup className="py-0">
          <SidebarGroupContent className="relative">

              <Link to="/documentation" className="flex items-center gap-2 w-full px-2 py-1 text-sm text-muted-foreground hover:bg-muted/50 rounded-md" >
            <BookOpenText className="" />
            <p>Documentation</p>
           </Link>

          </SidebarGroupContent>
        </SidebarGroup>

        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
        >
          +
        </Button>
      </div>

      {menuOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-56 overflow-hidden rounded-md bg-card shadow-lg ring-1 ring-border">
          <div className="p-3">
            <h3 className="text-sm font-medium text-foreground mb-2">Create New</h3>
            <div className="flex flex-col gap-1">

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start w-full">Folder</Button>
                </DialogTrigger>
                <FolderForm onCreated={closeAll} />
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start w-full"> Character</Button>
                </DialogTrigger>
                <CharacterForm onCreated={closeAll} />
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start w-full"> Campaign</Button>
                </DialogTrigger>
                <CampaignForm onCreated={closeAll} />
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start w-full"> Monster</Button>
                </DialogTrigger>
                <SimpleForm
                  title="Create a Monster"
                  description="Choose a name for your monster. You can edit details later."
                  type="monster"
                  defaultName="New Monster"
                  onCreated={closeAll}
                />
              </Dialog>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="justify-start w-full"> Note</Button>
                </DialogTrigger>
                <SimpleForm
                  title="Create a Note"
                  description="Choose a name for your note."
                  type="note"
                  defaultName="New Note"
                  onCreated={closeAll}
                />
              </Dialog>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
