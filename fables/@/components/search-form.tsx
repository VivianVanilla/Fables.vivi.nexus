import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
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
      await createObject({
        name,
        type: "character",
        data: {
          characterName: name,
          race,
          multiclass,
          classes,
          totalLevel,
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
            {RACES.map((r) => <option key={r}>{r}</option>)}
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
                {CLASSES.map((c) => <option key={c}>{c}</option>)}
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
  const { createObject } = useUserContext()
  const [name, setName] = useState(defaultName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setSaving(true)
    setError(null)
    try {
      await createObject({ name, type, data: {} })
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
            <Label htmlFor="search" className="sr-only">Search</Label>
            <SidebarInput
              id="search"
              placeholder="Search your stories"
              className="pl-8"
            />
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
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
