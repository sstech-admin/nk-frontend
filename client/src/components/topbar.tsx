import { Bell, Search, Globe, Maximize2, Menu, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, getUserInitial } from "@/lib/auth-context";
import { LogOut, Settings, User, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme-provider";

export function Topbar() {
  const { user, logout } = useAuth();
  const { toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex items-center justify-between gap-4 border-b px-4 py-2.5 bg-background sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 md:hidden"
          onClick={toggleSidebar}
          data-testid="button-mobile-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hidden md:inline-flex"
          onClick={toggleSidebar}
          data-testid="button-sidebar-toggle"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-current">
            <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <line x1="6" y1="1" x2="6" y2="15" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Button>

        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white border border-border">
            <img
              src="/nk-logo.png"
              alt="NK Tech Craft"
              className="h-5 w-5 object-contain"
            />
          </div>
          <span className="text-sm font-bold tracking-tight">NK Tech Craft</span>
        </div>

        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="w-72 pl-9 bg-muted/50"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="hidden md:flex items-center gap-1">
          <Button variant="ghost" size="icon" data-testid="button-fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" data-testid="button-globe">
            <Globe className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" data-testid="button-notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-destructive" />
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden relative" data-testid="button-mobile-actions">
              <MoreVertical className="h-5 w-5" />
              <span className="absolute top-1 right-1.5 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem data-testid="menuitem-mobile-fullscreen">
              <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme} data-testid="menuitem-mobile-theme">
              {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="menuitem-mobile-language">
              <Globe className="mr-2 h-4 w-4" /> Language
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="menuitem-mobile-notifications">
              <Bell className="mr-2 h-4 w-4" /> Notifications
              <span className="ml-auto h-2 w-2 rounded-full bg-destructive" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-user-menu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-sidebar-primary text-white font-semibold">
                  {getUserInitial(user)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem data-testid="menuitem-profile">
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem data-testid="menuitem-settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} data-testid="menuitem-logout">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
