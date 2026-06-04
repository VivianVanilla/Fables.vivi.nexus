import * as React from "react"
import { ChevronDown } from "lucide-react"

import { SearchForm } from "@/components/search-form"
import { VersionSwitcher } from "@/components/version-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"


const navMain = [
    {
      title: "Characters",
      color: "#fb7185",
      url: "#",
      items: [
        {
          title: "test",
          url: "#",
        },
        {
          title: "test2",
          url: "#",
        },
      ],
    },
    {
      title: "Notes",
      color: "#38bdf8",
      url: "#",
      items: [
        {
          title: "notes1",
          url: "#",
        },
        {
          title: "Data Fetching",
          url: "#",
          isActive: true,
        },
        {
          title: "Rendering",
          url: "#",
        },
        {
          title: "Caching",
          url: "#",
        },
        {
          title: "Styling",
          url: "#",
        },
        {
          title: "Optimizing",
          url: "#",
        },
        {
          title: "Configuring",
          url: "#",
        },
        {
          title: "Testing",
          url: "#",
        },
        {
          title: "Authentication",
          url: "#",
        },
        {
          title: "Deploying",
          url: "#",
        },
        {
          title: "Upgrading",
          url: "#",
        },
        {
          title: "Examples",
          url: "#",
        },
      ],
    },
    {
      title: "Monsters",
      url: "#",
      color: "#496774",
      items: [
        {
          title: "Components",
          url: "#",
        },
        {
          title: "File Conventions",
          url: "#",
        },
        {
          title: "Functions",
          url: "#",
        },
        {
          title: "next.config.js Options",
          url: "#",
        },
        {
          title: "CLI",
          url: "#",
        },
        {
          title: "Edge Runtime",
          url: "#",
        },
      ],
    },
    {
      title: "Spell Lists",
      url: "#",
      color: "#725608",
      items: [
        {
          title: "Accessibility",
          url: "#",
        },
        {
          title: "Fast Refresh",
          url: "#",
        },
        {
          title: "Next.js Compiler",
          url: "#",
        },
        {
          title: "Supported Browsers",
          url: "#",
        },
        {
          title: "Turbopack",
          url: "#",
        },
      ],
    },
  ]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [openGroups, setOpenGroups] = React.useState(
    () =>
      Object.fromEntries(
        navMain.map((item) => [item.title, false])
      ) as Record<string, boolean>
  )

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }))
  }

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <VersionSwitcher />
        <SearchForm />
      </SidebarHeader>
      <SidebarContent>
        {/* We create a SidebarGroup for each parent. */}
        {navMain.map((item) => {
          const isOpen = openGroups[item.title]
          return (
            <SidebarGroup key={item.title}>
              <SidebarGroupLabel asChild>
                <button
                  type="button"
                  onClick={() => toggleGroup(item.title)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1 text-left text-xs font-medium text-sidebar-foreground/70 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  style={item.color ? { borderColor: `${item.color}33` } : undefined}
                >
                  <span className="flex items-center gap-2">
                    {item.color ? (
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                    ) : null}
                    <span>{item.title}</span>
                  </span>
                  <ChevronDown
                    className={`size-4 transition-transform duration-150 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    style={item.color ? { color: item.color } : undefined}
                  />
                </button>
              </SidebarGroupLabel>
              <SidebarGroupContent className={isOpen ? "" : "hidden"}>
                <SidebarMenu>
                  {item.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={item.isActive}>
                        <a href={item.url}>{item.title}</a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
