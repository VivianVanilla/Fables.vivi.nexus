import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  const [open, setOpen] = useState(false)

  return (
    <form {...props} className="relative">
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
        <div className=" absolute top-full z-50 mt-2 w-72 overflow-hidden rounded-md bg-white shadow-lg">
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900">Create a New Fable</h3>
      <p className="mt-1 text-sm text-gray-500"></p>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="outline" size="sm" type="button">
          Folder Page
        </Button>
        <Button variant="outline" size="sm" type="button">
          Character Page
        </Button>
        <Button variant="outline" size="sm" type="button">
         Monster Page
        </Button>
         <Button variant="outline" size="sm" type="button">
         Note Page
        </Button>
      </div>
    </div>
  </div>
)}


          </div>
    </form>
  )
}
