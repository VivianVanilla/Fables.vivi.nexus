"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useUser } from "../../src/contexts/UserContext"
import { supabase } from "../../src/supabase"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react"
import { ProfileSettingsModal } from "@/components/profile-settings-modal"

export function VersionSwitcher() {
  const user = useUser()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = React.useState(false)

  const fullName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "User"

  const avatarUrl = user?.user_metadata?.avatar_url

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/")
  }

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex  size-10 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-hidden">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="size-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">Account</span>
                  <span className="text-xs">{fullName}</span>
                </div>
                <ChevronsUpDownIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width)"
              align="start"
            >
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {user?.email}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <SettingsIcon className="mr-2 size-4" />
                Profile Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOutIcon className="mr-2 size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <ProfileSettingsModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
      />
    </>
  )
}
