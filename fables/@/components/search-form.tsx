import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger, } from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SearchForm({ ...props }: React.ComponentProps<"div">) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<number>(1)

  return (
    <div {...props} className="relative">
      <div className="flex items-center gap-2">
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
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
        onClick={() => setOpen((value) => !value)}
      >
        +
      </Button>
      {open && (
        <div className=" absolute top-full z-50 mt-2 w-72 overflow-hidden rounded-md bg-card shadow-lg ring-1 ring-border">
    <div className="p-4">
      <h3 className="text-sm font-medium text-foreground">Create a New Fable</h3>
      <p className="mt-1 text-sm text-muted-foreground"></p>
      <div className="mt-4 flex flex-col gap-2">

         <Dialog>
      <form className="mt-4 flex flex-col">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
          Folder
        </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a Folder</DialogTitle>
            <DialogDescription>
             Choose a name and a color for your new folder. You can always change these later.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="folder-name">Name</Label>
              <Input id="folder-name" name="name" defaultValue="Default Folder" />
            </Field>
            <Field>
              <Label htmlFor="folder-color">Color</Label>
              <Input type="color" id="folder-color" name="color" defaultValue="#000000" className="w-16 h-16 p-1" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>

     
          <Dialog>
      <form className="flex flex-col gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
          Character Page
        </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a Character</DialogTitle>
            <DialogDescription>
             Choose a name for your new character. You can always change these later.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="character-name">Character Name</Label>
              <Input id="character-name" required name="name" defaultValue="Default Dink" />
            </Field>
            <Field>
              <Label htmlFor="character-level">Level</Label>
              <div className="mt-1 flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setLevel((v) => Math.max(1, v - 1))}
                >
                  −
                </Button>
                <Input
                  id="character-level"
                  name="level"
                  type="number"
                  min={1}
                  max={20}
                  value={level}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const n = Number(e.target.value) || 1
                    setLevel(Math.min(20, Math.max(1, Math.floor(n))))
                  }}
                  className="w-20 text-center"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"  
                  onClick={() => setLevel((v) => Math.min(20, v + 1))}
                >
                  +
                </Button>
              </div>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>

                <Dialog>
      <form className="flex flex-col gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
          Monster Page
        </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a Monster</DialogTitle>
            <DialogDescription>
             Choose a name for your new monster. You can always change these later.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="monster-name">Monster Name</Label>
              <Input id="monster-name" required name="name" defaultValue="Default Dinkasaurus" />
            </Field>
            <Field>
              
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>

          <Dialog>
      <form className="flex flex-col gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" type="button">
          Note Page
        </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a Note</DialogTitle>
            <DialogDescription>
             Choose a name for your new note. You can always change this later.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <Label htmlFor="note-name">Note Name</Label>
              <Input id="note-name" required name="name" defaultValue="Default Note" />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </DialogContent>
      </form>
    </Dialog>
      </div>
    </div>
  </div>
)}


          </div>
    </div>
  )
}
